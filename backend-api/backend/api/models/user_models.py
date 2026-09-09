"""User models"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy_utils import EmailType, IPAddressType, UUIDType

from api import base
from api.models.entity_models import PermissionsEntityMap
from api.models.model_helpers import (
    AwareDateTime,
    Base,
    DateMixin,
    GzipJsonType,
    GzipStringType,
    JSONType,
    PasswordType,
    ProDisplaySettingsType,
    ProEntitlementsType,
    ProZeroToHeroType,
    UUIDMixin,
)
from utilities.config import settings


class User(Base, UUIDMixin, DateMixin):
    """
    A unique user on our platform. All users are automatically give a Chargebee free account.
    Users must have unique emails and can delete their accounts
    """

    __tablename__ = "user"

    microsoft_id: Mapped[None | str] = mapped_column(String(100), default=None)
    first_name: Mapped[None | str] = mapped_column(String(100), default=None)
    last_name: Mapped[None | str] = mapped_column(String(100), default=None)
    email: Mapped[str] = mapped_column(EmailType, unique=True)
    clean_email: Mapped[str] = mapped_column(EmailType)
    username: Mapped[None | str] = mapped_column(String(50), unique=True)
    password: Mapped[str] = mapped_column(PasswordType, nullable=False)
    totp_secret: Mapped[None | str] = mapped_column(String(32), default=None)
    totp_active: Mapped[bool] = mapped_column(Boolean, default=False)
    two_factor_auth: Mapped[bool] = mapped_column(Boolean, default=False)
    temporary_password: Mapped[None | bool] = mapped_column(Boolean, default=False)
    # This is the currently active json token
    auth_token: Mapped[None | str] = mapped_column(Text)

    logins = relationship("Login", back_populates="user")

    # Pro JSON columns
    pro_entitlements = Column(ProEntitlementsType)
    pro_display_settings = Column(ProDisplaySettingsType)
    pro_zero_to_hero = Column(ProZeroToHeroType)

    # This decides what info they will need, and the columns everyone needs
    primary_usage: Mapped[None | str] = mapped_column(Text)
    wants_contacted: Mapped[None | bool] = mapped_column(Boolean, default=False)

    referred_by = Column(String(100), default=None)
    # The below tracks whether the user the referred them has been rewarded
    referred_by_sent = Column(Boolean, default=False)
    referral_code = Column(
        String(100), unique=True, nullable=False, default=base.random_string
    )
    total_referrals: Mapped[None | int] = mapped_column(Integer, default=0)

    deleted = Column(Boolean, default=False)
    confirmed = Column(Boolean, default=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    can_submit_marketplace: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    has_profile_url: Mapped[None | bool] = mapped_column(Boolean, default=False)

    # Pro fields
    permissions_uuid: Mapped[None | UUID] = mapped_column(
        ForeignKey("permissions_entity_map.uuid"), index=True
    )
    permissions: Mapped[Optional["PermissionsEntityMap"]] = relationship()
    billing_active: Mapped[None | bool] = mapped_column(Boolean, default=False)
    accepted_pro_tos: Mapped[None | bool] = mapped_column(Boolean, default=False)
    # This field indicates if they have been granted a pro trial ever, not just if they have an active trial
    pro_trial_granted: Mapped[None | bool] = mapped_column(Boolean, default=False)
    pro_trial_granted_date: Mapped[None | datetime] = mapped_column(AwareDateTime())
    pro_trial_end: Mapped[None | datetime] = mapped_column(AwareDateTime())
    pro_trial_extension: Mapped[None | bool] = mapped_column(Boolean, default=False)
    pro_trial_renewals: Mapped[None | int] = mapped_column(Integer, default=0)
    pro_start: Mapped[None | datetime] = mapped_column(AwareDateTime())
    latest_version: Mapped[None | str] = mapped_column(Text)

    # After 4 days of inactivity on the pro we send an email, we need to make sure we only send this email once
    pro_inactivity_email_sent: Mapped[None | bool] = mapped_column(
        Boolean, default=False
    )
    welcome_screen: Mapped[None | bool] = mapped_column(Boolean, default=False)
    hear_about_us: Mapped[None | str] = mapped_column(Text, default=None)

    stripe_id: Mapped[None | str] = mapped_column(String(50), index=True)

    def __str__(self) -> str:
        return str(self.email)

    def get_profile_url(self) -> None | str:
        if not self.has_profile_url:
            return None
        return settings.get_profile_url(self.uuid)


class Session(Base, UUIDMixin, DateMixin):
    "A login session for a user"

    __tablename__ = "session"

    user_uuid: Mapped[None | UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), index=True
    )
    user = relationship("User")
    api_token = Column(String(300), default=None)
    expiration_date: Mapped[None | datetime] = mapped_column(AwareDateTime())
    pro: Mapped[bool] = mapped_column(Boolean, default=False)
    source = Column(String(20), default=None)


class PersonalAccessToken(Base, UUIDMixin, DateMixin):
    "A durable user-owned API credential for scoped integrations"

    __tablename__ = "personal_access_token"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_personal_access_token_token_hash"),
        Index(
            "ix_personal_access_token_user_uuid_token_type", "user_uuid", "token_type"
        ),
    )

    user_uuid: Mapped[UUID] = mapped_column(ForeignKey("user.uuid"), index=True)
    user: Mapped["User"] = relationship()
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    token_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    token_prefix: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    revoked_at: Mapped[None | datetime] = mapped_column(AwareDateTime())
    last_used_at: Mapped[None | datetime] = mapped_column(AwareDateTime())


class Login(Base, UUIDMixin, DateMixin):
    "A record of when and where users log in"

    __tablename__ = "login"

    user_uuid: Mapped[None | UUID] = mapped_column(
        UUIDType, ForeignKey("user.uuid"), index=True
    )
    user = relationship("User", back_populates="logins")
    ip_address: Mapped[None | str] = mapped_column(IPAddressType)
    city = Column(String(100), default=None)
    region = Column(String(100), default=None)
    region_iso_code = Column(String(100), default=None)
    postal_code = Column(String(10), default=None)
    country = Column(String(100), default=None)
    country_code = Column(String(10), default=None)
    continent = Column(String(100), default=None)
    continent_code = Column(String(10), default=None)
    timezone_name = Column(String(100), default=None)
    timezone_abbrev = Column(String(10), default=None)
    source = Column(String(20), default=None)
    connection_type = Column(String(100), default=None)

    def __str__(self) -> str:
        return f"{self.user_uuid}-{self.created_date}"


class PermissionsInvite(Base, UUIDMixin, DateMixin):
    "Stores an invite to a permissions group"

    __tablename__ = "permissions_invite"

    user_uuid: Mapped[UUID] = mapped_column(ForeignKey("user.uuid"), index=True)
    user: Mapped["User"] = relationship()
    permissions_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("permissions_entity_map.uuid", ondelete="CASCADE"), index=True
    )
    permissions: Mapped["PermissionsEntityMap"] = relationship()
    revoked: Mapped[bool] = mapped_column(default=False)
    accepted: Mapped[bool] = mapped_column(default=False)
    expiration_date: Mapped[datetime] = mapped_column(AwareDateTime())
    shared_dashboards: Mapped[None | dict] = mapped_column(JSONType)
    shared_apps: Mapped[None | dict] = mapped_column(JSONType)


class UserProInvite(Base, UUIDMixin, DateMixin):
    "Invite codes for the terminal pro"

    __tablename__ = "user_pro_invite"

    inviting_user_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("user.uuid"), index=True
    )
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    email: Mapped[str] = mapped_column(EmailType)
    permissions_uuid: Mapped[None | UUID] = mapped_column(
        ForeignKey("permissions_entity_map.uuid", ondelete="SET NULL"),
        default=settings.PRO_TRIAL_MAPPING,
    )
    data = Column(JSONType)
    shared_dashboards: Mapped[None | dict] = mapped_column(JSONType)
    shared_apps: Mapped[None | dict] = mapped_column(JSONType)


class DeveloperOnboarding(Base, UUIDMixin, DateMixin):
    "Stores the user's developer onboarding data"

    __tablename__ = "developer_onboarding"

    user_uuid: Mapped[UUID] = mapped_column(ForeignKey("user.uuid"), index=True)
    primary_usage: Mapped[None | str] = mapped_column(Text)
    organization: Mapped[None | str] = mapped_column(Text)
    organization_name: Mapped[None | str] = mapped_column(Text)
    role: Mapped[None | str] = mapped_column(Text)
    programming_experience: Mapped[None | str] = mapped_column(Text)
    data_types: Mapped[None | list[str]] = mapped_column(JSONType)
    other_data_types: Mapped[None | str] = mapped_column(Text)
    skip_onboarding: Mapped[bool] = mapped_column(Boolean, default=False)


class UserPrompts(Base, UUIDMixin, DateMixin):
    "Stores the user's prompts"

    __tablename__ = "user_prompts"

    user_uuid: Mapped[UUID] = mapped_column(ForeignKey("user.uuid"), index=True)
    prompt: Mapped[dict | list[dict] | None] = mapped_column(
        GzipJsonType,
    )


class UserSkills(Base, UUIDMixin, DateMixin):
    "Stores the user's skills"

    __tablename__ = "user_skills"
    __table_args__ = (
        UniqueConstraint("user_uuid", "slug", name="uq_user_skills_user_uuid_slug"),
    )

    user_uuid: Mapped[UUID] = mapped_column(ForeignKey("user.uuid"), index=True)
    slug: Mapped[str] = mapped_column(String(50))
    description: Mapped[None | str] = mapped_column(Text)
    content: Mapped[None | str] = mapped_column(GzipStringType)


class UserRole(Base, UUIDMixin, DateMixin):
    "Stores the user's role"

    __tablename__ = "user_role"

    user_uuid: Mapped[UUID] = mapped_column(ForeignKey("user.uuid"), index=True)
    user = relationship("User")
    role_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("role.uuid", ondelete="CASCADE"), index=True
    )
    role = relationship("Role")
