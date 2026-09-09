import asyncio
from time import time
from typing import Literal
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy import and_, case, delete, func, insert, literal, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.sql import quoted_name

from api import base, crud, database, models, schemas
from api.auth_helpers import CustomRow
from utilities.config import settings

EXCEPTION_401 = HTTPException(
    status.HTTP_401_UNAUTHORIZED,
    detail="Incorrect username or password",
    headers={"WWW-Authenticate": "Bearer"},
)

TierType = Literal["pro", "terminal"]


ON_PREM_DATA_BUNDLE = schemas.DataBundle(
    bundle_name="On-Premise",
    except_widgets=[],
    except_dashboard_templates=[
        "calendars",
        "charting",
        "countryEconomics",
        "comparison",
        "earnings",
        "etfTemplate",
        "equity",
        "equityAnalyst",
        "news",
        "onboarding",
    ],
    except_team_collaboration=None,
    excel_add_in=1,
    data_export=1,
    providers=None,
    dashboards_at_launch=[],
    my_dashboards=[],
    invite_your_colleagues=0,
    number_copilot_calls_day=10_000,
    total_file_upload_size_gb=10,
)


async def is_trial(db: AsyncSession, user_uuid: UUID) -> bool:
    query = select(models.User.permissions_uuid).where(
        models.User.uuid == user_uuid,
    )
    result = (await db.execute(query)).scalar_one_or_none()
    return result == settings.PRO_TRIAL_MAPPING


async def is_trial_entity(db: AsyncSession, entity_uuid: UUID) -> bool:
    """
    Check if the given entity UUID corresponds to the trial entity.

    Args:
        db (AsyncSession): The database session.
        entity_uuid (UUID): The UUID of the entity to check.

    Returns:
        bool: True if the entity is a trial entity, False otherwise.
    """
    query = select(models.PermissionsEntityMap.entity_uuid).where(
        models.PermissionsEntityMap.uuid == settings.PRO_TRIAL_MAPPING,
    )
    result = (await db.execute(query)).scalar_one_or_none()
    return result == entity_uuid


async def is_developer_entity(db: AsyncSession, entity_uuid: UUID) -> bool:
    """
    Check if the given entity UUID corresponds to the developer entity.

    Args:
        db (AsyncSession): The database session.
        entity_uuid (UUID): The UUID of the entity to check.

    Returns:
        bool: True if the entity is the developer entity, False otherwise.
    """
    query = select(models.PermissionsEntityMap.entity_uuid).where(
        models.PermissionsEntityMap.uuid == settings.PRO_DEVELOPER_MAPPING,
    )
    result = (await db.execute(query)).scalar_one_or_none()
    return result == entity_uuid


async def set_pro_user_data(user, db: AsyncSession) -> schemas.ProUserReturn:
    return schemas.ProUserReturn(
        expiration_date=user.expiration_date,
        entitlements=user.pro_entitlements,
        accepted_pro_tos=bool(user.accepted_pro_tos),
        first_name=user.first_name,
        last_name=user.last_name,
        pro_display_settings=user.pro_display_settings,
        pro_zero_to_hero=user.pro_zero_to_hero,
        single_widgets=[x.__dict__ for x in user.SingleWidget],
        file_widgets=[x.__dict__ for x in user.FileWidget],
        api_sources=[x.__dict__ for x in user.ApiSource],
        username=user.username,
        email=user.email,
        uuid=user.uuid,
        primary_usage=user.primary_usage,
        entity_info=await _get_user_entity_info(db, user.uuid),
    )


async def get_mcp_servers(db: AsyncSession, user: models.User) -> schemas.MCPServers:
    query = (
        select(models.MCPServers.servers)
        .where(models.MCPServers.user_uuid == user.uuid)
        .limit(1)
    )
    results = (await db.execute(query)).scalar_one_or_none()

    return schemas.MCPServers(servers=results or [])


async def get_copilot_chats(
    db: AsyncSession, user_uuid: UUID, retry: bool = True
) -> list[schemas.ChatInfo | schemas.Chat]:

    last_opened_query = (
        select(models.CopilotChat)
        .options(selectinload(models.CopilotChat.messages))
        .where(models.CopilotChat.user_uuid == user_uuid)
        .order_by(models.CopilotChat.last_opened.desc())
        .limit(1)
    )
    last_opened = (await db.execute(last_opened_query)).scalar_one_or_none()

    latest_uuid = last_opened.uuid if last_opened else None

    query = (
        select(
            models.CopilotChat.uuid,
            models.CopilotChat.content,
            models.CopilotChat.created_date,
            models.CopilotChat.updated_date,
        )
        .where(models.CopilotChat.user_uuid == user_uuid)
        .order_by(models.CopilotChat.created_date.desc())
    )
    chats: list[schemas.ChatInfo | schemas.Chat] = []

    async for v in (await db.stream(query)).mappings():
        row = CustomRow(**v)
        chats.append(
            schemas.Chat.from_row(last_opened if row.uuid == latest_uuid else row)
        )

    # backwards compatibility with old chats
    if not chats and retry and (await migrate_user_copilot_chats(db, user_uuid)):
        return await get_copilot_chats(db, user_uuid, retry=False)

    return chats or schemas.default_chats()


async def get_user_questions_history(db: AsyncSession, user_uuid: UUID) -> list[str]:
    """Get the history of unique questions asked by the user, ordered by the most recent update date."""
    query = (
        select(models.ChatMessages.searchable_content)
        .where(
            models.ChatMessages.user_uuid == user_uuid,
            models.ChatMessages.role == base.ChatMessageRole.human,
            models.ChatMessages.searchable_content.isnot(None),
        )
        .group_by(models.ChatMessages.searchable_content)
        .order_by(func.max(models.ChatMessages.updated_date).asc())
    )
    return (await db.execute(query)).scalars().all()


async def migrate_user_copilot_chats(db: AsyncSession, user_uuid: UUID):
    """Migrate old copilot chats to the new format."""
    chats_post: dict[UUID, schemas.ChatUpdate] = {}
    query = select(models.CopilotChatOld).where(
        models.CopilotChatOld.user_uuid == user_uuid
    )

    async for row in (await db.stream(query)).scalars():
        try:
            chat = schemas.Chat.from_db(row.content, row.uuid).model_dump(by_alias=True)
            messages = {uuid4(): m for m in chat.pop("messages", [])}
            chat.update({"messages": messages})
            chats_post[row.uuid] = schemas.ChatUpdate.model_validate(chat)
        except Exception as e:
            logger.error(e)
            continue

    if not chats_post:
        return False

    try:
        await crud.bulk_copilot_chats_insert_update(
            db, user_uuid, schemas.CopilotChatsCreate(chats=chats_post)
        )
        return True
    except SQLAlchemyError as e:
        logger.error(e)
        await db.rollback()

    return False


async def get_entity_theme_settings(db: AsyncSession, entity_uuid: UUID):
    """Get the ag-grid theme settings for the entity"""
    query = (
        select(models.EntityThemeSettings.settings)
        .where(models.EntityThemeSettings.entity_uuid == entity_uuid)
        .limit(1)
    )
    result = (await db.execute(query)).scalar_one_or_none()
    if not result:
        return schemas.EntityThemeSettings()

    return schemas.EntityThemeSettings.model_validate(result)


async def get_trading_view_state(
    db: AsyncSession, user: models.User
) -> schemas.TVStateResponse:
    query = (
        select(models.TradingView)
        .where(models.TradingView.user_uuid == user.uuid)
        .limit(1)
    )
    result = (await db.execute(query)).scalar_one_or_none()
    return schemas.TVStateResponse.model_validate(result or {})


async def user_app_task(
    type: Literal["owned", "shared"], user_uuid: UUID
) -> crud.UserApps:
    start_time = time()
    try:
        async with database.AsyncReadSessionLocal.session() as session:
            if type == "owned":
                return await crud.get_user_apps_owned(session, user_uuid)
            if type == "shared":
                return await crud.get_user_apps_shared(session, user_uuid)
    except Exception as e:
        logger.exception(e)
    finally:
        logger.warning(
            f"User app task {type} took {(time() - start_time) * 1000:.2f}ms",
            exclude=True,
        )
    return {}


async def get_user_apps_complete(user: models.User) -> schemas.UserAppsComplete:
    tasks: list[asyncio.Task[crud.UserApps]] = [
        asyncio.create_task(user_app_task("owned", user.uuid)),
        asyncio.create_task(user_app_task("shared", user.uuid)),
    ]

    owned, shared = await asyncio.gather(*tasks)

    return schemas.UserAppsComplete(owned=owned, shared=shared)


