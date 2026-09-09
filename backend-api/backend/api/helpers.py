"""General functions to help throughout the repo"""

import asyncio
import contextlib
import pickle  # noqa: S403
import warnings
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta
from typing import Literal
from uuid import UUID, uuid4

import requests
from fastapi import HTTPException
from httpx import AsyncClient
from loguru import logger
from pydantic.networks import IPvAnyAddress
from rq.timeouts import JobTimeoutException
from sqlalchemy import case, func, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api import base, models, schemas, worker_tasks
from api.database import AsyncWriteSessionLocal
from api.models import DashboardItem, Entity, EntityType, PermissionsEntityMap, User
from routers import pro_helpers
from utilities import rq_results
from utilities.config import settings

HTTPX_CLIENT: AsyncClient | None = None


async def add_log_task(request: str, error: str, status_code: int, method: str):
    # Silence the pytest mock warning
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        async with AsyncWriteSessionLocal.session() as db:
            query = insert(models.Log).values(
                request=request, error=error, status_code=status_code, method=method
            )
            await db.execute(query)
            await db.commit()


def add_log(request: str, error: str, status_code: int, method: str):
    # Ensures exceptions aren't raised while called inside fastapi exception handlers
    # This is to prevent SQL details from being leaked to the client
    with contextlib.suppress(Exception):
        asyncio.ensure_future(add_log_task(request, error, status_code, method))


def handle_user_conflict(exc: IntegrityError):
    err_message = str(exc.orig)
    if "username" in err_message:
        raise HTTPException(409, detail="This username is already in use.") from exc
    if "email" in err_message:
        raise HTTPException(409, detail="This email is already in use.") from exc
    raise HTTPException(400, detail="An unknown error occurred.") from exc


def handle_duplicate_pk(exc: IntegrityError):
    err_message = str(exc.orig)
    # SQLite reports duplicates as "UNIQUE constraint failed: <table>.<column>"
    if "UNIQUE constraint failed" in err_message:
        return
    duplicate_entry = "Duplicate entry" in err_message or "duplicate key" in err_message
    primary = "PRIMARY" in err_message or "unique constraint" in err_message

    if not duplicate_entry or not primary:
        raise HTTPException(400, detail="Unknown database error occurred") from exc


async def get_user_usage(user: User):
    """Update user usage"""

    return await worker_tasks.update_user_usage_cache(user.uuid)


def refresh_usage_cache(user_uuid: UUID) -> None:
    try:
        rq_results.rq_que.enqueue(
            worker_tasks.user_usage_cache_task,
            user_uuid,
            job_timeout=settings.RQ_TIMEOUT,
        )

    except JobTimeoutException:
        logger.error(f"Update user usage job timed out for user: {user_uuid}")


def handle_add_login(
    user_uuid: UUID,
    ip_address: None | IPvAnyAddress,
    source: None | Literal["terminal", "hub", "sdk", "pro", "oauth-hub", "excel"],
) -> None:
    try:
        rq_results.rq_que.enqueue(
            worker_tasks.login_information,
            user_uuid,
            ip_address,
            source,
            job_timeout=settings.RQ_TIMEOUT,
        )

    except JobTimeoutException:
        logger.error(f"Login information job timed out for user: {user_uuid}")


async def check_first_login(
    db: AsyncSession,
    user_uuid: UUID,
    sources: list[Literal["pro", "oauth-pro", "excel"]] | None = None,
) -> bool:
    """Check if the user is logging in for the first time"""
    query = (
        select(func.count(models.Login.uuid))
        .where(
            models.Login.user_uuid == user_uuid,
            models.Login.source.in_(sources) if sources else True,
        )
        .limit(5)
    )

    result = (await db.execute(query)).scalar_one_or_none()

    return result is None or result == 0


def handle_share_files(
    owner_uuid: UUID,
    dashboard_uuid: UUID | None = None,
    user_app_uuid: UUID | None = None,
) -> None:
    try:
        rq_results.rq_que.enqueue(
            worker_tasks.update_share_files,
            str(owner_uuid),
            str(dashboard_uuid) if dashboard_uuid else None,
            str(user_app_uuid) if user_app_uuid else None,
            job_timeout=settings.RQ_TIMEOUT,
        )

    except JobTimeoutException:
        logger.error(f"Update shared files job timed out for user: {owner_uuid}")


