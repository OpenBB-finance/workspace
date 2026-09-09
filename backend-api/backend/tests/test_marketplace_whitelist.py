"""Integration tests for the marketplace submitter whitelist.

Covers the additions for the admin whitelist + submission gating feature:
  - GET  /admin/marketplace/validate (superuser probe; 401 otherwise)
  - GET/POST/DELETE /admin/marketplace/whitelist (flag toggles on User)
  - 403 enforcement on create/update/submit for non-whitelisted developers

Requires the backend test infra (MySQL + Redis via testcontainers):
    cd backend && poetry run pytest tests/test_marketplace_whitelist.py
"""

from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import update

from api import base
from api.models import User
from tests.fixtures.base import _AUTH_USER
from tests.fixtures.marketplace import (
    fake_verify as _fake_verify,
    post_create_app as _post_create,
    superuser_override as _superuser_override,
    whitelist_developer as _whitelist,
)


@pytest.mark.asyncio
async def test_non_whitelisted_cannot_create(auth_client):
    """A plain user is ineligible and blocked from creating apps."""
    resp = await _post_create(auth_client)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_whitelisted_user_can_create(auth_client):
    """Whitelisting flips eligibility to true and unblocks create."""
    _whitelist_entry = await _whitelist(auth_client, _AUTH_USER["email"])
    assert _whitelist_entry["email"] == _AUTH_USER["email"]

    resp = await _post_create(auth_client)
    assert resp.status_code == 200, resp.text
    app_id = resp.json()["app_id"]
    await auth_client.delete(f"/marketplace/developer/apps/{app_id}")


@pytest.mark.asyncio
async def test_superuser_bypasses_whitelist(auth_client, db_session):
    """A superuser is eligible and can create without being whitelisted."""
    await db_session.execute(
        update(User)
        .where(User.uuid == _AUTH_USER["user_uuid"])
        .values(is_superuser=True)
    )
    await db_session.commit()

    resp = await _post_create(auth_client)
    assert resp.status_code == 200, resp.text
    app_id = resp.json()["app_id"]
    await auth_client.delete(f"/marketplace/developer/apps/{app_id}")


@pytest.mark.asyncio
async def test_whitelist_is_idempotent(auth_client):
    """Adding the same email twice returns 200 both times and one flagged user."""
    first = await _whitelist(auth_client, _AUTH_USER["email"])
    second = await _whitelist(auth_client, _AUTH_USER["email"])
    assert first["uuid"] == second["uuid"]

    with _superuser_override():
        listed = await auth_client.get("/admin/marketplace/whitelist")
    assert listed.status_code == 200, listed.text
    matches = [e for e in listed.json() if e["email"] == _AUTH_USER["email"]]
    assert len(matches) == 1


@pytest.mark.asyncio
async def test_whitelist_normalizes_email(auth_client, db_session):
    """POST looks up by base.clean_email — dots and +suffix in the local part
    are stripped, so a differently-formatted address matches the stored user."""
    registered_email = "norm.dev+signup@example.com"
    stored_clean = base.clean_email(registered_email)  # "normdev@example.com"
    norm_user_uuid = "00000000-0000-0000-0000-0000000000a1"

    norm_user = User(
        uuid=norm_user_uuid,
        email=registered_email,
        clean_email=stored_clean,
        password="hashedpassword",  # noqa: S106
        confirmed=True,
    )
    db_session.add(norm_user)
    await db_session.commit()

    try:
        entry = await _whitelist(auth_client, "n.o.r.m.d.e.v+other@example.com")
        assert entry["uuid"] == norm_user_uuid
        assert entry["email"] == registered_email
    finally:
        # This user has a non-fixture UUID, so remove it to avoid leaking a
        # flagged row into later tests that share the session-scoped database.
        await db_session.execute(
            User.__table__.delete().where(User.uuid == norm_user_uuid)
        )
        await db_session.commit()


@pytest.mark.asyncio
async def test_whitelist_unknown_email_404(auth_client):
    """Whitelisting an email with no OpenBB account is a 404, not a 500."""
    with _superuser_override():
        resp = await auth_client.post(
            "/admin/marketplace/whitelist",
            json={"email": f"nobody-{uuid4().hex[:8]}@example.com"},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_dewhitelist_blocks_writes_but_keeps_reads(auth_client):
    """After removing the flag: create/update/submit 403, but list/verify/delete
    of existing drafts still work."""
    await _whitelist(auth_client, _AUTH_USER["email"])
    created = await _post_create(auth_client)
    assert created.status_code == 200, created.text
    app_id = created.json()["app_id"]

    with _superuser_override():
        removed = await auth_client.delete(
            f"/admin/marketplace/whitelist/{_AUTH_USER['user_uuid']}"
        )
    assert removed.status_code == 204

    # Writes are now blocked.
    assert (await _post_create(auth_client)).status_code == 403

    with patch("routers.marketplace.verify_vendor_app", _fake_verify):
        patched = await auth_client.patch(
            f"/marketplace/developer/apps/{app_id}",
            json={"short_description": "reworked"},
        )
    assert patched.status_code == 403

    submitted = await auth_client.post(
        f"/marketplace/developer/apps/{app_id}/submit-for-review", json={}
    )
    assert submitted.status_code == 403

    # Reads and non-write ownership actions still work.
    listed = await auth_client.get("/marketplace/developer/apps")
    assert listed.status_code == 200
    assert any(a["id"] == app_id for a in listed.json())

    with patch("routers.marketplace_developer.verify_vendor_app", _fake_verify):
        verified = await auth_client.post(
            f"/marketplace/developer/apps/{app_id}/verify"
        )
    assert verified.status_code == 200

    deleted = await auth_client.delete(f"/marketplace/developer/apps/{app_id}")
    assert deleted.status_code == 200, deleted.text


@pytest.mark.asyncio
async def test_admin_endpoints_reject_non_superuser(auth_client):
    """validate + whitelist endpoints 401 for a non-superuser (no override)."""
    assert (await auth_client.get("/admin/marketplace/validate")).status_code == 401
    assert (await auth_client.get("/admin/marketplace/whitelist")).status_code == 401
    post = await auth_client.post(
        "/admin/marketplace/whitelist", json={"email": _AUTH_USER["email"]}
    )
    assert post.status_code == 401
    delete = await auth_client.delete(
        f"/admin/marketplace/whitelist/{_AUTH_USER['user_uuid']}"
    )
    assert delete.status_code == 401


@pytest.mark.asyncio
async def test_validate_ok_for_superuser(auth_client):
    """The superuser probe returns success when the superuser check passes."""
    with _superuser_override():
        resp = await auth_client.get("/admin/marketplace/validate")
    assert resp.status_code == 200
    assert resp.json()["success"] is True
