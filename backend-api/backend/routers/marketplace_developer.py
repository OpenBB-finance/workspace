"""Developer self-serve marketplace endpoints.

Authenticated users can create, update, and remove their own marketplace apps
in ``development`` status — visible only to them in the public catalog.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import Row, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api import auth_helpers, base
from api.database import aget_read_db, aget_write_db
from api.email.mailchimp import send_email
from api.marketplace_helpers import verify_vendor_app
from api.marketplace_schemas import (
    AdminAppResponse,
    CreateVendorAppRequest,
    CreateVendorAppResponse,
    DeveloperAppResponse,
    UpdateVendorAppRequest,
    VerificationResult,
)
from api.models import Vendor, VendorApp
from routers.marketplace import (
    apply_vendor_fields,
    create_app_for_vendor,
    update_vendor_app,
)

router = APIRouter(tags=["marketplace-developer"])

MAX_DEVELOPER_APPS = 5
REVIEW_EMAIL = "apps@openbb.co"


async def require_submit_eligibility(
    user: Annotated[
        Row,
        Depends(
            auth_helpers.GetCurrentUser(
                ["uuid", "email", "is_superuser", "can_submit_marketplace"]
            )
        ),
    ],
) -> Row:
    """Gate marketplace submissions to superusers and whitelisted developers.

    Returns the same user Row shape as ``GetCurrentUser`` (superset of the columns
    the guarded endpoints need) so callers can swap it in for their ``user`` param."""
    if not (user.is_superuser or user.can_submit_marketplace):
        raise HTTPException(
            status_code=403,
            detail="Marketplace submissions are limited to whitelisted developers. "
            "Contact OpenBB to be added.",
        )
    return user


# ---------------------------------------------------------------------------
# POST — create vendor + app (lands in development)
# ---------------------------------------------------------------------------


@router.post(
    "/marketplace/developer/apps",
    response_model=CreateVendorAppResponse,
)
async def developer_create_app(
    body: CreateVendorAppRequest,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user: Annotated[Row, Depends(require_submit_eligibility)],
):
    """Create a vendor + app as a developer. Status lands in 'development'."""

    # Enforce app limit (count by distinct app name, not versions)
    count_query = select(func.count(distinct(VendorApp.name))).where(
        VendorApp.owner_uuid == user.uuid,
        VendorApp.status != base.AppStatus.removed,
    )
    count = (await db.execute(count_query)).scalar() or 0
    if count >= MAX_DEVELOPER_APPS:
        raise HTTPException(
            status_code=409,
            detail=f"You already have {count} app(s). "
            f"Maximum is {MAX_DEVELOPER_APPS}. Delete an existing app first.",
        )

    # Upsert vendor by name — developers can only edit vendors they own
    vendor_query = select(Vendor).where(Vendor.name == body.vendor_name)
    vendor_result = await db.execute(vendor_query)
    vendor = vendor_result.scalars().first()

    if vendor:
        if vendor.owner_uuid is not None and vendor.owner_uuid != user.uuid:
            raise HTTPException(
                status_code=409,
                detail=f"Vendor '{body.vendor_name}' belongs to another developer. "
                "Choose a different vendor name.",
            )
        # Claim ownership if unowned (e.g. admin-created vendor)
        if vendor.owner_uuid is None:
            vendor.owner_uuid = user.uuid
        apply_vendor_fields(vendor, body)
    else:
        vendor = Vendor(
            name=body.vendor_name,
            owner_uuid=user.uuid,
            description=body.vendor_description,
            website_url=body.vendor_website_url,
            documentation_url=body.documentation_url,
            support_email=body.contact_email,
            thumbnail_url=body.vendor_thumbnail_url,
        )
        db.add(vendor)
        await db.flush()

    # If this app name+version was previously listed and removed (e.g. an admin
    # unlisted a published app), drop the tombstone so re-listing doesn't collide
    # on the (vendor, name, version) unique constraint.
    stale_result = await db.execute(
        select(VendorApp).where(
            VendorApp.vendor_uuid == vendor.uuid,
            VendorApp.name == body.app_name,
            VendorApp.version == body.version,
            VendorApp.status == base.AppStatus.removed,
        )
    )
    for stale_app in stale_result.scalars().all():
        await db.delete(stale_app)
    await db.flush()

    return await create_app_for_vendor(vendor, body, db, user=user)


# ---------------------------------------------------------------------------
# GET — list the caller's own apps (any status except removed)
# ---------------------------------------------------------------------------


@router.get(
    "/marketplace/developer/apps",
    response_model=list[DeveloperAppResponse],
)
async def developer_list_apps(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user: Annotated[Row, Depends(auth_helpers.GetCurrentUser(["uuid"]))],
):
    """List the caller's own marketplace apps, newest first, with review state
    (status, rejection_reason, manifest fetch status) for the submission UI."""
    query = (
        select(VendorApp)
        .options(selectinload(VendorApp.vendor), selectinload(VendorApp.ratings))
        .where(
            VendorApp.owner_uuid == user.uuid,
            VendorApp.status != base.AppStatus.removed,
        )
        .order_by(VendorApp.updated_date.desc())
    )
    result = await db.execute(query)
    apps = result.scalars().all()
    return [DeveloperAppResponse.model_validate(app) for app in apps]


# ---------------------------------------------------------------------------
# PATCH — update own app
# ---------------------------------------------------------------------------


@router.patch(
    "/marketplace/developer/apps/{app_id}",
    response_model=DeveloperAppResponse,
)
async def developer_update_app(
    app_id: UUID,
    body: UpdateVendorAppRequest,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user: Annotated[Row, Depends(require_submit_eligibility)],
):
    """Update a developer's own app. Re-verifies if manifest URLs change."""

    query = (
        select(VendorApp)
        .options(selectinload(VendorApp.vendor), selectinload(VendorApp.ratings))
        .where(VendorApp.uuid == app_id, VendorApp.owner_uuid == user.uuid)
    )
    result = await db.execute(query)
    app = result.scalars().first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    # Only development/submitted apps can be edited by the developer
    if app.status not in {
        base.AppStatus.development,
        base.AppStatus.submitted,
        base.AppStatus.verified,
    }:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot update app in '{app.status.value}' status. "
            "Only development apps can be edited.",
        )

    # Update vendor fields — only vendors the developer owns
    return await update_vendor_app(app, body, db, user)


