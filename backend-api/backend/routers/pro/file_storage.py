"""Pro file storage endpoints."""

import asyncio
import contextlib
import io
import json
from datetime import timedelta
from typing import Annotated, Any
from uuid import UUID, uuid4
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import false, insert, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from api import auth_helpers, schemas
from api.database import aget_read_db, aget_write_db
from api.helpers import refresh_usage_cache
from api.models.tauri_models import PostStoredFile, StoredFile
from api.schemas import SuccessReturn
from api.storage import FileStorage
from routers.pro.helpers import get_dashboard_shared_file_uuids, get_shared_file_uuids
from utilities.config import settings

router = APIRouter(
    prefix="/pro",
    tags=["pro-file-storage"],
    dependencies=[Depends(auth_helpers.check_openbb)],
)


@router.post("/files", response_model=list[schemas.PendingFileReturn])
async def post_files(
    files: list[UploadFile],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    """Upload multiple files to the file storage bucket.

    The files will be stored in S3 and a reference to them will be
    created in the database to be later linked to a file widget.

    If the file is not used in a file widget within 24 hours,
    it will be automatically deleted from the S3 bucket.
    """

    tasks = []
    for item in files:
        if not item.filename:
            continue

        file_ending = item.filename.split(".")[-1].lower()
        s3_file = f"{uuid4()}.{file_ending}"

        fs = await item.read()
        filesize = len(fs)

        model = schemas.StoredFileSchema(
            creater_uuid=user.uuid,
            s3_file_name=s3_file,
            bucket=settings.get_file_bucket(),
            original_file_name=item.filename,
            extension=file_ending,
            size=filesize,
        )

        item.file.seek(0)
        tasks.append(
            asyncio.create_task(FileStorage.upload_pending_file(item.file, model))
        )

    gathered: list[schemas.StoredFileSchema] = await asyncio.gather(*tasks)

    processed_files: list[schemas.StoredFileSchema] = []
    for item in gathered:
        if not isinstance(item, schemas.StoredFileSchema):
            continue

        processed_files.append(item.as_return())

        if item.failed:
            continue

        try:
            pending_dict = item.model_dump(exclude={"failed"})
            await db.execute(insert(StoredFile).values(**pending_dict))
            await db.commit()

            settings.redis_cache(item.uuid, pending_dict, timedelta(days=1))

        except Exception as exc:
            logger.exception(exc)
            await FileStorage.delete_file(settings.get_file_bucket(), item.s3_file_name)

    refresh_usage_cache(user.uuid)
    return processed_files


async def get_user_stored_file(
    file_name: str, user: Any | None, db: AsyncSession
) -> StoredFile:
    file_uuid = file_name.split(".", maxsplit=1)[0]
    user_uuid = getattr(user, "uuid", None)

    checks = [StoredFile.s3_file_name == file_name]

    with contextlib.suppress(ValueError):
        uuid_obj = UUID(file_uuid)
        checks.append(StoredFile.uuid == uuid_obj)

    query = select(StoredFile).where(or_(*checks))

    if user is not None:
        # Authenticated request — enforce ownership / global / share-table access.
        # Unauthenticated callers (presigned URL flow) have already proven access
        # via signature verification before getting here.
        shared_file_uuids = await get_shared_file_uuids(db, user)
        query = query.where(
            or_(
                StoredFile.creater_uuid == user_uuid,
                StoredFile.is_global.is_(True),
                StoredFile.uuid.in_(shared_file_uuids),
            ),
        )

    query_file = await db.execute(query.limit(1))

    stored_file = query_file.scalar_one_or_none()
    if not stored_file and (cache := settings.redis_cache(file_uuid)):
        stored_file = schemas.StoredFileSchema(**cache)
        if user_uuid and stored_file.creater_uuid != user_uuid:
            raise HTTPException(403, detail="User does not have access to this file")

    if not await FileStorage.check_file_exists(stored_file):
        raise HTTPException(404, detail="File not found")

    return stored_file


@router.get("/files/{file_name}", response_class=StreamingResponse)
async def get_file(
    file_name: str,
    user=Depends(auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)),
    db: AsyncSession = Depends(aget_read_db),
):
    """Get a file from the file storage bucket."""
    stored_file = await get_user_stored_file(file_name, user, db)

    return FileStorage.get_stream(stored_file)


@router.get("/files/presigned/{file_name}", response_class=StreamingResponse)
async def get_signed_file(
    file_name: str,
    Expires: int,
    Signature: str,
    db: AsyncSession = Depends(aget_read_db),
):
    """Get a file from the local file storage bucket using a pre-signed URL.

    This endpoint is used for local storage pre-signed URLs, which are validated
    using the signature and expiration time.
    """

    if (
        storage_info := FileStorage.validate_presigned_url(
            file_name, Expires, Signature
        )
    ) is None:
        raise HTTPException(403, detail="Invalid or expired pre-signed URL")

    stored_file = await get_user_stored_file(storage_info["s3_file_name"], None, db)
    return FileStorage.get_stream(stored_file)


@router.get(
    "/files/{file_name}/presigned-url", response_model=schemas.PreSignedUrlReturn
)
async def get_presigned_url(
    file_name: str,
    expiration: int = 3600,
    user=Depends(auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)),
    db: AsyncSession = Depends(aget_read_db),
):
    """Get a pre-signed URL for a file in the file storage bucket."""
    stored_file = await get_user_stored_file(file_name, user, db)
    presign_url = await FileStorage.create_presigned_url(
        stored_file.bucket, stored_file.s3_file_name, expiration
    )

    return schemas.PreSignedUrlReturn(
        **stored_file.__dict__, pre_signed_url=presign_url
    )


