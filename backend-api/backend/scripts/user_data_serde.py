"""JSON codec for user data rows, shared by the export and import commands.

Rows are read and written through the ORM, so SQLAlchemy's ``TypeDecorator``
layer has already run by the time this module sees a value: gzip blobs arrive
as dicts, ``EncryptedType`` columns arrive as *plaintext* dicts, ``UUIDType``
arrives as ``UUID``. This module's only job is turning those Python values into
JSON and back.

Decoding is driven by the live column types rather than a hand-written table, so
a column that changes type cannot silently start round-tripping wrong.

Two behaviours worth knowing about:

* ``EncryptedType`` values are written to the archive as plaintext. Hub and Lite
  have different ``OPENBB_AES_KEY`` values, so ciphertext would be undecryptable
  at the destination. The ORM re-encrypts under the target's key on insert.
* ``PasswordType`` is never encoded. Its ``process_bind_param`` bcrypt hashes on
  every write, so a hash round-tripped through the ORM would be double-hashed
  and the account would become unloggable.
"""

import base64
import json
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import (
    Column,
    DateTime,
    Enum as SAEnum,
)
from sqlalchemy_utils import ScalarListType, UUIDType

from api.models.model_helpers import (
    DATETIME,
    AwareDateTime,
    BasePydanticType,
    PasswordType,
)
from scripts.user_data_scope import TableSpec, redacted_columns

# Bumped when the on-disk encoding changes in a way older archives cannot satisfy.
SERDE_VERSION = 1

# Marker for values with no native JSON representation.
_BYTES_KEY = "__bytes__"


class SerdeError(Exception):
    """Raised when a value cannot be encoded or decoded."""


# --------------------------------------------------------------------------- #
# Encoding: Python -> JSON-safe
# --------------------------------------------------------------------------- #
# Scalar encoders, tried in order. Enum comes first: a `class X(str, Enum)`
# would otherwise match the plain-scalar check and encode as the member rather
# than its value. datetime.isoformat preserves naive-vs-aware, which matters
# because DATETIME(fsp=6) columns are naive and AwareDateTime ones are UTC.
_SCALAR_ENCODERS: tuple[tuple[type, Any], ...] = (
    (Enum, lambda v: v.value),
    (UUID, str),
    (datetime, lambda v: v.isoformat()),
    (BaseModel, lambda v: v.model_dump(mode="json")),
    (bytes, lambda v: {_BYTES_KEY: base64.b64encode(v).decode("ascii")}),
)


def encode_value(value: Any) -> Any:
    """Convert a value returned by the ORM into something ``json.dumps`` accepts."""
    for kind, encode in _SCALAR_ENCODERS:
        if isinstance(value, kind):
            return encode(value)

    if value is None or isinstance(value, str | int | float | bool):
        return value
    if isinstance(value, dict):
        return {str(k): encode_value(v) for k, v in value.items()}
    if isinstance(value, list | tuple | set):
        return [encode_value(v) for v in value]

    raise SerdeError(f"Cannot encode value of type {type(value).__name__}: {value!r}")


def is_exportable(column: Column) -> bool:
    """Whether a column's value can be carried to another database.

    Generated columns are excluded: ``copilot_chat.search_vector`` and
    ``copilot_messages.search_vector`` are Postgres ``Computed`` full-text
    indexes that the database maintains itself. They do not exist on SQLite at
    all, and writing one is an error even where it does.
    """
    return column.computed is None


def encode_row(spec: TableSpec, obj: Any) -> dict[str, Any]:
    """Encode one ORM instance into a JSON-safe dict, dropping redacted columns."""
    dropped = set(redacted_columns(spec))
    return {
        column.key: encode_value(getattr(obj, column.key))
        for column in spec.model.__table__.columns
        if column.key not in dropped and is_exportable(column)
    }


# --------------------------------------------------------------------------- #
# Decoding: JSON-safe -> Python, driven by the column's declared type
# --------------------------------------------------------------------------- #
def _decode_for_column(column: Column, value: Any) -> Any:
    """Decode one value using its column type."""
    if value is None:
        return None
    return _decode_typed(column.type, value)


