import json
import pickle  # noqa: S403
import re
from datetime import (
    date as dateType,
    datetime,
)
from time import time
from typing import Any, Literal, TypedDict, TypeVar
from uuid import UUID

from fastapi import HTTPException
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import Select, and_, case, delete, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager, defer

from api import auth_helpers, base, models, schemas
from api.models import (
    ApiSource,
    DashboardItem,
    DashboardSave,
    DashboardShare,
    Entity,
    Login,
    PermissionsEntityMap,
    PermissionsInvite,
    SingleWidget,
    User,
    UserApp,
    UserAppShare,
    UserProInvite,
)
from api.models.tauri_models import StoredFile, StoredFileShare
from api.storage import FileStorage
from utilities.config import settings

ItemT = TypeVar("ItemT")


async def acreate_helper(db: AsyncSession, item: ItemT) -> ItemT:
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def get_user_entity_uuid(db: AsyncSession, permissions_uuid: UUID) -> UUID:
    user_entity_query = (
        select(models.PermissionsEntityMap.entity_uuid)
        .where(models.PermissionsEntityMap.uuid == permissions_uuid)
        .limit(1)
    )

    return (await db.execute(user_entity_query)).scalar_one_or_none()


async def get_shared_dashboard_file_uuids(
    db: AsyncSession, user: models.User, dashboard_uuid: UUID | None = None
):
    if dashboard_uuid is None:
        return []

    select_query = select(models.StoredFileShare.stored_file_uuids).where(
        models.StoredFileShare.shared_user_uuid == user.uuid,
        models.StoredFileShare.dashboard_item_uuid == dashboard_uuid,
    )

    return (await db.execute(select_query)).scalar_one_or_none() or []


async def bulk_dashboard_insert_update(  # noqa: PLR0912
    db: AsyncSession,
    dashboards: schemas.DashboardsCreate,
    owner_uuid: UUID,
    permissions_uuid: UUID,
):
    """
    Bulk update dashboards. The user uuid is included because we need to get a list of all
    dashboards the user owns, so that we know which ones can be modified.

    Parameters
    ----------
    db : Session
    dashboards : DashboardsCreate
        Pydantic model with dashboard ids and content
    owner_uuid : UUID
        UUID of the owner
    permissions_uuid : UUID
        UUID of the user's permissions
    """

    class Dashboard(BaseModel):
        uuid: UUID
        content: dict

    to_insert: list[Dashboard] = []
    to_update: list[Dashboard] = []
    to_delete: list[UUID] = []

    user_entity_uuid = await get_user_entity_uuid(db, permissions_uuid)

    dash_query = select(DashboardItem.uuid).where(
        DashboardItem.owner_uuid == owner_uuid
    )
    dashes = await db.execute(dash_query)
    dash_uuids = dashes.scalars().all()

    for key, value in dashboards.items.items():
        if key not in dash_uuids:
            if value == "DELETE":
                raise HTTPException(400, detail="User does not own dashboard")
            to_insert.append(Dashboard(uuid=key, content=value))
        elif key in dash_uuids:
            if value == "DELETE":
                to_delete.append(key)
            else:
                to_update.append(Dashboard(uuid=key, content=value))

    dashs_to_verify = to_delete + [x.uuid for x in to_update]
    for dashboard_uuid in dashs_to_verify:
        if dashboard_uuid not in dash_uuids:
            raise HTTPException(status_code=400, detail="User does not own dashboard")

    if to_insert:
        cleaned_insert = [
            {
                "uuid": x.uuid,
                "owner_uuid": owner_uuid,
                "creator_uuid": owner_uuid,
                "content": x.content,
                "entity_uuid": user_entity_uuid,
            }
            for x in to_insert
        ]
        await db.execute(insert(DashboardItem), cleaned_insert)
    # We need to insert the saves now since they are on a separate table
    # Temporarily commented out because the saves take a lot of space and are not used
    # for item in to_insert:
    # insert_save = insert(DashboardSave).values(dashboard_item_uuid=item.uuid, content=item.content)
    # db.execute(insert_save)
    if to_update:
        # cleaned_update = [{"dashboard_item_uuid": x.uuid, "content": x.content} for x in to_update]
        # db.execute(insert(DashboardSave), cleaned_update)
        cleaner_update = [{"uuid": x.uuid, "content": x.content} for x in to_update]
        await db.execute(update(DashboardItem), cleaner_update)

        if permissions_uuid != settings.PRO_DEVELOPER_MAPPING or settings.is_onprem():
            from api.helpers import handle_share_files  # noqa

            await db.commit()
            for item in to_update:
                handle_share_files(owner_uuid, item.uuid)

    if to_delete:
        query = delete(DashboardItem).where(
            DashboardItem.uuid.in_(to_delete), DashboardItem.owner_uuid == owner_uuid
        )
        await db.execute(query)
    await db.commit()


EXTRACT_HREF_REGEX = r"(?:<a\s+(?:[^>]*?\s+)?href=(['\"])(.*?)\1.*?>)(.*?)(?:<\/a>)"
EXTRACT_TAGS_CONTEXT_REGEX = r"(?:<.*?>)(.*?)(?:<\/.*?>)"


def to_searchable_text(msg: dict[str, Any]) -> str | None:
    if not (text := msg.get("content")):
        return None

    if msg.get("role") == "human":
        return text

    text = re.sub(EXTRACT_HREF_REGEX, r"\2", text)
    text = re.sub(EXTRACT_TAGS_CONTEXT_REGEX, r"\1", text)

    return "".join([e.lower() for e in text if e.isalnum() or e.isspace()])


class InsertUpdateDelete(TypedDict):
    to_insert: list[dict]
    to_update: list[dict]
    to_delete: list[UUID]


def default_ops() -> InsertUpdateDelete:
    return {"to_insert": [], "to_update": [], "to_delete": []}


