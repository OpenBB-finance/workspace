"""Functions that help with authentication"""

import asyncio
import random
import re
from contextlib import suppress
from datetime import timedelta
from pathlib import Path
from typing import Annotated, Any, Literal, TypeAlias, override
from uuid import UUID

import jwt
from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.security.utils import get_authorization_scheme_param
from jwt import PyJWTError
from loguru import logger
from sqlalchemy import delete, insert, select, update
from sqlalchemy.engine.row import Row
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from api.statics import butterfly_species
from utilities.config import settings

from . import base, crud, database, models, schemas

ALGORITHM = "HS256"
SESSION_GRACE_PERIOD = timedelta(minutes=5)
TOKEN_FILE = Path("/snowflake/session/token")


credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

ProviderT: TypeAlias = Literal["microsoft", "google", "okta", "snowflake"]

OAUTH_PROVIDERS: dict[ProviderT, str] = {
    "microsoft": "https://graph.microsoft.com/v1.0/me",
    "google": "https://www.googleapis.com/oauth2/v3/userinfo",
    "okta": f"{settings.OKTA_DOMAIN}/oauth2/v1/userinfo",
    "snowflake": "<HANDLED_SEPARATELY>",
}
OAUTH_PATHS = [f"/pro/{provider}-auth" for provider in OAUTH_PROVIDERS]
ADMIN_CHECKS = {
    "privilege": "USAGE",
    "granted_on": "ROLE",
    "granted_to": "USER",
    "role": "ACCOUNTADMIN",
}


VALID_PATHS = [
    "/pro/login",
    "/pro/validate-and-sync",
    "/pro/dash/validate-and-sync",
    "/pro/create-user",
    "/pro/create-account",
    "/pro/confirm-account",
    "/pro/transfer-user",
    "/pro/register",
    *OAUTH_PATHS,
    "/pro/check-install",
    "/pro/check-update",
]

LOCALHOST_ORIGINS = [
    "http://localhost:1420",
    "https://localhost:1420",
    "http://localhost",
]

# Public, unauthenticated, read-only endpoints that anyone may call from any
# origin (including localhost). The global CORSMiddleware only permits the
# BACKEND_CORS_ORIGINS allowlist, so these paths are handled separately by
# PublicCORSMiddleware. Matched exactly to avoid loosening sub-routes such as
# /marketplace/apps/{app_id}/rate.
PUBLIC_CORS_PATHS = frozenset({"/marketplace/apps"})


class PublicCORSMiddleware(BaseHTTPMiddleware):
    """Reflect `*` CORS for the whitelisted public paths in PUBLIC_CORS_PATHS.

    Registered as the outermost middleware so it can answer the preflight
    OPTIONS request before the restrictive global CORSMiddleware rejects an
    unknown origin. All other paths fall through untouched.
    """

    @override
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path not in PUBLIC_CORS_PATHS:
            return response

        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response


def check_valid(origin: str, url_path: str) -> bool:
    """Checks that the given origin or path is valid

    Parameters
    ----------
    origin : str
        The origin to be checked
    url_path : str
        The path to be checked
    """

    origin = origin or ""
    valid_domain = origin.endswith("snowflakecomputing.app")

    VALID_ORIGINS = settings.BACKEND_CORS_ORIGINS
    if settings.DISABLE_CORS:
        return True

    if any(url_path.startswith(path) for path in VALID_PATHS):
        return True

    return valid_domain or origin in VALID_ORIGINS


class OpenBBOriginOAuth2Token(OAuth2PasswordBearer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    async def __call__(self, request: Request) -> str | None:
        origin = request.headers.get("Origin")
        openbb_auth = request.headers.get("X-OpenBB-Authorization")
        openbb_scheme, openbb_param = get_authorization_scheme_param(openbb_auth)

        if request.url.path.startswith("/pro/user/") and origin is None:
            auth = request.headers.get("Authorization")
            _, auth_param = get_authorization_scheme_param(auth)
            return openbb_param or auth_param

        is_bearer = openbb_scheme.lower() == "bearer"
        if not check_valid(origin, request.url.path) and not is_bearer:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not allowed to access this endpoint",
            )

        if is_bearer and not openbb_param:
            raise credentials_exception

        return openbb_param or settings.OPENBB_AUTH_TOKEN


