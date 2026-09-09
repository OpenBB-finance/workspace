from uuid import UUID

import pytest


def test_personal_access_token_model_is_importable():
    from api.models import PersonalAccessToken

    assert PersonalAccessToken.__tablename__ == "personal_access_token"


@pytest.mark.asyncio
async def test_create_list_and_revoke_workspace_mcp_token(auth_client):
    create_response = await auth_client.post(
        "/pro/workspace-mcp/tokens",
        json={"name": "Claude Desktop"},
    )

    assert create_response.status_code == 200
    created = create_response.json()
    assert UUID(created["uuid"])
    assert created["name"] == "Claude Desktop"
    assert created["token_type"] == "workspace_mcp"
    assert created["token"].startswith("obb_mcp_")
    assert created["token_prefix"] == created["token"][:20]
    assert "token_hash" not in created

    list_response = await auth_client.get("/pro/workspace-mcp/tokens")

    assert list_response.status_code == 200
    tokens = list_response.json()
    assert len(tokens) == 1
    assert tokens[0]["uuid"] == created["uuid"]
    assert tokens[0]["name"] == "Claude Desktop"
    assert tokens[0]["token_prefix"] == created["token_prefix"]
    assert "token" not in tokens[0]
    assert "token_hash" not in tokens[0]

    revoke_response = await auth_client.delete(
        f"/pro/workspace-mcp/tokens/{created['uuid']}"
    )

    assert revoke_response.status_code == 204

    list_after_revoke = await auth_client.get("/pro/workspace-mcp/tokens")

    assert list_after_revoke.status_code == 200
    assert list_after_revoke.json() == []
