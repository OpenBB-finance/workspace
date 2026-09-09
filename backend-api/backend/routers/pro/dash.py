import asyncio
from time import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from sqlalchemy import insert, not_, or_, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from api import auth_helpers, crud, schemas
from api.database import aget_read_db, aget_write_db
from api.email import EmailService
from api.models import (
    DashboardItem,
    DashboardSave,
    DashboardShare,
    PermissionsEntityMap,
    User,
)
from api.rate_limit import LIMIT_DEFAULT, exempt_user_agent, limiter
from routers import pro_helpers, routers_helpers
from routers.pro.index import validate_user
from utilities.config import settings

router = APIRouter(
    prefix="/pro/dash",
    tags=["pro-dash"],
    dependencies=[Depends(auth_helpers.check_openbb)],
)


async def validate_dashboard_ownership(
    db: AsyncSession, dashboard_uuid: UUID, user_uuid: UUID
):
    error_message = await crud.dashboard_owner_errors(db, dashboard_uuid, user_uuid)
    if error_message:
        raise HTTPException(status_code=403, detail=error_message)


@router.get("/sync/owned", response_model=schemas.DashboardOwned)
async def get_owned_items(
    db: AsyncSession = Depends(aget_read_db),
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)
    ),
):
    owned = await crud.get_user_dashboards_owned(db, user.uuid)
    return schemas.DashboardOwned(owned=owned)


@router.get("/sync/shared", response_model=schemas.DashboardShared)
async def get_shared_items(
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)
    ),
):
    if user.permissions_uuid != settings.PRO_DEVELOPER_MAPPING or settings.is_onprem():
        tasks: list[asyncio.Task[crud.UserDashboards]] = [
            asyncio.create_task(pro_helpers.dashboard_task("shared", user.uuid)),
            asyncio.create_task(
                pro_helpers.dashboard_task(
                    "entity_shared", user.uuid, user.permissions_uuid
                )
            ),
        ]
        shared, entity_shared = await asyncio.gather(*tasks)
        entity_shared = {k: v for k, v in entity_shared.items() if k not in shared}
        return schemas.DashboardShared(shared=shared, entity_shared=entity_shared)

    return schemas.DashboardShared(shared={}, entity_shared={})


@router.get("/sync", response_model=schemas.DashboardComplete)
async def get_items(
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)
    ),
):
    return await pro_helpers.get_dashboards_complete(user=user)


