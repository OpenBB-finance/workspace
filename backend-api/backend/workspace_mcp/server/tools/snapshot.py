"""Workspace snapshot discovery tool."""

from fastmcp import FastMCP

from workspace_mcp.server._guidance import describe_tool
from workspace_mcp.server._helpers import CommandRunner, ToolResponse


def register(server: FastMCP, run: CommandRunner) -> None:
    @server.tool(
        description=describe_tool(
            "Request a fresh OpenBB Workspace snapshot from the connected browser.",
            (
                "Call this first when you need current dashboard state, dashboard "
                "identifiers across the workspace, or skill identifiers."
            ),
            (
                "The snapshot is intentionally compact: use list_available_widgets, "
                "get_widget_schema, and manage_dashboard for deeper follow-up inspection."
            ),
            (
                "dashboard_composition exposes deterministic tabs, layout coordinates, "
                "and groups for the current dashboard."
            ),
            (
                "If snapshot.skills lists a skill relevant to the request, call "
                "get_skill_content with its slug before composing."
            ),
        )
    )
    async def get_workspace_snapshot() -> ToolResponse:
        """Fetch the current workspace snapshot from the connected browser."""
        return await run({"command": "get_workspace_snapshot"})
