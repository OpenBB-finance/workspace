"""Docker container fixtures (MySQL/Redis)."""

import pytest

from .base import _configure_test_settings, _reinitialize_rq_queue, logger
from .utils import skip


@pytest.fixture(scope="session")
def db_containers():
    """Spin up MySQL and Redis containers for the test session."""
    from docker.errors import DockerException
    from testcontainers.community.mysql import MySqlContainer
    from testcontainers.community.redis import RedisContainer

    try:
        mysql_container = MySqlContainer(
            image="mysql:8.0",
            username="root",
            root_password="test_password",  # noqa: S106
            password="test_password",  # noqa: S106
            dbname="test_db",
        ).with_env("MYSQL_ROOT_HOST", "%")
        redis_container = RedisContainer("redis:alpine")
    except DockerException as exc:
        skip(f"Unable to initialize Docker client: {exc}")

    with mysql_container as mysql, redis_container as redis:
        mysql_host = mysql.get_container_host_ip()
        mysql_port = int(mysql.get_exposed_port(3306))
        if mysql_host == "localhost":
            mysql_host = "127.0.0.1"

        redis_host = redis.get_container_host_ip()
        redis_port = int(redis.get_exposed_port(6379))
        if redis_host == "localhost":
            redis_host = "127.0.0.1"

        _configure_test_settings(
            mysql_host=mysql_host,
            mysql_port=mysql_port,
            redis_host=redis_host,
            redis_port=redis_port,
        )
        _reinitialize_rq_queue()

        import time
        import pymysql

        logger.info("Waiting for MySQL at %s:%s...", mysql_host, mysql_port)
        for attempt in range(60):
            try:
                conn = pymysql.connect(
                    host=mysql_host,
                    port=mysql_port,
                    user="root",
                    password="test_password",  # noqa: S106
                    connect_timeout=5,
                )
                with conn.cursor() as cursor:
                    cursor.execute("CREATE DATABASE IF NOT EXISTS test_db")
                conn.close()
                logger.info("MySQL is ready.")
                break
            except Exception as exc:
                if attempt < 59:
                    if attempt % 10 == 0:
                        logger.info("Attempt %s/60: %s", attempt + 1, exc)
                    time.sleep(1)
                else:
                    logger.error("MySQL failed after 60 attempts. Last error: %s", exc)
                    raise RuntimeError(f"MySQL failed to become ready: {exc}")

        logger.info("Testcontainers started.")
        logger.info("MySQL: %s:%s", mysql_host, mysql_port)
        logger.info("Redis: %s:%s", redis_host, redis_port)

        yield {
            "mysql": mysql,
            "redis": redis,
            "mysql_host": mysql_host,
            "mysql_port": mysql_port,
            "redis_host": redis_host,
            "redis_port": redis_port,
        }
