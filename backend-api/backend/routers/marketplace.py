"""Marketplace router — public catalog + admin management + subscription endpoints"""

from typing import Annotated, Literal, TypeAlias
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response
from sqlalchemy import Row, and_, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api import auth_helpers, base
from api.database import aget_read_db, aget_write_db
from api.marketplace_helpers import update_app_parents, verify_vendor_app
from api.marketplace_schemas import (
    AdminAppResponse,
    AdminSubscriptionStats,
    AppStatusResponse,
    CreateAppRequest,
    CreateRateVendorApp,
    CreateVendorAppRequest,
    CreateVendorAppResponse,
    DeveloperAppResponse,
    MarketplaceAppResponse,
    SubscriptionListResponse,
    SubscriptionResponse,
    UpdateVendorAppRequest,
    WhitelistCreateRequest,
    WhitelistEntryResponse,
)
from api.models import RateVendorApp, User, UserAppSubscription, Vendor, VendorApp
from api.schemas import SuccessReturn

router = APIRouter(tags=["marketplace"])


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------


@router.get("/marketplace/apps")
async def get_marketplace_apps(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user: Annotated[
        Row | None, Depends(auth_helpers.GetCurrentUserOptional(["uuid"]))
    ] = None,
) -> list[MarketplaceAppResponse]:
    """Public endpoint — returns published apps + development apps owned by caller."""
    status_filter = VendorApp.status == base.AppStatus.published
    if user is not None:
        status_filter = or_(
            status_filter,
            and_(
                VendorApp.status == base.AppStatus.development,
                VendorApp.owner_uuid == user.uuid,
            ),
        )

    query = (
        select(VendorApp)
        .options(selectinload(VendorApp.vendor), selectinload(VendorApp.ratings))
        .where(status_filter)
        .order_by(VendorApp.is_built_in.desc(), VendorApp.name.asc())
    )
    result = await db.execute(query)
    apps = result.scalars().all()

    return [MarketplaceAppResponse.model_validate(app) for app in apps]


@router.get("/marketplace/apps/{app_id}")
async def get_marketplace_app(
    app_id: UUID,
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user: Annotated[
        Row | None, Depends(auth_helpers.GetCurrentUserOptional(["uuid"]))
    ] = None,
) -> MarketplaceAppResponse:
    """Public endpoint — returns a single published (or own development) app."""
    status_filter = VendorApp.status == base.AppStatus.published
    if user is not None:
        status_filter = or_(
            status_filter,
            and_(
                VendorApp.status == base.AppStatus.development,
                VendorApp.owner_uuid == user.uuid,
            ),
        )

    query = (
        select(VendorApp)
        .options(selectinload(VendorApp.vendor), selectinload(VendorApp.ratings))
        .where(VendorApp.uuid == app_id, status_filter)
    )
    result = await db.execute(query)
    app = result.scalars().first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    return MarketplaceAppResponse.model_validate(app)


@router.post("/marketplace/apps/{app_id}/rate")
async def rate_marketplace_app(
    app_id: UUID,
    body: CreateRateVendorApp,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user: Annotated[Row, Depends(auth_helpers.GetCurrentUser(["uuid"]))],
):
    """Submit or update a rating for a marketplace app."""
    # Verify app exists and is published
    app_query = select(VendorApp.uuid).where(
        VendorApp.uuid == app_id,
        VendorApp.status == base.AppStatus.published,
    )
    app_result = await db.execute(app_query)
    if not app_result.scalars().first():
        raise HTTPException(status_code=404, detail="App not found or not published")

    # Upsert rating
    rating_query = select(RateVendorApp).where(
        RateVendorApp.user_uuid == user.uuid,
        RateVendorApp.app_uuid == app_id,
    )
    rating_result = await db.execute(rating_query)
    rating = rating_result.scalars().first()

    if rating:
        rating.rating = body.rating
        rating.review = body.review
        await db.flush()
    else:
        rating = RateVendorApp(
            user_uuid=user.uuid, app_uuid=app_id, rating=body.rating, review=body.review
        )
        db.add(rating)

    await db.commit()

    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


