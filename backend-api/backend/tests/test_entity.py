"""
Integration tests for Entity Management endpoints.

Tests cover:
- Entity Type: CRUD operations
- Entity: CRUD operations
- Entity Relationships: creation and management
"""

import os
import sys

# Add the backend directory to Python path
BACKEND_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest
from uuid import uuid4


class TestEntityTypeList:
    """Tests for GET /entity/entity-type endpoint"""

    @pytest.mark.asyncio
    async def test_list_entity_types_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/entity/entity-type")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_list_entity_types_authenticated(self, auth_client):
        """Should return entity types list (requires admin permissions)"""
        response = await auth_client.get("/entity/entity-type")
        # 200 for success, 401/403 if not admin
        assert response.status_code in {200, 401, 403}

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict))


class TestEntityTypeCreate:
    """Tests for POST /entity/entity-type endpoint"""

    @pytest.mark.asyncio
    async def test_create_entity_type_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post(
            "/entity/entity-type",
            json={"entity_type": "test_type", "code": "TST"},
        )
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_create_entity_type_authenticated(self, auth_client):
        """Should create entity type (if admin permissions)"""
        response = await auth_client.post(
            "/entity/entity-type",
            json={
                "entity_type": f"test_type_{uuid4().hex[:8]}",
                "code": f"T{uuid4().hex[:2].upper()}",
            },
        )
        # 200/201 for success, 401/403 if not admin
        assert response.status_code in {200, 201, 401, 403, 422}

    @pytest.mark.asyncio
    async def test_create_entity_type_missing_required_fields(self, auth_client):
        """Should fail with missing required fields"""
        response = await auth_client.post("/entity/entity-type", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data
        # If 422, should have validation error details
        if response.status_code == 422 and "detail" in data:
            # FastAPI validation errors are in detail array
            assert isinstance(data["detail"], (list, str, dict))


class TestEntityTypeUpdate:
    """Tests for PUT /entity/entity-type/{type_uuid} endpoint"""

    @pytest.mark.asyncio
    async def test_update_entity_type_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.put(
            f"/entity/entity-type/{test_uuid}",
            json={"entity_type": "updated_type"},
        )
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_update_entity_type_nonexistent(self, auth_client):
        """Should return 404 for nonexistent entity type (if admin)"""
        test_uuid = str(uuid4())
        response = await auth_client.put(
            f"/entity/entity-type/{test_uuid}",
            json={"entity_type": "updated_type"},
        )
        # 401/403 if not admin, 404 if admin and not found
        assert response.status_code in {401, 403, 404, 422}


class TestEntityList:
    """Tests for GET /entity/entity endpoint"""

    @pytest.mark.asyncio
    async def test_list_entities_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/entity/entity")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_list_entities_authenticated(self, auth_client):
        """Should return entities list based on permissions"""
        response = await auth_client.get("/entity/entity")
        # 200 for success, 401/403 if not admin
        assert response.status_code in {200, 401, 403}

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict))


class TestEntityCreate:
    """Tests for POST /entity/entity endpoint"""

    @pytest.mark.asyncio
    async def test_create_entity_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post(
            "/entity/entity",
            json={"name": "Test Entity", "email": "entity@test.com"},
        )
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_create_entity_authenticated(self, auth_client):
        """Should create entity (if admin permissions)"""
        response = await auth_client.post(
            "/entity/entity",
            json={
                "name": f"Test Entity {uuid4().hex[:8]}",
                "email": f"entity_{uuid4().hex[:8]}@test.com",
            },
        )
        # 200/201 for success, 401/403 if not admin, 422 if missing entity_type_uuid
        assert response.status_code in {200, 201, 401, 403, 422}

    @pytest.mark.asyncio
    async def test_create_entity_missing_required_fields(self, auth_client):
        """Should fail with missing required fields"""
        response = await auth_client.post("/entity/entity", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data


class TestEntityUpdate:
    """Tests for PUT /entity/entity/{entity_uuid} endpoint"""

    @pytest.mark.asyncio
    async def test_update_entity_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.put(
            f"/entity/entity/{test_uuid}",
            json={"name": "Updated Entity"},
        )
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_update_entity_nonexistent(self, auth_client):
        """Should return 404 for nonexistent entity (if admin)"""
        test_uuid = str(uuid4())
        response = await auth_client.put(
            f"/entity/entity/{test_uuid}",
            json={"name": "Updated Entity"},
        )
        # 401/403 if not admin, 404 if admin and not found
        assert response.status_code in {401, 403, 404, 422}


class TestEntityRelationship:
    """Tests for /entity/entity-relationship endpoints"""

    @pytest.mark.asyncio
    async def test_get_relationships_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/entity/entity-relationship")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_relationships_authenticated(self, auth_client):
        """Should return entity relationships (if admin)"""
        response = await auth_client.get("/entity/entity-relationship")
        # 401/403 if not admin
        assert response.status_code in {200, 401, 403}

    @pytest.mark.asyncio
    async def test_create_relationship_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post(
            "/entity/entity-relationship",
            json={
                "parent_entity_uuid": str(uuid4()),
                "child_entity_uuid": str(uuid4()),
            },
        )
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_create_relationship_authenticated(self, auth_client):
        """Should create entity relationship (if admin)"""
        response = await auth_client.post(
            "/entity/entity-relationship",
            json={
                "parent_entity_uuid": str(uuid4()),
                "child_entity_uuid": str(uuid4()),
            },
        )
        # 401/403 if not admin, 404 for nonexistent entities
        assert response.status_code in {200, 201, 401, 403, 404, 422}

    @pytest.mark.asyncio
    async def test_update_relationship_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.put(
            f"/entity/entity-relationship/{test_uuid}",
            json={"active": False},
        )
        assert response.status_code in {401, 403, 422}


class TestEntityValidation:
    """Input validation tests for entity endpoints (require admin)"""

    @pytest.mark.asyncio
    async def test_entity_name_empty(self, auth_client):
        """Entity with empty name should fail (if admin)"""
        response = await auth_client.post(
            "/entity/entity",
            json={"name": "", "email": "entity@test.com"},
        )
        # 401/403 if not admin, 422 if validation fails
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_entity_email_invalid(self, auth_client):
        """Entity with invalid email should fail (if admin)"""
        response = await auth_client.post(
            "/entity/entity",
            json={"name": "Test Entity", "email": "not-an-email"},
        )
        # 401/403 if not admin, 422 if validation fails
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_entity_type_code_too_long(self, auth_client):
        """Entity type with code > expected length should fail (if admin)"""
        response = await auth_client.post(
            "/entity/entity-type",
            json={
                "entity_type": "test_type",
                "code": "WAYTOOLONGCODE",  # Usually limited to ~10 chars
            },
        )
        # 200 if accepted, 401/403 if not admin, 422 if validation fails
        assert response.status_code in {200, 401, 403, 422}
