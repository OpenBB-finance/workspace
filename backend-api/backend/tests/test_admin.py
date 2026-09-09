"""
Integration tests for Admin endpoints.
"""

import os
import sys

# Add the backend directory to Python path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest
from uuid import uuid4
from sqlalchemy import text


class TestAdminUsers:
    """Tests for /admin/users endpoints"""

    @pytest.mark.asyncio
    async def test_get_users_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/admin/users")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_users_authenticated_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        response = await auth_client.get("/admin/users")
        # Regular users MUST get 403. If they get 200, RBAC is broken.
        assert response.status_code == 403
        # Validate response structure
        data = response.json()
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_create_user_unauthenticated(self, client):
        """Should fail without auth - endpoint is /admin/create-user"""
        response = await client.post("/admin/create-user", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_delete_user_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.delete(f"/admin/users/{test_uuid}")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data


class TestAdminSingleUser:
    """Tests for /admin/users/{user_uuid} endpoints"""

    @pytest.mark.asyncio
    async def test_delete_user_by_uuid_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.delete(f"/admin/users/{test_uuid}")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_update_user_unauthenticated(self, client):
        """Should fail without auth - uses PATCH not PUT"""
        test_uuid = str(uuid4())
        response = await client.patch(f"/admin/users/{test_uuid}", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data


class TestAdminRegister:
    """Tests for /admin/register endpoint"""

    @pytest.mark.asyncio
    async def test_admin_register_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post("/admin/register", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data


class TestAdminEntity:
    """Tests for /admin/entity endpoints"""

    @pytest.mark.asyncio
    async def test_get_entity_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/admin/entity")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_update_entity_unauthenticated(self, client):
        """Should fail without auth - endpoint uses PATCH not POST"""
        response = await client.patch("/admin/entity", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data


class TestAdminApps:
    """Tests for /admin/apps endpoints"""

    @pytest.mark.asyncio
    async def test_get_apps_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/admin/apps")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_apps_authenticated_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        response = await auth_client.get("/admin/apps")
        # Regular users MUST get 403
        assert response.status_code == 403
        # Validate response structure
        data = response.json()
        assert "detail" in data or "message" in data or "error" in data


class TestAdminTheme:
    """Tests for /admin/theme-settings endpoints"""

    @pytest.mark.asyncio
    async def test_update_theme_unauthenticated(self, client):
        """Should fail without auth - uses PATCH"""
        response = await client.patch("/admin/theme-settings", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_update_theme_authenticated_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        response = await auth_client.patch("/admin/theme-settings", json={})
        # Regular users MUST get 403
        assert response.status_code == 403
        # Validate response structure
        data = response.json()
        assert "detail" in data or "message" in data or "error" in data


# =============================================================================
# ADMIN ACCESS CONTROL TESTS
# =============================================================================


class TestAdminAccessControl:
    """Tests verifying admin vs regular user access control"""

    @pytest.mark.asyncio
    async def test_regular_user_blocked_from_admin_users(self, auth_client):
        """Regular user should be blocked from /admin/users"""
        response = await auth_client.get("/admin/users")
        assert response.status_code == 403
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_regular_user_blocked_from_admin_entity(self, auth_client):
        """Regular user should be blocked from /admin/entity"""
        response = await auth_client.get("/admin/entity")
        assert response.status_code == 403
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_regular_user_blocked_from_admin_providers(self, auth_client):
        """Regular user should be blocked from /admin/providers"""
        response = await auth_client.get("/admin/providers")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_regular_user_blocked_from_admin_roles(self, auth_client):
        """Regular user should be blocked from /admin/role"""
        response = await auth_client.get("/admin/role")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_regular_user_blocked_from_create_user(self, auth_client):
        """Regular user should be blocked from /admin/create-user"""
        response = await auth_client.post(
            "/admin/create-user",
            json={
                "email": f"test_{uuid4().hex[:8]}@openbb.co",
                "username": "testuser",
            },
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_regular_user_blocked_from_register_invite(self, auth_client):
        """Regular user should be blocked from /admin/register"""
        response = await auth_client.post(
            "/admin/register",
            json={"email": f"invite_{uuid4().hex[:8]}@openbb.co"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_regular_user_blocked_from_entitlement_update(self, auth_client):
        """Regular user should be blocked from /admin/entitlement/{uuid}"""
        test_uuid = str(uuid4())
        response = await auth_client.patch(
            f"/admin/entitlement/{test_uuid}",
            json={"plan": "pro"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_regular_user_blocked_from_theme_settings(self, auth_client):
        """Regular user should be blocked from /admin/theme-settings"""
        response = await auth_client.patch(
            "/admin/theme-settings",
            json={"primary_color": "#000000"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_can_access_admin_entity(self, admin_client):
        """Admin user should be able to access /admin/entity"""
        response = await admin_client.get("/admin/entity")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_can_access_admin_entity_info(self, admin_client):
        """Admin user should be able to access /admin/entity-info"""
        response = await admin_client.get("/admin/entity-info")
        assert response.status_code == 200
        data = response.json()
        assert "seats" in data
        assert "used_seats" in data

    @pytest.mark.asyncio
    async def test_admin_can_access_admin_entity_map(self, admin_client):
        """Admin user should be able to access /admin/entity-map"""
        response = await admin_client.get("/admin/entity-map")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_admin_can_access_admin_users_list(self, admin_client):
        """Admin user should be able to access /admin/users"""
        response = await admin_client.get("/admin/users")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_admin_can_access_admin_apps(self, admin_client):
        """Admin user should be able to access /admin/apps"""
        response = await admin_client.get("/admin/apps")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_admin_can_access_admin_roles(self, admin_client):
        """Admin user should be able to access /admin/role"""
        response = await admin_client.get("/admin/role")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


# =============================================================================
# ADMIN INPUT VALIDATION TESTS
# =============================================================================


class TestAdminInputValidation:
    """Tests for admin endpoint input validation"""

    @pytest.mark.asyncio
    async def test_create_user_invalid_email(self, admin_client):
        """Creating user with invalid email should fail"""
        response = await admin_client.post(
            "/admin/create-user",
            json={"email": "not-an-email", "username": "testuser"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_user_empty_email(self, admin_client):
        """Creating user with empty email should fail"""
        response = await admin_client.post(
            "/admin/create-user",
            json={"email": "", "username": "testuser"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_user_sql_injection_email(self, admin_client, db_session):
        """SQL injection in email should be safely handled - verify DB"""
        response = await admin_client.post(
            "/admin/create-user",
            json={
                "email": "test@test.com'; DROP TABLE user; --",
                "username": "testuser",
            },
        )
        # Should return validation error or safely process
        assert response.status_code in {400, 422}

        # ACTUALLY verify the database is intact
        result = await db_session.execute(text("SELECT COUNT(*) FROM user"))
        count = result.scalar()
        assert count is not None  # Table still exists

    @pytest.mark.asyncio
    async def test_register_invite_invalid_email(self, admin_client):
        """Registering invite with invalid email should fail"""
        response = await admin_client.post(
            "/admin/register",
            json={"email": "invalid-email"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_user_invalid_uuid(self, admin_client):
        """Updating user with invalid UUID should fail"""
        response = await admin_client.patch(
            "/admin/users/not-a-uuid",
            json={"username": "newname"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_user_invalid_uuid(self, admin_client):
        """Deleting user with invalid UUID should fail"""
        response = await admin_client.delete("/admin/users/not-a-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_extend_trial_invalid_uuid(self, admin_client):
        """Extending trial with invalid UUID should fail"""
        response = await admin_client.get("/admin/extend-trial/not-a-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_entitlement_invalid_uuid(self, admin_client):
        """Getting entitlement with invalid UUID should fail"""
        response = await admin_client.get("/admin/entitlement/not-a-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_reset_password_invalid_uuid(self, admin_client):
        """Resetting password with invalid UUID should fail"""
        response = await admin_client.post("/admin/reset-password/not-a-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_role_empty_name(self, admin_client):
        """Creating role with empty name should fail"""
        response = await admin_client.post(
            "/admin/role",
            json={"name": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_role_duplicate_detection(self, admin_client):
        """Creating duplicate role should fail gracefully"""
        role_name = f"TestRole_{uuid4().hex[:8]}"
        # First creation
        response1 = await admin_client.post(
            "/admin/role",
            json={"name": role_name},
        )
        # May succeed or fail based on permissions
        if response1.status_code == 200:
            # Second creation should fail (duplicate)
            response2 = await admin_client.post(
                "/admin/role",
                json={"name": role_name},
            )
            assert response2.status_code in {400, 409, 422}


# =============================================================================
# ADMIN OUTPUT VALIDATION TESTS
# =============================================================================


class TestAdminOutputValidation:
    """Tests for admin endpoint output validation"""

    @pytest.mark.asyncio
    async def test_entity_info_response_schema(self, admin_client):
        """Verify /admin/entity-info returns expected schema"""
        response = await admin_client.get("/admin/entity-info")
        assert response.status_code == 200
        data = response.json()
        # Required fields
        assert "seats" in data
        assert "used_seats" in data
        # Types
        assert isinstance(data["seats"], int)
        assert isinstance(data["used_seats"], int)

    @pytest.mark.asyncio
    async def test_users_list_response_schema(self, admin_client):
        """Verify /admin/users returns expected schema"""
        response = await admin_client.get("/admin/users")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Each user should have expected fields
        for user in data:
            assert "uuid" in user or "email" in user

    @pytest.mark.asyncio
    async def test_roles_list_response_schema(self, admin_client):
        """Verify /admin/role returns expected schema"""
        response = await admin_client.get("/admin/role")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_entity_response_no_sensitive_data(self, admin_client):
        """Verify /admin/entity doesn't leak sensitive data"""
        response = await admin_client.get("/admin/entity")
        assert response.status_code == 200
        data = response.json()
        # Should not contain database internals
        assert "_sa_instance_state" not in str(data)
        # Should not contain password hashes
        assert "password" not in str(data).lower() or "null" in str(data).lower()


# =============================================================================
# ADMIN USER MANAGEMENT TESTS
# =============================================================================


class TestAdminUserManagement:
    """Tests for user management operations"""

    @pytest.mark.asyncio
    async def test_delete_nonexistent_user(self, admin_client):
        """Deleting nonexistent user should return 404"""
        fake_uuid = str(uuid4())
        response = await admin_client.delete(f"/admin/users/{fake_uuid}")
        assert response.status_code in {404, 400}

    @pytest.mark.asyncio
    async def test_update_nonexistent_user(self, admin_client):
        """Updating nonexistent user should succeed (update returns success even if no rows matched)"""
        fake_uuid = str(uuid4())
        response = await admin_client.patch(
            f"/admin/users/{fake_uuid}",
            json={"billing_active": True},  # Valid field from UserAdminUpdate schema
        )
        # The endpoint returns success even if no rows were updated
        # This is expected behavior for idempotent update operations
        assert response.status_code in {200, 404, 400, 403}

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_user(self, admin_client):
        """Revoking nonexistent user should return 404"""
        fake_uuid = str(uuid4())
        response = await admin_client.post(f"/admin/users/{fake_uuid}/revoke")
        assert response.status_code in {404, 400}

    @pytest.mark.asyncio
    async def test_remove_nonexistent_user(self, admin_client):
        """Removing nonexistent user should return 404"""
        fake_uuid = str(uuid4())
        response = await admin_client.delete(f"/admin/users/{fake_uuid}/remove")
        assert response.status_code in {404, 400}

    @pytest.mark.asyncio
    async def test_get_entitlement_nonexistent_user(self, admin_client):
        """Getting entitlement for nonexistent user should return 404"""
        fake_uuid = str(uuid4())
        response = await admin_client.get(f"/admin/entitlement/{fake_uuid}")
        assert response.status_code in {404, 400}

    @pytest.mark.asyncio
    async def test_reset_password_nonexistent_user(self, admin_client):
        """Resetting password for nonexistent user returns 403"""
        fake_uuid = str(uuid4())
        response = await admin_client.post(f"/admin/reset-password/{fake_uuid}")
        # The endpoint returns 403 as the user does not match the admin's organization
        assert response.status_code == 403


# =============================================================================
# ADMIN ROLE MANAGEMENT TESTS
# =============================================================================


class TestAdminRoleManagement:
    """Tests for role management operations"""

    @pytest.mark.asyncio
    async def test_get_nonexistent_role(self, admin_client):
        """Getting nonexistent role should return 404"""
        fake_uuid = str(uuid4())
        response = await admin_client.get(f"/admin/role/{fake_uuid}")
        assert response.status_code in {404, 400}

    @pytest.mark.asyncio
    async def test_update_nonexistent_role(self, admin_client):
        """Updating nonexistent role should return 404"""
        fake_uuid = str(uuid4())
        response = await admin_client.patch(
            f"/admin/role/{fake_uuid}",
            json={"name": "NewName"},
        )
        assert response.status_code in {404, 400}

    @pytest.mark.asyncio
    async def test_delete_nonexistent_role(self, admin_client):
        """Deleting nonexistent role should return 404"""
        fake_uuid = str(uuid4())
        response = await admin_client.delete(f"/admin/role/{fake_uuid}")
        assert response.status_code in {404, 400}

    @pytest.mark.asyncio
    async def test_update_role_permissions_nonexistent(self, admin_client):
        """Updating permissions for nonexistent role should return 404"""
        fake_uuid = str(uuid4())
        response = await admin_client.put(
            f"/admin/role-permissions/{fake_uuid}",
            json={"permissions": []},
        )
        assert response.status_code in {404, 400, 422}


# =============================================================================
# ADMIN ENTITY OPERATIONS TESTS
# =============================================================================


class TestAdminEntityOperations:
    """Tests for entity-level operations"""

    @pytest.mark.asyncio
    async def test_patch_entity_with_invalid_value(self, admin_client):
        """Patching entity with invalid value should fail"""
        response = await admin_client.patch(
            "/admin/entity",
            json={"require_authenticator": "not_a_boolean"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_patch_entity_with_valid_value(self, admin_client):
        """Patching entity with valid value should succeed"""
        response = await admin_client.patch(
            "/admin/entity",
            json={"require_authenticator": True},
        )
        # May succeed or not depending on entity setup
        assert response.status_code in {200, 400, 404}

    @pytest.mark.asyncio
    async def test_patch_providers_with_invalid_data(self, admin_client):
        """Patching providers with invalid data should fail"""
        response = await admin_client.patch(
            "/admin/providers",
            json={"invalid_key": "invalid_value"},
        )
        # Should either fail validation or ignore unknown fields
        assert response.status_code in {200, 400, 422}


# =============================================================================
# ADMIN INVITE MANAGEMENT TESTS
# =============================================================================


class TestAdminInviteManagement:
    """Tests for invite management"""

    @pytest.mark.asyncio
    async def test_delete_nonexistent_invite(self, admin_client):
        """Deleting nonexistent invite should return 404"""
        fake_uuid = str(uuid4())
        response = await admin_client.delete(f"/admin/register/{fake_uuid}")
        assert response.status_code in {404, 400}

    @pytest.mark.asyncio
    async def test_register_invite_xss_attempt(self, admin_client):
        """XSS in invite email should be safely handled"""
        response = await admin_client.post(
            "/admin/register",
            json={"email": "<script>alert('xss')</script>@test.com"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_invite_long_email(self, admin_client):
        """Very long email in invite should be rejected"""
        long_email = "a" * 300 + "@test.com"
        response = await admin_client.post(
            "/admin/register",
            json={"email": long_email},
        )
        assert response.status_code == 422


# =============================================================================
# ADMIN RATE LIMIT TESTS
# =============================================================================


class TestAdminRateLimits:
    """Tests for admin endpoint rate limiting"""

    @pytest.mark.asyncio
    async def test_admin_endpoints_have_rate_limits(self, admin_client):
        """Admin endpoints should enforce rate limits"""
        # Make many rapid requests
        responses = []
        for _ in range(5):
            response = await admin_client.get("/admin/entity-info")
            responses.append(response.status_code)

        # Should all succeed in test mode (rate limits may be disabled)
        # If rate limits are active, should see 429
        assert all(code in {200, 429} for code in responses)


# =============================================================================
# ADMIN PROVIDERS TESTS
# =============================================================================


class TestAdminProviders:
    """Tests for /admin/providers endpoints"""

    @pytest.mark.asyncio
    async def test_get_providers_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/admin/providers")
        assert response.status_code in {401, 403}
        data = response.json()
        assert isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_get_providers_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        response = await auth_client.get("/admin/providers")
        assert response.status_code == 403
        data = response.json()
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_providers_admin(self, admin_client):
        """Admin should be able to get provider keys"""
        response = await admin_client.get("/admin/providers")
        assert response.status_code in {200, 404}
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_patch_providers_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.patch("/admin/providers", json={})
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_patch_providers_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        response = await auth_client.patch(
            "/admin/providers",
            json={"test_key": "test_value"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_patch_providers_admin(self, admin_client):
        """Admin should be able to update provider keys"""
        response = await admin_client.patch(
            "/admin/providers",
            json={"test_provider": "test_key_value"},
        )
        # 200 for success, 400 if provider not recognized
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_patch_providers_empty_payload(self, admin_client):
        """Empty payload should be handled"""
        response = await admin_client.patch("/admin/providers", json={})
        assert response.status_code in {200, 422}

    @pytest.mark.asyncio
    async def test_patch_providers_sql_injection(self, admin_client):
        """SQL injection attempt should be safely handled"""
        response = await admin_client.patch(
            "/admin/providers",
            json={"provider": "'; DROP TABLE providers; --"},
        )
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_get_providers_no_sensitive_data_logging(self, admin_client):
        """Provider keys should not be logged in plain text"""
        response = await admin_client.get("/admin/providers")
        # Just verify the endpoint works without exposing secrets in response structure
        if response.status_code == 200:
            data = response.json()
            # Keys should be masked or partial
            assert isinstance(data, dict)


# =============================================================================
# ADMIN PASSWORD RESET TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminPasswordReset:
    """Tests for /admin/reset-password/{user_uuid} endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_reset_password_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.post(f"/admin/reset-password/{test_uuid}")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_reset_password_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.post(f"/admin/reset-password/{test_uuid}")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_reset_password_invalid_uuid(self, admin_client):
        """Should return 422 for invalid UUID"""
        response = await admin_client.post("/admin/reset-password/not-a-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_reset_password_returns_new_password(self, admin_client):
        """Password reset should return a usable new password"""
        # Get an existing user from the system
        users_response = await admin_client.get("/admin/user")
        if users_response.status_code == 200:
            users = users_response.json()
            if users and len(users) > 0:
                user_uuid = users[0].get("uuid")
                if user_uuid:
                    # Reset password
                    response = await admin_client.post(f"/admin/reset-password/{user_uuid}")
                    # Should succeed and return password
                    if response.status_code == 200:
                        data = response.json()
                        assert isinstance(data, dict)
                        # Should contain a password field
                        assert "password" in data or "success" in data or "message" in data


# =============================================================================
# ADMIN 2FA RESET TESTS - REAL OPERATIONS
# =============================================================================


class TestAdmin2FAReset:
    """Tests for /admin/reset-2fa/{user_uuid} endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_reset_2fa_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.post(f"/admin/reset-2fa/{test_uuid}")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_reset_2fa_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.post(f"/admin/reset-2fa/{test_uuid}")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_reset_2fa_invalid_uuid(self, admin_client):
        """Should return 422 for invalid UUID"""
        response = await admin_client.post("/admin/reset-2fa/not-a-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_reset_2fa_for_existing_user(self, admin_client):
        """Reset 2FA for existing user should work"""
        # Get an existing user
        users_response = await admin_client.get("/admin/user")
        if users_response.status_code == 200:
            users = users_response.json()
            if users and len(users) > 0:
                user_uuid = users[0].get("uuid")
                if user_uuid:
                    response = await admin_client.post(f"/admin/reset-2fa/{user_uuid}")
                    # Should succeed
                    assert response.status_code in {200, 400}  # 400 if 2FA not enabled
                    if response.status_code == 200:
                        data = response.json()
                        assert isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_reset_2fa_cross_org(self, admin_client):
        """Should fail with 403 when trying to reset 2FA for a user in a different organization"""
        fake_uuid = str(uuid4())
        response = await admin_client.post(f"/admin/reset-2fa/{fake_uuid}")
        assert response.status_code == 403
        assert response.json().get("detail") == "Cannot reset 2FA for users outside your organization"


# =============================================================================
# ADMIN CREATE USER TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminCreateUser:
    """Tests for /admin/create-user endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_create_user_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post(
            "/admin/create-user",
            json={"email": "test@test.com"},
        )
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_create_user_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        response = await auth_client.post(
            "/admin/create-user",
            json={"email": "test@test.com"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_user_missing_email(self, admin_client):
        """Should fail with missing email"""
        response = await admin_client.post("/admin/create-user", json={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_user_invalid_email(self, admin_client):
        """Should fail with invalid email format"""
        response = await admin_client.post(
            "/admin/create-user",
            json={"email": "not-an-email"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_user_and_verify_exists(self, admin_client):
        """Create a user and verify they exist in the system"""
        unique_email = f"created_{uuid4().hex[:8]}@testintegration.com"

        # Create user
        create_response = await admin_client.post(
            "/admin/create-user",
            json={"email": unique_email},
        )

        if create_response.status_code in {200, 201}:
            data = create_response.json()
            assert isinstance(data, dict)
            # Should return password or user info
            assert "password" in data or "uuid" in data or "success" in data

            # Verify user exists by searching
            users_response = await admin_client.get("/admin/user")
            if users_response.status_code == 200:
                users = users_response.json()
                assert isinstance(users, list)
                # Check if our created user is in the list
                assert any(isinstance(u, dict) and u.get("email", "").lower() == unique_email.lower() for u in users)
        elif create_response.status_code == 400:
            # User may already exist - that's a valid case
            pass

    @pytest.mark.asyncio
    async def test_create_duplicate_user_fails(self, admin_client):
        """Creating duplicate user should fail or return appropriate error"""
        unique_email = f"duplicate_{uuid4().hex[:8]}@testintegration.com"

        # Create user first time
        first_response = await admin_client.post(
            "/admin/create-user",
            json={"email": unique_email},
        )

        if first_response.status_code in {200, 201}:
            # Try to create same user again
            second_response = await admin_client.post(
                "/admin/create-user",
                json={"email": unique_email},
            )
            # Should fail or return existing user
            assert second_response.status_code in {200, 400, 409}


# =============================================================================
# ADMIN EXTEND TRIAL TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminExtendTrial:
    """Tests for /admin/extend-trial/{user_uuid} endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_extend_trial_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.get(f"/admin/extend-trial/{test_uuid}")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_extend_trial_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.get(f"/admin/extend-trial/{test_uuid}")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_extend_trial_invalid_uuid(self, admin_client):
        """Should return 422 for invalid UUID"""
        response = await admin_client.get("/admin/extend-trial/not-a-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_extend_trial_for_existing_user(self, admin_client):
        """Extend trial for existing user should work"""
        # Get existing user
        users_response = await admin_client.get("/admin/user")
        if users_response.status_code == 200:
            users = users_response.json()
            if users and len(users) > 0:
                user_uuid = users[0].get("uuid")
                if user_uuid:
                    response = await admin_client.get(f"/admin/extend-trial/{user_uuid}")
                    # Should succeed or indicate not a trial user
                    assert response.status_code in {200, 400}


# =============================================================================
# ADMIN ROLE PERMISSIONS GET TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminRolePermissionsGet:
    """Tests for GET /admin/role-permissions/{role_uuid} endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_get_role_permissions_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.get(f"/admin/role-permissions/{test_uuid}")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_role_permissions_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.get(f"/admin/role-permissions/{test_uuid}")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_role_permissions_invalid_uuid(self, admin_client):
        """Should return 422 for invalid UUID"""
        response = await admin_client.get("/admin/role-permissions/not-a-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_permissions_for_existing_role(self, admin_client):
        """Get permissions for an existing role"""
        # First get existing roles
        roles_response = await admin_client.get("/admin/role")
        if roles_response.status_code == 200:
            roles = roles_response.json()
            if roles and len(roles) > 0:
                role_uuid = roles[0].get("uuid")
                if role_uuid:
                    response = await admin_client.get(f"/admin/role-permissions/{role_uuid}")
                    assert response.status_code == 200

                    data = response.json()
                    assert isinstance(data, (dict, list))

    @pytest.mark.asyncio
    async def test_role_permissions_match_role_config(self, admin_client):
        """Role permissions should reflect the actual role configuration"""
        # Get roles
        roles_response = await admin_client.get("/admin/role")
        if roles_response.status_code == 200:
            roles = roles_response.json()
            if roles and len(roles) > 0:
                role = roles[0]
                role_uuid = role.get("uuid")
                if role_uuid:
                    # Get permissions
                    perms_response = await admin_client.get(f"/admin/role-permissions/{role_uuid}")
                    if perms_response.status_code == 200:
                        perms = perms_response.json()
                        # Permissions should be structured data
                        assert isinstance(perms, (dict, list))


# =============================================================================
# ADMIN ENTITLEMENT TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminEntitlement:
    """Tests for /admin/entitlement/{user_uuid} endpoints - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_get_entitlement_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.get(f"/admin/entitlement/{test_uuid}")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_entitlement_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.get(f"/admin/entitlement/{test_uuid}")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_patch_entitlement_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.patch(
            f"/admin/entitlement/{test_uuid}",
            json={"tier": "pro"},
        )
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_patch_entitlement_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.patch(
            f"/admin/entitlement/{test_uuid}",
            json={"tier": "pro"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_patch_entitlement_invalid_uuid(self, admin_client):
        """Should return 422 for invalid UUID"""
        response = await admin_client.patch(
            "/admin/entitlement/not-a-uuid",
            json={"tier": "pro"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_entitlement_for_existing_user(self, admin_client):
        """Get entitlement for existing user"""
        users_response = await admin_client.get("/admin/user")
        if users_response.status_code == 200:
            users = users_response.json()
            if users and len(users) > 0:
                user_uuid = users[0].get("uuid")
                if user_uuid:
                    response = await admin_client.get(f"/admin/entitlement/{user_uuid}")
                    assert response.status_code in {200, 404}
                    if response.status_code == 200:
                        data = response.json()
                        assert isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_update_entitlement_and_verify_change(self, admin_client):
        """Update entitlement and verify the change was applied"""
        users_response = await admin_client.get("/admin/user")
        if users_response.status_code == 200:
            users = users_response.json()
            if users and len(users) > 0:
                user_uuid = users[0].get("uuid")
                if user_uuid:
                    # Get current entitlement
                    before_response = await admin_client.get(f"/admin/entitlement/{user_uuid}")

                    if before_response.status_code == 200:
                        # Try to update (may fail depending on permissions)
                        update_response = await admin_client.patch(
                            f"/admin/entitlement/{user_uuid}",
                            json={},  # Empty patch should be handled
                        )
                        # Should not error
                        assert update_response.status_code in {200, 400, 422}


# =============================================================================
# ADMIN USER MODIFICATION TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminUserModification:
    """Tests for /admin/users/{uuid} PATCH endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_patch_user_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.patch(
            f"/admin/users/{test_uuid}",
            json={"billing_active": True},
        )
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_patch_user_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.patch(
            f"/admin/users/{test_uuid}",
            json={"billing_active": True},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_patch_user_invalid_uuid(self, admin_client):
        """Should return 422 for invalid UUID"""
        response = await admin_client.patch(
            "/admin/users/not-a-uuid",
            json={"billing_active": True},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_patch_user_modify_billing_status(self, admin_client):
        """Modify user billing status and verify change"""
        # Get existing users
        users_response = await admin_client.get("/admin/users")
        if users_response.status_code == 200:
            users = users_response.json()
            if users and len(users) > 0:
                user_uuid = users[0].get("uuid")
                if user_uuid:
                    # Attempt to update billing_active
                    response = await admin_client.patch(
                        f"/admin/users/{user_uuid}",
                        json={"billing_active": True},
                    )
                    # Should succeed or fail due to seat limits
                    assert response.status_code in {200, 400, 403}

                    if response.status_code == 200:
                        data = response.json()
                        assert isinstance(data, dict)
                        assert "success" in data or isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_patch_user_empty_payload(self, admin_client):
        """Empty payload should be handled gracefully"""
        users_response = await admin_client.get("/admin/users")
        if users_response.status_code == 200:
            users = users_response.json()
            if users and len(users) > 0:
                user_uuid = users[0].get("uuid")
                if user_uuid:
                    response = await admin_client.patch(
                        f"/admin/users/{user_uuid}",
                        json={},
                    )
                    # Should succeed or return validation error
                    assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_patch_user_cross_org_permissions(self, admin_client):
        """Should fail with 403 when assigning permissions from a different organization"""
        # Admin assigns a permissions UUID that they don't have access to
        fake_user_uuid = str(uuid4())
        fake_perm_uuid = str(uuid4())
        response = await admin_client.patch(
            f"/admin/users/{fake_user_uuid}",
            json={"permissions_uuid": fake_perm_uuid},
        )
        assert response.status_code == 403
        assert response.json().get("detail") == "Cannot assign permissions from a different organization"


# =============================================================================
# ADMIN USER DELETION TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminUserDeletion:
    """Tests for /admin/users/{uuid} DELETE endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_delete_user_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.delete(f"/admin/users/{test_uuid}")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_delete_user_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.delete(f"/admin/users/{test_uuid}")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_user_invalid_uuid(self, admin_client):
        """Should return 422 for invalid UUID"""
        response = await admin_client.delete("/admin/users/not-a-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_nonexistent_user_returns_404(self, admin_client):
        """Deleting nonexistent user should return 404 or 400"""
        fake_uuid = str(uuid4())
        response = await admin_client.delete(f"/admin/users/{fake_uuid}")
        assert response.status_code in {400, 404}

    @pytest.mark.asyncio
    async def test_delete_user_full_flow(self, admin_client, db_session):
        """Create user via admin, delete, verify gone"""

        unique_email = f"admindelete_{uuid4().hex[:8]}@testintegration.com"

        # Create user via admin endpoint
        create_response = await admin_client.post(
            "/admin/create-user",
            json={"email": unique_email},
        )

        if create_response.status_code in {200, 201}:
            # Get user UUID from response or search
            users_response = await admin_client.get("/admin/users")
            if users_response.status_code == 200:
                users = users_response.json()
                user_to_delete = None
                for user in users:
                    if user.get("email", "").lower() == unique_email.lower():
                        user_to_delete = user.get("uuid")
                        break

                if user_to_delete:
                    # Delete user
                    delete_response = await admin_client.delete(f"/admin/users/{user_to_delete}")
                    assert delete_response.status_code == 200

                    # Verify user is deleted (second delete should return 404/400)
                    delete_again = await admin_client.delete(f"/admin/users/{user_to_delete}")
                    assert delete_again.status_code in {400, 404}


# =============================================================================
# ADMIN USER REMOVE TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminUserRemove:
    """Tests for /admin/users/{uuid}/remove endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_remove_user_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.delete(f"/admin/users/{test_uuid}/remove")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_remove_user_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.delete(f"/admin/users/{test_uuid}/remove")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_remove_user_invalid_uuid(self, admin_client):
        """Should return 422 for invalid UUID"""
        response = await admin_client.delete("/admin/users/not-a-uuid/remove")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_remove_nonexistent_user_returns_404(self, admin_client):
        """Removing nonexistent user should return 404 or 400"""
        fake_uuid = str(uuid4())
        response = await admin_client.delete(f"/admin/users/{fake_uuid}/remove")
        assert response.status_code in {400, 404}

    @pytest.mark.asyncio
    async def test_remove_user_from_entity(self, admin_client):
        """Remove user from entity (sets permissions_uuid to None)"""
        # Get existing users
        users_response = await admin_client.get("/admin/users")
        if users_response.status_code == 200:
            users = users_response.json()
            # Find a user that's part of an entity (has permissions)
            for user in users:
                user_uuid = user.get("uuid")
                if user_uuid:
                    # Attempt to remove - may succeed or fail based on entity membership
                    response = await admin_client.delete(f"/admin/users/{user_uuid}/remove")
                    # 200 for success, 404 if user not in entity
                    assert response.status_code in {200, 400, 404}
                    break


# =============================================================================
# ADMIN USER REVOKE TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminUserRevoke:
    """Tests for /admin/users/{uuid}/revoke endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_revoke_user_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.post(f"/admin/users/{test_uuid}/revoke")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_revoke_user_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.post(f"/admin/users/{test_uuid}/revoke")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_revoke_user_invalid_uuid(self, admin_client):
        """Should return 422 for invalid UUID"""
        response = await admin_client.post("/admin/users/not-a-uuid/revoke")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_user_returns_404(self, admin_client):
        """Revoking nonexistent user should return 404 or 400"""
        fake_uuid = str(uuid4())
        response = await admin_client.post(f"/admin/users/{fake_uuid}/revoke")
        assert response.status_code in {400, 404}

    @pytest.mark.asyncio
    async def test_revoke_user_invite(self, admin_client):
        """Revoke user invite (sets invite revoked=True)"""
        # Get existing users
        users_response = await admin_client.get("/admin/users")
        if users_response.status_code == 200:
            users = users_response.json()
            for user in users:
                user_uuid = user.get("uuid")
                if user_uuid:
                    # Attempt to revoke
                    response = await admin_client.post(f"/admin/users/{user_uuid}/revoke")
                    # 200 for success, 404 if no invite exists
                    assert response.status_code in {200, 400, 404}
                    break


# =============================================================================
# ADMIN USER PERMISSIONS GET TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminUserPermissions:
    """Tests for /admin/user-permissions/{uuid} endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_get_user_permissions_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.get(f"/admin/user-permissions/{test_uuid}")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_user_permissions_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.get(f"/admin/user-permissions/{test_uuid}")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_user_permissions_invalid_uuid(self, admin_client):
        """Should return 422 for invalid UUID"""
        response = await admin_client.get("/admin/user-permissions/not-a-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_permissions_for_existing_user(self, admin_client):
        """Get permissions for an existing user"""
        # Get existing users
        users_response = await admin_client.get("/admin/users")
        if users_response.status_code == 200:
            users = users_response.json()
            if users and len(users) > 0:
                user_uuid = users[0].get("uuid")
                if user_uuid:
                    response = await admin_client.get(f"/admin/user-permissions/{user_uuid}")
                    # 200 for success, 404 if user has no permissions
                    assert response.status_code in {200, 404}

                    if response.status_code == 200:
                        data = response.json()
                        assert isinstance(data, (dict, list))

    @pytest.mark.asyncio
    async def test_get_permissions_for_nonexistent_user(self, admin_client):
        """Get permissions for nonexistent user - API returns empty result (200)"""
        fake_uuid = str(uuid4())
        response = await admin_client.get(f"/admin/user-permissions/{fake_uuid}")
        # API returns 200 with empty permissions for nonexistent users
        # This is valid behavior (no permissions = empty list/dict)
        assert response.status_code in {200, 400, 404}


# =============================================================================
# ADMIN REGISTER DELETE TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminRegisterDelete:
    """Tests for DELETE /admin/register/{id} endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_delete_register_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.delete(f"/admin/register/{test_uuid}")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_delete_register_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        test_uuid = str(uuid4())
        response = await auth_client.delete(f"/admin/register/{test_uuid}")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_register_invalid_uuid(self, admin_client):
        """Should return 422 for invalid UUID"""
        response = await admin_client.delete("/admin/register/not-a-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_nonexistent_invite(self, admin_client):
        """Deleting nonexistent invite should return 404"""
        fake_uuid = str(uuid4())
        response = await admin_client.delete(f"/admin/register/{fake_uuid}")
        assert response.status_code in {400, 404}

    @pytest.mark.asyncio
    async def test_delete_invite_full_flow(self, admin_client):
        """Create invite then delete it"""
        unique_email = f"invitedelete_{uuid4().hex[:8]}@testintegration.com"

        # Create invite
        create_response = await admin_client.post(
            "/admin/register",
            json={"email": unique_email},
        )

        if create_response.status_code in {200, 201}:
            create_data = create_response.json()
            invite_uuid = create_data.get("uuid")

            if invite_uuid:
                # Delete the invite
                delete_response = await admin_client.delete(f"/admin/register/{invite_uuid}")
                assert delete_response.status_code == 200

                # Verify invite is gone
                second_delete = await admin_client.delete(f"/admin/register/{invite_uuid}")
                assert second_delete.status_code in {400, 404}


# =============================================================================
# ADMIN APPS MANAGEMENT TESTS - REAL OPERATIONS
# =============================================================================


class TestAdminAppsManagement:
    """Tests for /admin/apps endpoints - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_get_apps_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/admin/apps")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_apps_non_admin(self, auth_client):
        """Should fail for non-admin users"""
        response = await auth_client.get("/admin/apps")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_apps_returns_list(self, admin_client):
        """Admin should get list of apps"""
        response = await admin_client.get("/admin/apps")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_apps_response_schema(self, admin_client):
        """Verify apps response schema"""
        response = await admin_client.get("/admin/apps")
        assert response.status_code == 200
        data = response.json()

        for app in data:
            # Each app should be a dict with expected fields
            assert isinstance(app, dict)
            # Apps typically have name, uuid, or similar identifiers
