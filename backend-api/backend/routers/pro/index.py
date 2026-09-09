"""Terminal pro routes"""

import re
from datetime import (
    date as dateType,
    datetime,
    timedelta,
)
from typing import Annotated, Literal
from urllib.parse import quote, urlparse
from uuid import UUID

import httpx
import pyotp
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import (
    JSONResponse,
    RedirectResponse,
    Response,
    StreamingResponse,
)
from jwt import ExpiredSignatureError, PyJWTError
from loguru import logger
from pydantic import field_validator
from sqlalchemy import Select, delete, func, insert, or_, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.background import BackgroundTask

from api import auth_helpers, base, crud, helpers, models, schemas
from api.database import aget_read_db, aget_write_db
from api.email import EmailService
from api.models import (
    DashboardShare,
    DeveloperOnboarding,
    Entity,
    PermissionsEntityMap,
    User,
    UserProInvite,
    UserRole,
)
from api.rate_limit import LIMIT_DEFAULT, exempt_openbb_ai, exempt_user_agent, limiter
from api.schemas import SuccessReturn
from routers import pro_helpers
from routers.entity import takeover_user
from routers.routers_helpers import brand_new_pro_newsletter, register_pro_user
from utilities.config import BaseModel, settings

router = APIRouter(
    prefix="/pro", tags=["pro"], dependencies=[Depends(auth_helpers.check_openbb)]
)


EXCEPTION_401 = HTTPException(
    status.HTTP_401_UNAUTHORIZED,
    detail="Incorrect username or password",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.get("/extend-trial-email/{user_uuid}", response_class=RedirectResponse)
async def extend_trial_email(
    user_uuid: UUID, db: AsyncSession = Depends(aget_write_db)
):
    "Gives a user 2 more weeks of trial time. This will ONLY work if there is no previous trial."
    base_url = f"{settings.PROURL}/login?"
    message = quote("User not found, please confirm you have not already renewed.")

    def add_where(
        query: Select,
    ) -> Select[tuple[datetime | None, int | None, str, int | None]]:
        return query.where(
            User.uuid == user_uuid,
            User.permissions_uuid == settings.PRO_TRIAL_MAPPING,
            User.deleted.is_(False),
            or_(User.pro_trial_renewals == 0, User.pro_trial_renewals.is_(None)),
            User.pro_trial_end.isnot(None),
        )

    select_query = select(User.pro_trial_end, User.pro_trial_renewals, User.email)
    final_squery = add_where(select_query)
    result = await db.execute(final_squery)
    if (db_user := result.first()) is None:
        return RedirectResponse(f"{base_url}error={message}")
    update_query = update(User).values(
        pro_trial_end=max(db_user.pro_trial_end, base.get_now()) + timedelta(days=14),
        pro_trial_renewals=db_user.pro_trial_renewals or 0 + 1,
    )
    final_uquery = add_where(update_query)
    response = await db.execute(final_uquery)
    if response.rowcount == 0:
        return RedirectResponse(f"{base_url}error={message}")
    await db.commit()
    # hubspot trial_extended sync removed — not needed for marketing provider
    return RedirectResponse(f"{base_url}email={quote(db_user.email)}&extended=true")


@router.get("/confirm-account", response_class=RedirectResponse)
@limiter.limit("5/minute")
async def confirm_account(
    request: Request,
    token: str,
    email: str = "",
    pro: str = "false",
    db: AsyncSession = Depends(aget_write_db),
):
    """Confirms a user account via email token and redirects to appropriate login page"""
    failure_url = (
        f"{settings.PROURL}/login" if pro == "true" else f"{settings.FRONTENDURL}/login"
    )

    try:
        data_dict = auth_helpers.decode_jwt(token)
        user_email = data_dict["user"]
    except ExpiredSignatureError:
        return RedirectResponse(failure_url)
    except PyJWTError:
        return RedirectResponse(failure_url)

    # hubspot is_verified sync removed — not needed for marketing provider

    query = update(User).where(User.email == user_email).values(confirmed=True)
    response = await db.execute(query)
    await db.commit()

    if response.rowcount == 0:
        return RedirectResponse(failure_url)

    EmailService.send_welcome_email(user_email)
    encoded_email = quote(email or user_email)

    if pro == "true":
        return RedirectResponse(f"{settings.PROURL}/login?email={encoded_email}")

    return RedirectResponse(
        f"{settings.FRONTENDURL}/login?email={encoded_email}&email-confirmed=true"
    )


@router.get("/transfer-user/{token}", response_class=RedirectResponse)
@limiter.limit("5/minute")
async def transfer_user(
    request: Request,
    token: str,
    email: str = "",
    db: AsyncSession = Depends(aget_write_db),
):
    "Transfers a user to a new account"
    try:
        result = await takeover_user(token, db)
        if result.success and result.message == email:
            return RedirectResponse(f"{settings.PROURL}/login?email={quote(email)}")
    except Exception as e:
        logger.error(f"Error transferring user: {e}")

    error = "unknown error occurred"
    return RedirectResponse(f"{settings.PROURL}/login?error={quote(error)}")


@router.post("/invites/create", response_model=SuccessReturn)
async def invite_user(
    user: schemas.UserCreateAdmin,
    db: AsyncSession = Depends(aget_write_db),
    creator: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "email", "permissions_uuid"], pro=True)
    ),
):
    "Allows someone to invite a user"

    data = await get_invites_remaining(db, user=creator)

    if data.get("remaining", 0) <= 0:
        raise HTTPException(status_code=403, detail="No invites remaining")

    await crud.check_clean_email(db, user.email)

    # Check if the user is already a pro user
    query2 = select(User.uuid).where(
        User.email == user.email, User.permissions_uuid.is_not(None)
    )
    result2 = (await db.execute(query2)).first()
    if result2 is not None:
        raise HTTPException(status_code=409, detail="User is already a pro user")
    try:
        extra_info = schemas.RegisterProUser(
            inviting_uuid=creator.uuid, inviting_email=creator.email
        )
        if creator.permissions_uuid == settings.PRO_DEVELOPER_MAPPING:
            user.permissions_uuid = settings.PRO_DEVELOPER_MAPPING

        response = await register_pro_user(db, user, extra_info)
        return SuccessReturn.from_bool(response)
    except IntegrityError as exc:
        return helpers.handle_user_conflict(exc)


