"""Widget catalog discovery, schema, data, and lifecycle tools."""

from typing import Annotated, Any

from fastmcp import FastMCP
from pydantic import Field

from workspace_mcp.config import result_offload_threshold
from workspace_mcp.models import (
    CreateWidgetCommand,
    DeleteWidgetCommand,
    GetParamOptionsCommand,
    GetWidgetDataCommand,
    GetWidgetSchemaCommand,
    ListAvailableWidgetsCommand,
    ParamOptionsRequest,
    ReadWidgetCommand,
    UpdateDashboardLayoutCommand,
    UpdateWidgetCommand,
    WidgetDataRequest,
)
from workspace_mcp.server._guidance import (
    DASHBOARD_ID_PARAM,
    ORIGIN_PARAM,
    WIDGET_ID_FALLBACK_PARAM,
    WIDGET_UUID_PARAM,
    describe_tool,
)
from workspace_mcp.server._helpers import (
    CommandRunner,
    ResultOffloadStore,
    ToolResponse,
    data_source_payloads,
    has_layout_ui_args,
    invalid_request,
    is_generative_only_widget,
    maybe_offload_result,
    param_options_payloads,
    require_widget_identifier,
    required_widget_config,
    widget_config,
)

type DashboardId = Annotated[str | None, Field(description=DASHBOARD_ID_PARAM)]
type WidgetUuid = Annotated[str | None, Field(description=WIDGET_UUID_PARAM)]
type WidgetIdFallback = Annotated[
    str | None, Field(description=WIDGET_ID_FALLBACK_PARAM)
]

_CATALOG_OFFLOAD_MESSAGE = (
    "Full catalog stored at {uri} (read it as an MCP resource). Prefer "
    "re-calling with an origin or backend_id filter; use get_widget_schema "
    "for one widget's full contract."
)


def summarize_widget_catalog(data: Any) -> dict[str, Any]:
    """Build the compact selection index for an offloaded widget catalog."""
    widgets = data.get("widgets") if isinstance(data, dict) else None
    if not isinstance(widgets, list):
        widgets = []
    origin_counts: dict[str, int] = {}
    index: list[dict[str, Any]] = []
    for widget in widgets:
        if not isinstance(widget, dict):
            continue
        origin = widget.get("origin", "")
        origin_counts[origin] = origin_counts.get(origin, 0) + 1
        index.append(
            {
                "origin": origin,
                "widget_id": widget.get("widget_id"),
                "name": widget.get("name"),
            }
        )
    return {
        "widget_count": len(index),
        "origins": [
            {"origin": origin, "count": count}
            for origin, count in origin_counts.items()
        ],
        "widgets": index,
    }