async def dashboard_task(
    type: Literal["owned", "shared", "entity_shared"],
    user_uuid: UUID,
    permissions_uuid: UUID | None = None,
) -> crud.UserDashboards:
    start_time = time()
    try:
        async with database.AsyncReadSessionLocal.session() as session:
            if type == "owned":
                return await crud.get_user_dashboards_owned(session, user_uuid)
            if type == "shared":
                return await crud.get_user_dashboards_shared(session, user_uuid)
            if type == "entity_shared":
                return await crud.get_user_dashboards_entity_shared(
                    session, user_uuid, permissions_uuid
                )
    except Exception as e:
        logger.exception(e)
    finally:
        logger.warning(
            f"Dashboard task {type} took {(time() - start_time) * 1000:.2f}ms",
            exclude=True,
        )
    return {}


async def get_dashboards_complete(user: models.User) -> schemas.DashboardComplete:
    if user.permissions_uuid != settings.PRO_DEVELOPER_MAPPING or settings.is_onprem():
        tasks: list[asyncio.Task[crud.UserDashboards]] = [
            asyncio.create_task(dashboard_task("owned", user.uuid)),
            asyncio.create_task(dashboard_task("shared", user.uuid)),
            asyncio.create_task(
                dashboard_task("entity_shared", user.uuid, user.permissions_uuid)
            ),
        ]

        owned, shared, entity_shared = await asyncio.gather(*tasks)

        entity_shared = {k: v for k, v in entity_shared.items() if k not in shared}

        return schemas.DashboardComplete(
            owned=owned, shared=shared, entity_shared=entity_shared
        )

    owned = await dashboard_task("owned", user.uuid)

    return schemas.DashboardComplete(owned=owned, shared={}, entity_shared={})


async def check_login(
    db: AsyncSession, user: schemas.UserLogin, db_user: schemas.UserProSchema | None
):
    if not db_user:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="The provided credentials do not match any registered user account.",
        )

    if not user._bypass_password_check and not base.verify_password(
        user.password, db_user.password
    ):
        raise EXCEPTION_401

    is_developer = await is_developer_entity(db, db_user.entity_uuid)
    if not is_developer and not db_user.billing_active:
        raise HTTPException(
            status_code=402, detail="User is not currently assigned a seat"
        )

    if not db_user.expiration_date or db_user.expiration_date < base.get_now():
        raise HTTPException(
            status_code=402, detail="Entity expiration date has expired"
        )


async def has_entitlement(db: AsyncSession, user_uuid: UUID):
    query_check_has_entitlement = (
        select(models.Entitlement.uuid)
        .where(models.Entitlement.user_uuid == user_uuid)
        .limit(1)
    )
    return (await db.execute(query_check_has_entitlement)).scalar_one_or_none()


async def _get_tier_defaults(db: AsyncSession, tier: TierType):
    tiers_match = {
        "pro": models.PRO_TIER_ID,
        "terminal": models.TERMINAL_TIER_ID,
    }
    tier_id = tiers_match.get(tier)
    if tier_id is None:
        raise HTTPException(status_code=422, detail="Invalid tier")
    tier_defaults = (
        await db.execute(
            select(models.TierDefaults).where(models.TierDefaults.tier_id == tier_id)
        )
    ).scalar_one_or_none()
    if tier_defaults is None:
        raise HTTPException(status_code=422, detail="Invalid tier")
    return tier_id, tier_defaults


async def _handle_data_bundle(db: AsyncSession, tier: TierType, trial: bool = False):
    if settings.is_onprem() and tier == "pro":
        return await get_data_bundle_uuid(db, "On-Premise")
    if tier == "terminal":
        return await get_data_bundle_uuid(db, models.DATA_BUNDLE_DEFAULT)
    if tier == "pro" and trial:
        return await get_data_bundle_uuid(db, models.DATA_BUNDLE_PRO_TRIAL)
    return None


async def get_data_bundle_uuid(db: AsyncSession, bundle_name: str):
    if not isinstance(bundle_name, str):
        raise ValueError(
            f"bundle_name must be a string, got {type(bundle_name).__name__}"
        )

    return (
        await db.execute(
            select(models.DataBundle.uuid).where(
                models.DataBundle.bundle_name == bundle_name
            )
        )
    ).scalar_one_or_none()


async def check_against_entity_tier(db: AsyncSession, user_uuid: UUID, tier: TierType):
    entity_uuid = await get_entity_uuid(db, user_uuid)
    entity_entitlement = await get_entity_entitlement(db, entity_uuid)

    if entity_entitlement.tier != tier:
        raise HTTPException(
            status_code=400,
            detail=f"Entity and user tier do not match. Entity tier is `{entity_entitlement.tier}`,"
            f" request had tier `{tier}`",
        )


async def insert_entitlement(db: AsyncSession, user_uuid: UUID, tier: TierType):
    await check_against_entity_tier(db, user_uuid, tier)

    tier_id, tier_defaults = await _get_tier_defaults(db, tier)
    is_trial_user = await is_trial(db, user_uuid)
    data_bundle_uuid = await _handle_data_bundle(db, tier, is_trial_user)

    query = insert(models.Entitlement).values(
        user_uuid=user_uuid,
        tier_id=tier_id,
        number_copilot_calls_day=tier_defaults.number_copilot_calls_day,
        total_file_upload_size_gb=tier_defaults.total_file_upload_size_gb,
        share_widgets=tier_defaults.share_widgets,
        bring_your_own_data=tier_defaults.bring_your_own_data,
        bring_your_own_copilot=tier_defaults.bring_your_own_copilot,
        admin_access=tier_defaults.admin_access,
        support=tier_defaults.support,
        excel_add_in=tier_defaults.excel_add_in,
        data_add_ons_redistribution=tier_defaults.data_add_ons_redistribution,
        data_bundle_uuid=data_bundle_uuid,
    )
    await db.execute(query)
    await db.commit()


async def update_entitlement(db: AsyncSession, user_uuid: UUID, tier: TierType):
    await check_against_entity_tier(db, user_uuid, tier)

    tier_id, tier_defaults = await _get_tier_defaults(db, tier)
    is_trial_user = await is_trial(db, user_uuid)
    data_bundle_uuid = await _handle_data_bundle(db, tier, is_trial_user)

    query = (
        update(models.Entitlement)
        .where(models.Entitlement.user_uuid == user_uuid)
        .values(
            tier_id=tier_id,
            number_copilot_calls_day=tier_defaults.number_copilot_calls_day,
            total_file_upload_size_gb=tier_defaults.total_file_upload_size_gb,
            share_widgets=tier_defaults.share_widgets,
            bring_your_own_data=tier_defaults.bring_your_own_data,
            bring_your_own_copilot=tier_defaults.bring_your_own_copilot,
            admin_access=tier_defaults.admin_access,
            support=tier_defaults.support,
            excel_add_in=tier_defaults.excel_add_in,
            data_add_ons_redistribution=tier_defaults.data_add_ons_redistribution,
            data_bundle_uuid=data_bundle_uuid,
        )
    )
    await db.execute(query)
    await db.commit()


async def get_entity_uuid(db: AsyncSession, user_uuid: UUID) -> UUID:
    entity_query = (
        select(models.Entity.uuid)
        .select_from(models.User)
        .join(
            models.PermissionsEntityMap,
            models.User.permissions_uuid == models.PermissionsEntityMap.uuid,
            isouter=True,
        )
        .join(
            models.Entity,
            models.PermissionsEntityMap.entity_uuid == models.Entity.uuid,
            isouter=True,
        )
        .where(models.User.uuid == user_uuid)
        .limit(1)
    )
    entity_uuid = (await db.execute(entity_query)).scalar_one_or_none()

    return entity_uuid


async def get_entity_users(db: AsyncSession, entity_uuid: UUID):
    query = (
        select(models.User.uuid)
        .select_from(models.User)
        .join(
            models.PermissionsEntityMap,
            models.PermissionsEntityMap.uuid == models.User.permissions_uuid,
        )
        .join(
            models.Entity, models.Entity.uuid == models.PermissionsEntityMap.entity_uuid
        )
        .where(models.Entity.uuid == entity_uuid)
    )
    return (await db.execute(query)).scalars().all()


