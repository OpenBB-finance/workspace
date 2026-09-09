"""FastMCP tool surface for the Workspace sidecar.

This package wires the per-domain tool modules into a single ``FastMCP``
instance. The public entry point is ``create_mcp_server``; the rest of the
re-exports keep ``from workspace_mcp.server import ...`` working for callers
that depend on the original flat-module layout (notably the test suite).
"""

import json
from typing import Any

from fastmcp import FastMCP
from fastmcp.exceptions import ResourceError
from fastmcp.prompts.base import Message
from starlette.types import Lifespan

from workspace_mcp.app_builder import register_app_builder_resources
from workspace_mcp.server._guidance import SERVER_INSTRUCTIONS, describe_tool
from workspace_mcp.server._helpers import (
    RESULT_REF_URI_TEMPLATE,
    CommandRunner,
    ResultOffloadStore,
    ToolResponse,
    data_source_payloads,
    has_layout_ui_args,
    invalid_request,
    is_generative_only_widget,
    param_options_payloads,
    payload_list,
    required_widget_config,
    session_context_prompt_content,
    validate_add_generative_widget_request,
    widget_config,
)
from workspace_mcp.server.tools import (
    agents as agents_tools,
    backends as backends_tools,
    dashboards as dashboards_tools,
    generative as generative_tools,
    navigation as navigation_tools,
    snapshot as snapshot_tools,
    widgets as widgets_tools,
)
from workspace_mcp.state import BridgeSessionManager, BrowserUnavailableError

__all__ = [
    "SERVER_INSTRUCTIONS",
    "ToolResponse",
    "create_mcp_server",
    "data_source_payloads",
    "describe_tool",
    "has_layout_ui_args",
    "invalid_request",
    "is_generative_only_widget",
    "param_options_payloads",
    "payload_list",
    "required_widget_config",
    "session_context_prompt_content",
    "validate_add_generative_widget_request",
    "widget_config",
]


def create_mcp_server(
    state: BridgeSessionManager, lifespan: Lifespan | None = None
) -> FastMCP:
    """Create the Workspace MCP server with the full v1 tool list."""
    server = FastMCP(
        name="OpenBB Workspace MCP",
        instructions=SERVER_INSTRUCTIONS,
        lifespan=lifespan,
    )

    register_app_builder_resources(server)

    offload_store = ResultOffloadStore()

    @server.resource(
        RESULT_REF_URI_TEMPLATE,
        name="Offloaded tool result",
        description=(
            "Full JSON payload of a tool result that was too large to return "
            "inline. Read the result_ref URI from the truncated tool response."
        ),
        mime_type="application/json",
    )
    def offloaded_result(result_id: str) -> str:
        """Serve one offloaded full tool result payload."""
        try:
            data = offload_store.get(result_id)
        except KeyError:
            raise ResourceError(
                f"Offloaded result '{result_id}' is no longer available; only "
                "the most recent offloaded results are kept. Re-run the tool "
                "call to regenerate it."
            ) from None
        return json.dumps(data)

    @server.prompt(
        name="workspace_tool_usage",
        description="Generic guidance for using the OpenBB Workspace MCP tool surface.",
    )
    def workspace_tool_usage() -> list[Message]:
        """Return a compact, generic usage prompt for MCP agents."""
        return [
            Message(SERVER_INSTRUCTIONS, role="user"),
            Message(session_context_prompt_content(state), role="user"),
        ]

    @server.prompt(
        name="workspace_session_context",
        description="Current tracked Workspace dashboard and tab context.",
    )
    def workspace_session_context() -> list[Message]:
        """Return the current tracked Workspace dashboard and tab context."""
        return [Message(session_context_prompt_content(state), role="user")]

    async def run(command: Any) -> ToolResponse:
        try:
            result = await state.execute_command(command)
        except BrowserUnavailableError as error:
            command_name = (
                command.get("command")
                if isinstance(command, dict)
                else getattr(command, "command", None)
            ) or "unknown"
            return {
                "ok": False,
                "command": command_name,
                "request_id": None,
                "message": str(error),
                "data": None,
                "error": {
                    "code": "unavailable",
                    "message": str(error),
                    "details": None,
                    "retryable": False,
                },
                "warnings": [],
            }
        return result.model_dump(mode="json")

    runner: CommandRunner = run

    snapshot_tools.register(server, runner)
    widgets_tools.register(server, runner, offload_store)
    dashboards_tools.register(server, runner)
    navigation_tools.register(server, runner)
    generative_tools.register(server, runner)
    backends_tools.register(server, runner)
    agents_tools.register(server, runner)

    return server