openbb_oauth2_scheme = OpenBBOriginOAuth2Token(tokenUrl="token")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)


async def create_login_token(  # noqa: PLR0913,PLR0917
    db: AsyncSession,
    user_uuid: UUID,
    expires_delta: None | timedelta = None,
    api_token: None | str = None,
    pro: bool = False,
    source: str = "",
) -> str:
    """Creates a session for given user"""
    expiration = base.get_now()
    if expires_delta is None:
        expiration += timedelta(minutes=15)
    else:
        expiration += expires_delta
    query = insert(models.Session).values(
        user_uuid=user_uuid,
        expiration_date=expiration,
        api_token=api_token,
        pro=pro,
        source=source,
    )
    response = await db.execute(query)
    await db.commit()
    return str(response.inserted_primary_key[0])  # type: ignore


async def delete_user_pro_sessions(
    db: AsyncSession,
    user_uuid: UUID,
    sources: list[Literal["pro", "oauth-pro", "excel"]] | None = None,
) -> None:
    """Deletes all pro sessions for the given user

    Parameters
    ----------
    db : AsyncSession
        The database session
    user_uuid : UUID
        The user's UUID
    sources : list[Literal["pro", "oauth-pro", "excel"]] | None
        The sources to be deleted
    """
    filters = [models.Session.user_uuid == user_uuid, models.Session.pro.is_(True)]

    if sources:
        filters.append(models.Session.source.in_(sources))

    query = await db.execute(select(models.Session).where(*filters))

    if session_results := query.scalars().all():
        for session in session_results:
            await db.delete(session)
            base.remove_session_redis(session.uuid)

    await db.commit()


