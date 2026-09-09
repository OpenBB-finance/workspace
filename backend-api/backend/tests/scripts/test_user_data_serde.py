"""Round-trip tests for the archive codec.

No database: these build transient ORM instances and push them through
encode -> JSON text -> decode, which is exactly the path a real export/import
takes. What matters is that the value the importer reconstructs is
indistinguishable from the one the exporter read.
"""

from datetime import UTC, datetime, timedelta, timezone
from uuid import uuid4

import pytest

from api import models, schemas
from scripts import user_data_scope as scope
from scripts import user_data_serde as serde


def _round_trip(spec: scope.TableSpec, obj) -> dict:
    """encode -> serialise -> parse -> decode, the full archive path."""
    encoded = serde.encode_row(spec, obj)
    reparsed = serde.loads_line(serde.dumps_line(encoded))
    return serde.decode_row(spec, reparsed)


# --------------------------------------------------------------------------- #
# Scalars
# --------------------------------------------------------------------------- #
def test_uuid_round_trips_as_uuid():
    spec = scope.spec_by_table("copilot_chat")
    user_uuid, row_uuid = uuid4(), uuid4()
    chat = models.CopilotChat(uuid=row_uuid, user_uuid=user_uuid, content={"m": []})

    result = _round_trip(spec, chat)

    assert result["uuid"] == row_uuid
    assert result["user_uuid"] == user_uuid
    assert isinstance(result["uuid"], type(row_uuid))


def test_aware_datetime_keeps_its_timezone():
    spec = scope.spec_by_table("copilot_chat")
    created = datetime(2026, 3, 14, 9, 26, 53, tzinfo=UTC)
    chat = models.CopilotChat(uuid=uuid4(), user_uuid=uuid4(), created_date=created)

    result = _round_trip(spec, chat)

    assert result["created_date"] == created
    assert result["created_date"].tzinfo is not None


def test_non_utc_offset_survives():
    spec = scope.spec_by_table("copilot_chat")
    created = datetime(2026, 3, 14, 9, 26, 53, tzinfo=timezone(timedelta(hours=-5)))
    chat = models.CopilotChat(uuid=uuid4(), user_uuid=uuid4(), created_date=created)

    assert _round_trip(spec, chat)["created_date"] == created


def test_dashboard_save_keeps_microseconds_and_stays_naive():
    """dashboard_save uses DATETIME(fsp=6), not AwareDateTime -- naive, sub-second.

    Version ordering depends on those microseconds, so truncation would reorder
    a user's dashboard history.
    """
    spec = scope.spec_by_table("dashboard_save")
    created = datetime(2026, 3, 14, 9, 26, 53, 589793)
    save = models.DashboardSave(
        uuid=uuid4(), dashboard_item_uuid=uuid4(), created_date=created
    )

    result = _round_trip(spec, save)

    assert result["created_date"] == created
    assert result["created_date"].microsecond == 589793
    assert result["created_date"].tzinfo is None


# --------------------------------------------------------------------------- #
# Container columns
# --------------------------------------------------------------------------- #
def test_gzip_json_content_round_trips_structurally():
    """dashboard_item.content is the blob holding widgets and layout."""
    spec = scope.spec_by_table("dashboard_item")
    content = {
        "widgets": [{"id": str(uuid4()), "x": 0, "y": 4, "params": {"ticker": "AAPL"}}],
        "name": "My dashboard",
        "nested": {"deep": [1, 2.5, True, None, "ünïcøde"]},
    }
    item = models.DashboardItem(
        uuid=uuid4(), owner_uuid=uuid4(), creator_uuid=uuid4(), content=content
    )

    assert _round_trip(spec, item)["content"] == content


def test_encrypted_columns_travel_as_plaintext():
    """Hub and Lite have different AES keys, so ciphertext would not decrypt."""
    spec = scope.spec_by_table("custom_copilot")
    headers = {"Authorization": "Bearer sk-secret-value"}
    copilots = [{"name": "my copilot", "id": "abc"}]
    copilot = models.CustomCopilot(
        uuid=uuid4(),
        user_uuid=uuid4(),
        url="https://example.com",
        headers=headers,
        copilots=copilots,
    )

    encoded = serde.encode_row(spec, copilot)
    assert encoded["headers"] == headers, "must be readable plaintext, not ciphertext"

    result = _round_trip(spec, copilot)
    assert result["headers"] == headers
    assert result["copilots"] == copilots


def test_gzip_string_content_round_trips():
    spec = scope.spec_by_table("user_skills")
    body = "# My skill\n\nDo the thing.\n\n- ünïcøde\n- \ttabs"
    skill = models.UserSkills(
        uuid=uuid4(), user_uuid=uuid4(), slug="my-skill", content=body
    )

    assert _round_trip(spec, skill)["content"] == body


