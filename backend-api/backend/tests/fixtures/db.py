"""Database session fixtures."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .base import _cleanup_test_user_records, _get_test_db_url_async, _TEST_USER_UUID


@pytest.fixture(scope="function")
async def db_session(apply_migrations):
    """Create a fresh async session per test and clean up test data."""
    test_db_url = _get_test_db_url_async()
    engine = create_async_engine(test_db_url, echo=False, pool_pre_ping=True)

    SessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=True,
    )

    async with SessionLocal() as cleanup_session:
        await _cleanup_test_user_records(cleanup_session, _TEST_USER_UUID)

    async with SessionLocal() as session:
        yield session

    async with SessionLocal() as cleanup_session:
        await _cleanup_test_user_records(cleanup_session, _TEST_USER_UUID)

    await engine.dispose()


class TestAsyncSessionLocal:
    """Async session factory wrapper used to patch database module globals."""

    def __init__(self, session_maker):
        self._session_maker = session_maker

    def session(self):
        return self._session_maker()