async def create_app_for_vendor(
    vendor: Vendor,
    body: CreateAppRequest,
    db: AsyncSession,
    owner_uuid: UUID | None = None,
    user: Row | None = None,
):
    """Add a new app to an existing vendor."""
    # 1. Default manifest URLs
    apps_json_url = body.apps_json_url
    widgets_json_url = body.widgets_json_url
    if body.backend_base_url and not apps_json_url:
        apps_json_url = f"{body.backend_base_url.rstrip('/')}/apps.json"
    if body.backend_base_url and not widgets_json_url:
        widgets_json_url = f"{body.backend_base_url.rstrip('/')}/widgets.json"

    if user and not owner_uuid:
        owner_uuid = user.uuid

    # 2. Create VendorApp
    app = VendorApp(
        vendor_uuid=vendor.uuid,
        owner_uuid=owner_uuid,
        name=body.app_name,
        version=body.version,
        short_description=body.short_description,
        category=body.category,
        tagline=body.tagline,
        thumbnail_url=body.thumbnail_url,
        thumbnail_url_dark=body.thumbnail_url_dark,
        thumbnail_url_light=body.thumbnail_url_light,
        screenshots=body.media or [],
        api_key_url=body.api_key_url,
        api_key_info_url=body.api_key_info_url,
        more_information_url=body.more_information_url,
        backend_base_url=body.backend_base_url,
        apps_json_url=apps_json_url,
        widgets_json_url=widgets_json_url,
        is_built_in=body.is_built_in or False,
        auth_type=body.auth_type,
        auth_fields=(
            [f.model_dump() for f in body.auth_fields] if body.auth_fields else None
        ),
        mcp_servers=(
            [s.model_dump() for s in body.mcp_servers] if body.mcp_servers else None
        ),
        status=base.AppStatus.submitted,
    )
    db.add(app)

    # 3. Run verification
    verification = await verify_vendor_app(app)

    # Developer flow: always move to development so they can preview.
    # Verification errors/warnings are returned so they know what to fix
    # before an admin can publish.
    # Admin flow: verify_vendor_app already sets the status to verified/submitted.
    if user:
        app.status = base.AppStatus.development

    try:
        await db.flush()
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"App '{body.app_name}' version '{body.version}' already exists. "
            "Use a different version number.",
        )

    # Build a helpful message for developers
    message = None
    if user:
        if verification.status == "ok" and not verification.errors:
            message = "App created and visible in your marketplace. An admin will review and publish it."
        else:
            issues = verification.errors or verification.warnings
            message = (
                "App created and visible in your marketplace, but verification found issues. "
                "Fix these before requesting publish: " + "; ".join(issues)
            )

    return CreateVendorAppResponse(
        app_id=app.uuid,
        vendor_id=vendor.uuid,
        version=app.version,
        status=app.status,
        verification=verification,
        message=message,
    )


@router.post("/admin/marketplace/apps", response_model=CreateVendorAppResponse)
async def post_create_vendor_app(
    body: CreateVendorAppRequest,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    _=Depends(auth_helpers.get_current_superuser),
):
    """Create a vendor + app and run automatic verification."""

    # 1. Upsert vendor by name
    vendor_query = select(Vendor).where(Vendor.name == body.vendor_name)
    vendor_result = await db.execute(vendor_query)
    vendor = vendor_result.scalars().first()

    # 2. Resolve owner_email → owner_uuid
    owner_uuid = None
    if body.owner_email is not None:
        user_query = select(User.uuid).where(
            User.clean_email == body.owner_email.lower()
        )
        user_result = await db.execute(user_query)
        owner_row = user_result.first()
        if not owner_row:
            raise HTTPException(
                status_code=404, detail=f"User not found: {body.owner_email}"
            )
        owner_uuid = owner_row.uuid

    if vendor:
        # Update vendor fields if provided
        if vendor.owner_uuid is None and owner_uuid is not None:
            vendor.owner_uuid = owner_uuid
        if body.vendor_description is not None:
            vendor.description = body.vendor_description
        if body.vendor_website_url is not None:
            vendor.website_url = body.vendor_website_url
        if body.documentation_url is not None:
            vendor.documentation_url = body.documentation_url
        if body.contact_email is not None:
            vendor.support_email = body.contact_email
        if body.vendor_thumbnail_url is not None:
            vendor.thumbnail_url = body.vendor_thumbnail_url
    else:
        vendor = Vendor(
            name=body.vendor_name,
            owner_uuid=owner_uuid,
            description=body.vendor_description,
            website_url=body.vendor_website_url,
            documentation_url=body.documentation_url,
            support_email=body.contact_email,
            thumbnail_url=body.vendor_thumbnail_url,
        )
        db.add(vendor)
        await db.flush()  # Ensure vendor.uuid is available

    # 3. Create VendorApp
    return await create_app_for_vendor(vendor, body, db, owner_uuid=owner_uuid)