def get_user_query(email: str):
    to_select = [
        User.uuid,
        User.email,
        User.password,
        User.confirmed,
        User.username,
        User.primary_usage,
        User.wants_contacted,
        User.created_date,
        User.has_profile_url,
        User.totp_secret,
        User.totp_active,
        User.permissions_uuid,
    ]
    target = User.email if "@" in email else User.username
    return select(*to_select).where(target == email, User.deleted.is_(False))  # type: ignore


def get_user_pro_query(email: str):
    query = (
        select(
            User.email,
            User.uuid,
            User.username,
            User.confirmed,
            User.password,
            User.latest_version,
            User.permissions_uuid,
            User.pro_entitlements,
            User.pro_trial_end,
            User.pro_trial_renewals,
            User.pro_trial_extension,
            User.temporary_password,
            User.totp_secret,
            User.totp_active,
            User.billing_active,
            User.welcome_screen,
            User.two_factor_auth,
            User.is_superuser,
            User.can_submit_marketplace,
            Entity.uuid.label("entity_uuid"),
            Entity.require_authenticator,
            Entity.name,
            Entity.expiration_date,
            PermissionsEntityMap.name.label("role"),
        )
        .join(
            PermissionsEntityMap,
            User.permissions_uuid == PermissionsEntityMap.uuid,
            isouter=True,
        )
        .join(Entity, PermissionsEntityMap.entity_uuid == Entity.uuid, isouter=True)
        .where(User.deleted.is_(False))
    )
    if "@" in email:
        return query.where(User.email == email).limit(1)
    return query.where(User.username == email).limit(1)


def get_openbb_contributors() -> list[str]:
    r = settings.get_redis_session("pro")
    existing = r.get("OPENBB_CONTRIBUTORS")
    if existing:
        return pickle.loads(existing)  # noqa: S301
    per_page = 100
    base_url = f"https://api.github.com/repos/OpenBB-finance/OpenBBTerminal/contributors?per_page={per_page}"
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    final_result: list[str] = []
    page = 1
    while True:
        response = requests.get(f"{base_url}&page={page}", headers=headers, timeout=10)
        temp = [x["login"] for x in response.json()]
        final_result.extend(temp)
        if len(temp) < per_page:
            break
        page += 1
    r.set("OPENBB_CONTRIBUTORS", pickle.dumps(final_result), ex=60 * 60 * 24)
    return final_result


async def get_or_create_entity_type(db: AsyncSession, code: str) -> UUID:
    select_query = select(EntityType.uuid).where(
        EntityType.code == code, EntityType.active.is_(True)
    )
    response = (await db.execute(select_query)).first()
    if response:
        return response.uuid
    create_query = insert(EntityType).values(
        code=code, active=True, permission_hierarchy=0, entity_type="Trial"
    )
    return (await db.execute(create_query)).inserted_primary_key[0]


async def get_or_create_entity(db: AsyncSession, entity_type: UUID, name: str) -> UUID:
    select_query = select(Entity.uuid).where(
        Entity.name == name, Entity.entity_type_uuid == entity_type
    )
    response = (await db.execute(select_query)).first()
    if response:
        return response.uuid
    create_query = insert(Entity).values(
        name=name,
        entity_type_uuid=entity_type,
        expiration_date=datetime(2040, 12, 31),
        email=None,
        company_type=None,
        organization_size=None,
        aum=None,
        country=None,
        seats=100_000,
    )
    return (await db.execute(create_query)).inserted_primary_key[0]


async def create_developer_mapping():
    async with AsyncWriteSessionLocal.session() as db:
        try:
            # Check if entity already exists
            check_query = (
                select(Entity.uuid).where(Entity.name == "OpenBB Developer").limit(1)
            )
            response = (await db.execute(check_query)).scalar_one_or_none()
            if response:
                return

            entity_type_uuid = await get_or_create_entity_type(db, "OBB")
            entity_uuid = await get_or_create_entity(
                db, entity_type_uuid, "OpenBB Developer"
            )
            entitlements = schemas.ProEntitlements.trial_values()
            create_mapping_q = insert(PermissionsEntityMap).values(
                uuid=settings.PRO_DEVELOPER_MAPPING,
                entity_uuid=entity_uuid,
                name="Developer",
                entitlements=entitlements,
            )
            await db.execute(create_mapping_q)
            await db.commit()

            # Add entity entitlements
            await pro_helpers.insert_entity_entitlement(db, entity_uuid, "terminal")

        except IntegrityError as e:
            handle_duplicate_pk(e)
            await db.rollback()
        except Exception as e:
            if not settings.is_onprem():
                logger.exception(e)
            await db.rollback()


