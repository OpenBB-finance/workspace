"""Tests for POST /admin/users/{uuid}/export.

The archive contents are covered by the export and round-trip tests; this file
covers only what the endpoint adds: who is allowed to call it, what happens for
an unknown user, and that the response is a real downloadable zip rather than
JSON.

An org admin must not be able to export accounts outside their own entity --
that is the one failure here that would leak another customer's data.
"""

import io
import json
from uuid import uuid4
from zipfile import ZipFile

import pytest
import sqlalchemy as sa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session

from api import auth_helpers, models
from api.database import aget_read_db
from api.models.model_helpers import Base
from api.rate_limit import limiter
from routers import admin

ENTITY_A, ENTITY_B = uuid4(), uuid4()
MAP_A, MAP_B = uuid4(), uuid4()

TARGET_A = uuid4()  # belongs to entity A
TARGET_B = uuid4()  # belongs to entity B
ADMIN_A = uuid4()  # org admin of entity A
SUPERUSER = uuid4()


def _entity(session, uuid, name, entity_type_uuid):
    session.add(models.Entity(uuid=uuid, name=name, entity_type_uuid=entity_type_uuid))
    session.flush()


def _user(uuid, email, permissions_uuid, **kw):
    return models.User(
        uuid=uuid,
        email=email,
        clean_email=email,
        username=email.split("@")[0],
        password="pw",
        confirmed=True,
        permissions_uuid=permissions_uuid,
        **kw,
    )


