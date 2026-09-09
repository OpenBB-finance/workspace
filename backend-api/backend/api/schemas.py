import json
import re
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Annotated, Any, Literal, TypeAlias, TypeVar
from uuid import UUID, uuid4

import requests
from fastapi.responses import JSONResponse
from pydantic import (
    AliasGenerator,
    AliasPath,
    ConfigDict,
    EmailStr,
    Field,
    HttpUrl,
    alias_generators,
    field_validator,
    model_validator,
)
from pydantic.functional_validators import AfterValidator, BeforeValidator
from pydantic.networks import IPvAnyAddress

from api import base
from api.events.types import RoleAuditAction, RoleResourceType
from utilities.config import BaseModel, settings

if TYPE_CHECKING:
    from api.models.tauri_models import CopilotChat, StoredFile


StoredFileT = TypeVar("StoredFileT", bound="StoredFile")

main_config = ConfigDict(extra="forbid", from_attributes=True)
source_type = Literal["terminal", "hub", "sdk", "pro", "oauth-pro", "oauth-hub", "excel"]
MetaDataWidgetType = Literal[
    "iframe",
    "rss_viewer",
    "rich_note",
    "copilot_table",
    "youtube",
    "widget_studio",
    "chart",
    "html",
    "ag_chart_from_table",
]

permissions_type = Literal["view", "comment"]  # "edit"
UserSourceType = Literal["user", "invite", "takeover"]
ExtensionType = Literal[
    "csv",
    "json",
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "xls",
    "xlsx",
    "txt",
    "zip",
    "md",
    "docx",
    "doc",
    "html",
]
ProgrammingExperience = Literal["no-experience", "basic", "intermediate-advanced"]
DashboardTypes = Literal[
    "charting",
    "news",
    "countryEconomics",
    "calendars",
    "equityAnalyst",
    "equity",
    "comparison",
    "etfTemplate",
    "onboarding",
    "earnings",
]
WidgetTypes = Literal[
    "etf_holdings",
    "economic_calendar",
    "earnings_trends",
    "revenue_trends",
    "etf_classification",
    "etf_characteristics",
]
AccessType = Literal["no-access", "access", "full-access"]
BundleNames = Literal["Default", "Equity Research", "Pro Trial", "On-Premise"]


def is_bad_word(word: str) -> bool:
    with open("utilities/bad_words.txt", encoding="utf-8") as f:
        for line in f:
            if line.replace("\n", "") == word:
                return True
    return False


def username_check(username: str) -> None | str:
    pattern = r"^\w{4,50}$"
    if not re.match(pattern, username, re.IGNORECASE):
        return (
            "Please make sure your username is letters, numbers, and underscores, and is between 4 and 50 characters long"  # noqa: E501
        )

    if is_bad_word(username.lower()):
        return "This username violates OpenBB Guidelines"
    return None


def check_email(v: str) -> str:
    # Chargebee has a 70 character limit on emails
    if len(v) > 70:  # noqa: PLR2004
        raise ValueError("Email must be 70 characters or less")
    if not base.check_email(v):
        raise ValueError("Invalid email")
    return v


SharesPermissions = dict[Annotated[str, AfterValidator(check_email)], permissions_type]


VALID_REGEX = r"^(?=\S*[a-z])(?=\S*[A-Z])(?=\S*\d)(?=\S*[^\w\s])\S{8,}$"
SKILL_SLUG_REGEX = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def check_password(v: str) -> str:
    if isinstance(v, bytes):
        v = v.decode("utf-8")

    if isinstance(v, str) and not re.match(VALID_REGEX, v):
        raise ValueError(
            "Password must be at least 8 characters long, contain at least one "
            "uppercase letter, one lowercase letter, one number, and one special character. "
            "Spaces are not allowed."
        )
    return v


def check_username(v: None | str) -> None | str:
    if v:
        result = username_check(v)
        if result:
            raise ValueError(result)
    return v


def check_email_or_username(v: str) -> str:
    if not base.check_email(v) and username_check(v):
        raise ValueError("Invalid email or username")
    return v


def check_totp_token(v: None | int) -> None | int:
    # The totp can be less than 6 because
    if v and len(str(v)) > 6:  # noqa: PLR2004
        raise ValueError("Invalid TOTP token")
    return v


def check_name(v: None | str) -> None | str:
    if v:
        for char in settings.UNUSABLE_JSON_CHARACTERS:
            if char in v:
                raise ValueError(f"Script name cannot contain {char}")
    return v


def check_system(v: None | str) -> None | str:
    if v:
        for system in v.split(","):
            if system not in base.get_systems():
                raise ValueError(f"Invalid system: {system}")
    return v


def check_version(v: None | str) -> None | str:
    if v and not re.match(r"^\d+\.\d+\.\d+$", v):
        raise ValueError(f"Invalid version: {v}")
    return v


def datetime_to_string(v: str | datetime | None):
    if isinstance(v, datetime):
        return v.isoformat()
    return v


def blank_to_none(v: None | str) -> None | str:
    if not v:
        return None
    return v


def get_camel_config(**config: ConfigDict) -> ConfigDict:
    return ConfigDict(
        **config,
        populate_by_name=True,
        alias_generator=AliasGenerator(alias=alias_generators.to_camel),
    )


def get_widget_metadata(
    apps_json_cache: list[dict] | None,
    widgets_json_cache: dict[str, dict] | None = None,
) -> dict[Literal["widgets", "totalWidgets"], Any]:
    """Extract app widget metadata and counts from cached manifests."""
    if (
        not apps_json_cache
        or not isinstance(apps_json_cache, list)
        or not widgets_json_cache
        or not isinstance(widgets_json_cache, dict)
    ):
        return {"widgets": [], "totalWidgets": 0}

    widgetCounts = {}
    for app in apps_json_cache:
        for tab in app.get("tabs", {}).values():
            for layout in tab.get("layout", []):
                widgetId = layout.get("i")
                if widgetId:
                    widgetCounts[widgetId] = widgetCounts.get(widgetId, 0) + 1

    widgets = []
    if widgets_json_cache and isinstance(widgets_json_cache, dict):
        for widgetId, widget in widgets_json_cache.items():
            if widgetId in widgetCounts and widget.get("name"):
                widgets.append(
                    AppWidgetMetadata(
                        id=widgetId,
                        name=widget.get("name"),
                        description=widget.get("description"),
                        count=widgetCounts[widgetId],
                    )
                )

    totalWidgets = sum(widgetCounts.values())
    return {"widgets": widgets, "totalWidgets": totalWidgets}


def get_prompts(apps_json_cache: list | None) -> list[str]:
    """Extract prompts from cached apps.json."""
    if not apps_json_cache or not isinstance(apps_json_cache, list):
        return []

    prompts = []
    for app in apps_json_cache:
        if isinstance(app, dict) and "prompts" in app:
            prompts.extend(app["prompts"])
    return prompts


def app_rating_to_average(ratings: list | None) -> float | None:
    """Calculate average rating from a list of ratings."""
    if not ratings:
        return None

    if (total_ratings := len(ratings)) == 0:
        return None

    rating_sum = sum(r.rating for r in ratings)
    average_rating = rating_sum / total_ratings
    return round(average_rating, 2)


# Named replacements for inline lambdas inside Annotated[...] — Cython
# can't serialise lambdas in those forward refs, so Pydantic later trips
# on `<lambda>`. See marketplace_schemas._is_development_status for the
# original example of this workaround.
def _prompts_count(v: list | None) -> int:
    return len(get_prompts(v))


