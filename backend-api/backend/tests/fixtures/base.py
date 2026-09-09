"""Shared helpers and configuration for backend test fixtures."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from datetime import UTC
from typing import Any, TypedDict
from collections.abc import Mapping, Sequence

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, text
from sqlalchemy.sql import Executable
from sqlalchemy.ext.asyncio import AsyncSession

_BASE_TEST_ENV = {
    "MODE": "test",
    "DATABASE_TYPE": "mysql",
    "HUBSPOT": "true",
    "HUBSPOT_EMAIL_TOKEN": "test_email_token",
    "HUBSPOT_CONTACT_TOKEN": "test_contact_token",
    "HUBSPOT_SERVICE_TOKEN": "test_service_token",
    "PROURL": "http://localhost:3000",
    "SELFURL": "http://localhost:8000",
    "JWT_SECRET": "supersecretkeyfortestingonly12345",
    "OPENBB_AES_KEY": "sixteenbytekey!!",
    "DISABLE_CORS": "true",
}
for key, value in _BASE_TEST_ENV.items():
    os.environ.setdefault(key, value)

from api.models import User  # noqa: E402
from utilities.config import settings  # noqa: E402
from main import app  # noqa: E402

logger = logging.getLogger(__name__)

_TEST_USER_UUID = "00000000-0000-0000-0000-000000000001"
_TEST_SESSION_UUID = "00000000-0000-0000-0000-000000000002"
_TEST_ENTITY_UUID = "00000000-0000-0000-0000-000000000003"
_TEST_PERM_UUID = "00000000-0000-0000-0000-000000000004"
_TEST_ENTITY_TYPE_UUID = "00000000-0000-0000-0000-000000000005"


class UserConfig(TypedDict):
    email: str
    user_uuid: str
    session_uuid: str
    entity_uuid: str
    perm_uuid: str
    entity_type_uuid: str
    entity_type: str
    entity_code: str
    entity_name: str
    entity_email: str
    perm_name: str
    session_source: str


CleanupStatement = tuple[Executable, Mapping[str, Any]]


_AUTH_USER: UserConfig = {
    "email": "testrunner@openbb.co",
    "user_uuid": _TEST_USER_UUID,
    "session_uuid": _TEST_SESSION_UUID,
    "entity_uuid": _TEST_ENTITY_UUID,
    "perm_uuid": _TEST_PERM_UUID,
    "entity_type_uuid": _TEST_ENTITY_TYPE_UUID,
    "entity_type": "test_company",
    "entity_code": "TST",
    "entity_name": "Test Entity",
    "entity_email": "entity@openbb.co",
    "perm_name": "admin",
    "session_source": "integration_test",
}

_ADMIN_USER: UserConfig = {
    "email": "admin_testrunner@openbb.co",
    "user_uuid": "00000000-0000-0000-0000-000000000010",
    "session_uuid": "00000000-0000-0000-0000-000000000011",
    "entity_uuid": "00000000-0000-0000-0000-000000000012",
    "perm_uuid": "00000000-0000-0000-0000-000000000013",
    "entity_type_uuid": "00000000-0000-0000-0000-000000000014",
    "entity_type": "admin_company",
    "entity_code": "ADM",
    "entity_name": "Admin Entity",
    "entity_email": "admin_entity@openbb.co",
    "perm_name": "Admin",
    "session_source": "test_admin",
}

_SECOND_USER: UserConfig = {
    "email": "second_testrunner@openbb.co",
    "user_uuid": "00000000-0000-0000-0000-000000000020",
    "session_uuid": "00000000-0000-0000-0000-000000000021",
    "entity_uuid": "00000000-0000-0000-0000-000000000022",
    "perm_uuid": "00000000-0000-0000-0000-000000000023",
    "entity_type_uuid": "00000000-0000-0000-0000-000000000024",
    "entity_type": "second_company",
    "entity_code": "SEC",
    "entity_name": "Second Entity",
    "entity_email": "second_entity@openbb.co",
    "perm_name": "admin",
    "session_source": "test_second",
}

_USER_UUID_TABLE_DELETE_QUERIES = [
    text("DELETE FROM `personal_access_token` WHERE user_uuid = :uuid"),
    text("DELETE FROM `mcp_servers` WHERE user_uuid = :uuid"),
    text("DELETE FROM `copilot_chat` WHERE user_uuid = :uuid"),
    text("DELETE FROM `custom_copilot` WHERE user_uuid = :uuid"),
    text("DELETE FROM `prompts` WHERE user_uuid = :uuid"),
    text("DELETE FROM `user_skills` WHERE user_uuid = :uuid"),
    text("DELETE FROM `widget_metadata` WHERE user_uuid = :uuid"),
    text("DELETE FROM `user_files` WHERE user_uuid = :uuid"),
    text("DELETE FROM `api_source_connectors` WHERE user_uuid = :uuid"),
    text("DELETE FROM `file_connectors` WHERE user_uuid = :uuid"),
    text("DELETE FROM `single_widget_connectors` WHERE user_uuid = :uuid"),
    text("DELETE FROM `dashboard_shares` WHERE user_uuid = :uuid"),
    text("DELETE FROM `dashboards` WHERE user_uuid = :uuid"),
]

_USER_UUID_HEX_TABLE_DELETE_QUERIES = [
    text("DELETE FROM `personal_access_token` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `mcp_servers` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `copilot_chat` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `custom_copilot` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `prompts` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `user_skills` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `widget_metadata` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `user_files` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `api_source_connectors` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `file_connectors` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `single_widget_connectors` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `dashboard_shares` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `dashboards` WHERE user_uuid = UNHEX(:uuid)"),
    text("DELETE FROM `session` WHERE user_uuid = UNHEX(:uuid)"),
]

_DELETE_USER_BY_UUID = text("DELETE FROM `user` WHERE uuid = :uuid")
_DELETE_SESSION_BY_UUID = text("DELETE FROM `session` WHERE uuid = :uuid")
_DELETE_SESSION_BY_UUID_HEX = text("DELETE FROM `session` WHERE uuid = UNHEX(:uuid)")
_DELETE_PERMISSIONS_BY_UUID = text(
    "DELETE FROM `permissions_entity_map` WHERE uuid = :uuid"
)
_DELETE_ENTITY_BY_UUID = text("DELETE FROM `entity` WHERE uuid = :uuid")
_DELETE_ENTITY_TYPE_BY_UUID = text("DELETE FROM `entity_type` WHERE uuid = :uuid")

_PRO_DEVELOPER_UUID = "22222222-2222-2222-2222-222222222222"
_PRO_TRIAL_UUID = "11111111-1111-1111-1111-111111111111"
_PRO_TRIAL_USER_UUID = "11111111-1111-1111-1111-111111111111"
_PRO_DEVELOPER_ENTITY_UUID = "33333333-3333-3333-3333-333333333333"
_PRO_TRIAL_ENTITY_UUID = "44444444-4444-4444-4444-444444444444"
_PRO_ENTITY_TYPE_UUID = "55555555-5555-5555-5555-555555555555"


def _configure_test_settings(
    *,
    mysql_host: str,
    mysql_port: int,
    redis_host: str,
    redis_port: int,
) -> None:
    """Update environment and settings for MySQL/Redis containers."""
    os.environ["DATABASE_TYPE"] = "mysql"
    os.environ["DB_HOST"] = mysql_host
    os.environ["DB_PORT"] = str(mysql_port)
    os.environ["DB_NAME"] = "test_db"
    os.environ["DB_USER"] = "root"
    os.environ["DB_PASSWORD"] = "test_password"

    os.environ["READ_DB_USER"] = "root"
    os.environ["READ_DB_PASSWORD"] = "test_password"
    os.environ["WRITE_DB_USER"] = "root"
    os.environ["WRITE_DB_PASSWORD"] = "test_password"

    os.environ["REDIS_HOST"] = redis_host
    os.environ["REDIS_PORT"] = str(redis_port)
    os.environ["REDIS_DB"] = "0"
    os.environ["REDIS_PASS"] = ""

    settings.DATABASE_TYPE = "mysql"
    settings.DB_HOST = mysql_host
    settings.DB_PORT = mysql_port
    settings.DB_NAME = "test_db"
    settings.READ_DB_USER = "root"
    settings.READ_DB_PASSWORD = "test_password"
    settings.WRITE_DB_USER = "root"
    settings.WRITE_DB_PASSWORD = "test_password"

    settings.REDIS_HOST = redis_host
    settings.REDIS_PORT = redis_port
    settings.REDIS_PASS = ""
    if hasattr(settings, "_RedisSettings__port"):
        setattr(settings, "_RedisSettings__ssl_config", settings.get_redis_ssl_config())
        setattr(
            settings,
            "_RedisSettings__port",
            settings.REDIS_SSL_PORT if settings.ssl_config else settings.REDIS_PORT,
        )
        setattr(
            settings,
            "_RedisSettings__schema",
            "rediss" if settings.ssl_config else "redis",
        )


def _reinitialize_rq_queue() -> None:
    """Recreate the RQ queue connection after Redis settings change."""
    try:
        from rq import worker_registration
        from utilities import rq_results

        if settings.REDIS_CLUSTER_MODE or settings.REDIS_RQ_HASH_TAGS:
            from utilities.rq_cluster import ClusterQueue as Queue

            worker_registration.REDIS_WORKER_KEYS = "rq:{rq}:workers"  # type: ignore
            worker_registration.WORKERS_BY_QUEUE_KEY = "rq:{rq}:workers:%s"  # type: ignore
        else:
            from rq import Queue

        rq_results.redis_conn_bots = settings.get_redis_session("bot")
        rq_results.rq_que = Queue(
            name="payments_queue",
            connection=rq_results.redis_conn_bots,
            failure_ttl=5,
        )
    except Exception:
        # If RQ isn't available, tests will still run but queue-backed features will fail with a timeout.
        pass


async def _set_fk_checks(session: AsyncSession, *, enabled: bool) -> None:
    """Enable or disable MySQL foreign key checks for a session."""
    await session.execute(
        text("SET FOREIGN_KEY_CHECKS = 1" if enabled else "SET FOREIGN_KEY_CHECKS = 0")
    )


async def _execute_cleanup_statements(
    session: AsyncSession,
    statements: Sequence[CleanupStatement],
) -> None:
    """Execute a list of SQL statements, ignoring failures for missing tables."""
    for statement, params in statements:
        try:
            await session.execute(statement, params)
        except Exception:
            pass


async def _cleanup_test_user_records(
    cleanup_session: AsyncSession, user_uuid: str
) -> None:
    """Remove test-user related rows from all relevant tables."""
    await _set_fk_checks(cleanup_session, enabled=False)

    statements: list[CleanupStatement] = [
        *[(query, {"uuid": user_uuid}) for query in _USER_UUID_TABLE_DELETE_QUERIES],
        (_DELETE_SESSION_BY_UUID, {"uuid": user_uuid}),
        (_DELETE_USER_BY_UUID, {"uuid": user_uuid}),
        (_DELETE_PERMISSIONS_BY_UUID, {"uuid": _TEST_PERM_UUID}),
        (_DELETE_ENTITY_BY_UUID, {"uuid": _TEST_ENTITY_UUID}),
        (_DELETE_ENTITY_TYPE_BY_UUID, {"uuid": _TEST_ENTITY_TYPE_UUID}),
    ]
    await _execute_cleanup_statements(cleanup_session, statements)

    await _set_fk_checks(cleanup_session, enabled=True)
    await cleanup_session.commit()


async def _cleanup_user_fixture_records(
    db_session: AsyncSession,
    user_config: UserConfig,
) -> None:
    """Remove fixture-specific rows for a user setup (hex UUID tables + entities)."""
    from api.models.entity_models import Entity, EntityType, PermissionsEntityMap

    await _set_fk_checks(db_session, enabled=False)

    user_uuid_hex = user_config["user_uuid"].replace("-", "")
    session_uuid_hex = user_config["session_uuid"].replace("-", "")

    statements: list[CleanupStatement] = [
        *[
            (query, {"uuid": user_uuid_hex})
            for query in _USER_UUID_HEX_TABLE_DELETE_QUERIES
        ],
        (_DELETE_SESSION_BY_UUID_HEX, {"uuid": session_uuid_hex}),
    ]
    await _execute_cleanup_statements(db_session, statements)

    try:
        await db_session.execute(
            delete(User).where(User.uuid == user_config["user_uuid"])
        )
    except Exception:
        pass
    try:
        await db_session.execute(
            delete(PermissionsEntityMap).where(
                PermissionsEntityMap.uuid == user_config["perm_uuid"]
            )
        )
    except Exception:
        pass
    try:
        await db_session.execute(
            delete(Entity).where(Entity.uuid == user_config["entity_uuid"])
        )
    except Exception:
        pass
    try:
        await db_session.execute(
            delete(EntityType).where(EntityType.uuid == user_config["entity_type_uuid"])
        )
    except Exception:
        pass

    await _set_fk_checks(db_session, enabled=True)
    await db_session.commit()


async def _create_user_fixture(
    db_session: AsyncSession, user_config: UserConfig
) -> User:
    """Create EntityType, Entity, Permissions map, and User for a fixture."""
    from api.models.entity_models import Entity, EntityType, PermissionsEntityMap

    entity_type = EntityType(
        uuid=user_config["entity_type_uuid"],
        entity_type=user_config["entity_type"],
        code=user_config["entity_code"],
        active=True,
        permission_hierarchy=0,
    )
    db_session.add(entity_type)
    await db_session.commit()

    entity = Entity(
        uuid=user_config["entity_uuid"],
        name=user_config["entity_name"],
        entity_type_uuid=entity_type.uuid,
        email=user_config["entity_email"],
    )
    db_session.add(entity)
    await db_session.commit()

    perm_map = PermissionsEntityMap(
        uuid=user_config["perm_uuid"],
        entity_uuid=entity.uuid,
        name=user_config["perm_name"],
    )
    db_session.add(perm_map)
    await db_session.commit()

    user_kwargs = {
        "email": user_config["email"],
        "clean_email": user_config["email"].lower(),
        "password": "hashedpassword",  # noqa: S106
        "confirmed": True,
        "uuid": user_config["user_uuid"],
        "permissions_uuid": perm_map.uuid,
    }

    user = User(**user_kwargs)
    db_session.add(user)
    await db_session.commit()
    return user


async def _create_session_record(
    db_session: AsyncSession,
    user_uuid: str,
    session_uuid: str,
    source: str,
) -> None:
    """Create a session row for auth-based fixtures."""
    from api.models import Session as SessionModel
    from datetime import datetime, timedelta

    exp_aware = datetime.now(UTC) + timedelta(hours=1)
    exp_naive = exp_aware.replace(tzinfo=None)

    new_session = SessionModel(
        uuid=session_uuid,
        user_uuid=user_uuid,
        expiration_date=exp_naive,
        pro=True,
        source=source,
    )
    db_session.add(new_session)
    await db_session.commit()


def _build_service_jwt() -> str:
    """Generate a service JWT for OpenBB auth header checks."""
    import jwt
    from datetime import datetime, timedelta

    payload = {
        "sub": "pro",
        "iss": "openbb-hub",
        "exp": datetime.now(UTC) + timedelta(hours=1),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


@asynccontextmanager
async def _make_auth_client(service_jwt: str, session_token: str):
    """Yield an AsyncClient with standard auth headers set."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as auth_ac:
        auth_ac.headers.update(
            {
                "X-OpenBB-Authorization": f"Bearer {service_jwt}",
                "Authorization": f"Bearer {session_token}",
                "Origin": "http://test",
            }
        )
        yield auth_ac


