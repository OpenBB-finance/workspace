"""Full export -> import round trip across two real databases.

This is the test that stands behind the whole feature. It seeds a database
against the live schema, runs the real ``export_user`` to produce a real zip,
then runs the real ``import_archive`` against a *separate* database standing in
for a fresh OpenBB Lite install, and compares the two accounts row by row.

``PRAGMA foreign_keys=ON`` is enabled on the destination, matching Lite. That
makes insert ordering a genuine constraint rather than a claim: a row inserted
before the row it references fails here exactly as it would in production.
"""

import json
from datetime import UTC, datetime
from uuid import uuid4
from zipfile import ZipFile

import pytest
import sqlalchemy as sa
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session

from api import base, models
from api.models.model_helpers import Base
from scripts import export_user_data as exporter
from scripts import import_user_data as importer
from scripts import user_data_scope as scope
from scripts import user_data_serde as serde

EMAIL = "migrating@example.com"
USER_UUID = uuid4()
DASHBOARD_UUID = uuid4()
CHAT_UUID = uuid4()
FILE_KEY = "abc123.csv"
FILE_BYTES = b"date,close\n2026-01-01,101.5\n"

# The destination's own entity, as init_users would have created it.
LITE_ENTITY = uuid4()
LITE_USER_MAP = uuid4()
LITE_ADMIN_MAP = uuid4()
LITE_ADMIN_UUID = uuid4()

# Hub's permission map, which must NOT survive the import.
HUB_MAP = uuid4()