def _none_to_empty_str(v: str | None) -> str:
    return v or ""


def _is_development_status(v) -> bool:
    return v == base.AppStatus.development


def _is_not_none(v) -> bool:
    return v is not None


VenderAppPrompts = Annotated[list[str], BeforeValidator(get_prompts)]
PromptsCount = Annotated[int, BeforeValidator(_prompts_count)]
AppRating: TypeAlias = Annotated[float | None, BeforeValidator(app_rating_to_average)]
NoneToStr: TypeAlias = Annotated[str | None, BeforeValidator(_none_to_empty_str)]


class ValidateReturn(BaseModel):
    authenticated: bool


class SuccessReturn(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    success: bool

    @classmethod
    def success_instance(cls):
        return cls(success=True)

    @classmethod
    def failure_instance(cls):
        return cls(success=False)

    @classmethod
    def from_bool(cls, value: bool):
        return cls(success=value)


class ResetPasswordReturn(SuccessReturn):
    temporary_password: str


class DashboardShareReturn(BaseModel):
    created_date: None | datetime
    permissions: None | base.PermissionEnum
    first_name: None | str
    last_name: None | str
    is_invite: bool


class TotpGenerateReturn(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    uri: str
    secret: str


class ContentReturn(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    content: str


class MessageReturn(SuccessReturn, extra="ignore"):  # type: ignore[call-arg]
    message: str


class ProfileUrlReturn(MessageReturn, extra="ignore"):  # type: ignore[call-arg]
    profile_url: None | str = None


class UrlReturn(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    url: None | str = None


class PendingFileReturn(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    stored_file_uuid: None | UUID = None
    extension: None | str = None
    original_file_name: None | str = None
    url: None | str = None
    failed: bool = False


class PreSignedUrlReturn(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    pre_signed_url: str
    stored_file_uuid: UUID = Field(serialization_alias="stored_file_uuid", alias="uuid")
    original_file_name: str


class CodeReturn(BaseModel):
    code: str
    used: bool


class RemainingCodes(BaseModel):
    remaining: None | int


class Token(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    username: None | str = None
    email: str
    primary_usage: str
    access_token: str
    token_type: str
    profile_url: None | str = None
    uuid: UUID


class FullToken(Token, extra="ignore"):  # type: ignore[call-arg]
    information_complete: Literal["bot", "complete", "incomplete"]
    has_pro: bool


class TokenData(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    email: None | EmailStr = None


class LogCreate(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    request: str
    error: str
    status_code: int
    method: str


class Email(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    message: str


class TokenGet(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    token: str


class TokenReturn(TokenGet, extra="ignore"):  # type: ignore[call-arg]
    expiration: datetime


class Expiration(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    days: int


class HubspotId(BaseModel):
    id: int


class Type(BaseModel):
    associationCategory: str
    associationTypeId: int


class Association(BaseModel):
    to: HubspotId
    types: list[Type]

    @classmethod
    def default(cls, hubspot_id: int):
        the_type = Type(associationCategory="HUBSPOT_DEFINED", associationTypeId=16)
        the_id = HubspotId(id=hubspot_id)
        return cls(to=the_id, types=[the_type])


class BaseProperties(BaseModel):
    subject: str
    hs_pipeline_stage: int
    hs_pipeline: int
    ticket_email: None | str
    content: str

    def full_json_dump(self, hubspot_id: int):
        new_data = Association.default(hubspot_id).model_dump()
        start = {"properties": self.model_dump(), "associations": [new_data]}
        return json.dumps(start)


class Feedback(BaseProperties):
    ticket_type: str
    location_page: str
    version: str


class UUIDReturn(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    uuid: UUID


class ProEntitlements(BaseModel, extra="allow"):  # type: ignore[call-arg]
    benzinga: Literal["Read", "Write", "None"] = "Read"
    polygon: Literal["Read", "Write", "None"] = "Read"
    intrinio: Literal["Read", "Write", "None"] = "Read"
    fmp: Literal["Read", "Write", "None"] = "Read"
    datarade: Literal["Read", "Write", "None"] = "Read"
    veraset: Literal["Read", "Write", "None"] = "Read"
    alphavantage: Literal["Read", "Write", "None"] = "Read"

    @classmethod
    def trial_values(cls) -> "ProEntitlements":
        return cls(
            benzinga="Read",
            polygon="Read",
            intrinio="Read",
            fmp="Read",
            datarade="Read",
            veraset="Read",
            alphavantage="Read",
        )


class ProKeys(BaseModel, extra="allow"):  # type: ignore[call-arg]
    benzinga: Annotated[None | str, BeforeValidator(blank_to_none)] = None
    polygon: Annotated[None | str, BeforeValidator(blank_to_none)] = None
    intrinio: Annotated[None | str, BeforeValidator(blank_to_none)] = None
    fmp: Annotated[None | str, BeforeValidator(blank_to_none)] = None
    datarade: Annotated[None | str, BeforeValidator(blank_to_none)] = None
    veraset: Annotated[None | str, BeforeValidator(blank_to_none)] = None
    alphavantage: Annotated[None | str, BeforeValidator(blank_to_none)] = None
    trading_economics: Annotated[None | str, BeforeValidator(blank_to_none)] = None

    def __hash__(self):
        return hash((type(self),) + tuple(self.model_dump().items()))

    def validate_keys(self) -> None | str:
        for key in self.model_fields_set:
            func_name = f"test_{key}"
            if getattr(self, key) is None:
                continue
            if hasattr(self, func_name) and not getattr(self, func_name)():
                return key
        return None

    def test_benzinga(self) -> bool:
        url = "https://api.benzinga.com/api/v2.1/calendar/offerings"
        response = requests.get(url, params={"token": self.benzinga}, timeout=10)
        return response.status_code != 401  # noqa: PLR2004

    def test_polygon(self) -> bool:
        url = "https://api.polygon.io/v2/aggs/ticker/AAPL/range/1/day/2023-01-09/2023-01-09"
        response = requests.get(url, params={"apiKey": self.polygon}, timeout=10)
        return response.status_code != 401  # noqa: PLR2004

    def test_intrinio(self) -> bool:
        url = "https://api-v2.intrinio.com/securities/AAPL/prices/technicals/atr"
        response = requests.get(url, params={"api_key": self.intrinio}, timeout=10)
        return response.status_code != 401  # noqa: PLR2004

    def test_fmp(self) -> bool:
        url = "https://financialmodelingprep.com/api/v3/search"
        response = requests.get(url, params={"apikey": self.fmp, "query": "AA"}, timeout=10)
        return response.status_code != 401  # noqa: PLR2004

    def test_alphavantage(self) -> bool:
        "This does NOT work because AlphaVantage runs with bad keys just fine"
        url = "https://www.alphavantage.co/query?interval=5min&apikey=demo"
        params = {
            "function": "TIME_SERIES_INTRADAY",
            "symbol": "IBM",
            "apikey": self.alphavantage,
        }
        response = requests.get(url, params=params, timeout=10)
        return response.status_code != 401  # noqa: PLR2004

    def test_trading_economics(self) -> bool:
        url = "https://api.tradingeconomics.com/country/mexico"
        response = requests.get(url, params={"c": self.trading_economics}, timeout=10)
        return response.status_code not in {401, 500}  # noqa: PLR2004


class ProInfoDeveloper(BaseModel, extra="allow"):  # type: ignore[call-arg]
    primaryUsage: Annotated[
        None | Literal["academic", "professional", "personal"],
        BeforeValidator(blank_to_none),
    ] = None
    organization: None | str = None
    role: None | str = None
    programmingExperience: Annotated[None | ProgrammingExperience, BeforeValidator(blank_to_none)] = None
    dataTypes: None | list[str] = None
    otherDataType: None | str = None
    organizationName: Annotated[None | str, BeforeValidator(blank_to_none)] = None
    skipOnboarding: bool = False

    def to_hubspot_properties(self) -> "HubspotProperties":
        return HubspotProperties(
            primary_usage=self.primaryUsage,
            org_segment=self.organization,
            role=self.role,
            programming_experience=self.programmingExperience,
            data_types=",".join(self.dataTypes),
            other_data_types=self.otherDataType,
            organization_name=self.organizationName,
        )

    def to_marketing(self) -> "UserMarketing":
        return UserMarketing(
            primary_usage=self.primaryUsage,
            organization_segment=self.organization,
            role=self.role,
            programming_experience=self.programmingExperience,
            data_types=",".join(self.dataTypes) if self.dataTypes else None,
            other_data_types=self.otherDataType,
            organization_name=self.organizationName,
        )


class DefaultTicker(BaseModel, extra="allow"):  # type: ignore[call-arg]
    """Default ticker for the user"""

    id_: str = Field(serialization_alias="id", alias="id")
    symbol: str
    category: str
    type_: str = Field(serialization_alias="type", alias="type")
    name: str
    exchange: str
    exchange_name: str | None = None
    currency: str | None = None
    industry: str | None = None
    sector: str | None = None
    country: str | None = None
    cik: str | None = None
    isin: str | None = None
    cusip: str | None = None
    has_options: bool | None = False

    @classmethod
    def default(cls) -> "DefaultTicker":
        return cls(
            id="AAPL",
            symbol="AAPL",
            ticker="AAPL",
            name="Apple Inc.",
            exchange="NASDAQ",
            exchange_name="NASDAQ Global Select",
            category="equity",
            type="stock",
            currency="USD",
            industry="Consumer Electronics",
            sector="Technology",
            country="US",
            cik="0000320193",
            isin="US0378331005",
            cusip="037833100",
            has_options=True,
        )


class ProInfo(BaseModel, extra="allow"):  # type: ignore[call-arg]
    """Deprecated. Retained only so historical alembic migrations remain importable."""


class ProDisplaySettings(BaseModel, extra="allow"):  # type: ignore[call-arg]
    decimalDigits: int = 2
    theme: Literal["light", "dark"] | None = None
    showWidgetControls: bool = False
    virtualizeWidgets: bool = False
    tablePagination: bool = False
    fontSize: Literal["small", "medium", "large"] = "medium"
    defaultTicker: DefaultTicker | None = DefaultTicker.default()
    gridCorners: list[Literal["ne", "nw", "se", "sw"]] = ["se"]
    gridSnapping: Literal["off", "vertical"] = "vertical"
    quickAddButtonTransparent: bool = False
    lastVisitedPage: str | None = "/app/data-connectors"

    @field_validator("defaultTicker", mode="before", check_fields=False)
    @classmethod
    def check_default_ticker(cls, value: dict[str, str] | str | None) -> DefaultTicker:
        try:
            while isinstance(value, str):
                value = json.loads(value)
            return DefaultTicker.model_validate(value)
        except (json.JSONDecodeError, ValueError):
            return DefaultTicker.default()


class NudgeTriggerRecord(BaseModel, extra="allow"):
    nudgeId: None | str = None
    timestamp: None | datetime = None


class ProZeroToHero(BaseModel, extra="allow"):  # type: ignore[call-arg]
    grouping: None | datetime = None
    table_charting: None | datetime = None
    data_connectors: None | datetime = None
    charting: None | datetime = None
    group_sector_companies: None | datetime = None
    analyst_walkthrough: None | datetime = None
    developer_walkthrough: None | datetime = None
    nudge_trigger_history: None | list[NudgeTriggerRecord] = None

    @classmethod
    def default(cls) -> "ProZeroToHero":
        return cls(
            grouping=None,
            table_charting=None,
            data_connectors=None,
            charting=None,
            group_sector_companies=None,
            analyst_walkthrough=None,
            developer_walkthrough=None,
            nudge_trigger_history=None,
        )


class WidgetMetadata(BaseModel):
    model_config = get_camel_config()
    description: None | str = None
    category: None | str = None
    sub_category: None | str = None


class CreateSingleWidget(WidgetMetadata, extra="forbid"):  # type: ignore[call-arg]
    model_config = get_camel_config()
    endpoint: str
    name: str
    grid_data: None | dict = None
    data: None | dict = None
    endpoint_headers: None | dict | list[dict] = None
    source: None | list[str] | str = None
    data_key: None | str = None

    @field_validator("source", mode="before", check_fields=False)
    @classmethod
    def check_source(cls, value: None | str | list[str]) -> None | list[str]:
        if value and isinstance(value, str):
            return value.split(",")
        return value


class ReturnSingleWidget(CreateSingleWidget, extra="ignore"):  # type: ignore[call-arg]
    model_config = get_camel_config(from_attributes=True)
    uuid: UUID
    widgetId: UUID = Field(serialization_alias="widgetId", alias="uuid")
    created_date: datetime = Field(serialization_alias="createdDate", alias="created_date")
    updated_date: datetime = Field(serialization_alias="updatedDate", alias="updated_date")

    @field_validator("source", mode="before", check_fields=False)
    @classmethod
    def check_source(cls, value: None | str | list[str]) -> None | str:
        if value and isinstance(value, list):
            return ",".join(value)
        return value


class CreateFileWidget(WidgetMetadata, extra="forbid"):  # type: ignore[call-arg]
    model_config = get_camel_config()
    stored_file_uuid: None | UUID = None
    url: HttpUrl
    name: str
    extension: ExtensionType
    data_key: None | str
    original_file_name: None | str
    source: None | str = None


class ReturnFileWidget(CreateFileWidget, extra="ignore"):  # type: ignore[call-arg]
    model_config = get_camel_config(from_attributes=True)
    uuid: UUID
    id_: UUID = Field(serialization_alias="id", alias="uuid")
    created_date: datetime = Field(serialization_alias="createdDate", alias="created_date")
    updated_date: datetime = Field(serialization_alias="updatedDate", alias="updated_date")


class ApiSourceEndpointHeaders(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    model_config = get_camel_config()
    key: str
    value: str
    location: Literal["headers", "query"] = "headers"


class ApiSourceBase(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    model_config = get_camel_config()
    name: str
    url: HttpUrl
    endpointHeaders: None | list[ApiSourceEndpointHeaders] = Field(default_factory=list)

    @field_validator("endpointHeaders", mode="before", check_fields=False)
    @classmethod
    def check_endpoint_headers(cls, value: None | dict | list) -> None | list:
        # Handle case where database has {} instead of [] or null
        if isinstance(value, dict):
            return list(value.values()) if value else []
        return value


class CreateApiSource(ApiSourceBase):
    vendor_app_uuid: None | UUID = None


class AppWidgetMetadata(BaseModel):
    id_: str = Field(serialization_alias="id", alias="id")
    name: str
    description: None | str = None
    count: int


class VendorAppSchema(BaseModel):
    model_config = get_camel_config(from_attributes=True)

    uuid: UUID
    name: str
    parent_app_uuid: UUID | None = Field(None, validation_alias="parent_app_uuid")
    vendor_name: str = Field(..., validation_alias=AliasPath("vendor", "name"))
    short_description: str | None = None
    category: str | None = None
    tagline: str | None = None
    apps_json_url: str | None = None
    widgets_json_url: str | None = None
    thumbnail: NoneToStr = Field("", validation_alias="thumbnail_url")
    thumbnail_dark: NoneToStr = Field("", validation_alias="thumbnail_url_dark")
    thumbnail_light: NoneToStr = Field("", validation_alias="thumbnail_url_light")
    version: str | None = None
    widgets: list[AppWidgetMetadata] | None = Field(default_factory=list)
    total_widgets: int | None = Field(0)

    prompts: VenderAppPrompts = Field(default_factory=list, validation_alias="apps_json_cache")
    widgets_json_cache: None | dict = None
    apps_json_cache: None | list = None
    average_rating: AppRating = Field(None, validation_alias="ratings")
    is_development: Annotated[
        bool,
        BeforeValidator(_is_development_status),
    ] = Field(False, validation_alias="status")

    @model_validator(mode="after")
    def populate_widgets(self) -> "VendorAppSchema":
        widget_metadata = get_widget_metadata(self.apps_json_cache, self.widgets_json_cache)
        self.widgets = widget_metadata.get("widgets", []) if widget_metadata else []
        self.total_widgets = widget_metadata.get("totalWidgets", 0) if widget_metadata else 0
        return self


class ReturnApiSource(ApiSourceBase, extra="ignore"):  # type: ignore[call-arg]
    model_config = get_camel_config(from_attributes=True)
    uuid: UUID
    id_: UUID = Field(serialization_alias="id", alias="uuid")
    created_date: datetime = Field(serialization_alias="createdDate", alias="created_date")
    updated_date: datetime = Field(serialization_alias="updatedDate", alias="updated_date")
    is_entity_backend: Annotated[bool, BeforeValidator(_is_not_none)] = Field(validation_alias="entity_uuid")
    vendor_app: VendorAppSchema | None = Field(None, validation_alias="vendor_app")


class EntityTypeCreate(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    entity_type: str
    code: str
    active: bool
    permission_hierarchy: int


class EntityTypeReturn(EntityTypeCreate):  # type: ignore[call-arg]
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    uuid: UUID


class EntityBase(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    name: str
    entity_code: str
    email: EmailStr
    company_type: str
    organization_size: str
    aum: int
    country: str
    seats: int
    expiration_date: datetime
    stripe_id: None | str = None
    api_keys: ProKeys = ProKeys()


class EntityPost(EntityBase):
    admin_email: EmailStr


class EntityReturn(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    uuid: UUID
    name: str
    entity_type: EntityTypeReturn
    email: None | str
    company_type: None | str
    organization_size: None | str
    aum: None | int
    country: None | str
    seats: None | int
    expiration_date: Annotated[None | str, BeforeValidator(datetime_to_string)]
    stripe_id: None | str
    api_keys: ProKeys = ProKeys()


class EntityRelationshipCreate(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    parent_uuid: UUID
    child_uuid: UUID


class EntityRelationshipGet(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    parent_uuid: UUID
    child_uuid: UUID


class EntityRelationshipReturn(EntityRelationshipCreate, extra="forbid"):  # type: ignore[call-arg]
    parent: EntityReturn
    child: EntityReturn
    supreme: EntityReturn
    uuid: UUID


class UserAdminUpdate(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    pro_entitlements: None | ProEntitlements = None
    permissions_uuid: None | UUID = None
    billing_active: None | bool = None


class EntityMapCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    entity_uuid: UUID
    name: str
    entitlements: ProEntitlements


class EntityMapReturn(EntityMapCreate):
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    uuid: UUID
    entity: EntityReturn
    name: str
    entitlements: ProEntitlements


class EntityInfoReturn(BaseModel):
    seats: int
    used_seats: int
    expiration_date: None | datetime


class EntityUserReturn(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    uuid: UUID
    email: str
    permissions: EntityMapReturn | None = None
    pro_trial_end: None | datetime = None


class AddEntityReturn(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    entity_uuid: UUID
    permission_map_uuid: UUID


class DashboardReturn(BaseModel):
    model_config = main_config
    creator: bool
    content: None | dict
    created_date: datetime
    updated_date: datetime
    created_by: str
    is_shared: bool | None = False


class DashboardsCreate(BaseModel):
    items: dict[UUID, Literal["DELETE"] | dict]


class DashboardOwned(BaseModel):
    owned: dict[UUID, DashboardReturn]


class DashboardShared(BaseModel):
    shared: dict[UUID, DashboardReturn]
    entity_shared: dict[UUID, DashboardReturn]


class DashboardComplete(DashboardOwned, DashboardShared):
    pass


class DataBundle(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True)

    bundle_name: BundleNames
    except_widgets: list[WidgetTypes] | None = None
    except_dashboard_templates: list[DashboardTypes] | None = None
    except_team_collaboration: list[Literal["pdf_reports", "sharing"]] | None = None
    excel_add_in: bool
    data_export: bool
    providers: list[Literal["fmp", "econdb", "benzinga"]] | None
    dashboards_at_launch: list[DashboardTypes] | None
    my_dashboards: list[DashboardTypes] | None
    invite_your_colleagues: bool
    number_copilot_calls_day: int
    total_file_upload_size_gb: int
    allow_custom_backends: bool | None = True

    @field_validator(
        "except_widgets",
        "except_dashboard_templates",
        "except_team_collaboration",
        "providers",
        "dashboards_at_launch",
        "my_dashboards",
        mode="before",
        check_fields=False,
    )
    @classmethod
    def json_to_lists(cls, value: None | str | list) -> None | list:
        if value and isinstance(value, str):
            return json.loads(value)
        return value


class EntitlementBase(BaseModel):
    model_config = main_config

    tier: Literal["pro", "terminal"] | None = None
    number_copilot_calls_day: int = None
    total_file_upload_size_gb: int = None
    share_widgets: Literal["public", "private"] | None = None
    bring_your_own_data: bool = None
    bring_your_own_copilot: bool = None
    admin_access: bool = None
    support: bool = None
    excel_add_in: bool = None
    data_add_ons_redistribution: bool = None
    bundle_name: BundleNames | None = None
    allow_custom_backends: bool | None = True


class EntitlementGet(EntitlementBase):
    data_bundle_info: DataBundle | None = None


class EntitlementUsageBase(BaseModel):
    def entitlement_match_dump(self):
        entitlement_match = {}

        for field_name, field in self.__class__.model_fields.items():
            entitlement_match[field.json_schema_extra["entitlement_match"]] = getattr(self, field_name)
        return entitlement_match

    model_config = main_config
    number_copilot_calls_day_count: int = Field(..., json_schema_extra={"entitlement_match": "number_copilot_calls_day"})
    total_file_upload_size_gb_count: float = Field(
        ..., json_schema_extra={"entitlement_match": "total_file_upload_size_gb"}
    )


class EntitlementUsagePut(BaseModel):
    add_copilot_count: int | None = Field(0, ge=0)
    subtract_copilot_count: int | None = Field(0, ge=0)
    reset_copilot_count: bool | None = False


class EntitlementUsageGet(EntitlementUsageBase, extra="ignore"):  # type: ignore[call-arg]
    copilot_calls_limit: int | None = None
    file_upload_size_limit: float | None = None

    @classmethod
    async def check_cache(cls, db, user) -> "EntitlementUsageGet":
        from routers.pro.helpers import check_usage_cache  # noqa: PLC0415

        return await check_usage_cache(db, user)


class UsageLimitError(BaseModel):
    error: str
    message: str
    current_usage: int

    @classmethod
    def limit_error(cls, usage: EntitlementUsageGet) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": "Maximum usage limit reached",
                "message": f"Cannot increment usage beyond the maximum limit of {usage.copilot_calls_limit}",
                "current_usage": usage.number_copilot_calls_day_count,
            },
        )


def default_chats() -> list["Chat"]:
    current_at = int(datetime.now(UTC).timestamp() * 1000)
    DEFAULT_CHAT = {
        "uuid": str(uuid4()),
        "createdAt": current_at,
        "label": "New chat",
        "messages": [],
        "titleManuallyUpdated": False,
        "titleNeedsUpdate": True,
        "lastOpened": current_at,
    }
    return [Chat.model_validate(DEFAULT_CHAT)]


class DashboardCompleteWithContext(DashboardComplete):
    model_config = main_config
    is_trial_entity: bool
    can_submit_marketplace: bool = False
    feature_entitlements: EntitlementGet | None = None
    usage: EntitlementUsageGet | None = None
    copilot_chats: list["ChatInfo | Chat"] | None = Field(default_factory=default_chats)
    questions_history: list[str] | None = None
    mcp_servers: list[dict] | None = Field(default_factory=list)
    trading_view: "TVStateResponse | None" = None
    pro_display_settings: ProDisplaySettings = ProDisplaySettings()
    entity_theme_settings: "EntityThemeSettings"
    single_widgets: list[ReturnSingleWidget]
    file_widgets: list[ReturnFileWidget]
    user_apps: "UserAppsComplete"
    user_skills: list["SkillReturn"] | None = Field(default_factory=list)
    widget_metadata: list["WidgetMetadataResponse"] | None = None


class DashboardSave(BaseModel):
    model_config = main_config
    content: dict
    uuid: UUID
    created_date: datetime


class UserEntityInfo(BaseModel):
    model_config = main_config
    entity_name: str
    permission_name: str


class ProUserReturn(BaseModel):
    model_config = main_config
    expiration_date: datetime
    entitlements: None | ProEntitlements
    accepted_pro_tos: bool
    first_name: None | str = None
    last_name: None | str = None
    pro_display_settings: ProDisplaySettings = ProDisplaySettings()
    pro_zero_to_hero: ProZeroToHero = ProZeroToHero.default()
    single_widgets: list[ReturnSingleWidget]
    file_widgets: list[ReturnFileWidget]
    api_sources: list[ReturnApiSource]
    username: None | str = None
    email: str
    uuid: UUID
    primary_usage: None | str = None
    widget_metadata: list["WidgetMetadataResponse"] | None = None
    entity_info: UserEntityInfo | None = None


class ProBackendReturn(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    expiration_date: datetime
    api_keys: ProKeys
    username: None | str = None
    email: str
    uuid: UUID
    primary_usage: None | str = None


class OpenaiPost(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    prompt: str


class TimegptPost(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    fh: int = 30
    y: dict[str, float]
    freq: Literal["H", "D", "W", "M"] = "M"
    clean_ex_first: bool = True
    level: list[int] = [80, 95]
    finetune_steps: int = 2


class TimegptData(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    timestamp: list[datetime]
    value: list[float]


class TimegptReturn(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    data: TimegptData
    message: str
    details: str
    code: str
    requestID: str
    support: str


class UserAdminReturn(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    uuid: UUID
    first_name: None | str = None
    last_name: None | str = None
    email: str
    billing_active: None | bool = False
    role: str
    last_login: None | datetime = None
    last_active: None | datetime = None
    status: Literal["active", "pending", "revoked", "expired"] = "pending"
    pro_entitlements: None | ProEntitlements = None
    permissions_uuid: UUID | None = None
    # Which table the information comes from, essential for properly implementing a delete function
    source: UserSourceType
    # pro_trial_renewals is > 0 or pro_trial_extensions is True
    renewed: bool = False


class InviteEmail(BaseModel):
    model_config = main_config
    to_emails: list[EmailStr]


class UserForgot(BaseModel):
    model_config = main_config
    email: Annotated[EmailStr, AfterValidator(check_email)]
    redirect: Literal["pro", "hub"] = "hub"


class UserReset(BaseModel):
    model_config = main_config
    password: Annotated[str, AfterValidator(check_password)]
    token: str


class HubspotProperties(BaseModel):
    marketing_email: None | bool = None
    academia_email: None | bool = None
    bot_email: None | bool = None
    pro_waitlist: None | bool = None
    primary_use: None | str = None
    wants_contacted: None | bool = None
    newsletter_only: bool = False
    is_verified: None | bool = None
    pro_start_date: None | float = None
    pro_trial_granted: None | bool = None
    pro_trial_granted_date: None | str = None
    is_paid_user: None | bool = None
    is_admin: None | bool = None
    trial_extended_0124: None | bool = None
    firstname: None | str = None
    lastname: None | str = None
    org_name: None | str = None
    org_segment: None | str = None
    role: None | str = None
    # Developer Onboarding
    programming_experience: None | str = None
    data_types: None | str = None
    other_data_types: None | str = None


class UserMarketing(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    model_config = main_config
    # Tag-based booleans (Mailchimp tags)
    email_academia: None | bool = None
    email_bot: None | bool = None
    email_newsletter: None | bool = None
    email_prowaitlist: None | bool = None
    # Profile / survey fields (Mailchimp merge fields)
    first_name: None | str = None
    last_name: None | str = None
    primary_usage: None | str = None
    organization_name: None | str = None
    organization_segment: None | str = None
    role: None | str = None
    wants_contacted: None | bool = None
    is_verified: None | bool = None
    is_paid_user: None | bool = None
    is_admin: None | bool = None
    pro_start_date: None | float = None
    pro_trial_granted: None | bool = None
    pro_trial_granted_date: None | str = None
    trial_extended: None | bool = None
    # Onboarding survey
    programming_experience: None | str = None
    data_types: None | str = None
    other_data_types: None | str = None

    def hubspot_properties(self) -> HubspotProperties:
        return HubspotProperties(
            marketing_email=self.email_newsletter,
            academia_email=self.email_academia,
            bot_email=self.email_bot,
            pro_waitlist=self.email_prowaitlist,
            primary_use=self.primary_usage,
            wants_contacted=self.wants_contacted,
            is_verified=self.is_verified,
            firstname=self.first_name,
            lastname=self.last_name,
            pro_start_date=self.pro_start_date,
            pro_trial_granted=self.pro_trial_granted,
            pro_trial_granted_date=self.pro_trial_granted_date,
            is_paid_user=self.is_paid_user,
            is_admin=self.is_admin,
            trial_extended_0124=self.trial_extended,
            org_name=self.organization_name,
            org_segment=self.organization_segment,
            programming_experience=self.programming_experience,
            data_types=self.data_types,
            other_data_types=self.other_data_types,
        )

    @classmethod
    def from_hubspot(cls, hub_dict: dict) -> "UserMarketing":
        email_academia = hub_dict.get("academia_email", False)
        return cls(
            email_academia=email_academia,
            email_bot=hub_dict.get("bot_email", False),
            email_newsletter=hub_dict.get("marketing_email", False),
            email_prowaitlist=hub_dict.get("pro_waitlist", False),
        )


class UserCreate(UserMarketing):
    model_config = main_config
    email: Annotated[EmailStr, AfterValidator(check_email)]
    password: Annotated[str, AfterValidator(check_password)]
    username: Annotated[None | str, AfterValidator(check_username)] = None
    referred_by: None | str = None


class UserCreateAdmin(BaseModel):
    model_config = main_config
    email: Annotated[EmailStr, AfterValidator(check_email)]
    permissions_uuid: UUID = settings.PRO_TRIAL_MAPPING
    first_name: None | str = None
    last_name: None | str = None
    message: None | str = Field(max_length=500, default=None)
    role: None | UUID = None


class UserCreateProAdmin(BaseModel):
    model_config = main_config
    email: Annotated[EmailStr, AfterValidator(check_email)]
    permissions_uuid: UUID = settings.PRO_TRIAL_MAPPING
    first_name: None | str = None
    last_name: None | str = None
    message: None | str = Field(max_length=500, default=None)
    newsletter: None | bool = False
    hear_about_us: None | str = None


class UserUpdateAdmin(BaseModel):
    model_config = main_config
    permissions_uuid: None | str = None
    pro_trial_end: None | datetime = None


class TotpToken(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    totp_token: Annotated[None | int, AfterValidator(check_totp_token)] = None


class ExternalUserLogin(BaseModel):
    model_config = main_config
    email: Annotated[str, AfterValidator(check_email_or_username)]
    remember: bool = False
    ip_address: Annotated[None | IPvAnyAddress, BeforeValidator(blank_to_none)] = None
    source: None | source_type = None
    totp_token: Annotated[None | int, AfterValidator(check_totp_token)] = None


class UserLogin(ExternalUserLogin):
    model_config = main_config
    password: Annotated[str, AfterValidator(check_password)]

    _bypass_password_check: bool = False


class ProUserLogin(UserLogin):
    version: None | str = None


class OAuthLogin(ProUserLogin):
    password: str | None = None

    def bypass_password_check(self):
        self._bypass_password_check = True

        return self


class UserJsonUpdate(BaseModel):
    model_config = main_config
    key: str
    value: Any = None


class UserUpdate(BaseModel, extra="forbid"):  # type: ignore[call-arg]
    first_name: None | str = None
    last_name: None | str = None
    old_password: Annotated[None | str, AfterValidator(check_password)] = None
    new_password: Annotated[None | str, AfterValidator(check_password)] = None
    email: Annotated[None | EmailStr, AfterValidator(check_email)] = None
    username: Annotated[None | str, AfterValidator(check_username)] = None
    primary_usage: None | str = None
    wants_contacted: None | bool = None

    def validated_dict(self, password: str):
        """Converts the model into a dictionary, valid for updating the user model.

        Parameters
        ----------
        password: str
            The user's old password hashed, used to validated old_password
        """
        if isinstance(password, bytes):
            password = password.decode("utf-8")

        new_dict = self.model_dump(exclude_none=True)
        old_pass = new_dict.pop("old_password", None)
        new_pass = new_dict.pop("new_password", None)
        if old_pass and new_pass:
            valid = base.verify_password(old_pass, password)
            if not valid:
                raise ValueError("Invalid password")
            new_dict["password"] = new_pass
            new_dict["temporary_password"] = False
        return new_dict


class UserReturn(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    model_config = main_config
    confirmed: bool
    created_date: datetime
    first_name: None | str = None
    last_name: None | str = None
    referral_count: None | int = None
    email: str
    username: Annotated[None | str, AfterValidator(check_username)] = None
    profile_url: None | str = None
    referral_code: str
    primary_usage: None | str = None
    information_complete: Literal["bot", "complete", "incomplete"]


class UserReturnExpanded(UserReturn):
    model_config = main_config
    uuid: UUID


class ShareDashboard(BaseModel):
    model_config = main_config
    # For right now, we are NOT allowing edit
    shares: SharesPermissions


class ShareUserApp(ShareDashboard):
    pass


class ShareDashboardList(BaseModel):
    model_config = main_config
    # For right now, we are NOT allowing edit
    shares: list[Annotated[str, AfterValidator(check_email)]]


class ShareUserAppList(ShareDashboardList):
    pass


class RegisterProUser(BaseModel):
    inviting_uuid: UUID
    inviting_email: str
    shared_user_app: None | UUID = None
    shared_dashboard: None | UUID = None
    shared_permissions: None | permissions_type = None


ForceInt = Annotated[int, BeforeValidator(int)]


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True)
    uuid: UUID | None = Field(default=None)
    role: base.ChatMessageRole
    copilotId: str
    timestamp: ForceInt
    content: str | dict | None = None
    isError: None | bool = None
    isFC: None | bool = None
    function: None | str = None
    input: None | dict = None
    copilot_function_call_arguments: None | dict = None
    isHidden: None | bool = None
    usedPersonalOpenAiKey: None | bool = None
    citations: None | list[dict] = None
    data: None | dict | list[dict] = None
    extra_state: None | dict = None

    @field_validator("usedPersonalOpenAiKey", mode="before", check_fields=False)
    @classmethod
    def check_used_personal_openai_key(cls, value: str | bool | None) -> bool:
        return bool(value)


def parse_created_at(value: datetime | int | None) -> int:
    if value is None:
        return int(datetime.now(UTC).timestamp() * 1000)
    if isinstance(value, datetime):
        return int(value.timestamp() * 1000)
    return value


class ChatInfo(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True)
    uuid: str | UUID | None = Field(default=None, serialization_alias="uuid", alias="id")
    createdAt: Annotated[int, BeforeValidator(parse_created_at)]
    label: str

    @classmethod
    def corrupted(cls, uuid: UUID) -> "Chat":
        """Creates a corrupted chat object with the given UUID."""
        return cls(
            uuid=uuid,
            createdAt=int(datetime.now(UTC).timestamp() * 1000),
            label="Corrupted Chat",
            messages=[
                ChatMessage(
                    uuid=uuid4(),
                    role="system",
                    content={
                        "eventType": "ERROR",
                        "message": "This chat contains corrupted data and cannot be displayed.",
                    },
                    timestamp=int(datetime.now(UTC).timestamp() * 1000),
                    copilotId="openbb-copilot",
                )
            ],
            lastOpened=int(datetime.now(UTC).timestamp() * 1000),
        )

    def to_content(self) -> dict:
        """Converts the Chat object to a dictionary suitable for database storage."""
        return self.model_dump(mode="json", exclude={"messages", "artifacts"}, by_alias=True)


class Chat(ChatInfo):
    artifacts: list[dict] | None = Field(default_factory=list)
    messages: list[ChatMessage]

    @classmethod
    def from_db(cls, value: dict | None, uuid: UUID) -> "Chat":
        if value is None:
            return cls.corrupted(uuid)

        value.pop("id_", None)
        value.pop("id", None)
        value.update({"uuid": uuid})
        return cls.model_validate(value)

    @classmethod
    def from_row(cls, row: "CopilotChat", from_search: bool = False) -> "ChatInfo | Chat":
        if (value := row.content) is None:
            return cls.corrupted(row.uuid)

        value.pop("id_", None)
        value.pop("id", None)
        value.update({"uuid": row.uuid})
        if not hasattr(row, "messages"):
            return ChatInfo.model_validate(value)

        value.update({"messages": [v.content for v in row.messages if v.content is not None]})
        if not from_search:
            value.update({"artifacts": row.artifacts if hasattr(row, "artifacts") else []})
        return cls.model_validate(value)


class ChatUpdate(Chat):
    messages: dict[UUID, Literal["DELETE"] | dict] = Field(default_factory=dict)

    def to_entry(self, chat_uuid: UUID, owner_uuid: UUID):
        """Converts the ChatUpdate object to a dictionary suitable for database storage."""
        v = self.model_dump(mode="json", by_alias=True)
        v.pop("id_", None)
        v.pop("id", None)
        messages: dict[str, Literal["DELETE"] | dict] = v.pop("messages", {})
        artifacts: list[dict] = v.pop("artifacts", [])
        entry = {
            "uuid": chat_uuid,
            "content": v,
            "artifacts": artifacts,
            "label": v.get("label"),
            "last_opened": base.time_ms_now(v.get("lastOpened")),
            "user_uuid": owner_uuid,
        }
        return (entry, messages)


class CopilotChatsCreate(BaseModel):
    chats: dict[UUID, Literal["DELETE"] | ChatUpdate]


class MCPTool(BaseModel):
    model_config = get_camel_config(extra="ignore", from_attributes=True)
    id_: str = Field(serialization_alias="id", alias="id")
    name: str
    description: str | None = None
    enabled: bool = True


class MCPServer(BaseModel):
    model_config = get_camel_config(extra="allow", from_attributes=True)
    id_: str = Field(serialization_alias="id", alias="id")
    client_name: str | None = None
    tools: list[MCPTool] = Field(default_factory=list)
    name: str
    url: str
    enabled: bool
    is_local: bool = False
    custom_headers: dict[str, str] | None = Field(default_factory=dict)


class MCPServers(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    servers: list[MCPServer] = Field(default_factory=list)

    def get_servers_json(self):
        return self.model_dump(by_alias=True).get("servers", [])


class TVChartsState(BaseModel):
    model_config = {"populate_by_name": True, "extra": "allow"}
    charts: list[dict] | None = Field(default_factory=list)
    studyTemplates: list[dict] | None = Field(default_factory=list)
    drawingTemplates: list[dict] | None = Field(default_factory=list)
    chartTemplates: list[dict] | None = Field(default_factory=list)
    chartLayouts: dict[str, dict[str, Any]] | None = Field(default_factory=dict)


class TVStateCreate(BaseModel):
    charts_state: TVChartsState
    settings: dict[str, Any]


class TVStateResponse(BaseModel):
    model_config = {"from_attributes": True, "populate_by_name": True}
    charts_state: TVChartsState | None = None
    settings: dict[str, Any] | None = None


class UserProSchema(BaseModel):
    "A schema for the user pro"

    model_config = {"from_attributes": True, "populate_by_name": True}

    email: str
    uuid: UUID
    username: str | None = None
    confirmed: bool
    password: str
    latest_version: str | None = None
    permissions_uuid: None | UUID = None
    pro_entitlements: ProEntitlements | None = None
    pro_trial_end: None | datetime = None
    pro_trial_renewals: None | int = None
    pro_trial_extension: None | bool = None
    temporary_password: None | bool = None
    totp_secret: None | str = None
    totp_active: bool | None = None
    two_factor_auth: bool | None = None
    billing_active: None | bool = None
    entity_uuid: UUID | None = None
    require_authenticator: bool | None = None
    name: str | None = None
    expiration_date: None | datetime = None
    role: str | None = None
    welcome_screen: bool | None = None
    is_superuser: bool | None = None
    can_submit_marketplace: bool | None = None


class StoredFileSchema(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    uuid: UUID | None = Field(default_factory=uuid4)
    creater_uuid: UUID
    s3_file_name: str
    bucket: str
    extension: ExtensionType
    original_file_name: None | str
    size: int

    failed: bool = False

    def as_return(self) -> "PendingFileReturn":
        return PendingFileReturn(
            stored_file_uuid=self.uuid,
            original_file_name=self.original_file_name,
            extension=self.extension,
            url=f"{settings.SELFURL}/pro/files/{self.uuid}.{self.extension}",
            failed=self.failed,
        )

    def set_failed(self) -> "StoredFileSchema":
        updated = self.model_copy(update={"failed": True})
        return updated


class StoredFileReturn(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    uuid: UUID
    file_widget_uuid: UUID | None = None
    extension: ExtensionType
    original_file_name: None | str
    size: int | None = None
    is_global: bool = False


class DownloadManifest(StoredFileReturn):
    model_config = {"from_attributes": True, "populate_by_name": True}

    uuid: UUID | None = None
    file_name: str | None = None

    @model_validator(mode="after")
    def check_file_name(self):
        if not self.file_name:
            self.file_name = f"{self.uuid}.{self.extension}"
        return self


class DeleteStoredFiles(BaseModel):
    file_uuids: list[UUID]


class WidgetMetadataResponse(BaseModel):
    model_config = get_camel_config()
    name: str
    description: str
    source: str
    category: str
    sub_category: str
    widget_type: MetaDataWidgetType
    storage: dict
    widget_config: dict | None = None
    widget_id: UUID


class WidgetMetadataResponsePatch(BaseModel):
    model_config = get_camel_config()
    name: str | None = None
    description: str | None = None
    source: str | None = None
    category: str | None = None
    sub_category: str | None = None
    widget_type: MetaDataWidgetType | None = None
    widget_config: dict | None = None
    storage: dict | None = None


class UserAppCreate(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True, populate_by_name=True)
    name: str
    description: str | None = None
    img: str | None = None
    img_dark: str | None = None
    img_light: str | None = None
    prompts: list[str] = Field(default_factory=list)
    widgets: list[dict] = Field(default_factory=list)
    groups: list[dict] = Field(default_factory=list)
    gridLayout: dict[str, list[dict]] = Field(default_factory=dict)
    currentTab: str | None = None


class UserAppReturn(BaseModel):
    model_config = get_camel_config(from_attributes=True)
    content: UserAppCreate
    creator: bool
    is_shared: bool | None = False
    created_date: datetime = Field(serialization_alias="createdDate", alias="created_date")
    updated_date: datetime = Field(serialization_alias="updatedDate", alias="updated_date")
    created_by: str = Field(serialization_alias="createdBy", alias="created_by")
    sharedWith: list[dict] | None = Field(default_factory=list, serialization_alias="sharedWith", alias="shared_with")


class UserAppShareReturn(BaseModel):
    created_date: None | datetime
    permissions: None | base.PermissionEnum
    first_name: None | str
    last_name: None | str
    is_invite: bool


class UserAppsComplete(BaseModel):
    shared: dict[UUID, UserAppReturn]
    owned: dict[UUID, UserAppReturn]


class EnabledBundles(BaseModel):
    enabled_bundles: list[str]
    disabled_widgets: list[str] | None = None


class EntitlementPost(BaseModel):
    model_config = main_config
    tier: Literal["pro", "terminal"]


class EntitlementPut(EntitlementPost): ...  # type: ignore


class EntitlementPatch(EntitlementBase): ...  # type: ignore


class ValidateAndSync(BaseModel):
    model_config = main_config
    feature_entitlements: EntitlementGet


class TierPut(BaseModel):
    model_config = main_config

    tier: Literal["terminal"]


class TierPutResponse(BaseModel):
    model_config = main_config
    entitlement: EntitlementGet
    usage: EntitlementUsageGet
    is_trial_entity: bool


class SharedDashboardViewed(BaseModel):
    dashboard_uuid: UUID
    viewed: bool


class SharedAppViewed(BaseModel):
    app_uuid: UUID
    viewed: bool


class AuthData(BaseModel):
    model_config = main_config

    token: str | None = None
    newsletter: bool | None = False
    version: None | str = None


class CustomCopilot(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    uuid: UUID | None = Field(default_factory=uuid4)
    url: str
    headers: dict[str, str]
    copilots: list[dict] | None = Field(default_factory=list)


class Prompt(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True)
    id: str
    prompt: str
    widgets: list | None = Field(default_factory=list)
    createdAt: str
    updatedAt: str


class SkillCreate(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    model_config = get_camel_config(from_attributes=True)
    slug: str
    description: str
    content: str

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        if len(value) < 2 or len(value) > 50:  # noqa: PLR2004
            raise ValueError("Skill slug must be between 2 and 50 characters")
        if not SKILL_SLUG_REGEX.match(value):
            raise ValueError("Skill slug must contain only lowercase letters, numbers, and hyphens")
        return value


class SkillReturn(SkillCreate):
    model_config = get_camel_config(from_attributes=True)

    uuid: UUID
    id_: UUID = Field(serialization_alias="id", alias="uuid")
    created_date: datetime = Field(serialization_alias="createdDate", alias="created_date")
    updated_date: datetime = Field(serialization_alias="updatedDate", alias="updated_date")


class TwoFactorAuth(BaseModel):
    model_config = main_config
    two_factor_auth: bool


class TwoFactorAuthGet(TwoFactorAuth):
    entity_require_authenticator: bool


class GetRoleWithUsers(BaseModel):
    model_config = main_config
    uuid: UUID
    name: str
    description: str
    updated_date: datetime
    users: list[EmailStr]


class PostRole(BaseModel):
    model_config = main_config
    uuid: UUID | None = None
    name: str
    description: str
    users: list[EmailStr] | None = None


class PatchRole(BaseModel):
    model_config = main_config
    name: str | None = None
    description: str | None = None
    users: list[EmailStr] | None = None


class WidgetAccess(BaseModel):
    widgetId: str
    access: AccessType


class PromptAccess(BaseModel):
    promptId: str
    access: AccessType


class TemplateAccess(BaseModel):
    templateId: str
    access: AccessType
    prompts: list[PromptAccess] | None = None


class AppReturn(BaseModel):
    uuid: UUID
    name: str
    url: str
    user_uuid: UUID
    user_email: str | None = None
    created_date: datetime
    updated_date: datetime


class RolePermissions(BaseModel):
    model_config = main_config
    uuid: UUID
    type: Literal["backend", "file", "prompt"]
    access: AccessType
    category: Literal["data-connectors", "templates", "prompts"]
    widgets: list[WidgetAccess] | None = None
    templates: list[TemplateAccess] | None = None
    file_extension: ExtensionType | None = None
    prompt: Prompt | None = None


class BackendPermissionsModel(BaseModel):
    model_config = main_config
    uuid: UUID
    name: str
    access: AccessType
    widgets: list[WidgetAccess] | None = None
    templates: list[TemplateAccess] | None = None
    url: str | None = None
    endpointHeaders: list[ApiSourceEndpointHeaders] | None = None
    created_date: datetime = Field(serialization_alias="createdDate", alias="created_date")
    updated_date: datetime = Field(serialization_alias="updatedDate", alias="updated_date")
    created_by: str | None = Field(serialization_alias="createdBy", alias="created_by")


class FilePermissionsModel(BaseModel):
    model_config = main_config
    uuid: UUID
    access: AccessType
    name: str
    description: str
    url: str | None = None
    stored_file_uuid: UUID | None = None

    @model_validator(mode="after")
    def check_stored_file_uuid(self):
        if not self.stored_file_uuid and self.url:
            try:
                uuid_str = self.url.split("/").pop().split(".")[0]
                self.stored_file_uuid = UUID(uuid_str)
            except ValueError:
                self.stored_file_uuid = None
        return self


class PromptPermissionsModel(BaseModel):
    model_config = main_config
    uuid: UUID
    access: AccessType
    prompt: Prompt


class UserRolePermissions(BaseModel):
    model_config = main_config
    backends: list[BackendPermissionsModel] | None = Field(default_factory=list)
    files: list[FilePermissionsModel] | None = Field(default_factory=list)
    prompts: list[PromptPermissionsModel] | None = Field(default_factory=list)


class UserRolesPermissions(BaseModel):
    model_config = main_config
    permissions: dict[UUID, UserRolePermissions] = Field(default_factory=dict)


class UserRolesPermissionsFlattened(BaseModel):
    model_config = main_config
    backends: list[BackendPermissionsModel] | None = Field(default_factory=list)
    files: list[FilePermissionsModel] | None = Field(default_factory=list)
    prompts: list[PromptPermissionsModel] | None = Field(default_factory=list)


class RoleAuditLogReturn(BaseModel):
    """Return model for audit logs"""

    uuid: UUID
    created_at: datetime
    entity_uuid: UUID
    role_uuid: None | UUID = None
    action: RoleAuditAction
    resource_type: RoleResourceType
    resource_uuid: UUID
    performed_by_email: str
    details: dict
    role_name: str
    details_msg: str | None = None


class UserPermissions(BaseModel):
    data_connectors: list[dict]
    templates: list[dict]
    prompts: list[dict]


class ThemeSettings(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True)
    tableTheme: dict | None = None
    chartTheme: dict | None = None
    appTheme: dict | None = None


class EntityThemeSettings(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    light: ThemeSettings | None = None
    dark: ThemeSettings | None = None


class ProToken(BaseModel, extra="ignore"):  # type: ignore[call-arg]
    uuid: UUID
    email: EmailStr
    access_token: str
    username: str | None
    entitlements: ProEntitlements
    expiration_date: datetime
    temporary_password: bool
    force_2fa: bool
    entity_name: None | str
    entity_theme_settings: EntityThemeSettings
    role: None | str
    is_trial_entity: bool
    pro_trial_end: None | datetime
    show_changelog: bool
    show_welcome_screen: bool | None = False


class ProTokenWithContext(ProToken):
    copilot_chats: list["ChatInfo | Chat"] | None = None
    questions_history: list[str] | None = None
    trading_view: TVStateResponse | None = None
    dash_sync: DashboardComplete | None = None
    user_apps: UserAppsComplete
    user_skills: list[SkillReturn] | None = None
    user: ProUserReturn | None = None
    feature_entitlements: EntitlementGet | None = None
    can_submit_marketplace: bool = False
    moved_to_developer: bool = False
    enabled_widget_bundles: EnabledBundles | None = None
    developer_onboarding_info: ProInfoDeveloper | None = None
    usage: EntitlementUsageGet | None = None
    custom_copilots: list[CustomCopilot] | None = None
    mcp_servers: list[MCPServer] | None = None
    is_first_login: bool | None = False
