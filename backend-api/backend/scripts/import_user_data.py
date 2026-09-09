"""Import an exported OpenBB account into this instance.

    python -m scripts.import_user_data /import/openbb-export-you-20260811.zip

Reads the archive produced by ``scripts.export_user_data`` and recreates the
account here. The archive is read directly -- there is no need to unzip it
first.

Design notes:

* **UUIDs are preserved.** Dashboard and app content are opaque gzipped blobs
  that internally reference backend, widget and file UUIDs. Rewriting identity
  would mean rewriting blob internals, so instead every UUID -- including the
  user's own -- is carried across unchanged. Collisions between UUID4s in a
  fresh database are not a practical concern.
* **Only ``permissions_uuid`` is remapped**, because it must point at a
  permission map that exists in *this* database.
* **The account has no usable password.** See ``user_data_scope`` for why. The
  admin sets one after the import.

Everything that travels, and everything reset on arrival, is defined by
``scripts.user_data_scope`` -- run ``--describe-scope`` to print it.
"""

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from uuid import UUID
from zipfile import BadZipFile, ZipFile

from loguru import logger
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from api import models
from api.database import aget_write_db
from scripts import (
    user_data_scope as scope,
    user_data_serde as serde,
)

SUPPORTED_MANIFEST_VERSIONS = {1}


class ImportError_(Exception):
    """Fatal problem that should stop the import."""


@dataclass
class ImportResult:
    email: str
    user_uuid: UUID
    inserted: dict[str, int] = field(default_factory=dict)
    archived_files: int = 0
    """Blobs present in the archive. They are not written anywhere -- the user
    keeps them from the archive's files/ folder."""
    skipped_tables: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    replaced: bool = False

    @property
    def total_rows(self) -> int:
        return sum(self.inserted.values())


# --------------------------------------------------------------------------- #
# Archive reading
# --------------------------------------------------------------------------- #
def open_archive(path: Path) -> ZipFile:
    if not path.exists():
        raise ImportError_(f"No such archive: {path}")
    try:
        return ZipFile(path)
    except BadZipFile as exc:
        raise ImportError_(f"{path} is not a readable zip archive: {exc}") from exc


def read_manifest(zf: ZipFile) -> dict[str, Any]:
    try:
        manifest = json.loads(zf.read("manifest.json"))
    except KeyError as exc:
        raise ImportError_(
            "Archive has no manifest.json -- it was not produced by "
            "scripts.export_user_data."
        ) from exc

    version = manifest.get("manifest_version")
    if version not in SUPPORTED_MANIFEST_VERSIONS:
        raise ImportError_(
            f"Archive manifest version {version} is not supported by this build "
            f"(supports {sorted(SUPPORTED_MANIFEST_VERSIONS)}). Use a matching "
            "version of OpenBB Lite."
        )

    if manifest.get("scope_version") != scope.SCOPE_VERSION:
        raise ImportError_(
            f"Archive was written against scope version "
            f"{manifest.get('scope_version')}, this build expects "
            f"{scope.SCOPE_VERSION}. The set of exported tables has changed; "
            "re-export with a matching version."
        )

    return manifest


def read_rows(zf: ZipFile, spec: scope.TableSpec) -> list[dict[str, Any]] | None:
    """Parse one table's JSONL. None means the archive does not contain it."""
    try:
        body = zf.read(f"data/{spec.filename}").decode("utf-8")
    except KeyError:
        return None
    return [serde.loads_line(line) for line in body.splitlines() if line.strip()]


# --------------------------------------------------------------------------- #
# Destination lookups
# --------------------------------------------------------------------------- #
async def resolve_permissions_uuid(db: AsyncSession) -> UUID:
    """Find this instance's non-admin permission map.

    init_users creates exactly two per entity, "Admin" and "User". Imported
    accounts join as regular users.
    """
    maps = (
        (
            await db.execute(
                select(models.PermissionsEntityMap).where(
                    models.PermissionsEntityMap.name == "User"
                )
            )
        )
        .scalars()
        .all()
    )
    if not maps:
        raise ImportError_(
            "No 'User' permission map exists in this database. The instance has "
            "not finished first-time setup -- start it once and try again."
        )
    if len(maps) > 1:
        raise ImportError_(
            f"Found {len(maps)} 'User' permission maps; cannot choose one "
            "automatically. This does not look like a single-tenant instance."
        )
    return maps[0].uuid


