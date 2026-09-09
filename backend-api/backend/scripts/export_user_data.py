"""Export one user's account into a portable archive.

    python -m scripts.export_user_data --email someone@example.com --out ./exports

Produces ``openbb-export-<email>-<timestamp>.zip`` containing the user's rows as
JSONL, their uploaded files, a manifest, and a README telling them how to import
it into OpenBB Lite.

What travels is defined entirely by ``scripts.user_data_scope`` -- run
``--describe-scope`` to print the contract, which is also embedded in the
archive.

Note on secrets: custom backend headers and copilot credentials are written to
the archive as **plaintext**. They have to be, because the destination instance
encrypts under a different key. The archive is therefore as sensitive as the
credentials it carries.
"""

import argparse
import asyncio
import hashlib
import io
import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID
from zipfile import ZIP_DEFLATED, ZipFile

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from api import models
from api.database import aget_read_db
from api.storage import FileStorage
from scripts import (
    user_data_scope as scope,
    user_data_serde as serde,
)
from utilities.config import settings

MANIFEST_VERSION = 1

# Hardcoded in routers/auth.py's profile image upload; not a configurable bucket.
PROFILE_BUCKET = "openbb-assets"

# Blob downloads run concurrently, bounded so a large account cannot exhaust
# the object store's connection pool.
MAX_CONCURRENT_DOWNLOADS = 16


class ExportError(Exception):
    """Fatal problem that should stop the export."""


@dataclass
class TableResult:
    rows: int
    sha256: str
    path: str


@dataclass
class ExportResult:
    archive: Path
    user_uuid: UUID
    email: str
    tables: dict[str, TableResult] = field(default_factory=dict)
    files_written: int = 0
    files_bytes: int = 0
    files_skipped: int = 0
    """Files the account has that were not downloaded (no --with-files)."""
    missing_files: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def total_rows(self) -> int:
        return sum(t.rows for t in self.tables.values())


# --------------------------------------------------------------------------- #
# Queries
# --------------------------------------------------------------------------- #
async def resolve_user(db: AsyncSession, email: str) -> models.User:
    """Find the account by email.

    Soft-deleted accounts have their email rewritten to
    ``deleted-<rand>-<original>``, so an exact match will miss them. We fall
    back to a suffix match and say so, rather than reporting "not found" for an
    account whose data is still fully present.
    """
    exact = (
        await db.execute(select(models.User).where(models.User.email == email))
    ).scalar_one_or_none()
    if exact is not None:
        return exact

    deleted = (
        (
            await db.execute(
                select(models.User).where(models.User.email.like(f"deleted-%-{email}"))
            )
        )
        .scalars()
        .all()
    )
    if len(deleted) == 1:
        return deleted[0]
    if len(deleted) > 1:
        raise ExportError(
            f"{email} matches {len(deleted)} soft-deleted accounts "
            f"({', '.join(u.email for u in deleted)}). Export by exact email."
        )

    raise ExportError(f"No account found for {email}")


def build_query(spec: scope.TableSpec, user_uuid: UUID, dashboard_uuids: list[UUID]):
    """The SELECT that pulls this table's rows for one user."""
    model = spec.model

    if spec.table == "user":
        return select(model).where(model.uuid == user_uuid)

    if spec.table == "dashboard_save":
        # Linked through dashboard_item rather than directly to the user.
        if not dashboard_uuids:
            return None
        return select(model).where(model.dashboard_item_uuid.in_(dashboard_uuids))

    if spec.table == "copilot_chat":
        # CopilotChat.messages is lazy="selectin"; copilot_messages is exported
        # as its own table, so suppress the eager load rather than fetching
        # every message twice.
        return (
            select(model)
            .where(model.user_uuid == user_uuid)
            .options(noload(model.messages))
        )

    return select(model).where(getattr(model, spec.link_column) == user_uuid)


# --------------------------------------------------------------------------- #
# Blobs
# --------------------------------------------------------------------------- #
async def fetch_blob(bucket: str, key: str, sem: asyncio.Semaphore) -> bytes | None:
    """Read one object. Returns None when it is missing or unreadable.

    FileStorage.get_file swallows credential and client errors and returns None,
    so a None here is not necessarily "absent" -- the caller records it as
    missing and the operator sees it in the summary.
    """
    async with sem:
        try:
            return await FileStorage.get_file(bucket, key)
        except Exception as exc:  # noqa: BLE001 - one bad object must not abort the run
            logger.warning(f"  ! {key}: {exc}")
            return None


