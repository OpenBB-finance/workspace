"""Worker tasks for the API."""

import asyncio
import io
import warnings
from datetime import datetime, timedelta  # type: ignore
from typing import Literal
from uuid import UUID, uuid4

from loguru import logger
from sqlalchemy.exc import SQLAlchemyError

from api.models.tauri_models import CopilotChatOld
from api.schemas import Chat, CopilotChatsCreate, EntitlementUsageGet
from api.storage import FileStorage
from routers.pro.helpers import get_entitlement, migrate_user_copilot_chats
from utilities import workers_queue
from utilities.decorators import next_schedule_dt, repeat_every

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
from sqlalchemy import delete, func, insert, or_, select, update
from sqlalchemy.orm import Session

from api import base, crud, geo, helpers
from api.database import AsyncReadSessionLocal, AsyncWriteSessionLocal
from api.email import EmailService
from api.models import (
    ApiSource,
    DashboardItem,
    DashboardSave,
    DashboardShare,
    DONT_USE_CopilotChats,
    EntitlementUsage,
    Entity,
    EntityEntitlement,
    FileWidget,
    Login,
    MCPServers,
    StoredFile,
    User,
)
from routers import pro_helpers
from utilities.config import settings

WriteSession = Session(
    bind=settings.get_write_engine(), autocommit=False, autoflush=True
)


async def login_information(
    user_uuid: UUID,
    ip_address: None | str,
    source: None | Literal["terminal", "hub", "sdk", "pro", "oauth-hub", "excel"],
) -> None:
    """Enters detailed geolocation information for a given ip address and login"""
    async with AsyncWriteSessionLocal.session() as db:
        if ip_address and settings.OPENBB_GEO_KEY:
            ip_info = geo.get_ip_info(ip_address)
            query = insert(Login).values(
                source=source or "hub",
                user_uuid=user_uuid,
                ip_address=ip_address,
                city=ip_info.city,
                region=ip_info.state_prov,
                region_iso_code=ip_info.state_code,
                postal_code=ip_info.zipcode,
                country=ip_info.country_name,
                country_code=ip_info.country_code3,
                continent=ip_info.continent_name,
                continent_code=ip_info.continent_code,
                timezone_name=ip_info.time_zone.name,
                timezone_abbrev=str(ip_info.time_zone.offset),
            )
        else:
            query = insert(Login).values(
                ip_address=ip_address, source=source or "hub", user_uuid=user_uuid
            )
        await db.execute(query)
        await db.commit()


def pat_token_check(db: None | Session = None):
    """Checks PAT tokens. If the token expires in 7-8 days, or in 1-2 days
    it will send an email."""
    if db is None:
        db = WriteSession
    with db:
        query = select(User.auth_token, User.email).where(
            User.auth_token.isnot(None), User.deleted.is_(False)
        )
        db_users = db.execute(query).all()
        clean_users = [(base.get_exp(x[0]), x[1]) for x in db_users]
        now = base.get_now()
        for expiration, email in clean_users:
            difference = expiration - now
            one_to_two = timedelta(days=1) <= difference <= timedelta(days=2)
            seven_to_eight = timedelta(days=7) <= difference <= timedelta(days=8)
            if one_to_two or seven_to_eight:
                EmailService.send_pat_warning(email, expiration)
    return True


def give_pro_trial_extension(db: None | Session = None):
    if db is None:
        db = WriteSession
    with db:
        query = select(User.email, User.uuid).where(
            User.permissions_uuid == settings.PRO_TRIAL_MAPPING,
            User.deleted.is_(False),
            or_(User.pro_trial_renewals == 0, User.pro_trial_renewals.is_(None)),
            User.pro_trial_end >= base.get_now() - timedelta(days=4),
            User.pro_trial_end < base.get_now() - timedelta(days=3),
        )
        db_users = db.execute(query).all()
        for user in db_users:
            EmailService.extend_pro_trial(user[0], user[1])
    return True