@router.get("/validate-and-sync", response_model=schemas.DashboardCompleteWithContext)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def dash_validate_and_get_items(  # noqa: PLR0914, PLR0915
    request: Request,
    db: AsyncSession = Depends(aget_write_db),
    user=Depends(
        auth_helpers.GetCurrentUser(
            [
                "uuid",
                "permissions_uuid",
                "pro_display_settings",
                "is_superuser",
                "can_submit_marketplace",
            ],
            ["SingleWidget", "FileWidget"],
            pro=True,
        )
    ),
):
    """
    Validate the user token and retrieve the complete dashboard data.

    Args:
        db (Session): Database session dependency.
        user (User): Current user dependency.

    Returns:
        schemas.DashboardComplete: Complete dashboard data (owned, shared and entity shared dashboards).

    Raises:
        HTTPException: If the token is invalid.
    """
    start_time = time()
    res = await validate_user(db=db, token=user.token)
    if not res.success:
        raise HTTPException(status_code=401, detail="invalid token")
    dashboards_complete = await pro_helpers.get_dashboards_complete(user=user)
    user_apps_complete = await pro_helpers.get_user_apps_complete(user=user)

    # Get copilot chats
    chats = await pro_helpers.get_copilot_chats(db, user.uuid)
    questions_history = await pro_helpers.get_user_questions_history(db, user.uuid)

    # Get MCP servers
    mcp_servers = await pro_helpers.get_mcp_servers(db, user)

    # Get TV State
    tv_state = await pro_helpers.get_trading_view_state(db, user)

    # Get user skills
    user_skills = await pro_helpers.get_user_skill_state(db, user.uuid)

    # Get usage
    usage = await schemas.EntitlementUsageGet.check_cache(db, user)

    # Get entitlements
    entitlements = await pro_helpers.get_entitlement(db, user.uuid)

    # Trial entity
    entity_uuid = await pro_helpers.get_entity_uuid(db, user.uuid)
    is_trial_entity = entity_uuid == await crud.get_trial_entity_uuid(db)
    # Get Theme Settings
    entity_theme_settings = await pro_helpers.get_entity_theme_settings(db, entity_uuid)
    widget_metadata = await pro_helpers.get_widget_metadata(db=db, user=user)

    process_time = (time() - start_time) * 1000
    logger.warning(f"Dashboard task took {process_time:.2f} ms", exclude=True)
    return schemas.DashboardCompleteWithContext(
        shared=dashboards_complete.shared,
        entity_shared=dashboards_complete.entity_shared,
        owned=dashboards_complete.owned,
        usage=usage,
        feature_entitlements=entitlements,
        can_submit_marketplace=bool(user.is_superuser or user.can_submit_marketplace),
        is_trial_entity=is_trial_entity,
        copilot_chats=chats,
        questions_history=questions_history,
        mcp_servers=mcp_servers.get_servers_json(),
        trading_view=tv_state.model_dump(),
        pro_display_settings=user.pro_display_settings,
        single_widgets=[x.__dict__ for x in user.SingleWidget],
        file_widgets=[x.__dict__ for x in user.FileWidget],
        user_apps=user_apps_complete,
        entity_theme_settings=entity_theme_settings.model_dump(),
        widget_metadata=widget_metadata,
        user_skills=user_skills,
    )


@router.post("/sync", response_model=schemas.SuccessReturn)
async def update_items(
    dashboard: schemas.DashboardsCreate,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)
    ),
):
    "Handles insert, update, and delete of a user's dashboards"

    try:
        await crud.bulk_dashboard_insert_update(
            db, dashboard, user.uuid, user.permissions_uuid
        )
    except SQLAlchemyError as e:
        logger.error(e)
        await db.rollback()
        raise HTTPException(
            status_code=400, detail="Could not successfully update the items"
        ) from e
    return {"success": True}


@router.get("/{dashboard_uuid}/versions", response_model=list[schemas.DashboardSave])
async def dashboard_versions(
    dashboard_uuid: UUID,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)
    ),
):
    "This function currently does not work because we are not actually saving DashboardSaves"

    async def get_versions():
        query = (
            select(
                DashboardSave.content, DashboardSave.uuid, DashboardSave.created_date
            )
            .where(DashboardSave.dashboard_item_uuid == dashboard_uuid)
            .order_by(DashboardSave.created_date.desc())
        )
        return (await db.execute(query)).mappings().all()

    # First we check if the user owns the query
    if not await crud.dashboard_owner_errors(db, dashboard_uuid, user.uuid):
        return await get_versions()
    # Next we check if the user has been shared the query
    shared_query = (
        select(DashboardShare.uuid)
        .where(DashboardShare.dashboard_item_uuid == dashboard_uuid)
        .where(
            DashboardShare.shared_user_uuid == user.uuid,
            DashboardShare.active.is_(True),
        )
    ).limit(1)
    if (await db.execute(shared_query)).first():
        return await get_versions()
    # Finally we check if the dashboard has been shared with everyone in the user's entity
    user_entity_query = (
        select(PermissionsEntityMap.entity_uuid)
        .where(PermissionsEntityMap.uuid == user.permissions_uuid)
        .limit(1)
    )
    user_entity = (await db.execute(user_entity_query)).scalar_one_or_none()
    if user_entity is None:
        raise HTTPException(status_code=400, detail="Unable to find the user's entity")

    query = (
        select(
            DashboardItem.uuid,
        )
        .join(User, User.uuid == DashboardItem.owner_uuid)
        .join(PermissionsEntityMap, User.permissions_uuid == PermissionsEntityMap.uuid)
        .where(
            DashboardItem.entity_share.is_(True),
            PermissionsEntityMap.entity_uuid == user_entity,
        )
    ).limit(1)

    if (await db.execute(query)).first():
        return await get_versions()

    raise HTTPException(
        status_code=403, detail="You do not have permission to view this dashboard"
    )


