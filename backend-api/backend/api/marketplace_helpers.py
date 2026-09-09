"""Marketplace verification and serialization helpers"""

import asyncio
from typing import Generic, TypeAlias, TypedDict, TypeVar, cast

import httpx
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api import base
from api.marketplace_schemas import ManifestSummary, VerificationResult
from api.models import VendorApp

FETCH_TIMEOUT = 60.0  # seconds
HTTP_CLIENT_ERROR = 400


def _check_required_fields(app: VendorApp) -> list[str]:
    """Validate required fields for non-built-in apps."""
    errors: list[str] = []
    if not app.name or not app.name.strip():
        errors.append("app_name is required")
    if not app.short_description or not app.short_description.strip():
        errors.append("short_description is required")
    if not app.backend_base_url:
        errors.append("backend_base_url is required for non-built-in apps")
    return errors


async def _check_url_reachability(client: httpx.AsyncClient, app: VendorApp):
    """HEAD-check a list of (label, url) pairs. Returns warnings."""
    warnings: list[str] = []
    url_fields = [
        "backend_base_url",
        "thumbnail_url",
        "api_key_url",
        "api_key_info_url",
    ]

    async def check_url(field: str) -> None:
        url = getattr(app, field, None)
        try:
            resp = await client.head(url, timeout=5.0)
            if resp.status_code >= HTTP_CLIENT_ERROR:
                warnings.append(f"{field} unreachable: {resp.status_code}")
        except httpx.HTTPError as exc:
            if isinstance(exc, httpx.ReadTimeout):
                exc = "request timed out"
            warnings.append(f"{field} check failed: {exc}")
        except Exception as exc:
            warnings.append(f"{field} check error: {exc}")

    # skip empty URLs
    tasks = [
        asyncio.create_task(check_url(v)) for v in url_fields if getattr(app, v, None)
    ]
    await asyncio.gather(*tasks)

    return warnings


T = TypeVar("T", bound="dict | list")


class ManifestDict(TypedDict, Generic[T], total=False):
    data: T | None
    errors: list[str]
    warnings: list[str]


async def _fetch_manifest(
    client: httpx.AsyncClient, url: str, label: str, expected_type: "T"
) -> "ManifestDict[T]":
    """Fetch and validate a JSON manifest. Returns (data, errors, warnings)."""
    output: ManifestDict[T] = {"data": None, "errors": [], "warnings": []}
    type_label = "array" if expected_type is list else "object"
    is_apps_json = label == "apps.json"

    try:
        resp = await client.get(url)
        if resp.status_code >= HTTP_CLIENT_ERROR:
            output["errors"].append(f"{label} unreachable: {resp.status_code}")
            return output
        data: T = resp.json()
        if is_apps_json and isinstance(data, dict):
            data = [data]
        if not isinstance(data, expected_type):
            output["errors"].append(f"{label} must be a JSON {type_label}")
            return output
        # Extra validation for widgets.json dict structure
        if expected_type is dict:
            bad_keys = [
                k for k, v in data.items() if not isinstance(v, dict) or "name" not in v
            ]
            if bad_keys:
                output["warnings"].append(
                    f"{label}: {len(bad_keys)} entries missing 'name' key"
                )
        output["data"] = data
    except httpx.HTTPError as exc:
        output["errors"].append(f"{label} fetch failed: {exc}")
    except Exception as exc:
        output["errors"].append(f"{label} invalid JSON: {exc}")

    return output


def _make_error_result(app: VendorApp, errors: list[str], warnings: list[str]):
    """Record an error result on the app and return it."""
    app.last_fetch_status = "error"
    app.last_fetch_error = "; ".join(errors)
    return VerificationResult(status="error", errors=errors, warnings=warnings)


Tasks: TypeAlias = tuple[list[str], ManifestDict[list[dict]], ManifestDict[dict]]


async def _run_url_tasks(client: httpx.AsyncClient, app: VendorApp):
    """Run URL reachability and manifest fetch tasks concurrently."""
    # Resolve manifest URLs
    base_url = app.backend_base_url.rstrip("/")
    apps_json_url = app.apps_json_url or f"{base_url}/apps.json"
    widgets_json_url = app.widgets_json_url or f"{base_url}/widgets.json"

    tasks = [
        asyncio.create_task(_check_url_reachability(client, app)),
        *[
            asyncio.create_task(_fetch_manifest(client, *args))
            for args in [
                (apps_json_url, "apps.json", list),
                (widgets_json_url, "widgets.json", dict),
            ]
        ],
    ]
    warnings, apps, widgets = cast(Tasks, await asyncio.gather(*tasks))

    errors = apps["errors"] + widgets["errors"]
    warnings = warnings + apps["warnings"] + widgets["warnings"]
    return (warnings, errors, apps["data"], widgets["data"])


async def verify_vendor_app(app: VendorApp) -> VerificationResult:
    """Run verification checks on a VendorApp. Returns a VerificationResult.

    Mutates app fields (cache, status, timestamps) but does NOT commit.
    """
    now = base.get_now()

    # Built-in apps skip all checks — auto-verify
    if app.is_built_in:
        app.status = base.AppStatus.verified
        app.last_verified_at = now
        app.last_fetch_status = "ok"
        app.last_fetch_error = None
        return VerificationResult(status="ok", manifest_summary=ManifestSummary())

    # Required field checks
    field_errors = _check_required_fields(app)
    if field_errors:
        return _make_error_result(app, field_errors, [])

    async with httpx.AsyncClient(timeout=FETCH_TIMEOUT, follow_redirects=True) as c:
        warnings, errors, apps_data, widgets_data = await _run_url_tasks(c, app)

    # Update app fields based on result
    app.last_fetched_at = now
    app.last_verified_at = now

    if errors:
        return _make_error_result(app, errors, warnings)

    # Success — cache manifests and update status
    for attr, value in [
        ("apps_json_cache", apps_data),
        ("widgets_json_cache", widgets_data),
        ("last_fetch_status", "ok"),
        ("last_fetch_error", None),
    ]:
        setattr(app, attr, value)

    if app.status == base.AppStatus.submitted:
        app.status = base.AppStatus.verified

    return VerificationResult(status="ok", warnings=warnings, manifest_summary=app)


async def update_app_parents(app: VendorApp, db: AsyncSession):
    """For apps with the same vendor + name, set parent_app_uuid to the latest published sibling."""

    query = select(VendorApp).where(
        VendorApp.vendor_uuid == app.vendor_uuid,
        VendorApp.uuid != app.uuid,
        VendorApp.name == app.name,
        or_(
            VendorApp.status == base.AppStatus.disabled,
            VendorApp.status == base.AppStatus.removed,
        ),
    )
    result = await db.execute(query)
    sibling_apps = result.scalars().all()

    for sibling_app in sibling_apps:
        sibling_app.parent_app_uuid = app.uuid