async def collect_blobs(
    stored_files: list[models.StoredFile], user: models.User
) -> tuple[dict[str, bytes], list[str]]:
    """Download every blob the account owns, plus the profile picture."""
    sem = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)

    wanted: list[tuple[str, str, str]] = []  # (archive path, bucket, key)
    for row in stored_files:
        if not row.s3_file_name:
            continue
        bucket = row.bucket or settings.get_file_bucket()
        wanted.append((f"files/{row.s3_file_name}", bucket, row.s3_file_name))

    if user.has_profile_url:
        key = f"profile-pictures/{user.uuid}.png"
        wanted.append((f"files/{key}", PROFILE_BUCKET, key))

    payloads = await asyncio.gather(
        *(fetch_blob(bucket, key, sem) for _, bucket, key in wanted)
    )

    blobs: dict[str, bytes] = {}
    missing: list[str] = []
    for (archive_path, _, key), payload in zip(wanted, payloads, strict=True):
        if payload is None:
            missing.append(key)
        else:
            blobs[archive_path] = payload
    return blobs, missing


# --------------------------------------------------------------------------- #
# Archive assembly
# --------------------------------------------------------------------------- #
def _safe_slug(email: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", email).strip("-").lower()


def _files_section(result: ExportResult) -> str:
    if result.files_skipped:
        return f"""## Your uploaded files

This archive does **not** contain your {result.files_skipped} uploaded file(s) --
only the record of what they were. Ask for an export with files included if you
want the files themselves.
"""
    return """## Your uploaded files

The `files/` folder holds every file you uploaded to OpenBB, plus your profile
picture. **These are not imported into OpenBB Lite** -- they are here so you
keep your own copy.

Unzip the archive and move `files/` somewhere safe before deleting it. If you
want any of them back inside OpenBB Lite, upload them again there.
"""


def build_readme(result: ExportResult, scope_text: str) -> str:
    return f"""# Your OpenBB data

Exported {datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")} for {result.email}.

This archive contains {result.total_rows} records and {result.files_written}
uploaded file(s) from your OpenBB account.

## SECURITY -- read this first

This archive contains **unencrypted credentials**: the authentication headers
for your custom backends and any custom copilots you configured. Anyone who
opens this file can read those credentials.

Store it somewhere private, and delete it once you have imported it -- but see
"Your uploaded files" below first, because that folder is the only copy you get.

{_files_section(result)}
## Importing into OpenBB Lite

1. Install OpenBB Lite and start it, mounting the folder holding this archive:

       docker run -d --name openbb -p 3000:3000 \\
           -v openbb-data:/data \\
           -v /path/to/this/folder:/import \\
           openbb/lite

2. Import this archive:

       docker exec openbb openbb-import /import/{result.archive.name}

3. Get the admin login and sign in at http://localhost:3000

       docker exec openbb credentials

4. As the admin, set a password for your account ({result.email}).
   Your OpenBB password is **not** carried over -- for your safety it was
   never exported.

You can then sign in as {result.email} with the password the admin set.

## What is in here

    manifest.json    what was exported, with checksums
    data/*.jsonl     one file per kind of record
    files/           your uploaded files -- yours to keep, not imported

## Exactly what was and was not exported

{scope_text}
"""


async def build_archive(
    db: AsyncSession,
    email: str,
    *,
    include_history: bool = False,
    include_legacy: bool = False,
    with_files: bool = False,
) -> tuple[bytes, ExportResult]:
    """Produce the archive in memory from an existing session.

    Split out from ``export_user`` so the admin API endpoint can stream the same
    bytes without going through the filesystem.
    """
    specs = scope.included_specs(
        include_history=include_history, include_legacy=include_legacy
    )

    # Fail before touching the database if the schema and codec disagree.
    for spec in specs:
        serde.assert_password_never_encoded(spec)

    user = await resolve_user(db, email)
    result = ExportResult(archive=Path(), user_uuid=user.uuid, email=str(user.email))
    result.archive = Path(
        f"openbb-export-{_safe_slug(email)}-"
        f"{datetime.now(UTC).strftime('%Y%m%d-%H%M%S')}.zip"
    )
    if user.deleted:
        result.warnings.append(
            f"Account is soft-deleted on Hub (stored email {user.email!r}). "
            "Its data is intact and has been exported."
        )

    # dashboard_save hangs off dashboard_item, so those UUIDs come first.
    dashboard_uuids: list[UUID] = list(
        (
            await db.execute(
                select(models.DashboardItem.uuid).where(
                    models.DashboardItem.owner_uuid == user.uuid
                )
            )
        )
        .scalars()
        .all()
    )

    encoded: dict[str, str] = {}
    stored_files: list[models.StoredFile] = []

    for spec in specs:
        query = build_query(spec, user.uuid, dashboard_uuids)
        rows = [] if query is None else list((await db.execute(query)).scalars().all())
        if spec.table == "stored_file":
            stored_files = rows

        body = "".join(
            serde.dumps_line(serde.encode_row(spec, row)) + "\n" for row in rows
        )
        encoded[spec.filename] = body
        result.tables[spec.table] = TableResult(
            rows=len(rows),
            sha256=hashlib.sha256(body.encode("utf-8")).hexdigest(),
            path=f"data/{spec.filename}",
        )
        logger.info(f"  {spec.table:<24} {len(rows):>6} rows")

    # Downloading blobs dominates the runtime -- on a real account, 160 files
    # took 47s of a 53s export, close enough to a 60s proxy idle timeout to fail
    # for anyone with more. Off unless asked for.
    blobs: dict[str, bytes] = {}
    missing: list[str] = []
    if with_files:
        logger.info(f"  {'files':<24} {len(stored_files):>6} to download")
        blobs, missing = await collect_blobs(stored_files, user)
        result.files_written = len(blobs)
        result.files_bytes = sum(len(b) for b in blobs.values())
        result.missing_files = missing
        if missing:
            result.warnings.append(
                f"{len(missing)} file(s) could not be read from storage and are "
                "absent from the archive: " + ", ".join(missing[:10])
            )
    elif stored_files or user.has_profile_url:
        result.files_skipped = len(stored_files)
        logger.info(
            f"  {'files':<24} {len(stored_files):>6} not downloaded "
            "(pass --with-files to include them)"
        )

    scope_text = scope.describe(
        include_history=include_history, include_legacy=include_legacy
    )
    manifest = {
        "manifest_version": MANIFEST_VERSION,
        "scope_version": scope.SCOPE_VERSION,
        "serde_version": serde.SERDE_VERSION,
        "exported_at": datetime.now(UTC).isoformat(),
        "source": {
            "database_type": settings.DATABASE_TYPE,
            "storage_provider": settings.STORAGE_PROVIDER,
        },
        "user": {
            "uuid": str(user.uuid),
            "email": str(user.email),
            "first_name": user.first_name,
            "last_name": user.last_name,
        },
        "options": {
            "include_history": include_history,
            "include_legacy": include_legacy,
            "with_files": with_files,
        },
        "tables": {
            name: {"rows": t.rows, "sha256": t.sha256, "path": t.path}
            for name, t in result.tables.items()
        },
        "files": {
            "count": result.files_written,
            "bytes": result.files_bytes,
            "skipped": result.files_skipped,
            "missing": missing,
        },
        "warnings": result.warnings,
    }

    buffer = io.BytesIO()
    with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))
        zf.writestr("README.md", build_readme(result, scope_text))
        zf.writestr("SCOPE.txt", scope_text)
        for filename, body in encoded.items():
            zf.writestr(f"data/{filename}", body)
        for archive_path, payload in blobs.items():
            zf.writestr(archive_path, payload)

    return buffer.getvalue(), result