@router.post("/admin/marketplace/vendors/{vendor_id}/apps")
async def post_create_app_for_vendor(
    vendor_id: UUID,
    body: CreateAppRequest,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    _=Depends(auth_helpers.get_current_superuser),
) -> CreateVendorAppResponse:
    """Add a new app to an existing vendor."""
    vendor_query = select(Vendor).where(Vendor.uuid == vendor_id)
    vendor_result = await db.execute(vendor_query)
    vendor = vendor_result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    return await create_app_for_vendor(vendor, body, db)


@router.get("/admin/marketplace/apps")
async def admin_list_apps(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    _=Depends(auth_helpers.get_current_superuser),
    status: str | None = Query(None, description="Filter by status"),
) -> list[AdminAppResponse]:
    """Admin endpoint — list all apps with full metadata."""
    query = select(VendorApp).options(
        selectinload(VendorApp.vendor), selectinload(VendorApp.parent_app)
    )

    if status:
        query = query.where(VendorApp.status == status)

    query = query.order_by(VendorApp.created_date.desc())
    result = await db.execute(query)
    apps = result.scalars().all()

    return [AdminAppResponse.model_validate(app) for app in apps]


def apply_vendor_fields(vendor: Vendor, body: CreateVendorAppRequest):
    """Apply optional vendor field updates to an existing vendor.

    Shared by the admin PATCH and the developer create/PATCH paths. Route
    updates through here rather than re-listing the columns per handler: the
    developer create previously kept its own copy and silently dropped
    `vendor_thumbnail_url`, so submitted company logos were never stored.
    """
    field_map = {
        "vendor_description": "description",
        "vendor_website_url": "website_url",
        "documentation_url": "documentation_url",
        "vendor_thumbnail_url": "thumbnail_url",
        "contact_email": "support_email",
    }
    for body_field, model_field in field_map.items():
        value = getattr(body, body_field)
        if value is not None:
            setattr(vendor, model_field, value)


def _apply_app_fields(app: VendorApp, body: UpdateVendorAppRequest):
    """Apply optional app field updates. Returns True if URL fields changed."""
    simple_fields = {
        "app_name": "name",
        "short_description": "short_description",
        "category": "category",
        "tagline": "tagline",
        "thumbnail_url": "thumbnail_url",
        "thumbnail_url_dark": "thumbnail_url_dark",
        "thumbnail_url_light": "thumbnail_url_light",
        "media": "screenshots",  # request field `media` → DB column `screenshots`
        "api_key_url": "api_key_url",
        "api_key_info_url": "api_key_info_url",
        "more_information_url": "more_information_url",
        "is_built_in": "is_built_in",
        "auth_type": "auth_type",
    }
    for body_field, model_field in simple_fields.items():
        value = getattr(body, body_field)
        if value is not None:
            setattr(app, model_field, value)

    # auth_fields: only meaningful when auth_type includes `custom`. The schema
    # validator already nulls them otherwise. On a transition away from `custom`,
    # clear any previously-stored fields so they don't linger.
    effective_auth_type = app.auth_type or []
    if "custom" in effective_auth_type:
        if body.auth_fields is not None:
            app.auth_fields = [f.model_dump() for f in body.auth_fields]
    else:
        app.auth_fields = None

    # Not in `simple_fields` because an empty list is meaningful here: it drops
    # the override so the response falls back to the apps.json manifest again.
    # Omitting the key leaves whatever is stored untouched.
    if body.mcp_servers is not None:
        app.mcp_servers = [s.model_dump() for s in body.mcp_servers] or None

    url_fields_changed = False
    for body_field in (
        "backend_base_url",
        "apps_json_url",
        "widgets_json_url",
        "api_key_info_url",
    ):
        value = getattr(body, body_field)
        if value is not None and value != getattr(app, body_field):
            setattr(app, body_field, value)
            url_fields_changed = True
    return url_fields_changed


