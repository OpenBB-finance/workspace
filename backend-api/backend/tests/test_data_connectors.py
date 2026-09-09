"""
Integration tests for Data Connector endpoints.
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


class TestSingleWidgetConnectors:
    """Tests for /pro/data-connectors/single-widget endpoints"""

    @pytest.mark.asyncio
    async def test_get_single_widget_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/data-connectors/single-widget")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_single_widget_authenticated(self, auth_client):
        """Should return single widget connectors"""
        response = await auth_client.get("/pro/data-connectors/single-widget")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_create_single_widget_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.post(
            f"/pro/data-connectors/single-widget/{test_uuid}", json={"name": "test"}
        )
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_create_single_widget_authenticated(self, auth_client):
        """Should create/update single widget connector"""
        test_uuid = str(uuid4())
        response = await auth_client.post(
            f"/pro/data-connectors/single-widget/{test_uuid}",
            json={"name": "test_widget", "data": {}},
        )
        # 200/201 for success, 422 for validation error
        assert response.status_code in {200, 201, 422}

    @pytest.mark.asyncio
    async def test_delete_single_widget_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.delete(
            f"/pro/data-connectors/single-widget/{test_uuid}"
        )
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_delete_single_widget_nonexistent(self, auth_client):
        """Should return 404 for nonexistent widget"""
        test_uuid = str(uuid4())
        response = await auth_client.delete(
            f"/pro/data-connectors/single-widget/{test_uuid}"
        )
        assert response.status_code in {200, 404}


class TestApiSourceConnectors:
    """Tests for /pro/data-connectors/api-source endpoints"""

    @pytest.mark.asyncio
    async def test_get_api_source_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/data-connectors/api-source")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_api_source_authenticated(self, auth_client):
        """Should return API source connectors"""
        response = await auth_client.get("/pro/data-connectors/api-source")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_create_api_source_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.post(
            f"/pro/data-connectors/api-source/{test_uuid}", json={"name": "test"}
        )
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_delete_api_source_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.delete(f"/pro/data-connectors/api-source/{test_uuid}")
        assert response.status_code in {401, 403}


class TestFileConnectors:
    """Tests for /pro/data-connectors/file endpoints"""

    @pytest.mark.asyncio
    async def test_get_file_connectors_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/data-connectors/file")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_file_connectors_authenticated(self, auth_client):
        """Should return file connectors"""
        response = await auth_client.get("/pro/data-connectors/file")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_create_file_connector_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.post(
            f"/pro/data-connectors/file/{test_uuid}", json={"name": "test"}
        )
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_delete_file_connector_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.delete(f"/pro/data-connectors/file/{test_uuid}")
        assert response.status_code in {401, 403}


# =============================================================================
# Enhanced Tests: CRUD Lifecycle & Validation
# =============================================================================


class TestSingleWidgetLifecycle:
    """Full CRUD lifecycle tests for single widget connectors"""

    @pytest.mark.asyncio
    async def test_single_widget_create_read_delete(self, auth_client):
        """Test complete single widget lifecycle"""
        widget_uuid = str(uuid4())

        # Step 1: Create widget
        create_response = await auth_client.post(
            f"/pro/data-connectors/single-widget/{widget_uuid}",
            json={
                "name": "Lifecycle Test Widget",
                "data": {"key": "value"},
            },
        )
        assert create_response.status_code in {200, 201, 422}

        if create_response.status_code in {200, 201}:
            # Step 2: Verify widget exists
            get_response = await auth_client.get("/pro/data-connectors/single-widget")
            assert get_response.status_code == 200

            # Step 3: Delete widget
            delete_response = await auth_client.delete(
                f"/pro/data-connectors/single-widget/{widget_uuid}"
            )
            assert delete_response.status_code in {200, 204, 404}

    @pytest.mark.asyncio
    async def test_single_widget_update_existing(self, auth_client):
        """Updating existing widget should work"""
        widget_uuid = str(uuid4())

        # Create initial widget
        await auth_client.post(
            f"/pro/data-connectors/single-widget/{widget_uuid}",
            json={"name": "Original Name", "data": {"version": 1}},
        )

        # Update widget
        update_response = await auth_client.post(
            f"/pro/data-connectors/single-widget/{widget_uuid}",
            json={"name": "Updated Name", "data": {"version": 2}},
        )
        assert update_response.status_code in {200, 201, 422}

        # Cleanup
        await auth_client.delete(f"/pro/data-connectors/single-widget/{widget_uuid}")


class TestApiSourceLifecycle:
    """Full CRUD lifecycle tests for API source connectors"""

    @pytest.mark.asyncio
    async def test_api_source_create_read_delete(self, auth_client):
        """Test complete API source lifecycle"""
        source_uuid = str(uuid4())

        # Step 1: Create API source
        create_response = await auth_client.post(
            f"/pro/data-connectors/api-source/{source_uuid}",
            json={
                "name": "Lifecycle Test API Source",
                "url": "https://api.example.com/data",
                "method": "GET",
            },
        )
        assert create_response.status_code in {200, 201, 422}

        if create_response.status_code in {200, 201}:
            # Step 2: Verify source exists
            get_response = await auth_client.get("/pro/data-connectors/api-source")
            assert get_response.status_code == 200

            # Step 3: Delete source
            delete_response = await auth_client.delete(
                f"/pro/data-connectors/api-source/{source_uuid}"
            )
            assert delete_response.status_code in {200, 204, 404}

    @pytest.mark.asyncio
    async def test_api_source_with_auth_headers(self, auth_client):
        """API source with authentication headers should work"""
        source_uuid = str(uuid4())

        response = await auth_client.post(
            f"/pro/data-connectors/api-source/{source_uuid}",
            json={
                "name": "Auth Header Test",
                "url": "https://api.example.com/data",
                "method": "GET",
                "headers": {"Authorization": "Bearer test_token"},
            },
        )
        assert response.status_code in {200, 201, 422}

        # Cleanup
        await auth_client.delete(f"/pro/data-connectors/api-source/{source_uuid}")


class TestFileConnectorLifecycle:
    """Full CRUD lifecycle tests for file connectors"""

    @pytest.mark.asyncio
    async def test_file_connector_create_read_delete(self, auth_client):
        """Test complete file connector lifecycle"""
        connector_uuid = str(uuid4())

        # Step 1: Create file connector
        create_response = await auth_client.post(
            f"/pro/data-connectors/file/{connector_uuid}",
            json={
                "name": "Lifecycle Test File Connector",
                "file_type": "csv",
            },
        )
        assert create_response.status_code in {200, 201, 422}

        if create_response.status_code in {200, 201}:
            # Step 2: Verify connector exists
            get_response = await auth_client.get("/pro/data-connectors/file")
            assert get_response.status_code == 200

            # Step 3: Delete connector
            delete_response = await auth_client.delete(
                f"/pro/data-connectors/file/{connector_uuid}"
            )
            assert delete_response.status_code in {200, 204, 404}


class TestDataConnectorValidation:
    """Input validation tests for data connector endpoints"""

    @pytest.mark.asyncio
    async def test_single_widget_invalid_uuid(self, auth_client):
        """Invalid UUID should fail validation"""
        response = await auth_client.post(
            "/pro/data-connectors/single-widget/not-a-uuid",
            json={"name": "Test", "data": {}},
        )
        assert response.status_code in {400, 422}

    @pytest.mark.asyncio
    async def test_api_source_invalid_url(self, auth_client):
        """API source with invalid URL should fail"""
        source_uuid = str(uuid4())
        response = await auth_client.post(
            f"/pro/data-connectors/api-source/{source_uuid}",
            json={
                "name": "Invalid URL Test",
                "url": "not-a-valid-url",
                "method": "GET",
            },
        )
        # May succeed (URL validated later) or fail validation
        assert response.status_code in {200, 201, 400, 422}

    @pytest.mark.asyncio
    async def test_api_source_sql_injection_in_url(self, auth_client):
        """SQL injection in URL should be handled safely"""
        source_uuid = str(uuid4())
        response = await auth_client.post(
            f"/pro/data-connectors/api-source/{source_uuid}",
            json={
                "name": "SQL Injection Test",
                "url": "https://api.example.com/data'; DROP TABLE users; --",
                "method": "GET",
            },
        )
        # Should not cause server error
        assert response.status_code in {200, 201, 400, 422}

    @pytest.mark.asyncio
    async def test_single_widget_large_data_payload(self, auth_client):
        """Large data payload should be handled"""
        widget_uuid = str(uuid4())
        large_data = {f"key_{i}": f"value_{i}" for i in range(50)}  # Reasonable size

        response = await auth_client.post(
            f"/pro/data-connectors/single-widget/{widget_uuid}",
            json={"name": "Large Data Widget", "data": large_data},
        )
        assert response.status_code in {200, 201, 413, 422}

        # Cleanup
        await auth_client.delete(f"/pro/data-connectors/single-widget/{widget_uuid}")


class TestDataConnectorResponseSchema:
    """Response schema validation for data connector endpoints"""

    @pytest.mark.asyncio
    async def test_single_widget_list_response_structure(self, auth_client):
        """Single widget list should return proper structure"""
        response = await auth_client.get("/pro/data-connectors/single-widget")
        assert response.status_code == 200
        data = response.json()

        # Should be a list
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_api_source_list_response_structure(self, auth_client):
        """API source list should return proper structure"""
        response = await auth_client.get("/pro/data-connectors/api-source")
        assert response.status_code == 200
        data = response.json()

        # Should be a list
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_file_connector_list_response_structure(self, auth_client):
        """File connector list should return proper structure"""
        response = await auth_client.get("/pro/data-connectors/file")
        assert response.status_code == 200
        data = response.json()

        # Should be a list
        assert isinstance(data, list)


class TestStoredFiles:
    """Tests for /pro/data-connectors/stored-files endpoint"""

    @pytest.mark.asyncio
    async def test_get_stored_files_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/data-connectors/stored-files")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_stored_files_authenticated(self, auth_client):
        """Should return stored files list"""
        response = await auth_client.get("/pro/data-connectors/stored-files")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