async def get_entitlement(db: AsyncSession, user_uuid: UUID):
    has_entitlement_ = await has_entitlement(db, user_uuid)

    if not has_entitlement_:
        # If the user does not have an entitlement, return the entity entitlement
        entity_uuid = await get_entity_uuid(db, user_uuid)
        if entity_uuid:
            return await get_entity_entitlement(db, entity_uuid)

    query = (
        select(
            case(
                (models.Entitlement.tier_id == models.PRO_TIER_ID, literal("pro")),
                (
                    models.Entitlement.tier_id == models.TERMINAL_TIER_ID,
                    literal("terminal"),
                ),
                else_=None,
            ).label("tier"),
            models.Entitlement.number_copilot_calls_day,
            models.Entitlement.total_file_upload_size_gb,
            models.Entitlement.share_widgets,
            models.Entitlement.bring_your_own_data,
            models.Entitlement.bring_your_own_copilot,
            models.Entitlement.admin_access,
            models.Entitlement.support,
            models.Entitlement.excel_add_in,
            models.Entitlement.data_add_ons_redistribution,
            models.Entitlement.data_bundle_uuid,
            models.Entitlement.allow_custom_backends,
            # DataBundle fields
            models.DataBundle.bundle_name,
            models.DataBundle.except_widgets,
            models.DataBundle.except_dashboard_templates,
            models.DataBundle.except_team_collaboration,
            models.DataBundle.excel_add_in.label("data_bundle_excel_add_in"),
            models.DataBundle.data_export,
            models.DataBundle.providers,
            models.DataBundle.dashboards_at_launch,
            models.DataBundle.my_dashboards,
            models.DataBundle.invite_your_colleagues,
            models.DataBundle.number_copilot_calls_day.label(
                "data_bundle_number_copilot_calls_day"
            ),
            models.DataBundle.total_file_upload_size_gb.label(
                "data_bundle_total_file_upload_size_gb"
            ),
        )
        .select_from(models.Entitlement)
        .join(
            models.DataBundle,
            models.Entitlement.data_bundle_uuid == models.DataBundle.uuid,
            isouter=True,
        )
        .where(models.Entitlement.user_uuid == user_uuid)
        .limit(1)
    )
    entitlement = (await db.execute(query)).first()

    if not entitlement:
        return entitlement

    entitlement_dict = entitlement._asdict()
    data_bundle_uuid = entitlement_dict.pop("data_bundle_uuid", None)
    data_bundle_dict = {
        k: entitlement_dict.pop(k)
        for k in [
            "bundle_name",
            "except_widgets",
            "except_dashboard_templates",
            "except_team_collaboration",
            "data_bundle_excel_add_in",
            "data_export",
            "providers",
            "dashboards_at_launch",
            "my_dashboards",
            "invite_your_colleagues",
            "data_bundle_number_copilot_calls_day",
            "data_bundle_total_file_upload_size_gb",
        ]
        if k in entitlement_dict
    }
    data_bundle_dict["excel_add_in"] = data_bundle_dict.pop(
        "data_bundle_excel_add_in", None
    )
    data_bundle_dict["number_copilot_calls_day"] = data_bundle_dict.pop(
        "data_bundle_number_copilot_calls_day", None
    )
    data_bundle_dict["total_file_upload_size_gb"] = data_bundle_dict.pop(
        "data_bundle_total_file_upload_size_gb", None
    )

    entitlement_get = schemas.EntitlementGet(**entitlement_dict)

    if data_bundle_uuid and data_bundle_dict:
        entitlement_get.bundle_name = data_bundle_dict["bundle_name"]
        entitlement_get.data_bundle_info = schemas.DataBundle(**data_bundle_dict)

    return entitlement_get


async def has_usage(db: AsyncSession, user_uuid: UUID):
    query = select(models.EntitlementUsage.uuid).where(
        models.EntitlementUsage.user_uuid == user_uuid
    )
    return (await db.execute(query)).scalar_one_or_none()


async def check_usage_validity(
    db: AsyncSession, usage: schemas.EntitlementUsagePut, user_uuid: UUID
):
    query = select(models.Entitlement).where(models.Entitlement.user_uuid == user_uuid)
    result = (await db.execute(query)).scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=404, detail="Entitlement not found")

    for key, value in usage.entitlement_match_dump().items():
        if value > result.__dict__[key]:
            raise HTTPException(
                status_code=400,
                detail=f"Usage not valid for `{key}`. Maximum allowed is {result.__dict__[key]}",
            )

    return result


async def insert_entity_entitlement(
    db: AsyncSession, entity_uuid: UUID, tier: TierType
):
    tier_id, tier_defaults = await _get_tier_defaults(db, tier)
    trial = await is_trial_entity(db, entity_uuid)
    data_bundle_uuid = await _handle_data_bundle(db, tier, trial)

    query = insert(models.EntityEntitlement).values(
        entity_uuid=entity_uuid,
        tier_id=tier_id,
        number_copilot_calls_day=tier_defaults.number_copilot_calls_day,
        total_file_upload_size_gb=tier_defaults.total_file_upload_size_gb,
        share_widgets=tier_defaults.share_widgets,
        bring_your_own_data=tier_defaults.bring_your_own_data,
        bring_your_own_copilot=tier_defaults.bring_your_own_copilot,
        admin_access=tier_defaults.admin_access,
        support=tier_defaults.support,
        excel_add_in=tier_defaults.excel_add_in,
        data_add_ons_redistribution=tier_defaults.data_add_ons_redistribution,
        data_bundle_uuid=data_bundle_uuid,
    )
    await db.execute(query)
    await db.commit()

    if not data_bundle_uuid and settings.is_onprem() and tier == "pro":
        await insert_entity_data_bundle(db, entity_uuid, ON_PREM_DATA_BUNDLE)


async def insert_entity_data_bundle(
    db: AsyncSession, entity_uuid: UUID, data_bundle: schemas.DataBundle
):
    data_bundle_uuid = await get_data_bundle_uuid(db, data_bundle.bundle_name)

    if data_bundle_uuid is None:
        query = insert(models.DataBundle).values(
            bundle_name=data_bundle.bundle_name,
            except_widgets=data_bundle.except_widgets,
            except_dashboard_templates=data_bundle.except_dashboard_templates,
            except_team_collaboration=data_bundle.except_team_collaboration,
            excel_add_in=data_bundle.excel_add_in,
            data_export=data_bundle.data_export,
            providers=data_bundle.providers,
            dashboards_at_launch=data_bundle.dashboards_at_launch,
            my_dashboards=data_bundle.my_dashboards,
            invite_your_colleagues=data_bundle.invite_your_colleagues,
            number_copilot_calls_day=data_bundle.number_copilot_calls_day,
            total_file_upload_size_gb=data_bundle.total_file_upload_size_gb,
            allow_custom_backends=data_bundle.allow_custom_backends,
        )
        result = await db.execute(query)
        data_bundle_uuid = result.inserted_primary_key[0]

    query = (
        update(models.EntityEntitlement)
        .where(models.EntityEntitlement.entity_uuid == entity_uuid)
        .values(
            number_copilot_calls_day=data_bundle.number_copilot_calls_day,
            total_file_upload_size_gb=data_bundle.total_file_upload_size_gb,
            excel_add_in=data_bundle.excel_add_in,
            data_bundle_uuid=data_bundle_uuid,
            allow_custom_backends=data_bundle.allow_custom_backends,
        )
    )
    await db.execute(query)
    await db.commit()


async def get_entity_entitlement(db: AsyncSession, entity_uuid: UUID):
    query = (
        select(
            case(
                (
                    models.EntityEntitlement.tier_id == models.PRO_TIER_ID,
                    literal("pro"),
                ),
                (
                    models.EntityEntitlement.tier_id == models.TERMINAL_TIER_ID,
                    literal("terminal"),
                ),
                else_=None,
            ).label("tier"),
            models.EntityEntitlement.number_copilot_calls_day,
            models.EntityEntitlement.total_file_upload_size_gb,
            models.EntityEntitlement.share_widgets,
            models.EntityEntitlement.bring_your_own_data,
            models.EntityEntitlement.bring_your_own_copilot,
            models.EntityEntitlement.admin_access,
            models.EntityEntitlement.support,
            models.EntityEntitlement.excel_add_in,
            models.EntityEntitlement.data_add_ons_redistribution,
            models.EntityEntitlement.data_bundle_uuid,
            models.EntityEntitlement.allow_custom_backends,
            # DataBundle fields
            models.DataBundle.bundle_name,
            models.DataBundle.except_widgets,
            models.DataBundle.except_dashboard_templates,
            models.DataBundle.except_team_collaboration,
            models.DataBundle.excel_add_in.label("data_bundle_excel_add_in"),
            models.DataBundle.data_export,
            models.DataBundle.providers,
            models.DataBundle.dashboards_at_launch,
            models.DataBundle.my_dashboards,
            models.DataBundle.invite_your_colleagues,
            models.DataBundle.number_copilot_calls_day.label(
                "data_bundle_number_copilot_calls_day"
            ),
            models.DataBundle.total_file_upload_size_gb.label(
                "data_bundle_total_file_upload_size_gb"
            ),
        )
        .select_from(models.EntityEntitlement)
        .join(
            models.DataBundle,
            models.EntityEntitlement.data_bundle_uuid == models.DataBundle.uuid,
            isouter=True,
        )
        .where(models.EntityEntitlement.entity_uuid == entity_uuid)
        .limit(1)
    )

    entitlement = (await db.execute(query)).first()

    if not entitlement:
        return entitlement

    entitlement_dict = entitlement._asdict()
    data_bundle_uuid = entitlement_dict.pop("data_bundle_uuid", None)
    data_bundle_dict = {
        k: entitlement_dict.pop(k)
        for k in [
            "bundle_name",
            "except_widgets",
            "except_dashboard_templates",
            "except_team_collaboration",
            "data_bundle_excel_add_in",
            "data_export",
            "providers",
            "dashboards_at_launch",
            "my_dashboards",
            "invite_your_colleagues",
            "data_bundle_number_copilot_calls_day",
            "data_bundle_total_file_upload_size_gb",
        ]
        if k in entitlement_dict
    }
    data_bundle_dict["excel_add_in"] = data_bundle_dict.pop(
        "data_bundle_excel_add_in", None
    )
    data_bundle_dict["number_copilot_calls_day"] = data_bundle_dict.pop(
        "data_bundle_number_copilot_calls_day", None
    )
    data_bundle_dict["total_file_upload_size_gb"] = data_bundle_dict.pop(
        "data_bundle_total_file_upload_size_gb", None
    )

    entitlement_get = schemas.EntitlementGet(**entitlement_dict)

    if data_bundle_uuid and data_bundle_dict:
        entitlement_get.bundle_name = data_bundle_dict["bundle_name"]
        entitlement_get.data_bundle_info = schemas.DataBundle(**data_bundle_dict)

    return entitlement_get


