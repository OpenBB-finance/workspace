"""Test alembic migrations against all supported database dialects.

Spins up testcontainers for MySQL and PostgreSQL (plus Redis for each),
uses a temp file for SQLite, runs ``alembic upgrade head`` via subprocess,
and then introspects every table to verify there are no type-mapping errors.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import time

import pymysql
import pytest
import sqlalchemy as sa

# ---------------------------------------------------------------------------
# Markers / skips
# ---------------------------------------------------------------------------

_DOCKER_AVAILABLE = True
try:
    import docker

    docker.from_env().ping()
except Exception:
    _DOCKER_AVAILABLE = False

needs_docker = pytest.mark.skipif(not _DOCKER_AVAILABLE, reason="Docker not available")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Tables seeded by 0002_seed_data
_SEED_TABLES = {"tier": 2, "default_tier": 2, "data_bundle": 3}

# Minimum expected tables (model-created tables)
_MIN_TABLES = 40


def _base_env() -> dict[str, str]:
    """Return minimal env vars shared across all dialects."""
    return {
        "MODE": "test",
        "JWT_SECRET": "testsecretfortesting12345678",
        "OPENBB_AES_KEY": "sixteenbytekey!!",
        "PROURL": "http://localhost:3000",
        "SELFURL": "http://localhost:8000",
        "DISABLE_CORS": "true",
        "HUBSPOT": "0",
        "PROMETHEUS": "0",
        "WORKERS": "1",
        "STORAGE_PROVIDER": "aws",
        "S3_ACCESS_KEY": "test",
        "S3_SECRET_KEY": "test",
        "S3_BUCKET_NAME": "test",
        "S3_FILE_BUCKET": "test",
        "S3_ENDPOINT_URL": "http://localhost",
        "FRONTENDURL": "http://localhost",
        "OPENBB_FRONTEND_USER_AGENT": "test",
        "OPENBB_AI_USER_AGENT": "test",
        "OPENBB_GEO_KEY": "test",
        "OPENBB_CHARGEBEE_SITE_KEY": "test",
        "OPENBB_CHARGEBEE_API_KEY": "test",
        "OKTA_DOMAIN": "test.okta.com",
        "SUPPRESSED_API_ROUTERS": '["bot", "terminal", "sdk", "run_tasks", "testing", "metrics"]',
        "SUPPRESSED_API_ROUTES": "[]",
        "OPENBB_AUTH_TOKEN": "test-token",
    }


def _run_alembic_upgrade(env_vars: dict[str, str]):
    """Run alembic upgrade head as a subprocess for full isolation."""
    env = {**os.environ, **env_vars}
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"alembic upgrade head failed (rc={result.returncode}):\n"
            f"STDOUT:\n{result.stdout}\n"
            f"STDERR:\n{result.stderr}"
        )
    return result


def _alembic_head() -> str:
    """Return the head revision of the migration chain."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(os.path.join(_BACKEND_DIR, "alembic.ini"))
    return ScriptDirectory.from_config(config).get_current_head()


def _inspect_and_verify(engine: sa.engine.Engine, dialect_name: str):
    """Introspect all tables and run a SELECT on each to verify types work."""
    inspector = sa.inspect(engine)
    tables = inspector.get_table_names()

    # Verify minimum table count
    assert (
        len(tables) >= _MIN_TABLES
    ), f"{dialect_name}: Expected at least {_MIN_TABLES} tables, got {len(tables)}: {sorted(tables)}"

    errors: list[str] = []

    with engine.connect() as conn:
        for table_name in tables:
            if table_name == "alembic_version":
                continue

            # Verify columns can be reflected (catches type-mapping issues)
            try:
                columns = inspector.get_columns(table_name)
                assert (
                    len(columns) > 0
                ), f"{dialect_name}: Table {table_name} has no columns"
            except Exception as exc:
                errors.append(
                    f"{dialect_name}: Failed to reflect columns for {table_name}: {exc}"
                )
                continue

            # Run a SELECT to verify the types are actually usable at runtime
            try:
                result = conn.execute(
                    sa.text(f"SELECT * FROM {_quote(table_name, dialect_name)} LIMIT 1")
                )
                result.fetchall()
            except Exception as exc:
                errors.append(f"{dialect_name}: SELECT failed on {table_name}: {exc}")

        # Verify seed data
        for table_name, expected_count in _SEED_TABLES.items():
            try:
                count = conn.execute(
                    sa.text(f"SELECT COUNT(*) FROM {_quote(table_name, dialect_name)}")
                ).scalar()
                assert (
                    count == expected_count
                ), f"{dialect_name}: {table_name} expected {expected_count} rows, got {count}"
            except Exception as exc:
                errors.append(
                    f"{dialect_name}: Seed check failed on {table_name}: {exc}"
                )

        # Verify alembic version is at head
        expected_head = _alembic_head()
        version = conn.execute(
            sa.text("SELECT version_num FROM alembic_version")
        ).scalar()
        assert (
            version == expected_head
        ), f"{dialect_name}: Expected alembic version {expected_head}, got {version}"

    assert not errors, f"{dialect_name} type-mapping errors:\n" + "\n".join(errors)


def _quote(table_name: str, dialect_name: str) -> str:
    """Quote a table name appropriately for the dialect."""
    if dialect_name == "mysql":
        return f"`{table_name}`"
    return f'"{table_name}"'