def _get_or_create_entity_type(session):
    """Ensure the PRO entity type exists for /pro endpoints."""
    from api.models.entity_models import EntityType

    entity_type = (
        session.query(EntityType)
        .filter(EntityType.uuid == _PRO_ENTITY_TYPE_UUID)
        .first()
    )
    if entity_type:
        return entity_type

    entity_type = EntityType(
        uuid=_PRO_ENTITY_TYPE_UUID,
        entity_type="developer",
        code="DEV",
        active=True,
        permission_hierarchy=0,
    )
    session.add(entity_type)
    session.commit()
    return entity_type


def _get_or_create_entity(
    session,
    *,
    uuid: str,
    name: str,
    email: str,
    entity_type_uuid: str,
):
    """Ensure an Entity row exists for a given UUID."""
    from api.models.entity_models import Entity

    entity = session.query(Entity).filter(Entity.uuid == uuid).first()
    if entity:
        return entity

    entity = Entity(
        uuid=uuid,
        name=name,
        entity_type_uuid=entity_type_uuid,
        email=email,
        seats=100,
    )
    session.add(entity)
    session.commit()
    return entity


def _get_or_create_permission(
    session,
    *,
    uuid: str,
    entity_uuid: str,
    name: str,
) -> None:
    """Ensure a PermissionsEntityMap row exists for a given UUID."""
    from api.models.entity_models import PermissionsEntityMap

    existing = (
        session.query(PermissionsEntityMap)
        .filter(PermissionsEntityMap.uuid == uuid)
        .first()
    )
    if existing:
        return

    permission = PermissionsEntityMap(uuid=uuid, entity_uuid=entity_uuid, name=name)
    session.add(permission)
    session.commit()