async def bulk_copilot_chats_insert_update(
    db: AsyncSession,
    owner_uuid: UUID,
    body: schemas.CopilotChatsCreate,
):
    """
    Bulk update copilot chats. The user uuid is included because we need to get a list of all
    chats the user owns, so that we know which ones can be modified.

    Parameters
    ----------
    db : AsyncSession
    owner_uuid : UUID
        UUID of the owner
    body : CopilotChatsCreate
        Pydantic model with chat ids and content
    """

    message_updates = default_ops()
    chats_updates = default_ops()

    pending_chat_uuids = list(body.chats.keys())

    chat_query = select(models.CopilotChat.uuid).where(
        models.CopilotChat.user_uuid == owner_uuid,
        models.CopilotChat.uuid.in_(pending_chat_uuids),
    )
    messages_query = (
        select(
            models.ChatMessages.uuid,
            models.ChatMessages.chat_uuid,
        )
        .where(
            models.ChatMessages.user_uuid == owner_uuid,
            models.ChatMessages.chat_uuid.in_(pending_chat_uuids),
        )
        .order_by(models.ChatMessages.updated_date.desc())
    )

    chat_uuids = (await db.execute(chat_query)).scalars().all()
    chat_messages_uuids: dict[UUID, list[UUID]] = {}
    for m in (await db.execute(messages_query)).all():
        chat_messages_uuids.setdefault(m.chat_uuid, []).append(m.uuid)

    def process_messages(
        messages: dict[str | UUID, Literal["DELETE"] | dict], chat_uuid: UUID
    ):
        messages_uuids = chat_messages_uuids.get(chat_uuid, [])

        for key, msg in messages.items():
            uuid = UUID(key) if isinstance(key, str) else key
            if msg == "DELETE":
                if uuid in messages_uuids:
                    message_updates["to_delete"].append(uuid)
                continue

            data = {
                "uuid": uuid,
                "chat_uuid": chat_uuid,
                "user_uuid": owner_uuid,
                "content": msg,
                "role": msg.get("role"),
            }
            if msg.get("role") in {"ai", "human"} and not msg.get("isHidden"):
                data["searchable_content"] = to_searchable_text(msg)

            if uuid not in messages_uuids:
                created_date = base.time_ms_now(msg.get("timestamp"))
                data.update(
                    {"created_date": created_date, "updated_date": created_date}
                )
                message_updates["to_insert"].append(data)
            elif uuid in messages_uuids:
                message_updates["to_update"].append(data)

    for uuid, v in body.chats.items():
        if v == "DELETE":
            if uuid not in chat_uuids:
                raise HTTPException(400, detail="User does not own chat")
            chats_updates["to_delete"].append(uuid)
            continue

        entry, messages = v.to_entry(uuid, owner_uuid)

        if uuid not in chat_uuids:
            created_date = base.time_ms_now(entry.get("content", {}).get("createdAt"))
            entry.update({"created_date": created_date, "updated_date": created_date})
            chats_updates["to_insert"].append(entry)
        elif uuid in chat_uuids:
            chats_updates["to_update"].append(entry)

        process_messages(messages, uuid)

    chats_to_verify = chats_updates["to_delete"] + [
        x["uuid"] for x in chats_updates["to_update"]
    ]
    for chat_uuid in chats_to_verify:
        if chat_uuid not in chat_uuids:
            raise HTTPException(status_code=400, detail="User does not own chat")

    for array, query in [
        (chats_updates["to_insert"], insert(models.CopilotChat)),
        (chats_updates["to_update"], update(models.CopilotChat)),
        (message_updates["to_insert"], insert(models.ChatMessages)),
        (message_updates["to_update"], update(models.ChatMessages)),
    ]:
        if array:
            await db.execute(query, array)

    delete_ops: list[tuple[list[UUID], type[ItemT]]] = [
        (chats_updates["to_delete"], models.CopilotChat),
        (message_updates["to_delete"], models.ChatMessages),
    ]
    for uuids, model in delete_ops:
        query = delete(model).where(
            model.uuid.in_(uuids), model.user_uuid == owner_uuid
        )
        await db.execute(query)

    await db.commit()


SelectT = TypeVar("SelectT", bound=Select)


def get_match_exprs(search_term: str) -> list:
    vector_match_exprs = []
    match_exprs = []

    # add :* to end of last word for prefix matching in postgres
    if settings.DATABASE_TYPE == "postgresql":
        search_term = re.sub(r"(\w+)$", r"\1:*", search_term)

    for w in search_term.split():
        word = w.strip()
        if len(word) < 3:  # ruff:ignore[magic-value-comparison]
            continue
        if settings.DATABASE_TYPE == "postgresql":
            vector_match_exprs.extend(
                [
                    models.ChatMessages.search_vector.match(word),
                    models.CopilotChat.search_vector.match(word),
                ]
            )

        word = re.sub(r"[^a-zA-Z0-9]", "", word)
        match_exprs.extend(
            [
                models.ChatMessages.searchable_content.contains(word),
                models.CopilotChat.label.contains(word),
            ]
        )
    return vector_match_exprs + match_exprs


def dialect_query(query: SelectT, search_term: str) -> SelectT:
    """
    Modify the query based on the database dialect and search term.

    Parameters
    ----------
    query : SelectT
        The SQLAlchemy select query to modify.
    search_term : str
        The term to search for in the chat messages.

    Returns
    -------
    SelectT
        The modified query with the appropriate search conditions and ordering.
    """
    match_exprs = get_match_exprs(search_term)
    if settings.DATABASE_TYPE == "mysql":
        search_term = search_term.replace("'", "")
        msg_match = models.ChatMessages.searchable_content.match(
            search_term, with_query_expansion=True
        )
        label_match = models.CopilotChat.label.match(
            search_term, with_query_expansion=True
        )

        return query.where(or_(*[msg_match, label_match, *match_exprs])).order_by(
            msg_match.desc(),
            models.ChatMessages.searchable_content.contains(search_term).desc(),
            label_match.desc(),
        )

    if settings.DATABASE_TYPE == "postgresql":
        order_by_clause = func.ts_rank(
            models.ChatMessages.search_vector,
            func.plainto_tsquery("simple", search_term),
        )
        return query.where(
            models.ChatMessages.search_vector.is_not(None),
            models.CopilotChat.search_vector.is_not(None),
            or_(*match_exprs),
        ).order_by(order_by_clause.desc())

    if settings.DATABASE_TYPE == "sqlite":
        search_term = search_term.replace("'", "")

        return query.where(or_(*match_exprs)).order_by(
            models.ChatMessages.searchable_content.contains(search_term).desc(),
            models.CopilotChat.label.contains(search_term).desc(),
        )

    return query