def register(
    server: FastMCP, run: CommandRunner, offload_store: ResultOffloadStore
) -> None:
    @server.tool(
        description=describe_tool(
            "Fetch current data for one Workspace data source.",
            "Only use this after selecting an exact widget identity and explicit data_args.",
        )
    )
    async def get_widget_data(
        origin: Annotated[str, Field(description=ORIGIN_PARAM)],
        widget_id: Annotated[
            str,
            Field(
                description=(
                    "Widget type identifier from list_available_widgets or the "
                    "workspace snapshot."
                )
            ),
        ],
        data_args: Annotated[
            dict[str, Any] | None,
            Field(
                description=(
                    "Object of explicit parameter values for this data source. "
                    "For chart widgets, include raw=true to fetch the underlying "
                    "rows instead of the Plotly figure JSON; the figure is for "
                    "the renderer, reasoning needs rows."
                )
            ),
        ] = None,
        widget_uuid: WidgetUuid = None,
        ssm_request: Annotated[
            dict[str, Any] | None,
            Field(description="Object payload for SSM-backed widgets."),
        ] = None,
    ) -> ToolResponse:
        """Fetch widget data using the same browser-side path Ada uses."""
        return await run(
            GetWidgetDataCommand(
                command="get_widget_data",
                data_sources=data_source_payloads(
                    [
                        WidgetDataRequest(
                            origin=origin,
                            widget_id=widget_id,
                            data_args=data_args or {},
                            widget_uuid=widget_uuid,
                            ssm_request=ssm_request,
                        )
                    ]
                ),
            )
        )

    @server.tool(
        description=describe_tool(
            "List widgets available to the current Workspace session.",
            "Returns deterministic widget identities for later get_widget_schema and create_widget calls.",
            (
                "Each returned widget includes origin; pass origin to other widget "
                "tools exactly as returned by list_available_widgets. A blank "
                "origin means the catalog is invalid."
            ),
            (
                "Only the deterministic plain-create subset is returned: "
                "generative-only note widgets such as rich_note and widgets that "
                "still require runtime-only bootstrap are intentionally excluded; "
                "use add_generative_widget for notes."
            ),
            (
                "Without filters the entire catalog is returned, which can be "
                "hundreds of widgets — prefer a filter when you know the source."
            ),
            (
                "Large unfiltered results return a compact index plus a "
                "result_ref resource with the full catalog."
            ),
        )
    )
    async def list_available_widgets(
        origin: Annotated[
            str | None,
            Field(
                description=(
                    "Filter: friendly catalog label matched exactly "
                    "(e.g. 'Options Activity Monitor'). Use origin when working "
                    "from a snapshot."
                )
            ),
        ] = None,
        backend_id: Annotated[
            str | None,
            Field(
                description=(
                    "Filter: backend UUID returned by manage_backends. Use "
                    "backend_id when you have a UUID from manage_backends. Both "
                    "filters can be passed together for a stricter match."
                )
            ),
        ] = None,
    ) -> ToolResponse:
        """List widgets that can be created in the current Workspace session."""
        result = await run(
            ListAvailableWidgetsCommand(
                command="list_available_widgets",
                origin=origin,
                backend_id=backend_id,
            )
        )
        return maybe_offload_result(
            result,
            offload_store,
            result_offload_threshold(),
            summarize=summarize_widget_catalog,
            message_template=_CATALOG_OFFLOAD_MESSAGE,
        )

    @server.tool(
        description=describe_tool(
            "Fetch the exact schema for one available widget.",
            "The response includes grid_data when layout defaults or min/max constraints are defined for that widget.",
            (
                "If a param returns requires_options_lookup=true, call get_params_options "
                "before using that param in create_widget or update_widget."
            ),
            (
                "rich_note is generative-only; use add_generative_widget with "
                "widget_type='note' instead."
            ),
        )
    )
    async def get_widget_schema(
        origin: Annotated[str, Field(description=ORIGIN_PARAM)],
        widget_id: Annotated[
            str,
            Field(
                description=(
                    "Widget type identifier from list_available_widgets or the "
                    "workspace snapshot."
                )
            ),
        ],
    ) -> ToolResponse:
        """Fetch one deterministic widget schema from the Workspace widget library."""
        if not origin or not widget_id:
            return invalid_request(
                "get_widget_schema",
                "get_widget_schema requires origin from list_available_widgets and widget_id.",
                details={"required": ["origin", "widget_id"]},
            )
        return await run(
            GetWidgetSchemaCommand(
                command="get_widget_schema",
                origin=origin,
                widget_id=widget_id,
            )
        )

    @server.tool(
        description=describe_tool(
            "Fetch the valid values for one widget parameter (one parameter option query per call).",
            (
                "Only call this after get_widget_schema shows the exact param has "
                "requires_options_lookup=true, and do not invent values for that param."
            ),
        )
    )
    async def get_params_options(
        origin: Annotated[str, Field(description=ORIGIN_PARAM)],
        widget_id: Annotated[
            str,
            Field(
                description=(
                    "Widget type identifier from list_available_widgets or the "
                    "workspace snapshot."
                )
            ),
        ],
        param_name: Annotated[
            str,
            Field(description="Exact paramName from the widget schema."),
        ],
        data_args: Annotated[
            dict[str, Any] | None,
            Field(
                description=(
                    "Object with the values required by the schema's "
                    "options_lookup_params when present."
                )
            ),
        ] = None,
    ) -> ToolResponse:
        """Fetch parameter options from the browser bridge."""
        return await run(
            GetParamOptionsCommand(
                command="get_params_options",
                param_options_queries=param_options_payloads(
                    [
                        ParamOptionsRequest(
                            origin=origin,
                            widget_id=widget_id,
                            param_name=param_name,
                            data_args=data_args or {},
                        )
                    ]
                ),
            )
        )

    @server.tool(
        description=describe_tool(
            "Read one widget from the active dashboard.",
            "Identify the widget by widget_uuid (preferred) or widget_id.",
        )
    )
    async def read_widget(
        widget_uuid: WidgetUuid = None,
        widget_id: WidgetIdFallback = None,
        dashboard_id: DashboardId = None,
    ) -> ToolResponse:
        """Load one widget's current payload from Workspace."""
        guard = require_widget_identifier(
            "read_widget", widget_uuid=widget_uuid, widget_id=widget_id
        )
        if guard is not None:
            return guard
        return await run(
            ReadWidgetCommand(
                command="read_widget",
                widget_uuid=widget_uuid,
                widget_id=widget_id,
                dashboard_id=dashboard_id,
            )
        )

    @server.tool(
        description=describe_tool(
            "Create one widget on a target dashboard.",
            "Use list_available_widgets and get_widget_schema first.",
            "Do not use this for rich_note; use add_generative_widget with widget_type='note'.",
            (
                "Pass dry_run=true to validate and preview effective_params "
                "without changing the workspace."
            ),
        )
    )
    async def create_widget(
        origin: Annotated[str, Field(description=ORIGIN_PARAM)],
        widget_id: Annotated[
            str,
            Field(
                description=(
                    "Widget type identifier from list_available_widgets or the "
                    "workspace snapshot."
                )
            ),
        ],
        dashboard_id: DashboardId = None,
        data_args: Annotated[
            dict[str, Any] | None,
            Field(
                description=("Object of data parameter values from the widget schema.")
            ),
        ] = None,
        ui_args: Annotated[
            dict[str, Any] | None,
            Field(description="Object of UI config values from the widget schema."),
        ] = None,
        dry_run: Annotated[
            bool | None,
            Field(
                description=(
                    "Validate and preview without changing the workspace: returns "
                    "valid, effective_params, and warnings for this exact payload. "
                    "A dry run that finds problems still returns ok=true; the "
                    "verdict is in the data."
                )
            ),
        ] = None,
    ) -> ToolResponse:
        """Create a new Workspace widget."""
        if not origin or not widget_id:
            return invalid_request(
                "create_widget",
                "create_widget requires origin from list_available_widgets and widget_id.",
                details={"required": ["origin", "widget_id"]},
            )
        if is_generative_only_widget(widget_id):
            return invalid_request(
                "create_widget",
                "create_widget does not support 'rich_note'. "
                "Use add_generative_widget with widget_type='note' instead.",
            )
        return await run(
            CreateWidgetCommand(
                command="create_widget",
                dashboard_id=dashboard_id,
                backend_name=origin,
                widget_id=widget_id,
                config=widget_config(
                    data_args=data_args,
                    ui_args=ui_args,
                ),
                dry_run=dry_run,
            )
        )

    @server.tool(
        description=describe_tool(
            "Update one existing widget on a target dashboard.",
            "Identify the widget by widget_uuid (preferred) or widget_id.",
            (
                "Use read_widget first to inspect current params, and verify "
                "effective_params in the response matches your intent."
            ),
            (
                "Config changes only: for placement (x, y, w, h, tab_id) use "
                "update_widget_layout."
            ),
            (
                "Pass dry_run=true to validate and preview effective_params "
                "without changing the workspace."
            ),
        )
    )
    async def update_widget(
        widget_uuid: WidgetUuid = None,
        widget_id: WidgetIdFallback = None,
        dashboard_id: DashboardId = None,
        data_args: Annotated[
            dict[str, Any] | None,
            Field(
                description=("Object of data parameter values from the widget schema.")
            ),
        ] = None,
        ui_args: Annotated[
            dict[str, Any] | None,
            Field(description="Object of UI config values from the widget schema."),
        ] = None,
        dry_run: Annotated[
            bool | None,
            Field(
                description=(
                    "Validate and preview without changing the workspace: returns "
                    "valid, effective_params, and warnings for this exact payload. "
                    "A dry run that finds problems still returns ok=true; the "
                    "verdict is in the data."
                )
            ),
        ] = None,
    ) -> ToolResponse:
        """Update an existing Workspace widget."""
        guard = require_widget_identifier(
            "update_widget", widget_uuid=widget_uuid, widget_id=widget_id
        )
        if guard is not None:
            return guard
        if data_args is None and ui_args is None:
            return invalid_request(
                "update_widget",
                "update_widget requires data_args and/or ui_args; call "
                "get_widget_schema to see valid params.",
                details={"required_one_of": ["data_args", "ui_args"]},
            )
        if has_layout_ui_args(ui_args):
            return invalid_request(
                "update_widget",
                "update_widget only supports widget-instance config changes. "
                "Use update_widget_layout for x, y, w, h, gridData, or tab_id.",
            )
        return await run(
            UpdateWidgetCommand(
                command="update_widget",
                dashboard_id=dashboard_id,
                widget_uuid=widget_uuid,
                widget_id=widget_id,
                config=required_widget_config(
                    data_args=data_args,
                    ui_args=ui_args,
                ),
                dry_run=dry_run,
            )
        )

    @server.tool(
        description=describe_tool(
            "Move or resize one widget in dashboard layout space.",
            "Identify the widget by widget_uuid (preferred) or widget_id.",
            (
                "The layout grid is 40 columns wide: full width is w=40, half width is "
                "w=20, one quarter is w=10. If a navigation_bar is present, first "
                "content usually starts at y=2."
            ),
        )
    )
    async def update_widget_layout(  # noqa: PLR0913, PLR0917
        x: float,
        y: float,
        w: float,
        h: float,
        widget_uuid: WidgetUuid = None,
        widget_id: WidgetIdFallback = None,
        dashboard_id: DashboardId = None,
        tab_id: Annotated[
            str | None,
            Field(
                description=(
                    "Inner tab id from manage_dashboard operation='read' or "
                    "get_workspace_snapshot.dashboard_composition; pass it when "
                    "moving a widget across tabs."
                )
            ),
        ] = None,
        min_w: float | None = None,
        min_h: float | None = None,
        max_w: float | None = None,
        max_h: float | None = None,
    ) -> ToolResponse:
        """Move or resize one widget in dashboard layout space."""
        guard = require_widget_identifier(
            "update_widget_layout", widget_uuid=widget_uuid, widget_id=widget_id
        )
        if guard is not None:
            return guard
        return await run(
            UpdateDashboardLayoutCommand(
                command="update_dashboard_layout",
                dashboard_id=dashboard_id,
                widget_uuid=widget_uuid,
                widget_id=widget_id,
                tab_id=tab_id,
                x=x,
                y=y,
                w=w,
                h=h,
                min_w=min_w,
                min_h=min_h,
                max_w=max_w,
                max_h=max_h,
            )
        )

    @server.tool(
        description=describe_tool(
            "Delete one widget from a target dashboard.",
            "Identify the widget by widget_uuid (preferred) or widget_id.",
        )
    )
    async def delete_widget(
        widget_uuid: WidgetUuid = None,
        widget_id: WidgetIdFallback = None,
        dashboard_id: DashboardId = None,
    ) -> ToolResponse:
        """Delete a Workspace widget."""
        guard = require_widget_identifier(
            "delete_widget", widget_uuid=widget_uuid, widget_id=widget_id
        )
        if guard is not None:
            return guard
        return await run(
            DeleteWidgetCommand(
                command="delete_widget",
                dashboard_id=dashboard_id,
                widget_uuid=widget_uuid,
                widget_id=widget_id,
            )
        )