@router.delete("/files/{file_uuid}", response_model=SuccessReturn)
async def delete_file(
    file_uuid: UUID,
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    select_query = select(StoredFile).where(
        StoredFile.uuid == file_uuid, StoredFile.creater_uuid == user.uuid
    )
    results = await db.execute(select_query)
    if not (result := results.scalar_one_or_none()):
        raise HTTPException(404, detail="File not found")

    if not await FileStorage.delete_file(result.bucket, result.s3_file_name):
        raise HTTPException(400, detail="Unable to delete file")

    await db.delete(result)
    await db.commit()

    refresh_usage_cache(user.uuid)
    return SuccessReturn.success_instance()


@router.delete("/files", response_model=SuccessReturn)
async def delete_files(
    data: Annotated[
        schemas.DeleteStoredFiles, Body(..., description="The files to delete")
    ],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    select_query = select(StoredFile).where(
        StoredFile.uuid.in_(data.file_uuids),
        StoredFile.creater_uuid == user.uuid,
    )
    query_results = await db.execute(select_query)
    if not (results := query_results.scalars().all()):
        raise HTTPException(404, detail="Files not found")

    tasks = [
        asyncio.create_task(
            FileStorage.delete_file(
                result.bucket,
                result.s3_file_name,
            )
        )
        for result in results
    ]

    gathered = await asyncio.gather(*tasks, return_exceptions=True)
    for idx, item in enumerate(gathered):
        instance = results[idx]

        if isinstance(item, Exception):
            logger.error(f"Failed to delete file: {results[idx].s3_file_name}")
            if isinstance(instance, StoredFile):
                instance.file_widget_uuid = None
            continue

        await db.delete(instance)

    await db.commit()

    refresh_usage_cache(user.uuid)
    return SuccessReturn.success_instance()


@router.post("/files/download", response_class=StreamingResponse)
async def get_files(
    files: Annotated[
        list[PostStoredFile], Body(..., description="The files to download")
    ],
    user=Depends(auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)),
    db: AsyncSession = Depends(aget_read_db),
):
    """Get a zip file of multiple files from the file storage bucket based on the file UUIDs or filenames provided."""

    shared_file_uuids = await get_shared_file_uuids(db, user)

    stored_file_query = (
        select(StoredFile)
        .where(or_(false(), *[f.filter_element() for f in files]))
        .where(
            or_(
                StoredFile.creater_uuid == user.uuid,
                StoredFile.is_global.is_(True),
                StoredFile.uuid.in_(shared_file_uuids),
            )
        )
    )
    stored_files = (await db.execute(stored_file_query)).scalars().all()

    tasks: list[asyncio.Task[bytes]] = []
    file_manifests: list[schemas.DownloadManifest] = []
    for file in files:
        file_dict = {"s3_file_name": "", "manifest": {}}
        model: StoredFile | None = file.to_stored_file(stored_files)

        if isinstance(model, StoredFile):
            file_dict.update(
                s3_file_name=model.s3_file_name,
                manifest=schemas.DownloadManifest.model_validate(model),
            )
        elif file.filename:
            file_dict.update(
                s3_file_name=file.filename,
                manifest=schemas.DownloadManifest(
                    **{
                        "file_name": file.filename,
                        "original_file_name": file.filename,
                        "extension": file.filename.split(".")[-1],
                    }
                ),
            )

        if not file_dict["s3_file_name"]:
            continue

        s3_file_name, manifest = file_dict.values()
        file_manifests.append(manifest)
        tasks.append(
            asyncio.create_task(
                FileStorage.get_file(settings.get_file_bucket(), s3_file_name)
            )
        )

    zip_io = io.BytesIO()
    file_name = ""

    failed_indexes = []
    with (ZipFile(zip_io, mode="w", compression=ZIP_DEFLATED) as tmp_zip,):
        gathered = await asyncio.gather(*tasks, return_exceptions=True)
        for idx, item in enumerate(gathered):
            file_name = file_manifests[idx].file_name

            if isinstance(item, Exception) or item is None:
                logger.error(f"Failed to download file: {file_name}")
                failed_indexes.append(idx)
                continue

            tmp_zip.writestr(file_name, item)

        for idx in failed_indexes:
            file_manifests.pop(idx)

        tmp_zip.writestr(
            "file_manifest.json", json.dumps(jsonable_encoder(file_manifests))
        )

    total_files = len(file_manifests)
    if total_files == 0:
        raise HTTPException(404, detail="No files found")

    return StreamingResponse(
        iter([zip_io.getvalue()]),
        media_type="application/x-zip-compressed",
        headers={
            "Content-Disposition": f"attachment; filename={user.uuid}_files_{total_files}.zip",
        },
        background=BackgroundTask(zip_io.close),
    )


@router.get("/files", response_model=list[schemas.StoredFileReturn])
async def get_user_stored_files(
    dashboard_uuid: UUID | None = None,
    user=Depends(auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)),
    db: AsyncSession = Depends(aget_read_db),
):
    """Get all stored files for a user. This includes files that are not linked to a file widget."""
    shared_file_uuids = await get_dashboard_shared_file_uuids(db, user, dashboard_uuid)

    select_query = select(StoredFile).where(
        or_(
            StoredFile.creater_uuid == user.uuid,
            StoredFile.is_global.is_(True),
            StoredFile.uuid.in_(shared_file_uuids),
        )
    )
    return (await db.execute(select_query)).scalars().all()