# ---------------------------------------------------------------------------
# POST — re-run verification on own app
# ---------------------------------------------------------------------------


@router.post(
    "/marketplace/developer/apps/{app_id}/verify",
    response_model=VerificationResult,
)
async def developer_verify_app(
    app_id: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user: Annotated[Row, Depends(auth_helpers.GetCurrentUser(["uuid"]))],
):
    """Check whether a developer's app is good to be listed. Read-only — does
    not persist cache, timestamps, or status changes."""

    query = (
        select(VendorApp)
        .options(selectinload(VendorApp.vendor))
        .where(VendorApp.uuid == app_id, VendorApp.owner_uuid == user.uuid)
    )
    result = await db.execute(query)
    app = result.scalars().first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    try:
        return await verify_vendor_app(app)
    finally:
        # verify_vendor_app mutates the app (cache, timestamps, status).
        # Discard those mutations so this endpoint is a pure check.
        await db.rollback()


# ---------------------------------------------------------------------------
# POST — submit an app for review (emails the reviewers)
# ---------------------------------------------------------------------------


def _format_submission_email(
    app: VendorApp, submitter_email: str, message: str | None
) -> tuple[str, str]:
    """Build (subject, text) for the review-request email."""
    subject = f"[Marketplace review] {app.vendor.name} — {app.name}"
    app_json = AdminAppResponse.model_validate(app).model_dump_json(indent=2)
    text = (
        f"Submitted by: {submitter_email}\n\n"
        f"Message from developer:\n{message or '(none)'}\n\n"
        f"App details:\n{app_json}"
    )
    return subject, text


@router.post("/marketplace/developer/apps/{app_id}/submit-for-review")
async def developer_submit_for_review(
    app_id: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user: Annotated[Row, Depends(require_submit_eligibility)],
    message: Annotated[str | None, Body(embed=True)] = None,
):
    """Email a review request to the marketplace reviewers. Does not write to DB."""
    query = (
        select(VendorApp)
        .options(selectinload(VendorApp.vendor))
        .where(VendorApp.uuid == app_id, VendorApp.owner_uuid == user.uuid)
    )
    result = await db.execute(query)
    app = result.scalars().first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    subject, text = _format_submission_email(app, user.email, message)
    sent = send_email(
        to_email=REVIEW_EMAIL,
        from_email="no-reply@openbb.co",
        subject=subject,
        text=text,
    )
    if not sent:
        raise HTTPException(
            status_code=502, detail="Failed to send review request email"
        )
    return {"detail": "App submitted for review"}


# ---------------------------------------------------------------------------
# DELETE — remove own app
# ---------------------------------------------------------------------------


@router.delete("/marketplace/developer/apps/{app_id}")
async def developer_remove_app(
    app_id: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user: Annotated[Row, Depends(auth_helpers.GetCurrentUser(["uuid"]))],
):
    """Remove a developer's own app (frees up an app slot)."""

    query = select(VendorApp).where(
        VendorApp.uuid == app_id, VendorApp.owner_uuid == user.uuid
    )
    result = await db.execute(query)
    app = result.scalars().first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    if app.status == base.AppStatus.removed:
        raise HTTPException(status_code=409, detail="App is already removed")

    if app.status in {base.AppStatus.published, base.AppStatus.disabled}:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot remove app in '{app.status.value}' status. "
            "Contact an admin to remove published apps.",
        )

    # Hard-delete so the developer can re-list the same app name later. A soft
    # `removed` row would keep the (vendor, name, version) unique slot taken and
    # 409 the next create with the same name + version "1".
    await db.delete(app)
    await db.commit()

    return {"detail": "App removed", "app_id": str(app_id)}
