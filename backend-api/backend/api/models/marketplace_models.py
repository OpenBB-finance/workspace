"""Marketplace models — Vendor catalog and vendor apps"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy_utils import UUIDType

from api import base
from api.models.model_helpers import (
    AwareDateTime,
    Base,
    DateMixin,
    GzipJsonType,
    JSONType,
    UUIDMixin,
)


class Vendor(Base, UUIDMixin, DateMixin):
    """A vendor that publishes apps in the marketplace"""

    __tablename__ = "vendor"

    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    owner_uuid: Mapped[UUID | None] = mapped_column(
        UUIDType,
        ForeignKey("user.uuid", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    documentation_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    support_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    apps: Mapped[list["VendorApp"]] = relationship(
        "VendorApp", back_populates="vendor", cascade="all, delete-orphan"
    )


class RateVendorApp(Base, UUIDMixin, DateMixin):
    """Tracks user ratings of vendor apps"""

    __tablename__ = "rate_vendor_app"

    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType,
        ForeignKey("user.uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    app_uuid: Mapped[UUID] = mapped_column(
        UUIDType,
        ForeignKey("vendor_app.uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rating: Mapped[int] = mapped_column(nullable=False)  # e.g. 1-5 stars
    review: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_uuid", "app_uuid", name="uq_user_app_rating"),
    )


class VendorApp(Base, UUIDMixin, DateMixin):
    """A vendor-hosted app listed in the marketplace"""

    __tablename__ = "vendor_app"

    vendor_uuid: Mapped[UUID] = mapped_column(
        UUIDType,
        ForeignKey("vendor.uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_uuid: Mapped[UUID | None] = mapped_column(
        UUIDType,
        ForeignKey("user.uuid", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False, default="1")
    short_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tagline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url_dark: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url_light: Mapped[str | None] = mapped_column(Text, nullable=True)
    screenshots: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    api_key_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    api_key_info_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    more_information_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    backend_base_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    apps_json_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    widgets_json_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_built_in: Mapped[bool] = mapped_column(Boolean, default=False)

    auth_type: Mapped[list[base.AuthType]] = mapped_column(
        JSONType, nullable=False, default=["api_key"]
    )
    auth_fields: Mapped[list[dict] | None] = mapped_column(
        JSONType, nullable=True, default=None
    )

    # Developer-declared MCP servers. NULL/empty means "fall back to whatever
    # the vendor's apps.json manifest declares" — see get_mcp_servers.
    mcp_servers: Mapped[list[dict] | None] = mapped_column(
        JSONType, nullable=True, default=None
    )

    status: Mapped[base.AppStatus] = mapped_column(
        Enum(base.AppStatus),
        default=base.AppStatus.submitted,
        nullable=False,
        index=True,
    )

    # Reviewer feedback when an app is rejected (kept while the dev edits/re-submits)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Manifest caching
    apps_json_cache: Mapped[list[dict] | None] = mapped_column(
        GzipJsonType, nullable=True
    )
    widgets_json_cache: Mapped[dict | None] = mapped_column(GzipJsonType, nullable=True)
    apps_json_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    widgets_json_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_fetched_at: Mapped[datetime | None] = mapped_column(
        AwareDateTime(), nullable=True
    )
    last_fetch_status: Mapped[str | None] = mapped_column(String(10), nullable=True)
    last_fetch_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_verified_at: Mapped[datetime | None] = mapped_column(
        AwareDateTime(), nullable=True
    )

    vendor: Mapped["Vendor"] = relationship(
        "Vendor",
        back_populates="apps",
        lazy="selectin",
    )

    ratings: Mapped[list[RateVendorApp]] = relationship(
        "RateVendorApp",
        primaryjoin="VendorApp.uuid == RateVendorApp.app_uuid",
        backref="vendor_app",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    parent_app_uuid: Mapped[UUID | None] = mapped_column(
        UUIDType,
        ForeignKey("vendor_app.uuid", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    parent_app: Mapped["VendorApp"] = relationship(
        "VendorApp",
        foreign_keys=[parent_app_uuid],
        remote_side="VendorApp.uuid",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint(
            "vendor_uuid", "name", "version", name="uq_vendor_app_name_version"
        ),
        Index("ix_vendor_app_vendor_status", "vendor_uuid", "status"),
    )


class UserAppSubscription(Base, UUIDMixin, DateMixin):
    """Tracks which users have subscribed to which marketplace apps"""

    __tablename__ = "user_app_subscription"

    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType,
        ForeignKey("user.uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    app_uuid: Mapped[UUID] = mapped_column(
        UUIDType,
        ForeignKey("vendor_app.uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    app: Mapped["VendorApp"] = relationship(
        "VendorApp", foreign_keys=[app_uuid], lazy="selectin"
    )

    status: Mapped[base.SubscriptionStatus] = mapped_column(
        Enum(base.SubscriptionStatus),
        default=base.SubscriptionStatus.active,
        nullable=False,
    )
    subscribed_at: Mapped[datetime | None] = mapped_column(
        AwareDateTime(), default=base.get_now
    )
    disconnected_at: Mapped[datetime | None] = mapped_column(
        AwareDateTime(), nullable=True
    )

    __table_args__ = (
        UniqueConstraint("user_uuid", "app_uuid", name="uq_user_app_subscription"),
        Index("ix_user_app_sub_user_status", "user_uuid", "status"),
    )