async def search_copilot_chats(
    db: AsyncSession,
    user_uuid: UUID,
    search_term: str,
    start_date: dateType | datetime | None = None,
    end_date: dateType | datetime | None = None,
) -> list[schemas.Chat | schemas.ChatInfo]:
    """
    Search copilot chats for a user based on a search term and optional date range.

    Parameters
    ----------
    db : AsyncSession
        The database session.
    user_uuid : UUID
        The UUID of the user.
    search_term : str
        The term to search for in the chat messages.
    start_date : dateType | datetime | None, optional
        The start date for filtering messages (inclusive).
    end_date : dateType | datetime | None, optional
        The end date for filtering messages (inclusive).

    Returns
    -------
    list[schemas.Chat | schemas.ChatInfo]
        A list of chat messages that match the search criteria.
    """

    query = (
        select(models.CopilotChat)
        .join(models.CopilotChat.messages)
        .where(
            models.CopilotChat.user_uuid == user_uuid,
            models.CopilotChat.label.is_not(None),
            models.ChatMessages.role.in_(["human", "ai"]),
            models.ChatMessages.searchable_content.is_not(None),
        )
        .options(
            contains_eager(models.CopilotChat.messages),
            defer(models.CopilotChat.artifacts),
        )
        .execution_options(populate_existing=True)
    )
    query = dialect_query(query, search_term.strip())

    if start_date:
        query = query.where(models.CopilotChat.created_date >= start_date)

    if end_date:
        query = query.where(models.CopilotChat.created_date <= end_date)

    results = await db.execute(query.limit(20))

    return [schemas.Chat.from_row(x, True) for x in results.unique().scalars().all()]


def user_response(db_user) -> User:
    """Filters for active subscriptions and active platforms"""

    db_user.information_complete = auth_helpers.check_info_fields(db_user)
    db_user.profile_url = (
        settings.get_profile_url(db_user.uuid) if db_user.has_profile_url else None
    )
    return db_user


async def get_user(db: AsyncSession, identify: dict[str, Any]) -> None | User:
    query = (
        select(User)
        .filter_by(**identify)
        .filter(User.email != settings.PRO_TRIAL_EMAIL)
    )
    return (await db.execute(query)).scalars().first()


async def create_entity_relationship(
    db: AsyncSession, entity_relationship: schemas.EntityRelationshipCreate
) -> models.EntityRelationship:
    "Create an entity relationship. If no supreme is provided, the parent is the supreme."
    supreme_uuid = await models.entity_get_supreme(db, entity_relationship.parent_uuid)
    db_entity_relationship = models.EntityRelationship(
        parent_uuid=entity_relationship.parent_uuid,
        child_uuid=entity_relationship.child_uuid,
        supreme_uuid=supreme_uuid if supreme_uuid else entity_relationship.parent_uuid,
    )
    new = await acreate_helper(db, db_entity_relationship)
    return new


T = TypeVar("T", bound="schemas.DashboardReturn | schemas.UserAppReturn")


def get_value(
    result, user_uuid: UUID, Model: "type[T] | None" = schemas.DashboardReturn
) -> "T":
    kwargs = {}
    if isinstance(result.content, dict) and "shared_with" in result.content:
        kwargs["shared_with"] = result.content.pop("shared_with")

    return Model(
        content=result.content,
        creator=result.creator_uuid == user_uuid,
        created_date=result.created_date,
        updated_date=result.updated_date,
        is_shared=result.is_shared if hasattr(result, "is_shared") else False,
        created_by=(
            result.created_by.strip()
            if result.created_by and isinstance(result.created_by, str)
            else ""
        ),
        **kwargs,
    )


UserDashboards = dict[UUID, schemas.DashboardReturn]


async def get_user_dashboards_owned(
    db: AsyncSession, user_uuid: UUID
) -> UserDashboards:
    "Gets all of a user's dashboards that they own."
    query = (
        select(
            DashboardItem.uuid,
            DashboardItem.content,
            DashboardItem.creator_uuid,
            DashboardItem.created_date,
            DashboardItem.updated_date,
            DashboardItem.is_shared,
            case(
                (
                    and_(User.first_name.is_not(None), User.last_name.is_not(None)),
                    func.concat(User.first_name, " ", User.last_name),
                ),
                else_=User.email,
            ).label("created_by"),
        )
        .join(User, User.uuid == DashboardItem.creator_uuid)
        .where(DashboardItem.owner_uuid == user_uuid)
    )
    results = await db.execute(query)
    return {x.uuid: get_value(x, user_uuid) for x in results.all()}


async def get_storedfile_uuids(
    db: AsyncSession,
    owner_uuid: UUID,
    dashboard_uuid: UUID | None = None,
    user_app_uuid: UUID | None = None,
) -> list[UUID]:
    "Gets all stored file uuids for a dashboard or user app"
    if dashboard_uuid:
        return await get_dashboard_storedfile_uuids(db, dashboard_uuid, owner_uuid)
    elif user_app_uuid:
        return await get_user_app_storedfile_uuids(db, user_app_uuid, owner_uuid)
    return []


async def get_dashboard_storedfile_uuids(
    db: AsyncSession, dashboard_uuid: UUID | None, owner_uuid: UUID
) -> list[UUID]:
    "Gets all stored file uuids for a dashboard"
    if dashboard_uuid is None:
        return []

    dashboard_item = await get_dashboard_item(db, dashboard_uuid, owner_uuid)

    if not dashboard_item:
        return []

    item_dict: dict = (
        dashboard_item.content
        if isinstance(dashboard_item.content, dict)
        else json.loads(dashboard_item.content)
    )

    stored_file_uuids: list[str] = item_dict.get("data", {}).get("storedFileUUIDs", [])

    file_uuids = []
    for uuid in stored_file_uuids:
        try:
            file_uuid = UUID(uuid)
        except ValueError as e:
            logger.error(e)
            continue
        file_uuids.append(file_uuid)

    return file_uuids


async def get_user_app(
    db: AsyncSession, app_uuid: UUID, user_uuid: UUID
) -> None | models.UserApp:
    query = (
        select(UserApp)
        .where(UserApp.uuid == app_uuid, UserApp.user_uuid == user_uuid)
        .limit(1)
    )
    return (await db.execute(query)).scalar_one_or_none()


async def get_user_app_storedfile_uuids(
    db: AsyncSession, user_app_uuid: UUID | None, owner_uuid: UUID
) -> list[UUID]:
    "Gets all stored file uuids for a user app"
    if user_app_uuid is None:
        return []

    user_app = await get_user_app(db, user_app_uuid, owner_uuid)

    if not user_app:
        return []

    item_dict: dict = (
        user_app.content
        if isinstance(user_app.content, dict)
        else json.loads(user_app.content)
    )

    stored_file_uuids: list[str] = item_dict.get("storedFileUUIDs", [])

    file_uuids = []
    for uuid in stored_file_uuids:
        try:
            file_uuid = UUID(uuid)
        except ValueError as e:
            logger.error(e)
            continue
        file_uuids.append(file_uuid)

    return file_uuids


