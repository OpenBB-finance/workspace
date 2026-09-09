"""Entity models"""

from datetime import UTC, datetime
from typing import Self
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy_utils import UUIDType

from api import schemas
from api.models.model_helpers import (
    AwareDateTime,
    Base,
    DateMixin,
    GzipJsonType,
    ProEntitlementsType,
    ProKeysType,
    UUIDMixin,
)


async def entity_get_supreme(db: AsyncSession, self_uuid: UUID) -> None | UUID:
    """Get the supreme entity for an entity. In a tree, every item will appear as a child
    Somewhere except the first item, and an unknown number of items will never appear as
    parents. To be the most efficient first we check for a child with the given id, then
    we check for any parent with the id.
    """

    query = select(EntityRelationship.supreme_uuid).where(
        EntityRelationship.child_uuid == self_uuid
    )
    child = (await db.execute(query)).first()
    if child:
        return child[0]
    query = select(EntityRelationship.supreme_uuid).where(
        EntityRelationship.parent_uuid == self_uuid
    )
    parent = (await db.execute(query)).first()
    if parent:
        return parent.supreme_uuid
    return None


class EntityType(Base, UUIDMixin, DateMixin):
    """Stores the types of entities and system information"""

    __tablename__ = "entity_type"

    entity_type: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(3), unique=True)
    active = Column(Boolean, default=False)
    permission_hierarchy = Column(Integer, default=0, nullable=False)


class Entity(Base, UUIDMixin, DateMixin):
    """Stores names and details of entities"""

    __tablename__ = "entity"

    name: Mapped[None | str] = mapped_column(String(100), unique=True)
    entity_type_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("entity_type.uuid"), index=True
    )
    entity_type: Mapped["EntityType"] = relationship(
        foreign_keys=[entity_type_uuid], lazy="selectin"
    )
    email: Mapped[None | str] = mapped_column(String(200))
    company_type: Mapped[None | str] = mapped_column(String(20))
    organization_size: Mapped[None | str] = mapped_column(String(20))
    aum: Mapped[None | int] = mapped_column(BigInteger, default=0)
    country: Mapped[None | str] = mapped_column(String(60))
    require_authenticator: Mapped[bool] = mapped_column(Boolean, default=False)
    api_keys: Mapped[ProKeysType] = mapped_column(
        ProKeysType, default=schemas.ProKeys()
    )
    seats: Mapped[None | int] = mapped_column(Integer, default=1)
    expiration_date: Mapped[None | datetime] = mapped_column(AwareDateTime())
    stripe_id: Mapped[None | str] = mapped_column(Text)

    async def get_all_children(self, db: AsyncSession) -> list["Entity"]:
        """Returns self, children, and children of children recursively"""

        # First we need to look at the child of the base element
        children = [self]
        stack = [self]

        # Then we fetch ALL relationships, in the future we might want to do smart
        # filter or caching, but this is fine until we see performance issues
        all_rels: list[EntityRelationship] = (
            (await db.execute(select(EntityRelationship))).scalars().all()
        )

        # Then we iterate through the stack, adding children to the list and stack
        while stack:
            current = stack.pop()
            temp = [x for x in all_rels if x.parent_uuid == current.uuid]
            children.extend([x.child for x in temp])
            stack.extend([x.child for x in temp])
        return children

    async def get_supreme(self, db: AsyncSession) -> UUID | None:
        return await entity_get_supreme(db, self.uuid)


class EntityRelationship(Base, UUIDMixin, DateMixin):
    """Stores the parent and child relationships for entities"""

    __tablename__ = "entity_relationship"

    parent_uuid: Mapped[UUID] = mapped_column(ForeignKey("entity.uuid"), index=True)
    parent: Mapped["Entity"] = relationship(foreign_keys=[parent_uuid], lazy="selectin")
    child_uuid: Mapped[UUID] = mapped_column(ForeignKey("entity.uuid"), index=True)
    child: Mapped["Entity"] = relationship(foreign_keys=[child_uuid], lazy="selectin")
    supreme_uuid: Mapped[UUID] = mapped_column(ForeignKey("entity.uuid"), index=True)
    supreme: Mapped["Entity"] = relationship(
        foreign_keys=[supreme_uuid], lazy="selectin"
    )


