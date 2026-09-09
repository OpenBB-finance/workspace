"""Export tests against a seeded database and a real zip archive.

These run the actual ``export_user`` coroutine against SQLite with object
storage stubbed, then open the resulting archive and inspect it. The point is to
verify the things an operator cannot easily check by eye: that another user's
data never leaks in, that excluded tables really are absent, and that a blob
which fails to download is reported rather than silently dropped.
"""

import json
from datetime import datetime
from uuid import uuid4
from zipfile import ZipFile

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api import base, models
from api.models.model_helpers import Base
from scripts import export_user_data as exporter
from scripts import user_data_scope as scope
from scripts import user_data_serde as serde

TARGET_EMAIL = "target@example.com"
OTHER_EMAIL = "other@example.com"

TARGET_UUID = uuid4()
OTHER_UUID = uuid4()
TARGET_DASHBOARD = uuid4()
OTHER_DASHBOARD = uuid4()
TARGET_CHAT = uuid4()
OTHER_CHAT = uuid4()

BLOBS = {
    "target-file.csv": b"col_a,col_b\n1,2\n",
    "missing-file.csv": None,  # storage returns None -> must be reported
    "other-file.csv": b"should never be exported\n",
}


def _user(uuid, email, **kw):
    return models.User(
        uuid=uuid,
        email=email,
        clean_email=email,
        username=email.split("@")[0],
        password="seed-password",
        confirmed=True,
        **kw,
    )


def _seed(session):
    session.add_all([
        _user(TARGET_UUID, TARGET_EMAIL, first_name="Target", has_profile_url=True),
        _user(OTHER_UUID, OTHER_EMAIL, first_name="Other"),
    ])

    # Target's data.
    session.add_all([
        models.DashboardItem(
            uuid=TARGET_DASHBOARD,
            owner_uuid=TARGET_UUID,
            creator_uuid=TARGET_UUID,
            content={"name": "Mine", "widgets": [{"i": "w1"}]},
        ),
        models.DashboardSave(
            uuid=uuid4(),
            dashboard_item_uuid=TARGET_DASHBOARD,
            content={"v": 1},
            created_date=datetime(2026, 1, 1, tzinfo=None),
        ),
        models.ApiSource(
            uuid=uuid4(),
            user_uuid=TARGET_UUID,
            name="my backend",
            url="https://api.example.com/",
            endpointHeaders=[{"Authorization": "Bearer sk-target"}],
        ),
        models.CopilotChat(
            uuid=TARGET_CHAT, user_uuid=TARGET_UUID, label="my chat"
        ),
        models.ChatMessages(
            uuid=uuid4(),
            user_uuid=TARGET_UUID,
            chat_uuid=TARGET_CHAT,
            role=base.ChatMessageRole.human,
            content={"text": "my private question"},
        ),
        models.CopilotChatOld(
            uuid=uuid4(),
            user_uuid=TARGET_UUID,
            content={"messages": [{"content": "my older chat"}]},
        ),
        models.StoredFile(
            uuid=uuid4(),
            creater_uuid=TARGET_UUID,
            s3_file_name="target-file.csv",
            bucket="pro-file-storage-dev",
            extension="csv",
            original_file_name="target.csv",
            size=16,
        ),
        models.StoredFile(
            uuid=uuid4(),
            creater_uuid=TARGET_UUID,
            s3_file_name="missing-file.csv",
            bucket="pro-file-storage-dev",
            extension="csv",
            original_file_name="gone.csv",
            size=99,
        ),
        # Excluded: a live session and a login record.
        models.Session(uuid=uuid4(), user_uuid=TARGET_UUID, api_token="secret-token"),
    ])

    # The other user's data -- none of this may appear in the archive.
    session.add_all([
        models.DashboardItem(
            uuid=OTHER_DASHBOARD,
            owner_uuid=OTHER_UUID,
            creator_uuid=OTHER_UUID,
            content={"name": "Not mine", "secret": "other-user-content"},
        ),
        models.DashboardSave(
            uuid=uuid4(),
            dashboard_item_uuid=OTHER_DASHBOARD,
            content={"secret": "other-user-history"},
            created_date=datetime(2026, 1, 1, tzinfo=None),
        ),
        models.ApiSource(
            uuid=uuid4(),
            user_uuid=OTHER_UUID,
            name="their backend",
            url="https://other.example.com/",
            endpointHeaders=[{"Authorization": "Bearer sk-other"}],
        ),
        models.CopilotChat(uuid=OTHER_CHAT, user_uuid=OTHER_UUID, label="their chat"),
        models.ChatMessages(
            uuid=uuid4(),
            user_uuid=OTHER_UUID,
            chat_uuid=OTHER_CHAT,
            role=base.ChatMessageRole.human,
            content={"text": "other-user-message"},
        ),
        models.CopilotChatOld(
            uuid=uuid4(),
            user_uuid=OTHER_UUID,
            content={"messages": [{"content": "other-user-old-chat"}]},
        ),
        models.StoredFile(
            uuid=uuid4(),
            creater_uuid=OTHER_UUID,
            s3_file_name="other-file.csv",
            bucket="pro-file-storage-dev",
            extension="csv",
            original_file_name="other.csv",
            size=24,
        ),
    ])
    session.commit()


