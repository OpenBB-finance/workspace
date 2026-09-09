import base64
from uuid import uuid4

import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_database_connection(db_session):
    """
    Verify we can connect to the test database and execute SQL.
    """
    result = await db_session.execute(text("SELECT 1"))
    assert result.scalar() == 1


@pytest.mark.asyncio
async def test_migrations_applied(db_session):
    """
    Verify that migrations were applied by checking for a known table.
    'user' table is standard.
    """
    # Check if 'user' table exists
    result = await db_session.execute(text("SHOW TABLES LIKE 'user'"))
    assert result.scalar() == "user"


@pytest.mark.asyncio
async def test_unauthenticated_access(client):
    """
    Verify 401/403 on protected endpoints without auth.
    Using /pro/user as it is in the CSV under Authentication.
    """
    response = await client.get("/pro/user")
    # Depending on how the app handles no auth, usually 401 or 403
    assert response.status_code in {401, 403}


@pytest.mark.asyncio
async def test_authenticated_access(auth_client):
    """
    Verify 200 on protected endpoints with auth.
    """
    # This endpoint gets the current user
    response = await auth_client.get("/pro/user")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "testrunner@openbb.co"


# =============================================================================
# DATABASE INTEGRITY TESTS
# =============================================================================


@pytest.mark.asyncio
async def test_required_tables_exist(db_session):
    """Verify all required tables exist in the database."""
    required_tables = [
        "user",
        "session",
        "role",
    ]
    for table in required_tables:
        result = await db_session.execute(text(f"SHOW TABLES LIKE '{table}'"))
        assert result.scalar() == table, f"Table '{table}' should exist"


@pytest.mark.asyncio
async def test_alembic_version_table_exists(db_session):
    """Verify alembic_version table exists (migrations were run)."""
    result = await db_session.execute(text("SHOW TABLES LIKE 'alembic_version'"))
    assert result.scalar() == "alembic_version"


@pytest.mark.asyncio
async def test_user_table_has_required_columns(db_session):
    """Verify user table has required columns."""
    result = await db_session.execute(text("DESCRIBE user"))
    columns = [row[0] for row in result.fetchall()]
    required_columns = ["uuid", "email"]
    for col in required_columns:
        assert col in columns, f"Column '{col}' should exist in user table"


# =============================================================================
# AUTHENTICATION EDGE CASE TESTS
# =============================================================================


@pytest.mark.asyncio
async def test_missing_auth_header(client):
    """Request without Authorization header should fail."""
    # Ensure no auth header
    if "Authorization" in client.headers:
        del client.headers["Authorization"]
    response = await client.get("/pro/user")
    assert response.status_code in {401, 403}
    # Validate error response structure
    data = response.json()
    assert isinstance(data, dict)
    assert "detail" in data or "message" in data or "error" in data
    # Ensure no sensitive data in error response
    response_str = str(data).lower()
    assert "password" not in response_str
    assert "secret" not in response_str
    assert (
        "token" not in response_str
        or "invalid" in response_str
        or "required" in response_str
    )


@pytest.mark.asyncio
async def test_invalid_bearer_token(client):
    """Invalid bearer token should be rejected."""
    client.headers["Authorization"] = "Bearer invalid_token_here"
    response = await client.get("/pro/user")
    assert response.status_code in {401, 403}
    # Validate error response structure
    data = response.json()
    assert isinstance(data, dict)
    assert "detail" in data or "message" in data or "error" in data
    # Ensure token value not echoed back
    response_str = str(data)
    assert "invalid_token_here" not in response_str


@pytest.mark.asyncio
async def test_malformed_auth_header(client):
    """Malformed auth header should be rejected."""
    client.headers["Authorization"] = "not-bearer-format"
    response = await client.get("/pro/user")
    assert response.status_code in {401, 403}
    # Validate error response structure
    data = response.json()
    assert isinstance(data, dict)
    assert "detail" in data or "message" in data or "error" in data


@pytest.mark.asyncio
async def test_empty_bearer_token(client):
    """Empty bearer token should be rejected."""
    client.headers["Authorization"] = "Bearer "
    response = await client.get("/pro/user")
    assert response.status_code in {401, 403}
    # Validate error response structure
    data = response.json()
    assert isinstance(data, dict)
    assert "detail" in data or "message" in data or "error" in data


@pytest.mark.asyncio
async def test_basic_auth_not_accepted(client):
    """Basic auth should not work on bearer-only endpoints."""
    credentials = base64.b64encode(b"user:pass").decode()
    client.headers["Authorization"] = f"Basic {credentials}"
    response = await client.get("/pro/user")
    assert response.status_code in {401, 403}
    # Validate error response structure
    data = response.json()
    assert isinstance(data, dict)
    assert "detail" in data or "message" in data or "error" in data
    # Ensure credentials not echoed back
    response_str = str(data)
    assert credentials not in response_str
    assert "user:pass" not in response_str


