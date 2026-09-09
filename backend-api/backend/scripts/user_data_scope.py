"""Declarative scope for the user data export/import.

This module is the single source of truth for *what moves* when a user's account
is exported from OpenBB Hub and imported into OpenBB Lite. Both
``scripts.export_user_data`` and ``scripts.import_user_data`` read this list, so
the two sides cannot drift apart.

Two registries, both deliberate:

``INCLUDED``
    Tables that are exported, in the order they must be inserted on import
    (SQLite runs with ``PRAGMA foreign_keys=ON``, so order is load-bearing).

``EXCLUDED``
    User-linked tables that are *not* exported, each with the reason. Excluded
    is a decision, not an oversight -- anything user-linked belongs in one list
    or the other, and ``test_user_data_scope.py`` fails if a table is in
    neither.

Run ``python -m scripts.user_data_scope`` to print the scope as a table.
"""

import secrets
import sys
from dataclasses import dataclass
from typing import Any

from api import models

# --------------------------------------------------------------------------- #
# Scope version. Bump when INCLUDED changes shape; the importer refuses an
# archive whose manifest records a different value.
# --------------------------------------------------------------------------- #
SCOPE_VERSION = 1

# Columns never written to the archive, regardless of table.
#
# ``password`` deserves its own note: PasswordType.process_bind_param bcrypt
# hashes on *every* write, so a hash round-tripped through the ORM would be
# double-hashed and the account would be permanently unloggable. The importer
# sets an unknown random password instead and the Lite admin assigns a real one.
GLOBAL_REDACT = ("password", "auth_token", "totp_secret")


@dataclass(frozen=True)
class TableSpec:
    """One table that travels with the user."""

    model: type
    link_column: str
    """Attribute on ``model`` holding the FK to ``user.uuid``."""

    label: str
    """Human description, shown in --describe-scope and the archive README."""

    redact: tuple[str, ...] = ()
    """Columns dropped at export time, on top of GLOBAL_REDACT."""

    optional: bool = False
    """Excluded unless explicitly requested via a CLI flag."""

    note: str = ""

    @property
    def table(self) -> str:
        return self.model.__tablename__

    @property
    def filename(self) -> str:
        return f"{self.table}.jsonl"


@dataclass(frozen=True)
class ExcludedTable:
    """A user-linked table intentionally left behind."""

    table: str
    link_column: str
    reason: str