def _decode_typed(col_type: Any, value: Any) -> Any:
    """Dispatch on the declared column type.

    Columns whose ``TypeDecorator`` accepts plain Python containers -- the gzip
    types, ``JSONType``, ``EncryptedType`` -- fall through to ``_decode_plain``;
    the ORM re-encodes them on write.
    """
    if isinstance(col_type, UUIDType):
        return value if isinstance(value, UUID) else UUID(str(value))

    if isinstance(col_type, AwareDateTime | DATETIME | DateTime):
        return value if isinstance(value, datetime) else datetime.fromisoformat(value)

    if isinstance(col_type, BasePydanticType):
        # process_bind_param rejects anything that is not a model instance.
        return col_type.model(**value) if isinstance(value, dict) else value

    if isinstance(col_type, ScalarListType):
        return _decode_scalar_list(col_type, value)

    if isinstance(col_type, SAEnum) and col_type.enum_class is not None:
        return _decode_enum(col_type.enum_class, value)

    return _decode_plain(value)


def _decode_enum(enum_class: type[Enum], value: Any) -> Any:
    """encode_value wrote the member's ``.value``, so look it up the same way.

    SQLAlchemy persists Enum columns by ``.name``, and going through the member
    keeps that correct even for enums whose name and value differ.
    """
    if isinstance(value, enum_class):
        return value
    return enum_class(value)


def _decode_scalar_list(col_type: ScalarListType, value: Any) -> Any:
    """ScalarListType round-trips via str(), so UUID members must be rebuilt."""
    if not isinstance(value, list):
        return value
    if col_type.coerce_func is UUID:
        return [v if isinstance(v, UUID) else UUID(str(v)) for v in value]
    return value


def _decode_plain(value: Any) -> Any:
    """Recursively restore byte markers inside otherwise plain JSON values."""
    if isinstance(value, dict):
        if set(value) == {_BYTES_KEY}:
            return base64.b64decode(value[_BYTES_KEY])
        return {k: _decode_plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_decode_plain(v) for v in value]
    return value


def decode_row(spec: TableSpec, payload: dict[str, Any]) -> dict[str, Any]:
    """Decode an archive row into kwargs for constructing ``spec.model``.

    Unknown keys are dropped rather than raising: an archive written by an older
    build may carry columns this schema no longer has, and losing a stale column
    is better than refusing the whole account.
    """
    columns = spec.model.__table__.columns
    dropped = set(redacted_columns(spec))

    decoded: dict[str, Any] = {}
    for key, raw in payload.items():
        if key in dropped or key not in columns:
            continue
        if not is_exportable(columns[key]):
            continue
        try:
            decoded[key] = _decode_for_column(columns[key], raw)
        except (ValueError, TypeError) as exc:
            raise SerdeError(
                f"Could not decode {spec.table}.{key} from {raw!r}: {exc}"
            ) from exc
    return decoded


def unknown_columns(spec: TableSpec, payload: dict[str, Any]) -> set[str]:
    """Archive keys this schema has no column for -- surfaced as import warnings."""
    return set(payload) - set(spec.model.__table__.columns.keys())


# --------------------------------------------------------------------------- #
# JSONL helpers
# --------------------------------------------------------------------------- #
def dumps_line(payload: dict[str, Any]) -> str:
    """One JSONL record. Keys are sorted so archives diff cleanly."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def loads_line(line: str) -> dict[str, Any]:
    payload = json.loads(line)
    if not isinstance(payload, dict):
        raise SerdeError(f"Expected a JSON object per line, got {type(payload).__name__}")
    return payload


def assert_password_never_encoded(spec: TableSpec) -> None:
    """Guard against a schema change quietly exposing a password column."""
    for column in spec.model.__table__.columns:
        if isinstance(column.type, PasswordType) and column.key not in set(redacted_columns(spec)):
            raise SerdeError(
                f"{spec.table}.{column.key} is a PasswordType but is not "
                "redacted. Exporting it would double-hash on import and "
                "lock the account out."
            )