@pytest.fixture(scope="module")
def seeded_db(tmp_path_factory):
    """A SQLite database standing in for Hub, plus an async session factory."""
    db_path = tmp_path_factory.mktemp("hub") / "hub.db"
    sync_engine = sa.create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(sync_engine)
    with sa.orm.Session(sync_engine) as session:
        _seed(session)

    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture(autouse=True)
def _patch_io(monkeypatch, seeded_db):
    """Point the exporter at the seeded database and a fake object store."""

    async def fake_read_db():
        async with seeded_db() as session:
            yield session

    async def fake_get_file(bucket, key):
        if key.startswith("profile-pictures/"):
            return b"\x89PNG fake"
        return BLOBS.get(key)

    monkeypatch.setattr(exporter, "aget_read_db", fake_read_db)
    monkeypatch.setattr(exporter.FileStorage, "get_file", staticmethod(fake_get_file))


@pytest.fixture
async def archive(tmp_path):
    """The default export: rows only, no file blobs."""
    result = await exporter.export_user(TARGET_EMAIL, tmp_path)
    return result, ZipFile(result.archive)


@pytest.fixture
async def archive_with_files(tmp_path):
    result = await exporter.export_user(TARGET_EMAIL, tmp_path, with_files=True)
    return result, ZipFile(result.archive)


def _rows(zf: ZipFile, table: str) -> list[dict]:
    body = zf.read(f"data/{table}.jsonl").decode("utf-8")
    return [serde.loads_line(line) for line in body.splitlines() if line]


# --------------------------------------------------------------------------- #
# Isolation -- the property that matters most
# --------------------------------------------------------------------------- #
async def test_no_other_users_data_appears_anywhere(archive):
    """Nothing belonging to the other account may appear in any archive member."""
    _, zf = archive

    blob = b"".join(zf.read(name) for name in zf.namelist())

    for leak in [
        b"other-user-content",
        b"other-user-history",
        b"other-user-message",
        b"other-user-old-chat",
        b"their chat",
        b"sk-other",
        b"should never be exported",
        str(OTHER_UUID).encode(),
        str(OTHER_CHAT).encode(),
        OTHER_EMAIL.encode(),
    ]:
        assert leak not in blob, f"leaked another user's data: {leak!r}"


async def test_chat_history_is_exported_from_all_three_tables(archive):
    """An account mid-migration has chats split across old and new tables."""
    _, zf = archive

    assert [r["uuid"] for r in _rows(zf, "copilot_chat")] == [str(TARGET_CHAT)]

    messages = _rows(zf, "copilot_messages")
    assert len(messages) == 1
    assert messages[0]["chat_uuid"] == str(TARGET_CHAT)
    assert messages[0]["content"] == {"text": "my private question"}
    assert messages[0]["role"] == "human"

    old = _rows(zf, "copilot_chat_old")
    assert len(old) == 1
    assert old[0]["content"]["messages"][0]["content"] == "my older chat"


async def test_only_the_targets_rows_are_exported(archive):
    _, zf = archive

    assert [r["uuid"] for r in _rows(zf, "user")] == [str(TARGET_UUID)]
    assert [r["uuid"] for r in _rows(zf, "dashboard_item")] == [str(TARGET_DASHBOARD)]
    assert all(r["user_uuid"] == str(TARGET_UUID) for r in _rows(zf, "api_source"))


async def test_excluded_tables_have_no_file_in_the_archive(archive):
    """Session tokens and login history must not ship."""
    _, zf = archive
    names = set(zf.namelist())

    for excluded in ("session", "login", "personal_access_token", "dashboard_share"):
        assert f"data/{excluded}.jsonl" not in names

    assert b"secret-token" not in b"".join(zf.read(n) for n in names)


# --------------------------------------------------------------------------- #
# Optional tables
# --------------------------------------------------------------------------- #
async def test_history_is_absent_by_default(archive):
    _, zf = archive
    assert "data/dashboard_save.jsonl" not in set(zf.namelist())