# --------------------------------------------------------------------------- #
# INCLUDED -- exported, and inserted on import in exactly this order.
# --------------------------------------------------------------------------- #
INCLUDED: list[TableSpec] = [
    TableSpec(
        model=models.User,
        link_column="uuid",
        label="Account profile, display settings and onboarding state",
        redact=("stripe_id", "microsoft_id", "referred_by", "referral_code"),
        note=(
            "permissions_uuid is repointed to the local Lite entity on import. "
            "referral_code is regenerated because it carries a UNIQUE constraint."
        ),
    ),
    # -- Data connectors. Must precede dashboards: dashboard content blobs
    #    reference api_source UUIDs.
    TableSpec(
        model=models.ApiSource,
        link_column="user_uuid",
        label="Custom backends",
        note=(
            "Personal backends only (user_uuid IS NOT NULL); entity-owned "
            "backends are org property and stay behind. endpointHeaders is "
            "EncryptedType -- exported as plaintext, re-encrypted on import "
            "under the target instance's OPENBB_AES_KEY."
        ),
    ),
    TableSpec(
        model=models.SingleWidget,
        link_column="user_uuid",
        label="Single-endpoint widget definitions",
    ),
    TableSpec(
        model=models.FileWidget,
        link_column="user_uuid",
        label="File-backed widget definitions",
    ),
    TableSpec(
        model=models.WidgetMetadata,
        link_column="user_uuid",
        label="Custom widgets, charts, notes and templates",
        note="widget_id is a UNIQUE frontend-side UUID and is preserved as-is.",
    ),
    # -- Files. Exported so the user gets a record of what they had alongside
    #    the blobs in files/, but never loaded into the destination.
    TableSpec(
        model=models.StoredFile,
        link_column="creater_uuid",  # sic: misspelled in the schema
        label="Uploaded file records (archived, not imported)",
        note=(
            "The blobs themselves are written to files/ in the archive for the "
            "user to keep. Neither the blobs nor these rows are loaded into the "
            "destination -- a row here is only a pointer to object storage, so "
            "importing it would create widgets referencing files that are not "
            "there."
        ),
    ),
    # -- Dashboards and apps. Content blobs reference everything above.
    TableSpec(
        model=models.DashboardItem,
        link_column="owner_uuid",
        label="Dashboards and folders, including widget layout",
        note=(
            "Filtered on owner_uuid, not creator_uuid: a dashboard the user "
            "authored but transferred to an org is org property. entity_uuid "
            "and entity_share are cleared on import."
        ),
    ),
    TableSpec(
        model=models.DashboardSave,
        link_column="dashboard_item_uuid",
        label="Dashboard version history",
        optional=True,
        note=(
            "Linked via dashboard_item, not user. Off by default -- one row "
            "per save makes this the largest table by volume. --include-history."
        ),
    ),
    TableSpec(
        model=models.UserApp,
        link_column="user_uuid",
        label="Workspace apps",
        note="entity/share flags are cleared on import.",
    ),
    # -- AI, agents and chat.
    TableSpec(
        model=models.CustomCopilot,
        link_column="user_uuid",
        label="Custom copilots / BYO agents",
        note=(
            "headers and copilots are EncryptedType -- exported plaintext, "
            "re-encrypted on import. UNIQUE on (user_uuid, url)."
        ),
    ),
    TableSpec(
        model=models.MCPServers,
        link_column="user_uuid",
        label="MCP server configurations",
    ),
    TableSpec(
        model=models.CopilotChat,
        link_column="user_uuid",
        label="Copilot chats",
    ),
    TableSpec(
        model=models.ChatMessages,
        link_column="user_uuid",
        label="Copilot chat messages",
        note=(
            "The actual conversation text. FKs copilot_chat.uuid, so it is "
            "inserted after it."
        ),
    ),
    TableSpec(
        model=models.CopilotChatOld,
        link_column="user_uuid",
        label="Pre-refactor copilot chats",
        note=(
            "The copilot chat refactor renamed the old table aside; "
            "migrate_duplicate_copilot_chats copies rows into copilot_chat in "
            "the background WITHOUT deleting the originals, so a migrated "
            "account holds every chat in both places (observed on a real "
            "account: 251 rows in each). Always exported, but imported only "
            "when copilot_chat is empty -- otherwise loading it would duplicate "
            "the user's entire chat history. An account the worker never "
            "reached has its only copy here, which is why it is not simply "
            "dropped."
        ),
    ),
    TableSpec(
        model=models.UserPrompts,
        link_column="user_uuid",
        label="Saved prompts",
    ),
    TableSpec(
        model=models.UserSkills,
        link_column="user_uuid",
        label="Agent skills",
        note="UNIQUE on (user_uuid, slug).",
    ),
    # -- Preferences.
    TableSpec(
        model=models.TradingView,
        link_column="user_uuid",
        label="TradingView chart state and settings",
    ),
    TableSpec(
        model=models.EnabledWidgetBundles,
        link_column="user_uuid",
        label="Enabled widget bundles and disabled widgets",
    ),
    # -- Preserved for completeness, not replayed. See EXCLUDED note below.
    TableSpec(
        model=models.DONT_USE_CopilotChats,
        link_column="user_uuid",
        label="Legacy copilot chat blob (archived, not imported)",
        optional=True,
        note=(
            "Superseded by copilot_chat. Exported under --include-legacy so "
            "old accounts lose nothing, but the importer never writes it."
        ),
    ),
]

# Specs the importer skips even when present in the archive.
NOT_IMPORTED: frozenset[str] = frozenset({
    models.DONT_USE_CopilotChats.__tablename__,
    # Uploaded files are handed back to the user as a folder in the archive,
    # not reinstated in the destination. See the StoredFile spec above.
    models.StoredFile.__tablename__,
})