@router.post(
    "/{dashboard_uuid}/toggle-entity-sharing", response_model=schemas.SuccessReturn
)
async def toggle_entity_sharing(
    dashboard_uuid: UUID,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)
    ),
):
    await validate_dashboard_ownership(db, dashboard_uuid, user.uuid)
    toggle_query = (
        update(DashboardItem)
        .where(DashboardItem.uuid == dashboard_uuid)
        .values(entity_share=not_(DashboardItem.entity_share))
    )
    await db.execute(toggle_query)
    await db.commit()
    return {"success": True}


@router.get(
    "/{dashboard_uuid}/shares", response_model=dict[str, schemas.DashboardShareReturn]
)
async def get_shares(
    dashboard_uuid: UUID,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "email", "permissions_uuid"], pro=True)
    ),
):
    trial_permissions_uuids = await crud.get_trial_permissions_uuids(db)
    final_result: dict[str, schemas.DashboardShareReturn] = {}
    query = (
        select(
            User.email,
            User.first_name,
            User.last_name,
            DashboardShare.permissions,
            DashboardShare.created_date,
        )
        .select_from(DashboardShare)
        .join(User, User.uuid == DashboardShare.shared_user_uuid)
        .join(DashboardItem, DashboardItem.uuid == DashboardShare.dashboard_item_uuid)
        .where(
            DashboardShare.active.is_(True),
            DashboardItem.owner_uuid == user.uuid,
            DashboardItem.uuid == dashboard_uuid,
        )
    )
    for shared in (await db.execute(query)).mappings().all():
        final_result[shared.email] = schemas.DashboardShareReturn(
            first_name=shared.first_name,
            last_name=shared.last_name,
            permissions=shared.permissions,
            created_date=shared.created_date,
            is_invite=False,
        )
    if user.permissions_uuid in trial_permissions_uuids:
        more_results = await crud.get_invite_shares(db, user.uuid, dashboard_uuid)
        final_result |= more_results
    return final_result


@router.post("/{dashboard_uuid}/share", response_model=schemas.SuccessReturn)
async def add_share(
    dashboard_uuid: UUID,
    share: schemas.ShareDashboard,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "email", "permissions_uuid"], pro=True)
    ),
):
    if user.permissions_uuid is None:
        raise HTTPException(
            status_code=400, detail="The user does not have permissions"
        )
    await validate_dashboard_ownership(db, dashboard_uuid, user.uuid)
    clean_shares = await crud.get_shares_without_existing(
        db, share, dashboard_uuid, user.email
    )
    if not clean_shares:
        return schemas.SuccessReturn.success_instance()

    trial_entity_uuid = await crud.get_trial_entity_uuid(db)
    user_permissions, user_emails, entity_uuid, user_uuids = (
        await crud.get_new_sharing_permissions(
            db, clean_shares, user.permissions_uuid, dashboard_uuid
        )
    )

    found_user = bool(user_permissions)
    if user_permissions:
        await db.execute(insert(DashboardShare), user_permissions)
        await db.execute(
            update(DashboardItem)
            .where(
                DashboardItem.uuid == dashboard_uuid,
                DashboardItem.owner_uuid == user.uuid,
            )
            .values(is_shared=True)
        )
        await db.commit()
        await crud.share_files(db, user.uuid, user_uuids, dashboard_uuid=dashboard_uuid)

    # Send invite emails:
    if trial_entity_uuid == entity_uuid:
        to_invite = await crud.get_unregistered_users(db, share.shares, user_emails)
        found_user = found_user or bool(to_invite)

        for invite in to_invite:
            # We might want to add a clean email check here
            extra_info = schemas.RegisterProUser(
                inviting_uuid=user.uuid,
                inviting_email=user.email,
                shared_dashboard=dashboard_uuid,
                shared_permissions=share.shares.get(invite, "view"),
            )
            new_user = schemas.UserCreateAdmin(
                email=invite, permissions_uuid=settings.PRO_TRIAL_MAPPING
            )
            # For now we are ignoring any errors here and just trying to invite everyone
            try:
                await routers_helpers.register_pro_user(db, new_user, extra_info)
            except Exception as e:
                logger.error(e)

    # Send share emails:
    for email in user_emails:
        EmailService.send_share_notice(email, user.email, dashboard_uuid)

    if not found_user:
        raise HTTPException(
            status_code=402, detail="User not found in your organization"
        )

    return schemas.SuccessReturn.success_instance()