async def has_entity_entitlement(db: AsyncSession, entity_uuid: UUID):
    query = (
        select(models.EntityEntitlement.uuid)
        .where(models.EntityEntitlement.entity_uuid == entity_uuid)
        .limit(1)
    )
    return (await db.execute(query)).scalar_one_or_none()


async def update_user_entitlement_with_entity_entitlement(
    db: AsyncSession, user_uuid: UUID
):
    entity_uuid = await get_entity_uuid(db, user_uuid)
    entity_entitlements_query = (
        select(models.EntityEntitlement)
        .where(models.EntityEntitlement.entity_uuid == entity_uuid)
        .limit(1)
    )
    entity_entitlements = (
        await db.execute(entity_entitlements_query)
    ).scalar_one_or_none()

    if not entity_entitlements:
        raise HTTPException(404, detail="Entity entitlements not found")

    has_entitlement_ = await has_entitlement(db, user_uuid)
    values = dict(
        tier_id=entity_entitlements.tier_id,
        number_copilot_calls_day=entity_entitlements.number_copilot_calls_day,
        total_file_upload_size_gb=entity_entitlements.total_file_upload_size_gb,
        share_widgets=entity_entitlements.share_widgets,
        bring_your_own_data=entity_entitlements.bring_your_own_data,
        bring_your_own_copilot=entity_entitlements.bring_your_own_copilot,
        admin_access=entity_entitlements.admin_access,
        support=entity_entitlements.support,
        excel_add_in=entity_entitlements.excel_add_in,
        data_add_ons_redistribution=entity_entitlements.data_add_ons_redistribution,
        data_bundle_uuid=entity_entitlements.data_bundle_uuid,
        allow_custom_backends=entity_entitlements.allow_custom_backends,
    )
    if has_entitlement_:
        query = (
            update(models.Entitlement)
            .where(models.Entitlement.user_uuid == user_uuid)
            .values(**values)
        )
    else:
        query = insert(models.Entitlement).values(user_uuid=user_uuid, **values)
    await db.execute(query)
    await db.commit()


async def check_usage_cache(
    db: AsyncSession, user: models.User
) -> None | models.EntitlementUsage:
    from api.worker_tasks import update_user_usage_cache  # noqa: PLC0415

    cache_key = f"usage:{user.uuid}"

    if usage := settings.redis_cache(cache_key):
        return schemas.EntitlementUsageGet.model_validate(usage)

    if (user_usage := await update_user_usage_cache(user.uuid)) is None:
        user_usage = await _create_usage(user, db)

    return settings.redis_cache(cache_key, user_usage, update=True)


async def _create_usage(
    user: models.User, db: AsyncSession
) -> schemas.EntitlementUsageGet:
    limits = await get_entitlement(db, user.uuid)

    if not limits:
        raise HTTPException(status_code=404, detail="Entitlement not found")

    select_query = select(func.sum(models.StoredFile.size)).where(
        models.StoredFile.creater_uuid == user.uuid
    )
    total_file_bytes = (await db.execute(select_query)).scalar_one_or_none()

    total_file_upload_size_gb_count = (
        (total_file_bytes / (1024**3)) if total_file_bytes else 0
    )

    usage = models.EntitlementUsage(
        user_uuid=user.uuid,
        number_copilot_calls_day_count=0,
        total_file_upload_size_gb_count=total_file_upload_size_gb_count,
    )

    db.add(usage)
    await db.commit()

    user_usage = {
        "copilot_calls_limit": limits.number_copilot_calls_day,
        "file_upload_size_limit": limits.total_file_upload_size_gb,
        "number_copilot_calls_day_count": 0,
        "total_file_upload_size_gb_count": total_file_upload_size_gb_count or 0,
    }

    return schemas.EntitlementUsageGet.model_validate(user_usage)


async def handle_tier_change(
    db: AsyncSession,
    user_uuid: UUID,
    tier: TierType,
):
    """Change the user entitlements and move the user to the corresponding entity."""
    permissions_uuid_query = select(models.User.permissions_uuid).where(
        models.User.uuid == user_uuid
    )
    permissions_uuid = (await db.execute(permissions_uuid_query)).scalar_one_or_none()
    if permissions_uuid and permissions_uuid not in {
        settings.PRO_DEVELOPER_MAPPING,
        settings.PRO_TRIAL_MAPPING,
    }:
        raise HTTPException(
            status_code=400, detail="User is assigned to a non default OpenBB entity"
        )
    permissions_uuid = (
        settings.PRO_DEVELOPER_MAPPING
        if (tier == "terminal" or settings.is_onprem())
        else settings.PRO_TRIAL_MAPPING
    )
    billing_active = await crud.total_user_count_full(db, permissions_uuid)
    # Move user to entity
    update_query = (
        update(models.User)
        .where(models.User.uuid == user_uuid)
        .values(permissions_uuid=permissions_uuid, billing_active=billing_active)
    )
    await db.execute(update_query)
    await db.commit()
    # Update user entitlement with entity entitlement
    await update_user_entitlement_with_entity_entitlement(db, user_uuid)

    # Having the user change permissions_uuid should also toggle the welcome screen
    await toggle_welcome_screen(db, user_uuid, True)


async def get_enabled_widget_bundles(
    db: AsyncSession, user: models.User
) -> schemas.EnabledBundles:
    query = (
        select(models.EnabledWidgetBundles)
        .where(models.EnabledWidgetBundles.user_uuid == user.uuid)
        .limit(1)
    )
    result = (await db.execute(query)).scalar_one_or_none()
    if not result:
        return schemas.EnabledBundles(
            enabled_bundles=[],
            disabled_widgets=[],
        )
    return schemas.EnabledBundles(
        enabled_bundles=result.enabled_bundles,
        disabled_widgets=result.disabled_widgets,
    )


async def get_widget_metadata(
    db: AsyncSession,
    user: models.User,
    widget_id: UUID | None = None,
    widget_type: str | None = None,
    name: str | None = None,
):
    query = select(
        models.WidgetMetadata.name,
        models.WidgetMetadata.description,
        models.WidgetMetadata.source,
        models.WidgetMetadata.category,
        models.WidgetMetadata.sub_category,
        models.WidgetMetadata.widget_type,
        models.WidgetMetadata.storage,
        models.WidgetMetadata.widget_config,
        models.WidgetMetadata.widget_id,
    ).where(
        models.WidgetMetadata.user_uuid == user.uuid,
    )
    if widget_id:
        query = query.where(models.WidgetMetadata.widget_id == widget_id)
    elif widget_type:
        query = query.where(models.WidgetMetadata.widget_type == widget_type)
        if name:
            query = query.where(models.WidgetMetadata.name == name)

    result = (await db.execute(query)).all()
    return [
        schemas.WidgetMetadataResponse.model_validate(item._asdict()) for item in result
    ]


