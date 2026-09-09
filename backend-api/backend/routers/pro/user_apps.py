from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import delete, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api import auth_helpers, crud, models, schemas
from api.database import aget_read_db, aget_write_db
from api.email import EmailService
from api.models import PermissionsEntityMap, User, UserApp, UserAppShare
from routers import pro_helpers, routers_helpers
from utilities.config import settings

router = APIRouter(
    prefix="/pro/user-apps",
    tags=["pro-user-apps"],
    dependencies=[Depends(auth_helpers.check_openbb)],
)


async def validate_app_ownership(db: AsyncSession, app_uuid: UUID, user_uuid: UUID):
    error_message = await crud.app_owner_errors(db, app_uuid, user_uuid)
    if error_message:
        raise HTTPException(status_code=403, detail=error_message)


@router.get("/sync", response_model=schemas.UserAppsComplete)
async def get_user_apps(
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to retrieve user apps data.

    Args:
        db (AsyncSession): The database session.
        user (User): The authenticated user.

    Returns:
        List[schemas.UserAppReturn]: A list of user apps data.
    """

    result = await pro_helpers.get_user_apps_complete(user=user)
    if not result:
        raise HTTPException(status_code=404, detail="User apps data not found")
    return result


@router.post("/{app_uuid}", response_model=schemas.UserAppsComplete)
async def post_user_app(
    app_uuid: UUID,
    user_app_data: schemas.UserAppCreate,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to create or update user apps data.

    Args:
        user_app_data (schemas.UserAppCreate): The user app data to be created or updated.
        db (AsyncSession): The database session.
        user (User): The authenticated user.

    Returns:
        SuccessReturn: An instance indicating the operation was successful.
    """
    query = (
        select(models.UserApp)
        .where(
            models.UserApp.user_uuid == user.uuid,
            models.UserApp.uuid == app_uuid,
        )
        .limit(1)
    )
    existing_data = (await db.execute(query)).scalar_one_or_none()
    if existing_data:
        update_query = (
            update(models.UserApp)
            .where(
                models.UserApp.user_uuid == user.uuid,
                models.UserApp.uuid == app_uuid,
            )
            .values(content=user_app_data.model_dump())
        )
        await db.execute(update_query)
        await db.commit()

        from api.helpers import handle_share_files  # noqa

        handle_share_files(owner_uuid=user.uuid, user_app_uuid=app_uuid)
    else:
        insert_query = insert(models.UserApp).values(
            uuid=app_uuid,
            user_uuid=user.uuid,
            content=user_app_data.model_dump(),
        )
        await db.execute(insert_query)
    await db.commit()
    return await pro_helpers.get_user_apps_complete(user=user)


@router.delete("/{app_uuid}", response_model=schemas.UserAppsComplete)
async def delete_user_app(
    app_uuid: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to delete user apps data.

    Args:
        app_uuid (UUID): The UUID of the app to be deleted.
        db (AsyncSession): The database session.
        user (User): The authenticated user.

    Returns:
        SuccessReturn: An instance indicating the operation was successful.
    """
    delete_query = delete(models.UserApp).where(
        models.UserApp.user_uuid == user.uuid,
        models.UserApp.uuid == app_uuid,
    )
    result = await db.execute(delete_query)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="User app data not found")
    await db.commit()
    return await pro_helpers.get_user_apps_complete(user=user)


@router.get("/{app_uuid}/shares", response_model=dict[str, schemas.UserAppShareReturn])
async def get_shares(
    app_uuid: UUID,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "email", "permissions_uuid"], pro=True)
    ),
):
    trial_permissions_uuids = await crud.get_trial_permissions_uuids(db)
    final_result: dict[str, schemas.UserAppShareReturn] = {}
    query = (
        select(
            User.email,
            User.first_name,
            User.last_name,
            UserAppShare.permissions,
            UserAppShare.created_date,
        )
        .select_from(UserAppShare)
        .join(User, User.uuid == UserAppShare.shared_user_uuid)
        .join(UserApp, UserApp.uuid == UserAppShare.user_app_uuid)
        .where(
            UserAppShare.active.is_(True),
            UserApp.user_uuid == user.uuid,
            UserApp.uuid == app_uuid,
        )
    )
    for shared in (await db.execute(query)).mappings().all():
        final_result[shared.email] = schemas.UserAppShareReturn(
            first_name=shared.first_name,
            last_name=shared.last_name,
            permissions=shared.permissions,
            created_date=shared.created_date,
            is_invite=False,
        )
    if user.permissions_uuid in trial_permissions_uuids:
        more_results = await crud.get_invite_shares(db, user.uuid, app_uuid=app_uuid)
        final_result |= more_results
    return final_result


@router.post("/{app_uuid}/share", response_model=schemas.SuccessReturn)
async def add_share(
    app_uuid: UUID,
    share: schemas.ShareUserApp,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "email", "permissions_uuid"], pro=True)
    ),
):
    if user.permissions_uuid is None:
        raise HTTPException(
            status_code=400, detail="The user does not have permissions"
        )
    await validate_app_ownership(db, app_uuid, user.uuid)
    clean_shares = await crud.get_app_shares_without_existing(
        db, share, app_uuid, user.email
    )
    if not clean_shares:
        return schemas.SuccessReturn.success_instance()

    trial_entity_uuid = await crud.get_trial_entity_uuid(db)
    user_permissions, user_emails, entity_uuid, user_uuids = (
        await crud.get_new_sharing_permissions(
            db, clean_shares, user.permissions_uuid, app_uuid=app_uuid
        )
    )

    found_user = bool(user_permissions)
    if user_permissions:
        await db.execute(insert(UserAppShare), user_permissions)
        await db.execute(
            update(UserApp)
            .where(
                UserApp.uuid == app_uuid,
                UserApp.user_uuid == user.uuid,
            )
            .values(is_shared=True)
        )
        await db.commit()
        await crud.share_files(db, user.uuid, user_uuids, user_app_uuid=app_uuid)

    # Send invite emails:
    if trial_entity_uuid == entity_uuid:
        to_invite = await crud.get_unregistered_users(db, share.shares, user_emails)
        found_user = found_user or bool(to_invite)

        for invite in to_invite:
            # We might want to add a clean email check here
            extra_info = schemas.RegisterProUser(
                inviting_uuid=user.uuid,
                inviting_email=user.email,
                shared_user_app=app_uuid,
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
        EmailService.send_share_notice(email, user.email, app_uuid)

    if not found_user:
        raise HTTPException(
            status_code=402, detail="User not found in your organization"
        )

    return schemas.SuccessReturn.success_instance()


@router.patch("/{app_uuid}/share", response_model=schemas.SuccessReturn)
async def update_share(
    app_uuid: UUID,
    share: schemas.ShareUserApp,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid", "email"], pro=True)),
):
    await validate_app_ownership(db, app_uuid, user.uuid)
    current_shares_query = (
        select(User.email, UserAppShare.permissions, UserAppShare.uuid)
        .join(UserAppShare, User.uuid == UserAppShare.shared_user_uuid)
        .where(
            UserAppShare.user_app_uuid == app_uuid,
            UserAppShare.active.is_(True),
            User.email.in_(share.shares.keys()),
        )
    )
    current_shares_response = (await db.execute(current_shares_query)).mappings().all()
    if not current_shares_response:
        await crud.handle_user_app_is_shared(db, app_uuid)
        return schemas.SuccessReturn.success_instance()
    current_shares = {x.email: (x.permissions, x.uuid) for x in current_shares_response}
    updates = []
    for key, value in current_shares.items():
        if value[0] != share.shares[key]:
            data = {"uuid": value[1], "permissions": share.shares[key]}
            updates.append(data)
    if updates:
        await db.execute(update(UserAppShare), updates)
        await db.commit()

    await crud.handle_user_app_is_shared(db, app_uuid)
    return schemas.SuccessReturn.success_instance()


@router.delete("/{app_uuid}/share", response_model=schemas.SuccessReturn)
async def delete_share(
    app_uuid: UUID,
    share: schemas.ShareUserAppList,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid", "email"], pro=True)),
):
    current_shares_query = (
        select(UserAppShare.uuid, UserAppShare.shared_user_uuid)
        .join(User, User.uuid == UserAppShare.shared_user_uuid)
        .join(UserApp, UserAppShare.user_app_uuid == UserApp.uuid)
        .where(
            UserAppShare.user_app_uuid == app_uuid,
            UserAppShare.active.is_(True),
            User.email.in_(share.shares),
            or_(
                UserApp.user_uuid == user.uuid,
                UserAppShare.shared_user_uuid == user.uuid,
            ),
        )
    )
    current_shares_response = await db.execute(current_shares_query)
    results = current_shares_response.mappings().all()

    current_shares = [x["uuid"] for x in results]
    if current_shares:
        delete_query = (
            update(UserAppShare)
            .where(UserAppShare.uuid.in_(current_shares), UserAppShare.active.is_(True))
            .values(active=False)
        )
        await db.execute(delete_query)
        await db.commit()

        user_uuids = [
            x["shared_user_uuid"] for x in results if x["shared_user_uuid"] != user.uuid
        ]

        await crud.unshare_files(db, user.uuid, user_uuids, user_app_uuid=app_uuid)

    await crud.handle_user_app_is_shared(db, app_uuid)

    return {"success": True}


@router.get(
    "/{app_uuid}/shares/users",
    response_model=dict[str, schemas.UserAppShareReturn],
)
async def see_available_users(
    app_uuid: UUID,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "email", "permissions_uuid"], pro=True)
    ),
):
    trial_permissions_uuids = await crud.get_trial_permissions_uuids(db)
    complete_list: dict[str, schemas.UserAppShareReturn] = {}
    await validate_app_ownership(db, app_uuid, user.uuid)
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
            UserAppShare.permissions,
            UserAppShare.created_date,
        )
        .join(UserAppShare, User.uuid == UserAppShare.shared_user_uuid)
        .where(
            UserAppShare.user_app_uuid == app_uuid,
            UserAppShare.active.is_(True),
        )
    )
    shared_users = (await db.execute(shared_users_query)).mappings().all()
    for share in shared_users:
        complete_list[share.email] = schemas.UserAppShareReturn(
            first_name=share.first_name,
            last_name=share.last_name,
            is_invite=False,
            permissions=share.permissions,
            created_date=share.created_date,
        )
    for valid in all_users:
        if valid.email not in complete_list:
            complete_list[valid.email] = schemas.UserAppShareReturn(
                first_name=valid.first_name,
                last_name=valid.last_name,
                is_invite=False,
                permissions=None,
                created_date=None,
            )
    if user.permissions_uuid in trial_permissions_uuids:
        more_results = await crud.get_invite_shares(db, user.uuid, app_uuid=app_uuid)
        complete_list |= more_results
    return complete_list


@router.get("/shared-app-viewed", response_model=list[schemas.SharedAppViewed])
async def get_shared_app_viewed(
    db: AsyncSession = Depends(aget_read_db),
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    app_uuid: UUID | None = None,
):
    """
    Get the shared app viewed status.
    """
    shared_app_query = select(
        UserAppShare.user_app_uuid.label("app_uuid"),
        UserAppShare.viewed,
    ).where(
        UserAppShare.shared_user_uuid == user.uuid,
    )
    if app_uuid:
        shared_app_query = shared_app_query.where(
            UserAppShare.user_app_uuid == app_uuid,
        )
    shared_apps = (await db.execute(shared_app_query)).all()
    if not shared_apps:
        raise HTTPException(
            status_code=400, detail="User does not have any shared apps."
        )

    return shared_apps


@router.patch("/shared-app-viewed/{app_uuid}", response_model=schemas.SuccessReturn)
async def patch_shared_app_viewed(
    app_uuid: UUID,
    db: AsyncSession = Depends(aget_read_db),
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Mark a shared app as viewed.
    """
    update_query = (
        update(UserAppShare)
        .where(
            UserAppShare.shared_user_uuid == user.uuid,
            UserAppShare.user_app_uuid == app_uuid,
        )
        .values(viewed=True)
    )
    await db.execute(update_query)
    await db.commit()
    return schemas.SuccessReturn.success_instance()