def create_jwt(data: dict, expires_delta: None | timedelta = None) -> str:
    """Creates a JWT token

    Parameters
    ----------
    data : dict
        The data to be encoded in the token
    expires_delta : None | timedelta
        The time until the token expires
    """
    to_encode = data.copy()
    expire = (
        base.get_now() + expires_delta
        if expires_delta
        else base.get_now() + timedelta(minutes=15)
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt  # type: ignore


def create_jwt_timeless(data: dict) -> str:
    """Creates a JWT token that does not expire

    Parameters
    ----------
    data : dict
        The data to be encoded in the token
    """
    return jwt.encode(data, settings.JWT_SECRET, algorithm=ALGORITHM)  # type: ignore


def decode_jwt(token: str) -> dict[str, str]:
    """Decodes the given JWT token

    Parameters
    ----------
    token : str
        The token to be decoded
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=ALGORITHM)  # type: ignore


ON_PREM_TOKEN: dict | None = None
if settings.is_onprem():
    with suppress(Exception):
        ON_PREM_TOKEN = decode_jwt(settings.OPENBB_AUTH_TOKEN)


class CustomRow:
    def __init__(self, **kwargs: dict[str, Any]):
        for key, value in kwargs.items():
            setattr(self, key, value)

    @classmethod
    def logout(cls):
        return cls(uuid=None, expiration_date=base.get_now() - timedelta(days=1))


async def check_session_expiration(
    result: CustomRow,
    token: UUID | str,
    db: AsyncSession | None = None,
    from_logout: bool = False,
) -> CustomRow:
    """Checks the session expiration for the given user.

    If the session is expired, it will either extend the expiration date
    by 5 minutes (if within the grace period) or delete the session.

    This avoids force logging out users who are currently active but whose
    sessions have technically expired.

    Parameters
    ----------
    result : CustomRow
        The result from the user query
    token : UUID | str
        The session token
    db : AsyncSession | None
        The database session
    from_logout : bool
        Whether the query is being generated from a logout request
    """
    if not result.expiration_date:
        return result

    is_expired = result.expiration_date < base.get_now()

    if not is_expired:
        return result

    newly_expired = result.expiration_date + SESSION_GRACE_PERIOD > base.get_now()

    token = UUID(token) if isinstance(token, str) else token

    async def update_session(db: AsyncSession):
        if newly_expired:
            new_exp = base.get_now() + SESSION_GRACE_PERIOD
            query = (
                update(models.Session)
                .where(models.Session.uuid == token)
                .values(expiration_date=new_exp)
            )
            setattr(result, "expiration_date", new_exp)
        else:
            query = delete(models.Session).where(models.Session.uuid == token)
            base.remove_session_redis(token)

        await db.execute(query)
        await db.commit()

    if db:
        await update_session(db)
    else:
        async with database.AsyncWriteSessionLocal.session() as db_session:
            await update_session(db_session)

    if not newly_expired and not from_logout:
        raise credentials_exception

    return result


class GetCurrentUser:
    """Gets the current user and specified columns"""

    def __init__(
        self,
        columns: list[str],
        tables: None | list[str] = None,
        pro: bool = False,
        from_logout: bool = False,
    ):
        """Initializes the class

        Parameters
        ----------
        columns : list[str]
            The columns to be returned
        tables : None | list[str]
            The tables to be joined
        pro : bool
            Whether to require the session to be a pro session
        from_logout : bool
            Whether the query is being generated from a logout request
        """

        self.columns = columns
        self.tables = tables if tables else []
        self.pro = pro
        self.from_logout = from_logout

    async def __call__(self, token: Annotated[str, Depends(oauth2_scheme)]):
        return await self.call_logic(
            token, self.columns, self.tables, self.pro, self.from_logout
        )

    @staticmethod
    async def call_logic(
        token: str, columns, tables, pro: bool = False, from_logout: bool = False
    ):
        try:
            clean_token = UUID(token)
        except:  # noqa: E722
            if from_logout:
                return CustomRow.logout()
            raise credentials_exception

        cleaned = await generate_user_query(
            clean_token, columns, tables, pro, from_logout
        )
        setattr(cleaned, "token", clean_token)
        if from_logout and getattr(cleaned, "uuid", None) is None:
            base.remove_session_redis(token)
            return cleaned

        return await check_session_expiration(cleaned, token, from_logout=from_logout)


class GetCurrentUserOptional:
    """Like GetCurrentUser but returns None when no token is provided."""

    def __init__(self, columns: list[str], tables: None | list[str] = None):
        self.columns = columns
        self.tables = tables if tables else []

    async def __call__(
        self, token: Annotated[str | None, Depends(oauth2_scheme_optional)] = None
    ):
        if token is None:
            return None
        try:
            return await GetCurrentUser.call_logic(token, self.columns, self.tables)
        except HTTPException:
            return None


class GetCurrentUserCookie(GetCurrentUser):
    """This is currently unused and only here in case Jose wants to switch from
    header to cookie authentication.
    """

    async def __call__(self, access_token: Annotated[str, Cookie()]):  # type: ignore
        return await GetCurrentUser.call_logic(access_token, self.columns, self.tables)


async def get_table_task(token: UUID, table: str, pro: bool = False):
    """Gets the table for the given user

    Parameters
    ----------
    token : UUID
        The current session token
    table : str
        The table to be returned
    pro : bool
        Whether to require the session to be a pro session
    """
    async with database.AsyncReadSessionLocal.session() as db:
        real_table = getattr(models, table)
        to_return = (
            select(models.Session.expiration_date, real_table)
            .where(
                models.Session.uuid == token,
                models.User.deleted.is_(False),
            )
            .join(models.User, models.User.uuid == models.Session.user_uuid)
            .join(real_table, real_table.user_uuid == models.User.uuid, isouter=True)
        )
        if pro:
            to_return = to_return.where(models.Session.pro.is_(True))

        return [
            result.get(table)
            for result in (await db.execute(to_return)).mappings().all()
            if result.get(table) is not None
        ]


async def get_columns_task(token: UUID, columns: list[str], pro: bool = False):
    """Gets the columns for the given user

    Parameters
    ----------
    token : UUID
        The current session token
    columns : list[str]
        The columns to be returned
    pro : bool
        Whether to require the session to be a pro session
    """
    async with database.AsyncReadSessionLocal.session() as db:
        real_cols = [getattr(models.User, col) for col in columns]
        to_return = (
            select(models.Session.expiration_date, *real_cols)
            .where(
                models.Session.uuid == token,
                models.User.deleted.is_(False),
            )
            .join(models.User, models.User.uuid == models.Session.user_uuid)
        )
        if pro:
            to_return = to_return.where(models.Session.pro.is_(True))

        return (await db.execute(to_return)).all()


async def generate_user_query(
    token: UUID,
    columns: list[str],
    tables: list[str],
    pro: bool = False,
    from_logout: bool = False,
) -> CustomRow:
    """Generates a query for the given user

    Parameters
    ----------
    db : Session
    token : UUID
        The current session token
    columns : list[str]
        The user columns to be returned
    tables : list[str]
        The tables that will be joined to the User table
    pro : bool
        Whether to require the session to be a pro session
    from_logout : bool
        Whether the query is being generated from a logout request
    """

    tasks = [asyncio.create_task(get_columns_task(token, columns, pro))] + [
        asyncio.create_task(get_table_task(token, table, pro)) for table in tables
    ]

    gathered = await asyncio.gather(*tasks)
    cols_results = gathered[0]
    table_results = gathered[1:] if tables else []

    if not cols_results:
        if from_logout:
            return CustomRow.logout()
        raise credentials_exception

    tables_dict: dict[str, list[Row]] = {}
    for table, value in zip(tables, table_results):
        tables_dict[table] = value

    all_results = flatten_results(cols_results, tables_dict)
    return all_results


def flatten_results(col_results: list[Row], table_results: dict[str, list[Row]]):
    """Flattens the results of the columns and tables

    Parameters
    ----------
    col_results : list[Row]
        The results of the columns
    table_results : dict[str, list[Row]
        The results of the tables
    """
    to_set = col_results[0]._asdict()
    for table, value in table_results.items():
        to_set[table] = value

    return CustomRow(**to_set)


async def get_current_superuser(
    token: str = Depends(oauth2_scheme),
) -> models.User:
    """
    Gets the current superuser from the database

    Parameters
    ----------
    token : str
        The token to be decoded
    db : Session
        The database session
    """
    try:
        UUID(token)
    except:  # noqa: E722
        raise credentials_exception
    query2 = (
        select(models.Session.expiration_date, models.User)
        .select_from(models.Session)
        .join(models.User, models.User.uuid == models.Session.user_uuid)
        .where(models.Session.uuid == token, models.User.deleted.is_(False))
    )
    async with database.AsyncWriteSessionLocal.session() as db:
        session = (await db.execute(query2)).first()
        if session is None:
            raise credentials_exception

        await check_session_expiration(session, token, db)

        if not session.User.is_superuser:
            raise credentials_exception
        return session.User


async def get_current_admin(
    token: str = Depends(oauth2_scheme),
):
    """
    Gets the current admin from the database

    Parameters
    ----------
    token : str
        The token to be decoded
    db : Session
        The database session
    """
    try:
        token_uuid = UUID(token)
    except:  # noqa: E722
        raise credentials_exception
    query2 = (
        select(
            models.Session.expiration_date,
            models.User.permissions_uuid,
            models.User.is_superuser,
            models.User.uuid,
            models.User.email,
            models.PermissionsEntityMap.name,
        )
        .select_from(models.Session)
        .join(models.User, models.User.uuid == models.Session.user_uuid)
        .join(
            models.PermissionsEntityMap,
            models.User.permissions_uuid == models.PermissionsEntityMap.uuid,
        )
        .where(
            models.Session.uuid == token_uuid,
            models.User.deleted.is_(False),
        )
    )

    async with database.AsyncWriteSessionLocal.session() as db:
        session = (await db.execute(query2)).first()
        if session is None:
            raise credentials_exception
        if session.name != "Admin":
            raise HTTPException(403, detail="User is not an admin")

        await check_session_expiration(session, token, db)
        return session


def is_valid_uuid(val):
    try:
        UUID(str(val))
        return True
    except ValueError:
        return False


def get_current_token(token: str = Depends(oauth2_scheme)) -> str:
    """
    Gets the current token from the header

    Parameters
    ----------
    token : str
        The token to be decoded
    """
    if not is_valid_uuid(token):
        raise HTTPException(422, detail="Token is not a valid UUID")
    return token


def token_checker(token: str, requirement: dict[str, str]) -> None:
    """Checks that the given token matches the given requirements

    Parameters
    ----------
    token : str
        The token to be checked
    requirement : dict[str, str]
        The requirements to be checked against
    """
    try:
        payload = decode_jwt(token)

        if ON_PREM_TOKEN:
            token_value: None | str = payload.get("auth", None)
            if token_value != ON_PREM_TOKEN.get("auth"):
                raise credentials_exception
            # token matches, so we can return
            return

        for key, value in requirement.items():
            token_value: None | str = payload.get(key, None)
            if value != token_value:
                raise credentials_exception
    except PyJWTError as e:
        raise credentials_exception from e


def check_openbb(token: str = Depends(openbb_oauth2_scheme)) -> None:
    """Checks that the given token is an openbb service token

    Parameters
    ----------
    token : str
        The token to be checked
    """
    for sub in ["bot", "openbb", "copilot", "excel", "findb", "pro"]:
        with suppress(Exception):
            return token_checker(token, {"sub": sub})

    raise credentials_exception


def check_pro(token: str = Depends(oauth2_scheme)) -> None:
    """Checks that the given token is a pro token

    Parameters
    ----------
    token : str
        The token to be checked
    """
    token_checker(token, {"sub": "pro"})


def check_bot(token: str = Depends(oauth2_scheme)) -> None:
    """Checks that the given token is a bot token

    Parameters
    ----------
    token : str
        The token to be checked
    """
    token_checker(token, {"sub": "bot"})


def check_lambda(token: str = Depends(oauth2_scheme)) -> None:
    """Checks that the given token is a lambda token

    Parameters
    ----------
    token : str
        The token to be checked
    """
    token_checker(token, {"sub": "lambda"})


async def reset_user_password(
    db: AsyncSession, new_password: str, token: str = Depends(oauth2_scheme)
) -> None | models.User:
    try:
        payload = decode_jwt(token)
        token_type = payload.get("token_type")
        if token_type != "forgot_password":  # noqa: S105
            raise credentials_exception
        user_email: None | str = payload.get("sub")
        if not user_email:
            raise credentials_exception
        token_data = schemas.TokenData(email=user_email)
    except PyJWTError:
        raise credentials_exception
    if not token_data.email:
        raise credentials_exception
    user = await crud.get_user(db, {"email": token_data.email})
    if user is None:
        raise credentials_exception
    u_query = (
        update(models.User)
        .where(models.User.email == token_data.email)
        .values(password=new_password, temporary_password=False)
    )
    await db.execute(u_query)
    d_query = delete(models.Session).where(models.Session.user_uuid == user.uuid)
    await db.execute(d_query)
    await db.commit()
    return user


def create_username() -> str:
    "Generate a random username which includes a butterfly name"
    butterfly = random.choice(butterfly_species)  # noqa: S311
    after = base.random_string(4)
    return f"{butterfly}_{after}"


def check_username_part(username: str) -> bool:
    """Checks that a string is a valid part of a username"""
    pattern = r"^\w{0,50}$"
    return bool(re.match(pattern, username, re.IGNORECASE))


def check_description(desc: str) -> bool:
    pattern = r"^[\w\s]+$"
    return bool(re.match(pattern, desc, re.IGNORECASE))


def check_info_fields(
    user: models.User | Row,
) -> Literal["bot", "complete", "incomplete"]:
    """Tells us whether the user has completed their pro fields. Bot users are legacy and not froced
    to fill in new fields"""
    if check_terminal_pro_fields(user):
        return "complete"
    if user.created_date is None:
        return "incomplete"
    if user.created_date.replace(tzinfo=None) < settings.HUB_RELEASE_DATE:
        return "bot"
    return "incomplete"


def check_terminal_pro_fields(user: models.User | Row) -> bool:
    "Whether or not a user has filled in all terminal pro information fields"
    return user.primary_usage is not None


CURRENT_PRO_USER = {
    "columns": [
        "username",
        "email",
        "uuid",
        "pro_entitlements",
        "accepted_pro_tos",
        "first_name",
        "last_name",
        "pro_display_settings",
        "pro_zero_to_hero",
        "primary_usage",
    ],
    "tables": ["SingleWidget", "ApiSource", "FileWidget"],
    "pro": True,
}


async def update_admin_user_permissions(
    db: AsyncSession, user_email: str, is_admin: bool
):
    if is_admin and settings.ON_PREM_ADMIN_MAPPING is not None:
        await db.execute(
            update(models.User)
            .where(models.User.email == user_email)
            .values(permissions_uuid=settings.ON_PREM_ADMIN_MAPPING, is_superuser=1)
        )
        await db.commit()
        logger.info(
            f"Set Snowflake user {user_email} as On-Prem Admin based on Snowflake role",
            exclude=True,
        )


async def process_snowflake_oauth(request: Request):
    """Initiate the Snowflake OAuth flow for the user."""
    from snowflake.snowpark.exceptions import SnowparkClientException  # noqa
    from snowflake.snowpark.session import Session  # noqa

    host_domain = request.headers.get("Host", "")
    ingress_user_token = request.headers.get("Sf-Context-Current-User-Token")
    subdomain = host_domain.replace(".snowflakecomputing.app", "")
    sf_user = request.headers.get("Sf-Context-Current-User")

    if not TOKEN_FILE.exists() or not ingress_user_token or not sf_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not allowed to access this endpoint",
        )

    token = TOKEN_FILE.read_text().strip()

    cfg = {
        "account": settings.SNOWFLAKE_ACCOUNT,
        "host": settings.SNOWFLAKE_HOST,
        "authenticator": "oauth",
        "token": token + "." + ingress_user_token,
    }
    is_admin = None
    try:
        with Session.builder.configs(cfg).create() as session:
            session.sql("SELECT CURRENT_ACCOUNT() AS ACCOUNT").collect()

        is_admin = False
        admin_checks = {**ADMIN_CHECKS, "grantee_name": sf_user}

        with Session.builder.configs({**cfg, "token": token}).create() as session:
            grants = session.sql(f"SHOW GRANTS TO USER {sf_user}").collect()
            for r in grants:
                row = r.as_dict()
                if all(row.get(k) == v for k, v in admin_checks.items()):
                    is_admin = True
                    break

    except SnowparkClientException as e:
        if is_admin is None:
            logger.error(f"Snowflake OAuth authentication failed: {e}")
            raise HTTPException(
                status_code=401,
                detail="Snowflake OAuth authentication failed",
            ) from e

    user_email = settings.get_snowflake_email(sf_user, subdomain)

    return {
        "email": user_email,
        "is_admin": is_admin,
        "given_name": sf_user,
        "host_domain": host_domain,
    }