async def create_trial_mapping():
    async with AsyncWriteSessionLocal.session() as db:
        try:
            # Check if the mapping already exists
            check_query = select(PermissionsEntityMap.uuid).where(
                PermissionsEntityMap.uuid == settings.PRO_TRIAL_MAPPING
            )
            response = (await db.execute(check_query)).first()
            if response:
                return
            # If not, create the mapping
            entity_type_uuid = await get_or_create_entity_type(db, "OBB")
            entity_uuid = await get_or_create_entity(
                db, entity_type_uuid, "OpenBB Trial"
            )
            entitlements = schemas.ProEntitlements.trial_values()
            create_mapping_q = insert(PermissionsEntityMap).values(
                uuid=settings.PRO_TRIAL_MAPPING,
                entity_uuid=entity_uuid,
                name="Trial",
                entitlements=entitlements,
            )
            await db.execute(create_mapping_q)
            await db.commit()
        except IntegrityError as e:
            handle_duplicate_pk(e)
            await db.rollback()
        except Exception as e:
            if not settings.is_onprem():
                logger.exception(e)
            await db.rollback()


async def create_trial_user():
    async with AsyncWriteSessionLocal.session() as db:
        try:
            # Check if the user already exists
            check_query = select(User.uuid).where(User.uuid == settings.PRO_TRIAL_USER)
            response = (await db.execute(check_query)).first()
            if response:
                return
            # If not, create the user
            create_user_query = insert(User).values(
                uuid=settings.PRO_TRIAL_USER,
                email=settings.PRO_TRIAL_EMAIL,
                password=uuid4().hex,
                first_name="Entity",
                last_name="Admin",
                clean_email=base.clean_email(settings.PRO_TRIAL_EMAIL),
            )
            await db.execute(create_user_query)
            await db.commit()
        except IntegrityError as e:
            handle_duplicate_pk(e)
            await db.rollback()
        except Exception as e:
            if not settings.is_onprem():
                logger.exception(e)
            await db.rollback()


async def init_trial_mappings():
    """Create the trial and developer mappings if they don't exist"""
    await create_trial_mapping()
    await create_trial_user()
    await create_developer_mapping()


def email_is_public(email: str) -> bool:
    email_domain = email.split("@")[1].lower().strip()
    with open("api/public_emails.txt") as public_domains:
        for domain in public_domains:
            if email_domain == domain.replace("\n", "").strip():
                return True
    return False


async def check_pro_trial(
    db: AsyncSession, user: schemas.UserProSchema
) -> None | datetime:
    if user.permissions_uuid == settings.PRO_TRIAL_MAPPING:
        if user.pro_trial_extension or user.pro_trial_end is None:
            if user.pro_trial_end is None:
                new_time = base.get_now() + timedelta(weeks=3)
            else:
                new_time = max(user.pro_trial_end, base.get_now())
            if user.pro_trial_extension:
                new_time += timedelta(weeks=1)
            update_query = (
                update(User)
                .where(User.uuid == user.uuid)
                .values(
                    pro_trial_end=new_time,
                    pro_trial_extension=False,
                    pro_trial_renewals=user.pro_trial_renewals
                    or 0 + int(user.pro_trial_extension or 0),
                )
            )
            await db.execute(update_query)
            await db.commit()
            return new_time
        elif base.get_now() > user.pro_trial_end:
            raise HTTPException(status_code=400, detail="The trial is expired")

    return user.pro_trial_end