async def process_create_user(
    the_uuid: UUID,
    email: str,
    db: AsyncSession = Depends(aget_write_db),
    from_oauth: bool = False,
    microsoft_id: str | None = None,
) -> Response | UUID | bool:
    "Allows an admin to register a new user"
    if settings.DISABLE_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is disabled")

    query = select(
        UserProInvite.data,
        UserProInvite.email,
        UserProInvite.permissions_uuid,
        UserProInvite.shared_dashboards,
    ).where(
        UserProInvite.uuid == the_uuid,
        UserProInvite.used.is_(False),
        UserProInvite.email == email,
    )
    result = (await db.execute(query)).first()
    if result is None:
        error = "Unknown or used invite code"
        if from_oauth:
            return False
        return RedirectResponse(f"{settings.PROURL}/login?error={quote(error)}")

    if result.permissions_uuid is None:
        result.permissions_uuid = settings.PRO_DEVELOPER_MAPPING

    pro_trial_granted = result.permissions_uuid != settings.PRO_DEVELOPER_MAPPING
    nowish = base.get_now()
    billing_active = await crud.total_user_count_full(db, result.permissions_uuid)
    # hubspot contact creation removed — not needed for marketing provider
    if await crud.check_new_user(db, result.email):
        error = "A user with this email already exists"
        if from_oauth:
            return False
        return RedirectResponse(f"{settings.PROURL}/login?error={quote(error)}")
    insert_query = insert(User).values(
        email=result.email,
        clean_email=base.clean_email(result.email),
        permissions_uuid=result.permissions_uuid,
        password=result.data["password"],
        first_name=result.data["first_name"],
        last_name=result.data["last_name"],
        billing_active=billing_active,
        pro_start=base.get_now(),
        confirmed=1,
        temporary_password=True,
        pro_trial_granted=pro_trial_granted,
        pro_trial_granted_date=nowish if pro_trial_granted else None,
        hear_about_us=result.data.get("hear_about_us", None),
        microsoft_id=microsoft_id,
    )
    response = await db.execute(insert_query)
    user_uuid = response.inserted_primary_key[0]
    # Add shares
    for key, value in (result.shared_dashboards or {}).items():
        share_insert = insert(DashboardShare).values(
            dashboard_item_uuid=key,
            shared_user_uuid=user_uuid,
            permissions=value,
        )
        await db.execute(share_insert)
    update_query = (
        update(UserProInvite).where(UserProInvite.uuid == the_uuid).values(used=True)
    )
    await db.execute(update_query)
    # Add role if provided
    if (role := result.data.get("role", None)) and role != "None" and role.strip():
        role_insert = insert(UserRole).values(
            user_uuid=user_uuid,
            role_uuid=role,
        )
        await db.execute(role_insert)
    await db.commit()

    EmailService.send_welcome_email(result.email)

    encoded_email = quote(result.email)

    return (
        RedirectResponse(f"{settings.PROURL}/login?email={encoded_email}")
        if not from_oauth
        else user_uuid
    )


@router.get("/create-account/{the_uuid}", response_class=RedirectResponse)
@router.post("/create-user/{the_uuid}", response_class=RedirectResponse)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def create_user(
    request: Request,
    the_uuid: UUID,
    email: str = "",
    db: AsyncSession = Depends(aget_write_db),
):
    if settings.DISABLE_REGISTRATION:
        error = "registration is disabled"
        return RedirectResponse(f"{settings.PROURL}/login?error={quote(error)}")
    try:
        return await process_create_user(the_uuid, email, db)
    except Exception as e:
        logger.error(f"Error creating user: {e}")

    error = "unknown error occurred"
    return RedirectResponse(f"{settings.PROURL}/login?error={quote(error)}")


@router.post("/register", response_model=SuccessReturn)
@limiter.limit("5/hour", exempt_when=exempt_user_agent)
async def register_user(
    request: Request,
    user: schemas.UserCreateProAdmin,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
):
    await crud.check_clean_email(db, user.email)
    brand_new_pro_newsletter(user)

    user.permissions_uuid = settings.PRO_DEVELOPER_MAPPING
    extra_info = schemas.RegisterProUser(
        inviting_uuid=settings.PRO_TRIAL_USER, inviting_email=settings.PRO_TRIAL_EMAIL
    )
    response = await register_pro_user(db, user, extra_info)

    return SuccessReturn.from_bool(response)


def bearer_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@router.get("/invites/remaining", response_model=schemas.RemainingCodes)
async def get_invites_remaining(
    db: AsyncSession = Depends(aget_read_db),
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid", "email"], pro=True)),
):
    # no longer being used
    # if not helpers.email_is_public(user.email):
    #     return {"remaining": None}
    query = select(func.count(UserProInvite.uuid).label("invites")).where(
        UserProInvite.inviting_user_uuid == user.uuid
    )
    result = (await db.execute(query)).first()
    invites = result.invites if result else 0
    return {"remaining": max(0, 15 - invites)}


@router.post("/logout", response_model=SuccessReturn)
@limiter.limit("10/minute", exempt_when=exempt_user_agent)
async def logout(
    request: Request,
    db: AsyncSession = Depends(aget_write_db),
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True, from_logout=True)),
):
    if getattr(user, "uuid", None) is None:
        return SuccessReturn(success=True)
    await auth_helpers.delete_user_pro_sessions(db, user.uuid, ["pro", "oauth-pro"])
    response = JSONResponse(content={"success": True}, status_code=200)
    response.delete_cookie(key="access_token")
    return response


