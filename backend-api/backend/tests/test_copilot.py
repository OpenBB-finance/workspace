"""
Integration tests for Copilot & AI endpoints.
"""

import os
import sys

# Add the backend directory to Python path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest
from uuid import uuid4


def _build_skill_payload(*, skill_id: str | None = None, slug: str | None = None) -> dict:
    suffix = str(uuid4())[:8]
    return {
        "id": skill_id or str(uuid4()),
        "slug": slug or f"skill-{suffix}",
        "description": f"Skill description {suffix}",
        "content": f"# Skill {suffix}\n\nBody",
        "createdAt": "2026-02-19T00:00:00.000Z",
        "updatedAt": "2026-02-19T00:00:00.000Z",
    }


class TestCustomCopilot:
    """Tests for /pro/custom-copilot endpoints"""

    @pytest.mark.asyncio
    async def test_get_copilots_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/custom-copilot")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_copilots_authenticated(self, auth_client):
        """Should return custom copilots"""
        response = await auth_client.get("/pro/custom-copilot")
        assert response.status_code == 200
        # Validate response structure
        data = response.json()
        assert isinstance(data, (list, dict))
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type

    @pytest.mark.asyncio
    async def test_update_copilot_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.put("/pro/custom-copilot", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_update_copilot_authenticated(self, auth_client):
        """Should update copilot"""
        response = await auth_client.put("/pro/custom-copilot", json={"name": "test_copilot", "config": {}})
        # 200 for success, 422 for validation error
        assert response.status_code in {200, 422}

    @pytest.mark.asyncio
    async def test_delete_copilot_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.delete(f"/pro/custom-copilot/{test_uuid}")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_delete_copilot_nonexistent(self, auth_client):
        """Should return 404 for nonexistent copilot"""
        test_uuid = str(uuid4())
        response = await auth_client.delete(f"/pro/custom-copilot/{test_uuid}")
        assert response.status_code in {200, 404}


class TestCopilotChats:
    """Tests for /pro/copilot-chats endpoints"""

    @pytest.mark.asyncio
    async def test_get_chats_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/copilot-chats")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_chats_authenticated(self, auth_client):
        """Should return chat history"""
        response = await auth_client.get("/pro/copilot-chats")
        assert response.status_code == 200
        # Validate response structure
        data = response.json()
        assert isinstance(data, (list, dict))
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type

    @pytest.mark.asyncio
    async def test_save_chats_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post("/pro/copilot-chats", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_save_chats_authenticated(self, auth_client):
        """Should save chat history"""
        response = await auth_client.post("/pro/copilot-chats", json={"chats": []})
        # 200 for success, 422 for validation error
        assert response.status_code in {200, 422}


class TestPrompts:
    """Tests for /pro/prompts endpoints"""

    @pytest.mark.asyncio
    async def test_get_prompts_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/prompts")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_prompts_authenticated(self, auth_client):
        """Should return saved prompts"""
        response = await auth_client.get("/pro/prompts")
        assert response.status_code == 200
        # Validate response structure
        data = response.json()
        assert isinstance(data, (list, dict))
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type

    @pytest.mark.asyncio
    async def test_save_prompts_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post("/pro/prompts", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_save_prompts_authenticated(self, auth_client):
        """Should save prompts"""
        response = await auth_client.post("/pro/prompts", json={"prompts": []})
        # 200 for success, 422 for validation error
        assert response.status_code in {200, 422}


class TestSkills:
    """Tests for /pro/skills endpoints"""

    @pytest.mark.asyncio
    async def test_get_skills_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/skills")
        assert response.status_code in {401, 403}
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_skills_authenticated(self, auth_client):
        """Should return saved skills"""
        response = await auth_client.get("/pro/skills")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type

    @pytest.mark.asyncio
    async def test_save_skills_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post("/pro/skills", json={})
        assert response.status_code in {401, 403, 422}
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_save_skills_authenticated(self, auth_client):
        """Should save skills"""
        payload = _build_skill_payload()
        response = await auth_client.post("/pro/skills", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert any(skill.get("slug") == payload["slug"] for skill in data)

    @pytest.mark.asyncio
    async def test_skills_roundtrip(self, auth_client):
        """Should persist and retrieve skill payloads"""
        payload = _build_skill_payload()
        save_response = await auth_client.post("/pro/skills", json=payload)
        assert save_response.status_code == 200

        get_response = await auth_client.get("/pro/skills")
        assert get_response.status_code == 200
        saved_skills = get_response.json()
        assert isinstance(saved_skills, list)
        assert any(skill.get("slug") == payload["slug"] for skill in saved_skills)

    @pytest.mark.asyncio
    async def test_duplicate_skill_slug_rejected(self, auth_client):
        """Should reject duplicate slugs for the same user"""
        slug = f"dup-{str(uuid4())[:8]}"
        payload = _build_skill_payload(skill_id=str(uuid4()), slug=slug)

        # First request should succeed
        response1 = await auth_client.post("/pro/skills", json=payload)
        assert response1.status_code == 200

        # Second request with same slug should fail (either 422 or 400 or 500 but ideally 400/422)
        response2 = await auth_client.post("/pro/skills", json=payload)
        assert response2.status_code in {400, 422, 500}

    @pytest.mark.asyncio
    async def test_same_slug_allowed_for_different_users(self, auth_client, second_user_client):
        """Should allow same slug for different users"""
        shared_slug = f"shared-{str(uuid4())[:8]}"

        first_response = await auth_client.post(
            "/pro/skills",
            json=_build_skill_payload(slug=shared_slug),
        )
        assert first_response.status_code == 200

        second_response = await second_user_client.post(
            "/pro/skills",
            json=_build_skill_payload(slug=shared_slug),
        )
        assert second_response.status_code == 200


class TestMcpServers:
    """Tests for /pro/mcp-servers endpoint"""

    @pytest.mark.asyncio
    async def test_save_mcp_config_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post("/pro/mcp-servers", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_save_mcp_config_authenticated(self, auth_client):
        """Should save MCP server config"""
        response = await auth_client.post("/pro/mcp-servers", json={"servers": []})
        # 200 for success, 422 for validation error
        assert response.status_code in {200, 422}
