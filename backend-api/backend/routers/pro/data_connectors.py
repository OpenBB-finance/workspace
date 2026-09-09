"""Pro data connectors API endpoints"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import delete, insert, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api import auth_helpers, crud, helpers, schemas
from api.database import aget_read_db, aget_write_db
from api.models import ApiSource, FileWidget, SingleWidget
from api.models.tauri_models import StoredFile
from api.schemas import SuccessReturn
from api.storage import FileStorage
from utilities.config import settings

router = APIRouter(
    prefix="/pro/data-connectors",
    tags=["pro-data-connectors"],
    dependencies=[Depends(auth_helpers.check_openbb)],
)


@router.get("/single-widget", response_model=list[schemas.ReturnSingleWidget])
async def get_user_single_widgets(
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_read_db),
):
    """Get all single widgets for a user"""
    select_query = select(SingleWidget).where(SingleWidget.user_uuid == user.uuid)

    return (await db.execute(select_query)).scalars().all()


@router.post("/single-widget/{widget_uuid}", response_model=SuccessReturn)
async def post_user_single_widget(
    widget_uuid: UUID,
    pro_info: schemas.CreateSingleWidget,
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    """Add or update a single widget for a user"""
    insert_query = insert(SingleWidget).values(
        uuid=widget_uuid,
        user_uuid=user.uuid,
        **pro_info.model_dump(),
    )
    try:
        await db.execute(insert_query)
    except IntegrityError as exc:
        helpers.handle_duplicate_pk(exc)
        update_query = (
            update(SingleWidget)
            .where(
                SingleWidget.uuid == widget_uuid, SingleWidget.user_uuid == user.uuid
            )
            .values(**pro_info.model_dump())
        )
        await db.execute(update_query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.delete("/single-widget/{widget_uuid}", response_model=SuccessReturn)
async def delete_user_single_widget(
    widget_uuid: Annotated[
        UUID, Path(..., description="The UUID of the widget to delete")
    ],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    """Delete a single widget"""
    query = delete(SingleWidget).where(
        SingleWidget.uuid == widget_uuid, SingleWidget.user_uuid == user.uuid
    )
    await db.execute(query)
    await db.commit()
    return SuccessReturn.success_instance()


@router.get("/file", response_model=list[schemas.ReturnFileWidget])
async def get_user_file_widgets(
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_read_db),
):
    """Get all file widgets for a user"""
    select_query = select(FileWidget).where(FileWidget.user_uuid == user.uuid)
    return (await db.execute(select_query)).scalars().all()


@router.post("/file/{widget_uuid}", response_model=schemas.SuccessReturn)
async def post_user_file_widget(
    widget_uuid: Annotated[
        UUID, Path(..., description="The UUID of the widget to create or update")
    ],
    pro_info: schemas.CreateFileWidget,
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    """Add or update a file widget for a user"""
    cache = settings.redis_cache(pro_info.stored_file_uuid)
    query = await db.execute(
        select(StoredFile).where(StoredFile.file_widget_uuid == widget_uuid)
    )
    stored_file = query.scalar_one_or_none()

    if stored_file is None and not cache:
        raise HTTPException(404, detail="File not found")

    data = pro_info.model_dump(exclude={"stored_file_uuid"})

    insert_query = insert(FileWidget).values(
        uuid=widget_uuid, user_uuid=user.uuid, **data
    )
    update_query = (
        update(FileWidget)
        .where(FileWidget.uuid == widget_uuid, FileWidget.user_uuid == user.uuid)
        .values(**data)
    )

    final_query = insert_query if stored_file is None else update_query

    try:
        await db.execute(final_query)
    except IntegrityError as exc:
        helpers.handle_duplicate_pk(exc)
        await db.execute(update_query)

    if stored_file is None:
        confirm_query = (
            update(StoredFile)
            .where(StoredFile.uuid == pro_info.stored_file_uuid)
            .values(
                file_widget_uuid=widget_uuid,
            )
        )
        await db.execute(confirm_query)
        settings.redis_cache(pro_info.stored_file_uuid, delete=True)

    await db.commit()
    return {"success": True}


@router.delete("/file/{widget_uuid}", response_model=schemas.SuccessReturn)
async def delete_user_file_widget(
    widget_uuid: Annotated[
        UUID, Path(..., description="The UUID of the widget to delete")
    ],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    """Delete a file widget and its associated file"""
    stored_file_query = select(StoredFile).where(
        StoredFile.file_widget_uuid == widget_uuid
    )
    stored_file = (await db.execute(stored_file_query)).scalar_one_or_none()

    if stored_file and not await FileStorage.delete_file(
        stored_file.bucket, stored_file.s3_file_name
    ):
        stored_file.file_widget_uuid = None
        await db.commit()

    query = delete(FileWidget).where(
        FileWidget.uuid == widget_uuid, FileWidget.user_uuid == user.uuid
    )
    await db.execute(query)
    await db.commit()
    return {"success": True}


@router.get("/stored-files", response_model=list[schemas.StoredFileReturn])
async def get_stored_files(
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_read_db),
):
    """Get all stored files for a user."""
    select_query = select(StoredFile).where(StoredFile.creater_uuid == user.uuid)
    return (await db.execute(select_query)).scalars().all()


@router.get("/api-source", response_model=list[schemas.ReturnApiSource])
async def get_user_api_sources(
    user=Depends(auth_helpers.GetCurrentUser(["uuid", "permissions_uuid"], pro=True)),
    db: AsyncSession = Depends(aget_read_db),
):
    """Get all API sources for a user"""
    filters = (ApiSource.user_uuid == user.uuid,)
    if settings.is_onprem():
        entity_uuid = await crud.get_user_entity_uuid(db, user.permissions_uuid)
        filters += (ApiSource.entity_uuid == entity_uuid,)

    select_query = (
        select(ApiSource)
        .where(
            or_(*filters) if settings.is_onprem() else ApiSource.user_uuid == user.uuid
        )
        .order_by(ApiSource.updated_date.desc())
    )
    return (await db.execute(select_query)).scalars().all()


@router.post("/api-source/{source_uuid}", response_model=SuccessReturn)
async def post_user_api_source(
    source_uuid: Annotated[
        UUID, Path(..., description="The UUID of the source to create or update")
    ],
    pro_info: schemas.CreateApiSource,
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    """Create or update an Data Connector API Source"""
    insert_query = insert(ApiSource).values(
        uuid=source_uuid, user_uuid=user.uuid, **pro_info.model_dump()
    )
    try:
        await db.execute(insert_query)
    except IntegrityError as exc:
        helpers.handle_duplicate_pk(exc)
        update_query = (
            update(ApiSource)
            .where(ApiSource.uuid == source_uuid, ApiSource.user_uuid == user.uuid)
            .values(**pro_info.model_dump())
        )
        await db.execute(update_query)

    await db.commit()
    return SuccessReturn.success_instance()


@router.delete("/api-source/{source_uuid}", response_model=SuccessReturn)
async def delete_user_api_source(
    source_uuid: Annotated[
        UUID, Path(..., description="The UUID of the source to delete")
    ],
    user=Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True)),
    db: AsyncSession = Depends(aget_write_db),
):
    """Delete an Data Connector API Source"""
    query = delete(ApiSource).where(
        ApiSource.uuid == source_uuid, ApiSource.user_uuid == user.uuid
    )
    await db.execute(query)
    await db.commit()
    return SuccessReturn.success_instance()
