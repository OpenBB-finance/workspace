"""Generated note/table/chart/HTML widget tool."""

from typing import Annotated, Any

from fastmcp import FastMCP
from pydantic import Field

from workspace_mcp.models import AddGenerativeWidgetCommand, GenerativeWidgetType
from workspace_mcp.server._guidance import DASHBOARD_ID_PARAM, describe_tool
from workspace_mcp.server._helpers import (
    CommandRunner,
    ToolResponse,
    invalid_request,
    literal_values,
    normalize_chart_params,
    validate_add_generative_widget_request,
)


def register(server: FastMCP, run: CommandRunner) -> None:
    @server.tool(
        description=describe_tool(
            "Create a generated note, table, chart, or HTML widget from inline content.",
            "The response includes widget_uuid; use that UUID for layout changes.",
            (
                "To place the widget on a new tab, first call manage_navigation_bar "
                "operation='add_tabs', then navigate_workspace to the generated "
                "slug tab_id, then call this tool without inner_tab."
            ),
        )
    )
    async def add_generative_widget(  # noqa: PLR0913, PLR0917
        widget_type: Annotated[
            GenerativeWidgetType,
            Field(
                description=(
                    "Use widget_type='note' for rich text notes such as rich_note."
                )
            ),
        ],
        dashboard_id: Annotated[
            str | None, Field(description=DASHBOARD_ID_PARAM)
        ] = None,
        data: Annotated[
            str | list[dict[str, Any]] | None,
            Field(
                description=(
                    "Content payload. For note and html: the raw text or HTML "
                    "content string. For table and chart: an array of objects."
                )
            ),
        ] = None,
        name: Annotated[
            str | None, Field(description="Display name for the new widget.")
        ] = None,
        description: Annotated[
            str | None, Field(description="Short description for the new widget.")
        ] = None,
        chart_params: Annotated[
            dict[str, Any] | None,
            Field(
                description=(
                    "Required for chart widgets: object with camelCase keys "
                    "chartType, xKey, yKey (non-empty array of strings), and optional "
                    "angleKey/calloutLabelKey. snake_case aliases (chart_type, "
                    "x_key, y_key, angle_key, callout_label_key) are accepted "
                    "and translated."
                )
            ),
        ] = None,
        inner_tab: Annotated[
            str | None,
            Field(
                description=(
                    "Places the new widget on an existing navigation tab only; "
                    "it does not create a tab."
                )
            ),
        ] = None,
    ) -> ToolResponse:
        """Create a generative widget from inline content."""
        allowed_widget_types = literal_values(GenerativeWidgetType)
        if widget_type not in allowed_widget_types:
            return invalid_request(
                "add_generative_widget",
                "add_generative_widget requires widget_type from {note, table, chart, html}.",
                details={"allowed_widget_types": allowed_widget_types},
            )
        chart_params = normalize_chart_params(chart_params)
        payload_error = validate_add_generative_widget_request(
            widget_type=widget_type,
            data=data,
            chart_params=chart_params,
        )
        if payload_error:
            return invalid_request(
                "add_generative_widget",
                payload_error,
                details={"widget_type": widget_type},
            )
        return await run(
            AddGenerativeWidgetCommand(
                command="add_generative_widget",
                dashboard_id=dashboard_id,
                widget_type=widget_type,
                data=data,
                name=name,
                description=description,
                chart_params=chart_params,
                inner_tab=inner_tab,
            )
        )
