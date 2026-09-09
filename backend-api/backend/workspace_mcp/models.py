"""Typed protocol models shared by the sidecar HTTP, websocket, and MCP layers."""

from typing import Annotated, Any, Literal
from uuid import uuid4

from openbb_ai.models import AgentTool, WorkspaceState
from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    TypeAdapter,
    field_validator,
)

type BridgeErrorCode = Literal[
    "invalid_request",
    "unauthorized",
    "unavailable",
    "timeout",
    "command_failed",
    "unknown",
]
type NavigationOperation = Literal["create", "add_tabs", "remove_tabs", "rename_tabs"]
type GenerativeWidgetType = Literal["note", "table", "chart", "html"]
type DashboardOperation = Literal["create", "read", "update"]
type WorkspaceNavigationOperation = Literal["dashboard", "tab"]
type BackendsOperation = Literal["list", "add", "update", "refresh", "remove"]
type AppsOperation = Literal["list", "read", "instantiate"]
type EndpointHeaderLocation = Literal["headers", "query"]
type BridgePayload = dict[str, Any]
type BridgePayloadList = list[BridgePayload]


def new_request_id() -> str:
    """Create a stable request identifier for browser command roundtrips."""
    return f"cmd_{uuid4().hex}"


def widget_groups() -> dict[str, list[dict[str, Any]]]:
    """Return the default widget buckets for a workspace snapshot."""
    return {"primary": [], "secondary": [], "extra": []}