async def update_shared_files(
    db: AsyncSession,
    owner_uuid: UUID,
    dashboard_uuid: UUID | None = None,
    user_app_uuid: UUID | None = None,
) -> tuple[list[UUID], dict[UUID, StoredFileShare]]:
    "Update shared files for a dashboard or user app"

    query = select(StoredFileShare).where(StoredFileShare.creater_uuid == owner_uuid)
    if dashboard_uuid:
        query = query.where(StoredFileShare.dashboard_item_uuid == dashboard_uuid)
    elif user_app_uuid:
        query = query.where(StoredFileShare.user_app_uuid == user_app_uuid)

    file_uuids = await get_storedfile_uuids(
        db, owner_uuid, dashboard_uuid, user_app_uuid
    )

    results = (await db.execute(query)).scalars().all()

    if not results:
        return (file_uuids, {})

    existing_shares = {x.shared_user_uuid: x for x in results}

    for share in existing_shares.values():
        share.stored_file_uuids = file_uuids

    await db.commit()

    return (file_uuids, existing_shares)


async def share_files(
    db: AsyncSession,
    owner_uuid: UUID,
    user_uuids: list[UUID],
    dashboard_uuid: UUID | None = None,
    user_app_uuid: UUID | None = None,
):
    "Share files with other users"
    file_uuids, existing_shares = await update_shared_files(
        db, owner_uuid, dashboard_uuid=dashboard_uuid, user_app_uuid=user_app_uuid
    )

    kwargs = {}
    if dashboard_uuid:
        kwargs["dashboard_item_uuid"] = dashboard_uuid
    elif user_app_uuid:
        kwargs["user_app_uuid"] = user_app_uuid

    for user_uuid in user_uuids:
        if user_uuid in existing_shares:
            continue

        new_share = insert(StoredFileShare).values(
            dashboard_item_uuid=dashboard_uuid,
            shared_user_uuid=user_uuid,
            stored_file_uuids=file_uuids,
            creater_uuid=owner_uuid,
        )
        await db.execute(new_share)

    await db.commit()


async def unshare_files(
    db: AsyncSession,
    owner_uuid: UUID,
    user_uuids: list[UUID],
    dashboard_uuid: UUID | None = None,
    user_app_uuid: UUID | None = None,
):
    query = delete(StoredFileShare).where(
        StoredFileShare.creater_uuid == owner_uuid,
        StoredFileShare.shared_user_uuid.in_(user_uuids),
    )
    if dashboard_uuid:
        query = query.where(StoredFileShare.dashboard_item_uuid == dashboard_uuid)
    elif user_app_uuid:
        query = query.where(StoredFileShare.user_app_uuid == user_app_uuid)
    else:
        return

    await db.execute(query)
    await db.commit()


async def handle_dashboard_is_shared(
    db: AsyncSession,
    dashboard_uuid: UUID,
) -> None:
    """Handles the is_shared field for a dashboard item.
    This field is used to determine if the dashboard is shared with anyone else.

    Parameters
    ----------
    db : AsyncSession
    dashboard_uuid : UUID
        The UUID of the dashboard item.
    """

    shared_query = select(func.count(DashboardShare.uuid)).where(
        DashboardShare.dashboard_item_uuid == dashboard_uuid,
        DashboardShare.active.is_(True),
    )
    shared_count = (await db.execute(shared_query)).scalar_one_or_none() or 0

    is_shared = shared_count > 0

    await db.execute(
        update(DashboardItem)
        .where(DashboardItem.uuid == dashboard_uuid)
        .values(is_shared=is_shared)
    )
    await db.commit()


async def handle_user_app_is_shared(
    db: AsyncSession,
    app_uuid: UUID,
) -> None:
    """Handles the is_shared field for a user app.
    This field is used to determine if the app is shared with anyone else.

    Parameters
    ----------
    db : AsyncSession
    app_uuid : UUID
        The UUID of the user app.
    """

    shared_query = select(func.count(UserAppShare.uuid)).where(
        UserAppShare.user_app_uuid == app_uuid,
        UserAppShare.active.is_(True),
    )
    shared_count = (await db.execute(shared_query)).scalar_one_or_none() or 0

    is_shared = shared_count > 0

    await db.execute(
        update(UserApp).where(UserApp.uuid == app_uuid).values(is_shared=is_shared)
    )
    await db.commit()


async def get_dashboard_item(
    db: AsyncSession, dashboard_uuid: UUID, user_uuid: UUID
) -> None | models.DashboardItem:
    query = select(DashboardItem).where(
        DashboardItem.uuid == dashboard_uuid, DashboardItem.owner_uuid == user_uuid
    )
    return (await db.execute(query)).scalar_one_or_none()


async def get_user_dashboards_shared(
    db: AsyncSession, user_uuid: UUID
) -> UserDashboards:
    """Get all dashboards that are currently shared with a user. This does NOT include dashboards
    shared to the entire entity.
    """
    shared_query = select(DashboardShare.dashboard_item_uuid).where(
        DashboardShare.shared_user_uuid == user_uuid,
        DashboardShare.active.is_(True),
    )
    shared_uuids = (await db.execute(shared_query)).scalars().all()

    if not shared_uuids:
        return {}

    query = (
        select(
            DashboardItem.uuid,
            DashboardItem.content,
            DashboardItem.creator_uuid,
            DashboardItem.created_date,
            DashboardItem.updated_date,
            case(
                (
                    and_(User.first_name.is_not(None), User.last_name.is_not(None)),
                    func.concat(User.first_name, " ", User.last_name),
                ),
                else_=User.email,
            ).label("created_by"),
        )
        .join(User, User.uuid == DashboardItem.creator_uuid)
        .where(
            DashboardItem.uuid.in_(shared_uuids), DashboardItem.owner_uuid != user_uuid
        )
    )

    results = await db.execute(query)
    try:
        return {x.uuid: get_value(x, user_uuid) for x in results.all()}
    except Exception as e:
        logger.error(e)
        return {}


