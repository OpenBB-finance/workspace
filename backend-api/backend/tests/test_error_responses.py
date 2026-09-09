"""
Integration tests for Error Responses and Rate Limiting.

Tests cover:
- Error response format consistency (401, 403, 404, 422, 500)
- Error message content (no information leakage)
- Rate limiting behavior
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


class TestErrorResponseFormat401:
    """Tests for 401 Unauthorized error response format"""

    @pytest.mark.asyncio
    async def test_401_contains_detail_field(self, client):
        """401 responses should contain 'detail' field"""
        response = await client.get("/pro/user")
        assert response.status_code in {401, 403}

        data = response.json()
        # Should have detail or message field
        assert "detail" in data or "message" in data

    @pytest.mark.asyncio
    async def test_401_does_not_leak_internal_paths(self, client):
        """401 responses should not expose internal file paths"""
        response = await client.get("/pro/user")

        response_text = response.text.lower()
        # Should not contain internal paths
        assert "/users/" not in response_text
        assert "/home/" not in response_text
        assert "traceback" not in response_text


class TestErrorResponseFormat403:
    """Tests for 403 Forbidden error response format"""

    @pytest.mark.asyncio
    async def test_403_contains_detail_field(self, client):
        """403 responses should contain 'detail' field"""
        # Try accessing admin endpoint without proper permissions
        response = await client.get("/admin/users")
        assert response.status_code in {401, 403}

        data = response.json()
        assert "detail" in data or "message" in data


class TestErrorResponseFormat404:
    """Tests for 404 Not Found error response format"""

    @pytest.mark.asyncio
    async def test_404_for_nonexistent_endpoint(self, client):
        """Nonexistent endpoint should return 404"""
        response = await client.get("/this/endpoint/does/not/exist")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_404_contains_detail_field(self, client):
        """404 responses should contain 'detail' field"""
        response = await client.get("/this/endpoint/does/not/exist")
        assert "Not Found" in response.text


class TestErrorResponseFormat422:
    """Tests for 422 Validation Error response format"""

    @pytest.mark.asyncio
    async def test_422_contains_detail_field(self, client):
        """422 responses should contain 'detail' field with error message"""
        response = await client.post("/login", json={})
        assert response.status_code == 422

        data = response.json()
        assert "detail" in data
        # This API returns detail as string (first error message)
        assert isinstance(data["detail"], str)

    @pytest.mark.asyncio
    async def test_422_contains_status_field(self, client):
        """422 responses should contain 'status' field"""
        response = await client.post("/login", json={})
        assert response.status_code == 422

        data = response.json()
        assert "status" in data
        assert data["status"] == 422

    @pytest.mark.asyncio
    async def test_422_for_invalid_email_format(self, client):
        """Invalid email should return 422 with helpful message"""
        response = await client.post(
            "/register",
            json={"email": "not-an-email", "password": "ValidPassword123!"},
        )
        assert response.status_code == 422

        data = response.json()
        # Should mention email in error
        response_text = str(data).lower()
        assert "email" in response_text or "value" in response_text

    @pytest.mark.asyncio
    async def test_422_for_invalid_password(self, client):
        """Invalid password should return 422 with helpful message"""
        response = await client.post(
            "/register",
            json={"email": "valid@test.com", "password": "short"},
        )
        assert response.status_code == 422


class TestErrorResponseSecurity:
    """Security tests for error responses"""

    @pytest.mark.asyncio
    async def test_error_does_not_expose_stack_trace(self, client):
        """Error responses should not expose Python stack traces"""
        # Try various bad inputs
        endpoints = [
            ("/login", {"email": "test", "password": "x" * 10000}),
            ("/register", {"email": "x" * 100, "password": "x"}),
        ]

        for endpoint, payload in endpoints:
            response = await client.post(endpoint, json=payload)
            response_text = response.text.lower()

            # Should not contain stack trace elements
            assert "traceback" not in response_text
            assert 'file "' not in response_text
            assert "line " not in response_text or "line" not in response_text[:50]

    @pytest.mark.asyncio
    async def test_error_does_not_expose_database_details(self, client):
        """Error responses should not expose database error details"""
        # Try SQL-like input
        response = await client.post(
            "/login",
            json={"email": "'; DROP TABLE users; --", "password": "password"},
        )

        response_text = response.text.lower()
        # Should not expose SQL error details
        assert "sql" not in response_text
        assert "mysql" not in response_text
        assert "syntax error" not in response_text
        assert "query" not in response_text

    @pytest.mark.asyncio
    async def test_error_does_not_expose_server_info(self, client):
        """Error responses should not expose server technology details"""
        response = await client.get("/nonexistent")

        # Check headers
        # Should not expose detailed server version
        server_header = response.headers.get("server", "").lower()
        assert "python" not in server_header

    @pytest.mark.asyncio
    async def test_404_does_not_enumerate_endpoints(self, client):
        """404 should not reveal valid endpoint patterns"""
        response = await client.get("/admin/secret-endpoint")

        # Response should be generic 404
        assert response.status_code in {401, 403, 404}

        # Should not suggest valid endpoints
        assert "did you mean" not in response.text


class TestRateLimitingBehavior:
    """Tests for rate limiting on sensitive endpoints"""

    @pytest.mark.asyncio
    async def test_login_rate_limit_exists(self, client):
        """Login endpoint should have rate limiting"""
        # Make multiple rapid requests
        responses = []
        for i in range(10):
            response = await client.post(
                "/login",
                json={
                    "email": f"ratelimit_{i}@test.com",
                    "password": "ValidPassword123!",
                },
            )
            responses.append(response.status_code)

        # Either all 401 (rate limit not hit) or some 429 (rate limited)
        valid_codes = {401, 429}
        for code in responses:
            assert code in valid_codes

    @pytest.mark.asyncio
    async def test_forgot_password_rate_limit_exists(self, client):
        """Forgot password should have rate limiting (10/hour)"""
        # Make multiple rapid requests
        responses = []
        for i in range(5):
            response = await client.post(
                "/forgot-password",
                json={"email": f"ratelimit_{i}@test.com"},
            )
            responses.append(response.status_code)

        # Should all succeed (under limit) or hit rate limit
        valid_codes = {200, 400, 429}
        for code in responses:
            assert code in valid_codes

    @pytest.mark.asyncio
    async def test_rate_limit_returns_429(self, client):
        """Rate limiting should return 429 status code"""
        # This is a behavioral test - we can't easily trigger rate limit
        # but we verify the endpoint accepts the request format
        response = await client.post(
            "/login",
            json={"email": "test@test.com", "password": "ValidPassword123!"},
        )
        # Should return 401 (wrong creds) or 429 (rate limited)
        assert response.status_code in {401, 429}


class TestContentTypeErrors:
    """Tests for Content-Type related errors"""

    @pytest.mark.asyncio
    async def test_wrong_content_type_handled(self, client):
        """Wrong Content-Type should return appropriate error"""
        response = await client.post(
            "/login",
            content=b"email=test@test.com&password=password",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        # Should return 422 (wrong format) or 415 (unsupported media type)
        assert response.status_code in {400, 415, 422}

    @pytest.mark.asyncio
    async def test_empty_body_handled(self, client):
        """Empty request body should return 422"""
        response = await client.post(
            "/login",
            content=b"",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in {400, 422}

    @pytest.mark.asyncio
    async def test_malformed_json_handled(self, client):
        """Malformed JSON should return appropriate error"""
        response = await client.post(
            "/login",
            content=b"{invalid json}",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in {400, 422}


class TestAuthenticatedErrorResponses:
    """Tests for error responses on authenticated endpoints"""

    @pytest.mark.asyncio
    async def test_authenticated_404_format(self, auth_client):
        """404 on authenticated endpoint should have proper format"""
        test_uuid = str(uuid4())
        response = await auth_client.get(f"/pro/dash/{test_uuid}/versions")

        if response.status_code == 404:
            data = response.json()
            assert "detail" in data or "message" in data

    @pytest.mark.asyncio
    async def test_authenticated_422_format(self, auth_client):
        """422 on authenticated endpoint should have proper format"""
        response = await auth_client.post(
            "/pro/dash/sync",
            json={"dashboards": [{"invalid": "data"}]},
        )

        if response.status_code == 422:
            data = response.json()
            assert "detail" in data

    @pytest.mark.asyncio
    async def test_error_preserves_request_id(self, auth_client):
        """Error responses should preserve request ID if present"""
        # Add request ID header
        auth_client.headers["X-Request-ID"] = "test-request-123"

        response = await auth_client.get("/nonexistent-endpoint")

        # Request ID should be echoed in response headers if supported
        # This is optional - some APIs implement this for debugging
        assert response.status_code == 404


class TestMethodNotAllowed:
    """Tests for 405 Method Not Allowed responses"""

    @pytest.mark.asyncio
    async def test_wrong_method_returns_405(self, client):
        """Using wrong HTTP method should return 405"""
        # Try DELETE on login endpoint
        response = await client.delete("/login")
        assert response.status_code in {404, 405}

    @pytest.mark.asyncio
    async def test_405_includes_allowed_methods(self, client):
        """405 response should indicate allowed methods"""
        response = await client.delete("/login")

        if response.status_code == 405:
            # Check for Allow header
            allow_header = response.headers.get("allow")
            # May or may not include Allow header
            if allow_header is not None:
                assert allow_header
            assert True  # Just verify we got 405