async def update_vendor_app(
    app: VendorApp,
    body: UpdateVendorAppRequest,
    db: AsyncSession,
    user: Row | None = None,
) -> AdminAppResponse | DeveloperAppResponse:
    """Apply updates to the app and re-run verification if manifest URLs changed."""
    # Update vendor (upsert by name if changed)
    if body.vendor_name is not None:
        vendor_query = select(Vendor).where(Vendor.name == body.vendor_name)
        vendor_result = await db.execute(vendor_query)
        vendor = vendor_result.scalars().first()
        if not vendor:
            vendor = Vendor(
                name=body.vendor_name, owner_uuid=user.uuid if user else None
            )
            db.add(vendor)
            await db.flush()
        elif user and vendor.owner_uuid is not None and vendor.owner_uuid != user.uuid:
            raise HTTPException(
                status_code=403,
                detail="Cannot change vendor: name already taken by another vendor",
            )
        app.vendor_uuid = vendor.uuid

    if (
        user
        and app.vendor.owner_uuid is not None
        and app.vendor.owner_uuid != user.uuid
    ):
        raise HTTPException(
            status_code=409,
            detail="Cannot edit a vendor you do not own.",
        )

    # Resolve owner_email → owner_uuid
    if not user and body.owner_email is not None:
        user_query = select(User.uuid).where(
            User.clean_email == body.owner_email.lower()
        )
        user_result = await db.execute(user_query)
        owner_row = user_result.first()
        if not owner_row:
            raise HTTPException(
                status_code=404, detail=f"User not found: {body.owner_email}"
            )
        app.owner_uuid = owner_row.uuid

    apply_vendor_fields(app.vendor, body)
    url_fields_changed = _apply_app_fields(app, body)

    verification = None
    if url_fields_changed:
        app.apps_json_cache = None
        app.widgets_json_cache = None
        verification = await verify_vendor_app(app)

        # Developer flow: always stay in development
        if user:
            app.status = base.AppStatus.development

    # A developer editing their own app is reworking it toward review — clear any
    # stale rejection feedback so the FE shows it as pending again, not rejected.
    if user:
        app.rejection_reason = None

    await db.flush()
    await db.commit()

    if user:
        return DeveloperAppResponse.model_validate(app)

    response = AdminAppResponse.model_validate(app)
    if verification:
        response.set_verification(verification)

    return response


@router.patch("/admin/marketplace/apps/{app_id}")
async def post_update_vendor_app(
    app_id: UUID,
    body: UpdateVendorAppRequest,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    _=Depends(auth_helpers.get_current_superuser),
) -> AdminAppResponse:
    """Update app fields. Re-verifies automatically if manifest URLs change."""
    query = (
        select(VendorApp)
        .options(selectinload(VendorApp.vendor))
        .where(VendorApp.uuid == app_id)
    )
    result = await db.execute(query)
    app = result.scalars().first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    # Update vendor (upsert by name if changed)
    return await update_vendor_app(app, body, db)


# ---------------------------------------------------------------------------
# State transition endpoints
# ---------------------------------------------------------------------------

TRANSITIONS = {
    "publish": {"from": ["verified", "development"], "to": "published"},
    "disable": {"from": ["published"], "to": "disabled"},
    "enable": {"from": ["disabled"], "to": "published"},
    "remove": {"from": None, "to": "removed"},  # None = any status
}


async def _transition_app(
    app_id: UUID,
    action: str,
    db: AsyncSession,
) -> AppStatusResponse:
    rule = TRANSITIONS[action]
    query = select(VendorApp).where(VendorApp.uuid == app_id)
    result = await db.execute(query)
    app = result.scalars().first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    status = app.status.value
    if rule["from"] is not None and status not in rule["from"]:
        expected = " or ".join(f"'{s}'" for s in rule["from"])
        raise HTTPException(
            status_code=409,
            detail=f"Cannot {action}: app status is '{status}', expected {expected}",
        )

    # Refuse to publish (or re-enable) when the last manifest fetch errored —
    # admin must re-verify successfully first. Built-in apps skip this since
    # they bypass manifest verification entirely.
    if (
        action in {"publish", "enable"}
        and not app.is_built_in
        and app.last_fetch_status == "error"
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot {action}: last manifest fetch errored "
                f"({app.last_fetch_error or 'unknown'}). "
                "Re-run /verify and resolve the upstream issue first."
            ),
        )

    app.status = rule["to"]

    # Approving (publish) clears any prior rejection feedback.
    if action == "publish":
        app.rejection_reason = None

    # When publishing or re-enabling, auto-disable other published versions
    if action in {"publish", "enable"}:
        # Clear parent_app_uuid to avoid conflicts with other versions
        app.parent_app_uuid = None
        other_versions_query = select(VendorApp).where(
            VendorApp.vendor_uuid == app.vendor_uuid,
            VendorApp.name == app.name,
            VendorApp.uuid != app.uuid,
            VendorApp.status == base.AppStatus.published,
        )
        other_result = await db.execute(other_versions_query)
        for other_app in other_result.scalars().all():
            other_app.status = base.AppStatus.disabled
            other_app.parent_app_uuid = app.uuid

        await update_app_parents(app, db)

    await db.flush()
    await db.commit()

    return AppStatusResponse(app_id=app.uuid, status=app.status)


