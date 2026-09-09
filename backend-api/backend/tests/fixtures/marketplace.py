"""Shared helpers for the marketplace test modules.

`test_marketplace_developer.py` and `test_marketplace_whitelist.py` both drive
the same submission endpoints, so the superuser bypass, the verification stub
and the request-body builder live here rather than being copied per file.

Imported directly (like `tests.fixtures.base`) — these are plain helpers, not
pytest fixtures, so they are not registered in `pytest_plugins`.
"""

from contextlib import contextmanager
from unittest.mock import patch
from uuid import uuid4

from api import auth_helpers
from api.marketplace_schemas import VerificationResult
from tests.fixtures.base import _AUTH_USER, app


@contextmanager
def superuser_override():
    """Bypass the is_superuser DB check so /admin/marketplace endpoints are callable."""
    app.dependency_overrides[auth_helpers.get_current_superuser] = lambda: None
    try:
        yield
    finally:
        app.dependency_overrides.pop(auth_helpers.get_current_superuser, None)


async def fake_verify(app_obj):
    """Stub verify_vendor_app so create/patch don't make real HTTP calls."""
    app_obj.last_fetch_status = "ok"
    app_obj.last_fetch_error = None
    return VerificationResult(status="ok")


def create_app_body(**overrides):
    """Body for POST /marketplace/developer/apps.

    Unique vendor/app names so tests don't collide on the global vendor-name
    uniqueness constraint regardless of DB cleanup strategy.
    """
    suffix = uuid4().hex[:8]
    body = {
        "vendor_name": f"Acme Data {suffix}",
        "app_name": f"Acme App {suffix}",
        "short_description": "An app",
        "backend_base_url": "https://acme.test",
    }
    body.update(overrides)
    return body


async def whitelist_developer(client, email: str = _AUTH_USER["email"]) -> dict:
    """Whitelist a developer so create/patch/submit pass the eligibility guard.

    Idempotent. Returns the whitelist entry.
    """
    with superuser_override():
        resp = await client.post("/admin/marketplace/whitelist", json={"email": email})
    assert resp.status_code == 200, resp.text
    return resp.json()


async def post_create_app(client, **overrides):
    """POST create with verification stubbed. Returns the raw response so the
    caller can assert on a failure status (e.g. the 403 eligibility guard)."""
    with patch("routers.marketplace.verify_vendor_app", fake_verify):
        return await client.post(
            "/marketplace/developer/apps", json=create_app_body(**overrides)
        )


async def create_app(client, **overrides) -> str:
    """Whitelist the caller, create an app, assert success, return its id."""
    await whitelist_developer(client)
    resp = await post_create_app(client, **overrides)
    assert resp.status_code == 200, resp.text
    return resp.json()["app_id"]