class Model(BaseModel):
    """Base model with strict validation and snake_case serialization."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class BridgeError(Model):
    """Structured error returned by the sidecar."""

    code: BridgeErrorCode
    message: str
    details: dict[str, Any] | None = None
    retryable: bool = False


class BrowserSessionStartRequest(Model):
    """Start a browser bridge session."""

    client_name: str = "workspace-ui"
    current_dashboard_id: str | None = None
    current_tab_id: str | None = None


class BrowserSessionContext(Model):
    """Tracked active Workspace context for one browser session."""

    current_dashboard_id: str | None = None
    current_tab_id: str | None = None


class BrowserSession(Model):
    """Active browser session metadata."""

    session_id: str
    token: str
    client_name: str
    current_dashboard_id: str | None = None
    current_tab_id: str | None = None


class BrowserSessionStartResponse(Model):
    """Session bootstrap payload returned to the browser."""

    session: BrowserSession
    websocket_url: str


class WorkspaceSnapshot(Model):
    """Bridge snapshot envelope around canonical OpenBB workspace models.

    The sidecar keeps the transport envelope local, but it reuses
    ``openbb_ai.models.WorkspaceState`` and ``openbb_ai.models.AgentTool`` so
    there is one source of truth for the main workspace payloads.
    """

    generated_at: int
    workspace_state: WorkspaceState | None = None
    workspace_options: list[str] = Field(default_factory=list)
    dashboards: list[dict[str, Any]] = Field(default_factory=list)
    dashboard_composition: dict[str, Any] | None = None
    widgets: dict[str, list[dict[str, Any]]] = Field(default_factory=widget_groups)
    context: list[dict[str, Any]] = Field(default_factory=list)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    files: list[dict[str, Any]] = Field(default_factory=list)
    tools: list[AgentTool] = Field(default_factory=list)
    skills: list[dict[str, Any]] = Field(default_factory=list)


class WorkspaceWidgetConfig(Model):
    """Widget configuration passed through to the Workspace frontend."""

    data_args: dict[str, Any] | None = None
    ui_args: dict[str, Any] | None = None


class WidgetDataRequest(Model):
    """Canonical MCP request item for widget-data tools.

    This shape intentionally matches the snapshot vocabulary so agents can
    reuse ``origin``, ``widget_id``, and ``params``/``data_args`` without
    translating into Ada's internal ``id`` and ``input_args`` names.
    """

    origin: str = Field(validation_alias=AliasChoices("origin", "backend_name"))
    widget_id: str
    data_args: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices(
            "data_args",
            "params",
            "input_args",
            "dataArgs",
            "inputArgs",
        ),
    )
    widget_uuid: str | None = None
    ssm_request: dict[str, Any] | None = None


class ParamOptionsRequest(Model):
    """Canonical MCP request item for parameter-options queries.

    The agent uses the snapshot's widget and param names directly, while the
    sidecar translates the request into the browser's existing Ada path.
    """

    origin: str = Field(validation_alias=AliasChoices("origin", "backend_name"))
    widget_id: str
    param_name: str
    data_args: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices(
            "data_args",
            "params",
            "options_endpoint_input_args",
            "dataArgs",
            "optionsEndpointInputArgs",
        ),
    )


class GetWidgetDataCommand(Model):
    """Fetch primary widget data from Workspace data sources."""

    command: Literal["get_widget_data"]
    request_id: str | None = None
    data_sources: BridgePayloadList = Field(default_factory=list)


class ListAvailableWidgetsCommand(Model):
    """List widgets that can be created in the current Workspace session."""

    command: Literal["list_available_widgets"]
    request_id: str | None = None
    origin: str | None = None
    backend_id: str | None = None


class GetWidgetSchemaCommand(Model):
    """Fetch one deterministic widget schema from the Workspace widget library."""

    command: Literal["get_widget_schema"]
    request_id: str | None = None
    origin: str | None = None
    widget_id: str


class GetParamOptionsCommand(Model):
    """Fetch parameter options for widget input arguments."""

    command: Literal["get_params_options"]
    request_id: str | None = None
    param_options_queries: BridgePayloadList = Field(default_factory=list)


class ReadWidgetCommand(Model):
    """Read one widget from the active dashboard."""

    command: Literal["read_widget"]
    request_id: str | None = None
    dashboard_id: str | None = None
    widget_uuid: str | None = None
    widget_id: str | None = None


class CreateWidgetCommand(Model):
    """Create one widget on the active dashboard."""

    command: Literal["create_widget"]
    request_id: str | None = None
    dashboard_id: str | None = None
    backend_name: str = Field(validation_alias=AliasChoices("backend_name", "origin"))
    widget_id: str
    config: WorkspaceWidgetConfig | None = None
    dry_run: bool | None = None


class UpdateWidgetCommand(Model):
    """Update one widget on the active dashboard."""

    command: Literal["update_widget"]
    request_id: str | None = None
    dashboard_id: str | None = None
    widget_uuid: str | None = None
    widget_id: str | None = None
    config: WorkspaceWidgetConfig
    dry_run: bool | None = None


class DeleteWidgetCommand(Model):
    """Delete one widget from the active dashboard."""

    command: Literal["delete_widget"]
    request_id: str | None = None
    dashboard_id: str | None = None
    widget_uuid: str | None = None
    widget_id: str | None = None


class ManageDashboardCommand(Model):
    """Create, read, or update dashboard metadata and composition."""

    command: Literal["manage_dashboard"]
    request_id: str | None = None
    operation: DashboardOperation
    dashboard_id: str | None = None
    name: str | None = None
    activate: bool | None = None


class NavigateWorkspaceCommand(Model):
    """Navigate the Workspace browser to an existing dashboard or inner tab."""

    command: Literal["navigate_workspace"]
    request_id: str | None = None
    operation: WorkspaceNavigationOperation
    dashboard_id: str | None = None
    tab_id: str | None = None


class UpdateDashboardLayoutCommand(Model):
    """Move or resize one widget in dashboard layout space."""

    command: Literal["update_dashboard_layout"]
    request_id: str | None = None
    dashboard_id: str | None = None
    widget_uuid: str | None = None
    widget_id: str | None = None
    tab_id: str | None = None
    x: float
    y: float
    w: float
    h: float
    min_w: float | None = None
    min_h: float | None = None
    max_w: float | None = None
    max_h: float | None = None


class ManageNavigationBarCommand(Model):
    """Create or mutate navigation tabs."""

    command: Literal["manage_navigation_bar"]
    request_id: str | None = None
    dashboard_id: str | None = None
    operation: NavigationOperation
    tabs: list[dict[str, Any]] = Field(default_factory=list)
    rename_map: dict[str, str] = Field(default_factory=dict)


class AddGenerativeWidgetCommand(Model):
    """Create a generated widget from inline data."""

    command: Literal["add_generative_widget"]
    request_id: str | None = None
    dashboard_id: str | None = None
    widget_type: GenerativeWidgetType
    data: list[dict[str, Any]] | str | None = None
    name: str | None = None
    description: str | None = None
    chart_params: dict[str, Any] | None = None
    inner_tab: str | None = None


class AssignTasksToAgentsCommand(Model):
    """Delegate tasks to configured external agents."""

    command: Literal["assign_tasks_to_agents"]
    request_id: str | None = None
    task_requests: BridgePayloadList = Field(default_factory=list)


class GetSkillContentCommand(Model):
    """Load one skill body from the Workspace skill library."""

    command: Literal["get_skill_content"]
    request_id: str | None = None
    slug: str
    reason: str | None = None


class GetWorkspaceSnapshotCommand(Model):
    """Fetch the current workspace snapshot from the connected browser."""

    command: Literal["get_workspace_snapshot"]
    request_id: str | None = None


class BackendEndpointHeader(Model):
    """One header or query parameter sent to a Workspace backend."""

    key: str
    value: str
    location: EndpointHeaderLocation = "headers"


class NavigationTabInput(Model):
    """One tab to create or remove on a navigation bar.

    The frontend handler (``useManageNavigationBar``) reads only ``name`` and
    derives ``tab_id`` as the slug of ``name``. ``extra="forbid"`` on the base
    ``Model`` rejects accidental ``tab_id`` / ``tab_name`` fields, so the
    common LLM mistake fails validation instead of silently writing the wrong
    shape to the bridge.
    """

    name: str

    @field_validator("name")
    @classmethod
    def _name_must_be_non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("name must not be blank")
        return value


class TaskRequest(Model):
    """One task delegated to an external Workspace agent.

    Field names match the frontend Zod schema in
    ``terminalpro/src/components/AI/.../ai.ts`` (``taskRequestsSchema``).
    """

    id: str
    description: str
    assigned_holder_url: str
    assigned_agent_id: str


class ManageBackendsCommand(Model):
    """List, add, update, refresh, or remove Workspace data backends."""

    command: Literal["manage_backends"]
    request_id: str | None = None
    operation: BackendsOperation
    backend_id: str | None = None
    name: str | None = None
    url: str | None = None
    endpoint_headers: list[BackendEndpointHeader] | None = None
    validate_widgets: bool | None = None
    is_openbb_platform: bool | None = None


class ManageAppsCommand(Model):
    """List, read, or instantiate Workspace apps across all app sources."""

    command: Literal["manage_apps"]
    request_id: str | None = None
    operation: AppsOperation
    backend_id: str | None = None
    app_name: str | None = None
    template_id: str | None = None
    dashboard_name: str | None = None
    activate: bool | None = None


type WorkspaceCommand = Annotated[
    GetWidgetDataCommand
    | ListAvailableWidgetsCommand
    | GetWidgetSchemaCommand
    | GetParamOptionsCommand
    | ReadWidgetCommand
    | CreateWidgetCommand
    | UpdateWidgetCommand
    | DeleteWidgetCommand
    | ManageDashboardCommand
    | UpdateDashboardLayoutCommand
    | NavigateWorkspaceCommand
    | ManageNavigationBarCommand
    | AddGenerativeWidgetCommand
    | AssignTasksToAgentsCommand
    | GetSkillContentCommand
    | GetWorkspaceSnapshotCommand
    | ManageBackendsCommand
    | ManageAppsCommand,
    Field(discriminator="command"),
]


class WorkspaceCommandResult(Model):
    """Typed browser command result returned through HTTP or MCP."""

    ok: bool
    command: str
    request_id: str | None = None
    message: str
    data: Any | None = None
    error: BridgeError | None = None
    warnings: list[str] = Field(default_factory=list)


class BrowserCommandResultMessage(Model):
    """Browser-to-sidecar command result."""

    type: Literal["command_result"]
    result: WorkspaceCommandResult


class BrowserPing(Model):
    """Browser keepalive event."""

    type: Literal["ping"]


class BrowserSessionContextChangedMessage(Model):
    """Browser-to-sidecar session context update."""

    type: Literal["session_context_changed"]
    session: BrowserSessionContext


type BrowserMessage = Annotated[
    BrowserCommandResultMessage | BrowserPing | BrowserSessionContextChangedMessage,
    Field(discriminator="type"),
]


class SessionReadyEvent(Model):
    """Server-to-browser session confirmation."""

    type: Literal["session_ready"]
    session: BrowserSession


class CommandRequestEvent(Model):
    """Server-to-browser workspace command request."""

    type: Literal["command_request"]
    command: WorkspaceCommand


class ErrorEvent(Model):
    """Server-to-browser error payload."""

    type: Literal["error"]
    error: BridgeError


class PongEvent(Model):
    """Server-to-browser keepalive acknowledgement."""

    type: Literal["pong"]


type ServerEvent = SessionReadyEvent | CommandRequestEvent | ErrorEvent | PongEvent

workspace_command_adapter: TypeAdapter[WorkspaceCommand] = TypeAdapter(WorkspaceCommand)
browser_message_adapter: TypeAdapter[BrowserMessage] = TypeAdapter(BrowserMessage)