async def find_conflicts(
    db: AsyncSession, user_uuid: UUID, email: str
) -> tuple[models.User | None, models.User | None]:
    by_uuid = (
        await db.execute(select(models.User).where(models.User.uuid == user_uuid))
    ).scalar_one_or_none()
    by_email = (
        await db.execute(select(models.User).where(models.User.email == email))
    ).scalar_one_or_none()
    return by_uuid, by_email


async def unique_username(db: AsyncSession, wanted: str | None) -> str | None:
    """Usernames are UNIQUE; suffix until free rather than failing the import."""
    if not wanted:
        return wanted
    candidate, n = wanted, 1
    while (
        await db.execute(select(models.User.uuid).where(models.User.username == candidate))
    ).scalar_one_or_none() is not None:
        n += 1
        candidate = f"{wanted}-{n}"
    return candidate


async def clear_previous_import(
    db: AsyncSession, user_uuid: UUID, email: str, *, force: bool
) -> bool:
    """Make room for the account, or refuse. Returns True if rows were removed."""
    by_uuid, by_email = await find_conflicts(db, user_uuid, email)
    if not (by_uuid or by_email):
        return False

    if not force:
        existing = by_uuid or by_email
        raise ImportError_(
            f"An account for {existing.email} already exists here. "
            "Re-run with --force to replace the previously imported data, "
            "or import into a fresh instance."
        )
    if by_email and by_uuid and by_email.uuid != by_uuid.uuid:
        raise ImportError_(
            f"{email} is already used by a different account here. Rename "
            "or remove it before importing."
        )

    target = by_uuid or by_email
    logger.warning(f"  replacing existing account {target.email}")
    await purge_user(db, target.uuid)
    return True


async def purge_user(db: AsyncSession, user_uuid: UUID) -> None:
    """Delete an existing imported account, children first.

    Only touches rows the importer itself would have created.
    """
    for spec in reversed(scope.INCLUDED):
        if spec.table in scope.NOT_IMPORTED:
            continue
        model = spec.model
        if spec.table == "user":
            await db.execute(delete(model).where(model.uuid == user_uuid))
        elif spec.table == "dashboard_save":
            owned = select(models.DashboardItem.uuid).where(
                models.DashboardItem.owner_uuid == user_uuid
            )
            await db.execute(
                delete(model).where(model.dashboard_item_uuid.in_(owned))
            )
        else:
            await db.execute(
                delete(model).where(getattr(model, spec.link_column) == user_uuid)
            )


# --------------------------------------------------------------------------- #
# Blobs
#
# There is deliberately no blob restore step. Uploaded files travel in the
# archive's files/ folder so the user keeps their own copy, but they are not
# written into this instance's storage and the stored_file rows that point at
# them are not loaded either (see NOT_IMPORTED in user_data_scope).
# --------------------------------------------------------------------------- #
def duplicate_chat_warning(
    spec: scope.TableSpec, payloads: list[dict[str, Any]], migrated_chats: int
) -> str | None:
    """Whether ``copilot_chat_old`` would duplicate history already imported.

    migrate_duplicate_copilot_chats copies rows from copilot_chat_old into
    copilot_chat and does *not* delete the originals, so a migrated account
    holds every conversation in both tables -- loading both doubles their
    history. An account the worker never reached has its only copy in the old
    table, so it is loaded whenever copilot_chat came through empty.

    Returns the warning to record when the rows should be skipped, else None.
    """
    if spec.table != "copilot_chat_old" or not payloads or not migrated_chats:
        return None
    return (
        f"{len(payloads)} pre-refactor chat(s) were skipped: the same "
        f"conversations are already present as {migrated_chats} migrated "
        "chat(s). They remain in the archive."
    )


