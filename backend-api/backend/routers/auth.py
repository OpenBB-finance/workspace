"""Authentication routes"""

from datetime import timedelta
from typing import Annotated

import pyotp
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from jwt import ExpiredSignatureError, PyJWTError
from sqlalchemy import Row, delete, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api import auth_helpers, base, crud, helpers, models, schemas
from api.database import aget_read_db, aget_write_db
from api.email import EmailService
from api.models import User, UserProInvite
from api.rate_limit import LIMIT_DEFAULT, LIMIT_FEW, exempt_user_agent, limiter
from api.storage import FileStorage
from routers import pro_helpers
from utilities.config import settings

user_response_fields = [
    "uuid",
    "confirmed",
    "created_date",
    "first_name",
    "last_name",
    "email",
    "username",
    "referral_code",
    "primary_usage",
    "has_profile_url",
    "wants_contacted",
]

router = APIRouter(tags=["auth"])

EXCEPTION_401 = HTTPException(
    status.HTTP_401_UNAUTHORIZED,
    detail="Incorrect username or password",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.post("/login", response_model=schemas.FullToken)
@limiter.limit("5/minute")
async def login(
    request: Request, user: schemas.UserLogin, db: AsyncSession = Depends(aget_write_db)
):
    status_code = 200
    query = helpers.get_user_query(user.email)
    db_user = (await db.execute(query)).first()

    if not db_user:
        raise EXCEPTION_401
    information_complete = auth_helpers.check_info_fields(db_user)
    if information_complete == "incomplete":
        status_code = 206

    if not base.verify_password(user.password, db_user.password):
        raise EXCEPTION_401

    if not db_user.confirmed:
        token_data = {"user": str(db_user.email)}
        token = auth_helpers.create_jwt(token_data, timedelta(hours=24))
        EmailService.send_confirmation(token, str(db_user.email))
        return JSONResponse(
            content={"message": "User is not confirmed"}, status_code=403
        )

    if db_user.totp_secret and db_user.totp_active:
        valid_secret = int(pyotp.TOTP(db_user.totp_secret).now())
        if valid_secret != user.totp_token:
            return JSONResponse(
                content={"message": "Invalid TOTP token"}, status_code=202
            )

    time_d = timedelta(days=30 if user.remember else 7)
    access_token = await auth_helpers.create_login_token(
        db, db_user.uuid, time_d, source=user.source or ""
    )
    # Enter the login into our database
    helpers.handle_add_login(db_user.uuid, user.ip_address, user.source)

    content = {
        "access_token": access_token,
        "token_type": "bearer",
        "information_complete": information_complete,
        "uuid": str(db_user.uuid),
        "primary_usage": db_user.primary_usage or "bot",
        "email": db_user.email,
        "username": db_user.username,
        "profile_url": (
            settings.get_profile_url(db_user.uuid) if db_user.has_profile_url else None
        ),
        "has_pro": bool(db_user.permissions_uuid),
    }
    return JSONResponse(content=content, status_code=status_code)


@router.get("/logout")
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def logout(
    request: Request,
    db: AsyncSession = Depends(aget_write_db),
    token: str = Depends(auth_helpers.get_current_token),
):
    query = delete(models.Session).where(models.Session.uuid == token)
    await db.execute(query)
    await db.commit()
    return JSONResponse(content={"success": True}, status_code=200)


@router.post("/register", response_model=schemas.MessageReturn)
@limiter.limit(LIMIT_FEW, exempt_when=exempt_user_agent)
async def register(
    request: Request,
    user: schemas.UserCreate,
    db: AsyncSession = Depends(aget_write_db),
):
    if settings.DISABLE_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is disabled")

    if not user.username:
        user.username = auth_helpers.create_username()

    user.is_verified = False
    # Marketing contact is created via brand_new_pro_newsletter during registration
    to_exclude = {
        "email_academia",
        "email_bot",
        "email_prowaitlist",
        "email_newsletter",
        "is_verified",
    }
    as_dict = user.model_dump(exclude=to_exclude)
    if await crud.check_new_user(db, user.email):
        raise HTTPException(409, detail="A user with this email already exists")
    query = insert(User).values(clean_email=base.clean_email(user.email), **as_dict)
    try:
        response = await db.execute(query)
        await db.commit()
        response.inserted_primary_key[0]  # type: ignore
    except IntegrityError as exc:
        return helpers.handle_user_conflict(exc)
    data = {"user": str(user.email)}
    token = auth_helpers.create_jwt(data, timedelta(hours=24))
    EmailService.send_confirmation(token, user.email)
    return JSONResponse(content={"success": True}, status_code=200)


@router.post("/resend-confirmation", response_model=schemas.MessageReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def resend_confirmation(
    request: Request,
    user: schemas.UserForgot,
    db: AsyncSession = Depends(aget_read_db),
):
    if not settings.HUBSPOT:
        raise HTTPException(400, detail="Hubspot is disabled.")

    query = select(User.email).where(User.email == user.email)
    response = (await db.execute(query)).first()
    if response is None:
        raise HTTPException(409, detail="User does not exist")
    data = {"user": str(response.email)}
    token = auth_helpers.create_jwt(data, timedelta(hours=24))
    EmailService.send_confirmation(token, response.email)
    return JSONResponse(content={"success": True}, status_code=200)


@router.get("/confirm-account", response_model=schemas.MessageReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def confirm_account(
    request: Request, token: str, db: AsyncSession = Depends(aget_write_db)
):
    try:
        data_dict = auth_helpers.decode_jwt(token)
        email = data_dict["user"]
    except ExpiredSignatureError:
        raise HTTPException(400, detail="Token Expired")
    except PyJWTError:
        raise HTTPException(400, detail="Invalid Token")
    # hubspot.update_contact is_verified no longer needed — marketing prefs handled separately
    query = update(User).where(User.email == email).values(confirmed=True)
    response = await db.execute(query)
    await db.commit()
    if response.rowcount == 0:  # type: ignore
        raise HTTPException(404, detail="User not found")
    EmailService.send_welcome_email(email)
    return JSONResponse(content={"success": True}, status_code=200)


@router.post("/forgot-password", response_model=schemas.MessageReturn)
@limiter.limit("10/hour")
async def forgot_password(
    request: Request,
    user: schemas.UserForgot,
    db: Annotated[AsyncSession, Depends(aget_read_db)],
):
    query = select(User.email).where(User.email == user.email)
    response = (await db.execute(query)).first()
    if not response:
        # Check for pending invite
        inviter_query = (
            select(
                User.email,
                User.permissions_uuid,
                UserProInvite.uuid,
                UserProInvite.email.label("invited_email"),
                UserProInvite.data,
            )
            .join(UserProInvite, User.uuid == UserProInvite.inviting_user_uuid)
            .where(
                UserProInvite.email == user.email,
                UserProInvite.used.is_(False),
            )
            .limit(1)
        )
        inviter_result = (await db.execute(inviter_query)).first()
        if not inviter_result:
            helpers.add_log("/forgot-password", "User not found", 200, "POST")
            # Return same message as successful case to avoid user enumeration
            return JSONResponse(content={"success": True}, status_code=200)

        is_free_tier = (
            inviter_result.permissions_uuid == settings.PRO_DEVELOPER_MAPPING
            and not settings.is_onprem()
        )
        pw = inviter_result.data.get("password") or base.random_password()
        EmailService.send_create_account(
            token=inviter_result.uuid,
            to=inviter_result.invited_email,
            password=pw,
            inviter=inviter_result.email,
            is_free_tier=is_free_tier,
        )
        raise HTTPException(
            409,
            detail="An invitation has already been sent to this user. A new invitation will be sent to your email.",
        )

    reset_token = auth_helpers.create_jwt(
        data={"sub": response.email, "token_type": "forgot_password"},
        expires_delta=timedelta(minutes=15),
    )
    EmailService.send_password_reset(reset_token, user.email)
    return JSONResponse(content={"success": True}, status_code=200)


@router.post("/forgot-password-confirmation", response_model=schemas.MessageReturn)
@limiter.limit("10/hour")
async def forgot_password_confirmation(
    request: Request, user: schemas.UserReset, db: AsyncSession = Depends(aget_write_db)
):
    success = await auth_helpers.reset_user_password(db, user.password, user.token)
    if success:
        EmailService.send_password_reset_confirmation(success.email)
        return JSONResponse(content={"success": True}, status_code=200)
    raise HTTPException(400, detail="Error resetting password")


@router.get("/user", response_model=schemas.UserReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
def get_user(
    request: Request,
    user=Depends(auth_helpers.GetCurrentUser(user_response_fields)),
):
    return crud.user_response(user)


@router.put("/user", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def put_user(
    request: Request,
    user_update: schemas.UserUpdate,
    db: AsyncSession = Depends(aget_write_db),
    user=Depends(auth_helpers.GetCurrentUser(["uuid", "email", "password"])),
):
    update_data = user_update.model_dump()
    if len(str(update_data)) > settings.MAX_DICT_LEN:
        raise HTTPException(400, detail="Dictionary exceeds maximum length")
    try:
        new_dict = user_update.validated_dict(user.password)
    except ValueError as e:
        raise HTTPException(401, detail="Invalid password") from e

    try:
        query = update(User).where(User.uuid == user.uuid).values(**new_dict)
        await db.execute(query)
        await db.commit()
    except IntegrityError as exc:
        return helpers.handle_user_conflict(exc)
    # hubspot first/last name sync removed — not needed for marketing provider
    if user_update.old_password and user_update.new_password:
        query = delete(models.Session).where(
            models.Session.uuid != user.token, models.Session.user_uuid == user.uuid
        )
        await db.execute(query)
        await db.commit()
        EmailService.send_password_reset_confirmation(user.email)
    return {"success": True}


@router.get("/logout-everywhere", response_model=schemas.MessageReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def logout_everywhere(
    request: Request,
    db: AsyncSession = Depends(aget_write_db),
    user=Depends(auth_helpers.GetCurrentUser(["uuid"])),
):
    query = delete(models.Session).where(models.Session.user_uuid == user.uuid)
    await db.execute(query)
    await db.commit()
    return JSONResponse(content={"success": True}, status_code=200)


@router.delete("/user", response_model=schemas.MessageReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def delete_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid"])),
):
    result = await pro_helpers.delete_user(db, user.uuid)
    return JSONResponse(content={"success": result}, status_code=200)


@router.get("/validate", response_model=schemas.ValidateReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def validate_email(
    request: Request, key: str, email: str, db: AsyncSession = Depends(aget_read_db)
):
    auth_helpers.token_checker(key, {"sub": "polygon"})
    query = select(User.uuid).where(User.email == email)
    response = (await db.execute(query)).first()
    return JSONResponse(content={"authenticated": bool(response)}, status_code=200)


@router.post("/login-github-google", response_model=schemas.FullToken)
@limiter.limit("5/minute")
async def login_external(  # noqa: PLR0915
    request: Request,
    user: schemas.ExternalUserLogin,
    db: AsyncSession = Depends(aget_write_db),
):
    status_code = 200
    db_user = (await db.execute(helpers.get_user_query(user.email))).first()
    time_d = 30 if user.remember else 7
    if not db_user:
        status_code = 201
        rand_password = base.random_string(165)
        if await crud.check_new_user(db, user.email):
            raise HTTPException(409, detail="A user with this email already exists")
        query_i = insert(User).values(
            email=user.email,
            clean_email=base.clean_email(user.email),
            source=user.source,
            confirmed=True,
            password=rand_password,
        )
        response = await db.execute(query_i)
        user_uuid = response.inserted_primary_key[0]  # type: ignore
        await db.commit()
        information_complete = "incomplete"
        primary_usage = ""
        has_pro = False
        EmailService.send_welcome_email(user.email)

    else:
        # For right now we still need to give the user a token so they can still update fields
        # This creates an exploit in the system, but the exploit is that they can use the website
        # without answering two know your customer questions, which is pretty minor
        if not db_user.confirmed:
            update_query = (
                update(User).where(User.email == user.email).values(confirmed=True)
            )
            await db.execute(update_query)
            await db.commit()
        information_complete = auth_helpers.check_info_fields(db_user)
        if information_complete == "incomplete":
            status_code = 206
        user_uuid = db_user.uuid
        has_pro = db_user.permissions_uuid
        primary_usage = db_user.primary_usage
        # For right now we are NOT checking ouath for 2FA
        if db_user.totp_secret and False:  # noqa: SIM223
            valid_secret = int(pyotp.TOTP(db_user.totp_secret).now())
            if valid_secret != user.totp_token:
                return JSONResponse(
                    content={"message": "Invalid TOTP token"}, status_code=202
                )

    delta = timedelta(days=time_d)
    access_token = await auth_helpers.create_login_token(
        db, user_uuid, delta, source=user.source or ""
    )
    # Enter the login into our database
    helpers.handle_add_login(user_uuid, user.ip_address, user.source)

    response_data = {
        "access_token": access_token,
        "token_type": "bearer",
        "information_complete": information_complete,
        "uuid": str(user_uuid),
        "primary_usage": primary_usage,
        "email": "" if not db_user else db_user.email,
        "has_pro": bool(has_pro),
        "username": "" if not db_user else db_user.username,
        "profile_url": (
            ""
            if not db_user
            else (
                settings.get_profile_url(db_user.uuid)
                if db_user.has_profile_url
                else None
            )
        ),
    }
    return JSONResponse(content=response_data, status_code=status_code)


@router.get("/marketing", response_model=schemas.UserMarketing)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_marketing(
    request: Request,
    user=Depends(auth_helpers.GetCurrentUser(["email"])),
    db: AsyncSession = Depends(aget_read_db),
):
    from api.marketing import MarketingService  # noqa: PLC0415

    result = MarketingService.get_contact(user.email)
    if result is None:
        return schemas.UserMarketing()
    return result


@router.put("/marketing", response_model=schemas.MessageReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def put_marketing(
    request: Request,
    marketing_info: schemas.UserMarketing,
    user=Depends(
        auth_helpers.GetCurrentUser(
            [
                "email",
                "first_name",
                "last_name",
                "primary_usage",
                "wants_contacted",
            ]
        )
    ),
    db: AsyncSession = Depends(aget_write_db),
):
    from api.marketing import MarketingService  # noqa: PLC0415

    # Enrich marketing info with user profile data from DB
    enrichment = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "primary_usage": user.primary_usage,
        "wants_contacted": user.wants_contacted,
    }
    for field, value in enrichment.items():
        if value and not getattr(marketing_info, field, None):
            setattr(marketing_info, field, value)

    result = MarketingService.update_contact(user.email, marketing_info)
    if not result:
        raise HTTPException(400, detail="Could not update user tags")
    return JSONResponse(content={"success": True}, status_code=200)


@router.post("/profileimage", response_model=schemas.ProfileUrlReturn)
@limiter.limit(LIMIT_FEW, exempt_when=exempt_user_agent)
async def post_profile_image(
    request: Request,
    image: UploadFile,
    user: Row = Depends(auth_helpers.GetCurrentUser(["uuid", "has_profile_url"])),
    db: AsyncSession = Depends(aget_write_db),
):
    if image.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(400, detail="Image must be a jpeg or png")
    fs = await image.read()
    filesize = len(fs)
    if filesize > 1024 * 1024:
        raise HTTPException(400, detail="Image must be less than 1MB")
    image.file.seek(0)
    result = await FileStorage.upload_file(
        image.file, "openbb-assets", f"profile-pictures/{user.uuid}.png"
    )
    if result:
        query = update(User).where(User.uuid == user.uuid).values(has_profile_url=True)
        await db.execute(query)
        await db.commit()
    the_url = settings.get_profile_url(user.uuid) if user.has_profile_url else None
    return JSONResponse(
        content={"success": result, "profile_url": the_url},
        status_code=200 if result else 400,
    )


@router.delete("/profileimage", response_model=schemas.MessageReturn)
@limiter.limit(LIMIT_FEW, exempt_when=exempt_user_agent)
async def delete_profile_image(
    request: Request,
    user: Row = Depends(auth_helpers.GetCurrentUser(["uuid"])),
    db: AsyncSession = Depends(aget_write_db),
):
    result = await FileStorage.delete_file(
        "openbb-assets", f"profile-pictures/{user.uuid}.png"
    )
    if result:
        query = update(User).where(User.uuid == user.uuid).values(has_profile_url=False)
        await db.execute(query)
        await db.commit()
    return JSONResponse(content={"success": result}, status_code=200 if result else 400)


@router.get("/support-confirmation")
@limiter.limit(LIMIT_FEW, exempt_when=exempt_user_agent)
def support_confirmation(
    request: Request,
    user: User = Depends(auth_helpers.GetCurrentUser(["email"])),
):
    EmailService.send_support_received(user.email)


@router.get("/username-list/{username}", response_model=Page[str])
@limiter.limit(LIMIT_FEW, exempt_when=exempt_user_agent)
async def username_list(
    request: Request,
    username: str,
    _: User = Depends(auth_helpers.GetCurrentUser(["email"])),
    db: AsyncSession = Depends(aget_read_db),
):
    query = select(User.username).where(
        User.username.contains(username), User.deleted.is_(False)
    )
    return await paginate(db, query, unwrap_mode="unwrap")


@router.post("/newsletter/{email}", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_FEW, exempt_when=exempt_user_agent)
def subscribe_newsletter(request: Request, email: str):
    from api.marketing import MarketingService  # noqa: PLC0415

    properties = schemas.UserMarketing(email_newsletter=True)
    result = MarketingService.update_contact(email, properties)
    content = {"success": bool(result)}
    return JSONResponse(content=content, status_code=200 if result else 400)


@router.post("/totp", response_model=schemas.TotpGenerateReturn)
@limiter.limit(LIMIT_FEW, exempt_when=exempt_user_agent)
async def generate_totp(
    request: Request,
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "email", "totp_secret", "totp_active"])
    ),
    db: AsyncSession = Depends(aget_write_db),
):
    if user.totp_secret and user.totp_active:
        raise HTTPException(400, detail="TOTP already enabled")
    totp = pyotp.TOTP(pyotp.random_base32())
    query = update(User).where(User.uuid == user.uuid).values(totp_secret=totp.secret)
    await db.execute(query)
    await db.commit()
    uri = totp.provisioning_uri(name=user.email, issuer_name="OpenBB")
    return schemas.TotpGenerateReturn(uri=uri, secret=totp.secret)


@router.post("/totp/activate", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_FEW, exempt_when=exempt_user_agent)
async def confirm_totp(
    request: Request,
    totp_submit: schemas.TotpToken,
    user: User = Depends(
        auth_helpers.GetCurrentUser(["uuid", "totp_secret", "totp_active"])
    ),
    db: AsyncSession = Depends(aget_write_db),
):
    if not user.totp_secret:
        raise HTTPException(400, detail="TOTP secret has not been generated")

    valid_secret = int(pyotp.TOTP(user.totp_secret).now())
    if valid_secret != totp_submit.totp_token:
        raise HTTPException(401, detail="Invalid TOTP token")

    query = update(User).where(User.uuid == user.uuid).values(totp_active=True)
    await db.execute(query)
    await db.commit()
    return {"success": True}


@router.delete("/totp", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_FEW, exempt_when=exempt_user_agent)
async def delete_totp(
    request: Request,
    user: User = Depends(auth_helpers.GetCurrentUser(["uuid"])),
    db: AsyncSession = Depends(aget_write_db),
):
    query = (
        update(User)
        .where(User.uuid == user.uuid)
        .values(totp_secret=None, totp_active=False)
    )
    await db.execute(query)
    await db.commit()
    return {"success": True}