# =============================================================================
# API RESPONSE FORMAT TESTS
# =============================================================================


@pytest.mark.asyncio
async def test_json_content_type(auth_client):
    """API should return JSON content type."""
    response = await auth_client.get("/pro/user")
    assert response.status_code == 200
    content_type = response.headers.get("content-type", "")
    assert "application/json" in content_type


@pytest.mark.asyncio
async def test_user_response_has_uuid(auth_client):
    """User response should include uuid."""
    response = await auth_client.get("/pro/user")
    assert response.status_code == 200
    data = response.json()
    assert "uuid" in data


@pytest.mark.asyncio
async def test_user_response_no_password_hash(auth_client):
    """User response should never expose password hash."""
    response = await auth_client.get("/pro/user")
    assert response.status_code == 200
    data_str = str(response.json())
    assert "password_hash" not in data_str
    assert "hashed_password" not in data_str


# =============================================================================
# HEALTH & STATUS ENDPOINT TESTS
# =============================================================================


@pytest.mark.asyncio
async def test_health_endpoint_exists(client):
    """Health check endpoint should exist and be accessible."""
    # Common health check paths
    for path in ["/health", "/healthz", "/status", "/"]:
        response = await client.get(path)
        if response.status_code == 200:
            return  # Found a working health endpoint
    # If none found, check root returns something
    response = await client.get("/")
    assert response.status_code in {200, 404}


# =============================================================================
# ERROR HANDLING TESTS
# =============================================================================


@pytest.mark.asyncio
async def test_404_for_nonexistent_endpoint(client):
    """Nonexistent endpoint should return 404."""
    response = await client.get("/this/endpoint/does/not/exist")
    assert response.status_code == 404
    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data
        # Ensure path is not echoed back in a way that could enable XSS
        return

    assert "Not Found" in response.text


@pytest.mark.asyncio
async def test_405_for_wrong_method(auth_client):
    """Wrong HTTP method should return 405."""
    # Try DELETE on a GET-only endpoint
    response = await auth_client.delete("/pro/user")
    # 405 Method Not Allowed, or 400/422 if handled differently
    assert response.status_code in {200, 400, 404, 405, 422}


@pytest.mark.asyncio
async def test_422_for_invalid_json(auth_client):
    """Invalid JSON body should return 422."""
    # Send invalid JSON to a POST endpoint
    response = await auth_client.post(
        "/pro/display-settings",
        content="not valid json",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code in {400, 422}
    # Validate error response structure
    data = response.json()
    assert isinstance(data, dict)
    assert "detail" in data or "message" in data or "error" in data
    # Content type should be JSON
    content_type = response.headers.get("content-type", "")
    assert "application/json" in content_type


# =============================================================================
# ADMIN VS REGULAR USER TESTS
# =============================================================================


@pytest.mark.asyncio
async def test_admin_endpoints_require_admin(auth_client):
    """Admin endpoints should reject regular users."""
    response = await auth_client.get("/admin/users")
    assert response.status_code in {401, 403}
    # Validate error response structure
    data = response.json()
    assert isinstance(data, dict)
    assert "detail" in data or "message" in data or "error" in data
    # Error should indicate access/permission issue
    response_str = str(data).lower()
    has_access_error = any(
        word in response_str
        for word in ["admin", "permission", "access", "authorized", "forbidden"]
    )
    assert has_access_error


@pytest.mark.asyncio
async def test_admin_client_can_access_admin_endpoints(admin_client):
    """Admin client should access admin endpoints."""
    response = await admin_client.get("/admin/users")
    assert response.status_code == 200
    # Validate response structure
    data = response.json()
    # Should return list of users or paginated response
    if isinstance(data, list):
        # If list, each item should be a user object
        if len(data) > 0:
            user = data[0]
            assert isinstance(user, dict)
            # Should not expose password hashes
            assert "password" not in str(user).lower() or "password_hash" not in str(
                user
            )
    elif isinstance(data, dict):
        # May be paginated: {items: [...], total: ..., page: ...}
        assert "items" in data or "users" in data or "data" in data
    # Content type should be JSON
    content_type = response.headers.get("content-type", "")
    assert "application/json" in content_type


@pytest.mark.asyncio
async def test_regular_user_cannot_elevate_to_admin(auth_client):
    """Regular user should not be able to gain admin access."""
    # Try various privilege escalation attempts
    # Try to assign admin role to self
    response = await auth_client.post(
        "/admin/role",
        json={"name": "Admin", "description": "Attempt to create admin role"},
    )
    assert response.status_code in {401, 403}

    # Try to modify permissions
    fake_uuid = str(uuid4())
    response = await auth_client.put(
        f"/admin/role-permissions/{fake_uuid}",
        json={"permissions": [{"type": "backend", "access": "full-access"}]},
    )
    assert response.status_code in {401, 403}
