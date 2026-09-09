"""Integration tests for the developer marketplace submission flow.

Covers the additions for the Workspace app-submission feature:
  - GET /marketplace/developer/apps (owner-scoped, exposes status + rejection_reason)
  - POST /admin/marketplace/apps/{id}/reject (reason stored, status guarded)
  - rejection_reason cleared on developer PATCH and on publish
  - hard-delete frees the (vendor, name, version) slot for re-listing

Requires the backend test infra (MySQL + Redis via testcontainers):
    cd backend && poetry run pytest tests/test_marketplace_developer.py
"""

import os
import sys
from unittest.mock import patch
from uuid import uuid4

BACKEND_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest

from tests.fixtures.base import _SECOND_USER
from tests.fixtures.marketplace import (
    create_app as _create_app,
    fake_verify as _fake_verify,
    post_create_app as _post_create_app,
    superuser_override as _superuser_override,
    whitelist_developer as _whitelist,
)


@pytest.mark.asyncio
async def test_developer_list_is_owner_scoped(auth_client, second_user_client):
    app_id = await _create_app(auth_client)

    mine = await auth_client.get("/marketplace/developer/apps")
    assert mine.status_code == 200
    apps = mine.json()
    assert any(a["id"] == app_id for a in apps)
    target = next(a for a in apps if a["id"] == app_id)
    assert target["status"] == "development"
    assert target["rejectionReason"] is None

    # A different user must not see this app.
    theirs = await second_user_client.get("/marketplace/developer/apps")
    assert theirs.status_code == 200
    assert all(a["id"] != app_id for a in theirs.json())
    await auth_client.delete(f"/marketplace/developer/apps/{app_id}")


@pytest.mark.asyncio
async def test_reject_sets_reason_and_keeps_development(auth_client):
    app_id = await _create_app(auth_client)

    with _superuser_override():
        reject = await auth_client.post(
            f"/admin/marketplace/apps/{app_id}/reject",
            json={"reason": "Fix your thumbnail"},
        )
    assert reject.status_code == 200, reject.text

    listed = (await auth_client.get("/marketplace/developer/apps")).json()
    target = next(a for a in listed if a["id"] == app_id)
    assert target["status"] == "development"
    assert target["rejectionReason"] == "Fix your thumbnail"
    await auth_client.delete(f"/marketplace/developer/apps/{app_id}")


@pytest.mark.asyncio
async def test_reject_requires_a_reason(auth_client):
    app_id = await _create_app(auth_client)
    with _superuser_override():
        resp = await auth_client.post(
            f"/admin/marketplace/apps/{app_id}/reject", json={"reason": "  "}
        )
    assert resp.status_code == 422
    await auth_client.delete(f"/marketplace/developer/apps/{app_id}")


@pytest.mark.asyncio
async def test_reject_requires_development_status(auth_client):
    app_id = await _create_app(auth_client)
    with _superuser_override():
        publish = await auth_client.post(f"/admin/marketplace/apps/{app_id}/publish")
        assert publish.status_code == 200, publish.text
        reject = await auth_client.post(
            f"/admin/marketplace/apps/{app_id}/reject", json={"reason": "too late"}
        )
    assert reject.status_code == 409
    await auth_client.delete(f"/marketplace/developer/apps/{app_id}")


@pytest.mark.asyncio
async def test_developer_patch_clears_rejection_reason(auth_client):
    app_id = await _create_app(auth_client)
    with _superuser_override():
        await auth_client.post(
            f"/admin/marketplace/apps/{app_id}/reject", json={"reason": "needs work"}
        )

    with patch("routers.marketplace.verify_vendor_app", _fake_verify):
        patched = await auth_client.patch(
            f"/marketplace/developer/apps/{app_id}",
            json={"short_description": "now improved"},
        )
    assert patched.status_code == 200, patched.text
    assert patched.json()["status"] == "development"
    assert patched.json()["rejectionReason"] is None
    await auth_client.delete(f"/marketplace/developer/apps/{app_id}")


@pytest.mark.asyncio
async def test_publish_clears_rejection_reason(auth_client):
    app_id = await _create_app(auth_client)
    with _superuser_override():
        await auth_client.post(
            f"/admin/marketplace/apps/{app_id}/reject", json={"reason": "needs work"}
        )
        publish = await auth_client.post(f"/admin/marketplace/apps/{app_id}/publish")
        assert publish.status_code == 200, publish.text

    # Published app surfaces in the public catalog with no stale rejection.
    catalog = (await auth_client.get("/marketplace/apps")).json()
    published = next((a for a in catalog if a["id"] == app_id), None)
    assert published is not None
    assert published.get("rejectionReason") in {None, ""}

    await auth_client.delete(f"/marketplace/developer/apps/{app_id}")


async def _vendor_logo_of(client, app_id: str) -> str | None:
    listed = (await client.get("/marketplace/developer/apps")).json()
    return next(a for a in listed if a["id"] == app_id)["vendorThumbnailUrl"]


async def _create_as_second_user(client, **overrides) -> str:
    """Create an app owned by the second user.

    The tests above share one user that leaks its apps, so by this point it sits
    at MAX_DEVELOPER_APPS and any further create 409s. The second user only ever
    does reads, so its budget is free.
    """
    await _whitelist(client, _SECOND_USER["email"])
    resp = await _post_create_app(client, **overrides)
    assert resp.status_code == 200, resp.text
    return resp.json()["app_id"]


@pytest.mark.asyncio
async def test_create_persists_the_vendor_logo(second_user_client):
    """The company logo is a required field in the submission dialog, so losing
    it on create leaves the vendor unbranded with nothing to signal why."""
    logo = "https://acme.test/logo.png"
    app_id = await _create_as_second_user(second_user_client, vendor_thumbnail_url=logo)
    try:
        assert await _vendor_logo_of(second_user_client, app_id) == logo
    finally:
        await second_user_client.delete(f"/marketplace/developer/apps/{app_id}")


@pytest.mark.asyncio
async def test_create_updates_the_logo_on_an_existing_vendor(second_user_client):
    """Second app for a vendor that already exists — the update branch of the
    create handler must apply the logo too, not just the insert branch."""
    vendor = f"Acme Data {uuid4().hex[:8]}"
    logo = "https://acme.test/logo.png"

    first_id = await _create_as_second_user(second_user_client, vendor_name=vendor)
    second_id = await _create_as_second_user(
        second_user_client, vendor_name=vendor, vendor_thumbnail_url=logo
    )
    try:
        assert await _vendor_logo_of(second_user_client, second_id) == logo
    finally:
        for app_id in (first_id, second_id):
            await second_user_client.delete(f"/marketplace/developer/apps/{app_id}")


@pytest.mark.asyncio
async def test_hard_delete_allows_relisting_same_name(auth_client):
    suffix = uuid4().hex[:8]
    body = {
        "vendor_name": f"Reuse Vendor {suffix}",
        "app_name": f"Reuse App {suffix}",
        "short_description": "An app",
        "backend_base_url": "https://reuse.test",
    }
    await _whitelist(auth_client)
    with patch("routers.marketplace.verify_vendor_app", _fake_verify):
        first = await auth_client.post("/marketplace/developer/apps", json=body)
        assert first.status_code == 200, first.text
        deleted = await auth_client.delete(
            f"/marketplace/developer/apps/{first.json()['app_id']}"
        )
        assert deleted.status_code == 200, deleted.text
        # Soft-delete would 409 here on the (vendor, name, version) unique slot.
        again = await auth_client.post("/marketplace/developer/apps", json=body)
    assert again.status_code == 200, again.text