def four_days_no_use(db: None | Session = None):
    if db is None:
        db = WriteSession
    with db:
        latest_login_subquery = (
            select(Login.user_uuid, func.max(Login.created_date).label("last_login"))
            .group_by(Login.user_uuid)
            .alias()
        )
        query = (
            select(User.email, User.uuid, User.first_name)
            .where(
                User.deleted.is_(False),
                User.permissions_uuid == settings.PRO_TRIAL_MAPPING,
                latest_login_subquery.c.last_login
                >= base.get_now() - timedelta(days=5),
                latest_login_subquery.c.last_login < base.get_now() - timedelta(days=4),
                User.pro_inactivity_email_sent.is_(False),
            )
            .join(latest_login_subquery, latest_login_subquery.c.user_uuid == User.uuid)
        )
        db_users = db.execute(query).all()
        updates: list[dict] = []
        for user in db_users:
            EmailService.four_days_no_use(user[0], user[2])
            updates.append({"uuid": user[1], "pro_inactivity_email_sent": True})
        db.execute(update(User), updates)
        db.commit()
    return True


async def delete_old_saves() -> bool:
    """Delete old dashboard saves if they are older than two days old and
    if the user has more than 10 saves.
    """

    async with AsyncWriteSessionLocal.session() as db:
        to_delete = await crud.get_dashboard_saves_to_delete(db)
        delete_date = base.get_now() - timedelta(days=2)
        delete_query = delete(DashboardSave).where(
            DashboardSave.uuid.in_(to_delete), DashboardSave.created_date < delete_date
        )
        await db.execute(delete_query)
        await db.commit()

    return True


async def delete_unconfirmed_files(delete_delay: int = 7) -> bool:
    """Deletes unconfirmed files that are older than a certain number of days"""

    delete_end = base.get_now() - timedelta(days=delete_delay)
    delete_start = delete_end - timedelta(days=7)

    async with AsyncWriteSessionLocal.session() as db:
        select_query = select(StoredFile).where(
            StoredFile.file_widget_uuid.is_(None),
            StoredFile.created_date >= delete_start,
            StoredFile.created_date < delete_end,
            StoredFile.is_global.is_(False),
        )

        to_delete = (await db.execute(select_query)).scalars().all()

        for file in to_delete:
            if await FileStorage.delete_file(file.bucket, file.s3_file_name):
                await db.delete(file)

        await db.commit()

    return True


async def migrate_file_widget_urls_to_stored_files():
    """Migrate file widget urls to stored files"""
    bucket_base = f"{settings.S3_BUCKET_BASE}"

    async with AsyncWriteSessionLocal.session() as db:
        stored_query = select(StoredFile.uuid)
        stored_results = (await db.execute(stored_query)).scalars().all()
        stored_files = [str(result) for result in stored_results]

        select_query = select(FileWidget).where(
            FileWidget.url.like("%pro-file-storage%")
        )

        results = (await db.execute(select_query)).scalars().all()

        for file_widget in results:
            try:
                if not file_widget.url:
                    continue

                s3_file_name = file_widget.url.replace(bucket_base, "")
                uuid_str = s3_file_name.replace("pro-file-storage/", "").split(".")[0]
                file_bytes = await helpers.get_file_response(str(file_widget.url))

                update_query = (
                    update(FileWidget)
                    .where(FileWidget.uuid == file_widget.uuid)
                    .values(
                        url=f"{settings.SELFURL}/pro/files/{uuid_str}.{file_widget.extension}"
                    )
                )

                if uuid_str in stored_files:
                    await db.execute(update_query)
                    continue

                file = io.BytesIO(file_bytes)

                entry_to_insert = StoredFile(
                    uuid=UUID(uuid_str),
                    file_widget_uuid=file_widget.uuid,
                    creater_uuid=file_widget.user_uuid,
                    s3_file_name=s3_file_name.replace("pro-file-storage/", ""),
                    bucket=settings.get_file_bucket(),
                    original_file_name=file_widget.original_file_name,
                    extension=file_widget.extension,
                    size=file.getbuffer().nbytes,
                    created_date=file_widget.created_date,
                    updated_date=file_widget.updated_date,
                )

                pending_file = await FileStorage.upload_pending_file(
                    file, entry_to_insert
                )
                if pending_file.failed:
                    continue

                db.add(entry_to_insert)
                await db.execute(update_query)
                await db.commit()
            except Exception as e:
                logger.exception(e)
                await db.rollback()

        await db.commit()

    return True


