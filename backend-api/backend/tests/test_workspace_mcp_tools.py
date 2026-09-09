"""Behavior tests for the Workspace MCP sidecar tool surface.

Covers the WorkspaceBench hardening work: Literal-typed operation params,
required identifiers, sidecar-side guards, warnings passthrough, explicit
empty-config preservation, manage_dashboard update targeting, chart_params
snake_case tolerance, and error envelope completeness.
"""

import json

import pytest
from fastmcp.client import Client
from workspace_mcp.models import (
    BrowserSessionStartRequest,
    WorkspaceCommandResult,
)
from workspace_mcp.server import create_mcp_server
from workspace_mcp.state import BridgeSessionManager


@pytest.fixture(autouse=True)
def mock_external_services():
    yield


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    yield


def make_state(*, command_timeout_seconds: float = 1.0) -> BridgeSessionManager:
    return BridgeSessionManager(
        base_url="http://127.0.0.1:8787",
        websocket_path="/bridge/ws",
        command_timeout_seconds=command_timeout_seconds,
    )


@pytest.fixture
def recorded() -> list:
    return []


@pytest.fixture
def server(recorded):
    """MCP server whose bridge records commands and answers ok."""
    state = make_state()

    async def fake_execute(command):
        recorded.append(command)
        command_name = (
            command.get("command")
            if isinstance(command, dict)
            else getattr(command, "command", "unknown")
        )
        return WorkspaceCommandResult(
            ok=True, command=command_name, message="ok", data={}
        )

    state.execute_command = fake_execute
    return create_mcp_server(state)


def payload(result) -> dict:
    if result.structured_content is not None:
        return result.structured_content
    return json.loads(result.content[0].text)


async def tool_schemas(server) -> dict:
    return {tool.name: tool.parameters for tool in await server.list_tools()}


# ---------------------------------------------------------------------------
# H1: operation enums surfaced in the JSON schema and enforced by FastMCP
# ---------------------------------------------------------------------------


async def test_operation_enums_are_surfaced_in_tool_schemas(server):
    schemas = await tool_schemas(server)

    assert schemas["manage_dashboard"]["properties"]["operation"]["enum"] == [
        "create",
        "read",
        "update",
    ]
    assert schemas["manage_navigation_bar"]["properties"]["operation"]["enum"] == [
        "create",
        "add_tabs",
        "remove_tabs",
        "rename_tabs",
    ]
    assert schemas["navigate_workspace"]["properties"]["operation"]["enum"] == [
        "dashboard",
        "tab",
    ]
    assert schemas["manage_backends"]["properties"]["operation"]["enum"] == [
        "list",
        "add",
        "update",
        "refresh",
        "remove",
    ]
    assert schemas["manage_apps"]["properties"]["operation"]["enum"] == [
        "list",
        "read",
        "instantiate",
    ]
    assert schemas["add_generative_widget"]["properties"]["widget_type"]["enum"] == [
        "note",
        "table",
        "chart",
        "html",
    ]


async def test_invalid_operation_is_rejected_with_allowed_values(server, recorded):
    async with Client(server) as client:
        result = await client.call_tool(
            "manage_dashboard", {"operation": "delete"}, raise_on_error=False
        )

    assert result.is_error
    text = result.content[0].text
    assert "'create', 'read' or 'update'" in text
    assert recorded == []


# ---------------------------------------------------------------------------
# H2: unconditionally required params are schema-required
# ---------------------------------------------------------------------------


async def test_get_widget_schema_and_create_widget_require_origin_and_widget_id(server):
    schemas = await tool_schemas(server)

    assert schemas["get_widget_schema"]["required"] == ["origin", "widget_id"]
    assert schemas["create_widget"]["required"] == ["origin", "widget_id"]


async def test_create_widget_without_origin_is_rejected_by_schema(server, recorded):
    async with Client(server) as client:
        result = await client.call_tool(
            "create_widget", {"widget_id": "w"}, raise_on_error=False
        )

    assert result.is_error
    assert "origin" in result.content[0].text
    assert recorded == []


# ---------------------------------------------------------------------------
# H3: sidecar-side identifier and config guards
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("tool_name", "arguments"),
    [
        ("read_widget", {}),
        ("update_widget", {"data_args": {"symbol": "AAPL"}}),
        ("delete_widget", {}),
        ("update_widget_layout", {"x": 0, "y": 0, "w": 10, "h": 5}),
    ],
)
async def test_widget_tools_require_an_identifier(
    server, recorded, tool_name, arguments
):
    async with Client(server) as client:
        result = await client.call_tool(tool_name, arguments, raise_on_error=False)

    body = payload(result)
    assert body["ok"] is False
    assert body["error"]["code"] == "invalid_request"
    assert (
        f"{tool_name} requires widget_uuid (preferred) or widget_id" in body["message"]
    )
    assert "get_workspace_snapshot.dashboard_composition" in body["message"]
    assert body["error"]["details"] == {"required_one_of": ["widget_uuid", "widget_id"]}
    assert recorded == []