def _wait_for_mysql(host: str, port: int, timeout: int = 60):
    """Wait for MySQL to accept connections."""
    for attempt in range(timeout):
        try:
            conn = pymysql.connect(
                host=host,
                port=port,
                user="root",
                password="test_password",  # noqa: S106
                connect_timeout=3,
            )
            conn.close()
            return
        except Exception:
            if attempt < timeout - 1:
                time.sleep(1)
            else:
                raise RuntimeError(f"MySQL not ready after {timeout}s at {host}:{port}")


def _wait_for_postgres(host: str, port: int, timeout: int = 60):
    """Wait for PostgreSQL to accept connections."""
    import psycopg2

    for attempt in range(timeout):
        try:
            conn = psycopg2.connect(
                host=host,
                port=port,
                user="root",
                password="test_password",  # noqa: S106
                dbname="test_db",
                connect_timeout=3,
            )
            conn.close()
            return
        except Exception:
            if attempt < timeout - 1:
                time.sleep(1)
            else:
                raise RuntimeError(
                    f"PostgreSQL not ready after {timeout}s at {host}:{port}"
                )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@needs_docker
class TestMySQLMigrations:
    """Test alembic upgrade head on a fresh MySQL database."""

    def test_mysql_upgrade_head(self):
        from testcontainers.community.mysql import MySqlContainer
        from testcontainers.community.redis import RedisContainer

        with (
            MySqlContainer(
                image="mysql:8.4",
                username="root",
                root_password="test_password",
                password="test_password",
                dbname="test_db",
            ).with_env("MYSQL_ROOT_HOST", "%") as mysql,
            RedisContainer("redis:alpine") as redis,
        ):
            mysql_host = mysql.get_container_host_ip()
            mysql_port = int(mysql.get_exposed_port(3306))
            if mysql_host == "localhost":
                mysql_host = "127.0.0.1"

            redis_host = redis.get_container_host_ip()
            redis_port = int(redis.get_exposed_port(6379))
            if redis_host == "localhost":
                redis_host = "127.0.0.1"

            _wait_for_mysql(mysql_host, mysql_port)

            env_vars = {
                **_base_env(),
                "DATABASE_TYPE": "mysql",
                "DB_HOST": mysql_host,
                "DB_PORT": str(mysql_port),
                "DB_NAME": "test_db",
                "READ_DB_USER": "root",
                "READ_DB_PASSWORD": "test_password",
                "WRITE_DB_USER": "root",
                "WRITE_DB_PASSWORD": "test_password",
                "REDIS_HOST": redis_host,
                "REDIS_PORT": str(redis_port),
                "REDIS_PASS": "",
            }

            result = _run_alembic_upgrade(env_vars)
            assert (
                "Running upgrade" in result.stderr
            ), f"No migrations ran:\n{result.stderr}"

            url = (
                f"mysql+pymysql://root:test_password@{mysql_host}:{mysql_port}/test_db"
                "?charset=utf8mb4"
            )
            engine = sa.create_engine(url)
            try:
                _inspect_and_verify(engine, "mysql")
            finally:
                engine.dispose()


@needs_docker
class TestPostgreSQLMigrations:
    """Test alembic upgrade head on a fresh PostgreSQL database."""

    def test_postgres_upgrade_head(self):
        from testcontainers.community.postgres import PostgresContainer
        from testcontainers.community.redis import RedisContainer

        with (
            PostgresContainer(
                image="postgres:16",
                username="root",
                password="test_password",
                dbname="test_db",
            ) as pg,
            RedisContainer("redis:alpine") as redis,
        ):
            pg_host = pg.get_container_host_ip()
            pg_port = int(pg.get_exposed_port(5432))
            if pg_host == "localhost":
                pg_host = "127.0.0.1"

            redis_host = redis.get_container_host_ip()
            redis_port = int(redis.get_exposed_port(6379))
            if redis_host == "localhost":
                redis_host = "127.0.0.1"

            _wait_for_postgres(pg_host, pg_port)

            env_vars = {
                **_base_env(),
                "DATABASE_TYPE": "postgresql",
                "DB_HOST": pg_host,
                "DB_PORT": str(pg_port),
                "DB_NAME": "test_db",
                "READ_DB_USER": "root",
                "READ_DB_PASSWORD": "test_password",
                "WRITE_DB_USER": "root",
                "WRITE_DB_PASSWORD": "test_password",
                "REDIS_HOST": redis_host,
                "REDIS_PORT": str(redis_port),
                "REDIS_PASS": "",
            }

            result = _run_alembic_upgrade(env_vars)
            assert (
                "Running upgrade" in result.stderr
            ), f"No migrations ran:\n{result.stderr}"

            url = (
                f"postgresql+psycopg2://root:test_password@{pg_host}:{pg_port}/test_db"
            )
            engine = sa.create_engine(url)
            try:
                _inspect_and_verify(engine, "postgresql")
            finally:
                engine.dispose()


class TestSQLiteMigrations:
    """Test alembic upgrade head on a fresh SQLite database."""

    def test_sqlite_upgrade_head(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test.db")

            # SQLite needs Redis env vars set for Settings validation,
            # even though it won't use the Redis lock in alembic.
            env_vars = {
                **_base_env(),
                "DATABASE_TYPE": "sqlite",
                "DB_PATH": db_path,
                "REDIS_HOST": "127.0.0.1",
                "REDIS_PORT": "6379",
                "REDIS_PASS": "",
            }

            result = _run_alembic_upgrade(env_vars)
            assert (
                "Running upgrade" in result.stderr
            ), f"No migrations ran:\n{result.stderr}"

            url = f"sqlite:///{db_path}"
            engine = sa.create_engine(url)
            try:
                _inspect_and_verify(engine, "sqlite")
            finally:
                engine.dispose()
