import os
import sys

# Add the backend directory to Python path
BACKEND_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest


class TestMetrics:
    """Tests for /metrics endpoints"""

    @pytest.mark.asyncio
    async def test_get_user_metrics_public(self, client):
        """Should be accessible without authentication"""
        response = await client.get("/metrics/users")
        assert response.status_code == 200

        data = response.json()
        assert "users" in data
        assert isinstance(data["users"], list)

        if len(data["users"]) > 0:
            item = data["users"][0]
            assert "timestamp" in item
            assert "count" in item
            assert isinstance(item["count"], int)

    @pytest.mark.asyncio
    async def test_get_user_metrics_cache_behavior(self, client):
        """Should cache results (implicit verification via double request)"""
        # First request
        response1 = await client.get("/metrics/users")
        assert response1.status_code == 200

        # Second request (should be fast/from cache)
        response2 = await client.get("/metrics/users")
        assert response2.status_code == 200
        assert response1.json() == response2.json()