@router.patch("/{dashboard_uuid}/share", response_model=schemas.SuccessReturn)
async def update_share(
    dashboard_uuid: UUID,
    share: schemas.ShareDashboard,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid", "email"], pro=True)),
):
    await validate_dashboard_ownership(db, dashboard_uuid, user.uuid)
    current_shares_query = (
        select(User.email, DashboardShare.permissions, DashboardShare.uuid)
        .join(DashboardShare, User.uuid == DashboardShare.shared_user_uuid)
        .where(
            DashboardShare.dashboard_item_uuid == dashboard_uuid,
            DashboardShare.active.is_(True),
            User.email.in_(share.shares.keys()),
        )
    )
    current_shares_response = (await db.execute(current_shares_query)).mappings().all()
    if not current_shares_response:
        await crud.handle_dashboard_is_shared(db, dashboard_uuid)
        return schemas.SuccessReturn.success_instance()
    current_shares = {x.email: (x.permissions, x.uuid) for x in current_shares_response}
    updates = []
    for key, value in current_shares.items():
        if value[0] != share.shares[key]:
            data = {"uuid": value[1], "permissions": share.shares[key]}
            updates.append(data)
    if updates:
        await db.execute(update(DashboardShare), updates)
        await db.commit()

    await crud.handle_dashboard_is_shared(db, dashboard_uuid)
    return schemas.SuccessReturn.success_instance()


@router.delete("/{dashboard_uuid}/share", response_model=schemas.SuccessReturn)
async def delete_share(
    dashboard_uuid: UUID,
    share: schemas.ShareDashboardList,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid", "email"], pro=True)),
):
    current_shares_query = (
        select(DashboardShare.uuid, DashboardShare.shared_user_uuid)
        .join(User, User.uuid == DashboardShare.shared_user_uuid)
        .join(DashboardItem, DashboardShare.dashboard_item_uuid == DashboardItem.uuid)
        .where(
            DashboardShare.dashboard_item_uuid == dashboard_uuid,
            DashboardShare.active.is_(True),
            User.email.in_(share.shares),
            or_(
                DashboardItem.owner_uuid == user.uuid,
                DashboardShare.shared_user_uuid == user.uuid,
            ),
        )
    )
    current_shares_response = await db.execute(current_shares_query)
    results = current_shares_response.mappings().all()

    current_shares = [x["uuid"] for x in results]
    if current_shares:
        delete_query = (
            update(DashboardShare)
            .where(
                DashboardShare.uuid.in_(current_shares), DashboardShare.active.is_(True)
            )
            .values(active=False)
        )
        await db.execute(delete_query)
        await db.commit()

        user_uuids = [
            x["shared_user_uuid"] for x in results if x["shared_user_uuid"] != user.uuid
        ]

        await crud.unshare_files(
            db, user.uuid, user_uuids, dashboard_uuid=dashboard_uuid
        )

    await crud.handle_dashboard_is_shared(db, dashboard_uuid)

    return {"success": True}