@pytest.fixture(scope="module")
def sessions(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("admin") / "hub.db"
    sync = sa.create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(sync)

    with Session(sync) as session:
        # entity_type.code is UNIQUE, so both orgs share one type.
        etype = models.EntityType(
            uuid=uuid4(), entity_type="CORPORATION", code="CORP"
        )
        session.add(etype)
        session.flush()
        _entity(session, ENTITY_A, "Org A", etype.uuid)
        _entity(session, ENTITY_B, "Org B", etype.uuid)
        session.add_all([
            models.PermissionsEntityMap(uuid=MAP_A, entity_uuid=ENTITY_A, name="Admin"),
            models.PermissionsEntityMap(uuid=MAP_B, entity_uuid=ENTITY_B, name="Admin"),
        ])
        session.flush()
        session.add_all([
            _user(TARGET_A, "target-a@example.com", MAP_A, first_name="A"),
            _user(TARGET_B, "target-b@example.com", MAP_B, first_name="B"),
            _user(ADMIN_A, "admin-a@example.com", MAP_A),
            _user(SUPERUSER, "root@example.com", MAP_A, is_superuser=True),
        ])
        session.flush()
        session.add(
            models.DashboardItem(
                uuid=uuid4(),
                owner_uuid=TARGET_A,
                creator_uuid=TARGET_A,
                content={"name": "A's dashboard"},
            )
        )
        session.commit()

    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
def client(sessions, monkeypatch):
    """An app with just the admin router, and the caller injectable per test."""
    monkeypatch.setattr(limiter, "enabled", False)

    async def fake_get_file(bucket, key):
        return None

    monkeypatch.setattr(admin.export_user_data.FileStorage, "get_file", staticmethod(fake_get_file))

    app = FastAPI()
    app.include_router(admin.router)
    app.state.limiter = limiter

    async def override_db():
        async with sessions() as session:
            yield session

    app.dependency_overrides[aget_read_db] = override_db

    def as_caller(caller_uuid):
        """Authenticate as this user.

        get_current_superuser is what the endpoint depends on; overriding it
        with a plain lookup lets a non-superuser reach the handler, which is
        exactly what the guard test below needs to prove is impossible in
        production. Those tests assert the real dependency instead.
        """

        async def override_caller():
            async with sessions() as session:
                return await session.get(models.User, caller_uuid)

        app.dependency_overrides[auth_helpers.get_current_superuser] = override_caller
        return TestClient(app)

    return as_caller


# --------------------------------------------------------------------------- #
# Authorisation
#
# A full account export includes credentials in the clear, so it is gated on
# superuser rather than the org-admin dependency the rest of /admin uses.
# --------------------------------------------------------------------------- #
def test_export_is_gated_on_superuser_not_org_admin():
    """The guard itself, asserted against the route's real dependency.

    The other tests in this file override authentication to reach the handler,
    so this is the one that proves an org admin cannot get in at all.
    """
    route = next(r for r in admin.router.routes if r.path.endswith("/export"))
    guards = {
        d.call.__name__ for d in route.dependant.dependencies if hasattr(d.call, "__name__")
    }

    assert "get_current_superuser" in guards
    assert "get_current_admin" not in guards, (
        "org admins must not be able to export accounts"
    )


def test_a_bad_token_is_rejected_by_the_real_dependency():
    """With no override, the genuine guard runs and refuses."""
    app = FastAPI()
    app.include_router(admin.router)
    app.state.limiter = limiter

    with TestClient(app) as raw:
        response = raw.post(
            f"/admin/users/{TARGET_A}/export",
            headers={"Authorization": "Bearer not-a-session-uuid"},
        )

    assert response.status_code in {401, 403}


def test_superuser_can_export_any_account(client):
    response = client(SUPERUSER).post(f"/admin/users/{TARGET_B}/export")

    assert response.status_code == 200


def test_unknown_user_is_a_404(client):
    response = client(SUPERUSER).post(f"/admin/users/{uuid4()}/export")

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


# --------------------------------------------------------------------------- #
# Response shape
# --------------------------------------------------------------------------- #
def test_response_is_a_downloadable_zip(client):
    response = client(SUPERUSER).post(f"/admin/users/{TARGET_A}/export")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "attachment; filename=" in response.headers["content-disposition"]
    assert ".zip" in response.headers["content-disposition"]

    with ZipFile(io.BytesIO(response.content)) as zf:
        names = set(zf.namelist())

    assert "manifest.json" in names
    assert "README.md" in names
    assert "data/user.jsonl" in names


def test_response_reports_row_and_file_counts(client):
    response = client(SUPERUSER).post(f"/admin/users/{TARGET_A}/export")

    assert int(response.headers["x-openbb-export-rows"]) > 0
    assert "x-openbb-export-files" in response.headers


def test_history_is_opt_in_via_query_param(client):
    caller = client(SUPERUSER)

    without = caller.post(f"/admin/users/{TARGET_A}/export")
    with_history = caller.post(
        f"/admin/users/{TARGET_A}/export", params={"include_history": "true"}
    )

    def names(response):
        with ZipFile(io.BytesIO(response.content)) as zf:
            return set(zf.namelist())

    assert "data/dashboard_save.jsonl" not in names(without)
    assert "data/dashboard_save.jsonl" in names(with_history)


def test_files_are_opt_in_over_http(client):
    """Blob download is what pushes the request past proxy idle timeouts."""
    caller = client(SUPERUSER)

    default = caller.post(f"/admin/users/{TARGET_A}/export")
    manifest = json.loads(ZipFile(io.BytesIO(default.content)).read("manifest.json"))

    assert manifest["options"]["with_files"] is False
    assert int(default.headers["x-openbb-export-files"]) == 0

    asked = caller.post(
        f"/admin/users/{TARGET_A}/export", params={"with_files": "true"}
    )
    manifest = json.loads(ZipFile(io.BytesIO(asked.content)).read("manifest.json"))

    assert manifest["options"]["with_files"] is True


def test_exported_archive_contains_only_the_requested_user(client):
    response = client(SUPERUSER).post(f"/admin/users/{TARGET_A}/export")

    with ZipFile(io.BytesIO(response.content)) as zf:
        blob = b"".join(zf.read(n) for n in zf.namelist())

    assert str(TARGET_B).encode() not in blob
    assert b"target-b@example.com" not in blob
