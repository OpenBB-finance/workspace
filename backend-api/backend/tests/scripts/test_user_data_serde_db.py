"""End-to-end codec fidelity against real databases.

The isolated codec tests prove encode/decode are inverses in memory. This file
proves the thing that actually ships: a row written by SQLAlchemy in one
database, exported, and re-inserted by SQLAlchemy into a *different* database
comes back identical.

That second hop is where the subtle failures live. ``EncryptedType`` re-encrypts
under a different key, ``GzipJson*`` recompresses, ``BasePydanticType`` refuses
anything that is not a model instance, and ``DATETIME(fsp=6)`` can quietly drop
microseconds. Comparing in-memory dicts would catch none of it.

Foreign keys are left off here on purpose -- insert ordering is the scope
module's contract and is covered in ``test_user_data_scope.py``. This file is
only about value fidelity.
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from api import base, models
from api.models.model_helpers import Base
from scripts import user_data_scope as scope
from scripts import user_data_serde as serde

USER_UUID = uuid4()
CHAT_UUID = uuid4()


def _sample_rows() -> dict[str, object]:
    """One representative row per interesting column type."""
    return {
        "user": models.User(
            uuid=USER_UUID,
            email="shutdown@example.com",
            clean_email="shutdown@example.com",
            username="shutdown-user",
            password="plaintext-only-at-write-time",
            first_name="Ada",
            last_name="Lovelace",
            confirmed=True,
            created_date=datetime(2023, 1, 5, 8, 30, tzinfo=UTC),
        ),
        "api_source": models.ApiSource(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            name="My backend",
            url="https://api.example.com/",
            endpointHeaders=[{"Authorization": "Bearer sk-live-secret"}],
        ),
        "widget_metadata": models.WidgetMetadata(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            name="My note",
            description="a note",
            source="custom",
            category="c",
            sub_category="s",
            widget_type="rich_note",
            storage={"body": "# heading\n\nsome **markdown** with ünïcøde"},
            widget_config={"theme": "dark", "n": 3},
            widget_id=uuid4(),
        ),
        "stored_file": models.StoredFile(
            uuid=uuid4(),
            creater_uuid=USER_UUID,
            s3_file_name="7f3a-report.pdf",
            bucket="pro-file-storage-dev",
            extension="pdf",
            original_file_name="report.pdf",
            size=182_344,
        ),
        "dashboard_item": models.DashboardItem(
            uuid=uuid4(),
            owner_uuid=USER_UUID,
            creator_uuid=USER_UUID,
            content={
                "name": "Markets",
                "widgets": [
                    {"i": str(uuid4()), "x": 0, "y": 0, "w": 6, "h": 4,
                     "params": {"ticker": "AAPL", "limit": 100}},
                ],
                "unicode": "ünïcøde ✅",
            },
        ),
        "dashboard_save": models.DashboardSave(
            uuid=uuid4(),
            dashboard_item_uuid=uuid4(),
            content={"version": 2},
            created_date=datetime(2026, 3, 14, 9, 26, 53, 589793),
        ),
        "user_app": models.UserApp(
            uuid=uuid4(), user_uuid=USER_UUID, content={"tabs": [{"id": "a"}]}
        ),
        "custom_copilot": models.CustomCopilot(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            url="https://copilot.example.com",
            headers={"Authorization": "Bearer sk-copilot-secret"},
            copilots=[{"name": "analyst", "id": "an-1"}],
        ),
        "mcp_servers": models.MCPServers(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            servers=[{"name": "openbb", "url": "https://mcp.example.com"}],
        ),
        "copilot_chat": models.CopilotChat(
            uuid=CHAT_UUID,
            user_uuid=USER_UUID,
            label="My conversation",
            content={"summary": "a chat"},
            artifacts=[{"type": "table", "rows": 3}],
            last_opened=datetime(2026, 5, 1, 12, 0, tzinfo=UTC),
        ),
        "copilot_messages": models.ChatMessages(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            chat_uuid=CHAT_UUID,
            role=base.ChatMessageRole.human,
            content={"text": "what is the price of AAPL?"},
            searchable_content="what is the price of AAPL?",
        ),
        "copilot_chat_old": models.CopilotChatOld(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            content={"messages": [{"role": "user", "content": "an older chat"}]},
        ),
        "user_prompts": models.UserPrompts(
            uuid=uuid4(), user_uuid=USER_UUID, prompt=[{"title": "p", "body": "b"}]
        ),
        "user_skills": models.UserSkills(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            slug="my-skill",
            description="does things",
            content="# Skill\n\nBody with ünïcøde and\ttabs",
        ),
        "trading_view": models.TradingView(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            charts_state={"charts": [{"symbol": "AAPL"}]},
            settings={"theme": "dark"},
        ),
        "enabled_widget_bundles": models.EnabledWidgetBundles(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            enabled_bundles=["equity", "crypto"],
            disabled_widgets=["noisy_widget"],
        ),
        "single_widget": models.SingleWidget(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            name="w",
            endpoint="/data",
            grid_data={"x": 1},
            data={"k": "v"},
            endpoint_headers={"X-Key": "abc"},
            source=["custom"],
        ),
        "file_widget": models.FileWidget(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            url="https://files.example.com/a.csv",
            name="a",
            extension="csv",
            original_file_name="a.csv",
        ),
    }


SAMPLES = _sample_rows()


@pytest.fixture(scope="module")
def source_db():
    """Stands in for the Hub database.

    All tables are created, not just the exported ones: ApiSource.vendor_app is
    a lazy="joined" relationship, so reading api_source LEFT JOINs vendor_app.
    """
    engine = sa.create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add_all(SAMPLES.values())
        session.commit()
        yield session


@pytest.fixture(scope="module")
def archive(source_db) -> dict[str, str]:
    """The exported JSONL line for each sampled row."""
    lines = {}
    for table in SAMPLES:
        spec = scope.spec_by_table(table)
        original = source_db.get(spec.model, SAMPLES[table].uuid)
        assert original is not None, f"{table} was not persisted to the source DB"
        lines[table] = serde.dumps_line(serde.encode_row(spec, original))
    return lines


@pytest.fixture(scope="module")
def target_db(archive):
    """A separate database after a full import of the archive.

    The import runs here rather than inside a test so that every assertion
    below observes the same finished state regardless of run order.
    """
    engine = sa.create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for table, line in archive.items():
            spec = scope.spec_by_table(table)
            kwargs = serde.decode_row(spec, serde.loads_line(line))
            kwargs |= scope.import_overrides(spec)
            session.add(spec.model(**kwargs))
        session.commit()
        yield session


@pytest.mark.parametrize("table", sorted(SAMPLES), ids=str)
def test_row_survives_export_and_reimport(table, source_db, target_db):
    """Hub row -> archive line -> Lite row, compared as archive lines.

    Columns the importer deliberately resets are excluded here and asserted
    individually in the override tests below.
    """
    spec = scope.spec_by_table(table)
    assert spec is not None, f"{table} is not in the export scope"

    original = source_db.get(spec.model, SAMPLES[table].uuid)
    reimported = target_db.get(spec.model, SAMPLES[table].uuid)
    assert reimported is not None, "row did not land in the target database"

    forced = set(scope.import_overrides(spec))
    before = serde.encode_row(spec, original)
    after = serde.encode_row(spec, reimported)

    assert {k: v for k, v in after.items() if k not in forced} == {
        k: v for k, v in before.items() if k not in forced
    }


def test_encrypted_column_is_ciphertext_at_rest_but_plaintext_in_the_archive(source_db):
    """The archive must be portable across instances with different AES keys."""
    spec = scope.spec_by_table("custom_copilot")
    row = source_db.get(models.CustomCopilot, SAMPLES["custom_copilot"].uuid)

    at_rest = source_db.execute(
        sa.text("SELECT headers FROM custom_copilot WHERE uuid = :u"),
        {"u": SAMPLES["custom_copilot"].uuid.bytes},
    ).scalar_one()

    assert "sk-copilot-secret" not in str(at_rest), "should be encrypted in the DB"
    assert serde.encode_row(spec, row)["headers"] == {
        "Authorization": "Bearer sk-copilot-secret"
    }


def test_gzip_column_is_compressed_at_rest(source_db):
    """Confirms we are reading through the TypeDecorator, not around it."""
    at_rest = source_db.execute(
        sa.text("SELECT content FROM copilot_chat WHERE uuid = :u"),
        {"u": SAMPLES["copilot_chat"].uuid.bytes},
    ).scalar_one()

    assert isinstance(at_rest, bytes)
    assert at_rest[:2] == b"\x1f\x8b", "expected a gzip magic number"


def test_password_never_reaches_the_archive(source_db):
    spec = scope.spec_by_table("user")
    user = source_db.get(models.User, USER_UUID)

    encoded = serde.encode_row(spec, user)
    line = serde.dumps_line(encoded)

    assert "password" not in encoded, "the column itself must not be exported"
    assert "plaintext-only-at-write-time" not in line
    assert "$2b$" not in line, "a bcrypt hash would double-hash on import"


def test_imported_user_has_a_password_nobody_holds(source_db, target_db):
    """password is NOT NULL, so the importer must supply one -- a random one."""
    spec = scope.spec_by_table("user")
    original = source_db.get(models.User, USER_UUID)

    overrides = scope.import_overrides(spec)

    assert overrides["password"] != "plaintext-only-at-write-time"
    assert len(overrides["password"]) >= 32, "must be unguessable"
    assert scope.import_overrides(spec)["password"] != overrides["password"], (
        "a fresh random password per import, not a shared constant"
    )

    imported = target_db.get(models.User, original.uuid)
    assert imported.temporary_password is True
    assert imported.confirmed is True, "login rejects unconfirmed accounts"
    assert imported.is_superuser is False


def test_marketplace_reference_is_cleared_on_import(source_db, target_db):
    """vendor_app is EXCLUDED, so the FK would dangle in Lite."""
    imported = target_db.get(models.ApiSource, SAMPLES["api_source"].uuid)

    assert imported.vendor_app_uuid is None
    assert imported.entity_uuid is None
    assert imported.endpointHeaders == [{"Authorization": "Bearer sk-live-secret"}]


def test_stored_file_survives_the_codec_even_though_it_is_never_imported():
    """The rows are archived so the user has a record of the files they had.

    They are not loaded into a destination (see NOT_IMPORTED), but they still
    have to encode and decode cleanly to reach the archive.
    """
    assert "stored_file" in scope.NOT_IMPORTED

    spec = scope.spec_by_table("stored_file")
    encoded = serde.encode_row(spec, SAMPLES["stored_file"])

    assert encoded["s3_file_name"] == "7f3a-report.pdf"
    assert encoded["original_file_name"] == "report.pdf"


def test_org_ownership_is_dropped_on_import(target_db):
    imported = target_db.get(models.DashboardItem, SAMPLES["dashboard_item"].uuid)

    assert imported.entity_uuid is None
    assert imported.entity_share is False
    assert imported.is_shared is False


def test_every_override_names_a_real_column():
    for table, reasons in scope.IMPORT_OVERRIDE_REASONS.items():
        spec = scope.spec_by_table(table)
        assert spec is not None, f"override for unexported table {table!r}"
        columns = set(spec.model.__table__.columns.keys())
        for column in reasons:
            assert column in columns, f"{table}.{column} does not exist"


def test_every_override_is_documented():
    """A forced value without a stated reason is indistinguishable from a bug."""
    for spec in scope.INCLUDED:
        forced = set(scope.import_overrides(spec))
        documented = set(scope.IMPORT_OVERRIDE_REASONS.get(spec.table, {}))
        assert forced == documented, (
            f"{spec.table}: overrides {forced ^ documented} are undocumented or "
            "documented but not applied"
        )
