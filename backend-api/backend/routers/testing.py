from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api import crud, schemas
from api.auth_helpers import check_pro
from api.database import aget_write_db
from api.models import User
from api.models.entity_models import PermissionsEntityMap
from api.models.user_models import UserProInvite
from routers.pro.helpers import update_user_entitlement_with_entity_entitlement
from routers.pro.index import process_create_user
from utilities.config import settings

router = APIRouter(prefix="/testing", tags=["testing"])


async def get_permissions_uuid(
    db: AsyncSession, tier: Literal["paid", "free"], as_admin: bool = False
) -> str:
    "Helper to get the permissions uuid for a given tier"
    permissions_uuid = (
        settings.PRO_TRIAL_MAPPING if tier == "paid" else settings.PRO_DEVELOPER_MAPPING
    )

    if as_admin:
        user_entity_uuid = await crud.get_user_entity_uuid(db, permissions_uuid)
        admin_query = select(PermissionsEntityMap.uuid).where(
            PermissionsEntityMap.entity_uuid == user_entity_uuid,
            PermissionsEntityMap.name == "Admin",
        )
        result = await db.execute(admin_query)
        permissions_uuid = result.scalars().first()

    if not permissions_uuid:
        raise HTTPException(status_code=500, detail="Permissions mapping not found")
    return permissions_uuid


@router.delete("/user/{email}/{tier}", response_model=schemas.SuccessReturn)
async def delete_user(
    email: str,
    tier: Literal["paid", "free"],
    as_admin: bool = False,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(check_pro),
):
    "This should remove all traces of a user from the database"
    permissions_uuid = await get_permissions_uuid(db, tier, as_admin)

    query = (
        select(User.uuid, User.email)
        .where(User.email == email, User.permissions_uuid == permissions_uuid)
        .limit(1)
    )
    result = await db.execute(query)
    user = result.mappings().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    logger.info(f"Deleting user {user.email} with uuid {user.uuid}")

    try:
        from api.marketing import MarketingService  # noqa: PLC0415

        MarketingService.delete_contact(user.email)
    except Exception as e:
        logger.error(f"Failed to delete marketing contact {user.email}: {e}")

    await crud.full_delete_user(db, user.uuid)
    return {"success": True}


@router.post("/user/{email}/{tier}", response_model=schemas.SuccessReturn)
async def complete_user(
    email: str,
    tier: Literal["paid", "free"],
    password: str,
    as_admin: bool = False,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(check_pro),
):
    "This should mark a user as having completed signup"
    invite_query = (
        select(UserProInvite.uuid)
        .where(UserProInvite.email == email, UserProInvite.used.is_(False))
        .limit(1)
    )
    invite_uuid = (await db.execute(invite_query)).scalars().first()

    if invite_uuid and not (
        await process_create_user(invite_uuid, email, db, from_oauth=True)
    ):
        raise HTTPException(status_code=500, detail="Failed to create user from invite")

    permissions_uuid = await get_permissions_uuid(db, tier, as_admin)

    query = (
        update(User)
        .where(User.email == email)
        .values(
            confirmed=True,
            billing_active=True,
            permissions_uuid=permissions_uuid,
            password=password,
            temporary_password=False,
        )
    )

    result = await db.execute(query)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="User not found")

    user_uuid_query = select(User.uuid).where(User.email == email).limit(1)
    user_uuid = (await db.execute(user_uuid_query)).scalars().first()

    # Update user entitlement with entity entitlement
    await update_user_entitlement_with_entity_entitlement(db, user_uuid)
    return {"success": True}
