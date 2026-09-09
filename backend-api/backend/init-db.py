import asyncio
import sys

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from utilities.config import settings

MAX_RETRIES = 10

DB_TYPE = "MySQL" if settings.DATABASE_TYPE == "mysql" else "PostgreSQL"


def get_connection():
    """Establish a database connection based on the configured database type."""
    return settings.get_write_session()


async def main():
    if settings.DATABASE_TYPE == "sqlite":
        # SQLite is file-based: there is no server to wait for and no
        # CREATE DATABASE step, and SELECT VERSION() is not supported.
        print("SQLite database is file-based; skipping initialization.")  # noqa
        return

    attempts = 0

    async with get_connection().session() as session:
        while attempts < MAX_RETRIES:
            try:
                cursor = await session.execute(text("SELECT VERSION();"))
                version = cursor.fetchone()
                print(f"Connected to {DB_TYPE} Server version: {version[0]}")  # noqa
                break
            except OperationalError as e:
                print(f"Database not ready, waiting 5 seconds... ({e})")  # noqa
                attempts += 1
                if attempts >= MAX_RETRIES:
                    print(  # noqa
                        "Failed to connect to the database after multiple attempts."
                    )
                    sys.exit(1)

                await asyncio.sleep(5)

        try:
            # create db if not exists
            if settings.DATABASE_TYPE == "mysql":
                await session.execute(
                    text(
                        f"CREATE DATABASE IF NOT EXISTS `{settings.DB_NAME}` "
                        "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
                    )
                )
            elif settings.DATABASE_TYPE == "postgresql":
                cursor = await session.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :db_name;"),
                    {"db_name": settings.DB_NAME},
                )
                exists = cursor.fetchone()
                if not exists:
                    await session.execute(
                        text(
                            f"CREATE DATABASE {settings.DB_NAME} "
                            "WITH ENCODING 'UTF8' "
                            "LC_COLLATE='en_US.utf8' "
                            "LC_CTYPE='en_US.utf8' "
                            "TEMPLATE=template1;"
                        )
                    )
            # commit changes

            await session.commit()
            print(f"Database {settings.DB_NAME} is ready.")  # noqa
        except Exception as e:
            print(f"Database connection failed: {e}")  # noqa
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
