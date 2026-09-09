"""Pydantic schemas for the Marketplace feature"""

from datetime import datetime
from typing import Annotated, Literal, TypeAlias
from urllib.parse import urlparse
from uuid import UUID

from pydantic import (
    AliasChoices,
    AliasPath,
    BeforeValidator,
    EmailStr,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)

from api.base import AppStatus, AuthType, SubscriptionStatus
from api.schemas import (
    AppRating,
    AppWidgetMetadata,
    NoneToStr,
    PromptsCount,
    VenderAppPrompts,
    get_camel_config,
    get_widget_metadata,
)
from utilities.config import BaseModel

# --- Public response (must match frontend ListedApp interface exactly) ---


def get_app_images(apps_json_cache: list | None) -> dict[str, str | None] | None:
    """Extract thumbnail URLs from cached apps.json."""
    if not apps_json_cache or not isinstance(apps_json_cache, list):
        return {}

    first_app = next((app for app in apps_json_cache if isinstance(app, dict)), None)

    if not first_app:
        return {}

    return {
        "img": first_app.get("img"),
        "img_dark": first_app.get("img_dark"),
        "img_light": first_app.get("img_light"),
    }


def _is_development_status(v) -> bool:
    """Named replacement for an inline lambda — Cython can't serialise lambdas
    in Annotated[...] forward refs, so Pydantic later trips on `<lambda>`."""
    return v == AppStatus.development


def get_mcp_servers(apps_json_cache: list | dict | None) -> list:
    """Extract MCP server info from cached apps.json. Returns a list (the
    `mcp_servers` field is a list) — empty when there's no usable cache."""
    if not apps_json_cache or not isinstance(apps_json_cache, list):
        return []

    first_app = next((app for app in apps_json_cache if isinstance(app, dict)), None)

    if not first_app:
        return []

    return first_app.get("mcp_servers", first_app.get("mcpServers", []))


class AppThumbnails(BaseModel):
    img: NoneToStr = Field("")
    img_dark: NoneToStr = Field("")
    img_light: NoneToStr = Field("")


def _coerce_mcp_auth_type(v) -> str | None:
    """apps.json is vendor-controlled and the listing endpoint validates every
    app in one pass, so an unrecognised value falls back to the default OAuth
    flow rather than raising and taking down the whole marketplace response.

    The `isinstance` guard is load-bearing: set membership hashes the operand,
    so a vendor writing `"authType": []` would raise TypeError without it.
    """
    return v if isinstance(v, str) and v in {"oauth", "token"} else None


class AppMCPServer(BaseModel):
    # camelCase config so `auth_type` is read from and emitted as `authType`,
    # matching the apps.json reference and the frontend `ListedAppMcpServer` type.
    model_config = get_camel_config()

    name: str
    description: str | None = None
    url: str
    # Absent keeps the default OAuth flow; `token` makes the frontend prompt for
    # a static bearer token instead of running the OAuth popup on a 401.
    auth_type: Annotated[
        Literal["oauth", "token"] | None, BeforeValidator(_coerce_mcp_auth_type)
    ] = None


def _derive_mcp_servers(apps_json_cache: list | dict | None) -> list[AppMCPServer]:
    """Build servers from the vendor's cached apps.json.

    Vendors control the manifest, so a malformed entry must degrade to "no MCP
    servers" rather than raise — the listing endpoint validates every app in one
    pass and a raise here would 500 the whole catalog.
    """
    servers = []
    for raw in get_mcp_servers(apps_json_cache):
        if not isinstance(raw, dict):
            continue
        try:
            servers.append(AppMCPServer.model_validate(raw))
        except ValidationError:
            continue
    return servers


class MCPServersMixin(BaseModel):
    """Shared `mcp_servers` field and stored-vs-manifest fallback.

    `MarketplaceAppResponse` and `AdminAppResponse` are separate hierarchies
    with different alias configs, but both must resolve MCP servers the same
    way — a reviewer has to judge the listing users will actually get. Keeping
    the field and the validator here stops the two from drifting apart.

    `apps_json_cache` lives here too because the fallback reads it; it stays
    excluded from the response, as it is internal-only.
    """

    mcp_servers: list[AppMCPServer] | None = Field(
        default_factory=list, validation_alias="mcp_servers"
    )
    apps_json_cache: None | list | dict = Field(
        None, exclude=True, validation_alias="apps_json_cache"
    )

    @model_validator(mode="after")
    def populate_mcp_servers(self):
        """Stored config wins; otherwise derive from the vendor's apps.json."""
        if not self.mcp_servers:
            self.mcp_servers = _derive_mcp_servers(self.apps_json_cache)
        return self