# --------------------------------------------------------------------------- #
# EXCLUDED -- user-linked, deliberately left behind.
# --------------------------------------------------------------------------- #
EXCLUDED: list[ExcludedTable] = [
    ExcludedTable(
        "session", "user_uuid", "Live bearer tokens for a service being shut down."
    ),
    ExcludedTable("login", "user_uuid", "Login audit trail with IP and geolocation."),
    ExcludedTable(
        "personal_access_token",
        "user_uuid",
        "Only token_hash and token_prefix are stored; the tokens themselves are "
        "unrecoverable by design, so the rows would import as dead metadata.",
    ),
    ExcludedTable(
        "developer_onboarding", "user_uuid", "Signup survey answers; no product value."
    ),
    ExcludedTable(
        "user_role",
        "user_uuid",
        "Org RBAC. Lite bootstraps its own entity and Admin/User permission "
        "maps, so Hub role rows would dangle.",
    ),
    ExcludedTable(
        "permissions_invite", "user_uuid", "Pending org invitations to a dead service."
    ),
    ExcludedTable(
        "user_pro_invite", "inviting_user_uuid", "Invitations the user sent to others."
    ),
    ExcludedTable(
        "dashboard_share",
        "shared_user_uuid",
        "Dashboards shared *to* the user are owned by another account. Out of "
        "scope per strictly-user-owned; the owner exports their own copy.",
    ),
    ExcludedTable(
        "user_app_share", "shared_user_uuid", "Apps shared to the user; see above."
    ),
    ExcludedTable(
        "stored_file_share", "creater_uuid", "File shares to other accounts; see above."
    ),
    ExcludedTable(
        "entitlement", "user_uuid", "Hub billing tier. Meaningless in Lite."
    ),
    ExcludedTable("entitlement_usage", "user_uuid", "Hub quota counters."),
    ExcludedTable(
        "user_app_subscription", "user_uuid", "Marketplace subscriptions; no "
        "marketplace in Lite."
    ),
    ExcludedTable("rate_vendor_app", "user_uuid", "Marketplace app reviews."),
    ExcludedTable("vendor", "owner_uuid", "Marketplace publisher identity."),
    ExcludedTable("vendor_app", "owner_uuid", "Marketplace published listings."),
    ExcludedTable(
        "audit_entity_roles_permissions",
        "performed_by_uuid",
        "Org admin audit log; belongs to the entity, not the user.",
    ),
]


# --------------------------------------------------------------------------- #
# Destination-side overrides
#
# Columns the importer forces regardless of what the archive says, because the
# source value is either meaningless or actively unsafe at the destination.
# Every entry here is a value that would otherwise break the insert or carry a
# dead reference into the new database.
# --------------------------------------------------------------------------- #
IMPORT_OVERRIDE_REASONS: dict[str, dict[str, str]] = {
    "user": {
        "password": (
            "Never carried over. PasswordType re-hashes on write, and the "
            "chosen policy is admin-set-only, so the importer writes an "
            "unguessable random value nobody holds and the Lite admin assigns "
            "a real password."
        ),
        "temporary_password": "Flags the account as needing a password set.",
        "confirmed": (
            "Login rejects unconfirmed accounts. The user already confirmed on "
            "Hub, so re-confirming in Lite would be a dead end -- there is no "
            "confirmation email to receive."
        ),
        "is_superuser": "Hub superuser status does not transfer to a new instance.",
        "deleted": "A soft-deleted Hub account imports as a live Lite account.",
        "stripe_id": "No billing in Lite.",
        "billing_active": "No billing in Lite.",
    },
    "api_source": {
        "vendor_app_uuid": (
            "Points at a marketplace listing, which is EXCLUDED and will never "
            "exist in Lite. With PRAGMA foreign_keys=ON this would fail the "
            "insert outright."
        ),
        "entity_uuid": "Org ownership does not transfer; these become personal.",
    },
    "dashboard_item": {
        "entity_uuid": "Org ownership does not transfer.",
        "entity_share": "Nothing to share with in a single-user instance.",
        "is_shared": "Share state is meaningless without the other accounts.",
    },
    "user_app": {"is_shared": "Share state is meaningless without the other accounts."},
}


def import_overrides(spec: TableSpec) -> dict[str, Any]:
    """Values the importer forces onto every row of ``spec``.

    ``permissions_uuid`` is deliberately absent: it has to be resolved against
    the live Lite database at import time, so the import script sets it.
    """
    if spec.table == "user":
        return {
            # Long, random, and immediately discarded -- nobody can use it.
            "password": secrets.token_urlsafe(48),
            "temporary_password": True,
            "confirmed": True,
            "is_superuser": False,
            "deleted": False,
            "stripe_id": None,
            "billing_active": False,
        }
    if spec.table == "api_source":
        return {"vendor_app_uuid": None, "entity_uuid": None}
    if spec.table == "dashboard_item":
        return {"entity_uuid": None, "entity_share": False, "is_shared": False}
    if spec.table == "user_app":
        return {"is_shared": False}
    return {}


# --------------------------------------------------------------------------- #
# Non-table assets travelling in the archive.
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class AssetSpec:
    name: str
    label: str
    note: str = ""