async def test_update_widget_requires_data_args_or_ui_args(server, recorded):
    async with Client(server) as client:
        result = await client.call_tool(
            "update_widget", {"widget_uuid": "uuid-1"}, raise_on_error=False
        )

    body = payload(result)
    assert body["ok"] is False
    assert body["error"]["code"] == "invalid_request"
    assert "update_widget requires data_args and/or ui_args" in body["message"]
    assert "get_widget_schema" in body["message"]
    assert recorded == []


# ---------------------------------------------------------------------------
# H4: warnings passthrough and explicit-empty config preservation
# ---------------------------------------------------------------------------


async def test_bridge_warnings_pass_through_verbatim(recorded):
    state = make_state()

    async def fake_execute(command):
        recorded.append(command)
        return WorkspaceCommandResult(
            ok=True,
            command="manage_dashboard",
            message="ok",
            data={},
            warnings=["dashboard name already in use"],
        )

    state.execute_command = fake_execute
    server = create_mcp_server(state)

    async with Client(server) as client:
        result = await client.call_tool(
            "manage_dashboard", {"operation": "read"}, raise_on_error=False
        )

    assert payload(result)["warnings"] == ["dashboard name already in use"]


async def test_create_widget_preserves_explicit_empty_data_args(server, recorded):
    async with Client(server) as client:
        await client.call_tool(
            "create_widget",
            {"origin": "Backend", "widget_id": "w", "data_args": {}},
            raise_on_error=False,
        )

    command = recorded[0]
    assert command.config is not None
    assert command.config.data_args == {}
    assert command.config.ui_args is None


async def test_create_widget_without_config_sends_no_config(server, recorded):
    async with Client(server) as client:
        await client.call_tool(
            "create_widget",
            {"origin": "Backend", "widget_id": "w"},
            raise_on_error=False,
        )

    assert recorded[0].config is None


async def test_update_widget_preserves_explicit_empty_ui_args(server, recorded):
    async with Client(server) as client:
        await client.call_tool(
            "update_widget",
            {"widget_uuid": "uuid-1", "ui_args": {}},
            raise_on_error=False,
        )

    command = recorded[0]
    assert command.config.ui_args == {}
    assert command.config.data_args is None


# ---------------------------------------------------------------------------
# dry_run: schema presence, forwarding, and guard ordering
# ---------------------------------------------------------------------------


async def test_dry_run_is_present_in_create_and_update_widget_schemas(server):
    schemas = await tool_schemas(server)

    assert "dry_run" in schemas["create_widget"]["properties"]
    assert "dry_run" in schemas["update_widget"]["properties"]


async def test_create_widget_forwards_dry_run_to_bridge_command(server, recorded):
    async with Client(server) as client:
        await client.call_tool(
            "create_widget",
            {"origin": "Backend", "widget_id": "w", "dry_run": True},
            raise_on_error=False,
        )

    assert recorded[0].dry_run is True


async def test_update_widget_forwards_dry_run_to_bridge_command(server, recorded):
    async with Client(server) as client:
        await client.call_tool(
            "update_widget",
            {"widget_uuid": "uuid-1", "data_args": {"symbol": "AAPL"}, "dry_run": True},
            raise_on_error=False,
        )

    assert recorded[0].dry_run is True


async def test_update_widget_guards_still_fire_with_dry_run(server, recorded):
    async with Client(server) as client:
        result = await client.call_tool(
            "update_widget",
            {"data_args": {"symbol": "AAPL"}, "dry_run": True},
            raise_on_error=False,
        )

    body = payload(result)
    assert body["ok"] is False
    assert body["error"]["code"] == "invalid_request"
    assert recorded == []


# ---------------------------------------------------------------------------
# H5: manage_dashboard update resolves omitted dashboard_id like read
# ---------------------------------------------------------------------------


async def test_manage_dashboard_update_forwards_omitted_dashboard_id(server, recorded):
    async with Client(server) as client:
        result = await client.call_tool(
            "manage_dashboard",
            {"operation": "update", "name": "Renamed"},
            raise_on_error=False,
        )

    assert payload(result)["ok"] is True
    command = recorded[0]
    assert command.operation == "update"
    assert command.dashboard_id is None
    assert command.name == "Renamed"


