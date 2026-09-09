"""Unit tests for dialect-specific IntegrityError handling in api.helpers.

Regression for lite/SQLite deployments: SQLite reports duplicate keys as
"UNIQUE constraint failed: <table>.<column>", which handle_duplicate_pk
previously did not recognize, turning every insert-then-update upsert
(e.g. renaming a data connector) into a 400 "Unknown database error occurred".
"""

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from api.helpers import handle_duplicate_pk


def _integrity_error(orig_message: str) -> IntegrityError:
    return IntegrityError("INSERT INTO api_source ...", {}, Exception(orig_message))


class TestHandleDuplicatePk:
    def test_sqlite_unique_constraint_is_recognized(self):
        """SQLite duplicate PK message must not raise (upsert falls through to UPDATE)."""
        exc = _integrity_error("UNIQUE constraint failed: api_source.uuid")
        handle_duplicate_pk(exc)

    def test_mysql_duplicate_entry_is_recognized(self):
        exc = _integrity_error(
            "(1062, \"Duplicate entry 'abc' for key 'PRIMARY'\")"
        )
        handle_duplicate_pk(exc)

    def test_postgres_duplicate_key_is_recognized(self):
        exc = _integrity_error(
            'duplicate key value violates unique constraint "api_source_pkey"'
        )
        handle_duplicate_pk(exc)

    def test_unrelated_integrity_error_raises_400(self):
        exc = _integrity_error("FOREIGN KEY constraint failed")
        with pytest.raises(HTTPException) as exc_info:
            handle_duplicate_pk(exc)
        assert exc_info.value.status_code == 400