def _get_or_create_user(session, *, uuid: str, email: str, perm_uuid: str) -> None:
    """Ensure a User row exists for /pro register/login flows."""
    existing_user = session.query(User).filter(User.uuid == uuid).first()
    if existing_user:
        return

    trial_user = User(
        uuid=uuid,
        email=email,
        clean_email=email,
        password="not_a_real_password",  # noqa: S106
        confirmed=True,
        permissions_uuid=perm_uuid,
    )
    session.add(trial_user)
    session.commit()


def _seed_pro_entities() -> None:
    """Seed required entities for /pro endpoints after migrations."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    sync_url = (
        f"mysql+pymysql://{settings.WRITE_DB_USER}:{settings.WRITE_DB_PASSWORD}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    )
    engine = create_engine(sync_url)

    with Session(engine) as session:
        entity_type = _get_or_create_entity_type(session)
        developer_entity = _get_or_create_entity(
            session,
            uuid=_PRO_DEVELOPER_ENTITY_UUID,
            name="Developer Entity",
            email="developer@openbb.co",
            entity_type_uuid=entity_type.uuid,
        )
        trial_entity = _get_or_create_entity(
            session,
            uuid=_PRO_TRIAL_ENTITY_UUID,
            name="Trial Entity",
            email="trial@openbb.co",
            entity_type_uuid=entity_type.uuid,
        )
        _get_or_create_permission(
            session,
            uuid=_PRO_DEVELOPER_UUID,
            entity_uuid=developer_entity.uuid,
            name="developer",
        )
        _get_or_create_permission(
            session,
            uuid=_PRO_TRIAL_UUID,
            entity_uuid=trial_entity.uuid,
            name="trial",
        )
        _get_or_create_user(
            session,
            uuid=_PRO_TRIAL_USER_UUID,
            email="pro_trial_user@openbb.co",
            perm_uuid=_PRO_TRIAL_UUID,
        )

    engine.dispose()


def _get_test_db_url_async() -> str:
    """Build async DB URL using dynamic container ports."""
    return (
        f"mysql+aiomysql://{settings.WRITE_DB_USER}:{settings.WRITE_DB_PASSWORD}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    )


def _get_test_db_url_sync() -> str:
    """Build sync DB URL using dynamic container ports."""
    return (
        f"mysql+pymysql://{settings.WRITE_DB_USER}:{settings.WRITE_DB_PASSWORD}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    )


__all__ = [
    "_configure_test_settings",
    "_reinitialize_rq_queue",
    "_cleanup_test_user_records",
    "_cleanup_user_fixture_records",
    "_create_user_fixture",
    "_create_session_record",
    "_build_service_jwt",
    "_make_auth_client",
    "_seed_pro_entities",
    "_get_test_db_url_async",
    "_get_test_db_url_sync",
    "_AUTH_USER",
    "_ADMIN_USER",
    "_SECOND_USER",
    "_TEST_USER_UUID",
    "CleanupStatement",
    "UserConfig",
    "logger",
    "settings",
    "app",
]