@router.post("/admin/marketplace/apps/{app_id}/reject")
async def admin_reject_app(
    app_id: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    reason: Annotated[str, Body(embed=True)],
    _=Depends(auth_helpers.get_current_superuser),
) -> AppStatusResponse:
    """Reject a developer's app: store the reason and keep it in `development`
    so the developer can edit and re-submit. Approve is the existing `publish`.

    Declared before the `{action}` route so `/reject` matches here, not there."""
    query = select(VendorApp).where(VendorApp.uuid == app_id)
    result = await db.execute(query)
    app = result.scalars().first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    if app.status != base.AppStatus.development:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot reject: app status is '{app.status.value}', "
            "expected 'development'",
        )
    if not reason.strip():
        raise HTTPException(status_code=422, detail="Rejection reason is required")

    app.rejection_reason = reason.strip()
    await db.flush()
    await db.commit()

    return AppStatusResponse(app_id=app.uuid, status=app.status)


AdminAction: TypeAlias = Literal["publish", "disable", "enable", "remove", "verify"]


@router.post(
    "/admin/marketplace/apps/{app_id}/{action}",
    response_model=AppStatusResponse | CreateVendorAppResponse,
)
async def admin_transition_app(
    app_id: UUID,
    action: AdminAction,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    _=Depends(auth_helpers.get_current_superuser),
):
    """Admin endpoint — transition app status or trigger verification."""
    if action != "verify":
        return await _transition_app(app_id, action, db)

    query = (
        select(VendorApp)
        .options(selectinload(VendorApp.vendor))
        .where(VendorApp.uuid == app_id)
    )
    result = await db.execute(query)
    app = result.scalars().first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    verification = await verify_vendor_app(app)

    await db.flush()
    await db.commit()

    return CreateVendorAppResponse(
        app_id=app.uuid,
        vendor_id=app.vendor_uuid,
        version=app.version,
        status=app.status,
        verification=verification,
    )


# ---------------------------------------------------------------------------
# User subscription endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/marketplace/apps/{app_id}/subscribe", response_model=SubscriptionResponse
)
async def subscribe_to_app(
    app_id: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user: Annotated[Row, Depends(auth_helpers.GetCurrentUser(["uuid"]))],
):
    """Subscribe the current user to a marketplace app."""
    # Verify app exists and is published (or development + owned by user)
    app_query = select(VendorApp.uuid, VendorApp.status, VendorApp.owner_uuid).where(
        VendorApp.uuid == app_id,
        or_(
            VendorApp.status == base.AppStatus.published,
            and_(
                VendorApp.status == base.AppStatus.development,
                VendorApp.owner_uuid == user.uuid,
            ),
        ),
    )
    app_result = await db.execute(app_query)
    if not app_result.first():
        raise HTTPException(status_code=404, detail="App not found or not published")

    # Upsert subscription
    sub_query = select(UserAppSubscription).where(
        UserAppSubscription.user_uuid == user.uuid,
        UserAppSubscription.app_uuid == app_id,
    )
    sub_result = await db.execute(sub_query)
    sub = sub_result.scalars().first()

    if sub:
        sub.status = base.SubscriptionStatus.active
        sub.disconnected_at = None
        await db.flush()
    else:
        sub = UserAppSubscription(user_uuid=user.uuid, app_uuid=app_id)
        db.add(sub)

    await db.commit()

    return SubscriptionResponse.model_validate(sub)


@router.delete("/marketplace/apps/{app_id}/subscribe")
async def unsubscribe_from_app(
    app_id: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user: Annotated[Row, Depends(auth_helpers.GetCurrentUser(["uuid"]))],
):
    """Unsubscribe the current user from a marketplace app (soft-delete)."""
    sub_query = select(UserAppSubscription).where(
        UserAppSubscription.user_uuid == user.uuid,
        UserAppSubscription.app_uuid == app_id,
        UserAppSubscription.status == base.SubscriptionStatus.active,
    )
    sub_result = await db.execute(sub_query)
    sub = sub_result.scalars().first()

    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found")

    sub.status = base.SubscriptionStatus.disconnected
    sub.disconnected_at = base.get_now()
    await db.flush()
    await db.commit()

    return Response(status_code=204)


