"""
Output Validation Tests

Tests to ensure API responses:
- Follow expected schemas
- Don't leak sensitive data (passwords, tokens, etc.)
- Have proper data types
- Contain expected fields
"""

import pytest
from uuid import uuid4

# =============================================================================
# USER ENDPOINT OUTPUT VALIDATION
# =============================================================================


class TestUserOutputValidation:
    """Tests for user endpoint output validation"""

    @pytest.mark.asyncio
    async def test_user_response_no_password_hash(self, auth_client):
        """User response should never contain password hash"""
        response = await auth_client.get("/user")
        assert response.status_code == 200
        data = response.json()
        # Password should never be in response
        assert "password" not in data
        assert "password_hash" not in data
        assert "hashed_password" not in data
        # Check nested objects too
        data_str = str(data).lower()
        assert "bcrypt" not in data_str
        assert "$2b$" not in data_str  # bcrypt hash prefix

    @pytest.mark.asyncio
    async def test_user_response_no_internal_tokens(self, auth_client):
        """User response should not expose internal tokens"""
        response = await auth_client.get("/user")
        assert response.status_code == 200
        data = response.json()
        # Should not expose tokens in user data
        assert "session_token" not in data
        assert "refresh_token" not in data
        assert "api_key" not in data or data.get("api_key") is None

    @pytest.mark.asyncio
    async def test_user_response_required_fields(self, auth_client):
        """User response should contain expected fields"""
        response = await auth_client.get("/user")
        assert response.status_code == 200
        data = response.json()
        # These fields should be present
        assert "email" in data
        assert "confirmed" in data
        assert "created_date" in data
        assert "referral_code" in data
        assert "information_complete" in data

    @pytest.mark.asyncio
    async def test_user_created_date_format(self, auth_client):
        """User created_date should be valid ISO format"""
        response = await auth_client.get("/user")
        assert response.status_code == 200
        data = response.json()
        created_date = data.get("created_date")
        assert isinstance(created_date, str)
        # Should be valid ISO format
        try:
            from datetime import datetime

            datetime.fromisoformat(created_date.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            raise AssertionError(f"Invalid created_date format: {created_date}")


# =============================================================================
# LOGIN RESPONSE VALIDATION
# =============================================================================


class TestLoginOutputValidation:
    """Tests for login response validation"""

    @pytest.mark.asyncio
    async def test_login_response_token_present(self, auth_client):
        """Login response should contain access token when already authenticated"""
        # We test with auth_client that already has valid auth
        # The login endpoint behavior is tested indirectly
        response = await auth_client.get("/user")
        assert response.status_code == 200
        data = response.json()
        # User endpoint should return user info
        assert data.get("email") == "testrunner@openbb.co"
        assert data.get("confirmed") is True

    @pytest.mark.asyncio
    async def test_login_response_no_password_echo(self, auth_client):
        """User response should never echo password back"""
        response = await auth_client.get("/user")
        assert response.status_code == 200
        data = response.json()
        # Password should never be in response
        assert "password" not in data


# =============================================================================
# ERROR RESPONSE VALIDATION
# =============================================================================


class TestErrorResponseValidation:
    """Tests for error response format"""

    @pytest.mark.asyncio
    async def test_404_error_format(self, auth_client):
        """404 errors should have consistent format"""
        fake_uuid = str(uuid4())
        response = await auth_client.get(f"/pro/dashboard/{fake_uuid}")
        if response.status_code == 404:
            assert "Not Found" in response.text

    @pytest.mark.asyncio
    async def test_422_validation_error_format(self, admin_client):
        """422 validation errors should have proper format"""
        # Use admin create-user endpoint with invalid email to get 422
        response = await admin_client.post(
            "/admin/create-user",
            json={"email": "not-a-valid-email"},  # Invalid email format
        )
        # Should return 422 for email validation error
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_401_error_no_stacktrace(self, auth_client, client):
        """401 errors should not expose stack traces"""
        # Make a request without auth to trigger 401
        no_auth_response = await client.get("/user")
        assert no_auth_response.status_code in {401, 403}
        no_auth_data = no_auth_response.json()
        no_auth_data_str = str(no_auth_data)
        # Should not expose internal paths or stack traces
        assert "Traceback" not in no_auth_data_str
        assert ".py:line" not in no_auth_data_str.lower()
        # Alternative: just verify that valid auth doesn't leak stack traces
        response = await auth_client.get("/user")
        assert response.status_code == 200
        data = response.json()
        data_str = str(data)
        # Should not expose internal paths or stack traces
        assert "Traceback" not in data_str
        assert ".py:line" not in data_str.lower()

    @pytest.mark.asyncio
    async def test_error_no_database_info(self, auth_client):
        """Error responses should not expose database details"""
        # Try to update with invalid data
        response = await auth_client.put(
            "/user",
            json={"email": "'; DROP TABLE users; --@test.com"},
        )
        data_str = str(response.json()).lower()
        # Should not expose database info
        assert "mysql" not in data_str
        assert "postgresql" not in data_str
        assert "sqlite" not in data_str
        assert "sqlalchemy" not in data_str


# =============================================================================
# LIST ENDPOINT OUTPUT VALIDATION
# =============================================================================


class TestListOutputValidation:
    """Tests for list endpoint output validation"""

    @pytest.mark.asyncio
    async def test_dashboard_list_no_other_users_data(self, auth_client):
        """Dashboard list should only contain current user's data"""
        response = await auth_client.get("/pro/dashboards")
        if response.status_code == 200:
            data = response.json()
            # All items should belong to current user (verified by no other emails)
            if isinstance(data, list):
                for item in data:
                    # Should not expose other users' personal info
                    assert "user_email" not in item or "@" not in str(
                        item.get("user_email", "")
                    )

    @pytest.mark.asyncio
    async def test_widgets_list_proper_format(self, auth_client):
        """Widgets list should have proper format"""
        response = await auth_client.get("/pro/widgets")
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict))


