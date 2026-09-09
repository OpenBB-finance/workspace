from uuid import UUID

import pytest


def test_workspace_mcp_token_helpers_generate_hash_and_prefix():
    from routers.pro.workspace_mcp.auth import (
        WORKSPACE_MCP_TOKEN_PREFIX,
        display_token_prefix,
        generate_workspace_mcp_token,
        hash_workspace_mcp_token,
    )

    token = generate_workspace_mcp_token()
    other_token = generate_workspace_mcp_token()

    assert token.startswith(WORKSPACE_MCP_TOKEN_PREFIX)
    assert other_token.startswith(WORKSPACE_MCP_TOKEN_PREFIX)
    assert token != other_token
    assert len(token.removeprefix(WORKSPACE_MCP_TOKEN_PREFIX)) >= 43
    assert hash_workspace_mcp_token(token) == hash_workspace_mcp_token(token)
    assert hash_workspace_mcp_token(token) != token
    assert display_token_prefix(token) == token[:20]


def test_workspace_mcp_auth_failure_does_not_advertise_oauth():
    from routers.pro.workspace_mcp.auth import workspace_mcp_credentials_exception

    assert "WWW-Authenticate" not in (workspace_mcp_credentials_exception.headers or {})


@pytest.mark.asyncio
async def test_mcp_endpoint_rejects_missing_and_malformed_auth(client):
    missing = await client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    malformed = await client.post(
        "/mcp",
        headers={"Authorization": "Basic abc"},
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
    )
    unknown = await client.post(
        "/mcp",
        headers={"Authorization": "Bearer obb_mcp_unknown"},
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
    )

    assert missing.status_code == 401
    assert malformed.status_code == 401
    assert unknown.status_code == 401


@pytest.mark.asyncio
async def test_mcp_get_is_not_registered_as_one_shot_transport(client):
    response = await client.get("/mcp")

    assert response.status_code == 405


@pytest.mark.asyncio
async def test_unknown_path_returns_404_not_credential_error(client):
    response = await client.post(
        "/pro/adfasdfasfd",
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
    )

    assert response.status_code == 404
    assert "Could not validate Workspace MCP credentials" not in response.text


@pytest.mark.asyncio
async def test_mcp_endpoint_rejects_revoked_token(auth_client, client):
    create_response = await auth_client.post(
        "/pro/workspace-mcp/tokens",
        json={"name": "Revoked token"},
    )
    token = create_response.json()["token"]
    token_uuid = create_response.json()["uuid"]

    await auth_client.delete(f"/pro/workspace-mcp/tokens/{token_uuid}")

    response = await client.post(
        "/mcp",
        headers={"Authorization": f"Bearer {token}"},
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_mcp_tool_call_with_valid_token_returns_no_browser_connected(auth_client, client):
    create_response = await auth_client.post(
        "/pro/workspace-mcp/tokens",
        json={"name": "Agent"},
    )
    payload = create_response.json()

    assert UUID(payload["uuid"])

    response = await client.post(
        "/mcp",
        headers={"Authorization": f"Bearer {payload['token']}"},
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": "get_workspace_snapshot", "arguments": {}},
        },
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "unavailable"
