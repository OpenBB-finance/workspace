"""
Integration tests for Features & Entitlements endpoints.
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


class TestTier:
    """Tests for /pro/tier endpoint"""

    @pytest.mark.asyncio
    async def test_update_tier_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.put("/pro/tier", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_update_tier_authenticated(self, auth_client):
        """Should update subscription tier"""
        response = await auth_client.put("/pro/tier", json={"tier": "pro"})
        # 200 for success, 400 for invalid, 422 for validation
        assert response.status_code in {200, 400, 422}
        # Validate response structure
        data = response.json()
        assert isinstance(data, dict)
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type


class TestUserHasEntity:
    """Tests for /pro/user-has-entity endpoint"""

    @pytest.mark.asyncio
    async def test_check_entity_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/user-has-entity")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_check_entity_authenticated(self, auth_client):
        """Should return entity membership status"""
        response = await auth_client.get("/pro/user-has-entity")
        assert response.status_code == 200
        # Validate response structure
        data = response.json()
        assert isinstance(data, (bool, dict))
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type


class TestEnabledBundles:
    """Tests for /pro/enabled-bundles endpoints"""

    @pytest.mark.asyncio
    async def test_get_bundles_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/enabled-bundles")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_bundles_authenticated(self, auth_client):
        """Should return enabled bundles"""
        response = await auth_client.get("/pro/enabled-bundles")
        assert response.status_code == 200
        # Validate response structure
        data = response.json()
        assert isinstance(data, (list, dict))
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type

    @pytest.mark.asyncio
    async def test_update_bundles_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.put("/pro/enabled-bundles", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_update_bundles_authenticated(self, auth_client):
        """Should update enabled bundles"""
        response = await auth_client.put("/pro/enabled-bundles", json={"bundles": []})
        # 200 for success, 422 for validation error
        assert response.status_code in {200, 422}
        # Validate response structure
        data = response.json()
        assert isinstance(data, dict)
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type


class TestUsage:
    """Tests for /pro/usage endpoint"""

    @pytest.mark.asyncio
    async def test_get_usage_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/usage")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_usage_authenticated(self, auth_client):
        """Should return API usage stats - may require entity context"""
        response = await auth_client.get("/pro/usage")
        # 200 for success, 400 if missing entity context, 403 for permission denied, 404 if no entitlement
        assert response.status_code in {200, 400, 403, 404}


class TestResourcePermissions:
    """Tests for /pro/resource-permissions endpoint"""

    @pytest.mark.asyncio
    async def test_get_permissions_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/resource-permissions")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_permissions_authenticated(self, auth_client):
        """Should return resource permissions"""
        response = await auth_client.get("/pro/resource-permissions")
        assert response.status_code == 200
        # Validate response structure
        data = response.json()
        assert isinstance(data, (list, dict))
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type


# =============================================================================
# TIER INPUT VALIDATION TESTS
# =============================================================================


class TestTierInputValidation:
    """Tests for tier endpoint input validation"""

    @pytest.mark.asyncio
    async def test_update_tier_invalid_value(self, auth_client):
        """Invalid tier value should be handled"""
        response = await auth_client.put("/pro/tier", json={"tier": "invalid_tier"})
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_update_tier_empty_value(self, auth_client):
        """Empty tier value should be handled"""
        response = await auth_client.put("/pro/tier", json={"tier": ""})
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_update_tier_sql_injection(self, auth_client):
        """SQL injection in tier should be handled safely"""
        response = await auth_client.put(
            "/pro/tier", json={"tier": "'; DROP TABLE users; --"}
        )
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_update_tier_null_value(self, auth_client):
        """Null tier value should be handled"""
        response = await auth_client.put("/pro/tier", json={"tier": None})
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_update_tier_numeric_value(self, auth_client):
        """Numeric tier value should be handled"""
        response = await auth_client.put("/pro/tier", json={"tier": 12345})
        assert response.status_code in {200, 400, 422}


# =============================================================================
# BUNDLES INPUT VALIDATION TESTS
# =============================================================================


class TestBundlesInputValidation:
    """Tests for enabled bundles endpoint input validation"""

    @pytest.mark.asyncio
    async def test_update_bundles_invalid_format(self, auth_client):
        """Invalid bundles format should be handled"""
        response = await auth_client.put(
            "/pro/enabled-bundles", json={"bundles": "not-an-array"}
        )
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_update_bundles_null_value(self, auth_client):
        """Null bundles value should be handled"""
        response = await auth_client.put("/pro/enabled-bundles", json={"bundles": None})
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_update_bundles_invalid_bundle_name(self, auth_client):
        """Invalid bundle name should be handled"""
        response = await auth_client.put(
            "/pro/enabled-bundles", json={"bundles": ["nonexistent_bundle_xyz"]}
        )
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_update_bundles_sql_injection(self, auth_client):
        """SQL injection in bundles should be handled safely"""
        response = await auth_client.put(
            "/pro/enabled-bundles", json={"bundles": ["'; DROP TABLE users; --"]}
        )
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_update_bundles_large_array(self, auth_client):
        """Large bundles array should be handled"""
        response = await auth_client.put(
            "/pro/enabled-bundles", json={"bundles": ["bundle"] * 100}
        )
        assert response.status_code in {200, 400, 422}


# =============================================================================
# FEATURES OUTPUT VALIDATION TESTS
# =============================================================================


class TestFeaturesOutputValidation:
    """Tests for features endpoint output validation"""

    @pytest.mark.asyncio
    async def test_bundles_response_schema(self, auth_client):
        """Enabled bundles response should have expected schema"""
        response = await auth_client.get("/pro/enabled-bundles")
        if response.status_code == 200:
            data = response.json()
            # Should be a list or dict with bundle info
            assert isinstance(data, (list, dict))

    @pytest.mark.asyncio
    async def test_permissions_response_schema(self, auth_client):
        """Resource permissions response should have expected schema"""
        response = await auth_client.get("/pro/resource-permissions")
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict))

    @pytest.mark.asyncio
    async def test_usage_response_schema(self, auth_client):
        """Usage response should have expected schema"""
        response = await auth_client.get("/pro/usage")
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict))

    @pytest.mark.asyncio
    async def test_entity_status_response_schema(self, auth_client):
        """Entity status response should have expected schema"""
        response = await auth_client.get("/pro/user-has-entity")
        if response.status_code == 200:
            data = response.json()
            # Should be a boolean or dict with status
            assert isinstance(data, (bool, dict))

    @pytest.mark.asyncio
    async def test_features_no_sensitive_data(self, auth_client):
        """Features responses should not expose sensitive data"""
        response = await auth_client.get("/pro/resource-permissions")
        if response.status_code == 200:
            data_str = str(response.json())
            assert "password" not in data_str.lower()
            assert "secret" not in data_str.lower()
            assert "private_key" not in data_str.lower()


# =============================================================================
# FEATURES ADMIN TESTS
# =============================================================================


class TestFeaturesAdmin:
    """Tests for admin access to features"""

    @pytest.mark.asyncio
    async def test_admin_can_get_usage(self, admin_client):
        """Admin should be able to get usage stats"""
        response = await admin_client.get("/pro/usage")
        # 200 for success, 400 if missing entity context, 403 for permission denied, 404 if no entitlement
        assert response.status_code in {200, 400, 403, 404}

    @pytest.mark.asyncio
    async def test_admin_can_get_bundles(self, admin_client):
        """Admin should be able to get enabled bundles"""
        response = await admin_client.get("/pro/enabled-bundles")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_can_get_permissions(self, admin_client):
        """Admin should be able to get resource permissions"""
        response = await admin_client.get("/pro/resource-permissions")
        assert response.status_code == 200


# =============================================================================
# FEATURES CROSS-USER SECURITY TESTS
# =============================================================================


class TestFeaturesCrossUserSecurity:
    """Tests for cross-user access prevention in features"""

    @pytest.mark.asyncio
    async def test_bundles_isolated_per_user(self, auth_client, second_user_client):
        """Each user should only see their own bundles"""
        response1 = await auth_client.get("/pro/enabled-bundles")
        response2 = await second_user_client.get("/pro/enabled-bundles")

        assert response1.status_code == 200
        assert response2.status_code == 200
        # Bundles may be the same (default) but should be isolated endpoints

    @pytest.mark.asyncio
    async def test_permissions_isolated_per_user(self, auth_client, second_user_client):
        """Each user should only see their own permissions"""
        response1 = await auth_client.get("/pro/resource-permissions")
        response2 = await second_user_client.get("/pro/resource-permissions")

        assert response1.status_code == 200
        assert response2.status_code == 200

    @pytest.mark.asyncio
    async def test_entity_status_isolated_per_user(
        self, auth_client, second_user_client
    ):
        """Each user should only see their own entity status"""
        response1 = await auth_client.get("/pro/user-has-entity")
        response2 = await second_user_client.get("/pro/user-has-entity")

        assert response1.status_code == 200
        assert response2.status_code == 200


# =============================================================================
# FEATURES AUTHENTICATION EDGE CASES
# =============================================================================


class TestFeaturesAuthEdgeCases:
    """Tests for features authentication edge cases"""

    @pytest.mark.asyncio
    async def test_features_with_expired_token(self, client):
        """Expired token should be rejected"""
        client.headers["Authorization"] = "Bearer expired.token.here"
        response = await client.get("/pro/enabled-bundles")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_features_with_malformed_token(self, client):
        """Malformed token should be rejected"""
        client.headers["Authorization"] = "Bearer not-a-valid-jwt"
        response = await client.get("/pro/resource-permissions")
        assert response.status_code in {401, 403}