async def export_user(
    email: str,
    out_dir: Path,
    *,
    include_history: bool = False,
    include_legacy: bool = False,
    with_files: bool = False,
) -> ExportResult:
    """Export an account to a zip on disk."""
    async for db in aget_read_db():
        payload, result = await build_archive(
            db,
            email,
            include_history=include_history,
            include_legacy=include_legacy,
            with_files=with_files,
        )
        out_dir.mkdir(parents=True, exist_ok=True)
        result.archive = out_dir / result.archive.name
        result.archive.write_bytes(payload)
        return result

    raise ExportError("Could not open a database session")


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="export_user_data",
        description="Export one user's OpenBB account to a portable archive.",
    )
    parser.add_argument("--email", help="Email address of the account to export")
    parser.add_argument(
        "--out", default="./exports", help="Directory to write the archive into"
    )
    parser.add_argument(
        "--include-history",
        action="store_true",
        help="Include dashboard version history (much larger archive)",
    )
    parser.add_argument(
        "--include-legacy",
        action="store_true",
        help="Include the legacy copilot chat table (archived, never imported)",
    )
    parser.add_argument(
        "--with-files",
        action="store_true",
        help="Download the account's uploaded files into the archive. Slow: this "
        "dominates the export time and can exceed proxy timeouts over HTTP.",
    )
    parser.add_argument(
        "--describe-scope",
        action="store_true",
        help="Print exactly what is and is not exported, then exit",
    )
    args = parser.parse_args(argv)

    if args.describe_scope:
        logger.info(
            scope.describe(
                include_history=args.include_history,
                include_legacy=args.include_legacy,
            )
        )
        return 0

    if not args.email:
        parser.error("--email is required (or use --describe-scope)")

    logger.info(f"Exporting {args.email}")
    try:
        result = asyncio.run(
            export_user(
                args.email,
                Path(args.out),
                include_history=args.include_history,
                include_legacy=args.include_legacy,
                with_files=args.with_files,
            )
        )
    except ExportError as exc:
        logger.error(f"Export failed: {exc}")
        return 1

    logger.info(f"Wrote {result.archive}")
    logger.info(
        f"  {result.total_rows} rows, {result.files_written} files "
        f"({result.files_bytes / 1024 / 1024:.1f} MB uncompressed)"
    )
    if result.files_skipped:
        logger.info(
            f"  {result.files_skipped} uploaded file(s) were not included; "
            "re-run with --with-files to download them"
        )
    for warning in result.warnings:
        logger.warning(warning)
    logger.warning(
        "This archive contains unencrypted backend and copilot credentials. "
        "Treat it as a secret and delete it once it has been imported."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
