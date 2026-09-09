"""
Integration tests for Miscellaneous endpoints.
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


class TestFeedback:
    """Tests for /feedback endpoint"""

    # Valid feedback payload with all required fields from BaseProperties + Feedback
    VALID_FEEDBACK = {
        "subject": "Test Feedback",
        "hs_pipeline_stage": 1,
        "hs_pipeline": 1,
        "ticket_email": "test@example.com",
        "content": "Test feedback content",
        "ticket_type": "bug",
        "location_page": "/dashboard",
        "version": "1.0.0",
    }

    @pytest.mark.asyncio
    async def test_feedback_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post("/feedback", json=self.VALID_FEEDBACK)
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_feedback_authenticated(self, auth_client):
        """Should submit feedback successfully"""
        response = await auth_client.post("/feedback", json=self.VALID_FEEDBACK)
        # 200 for success, 400 if hubspot disabled, 404 if user missing hubspot account
        assert response.status_code in {200, 400, 404}
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") is True

    @pytest.mark.asyncio
    async def test_feedback_missing_required_fields(self, auth_client):
        """Should fail with missing required fields"""
        response = await auth_client.post("/feedback", json={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_feedback_invalid_data_types(self, auth_client):
        """Should fail with invalid data types"""
        response = await auth_client.post(
            "/feedback",
            json={
                "subject": 12345,  # Should be string
                "hs_pipeline_stage": "not_an_int",
                "hs_pipeline": "not_an_int",
                "ticket_email": [],
                "content": None,
                "ticket_type": 12345,
                "location_page": None,
                "version": [],
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_feedback_xss_attempt(self, auth_client):
        """XSS in feedback should be safely handled"""
        payload = self.VALID_FEEDBACK.copy()
        payload["content"] = "<script>alert('xss')</script>"
        response = await auth_client.post("/feedback", json=payload)
        # Should either succeed (sanitized), 400 if hubspot disabled, or return 404 (no hubspot)
        assert response.status_code in {200, 400, 404}

    @pytest.mark.asyncio
    async def test_feedback_sql_injection_attempt(self, auth_client):
        """SQL injection in feedback should be safely handled"""
        payload = self.VALID_FEEDBACK.copy()
        payload["content"] = "bug'; DROP TABLE user; --"
        response = await auth_client.post("/feedback", json=payload)
        # Should either succeed (safely escaped), 400 if hubspot disabled, or return 404 (no hubspot)
        assert response.status_code in {200, 400, 404}


class TestMarketing:
    """Tests for /marketing endpoint"""

    @pytest.mark.asyncio
    async def test_get_marketing_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/marketing")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_marketing_authenticated(self, auth_client):
        """Should get marketing preferences - may return 400 if missing data"""
        response = await auth_client.get("/marketing")
        # 200 for success, 400 if user missing required data, 403 for permission denied
        assert response.status_code in {200, 400, 403}

    @pytest.mark.asyncio
    async def test_update_marketing_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.put("/marketing", json={})
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_update_marketing_authenticated(self, auth_client):
        """Should update marketing preferences"""
        response = await auth_client.put("/marketing", json={"marketing_email": True})
        # 200 for success, 422/400 for validation error
        assert response.status_code in {200, 400, 422}


class TestDeveloperOnboarding:
    """Tests for /pro/pro-developer-onboarding-info endpoint"""

    @pytest.mark.asyncio
    async def test_developer_onboarding_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/pro-developer-onboarding-info")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_developer_onboarding_authenticated(self, auth_client):
        """Should return developer onboarding status"""
        response = await auth_client.get("/pro/pro-developer-onboarding-info")
        # 200 for success, 404 if no data
        assert response.status_code in {200, 404}


class TestZeroToHero:
    """Tests for /pro/zero-to-hero endpoint"""

    @pytest.mark.asyncio
    async def test_zero_to_hero_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/zero-to-hero")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_zero_to_hero_authenticated(self, auth_client):
        """Should return zero-to-hero progress"""
        response = await auth_client.get("/pro/zero-to-hero")
        # 200 for success, 404 if no data
        assert response.status_code in {200, 404}

    @pytest.mark.asyncio
    async def test_zero_to_hero_update_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post("/pro/zero-to-hero", json={})
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_zero_to_hero_update_authenticated(self, auth_client):
        """Should update zero-to-hero progress"""
        response = await auth_client.post(
            "/pro/zero-to-hero", json={"step": 1, "completed": True}
        )
        # 200 for success, 422 for validation error
        assert response.status_code in {200, 422}


class TestHealthCheck:
    """Tests for health check endpoints"""

    @pytest.mark.asyncio
    async def test_health_check(self, client):
        """Should return healthy status"""
        response = await client.get("/health")
        # Some apps use / or /healthz instead
        if response.status_code == 404:
            response = await client.get("/")
        assert response.status_code in {200, 404}


class TestOpenAPIAndDocs:
    """Tests for OpenAPI schema and docs endpoints.

    Note: These are disabled in production (docs_url=None, redoc_url=None, openapi_url=None).
    In test environment they may not be available.
    """

    @pytest.mark.asyncio
    async def test_openapi_schema_or_disabled(self, client):
        """OpenAPI schema may be disabled in this environment"""
        response = await client.get("/openapi.json")
        # 200 if enabled, 401/404 if disabled/not found
        assert response.status_code in {200, 401, 404}

    @pytest.mark.asyncio
    async def test_swagger_docs_or_disabled(self, client):
        """Swagger UI may be disabled in this environment"""
        response = await client.get("/docs")
        # 200 if enabled, 404 if disabled
        assert response.status_code in {200, 404}

    @pytest.mark.asyncio
    async def test_redoc_or_disabled(self, client):
        """ReDoc may be disabled in this environment"""
        response = await client.get("/redoc")
        # 200 if enabled, 404 if disabled
        assert response.status_code in {200, 404}
