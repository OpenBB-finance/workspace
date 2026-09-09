"""Configurate read and write access and create a session"""

import json
from contextlib import suppress
from time import time

from sqlalchemy import Connection, Engine, MetaData, event
from sqlalchemy.engine.interfaces import DBAPICursor, _DBAPISingleExecuteParams
from sqlalchemy.orm import DeclarativeMeta, declarative_base

from utilities.config import settings

QUERY_THRESHOLD_MS = 5000  # 5 seconds

AsyncReadSessionLocal = settings.get_read_session()
AsyncWriteSessionLocal = settings.get_write_session()

Base: DeclarativeMeta = declarative_base(
    metadata=MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        }
    )
)

# SQLite: enable WAL mode for better concurrency and enforce foreign keys
if settings.DATABASE_TYPE == "sqlite":

    @event.listens_for(Engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        # Wait (and retry) up to 5s for the single write lock instead of failing immediately
        # with "database is locked" when connections/processes contend for a write.
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


async def aget_read_db():
    "Creates an async session with read only access"
    async with AsyncReadSessionLocal.session() as session:
        yield session


async def aget_write_db():
    "Creates an async session with read and write access"
    async with AsyncWriteSessionLocal.session() as session:
        yield session


@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn: Connection, *args):
    conn.info.setdefault("start_time", []).append(time())


@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(  # noqa
    conn: Connection,
    cursor: DBAPICursor,
    query: str,
    parameters: _DBAPISingleExecuteParams,
    *args,
):
    total = round((time() - conn.info["start_time"].pop(-1)) * 1000, 2)

    if total < QUERY_THRESHOLD_MS:  # 5 seconds
        return

    with suppress(Exception):
        from api.helpers import add_log  # noqa

        # make sure parameters are not too large
        if isinstance(parameters, list | tuple):
            parameters = [str(param)[:100] for param in parameters]
        elif isinstance(parameters, dict):
            parameters = {k: str(v)[:100] for k, v in parameters.items()}

        error_dict = {
            "total_ms": total,
            "query": query[:1000] + "...",
            "parameters": f"{parameters}",
        }
        add_log("query_threshold", json.dumps(error_dict), 400, "query")