def test_scalar_list_round_trips():
    spec = scope.spec_by_table("enabled_widget_bundles")
    bundles = models.EnabledWidgetBundles(
        uuid=uuid4(),
        user_uuid=uuid4(),
        enabled_bundles=["equity", "crypto"],
        disabled_widgets=["some_widget"],
    )

    result = _round_trip(spec, bundles)

    assert result["enabled_bundles"] == ["equity", "crypto"]
    assert result["disabled_widgets"] == ["some_widget"]


def test_pydantic_column_decodes_back_to_a_model_instance():
    """BasePydanticType.process_bind_param rejects a plain dict."""
    spec = scope.spec_by_table("user")
    settings = schemas.ProDisplaySettings()
    user = models.User(
        uuid=uuid4(), email="a@b.co", clean_email="a@b.co", pro_display_settings=settings
    )

    result = _round_trip(spec, user)

    assert isinstance(result["pro_display_settings"], schemas.ProDisplaySettings)
    assert result["pro_display_settings"] == settings


def test_bytes_survive_via_base64():
    payload = b"\x00\x01\xfe\xff not utf-8"
    assert serde._decode_plain(serde.encode_value(payload)) == payload


def test_enum_round_trips_to_the_enum_member():
    """SQLAlchemy persists Enum columns by name and rejects bare strings."""
    from api import base

    spec = scope.spec_by_table("copilot_messages")
    message = models.ChatMessages(
        uuid=uuid4(),
        user_uuid=uuid4(),
        chat_uuid=uuid4(),
        role=base.ChatMessageRole.human,
        content={"text": "hello"},
    )

    result = _round_trip(spec, message)

    assert result["role"] is base.ChatMessageRole.human


def test_generated_columns_are_never_exported():
    """search_vector is a Postgres Computed column -- writing one is an error.

    It does not exist on SQLite, so this is asserted structurally rather than by
    round-tripping a value.
    """
    for spec in scope.INCLUDED:
        for column in spec.model.__table__.columns:
            if column.computed is not None:
                assert not serde.is_exportable(column), (
                    f"{spec.table}.{column.key} is generated and must not travel"
                )


# --------------------------------------------------------------------------- #
# Redaction
# --------------------------------------------------------------------------- #
def test_password_is_never_encoded():
    """A bcrypt hash round-tripped through the ORM double-hashes on write."""
    spec = scope.spec_by_table("user")
    user = models.User(
        uuid=uuid4(), email="a@b.co", clean_email="a@b.co", password="hunter2"
    )

    encoded = serde.encode_row(spec, user)

    assert "password" not in encoded
    assert "auth_token" not in encoded
    assert "totp_secret" not in encoded
    assert "hunter2" not in serde.dumps_line(encoded)


def test_password_guard_passes_for_every_exported_table():
    for spec in scope.INCLUDED:
        serde.assert_password_never_encoded(spec)


def test_decode_ignores_a_redacted_column_smuggled_into_an_archive():
    spec = scope.spec_by_table("user")
    payload = {"uuid": str(uuid4()), "email": "a@b.co", "password": "$2b$12$fakehash"}

    assert "password" not in serde.decode_row(spec, payload)


# --------------------------------------------------------------------------- #
# Forward compatibility
# --------------------------------------------------------------------------- #
def test_unknown_columns_are_dropped_not_fatal():
    """An archive from an older build must not fail the whole import."""
    spec = scope.spec_by_table("copilot_chat")
    payload = {
        "uuid": str(uuid4()),
        "user_uuid": str(uuid4()),
        "column_that_no_longer_exists": "whatever",
    }

    decoded = serde.decode_row(spec, payload)

    assert "column_that_no_longer_exists" not in decoded
    assert serde.unknown_columns(spec, payload) == {"column_that_no_longer_exists"}


def test_malformed_uuid_names_the_offending_column():
    spec = scope.spec_by_table("copilot_chat")

    with pytest.raises(serde.SerdeError, match="copilot_chat.uuid"):
        serde.decode_row(spec, {"uuid": "not-a-uuid"})


def test_unencodable_type_is_rejected_loudly():
    with pytest.raises(serde.SerdeError, match="Cannot encode"):
        serde.encode_value(object())


# --------------------------------------------------------------------------- #
# Every exported table is encodable
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("spec", scope.INCLUDED, ids=lambda s: s.table)
def test_every_exported_table_encodes_an_empty_instance(spec: scope.TableSpec):
    """Catches a new column of a type the codec has no rule for."""
    encoded = serde.encode_row(spec, spec.model())

    serde.dumps_line(encoded)
    assert set(encoded).isdisjoint(serde.redacted_columns(spec))


def test_jsonl_keys_are_sorted_for_clean_diffs():
    line = serde.dumps_line({"b": 1, "a": 2})
    assert line == '{"a":2,"b":1}'
