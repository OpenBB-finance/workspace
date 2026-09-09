"""SDK routes"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from jwt import PyJWTError
from sqlalchemy import Row, delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api import auth_helpers, base, helpers, models, schemas
from api.database import aget_write_db
from api.models import User
from api.rate_limit import LIMIT_DEFAULT, exempt_user_agent, limiter
from routers import auth

router = APIRouter(prefix="/sdk", tags=["sdk"])


@router.get("/token", response_model=schemas.TokenReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_sdk(
    request: Request, user: Row = Depends(auth_helpers.GetCurrentUser(["auth_token"]))
):
    """Shows the current sdk token for a user"""
    if user.auth_token is None:
        raise HTTPException(404, detail="User does not have a token")
    try:
        auth_helpers.decode_jwt(user.auth_token)
    except PyJWTError as error:
        exp_datetime = base.get_exp(user.auth_token)
        if exp_datetime < base.get_now():
            exp_str = exp_datetime.strftime("%Y-%m-%d %H:%M:%S")
            raise HTTPException(400, detail=f"Token expired: {exp_str}") from error
        raise HTTPException(400, detail="Unknown issue with PAT token") from error
    return {"token": user.auth_token, "expiration": base.get_exp(user.auth_token)}


@router.put("/token", response_model=schemas.TokenReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def update_sdk(
    request: Request,
    expiration: schemas.Expiration,
    db: AsyncSession = Depends(aget_write_db),
    user: Row = Depends(auth_helpers.GetCurrentUser(["auth_token", "uuid"])),
):
    "Updates the token for a given user and returns the next token"
    if user.auth_token:
        query = delete(models.Session).where(
            models.Session.api_token == user.auth_token,
            models.Session.user_uuid == user.uuid,
        )
        await db.execute(query)
        await db.commit()
    new_token = base.random_long_string()
    data = {"auth_token": new_token}
    as_jwt = auth_helpers.create_jwt(data, timedelta(days=expiration.days))
    query2 = update(User).where(User.uuid == user.uuid).values(auth_token=as_jwt)
    await db.execute(query2)
    await db.commit()
    return {"token": as_jwt, "expiration": base.get_exp(as_jwt)}


@router.delete("/token")
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def delete_sdk(
    request: Request,
    db: AsyncSession = Depends(aget_write_db),
    user: Row = Depends(auth_helpers.GetCurrentUser(["auth_token", "uuid"])),
):
    if user.auth_token:
        query = delete(models.Session).where(
            models.Session.api_token == user.auth_token,
            models.Session.user_uuid == user.uuid,
        )
        await db.execute(query)
        query2 = update(User).where(User.uuid == user.uuid).values(auth_token=None)
        await db.execute(query2)
        await db.commit()
    return JSONResponse(content={"success": True}, status_code=202)


@router.post("/login", response_model=schemas.Token)
@limiter.limit("5/minute")
async def login(
    request: Request, user: schemas.TokenGet, db: AsyncSession = Depends(aget_write_db)
):
    columns = [
        User.uuid,
        User.primary_usage,
        User.confirmed,
        User.email,
        User.password,
        User.username,
    ]
    query = select(*columns).where(User.auth_token == user.token, User.deleted.is_(False))  # type: ignore
    db_user = (await db.execute(query)).first()
    if not db_user:
        raise auth.EXCEPTION_401
    if not db_user.confirmed:
        return JSONResponse(
            content={"message": "User is not confirmed"}, status_code=403
        )
    access_token = await auth_helpers.create_login_token(
        db, db_user.uuid, timedelta(days=30), user.token, source="sdk"
    )
    helpers.handle_add_login(db_user.uuid, None, "sdk")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "uuid": db_user.uuid,
        "primary_usage": db_user.primary_usage or "bot",
        "email": db_user.email,
        "username": db_user.username,
    }