def count_archived_files(zf: ZipFile) -> int:
    """How many file blobs the archive carries, for the closing summary."""
    return sum(
        1 for n in zf.namelist() if n.startswith("files/") and not n.endswith("/")
    )


# --------------------------------------------------------------------------- #
# Import
# --------------------------------------------------------------------------- #
async def import_archive(archive_path: Path, *, force: bool = False) -> ImportResult:
    zf = open_archive(archive_path)
    manifest = read_manifest(zf)

    email = manifest["user"]["email"]
    user_uuid = UUID(manifest["user"]["uuid"])
    result = ImportResult(email=email, user_uuid=user_uuid)

    async for db in aget_write_db():
        result.replaced = await clear_previous_import(db, user_uuid, email, force=force)
        permissions_uuid = await resolve_permissions_uuid(db)

        # How many post-refactor chats the archive carried. Decides whether the
        # pre-refactor copilot_chat_old rows are a duplicate or the only copy.
        migrated_chats = 0

        for spec in scope.included_specs(include_history=True, include_legacy=True):
            if spec.table in scope.NOT_IMPORTED:
                if read_rows(zf, spec) is not None:
                    result.skipped_tables.append(spec.table)
                continue

            payloads = read_rows(zf, spec)
            if payloads is None:
                continue

            duplicate_chats = duplicate_chat_warning(spec, payloads, migrated_chats)
            if duplicate_chats is not None:
                result.skipped_tables.append(spec.table)
                result.warnings.append(duplicate_chats)
                continue

            overrides = scope.import_overrides(spec)
            for payload in payloads:
                unknown = serde.unknown_columns(spec, payload)
                if unknown:
                    result.warnings.append(
                        f"{spec.table}: ignored unknown column(s) "
                        f"{', '.join(sorted(unknown))} from a newer export"
                    )

                kwargs = serde.decode_row(spec, payload) | overrides

                if spec.table == "user":
                    kwargs["permissions_uuid"] = permissions_uuid
                    kwargs["username"] = await unique_username(
                        db, kwargs.get("username")
                    )

                db.add(spec.model(**kwargs))

            # Flush per table so a failure names the table that caused it.
            await db.flush()
            result.inserted[spec.table] = len(payloads)
            if spec.table == "copilot_chat":
                migrated_chats = len(payloads)
            if payloads:
                logger.info(f"  {spec.table:<24} {len(payloads):>6} rows")

        result.archived_files = count_archived_files(zf)
        await db.commit()
        return result

    raise ImportError_("Could not open a database session")


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="import_user_data",
        description="Import an exported OpenBB account into this instance.",
    )
    parser.add_argument("archive", nargs="?", help="Path to the export .zip")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace a previously imported copy of this account (deletes its "
        "existing rows first)",
    )
    parser.add_argument(
        "--describe-scope",
        action="store_true",
        help="Print exactly what is imported and what is reset, then exit",
    )
    args = parser.parse_args(argv)

    if args.describe_scope:
        logger.info(scope.describe(include_history=True, include_legacy=True))
        return 0

    if not args.archive:
        parser.error("an archive path is required (or use --describe-scope)")

    logger.info(f"Importing {args.archive}")
    try:
        result = asyncio.run(import_archive(Path(args.archive), force=args.force))
    except ImportError_ as exc:
        logger.error(f"Import failed: {exc}")
        return 1

    logger.info(f"Imported {result.total_rows} rows")
    for table in result.skipped_tables:
        logger.info(f"  note: {table} was archived for preservation and is not loaded")
    for warning in result.warnings:
        logger.warning(warning)

    # Written to stdout, not logged: this is the instruction the person running
    # the import needs to act on, and log formatting buries it.
    sys.stdout.write(
        f"\nThe account {result.email} now exists but has no usable password.\n"
        "To finish:\n"
        "  1. docker exec openbb credentials      # get the admin login\n"
        "  2. Sign in as the admin\n"
        f"  3. Set a password for {result.email}\n"
    )
    if result.archived_files:
        sys.stdout.write(
            f"\nYour {result.archived_files} uploaded file(s) were not imported "
            "by design.\nThey are in the files/ folder of the archive -- unzip "
            "it to keep them.\n"
        )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
