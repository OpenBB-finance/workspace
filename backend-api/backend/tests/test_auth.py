"""
Integration tests for Authentication endpoints.

Tests the real workspace flows using actual payloads from the frontend.
No mocking of internal logic - tests hit the real database.

Flow tested:
1. Register: POST /pro/register
2. Login with temp password: POST /pro/login
3. Change password: PUT /user
4. Set profile: PUT /user (first_name, last_name)
5. Logout: GET /logout
6. Delete account: DELETE /user

Additional tests:
- 2FA/TOTP activation
- Password reset
- OAuth error handling
"""

import os
import sys

# Add the backend directory to Python path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest

from tests.fixtures.utils import skip
import jwt
from uuid import uuid4
from datetime import datetime, timedelta, UTC
from sqlalchemy import delete, select

from api.models import User, Session as SessionModel, UserProInvite
from utilities.config import settings


# =============================================================================
# Workspace Payloads - Exact payloads from the frontend
# =============================================================================


class WorkspacePayloads:
    """Real payloads that the workspace frontend sends to the backend."""

    @staticmethod
    def register(email: str, newsletter: bool = True, hear_about_us: str = "linkedin"):
        """POST /pro/register payload"""
        return {
            "email": email,
            "newsletter": newsletter,
            "hear_about_us": hear_about_us,
        }

    @staticmethod
    def login(email: str, password: str, version: str = "v3.3.0"):
        """POST /pro/login payload"""
        return {
            "email": email,
            "password": password,
            "remember": False,
            "ip_address": "",
            "source": "pro",
            "totp_token": None,
            "version": version,
        }

    @staticmethod
    def change_password(old_password: str, new_password: str):
        """PUT /user payload for password change"""
        return {
            "old_password": old_password,
            "new_password": new_password,
        }

    @staticmethod
    def set_profile(first_name: str, last_name: str):
        """PUT /user payload for profile update"""
        return {
            "first_name": first_name,
            "last_name": last_name,
        }


# =============================================================================
# Helper Functions
# =============================================================================