class AppMCPServerInput(BaseModel):
    """Request-side counterpart of `AppMCPServer`.

    Deliberately not reusing `AppMCPServer`: its `BeforeValidator` silently
    downgrades an unrecognised `auth_type` to `None`, which is right for a
    vendor-controlled manifest we must not 500 on, and wrong for a request
    body where a typo should surface as a 422.
    """

    model_config = get_camel_config()

    # Bounded because these persist verbatim into the `mcp_servers` JSON column
    # and are then re-read and re-serialized on every public catalog request —
    # one oversized row would be paid for by every listing call.
    name: str = Field(max_length=200)
    description: str | None = Field(None, max_length=1000)
    url: str = Field(max_length=2048)
    auth_type: Literal["oauth", "token"] | None = None

    @field_validator("name", "url")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("must be non-empty")
        return v

    @field_validator("url")
    @classmethod
    def _http_url(cls, v: str) -> str:
        """Only `http`/`https` reach the frontend's MCP client.

        Kept as a plain `str` rather than `AnyHttpUrl` on purpose: the value is
        stored verbatim in a JSON column via `model_dump()`, and a pydantic
        `Url` is neither JSON-serializable nor byte-identical to what the
        developer typed (it appends a trailing slash).
        """
        parsed = urlparse(v.strip())
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("must be an http:// or https:// URL")
        return v


AppImages: TypeAlias = Annotated[AppThumbnails | None, BeforeValidator(get_app_images)]