async def get_user_dashboards_entity_shared_noex(
    db: AsyncSession, user_uuid: UUID, permissions_uuid: UUID
) -> UserDashboards:
    "Gets all dashboards that are shared with all user's in the current user's entity"
    start_time = time()
    query = (
        select(
            DashboardItem.uuid,
            DashboardItem.content,
            DashboardItem.creator_uuid,
            DashboardItem.created_date,
            DashboardItem.updated_date,
            case(
                (
                    and_(User.first_name.is_not(None), User.last_name.is_not(None)),
                    func.concat(User.first_name, " ", User.last_name),
                ),
                else_=User.email,
            ).label("created_by"),
        )
        .join(User, User.uuid == DashboardItem.owner_uuid)
        .join(PermissionsEntityMap, User.permissions_uuid == PermissionsEntityMap.uuid)
        .where(
            DashboardItem.entity_share.is_(True),
            PermissionsEntityMap.uuid == permissions_uuid,
            DashboardItem.owner_uuid != user_uuid,
        )
    )
    results = await db.execute(query)
    data = {x.uuid: get_value(x, user_uuid) for x in results.all()}
    logger.warning(
        f"Time to get user entity dashboards: {(time() - start_time) * 1000:.2f}"
    )
    return data


async def get_user_dashboards_entity_shared(
    db: AsyncSession,
    user_uuid: UUID,
    permissions_uuid: UUID,
    exclude_uuids: list[UUID] | None = None,
) -> UserDashboards:
    "Gets all dashboards that are shared with all user's in the current user's entity"
    if permissions_uuid == settings.PRO_DEVELOPER_MAPPING and not settings.is_onprem():
        return {}

    user_entity_uuid = await get_user_entity_uuid(db, permissions_uuid)

    if not user_entity_uuid:
        return {}

    where_clause = (
        DashboardItem.entity_share.is_(True),
        DashboardItem.owner_uuid != user_uuid,
        DashboardItem.entity_uuid == user_entity_uuid,
    )
    if exclude_uuids:
        where_clause += (DashboardItem.uuid.notin_(exclude_uuids),)

    shared_query = select(DashboardItem.uuid).where(*where_clause)
    shared_uuids = (await db.execute(shared_query)).scalars().all()

    if not shared_uuids:
        return {}

    query = select(
        DashboardItem.uuid,
        DashboardItem.content,
        DashboardItem.creator_uuid,
        DashboardItem.created_date,
        DashboardItem.updated_date,
        case(
            (
                and_(User.first_name.is_not(None), User.last_name.is_not(None)),
                func.concat(User.first_name, " ", User.last_name),
            ),
            else_=User.email,
        ).label("created_by"),
    ).where(DashboardItem.uuid.in_(shared_uuids))

    results = await db.execute(query)
    return {x.uuid: get_value(x, user_uuid) for x in results.all()}


async def dashboard_owner_errors(
    db: AsyncSession, dashboard_uuid: UUID, user_uuid: UUID
) -> None | str:
    "This function returns a string error, or none if the user is the owner."
    query = (
        select(DashboardItem.owner_uuid)
        .where(DashboardItem.uuid == dashboard_uuid)
        .limit(1)
    )
    result = (await db.execute(query)).scalar_one_or_none()
    if not result:
        return "Dashboard does not exist"
    if result != user_uuid:
        return "You do not have permission to share this dashboard"
    return None


async def app_owner_errors(
    db: AsyncSession, app_uuid: UUID, user_uuid: UUID
) -> None | str:
    "This function returns a string error, or none if the user is the owner."
    query = select(UserApp.user_uuid).where(UserApp.uuid == app_uuid).limit(1)
    result = (await db.execute(query)).scalar_one_or_none()
    if not result:
        return "Dashboard does not exist"
    if result != user_uuid:
        return "You do not have permission to share this app"
    return None


async def get_dashboard_saves_to_delete(
    db: AsyncSession, max_saves: int = 10
) -> list[UUID]:
    "We delete all saves after n (max_saves) number of saves to conserve database. Saves are past states of a dashboard."
    row_number_column = (
        func.row_number()
        .over(
            partition_by=DashboardSave.dashboard_item_uuid,
            order_by=DashboardSave.created_date.desc(),
        )
        .label("row_num")
    )

    windowed_subquery = select(
        DashboardSave.uuid, DashboardSave.dashboard_item_uuid, row_number_column
    ).subquery()

    select_query = select(windowed_subquery.c.uuid).where(
        windowed_subquery.c.row_num > max_saves
    )
    results = await db.execute(select_query)
    return [x for x in results.scalars().all()]


async def get_total_user_count(db: AsyncSession, admin_uuid: UUID) -> int:
    "The total amount of active users in the entity of a given user."
    active_query = (
        select(func.count(User.uuid.distinct()))
        .join(
            models.PermissionsEntityMap,
            models.PermissionsEntityMap.uuid == User.permissions_uuid,
        )
        .join(
            models.Entity, models.Entity.uuid == models.PermissionsEntityMap.entity_uuid
        )
        .where(User.billing_active.is_(True), models.Entity.uuid == admin_uuid)
    ).limit(1)
    response = (await db.execute(active_query)).scalar_one_or_none()
    if response is None:
        raise HTTPException(
            404, detail="Could not find the entity associated with the given admin"
        )
    return response


async def total_user_count_full(db: AsyncSession, permissions_uuid: UUID) -> bool:
    "Returns true if there is a free seat for the entity"
    admin_query = (
        select(Entity.uuid, Entity.seats)
        .select_from(PermissionsEntityMap)
        .join(Entity, Entity.uuid == PermissionsEntityMap.entity_uuid)
        .where(PermissionsEntityMap.uuid == permissions_uuid)
    ).limit(1)
    admin_result = (await db.execute(admin_query)).first()
    if not admin_result:
        raise HTTPException(
            404, detail="Could not find the entity associated with the given admin"
        )
    total_count = await get_total_user_count(db, admin_result.uuid)
    return total_count < (admin_result.seats or 0)


async def check_new_user(db: AsyncSession, email: str) -> bool:
    cleaned = base.clean_email(email)
    if cleaned in settings.SPECIAL_EMAILS:
        return False
    query = select(User.clean_email).where(User.clean_email == cleaned).limit(1)
    result = (await db.execute(query)).first()
    return bool(result)


async def check_clean_email(db: AsyncSession, user_email: str):
    user_clean_email = base.clean_email(user_email)
    if user_clean_email in settings.SPECIAL_EMAILS:
        return None
    user_query = select(User.uuid).where(
        User.clean_email == user_clean_email,
        User.permissions_uuid.is_not(None),
        User.deleted.is_(False),
    )
    response = (await db.execute(user_query)).first()
    if response:
        raise HTTPException(409, detail="This email already has an account registered")