async def update_share_files(
    owner_uuid: str, dashboard_uuid: str | None = None, user_app_uuid: str | None = None
) -> bool:
    """Updates the shared files for a dashboard or user app"""
    try:
        dashboard_uuid = UUID(dashboard_uuid) if dashboard_uuid else None
        user_app_uuid = UUID(user_app_uuid) if user_app_uuid else None
        owner_uuid = UUID(owner_uuid)
    except ValueError:
        return False

    async with AsyncWriteSessionLocal.session() as db:
        await crud.update_shared_files(db, owner_uuid, dashboard_uuid, user_app_uuid)

    return True


@repeat_every(seconds=timedelta(hours=10), wait_first=False)
async def delete_old_saves_task():
    """Task to delete old dashboard saves"""
    return await workers_queue.worker_queue_at(
        delete_old_saves,
        next_schedule_dt(base.get_midnight(), add_days=3),
        job_timeout=1800,
    )


@repeat_every(seconds=timedelta(hours=10), wait_first=False)
async def delete_unconfirmed_files_task():
    """Task to delete unconfirmed files"""
    return await workers_queue.worker_queue_at(
        delete_unconfirmed_files,
        next_schedule_dt(base.get_midnight(), add_days=2),
        job_timeout=1800,
    )


@repeat_every(seconds=timedelta(minutes=2), wait_first=True, max_repetitions=1)
async def delete_unconfirmed_files_no_delay_task():
    """Task to delete unconfirmed files"""
    clear_date = settings.CLEAR_UNCONFIRMED_FILES_DATE

    for delete_delay in reversed(range(0, 30)):
        await workers_queue.worker_queue(
            delete_unconfirmed_files,
            f"delete_unconfirmed_files_{clear_date}_{delete_delay}",
            delete_delay=delete_delay,
            result_ttl=-1,
            job_timeout=500,
        )


# This task is not repeated because it is a one-time migration
@repeat_every(seconds=10, wait_first=True, max_repetitions=1)
async def migrate_stored_files_task():
    """Task to migrate file widget urls to stored files"""

    # setting result_ttl to -1 to keep the return value in redis indefinitely (prevents the task from being re-run)
    return await workers_queue.worker_queue(
        migrate_file_widget_urls_to_stored_files,
        "migrate_file_widget_urls_to_stored_files_task",
        sleep=10,
        result_ttl=-1,
        job_timeout=1800,
    )


async def get_usage_tasks(uuid: UUID, usage_type: Literal["file", "copilot", "limits"]):
    """Get usage tasks for a user"""
    async with AsyncReadSessionLocal.session() as db:
        if usage_type == "limits":
            return await get_entitlement(db, uuid)

        if usage_type == "file":
            file_sum_query = select(func.sum(StoredFile.size)).where(
                StoredFile.creater_uuid == uuid
            )
            total_file_bytes = (await db.execute(file_sum_query)).scalar_one_or_none()
            return total_file_bytes

        if usage_type == "copilot":
            usage_query = await db.execute(
                select(EntitlementUsage.number_copilot_calls_day_count)
                .where(EntitlementUsage.user_uuid == uuid)
                .limit(1)
            )
            copilot_calls_day_count = usage_query.scalar_one_or_none()
            return copilot_calls_day_count

    return None


async def update_user_usage_cache(user_uuid: UUID, reset_copilot_calls: bool = False):
    tasks = [
        asyncio.create_task(get_usage_tasks(user_uuid, "limits")),
        asyncio.create_task(get_usage_tasks(user_uuid, "file")),
        asyncio.create_task(get_usage_tasks(user_uuid, "copilot")),
    ]

    limits, total_file_bytes, copilot_calls_day_count = await asyncio.gather(*tasks)

    if not limits:
        return None

    total_file_upload_size_gb_count = (
        (total_file_bytes / (1024**3)) if total_file_bytes else 0
    )

    try:
        cache_data = {
            "copilot_calls_limit": limits.number_copilot_calls_day,
            "file_upload_size_limit": limits.total_file_upload_size_gb,
            "number_copilot_calls_day_count": (
                0 if reset_copilot_calls else (copilot_calls_day_count or 0)
            ),
            "total_file_upload_size_gb_count": total_file_upload_size_gb_count or 0,
        }

        settings.redis_cache(f"usage:{user_uuid}", cache_data, update=True)
        return EntitlementUsageGet(**cache_data)
    except Exception as e:
        logger.exception(e)

    return None


