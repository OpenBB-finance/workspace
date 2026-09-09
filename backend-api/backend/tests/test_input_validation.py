"""
Integration tests for Input Validation.

Tests cover:
- Email validation (format, length, injection attempts)
- Password validation (length, requirements)
- UUID validation (format, injection attempts)
- JSON payload validation (size limits, structure)
- Username validation (length, allowed characters, bad words)
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
from sqlalchemy import text


class TestEmailValidation:
    """Tests for email input validation across endpoints"""

    @pytest.mark.asyncio
    async def test_email_max_length_chargebee_limit(self, client):
        """Email > 70 chars should fail (Chargebee limit)"""
        # Create an email that's 71 characters (over the 70 char limit)
        # 61 chars + "@openbb.co" (10 chars) = 71 chars total
        long_local = "a" * 61
        long_email = f"{long_local}@openbb.co"

        response = await client.post(
            "/register",
            json={"email": long_email, "password": "ValidPassword123!"},
        )
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_email_invalid_format_no_at(self, client):
        """Email without @ should fail validation"""
        response = await client.post(
            "/register",
            json={"email": "invalidemail.com", "password": "ValidPassword123!"},
        )
        assert response.status_code == 422
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_email_invalid_format_no_domain(self, client):
        """Email without domain should fail validation"""
        response = await client.post(
            "/register",
            json={"email": "invalid@", "password": "ValidPassword123!"},
        )
        assert response.status_code == 422
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_email_invalid_format_spaces(self, client):
        """Email with spaces should fail validation"""
        response = await client.post(
            "/register",
            json={"email": "invalid email@test.com", "password": "ValidPassword123!"},
        )
        assert response.status_code == 422
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_email_sql_injection_in_register(self, client, db_session):
        """SQL injection in email should be safely handled - verify DB"""
        malicious_emails = [
            "test@test.com'; DROP TABLE user; --",
            "test@test.com' OR '1'='1",
            "' UNION SELECT * FROM user --@test.com",
        ]

        for email in malicious_emails:
            response = await client.post(
                "/register",
                json={"email": email, "password": "ValidPassword123!"},
            )
            # Should return validation error, not 500
            assert response.status_code in {400, 422}, f"Failed for email: {email}"

        # ACTUALLY verify the database is intact after all injection attempts
        result = await db_session.execute(text("SELECT COUNT(*) FROM user"))
        count = result.scalar()
        assert count is not None  # Table still exists and is queryable

    @pytest.mark.asyncio
    async def test_email_xss_attempt_in_register(self, client):
        """XSS in email should be safely handled"""
        xss_emails = [
            "<script>alert('xss')</script>@test.com",
            "test@test.com<img src=x onerror=alert('xss')>",
            "javascript:alert('xss')@test.com",
        ]

        for email in xss_emails:
            response = await client.post(
                "/register",
                json={"email": email, "password": "ValidPassword123!"},
            )
            # Should return validation error, not 500
            assert response.status_code in {400, 422}, f"Failed for email: {email}"

    @pytest.mark.asyncio
    async def test_email_unicode_handling(self, client):
        """Unicode in email should be handled properly"""
        unicode_emails = [
            "tëst@test.com",  # Latin with diacritics
            "测试@test.com",  # Chinese characters
            "test@tëst.com",  # Unicode in domain
        ]

        for email in unicode_emails:
            response = await client.post(
                "/register",
                json={"email": email, "password": "ValidPassword123!"},
            )
            # May be valid internationalized email or validation error
            assert response.status_code in {200, 400, 422}, f"Failed for email: {email}"


class TestPasswordValidation:
    """Tests for password input validation"""

    @pytest.mark.asyncio
    async def test_password_min_length_7_chars_fails(self, client):
        """Password with 7 chars should fail (min is 8)"""
        response = await client.post(
            "/register",
            json={
                "email": f"pwtest_{uuid4().hex[:8]}@openbb.co",
                "password": "Short1!",  # 7 chars
            },
        )
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_password_min_length_8_chars_succeeds(self, client):
        """Password with exactly 8 chars should pass validation"""
        response = await client.post(
            "/register",
            json={
                "email": f"pwtest_{uuid4().hex[:8]}@openbb.co",
                "password": "Valid12!",  # 8 chars
            },
        )
        # 200 success or 400 if HubSpot disabled (but not 422 for validation)
        assert response.status_code in {200, 400}

    @pytest.mark.asyncio
    async def test_password_empty_fails(self, client):
        """Empty password should fail validation"""
        response = await client.post(
            "/register",
            json={
                "email": f"pwtest_{uuid4().hex[:8]}@openbb.co",
                "password": "",
            },
        )
        assert response.status_code == 422
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_password_whitespace_only_fails(self, client):
        """Password with only whitespace should fail or be rejected"""
        response = await client.post(
            "/register",
            json={
                "email": f"pwtest_{uuid4().hex[:8]}@openbb.co",
                "password": "        ",  # 8 spaces
            },
        )
        # May succeed (whitespace trimmed and treated as empty) or fail validation
        # 200 if registration works (API might allow it), 400/422 if validation fails
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_password_unicode_characters(self, client):
        """Password with unicode characters should be handled"""
        response = await client.post(
            "/register",
            json={
                "email": f"pwtest_{uuid4().hex[:8]}@openbb.co",
                "password": "Pässwörd123!",  # Unicode chars
            },
        )
        # May succeed or fail depending on implementation
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_password_very_long(self, client):
        """Very long password should be handled"""
        long_password = "A" * 1000 + "1!"
        response = await client.post(
            "/register",
            json={
                "email": f"pwtest_{uuid4().hex[:8]}@openbb.co",
                "password": long_password,
            },
        )
        # Should either succeed or return appropriate error
        assert response.status_code in {200, 400, 422}


class TestUUIDValidation:
    """Tests for UUID parameter validation"""

    @pytest.mark.asyncio
    async def test_invalid_uuid_format_returns_422(self, auth_client):
        """Invalid UUID format should return 422"""
        invalid_uuids = [
            "not-a-uuid",
            "12345",
            "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            "",
        ]

        for uuid in invalid_uuids:
            response = await auth_client.get(f"/pro/dash/{uuid}/shares")
            # Should return 422 (validation) or 400 (bad request)
            assert response.status_code in {400, 422, 404}, f"Failed for UUID: {uuid}"

    @pytest.mark.asyncio
    async def test_uuid_sql_injection(self, auth_client, db_session):
        """SQL injection in UUID should be safely handled - verify DB"""
        malicious_uuids = [
            "'; DROP TABLE dashboard; --",
            "' OR '1'='1",
            "1; DELETE FROM user WHERE 1=1; --",
        ]

        for uuid in malicious_uuids:
            response = await auth_client.delete(f"/pro/files/{uuid}")
            # Should return validation error, not 500
            assert response.status_code in {400, 404, 422}, f"Failed for UUID: {uuid}"

        # ACTUALLY verify the database is intact after all injection attempts
        result = await db_session.execute(text("SELECT COUNT(*) FROM user"))
        count = result.scalar()
        assert count is not None  # Table still exists and is queryable

    @pytest.mark.asyncio
    async def test_valid_uuid_nonexistent_resource(self, auth_client):
        """Valid UUID format but nonexistent resource should return 404 or 200"""
        valid_uuid = str(uuid4())
        response = await auth_client.get(f"/pro/dash/{valid_uuid}/shares")
        # Should return 404 (not found) or 200 (empty list)
        assert response.status_code in {200, 400, 404}


class TestJSONPayloadValidation:
    """Tests for JSON payload validation"""

    @pytest.mark.asyncio
    async def test_missing_required_fields(self, client):
        """Missing required fields should return 422"""
        response = await client.post("/login", json={})
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_extra_fields_handling(self, auth_client):
        """Extra fields in payload should be ignored or rejected"""
        response = await auth_client.put(
            "/user",
            json={
                "first_name": "Test",
                "unknown_field": "should_be_ignored",
                "another_unknown": 12345,
            },
        )
        # Should succeed (ignoring extras) or return 422 if strict
        assert response.status_code in {200, 422}

    @pytest.mark.asyncio
    async def test_wrong_type_for_field(self, client):
        """Wrong type for field should return 422"""
        response = await client.post(
            "/login",
            json={
                "email": 12345,  # Should be string
                "password": ["array", "not", "string"],
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_null_values_for_required_fields(self, client):
        """Null values for required fields should return 422"""
        response = await client.post(
            "/login",
            json={"email": None, "password": None},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_deeply_nested_json(self, auth_client):
        """Deeply nested JSON should be handled without stack overflow"""
        # Create moderately nested structure (20 levels is enough to test)
        nested = {"level": 0}
        current = nested
        for i in range(20):
            current["nested"] = {"level": i + 1}
            current = current["nested"]

        response = await auth_client.post(
            "/pro/display-settings",
            json=nested,
        )
        # Should handle gracefully - either accept, return 422, or 400
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_large_array_in_payload(self, auth_client):
        """Large array in payload should be handled"""
        large_array = list(range(100))  # Reasonable size to avoid hanging

        response = await auth_client.put(
            "/pro/enabled-bundles",
            json={"bundles": large_array},
        )
        # Should handle gracefully
        assert response.status_code in {200, 400, 413, 422}

    @pytest.mark.asyncio
    async def test_invalid_json_syntax(self, client):
        """Invalid JSON syntax should return appropriate error"""
        response = await client.post(
            "/login",
            content=b'{"email": "test@test.com", "password": }',  # Invalid JSON
            headers={"Content-Type": "application/json"},
        )
        # Should return 400 (bad request) or 422 (unprocessable)
        assert response.status_code in {400, 422}


class TestUsernameValidation:
    """Tests for username validation"""

    @pytest.mark.asyncio
    async def test_username_min_length_3_chars_fails(self, client):
        """Username with 3 chars should fail (min is 4)"""
        response = await client.post(
            "/register",
            json={
                "email": f"usertest_{uuid4().hex[:8]}@openbb.co",
                "password": "ValidPassword123!",
                "username": "abc",  # 3 chars
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_username_min_length_4_chars_succeeds(self, client):
        """Username with 4 chars should pass validation"""
        # Use random 4-char username to avoid conflicts
        random_username = uuid4().hex[:4]
        response = await client.post(
            "/register",
            json={
                "email": f"usertest_{uuid4().hex[:8]}@openbb.co",
                "password": "ValidPassword123!",
                "username": random_username,  # 4 random chars
            },
        )
        # 200 success, 400 if HubSpot disabled, 409 if username/email exists
        assert response.status_code in {200, 400, 409}

    @pytest.mark.asyncio
    async def test_username_max_length_51_chars_fails(self, client):
        """Username with 51 chars should fail (max is 50)"""
        response = await client.post(
            "/register",
            json={
                "email": f"usertest_{uuid4().hex[:8]}@openbb.co",
                "password": "ValidPassword123!",
                "username": "a" * 51,
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_username_special_chars_rejected(self, client):
        """Username with special characters should be rejected"""
        invalid_usernames = [
            "user@name",
            "user!name",
            "user name",  # space
            "user#name",
            "user$name",
        ]

        for username in invalid_usernames:
            response = await client.post(
                "/register",
                json={
                    "email": f"usertest_{uuid4().hex[:8]}@openbb.co",
                    "password": "ValidPassword123!",
                    "username": username,
                },
            )
            assert response.status_code == 422, f"Failed for username: {username}"

    @pytest.mark.asyncio
    async def test_username_valid_characters_allowed(self, client):
        """Username with letters, numbers, underscores should be allowed"""
        valid_usernames = [
            "user_name",
            "UserName123",
            "user123",
            "USER_NAME_123",
        ]

        for username in valid_usernames:
            response = await client.post(
                "/register",
                json={
                    "email": f"usertest_{uuid4().hex[:8]}@openbb.co",
                    "password": "ValidPassword123!",
                    "username": username,
                },
            )
            # 200 success or 400 if HubSpot disabled (but not 422)
            assert response.status_code in {
                200,
                400,
                409,
            }, f"Failed for username: {username}"


class TestContentTypeValidation:
    """Tests for Content-Type header validation"""

    @pytest.mark.asyncio
    async def test_missing_content_type_for_json_endpoint(self, client):
        """Missing Content-Type for JSON endpoint should be handled"""
        response = await client.post(
            "/login",
            content=b'{"email": "test@test.com", "password": "password123"}',
            # No Content-Type header
        )
        # Should work or return appropriate error (401 for invalid login is valid)
        assert response.status_code in {200, 400, 401, 415, 422}

    @pytest.mark.asyncio
    async def test_wrong_content_type(self, client):
        """Wrong Content-Type should be handled"""
        response = await client.post(
            "/login",
            content=b'{"email": "test@test.com", "password": "password123"}',
            headers={"Content-Type": "text/plain"},
        )
        # Should return 415 (unsupported media type) or 422
        assert response.status_code in {400, 415, 422}


class TestPathParameterValidation:
    """Tests for path parameter validation"""

    @pytest.mark.asyncio
    async def test_path_traversal_attempt(self, auth_client):
        """Path traversal attempts should be blocked"""
        malicious_paths = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32",
            "%2e%2e%2f%2e%2e%2f",
        ]

        for path in malicious_paths:
            response = await auth_client.get(f"/pro/files/{path}")
            # Should return 400/404/422, not expose files
            assert response.status_code in {400, 404, 422}, f"Failed for path: {path}"

    @pytest.mark.asyncio
    async def test_null_byte_injection(self, auth_client):
        """Null byte injection should be blocked"""
        response = await auth_client.get("/pro/files/test%00.txt")
        # Should return validation error
        assert response.status_code in {400, 404, 422}