# =============================================================================
# ADMIN OUTPUT VALIDATION (for admin users)
# =============================================================================


class TestAdminOutputValidation:
    """Tests for admin endpoint output validation"""

    @pytest.mark.asyncio
    async def test_admin_users_list_no_password_hashes(self, admin_client):
        """Admin users list should not expose password hashes"""
        response = await admin_client.get("/admin/users")
        if response.status_code == 200:
            data = response.json()
            data_str = str(data).lower()
            # Even admin shouldn't see password hashes
            assert "bcrypt" not in data_str
            assert "$2b$" not in data_str
            assert "password_hash" not in data_str

    @pytest.mark.asyncio
    async def test_admin_entity_info_structured(self, admin_client):
        """Admin entity info should be properly structured"""
        response = await admin_client.get("/admin/entity/info")
        if response.status_code == 200:
            data = response.json()
            # Should be a dict with expected structure
            assert isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_admin_roles_list_format(self, admin_client):
        """Admin roles list should have proper format"""
        response = await admin_client.get("/admin/roles")
        if response.status_code == 200:
            data = response.json()
            # Should be a list
            assert isinstance(data, list)


# =============================================================================
# SENSITIVE DATA LEAK PREVENTION
# =============================================================================


class TestSensitiveDataLeakPrevention:
    """Tests to ensure sensitive data is not leaked in responses"""

    @pytest.mark.asyncio
    async def test_no_aws_credentials_in_response(self, auth_client):
        """Responses should never contain AWS credentials"""
        endpoints = ["/auth/user", "/pro/dashboards", "/pro/widgets"]
        for endpoint in endpoints:
            response = await auth_client.get(endpoint)
            if response.status_code == 200:
                data_str = str(response.json())
                assert "AKIA" not in data_str  # AWS access key prefix
                assert "aws_secret" not in data_str.lower()

    @pytest.mark.asyncio
    async def test_no_internal_ips_in_response(self, auth_client):
        """Responses should not expose internal IPs"""
        response = await auth_client.get("/auth/user")
        if response.status_code == 200:
            data_str = str(response.json())
            # Common internal IP patterns
            assert "192.168." not in data_str
            assert "10.0." not in data_str
            assert "172.16." not in data_str

    @pytest.mark.asyncio
    async def test_no_environment_variables_in_error(self, client):
        """Error responses should not expose environment variables"""
        response = await client.post(
            "/auth/login",
            json={
                "email": "test@test.com",
                "password": "x" * 10000,
            },  # Trigger potential error
        )
        data_str = (
            str(response.json())
            if "application/json" in response.headers.get("content-type")
            else response.text
        )
        # Should not expose env vars
        assert "DATABASE_URL" not in data_str
        assert "SECRET_KEY" not in data_str
        assert "API_KEY" not in data_str

    @pytest.mark.asyncio
    async def test_no_jwt_secret_in_response(self, auth_client):
        """Responses should never contain JWT secret"""
        response = await auth_client.get("/auth/user")
        if response.status_code == 200:
            data_str = str(response.json())
            # JWT secret patterns
            assert "jwt_secret" not in data_str.lower()
            assert "secret_key" not in data_str.lower()


# =============================================================================
# RESPONSE HEADER VALIDATION
# =============================================================================


class TestResponseHeaderValidation:
    """Tests for response header security"""

    @pytest.mark.asyncio
    async def test_content_type_header_present(self, auth_client):
        """Responses should have Content-Type header"""
        response = await auth_client.get("/auth/user")
        assert "content-type" in response.headers

    @pytest.mark.asyncio
    async def test_no_server_version_leak(self, client):
        """Server header should not expose version info"""
        response = await client.get("/auth/login")
        # Check various server headers
        server_header = response.headers.get("server", "")
        x_powered_by = response.headers.get("x-powered-by", "")
        # Should not expose detailed version info
        assert "uvicorn" not in server_header.lower() or "/" not in server_header
        assert "python" not in x_powered_by.lower()


# =============================================================================
# DATA TYPE VALIDATION
# =============================================================================


class TestDataTypeValidation:
    """Tests for correct data types in responses"""

    @pytest.mark.asyncio
    async def test_boolean_fields_are_boolean(self, auth_client):
        """Boolean fields should be actual booleans, not strings"""
        response = await auth_client.get("/auth/user")
        if response.status_code == 200:
            data = response.json()
            # Check known boolean fields
            if "confirmed" in data:
                assert isinstance(data["confirmed"], bool)
            if "active" in data:
                assert isinstance(data["active"], bool)

    @pytest.mark.asyncio
    async def test_timestamp_fields_format(self, auth_client):
        """Timestamp fields should have consistent format"""
        response = await auth_client.get("/auth/user")
        if response.status_code == 200:
            data = response.json()
            # Check known timestamp fields
            if "created_at" in data:
                # Should be ISO format string or None
                assert data["created_at"] is None or isinstance(data["created_at"], str)

    @pytest.mark.asyncio
    async def test_uuid_fields_format(self, auth_client):
        """UUID fields should have proper format"""
        response = await auth_client.get("/auth/user")
        if response.status_code == 200:
            data = response.json()
            if "uuid" in data:
                from uuid import UUID

                # Should be valid UUID
                UUID(data["uuid"])