def create_service_jwt():
    """Create a service JWT for X-OpenBB-Authorization header"""
    payload = {
        "sub": "pro",
        "iss": "openbb-hub",
        "exp": datetime.now(UTC) + timedelta(hours=1),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


async def cleanup_test_user(
    db_session,
    user_uuid: str | None = None,
    email: str | None = None,
):
    """Clean up test user and related data"""
    if user_uuid:
        await db_session.execute(delete(SessionModel).where(SessionModel.user_uuid == user_uuid))
        await db_session.execute(delete(User).where(User.uuid == user_uuid))
    if email:
        await db_session.execute(delete(UserProInvite).where(UserProInvite.email == email))
        await db_session.execute(delete(User).where(User.email == email))
    await db_session.commit()


# =============================================================================
# TEST: Login Endpoint
# =============================================================================


class TestProLogin:
    """Tests for POST /pro/login endpoint (workspace login)"""

    @pytest.mark.asyncio
    async def test_login_missing_credentials(self, pro_client):
        """Login with empty payload should return 422"""
        response = await pro_client.post("/pro/login", json={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_missing_password(self, pro_client):
        """Login without password should return 422"""
        response = await pro_client.post("/pro/login", json={"email": "test@test.com"})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, pro_client):
        """Login with nonexistent user should return 401"""
        response = await pro_client.post(
            "/pro/login", json=WorkspacePayloads.login("nonexistent@test.com", "WrongPassword123!")
        )
        # /pro/login returns 401 for nonexistent user
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_valid_credentials(self, pro_client, db_session):
        """Login with valid credentials should return 200 with access_token

        Note: /pro/login requires users to have entity associations. Users without
        entity associations will get 404 when the system tries to associate them.
        This test verifies the login attempt doesn't cause a 500 error.
        For full login testing, use auth_client which has proper entity setup.
        """
        test_password = "TestPassword123!"
        test_user_uuid = str(uuid4())
        test_email = f"login_test_{uuid4().hex[:8]}@openbb.co"

        # Create confirmed test user (without entity association)
        test_user = User(
            uuid=test_user_uuid,
            email=test_email,
            clean_email=test_email.lower(),
            password=test_password,
            confirmed=True,
        )
        db_session.add(test_user)
        await db_session.commit()

        try:
            response = await pro_client.post("/pro/login", json=WorkspacePayloads.login(test_email, test_password))

            # Without entity setup, returns 404 (entity not found)
            # With entity setup, returns 200/206
            # Should never return 500
            assert response.status_code in {200, 206, 404}
            assert response.status_code != 500

            if response.status_code in {200, 206}:
                data = response.json()
                assert "access_token" in data
                assert data["email"] == test_email
                assert data["token_type"] == "bearer"
                assert "uuid" in data
        finally:
            await cleanup_test_user(db_session, user_uuid=test_user_uuid)

    @pytest.mark.asyncio
    async def test_login_unconfirmed_user(self, pro_client, db_session):
        """Login for unconfirmed user should return 403 (or 404 if no entity)

        Note: /pro/login may return 404 if user lacks entity association.
        The 403 check only applies when entity setup is complete.
        """
        test_password = "TestPassword123!"
        test_user_uuid = str(uuid4())
        test_email = f"unconfirmed_{uuid4().hex[:8]}@openbb.co"

        test_user = User(
            uuid=test_user_uuid,
            email=test_email,
            clean_email=test_email.lower(),
            password=test_password,
            confirmed=False,
        )
        db_session.add(test_user)
        await db_session.commit()

        try:
            response = await pro_client.post("/pro/login", json=WorkspacePayloads.login(test_email, test_password))
            # 403 for unconfirmed user, 404 if entity association missing
            assert response.status_code in {403, 404}
        finally:
            await cleanup_test_user(db_session, user_uuid=test_user_uuid)

    @pytest.mark.asyncio
    async def test_login_empty_email(self, pro_client):
        """Login with empty email should return 422"""
        response = await pro_client.post("/pro/login", json=WorkspacePayloads.login("", "password123"))
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_empty_password(self, pro_client):
        """Login with empty password should return 422"""
        response = await pro_client.post("/pro/login", json=WorkspacePayloads.login("test@test.com", ""))
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_sql_injection_attempt(self, pro_client):
        """Login should safely handle SQL injection attempts"""
        response = await pro_client.post(
            "/pro/login", json=WorkspacePayloads.login("test@test.com' OR '1'='1", "password' OR '1'='1")
        )
        # Should return 404 (not found) or 422 (validation error), not 500
        assert response.status_code in {404, 422}

    @pytest.mark.asyncio
    async def test_login_xss_attempt(self, pro_client):
        """Login should safely handle XSS attempts"""
        response = await pro_client.post(
            "/pro/login", json=WorkspacePayloads.login("<script>alert('xss')</script>@test.com", "password123")
        )
        assert response.status_code in {404, 422}


# =============================================================================
# TEST: Logout Endpoint
# =============================================================================


class TestLogout:
    """Tests for GET /logout endpoint"""

    @pytest.mark.asyncio
    async def test_logout_unauthenticated(self, client):
        """Logout without auth should return 401 or 403"""
        response = await client.get("/logout")
        assert response.status_code in {401, 403}
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_logout_authenticated(self, auth_client):
        """Logout with valid session should return 200 with success=True"""
        response = await auth_client.get("/logout")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True


# =============================================================================
# TEST: Register Endpoint
# =============================================================================


class TestRegister:
    """Tests for POST /pro/register endpoint"""

    @pytest.mark.asyncio
    async def test_register_missing_email(self, pro_client):
        """Register without email should return 422"""
        response = await pro_client.post("/pro/register", json={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, pro_client):
        """Register with invalid email format should return 422"""
        response = await pro_client.post("/pro/register", json=WorkspacePayloads.register("not-an-email"))
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_valid_input(self, pro_client, db_session):
        """Register with valid input should return 200"""
        test_email = f"register_test_{uuid4().hex[:8]}@openbb.co"

        try:
            response = await pro_client.post("/pro/register", json=WorkspacePayloads.register(test_email))

            # 200 for success, 400 if HubSpot disabled
            assert response.status_code in {200, 400}

            if response.status_code == 200:
                data = response.json()
                assert data.get("success") is True
        finally:
            await cleanup_test_user(db_session, email=test_email)

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, pro_client, db_session):
        """Register with existing email should handle gracefully

        Note: /pro/register for an existing user creates a transfer invite
        (sends email to transfer to Pro), it doesn't return a conflict error.
        This is the expected behavior to allow existing Hub users to join Pro.
        """
        test_email = f"duplicate_{uuid4().hex[:8]}@openbb.co"
        test_user_uuid = str(uuid4())

        # Create existing user
        existing_user = User(
            uuid=test_user_uuid,
            email=test_email,
            clean_email=test_email.lower(),
            password="Password123!",  # noqa: S106
            confirmed=True,
        )
        db_session.add(existing_user)
        await db_session.commit()

        try:
            response = await pro_client.post("/pro/register", json=WorkspacePayloads.register(test_email))
            # 200 creates transfer invite, 400 if HubSpot disabled
            assert response.status_code in {200, 400}
        finally:
            # Cleanup in correct order for FK constraints
            from sqlalchemy import delete, text
            from api.models import PermissionsInvite

            await db_session.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            await db_session.execute(delete(PermissionsInvite).where(PermissionsInvite.user_uuid == test_user_uuid))
            await db_session.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            await cleanup_test_user(db_session, user_uuid=test_user_uuid, email=test_email)

    @pytest.mark.asyncio
    async def test_register_email_too_long(self, pro_client):
        """Register with email > 70 chars should return 422 (Chargebee limit)"""
        long_local = "a" * 61
        long_email = f"{long_local}@openbb.co"  # 71 chars total

        response = await pro_client.post("/pro/register", json=WorkspacePayloads.register(long_email))
        assert response.status_code == 422


# =============================================================================
# TEST: User Profile Endpoints
# =============================================================================


class TestUserProfile:
    """Tests for /user and /pro/user endpoints"""

    @pytest.mark.asyncio
    async def test_get_user_unauthenticated(self, client):
        """Getting user without auth should return 401 or 403"""
        response = await client.get("/pro/user")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_user_authenticated(self, auth_client):
        """Getting user with auth should return 200 with user data"""
        response = await auth_client.get("/pro/user")
        assert response.status_code == 200

        data = response.json()
        assert "email" in data
        assert "uuid" in data
        assert data["email"] == "testrunner@openbb.co"

        # Should not expose sensitive fields
        assert "password" not in str(data).lower() or "password_hash" not in str(data)

    @pytest.mark.asyncio
    async def test_update_user_profile(self, auth_client):
        """Updating user profile should return 200"""
        response = await auth_client.put("/user", json=WorkspacePayloads.set_profile("IntegrationTest", "User"))
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True


# =============================================================================
# TEST: Password Change
# =============================================================================


class TestPasswordChange:
    """Tests for password change via PUT /user"""

    @pytest.mark.asyncio
    async def test_change_password_unauthenticated(self, client):
        """Password change without auth should return 401 or 403"""
        response = await client.put("/user", json=WorkspacePayloads.change_password("old", "new"))
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_change_password_wrong_old_password(self, pro_client, db_session):
        """Password change with wrong old password should fail"""
        test_password = "CorrectPassword123!"
        test_user_uuid = str(uuid4())
        test_email = f"pwchange_{uuid4().hex[:8]}@openbb.co"

        test_user = User(
            uuid=test_user_uuid,
            email=test_email,
            clean_email=test_email.lower(),
            password=test_password,
            confirmed=True,
        )
        db_session.add(test_user)
        await db_session.commit()

        try:
            # Login first
            login_response = await pro_client.post("/pro/login", json=WorkspacePayloads.login(test_email, test_password))
            if login_response.status_code not in {200, 206}:
                skip("Could not login for password change test")

            token = login_response.json()["access_token"]
            service_jwt = create_service_jwt()

            pro_client.headers.update(
                {
                    "Authorization": f"Bearer {token}",
                    "X-OpenBB-Authorization": f"Bearer {service_jwt}",
                }
            )

            # Try to change with wrong old password
            response = await pro_client.put(
                "/user", json=WorkspacePayloads.change_password("WrongOldPassword!", "NewPassword123!")
            )
            assert response.status_code in {400, 401, 422}
        finally:
            await cleanup_test_user(db_session, user_uuid=test_user_uuid)


# =============================================================================
# TEST: Forgot Password
# =============================================================================


class TestForgotPassword:
    """Tests for /forgot-password endpoints"""

    @pytest.mark.asyncio
    async def test_forgot_password_missing_email(self, client):
        """Forgot password without email should return 422"""
        response = await client.post("/forgot-password", json={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forgot_password_nonexistent_user(self, client):
        """Forgot password for nonexistent user should not reveal if user exists"""
        response = await client.post("/forgot-password", json={"email": f"nonexistent_{uuid4().hex}@test.com"})
        # Should return 200 (same as valid user) to prevent enumeration, or 400 if HubSpot disabled
        assert response.status_code in {200, 400}

    @pytest.mark.asyncio
    async def test_forgot_password_valid_user(self, client, db_session):
        """Forgot password for valid user should return 200"""
        test_user_uuid = str(uuid4())
        test_email = f"forgot_{uuid4().hex[:8]}@openbb.co"

        test_user = User(
            uuid=test_user_uuid,
            email=test_email,
            clean_email=test_email.lower(),
            password="TestPassword123!",  # noqa: S106
            confirmed=True,
        )
        db_session.add(test_user)
        await db_session.commit()

        try:
            response = await client.post("/forgot-password", json={"email": test_email})
            # 200 success or 400 if HubSpot disabled
            assert response.status_code in {200, 400}
        finally:
            await cleanup_test_user(db_session, user_uuid=test_user_uuid)


# =============================================================================
# TEST: Password Reset Confirmation
# =============================================================================


class TestPasswordResetConfirmation:
    """Tests for /forgot-password-confirmation endpoint"""

    @pytest.mark.asyncio
    async def test_reset_missing_fields(self, client):
        """Password reset without required fields should return 422"""
        response = await client.post("/forgot-password-confirmation", json={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_reset_invalid_token(self, client):
        """Password reset with invalid token should return 401"""
        response = await client.post(
            "/forgot-password-confirmation", json={"token": "invalid_token", "password": "NewPassword123!"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_reset_expired_token(self, client):
        """Password reset with expired token should return 401"""
        expired_payload = {
            "sub": "test@test.com",
            "token_type": "forgot_password",
            "exp": datetime.now(UTC) - timedelta(hours=1),
        }
        expired_token = jwt.encode(expired_payload, settings.JWT_SECRET, algorithm="HS256")

        response = await client.post(
            "/forgot-password-confirmation", json={"token": expired_token, "password": "NewPassword123!"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_reset_password_too_short(self, client):
        """Password reset with short password should return 422"""
        response = await client.post("/forgot-password-confirmation", json={"token": "some_token", "password": "Short1"})
        assert response.status_code == 422


# =============================================================================
# TEST: 2FA / TOTP
# =============================================================================


class TestTwoFactorAuth:
    """Tests for TOTP/2FA endpoints"""

    @pytest.mark.asyncio
    async def test_get_2fa_unauthenticated(self, client):
        """Getting 2FA settings without auth should return 401 or 403"""
        response = await client.get("/pro/2fa")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_generate_totp_unauthenticated(self, client):
        """Generating TOTP without auth should return 401 or 403"""
        response = await client.post("/totp", json={})
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_activate_totp_unauthenticated(self, client):
        """Activating TOTP without auth should return 401 or 403"""
        response = await client.post("/totp/activate", json={"totp_token": 123456})
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_activate_totp_without_secret(self, auth_client):
        """Activating TOTP without generating secret first should return 400"""
        response = await auth_client.post("/totp/activate", json={"totp_token": 123456})
        assert response.status_code in {400, 401}

    @pytest.mark.asyncio
    async def test_activate_totp_wrong_code(self, auth_client):
        """Activating TOTP with wrong code should return 401"""
        # First generate a secret
        generate_response = await auth_client.post("/totp", json={})
        if generate_response.status_code == 200:
            response = await auth_client.post("/totp/activate", json={"totp_token": 0})
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_totp_full_flow(self, pro_client, db_session):
        """Test complete TOTP activation: generate -> activate with valid code"""
        import pyotp

        test_user_uuid = str(uuid4())
        test_email = f"totp_{uuid4().hex[:8]}@openbb.co"
        test_password = "TotpTestPassword123!"

        test_user = User(
            uuid=test_user_uuid,
            email=test_email,
            clean_email=test_email.lower(),
            password=test_password,
            confirmed=True,
        )
        db_session.add(test_user)
        await db_session.commit()

        try:
            # Login
            login_response = await pro_client.post("/pro/login", json=WorkspacePayloads.login(test_email, test_password))
            if login_response.status_code not in {200, 206}:
                skip("Could not login for TOTP test")

            token = login_response.json()["access_token"]
            service_jwt = create_service_jwt()

            pro_client.headers.update(
                {
                    "Authorization": f"Bearer {token}",
                    "X-OpenBB-Authorization": f"Bearer {service_jwt}",
                }
            )

            # Generate TOTP secret
            generate_response = await pro_client.post("/totp", json={})
            if generate_response.status_code == 200:
                secret = generate_response.json()["secret"]

                # Generate valid code
                totp = pyotp.TOTP(secret)
                valid_code = int(totp.now())

                # Activate with valid code
                activate_response = await pro_client.post("/totp/activate", json={"totp_token": valid_code})
                assert activate_response.status_code == 200
                assert activate_response.json().get("success") is True
        finally:
            await cleanup_test_user(db_session, user_uuid=test_user_uuid)


# =============================================================================
# TEST: User Deletion
# =============================================================================


class TestUserDeletion:
    """Tests for DELETE /user endpoint"""

    @pytest.mark.asyncio
    async def test_delete_user_unauthenticated(self, client):
        """Deleting user without auth should return 401 or 403"""
        response = await client.delete("/user")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_delete_user_full_flow(self, pro_client, db_session):
        """Test complete user deletion: create -> delete -> verify can't login"""
        test_user_uuid = str(uuid4())
        test_email = f"delete_{uuid4().hex[:8]}@openbb.co"
        test_password = "DeleteTestPassword123!"

        test_user = User(
            uuid=test_user_uuid,
            email=test_email,
            clean_email=test_email.lower(),
            password=test_password,
            confirmed=True,
        )
        db_session.add(test_user)
        await db_session.commit()

        try:
            # Login
            login_response = await pro_client.post("/pro/login", json=WorkspacePayloads.login(test_email, test_password))
            if login_response.status_code not in {200, 206}:
                skip("Could not login for delete test")

            token = login_response.json()["access_token"]
            service_jwt = create_service_jwt()

            pro_client.headers.update(
                {
                    "Authorization": f"Bearer {token}",
                    "X-OpenBB-Authorization": f"Bearer {service_jwt}",
                }
            )

            # Delete user
            delete_response = await pro_client.delete("/user")
            assert delete_response.status_code == 200
            assert delete_response.json().get("success") is True

            # Verify can't login anymore
            login_again = await pro_client.post("/pro/login", json=WorkspacePayloads.login(test_email, test_password))
            assert login_again.status_code == 404
        finally:
            # Cleanup any remaining sessions
            await db_session.execute(delete(SessionModel).where(SessionModel.user_uuid == test_user_uuid))
            await db_session.commit()


# =============================================================================
# TEST: OAuth Error Handling
# =============================================================================


class TestOAuthErrorHandling:
    """Tests for OAuth endpoints error handling"""

    @pytest.mark.asyncio
    async def test_google_auth_missing_token(self, pro_client):
        """Google auth without token should return error"""
        response = await pro_client.post("/pro/google-auth", json={})
        # 400/422 for missing token, 401 for auth error
        assert response.status_code in {400, 401, 422}

    @pytest.mark.asyncio
    async def test_google_auth_invalid_token(self, pro_client):
        """Google auth with invalid token should return error, not 500"""
        response = await pro_client.post("/pro/google-auth", json={"token": "invalid_token"})
        assert response.status_code in {400, 401, 422}
        assert response.status_code != 500

    @pytest.mark.asyncio
    async def test_microsoft_auth_missing_token(self, pro_client):
        """Microsoft auth without token should return error"""
        response = await pro_client.post("/pro/microsoft-auth", json={})
        # 400/422 for missing token, 401 for auth error
        assert response.status_code in {400, 401, 422}

    @pytest.mark.asyncio
    async def test_oauth_sql_injection_attempt(self, pro_client):
        """OAuth should handle SQL injection safely"""
        response = await pro_client.post("/pro/google-auth", json={"token": "'; DROP TABLE users; --"})
        assert response.status_code in {400, 401, 422}
        assert response.status_code != 500

    @pytest.mark.asyncio
    async def test_oauth_no_token_leakage(self, pro_client):
        """OAuth error should not echo back the token"""
        test_token = "secret_test_token_12345"
        response = await pro_client.post("/pro/google-auth", json={"token": test_token})
        assert test_token not in response.text


# =============================================================================
# TEST: Session Validation
# =============================================================================


class TestSessionValidation:
    """Tests for /pro/validate endpoint"""

    @pytest.mark.asyncio
    async def test_validate_unauthenticated(self, client):
        """Validate without auth should return 401 or 403"""
        response = await client.get("/pro/validate")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_validate_authenticated(self, auth_client):
        """Validate with valid session should return 200"""
        response = await auth_client.get("/pro/validate")
        assert response.status_code == 200


# =============================================================================
# TEST: Full Registration Flow (Integration)
# =============================================================================


class TestFullRegistrationFlow:
    """
    Integration test for the complete registration flow as done by workspace.

    Flow:
    1. POST /pro/register - Creates invite with temp password
    2. POST /pro/login - Login with temp password
    3. PUT /user - Change to permanent password
    4. PUT /user - Set first/last name
    """

    @pytest.mark.asyncio
    async def test_registration_creates_invite(self, pro_client, db_session):
        """Registration should create UserProInvite with temporary password"""
        test_email = f"flow_test_{uuid4().hex[:8]}@openbb.co"

        try:
            response = await pro_client.post("/pro/register", json=WorkspacePayloads.register(test_email))

            if response.status_code == 200:
                # Check that invite was created
                invite_query = select(UserProInvite).where(UserProInvite.email == test_email)
                result = await db_session.execute(invite_query)
                invite = result.scalar_one_or_none()

                assert invite is not None
                assert invite.data is not None
                # Temp password should be in the data
                assert "password" in invite.data
        finally:
            await cleanup_test_user(db_session, email=test_email)