async def test_manage_dashboard_update_without_name_errors_with_context_hint(
    server, recorded
):
    async with Client(server) as client:
        result = await client.call_tool(
            "manage_dashboard", {"operation": "update"}, raise_on_error=False
        )

    body = payload(result)
    assert body["ok"] is False
    assert body["error"]["code"] == "invalid_request"
    assert "session_context.current_dashboard_uuid" in body["message"]
    assert recorded == []


# ---------------------------------------------------------------------------
# H8: chart_params snake_case tolerance
# ---------------------------------------------------------------------------


async def test_add_generative_widget_translates_snake_case_chart_params(
    server, recorded
):
    async with Client(server) as client:
        result = await client.call_tool(
            "add_generative_widget",
            {
                "widget_type": "chart",
                "data": [{"x": 1, "y": 2}],
                "chart_params": {
                    "chart_type": "line",
                    "x_key": "x",
                    "y_key": ["y"],
                    "angle_key": "a",
                },
            },
            raise_on_error=False,
        )

    assert payload(result)["ok"] is True
    assert recorded[0].chart_params == {
        "chartType": "line",
        "xKey": "x",
        "yKey": ["y"],
        "angleKey": "a",
    }


async def test_add_generative_widget_chart_params_still_validated(server, recorded):
    async with Client(server) as client:
        result = await client.call_tool(
            "add_generative_widget",
            {
                "widget_type": "chart",
                "data": [{"x": 1}],
                "chart_params": {"chart_type": "line"},
            },
            raise_on_error=False,
        )

    body = payload(result)
    assert body["ok"] is False
    assert body["error"]["code"] == "invalid_request"
    assert "chartType, xKey, and non-empty yKey" in body["message"]
    assert recorded == []


# ---------------------------------------------------------------------------
# H9: error envelope completeness, structured details, timeout hint
# ---------------------------------------------------------------------------


async def test_browser_unavailable_error_uses_complete_envelope():
    server = create_mcp_server(make_state())

    async with Client(server) as client:
        result = await client.call_tool(
            "manage_dashboard", {"operation": "read"}, raise_on_error=False
        )

    body = payload(result)
    assert body["ok"] is False
    assert body["command"] == "manage_dashboard"
    assert body["request_id"] is None
    assert body["data"] is None
    assert body["warnings"] == []
    assert body["error"]["code"] == "unavailable"
    assert body["error"]["retryable"] is False
    assert body["message"]


async def test_shape_guard_errors_carry_structured_details(server, recorded):
    async with Client(server) as client:
        result = await client.call_tool(
            "manage_navigation_bar",
            {"operation": "add_tabs"},
            raise_on_error=False,
        )

    body = payload(result)
    assert body["error"]["details"] == {"required": ["tabs"]}
    assert recorded == []


async def test_timeout_error_includes_snapshot_hint():
    state = make_state(command_timeout_seconds=0.05)
    start = await state.start_session(
        BrowserSessionStartRequest(client_name="workspace-ui")
    )

    class Socket:
        async def send_json(self, data: object) -> None:
            return None

    await state.connect_browser(
        session_id=start.session.session_id,
        token=start.session.token,
        socket=Socket(),
    )

    result = await state.execute_command({"command": "get_workspace_snapshot"})

    assert result.ok is False
    assert result.error is not None
    assert result.error.code == "timeout"
    assert result.error.retryable is True
    assert "verify identifiers exist via get_workspace_snapshot" in result.message


# ---------------------------------------------------------------------------
# H7: discoverability content
# ---------------------------------------------------------------------------


async def test_not_supported_sentences_present(server):
    tools = {tool.name: tool.description for tool in await server.list_tools()}

    assert (
        "Dashboard deletion is not available through this MCP surface."
        in tools["manage_dashboard"]
    )
    assert (
        "There is no app update or delete through this MCP surface."
        in tools["manage_apps"]
    )
    assert "call get_skill_content with its slug" in tools["get_workspace_snapshot"]
    assert "do not invent them" in tools["assign_tasks_to_agents"]
    assert "one Workspace data source" in tools["get_widget_data"]
    assert "one parameter option query" in tools["get_params_options"]
    assert (
        "Large unfiltered results return a compact index plus a result_ref "
        "resource with the full catalog." in tools["list_available_widgets"]
    )


# ---------------------------------------------------------------------------
# Result offloading: large list_available_widgets catalogs move behind an
# openbb://workspace/results/{result_id} resource with a compact inline index.
# ---------------------------------------------------------------------------