class CreateRateVendorApp(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    review: str | None = Field(None, validation_alias="feedback")


class AuthField(BaseModel):
    """Vendor-defined auth field for `custom` auth_type apps.

    Sent as an HTTP header on listed-app backend requests, with the user-entered
    value optionally prefixed (e.g. `Bearer `).
    """

    model_config = get_camel_config()

    id: str
    label: str
    key: str
    prefix: str | None = None

    @field_validator("id", "label", "key")
    def _non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("must be non-empty")
        return v


class MarketplaceAppResponse(MCPServersMixin):
    """Public marketplace app — camelCase keys to match frontend ListedApp type."""

    model_config = get_camel_config(from_attributes=True)

    id: UUID = Field(..., validation_alias="uuid")
    parent_app_uuid: UUID | None = Field(None, validation_alias="parent_app_uuid")
    vendor_name: str = Field(..., validation_alias=AliasPath("vendor", "name"))
    app_name: str = Field(..., validation_alias="name")
    category: str | None = None
    tagline: str | None = None
    description: str = Field("", validation_alias="short_description")
    backend_url: NoneToStr = Field("", validation_alias="backend_base_url")
    thumbnail: NoneToStr = Field("", validation_alias="thumbnail_url")
    thumbnail_dark: str | None = Field(None, validation_alias="thumbnail_url_dark")
    thumbnail_light: str | None = Field(None, validation_alias="thumbnail_url_light")
    app_images: AppImages = Field(None, validation_alias="apps_json_cache")
    media: list[str] = Field(
        default_factory=list,
        validation_alias="screenshots",
        description="Image/video URLs shown in the app carousel.",
    )
    api_key_url: str | None = None
    api_key_info_url: str | None = None
    vendor_description: str | None = Field(
        None, validation_alias=AliasPath("vendor", "description")
    )
    vendor_website_url: str | None = Field(
        None, validation_alias=AliasPath("vendor", "website_url")
    )
    vendor_thumbnail_url: str | None = Field(
        None, validation_alias=AliasPath("vendor", "thumbnail_url")
    )
    contact_email: str | None = Field(
        None, validation_alias=AliasPath("vendor", "support_email")
    )
    documentation_url: str | None = Field(
        None, validation_alias=AliasPath("vendor", "documentation_url")
    )

    widgets: list[AppWidgetMetadata] | None = Field(default_factory=list)
    total_widgets: int | None = Field(0)
    prompts: VenderAppPrompts = Field(
        default_factory=list, validation_alias="apps_json_cache"
    )
    # `mcp_servers` is inherited from MCPServersMixin, which also applies the
    # apps.json fallback whenever the stored column is empty.
    average_rating: AppRating = Field(None, validation_alias="ratings")

    version: str = "1"
    created_date: datetime | None = None
    updated_date: datetime | None = None
    # Deprecated alias for `media` — still emitted so older frontend clients
    # that read `screenshots` keep working. Remove after all consumers have
    # switched to `media`.
    screenshots: list[str] | None = Field(default_factory=list)
    is_built_in: bool = False
    is_development: Annotated[
        bool,
        BeforeValidator(_is_development_status),
    ] = Field(False, validation_alias="status")
    auth_type: list[AuthType] | None = Field(default_factory=lambda: ["api_key"])
    auth_fields: list[AuthField] | None = None

    # Exclude cached manifest data from the public response — it's only for internal use
    # (`apps_json_cache` is inherited from MCPServersMixin, already excluded).
    widgets_json_cache: None | dict = Field(
        None, exclude=True, validation_alias="widgets_json_cache"
    )

    @model_validator(mode="after")
    def populate_widgets(self) -> "MarketplaceAppResponse":
        widget_metadata = get_widget_metadata(
            self.apps_json_cache, self.widgets_json_cache
        )
        self.widgets = widget_metadata.get("widgets", []) if widget_metadata else []
        self.total_widgets = (
            widget_metadata.get("totalWidgets", 0) if widget_metadata else 0
        )
        return self


class DeveloperAppResponse(MarketplaceAppResponse):
    """An app as seen by its owning developer. Extends the public catalog shape
    with the review state the public response intentionally hides, so the
    submission UI can show pending / rejected (+ reason) / broken-manifest."""

    status: AppStatus
    rejection_reason: str | None = None
    last_fetch_status: str | None = None
    last_fetch_error: str | None = None
    # The raw column, before `populate_mcp_servers` applies the manifest
    # fallback. The submission dialog needs the distinction: seeding its form
    # from the merged `mcp_servers` would silently convert a manifest-derived
    # server into stored config on the next PATCH, freezing it against
    # later apps.json updates.
    stored_mcp_servers: list[AppMCPServer] | None = Field(
        None, validation_alias="mcp_servers"
    )


# --- Admin request schemas ---


def _validate_auth_type(v: list[str] | str | None) -> list[str] | None:
    if v is None:
        return v
    if isinstance(v, str):
        # Allow comma-separated string for convenience
        v = [item.strip() for item in v.split(",") if item.strip()]
    if not isinstance(v, list) or not all(isinstance(item, str) for item in v):
        raise ValueError("auth_type must be a string or list of strings")
    valid_options = {"api_key", "none", "custom"}
    if not all(item in valid_options for item in v):
        raise ValueError(f"auth_type items must be one of `{valid_options}`")
    if len(v) != len(set(v)):
        raise ValueError("auth_type items must be unique")
    if {"api_key", "custom"}.issubset(v):
        raise ValueError("auth_type cannot combine `api_key` and `custom`")
    return v


def _validate_auth_fields(
    auth_type: list[str] | None, auth_fields: list[AuthField] | None
) -> list[AuthField] | None:
    has_custom = bool(auth_type) and "custom" in auth_type
    if not has_custom:
        # auth_fields only meaningful for `custom` mode — drop otherwise
        return None
    if not auth_fields:
        raise ValueError("auth_fields is required when auth_type includes `custom`")
    ids = [f.id for f in auth_fields]
    if len(ids) != len(set(ids)):
        raise ValueError("auth_fields ids must be unique")
    keys = [f.key for f in auth_fields]
    if len(keys) != len(set(keys)):
        raise ValueError("auth_fields keys must be unique")
    return auth_fields


class CreateAppRequest(BaseModel):
    """App-only fields — used when adding an app to an existing vendor."""

    app_name: str = Field(
        ...,
        description="App name shown in the marketplace and inside the Terminal. "
        "Overrides whatever `name` the vendor ships in their apps.json.",
    )
    version: str = "1"
    short_description: str = Field(
        ...,
        description="Short description shown on the marketplace tile and app detail page. "
        "Overrides whatever `description` the vendor ships in their apps.json.",
    )
    category: str | None = Field(
        None,
        description="Optional category for the app (e.g. 'Flow & Options', 'Data & Analytics', etc.).",
    )
    tagline: str | None = Field(
        None, description="Optional tagline shown below the app name in the marketplace"
    )
    thumbnail_url: str | None = Field(
        None,
        description="Default app thumbnail shown in the marketplace and inside the Terminal. "
        "Overrides `img` in the vendor's apps.json. URL or base64 data string.",
    )
    thumbnail_url_dark: str | None = Field(
        None,
        description="Optional dark-mode variant of the app thumbnail. Overrides `img_dark` "
        "in the vendor's apps.json. URL or base64 data string. Falls back to `thumbnail_url` "
        "if not set.",
    )
    thumbnail_url_light: str | None = Field(
        None,
        description="Optional light-mode variant of the app thumbnail. Overrides `img_light` "
        "in the vendor's apps.json. URL or base64 data string. Falls back to `thumbnail_url` "
        "if not set.",
    )
    media: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("media", "screenshots"),
        description=(
            "Image and/or video URLs shown in the app detail carousel. Frontend "
            "infers type from the file extension (.png/.jpg/.webp → image, "
            ".mp4/.webm/.mov → video). Accepted under the legacy name "
            "`screenshots` as well for backward compatibility."
        ),
    )
    api_key_url: str | None = Field(
        None,
        description=(
            "Optional endpoint we call to verify the API key a user enters on the "
            "'Add API key' screen. If set, the Terminal POSTs the user-provided key to "
            "this URL and expects a success/error response — this lets you fully "
            "control the verification flow and return a custom error message that the "
            "user sees in the modal.\n\n"
            "If NOT set, the Terminal verifies the key by calling the first widget in "
            "your widgets.json. In that case, make sure that widget returns a clear, "
            "user-facing error message when the key is invalid — it's what the user "
            "will see."
        ),
    )
    api_key_info_url: str | None = Field(
        None,
        description="Optional URL where users can get instructions on how to obtain an API key.",
    )
    more_information_url: str | None = None
    backend_base_url: str = ""
    apps_json_url: str | None = None
    widgets_json_url: str | None = None
    is_built_in: bool | None = None
    auth_type: list[str] | None = Field(default_factory=lambda: ["api_key"])
    auth_fields: list[AuthField] | None = None
    # `max_length` must sit inside the Annotated list, not on the outer Field:
    # on a `list[...] | None` union pydantic silently drops the constraint.
    mcp_servers: Annotated[list[AppMCPServerInput], Field(max_length=20)] | None = (
        Field(
            None,
            description=(
                "MCP servers exposed by this app. Omit to derive them from the "
                "`mcp_servers` block of the vendor's apps.json; send an explicit "
                "list to override the manifest, or `[]` to drop the override and "
                "fall back to the manifest again."
            ),
        )
    )
    owner_email: str | None = None

    @field_validator("auth_type", mode="before")
    def validate_auth_type(cls, v: list[str] | str | None) -> list[str] | None:
        return _validate_auth_type(v)

    @model_validator(mode="after")
    def validate_auth_fields(self) -> "CreateAppRequest":
        self.auth_fields = _validate_auth_fields(self.auth_type, self.auth_fields)
        return self