async def remove_pro_data(db: AsyncSession, user_uuid: UUID):
    stored_file_query = select(StoredFile).where(StoredFile.creater_uuid == user_uuid)
    stored_files = (await db.execute(stored_file_query)).scalars().all()

    for stored_file in stored_files:
        await FileStorage.delete_file(stored_file.bucket, stored_file.s3_file_name)
        await db.delete(stored_file)

    file_widgets = delete(models.FileWidget).where(
        models.FileWidget.user_uuid == user_uuid
    )
    await db.execute(file_widgets)
    single_widgets = delete(SingleWidget).where(SingleWidget.user_uuid == user_uuid)
    await db.execute(single_widgets)
    api_sources = delete(ApiSource).where(ApiSource.user_uuid == user_uuid)
    await db.execute(api_sources)
    meta_data = delete(models.WidgetMetadata).where(
        models.WidgetMetadata.user_uuid == user_uuid
    )
    await db.execute(meta_data)
    dev_onboarding = delete(models.DeveloperOnboarding).where(
        models.DeveloperOnboarding.user_uuid == user_uuid
    )
    await db.execute(dev_onboarding)
    entitlements = delete(models.Entitlement).where(
        models.Entitlement.user_uuid == user_uuid
    )
    await db.execute(entitlements)
    entitlements_usage = delete(models.EntitlementUsage).where(
        models.EntitlementUsage.user_uuid == user_uuid
    )
    await db.execute(entitlements_usage)
    try:
        copilot_chats = delete(models.DONT_USE_CopilotChats).where(
            models.DONT_USE_CopilotChats.user_uuid == user_uuid
        )
        await db.execute(copilot_chats)
    except Exception as e:
        logger.error(e)

    copilot_chats = delete(models.CopilotChat).where(
        models.CopilotChat.user_uuid == user_uuid
    )
    await db.execute(copilot_chats)

    tv_state = delete(models.TradingView).where(
        models.TradingView.user_uuid == user_uuid
    )
    await db.execute(tv_state)

    bundle_settings = delete(models.EnabledWidgetBundles).where(
        models.EnabledWidgetBundles.user_uuid == user_uuid
    )
    await db.execute(bundle_settings)

    mcp_servers = delete(models.MCPServers).where(
        models.MCPServers.user_uuid == user_uuid
    )
    await db.execute(mcp_servers)


async def remove_other_user_items(db: AsyncSession, user_uuid: UUID):
    user_email_query = select(User.email).where(User.uuid == user_uuid).limit(1)
    user_email = (await db.execute(user_email_query)).scalar_one_or_none()

    dash_item_query = delete(DashboardItem).where(
        or_(
            DashboardItem.creator_uuid == user_uuid,
            DashboardItem.owner_uuid == user_uuid,
        )
    )
    await db.execute(dash_item_query)
    login_query = delete(Login).where(Login.user_uuid == user_uuid)
    await db.execute(login_query)
    session_query = delete(models.Session).where(models.Session.user_uuid == user_uuid)
    await db.execute(session_query)

    try:
        if user_email:
            pro_invite_query = delete(models.UserProInvite).where(
                models.UserProInvite.email == user_email
            )
            await db.execute(pro_invite_query)
    except Exception as e:
        logger.error(e)

    perms_invite_query = delete(PermissionsInvite).where(
        PermissionsInvite.user_uuid == user_uuid
    )
    await db.execute(perms_invite_query)
    user_query = delete(User).where(User.uuid == user_uuid)
    await db.execute(user_query)


async def full_delete_user(db: AsyncSession, user_uuid: UUID):
    "This is a complete wipe of everything related to a user. We ONLY use this for integration tests."
    await remove_pro_data(db, user_uuid)
    await remove_other_user_items(db, user_uuid)
    await db.commit()


async def get_trial_entity_uuid(db: AsyncSession) -> None | UUID:
    r = settings.get_redis_session("pro")
    existing = r.get("TRIAL_ENTITY_UUID")
    if existing:
        return pickle.loads(existing)  # noqa: S301
    query = select(PermissionsEntityMap.entity_uuid).where(
        PermissionsEntityMap.uuid == settings.PRO_TRIAL_MAPPING
    )
    result = await db.execute(query)
    if (entity_uuid := result.scalar()) is None:
        return None
    r.set("TRIAL_ENTITY_UUID", pickle.dumps(entity_uuid))
    return entity_uuid


async def get_trial_permissions_uuids(db: AsyncSession) -> set[UUID]:
    r = settings.get_redis_session("pro")
    existing = r.get("TRIAL_PERMISSIONS_UUIDS")
    if existing:
        return pickle.loads(existing)  # noqa: S301
    entity_uuid = await get_trial_entity_uuid(db)
    query = select(PermissionsEntityMap.uuid).where(
        PermissionsEntityMap.entity_uuid == entity_uuid
    )
    result = await db.execute(query)
    final_result = {x[0] for x in result.all()}
    r.set("TRIAL_PERMISSIONS_UUIDS", pickle.dumps(final_result), ex=60 * 60 * 24 * 7)
    return final_result


async def get_shares_without_existing(
    db: AsyncSession,
    share: schemas.ShareDashboard,
    dashboard_uuid: UUID,
    user_email: str,
) -> schemas.SharesPermissions:
    current_shares_query = (
        select(User.email)
        .join(DashboardShare, User.uuid == DashboardShare.shared_user_uuid)
        .where(
            DashboardShare.dashboard_item_uuid == dashboard_uuid,
            DashboardShare.active.is_(True),
        )
    )
    current_shares_response = await db.execute(current_shares_query)
    current_shares = [x for x in current_shares_response.scalars().all()]
    current_shares.append(user_email)
    # For right now if a user is already shared we will not update the share, even if the permissions are different
    return {x: y for x, y in share.shares.items() if x not in current_shares}


async def get_app_shares_without_existing(
    db: AsyncSession,
    share: schemas.ShareDashboard,
    app_uuid: UUID,
    user_email: str,
) -> schemas.SharesPermissions:
    current_shares_query = (
        select(User.email)
        .join(UserAppShare, User.uuid == UserAppShare.shared_user_uuid)
        .where(
            UserAppShare.user_app_uuid == app_uuid,
            UserAppShare.active.is_(True),
        )
    )
    current_shares_response = await db.execute(current_shares_query)
    current_shares = [x for x in current_shares_response.scalars().all()]
    current_shares.append(user_email)
    # For right now if a user is already shared we will not update the share, even if the permissions are different
    return {x: y for x, y in share.shares.items() if x not in current_shares}


class NewSharingPermission(TypedDict):
    dashboard_item_uuid: UUID
    shared_user_uuid: UUID
    permissions: schemas.permissions_type