async def get_developer_onboarding_info(
    db: AsyncSession, user: models.User
) -> schemas.ProInfoDeveloper | None:
    query = select(models.DeveloperOnboarding).where(
        models.DeveloperOnboarding.user_uuid == user.uuid
    )
    result = await db.execute(query)
    developer_info = result.scalar_one_or_none()

    if not developer_info:
        return None
    return schemas.ProInfoDeveloper(
        primaryUsage=developer_info.primary_usage,
        organization=developer_info.organization,
        role=developer_info.role,
        programmingExperience=developer_info.programming_experience,
        dataTypes=developer_info.data_types,
        otherDataType=developer_info.other_data_types,
        organizationName=developer_info.organization_name,
        skipOnboarding=developer_info.skip_onboarding,
    )


async def _get_user_entity_info(
    db: AsyncSession, user_uuid: UUID
) -> schemas.UserEntityInfo:
    query = (
        select(models.Entity.name, models.PermissionsEntityMap.name.label("permission"))
        .select_from(models.User)
        .where(models.User.uuid == user_uuid)
        .outerjoin(
            models.PermissionsEntityMap,
            models.PermissionsEntityMap.uuid == models.User.permissions_uuid,
        )
        .outerjoin(
            models.Entity, models.Entity.uuid == models.PermissionsEntityMap.entity_uuid
        )
    )
    result = (await db.execute(query)).first()
    return schemas.UserEntityInfo(
        entity_name=result.name, permission_name=result.permission
    )


async def _deactivate_user_platforms(db: AsyncSession, user_uuid: UUID):
    subscriptions_query = (
        select(models.Subscription)
        .options(selectinload(models.Subscription.platforms))
        .where(models.Subscription.user_uuid == user_uuid)
    )
    subscriptions = (await db.execute(subscriptions_query)).scalars().all()

    for sub in subscriptions:
        for plat in sub.platforms:
            up_query = (
                update(models.Platform)
                .where(models.Platform.uuid == plat.uuid)
                .values(active=False)
            )
            await db.execute(up_query)
            await db.commit()
            base.remove_redis(plat.name, plat.platform_id)


async def delete_user(db: AsyncSession, user_uuid: UUID) -> bool:
    """This function is used to soft delete a user."""

    # Given the user uuid, gets the email and username
    user_details_query = select(
        models.User.email,
        models.User.username,
        models.User.clean_email,
    ).where(models.User.uuid == user_uuid)
    user_details = (await db.execute(user_details_query)).first()
    if not user_details:
        raise HTTPException(status_code=404, detail="User not found")

    # Remove user from marketing provider
    try:
        from api.marketing import MarketingService  # noqa: PLC0415

        MarketingService.delete_contact(user_details.email)
    except Exception as e:
        logger.error(f"Failed to delete marketing contact {user_details.email}: {e}")
    # Deactivate user platforms
    await _deactivate_user_platforms(db, user_uuid)
    # Delete user sessions
    query = delete(models.Session).where(models.Session.user_uuid == user_uuid)
    await db.execute(query)
    # Update user
    the_rand = base.random_string(4)
    query2 = (
        update(models.User)
        .where(models.User.uuid == user_uuid)
        .values(
            deleted=True,
            email=f"deleted-{the_rand}-{user_details.email}",
            username=f"deleted-{the_rand}-{user_details.username}",
            clean_email=f"deleted-{the_rand}-{user_details.clean_email}",
            password=str(uuid4()),
            permissions_uuid=None,
        )
    )
    response = await db.execute(query2)
    await db.commit()
    return response.rowcount == 1


async def insert_or_update_custom_copilot(
    db: AsyncSession, user_uuid: UUID, custom_copilot: schemas.CustomCopilot
):
    """
    Update or insert a custom copilot for a user.
    """
    # Try to update first
    update_stmt = (
        update(models.CustomCopilot)
        .where(
            models.CustomCopilot.uuid == custom_copilot.uuid,
            models.CustomCopilot.user_uuid == user_uuid,
        )
        .values(
            headers=custom_copilot.headers,
            copilots=custom_copilot.copilots,
        )
    )
    result = await db.execute(update_stmt)

    # If no rows were updated, insert new record
    if result.rowcount == 0:
        db_copilot = models.CustomCopilot(
            uuid=custom_copilot.uuid,
            user_uuid=user_uuid,
            url=custom_copilot.url,
            headers=custom_copilot.headers,
            copilots=custom_copilot.copilots,
        )
        db.add(db_copilot)

    await db.commit()


async def get_custom_copilots(
    db: AsyncSession, user_uuid: UUID
) -> list[schemas.CustomCopilot]:
    """
    Get all custom copilots for a user.
    """
    query = select(models.CustomCopilot).where(
        models.CustomCopilot.user_uuid == user_uuid
    )
    result = await db.execute(query)
    return [
        schemas.CustomCopilot.model_validate(item) for item in result.scalars().all()
    ]


async def delete_custom_copilot(
    db: AsyncSession, user_uuid: UUID, uuid: str | None = None
):
    """
    Delete a custom copilot(s) for a user.
    If the uuid is provided, delete only that copilot, otherwise delete all custom copilots for the user.
    """
    delete_stmt = delete(models.CustomCopilot).where(
        models.CustomCopilot.user_uuid == user_uuid,
    )
    if uuid:
        delete_stmt = delete_stmt.where(models.CustomCopilot.uuid == uuid)
    await db.execute(delete_stmt)
    await db.commit()


async def toggle_welcome_screen(
    db: AsyncSession, user_uuid: UUID, welcome_screen: bool
):
    update_query = (
        update(models.User)
        .where(models.User.uuid == user_uuid)
        .values(welcome_screen=welcome_screen)
    )
    await db.execute(update_query)
    await db.commit()


async def insert_user_prompt_state(
    db: AsyncSession, user_uuid: UUID, prompts: list[schemas.Prompt]
):
    # Delete prompts that are no longer in the list
    user_prompt_uuids = await _get_user_prompt_uuids(db, user_uuid)
    for prompt_uuid in user_prompt_uuids:
        if prompt_uuid not in [prompt.id for prompt in prompts]:
            await delete_user_prompt(db, user_uuid, prompt_uuid)

    for prompt in prompts:
        prompt_uuid = prompt.id

        if prompt_uuid not in user_prompt_uuids:
            insert_query = insert(models.UserPrompts).values(
                user_uuid=user_uuid, uuid=prompt_uuid, prompt=prompt.model_dump()
            )
            await db.execute(insert_query)
        else:
            await _update_user_prompt(db, user_uuid, prompt_uuid, prompt)

    await db.commit()


async def delete_user_prompt(db: AsyncSession, user_uuid: UUID, prompt_uuid: UUID):
    delete_query = delete(models.UserPrompts).where(
        models.UserPrompts.user_uuid == user_uuid,
        models.UserPrompts.uuid == prompt_uuid,
    )
    await db.execute(delete_query)
    await db.commit()


async def _get_user_prompt_uuids(db: AsyncSession, user_uuid: UUID) -> list[UUID]:
    query = select(models.UserPrompts.uuid).where(
        models.UserPrompts.user_uuid == user_uuid
    )
    result = await db.execute(query)
    return result.scalars().all()


async def _update_user_prompt(
    db: AsyncSession, user_uuid: UUID, prompt_uuid: UUID, prompt: schemas.Prompt
):
    update_query = (
        update(models.UserPrompts)
        .where(
            models.UserPrompts.user_uuid == user_uuid,
            models.UserPrompts.uuid == prompt_uuid,
        )
        .values(prompt=prompt.model_dump())
    )

    await db.execute(update_query)
    await db.commit()


async def get_user_prompt_state(
    db: AsyncSession, user_uuid: UUID
) -> list[schemas.Prompt]:
    query = select(models.UserPrompts.prompt).where(
        models.UserPrompts.user_uuid == user_uuid
    )
    result = (await db.execute(query)).scalars().all()

    prompts = []
    for prompt in result:
        if isinstance(prompt, list):
            prompts.extend([schemas.Prompt(**p) for p in prompt])
        elif isinstance(prompt, dict):
            prompts.append(schemas.Prompt(**prompt))

    return prompts


async def delete_user_skills(
    db: AsyncSession, user_uuid: UUID, skill_uuids: list[UUID]
):
    delete_query = delete(models.UserSkills).where(
        models.UserSkills.user_uuid == user_uuid,
        models.UserSkills.uuid.in_(skill_uuids),
    )
    await db.execute(delete_query)
    await db.commit()


async def update_user_skill(
    db: AsyncSession, user_uuid: UUID, skill_uuid: UUID, skill: schemas.SkillCreate
):
    update_query = (
        update(models.UserSkills)
        .where(
            models.UserSkills.user_uuid == user_uuid,
            models.UserSkills.uuid == skill_uuid,
        )
        .values(**skill.model_dump())
    )

    await db.execute(update_query)
    await db.commit()