class CreateVendorAppRequest(CreateAppRequest):
    # Vendor fields (upsert by vendor_name)
    vendor_name: str
    vendor_description: str | None = None
    vendor_website_url: str | None = None
    documentation_url: str | None = None
    vendor_thumbnail_url: str | None = None
    contact_email: str | None = None


class UpdateVendorAppRequest(CreateVendorAppRequest):
    # Vendor fields (optional updates)
    vendor_name: str | None = None

    # App fields
    app_name: str | None = None
    version: str | None = None
    short_description: str | None = None
    media: list[str] | None = Field(
        None, validation_alias=AliasChoices("media", "screenshots")
    )
    backend_base_url: str | None = None
    is_built_in: bool | None = None
    auth_type: list[str] | None = None


# --- Admin response schemas ---


class ManifestSummary(BaseModel):
    model_config = {"from_attributes": True, "populate_by_name": True}
    widgets_count: int = Field(0)
    prompts_count: PromptsCount = Field(0, validation_alias="apps_json_cache")

    # Exclude cached manifest data from the public response — it's only for internal use
    widgets_json_cache: None | dict = Field(
        None, exclude=True, validation_alias="widgets_json_cache"
    )
    apps_json_cache: None | list | dict = Field(
        None, exclude=True, validation_alias="apps_json_cache"
    )

    @model_validator(mode="after")
    def populate_widgets(self) -> "ManifestSummary":
        widget_metadata = get_widget_metadata(
            self.apps_json_cache, self.widgets_json_cache
        )
        self.widgets_count = (
            widget_metadata.get("totalWidgets", 0) if widget_metadata else 0
        )
        return self


class VerificationResult(BaseModel):
    status: Literal["ok", "error"]
    errors: list[str] = []
    warnings: list[str] = []
    manifest_summary: ManifestSummary | None = None


class CreateVendorAppResponse(BaseModel):
    app_id: UUID
    vendor_id: UUID
    version: str = "1"
    status: AppStatus
    verification: VerificationResult
    message: str | None = None


class AppStatusResponse(BaseModel):
    app_id: UUID
    status: AppStatus


