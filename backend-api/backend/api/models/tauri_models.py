"""Tauri models"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ColumnElement,
    Computed,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy_utils import ScalarListType, UUIDType

from api import base
from api.models.marketplace_models import VendorApp
from api.models.model_helpers import (
    DATETIME,
    AwareDateTime,
    Base,
    DateMixin,
    EncryptedType,
    GzipJsonLongType,
    GzipJsonType,
    HttpUrlType,
    JSONType,
    UUIDMixin,
)
from utilities.config import settings


class DashboardItem(Base, UUIDMixin, DateMixin):
    "Stores dashboard folders or item"

    __tablename__ = "dashboard_item"

    creator_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), index=True
    )
    owner_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), index=True
    )
    entity_share: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    entity_uuid: Mapped[None | UUID] = mapped_column(
        UUIDType, ForeignKey("entity.uuid"), index=True
    )
    content: Mapped[str | None] = mapped_column(GzipJsonLongType)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class DashboardSave(Base, UUIDMixin):
    """Stores one version of a dashboard

    Important note: this table does not use the DateMixin because that keeps track of dates in seconds
    and here we need fractional seconds to ensure that users always retrieve the latest version of the dashboard
    """

    __tablename__ = "dashboard_save"

    dashboard_item_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("dashboard_item.uuid", ondelete="CASCADE"), index=True
    )
    content: Mapped[str | None] = mapped_column(GzipJsonType)
    created_date: Mapped[datetime | None] = mapped_column(
        DATETIME(fsp=6), default=base.get_now
    )
    updated_date: Mapped[datetime | None] = mapped_column(
        DATETIME(fsp=6), default=base.get_now, onupdate=base.get_now
    )


class DashboardShare(Base, UUIDMixin, DateMixin):
    "Gives one user specific access to one dashboard item"

    __tablename__ = "dashboard_share"

    dashboard_item_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("dashboard_item.uuid", ondelete="CASCADE"), index=True
    )
    shared_user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), index=True
    )
    active: Mapped[str] = mapped_column(Boolean, default=True, index=True)
    permissions: Mapped[base.PermissionEnum] = mapped_column(
        Enum(base.PermissionEnum), default=base.PermissionEnum.view
    )
    viewed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class SingleWidget(Base, UUIDMixin, DateMixin):
    __tablename__ = "single_widget"

    description: Mapped[None | str] = mapped_column(Text)
    endpoint: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), index=True
    )
    grid_data: Mapped[str | None] = mapped_column(JSONType)
    data: Mapped[str | None] = mapped_column(JSONType)
    endpoint_headers: Mapped[str | None] = mapped_column(JSONType)
    source: Mapped[None | list[str]] = mapped_column(ScalarListType)
    category: Mapped[None | str] = mapped_column(Text)
    sub_category: Mapped[None | str] = mapped_column(Text)
    data_key: Mapped[None | str] = mapped_column(Text)


class ApiSource(Base, UUIDMixin, DateMixin):
    __tablename__ = "api_source"

    name: Mapped[str] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(HttpUrlType)
    user_uuid: Mapped[None | UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), index=True
    )
    endpointHeaders: Mapped[list[dict[str, str]] | None] = mapped_column(EncryptedType)
    entity_uuid: Mapped[None | UUID] = mapped_column(
        ForeignKey("entity.uuid", ondelete="CASCADE"), index=True
    )
    vendor_app_uuid: Mapped[None | UUID] = mapped_column(
        ForeignKey("vendor_app.uuid", ondelete="CASCADE"), index=True
    )
    vendor_app: Mapped[VendorApp | None] = relationship(
        foreign_keys=[vendor_app_uuid], lazy="joined"
    )

    __table_args__ = (
        CheckConstraint(
            (user_uuid.isnot(None)) | (entity_uuid.isnot(None)),
            name="check_user_or_entity_api_source",
        ),
        Index(
            "ix_user_entity_name_api_source",
            "user_uuid",
            "entity_uuid",
            "name",
            unique=False,
        ),
    )


class FileWidget(Base, UUIDMixin, DateMixin):
    __tablename__ = "file_widget"

    user_uuid: Mapped[UUID] = mapped_column(ForeignKey("user.uuid"), index=True)
    url: Mapped[str] = mapped_column(HttpUrlType)
    name: Mapped[str] = mapped_column(Text)
    extension: Mapped[str] = mapped_column(Text)
    original_file_name: Mapped[None | str] = mapped_column(Text)
    data_key: Mapped[None | str] = mapped_column(Text)
    description: Mapped[None | str] = mapped_column(Text)
    category: Mapped[None | str] = mapped_column(Text)
    sub_category: Mapped[None | str] = mapped_column(Text)
    source: Mapped[None | str] = mapped_column(Text)


class DONT_USE_CopilotChats(Base, UUIDMixin, DateMixin):
    """Copilot Chat"""

    __tablename__ = "copilot_chats"
    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), unique=True, nullable=False
    )
    chats: Mapped[list[dict] | None] = mapped_column(
        GzipJsonType,
    )


class CopilotChatOld(Base, UUIDMixin, DateMixin):
    """Copilot Chat"""

    __tablename__ = "copilot_chat_old"
    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), nullable=False, index=True
    )
    content: Mapped[dict | None] = mapped_column(GzipJsonLongType)


class CopilotChat(Base, UUIDMixin, DateMixin):
    """Copilot Chat"""

    __tablename__ = "copilot_chat"
    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), nullable=False, index=True
    )
    content: Mapped[dict | None] = mapped_column(GzipJsonType)
    artifacts: Mapped[list[dict] | None] = mapped_column(GzipJsonLongType)
    label: Mapped[str | None] = mapped_column(Text)

    messages: Mapped[list["ChatMessages"]] = relationship(
        "ChatMessages",
        primaryjoin="CopilotChat.uuid == ChatMessages.chat_uuid",
        order_by="ChatMessages.created_date.asc()",
        backref="copilot_chat",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    last_opened: Mapped[datetime | None] = mapped_column(
        AwareDateTime(), default=base.get_now
    )

    if settings.DATABASE_TYPE == "postgresql":
        search_vector: Mapped[TSVECTOR | None] = mapped_column(
            TSVECTOR,
            Computed("to_tsvector('simple', label)", persisted=True),
            nullable=True,
        )

        # GIN Index is critical for full-text search performance
        __table_args__ = (
            Index("ix_copilot_chat_search", search_vector, postgresql_using="gin"),
        )

    if settings.DATABASE_TYPE == "mysql":
        __table_args__ = (
            Index("ix_copilot_chat_search", "label", mysql_prefix="FULLTEXT"),
        )


class ChatMessages(Base, UUIDMixin):
    """Copilot Chat Messages"""

    __tablename__ = "copilot_messages"
    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), nullable=False
    )
    chat_uuid: Mapped[UUID] = mapped_column(
        UUIDType,
        ForeignKey("copilot_chat.uuid", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[dict | None] = mapped_column(GzipJsonType)
    searchable_content: Mapped[str | None] = mapped_column(Text)
    role: Mapped[base.ChatMessageRole] = mapped_column(Enum(base.ChatMessageRole))

    created_date: Mapped[datetime | None] = mapped_column(
        DATETIME(fsp=3), default=base.get_now
    )
    updated_date: Mapped[datetime | None] = mapped_column(
        DATETIME(fsp=3), default=base.get_now, onupdate=base.get_now
    )

    __table_args__ = (
        Index(
            "ix_user_chat_message",
            "user_uuid",
            "chat_uuid",
            text("created_date DESC"),
            unique=False,
        ),
        Index(
            "ix_user_searchable_content",
            "user_uuid",
            "chat_uuid",
            "role",
            unique=False,
        ),
    )
    if settings.DATABASE_TYPE == "postgresql":
        # Automatically managed TSVECTOR  full-text search
        search_vector: Mapped[TSVECTOR | None] = mapped_column(
            TSVECTOR,
            Computed("to_tsvector('simple', searchable_content)", persisted=True),
            nullable=True,
        )

        __table_args__ += (
            Index("ix_user_search_vector", search_vector, postgresql_using="gin"),
        )

    if settings.DATABASE_TYPE == "mysql":
        __table_args__ += (
            Index(
                "ix_user_searchable_content_fulltext",
                "searchable_content",
                mysql_prefix="FULLTEXT",
                unique=False,
            ),
        )


class TradingView(Base, UUIDMixin, DateMixin):
    """TradingView state"""

    __tablename__ = "trading_view"

    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), unique=True, nullable=False
    )
    charts_state: Mapped[dict] = mapped_column(GzipJsonType)
    settings: Mapped[dict] = mapped_column(GzipJsonType)


class StoredFile(Base, UUIDMixin, DateMixin):
    __tablename__ = "stored_file"

    creater_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), nullable=False, index=True
    )
    file_widget_uuid: Mapped[None | UUID] = mapped_column(
        UUIDType,
        ForeignKey("file_widget.uuid", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    s3_file_name: Mapped[str] = mapped_column(Text)
    bucket: Mapped[str] = mapped_column(Text)
    extension: Mapped[str] = mapped_column(Text)
    original_file_name: Mapped[None | str] = mapped_column(Text)
    size: Mapped[int] = mapped_column(Integer, default=0)
    is_global: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_entity_shared: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class StoredFileShare(Base, UUIDMixin, DateMixin):
    __tablename__ = "stored_file_share"

    dashboard_item_uuid: Mapped[UUID | None] = mapped_column(
        UUIDType, ForeignKey("dashboard_item.uuid", ondelete="CASCADE"), index=True
    )
    user_app_uuid: Mapped[UUID | None] = mapped_column(
        UUIDType, ForeignKey("user_app.uuid", ondelete="CASCADE"), index=True
    )
    creater_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), nullable=False, index=True
    )
    shared_user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), nullable=False, index=True
    )
    stored_file_uuids: Mapped[list[UUID]] = mapped_column(ScalarListType(UUID))
    entity_uuid: Mapped[None | UUID] = mapped_column(
        UUIDType, ForeignKey("entity.uuid"), nullable=True, index=True
    )


class PostStoredFile(BaseModel):
    filename: str | None = None
    file_uuid: UUID | None = None

    def filter_element(self) -> ColumnElement[bool]:
        if self.filename:
            return StoredFile.original_file_name == self.filename

        return StoredFile.uuid == self.file_uuid

    def to_stored_file(self, db_results: list[StoredFile]) -> StoredFile | None:
        if not db_results:
            return None

        if self.file_uuid:
            return next((x for x in db_results if x.uuid == self.file_uuid), None)

        if self.filename:
            return next(
                (x for x in db_results if x.original_file_name == self.filename), None
            )

        return None


class WidgetMetadata(Base, UUIDMixin, DateMixin):
    __tablename__ = "widget_metadata"

    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), nullable=False
    )

    name: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(50))
    category: Mapped[str] = mapped_column(String(50))
    sub_category: Mapped[str] = mapped_column(String(50))
    widget_type: Mapped[str] = mapped_column(String(50))
    storage: Mapped[str | None] = mapped_column(GzipJsonType)
    widget_config: Mapped[dict | None] = mapped_column(GzipJsonType)
    widget_id: Mapped[UUID] = mapped_column(
        UUIDType, unique=True
    )  # this is FE ID (uuid)

    __table_args__ = (
        Index("ix_user_name_type", "user_uuid", "name", "widget_type", unique=False),
    )


class UserApp(Base, UUIDMixin, DateMixin):
    __tablename__ = "user_app"

    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), nullable=False, index=True
    )
    content: Mapped[dict | None] = mapped_column(GzipJsonLongType)
    is_shared: Mapped[bool | None] = mapped_column(Boolean, default=False, index=True)


class UserAppShare(Base, UUIDMixin, DateMixin):
    __tablename__ = "user_app_share"

    user_app_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user_app.uuid", ondelete="CASCADE"), index=True
    )
    shared_user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), index=True
    )
    active: Mapped[str] = mapped_column(Boolean, default=True, index=True)
    permissions: Mapped[base.PermissionEnum] = mapped_column(
        Enum(base.PermissionEnum), default=base.PermissionEnum.view
    )
    viewed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class EnabledWidgetBundles(Base, UUIDMixin, DateMixin):
    __tablename__ = "enabled_widget_bundles"

    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), nullable=False, unique=True
    )

    enabled_bundles: Mapped[list[str]] = mapped_column(ScalarListType)
    disabled_widgets: Mapped[list[str]] = mapped_column(ScalarListType, nullable=True)


class CustomCopilot(Base, UUIDMixin, DateMixin):
    __tablename__ = "custom_copilot"

    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(200), nullable=False)
    headers: Mapped[dict[str, str] | None] = mapped_column(EncryptedType)
    copilots: Mapped[list[dict] | None] = mapped_column(EncryptedType)

    __table_args__ = (
        UniqueConstraint("user_uuid", "url", name="uix_user_url_custom_copilot"),
    )


class MCPServers(Base, UUIDMixin, DateMixin):
    __tablename__ = "mcp_servers"

    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), nullable=False, index=True
    )
    servers: Mapped[list[dict] | None] = mapped_column(GzipJsonType)