async def get_managed_users(db: AsyncSession, admin_result: UUID):
    latest_login_subquery = (
        select(
            models.Login.user_uuid,
            func.max(models.Login.created_date).label("last_login"),
        )
        .group_by(models.Login.user_uuid)
        .alias()
    )
    # Get active users and users who are invited with a new account
    query = (
        select(
            User.uuid,
            User.first_name,
            User.last_name,
            User.email,
            User.billing_active,
            PermissionsEntityMap.name.label("role"),
            User.pro_entitlements,
            latest_login_subquery.c.last_login,
            User.permissions_uuid,
            func.max(DashboardItem.updated_date).label("last_active"),
            case((User.confirmed.is_(True), "active"), else_="pending").label("status"),
            case(
                ((User.pro_trial_renewals or 0) > 0, True),  # type: ignore
                (User.pro_trial_extension.is_(True), True),
                else_=False,
            ).label("renewed"),
        )
        .join(PermissionsEntityMap, User.permissions_uuid == PermissionsEntityMap.uuid)
        .join(
            latest_login_subquery,
            User.uuid == latest_login_subquery.c.user_uuid,
            isouter=True,
        )
        .join(DashboardItem, User.uuid == DashboardItem.owner_uuid, isouter=True)
        .where(
            PermissionsEntityMap.entity_uuid == admin_result, User.deleted.is_(False)
        )
        .group_by(
            User.uuid,
            User.first_name,
            User.last_name,
            User.email,
            User.billing_active,
            PermissionsEntityMap.name,
            User.pro_entitlements,
            latest_login_subquery.c.last_login,
            User.permissions_uuid,
            User.confirmed,
            User.pro_trial_renewals,
            User.pro_trial_extension,
        )
    )
    return (await db.execute(query)).all()


async def get_permissions_invite_users(db: AsyncSession, admin_result: UUID):
    query = (
        select(
            User.email,
            User.uuid,
            User.first_name,
            User.last_name,
            models.PermissionsEntityMap.name.label("role"),
            models.PermissionsInvite.user_uuid.label("uuid"),
            case(
                (models.PermissionsInvite.revoked.is_(True), "revoked"),
                (models.PermissionsInvite.expiration_date < base.get_now(), "expired"),
                else_="pending",
            ).label("status"),
        )
        .select_from(models.PermissionsInvite)
        .join(
            PermissionsEntityMap,
            models.PermissionsInvite.permissions_uuid == PermissionsEntityMap.uuid,
        )
        .join(User, User.uuid == models.PermissionsInvite.user_uuid)
        .where(
            PermissionsEntityMap.entity_uuid == admin_result,
            models.PermissionsInvite.accepted.is_(False),
            models.PermissionsInvite.revoked.is_(False),
            User.deleted.is_(False),
        )
    )
    return (await db.execute(query)).all()


async def get_pro_invite_users(db: AsyncSession, admin_result: UUID):
    query = (
        select(
            models.UserProInvite.email,
            PermissionsEntityMap.name.label("role"),
            models.UserProInvite.data,
            models.UserProInvite.uuid,
        )
        .select_from(models.UserProInvite)
        .join(
            PermissionsEntityMap,
            models.UserProInvite.permissions_uuid == PermissionsEntityMap.uuid,
        )
        .where(
            PermissionsEntityMap.entity_uuid == admin_result,
            models.UserProInvite.used.is_(False),
        )
    )
    return (await db.execute(query)).all()


def get_pro_session_expiration(
    pro_trial_end: None | datetime, user: schemas.UserProSchema, remember: bool
) -> timedelta:
    if user.permissions_uuid == settings.PRO_DEVELOPER_MAPPING:
        return timedelta(30 if remember else 7)

    now = base.get_now()
    time_ds = [timedelta(30 if remember else 7), user.expiration_date - now]
    if pro_trial_end and user.permissions_uuid == settings.PRO_TRIAL_MAPPING:
        time_ds.append(pro_trial_end - now)
    return min(time_ds)


def get_httpx_client() -> AsyncClient:
    global HTTPX_CLIENT  # noqa: PLW0603
    if not HTTPX_CLIENT:
        HTTPX_CLIENT = AsyncClient()
    return HTTPX_CLIENT


async def stream_response_httpx(url: str) -> AsyncGenerator[bytes, None]:
    async with get_httpx_client().stream("GET", url) as response:
        if response.is_error:
            raise HTTPException(response.status_code, detail=response.text)
        async for chunk in response.aiter_raw():
            yield chunk


async def get_file_response(url: str) -> bytes:
    async with get_httpx_client().stream("GET", url) as response:
        if response.is_error:
            raise HTTPException(response.status_code, detail=response.text)
        return await response.aread()


async def test_url(url: str) -> bool:
    async with get_httpx_client().stream("HEAD", url) as response:
        return response.is_success