@router.post("/login", response_model=schemas.ProTokenWithContext)
@limiter.limit("5/minute", exempt_when=exempt_openbb_ai)
async def login(  # noqa: PLR0914, PLR0915
    request: Request,
    user: schemas.ProUserLogin,
    db: AsyncSession = Depends(aget_write_db),
):
    if not (
        result := (await db.execute(helpers.get_user_pro_query(user.email))).first()
    ):
        raise EXCEPTION_401

    # If the user is not associated with an entity, means they registered on other OpenBB platforms (eg Hub)
    # and we need to associate them with the developer entity.
    if not result._asdict().get("permissions_uuid", None):
        await pro_helpers.handle_tier_change(
            db=db, user_uuid=result.uuid, tier="terminal"
        )
        # Re-fetch the user from the database
        result = (await db.execute(helpers.get_user_pro_query(user.email))).first()

    db_user = schemas.UserProSchema.model_validate(result)
    await pro_helpers.check_login(
        db, user, db_user
    )  # Will raise if a problem is encountered

    # If the user does not have an entitlement, we assume it's an already existing pro user
    # that doesn't went through the developer onboarding process.
    has_entitlement = await pro_helpers.has_entitlement(db, db_user.uuid)
    if not has_entitlement:
        await pro_helpers.update_user_entitlement_with_entity_entitlement(
            db=db, user_uuid=db_user.uuid
        )

    if not db_user.confirmed:
        return JSONResponse(
            content={"message": "User is not confirmed"}, status_code=403
        )

    try:
        moved_to_developer = False
        pro_trial_end = await helpers.check_pro_trial(db, db_user)
    except HTTPException:
        # If the trial ended, move the user to the OpenBB Developer Entity
        await pro_helpers.handle_tier_change(
            db=db, user_uuid=db_user.uuid, tier="terminal"
        )
        db_user = schemas.UserProSchema.model_validate(
            (await db.execute(helpers.get_user_pro_query(user.email))).first()
        )
        # Assign the pro trial end date to None so the expiration date is calculated based on the current date
        pro_trial_end = None
        # Inform the user that the trial ended
        moved_to_developer = True

    if (
        db_user.totp_secret
        and db_user.totp_active
        and int(pyotp.TOTP(db_user.totp_secret).now()) != user.totp_token
    ):
        return JSONResponse(content={"message": "Invalid TOTP token"}, status_code=202)

    if db_user.require_authenticator and not db_user.totp_active:
        # If the user's entity requires 2FA but not active,
        # we need to send them a new token and ask them to activate it
        access_token = await auth_helpers.create_login_token(
            db=db,
            user_uuid=db_user.uuid,
            expires_delta=timedelta(minutes=5),
            pro=True,
            source=user.source or "",
        )
        return JSONResponse(
            content={
                "message": "Two-factor authentication is required",
                "access_token": access_token,
            },
            status_code=202,
        )

    show_changelog = (
        db_user.latest_version is not None and db_user.latest_version != user.version
    )
    if user.version and db_user.latest_version != user.version:
        update_query = (
            update(User)
            .where(User.uuid == db_user.uuid)
            .values(latest_version=user.version)
        )
        await db.execute(update_query)

    time_d = helpers.get_pro_session_expiration(pro_trial_end, db_user, user.remember)

    sources = ["pro", "oauth-pro"] if user.source != "excel" else ["excel"]

    # Delete all other pro sessions, except for excel
    await auth_helpers.delete_user_pro_sessions(db, db_user.uuid, sources)

    access_token = await auth_helpers.create_login_token(
        db=db,
        user_uuid=db_user.uuid,
        expires_delta=time_d,
        pro=True,
        source=user.source or "",
    )

    # Check if the user is logging in for the first time
    is_first_login = await helpers.check_first_login(
        db, db_user.uuid, ["oauth-pro", "pro"]
    )

    # Enter the login into our database
    helpers.handle_add_login(db_user.uuid, user.ip_address, user.source)
    base.set_tpro_redis(db_user.uuid, db_user.pro_entitlements)
    base_entity_uuid = await crud.get_trial_entity_uuid(db)

    # Check if the user is on a trial
    is_trial = base_entity_uuid == db_user.entity_uuid and not settings.is_onprem()

    # Get Copilot Chats
    chats = await pro_helpers.get_copilot_chats(db, db_user.uuid)
    questions_history = await pro_helpers.get_user_questions_history(db, db_user.uuid)

    # Get MCP servers
    mcp_servers = await pro_helpers.get_mcp_servers(db, db_user)

    # Get TV State
    tv_state = await pro_helpers.get_trading_view_state(db, db_user)

    # Get Theme Settings
    entity_theme_settings = await pro_helpers.get_entity_theme_settings(
        db, db_user.entity_uuid
    )

    # Get Dashboards
    dashboards_complete = await pro_helpers.get_dashboards_complete(db_user)

    # Get User Apps
    user_apps_complete = await pro_helpers.get_user_apps_complete(db_user)

    # Get User Data
    curr_user = await auth_helpers.GetCurrentUser.call_logic(
        token=access_token, **auth_helpers.CURRENT_PRO_USER
    )

    if settings.is_onprem():
        entity_query = select(models.ApiSource).where(
            models.ApiSource.entity_uuid == db_user.entity_uuid
        )
        entity_backends = (await db.execute(entity_query)).scalars().all()
        if entity_backends and isinstance(curr_user.ApiSource, list):
            curr_user.ApiSource.extend(entity_backends)

    # Get Widget Metadata
    widget_metadata = await pro_helpers.get_widget_metadata(db=db, user=db_user)
    user_data = await pro_helpers.set_pro_user_data(curr_user, db)
    user_data.widget_metadata = widget_metadata

    # Get Entitlements
    entitlements = await pro_helpers.get_entitlement(db, db_user.uuid)

    # Get Enabled Widget Bundles
    enabled_widget_bundles = await pro_helpers.get_enabled_widget_bundles(db, db_user)

    # Get Developer Onboarding Info
    developer_onboarding_info = await pro_helpers.get_developer_onboarding_info(
        db, db_user
    )
    if developer_onboarding_info and (
        db_user.permissions_uuid == settings.PRO_DEVELOPER_MAPPING
        and not settings.is_onprem()
    ):
        # If the user is on the developer tier, we don't want to skip the onboarding
        developer_onboarding_info.skipOnboarding = False

    # Get usage
    usage = await helpers.get_user_usage(db_user)

    # Get custom copilots
    custom_copilots = await pro_helpers.get_custom_copilots(db, db_user.uuid)

    # Get user skills
    user_skills = await pro_helpers.get_user_skill_state(db, db_user.uuid)

    # Show welcome screen if the user has not seen it yet and then toggle it to not show again
    welcome_screen = db_user.welcome_screen
    if welcome_screen:
        await pro_helpers.toggle_welcome_screen(db, db_user.uuid, False)

    content = {
        "uuid": db_user.uuid,
        "email": db_user.email,
        "access_token": access_token,
        "username": db_user.username,
        "entitlements": db_user.pro_entitlements,
        "expiration_date": base.get_now() + time_d,
        "temporary_password": bool(db_user.temporary_password)
        and user.source != "oauth-pro",
        "force_2fa": (db_user.require_authenticator or db_user.two_factor_auth)
        and not (db_user.totp_secret and db_user.totp_active),
        "entity_name": db_user.name,
        "role": db_user.role,
        "is_trial_entity": is_trial,
        "entity_theme_settings": entity_theme_settings,
        "pro_trial_end": pro_trial_end if is_trial else None,
        "show_changelog": show_changelog,
        "copilot_chats": chats,
        "questions_history": questions_history,
        "trading_view": tv_state,
        "dash_sync": dashboards_complete,
        "user_apps": user_apps_complete,
        "user_skills": user_skills,
        "user": user_data,
        "feature_entitlements": entitlements,
        "can_submit_marketplace": bool(
            db_user.is_superuser or db_user.can_submit_marketplace
        ),
        "moved_to_developer": moved_to_developer,
        "enabled_widget_bundles": enabled_widget_bundles,
        "developer_onboarding_info": developer_onboarding_info,
        "usage": usage,
        "custom_copilots": custom_copilots,
        "mcp_servers": mcp_servers.servers if mcp_servers else None,
        "show_welcome_screen": welcome_screen,
        "is_first_login": is_first_login,
    }

    context = schemas.ProTokenWithContext.model_validate(content)
    response = JSONResponse(content=jsonable_encoder(context))
    response.set_cookie(key="access_token", value=access_token, httponly=True)

    return response


async def process_auth(token: str, provider: auth_helpers.ProviderT, request: Request):
    """Processes OAuth authentication for a given provider."""
    if provider == "snowflake":
        return await auth_helpers.process_snowflake_oauth(request)

    url = auth_helpers.OAUTH_PROVIDERS.get(provider)
    if not url or not token:
        raise ValueError("Invalid provider or token")

    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=bearer_header(token))
        if res.is_error:
            raise HTTPException(
                status_code=400, detail=f"Invalid {provider.title()} token"
            )
        user_data: dict = res.json()
        return user_data


