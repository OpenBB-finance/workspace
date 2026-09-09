import json
import tomllib
from collections.abc import Callable, Coroutine
from contextlib import suppress
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from loguru import logger
from pydantic import BaseModel, SecretStr, field_validator
from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api import base, schemas
from api.base import clean_email
from api.helpers import init_trial_mappings
from api.models import Entity, EntityType, PermissionsEntityMap, User
from routers.entity import add_entity, aget_write_db
from routers.pro.helpers import insert_entity_data_bundle
from routers.pro.index import process_create_user, register_pro_user

type MaybCoro[T] = Coroutine[Any, Any, T] | T


CONFIG_PATH = Path(__file__).parent / "cfgs"

BACKEND_DIR = Path(__file__).parent.parent
USER_CREATE_JSON_PATH = BACKEND_DIR / "user_create.json"
USER_CREATE_JSON_PATH.touch(exist_ok=True)


class UserConfig(BaseModel):
    email: str
    first_name: str
    last_name: str


class AdminUser(UserConfig):
    password: SecretStr
    uuid: UUID | None = None


class EntityConfig(BaseModel):
    name: str
    seats: int
    aum: int
    company_type: str
    organization_size: str
    country: str


class Config(BaseModel):
    entity: EntityConfig
    admins: list[AdminUser] | None = []
    users: list[UserConfig] | None = []

    @field_validator("users", "admins", mode="before", check_fields=False)
    @classmethod
    def check_users(cls, v):
        return [user for user in v if user.get("email")]


async def call_func[**P, T](
    func: Callable[P, MaybCoro[T]], *args: P.args, **kwargs: P.kwargs
) -> T:
    """Unwraps a function to ignore decorators."""

    while hasattr(func, "__wrapped__"):
        func = func.__wrapped__

    return await func(*args, **kwargs)


DEFAULT_DATA_BUNDLE = schemas.DataBundle(
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

DummyAdmin = AdminUser(
    email="no_admin@entity.com",
    first_name="No",
    last_name="Admin",
    password=SecretStr("INVALID_PASSWORD"),
    uuid=UUID("11111111-1111-1111-1111-111111111111"),
)


class SetupConfig:
    db: AsyncSession
    config: Config
    admin_user: type[User] | None
    code: str

    def __init__(self, config: Config, db: AsyncSession):
        self.db = db
        self.config = config
        self.admin_user: type[User] | None = None
        self.code = config.entity.name[:3].upper()

    async def add_entity(self, entity: schemas.EntityPost):
        return await call_func(add_entity, None, entity, self.db)

    async def create_user(self, the_uuid: UUID, email: str) -> User:
        return await process_create_user(the_uuid, email, self.db)

    async def init_admins(self, permissions_uuid: UUID) -> User:
        admin_users: list[User] = []
        for admin in self.config.admins:
            admin_users.append(await self.create_admin(admin, permissions_uuid))

        self.admin_user = admin_users[0] if admin_users else DummyAdmin

    async def create_admin(self, admin_user: AdminUser, permissions_uuid: UUID) -> User:
        logger.info(f"Checking for admin: {admin_user.email}")
        query = select(User).where(User.email == admin_user.email)
        result = await self.db.execute(query)

        if (user := result.scalars().first()) is None:
            logger.info(f"Creating admin: {admin_user.email} with is_superuser=1")
            query = insert(User).values(
                email=admin_user.email,
                first_name=admin_user.first_name,
                last_name=admin_user.last_name,
                confirmed=1,
                clean_email=clean_email(admin_user.email),
                permissions_uuid=permissions_uuid,
                is_superuser=1,
                password=admin_user.password.get_secret_value(),
                billing_active=1,
            )
            result = await self.db.execute(query)
            await self.db.commit()

            return await self.create_admin(admin_user, permissions_uuid)

        password_ok = False
        if user.password:
            with suppress(Exception):
                password_ok = base.verify_password(
                    admin_user.password.get_secret_value(), user.password
                )
        if not user.is_superuser or not password_ok:
            logger.info(
                f"Updating admin: {admin_user.email} (is_superuser={user.is_superuser})"
            )
            stmt = (
                update(User)
                .where(User.uuid == user.uuid)
                .values(
                    is_superuser=1,
                    confirmed=1,
                    password=admin_user.password.get_secret_value(),
                )
            )
            await self.db.execute(stmt)
            await self.db.commit()
            await self.db.refresh(user)
            return await self.create_admin(admin_user, permissions_uuid)

        logger.info(
            f"Admin already exists: {admin_user.email}, is_superuser={user.is_superuser}"
        )
        return user

    async def create_entity(self):
        query = select(EntityType.uuid).where(EntityType.code == self.code)
        result = await self.db.execute(query)

        main_admin = self.config.admins[0] if self.config.admins else DummyAdmin

        if (entity_type_uuid := result.scalars().first()) is None:
            query = insert(EntityType).values(
                entity_type="On-Premise",
                code=self.code,
                active=True,
                permission_hierarchy=2,
            )

            result = await self.db.execute(query)
            await self.db.commit()
            entity_type_uuid = result.inserted_primary_key[0]

        return await self.add_entity(
            schemas.EntityPost(
                email=main_admin.email,
                admin_email=main_admin.email,
                entity_code=str(entity_type_uuid),
                expiration_date=datetime.now() + timedelta(days=365 * 50),
                **self.config.entity.model_dump(),
            ),
        )

    async def run(self):
        query = select(Entity.uuid).where(Entity.name == self.config.entity.name)
        result = await self.db.execute(query)

        if (entity_uuid := result.scalars().first()) is None:
            entity_data = await self.create_entity()
            entity_uuid = entity_data["entity_uuid"]
            await insert_entity_data_bundle(self.db, entity_uuid, DEFAULT_DATA_BUNDLE)

        query = select(PermissionsEntityMap).where(
            PermissionsEntityMap.entity_uuid == entity_uuid
        )
        result = await self.db.execute(query)

        permissions_map: dict[str, UUID] = {}

        for permission in result.scalars().all():
            permissions_map[permission.name] = permission.uuid

        await self.init_admins(permissions_map["Admin"])

        user_create = {
            "on_prem_admin_uuid": permissions_map["Admin"],
            "permissions_uuid": permissions_map["User"],
            "inviting_uuid": self.admin_user.uuid,
            "inviting_email": self.admin_user.email,
        }
        with USER_CREATE_JSON_PATH.open("w", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(jsonable_encoder(user_create), indent=4))

        for user in self.config.users:
            user_create = schemas.UserCreateProAdmin(
                email=user.email,
                permissions_uuid=permissions_map["User"],
                first_name=user.first_name,
                last_name=user.last_name,
            )
            extra_info = schemas.RegisterProUser(
                inviting_uuid=self.admin_user.uuid,
                inviting_email=self.admin_user.email,
            )

            with suppress(Exception):
                invite_uuid = await register_pro_user(
                    self.db, user_create, extra_info, from_oauth=True
                )
                if not invite_uuid or not await self.create_user(
                    invite_uuid, user.email
                ):
                    continue

        await self.db.commit()


async def setup_configs():
    configs = []
    for file in CONFIG_PATH.glob("*.toml"):
        with file.open("rb") as f:
            configs.append(Config(**tomllib.load(f)))

    with suppress(Exception):
        await init_trial_mappings()

    async for db in aget_write_db():
        for config in configs:
            await SetupConfig(config, db).run()


if __name__ == "__main__":
    import asyncio

    asyncio.run(setup_configs())
