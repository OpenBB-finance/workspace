"""Entity routes"""

import io
from contextlib import suppress
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import Row, case, delete, insert, literal, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api import auth_helpers, crud, helpers, models, schemas
from api.base import clean_email, get_now, random_password
from api.database import aget_read_db, aget_write_db
from api.email import EmailService
from api.models import (
    Entity,
    PermissionsEntityMap,
    PermissionsInvite,
    User,
    UserProInvite,
    UserRole,
)
from api.rate_limit import LIMIT_DEFAULT, exempt_user_agent, limiter
from api.schemas import ResetPasswordReturn, SuccessReturn
from routers import pro_helpers, routers_helpers
from scripts import export_user_data
from utilities.config import BaseModel, settings

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminPutEntity(BaseModel):
    require_authenticator: None | bool = None


async def get_admin_entity(db: AsyncSession, permissions_uuid: UUID) -> UUID:
    admin_query = select(PermissionsEntityMap.entity_uuid).where(
        PermissionsEntityMap.uuid == permissions_uuid
    )
    admin_entity_uuid = (await db.execute(admin_query)).scalar_one_or_none()
    if admin_entity_uuid is None:
        raise HTTPException(404, detail="Could not find the provided permissions map")
    return admin_entity_uuid


@router.patch("/entity", response_model=SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def patch_entity(
    request: Request,
    data: AdminPutEntity,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    admin_result = await get_admin_entity(db, admin.permissions_uuid)
    clean_values = data.model_dump(exclude_none=True)
    query = update(Entity).where(Entity.uuid == admin_result).values(**clean_values)
    response2 = await db.execute(query)
    if response2.rowcount == 0:
        raise HTTPException(404, detail="Entity does not exist")
    await db.commit()

    if data.require_authenticator is not None:
        await pro_helpers.require_entity_users_2fa(
            db, admin_result, data.require_authenticator
        )

    return SuccessReturn.success_instance()


@router.get("/entity", response_model=AdminPutEntity)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_entity(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    admin_result = await get_admin_entity(db, admin.permissions_uuid)
    query = select(Entity.require_authenticator).where(Entity.uuid == admin_result)
    return (await db.execute(query)).first()


@router.get("/entity-info", response_model=schemas.EntityInfoReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_entity_info(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    admin_result = await get_admin_entity(db, admin.permissions_uuid)
    total_count = await crud.get_total_user_count(db, admin_result)
    query = select(Entity.seats, Entity.expiration_date).where(
        Entity.uuid == admin_result
    )
    result = (await db.execute(query)).first()
    if result is None:
        raise HTTPException(404, detail="Entity does not exist")
    return schemas.EntityInfoReturn(
        seats=result.seats or 0,
        expiration_date=result.expiration_date,
        used_seats=total_count or 0,
    )


@router.get("/entity-map", response_model=list[schemas.EntityMapReturn])
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_entity_maps(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    admin_result = await get_admin_entity(db, admin.permissions_uuid)
    query = (
        select(PermissionsEntityMap)
        .options(selectinload(PermissionsEntityMap.entity))
        .where(PermissionsEntityMap.entity_uuid == admin_result)
    )

    return (await db.execute(query)).scalars().all()


@router.post("/register", response_model=SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def register_user(
    request: Request,
    user: schemas.UserCreateAdmin,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    """Allows an admin to register a new user"""
    await crud.check_clean_email(db, user.email)
    admin_query = (
        select(Entity.uuid)
        .select_from(PermissionsEntityMap)
        .join(Entity, Entity.uuid == PermissionsEntityMap.entity_uuid)
        .where(PermissionsEntityMap.uuid == admin.permissions_uuid)
    )
    admin_result = (await db.execute(admin_query)).first()
    if not admin_result:
        raise HTTPException(
            404, detail="Could not find the entity associated with the given admin"
        )
    perms_query = select(PermissionsEntityMap.entity_uuid).where(
        PermissionsEntityMap.uuid == user.permissions_uuid
    )
    perms_result = (await db.execute(perms_query)).first()
    if perms_result is None:
        raise HTTPException(404, detail="Could not find the provided permissions map")
    if perms_result.entity_uuid != admin_result.uuid:
        raise HTTPException(403, detail="Invalid permissions")
    extra_info = schemas.RegisterProUser(
        inviting_uuid=admin.uuid, inviting_email=admin.email
    )
    result = await routers_helpers.register_pro_user(db, user, extra_info)
    return SuccessReturn.from_bool(result)


@router.delete("/register/{invite_uuid}", response_model=SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def revoke_register_user(
    invite_uuid: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    admin_query = (
        select(Entity.uuid, Entity.seats)
        .select_from(PermissionsEntityMap)
        .join(Entity, Entity.uuid == PermissionsEntityMap.entity_uuid)
        .where(PermissionsEntityMap.uuid == admin.permissions_uuid)
    )
    admin_result = (await db.execute(admin_query)).first()
    if not admin_result:
        raise HTTPException(
            404, detail="Could not find the entity associated with the given admin"
        )
    perms_query = (
        select(PermissionsEntityMap.entity_uuid)
        .join(
            UserProInvite, UserProInvite.permissions_uuid == PermissionsEntityMap.uuid
        )
        .where(UserProInvite.uuid == invite_uuid)
    )
    perms_result = (await db.execute(perms_query)).first()
    if perms_result is None:
        raise HTTPException(404, detail="Could not find the provided permissions map")
    if perms_result.entity_uuid != admin_result.uuid:
        raise HTTPException(403, detail="Invalid permissions")
    delete_query = delete(UserProInvite).where(UserProInvite.uuid == invite_uuid)
    await db.execute(delete_query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.post("/users/{user_uuid}/revoke", response_model=SuccessReturn)
async def revoke_user(
    request: Request,
    user_uuid: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    admin_result = await get_admin_entity(db, admin.permissions_uuid)
    maps_query = select(PermissionsEntityMap.uuid).where(
        PermissionsEntityMap.entity_uuid == admin_result
    )
    maps_result = (await db.execute(maps_query)).all()
    maps_clean = [item.uuid for item in maps_result]
    query = (
        update(PermissionsInvite)
        .where(
            PermissionsInvite.user_uuid == user_uuid,
            PermissionsInvite.permissions_uuid.in_(maps_clean),
        )
        .values(revoked=True)
    )
    response = await db.execute(query)
    await db.commit()
    if response.rowcount == 0:
        raise HTTPException(404, detail="Invite does not exist")
    return SuccessReturn.success_instance()


@router.delete("/users/{user_uuid}/remove", response_model=SuccessReturn)
async def remove_user(
    request: Request,
    user_uuid: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    """This endpoint is used to remove a user from an entity."""
    if admin.is_superuser:
        query = update(User).where(User.uuid == user_uuid).values(permissions_uuid=None)
        response = await db.execute(query)
    else:
        admin_result = await get_admin_entity(db, admin.permissions_uuid)
        maps_query = select(PermissionsEntityMap.uuid).where(
            PermissionsEntityMap.entity_uuid == admin_result
        )
        maps_result = (await db.execute(maps_query)).all()
        maps_clean = [item.uuid for item in maps_result]
        query = (
            update(User)
            .where(User.uuid == user_uuid, User.permissions_uuid.in_(maps_clean))
            .values(permissions_uuid=None)
        )
        response = await db.execute(query)

    await crud.remove_shares_both_ways(db, user_uuid)
    await crud.update_user_dashboards_new_entity(db, user_uuid)

    await db.commit()
    if response.rowcount == 0:
        raise HTTPException(404, detail="Matching user not found")
    return SuccessReturn.success_instance()


@router.delete("/users/{user_uuid}", response_model=SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def delete_user(
    request: Request,
    user_uuid: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    _: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    """This endpoint is used to soft delete a user."""
    result = await pro_helpers.delete_user(db, user_uuid)
    return SuccessReturn.from_bool(result)


@router.patch("/users/{user_uuid}", response_model=SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def update_user(
    request: Request,
    user_uuid: UUID,
    update_info: schemas.UserAdminUpdate,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    admin_query = (
        select(Entity.uuid, Entity.seats)
        .select_from(PermissionsEntityMap)
        .join(Entity, Entity.uuid == PermissionsEntityMap.entity_uuid)
        .where(PermissionsEntityMap.uuid == admin.permissions_uuid)
    )
    admin_result = (await db.execute(admin_query)).first()
    if not admin_result:
        raise HTTPException(
            404, detail="Could not find the entity associated with the given admin"
        )
    if update_info.billing_active:
        total_count = await crud.get_total_user_count(db, admin_result.uuid)
        if total_count >= (admin_result.seats or 0):
            raise HTTPException(
                403, detail="The maximum amount of seats has already been reached"
            )
    maps_query = select(PermissionsEntityMap.uuid).where(
        PermissionsEntityMap.entity_uuid == admin_result.uuid
    )
    maps_result = (await db.execute(maps_query)).all()
    maps_clean = [item.uuid for item in maps_result]

    if (
        update_info.permissions_uuid is not None
        and not admin.is_superuser
        and update_info.permissions_uuid not in maps_clean
    ):
        raise HTTPException(
            403, detail="Cannot assign permissions from a different organization"
        )

    data = {}
    for field in update_info.model_fields_set:
        value = getattr(update_info, field)
        if value is not None:
            data[field] = value
    query = (
        update(User)
        .where(User.uuid == user_uuid, User.permissions_uuid.in_(maps_clean))
        .values(**data)
    )
    response = await db.execute(query)
    await db.commit()
    # In theory we should remove shares here, but since an admin should only be able to change inside the entity
    # it feels unnecessary
    if response.rowcount == 0:
        raise HTTPException(404, detail="Matching user not found")
    if update_info.billing_active is False:
        await auth_helpers.delete_user_pro_sessions(db, user_uuid)

    return SuccessReturn.success_instance()


@router.get("/validate", response_model=SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def validate_admin(
    request: Request,
    _: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    """This endpoint is used to validate that the user is an admin."""
    return SuccessReturn.success_instance()


@router.get("/users", response_model=list[schemas.UserAdminReturn])
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def see_users(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    results: list[schemas.UserAdminReturn] = []

    def add_to_list(to_add: list[dict], source: schemas.UserSourceType):
        for result in to_add:
            item = schemas.UserAdminReturn(source=source, **result)
            results.append(item)

    admin_result = await get_admin_entity(db, admin.permissions_uuid)
    results1 = await helpers.get_managed_users(db, admin_result)
    add_to_list([x._mapping for x in results1], source="user")
    results2 = await helpers.get_permissions_invite_users(db, admin_result)
    add_to_list([x._mapping for x in results2], source="takeover")
    results3 = await helpers.get_pro_invite_users(db, admin_result)
    cleaned3 = [
        {
            "email": x[0],
            "role": x[1],
            "first_name": x[2].get("first_name"),
            "last_name": x[2].get("last_name"),
            "uuid": x[3],
        }
        for x in results3
    ]
    add_to_list(cleaned3, source="invite")
    return results


@router.get("/apps", response_model=list[schemas.AppReturn])
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_apps(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    """Retrieve all apps for users in the entity, sorted by user_uuid"""
    admin_result = await get_admin_entity(db, admin.permissions_uuid)

    # Get all users in the entity
    maps_query = select(PermissionsEntityMap.uuid).where(
        PermissionsEntityMap.entity_uuid == admin_result
    )
    maps_result = (await db.execute(maps_query)).all()
    maps_clean = [item.uuid for item in maps_result]

    # Get all users with these permission maps
    users_query = select(User.uuid, User.email).where(
        User.permissions_uuid.in_(maps_clean),
        User.deleted.is_(False),
    )
    users_result = (await db.execute(users_query)).all()
    user_dict = {user.uuid: user.email for user in users_result}

    # Get all apps for these users
    apps_query = (
        select(
            models.ApiSource.uuid,
            models.ApiSource.name,
            models.ApiSource.url,
            models.ApiSource.user_uuid,
            models.ApiSource.created_date,
            models.ApiSource.updated_date,
        )
        .where(models.ApiSource.user_uuid.in_(user_dict.keys()))
        .order_by(models.ApiSource.user_uuid)
    )

    apps_result = (await db.execute(apps_query)).all()

    if apps_result is None:
        raise HTTPException(404, detail="No apps found")

    return [
        schemas.AppReturn(
            uuid=app.uuid,
            name=app.name,
            url=str(app.url),
            user_email=user_dict.get(app.user_uuid),
            user_uuid=app.user_uuid,
            created_date=app.created_date,
            updated_date=app.updated_date,
        )
        for app in apps_result
    ]


@router.get("/providers", response_model=schemas.ProKeys)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_providers(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    query = (
        select(Entity.api_keys)
        .join(
            PermissionsEntityMap,
            Entity.uuid == PermissionsEntityMap.entity_uuid,
        )
        .where(PermissionsEntityMap.uuid == admin.permissions_uuid)
    )
    result = (await db.execute(query)).first()
    if result is None:
        raise HTTPException(404, detail="Could not find an entity")
    return result.api_keys


@router.patch("/providers", response_model=SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def patch_providers(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    admin: Annotated[User, Depends(auth_helpers.get_current_admin)],
    data: schemas.ProKeys,
):
    if admin.permissions_uuid is None:
        raise HTTPException(400, detail="Invalid admin configuration")
    admin_result = await get_admin_entity(db, admin.permissions_uuid)
    current_q = select(Entity.api_keys).where(Entity.uuid == admin_result)
    current_result = (await db.execute(current_q)).first()
    if current_result is None:
        raise HTTPException(404, detail="Could not find an entity")
    new_model = current_result.api_keys
    validate_return = data.validate_keys()
    if validate_return:
        raise HTTPException(422, detail=f"Invalid key for source: {validate_return}")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(new_model, key, value)

    if admin_result is None:
        raise HTTPException(404, detail="Could not find the provided permissions map")
    query = update(Entity).where(Entity.uuid == admin_result).values(api_keys=new_model)
    response = await db.execute(query)
    await db.commit()
    if response.rowcount == 0:
        raise HTTPException(404, detail="Could not find an entity")
    return SuccessReturn.success_instance()


@router.get("/extend-trial/{user_uuid}", response_model=SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def extend_trial(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    admin: Annotated[User, Depends(auth_helpers.get_current_admin)],
    user_uuid: UUID,
):
    if not admin.permissions_uuid:
        raise HTTPException(
            404, detail="User is currently not assigned any permissions"
        )
    admin_result = await get_admin_entity(db, admin.permissions_uuid)
    maps_query = select(PermissionsEntityMap.uuid).where(
        PermissionsEntityMap.entity_uuid == admin_result
    )
    maps_result = (await db.execute(maps_query)).all()
    maps_clean = [item.uuid for item in maps_result]
    query = select(User.email, User.uuid).where(
        User.uuid == user_uuid, User.permissions_uuid.in_(maps_clean)
    )
    user = (await db.execute(query)).first()
    if user is None:
        raise HTTPException(404, detail="User not found")
    EmailService.extend_pro_trial(user[0], user[1])
    return SuccessReturn.success_instance()


@router.get("/entitlement/{user_uuid}", response_model=schemas.EntitlementGet)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_entitlement(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user_uuid: UUID,
    _: Annotated[User, Depends(auth_helpers.get_current_admin)],
):
    """Endpoint to retrieve the entitlement for a user."""

    query = (
        select(
            case(
                (models.Entitlement.tier_id == models.PRO_TIER_ID, literal("pro")),
                (
                    models.Entitlement.tier_id == models.TERMINAL_TIER_ID,
                    literal("terminal"),
                ),
                else_=None,
            ).label("tier"),
            models.Entitlement.number_copilot_calls_day,
            models.Entitlement.total_file_upload_size_gb,
            models.Entitlement.share_widgets,
            models.Entitlement.bring_your_own_data,
            models.Entitlement.bring_your_own_copilot,
            models.Entitlement.admin_access,
            models.Entitlement.support,
            models.Entitlement.excel_add_in,
            models.Entitlement.data_add_ons_redistribution,
            models.Entitlement.allow_custom_backends,
            # DataBundle fields
            models.DataBundle.bundle_name,
        )
        .select_from(models.Entitlement)
        .join(
            models.DataBundle,
            models.Entitlement.data_bundle_uuid == models.DataBundle.uuid,
            isouter=True,
        )
        .where(models.Entitlement.user_uuid == user_uuid)
        .limit(1)
    )
    result = (await db.execute(query)).first()
    if result is None:
        raise HTTPException(404, detail="Entitlement not found")

    # The result is sent with no data bundle info on purpose since it's not needed for the admin panel
    return result


@router.patch("/entitlement/{user_uuid}", response_model=SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def patch_entitlement(
    request: Request,
    entitlement: schemas.EntitlementPatch,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user_uuid: UUID,
    _: Annotated[User, Depends(auth_helpers.get_current_admin)],
):
    """Endpoint to update the entitlement for a user."""
    tiers_match = {
        "pro": models.PRO_TIER_ID,
        "terminal": models.TERMINAL_TIER_ID,
    }
    if not await pro_helpers.has_entitlement(db, user_uuid):
        raise HTTPException(status_code=404, detail="Entitlement not found")

    entitlement_dict = entitlement.model_dump(exclude_unset=True)
    if tier := entitlement_dict.pop("tier", None):
        # User can't be on a different tier than the associated entity
        await pro_helpers.check_against_entity_tier(db, user_uuid, tier)

        entitlement_dict["tier_id"] = tiers_match.get(tier)

    if bundle_name := entitlement_dict.pop("bundle_name", None):
        entitlement_dict["data_bundle_uuid"] = await pro_helpers.get_data_bundle_uuid(
            db, bundle_name
        )

    query = (
        update(models.Entitlement)
        .where(models.Entitlement.user_uuid == user_uuid)
        .values(**entitlement_dict)
    )
    await db.execute(query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.post("/reset-password/{user_uuid}", response_model=ResetPasswordReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def post_reset_password(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user_uuid: UUID,
    admin: Annotated[User, Depends(auth_helpers.get_current_admin)],
):
    """Endpoint to reset the password for a user."""
    if not admin.is_superuser:
        admin_entity_uuid = await get_admin_entity(db, admin.permissions_uuid)
        target_entity_query = (
            select(PermissionsEntityMap.entity_uuid)
            .join(User, User.permissions_uuid == PermissionsEntityMap.uuid)
            .where(User.uuid == user_uuid)
        )
        target_entity_uuid = (
            await db.execute(target_entity_query)
        ).scalar_one_or_none()
        if target_entity_uuid is None or target_entity_uuid != admin_entity_uuid:
            raise HTTPException(
                403, detail="Cannot reset password for users outside your organization"
            )

    new_password = random_password()
    update_query = (
        update(User)
        .where(User.uuid == user_uuid)
        .values(password=new_password, temporary_password=True)
    )
    await db.execute(update_query)
    await db.commit()

    # Remove all sessions for the user
    delete_query = delete(models.Session).where(models.Session.user_uuid == user_uuid)
    await db.execute(delete_query)
    await db.commit()

    return ResetPasswordReturn(
        success=True,
        temporary_password=new_password,
    )


@router.post("/users/{user_uuid}/export")
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def post_export_user_data(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user_uuid: UUID,
    superuser: Annotated[User, Depends(auth_helpers.get_current_superuser)],
    include_history: Annotated[
        bool, Query(description="Include dashboard version history")
    ] = False,
    include_legacy: Annotated[
        bool, Query(description="Include the legacy copilot chat table")
    ] = False,
    with_files: Annotated[
        bool,
        Query(
            description="Download the account's uploaded files into the archive. "
            "Slow -- on a large account this can exceed the proxy's idle timeout."
        ),
    ] = False,
):
    """Export a user's account as a portable zip archive.

    **Superuser only.** Org admins cannot call this. The archive is a complete
    copy of somebody's account including their credentials in the clear, so the
    bar is deliberately higher than for the rest of /admin -- an org admin
    resetting a password is recoverable, exfiltrating an account is not.

    The archive carries the user's dashboards, widgets, custom backends and
    chats, and can be imported into OpenBB Lite. Uploaded files travel in the
    archive's files/ folder for the user to keep, but are not reinstated on
    import. Exactly what travels is defined by ``scripts.user_data_scope``.

    The response contains **unencrypted** backend and copilot credentials -- the
    destination instance encrypts under a different key, so they cannot be
    carried across as ciphertext. Treat the archive as secret.
    """
    target_query = select(User).where(User.uuid == user_uuid)
    target = (await db.execute(target_query)).scalar_one_or_none()
    if target is None:
        raise HTTPException(404, detail="User not found")

    logger.info(
        f"Superuser {superuser.email} is exporting the account {target.email}"
    )

    try:
        payload, result = await export_user_data.build_archive(
            db,
            str(target.email),
            include_history=include_history,
            include_legacy=include_legacy,
            with_files=with_files,
        )
    except export_user_data.ExportError as exc:
        raise HTTPException(400, detail=str(exc)) from exc

    return StreamingResponse(
        io.BytesIO(payload),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{result.archive.name}"',
            "X-OpenBB-Export-Rows": str(result.total_rows),
            "X-OpenBB-Export-Files": str(result.files_written),
        },
    )


@router.post("/reset-2fa/{user_uuid}", response_model=SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def post_reset_2fa(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user_uuid: UUID,
    admin: Annotated[User, Depends(auth_helpers.get_current_admin)],
):
    """Endpoint to reset the 2FA for a user."""
    if not admin.is_superuser:
        admin_entity_uuid = await get_admin_entity(db, admin.permissions_uuid)
        target_entity_query = (
            select(PermissionsEntityMap.entity_uuid)
            .join(User, User.permissions_uuid == PermissionsEntityMap.uuid)
            .where(User.uuid == user_uuid)
        )
        target_entity_uuid = (
            await db.execute(target_entity_query)
        ).scalar_one_or_none()
        if target_entity_uuid is None or target_entity_uuid != admin_entity_uuid:
            raise HTTPException(
                403, detail="Cannot reset 2FA for users outside your organization"
            )
    update_query = (
        update(User)
        .where(User.uuid == user_uuid)
        .values(totp_secret=None, totp_active=False)
    )
    await db.execute(update_query)
    await db.commit()

    # Remove all sessions for the user
    delete_query = delete(models.Session).where(models.Session.user_uuid == user_uuid)
    await db.execute(delete_query)
    await db.commit()

    return SuccessReturn.success_instance()


@router.post("/create-user", response_model=schemas.ResetPasswordReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def create_user(
    request: Request,
    user: schemas.UserCreateAdmin,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    _: Annotated[Row, Depends(auth_helpers.get_current_admin)],
):
    """Allows an admin to register a new user, if the user isn't already registered or invited"""
    # Check if the entity has available seats
    permissions_query = select(PermissionsEntityMap.entity_uuid).where(
        PermissionsEntityMap.uuid == user.permissions_uuid
    )
    entity_uuid = (await db.execute(permissions_query)).first()[0]
    seats_query = select(Entity.seats).where(Entity.uuid == entity_uuid)
    seats = (await db.execute(seats_query)).first()[0]
    total_count = await crud.get_total_user_count(db, entity_uuid)
    if total_count >= (seats or 0):
        raise HTTPException(
            403, detail="The maximum amount of seats has already been reached"
        )

    # Check if the user is already invited
    query_invite = select(UserProInvite.uuid).where(UserProInvite.email == user.email)
    invite_result = (await db.execute(query_invite)).first()
    if invite_result:
        raise HTTPException(409, detail="User is already invited")

    # Check if the user is already registered
    if await crud.check_new_user(db, user.email):
        raise HTTPException(409, detail="A user with this email already exists")

    pro_trial_granted = user.permissions_uuid != settings.PRO_DEVELOPER_MAPPING
    nowish = get_now()

    # hubspot contact creation removed — not needed for marketing provider

    # Create user
    random_pw = random_password()
    insert_query = insert(User).values(
        email=user.email,
        clean_email=clean_email(user.email),
        permissions_uuid=user.permissions_uuid,
        password=random_pw,
        first_name=user.first_name,
        last_name=user.last_name,
        billing_active=True,
        pro_start=get_now(),
        confirmed=1,
        temporary_password=True,
        pro_trial_granted=pro_trial_granted,
        pro_trial_granted_date=nowish if pro_trial_granted else None,
    )
    response = await db.execute(insert_query)

    if response.rowcount == 0:
        raise HTTPException(404, detail="User was not created")

    # Add role if provided
    if role := user.role:
        role_insert = insert(UserRole).values(
            user_uuid=response.inserted_primary_key[0],
            role_uuid=role,
        )
        await db.execute(role_insert)

    await db.commit()
    return schemas.ResetPasswordReturn(
        success=True,
        temporary_password=random_pw,
    )


@router.post("/role", response_model=schemas.SuccessReturn)
async def post_role(
    role: schemas.PostRole,
    db: AsyncSession = Depends(aget_write_db),
    admin: User = Depends(auth_helpers.get_current_admin),
):
    """
    Create a new role for the entity
    """
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    new_role = models.Role(
        uuid=role.uuid,
        name=role.name,
        description=role.description,
        entity_uuid=entity_uuid,
    )
    db.add(new_role)
    await db.flush()
    role_uuid = new_role.uuid

    if role.users:
        await pro_helpers.add_users_to_role(db, role_uuid, role.users)

    await db.commit()

    return schemas.SuccessReturn.success_instance()


@router.get("/role", response_model=list[schemas.GetRoleWithUsers])
async def get_roles(
    db: AsyncSession = Depends(aget_read_db),
    admin: User = Depends(auth_helpers.get_current_admin),
):
    """
    Get all roles for the entity
    """
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    query = select(models.Role).where(
        models.Role.entity_uuid == entity_uuid, models.Role.deleted_at.is_(None)
    )
    roles = await db.execute(query)

    result = []
    for role in roles.scalars():
        role_users = await pro_helpers.get_role_users(db, role.uuid)
        result.append(
            schemas.GetRoleWithUsers(
                uuid=role.uuid,
                name=role.name,
                description=role.description,
                updated_date=role.updated_date,
                users=role_users,
            )
        )
    return result


@router.get("/role/{role_uuid}", response_model=schemas.GetRoleWithUsers)
async def get_role(
    role_uuid: UUID,
    db: AsyncSession = Depends(aget_read_db),
    admin: User = Depends(auth_helpers.get_current_admin),
):
    """Get a role by uuid"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    role = (
        await db.execute(
            select(models.Role).where(
                models.Role.uuid == role_uuid,
                models.Role.entity_uuid == entity_uuid,
                models.Role.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    role_users = await pro_helpers.get_role_users(db, role_uuid)
    return schemas.GetRoleWithUsers(
        uuid=role.uuid,
        name=role.name,
        description=role.description,
        updated_date=role.updated_date,
        users=role_users,
    )


@router.patch("/role/{role_uuid}", response_model=schemas.SuccessReturn)
async def patch_role(
    role_uuid: UUID,
    role: schemas.PatchRole,
    db: AsyncSession = Depends(aget_write_db),
    admin: User = Depends(auth_helpers.get_current_admin),
):
    """Patch a role"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    if not await pro_helpers.role_exists(db, role_uuid, entity_uuid):
        raise HTTPException(status_code=404, detail="Role not found")

    # Update role details if name or description provided
    adjusted_role = role.model_dump(
        exclude={"users"}, exclude_unset=True, exclude_none=True
    )

    if adjusted_role:
        db_role = await db.get(models.Role, role_uuid)
        if db_role and db_role.entity_uuid == entity_uuid:
            for key, value in adjusted_role.items():
                setattr(db_role, key, value)
            await db.flush()

    # Update users if provided
    if role.users is not None:  # Check if None since empty list is valid
        await pro_helpers.update_role_users(db, role_uuid, role.users)

    await db.commit()
    return schemas.SuccessReturn.success_instance()


@router.delete("/role/{role_uuid}", response_model=schemas.SuccessReturn)
async def delete_role(
    role_uuid: UUID,
    db: AsyncSession = Depends(aget_write_db),
    admin: User = Depends(auth_helpers.get_current_admin),
):
    """Delete a role"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    if not await pro_helpers.role_exists(db, role_uuid, entity_uuid):
        raise HTTPException(status_code=404, detail="Role not found")

    role = await db.get(models.Role, role_uuid)
    if not role or role.entity_uuid != entity_uuid:
        raise HTTPException(status_code=404, detail="Role not found")

    await role.soft_delete(db)
    await db.commit()

    return schemas.SuccessReturn.success_instance()


@router.put("/role-permissions/{role_uuid}", response_model=schemas.SuccessReturn)
async def put_role_permissions(
    role_uuid: UUID,
    role_permissions: list[schemas.RolePermissions],
    db: AsyncSession = Depends(aget_write_db),
    admin: User = Depends(auth_helpers.get_current_admin),
):
    """Update the permissions for a role"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    if not await pro_helpers.role_exists(db, role_uuid, entity_uuid):
        raise HTTPException(status_code=404, detail="Role not found")

    for item in role_permissions:
        if item.type == "backend":
            await pro_helpers.insert_or_update_backend_permissions(
                db, role_uuid, item.uuid, item
            )
        elif item.type == "file":
            await pro_helpers.insert_or_update_file_permissions(
                db, role_uuid, item.uuid, item.access
            )
        elif item.type == "prompt":
            if not item.prompt and item.templates:
                await pro_helpers.insert_or_update_prompt_template_permissions(
                    db, role_uuid, item
                )
            else:
                await pro_helpers.insert_or_update_prompt_permissions(
                    db, role_uuid, item.uuid, item.access
                )

    await db.flush()
    await db.commit()

    return schemas.SuccessReturn.success_instance()


@router.get(
    "/role-permissions/{role_uuid}", response_model=list[schemas.RolePermissions]
)
async def get_role_permissions(
    role_uuid: UUID,
    db: AsyncSession = Depends(aget_read_db),
    admin: User = Depends(auth_helpers.get_current_admin),
):
    """Get the permissions for a role"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    if not await pro_helpers.role_exists(db, role_uuid, entity_uuid):
        raise HTTPException(status_code=404, detail="Role not found")

    permissions = []
    # Get backend permissions
    permissions_backends = await db.execute(
        select(models.RoleBackend).where(models.RoleBackend.role_uuid == role_uuid)
    )
    permissions.extend(
        [
            schemas.RolePermissions(
                uuid=permission.backend_uuid,
                access=permission.access,
                widgets=permission.widgets,
                templates=permission.templates,
                type="backend",
                category="data-connectors",
            )
            for permission in permissions_backends.scalars()
        ]
    )

    # Get file permissions
    permissions_files = await db.execute(
        select(
            models.RoleFile.file_uuid,
            models.RoleFile.access,
            models.FileWidget.extension,
        )
        .join(models.FileWidget, models.RoleFile.file_uuid == models.FileWidget.uuid)
        .where(models.RoleFile.role_uuid == role_uuid)
    )

    permissions.extend(
        [
            schemas.RolePermissions(
                uuid=permission["file_uuid"],
                access=permission["access"],
                type="file",
                category="data-connectors",
                file_extension=permission["extension"],
            )
            for permission in permissions_files.mappings()
        ]
    )

    # Get prompt permissions
    permissions_prompts = await db.execute(
        select(
            models.RolePrompt.prompt_uuid,
            models.RolePrompt.access,
            models.UserPrompts.prompt,
        )
        .join(
            models.UserPrompts, models.RolePrompt.prompt_uuid == models.UserPrompts.uuid
        )
        .where(models.RolePrompt.role_uuid == role_uuid)
    )

    permissions.extend(
        [
            schemas.RolePermissions(
                uuid=permission["prompt_uuid"],
                access=permission["access"],
                type="prompt",
                category="prompts",
                prompt=permission["prompt"],
            )
            for permission in permissions_prompts.mappings()
        ]
    )
    return permissions


@router.get(
    "/role-permissions-audit-logs", response_model=list[schemas.RoleAuditLogReturn]
)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_audit_logs(  # noqa: PLR0913, PLR0917
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    admin: Annotated[Row, Depends(auth_helpers.get_current_admin)],
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    action: schemas.RoleAuditAction | None = Query(None),
    resource_type: schemas.RoleResourceType | None = Query(None),
    role_uuid: UUID | None = Query(None),
):
    """Retrieve audit logs for the entity"""
    # Get admin's entity
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)

    # Build query
    query = (
        select(
            models.AuditEntityRolesPermissions.uuid,
            models.AuditEntityRolesPermissions.created_date,
            models.AuditEntityRolesPermissions.entity_uuid,
            models.AuditEntityRolesPermissions.role_uuid,
            models.AuditEntityRolesPermissions.action,
            models.AuditEntityRolesPermissions.resource_type,
            models.AuditEntityRolesPermissions.resource_uuid,
            models.AuditEntityRolesPermissions.details,
            models.User.email.label("performed_by_email"),
            models.Role.name.label("role_name"),
        )
        .join(
            models.User,
            models.AuditEntityRolesPermissions.performed_by_uuid == models.User.uuid,
        )
        .join(
            models.Role,
            models.AuditEntityRolesPermissions.role_uuid == models.Role.uuid,
        )
        .where(models.AuditEntityRolesPermissions.entity_uuid == entity_uuid)
        .order_by(models.AuditEntityRolesPermissions.created_date.desc())
    )

    if start_date:
        query = query.where(
            models.AuditEntityRolesPermissions.created_date >= start_date
        )
    if end_date:
        query = query.where(models.AuditEntityRolesPermissions.created_date <= end_date)
    if action:
        query = query.where(models.AuditEntityRolesPermissions.action == action)
    if resource_type:
        query = query.where(
            models.AuditEntityRolesPermissions.resource_type == resource_type
        )
    if role_uuid:
        query = query.where(models.AuditEntityRolesPermissions.role_uuid == role_uuid)

    # Execute query
    results = await db.execute(query)

    # Transform results
    audit_logs = []
    for row in results.mappings():
        details_msg = None
        with suppress(Exception):
            details_msg = pro_helpers.create_details_message(
                row["action"], row["resource_type"], row["details"]
            )

        audit_log = schemas.RoleAuditLogReturn(
            uuid=row["uuid"],
            created_at=row["created_date"],
            entity_uuid=row["entity_uuid"],
            role_uuid=row["role_uuid"],
            action=row["action"],
            resource_type=row["resource_type"],
            resource_uuid=row["resource_uuid"],
            performed_by_email=row["performed_by_email"],
            details=row["details"],
            details_msg=details_msg,
            role_name=row["role_name"],
        )
        audit_logs.append(audit_log)

    return audit_logs


@router.get(
    "/user-permissions/{user_uuid}", response_model=list[schemas.UserPermissions]
)
async def get_user_permissions(
    user_uuid: UUID,
    db: AsyncSession = Depends(aget_read_db),
    _: User = Depends(auth_helpers.get_current_admin),
):
    """Get the permissions for a user"""
    user_role_permissions = await pro_helpers.get_user_role_permissions(db, user_uuid)

    # Convert permissions dict to use role names as keys instead of UUIDs
    permissions_dict = user_role_permissions.model_dump().get("permissions", {})
    named_permissions = {}
    for role_uuid, role_data in permissions_dict.items():
        # Don't try to convert role_uuid to UUID again, it's already a string
        role_name = await pro_helpers.get_role_name(db, role_uuid)
        named_permissions[role_name] = role_data
    user_role_permissions.permissions = named_permissions

    data_connectors = []
    templates = []
    prompts = []
    processed_backends = set()
    processed_files = set()
    processed_templates = set()
    processed_prompts = set()

    for role_name, role_data in (
        user_role_permissions.model_dump().get("permissions", {}).items()
    ):
        for backend in role_data.get("backends", []):
            await pro_helpers.process_backend(
                role_name, backend, data_connectors, processed_backends
            )
            await pro_helpers.process_templates(
                role_name,
                backend,
                processed_templates,
                templates,
                prompts,  # Pass prompts list
                processed_prompts,  # Pass processed prompts set
            )

        for file in role_data.get("files", []):
            await pro_helpers.process_file(
                role_name, file, data_connectors, processed_files
            )

        # Process standalone prompts
        await pro_helpers.process_prompts(
            role_name, role_data.get("prompts", []), processed_prompts, prompts
        )

    # Add final_permission to all resources
    await pro_helpers.add_final_permissions_to_resources(
        data_connectors, templates, prompts
    )

    return [
        schemas.UserPermissions(
            data_connectors=data_connectors, templates=templates, prompts=prompts
        )
    ]


@router.patch("/theme-settings", response_model=schemas.SuccessReturn)
async def patch_ag_grid_theme_settings(
    settings: schemas.EntityThemeSettings,
    db: AsyncSession = Depends(aget_write_db),
    admin: User = Depends(auth_helpers.get_current_admin),
):
    """Update the ag-grid theme settings for the entity"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    existing = (
        await db.execute(
            select(models.EntityThemeSettings).where(
                models.EntityThemeSettings.entity_uuid == entity_uuid
            )
        )
    ).scalar_one_or_none()

    adjusted_settings = settings.model_dump(exclude_unset=True)
    if existing:
        setattr(existing, "settings", adjusted_settings)
    else:
        new_settings = models.EntityThemeSettings(
            entity_uuid=entity_uuid, settings=adjusted_settings
        )
        db.add(new_settings)

    await db.commit()
    return schemas.SuccessReturn.success_instance()