ASSETS: list[AssetSpec] = [
    AssetSpec(
        "files/",
        "Uploaded file blobs -- yours to keep, not imported",
        "One per stored_file row, keyed by s3_file_name, downloaded from object "
        "storage at export. The import never writes these anywhere: they are in "
        "the archive so the user keeps their own copy of the files.",
    ),
    AssetSpec(
        "files/profile-pictures/",
        "Profile picture -- yours to keep, not imported",
        "Present only when user.has_profile_url is set.",
    ),
]


# --------------------------------------------------------------------------- #
# Lookups and reporting
# --------------------------------------------------------------------------- #
def included_specs(
    *, include_history: bool = False, include_legacy: bool = False
) -> list[TableSpec]:
    """The specs active for a given run, in insert order."""
    optional_on = {
        models.DashboardSave.__tablename__: include_history,
        models.DONT_USE_CopilotChats.__tablename__: include_legacy,
    }
    return [s for s in INCLUDED if not s.optional or optional_on.get(s.table, False)]


def spec_by_table(table: str) -> TableSpec | None:
    return next((s for s in INCLUDED if s.table == table), None)


def redacted_columns(spec: TableSpec) -> tuple[str, ...]:
    """Every column dropped for this spec, restricted to ones it actually has.

    GLOBAL_REDACT is applied to all tables defensively, but only ``user`` owns
    columns like ``password`` -- so filter to real columns to keep
    ``describe()`` honest about what is being dropped from where.
    """
    present = set(spec.model.__table__.columns.keys())
    ordered = dict.fromkeys(GLOBAL_REDACT + spec.redact)
    return tuple(c for c in ordered if c in present)


def _describe_spec(spec: TableSpec) -> list[str]:
    flags = []
    if spec.optional:
        flags.append("optional")
    if spec.table in NOT_IMPORTED:
        flags.append("archive only, never imported")
    suffix = f"  [{', '.join(flags)}]" if flags else ""

    lines = [
        f"  {spec.table}{suffix}",
        f"      {spec.label}",
        f"      linked by: {spec.link_column}",
    ]
    if dropped := redacted_columns(spec):
        lines.append(f"      dropped:   {', '.join(dropped)}")
    if forced := import_overrides(spec):
        lines.append(f"      on import: {', '.join(sorted(forced))} reset")
    if spec.note:
        lines.append(f"      note:      {spec.note}")
    lines.append("")
    return lines


def _describe_assets() -> list[str]:
    lines = ["ASSETS", ""]
    for asset in ASSETS:
        lines += [f"  {asset.name}", f"      {asset.label}"]
        if asset.note:
            lines.append(f"      note:      {asset.note}")
        lines.append("")
    return lines


def _describe_overrides() -> list[str]:
    lines = ["RESET ON IMPORT -- source values that do not travel", ""]
    for table, reasons in IMPORT_OVERRIDE_REASONS.items():
        lines.append(f"  {table}")
        lines += [f"      {column}: {reason}" for column, reason in reasons.items()]
        lines.append("")
    return lines


def _describe_excluded() -> list[str]:
    lines = ["EXCLUDED -- user-linked data deliberately left behind", ""]
    for ex in EXCLUDED:
        lines += [f"  {ex.table} (via {ex.link_column})", f"      {ex.reason}", ""]
    return lines


def describe(*, include_history: bool = False, include_legacy: bool = False) -> str:
    """Render the scope as human-readable text.

    Surfaced by ``--describe-scope`` on both commands and embedded in the
    archive README so the contract ships with the data.
    """
    active = included_specs(
        include_history=include_history, include_legacy=include_legacy
    )

    lines = [
        f"OpenBB user data scope (version {SCOPE_VERSION})",
        "",
        "EXPORTED -- listed in import order",
        "",
    ]
    for spec in active:
        lines += _describe_spec(spec)

    if skipped := [s for s in INCLUDED if s not in active]:
        lines += ["NOT EXPORTED IN THIS RUN -- available behind a flag", ""]
        lines += [f"  {s.table} -- {s.label}" for s in skipped]
        lines.append("")

    lines += _describe_assets()
    lines += _describe_overrides()
    lines += _describe_excluded()

    return "\n".join(lines)


if __name__ == "__main__":
    # Written straight to stdout rather than logged: this is a document meant to
    # be read or redirected to a file, not an operational message.
    sys.stdout.write(describe(include_history=True, include_legacy=True) + "\n")