async def handle_oauth_user(
    request: Request, db: AsyncSession, user_data: dict, auth_data: schemas.AuthData
):
    """Handles OAuth user sign-in and sign-up process."""
    user_email = user_data.get("email")
    is_admin = user_data.get("is_admin")
    host_domain = user_data.get("host_domain")

    filters = [User.email == user_email]
    if microsoft_id := user_data.get("microsoft_id"):
        # Attempt to get id from OAuth data if available
        filters.append(User.microsoft_id == microsoft_id)

    user_exists = (
        (
            await db.execute(
                select(
                    User.uuid,
                    User.email,
                    User.microsoft_id,
                    User.permissions_uuid,
                )
                .where(or_(*filters))
                .limit(1)
            )
        )
        .mappings()
        .first()
    )

    user_uuid: UUID | None = None
    if not user_exists:
        # User does not exist, proceed with sign-up
        user_create = schemas.UserCreateProAdmin(
            first_name=user_data.get("given_name"),
            last_name=user_data.get("family_name"),
            email=user_email,
            permissions_uuid=settings.PRO_DEVELOPER_MAPPING,
            newsletter=auth_data.newsletter,
        )
        extra_info = schemas.RegisterProUser(
            inviting_uuid=settings.PRO_TRIAL_USER,
            inviting_email=settings.PRO_TRIAL_EMAIL,
        )
        invite_uuid = await register_pro_user(
            db, user_create, extra_info, from_oauth=True
        )
        if not invite_uuid or not (
            user_uuid := await process_create_user(
                invite_uuid, user_email, db, from_oauth=True, microsoft_id=microsoft_id
            )
        ):
            raise HTTPException(status_code=400, detail="Failed to create user")

        # For Snowflake, create the Native Backend API source
        if host_domain is not None:
            await auth_helpers.update_admin_user_permissions(db, user_email, is_admin)

    if host_domain is not None and not settings.redis_cache("snowflake_created_v2"):
        entity_uuid = await pro_helpers.get_entity_uuid(
            db, user_uuid or user_exists["uuid"]
        )
        try:
            await db.execute(
                insert(models.ApiSource).values(
                    entity_uuid=entity_uuid,
                    name="Snowflake",
                    url=f"https://{host_domain}/native-backend",
                    endpointHeaders=[],
                )
            )
            await db.commit()
            logger.info(
                f"Created Native Backend API source for Snowflake Entity {entity_uuid}",
                exclude=True,
            )
            settings.redis_cache("snowflake_created_v2", "true")
        except SQLAlchemyError as e:
            logger.error(
                f"Failed to create API source for Snowflake Entity {entity_uuid}: {e}"
            )
            await db.rollback()

    if (
        user_exists
        and is_admin
        and user_exists["permissions_uuid"] != settings.ON_PREM_ADMIN_MAPPING
    ):
        await auth_helpers.update_admin_user_permissions(db, user_email, is_admin)

    # User exists, proceed with sign-in
    user_login = schemas.OAuthLogin(
        email=user_exists["email"] if user_exists else user_email,
        remember=False,
        ip_address="",
        source="oauth-pro",
        password="",
        version=auth_data.version,
    ).bypass_password_check()

    if (user_exists and user_exists["microsoft_id"] is None) and microsoft_id:
        # Update the user's Microsoft ID if it was not previously set
        await db.execute(
            update(User)
            .where(User.uuid == user_exists["uuid"])
            .values(microsoft_id=microsoft_id)
        )
        await db.commit()

    return await login(request, user_login, db)


@router.post("/{provider}-auth", response_model=schemas.ProTokenWithContext)
@limiter.limit("5/minute")
async def oauth_auth(
    request: Request,
    provider: auth_helpers.ProviderT,
    data: schemas.AuthData,
    db: AsyncSession = Depends(aget_write_db),
):
    """Endpoint for OAuth Authentication, both for sign-in and sign-up."""
    user_data = await process_auth(data.token, provider, request)
    user_email = user_data.get("email")

    if provider == "microsoft":
        user_email = user_data.get("mail") or user_data.get("userPrincipalName")
        user_data["email"] = user_email
        user_data["microsoft_id"] = user_data.get("id")
        user_data["given_name"] = user_data.get("givenName")
        user_data["family_name"] = user_data.get("surname")

    is_google = provider == "google"
    if not user_email or (is_google and not user_data.get("email_verified", False)):
        error_message = "found in token" if not is_google else "verified by Google"
        raise HTTPException(status_code=400, detail=f"Email not {error_message}")

    return await handle_oauth_user(request, db, user_data, data)


@router.get("/2fa", response_model=schemas.TwoFactorAuthGet)
async def get_2fa(
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(
        auth_helpers.GetCurrentUser(
            ["uuid", "two_factor_auth", "totp_active"], pro=True
        )
    ),
):
    """Endpoint to get the 2FA status for a user."""

    entity_uuid = await pro_helpers.get_entity_uuid(db, user.uuid)
    entity_require_authenticator = await pro_helpers.entity_require_authenticator(
        db, entity_uuid
    )

    two_factor_auth = user.two_factor_auth or entity_require_authenticator

    return schemas.TwoFactorAuthGet(
        two_factor_auth=two_factor_auth and user.totp_active,
        entity_require_authenticator=entity_require_authenticator,
    )


@router.put("/2fa", response_model=SuccessReturn)
async def put_2fa(
    data: schemas.TwoFactorAuth,
    db: AsyncSession = Depends(aget_write_db),
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    query = (
        update(User)
        .where(User.uuid == user.uuid)
        .values(
            two_factor_auth=data.two_factor_auth,
            totp_active=False,
            totp_secret=None,
        )
    )
    await db.execute(query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.get("/user", response_model=schemas.ProUserReturn)
async def get_user(
    db: AsyncSession = Depends(aget_read_db),
    user=Depends(auth_helpers.GetCurrentUser(**auth_helpers.CURRENT_PRO_USER)),
):
    user_data = await pro_helpers.set_pro_user_data(user, db)
    user_data.widget_metadata = await pro_helpers.get_widget_metadata(db=db, user=user)
    return user_data


@router.get("/user/{token}", response_model=schemas.ProBackendReturn)
async def get_user_backend(
    token: UUID,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.check_bot),
):
    session_query = (
        select(
            models.Session.expiration_date,
            User.pro_entitlements,
            User.uuid,
            User.primary_usage,
            User.username,
            User.email,
            Entity.api_keys,
        )
        .select_from(models.Session)
        .join(User, User.uuid == models.Session.user_uuid)
        .join(PermissionsEntityMap, User.permissions_uuid == PermissionsEntityMap.uuid)
        .join(Entity, Entity.uuid == PermissionsEntityMap.entity_uuid)
        .where(
            models.Session.pro.is_(True),
            User.deleted.is_(False),
            models.Session.uuid == token,
        )
    )
    session = (await db.execute(session_query)).first()
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")

    try:
        await auth_helpers.check_session_expiration(session, token, db)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Session expired")

    clean_data = {}
    for key, value in session.pro_entitlements:
        if value != "None":
            clean_data[key] = getattr(session.api_keys, key)

    clean_schema = schemas.ProKeys(**clean_data)

    return schemas.ProBackendReturn(
        expiration_date=session.expiration_date,
        api_keys=clean_schema,
        username=session.username,
        email=session.email,
        uuid=session.uuid,
        primary_usage=session.primary_usage,
    )


@router.get("/validate", response_model=SuccessReturn)
async def validate_user(
    db: AsyncSession = Depends(aget_write_db),
    token=Depends(auth_helpers.get_current_token),
):
    query = (
        select(models.Session.expiration_date)
        .where(models.Session.uuid == token, models.Session.pro.is_(True))
        .limit(1)
    )
    expiration_date = (await db.execute(query)).scalar_one_or_none()
    if expiration_date is None:
        return SuccessReturn.failure_instance()

    session = auth_helpers.CustomRow(expiration_date=expiration_date)
    try:
        await auth_helpers.check_session_expiration(session, token, db)
    except HTTPException:
        return SuccessReturn.failure_instance()

    return SuccessReturn.success_instance()


@router.get("/validate-and-sync", response_model=schemas.ValidateAndSync)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def validate_and_get_items(
    request: Request,
    db: AsyncSession = Depends(aget_write_db),
    user=Depends(auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)),
):
    """
    Validate the user token and retrieve the other relevant data.

    Args:
        db (AsyncSession): Database session dependency.
        user (User): Current user dependency.

    Returns:
        schemas.ValidateAndSync: ValidateAndSync object with the feature entitlements.


    Raises:
        HTTPException: If the token is invalid.
    """
    res = await validate_user(db=db, token=user.token)
    if not res.success:
        raise HTTPException(status_code=401, detail="invalid token")
    entitlements = await pro_helpers.get_entitlement(db=db, user_uuid=user.uuid)
    return schemas.ValidateAndSync(
        feature_entitlements=entitlements,
    )