async def get_new_sharing_permissions(
    db: AsyncSession,
    clean_shares: schemas.SharesPermissions,
    permissions_uuid: UUID,
    dashboard_uuid: UUID | None = None,
    app_uuid: UUID | None = None,
) -> tuple[list[NewSharingPermission], list[str], UUID, list[UUID]]:
    current_user_entity_query = select(PermissionsEntityMap.entity_uuid).where(
        PermissionsEntityMap.uuid == permissions_uuid
    )
    current_user_entity = await db.execute(current_user_entity_query)
    if (entity_uuid := current_user_entity.scalar()) is None:
        raise HTTPException(status_code=400, detail="The user does not have an entity")

    user_uuids_query = (
        select(User.uuid, User.email)
        .join(PermissionsEntityMap, PermissionsEntityMap.uuid == User.permissions_uuid)
        .where(
            User.email.in_(clean_shares.keys()),
            PermissionsEntityMap.entity_uuid == entity_uuid,
        )
    )
    user_uuids_response = (await db.execute(user_uuids_query)).all()

    dict_key = "dashboard_item_uuid" if dashboard_uuid else "user_app_uuid"
    permissions: list[NewSharingPermission] = [
        {
            dict_key: dashboard_uuid or app_uuid,
            "shared_user_uuid": x.uuid,
            "permissions": clean_shares.get(x.email, "view"),
        }
        for x in user_uuids_response
    ]
    return (
        permissions,
        [x.email for x in user_uuids_response],
        entity_uuid,
        [x.uuid for x in user_uuids_response],
    )


async def get_unregistered_users(
    db: AsyncSession, shares: schemas.SharesPermissions, good_emails: list[str]
) -> set[str]:
    clean_emails = set(shares.keys()) - set(good_emails)
    if not clean_emails:
        return set()
    query = select(User.email).where(
        User.email.in_(clean_emails), User.permissions_uuid.isnot(None)
    )
    result = await db.execute(query)
    return clean_emails - {x for x in result.scalars().all()}


async def get_invite_shares(
    db: AsyncSession,
    user_uuid: UUID,
    dashboard_uuid: UUID | None = None,
    app_uuid: UUID | None = None,
) -> dict[str, schemas.DashboardShareReturn | schemas.UserAppShareReturn]:
    trial_permissions_uuids = await get_trial_permissions_uuids(db)
    final_result: dict[
        str, schemas.DashboardShareReturn | schemas.UserAppShareReturn
    ] = {}
    hub_invite_query = (
        select(
            PermissionsInvite.shared_apps,
            PermissionsInvite.shared_dashboards,
            PermissionsInvite.created_date,
            User.email,
        )
        .select_from(PermissionsInvite)
        .join(User, User.uuid == PermissionsInvite.user_uuid)
        .where(
            PermissionsInvite.accepted.is_(False),
            PermissionsInvite.revoked.is_(False),
            PermissionsInvite.expiration_date > base.get_now(),
            PermissionsInvite.permissions_uuid.in_(trial_permissions_uuids),
        )
    )

    if dashboard_uuid:
        hub_invite_query = hub_invite_query.where(
            PermissionsInvite.shared_dashboards.contains(str(dashboard_uuid))
        )
    if app_uuid:
        hub_invite_query = hub_invite_query.where(
            PermissionsInvite.shared_apps.contains(str(app_uuid))
        )

    for invited in (await db.execute(hub_invite_query)).all():
        if dashboard_uuid and str(dashboard_uuid) in invited.shared_dashboards:
            permissions = invited.shared_dashboards.get(str(dashboard_uuid))
            final_result[invited.email] = schemas.DashboardShareReturn(
                permissions=permissions,
                created_date=invited.created_date,
                is_invite=True,
                first_name=None,
                last_name=None,
            )
        if app_uuid and invited.shared_apps and str(app_uuid) in invited.shared_apps:
            permissions = invited.shared_apps.get(str(app_uuid))
            final_result[invited.email] = schemas.UserAppShareReturn(
                permissions=permissions,
                created_date=invited.created_date,
                is_invite=True,
                first_name=None,
                last_name=None,
            )

    new_invite_query = select(
        UserProInvite.shared_apps,
        UserProInvite.shared_dashboards,
        UserProInvite.created_date,
        UserProInvite.email,
    ).where(
        UserProInvite.used.is_(False),
        UserProInvite.inviting_user_uuid == user_uuid,
        UserProInvite.permissions_uuid.in_(trial_permissions_uuids),
    )
    if dashboard_uuid:
        new_invite_query = new_invite_query.where(
            UserProInvite.shared_dashboards.contains(str(dashboard_uuid))
        )
    if app_uuid:
        new_invite_query = new_invite_query.where(
            UserProInvite.shared_apps.contains(str(app_uuid))
        )

    for new_invite in (await db.execute(new_invite_query)).all():
        if dashboard_uuid and str(dashboard_uuid) in new_invite.shared_dashboards:
            permissions = new_invite.shared_dashboards.get(str(dashboard_uuid))
            final_result[new_invite.email] = schemas.DashboardShareReturn(
                permissions=permissions,
                created_date=new_invite.created_date,
                is_invite=True,
                first_name=None,
                last_name=None,
            )
        if (
            app_uuid
            and new_invite.shared_apps
            and str(app_uuid) in new_invite.shared_apps
        ):
            permissions = new_invite.shared_apps.get(str(app_uuid))
            final_result[new_invite.email] = schemas.UserAppShareReturn(
                permissions=permissions,
                created_date=new_invite.created_date,
                is_invite=True,
                first_name=None,
                last_name=None,
            )
    return final_result


def get_updated_share_values(
    dash_item_uuids: list[UUID],
    shared_dashboards: dict,
    user_app_uuids: list[UUID],
    shared_apps: dict,
) -> dict[Literal["shared_dashboards", "shared_apps"], dict]:
    new_shared_dashboards = {
        key: value
        for key, value in shared_dashboards.items()
        if shared_dashboards and key not in dash_item_uuids
    }
    new_shared_apps = {
        key: value
        for key, value in shared_apps.items()
        if shared_apps and key not in user_app_uuids
    }
    values = {
        k: v
        for k, v in {
            "shared_apps": (
                new_shared_apps if len(new_shared_apps) != len(shared_apps) else None
            ),
            "shared_dashboards": (
                new_shared_dashboards
                if len(new_shared_dashboards) != len(shared_dashboards)
                else None
            ),
        }.items()
        if v is not None
    }
    return values


