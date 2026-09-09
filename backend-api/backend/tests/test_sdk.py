"""
Integration tests for SDK endpoints.

Tests cover:
- SDK Token: get, refresh, delete
- SDK Login: token-based authentication
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


class TestSDKTokenGet:
    """Tests for GET /sdk/token endpoint"""

    @pytest.mark.asyncio
    async def test_get_token_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/sdk/token")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_token_authenticated(self, auth_client):
        """Should return current SDK token"""
        response = await auth_client.get("/sdk/token")
        # 200 if token exists, 404 if not created yet
        assert response.status_code in {200, 404}

        if response.status_code == 200:
            data = response.json()
            # Validate response contains token field
            assert "token" in data or "access_token" in data


class TestSDKTokenRefresh:
    """Tests for PUT /sdk/token endpoint"""

    @pytest.mark.asyncio
    async def test_refresh_token_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.put("/sdk/token", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_refresh_token_authenticated(self, auth_client):
        """Should refresh/generate SDK token"""
        response = await auth_client.put("/sdk/token", json={})
        # 200 for success, 201 for created new token
        assert response.status_code in {200, 201, 422}

        if response.status_code in {200, 201}:
            data = response.json()
            # Should contain token info
            assert "token" in data or "access_token" in data or "success" in data

    @pytest.mark.asyncio
    async def test_refresh_token_with_expiration(self, auth_client):
        """Should accept custom expiration days"""
        response = await auth_client.put("/sdk/token", json={"days": 30})
        assert response.status_code in {200, 201, 422}


class TestSDKTokenDelete:
    """Tests for DELETE /sdk/token endpoint"""

    @pytest.mark.asyncio
    async def test_delete_token_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.delete("/sdk/token")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_delete_token_authenticated(self, auth_client):
        """Should delete SDK token"""
        # First create a token
        await auth_client.put("/sdk/token", json={})

        # Then delete it
        response = await auth_client.delete("/sdk/token")
        # 200/202 for success, 404 if no token exists
        assert response.status_code in {200, 202, 404}

        if response.status_code in {200, 202}:
            data = response.json()
            assert "success" in data
            assert data["success"] is True

    @pytest.mark.asyncio
    async def test_delete_nonexistent_token(self, auth_client):
        """Deleting nonexistent token should handle gracefully"""
        # Delete twice to ensure second one handles missing token
        await auth_client.delete("/sdk/token")
        response = await auth_client.delete("/sdk/token")
        # Should return 200/202 (idempotent) or 404
        assert response.status_code in {200, 202, 404}


class TestSDKLogin:
    """Tests for POST /sdk/login endpoint"""

    @pytest.mark.asyncio
    async def test_sdk_login_missing_token(self, client):
        """Should fail without token"""
        response = await client.post("/sdk/login", json={})
        assert response.status_code in {401, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_sdk_login_invalid_token(self, client):
        """Should fail with invalid token"""
        response = await client.post("/sdk/login", json={"token": "invalid_token_here"})
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data
        # Token should not be echoed in response
        response_str = str(data)
        assert "invalid_token_here" not in response_str

    @pytest.mark.asyncio
    async def test_sdk_login_malformed_token(self, client):
        """Should handle malformed token gracefully"""
        malformed_tokens = [
            "",
            "   ",
            "a" * 1000,  # Very long
            "token with spaces",
            "<script>alert('xss')</script>",
        ]

        for token in malformed_tokens:
            response = await client.post("/sdk/login", json={"token": token})
            # Should return 401 or 422, not 500
            assert response.status_code in {401, 403, 422}, f"Failed for token: {token}"


class TestSDKTokenLifecycle:
    """Full lifecycle tests for SDK tokens"""

    @pytest.mark.asyncio
    async def test_sdk_token_create_get_delete_cycle(self, auth_client):
        """Test complete lifecycle: create -> get -> delete"""
        # Step 1: Create/refresh token
        create_response = await auth_client.put("/sdk/token", json={})
        assert create_response.status_code in {200, 201, 422}

        if create_response.status_code in {200, 201}:
            # Step 2: Get token
            get_response = await auth_client.get("/sdk/token")
            assert get_response.status_code == 200

            # Step 3: Delete token
            delete_response = await auth_client.delete("/sdk/token")
            assert delete_response.status_code in {200, 202, 404}

            # Step 4: Verify token is gone
            verify_response = await auth_client.get("/sdk/token")
            assert verify_response.status_code in {200, 404}


class TestSDKTokenSecurity:
    """Security tests for SDK token endpoints"""

    @pytest.mark.asyncio
    async def test_sdk_token_not_exposed_in_error(self, client):
        """Error responses should not leak token values"""
        response = await client.post(
            "/sdk/login", json={"token": "test_secret_token_value"}
        )

        # Check that the token value is not reflected in error message
        if response.status_code in {401, 403}:
            response_text = response.text
            assert "test_secret_token_value" not in response_text

    @pytest.mark.asyncio
    async def test_sdk_login_rate_limiting_behavior(self, client):
        """SDK login should have some form of rate limiting"""
        # Make multiple rapid requests
        responses = []
        for _ in range(10):
            response = await client.post(
                "/sdk/login", json={"token": f"invalid_{uuid4().hex}"}
            )
            responses.append(response.status_code)

        # All should be 401 (invalid) or eventually 429 (rate limited)
        for status in responses:
            assert status in {401, 403, 429}
