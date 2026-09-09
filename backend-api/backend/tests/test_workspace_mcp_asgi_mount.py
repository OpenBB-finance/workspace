from starlette.routing import Mount


def test_workspace_mcp_router_does_not_import_custom_jsonrpc_handler():
    from routers.pro.workspace_mcp import router

    assert not hasattr(router, "handle_mcp_request")


def test_mcp_is_mounted_as_fastmcp_asgi_app():
    from main import app

    root_mounts = [
        route for route in app.routes if isinstance(route, Mount) and not route.path
    ]

    assert len(root_mounts) == 1
    assert isinstance(root_mounts[0], Mount)
    assert any(
        getattr(route, "path", None) == "/mcp" for route in root_mounts[0].app.routes
    )


async def test_mcp_server_uses_sidecar_tool_schema():
    from routers.pro.workspace_mcp.asgi import create_workspace_mcp_server

    server = create_workspace_mcp_server()
    tools = {tool.name: tool for tool in await server.list_tools()}
    schema = tools["get_widget_schema"].parameters

    assert tools["get_widget_schema"].description
    assert schema["additionalProperties"] is False
    assert "required" in schema and schema["required"] == ["origin", "widget_id"]
    assert schema["properties"]["origin"]["type"] == "string"