async def entitlement_usage(reset_copilot_calls: bool = False):
    """Entitlement usage"""
    logger.info("Starting entitlement_usage task")
    async with AsyncWriteSessionLocal.session() as db:
        query = select(EntitlementUsage.user_uuid).where(
            EntitlementUsage.number_copilot_calls_day_count != 0
        )
        results = (await db.execute(query)).scalars().all()

        for user_uuid in results:

            if cache_data := settings.redis_cache(f"usage:{user_uuid}"):
                cache_data = EntitlementUsageGet.model_validate(cache_data)

            if (
                updated_data := await update_user_usage_cache(
                    user_uuid, reset_copilot_calls
                )
            ) is None:
                continue

            if cache_data and (
                cache_data.number_copilot_calls_day_count
                == updated_data.number_copilot_calls_day_count
                and cache_data.total_file_upload_size_gb_count
                == updated_data.total_file_upload_size_gb_count
            ):
                continue

            update_query = (
                update(EntitlementUsage)
                .where(EntitlementUsage.user_uuid == user_uuid)
                .values(
                    number_copilot_calls_day_count=updated_data.number_copilot_calls_day_count
                    or 0,
                    total_file_upload_size_gb_count=updated_data.total_file_upload_size_gb_count
                    or 0,
                )
            )

            try:
                await db.execute(update_query)
            except Exception as e:
                logger.exception(e)
                await db.rollback()

        await db.commit()

    logger.info("Finished entitlement_usage task")
    return True


@repeat_every(seconds=timedelta(minutes=5), wait_first=False)
async def entitlement_usage_task():
    """Entitlement usage"""
    return await workers_queue.worker_queue(
        entitlement_usage,
        "entitlement_usage",
        result_ttl=base.get_result_ttl(timedelta(minutes=4)),
        job_timeout=1800,
    )


async def add_entity_entitlements():
    """Add entity entitlements for entities without an entitlement"""

    async with AsyncWriteSessionLocal.session() as db:
        try:
            query = (
                select(Entity.uuid)
                .select_from(Entity)
                .outerjoin(
                    EntityEntitlement, Entity.uuid == EntityEntitlement.entity_uuid
                )
                .where(EntityEntitlement.uuid.is_(None))
            )
            entities_wo_entitlement = (await db.execute(query)).scalars().all()
            for entity_uuid in entities_wo_entitlement:
                await pro_helpers.insert_entity_entitlement(db, entity_uuid, "pro")
        except Exception as e:
            logger.exception(e)
            await db.rollback()

    return True


async def migrate_duplicate_copilot_chats():
    """Migrate copilot chats"""
    async with AsyncWriteSessionLocal.session() as db:
        user_uuids = (
            (await db.execute(select(CopilotChatOld.user_uuid).distinct()))
            .scalars()
            .all()
        )

        for user_uuid in user_uuids:
            query = select(CopilotChatOld).where(CopilotChatOld.user_uuid == user_uuid)
            results = (await db.execute(query)).scalars().all()

            chats = [
                Chat.from_db(chat.content, chat.uuid)
                for chat in results
                if chat.content
            ]

            chats_post: dict[UUID, dict] = {}

            try:
                query = (
                    select(DONT_USE_CopilotChats)
                    .where(DONT_USE_CopilotChats.user_uuid == user_uuid)
                    .limit(1)
                )

                if (result := (await db.execute(query)).scalar_one_or_none()) is None:
                    continue

                new_chats = {chat.createdAt: str(chat.uuid) for chat in chats}

                for chat in result.chats or []:
                    uuid = str(chat.get("id", chat.get("uuid", uuid4())))
                    chat.update({"uuid": uuid, "id": uuid})

                    created_at = chat.get("createdAt")
                    if (
                        created_at is not None
                        and created_at not in new_chats
                        and uuid not in new_chats.values()
                        and new_chats.get(created_at) != uuid
                    ):
                        chats_post[uuid] = chat
            except Exception as e:
                logger.error(e)
                continue

            if chats_post:
                try:
                    await crud.bulk_copilot_chats_insert_update(
                        db, user_uuid, CopilotChatsCreate(chats=chats_post)
                    )
                except SQLAlchemyError as e:
                    logger.error(e)
                    await db.rollback()

    return True


