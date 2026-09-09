import json
from uuid import UUID

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import case, func, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api import base, crud, schemas
from api.email import EmailService
from api.models import (
    Entity,
    PermissionsEntityMap,
    PermissionsInvite,
    User,
    UserProInvite,
)
from utilities.config import settings

# Dead code: nothing selects this column. Do not use as-is — BIN_TO_UUID is a
# MySQL-only function, so any query including it fails on SQLite and PostgreSQL.
profile_url_column = case(
    (
        User.has_profile_url.is_(True),
        func.concat(settings.S3_IMAGE_BUCKET, func.bin_to_uuid(User.uuid), ".png"),
    ),
    else_=None,
).label("profile_url")


class UserToRegister(BaseModel):
    first_name: None | str
    last_name: None | str
    uuid: UUID
    confirmed: bool
    permissions_uuid: None | UUID


def get_final_shares(
    original: None | dict[str, schemas.permissions_type],
    new: None | UUID,
    perms: None | schemas.permissions_type,
) -> None | dict[str, schemas.permissions_type]:
    base = original or {}
    if new and perms:
        base[str(new)] = perms
    return base or None


async def initiate_account_takeover(
    db: AsyncSession,
    user: schemas.UserCreateAdmin | schemas.UserCreateProAdmin,
    db_user: UserToRegister,
    information: schemas.RegisterProUser,
) -> bool:
    query = (
        select(Entity.name, Entity.uuid)
        .select_from(Entity)
        .join(PermissionsEntityMap, Entity.uuid == PermissionsEntityMap.entity_uuid)
        .where(PermissionsEntityMap.uuid == user.permissions_uuid)
    )
    entity_result = (await db.execute(query)).first()
    if entity_result is None:
        raise HTTPException(404, detail="Entity does not exist")
    existing_invite_query = select(
        PermissionsInvite.uuid,
        PermissionsInvite.shared_dashboards,
        PermissionsInvite.shared_apps,
        PermissionsInvite.permissions_uuid,
    ).where(
        PermissionsInvite.user_uuid == db_user.uuid,
        PermissionsInvite.permissions_uuid == user.permissions_uuid,
        PermissionsInvite.revoked.is_(False),
        PermissionsInvite.accepted.is_(False),
    )
    existing_invite = (await db.execute(existing_invite_query)).first()
    if existing_invite:
        shared_dashboards = get_final_shares(
            existing_invite.shared_dashboards,
            information.shared_dashboard,
            information.shared_permissions,
        )
        shared_apps = get_final_shares(
            existing_invite.shared_apps,
            information.shared_user_app,
            information.shared_permissions,
        )
        update_invite_query = (
            update(PermissionsInvite)
            .where(PermissionsInvite.uuid == existing_invite.uuid)
            .values(shared_dashboards=shared_dashboards, shared_apps=shared_apps)
        )
        await db.execute(update_invite_query)
        await db.commit()
        return True
    revoke_update = (
        update(PermissionsInvite)
        .where(PermissionsInvite.user_uuid == db_user.uuid)
        .values(revoked=True)
    )
    await db.execute(revoke_update)
    # Create the new invite for the user
    shared_dash = get_final_shares(
        {}, information.shared_dashboard, information.shared_permissions
    )
    shared_apps = get_final_shares(
        {}, information.shared_user_app, information.shared_permissions
    )
    create = insert(PermissionsInvite).values(
        expiration_date=base.get_now() + settings.INVITE_EXPIRATION,
        permissions_uuid=user.permissions_uuid,
        user_uuid=db_user.uuid,
        shared_dashboards=shared_dash,
        shared_apps=shared_apps,
    )
    result = await db.execute(create)
    await db.commit()
    EmailService.send_account_takeover(
        result.inserted_primary_key[0],
        user.email,
        information.inviting_email,
        user.message,
    )
    return True


async def update_user_name(
    db: AsyncSession,
    user: schemas.UserCreateAdmin | schemas.UserCreateProAdmin,
    db_user: UserToRegister,
):
    first_name = db_user.first_name or user.first_name
    last_name = db_user.last_name or user.last_name
    billing_active = await crud.total_user_count_full(db, user.permissions_uuid)
    if first_name != db_user.first_name or last_name != db_user.last_name:
        update_query = (
            update(User)
            .where(User.uuid == db_user.uuid)
            .values(
                first_name=first_name,
                last_name=last_name,
                billing_active=billing_active,
            )
        )
        await db.execute(update_query)


def brand_new_pro_newsletter(user: schemas.UserCreateProAdmin | schemas.AuthData):
    if not user.newsletter or settings.DISABLE_REGISTRATION:
        return

    try:
        from api.marketing import MarketingService  # noqa: PLC0415

        MarketingService.update_contact(
            user.email, schemas.UserMarketing(email_newsletter=True)
        )
    except Exception as e:
        logger.error(f"Error updating newsletter status:\n{e}")


