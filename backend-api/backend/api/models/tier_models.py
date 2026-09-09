"""Tier models."""

from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy_utils import UUIDType

from api.models.model_helpers import Base, DateMixin, JSONType, UUIDMixin

PRO_TIER_ID = 1
TERMINAL_TIER_ID = 2

DATA_BUNDLE_DEFAULT = "Default"
DATA_BUNDLE_EQUITY_RESEARCH = "Equity Research"
DATA_BUNDLE_PRO_TRIAL = "Pro Trial"


class Tier(Base, DateMixin):
    """Tiers."""

    __tablename__ = "tier"

    id = Column(Integer, primary_key=True)
    name = Column(String(20), nullable=False, unique=True)
    has_trial = Column(Boolean, nullable=False, default=False)
    trial_duration_days = Column(Integer, nullable=True)


class TierDefaults(Base, UUIDMixin, DateMixin):
    """Tier defaults for features."""

    __tablename__ = "default_tier"

    tier_id = Column(Integer, ForeignKey("tier.id"), nullable=False)
    tier = relationship("Tier")

    name = Column(String(50), nullable=False, unique=True)
    number_copilot_calls_day = Column(Integer)
    total_file_upload_size_gb = Column(Integer)
    share_widgets = Column(String(20))
    data_bundle = Column(Boolean)
    bring_your_own_data = Column(Boolean)
    bring_your_own_copilot = Column(Boolean)
    admin_access = Column(Boolean)
    support = Column(Boolean)
    excel_add_in = Column(Boolean)
    data_add_ons_redistribution = Column(Boolean)

    __table_args__ = (
        CheckConstraint(
            share_widgets.in_(["public", "private"]),
            name="check_share_widgets_values_tier_defaults",
        ),
    )


class EntityEntitlement(Base, UUIDMixin, DateMixin):
    """Entitlements for entities."""

    __tablename__ = "entity_entitlement"

    entity_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("entity.uuid", ondelete="CASCADE"), index=True, unique=True
    )
    entity = relationship("Entity")

    tier_id = Column(Integer, ForeignKey("tier.id"), nullable=False)
    tier = relationship("Tier")

    number_copilot_calls_day = Column(Integer)
    total_file_upload_size_gb = Column(Integer)
    share_widgets = Column(String(20))
    data_bundle = Column(Boolean)
    bring_your_own_data = Column(Boolean)
    bring_your_own_copilot = Column(Boolean)
    admin_access = Column(Boolean)
    support = Column(Boolean)
    excel_add_in = Column(Boolean)
    data_add_ons_redistribution = Column(Boolean)
    allow_custom_backends: Mapped[bool | None] = mapped_column(Boolean, default=True)

    data_bundle_uuid = Column(
        UUIDType, ForeignKey("data_bundle.uuid"), nullable=True, default=None
    )
    data_bundle = relationship("DataBundle")

    __table_args__ = (
        CheckConstraint(
            share_widgets.in_(["public", "private"]),
            name="check_share_widgets_values_entity_entitlements",
        ),
    )


class Entitlement(Base, UUIDMixin, DateMixin):
    """Entitlements for users."""

    __tablename__ = "entitlement"

    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), index=True, unique=True
    )
    user = relationship("User")

    tier_id = Column(Integer, ForeignKey("tier.id"), nullable=False)
    tier = relationship("Tier")

    number_copilot_calls_day = Column(Integer)
    total_file_upload_size_gb = Column(Integer)
    share_widgets = Column(String(20))
    bring_your_own_data = Column(Boolean)
    bring_your_own_copilot = Column(Boolean)
    admin_access = Column(Boolean)
    support = Column(Boolean)
    excel_add_in = Column(Boolean)
    data_add_ons_redistribution = Column(Boolean)
    allow_custom_backends: Mapped[bool | None] = mapped_column(Boolean, default=True)

    data_bundle_uuid = Column(
        UUIDType, ForeignKey("data_bundle.uuid"), nullable=True, default=None
    )
    data_bundle = relationship("DataBundle")

    __table_args__ = (
        CheckConstraint(
            share_widgets.in_(["public", "private"]),
            name="check_share_widgets_values_entitlements",
        ),
    )


class DataBundle(Base, UUIDMixin, DateMixin):
    """Bundles for users."""

    __tablename__ = "data_bundle"

    bundle_name = Column(String(50), nullable=False, unique=True)
    except_widgets: Mapped[list[str]] = mapped_column(JSONType)
    except_dashboard_templates: Mapped[list[str]] = mapped_column(JSONType)
    except_team_collaboration: Mapped[list[str] | None] = mapped_column(JSONType)
    excel_add_in = Column(Boolean, nullable=False, default=False)
    data_export = Column(Boolean, nullable=False, default=False)
    providers: Mapped[list[str] | None] = mapped_column(JSONType)
    dashboards_at_launch: Mapped[list[str] | None] = mapped_column(JSONType)
    my_dashboards: Mapped[list[str] | None] = mapped_column(JSONType)
    invite_your_colleagues = Column(Boolean, nullable=False, default=False)
    number_copilot_calls_day = Column(Integer)
    total_file_upload_size_gb = Column(Integer)
    allow_custom_backends: Mapped[bool | None] = mapped_column(Boolean, default=True)


class EntitlementUsage(Base, UUIDMixin, DateMixin):
    """Entitlement usage for users."""

    __tablename__ = "entitlement_usage"

    user_uuid: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), index=True, unique=True
    )
    user = relationship("User")

    number_copilot_calls_day_count = Column(Integer, nullable=False, default=0)
    total_file_upload_size_gb_count = Column(Float, nullable=False, default=0)