@router.get(
    "/{dashboard_uuid}/shares/users",
    response_model=dict[str, schemas.DashboardShareReturn],
)
async def see_available_users(
    dashboard_uuid: UUID,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "email", "permissions_uuid"], pro=True)
    ),
):
    trial_permissions_uuids = await crud.get_trial_permissions_uuids(db)
    complete_list: dict[str, schemas.DashboardShareReturn] = {}
    await validate_dashboard_ownership(db, dashboard_uuid, user.uuid)
    user_entity_query = select(PermissionsEntityMap.entity_uuid).where(
        PermissionsEntityMap.uuid == user.permissions_uuid
    )
    user_entity = (await db.execute(user_entity_query)).scalar_one_or_none()
    if user_entity is None:
        raise HTTPException(status_code=400, detail="Unable to find the user's entity")
    base_entity_uuid = await crud.get_trial_entity_uuid(db)

    all_users = []

    if user_entity != base_entity_uuid:
        all_users_query = (
            select(
                User.email,
                User.first_name,
                User.last_name,
                PermissionsEntityMap.entity_uuid,
            )
            .join(
                PermissionsEntityMap, User.permissions_uuid == PermissionsEntityMap.uuid
            )
            .where(
                PermissionsEntityMap.entity_uuid == user_entity,
                User.email != user.email,
            )
        )
        all_users = (await db.execute(all_users_query)).mappings().all()

    shared_users_query = (
        select(
            User.email,
            User.first_name,
            User.last_name,
            DashboardShare.permissions,
            DashboardShare.created_date,
        )
        .join(DashboardShare, User.uuid == DashboardShare.shared_user_uuid)
        .where(
            DashboardShare.dashboard_item_uuid == dashboard_uuid,
            DashboardShare.active.is_(True),
        )
    )
    shared_users = (await db.execute(shared_users_query)).mappings().all()
    for share in shared_users:
        complete_list[share.email] = schemas.DashboardShareReturn(
            first_name=share.first_name,
            last_name=share.last_name,
            is_invite=False,
            permissions=share.permissions,
            created_date=share.created_date,
        )
    for valid in all_users:
        if valid.email not in complete_list:
            complete_list[valid.email] = schemas.DashboardShareReturn(
                first_name=valid.first_name,
                last_name=valid.last_name,
                is_invite=False,
                permissions=None,
                created_date=None,
            )
    if user.permissions_uuid in trial_permissions_uuids:
        more_results = await crud.get_invite_shares(db, user.uuid, dashboard_uuid)
        complete_list |= more_results
    return complete_list


@router.get(
    "/shared-dashboard-viewed", response_model=list[schemas.SharedDashboardViewed]
)
async def get_shared_dashboard_viewed(
    db: AsyncSession = Depends(aget_read_db),
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    dashboard_uuid: UUID | None = None,
):
    """
    Get the shared dashboard viewed status.
    """
    shared_dashboard_query = select(
        DashboardShare.dashboard_item_uuid.label("dashboard_uuid"),
        DashboardShare.viewed,
    ).where(
        DashboardShare.shared_user_uuid == user.uuid,
    )
    if dashboard_uuid:
        shared_dashboard_query = shared_dashboard_query.where(
            DashboardShare.dashboard_item_uuid == dashboard_uuid,
        )
    shared_dashboards = (await db.execute(shared_dashboard_query)).all()
    if not shared_dashboards:
        raise HTTPException(
            status_code=400, detail="User does not have any shared dashboards."
        )

    return shared_dashboards


@router.patch(
    "/shared-dashboard-viewed/{dashboard_uuid}", response_model=schemas.SuccessReturn
)
async def patch_shared_dashboard_viewed(
    dashboard_uuid: UUID,
    db: AsyncSession = Depends(aget_read_db),
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Mark a shared dashboard as viewed.
    """
    update_query = (
        update(DashboardShare)
        .where(
            DashboardShare.shared_user_uuid == user.uuid,
            DashboardShare.dashboard_item_uuid == dashboard_uuid,
        )
        .values(viewed=True)
    )
    await db.execute(update_query)
    await db.commit()
    return schemas.SuccessReturn.success_instance()