OFFLOAD_ENV = "OPENBB_WORKSPACE_MCP_RESULT_OFFLOAD_THRESHOLD"
RESULT_REF_PREFIX = "openbb://workspace/results/"


def make_catalog_widgets(count: int, *, description_pad: int = 400) -> list[dict]:
    origins = ("Backend A", "Backend B")
    return [
        {
            "origin": origins[index % 2],
            "backend_name": origins[index % 2],
            "backend_id": f"backend-{index % 2}",
            "widget_id": f"widget_{index}",
            "name": f"Widget {index}",
            "description": "x" * description_pad,
            "category": "cat",
            "sub_category": "sub",
            "widget_type": "table",
        }
        for index in range(count)
    ]


def make_catalog_server(widgets: list[dict]):
    state = make_state()

    async def fake_execute(command):
        return WorkspaceCommandResult(
            ok=True,
            command="list_available_widgets",
            message="Available widgets listed.",
            data={"widgets": widgets},
        )

    state.execute_command = fake_execute
    return create_mcp_server(state)


async def test_small_widget_catalog_passes_through_unchanged():
    widgets = make_catalog_widgets(3)
    server = make_catalog_server(widgets)

    async with Client(server) as client:
        result = await client.call_tool(
            "list_available_widgets", {}, raise_on_error=False
        )

    body = payload(result)
    assert body["ok"] is True
    assert body["data"] == {"widgets": widgets}
    assert "truncated" not in body["data"]
    assert "result_ref" not in body["data"]
    assert body["message"] == "Available widgets listed."


async def test_large_widget_catalog_is_offloaded_to_compact_index():
    widgets = make_catalog_widgets(200)
    server = make_catalog_server(widgets)

    async with Client(server) as client:
        result = await client.call_tool(
            "list_available_widgets", {}, raise_on_error=False
        )

    body = payload(result)
    assert body["ok"] is True
    data = body["data"]
    assert set(data) == {
        "widget_count",
        "origins",
        "widgets",
        "truncated",
        "result_ref",
    }
    assert data["widget_count"] == 200
    assert data["truncated"] is True
    assert data["result_ref"].startswith(RESULT_REF_PREFIX)
    assert sorted(data["origins"], key=lambda item: item["origin"]) == [
        {"origin": "Backend A", "count": 100},
        {"origin": "Backend B", "count": 100},
    ]
    assert len(data["widgets"]) == 200
    assert data["widgets"][0] == {
        "origin": "Backend A",
        "widget_id": "widget_0",
        "name": "Widget 0",
    }
    assert all(
        set(entry) == {"origin", "widget_id", "name"} for entry in data["widgets"]
    )
    assert f"Full catalog stored at {data['result_ref']}" in body["message"]
    assert "origin or backend_id filter" in body["message"]
    assert "get_widget_schema" in body["message"]


async def test_offloaded_result_resource_returns_full_original_payload():
    widgets = make_catalog_widgets(200)
    server = make_catalog_server(widgets)

    async with Client(server) as client:
        result = await client.call_tool(
            "list_available_widgets", {}, raise_on_error=False
        )
        ref = payload(result)["data"]["result_ref"]
        contents = await client.read_resource(ref)

    assert json.loads(contents[0].text) == {"widgets": widgets}


async def test_offload_store_evicts_oldest_result_after_fifteen(monkeypatch):
    monkeypatch.setenv(OFFLOAD_ENV, "100")
    server = make_catalog_server(make_catalog_widgets(2))

    async with Client(server) as client:
        refs = []
        for _ in range(16):
            result = await client.call_tool(
                "list_available_widgets", {}, raise_on_error=False
            )
            refs.append(payload(result)["data"]["result_ref"])

        assert len(set(refs)) == 16
        contents = await client.read_resource(refs[-1])
        assert json.loads(contents[0].text)["widgets"]

        with pytest.raises(Exception, match="no longer available"):
            await client.read_resource(refs[0])


async def test_offload_threshold_env_override_is_respected(monkeypatch):
    widgets = make_catalog_widgets(3)
    monkeypatch.setenv(OFFLOAD_ENV, "100")
    server = make_catalog_server(widgets)

    async with Client(server) as client:
        result = await client.call_tool(
            "list_available_widgets", {}, raise_on_error=False
        )

    data = payload(result)["data"]
    assert data["truncated"] is True
    assert data["widget_count"] == 3
    assert data["result_ref"].startswith(RESULT_REF_PREFIX)