async def brand_new_pro_account(
    db: AsyncSession,
    user: schemas.UserCreateAdmin | schemas.UserCreateProAdmin,
    information: schemas.RegisterProUser,
    from_oauth: bool = False,
) -> None | UUID:
    rand_pass = base.random_password()
    data = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "password": rand_pass,
        "hear_about_us": user.hear_about_us if hasattr(user, "hear_about_us") else None,
    }
    select_query = select(
        UserProInvite.uuid,
        UserProInvite.shared_dashboards,
        UserProInvite.shared_apps,
        UserProInvite.email,
    ).where(UserProInvite.email == user.email, UserProInvite.used.is_(False))
    invite_result = (await db.execute(select_query)).first()

    invite_uuid = invite_result.uuid if invite_result else None
    is_insert = invite_uuid is None

    if invite_result and not information.shared_dashboard and not from_oauth:
        # Being here means that the user has already been invited
        # So we need to send the email with the original inviter

        inviter_query = (
            select(User.email, UserProInvite.data)
            .join(UserProInvite, User.uuid == UserProInvite.inviting_user_uuid)
            .where(
                UserProInvite.email == invite_result.email,
                UserProInvite.used.is_(False),
            )
            .limit(1)
        )
        inviter_result = (await db.execute(inviter_query)).first()

        # In case the inviter is not found, we'll state inviter=invited
        # to prevent sending the wrong template
        inviter_email = inviter_result.email if inviter_result else invite_result.email

        # Need to get the existing temp password if it exists bc we're not creating
        # a new invite, only resending the email
        pw = (
            inviter_result.data.get("password") or rand_pass
            if inviter_result
            else rand_pass
        )

        EmailService.send_create_account(
            token=invite_result.uuid,
            to=invite_result.email,
            password=pw,
            inviter=inviter_email,
            message=user.message,
            is_free_tier=user.permissions_uuid == settings.PRO_DEVELOPER_MAPPING,
        )

        raise HTTPException(
            409,
            detail="An invitation has already been sent to this user. A new invitation will be sent to your email.",
        )

    if invite_result:
        shared_dashboards = get_final_shares(
            invite_result.shared_dashboards,
            information.shared_dashboard,
            information.shared_permissions,
        )
        shared_apps = get_final_shares(
            invite_result.shared_apps,
            information.shared_user_app,
            information.shared_permissions,
        )
        insert_query = (
            update(UserProInvite)
            .where(UserProInvite.uuid == invite_result.uuid)
            .values(shared_dashboards=shared_dashboards, shared_apps=shared_apps)
        )

    else:
        shared_dash = get_final_shares(
            {}, information.shared_dashboard, information.shared_permissions
        )
        shared_apps = get_final_shares(
            {}, information.shared_user_app, information.shared_permissions
        )
        insert_query = insert(UserProInvite).values(  # type: ignore
            inviting_user_uuid=information.inviting_uuid,
            data=data,
            email=user.email,
            permissions_uuid=user.permissions_uuid,
            shared_dashboards=shared_dash,
            shared_apps=shared_apps,
        )
        is_insert = True
    try:
        response = await db.execute(insert_query)
        if from_oauth:
            await db.commit()
            return invite_uuid or (
                response.inserted_primary_key[0] if is_insert else None
            )

    except IntegrityError as e:
        logger.error(f"Error inserting pro invite:\n{e}")
        await db.rollback()
        raise HTTPException(500, detail="Error inserting pro invite")
    try:
        if not invite_result:
            EmailService.send_create_account(
                token=response.inserted_primary_key[0],
                to=user.email,
                password=rand_pass,
                inviter=information.inviting_email,
                message=user.message,
                is_free_tier=user.permissions_uuid == settings.PRO_DEVELOPER_MAPPING,
            )

    except HTTPException as http_e:
        await db.rollback()
        raise http_e
    except Exception as e:
        logger.error(f"Error sending email:\n{e}")
        await db.rollback()
        raise HTTPException(500, detail="Error sending email")


async def register_pro_user(
    db: AsyncSession,
    user: schemas.UserCreateAdmin | schemas.UserCreateProAdmin,
    information: schemas.RegisterProUser,
    from_oauth: bool = False,
) -> bool | UUID | None:
    if settings.DISABLE_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is disabled")

    query = select(
        User.first_name,
        User.last_name,
        User.uuid,
        User.confirmed,
        User.permissions_uuid,
    ).where(User.email == user.email)
    result = (await db.execute(query)).first()
    if result:
        db_user = UserToRegister(
            first_name=result.first_name,
            last_name=result.last_name,
            uuid=result.uuid,
            confirmed=result.confirmed,
            permissions_uuid=result.permissions_uuid,
        )
        if db_user.confirmed and db_user.permissions_uuid:
            raise HTTPException(409, detail="User already registered")
        # First we need to update the name
        # This lets an admin update an existing user's name without their permission
        # But I think this is not an important issue for now
        await update_user_name(db, user, db_user)

        final_result = await initiate_account_takeover(db, user, db_user, information)
        return final_result

    # First check if an active invite exists
    new_invite_uuid = await brand_new_pro_account(db, user, information, from_oauth)
    await db.commit()

    return new_invite_uuid if from_oauth else True


async def update_all_redis(db: AsyncSession, query, entitlements: dict):
    responses = (await db.execute(query)).all()
    for response in responses:
        json_string = json.dumps(jsonable_encoder(entitlements))
        r = settings.get_redis_session("pro")
        r.set(str(response.uuid), json_string, xx=True)