class PermissionsEntityMap(Base, UUIDMixin, DateMixin):
    """Combines an entity with various permissions"""

    __tablename__ = "permissions_entity_map"

    entity_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("entity.uuid", ondelete="CASCADE"), index=True
    )
    entity: Mapped["Entity"] = relationship(foreign_keys=[entity_uuid], lazy="selectin")
    name: Mapped[str] = mapped_column(String(100))
    entitlements: Mapped[None | schemas.ProEntitlements] = mapped_column(
        ProEntitlementsType
    )


class AuditEntityRolesPermissions(Base, UUIDMixin, DateMixin):
    """Stores the audit logs for entity roles and permissions"""

    __tablename__ = "audit_entity_roles_permissions"

    entity_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("entity.uuid", ondelete="CASCADE"), index=True
    )
    entity: Mapped["Entity"] = relationship(foreign_keys=[entity_uuid])
    role_uuid: Mapped[UUID] = mapped_column(ForeignKey("role.uuid"), index=True)
    role: Mapped["Role"] = relationship(foreign_keys=[role_uuid])
    action: Mapped[str] = mapped_column(String(100))
    resource_type: Mapped[str] = mapped_column(String(100))
    resource_uuid: Mapped[UUID] = mapped_column(UUIDType, index=True)
    performed_by_uuid: Mapped[UUID] = mapped_column(ForeignKey("user.uuid"), index=True)
    performed_by = relationship("User")
    details: Mapped[dict] = mapped_column(GzipJsonType)


class Role(Base, UUIDMixin, DateMixin):
    """Stores the roles of entities"""

    __tablename__ = "role"
    __table_args__ = (
        # Modified unique constraint to consider deleted_at
        UniqueConstraint(
            "entity_uuid", "name", "deleted_at", name="uix_role_entity_name_deleted_at"
        ),
    )

    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    entity_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("entity.uuid", ondelete="CASCADE"), index=True
    )
    entity: Mapped["Entity"] = relationship(foreign_keys=[entity_uuid])
    deleted_at: Mapped[datetime | None] = mapped_column(
        AwareDateTime(timezone=True), nullable=True
    )

    async def soft_delete(self, db: AsyncSession) -> Self:
        """Soft delete this role"""
        self.deleted_at = datetime.now(UTC)
        await db.flush()
        return self


class RoleBackend(Base, UUIDMixin, DateMixin):
    """Stores the roles of entities"""

    __tablename__ = "role_backend"

    role_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("role.uuid", ondelete="CASCADE"), index=True
    )
    role: Mapped["Role"] = relationship(foreign_keys=[role_uuid])
    backend_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("api_source.uuid", ondelete="CASCADE"), index=True
    )
    backend = relationship("ApiSource")
    access: Mapped[str] = mapped_column(String(100))
    widgets: Mapped[list[dict] | None] = mapped_column(GzipJsonType)
    templates: Mapped[list[dict] | None] = mapped_column(GzipJsonType)


class RoleFile(Base, UUIDMixin, DateMixin):
    """Stores the roles of entities"""

    __tablename__ = "role_file"

    role_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("role.uuid", ondelete="CASCADE"), index=True
    )
    role: Mapped["Role"] = relationship(foreign_keys=[role_uuid])
    file_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("file_widget.uuid", ondelete="CASCADE"), index=True
    )
    file = relationship("FileWidget")
    access: Mapped[str] = mapped_column(String(100))


class RolePrompt(Base, UUIDMixin, DateMixin):
    """Stores the roles of entities"""

    __tablename__ = "role_prompt"

    role_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("role.uuid", ondelete="CASCADE"), index=True
    )
    role: Mapped["Role"] = relationship(foreign_keys=[role_uuid])
    prompt_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("user_prompts.uuid", ondelete="CASCADE"), index=True
    )
    prompt = relationship("UserPrompts")
    access: Mapped[str] = mapped_column(String(100))


class EntityThemeSettings(Base, UUIDMixin, DateMixin):
    """Stores the theme settings for an entity, used by ag-grid"""

    __tablename__ = "entity_theme_settings"

    entity_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("entity.uuid", ondelete="CASCADE"), index=True
    )
    settings: Mapped[dict] = mapped_column(GzipJsonType)
