"""Dashboard CRUD tool."""

from typing import Annotated

from fastmcp import FastMCP
from pydantic import Field

from workspace_mcp.models import DashboardOperation, ManageDashboardCommand
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
            "Create, read, or update one Workspace dashboard.",
            "Dashboard deletion is not available through this MCP surface.",
            "For create, pass name and optional dashboard_id and activate.",
            "For read, pass optional dashboard_id; omitted dashboard_id targets the current dashboard.",
            (
                "For update, pass name; omitted dashboard_id resolves to the "
                "current dashboard the same way read does."
            ),
        )
    )
    async def manage_dashboard(
        operation: DashboardOperation,
        dashboard_id: Annotated[
            str | None, Field(description=DASHBOARD_ID_PARAM)
        ] = None,
        name: Annotated[
            str | None,
            Field(description="Dashboard display name. Required for create and update."),
        ] = None,
        activate: Annotated[
            bool | None,
            Field(
                description=(
                    "For create: route the browser to the new dashboard "
                    "(default true)."
                )
            ),
        ] = None,
    ) -> ToolResponse:
        """Create, read, or update dashboard metadata and composition."""
        if operation == "create":
            if not name:
                return invalid_request(
                    "manage_dashboard",
                    "manage_dashboard operation='create' requires name.",
                    details={"required": ["name"]},
                )
            return await run(
                ManageDashboardCommand(
                    command="manage_dashboard",
                    operation="create",
                    name=name,
                    dashboard_id=dashboard_id,
                    activate=True if activate is None else activate,
                )
            )
        if operation == "read":
            return await run(
                ManageDashboardCommand(
                    command="manage_dashboard",
                    operation="read",
                    dashboard_id=dashboard_id,
                )
            )
        if operation == "update":
            if name is None:
                return invalid_request(
                    "manage_dashboard",
                    "manage_dashboard operation='update' requires dashboard_id "
                    "and name. Use session_context.current_dashboard_uuid from "
                    "your previous tool result, or call get_workspace_snapshot.",
                    details={"required": ["name"]},
                )
            return await run(
                ManageDashboardCommand(
                    command="manage_dashboard",
                    operation="update",
                    dashboard_id=dashboard_id,
                    name=name,
                )
            )
        return invalid_request(
            "manage_dashboard",
            "manage_dashboard requires operation from {create, read, update}. "
            "Dashboard deletion is not available through this MCP surface.",
            details={"allowed_operations": literal_values(DashboardOperation)},
        )
