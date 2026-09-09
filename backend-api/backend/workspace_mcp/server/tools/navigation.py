"""Navigation-bar mutation and route navigation tools."""

from typing import Annotated

from fastmcp import FastMCP
from pydantic import Field

from workspace_mcp.models import (
    ManageNavigationBarCommand,
    NavigateWorkspaceCommand,
    NavigationOperation,
    NavigationTabInput,
    WorkspaceNavigationOperation,
)
from workspace_mcp.server._guidance import DASHBOARD_ID_PARAM, describe_tool
from workspace_mcp.server._helpers import (
    CommandRunner,
    ToolResponse,
    invalid_request,
    literal_values,
)


def register(server: FastMCP, run: CommandRunner) -> None:
    @server.tool(
        description=describe_tool(
            "Create or mutate navigation tabs on an existing dashboard's navigation_bar widget.",
            (
                "If the dashboard does not already have a navigation_bar widget, "
                "call operation='create' first; it creates or initializes "
                "navigation tabs on that dashboard and does not create a dashboard."
            ),
            (
                "After add_tabs, navigate_workspace to the generated slug tab_id, "
                "e.g. AAPL Analysis -> aapl-analysis, before creating content for "
                "that tab."
            ),
        )
    )
    async def manage_navigation_bar(
        operation: NavigationOperation,
        dashboard_id: Annotated[
            str | None, Field(description=DASHBOARD_ID_PARAM)
        ] = None,
        tabs: Annotated[
            list[NavigationTabInput] | None,
            Field(
                description=(
                    'Array of {"name": ...} objects, for example '
                    '[{"name":"AAPL Analysis"}]; name is the only key (tab_id and '
                    "tab_name are rejected) and tab_id is generated as the slug "
                    'of name. Not a string array such as ["AAPL Analysis"]. '
                    "Required for create, add_tabs, and remove_tabs."
                )
            ),
        ] = None,
        rename_map: Annotated[
            dict[str, str] | None,
            Field(
                description=(
                    "Object mapping existing tab_id to new display name, for "
                    'example {"old-tab-id":"New Name"}. Required for rename_tabs. '
                    "Renaming changes the display label only; the tab_id keeps "
                    "its original slug."
                )
            ),
        ] = None,
    ) -> ToolResponse:
        """Create tabs or update navigation tab metadata."""
        allowed_operations = literal_values(NavigationOperation)
        if operation not in allowed_operations:
            return invalid_request(
                "manage_navigation_bar",
                "manage_navigation_bar requires operation from {create, add_tabs, remove_tabs, rename_tabs}.",
                details={"allowed_operations": allowed_operations},
            )
        tabs_payload = [tab.model_dump() for tab in (tabs or [])]
        rename_map_payload = rename_map or {}
        if operation in {"create", "add_tabs", "remove_tabs"} and not tabs_payload:
            return invalid_request(
                "manage_navigation_bar",
                f"manage_navigation_bar operation='{operation}' requires tabs.",
                details={"required": ["tabs"]},
            )
        if operation == "rename_tabs" and not rename_map_payload:
            return invalid_request(
                "manage_navigation_bar",
                "manage_navigation_bar operation='rename_tabs' requires rename_map.",
                details={"required": ["rename_map"]},
            )
        return await run(
            ManageNavigationBarCommand(
                command="manage_navigation_bar",
                dashboard_id=dashboard_id,
                operation=operation,
                tabs=tabs_payload,
                rename_map=rename_map_payload,
            )
        )

    @server.tool(
        description=describe_tool(
            "Navigate the Workspace browser to an existing dashboard or inner tab.",
            "For operation='dashboard', pass dashboard_id and optional tab_id.",
            (
                "For operation='tab', pass tab_id and optional dashboard_id; "
                "omitted dashboard_id targets the current dashboard route."
            ),
        )
    )
    async def navigate_workspace(
        operation: WorkspaceNavigationOperation,
        dashboard_id: Annotated[
            str | None, Field(description=DASHBOARD_ID_PARAM)
        ] = None,
        tab_id: Annotated[
            str | None,
            Field(
                description=(
                    "Inner tab slug id, e.g. aapl-analysis. Required for "
                    "operation='tab'."
                )
            ),
        ] = None,
    ) -> ToolResponse:
        """Navigate to a dashboard route or switch an inner tab."""
        if operation == "dashboard":
            if not dashboard_id:
                return invalid_request(
                    "navigate_workspace",
                    "navigate_workspace operation='dashboard' requires dashboard_id.",
                    details={"required": ["dashboard_id"]},
                )
            return await run(
                NavigateWorkspaceCommand(
                    command="navigate_workspace",
                    operation="dashboard",
                    dashboard_id=dashboard_id,
                    tab_id=tab_id,
                )
            )
        if operation == "tab":
            if not tab_id:
                return invalid_request(
                    "navigate_workspace",
                    "navigate_workspace operation='tab' requires tab_id.",
                    details={"required": ["tab_id"]},
                )
            return await run(
                NavigateWorkspaceCommand(
                    command="navigate_workspace",
                    operation="tab",
                    tab_id=tab_id,
                    dashboard_id=dashboard_id,
                )
            )
        return invalid_request(
            "navigate_workspace",
            "navigate_workspace requires operation from {dashboard, tab}.",
            details={"allowed_operations": literal_values(WorkspaceNavigationOperation)},
        )
