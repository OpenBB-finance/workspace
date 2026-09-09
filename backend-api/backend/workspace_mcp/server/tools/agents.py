"""Agent task delegation and skill content tools."""

from typing import Annotated

from fastmcp import FastMCP
from pydantic import Field

from workspace_mcp.models import (
    AssignTasksToAgentsCommand,
    GetSkillContentCommand,
    TaskRequest,
)
from workspace_mcp.server._guidance import describe_tool
from workspace_mcp.server._helpers import CommandRunner, ToolResponse


def register(server: FastMCP, run: CommandRunner) -> None:
    @server.tool(
        description=describe_tool(
            "Assign tasks to configured external Workspace agents.",
            (
                "Get assigned_holder_url and assigned_agent_id from "
                "get_workspace_snapshot; do not invent them."
            ),
        )
    )
    async def assign_tasks_to_agents(
        task_requests: Annotated[
            list[TaskRequest],
            Field(
                description=(
                    "Array of objects shaped like {id, description, "
                    "assigned_holder_url, assigned_agent_id}."
                )
            ),
        ],
    ) -> ToolResponse:
        """Delegate work to Workspace agents through the browser bridge."""
        return await run(
            AssignTasksToAgentsCommand(
                command="assign_tasks_to_agents",
                task_requests=[task.model_dump() for task in task_requests],
            )
        )

    @server.tool(
        description=describe_tool(
            "Load one skill body from the Workspace skill library.",
        )
    )
    async def get_skill_content(
        slug: Annotated[
            str,
            Field(
                description=(
                    "Exact skill slug from the latest workspace snapshot "
                    "(snapshot.skills)."
                )
            ),
        ],
        reason: str | None = None,
    ) -> ToolResponse:
        """Load one skill from Workspace's skill library."""
        return await run(
            GetSkillContentCommand(
                command="get_skill_content",
                slug=slug,
                reason=reason,
            )
        )