async def migrate_copilot_chats():
    """Migrate copilot chats"""
    async with AsyncWriteSessionLocal.session() as db:
        result = await db.stream(select(CopilotChatOld.user_uuid).distinct())

        async for user_uuid in result.scalars():
            await migrate_user_copilot_chats(db, user_uuid)

    return True


# This task is not repeated because it is a one-time migration
@repeat_every(seconds=10, wait_first=True, max_repetitions=1)
async def add_entity_entitlements_task():
    """Task to add entity entitlements"""
    # setting result_ttl to -1 to keep the return value in redis indefinitely (prevents the task from being re-run)
    return await workers_queue.worker_queue(
        add_entity_entitlements, "add_entity_entitlements", sleep=10, result_ttl=-1
    )


async def user_usage_cache_task(user_uuid: UUID):
    """Update user usage"""
    return await update_user_usage_cache(user_uuid)


async def reset_copilot_calls():
    return await entitlement_usage(reset_copilot_calls=True)


@repeat_every(seconds=timedelta(hours=2), wait_first=False)
async def reset_copilot_calls_task():
    """Task to reset copilot calls"""
    return await workers_queue.worker_queue_at(
        reset_copilot_calls,
        next_schedule_dt(base.get_midnight()),
        job_timeout=1800,
    )


async def populate_dashboard_items_entity_uuid():
    """Populate dashboard items entity uuid"""
    logger.info("Starting populate_dashboard_items_entity_uuid task")
    async with AsyncWriteSessionLocal.session() as db:
        try:
            query = (
                select(User.permissions_uuid, DashboardItem.uuid)
                .select_from(DashboardItem)
                .join(User, User.uuid == DashboardItem.creator_uuid)
                .where(DashboardItem.entity_uuid.is_(None))
            )
            results = (await db.execute(query)).all()
            for item in results:
                user_entity_uuid = await crud.get_user_entity_uuid(
                    db, item.permissions_uuid
                )

                if user_entity_uuid:
                    await db.execute(
                        update(DashboardItem)
                        .where(DashboardItem.uuid == item.uuid)
                        .values(entity_uuid=user_entity_uuid)
                    )

            await db.commit()
        except Exception as e:
            logger.exception(e)
            await db.rollback()

    logger.info("Finished populate_dashboard_items_entity_uuid task")
    return True


@repeat_every(seconds=10, wait_first=False, max_repetitions=1)
async def populate_dashboard_items_entity_uuid_task():
    """Task to populate dashboard items entity uuid"""
    return await workers_queue.worker_queue(
        populate_dashboard_items_entity_uuid,
        "populate_dashboard_items_entity_uuid",
        result_ttl=-1,
        job_timeout=1800,
    )


async def encrypt_api_source_headers():
    """Encrypt api source headers"""
    async with AsyncWriteSessionLocal.session() as db:
        try:
            query = (
                select(ApiSource.uuid, ApiSource.endpointHeaders)
                .select_from(ApiSource)
                .where(ApiSource.endpointHeaders.isnot(None))
            )
            results = (await db.execute(query)).all()
            for item in results:
                # Since the column type is `EncryptedType` it will be automatically encrypted
                # on update
                await db.execute(
                    update(ApiSource)
                    .where(ApiSource.uuid == item.uuid)
                    .values(endpointHeaders=item.endpointHeaders)
                )

            await db.commit()
        except Exception as e:
            logger.exception(e)
            await db.rollback()

    return True


@repeat_every(seconds=10, wait_first=False, max_repetitions=1)
async def encrypt_api_source_headers_task():
    """Task to encrypt api source headers"""
    return await workers_queue.worker_queue(
        encrypt_api_source_headers, "encrypt_api_source_headers", result_ttl=-1
    )


@repeat_every(seconds=10, wait_first=False, max_repetitions=1)
async def migrate_duplicate_copilot_chats_task():
    """Task to migrate copilot chats"""
    return await workers_queue.worker_queue(
        migrate_duplicate_copilot_chats,
        "migrate_copilot_chats_task",
        result_ttl=-1,
        job_timeout=1800,
    )