async def get_user_skill_state(db: AsyncSession, user_uuid: UUID):
    query = (
        select(models.UserSkills)
        .where(models.UserSkills.user_uuid == user_uuid)
        .order_by(models.UserSkills.created_date.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()


async def entity_require_authenticator(db: AsyncSession, entity_uuid: UUID) -> bool:
    if not entity_uuid:
        return False

    query = select(models.Entity.require_authenticator).where(
        models.Entity.uuid == entity_uuid
    )
    result = (await db.execute(query)).scalar_one_or_none()
    return result is not None and result


async def require_entity_users_2fa(
    db: AsyncSession, entity_uuid: UUID, require_authenticator: bool
) -> bool:
    """Set the require_authenticator flag to True for all users in the entity."""
    entity_users = await get_entity_users(db, entity_uuid)
    for user_uuid in entity_users:
        update_query = (
            update(models.User)
            .where(
                models.User.uuid == user_uuid,
                and_(
                    models.User.totp_active.is_(False),
                    models.User.totp_secret.is_(None),
                ),
            )
            .values(two_factor_auth=require_authenticator)
        )
        await db.execute(update_query)
    await db.commit()


async def _get_user_uuid_by_email(db: AsyncSession, email: str) -> UUID | None:
    """
    Get a user's UUID by their email address.

    Args:
        db (AsyncSession): The database session.
        email (str): The email address to look up.

    Returns:
        UUID | None: The user's UUID if found, None otherwise.
    """
    query = select(models.User.uuid).where(models.User.email == email)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def _get_role_entity_uuid(db: AsyncSession, role_uuid: UUID) -> UUID:
    query = select(models.Role.entity_uuid).where(models.Role.uuid == role_uuid)
    result = (await db.execute(query)).scalar_one_or_none()
    return result


async def _convert_emails_to_uuids(db: AsyncSession, users: list[str]) -> list[UUID]:
    return [await _get_user_uuid_by_email(db, email) for email in users]


async def role_exists(db: AsyncSession, role_uuid: UUID, entity_uuid: UUID) -> bool:
    query = select(models.Role.uuid).where(
        models.Role.uuid == role_uuid,
        models.Role.entity_uuid == entity_uuid,
        models.Role.deleted_at.is_(None),
    )
    result = (await db.execute(query)).scalar_one_or_none()
    return result is not None


async def add_users_to_role(db: AsyncSession, role_uuid: UUID, users: list[str]):
    # Get the entity_uuid for this role
    entity_uuid = await _get_role_entity_uuid(db, role_uuid)
    if not entity_uuid:
        raise HTTPException(404, detail="Role not found")

    # Get all users in the entity
    entity_users = await get_entity_users(db, entity_uuid)

    # Convert emails to UUIDs and filter to only those in the entity
    valid_users = await _convert_emails_to_uuids(db, users)
    valid_users = [user_uuid for user_uuid in valid_users if user_uuid in entity_users]

    # Add valid users to group
    for user_uuid in valid_users:
        user_role = models.UserRole(role_uuid=role_uuid, user_uuid=user_uuid)
        db.add(user_role)
        await db.flush()
    await db.commit()


async def remove_users_from_role(db: AsyncSession, role_uuid: UUID, users: list[str]):
    # Get UUIDs for users to remove
    user_uuids_to_remove = await _convert_emails_to_uuids(db, users)

    if user_uuids_to_remove:
        user_roles = (
            await db.scalars(
                select(models.UserRole).where(
                    and_(
                        models.UserRole.role_uuid == role_uuid,
                        models.UserRole.user_uuid.in_(user_uuids_to_remove),
                    )
                )
            )
        ).all()
        for user_role in user_roles:
            await db.delete(user_role)
        await db.commit()


async def get_role_users(db: AsyncSession, role_uuid: UUID) -> list[str]:
    query = (
        select(models.User.email)
        .join(models.UserRole, models.UserRole.user_uuid == models.User.uuid)
        .where(models.UserRole.role_uuid == role_uuid)
    )
    result = (await db.execute(query)).scalars().all()
    return result


async def update_role_users(db: AsyncSession, role_uuid: UUID, new_users: list[str]):
    """
    Update the users in a role by comparing the new list with existing users.
    Will add new users and remove users that are no longer in the list.

    Args:
        db (AsyncSession): The database session
        role_uuid (UUID): The UUID of the role to update
        new_users (list[str]): List of email addresses for the desired role members
    """
    # Get the entity_uuid for this role
    entity_uuid = await _get_role_entity_uuid(db, role_uuid)
    if not entity_uuid:
        raise HTTPException(404, detail="Role not found")

    # Get current role users
    current_users = await get_role_users(db, role_uuid)

    # Determine users to add and remove
    users_to_add = [email for email in new_users if email not in current_users]
    users_to_remove = [email for email in current_users if email not in new_users]

    # Add new users
    if users_to_add:
        await add_users_to_role(db, role_uuid, users_to_add)

    # Remove users no longer in the list
    if users_to_remove:
        await remove_users_from_role(db, role_uuid, users_to_remove)


async def insert_or_update_backend_permissions(
    db: AsyncSession,
    role_uuid: UUID,
    backend_uuid: UUID,
    permissions: schemas.RolePermissions,
):
    query = select(models.RoleBackend).where(
        models.RoleBackend.role_uuid == role_uuid,
        models.RoleBackend.backend_uuid == backend_uuid,
    )
    result = (await db.execute(query)).scalar_one_or_none()

    permissions_dict: dict[str, list[dict]] = permissions.model_dump(
        exclude=["type", "category", "uuid"], exclude_none=True, exclude_unset=True
    )

    if not result:
        result = models.RoleBackend(
            role_uuid=role_uuid, backend_uuid=backend_uuid, **permissions_dict
        )
        db.add(result)

        return await db.commit()

    for key, value in permissions_dict.items():
        has_changes = False
        if key == "widgets" and value:
            has_changes |= len(result.widgets or []) != len(value)

            new_access = {
                w.get("widgetId"): w.get("access")
                for w in value
                if w.get("widgetId") and w.get("access")
            }
            # Check if the widgets list has changed
            for widget in result.widgets or []:
                if has_changes:
                    break
                widget_id = widget.get("widgetId")
                has_changes |= bool(widget.get("access") != new_access.get(widget_id))

        if key == "templates" and value:
            has_changes |= len(result.templates or []) != len(value)

            new_access: dict[str, str] = {}
            new_prompts: dict = {}

            for t in value:
                if has_changes:
                    break
                template_id = t.get("templateId")
                if not (template_id and t.get("access")):
                    continue
                new_prompts[template_id] = {
                    p.get("promptId"): p.get("access")
                    for p in t.get("prompts", [])
                    if p.get("promptId") and p.get("access")
                }
                new_access[template_id] = t.get("access")

            # Check if the templates list has changed
            for template in result.templates or []:
                if has_changes:
                    break
                template_id = template.get("templateId")
                prompts: list[dict] = template.get("prompts", [])
                new_prompts_access: dict = new_prompts.get(template_id, {})

                # Check if the prompts list has changed
                prompts_change = [
                    p.get("promptId")
                    for p in prompts
                    if p.get("access") != new_prompts_access.get(p.get("promptId"))
                ]
                template_change = template.get("access") != new_access.get(template_id)
                has_changes |= bool(prompts_change or template_change)

            if not has_changes:
                continue

        setattr(result, key, value)

    await db.flush()
    await db.commit()


async def insert_or_update_file_permissions(
    db: AsyncSession, role_uuid: UUID, file_uuid: UUID, access: bool
):
    query = select(models.RoleFile).where(
        models.RoleFile.role_uuid == role_uuid, models.RoleFile.file_uuid == file_uuid
    )
    result = (await db.execute(query)).scalar_one_or_none()

    if result:
        result.access = access
    else:
        result = models.RoleFile(
            role_uuid=role_uuid, file_uuid=file_uuid, access=access
        )
        db.add(result)

    await db.commit()


async def insert_or_update_prompt_permissions(
    db: AsyncSession, role_uuid: UUID, prompt_uuid: UUID, access: bool
):
    query = select(models.RolePrompt).where(
        models.RolePrompt.role_uuid == role_uuid,
        models.RolePrompt.prompt_uuid == prompt_uuid,
    )
    result = (await db.execute(query)).scalar_one_or_none()

    if result:
        result.access = access
    else:
        result = models.RolePrompt(
            role_uuid=role_uuid, prompt_uuid=prompt_uuid, access=access
        )
        db.add(result)

    await db.commit()


async def insert_or_update_prompt_template_permissions(
    db: AsyncSession, role_uuid: UUID, permissions: schemas.RolePermissions
):
    query = select(models.RoleBackend).where(
        models.RoleBackend.role_uuid == role_uuid,
        models.RoleBackend.backend_uuid == permissions.uuid,
    )
    result = (await db.execute(query)).scalar_one_or_none()
    if not result:
        raise HTTPException(404, detail="Prompt not found")

    permissions_templates_json = [
        perm_tpl.model_dump() for perm_tpl in permissions.templates
    ]
    template_id = permissions.templates[0].templateId

    # Check if template exists
    template_exists = any(
        t["templateId"] == template_id for t in result.templates or []
    )

    if template_exists:
        # Update existing template
        templates = result.templates or []
        for i, template in enumerate(templates):
            if template["templateId"] == template_id:
                templates[i] = permissions_templates_json[0]
        result.templates = templates
    else:
        # Add new template
        templates = result.templates or []
        templates.extend(permissions_templates_json)
        result.templates = templates

    flag_modified(result, "templates")
    await db.commit()


async def _get_user_roles(db: AsyncSession, user_uuid: UUID) -> list[UUID]:
    query = (
        select(models.UserRole.role_uuid)
        .join(models.Role, models.Role.uuid == models.UserRole.role_uuid)
        .where(models.UserRole.user_uuid == user_uuid, models.Role.deleted_at.is_(None))
    )
    result = (await db.execute(query)).scalars().all()
    return result


async def _get_role_backend_permissions(
    db: AsyncSession, role_uuid: UUID
) -> list[schemas.BackendPermissionsModel]:
    query = (
        select(
            models.RoleBackend.backend_uuid,
            models.ApiSource.name,
            models.ApiSource.created_date,
            models.ApiSource.updated_date,
            models.RoleBackend.access,
            models.RoleBackend.widgets,
            models.RoleBackend.templates,
            case(
                (models.RoleBackend.access == literal("access"), models.ApiSource.url),
                else_=None,
            ).label("url"),
            case(
                (
                    models.RoleBackend.access == literal("access"),
                    models.ApiSource.endpointHeaders,
                ),
                else_=None,
            ).label(quoted_name("endpointHeaders", False)),
            case(
                (
                    and_(
                        models.User.first_name.is_not(None),
                        models.User.last_name.is_not(None),
                    ),
                    func.concat(models.User.first_name, " ", models.User.last_name),
                ),
                else_=models.User.email,
            ).label("created_by"),
        )
        .select_from(models.RoleBackend)
        .join(
            models.ApiSource, models.ApiSource.uuid == models.RoleBackend.backend_uuid
        )
        .join(models.User, models.User.uuid == models.ApiSource.user_uuid)
        .where(
            models.RoleBackend.role_uuid == role_uuid,
            models.RoleBackend.access != "no-access",
        )
    )
    result = await db.execute(query)
    return [
        {
            "uuid": str(row.backend_uuid),
            "name": row.name,
            "access": row.access,
            "widgets": [w for w in (row.widgets or []) if w["access"] != "no-access"],
            "templates": [
                {
                    **t,
                    "prompts": [
                        p
                        for p in t.get("prompts", [])
                        if p.get("access") != "no-access"
                    ],
                }
                for t in (row.templates or [])
                if t["access"] != "no-access"
            ],
            "url": row.url,
            "endpointHeaders": row.endpointHeaders,
            "created_date": row.created_date,
            "updated_date": row.updated_date,
            "created_by": row.created_by,
        }
        for row in result.all()
    ]


async def _get_role_file_permissions(
    db: AsyncSession, role_uuid: UUID
) -> list[schemas.FilePermissionsModel]:
    query = (
        select(
            models.RoleFile.file_uuid,
            models.FileWidget.name,
            models.FileWidget.description,
            models.RoleFile.access,
            case(
                (models.RoleFile.access == "access", models.FileWidget.url), else_=None
            ).label("url"),
        )
        .select_from(models.RoleFile)
        .join(models.FileWidget, models.FileWidget.uuid == models.RoleFile.file_uuid)
        .where(
            models.RoleFile.role_uuid == role_uuid,
            models.RoleFile.access != "no-access",
        )
    )
    result = await db.execute(query)
    return [
        {
            "uuid": str(row.file_uuid),
            "access": row.access,
            "name": row.name,
            "description": row.description,
            "url": row.url,
        }
        for row in result.all()
    ]


async def _get_role_prompt_permissions(
    db: AsyncSession, role_uuid: UUID
) -> list[schemas.PromptPermissionsModel]:
    query = (
        select(
            models.RolePrompt.prompt_uuid,
            models.UserPrompts.prompt,
            models.RolePrompt.access,
        )
        .select_from(models.RolePrompt)
        .join(
            models.UserPrompts, models.RolePrompt.prompt_uuid == models.UserPrompts.uuid
        )
        .where(
            models.RolePrompt.role_uuid == role_uuid,
            models.RolePrompt.access != "no-access",
        )
    )
    result = await db.execute(query)
    return [
        {
            "uuid": str(row.prompt_uuid),
            "access": row.access,
            "prompt": row.prompt,
        }
        for row in result.all()
    ]


async def get_user_role_permissions(
    db: AsyncSession, user_uuid: UUID
) -> schemas.UserRolesPermissions:
    """
    Get the permissions for a user's roles.
    """
    permissions = {}

    # Get all roles for the user
    roles = await _get_user_roles(db, user_uuid)

    for role_uuid in roles:
        # Initialize the dictionary structure for this role
        permissions[str(role_uuid)] = {"backends": [], "files": [], "prompts": []}

        # Get and assign permissions
        backend_permissions = await _get_role_backend_permissions(db, role_uuid)
        file_permissions = await _get_role_file_permissions(db, role_uuid)
        prompt_permissions = await _get_role_prompt_permissions(db, role_uuid)

        permissions[str(role_uuid)]["backends"] = backend_permissions
        permissions[str(role_uuid)]["files"] = file_permissions
        permissions[str(role_uuid)]["prompts"] = prompt_permissions

    return schemas.UserRolesPermissions(permissions=permissions)


def flatten_permissions(
    permissions_dict: schemas.UserRolesPermissions,
) -> schemas.UserRolesPermissionsFlattened:
    def _get_most_permissive_access(access1, access2):
        return "access" if "access" in {access1, access2} else "no-access"

    def _merge_items(items1, items2, id_key):
        items_map = {item[id_key]: item for item in (items1 or [])}
        for item in items2 or []:
            if item[id_key] in items_map:
                items_map[item[id_key]]["access"] = _get_most_permissive_access(
                    items_map[item[id_key]]["access"], item["access"]
                )
            else:
                items_map[item[id_key]] = item
        return list(items_map.values())

    def _handle_resource_type(resources, resource_type, id_key, merge_fn=None):
        flattened_resources = {}
        for _, role_permissions in resources.get("permissions", {}).items():
            for resource in role_permissions.get(resource_type) or []:
                resource_id = resource[id_key]
                if resource_id not in flattened_resources:
                    flattened_resources[resource_id] = resource
                else:
                    existing = flattened_resources[resource_id]
                    existing["access"] = _get_most_permissive_access(
                        existing["access"], resource["access"]
                    )

                    # Handle special merging for backends
                    if merge_fn:
                        merge_fn(existing, resource)

                    # Handle URL nullification
                    if existing["access"] == "no-access" and "url" in existing:
                        existing["url"] = None
                        if "endpointHeaders" in existing:
                            existing["endpointHeaders"] = None

        return list(flattened_resources.values())

    def _merge_backend_specifics(existing, new):
        existing["widgets"] = _merge_items(
            existing["widgets"], new["widgets"], "widgetId"
        )
        existing["templates"] = _merge_items(
            existing["templates"], new["templates"], "templateId"
        )

    return schemas.UserRolesPermissionsFlattened(
        backends=_handle_resource_type(
            permissions_dict, "backends", "uuid", _merge_backend_specifics
        ),
        files=_handle_resource_type(permissions_dict, "files", "uuid"),
        prompts=_handle_resource_type(permissions_dict, "prompts", "uuid"),
    )


def create_details_message(action: str, resource_type: str, details: dict) -> str:
    """Create a human readable message from audit log details"""

    # Handle updates with old/new values
    if action == "update":
        changed_fields = []
        for field, value in details.items():
            if isinstance(value, dict) and "old" in value and "new" in value:
                changed_fields.append(field)
        if changed_fields:
            return f"Changed {', '.join(changed_fields)}."

    # Handle role creation ,deletion and restoration
    if action in {"create", "delete", "restore"} and resource_type == "role":
        message_map = {
            "create": f"Created role '{details.get('name', '')}'.",
            "delete": "Role was deleted.",
            "restore": "Role was restored.",
        }
        return message_map[action]

    # Handle permission assignments
    if action == "assign" and resource_type in {"backend", "file", "prompt"}:
        prefix_map = {
            "backend": "Assigned backend",
            "file": "Assigned file",
            "prompt": "Assigned prompt",
        }
        suffix = f"permissions with {details.get('access', {}).get('new', 'unknown')}."

        return f"{prefix_map[resource_type]} {suffix}"

    # Handle user role assignments
    if action in {"add", "remove"} and resource_type == "user":
        message_map = {
            "add": "Added user to role.",
            "remove": "Removed user from role.",
        }
        return message_map[action]

    return "Action performed."  # Default message


async def _process_backend_widgets(backend_entry, role_uuid, backend):
    """Process widgets for a backend entry."""
    for widget in backend.get("widgets", []):
        widget_entry = {
            "widgetId": widget.get("widgetId"),
            "access": [{role_uuid: widget.get("access")}],
        }
        backend_entry["widgets"].append(widget_entry)


async def _update_backend_widgets(dc, role_uuid, backend):
    """Update widgets for an existing backend."""
    existing_widget_ids = {w.get("widgetId") for w in dc["widgets"]}
    for widget in backend.get("widgets", []):
        widget_id = widget.get("widgetId")
        if widget_id in existing_widget_ids:
            for w in dc["widgets"]:
                if w.get("widgetId") == widget_id:
                    w["access"].append({role_uuid: widget.get("access")})
        else:
            dc["widgets"].append(
                {"widgetId": widget_id, "access": [{role_uuid: widget.get("access")}]}
            )


async def _add_or_update_template_prompt(
    role_uuid: UUID,
    prompt,
    template_id: str,
    prompts_list: list,
    processed_prompts: set,
):
    """Add or update a template prompt."""
    prompt_uuid = prompt.get("promptId")
    if prompt_uuid not in processed_prompts:
        prompts_list.append(
            {
                "uuid": prompt_uuid,
                "prompt": prompt.get("prompt"),
                "access": [{role_uuid: prompt.get("access")}],
                "templateId": template_id,
            }
        )
        processed_prompts.add(prompt_uuid)
    else:
        for p in prompts_list:
            if p.get("uuid") == prompt_uuid:
                p["access"].append({role_uuid: prompt.get("access")})


async def process_templates(  # noqa: PLR0913, PLR0917
    role_uuid: UUID,
    backend,
    processed_templates: set,
    templates: list,
    prompts_list: list,
    processed_prompts: set,
):
    """Process templates for a backend."""
    for template in backend.get("templates", []):
        template_id = template.get("templateId")
        if template_id not in processed_templates:
            templates.append(
                {
                    "templateId": template_id,
                    "access": [{role_uuid: template.get("access")}],
                    "prompts": [],
                }
            )
            processed_templates.add(template_id)

            for prompt in template.get("prompts", []):
                await _add_or_update_template_prompt(
                    role_uuid, prompt, template_id, prompts_list, processed_prompts
                )
        else:
            for t in templates:
                if t.get("templateId") == template_id:
                    t["access"].append({role_uuid: template.get("access")})
                    for prompt in template.get("prompts", []):
                        await _add_or_update_template_prompt(
                            role_uuid,
                            prompt,
                            template_id,
                            prompts_list,
                            processed_prompts,
                        )


async def process_backend(
    role_uuid: UUID, backend, data_connectors: list, processed_backends: set
):
    """Process a single backend."""
    backend_uuid = backend.get("uuid")
    if backend_uuid not in processed_backends:
        backend_entry = {
            "uuid": backend_uuid,
            "type": "backend",
            "name": backend.get("name"),
            "access": [{role_uuid: backend.get("access")}],
            "widgets": [],
        }
        await _process_backend_widgets(backend_entry, role_uuid, backend)
        data_connectors.append(backend_entry)
        processed_backends.add(backend_uuid)
    else:
        for dc in data_connectors:
            if dc.get("uuid") == backend_uuid:
                dc["access"].append({role_uuid: backend.get("access")})
                await _update_backend_widgets(dc, role_uuid, backend)


async def process_file(
    role_uuid: UUID, file, data_connectors: list, processed_files: set
):
    """Process a single file."""
    file_uuid = file.get("uuid")
    if file_uuid not in processed_files:
        data_connectors.append(
            {
                "uuid": file_uuid,
                "type": "file",
                "name": file.get("name"),
                "description": file.get("description"),
                "access": [{role_uuid: file.get("access")}],
            }
        )
        processed_files.add(file_uuid)
    else:
        for dc in data_connectors:
            if dc.get("uuid") == file_uuid:
                dc["access"].append({role_uuid: file.get("access")})


async def process_prompts(
    role_uuid: UUID, prompts_data: list, processed_prompts: set, prompts_list: list
):
    """Process standalone prompts."""
    for prompt in prompts_data:
        prompt_uuid = prompt.get("uuid")
        if prompt_uuid not in processed_prompts:
            prompts_list.append(
                {
                    "uuid": prompt_uuid,
                    "prompt": prompt.get("prompt"),
                    "access": [{role_uuid: prompt.get("access")}],
                }
            )
            processed_prompts.add(prompt_uuid)
        else:
            for p in prompts_list:
                if p.get("uuid") == prompt_uuid:
                    p["access"].append({role_uuid: prompt.get("access")})


async def get_role_name(db: AsyncSession, role_uuid: UUID) -> str:
    """Get the name of a role."""
    query = select(models.Role.name).where(models.Role.uuid == role_uuid)
    result = (await db.execute(query)).scalar_one_or_none()
    return result


async def compute_final_permission(permissions_dict):
    """
    Compute the final permission based on all role permissions.
    If any role has 'access', the final permission is 'access'.
    Otherwise, the final permission is 'no-access'.

    Args:
        permissions_dict (dict): Dictionary of {role_name: access_value}

    Returns:
        str: 'access' or 'no-access'
    """
    if not permissions_dict:
        return "no-access"

    for access in permissions_dict.values():
        if access == "access":
            return "access"

    return "no-access"


async def add_final_permissions_to_resources(  # noqa: PLR0912
    data_connectors, templates, prompts
):
    """
    Add final_permission field to each resource based on role permissions.

    Args:
        data_connectors (list): List of data connector resources
        templates (list): List of template resources
        prompts (list): List of prompt resources
    """
    # Process data connectors
    for connector in data_connectors:
        role_permissions = {}
        for access_entry in connector.get("access", []):
            for role, access in access_entry.items():
                role_permissions[role] = access
        connector["final_permission"] = await compute_final_permission(role_permissions)

        # Process widgets for backends
        if connector.get("type") == "backend" and "widgets" in connector:
            for widget in connector.get("widgets", []):
                widget_role_permissions = {}
                for access_entry in widget.get("access", []):
                    for role, access in access_entry.items():
                        widget_role_permissions[role] = access
                widget["final_permission"] = await compute_final_permission(
                    widget_role_permissions
                )

    # Process templates
    for template in templates:
        role_permissions = {}
        for access_entry in template.get("access", []):
            for role, access in access_entry.items():
                role_permissions[role] = access
        template["final_permission"] = await compute_final_permission(role_permissions)

    # Process prompts
    for prompt in prompts:
        role_permissions = {}
        for access_entry in prompt.get("access", []):
            for role, access in access_entry.items():
                role_permissions[role] = access
        prompt["final_permission"] = await compute_final_permission(role_permissions)


async def get_shared_file_uuids(
    db: AsyncSession, user: models.User | None
) -> list[UUID]:
    if not user:
        return []

    select_query = select(models.StoredFileShare.stored_file_uuids).where(
        models.StoredFileShare.shared_user_uuid == user.uuid,
        models.StoredFileShare.creater_uuid != user.uuid,
    )

    results = (await db.execute(select_query)).scalars().all()

    shared_uuids = [uuid for item in results for uuid in item] if results else []

    if user.permissions_uuid != settings.PRO_DEVELOPER_MAPPING or settings.is_onprem():
        permissions = await get_user_role_permissions(db, user.uuid)
        role_permissions = flatten_permissions(permissions.model_dump())
        if role_permissions.files:
            shared_uuids.extend(
                [
                    file.stored_file_uuid
                    for file in role_permissions.files
                    if file.stored_file_uuid and file.access != "no-access"
                ]
            )

    return list(set(shared_uuids))


async def get_dashboard_shared_file_uuids(
    db: AsyncSession, user: models.User, dashboard_uuid: UUID | None = None
) -> list[UUID]:
    if dashboard_uuid is None:
        return []

    dashboard_file_uuids = await crud.get_dashboard_storedfile_uuids(
        db, dashboard_uuid, user.uuid
    )

    if not dashboard_file_uuids:
        return await crud.get_shared_dashboard_file_uuids(db, user, dashboard_uuid)

    shared_file_uuids = await get_shared_file_uuids(db, user)

    return list(
        set([uuid for uuid in dashboard_file_uuids if uuid in shared_file_uuids])
    )