async def remove_shares_both_ways(
    db: AsyncSession, user_uuid: None | UUID = None, email: None | str = None
):
    trial_permissions_uuids = await get_trial_permissions_uuids(db)
    if user_uuid is None:
        user_uuid_query = select(User.uuid).where(User.email == email)
        user_uuid_response = (await db.execute(user_uuid_query)).first()
        if user_uuid_response is None:
            raise HTTPException(status_code=400, detail="The user could not be found")
        user_uuid = user_uuid_response[0]

    # Delete the dashboards this user shared with others
    dash_item_uuids_query = select(DashboardItem.uuid).where(
        DashboardItem.owner_uuid == user_uuid
    )
    dash_item_uuids = (await db.execute(dash_item_uuids_query)).scalars().all()
    await db.execute(
        delete(DashboardShare).where(
            DashboardShare.dashboard_item_uuid.in_(dash_item_uuids)
        )
    )

    # Delete the dashboards shared with this user
    await db.execute(
        delete(DashboardShare).where(DashboardShare.shared_user_uuid == user_uuid)
    )

    # Delete the app shares this user shared with others
    user_app_uuids = (
        (await db.execute(select(UserApp.uuid).where(UserApp.user_uuid == user_uuid)))
        .scalars()
        .all()
    )
    await db.execute(
        delete(UserAppShare).where(UserAppShare.user_app_uuid.in_(user_app_uuids))
    )

    # Remove the share from permissions invites
    hub_invite_query = select(
        PermissionsInvite.uuid,
        PermissionsInvite.shared_dashboards,
        PermissionsInvite.shared_apps,
    ).where(
        PermissionsInvite.accepted.is_(False),
        PermissionsInvite.revoked.is_(False),
        PermissionsInvite.expiration_date > base.get_now(),
        PermissionsInvite.permissions_uuid.in_(trial_permissions_uuids),
    )
    hub_invites: list[tuple[UUID, dict, dict]] = (
        await db.execute(hub_invite_query)
    ).all()
    for uuid, shared_dashboards, shared_apps in hub_invites:
        if not shared_dashboards and not shared_apps:
            continue

        values = get_updated_share_values(
            dash_item_uuids, shared_dashboards, user_app_uuids, shared_apps
        )
        if not values:
            continue

        update_query = (
            update(PermissionsInvite)
            .where(PermissionsInvite.uuid == uuid)
            .values(**values)
        )
        await db.execute(update_query)

    new_invite_query = select(
        UserProInvite.uuid, UserProInvite.shared_dashboards, UserProInvite.shared_apps
    ).where(
        UserProInvite.used.is_(False),
        UserProInvite.inviting_user_uuid == user_uuid,
        UserProInvite.permissions_uuid.in_(trial_permissions_uuids),
    )
    new_invites: list[tuple[UUID, dict, dict]] = (
        await db.execute(new_invite_query)
    ).all()
    for uuid, shared_dashboards, shared_apps in new_invites:
        if not shared_dashboards and not shared_apps:
            continue

        values = get_updated_share_values(
            dash_item_uuids, shared_dashboards, user_app_uuids, shared_apps
        )
        if not values:
            continue

        update_query = (
            update(UserProInvite).where(UserProInvite.uuid == uuid).values(**values)
        )
        await db.execute(update_query)


async def update_user_dashboards_new_entity(
    db: AsyncSession, user_uuid: UUID, new_entity_uuid: UUID | None = None
):
    query = (
        update(DashboardItem)
        .where(DashboardItem.owner_uuid == user_uuid)
        .values(entity_uuid=new_entity_uuid)
    )
    await db.execute(query)
    await db.commit()


UserApps = dict[UUID, schemas.UserAppReturn]


async def get_user_apps_shared(db: AsyncSession, user_uuid: UUID) -> UserApps:
    """Get all user apps that are currently shared with a user."""
    shared_query = select(UserAppShare.user_app_uuid).where(
        UserAppShare.shared_user_uuid == user_uuid,
        UserAppShare.active.is_(True),
    )
    shared_uuids = (await db.execute(shared_query)).scalars().all()

    if not shared_uuids:
        return {}

    query = (
        select(
            UserApp.uuid,
            UserApp.content,
            UserApp.user_uuid.label("creator_uuid"),
            UserApp.created_date,
            UserApp.updated_date,
            case(
                (
                    and_(User.first_name.is_not(None), User.last_name.is_not(None)),
                    func.concat(User.first_name, " ", User.last_name),
                ),
                else_=User.email,
            ).label("created_by"),
        )
        .join(User, User.uuid == UserApp.user_uuid)
        .where(UserApp.uuid.in_(shared_uuids), UserApp.user_uuid != user_uuid)
    )

    results = await db.execute(query)
    try:
        return {
            x.uuid: get_value(x, user_uuid, schemas.UserAppReturn)
            for x in results.all()
        }
    except Exception as e:
        logger.error(e)
        return {}


async def get_user_apps_owned(db: AsyncSession, user_uuid: UUID) -> UserApps:
    "Gets all of a user's apps that they own."
    query = (
        select(
            UserApp.uuid,
            UserApp.content,
            UserApp.user_uuid.label("creator_uuid"),
            UserApp.created_date,
            UserApp.updated_date,
            UserApp.is_shared,
            case(
                (
                    and_(User.first_name.is_not(None), User.last_name.is_not(None)),
                    func.concat(User.first_name, " ", User.last_name),
                ),
                else_=User.email,
            ).label("created_by"),
        )
        .join(User, User.uuid == UserApp.user_uuid)
        .where(UserApp.user_uuid == user_uuid)
    )

    shared_with_query = (
        select(UserAppShare.user_app_uuid, User.first_name, User.last_name, User.email)
        .join(User, User.uuid == UserAppShare.shared_user_uuid)
        .where(
            UserAppShare.shared_user_uuid != user_uuid,
            UserAppShare.active.is_(True),
            UserAppShare.permissions == "view",
        )
    )

    results = (await db.execute(query)).all()

    shared_with_results = await db.execute(shared_with_query)
    shared_with_map: dict[UUID, list[dict[str, str]]] = {}

    for row in shared_with_results.all():
        full_name = (
            f"{row.first_name} {row.last_name}"
            if row.first_name and row.last_name
            else row.email
        )
        shared_with_map.setdefault(row.user_app_uuid, []).append(
            {"name": full_name, "email": row.email}
        )

    for x in results:
        x.content["shared_with"] = shared_with_map.get(x.uuid, [])

    return {x.uuid: get_value(x, user_uuid, schemas.UserAppReturn) for x in results}