@router.post("/pro-developer-onboarding-info", response_model=SuccessReturn)
async def post_pro_developer_info(
    pro_info: schemas.ProInfoDeveloper,
    user=Depends(
        auth_helpers.GetCurrentUser(
            ["uuid", "email", "first_name", "last_name"], pro=True
        )
    ),
    db: AsyncSession = Depends(aget_write_db),
):
    # Sync onboarding info to Mailchimp only if the contact already exists
    try:
        from api.marketing import MarketingService  # noqa: PLC0415

        if MarketingService.find_contact(user.email):
            marketing = pro_info.to_marketing()
            marketing.first_name = marketing.first_name or user.first_name
            marketing.last_name = marketing.last_name or user.last_name
            MarketingService.update_contact(user.email, marketing)
    except Exception as e:
        logger.error(f"Error syncing onboarding to marketing: {e}")

    # Check if the user already exists in the DeveloperOnboarding table
    existing_entry = await db.execute(
        select(DeveloperOnboarding).where(DeveloperOnboarding.user_uuid == user.uuid)
    )
    existing_entry = existing_entry.scalar_one_or_none()

    if existing_entry:
        # If the user exists, perform an update
        query = (
            update(DeveloperOnboarding)
            .where(DeveloperOnboarding.user_uuid == user.uuid)
            .values(
                primary_usage=pro_info.primaryUsage,
                organization=pro_info.organization,
                role=pro_info.role,
                programming_experience=pro_info.programmingExperience,
                data_types=pro_info.dataTypes,
                other_data_types=pro_info.otherDataType,
                organization_name=pro_info.organizationName,
                skip_onboarding=pro_info.skipOnboarding,
            )
        )
    else:
        # If the user doesn't exist, perform an insert
        query = insert(DeveloperOnboarding).values(
            user_uuid=user.uuid,
            primary_usage=pro_info.primaryUsage,
            organization=pro_info.organization,
            role=pro_info.role,
            programming_experience=pro_info.programmingExperience,
            data_types=pro_info.dataTypes,
            other_data_types=pro_info.otherDataType,
            organization_name=pro_info.organizationName,
            skip_onboarding=pro_info.skipOnboarding,
        )
    await db.execute(query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.get(
    "/pro-developer-onboarding-info",
    response_model=schemas.ProInfoDeveloper,
)
async def get_pro_developer_info(
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_read_db),
):
    developer_onboarding_info = await pro_helpers.get_developer_onboarding_info(
        db, user
    )
    if not developer_onboarding_info:
        return JSONResponse(
            status_code=404,
            content={
                "detail": "Developer onboarding information not found for the given user UUID"
            },
        )
    return developer_onboarding_info