def _enable_fks(engine):
    @event.listens_for(engine.sync_engine, "connect")
    def _set(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")


def _entity_type(session):
    """entity.entity_type_uuid is NOT NULL, so every entity needs one."""
    entity_type = models.EntityType(
        uuid=uuid4(), entity_type="CORPORATION", code="CORPORATION"
    )
    session.add(entity_type)
    session.flush()
    return entity_type.uuid


def _seed_source(session):
    """A Hub account with something in every table that travels."""
    entity = models.Entity(
        uuid=uuid4(), name="Hub Org", entity_type_uuid=_entity_type(session)
    )
    session.add(entity)
    session.add(
        models.PermissionsEntityMap(uuid=HUB_MAP, entity_uuid=entity.uuid, name="User")
    )
    session.add(
        models.User(
            uuid=USER_UUID,
            email=EMAIL,
            clean_email=EMAIL,
            username="migrating",
            password="original-password",
            first_name="Ada",
            last_name="Lovelace",
            confirmed=True,
            is_superuser=True,  # must not survive
            stripe_id="cus_12345",  # must not survive
            has_profile_url=True,
            permissions_uuid=HUB_MAP,  # must be repointed
            created_date=datetime(2024, 6, 1, 10, 0, tzinfo=UTC),
        )
    )
    session.flush()

    file_widget = models.FileWidget(
        uuid=uuid4(),
        user_uuid=USER_UUID,
        url="https://files.example.com/abc123.csv",
        name="prices",
        extension="csv",
        original_file_name="prices.csv",
    )
    session.add(file_widget)
    session.flush()

    session.add_all([
        models.ApiSource(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            name="My backend",
            url="https://api.example.com/",
            endpointHeaders=[{"Authorization": "Bearer sk-live-secret"}],
        ),
        models.SingleWidget(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            name="w",
            endpoint="/data",
            grid_data={"x": 1},
        ),
        models.WidgetMetadata(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            name="My note",
            description="d",
            source="custom",
            category="c",
            sub_category="s",
            widget_type="rich_note",
            storage={"body": "# Notes\n\nünïcøde ✅"},
            widget_config={"theme": "dark"},
            widget_id=uuid4(),
        ),
        models.StoredFile(
            uuid=uuid4(),
            creater_uuid=USER_UUID,
            file_widget_uuid=file_widget.uuid,
            s3_file_name=FILE_KEY,
            bucket="pro-file-storage-dev",
            extension="csv",
            original_file_name="prices.csv",
            size=len(FILE_BYTES),
            is_global=True,  # must not survive
        ),
        models.DashboardItem(
            uuid=DASHBOARD_UUID,
            owner_uuid=USER_UUID,
            creator_uuid=USER_UUID,
            entity_uuid=entity.uuid,  # must not survive
            entity_share=True,  # must not survive
            content={
                "name": "Markets",
                "widgets": [{"i": "w1", "x": 0, "y": 0, "params": {"ticker": "AAPL"}}],
            },
        ),
        models.UserApp(uuid=uuid4(), user_uuid=USER_UUID, content={"tabs": ["a"]}),
        models.CustomCopilot(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            url="https://copilot.example.com",
            headers={"Authorization": "Bearer sk-copilot"},
            copilots=[{"name": "analyst"}],
        ),
        models.MCPServers(
            uuid=uuid4(), user_uuid=USER_UUID, servers=[{"name": "openbb"}]
        ),
        models.CopilotChat(uuid=CHAT_UUID, user_uuid=USER_UUID, label="My chat"),
        models.UserPrompts(
            uuid=uuid4(), user_uuid=USER_UUID, prompt=[{"title": "p"}]
        ),
        models.UserSkills(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            slug="my-skill",
            content="# Skill body",
        ),
        models.TradingView(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            charts_state={"charts": []},
            settings={"theme": "dark"},
        ),
        models.EnabledWidgetBundles(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            enabled_bundles=["equity"],
            disabled_widgets=[],
        ),
        models.CopilotChatOld(
            uuid=uuid4(), user_uuid=USER_UUID, content={"messages": ["old"]}
        ),
    ])
    session.flush()

    session.add(
        models.ChatMessages(
            uuid=uuid4(),
            user_uuid=USER_UUID,
            chat_uuid=CHAT_UUID,
            role=base.ChatMessageRole.human,
            content={"text": "what is AAPL trading at?"},
            searchable_content="what is AAPL trading at?",
        )
    )
    session.add(
        models.DashboardSave(
            uuid=uuid4(),
            dashboard_item_uuid=DASHBOARD_UUID,
            content={"v": 1},
            created_date=datetime(2026, 3, 14, 9, 26, 53, 589793),
        )
    )
    session.commit()


def _seed_destination(session):
    """A fresh Lite install, as scripts.init_users leaves it."""
    session.add(
        models.Entity(
            uuid=LITE_ENTITY,
            name="OpenBB Lite",
            entity_type_uuid=_entity_type(session),
        )
    )
    session.flush()
    session.add_all([
        models.PermissionsEntityMap(
            uuid=LITE_ADMIN_MAP, entity_uuid=LITE_ENTITY, name="Admin"
        ),
        models.PermissionsEntityMap(
            uuid=LITE_USER_MAP, entity_uuid=LITE_ENTITY, name="User"
        ),
    ])
    session.flush()
    session.add(
        models.User(
            uuid=LITE_ADMIN_UUID,
            email="admin@openbb.co",
            clean_email="admin@openbb.co",
            username="migrating",  # deliberate clash with the imported username
            password="admin-password",
            confirmed=True,
            is_superuser=True,
            permissions_uuid=LITE_ADMIN_MAP,
        )
    )
    session.commit()


@pytest.fixture(scope="module")
def databases(tmp_path_factory):
    root = tmp_path_factory.mktemp("roundtrip")

    src_path, dst_path = root / "hub.db", root / "lite.db"
    for path, seed in ((src_path, _seed_source), (dst_path, _seed_destination)):
        sync = sa.create_engine(f"sqlite:///{path}")
        Base.metadata.create_all(sync)
        with Session(sync) as session:
            seed(session)

    src = create_async_engine(f"sqlite+aiosqlite:///{src_path}")
    dst = create_async_engine(f"sqlite+aiosqlite:///{dst_path}")
    _enable_fks(dst)  # Lite runs with foreign keys enforced
    return async_sessionmaker(src), async_sessionmaker(dst)


@pytest.fixture(scope="module")
def storage():
    return {FILE_KEY: FILE_BYTES, f"profile-pictures/{USER_UUID}.png": b"\x89PNG"}


def _redirect_io(mp, databases, storage):
    """Point the scripts at the test databases and an in-memory object store.

    Only the exporter reads storage. The importer deliberately has no storage
    access at all -- uploaded files stay in the archive for the user to keep.
    """
    src_sessions, dst_sessions = databases

    async def read_db():
        async with src_sessions() as session:
            yield session

    async def write_db():
        async with dst_sessions() as session:
            yield session

    async def get_file(bucket, key):
        return storage.get(key)

    mp.setattr(exporter, "aget_read_db", read_db)
    mp.setattr(exporter.FileStorage, "get_file", staticmethod(get_file))
    mp.setattr(importer, "aget_write_db", write_db)


@pytest.fixture(autouse=True)
def _patch_io(monkeypatch, databases, storage):
    _redirect_io(monkeypatch, databases, storage)


@pytest.fixture(scope="module")
async def imported(databases, tmp_path_factory, storage, request):
    """Export from the source database and import into the destination.

    Runs once for the module. pytest's monkeypatch fixture is function-scoped,
    so this uses its own MonkeyPatch instance.
    """
    mp = pytest.MonkeyPatch()
    request.addfinalizer(mp.undo)
    _redirect_io(mp, databases, storage)

    out = tmp_path_factory.mktemp("archive")
    export_result = await exporter.export_user(
        EMAIL, out, include_history=True, with_files=True
    )
    import_result = await importer.import_archive(export_result.archive)
    return export_result, import_result


# --------------------------------------------------------------------------- #
# The account arrives intact
# --------------------------------------------------------------------------- #
async def test_destination_actually_enforces_foreign_keys(databases):
    """Guards the guard.

    Every ordering claim in this file rests on the destination behaving like
    Lite. If the PRAGMA silently stopped applying, the import could pass here
    while failing in production, so assert both that the pragma is set and that
    a violating insert is genuinely rejected.
    """
    _, dst_sessions = databases

    async with dst_sessions() as s:
        assert (await s.execute(sa.text("PRAGMA foreign_keys"))).scalar_one() == 1

        with pytest.raises(sa.exc.IntegrityError):
            await s.execute(
                sa.text(
                    "INSERT INTO copilot_messages "
                    "(uuid, user_uuid, chat_uuid, role) "
                    "VALUES (:u, :u, :missing, 'human')"
                ),
                {"u": uuid4().bytes, "missing": uuid4().bytes},
            )
        await s.rollback()


async def test_import_succeeds_with_foreign_keys_enforced(imported):
    """Insert ordering is real: a bad order fails here as it would in Lite."""
    _, import_result = imported

    assert import_result.total_rows > 0
    assert import_result.user_uuid == USER_UUID


@pytest.mark.parametrize(
    "table", [s.table for s in scope.included_specs(include_history=True)], ids=str
)
async def test_every_table_arrives_identical(table, databases, imported):
    """Row for row, ignoring only the columns the importer deliberately resets."""
    if table in scope.NOT_IMPORTED:
        pytest.skip(f"{table} is archived but never imported")
    if table == "copilot_chat_old":
        pytest.skip(
            "conditionally imported -- covered by the two dedup tests below"
        )

    src_sessions, dst_sessions = databases
    spec = scope.spec_by_table(table)
    forced = set(scope.import_overrides(spec)) | {"permissions_uuid", "username"}

    def comparable(rows):
        return sorted(
            (
                {k: v for k, v in serde.encode_row(spec, r).items() if k not in forced}
                for r in rows
            ),
            key=lambda d: d.get("uuid", ""),
        )

    async with src_sessions() as s:
        before = (await s.execute(sa.select(spec.model))).scalars().all()
        before_rows = comparable(before)

    async with dst_sessions() as s:
        after = (await s.execute(sa.select(spec.model))).scalars().all()
        # The destination also holds its own bootstrap admin.
        after = [r for r in after if getattr(r, "uuid", None) != LITE_ADMIN_UUID]
        after_rows = comparable(after)

    assert before_rows, f"{table} had no source rows -- the test seed is incomplete"
    assert after_rows == before_rows


async def test_chat_messages_survive_with_their_enum_role(databases, imported):
    _, dst_sessions = databases
    async with dst_sessions() as s:
        message = (
            await s.execute(sa.select(models.ChatMessages))
        ).scalar_one()

    assert message.role is base.ChatMessageRole.human
    assert message.content == {"text": "what is AAPL trading at?"}
    assert message.chat_uuid == CHAT_UUID


async def test_dashboard_content_blob_is_byte_for_byte_intact(databases, imported):
    _, dst_sessions = databases
    async with dst_sessions() as s:
        dashboard = await s.get(models.DashboardItem, DASHBOARD_UUID)

    assert dashboard.content == {
        "name": "Markets",
        "widgets": [{"i": "w1", "x": 0, "y": 0, "params": {"ticker": "AAPL"}}],
    }


async def test_credentials_are_re_encrypted_and_readable(databases, imported):
    """The archive carries plaintext; the destination stores its own ciphertext."""
    _, dst_sessions = databases
    async with dst_sessions() as s:
        copilot = (await s.execute(sa.select(models.CustomCopilot))).scalar_one()
        at_rest = (
            await s.execute(sa.text("SELECT headers FROM custom_copilot"))
        ).scalar_one()

    assert copilot.headers == {"Authorization": "Bearer sk-copilot"}
    assert "sk-copilot" not in str(at_rest), "must be encrypted at rest"


async def test_uploaded_files_are_in_the_archive_for_the_user_to_keep(imported):
    """Files are handed back as a folder, not reinstated in the destination."""
    export_result, import_result = imported

    with ZipFile(export_result.archive) as zf:
        names = set(zf.namelist())
        assert zf.read(f"files/{FILE_KEY}") == FILE_BYTES

    assert f"files/profile-pictures/{USER_UUID}.png" in names
    assert import_result.archived_files == 2


async def test_import_writes_no_files_anywhere(imported, storage):
    """The importer has no storage access; nothing may appear in the store."""
    _, import_result = imported

    assert not any(k.startswith("imported/") for k in storage)
    assert set(storage) == {FILE_KEY, f"profile-pictures/{USER_UUID}.png"}
    assert "stored_file" not in import_result.inserted


async def test_stored_file_rows_are_archived_but_not_loaded(databases, imported):
    """The rows are pointers to blobs that will not exist here."""
    export_result, _ = imported
    _, dst_sessions = databases

    with ZipFile(export_result.archive) as zf:
        assert "data/stored_file.jsonl" in set(zf.namelist()), (
            "the record of what the user had should still be exported"
        )

    async with dst_sessions() as s:
        rows = (await s.execute(sa.select(models.StoredFile))).scalars().all()

    assert rows == []


# --------------------------------------------------------------------------- #
# The account arrives correctly *changed*
# --------------------------------------------------------------------------- #
async def test_account_cannot_be_logged_into_with_the_old_password(databases, imported):
    """No password travels, so nothing the user knew still works."""
    _, dst_sessions = databases
    async with dst_sessions() as s:
        user = await s.get(models.User, USER_UUID)

    assert not base.verify_password("original-password", user.password)
    assert user.temporary_password is True
    assert user.confirmed is True, "must be able to log in once a password is set"


async def test_hub_privileges_and_billing_do_not_transfer(databases, imported):
    _, dst_sessions = databases
    async with dst_sessions() as s:
        user = await s.get(models.User, USER_UUID)

    assert user.is_superuser is False, "Hub superuser must not become a Lite superuser"
    assert user.stripe_id is None
    assert user.billing_active is False


async def test_user_joins_the_local_entity(databases, imported):
    """The Hub permission map does not exist here and would dangle."""
    _, dst_sessions = databases
    async with dst_sessions() as s:
        user = await s.get(models.User, USER_UUID)

    assert user.permissions_uuid == LITE_USER_MAP
    assert user.permissions_uuid != HUB_MAP


async def test_username_collision_is_resolved(databases, imported):
    """The bootstrap admin already holds 'migrating'."""
    _, dst_sessions = databases
    async with dst_sessions() as s:
        user = await s.get(models.User, USER_UUID)
        admin = await s.get(models.User, LITE_ADMIN_UUID)

    assert user.username != admin.username
    assert user.username.startswith("migrating")


async def test_org_ownership_and_sharing_are_dropped(databases, imported):
    _, dst_sessions = databases
    async with dst_sessions() as s:
        dashboard = await s.get(models.DashboardItem, DASHBOARD_UUID)

    assert dashboard.entity_uuid is None
    assert dashboard.entity_share is False


async def test_pre_refactor_chats_are_not_duplicated_when_already_migrated(
    databases, imported
):
    """The seed has one chat in copilot_chat and one in copilot_chat_old.

    On a real account these are the same conversations -- the migration worker
    copies without deleting -- so loading both would double the user's history.
    """
    export_result, import_result = imported
    _, dst_sessions = databases

    with ZipFile(export_result.archive) as zf:
        assert "data/copilot_chat_old.jsonl" in set(zf.namelist()), (
            "the pre-refactor rows must still be preserved in the archive"
        )

    async with dst_sessions() as s:
        old = (await s.execute(sa.select(models.CopilotChatOld))).scalars().all()
        new = (await s.execute(sa.select(models.CopilotChat))).scalars().all()

    assert old == [], "pre-refactor chats must not be loaded alongside migrated ones"
    assert len(new) == 1
    assert "copilot_chat_old" in import_result.skipped_tables
    assert any("already present" in w for w in import_result.warnings)


async def test_pre_refactor_chats_load_when_the_account_was_never_migrated(
    tmp_path_factory, databases, storage, imported, request
):
    """An unmigrated account's only copy is the old table -- it must survive."""
    export_result, _ = imported

    mp = pytest.MonkeyPatch()
    request.addfinalizer(mp.undo)

    # A destination with no chats at all, standing in for a fresh Lite install.
    root = tmp_path_factory.mktemp("unmigrated")
    db_path = root / "lite.db"
    sync = sa.create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(sync)
    with Session(sync) as session:
        _seed_destination(session)

    sessions = async_sessionmaker(create_async_engine(f"sqlite+aiosqlite:///{db_path}"))

    async def write_db():
        async with sessions() as session:
            yield session

    mp.setattr(importer, "aget_write_db", write_db)

    # Rewrite the archive so copilot_chat is empty but copilot_chat_old is not,
    # which is what an account the migration worker never reached looks like.
    stripped = root / "no-new-chats.zip"
    with ZipFile(export_result.archive) as src, ZipFile(stripped, "w") as dst:
        for name in src.namelist():
            payload = b"" if name == "data/copilot_chat.jsonl" else src.read(name)
            dst.writestr(name, payload)

    result = await importer.import_archive(stripped)

    async with sessions() as s:
        old = (await s.execute(sa.select(models.CopilotChatOld))).scalars().all()

    assert len(old) == 1, "the only copy of the history must be loaded"
    assert "copilot_chat_old" not in result.skipped_tables


async def test_legacy_blob_table_is_reported_but_not_loaded(imported, databases):
    export_result, import_result = imported

    with ZipFile(export_result.archive) as zf:
        assert "data/copilot_chats.jsonl" not in set(zf.namelist())

    assert "copilot_chats" not in import_result.inserted


# --------------------------------------------------------------------------- #
# Re-import behaviour
# --------------------------------------------------------------------------- #
async def test_second_import_refuses_without_force(imported):
    export_result, _ = imported

    with pytest.raises(importer.ImportError_, match="already exists"):
        await importer.import_archive(export_result.archive)


async def test_force_replaces_rather_than_duplicating(imported, databases):
    export_result, _ = imported
    _, dst_sessions = databases

    async def dashboard_count():
        async with dst_sessions() as s:
            return len(
                (await s.execute(sa.select(models.DashboardItem))).scalars().all()
            )

    before = await dashboard_count()
    result = await importer.import_archive(export_result.archive, force=True)

    assert result.replaced is True
    assert await dashboard_count() == before, "re-import must not duplicate rows"


# --------------------------------------------------------------------------- #
# Archive validation
# --------------------------------------------------------------------------- #
async def test_scope_version_mismatch_is_refused(tmp_path, imported):
    """A newer archive against an older Lite must fail loudly, not half-import."""
    export_result, _ = imported
    tampered = tmp_path / "tampered.zip"

    with ZipFile(export_result.archive) as src, ZipFile(tampered, "w") as dst:
        for name in src.namelist():
            payload = src.read(name)
            if name == "manifest.json":
                manifest = json.loads(payload)
                manifest["scope_version"] = scope.SCOPE_VERSION + 99
                payload = json.dumps(manifest).encode()
            dst.writestr(name, payload)

    with pytest.raises(importer.ImportError_, match="scope version"):
        await importer.import_archive(tampered)


async def test_a_non_archive_is_rejected_clearly(tmp_path):
    junk = tmp_path / "notazip.zip"
    junk.write_bytes(b"this is not a zip file")

    with pytest.raises(importer.ImportError_, match="not a readable zip"):
        await importer.import_archive(junk)


async def test_missing_archive_is_reported(tmp_path):
    with pytest.raises(importer.ImportError_, match="No such archive"):
        await importer.import_archive(tmp_path / "nope.zip")