@router.get("/marketplace/subscriptions", response_model=SubscriptionListResponse)
async def get_user_subscriptions(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user: Annotated[Row, Depends(auth_helpers.GetCurrentUser(["uuid"]))],
):
    """Get all active subscriptions for the current user."""
    query = (
        select(UserAppSubscription)
        .options(
            selectinload(UserAppSubscription.app).selectinload(VendorApp.parent_app)
        )
        .where(
            UserAppSubscription.user_uuid == user.uuid,
            UserAppSubscription.status == base.SubscriptionStatus.active,
        )
        .order_by(UserAppSubscription.subscribed_at.desc())
    )
    result = await db.execute(query)
    subs = result.scalars().all()

    return SubscriptionListResponse.model_validate({"subscriptions": subs})


@router.get("/admin/marketplace/apps/{app_id}/subscriptions")
async def admin_get_subscription_stats(
    app_id: UUID,
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    _=Depends(auth_helpers.get_current_superuser),
):
    """Admin endpoint — subscription stats for a specific app."""
    # Verify app exists
    app_query = select(VendorApp.uuid, VendorApp.name).where(VendorApp.uuid == app_id)
    app_result = await db.execute(app_query)
    app_row = app_result.first()
    if not app_row:
        raise HTTPException(status_code=404, detail="App not found")

    # Count active and total subscriptions
    active_query = select(func.count()).where(
        UserAppSubscription.app_uuid == app_id,
        UserAppSubscription.status == base.SubscriptionStatus.active,
    )
    total_query = select(func.count()).where(UserAppSubscription.app_uuid == app_id)

    active_count = (await db.execute(active_query)).scalar() or 0
    total_count = (await db.execute(total_query)).scalar() or 0

    return AdminSubscriptionStats(
        app_id=app_id,
        app_name=app_row.name,
        active_count=active_count,
        total_count=total_count,
    )


# ---------------------------------------------------------------------------
# Submitter whitelist endpoints (admin)
# ---------------------------------------------------------------------------


@router.get("/admin/marketplace/validate", response_model=SuccessReturn)
async def validate_marketplace_admin(
    _=Depends(auth_helpers.get_current_superuser),
):
    """Frontend visibility probe — 200 for superusers, 401 otherwise."""
    return SuccessReturn.success_instance()


_WHITELIST_COLUMNS = (
    User.uuid,
    User.email,
    User.created_date,
    User.can_submit_marketplace,
)


@router.get("/admin/marketplace/whitelist")
async def list_marketplace_whitelist(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    _=Depends(auth_helpers.get_current_superuser),
) -> list[WhitelistEntryResponse]:
    """List users allowed to submit marketplace apps, newest account first."""
    query = (
        select(*_WHITELIST_COLUMNS)
        .where(
            User.can_submit_marketplace.is_(True),
            User.deleted.is_(False),
        )
        .order_by(User.created_date.desc())
    )
    result = await db.execute(query)

    return [WhitelistEntryResponse.model_validate(row) for row in result.all()]


@router.post("/admin/marketplace/whitelist")
async def add_marketplace_whitelist(
    body: WhitelistCreateRequest,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    _=Depends(auth_helpers.get_current_superuser),
) -> WhitelistEntryResponse:
    """Whitelist a developer by email. Idempotent — re-adding returns the same
    entry. 404 if no user with that email has an OpenBB account yet."""
    # `EmailStr` already guarantees exactly one "@", so clean_email cannot raise.
    cleaned = base.clean_email(body.email)

    query = select(*_WHITELIST_COLUMNS).where(
        User.clean_email == cleaned, User.deleted.is_(False)
    )
    user = (await db.execute(query)).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No user with that email — ask them to create an OpenBB account first",
        )

    if not user.can_submit_marketplace:
        await db.execute(
            update(User)
            .where(User.uuid == user.uuid)
            .values(can_submit_marketplace=True)
        )
        await db.commit()

    return WhitelistEntryResponse.model_validate(user)


@router.delete("/admin/marketplace/whitelist/{user_uuid}", status_code=204)
async def remove_marketplace_whitelist(
    user_uuid: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    _=Depends(auth_helpers.get_current_superuser),
):
    """Revoke a developer's marketplace submission access."""
    query = select(User.can_submit_marketplace).where(
        User.uuid == user_uuid, User.deleted.is_(False)
    )
    user = (await db.execute(query)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.can_submit_marketplace:
        await db.execute(
            update(User)
            .where(User.uuid == user_uuid)
            .values(can_submit_marketplace=False)
        )
        await db.commit()

    return Response(status_code=204)
