"""HTTP client fixtures for backend tests."""

from contextlib import ExitStack
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .base import (
    _ADMIN_USER,
    _AUTH_USER,
    _SECOND_USER,
    _build_service_jwt,
    _cleanup_user_fixture_records,
    _create_session_record,
    _create_user_fixture,
    _get_test_db_url_async,
    _get_test_db_url_sync,
    _make_auth_client,
    app,
    settings,
)
from .db import TestAsyncSessionLocal


@pytest.fixture(scope="function")
async def client(db_session, apply_migrations):
    """Unauthenticated test client with DB overrides."""
    from api.database import aget_read_db, aget_write_db
    from sqlalchemy import create_engine

    test_db_url = _get_test_db_url_async()
    test_engine = create_async_engine(test_db_url, echo=False, pool_pre_ping=True)

    TestSessionLocal = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=True,
    )

    sync_test_db_url = _get_test_db_url_sync()
    sync_test_engine = create_engine(sync_test_db_url, echo=False, pool_pre_ping=True)

    test_async_read = TestAsyncSessionLocal(TestSessionLocal)
    test_async_write = TestAsyncSessionLocal(TestSessionLocal)

    async def override_async_get_db():
        yield db_session

    app.dependency_overrides[aget_read_db] = override_async_get_db
    app.dependency_overrides[aget_write_db] = override_async_get_db

    with ExitStack() as stack:
        stack.enter_context(
            patch("api.database.AsyncReadSessionLocal", test_async_read)
        )
        stack.enter_context(
            patch("api.database.AsyncWriteSessionLocal", test_async_write)
        )
        stack.enter_context(
            patch("api.auth_helpers.database.AsyncReadSessionLocal", test_async_read)
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    app.dependency_overrides.clear()
    await test_engine.dispose()
    sync_test_engine.dispose()


@pytest.fixture(scope="function")
async def pro_client(client):
    """Client with service JWT header for /pro endpoints only."""
    import jwt

    payload = {
        "sub": "pro",
        "iss": "openbb-hub",
        "exp": datetime.now(UTC) + timedelta(hours=1),
    }

    service_jwt = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

    client.headers.update(
        {
            "X-OpenBB-Authorization": f"Bearer {service_jwt}",
            "Origin": "http://test",
        }
    )

    yield client


@pytest.fixture(scope="function")
async def auth_client(client, db_session):
    """Authenticated client with a standard test user and session."""
    await _cleanup_user_fixture_records(db_session, _AUTH_USER)
    await _create_user_fixture(db_session, _AUTH_USER)
    await _create_session_record(
        db_session,
        _AUTH_USER["user_uuid"],
        _AUTH_USER["session_uuid"],
        _AUTH_USER["session_source"],
    )

    service_jwt = _build_service_jwt()
    async with _make_auth_client(service_jwt, _AUTH_USER["session_uuid"]) as auth_ac:
        yield auth_ac


@pytest.fixture(scope="function")
async def admin_client(client, db_session):
    """Authenticated admin client for admin endpoints."""
    await _cleanup_user_fixture_records(db_session, _ADMIN_USER)
    await _create_user_fixture(db_session, _ADMIN_USER)
    await _create_session_record(
        db_session,
        _ADMIN_USER["user_uuid"],
        _ADMIN_USER["session_uuid"],
        _ADMIN_USER["session_source"],
    )

    service_jwt = _build_service_jwt()
    async with _make_auth_client(service_jwt, _ADMIN_USER["session_uuid"]) as admin_ac:
        yield admin_ac


@pytest.fixture(scope="function")
async def second_user_client(client, db_session):
    """Second authenticated user client for cross-user tests."""
    await _cleanup_user_fixture_records(db_session, _SECOND_USER)
    await _create_user_fixture(db_session, _SECOND_USER)
    await _create_session_record(
        db_session,
        _SECOND_USER["user_uuid"],
        _SECOND_USER["session_uuid"],
        _SECOND_USER["session_source"],
    )

    service_jwt = _build_service_jwt()
    async with _make_auth_client(
        service_jwt, _SECOND_USER["session_uuid"]
    ) as second_ac:
        yield second_ac