async def test_history_is_scoped_to_the_users_own_dashboards(tmp_path):
    """dashboard_save links via dashboard_item, so the join is easy to get wrong."""
    result = await exporter.export_user(TARGET_EMAIL, tmp_path, include_history=True)

    with ZipFile(result.archive) as zf:
        saves = _rows(zf, "dashboard_save")

    assert len(saves) == 1
    assert saves[0]["dashboard_item_uuid"] == str(TARGET_DASHBOARD)


# --------------------------------------------------------------------------- #
# Files
# --------------------------------------------------------------------------- #
async def test_files_are_not_downloaded_by_default(archive):
    """Blob download dominates the runtime, so it is opt-in."""
    result, zf = archive

    assert not [n for n in zf.namelist() if n.startswith("files/")]
    assert result.files_written == 0
    assert result.files_skipped == 2, "the account's 2 file rows are still counted"

    manifest = json.loads(zf.read("manifest.json"))
    assert manifest["options"]["with_files"] is False
    assert manifest["files"]["skipped"] == 2

    # The rows still travel, so the user knows which files they had.
    assert len(_rows(zf, "stored_file")) == 2


async def test_readme_says_the_files_were_left_out(archive):
    _, zf = archive
    readme = zf.read("README.md").decode("utf-8")

    assert "does **not** contain your 2 uploaded file(s)" in readme


async def test_blobs_are_written_when_asked_for(archive_with_files):
    result, zf = archive_with_files
    names = set(zf.namelist())

    assert "files/target-file.csv" in names
    assert zf.read("files/target-file.csv") == BLOBS["target-file.csv"]
    assert f"files/profile-pictures/{TARGET_UUID}.png" in names
    assert result.files_written == 2  # one data file + the profile picture
    assert result.files_skipped == 0


async def test_unreadable_blob_is_reported_not_silently_dropped(archive_with_files):
    """FileStorage.get_file returns None on failure -- that must surface."""
    result, zf = archive_with_files

    assert "missing-file.csv" in result.missing_files
    assert "files/missing-file.csv" not in set(zf.namelist())
    assert any("could not be read" in w for w in result.warnings)

    manifest = json.loads(zf.read("manifest.json"))
    assert manifest["files"]["missing"] == ["missing-file.csv"]

    # The row itself still travels, so the user knows the file existed.
    assert any(r["s3_file_name"] == "missing-file.csv" for r in _rows(zf, "stored_file"))


# --------------------------------------------------------------------------- #
# Manifest and documentation
# --------------------------------------------------------------------------- #
async def test_manifest_checksums_match_the_data_files(archive):
    import hashlib

    _, zf = archive
    manifest = json.loads(zf.read("manifest.json"))

    for table, entry in manifest["tables"].items():
        body = zf.read(entry["path"])
        assert hashlib.sha256(body).hexdigest() == entry["sha256"], f"{table} checksum"


async def test_manifest_records_versions_for_the_importer(archive):
    _, zf = archive
    manifest = json.loads(zf.read("manifest.json"))

    assert manifest["scope_version"] == scope.SCOPE_VERSION
    assert manifest["serde_version"] == serde.SERDE_VERSION
    assert manifest["user"]["email"] == TARGET_EMAIL


async def test_archive_documents_its_own_scope(archive):
    _, zf = archive
    names = set(zf.namelist())

    assert "SCOPE.txt" in names
    assert "README.md" in names

    scope_text = zf.read("SCOPE.txt").decode("utf-8")
    assert "EXCLUDED" in scope_text
    assert "RESET ON IMPORT" in scope_text


async def test_readme_warns_about_plaintext_credentials(archive):
    """The archive carries live credentials; the user has to be told."""
    _, zf = archive
    readme = zf.read("README.md").decode("utf-8")

    assert "unencrypted credentials" in readme
    assert "openbb-import" in readme, "must tell them how to import"
    assert "password is **not** carried over" in readme


async def test_password_is_absent_from_the_whole_archive(archive):
    _, zf = archive

    assert "password" not in _rows(zf, "user")[0]
    assert b"seed-password" not in b"".join(zf.read(n) for n in zf.namelist())


# --------------------------------------------------------------------------- #
# Account resolution
# --------------------------------------------------------------------------- #
async def test_unknown_email_fails_clearly(tmp_path):
    with pytest.raises(exporter.ExportError, match="No account found"):
        await exporter.export_user("nobody@example.com", tmp_path)


async def test_soft_deleted_account_is_found_and_flagged(seeded_db, tmp_path):
    """delete_user rewrites the email to deleted-<rand>-<original>."""
    email = "gone@example.com"
    async with seeded_db() as session:
        session.add(_user(uuid4(), f"deleted-abc123-{email}", deleted=True))
        await session.commit()

    result = await exporter.export_user(email, tmp_path)

    assert any("soft-deleted" in w for w in result.warnings)