@repeat_every(seconds=10, wait_first=False, max_repetitions=1)
async def migrate_new_copilot_chats_task():
    """Task to migrate copilot chats"""
    return await workers_queue.worker_queue(
        migrate_copilot_chats,
        "migrate_new_copilot_chats_task",
        result_ttl=-1,
        job_timeout=1800,
    )


async def populate_dashboard_items_is_shared():
    """Populate dashboard items is_shared field"""
    async with AsyncWriteSessionLocal.session() as db:
        try:
            count_query = (
                select(DashboardShare.dashboard_item_uuid, DashboardShare.active)
                .where(DashboardShare.active.is_(True))
                .distinct(DashboardShare.dashboard_item_uuid)
            )

            results = (await db.execute(count_query)).all()
            for item in results:
                await db.execute(
                    update(DashboardItem)
                    .where(DashboardItem.uuid == item.dashboard_item_uuid)
                    .values(is_shared=item.active)
                )

            await db.commit()
        except Exception as e:
            logger.exception(e)
            await db.rollback()

    return True


@repeat_every(seconds=10, wait_first=False, max_repetitions=1)
async def populate_dashboard_items_is_shared_task():
    """Task to populate dashboard items is_shared field"""
    return await workers_queue.worker_queue(
        populate_dashboard_items_is_shared,
        "populate_dashboard_items_is_shared_task",
        result_ttl=1 * 60,
        job_timeout=1800,
    )


async def fix_multiple_mcp_servers_entries():
    """Fix the case where multiple MCPServers entries exist for the same user by merging the
    servers into one entry and deleting the duplicates
    """
    async with AsyncWriteSessionLocal.session() as db:
        try:
            query = (
                select(MCPServers.user_uuid)
                .group_by(MCPServers.user_uuid)
                .having(func.count(MCPServers.user_uuid) > 1)
            )
            results = (await db.execute(query)).scalars().all()
            for user_uuid in results:
                servers_query = (
                    select(MCPServers)
                    .where(MCPServers.user_uuid == user_uuid)
                    .order_by(MCPServers.created_date.asc())
                )
                servers_results = (await db.execute(servers_query)).scalars().all()
                all_servers = []
                for result in servers_results:
                    all_servers.extend(result.servers or [])

                unique_servers = list(
                    {
                        f"{server.get('name')}_{server.get('url')}": server
                        for server in all_servers
                    }.values()
                )

                first_entry = servers_results[0]

                await db.execute(
                    update(MCPServers)
                    .where(
                        MCPServers.user_uuid == user_uuid,
                        MCPServers.uuid == first_entry.uuid,
                    )
                    .values(servers=unique_servers)
                )

                delete_query = delete(MCPServers).where(
                    MCPServers.user_uuid == user_uuid,
                    MCPServers.uuid != first_entry.uuid,
                )
                await db.execute(delete_query)

            await db.commit()
        except Exception as e:
            logger.exception(e)
            await db.rollback()

    return True


@repeat_every(seconds=10, wait_first=False, max_repetitions=1)
async def fix_multiple_mcp_servers_entries_task():
    """Task to fix multiple MCPServers entries for the same user"""
    return await workers_queue.worker_queue(
        fix_multiple_mcp_servers_entries,
        "fix_multiple_mcp_servers_entries_task",
        result_ttl=-1,
        job_timeout=1800,
    )


async def start_background_tasks():
    """Start all background tasks"""

    await populate_dashboard_items_entity_uuid_task()
    await reset_copilot_calls_task()
    await entitlement_usage_task()
    await delete_old_saves_task()
    await delete_unconfirmed_files_task()
    await migrate_stored_files_task()
    await add_entity_entitlements_task()
    await encrypt_api_source_headers_task()
    # await migrate_duplicate_copilot_chats_task()
    await populate_dashboard_items_is_shared_task()
    await fix_multiple_mcp_servers_entries_task()

    clear_datetime = datetime.strptime(
        settings.CLEAR_UNCONFIRMED_FILES_DATE, "%Y-%m-%d"
    )

    # Clear unconfirmed files if the current day is the same
    # as the clear date
    if base.get_now().day == clear_datetime.day:
        await delete_unconfirmed_files_no_delay_task()

    return True