@router.post("/accepted-pro-tos", response_model=SuccessReturn)
async def post_accepted_pro_tos(
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    query = update(User).where(User.uuid == user.uuid).values(accepted_pro_tos=True)
    await db.execute(query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.post("/display-settings", response_model=SuccessReturn)
async def post_pro_settings(
    pro_info: schemas.ProDisplaySettings,
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    query = (
        update(User).where(User.uuid == user.uuid).values(pro_display_settings=pro_info)
    )
    await db.execute(query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.post("/zero-to-hero", response_model=SuccessReturn)
async def post_zero_to_hero(
    pro_info: schemas.ProZeroToHero,
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    # Get current values
    result = await db.execute(
        select(User.pro_zero_to_hero).where(User.uuid == user.uuid)
    )
    current_values = result.scalar_one_or_none()

    # If there are current values, only update the non-None values from pro_info
    if current_values:
        update_values = current_values.model_dump()
        for field, value in pro_info.model_dump().items():
            if value is not None:
                update_values[field] = value
        pro_info = schemas.ProZeroToHero(**update_values)

    query = update(User).where(User.uuid == user.uuid).values(pro_zero_to_hero=pro_info)
    await db.execute(query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.get("/zero-to-hero", response_model=schemas.ProZeroToHero)
async def get_zero_to_hero(
    db: AsyncSession = Depends(aget_read_db),
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Get zero to hero data for a user. Optionally filter by a specific property.

    Args:
        db (AsyncSession): Database session
        user (User): Current authenticated user

    Returns:
        schemas.ProZeroToHero: Zero to hero data

    Raises:
        HTTPException: If no data is found or if property_name is invalid
    """
    result = await db.execute(
        select(User.pro_zero_to_hero).where(User.uuid == user.uuid)
    )
    zero_to_hero_data = result.scalar_one_or_none()

    if not zero_to_hero_data:
        raise HTTPException(
            status_code=404, detail="Zero to hero data not found for user"
        )

    return zero_to_hero_data


@router.post("/copilot-chats", response_model=schemas.EntitlementUsageGet)
async def post_copilot_chats(
    chats: schemas.CopilotChatsCreate,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to create or update copilot chats for a user.

    If the user does not have any existing chats, a new entry is created.
    If the user already has chats, the existing entry is updated with the new chats.
    The idea of this endpoint is to allow the client to manage the chats for the user and simply
    keep the server in sync with the client's state.

    Args:
        chats (schemas.CopilotChatsCreate): The chats to be created or updated.
        db (AsyncSession): The database session.
        user: The current authenticated user.

    Returns:
        SuccessReturn: An instance indicating the operation was successful.
    """

    try:
        await crud.bulk_copilot_chats_insert_update(db, user.uuid, chats)
    except SQLAlchemyError as e:
        logger.error(e)
        await db.rollback()
        raise HTTPException(
            status_code=400, detail="Could not successfully update the items"
        ) from e

    return await schemas.EntitlementUsageGet.check_cache(db, user)


@router.get("/copilot-chats", response_model=list[schemas.Chat | schemas.ChatInfo])
async def get_copilot_chats(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to retrieve copilot chats for a user.

    This endpoint fetches the copilot chats associated with the current authenticated user.

    Args:
        db (AsyncSession): The database session.
        user: The current authenticated user.

    Returns:
        list[schemas.Chat | schemas.ChatInfo]: A list of copilot chats for the user.
    """
    result = await pro_helpers.get_copilot_chats(db, user.uuid)
    if not result:
        raise HTTPException(
            status_code=404, detail="Copilot chats not found for the user"
        )
    return result


@router.delete("/copilot-chats", response_model=SuccessReturn)
async def delete_copilot_chats(
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to delete copilot chats for a user.

    This endpoint deletes the copilot chats associated with the current authenticated user.

    Args:
        db (AsyncSession): The database session.
        user: The current authenticated user.

    Returns:
        SuccessReturn: An instance indicating the operation was successful.
    """
    query = delete(models.CopilotChat).where(
        models.CopilotChat.user_uuid == user.uuid,
    )
    await db.execute(query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.get(
    "/copilot-chats/search", response_model=list[schemas.Chat | schemas.ChatInfo]
)
async def search_copilot_chats(
    query: Annotated[str, Query(..., min_length=2)],
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    start_date: dateType | datetime | None = None,
    end_date: dateType | datetime | None = None,
):
    """
    Endpoint to search copilot chats for a user.

    This endpoint searches the copilot chats associated with the current authenticated user
    based on the provided query string.

    Args:
        query (str): The search query string.
        db (AsyncSession): The database session.
        user: The current authenticated user.
        start_date (dateType | datetime | None, optional): The start date for filtering messages (inclusive).
        end_date (dateType | datetime | None, optional): The end date for filtering messages (inclusive).

    Returns:
        list[schemas.Chat | schemas.ChatInfo]: A list of copilot chats matching the search query.
    """

    return await crud.search_copilot_chats(db, user.uuid, query, start_date, end_date)


@router.get("/copilot-chats/{chat_uuid}", response_model=schemas.Chat)
async def get_copilot_chat(
    chat_uuid: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to retrieve a specific copilot chat for a user.

    This endpoint fetches the copilot chat associated with the specified chat UUID
    for the current authenticated user.

    Args:
        chat_uuid (UUID): The UUID of the copilot chat to retrieve.
        db (AsyncSession): The database session.
        user: The current authenticated user.

    Returns:
        schemas.Chat: The copilot chat corresponding to the provided UUID.
    """
    where_clause = (
        models.CopilotChat.uuid == chat_uuid,
        models.CopilotChat.user_uuid == user.uuid,
    )

    query = (
        select(models.CopilotChat)
        .options(selectinload(models.CopilotChat.messages))
        .where(*where_clause)
    )
    result = (await db.execute(query)).scalar_one_or_none()
    if not result:
        raise HTTPException(
            status_code=404, detail="Copilot chat not found for the user"
        )

    chat = schemas.Chat.from_row(result)
    try:
        last_opened = base.get_now()
        chat.lastOpened = last_opened.timestamp() * 1000
        query = (
            update(models.CopilotChat)
            .where(*where_clause)
            .values(last_opened=last_opened, content=chat.to_content())
        )
        await db.execute(query)
        await db.commit()
    except SQLAlchemyError as e:
        logger.error(e)
        await db.rollback()

    return chat


@router.post("/tv-state", response_model=SuccessReturn)
async def post_tv_state(
    tv_state: schemas.TVStateCreate,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to create or update trading view state for a user.

    If the user does not have any existing trading view state, a new entry is created.
    If the user already has trading view state, the existing entry is updated with the new state.
    The idea of this endpoint is to allow the client to manage the trading view state for the user and simply
    keep the server in sync with the client's state.

    Args:
        tv_state (schemas.TVStateCreate): The trading view state to be created or updated.
        db (AsyncSession): The database session.
        user
    Returns:
        SuccessReturn: An instance indicating the operation was successful.
    """
    query = (
        select(models.TradingView)
        .where(models.TradingView.user_uuid == user.uuid)
        .limit(1)
    )

    result = (await db.execute(query)).scalar_one_or_none()
    if result is None:
        insert_query = insert(models.TradingView).values(
            user_uuid=user.uuid,
            charts_state=tv_state.charts_state.model_dump(),
            settings=tv_state.settings,
        )
        await db.execute(insert_query)
    else:
        result.charts_state = tv_state.charts_state.model_dump()
        result.settings = tv_state.settings

    await db.commit()

    return SuccessReturn.success_instance()


@router.get("/tv-state", response_model=schemas.TVStateResponse)
async def get_tv_state(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to retrieve trading view state for a user.

    This endpoint fetches the trading view state associated with the current authenticated user.

    Args:
        db (AsyncSession): The database session.
        user: The current authenticated user.

    Returns:
        schemas.TVStateResponse: The trading view state for the user.
    """
    result = await pro_helpers.get_trading_view_state(db, user)
    if not result.charts_state:
        raise HTTPException(
            status_code=404, detail="Trading view state not found for the user"
        )
    return result


@router.put("/tier", response_model=schemas.TierPutResponse)
async def put_tier(
    tier: schemas.TierPut,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to change the tier for a user.

    Change the user entitlements and move the user to the corresponding entity.
    Exclusively from/to Developer and Trial entities.

    Args:
        tier (schemas.TierPut): The tier to be changed to.

    Returns:
        schemas.TierPutResponse: info about the entitlement and usage.
    """
    await pro_helpers.handle_tier_change(db, user.uuid, tier.tier)
    entitlements = await pro_helpers.get_entitlement(db, user.uuid)
    usage = await helpers.get_user_usage(user)
    is_trial = await pro_helpers.is_trial(db, user.uuid)

    return schemas.TierPutResponse(
        entitlement=entitlements, usage=usage, is_trial_entity=is_trial
    )


@router.post("/entitlement", response_model=SuccessReturn)
async def post_entitlement(
    entitlement: schemas.EntitlementPost,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to create the entitlement for a user.

    Args:
        entitlement (schemas.EntitlementPost): The entitlement to be created or updated.

    Returns:
        SuccessReturn: An instance indicating the operation was successful.
    """

    has_entitlement = await pro_helpers.has_entitlement(db, user.uuid)
    if not has_entitlement:
        await pro_helpers.insert_entitlement(
            db=db, user_uuid=user.uuid, tier=entitlement.tier
        )
    else:
        raise HTTPException(status_code=400, detail="Entitlement already exists")
    return SuccessReturn.success_instance()


@router.put("/entitlement", response_model=SuccessReturn)
async def put_entitlement(
    entitlement: schemas.EntitlementPut,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    has_entitlement = await pro_helpers.has_entitlement(db, user.uuid)
    if not has_entitlement:
        raise HTTPException(status_code=404, detail="Entitlement not found")

    await pro_helpers.update_entitlement(
        db=db, user_uuid=user.uuid, tier=entitlement.tier
    )
    return SuccessReturn.success_instance()


@router.get("/entitlement", response_model=schemas.EntitlementGet)
async def get_entitlement(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to retrieve the entitlement for a user.

    This endpoint retrieves the entitlement associated with the current authenticated user;
    If the user is associated with an entity, the returned entitlement will be the one associated with the entity.

    Args:

    Raises:
        HTTPException: If the entitlement is not found.

    Returns:
        schemas.EntitlementGet: The entitlement for the user.
    """
    result = await pro_helpers.get_entitlement(db, user.uuid)
    if not result:
        raise HTTPException(status_code=404, detail="Entitlement not found")

    return result


@router.patch("/entitlement", response_model=SuccessReturn)
async def patch_entitlement(
    entitlement: schemas.EntitlementPatch,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to update the entitlement for a user.

    This endpoint updates the entitlement associated with the current authenticated user.
    One or all of the fields can be updated.

    Args:
        entitlement (schemas.EntitlementPatch): The entitlement to be updated.

    Returns:
        SuccessReturn: An instance indicating the operation was successful.
    """
    tiers_match = {
        "pro": models.PRO_TIER_ID,
        "terminal": models.TERMINAL_TIER_ID,
    }
    if not pro_helpers.has_entitlement(db, user.uuid):
        raise HTTPException(status_code=404, detail="Entitlement not found")

    entitlement_dict = entitlement.model_dump(exclude_unset=True)
    if tier := entitlement_dict.pop("tier", None):
        entitlement_dict["tier_id"] = tiers_match.get(tier)

    if bundle_name := entitlement_dict.pop("bundle_name", None):
        entitlement_dict["data_bundle_uuid"] = await pro_helpers.get_data_bundle_uuid(
            db, bundle_name
        )

    query = (
        update(models.Entitlement)
        .where(models.Entitlement.user_uuid == user.uuid)
        .values(**entitlement_dict)
    )
    await db.execute(query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.put("/usage", response_model=schemas.EntitlementUsageGet)
async def put_usage(
    usage: schemas.EntitlementUsagePut,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    # await pro_helpers.check_usage_validity(db, usage, user.uuid)
    add_count = usage.add_copilot_count
    subtract_count = usage.subtract_copilot_count

    has_usage = await pro_helpers.has_usage(db, user.uuid)
    if not has_usage:
        query = insert(models.EntitlementUsage).values(
            user_uuid=user.uuid,
            number_copilot_calls_day_count=add_count,
        )
    else:
        user_usage = await schemas.EntitlementUsageGet.check_cache(db, user)
        total_copilot_calls = (
            user_usage.number_copilot_calls_day_count + add_count - subtract_count
        )

        if usage.reset_copilot_count:
            total_copilot_calls = add_count

        if total_copilot_calls > user_usage.copilot_calls_limit:
            return schemas.UsageLimitError.limit_error(user_usage)

        query = (
            update(models.EntitlementUsage)
            .where(models.EntitlementUsage.user_uuid == user.uuid)
            .values(number_copilot_calls_day_count=total_copilot_calls)
        )

    await db.execute(query)
    await db.commit()
    return await helpers.get_user_usage(user)


@router.get("/usage", response_model=schemas.EntitlementUsageGet)
async def get_usage(
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    result = await schemas.EntitlementUsageGet.check_cache(db, user)
    if not result:
        raise HTTPException(status_code=404, detail="Usage not found")
    return result


@router.get(
    "/widget-metadata",
    response_model=list[schemas.WidgetMetadataResponse],
)
async def get_widget_metadata(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    widget_type: schemas.MetaDataWidgetType | None = None,
    name: str | None = None,
    widget_id: UUID | None = None,
):
    """
    Retrieve widget metadata for a specific widget type and name.

    Args:
        widget_type (str): The type of the widget.
        name (str): The name of the widget.
        id (UUID): The ID of the widget.
    Returns:
        List[schemas.WidgetMetadataResponse]: A list of widget metadata responses.

    Raises:
        HTTPException: If no widget metadata is found.
    """
    result = await pro_helpers.get_widget_metadata(
        db=db, user=user, widget_id=widget_id, widget_type=widget_type, name=name
    )

    if not result:
        raise HTTPException(
            status_code=404, detail="Widget metadata not found for the user"
        )
    return result


@router.post("/widget-metadata", response_model=SuccessReturn)
async def post_widget_metadata(
    widget_metadata: schemas.WidgetMetadataResponse,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Create a new widget metadata entry.

    Args:
        widget_metadata (schemas.WidgetMetadataResponse): The widget metadata to be created.

    Returns:
        schemas.SuccessReturn: A success response indicating the operation was successful.
    """
    query = insert(models.WidgetMetadata).values(
        user_uuid=user.uuid, **widget_metadata.model_dump()
    )
    await db.execute(query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.patch("/widget-metadata", response_model=SuccessReturn)
async def patch_widget_metadata(  # noqa: PLR0913, PLR0917
    widget_metadata: schemas.WidgetMetadataResponsePatch,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    widget_id: UUID | None = None,
    widget_type: schemas.MetaDataWidgetType | None = None,
    name: str | None = None,
):
    """
    Update an existing widget metadata entry.

    Args:
        widget_metadata (schemas.WidgetMetadataResponse): The widget metadata to be updated.
        db (AsyncSession): The database session.
        user (User): The authenticated user.

    Returns:
        schemas.SuccessReturn: A success response indicating the operation was successful.
    """
    if not widget_id and not (widget_type and name):
        raise HTTPException(
            status_code=422, detail="Either id or widget_type and name must be provided"
        )

    query = update(models.WidgetMetadata).where(
        models.WidgetMetadata.user_uuid == user.uuid
    )
    if widget_id:
        query = query.where(models.WidgetMetadata.widget_id == widget_id)

    else:
        query = query.where(
            models.WidgetMetadata.widget_type == widget_type,
            models.WidgetMetadata.name == name,
        )

    query = query.values(**widget_metadata.model_dump(exclude_unset=True))

    if (await db.execute(query)).rowcount == 0:
        raise HTTPException(
            status_code=404, detail="Widget metadata not found for the user"
        )

    await db.commit()
    return SuccessReturn.success_instance()


@router.delete(
    "/widget-metadata/{widget_id}", response_model=list[schemas.WidgetMetadataResponse]
)
async def delete_widget_metadata(
    widget_id: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Delete an existing widget metadata entry and return the list of remaining entries.

    Args:
        widget_id (UUID): The ID of the widget to delete.
        db (AsyncSession): The database session.
        user (User): The authenticated user.

    Returns:
        List[schemas.WidgetMetadataResponse]: A list of remaining widget metadata entries.

    Raises:
        HTTPException: If no matching widget metadata is found.
    """
    delete_query = delete(models.WidgetMetadata).where(
        models.WidgetMetadata.user_uuid == user.uuid,
        models.WidgetMetadata.widget_id == widget_id,
    )

    result = await db.execute(delete_query)

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404, detail="Widget metadata not found for the given widget_id"
        )

    await db.commit()

    # Fetch remaining widget metadata for the user
    return await pro_helpers.get_widget_metadata(db=db, user=user)


@router.put("/enabled-bundles", response_model=SuccessReturn)
async def put_enabled_bundles(
    bundles: schemas.EnabledBundles,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to update or insert enabled bundles for a user.

    This endpoint updates the enabled bundles and disabled widgets associated with the current authenticated user.
    If no record exists for the user, a new record is inserted.

    Args:
        bundles (schemas.EnabledBundles): The enabled bundles and disabled widgets to be updated or inserted.
        user: The current authenticated user.

    Returns:
        SuccessReturn: An instance indicating the operation was successful.
    """
    query = (
        select(models.EnabledWidgetBundles.uuid)
        .where(models.EnabledWidgetBundles.user_uuid == user.uuid)
        .limit(1)
    )
    enabled_widget_bundles_uuid = (await db.execute(query)).scalar_one_or_none()
    if not enabled_widget_bundles_uuid:
        insert_query = insert(models.EnabledWidgetBundles).values(
            user_uuid=user.uuid,
            enabled_bundles=bundles.enabled_bundles,
            disabled_widgets=bundles.disabled_widgets,
        )
        await db.execute(insert_query)
    else:
        update_query = (
            update(models.EnabledWidgetBundles)
            .where(models.EnabledWidgetBundles.uuid == enabled_widget_bundles_uuid)
            .values(
                enabled_bundles=bundles.enabled_bundles,
                disabled_widgets=bundles.disabled_widgets,
            )
        )
        await db.execute(update_query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.get("/enabled-bundles", response_model=schemas.EnabledBundles)
async def get_enabled_bundles(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Endpoint to retrieve enabled bundles for a user.

    This endpoint fetches the enabled bundles and disabled widgets associated with the current authenticated user.

    Args:
        user: The current authenticated user.

    Returns:
        schemas.EnabledBundles: The enabled bundles and disabled widgets for the user.
    """
    return await pro_helpers.get_enabled_widget_bundles(db, user)


@router.get("/user-has-entity", response_model=schemas.SuccessReturn)
async def user_has_entity(
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_read_db),
):
    """
    Check if the user has an entity which is not OpenBB default Developer Entity.
    """
    permissions_uuid_query = select(models.User.permissions_uuid).where(
        models.User.uuid == user.uuid
    )
    permissions_uuid = (await db.execute(permissions_uuid_query)).scalar_one_or_none()
    if permissions_uuid and (
        permissions_uuid != settings.PRO_DEVELOPER_MAPPING or settings.is_onprem()
    ):
        return schemas.SuccessReturn.success_instance()
    return schemas.SuccessReturn.failure_instance()


@router.put("/custom-copilot", response_model=SuccessReturn)
async def put_custom_copilot(
    custom_copilot: schemas.CustomCopilot,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Update or insert a custom copilot for a user.
    """
    await pro_helpers.insert_or_update_custom_copilot(db, user.uuid, custom_copilot)
    return SuccessReturn.success_instance()


@router.get("/custom-copilot", response_model=list[schemas.CustomCopilot])
async def get_custom_copilot(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Get all custom copilots for a user.
    """
    return await pro_helpers.get_custom_copilots(db, user.uuid)


@router.delete("/custom-copilot/{uuid}", response_model=SuccessReturn)
async def delete_custom_copilot(
    uuid: UUID,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Delete a custom copilot(s) for a user.
    If the url is provided, delete only that copilot, otherwise delete all custom copilots for the user.
    """
    await pro_helpers.delete_custom_copilot(db, user.uuid, uuid)
    return SuccessReturn.success_instance()


@router.post("/prompts", response_model=SuccessReturn)
async def post_user_prompt(
    prompts: list[schemas.Prompt],
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Add the user prompts state.
    """
    await pro_helpers.insert_user_prompt_state(db, user.uuid, prompts)
    return SuccessReturn.success_instance()


@router.get("/prompts", response_model=list[schemas.Prompt])
async def get_user_prompt(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Get the user prompts state.
    """
    return await pro_helpers.get_user_prompt_state(db, user.uuid)


@router.post("/skills", response_model=list[schemas.SkillReturn])
async def create_user_skill(
    skill: schemas.SkillCreate,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Add the user skills state.
    """
    query = insert(models.UserSkills).values(**skill.model_dump(), user_uuid=user.uuid)
    await db.execute(query)
    await db.commit()
    return await pro_helpers.get_user_skill_state(db, user.uuid)


@router.patch("/skills/{skill_uuid}", response_model=list[schemas.SkillReturn])
async def update_user_skill(
    skill_uuid: UUID,
    skill: schemas.SkillCreate,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Update a user skill.
    """
    await pro_helpers.update_user_skill(db, user.uuid, skill_uuid, skill)
    return await pro_helpers.get_user_skill_state(db, user.uuid)


@router.delete("/skills", response_model=list[schemas.SkillReturn])
async def delete_user_skill(
    skill_uuids: list[UUID],
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Delete a user skill.
    """
    await pro_helpers.delete_user_skills(db, user.uuid, skill_uuids)
    return await pro_helpers.get_user_skill_state(db, user.uuid)


@router.get("/skills", response_model=list[schemas.SkillReturn])
async def get_user_skill(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Get the user skills state.
    """
    return await pro_helpers.get_user_skill_state(db, user.uuid)


@router.get("/role-permissions", response_model=schemas.UserRolesPermissions)
async def get_user_role_permissions(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Get the role permissions for a user.
    """
    return await pro_helpers.get_user_role_permissions(db, user.uuid)


@router.get(
    "/resource-permissions", response_model=schemas.UserRolesPermissionsFlattened
)
async def get_resource_permissions(
    db: Annotated[AsyncSession, Depends(aget_read_db)],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """
    Get the resource permissions for a user.
    """
    permissions = await pro_helpers.get_user_role_permissions(db, user.uuid)
    return pro_helpers.flatten_permissions(permissions.model_dump())


@router.get("/theme-settings", response_model=schemas.EntityThemeSettings)
async def get_ag_grid_theme_settings(
    db: AsyncSession = Depends(aget_read_db),
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """Get the ag-grid theme settings for the entity"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, user.uuid)
    return await pro_helpers.get_entity_theme_settings(db, entity_uuid)


@router.post("/mcp-servers", response_model=schemas.MCPServers)
async def post_mcp_servers(
    mcp_servers: schemas.MCPServers,
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    """
    Add or update the MCP servers for a user.
    """
    query = (
        select(models.MCPServers.uuid)
        .where(models.MCPServers.user_uuid == user.uuid)
        .limit(1)
    )
    result = (await db.execute(query)).scalar_one_or_none()
    if result is not None:
        # If the user already has MCP servers, update them
        query = (
            update(models.MCPServers)
            .where(models.MCPServers.user_uuid == user.uuid)
            .values(**mcp_servers.model_dump())
        )
    else:
        # If the user doesn't have MCP servers, insert them
        query = insert(models.MCPServers).values(
            user_uuid=user.uuid, **mcp_servers.model_dump()
        )
    await db.execute(query)
    await db.commit()

    return await pro_helpers.get_mcp_servers(db, user)


class MCPProxyRequest(BaseModel):
    model_config = {"extra": "ignore"}

    url: str
    method: Literal["GET", "POST"] = "GET"
    headers: dict | None = None
    body: dict | list | None = None

    @field_validator("url")
    def validate_url(cls, v: str) -> str:
        """Filter unsupported MCP urls.

        TODO: Consider adding the following patterns.
            - If ALLOWED_MCP_HOSTNAMES is explicitly set it becomes and explicit allow-list
            - In-cluster DNS endpoints are in deny-list (*.svc.cluster.local pattern)
            - Transport-level filtering: http in deny-list
        """
        # Prevent SSRF attacks
        parsed_url = urlparse(v)
        hostname = parsed_url.hostname

        if hostname in settings.ALLOWED_MCP_HOSTNAMES:
            return v

        # Block localhost and IP based urls
        if hostname in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("Invalid URL: localhost is not allowed")

        if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", hostname):
            raise ValueError("Invalid URL: IP addresses are not allowed")

        return v


mcp_proxy_client = httpx.AsyncClient(
    timeout=httpx.Timeout(10.0, read=300.0, connect=5.0)
)


def handle_cors(request: Response) -> dict[str, str]:
    origin = request.headers.get("Origin") or "*"
    cors_headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, mcp-session-id, www-authenticate, x-snowflake-request-id",
        "Access-Control-Expose-Headers": "mcp-session-id, www-authenticate, x-snowflake-request-id",
        "Access-Control-Max-Age": "86400",
    }

    return cors_headers


@router.post("/mcp-proxy", response_class=StreamingResponse)
async def mcp_proxy(
    data: Annotated[MCPProxyRequest, Body()],
    _=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
):
    """Proxy a request to the MCP service.
    This is used to allow the frontend to make requests to the MCP service to avoid CORS issues.
    """
    kwargs = {"headers": data.headers, "json": data.body}
    try:
        content_type = data.headers.get("content-type", "") if data.headers else ""
        # httpx requires form data to be sent as `data` instead of `json`
        if "x-www-form-urlencoded" in content_type and isinstance(data.body, dict):
            kwargs["data"] = kwargs.pop("json")

        req = mcp_proxy_client.build_request(data.method, data.url, **kwargs)
        r = await mcp_proxy_client.send(req, stream=True, follow_redirects=True)
        r.headers.update(handle_cors(r))

        return StreamingResponse(
            content=r.aiter_raw(),
            status_code=r.status_code,
            headers=r.headers,
            background=BackgroundTask(r.aclose),
        )

    except httpx.ReadTimeout as e:
        raise HTTPException(
            status_code=504, detail="MCP service request timed out"
        ) from e
    except httpx.RequestError as e:
        logger.error(f"An error occurred while requesting {e.request.url!r}.")
        raise HTTPException(
            status_code=502, detail="Error connecting to MCP service"
        ) from e
