"""Entity routes"""

from copy import deepcopy
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi_pagination import Page
from fastapi_pagination.customization import CustomizedPage, UseParamsFields
from fastapi_pagination.ext.sqlalchemy import paginate
from loguru import logger
from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api import auth_helpers, base, crud, models, schemas
from api.database import aget_read_db, aget_write_db
from api.email import EmailService
from api.models import (
    DashboardShare,
    Entity,
    EntityType,
    PermissionsEntityMap,
    PermissionsInvite,
    User,
)
from api.rate_limit import LIMIT_DEFAULT, exempt_user_agent, limiter
from routers import pro_helpers, routers_helpers
from utilities.config import settings

router = APIRouter(prefix="/entity", tags=["entity"])

CustomPage = CustomizedPage[Page, UseParamsFields(size=Query(100, ge=1, le=1000))]


@router.post("/entity-type", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def add_entity_type(
    request: Request,
    entity_type: schemas.EntityTypeCreate,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    try:
        query = insert(EntityType).values(
            entity_type=entity_type.entity_type,
            code=entity_type.code,
            active=entity_type.active,
            permission_hierarchy=entity_type.permission_hierarchy,
        )
        await db.execute(query)
        await db.commit()
        return {"success": True}
    except IntegrityError as exc:
        raise HTTPException(409, detail="Entity type already exists") from exc
    except DataError as exc:
        raise HTTPException(400, detail="Bad data submitted") from exc


@router.put("/entity-type/{type_uuid}", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def put_entity_type(
    type_uuid: UUID,
    request: Request,
    entity_type: schemas.EntityTypeCreate,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    try:
        query = (
            update(EntityType)
            .where(EntityType.uuid == type_uuid)
            .values(**entity_type.model_dump())
        )
        response = await db.execute(query)
        await db.commit()
        if response.rowcount == 0:  # type: ignore
            raise HTTPException(404, detail="Entity type not found")
    except IntegrityError as exc:
        raise HTTPException(409, detail="Entity type already exists") from exc
    except DataError as exc:
        raise HTTPException(400, detail="Bad data submitted") from exc
    return {"success": True}


@router.get("/entity-type", response_model=CustomPage[schemas.EntityTypeReturn])
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_entity_types(
    request: Request,
    db: AsyncSession = Depends(aget_read_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    query = select(
        EntityType.entity_type,
        EntityType.code,
        EntityType.active,
        EntityType.permission_hierarchy,
        EntityType.uuid,
    )
    return await paginate(db, query)


@router.post("/entity", response_model=schemas.AddEntityReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def add_entity(
    request: Request,
    entity: schemas.EntityPost,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    try:
        query = insert(Entity).values(
            name=entity.name,
            entity_type_uuid=entity.entity_code,
            email=entity.email,
            company_type=entity.company_type,
            organization_size=entity.organization_size,
            aum=entity.aum,
            country=entity.country,
            seats=entity.seats,
            expiration_date=entity.expiration_date,
            stripe_id=entity.stripe_id,
            api_keys=entity.api_keys,
        )
        response = await db.execute(query)
        entity_uuid = response.inserted_primary_key[0]
        # Add entity entitlement
        await pro_helpers.insert_entity_entitlement(db, entity_uuid, "pro")
    except IntegrityError as exc:
        detail = (
            exc.orig.args[1]
            if exc.orig.args and len(exc.orig.args) > 1
            else "Invalid code"
        )
        raise HTTPException(409, detail=detail) from exc

    # Create an admin user for the entity
    i_query = insert(PermissionsEntityMap).values(
        name="Admin",
        entitlements=schemas.ProEntitlements(),
        entity_uuid=entity_uuid,
    )
    # Create a base user for the entity
    i2_query = insert(PermissionsEntityMap).values(
        name="User",
        entitlements=schemas.ProEntitlements(),
        entity_uuid=entity_uuid,
    )
    result = await db.execute(i_query)
    await db.execute(i2_query)

    # send hubspot email to the admin
    EmailService.send_new_entity(to=entity.admin_email, entity_name=entity.name)

    await db.commit()
    return {
        "entity_uuid": entity_uuid,
        "permission_map_uuid": result.inserted_primary_key[0],
    }


@router.put("/entity/{entity_uuid}", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def put_entity(
    entity_uuid: UUID,
    request: Request,
    entity: schemas.EntityBase,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    query = (
        update(Entity)
        .where(Entity.uuid == entity_uuid)
        .values(
            name=entity.name,
            entity_type_uuid=entity.entity_code,
            email=entity.email,
            company_type=entity.company_type,
            organization_size=entity.organization_size,
            aum=entity.aum,
            country=entity.country,
            seats=entity.seats,
            expiration_date=entity.expiration_date,
            stripe_id=entity.stripe_id,
            api_keys=entity.api_keys,
        )
    )
    try:
        response = await db.execute(query)
        await db.commit()
        if response.rowcount == 0:  # type: ignore
            raise HTTPException(404, detail="Entity not found")
    except IntegrityError as exc:
        detail = (
            exc.orig.args[1]
            if exc.orig.args and len(exc.orig.args) > 1
            else "Invalid code"
        )
        raise HTTPException(409, detail=detail) from exc
    return {"success": True}


@router.get("/entity", response_model=CustomPage[schemas.EntityReturn])
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_entities(
    request: Request,
    db: AsyncSession = Depends(aget_read_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    def transformer(items: list[Entity]):
        cleaned = []
        for item in items:
            temp = schemas.EntityReturn(
                uuid=item.uuid,
                name=item.name,
                entity_type=item[2].__dict__,
                email=item.email,
                company_type=item.company_type,
                organization_size=item.organization_size,
                aum=item.aum,
                country=item.country,
                seats=item.seats,
                expiration_date=item.expiration_date,
                stripe_id=item.stripe_id,
                api_keys=item.api_keys or schemas.ProKeys(),
            )
            cleaned.append(temp)
        return cleaned

    query = (
        select(
            Entity.uuid,
            Entity.name,
            EntityType,
            Entity.email,
            Entity.company_type,
            Entity.organization_size,
            Entity.aum,
            Entity.country,
            Entity.seats,
            Entity.expiration_date,
            Entity.stripe_id,
            Entity.api_keys,
        )
        .select_from(Entity)
        .join(EntityType, Entity.entity_type_uuid == EntityType.uuid)
    )
    return await paginate(db, query, transformer=transformer)


@router.post("/entity-relationship", response_model=schemas.EntityRelationshipReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def add_entity_relationship(
    request: Request,
    entity: schemas.EntityRelationshipGet,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    schema = schemas.EntityRelationshipCreate(
        parent_uuid=entity.parent_uuid, child_uuid=entity.child_uuid
    )
    # We are keeping this for now, because this has more complicated logic
    return await crud.create_entity_relationship(db, schema)


@router.put("/entity-relationship/{er_uuid}", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def put_entity_relationship(
    er_uuid: UUID,
    request: Request,
    entity: schemas.EntityRelationshipGet,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    try:
        query = (
            update(models.EntityRelationship)
            .where(models.EntityRelationship.uuid == er_uuid)
            .values(parent_uuid=entity.parent_uuid, child_uuid=entity.child_uuid)
        )
        response = await db.execute(query)
        await db.commit()
        if response.rowcount == 0:  # type: ignore
            raise HTTPException(404, detail="Entity relationship not found")
    except IntegrityError as exc:
        raise HTTPException(
            404, detail="Parent or child relatiosnhip not found"
        ) from exc
    return schemas.SuccessReturn.success_instance()


@router.get(
    "/entity-relationship", response_model=CustomPage[schemas.EntityRelationshipReturn]
)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_entity_relationships(
    request: Request,
    db: AsyncSession = Depends(aget_read_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    query = select(models.EntityRelationship)
    return await paginate(db, query)


@router.post("/entity-map", response_model=schemas.UUIDReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def add_entity_map(
    request: Request,
    entity_map: schemas.EntityMapCreate,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    query = insert(PermissionsEntityMap).values(
        entity_uuid=entity_map.entity_uuid,
        name=entity_map.name,
        entitlements=entity_map.entitlements,
    )
    response = await db.execute(query)
    if response.rowcount == 0:  # type: ignore
        raise HTTPException(404, detail="Map not found")
    await db.commit()
    return {"uuid": response.inserted_primary_key[0]}


@router.put("/entity-map/{map_uuid}", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def put_entity_map(
    map_uuid: UUID,
    request: Request,
    entity_map: schemas.EntityMapCreate,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    query = (
        update(PermissionsEntityMap)
        .where(PermissionsEntityMap.uuid == map_uuid)
        .values(
            entity_uuid=entity_map.entity_uuid,
            name=entity_map.name,
            entitlements=entity_map.entitlements,
        )
    )
    try:
        response = await db.execute(query)
        if response.rowcount == 0:  # type: ignore
            raise HTTPException(404, detail="Map not found")
    except IntegrityError as exc:
        raise HTTPException(409, detail="Entity type already exists") from exc
    except DataError as exc:
        raise HTTPException(400, detail="Bad data submitted") from exc
    await db.commit()
    select_query = select(User.uuid).where(User.permissions_uuid == map_uuid)
    await routers_helpers.update_all_redis(
        db, select_query, entity_map.entitlements.model_dump()
    )
    return {"success": True}


@router.get("/entity-map", response_model=CustomPage[schemas.EntityMapReturn])
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_entity_maps(
    request: Request,
    db: AsyncSession = Depends(aget_read_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    query = select(PermissionsEntityMap)
    return await paginate(db, query)


@router.post("/register-admin", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def register_admin(
    request: Request,
    user: schemas.UserCreateAdmin,
    db: AsyncSession = Depends(aget_write_db),
    admin: User = Depends(auth_helpers.get_current_superuser),
):
    "Allows an admin to register a new user"
    extra_info = schemas.RegisterProUser(
        inviting_uuid=admin.uuid, inviting_email=admin.email
    )
    result = await routers_helpers.register_pro_user(db, user, extra_info)
    return schemas.SuccessReturn.from_bool(result)


async def takeover_user(token: UUID, db: AsyncSession = Depends(aget_write_db)):
    invite_query = (
        select(
            PermissionsInvite.uuid,
            PermissionsInvite.permissions_uuid,
            User.email,
            PermissionsInvite.shared_dashboards,
            User.uuid.label("user_uuid"),
        )
        .select_from(models.PermissionsInvite)
        .where(
            PermissionsInvite.revoked.is_(False),
            PermissionsInvite.accepted.is_(False),
            PermissionsInvite.expiration_date > base.get_now(),
            PermissionsInvite.uuid == token,
        )
        .join(User, PermissionsInvite.user_uuid == User.uuid)
    )
    invite_data = (await db.execute(invite_query)).first()
    if not invite_data:
        return schemas.MessageReturn(success=False, message="Invite not found")
    billing_active = await crud.total_user_count_full(db, invite_data.permissions_uuid)
    # hubspot pro_start_date sync removed — not needed for marketing provider
    update_user = (
        update(User)
        .where(User.email == invite_data.email)
        .values(
            permissions_uuid=invite_data.permissions_uuid,
            billing_active=billing_active,
            pro_start=base.get_now(),
        )
    )
    update_invite = (
        update(PermissionsInvite)
        .where(
            PermissionsInvite.uuid == invite_data.uuid,
            PermissionsInvite.revoked.is_(False),
            PermissionsInvite.expiration_date > base.get_now(),
        )
        .values(accepted=1)
    )
    # Takeovers dont work on the same entity, so there is no reason to check for it here
    await crud.remove_shares_both_ways(db, email=invite_data.email)
    # Add shares
    for key, value in (invite_data.shared_dashboards or {}).items():
        share_insert = insert(DashboardShare).values(
            dashboard_item_uuid=key,
            shared_user_uuid=invite_data.user_uuid,
            permissions=value,
        )
        await db.execute(share_insert)
    response = await db.execute(update_user)
    await db.execute(update_invite)
    await db.commit()
    if response.rowcount == 0:  # type: ignore
        return schemas.MessageReturn(success=False, message="User not found")
    select_user = select(User.uuid).where(User.email == invite_data.email)
    (await db.execute(select_user)).first()
    return schemas.MessageReturn(success=True, message=invite_data.email)


@router.patch("/takeover/{token}", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def takeover(
    token: UUID, request: Request, db: AsyncSession = Depends(aget_write_db)
):
    try:
        result = await takeover_user(token, db)
        if not result.success:
            raise HTTPException(404, detail=result.message)
        return schemas.SuccessReturn.success_instance()
    except Exception as exc:
        logger.error(f"Error during takeover: {exc}")
        raise HTTPException(500, detail="Unknown error during takeover") from exc


@router.put("/user/{user_uuid}", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def put_user(
    user_uuid: UUID,
    request: Request,
    user: schemas.UserUpdateAdmin,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    # Old entity
    old_entity_query = (
        select(PermissionsEntityMap.entity_uuid)
        .join(User, User.permissions_uuid == PermissionsEntityMap.uuid)
        .where(User.uuid == user_uuid)
    )
    old_entity_uuid = (await db.execute(old_entity_query)).scalar_one_or_none()
    new_entity_query = select(PermissionsEntityMap.entity_uuid).where(
        PermissionsEntityMap.uuid == user.permissions_uuid
    )
    new_entity_uuid = (await db.execute(new_entity_query)).scalar_one_or_none()
    nowish = base.get_now()
    query = (
        update(User)
        .where(User.uuid == user_uuid)
        .values(
            permissions_uuid=user.permissions_uuid,
            pro_trial_granted=True,
            pro_trial_granted_date=nowish,
        )
    )
    if user.pro_trial_end:
        query = query.values(pro_trial_end=user.pro_trial_end)

    # Update the user's permissions_uuid and pro_trial_end (if any)
    response = await db.execute(query)
    await db.commit()
    if response.rowcount == 0:  # type: ignore
        raise HTTPException(404, detail="User not found")

    # hubspot pro_trial_granted sync removed — not needed for marketing provider

    # Handle shared dashboards
    if old_entity_uuid != new_entity_uuid:
        await crud.remove_shares_both_ways(db, user_uuid)
        await crud.update_user_dashboards_new_entity(db, user_uuid, new_entity_uuid)

    # Clear the user's redis cache
    r = settings.get_redis_session("pro")
    r.delete(str(user_uuid))

    # Update user entitlements for the new entity's
    await pro_helpers.update_user_entitlement_with_entity_entitlement(db, user_uuid)

    # Update onboarding info to not skip onboarding
    update_onboarding_query = (
        update(models.DeveloperOnboarding)
        .where(models.DeveloperOnboarding.user_uuid == user_uuid)
        .values(skip_onboarding=False)
    )
    await db.execute(update_onboarding_query)

    # Having the user change permissions_uuid should also toggle the welcome screen
    await pro_helpers.toggle_welcome_screen(db, user_uuid, True)

    # Destroy all other pro sessions for the user
    await auth_helpers.delete_user_pro_sessions(
        db, user_uuid, ["pro", "oauth-pro", "excel"]
    )
    return {"success": True}


@router.get("/user", response_model=CustomPage[schemas.EntityUserReturn])
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_users(
    request: Request,
    email: str = "",
    db: AsyncSession = Depends(aget_read_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    query = select(User.uuid, User.email, User.permissions_uuid, User.pro_trial_end)
    if email:
        query = query.where(User.email.contains(email))

    async def transformer(items: list[User]):
        cleaned = []
        for item in items:
            permissions_query = (
                select(PermissionsEntityMap)
                .where(PermissionsEntityMap.uuid == item.permissions_uuid)
                .limit(1)
            )
            permissions = (await db.execute(permissions_query)).scalar_one_or_none()
            cleaned.append(
                schemas.EntityUserReturn(
                    uuid=item.uuid,
                    email=item.email,
                    permissions=permissions,
                    pro_trial_end=item.pro_trial_end,
                )
            )
        return cleaned

    return await paginate(db, query, transformer=transformer)


@router.get("/entitlement/{entity_uuid}", response_model=schemas.EntitlementGet)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def get_entitlement(
    request: Request,
    entity_uuid: UUID,
    db: AsyncSession = Depends(aget_read_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    result = await pro_helpers.get_entity_entitlement(db, entity_uuid)
    if not result:
        raise HTTPException(status_code=404, detail="Entitlement not found")
    return result


@router.patch("/entitlement/{entity_uuid}", response_model=schemas.SuccessReturn)
async def patch_entitlement(
    entity_uuid: UUID,
    entitlement: schemas.EntitlementPatch,
    update_all: bool = False,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    """
    Endpoint to update the entitlement for an entity.

    Args:
        entitlement (schemas.EntitlementPatch): The entitlement to be updated.
        update_all (bool): If True, apply changes to all users regardless of their current values.

    Returns:
        SuccessReturn: An instance indicating the operation was successful.
    """
    tiers_match = {
        "pro": models.PRO_TIER_ID,
        "terminal": models.TERMINAL_TIER_ID,
    }
    has_entitlement = await pro_helpers.has_entity_entitlement(db, entity_uuid)
    if not has_entitlement:
        raise HTTPException(status_code=404, detail="Entitlement not found")

    entitlement_dict = entitlement.model_dump(exclude_unset=True)
    if tier := entitlement_dict.pop("tier", None):
        entitlement_dict["tier_id"] = tiers_match.get(tier)

    bundle_name = entitlement_dict.pop("bundle_name", None)
    if bundle_name and settings.is_onprem():
        bundle_uuid = await pro_helpers.get_data_bundle_uuid(db, bundle_name)
        if bundle_uuid is None:
            raise HTTPException(
                status_code=404, detail=f"Data bundle '{bundle_name}' not found"
            )
        entitlement_dict["data_bundle_uuid"] = bundle_uuid

    # Fetch the current entitlement from the database
    current_entitlement = (
        await db.execute(
            select(models.EntityEntitlement).where(
                models.EntityEntitlement.entity_uuid == entity_uuid
            )
        )
    ).scalar_one_or_none()

    if not current_entitlement:
        raise HTTPException(status_code=404, detail="Entitlement not found")

    # Make a copy of the entitlements so we can use to compare with the user's
    current_entitlement_detached = deepcopy(current_entitlement)

    # Compare the current values with the new values and create a dictionary of changed values
    changed_values = {
        key: value
        for key, value in entitlement_dict.items()
        if getattr(current_entitlement, key) != value
    }

    if changed_values:
        # Update the database with the changed values
        query = (
            update(models.EntityEntitlement)
            .where(models.EntityEntitlement.entity_uuid == entity_uuid)
            .values(**changed_values)
        )
        await db.execute(query)

    # Apply the changes on its users
    users_in_entity = await pro_helpers.get_entity_users(db, entity_uuid)
    for user_uuid in users_in_entity:
        if update_all:
            # If update_all is True, apply all changes to all users
            query = (
                update(models.Entitlement)
                .where(models.Entitlement.user_uuid == user_uuid)
                .values(**changed_values)
            )
            await db.execute(query)
        else:
            # Fetch the user's current entitlement
            user_entitlement = await db.execute(
                select(models.Entitlement).where(
                    models.Entitlement.user_uuid == user_uuid
                )
            )
            user_entitlement = user_entitlement.scalar_one_or_none()

            if user_entitlement:
                # Only update fields that match the entity's current values
                user_changes = {
                    key: value
                    for key, value in changed_values.items()
                    if getattr(user_entitlement, key)
                    == getattr(current_entitlement_detached, key)
                }

                if user_changes:
                    query = (
                        update(models.Entitlement)
                        .where(models.Entitlement.user_uuid == user_uuid)
                        .values(**user_changes)
                    )
                    await db.execute(query)

    await db.commit()
    return schemas.SuccessReturn.success_instance()


@router.delete("/entity/{entity_uuid}", response_model=schemas.SuccessReturn)
@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)
async def delete_entity(
    entity_uuid: UUID,
    request: Request,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(auth_helpers.get_current_superuser),
):
    """Delete an entity by uuid if it has no users"""
    users_in_entity = await pro_helpers.get_entity_users(db, entity_uuid)
    if users_in_entity:
        raise HTTPException(
            status_code=400, detail="Cannot delete entity with existing users"
        )
    delete_query = delete(models.Entity).where(models.Entity.uuid == entity_uuid)
    result = await db.execute(delete_query)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Entity not found")
    await db.commit()
    return schemas.SuccessReturn.success_instance()


@router.post("/role", response_model=schemas.SuccessReturn)
async def post_role(
    role: schemas.PostRole,
    db: AsyncSession = Depends(aget_write_db),
    admin: User = Depends(auth_helpers.get_current_superuser),
):
    """
    Create a new role for the entity
    """
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    insert_query = insert(models.Role).values(
        uuid=role.uuid,
        name=role.name,
        description=role.description,
        entity_uuid=entity_uuid,
    )
    role_uuid = (await db.execute(insert_query)).inserted_primary_key[0]

    if role.users:
        await pro_helpers.add_users_to_role(db, role_uuid, role.users)

    await db.commit()

    return schemas.SuccessReturn.success_instance()


@router.get("/role", response_model=list[schemas.GetRoleWithUsers])
async def get_roles(
    db: AsyncSession = Depends(aget_read_db),
    admin: User = Depends(auth_helpers.get_current_superuser),
):
    """
    Get all roles for the entity
    """
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    query = select(models.Role).where(models.Role.entity_uuid == entity_uuid)
    roles = await db.execute(query)

    result = []
    for role in roles.scalars():
        role_users = await pro_helpers.get_role_users(db, role.uuid)
        result.append(
            schemas.GetRoleWithUsers(
                uuid=role.uuid,
                name=role.name,
                description=role.description,
                updated_date=role.updated_date,
                users=role_users,
            )
        )
    return result


@router.get("/role/{role_uuid}", response_model=schemas.GetRoleWithUsers)
async def get_role(
    role_uuid: UUID,
    db: AsyncSession = Depends(aget_read_db),
    admin: User = Depends(auth_helpers.get_current_superuser),
):
    """Get a role by uuid"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    role = (
        await db.execute(
            select(models.Role).where(
                models.Role.uuid == role_uuid,
                models.Role.entity_uuid == entity_uuid,
            )
        )
    ).scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    role_users = await pro_helpers.get_role_users(db, role_uuid)
    return schemas.GetRoleWithUsers(
        uuid=role.uuid,
        name=role.name,
        description=role.description,
        updated_date=role.updated_date,
        users=role_users,
    )


@router.patch("/role/{role_uuid}", response_model=schemas.SuccessReturn)
async def patch_role(
    role_uuid: UUID,
    role: schemas.PatchRole,
    db: AsyncSession = Depends(aget_write_db),
    admin: User = Depends(auth_helpers.get_current_superuser),
):
    """Patch a role"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    if not await pro_helpers.role_exists(db, role_uuid, entity_uuid):
        raise HTTPException(status_code=404, detail="Role not found")

    # Update role details if name or description provided
    adjusted_role = role.model_dump(
        exclude={"users"}, exclude_unset=True, exclude_none=True
    )

    if adjusted_role:
        query = (
            update(models.Role)
            .where(
                models.Role.uuid == role_uuid, models.Role.entity_uuid == entity_uuid
            )
            .values(**adjusted_role)
        )
        await db.execute(query)
        await db.commit()

    # Update users if provided
    if role.users is not None:  # Check if None since empty list is valid
        await pro_helpers.update_role_users(db, role_uuid, role.users)

    return schemas.SuccessReturn.success_instance()


@router.delete("/role/{role_uuid}", response_model=schemas.SuccessReturn)
async def delete_role(
    role_uuid: UUID,
    db: AsyncSession = Depends(aget_write_db),
    admin: User = Depends(auth_helpers.get_current_superuser),
):
    """Delete a role"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    if not await pro_helpers.role_exists(db, role_uuid, entity_uuid):
        raise HTTPException(status_code=404, detail="Role not found")

    # Delete the group - UserGroup entries will be cascade deleted due to foreign key constraint
    result = await db.execute(delete(models.Role).where(models.Role.uuid == role_uuid))

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Role not found")

    await db.commit()
    return schemas.SuccessReturn.success_instance()


@router.put("/role-permissions/{role_uuid}", response_model=schemas.SuccessReturn)
async def put_role_permissions(
    role_uuid: UUID,
    role_permissions: list[schemas.RolePermissions],
    db: AsyncSession = Depends(aget_write_db),
    admin: User = Depends(auth_helpers.get_current_superuser),
):
    """Update the permissions for a role"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    if not await pro_helpers.role_exists(db, role_uuid, entity_uuid):
        raise HTTPException(status_code=404, detail="Role not found")

    for role_permission in role_permissions:
        if role_permission.type == "backend":
            await pro_helpers.insert_or_update_backend_permissions(
                db, role_uuid, role_permission.uuid, role_permission
            )
        elif role_permission.type == "file":
            await pro_helpers.insert_or_update_file_permissions(
                db, role_uuid, role_permission.uuid, role_permission.access
            )

    await db.commit()

    return schemas.SuccessReturn.success_instance()


@router.get(
    "/role-permissions/{role_uuid}", response_model=list[schemas.RolePermissions]
)
async def get_role_permissions(
    role_uuid: UUID,
    db: AsyncSession = Depends(aget_read_db),
    admin: User = Depends(auth_helpers.get_current_superuser),
):
    """Get the permissions for a role"""
    entity_uuid = await pro_helpers.get_entity_uuid(db, admin.uuid)
    if not await pro_helpers.role_exists(db, role_uuid, entity_uuid):
        raise HTTPException(status_code=404, detail="Role not found")

    permissions = []
    # Get backend permissions
    permissions_backends = await db.execute(
        select(models.RoleBackend).where(models.RoleBackend.role_uuid == role_uuid)
    )
    permissions.extend(
        [
            schemas.RolePermissions(
                uuid=permission.backend_uuid,
                access=permission.access,
                widgets=permission.widgets,
                templates=permission.templates,
                type="backend",
                category="data-connectors",
            )
            for permission in permissions_backends.scalars()
        ]
    )

    # Get file permissions
    permissions_files = await db.execute(
        select(
            models.RoleFile.file_uuid,
            models.RoleFile.access,
            models.FileWidget.extension,
        )
        .join(models.FileWidget, models.RoleFile.file_uuid == models.FileWidget.uuid)
        .where(models.RoleFile.role_uuid == role_uuid)
    )
    permissions.extend(
        [
            schemas.RolePermissions(
                uuid=permission["file_uuid"],
                access=permission["access"],
                type="file",
                category="data-connectors",
                file_extension=permission["extension"],
            )
            for permission in permissions_files.mappings()
        ]
    )
    return permissions


@router.post("/data-backends/{entity_uuid}")
async def add_data_backend(
    entity_uuid: UUID,
    data_backend: schemas.CreateApiSource,
    db: AsyncSession = Depends(aget_write_db),
    _: User = Depends(auth_helpers.get_current_superuser),
):
    """Add a data backend to the entity"""

    insert_query = insert(models.ApiSource).values(
        **data_backend.model_dump(), entity_uuid=entity_uuid
    )

    await db.execute(insert_query)
    await db.commit()
    return schemas.SuccessReturn.success_instance()


@router.delete("/data-backends/{entity_uuid}/{backend_name}")
async def delete_data_backend(
    entity_uuid: UUID,
    backend_name: str,
    db: AsyncSession = Depends(aget_write_db),
    _: User = Depends(auth_helpers.get_current_superuser),
):
    """Delete a data backend from the entity"""
    delete_query = delete(models.ApiSource).where(
        models.ApiSource.entity_uuid == entity_uuid,
        models.ApiSource.name == backend_name,
    )
    result = await db.execute(delete_query)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Data backend not found")

    await db.commit()
    return schemas.SuccessReturn.success_instance()


@router.get(
    "/data-backends/{entity_uuid}", response_model=list[schemas.ReturnApiSource]
)
async def get_data_backends(
    entity_uuid: UUID,
    db: AsyncSession = Depends(aget_read_db),
    _: User = Depends(auth_helpers.get_current_superuser),
):
    """Get the data backends for the entity"""
    query = select(models.ApiSource).where(models.ApiSource.entity_uuid == entity_uuid)
    data_backends = await db.execute(query)

    return data_backends.scalars().all()
