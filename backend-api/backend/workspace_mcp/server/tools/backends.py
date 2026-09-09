"""Backend connection management and app-template tools."""

from typing import Annotated

from fastmcp import FastMCP
from pydantic import Field

from workspace_mcp.models import (
    AppsOperation,
    BackendEndpointHeader,
    BackendsOperation,
    ManageAppsCommand,
    ManageBackendsCommand,
)
from workspace_mcp.server._guidance import describe_tool
from workspace_mcp.server._helpers import (
    CommandRunner,
    ToolResponse,
    invalid_request,
    literal_values,
)


def register(server: FastMCP, run: CommandRunner) -> None:
    @server.tool(
        description=describe_tool(
            "Manage Workspace data backends (the connections that power widgets).",
            "For list, returns each backend with id, name, url, status, and widget/app/agent counts.",
            "For add, requires name and url.",
            (
                "For update, requires backend_id and at least one of name, url, "
                "endpoint_headers, or is_openbb_platform."
            ),
            "For refresh, requires backend_id; re-fetches widgets and templates from the backend URL.",
            "For remove, requires backend_id.",
            "To author or debug a custom backend's widgets.json or apps.json, read the "
            "openbb://workspace/app-builder/index resource; it links the specs, minimal "
            "working examples, and validation/common-errors.",
        )
    )
    async def manage_backends(  # noqa: PLR0913, PLR0917
        operation: BackendsOperation,
        backend_id: Annotated[
            str | None,
            Field(
                description=(
                    "Backend UUID from manage_backends operation='list'. Required "
                    "for update, refresh, and remove."
                )
            ),
        ] = None,
        name: Annotated[
            str | None, Field(description="Backend display name.")
        ] = None,
        url: Annotated[str | None, Field(description="Backend base URL.")] = None,
        endpoint_headers: Annotated[
            list[BackendEndpointHeader] | None,
            Field(
                description=(
                    'Array of {"key", "value", "location"} objects where location '
                    'is "headers" (default) or "query".'
                )
            ),
        ] = None,
        validate_widgets: Annotated[
            bool | None,
            Field(
                description=(
                    "For add: defaults to true and surfaces a warning if widgets "
                    "fail to load."
                )
            ),
        ] = None,
        is_openbb_platform: bool | None = None,
    ) -> ToolResponse:
        """List, add, update, refresh, or remove Workspace data backends."""
        allowed_operations = literal_values(BackendsOperation)
        if operation not in allowed_operations:
            return invalid_request(
                "manage_backends",
                "manage_backends requires operation from {list, add, update, refresh, remove}.",
                details={"allowed_operations": allowed_operations},
            )

        if operation == "add":
            if not name or not url:
                return invalid_request(
                    "manage_backends",
                    "manage_backends operation='add' requires name and url.",
                    details={"required": ["name", "url"]},
                )
        elif operation in {"update", "refresh", "remove"}:
            if not backend_id:
                return invalid_request(
                    "manage_backends",
                    f"manage_backends operation='{operation}' requires backend_id.",
                    details={"required": ["backend_id"]},
                )
            if operation == "update" and not (
                name
                or url
                or endpoint_headers is not None
                or is_openbb_platform is not None
            ):
                return invalid_request(
                    "manage_backends",
                    "manage_backends operation='update' requires at least one of "
                    "name, url, endpoint_headers, or is_openbb_platform.",
                    details={
                        "required_one_of": [
                            "name",
                            "url",
                            "endpoint_headers",
                            "is_openbb_platform",
                        ]
                    },
                )

        return await run(
            ManageBackendsCommand(
                command="manage_backends",
                operation=operation,
                backend_id=backend_id,
                name=name,
                url=url,
                endpoint_headers=endpoint_headers,
                validate_widgets=validate_widgets,
                is_openbb_platform=is_openbb_platform,
            )
        )

    @server.tool(
        description=describe_tool(
            "List, read, or instantiate Workspace apps (dashboard templates).",
            "There is no app update or delete through this MCP surface.",
            "Apps bundle tabs, widget layouts, parameter groups, and suggested prompts. "
            "Instantiating one is the programmatic equivalent of clicking an app in the gallery.",
            "For list, apps come from the user's own backends (type='backend'), apps "
            "shared through their organization (type='shared'), and saved apps they "
            "created or that were shared with them (type='saved'). Each app includes "
            "name, template_id, description, type, backend_id, backend_name, "
            "is_shared, and created_by.",
            "For read, requires app_name (or template_id); resolves across all app "
            "sources and returns the full app definition including tabs with layouts "
            "(or widgets for saved apps), parameter groups, and suggested prompts.",
            "For instantiate, requires app_name (or template_id); creates a fresh dashboard "
            "from the app template and returns its dashboard_id. Pass that dashboard_id to "
            "subsequent dashboard-targeting tools.",
            "Apps are defined by the apps.json a backend serves; to author one, read the "
            "openbb://workspace/app-builder/index resource.",
        )
    )
    async def manage_apps(
        operation: AppsOperation,
        backend_id: Annotated[
            str | None,
            Field(
                description=(
                    "For list: omit to return every app the user can see; pass "
                    "backend_id only to filter to one backend (own or shared). Use "
                    "manage_backends operation='list' to discover backend_id values."
                )
            ),
        ] = None,
        app_name: Annotated[
            str | None,
            Field(
                description=(
                    "App name for read and instantiate; either app_name or "
                    "template_id is required."
                )
            ),
        ] = None,
        template_id: Annotated[
            str | None,
            Field(description="App template id; alternative to app_name."),
        ] = None,
        dashboard_name: Annotated[
            str | None,
            Field(description="For instantiate: optional name for the created dashboard."),
        ] = None,
        activate: Annotated[
            bool | None,
            Field(
                description=(
                    "For instantiate: defaults to true and routes the browser to "
                    "the new dashboard."
                )
            ),
        ] = None,
    ) -> ToolResponse:
        """List, read, or instantiate Workspace apps across all app sources."""
        allowed_operations = literal_values(AppsOperation)
        if operation not in allowed_operations:
            return invalid_request(
                "manage_apps",
                "manage_apps requires operation from {list, read, instantiate}.",
                details={"allowed_operations": allowed_operations},
            )
        if operation in {"read", "instantiate"} and not app_name and not template_id:
            return invalid_request(
                "manage_apps",
                f"manage_apps operation='{operation}' requires app_name or template_id.",
                details={"required_one_of": ["app_name", "template_id"]},
            )

        return await run(
            ManageAppsCommand(
                command="manage_apps",
                operation=operation,
                backend_id=backend_id,
                app_name=app_name,
                template_id=template_id,
                dashboard_name=dashboard_name,
                activate=activate,
            )
        )