# --- Subscription schemas ---


class SubscriptionResponse(BaseModel):
    """Basic subscription info for a single app."""

    model_config = get_camel_config(from_attributes=True)

    app_id: UUID = Field(..., validation_alias="app_uuid")
    status: SubscriptionStatus
    subscribed_at: datetime | None = None


class SubscriptionsResponse(SubscriptionResponse):
    """Subscription info including related app details for a single app."""

    model_config = get_camel_config(from_attributes=True)

    name: str = Field(..., validation_alias=AliasPath("app", "name"))
    parent_app_uuid: UUID | None = Field(
        None, validation_alias=AliasPath("app", "parent_app_uuid")
    )
    latest_version: str | None = Field(
        None, validation_alias=AliasPath("app", "parent_app", "version")
    )
    version: str | None = Field(None, validation_alias=AliasPath("app", "version"))


def get_subscribed_app_ids(subscriptions: list) -> set[UUID]:
    """Helper to extract set of app UUIDs from a list of SubscriptionResponse objects."""
    app_ids = set()
    for sub in subscriptions:
        app_ids.add(sub.app_uuid)
        if sub.app and sub.app.parent_app_uuid:
            app_ids.add(sub.app.parent_app_uuid)
    return app_ids


class SubscriptionListResponse(BaseModel):
    model_config = get_camel_config(from_attributes=True)

    subscriptions: list[SubscriptionsResponse] = []
    subscribed_app_ids: Annotated[
        set[UUID], BeforeValidator(get_subscribed_app_ids)
    ] = Field(default_factory=set, validation_alias="subscriptions")


class AdminSubscriptionStats(BaseModel):
    app_id: UUID
    app_name: str
    active_count: int | None = 0
    total_count: int | None = 0


# --- Admin response schemas ---


class AdminAppResponse(MCPServersMixin):
    """Full app details for admin view."""

    model_config = {"from_attributes": True, "populate_by_name": True}

    id: UUID = Field(..., validation_alias="uuid")
    vendor_id: UUID = Field(..., validation_alias="vendor_uuid")
    vendor_name: str = Field(..., validation_alias=AliasPath("vendor", "name"))
    name: str
    version: str = "1"
    short_description: str | None = None
    category: str | None = None
    tagline: str | None = None
    thumbnail_url: str | None = None
    thumbnail_url_dark: str | None = None
    thumbnail_url_light: str | None = None
    media: list[str] = Field(default_factory=list, validation_alias="screenshots")
    # Deprecated alias for `media` — still emitted for backward compat.
    screenshots: list[str] = []
    api_key_url: str | None = None
    api_key_info_url: str | None = None
    more_information_url: str | None = None
    backend_base_url: str | None = None
    apps_json_url: str | None = None
    widgets_json_url: str | None = None
    is_built_in: bool = False
    auth_type: list[AuthType] | None = None
    auth_fields: list[AuthField] | None = None
    status: str
    created_date: datetime | None = None
    updated_date: datetime | None = None
    last_fetched_at: datetime | None = None
    last_fetch_status: str | None = None
    last_fetch_error: str | None = None
    last_verified_at: datetime | None = None
    rejection_reason: str | None = None
    widgets_count: int | None = Field(0)
    prompts_count: PromptsCount = Field(0, validation_alias="apps_json_cache")
    verification: VerificationResult | None = None

    # Exclude cached manifest data from the public response — it's only for internal use
    # (`apps_json_cache` is inherited from MCPServersMixin, already excluded).
    widgets_json_cache: None | dict = Field(
        None, exclude=True, validation_alias="widgets_json_cache"
    )

    def set_verification(self, verification: VerificationResult) -> None:
        """Set the verification result on this response."""
        self.verification = verification

    @model_validator(mode="after")
    def populate_widgets(self) -> "ManifestSummary":
        widget_metadata = get_widget_metadata(
            self.apps_json_cache, self.widgets_json_cache
        )
        self.widgets_count = (
            widget_metadata.get("totalWidgets", 0) if widget_metadata else 0
        )
        return self


# --- Submitter whitelist schemas ---


class WhitelistEntryResponse(BaseModel):
    """A user allowed to submit marketplace apps."""

    model_config = {"from_attributes": True}

    uuid: UUID
    email: str
    created_date: datetime | None = None


class WhitelistCreateRequest(BaseModel):
    """Whitelist a developer by their OpenBB account email."""

    # 255 matches the EmailType(length=255) column the lookup runs against.
    email: EmailStr = Field(max_length=255)
