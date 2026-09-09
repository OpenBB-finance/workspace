"""The export/import scope is a contract, so it gets enforced like one.

These tests need no database -- they read SQLAlchemy metadata and the scope
registries. The important one is ``test_every_user_linked_table_is_classified``:
it fails when a new table gains a FK to ``user.uuid`` without anyone deciding
whether the user's account export should carry it.
"""

import pytest

# Imported for its side effect: Base.metadata only knows about tables whose
# module has been imported, so without this the sweep below can silently run
# against a partial schema and report a clean bill of health.
import api.models  # noqa: F401
from api.models.model_helpers import Base
from scripts import user_data_scope as scope


def _user_linked_tables() -> set[str]:
    """Every table with a foreign key onto user.uuid, per live metadata."""
    return {
        table.name
        for table in Base.metadata.tables.values()
        for fk in table.foreign_keys
        if fk.column.table.name == "user" and fk.column.name == "uuid"
    }


def test_every_user_linked_table_is_classified():
    """A user-linked table must be exported or explicitly excluded."""
    classified = {s.table for s in scope.INCLUDED} | {e.table for e in scope.EXCLUDED}
    unclassified = _user_linked_tables() - classified

    assert not unclassified, (
        "These tables link to user.uuid but appear in neither INCLUDED nor "
        f"EXCLUDED in scripts/user_data_scope.py: {sorted(unclassified)}. "
        "Add each one to whichever registry is correct -- exporting a user's "
        "account should never silently skip their data."
    )


def test_no_table_is_both_included_and_excluded():
    overlap = {s.table for s in scope.INCLUDED} & {e.table for e in scope.EXCLUDED}
    assert not overlap, f"Tables in both registries: {sorted(overlap)}"


def test_excluded_tables_exist_and_carry_a_reason():
    known = set(Base.metadata.tables)
    for ex in scope.EXCLUDED:
        assert ex.table in known, f"EXCLUDED references unknown table {ex.table!r}"
        assert ex.reason.strip(), f"{ex.table} is excluded without a reason"


def test_included_link_columns_exist_on_their_models():
    for spec in scope.INCLUDED:
        assert hasattr(spec.model, spec.link_column), (
            f"{spec.table}.{spec.link_column} does not exist -- the column was "
            "probably renamed."
        )


def test_password_is_never_exportable():
    """PasswordType re-hashes on write; a round-tripped hash locks the account out."""
    assert "password" in scope.GLOBAL_REDACT

    user_spec = scope.spec_by_table("user")
    assert user_spec is not None
    assert "password" in scope.redacted_columns(user_spec)


def test_dashboards_are_scoped_by_owner_not_creator():
    """A dashboard authored by the user but owned by an org is org property."""
    spec = scope.spec_by_table("dashboard_item")
    assert spec is not None
    assert spec.link_column == "owner_uuid"


def test_entity_owned_backends_are_out_of_scope():
    """api_source rows carry either user_uuid or entity_uuid; only the former moves."""
    spec = scope.spec_by_table("api_source")
    assert spec is not None
    assert spec.link_column == "user_uuid"


def test_optional_tables_are_off_by_default():
    default = {s.table for s in scope.included_specs()}
    assert "dashboard_save" not in default
    assert "copilot_chats" not in default

    with_history = {s.table for s in scope.included_specs(include_history=True)}
    assert "dashboard_save" in with_history


def test_user_is_inserted_before_everything_that_references_it():
    tables = [s.table for s in scope.INCLUDED]
    assert tables[0] == "user", "user must be inserted first; FKs are enforced"


@pytest.mark.parametrize(
    "earlier,later",
    [
        # Dashboard content blobs reference these UUIDs, so the rows must exist
        # before the dashboards that point at them.
        ("api_source", "dashboard_item"),
        ("widget_metadata", "dashboard_item"),
        ("file_widget", "stored_file"),  # stored_file.file_widget_uuid FK
        ("stored_file", "dashboard_item"),
        ("dashboard_item", "dashboard_save"),  # dashboard_save FKs dashboard_item
        ("copilot_chat", "copilot_messages"),  # copilot_messages FKs copilot_chat
    ],
)
def test_insert_order_respects_dependencies(earlier: str, later: str):
    tables = [s.table for s in scope.INCLUDED]
    assert tables.index(earlier) < tables.index(later), (
        f"{earlier} must be inserted before {later}"
    )


def test_legacy_chat_table_is_archived_but_not_imported():
    assert "copilot_chats" in scope.NOT_IMPORTED
    assert scope.spec_by_table("copilot_chats") is not None


def test_all_three_chat_generations_are_exported_by_default():
    """Chats live in up to three places while the refactor migration runs.

    migrate_duplicate_copilot_chats moves rows from copilot_chat_old into
    copilot_chat/copilot_messages one user at a time, so an unmigrated account's
    only copy is the old table. Dropping any of these loses real history.
    """
    default = {s.table for s in scope.included_specs()}

    assert "copilot_chat" in default
    assert "copilot_messages" in default
    assert "copilot_chat_old" in default


def test_chat_messages_are_scoped_to_the_user_directly():
    """copilot_messages carries its own user_uuid, so no join is needed."""
    spec = scope.spec_by_table("copilot_messages")
    assert spec is not None
    assert spec.link_column == "user_uuid"


def test_describe_covers_both_registries():
    text = scope.describe(include_history=True, include_legacy=True)
    for spec in scope.INCLUDED:
        assert spec.table in text
    for ex in scope.EXCLUDED:
        assert ex.table in text
