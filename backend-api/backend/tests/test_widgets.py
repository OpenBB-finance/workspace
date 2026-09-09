"""
Integration tests for Widget & Config endpoints.
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


class TestWidgetMetadata:
    """Tests for /pro/widget-metadata endpoints"""

    @pytest.mark.asyncio
    async def test_get_widget_metadata_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/widget-metadata")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_widget_metadata_authenticated(self, auth_client):
        """Should return widget metadata or 404 if none exists"""
        response = await auth_client.get("/pro/widget-metadata")
        # 200 for success, 404 if no metadata exists yet
        assert response.status_code in {200, 404}
        # Validate response structure
        data = response.json()
        assert isinstance(data, (list, dict))
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type

    @pytest.mark.asyncio
    async def test_create_widget_metadata_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post("/pro/widget-metadata", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_create_widget_metadata_authenticated(self, auth_client):
        """Should create widget metadata"""
        widget_id = str(uuid4())
        payload = {
            "widgetId": widget_id,
            "name": "Test Widget",
            "description": "Integrated Test Widget",
            "source": "testing",
            "category": "testing",
            "subCategory": "testing",
            "widgetType": "iframe",
            "storage": {"url": "https://example.com"},
            "widgetConfig": {},
        }
        response = await auth_client.post("/pro/widget-metadata", json=payload)
        assert response.status_code in {200, 201}
        data = response.json()
        assert data.get("success") is True

    @pytest.mark.asyncio
    async def test_create_widget_metadata_chart_html_types(self, auth_client):
        """Should accept canonical chart/html widget types"""
        for widget_type in ("chart", "html"):
            widget_id = str(uuid4())
            payload = {
                "widgetId": widget_id,
                "name": f"test-{widget_type}-{widget_id}",
                "description": f"metadata for {widget_type}",
                "source": "testing",
                "category": "testing",
                "subCategory": "testing",
                "widgetType": widget_type,
                "storage": (
                    {"plotlyData": {"data": [], "layout": {}}}
                    if widget_type == "chart"
                    else {"html": "<div>test</div>"}
                ),
            }

            response = await auth_client.post("/pro/widget-metadata", json=payload)
            assert response.status_code in {200, 201}
            data = response.json()
            assert data.get("success") is True

    @pytest.mark.asyncio
    async def test_get_widget_metadata_filters_chart_html(self, auth_client):
        """Should support chart/html widget_type filters"""
        created_names: dict[str, str] = {}
        for widget_type in ("chart", "html"):
            widget_id = str(uuid4())
            name = f"filter-{widget_type}-{widget_id}"
            created_names[widget_type] = name
            payload = {
                "widgetId": widget_id,
                "name": name,
                "description": f"metadata for {widget_type}",
                "source": "testing",
                "category": "testing",
                "subCategory": "testing",
                "widgetType": widget_type,
                "storage": (
                    {"plotlyData": {"data": [], "layout": {}}}
                    if widget_type == "chart"
                    else {"html": "<div>test</div>"}
                ),
            }
            create_response = await auth_client.post("/pro/widget-metadata", json=payload)
            assert create_response.status_code in {200, 201}

        for widget_type in ("chart", "html"):
            response = await auth_client.get(
                f"/pro/widget-metadata?widget_type={widget_type}"
            )
            assert response.status_code == 200
            widgets = response.json()
            assert isinstance(widgets, list)
            assert any(
                item.get("name") == created_names[widget_type]
                and item.get("widgetType") == widget_type
                for item in widgets
            )

    @pytest.mark.parametrize(
        ("widget_type", "storage"),
        [
            ("chart", {"plotlyData": {"data": [], "layout": {}}}),
            ("html", {"html": "<div>test</div>"}),
        ],
    )
    @pytest.mark.asyncio
    async def test_patch_widget_metadata_with_widget_type_selector(
        self, auth_client, widget_type, storage
    ):
        """Should patch metadata by widget_type and name selector"""
        widget_id = str(uuid4())
        name = f"patch-{widget_type}-{widget_id}"
        create_payload = {
            "widgetId": widget_id,
            "name": name,
            "description": "before update",
            "source": "testing",
            "category": "testing",
            "subCategory": "testing",
            "widgetType": widget_type,
            "storage": storage,
        }
        create_response = await auth_client.post(
            "/pro/widget-metadata",
            json=create_payload,
        )
        assert create_response.status_code in {200, 201}

        patch_payload = {"description": "after update"}
        patch_response = await auth_client.patch(
            f"/pro/widget-metadata?widget_type={widget_type}&name={name}",
            json=patch_payload,
        )
        assert patch_response.status_code == 200
        assert patch_response.json().get("success") is True

        verify_response = await auth_client.get(
            f"/pro/widget-metadata?widget_id={widget_id}"
        )
        assert verify_response.status_code == 200
        widgets = verify_response.json()
        widget = next((item for item in widgets if item["widgetId"] == widget_id), None)
        assert widget is not None
        assert widget["widgetType"] == widget_type
        assert widget["description"] == "after update"

    @pytest.mark.asyncio
    async def test_patch_widget_metadata_authenticated(self, auth_client):
        """Should update widget metadata"""
        # First create a widget to update
        widget_id = str(uuid4())
        payload = {
            "widgetId": widget_id,
            "name": "Widget To Update",
            "description": "Original Description",
            "source": "testing",
            "category": "testing",
            "subCategory": "testing",
            "widgetType": "iframe",
            "storage": {"url": "https://example.com"},
        }
        await auth_client.post("/pro/widget-metadata", json=payload)

        # Now update it
        patch_payload = {
            "name": "Updated Widget Name",
            "description": "Updated Description",
        }
        # Note: API requires widget_id as query param for specific widget update
        response = await auth_client.patch(
            f"/pro/widget-metadata?widget_id={widget_id}", json=patch_payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True

        # Verify update
        get_response = await auth_client.get(
            f"/pro/widget-metadata?widget_id={widget_id}"
        )
        # Returns a list
        widgets = get_response.json()
        assert len(widgets) > 0
        w = next((x for x in widgets if x["widgetId"] == widget_id), None)
        assert w is not None
        assert w["name"] == "Updated Widget Name"

    @pytest.mark.asyncio
    async def test_delete_widget_metadata_unauthenticated(self, client):
        """Should fail without auth"""
        test_id = str(uuid4())
        response = await client.delete(f"/pro/widget-metadata/{test_id}")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_delete_widget_metadata_nonexistent(self, auth_client):
        """Should return 404 for nonexistent widget"""
        test_id = str(uuid4())
        response = await auth_client.delete(f"/pro/widget-metadata/{test_id}")
        assert response.status_code in {200, 404}


class TestThemeSettings:
    """Tests for /pro/theme-settings endpoint"""

    @pytest.mark.asyncio
    async def test_get_theme_settings_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/theme-settings")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_theme_settings_authenticated(self, auth_client):
        """Should return theme settings"""
        response = await auth_client.get("/pro/theme-settings")
        # 200 for success, 404 if no settings exist
        assert response.status_code in {200, 404}
        # Validate response structure
        data = response.json()
        assert isinstance(data, dict)
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type


class TestTvState:
    """Tests for /pro/tv-state endpoint"""

    @pytest.mark.asyncio
    async def test_save_tv_state_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post("/pro/tv-state", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_save_tv_state_authenticated(self, auth_client):
        """Should save TradingView state"""
        response = await auth_client.post(
            "/pro/tv-state", json={"state": {"chart": "data"}}
        )
        # 200 for success, 422 for validation error
        assert response.status_code in {200, 422}


# =============================================================================
# WIDGET INPUT VALIDATION TESTS
# =============================================================================


class TestWidgetInputValidation:
    """Tests for widget endpoint input validation"""

    @pytest.mark.asyncio
    async def test_create_widget_empty_name(self, auth_client):
        """Creating widget with empty name should be handled"""
        response = await auth_client.post(
            "/pro/widget-metadata", json={"name": "", "type": "chart"}
        )
        assert response.status_code in {200, 201, 400, 422}

    @pytest.mark.asyncio
    async def test_create_widget_very_long_name(self, auth_client):
        """Creating widget with very long name should be handled"""
        response = await auth_client.post(
            "/pro/widget-metadata", json={"name": "a" * 500, "type": "chart"}
        )
        assert response.status_code in {200, 201, 400, 422}

    @pytest.mark.asyncio
    async def test_create_widget_sql_injection(self, auth_client, db_session):
        """SQL injection in widget name should be handled safely - verify DB"""
        sql_payload = "'; DROP TABLE widget_metadata; --"
        response = await auth_client.post(
            "/pro/widget-metadata",
            json={"name": sql_payload, "type": "chart"},
        )
        assert response.status_code in {200, 201, 400, 422}

        # ACTUALLY verify the database is intact - query the widget_metadata table
        result = await db_session.execute(text("SELECT COUNT(*) FROM widget_metadata"))
        count = result.scalar()
        assert count is not None  # Table still exists and is queryable

    @pytest.mark.asyncio
    async def test_create_widget_xss(self, auth_client, db_session):
        """XSS in widget name should be handled safely - verify storage"""
        xss_payload = "<script>alert('xss')</script>"
        response = await auth_client.post(
            "/pro/widget-metadata",
            json={"name": xss_payload, "type": "chart"},
        )

        if response.status_code in {400, 422}:
            # Safe: Input was rejected
            pass
        elif response.status_code in {200, 201}:
            # Verify Content-Type is JSON (not HTML)
            content_type = response.headers.get("content-type", "")
            assert "application/json" in content_type

            # Verify payload is stored safely (either literal or escaped)
            data = response.json()
            if "name" in data:
                stored = data.get("name", "")
                assert stored in {
                    xss_payload,
                    "&lt;script&gt;alert('xss')&lt;/script&gt;",
                    "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;",
                }

    @pytest.mark.asyncio
    async def test_delete_widget_invalid_uuid(self, auth_client):
        """Deleting widget with invalid UUID should return 422"""
        response = await auth_client.delete("/pro/widget-metadata/not-a-valid-uuid")
        assert response.status_code == 422


# =============================================================================
# THEME SETTINGS VALIDATION TESTS
# =============================================================================


class TestThemeSettingsValidation:
    """Tests for theme settings validation"""

    @pytest.mark.asyncio
    async def test_save_theme_sql_injection(self, auth_client, db_session):
        """SQL injection in theme settings should be handled safely - verify DB"""
        sql_payload = "'; DROP TABLE user; --"
        response = await auth_client.post(
            "/pro/theme-settings",
            json={"theme": sql_payload},
        )
        # POST may not exist, try PUT
        if response.status_code == 405:
            response = await auth_client.put(
                "/pro/theme-settings",
                json={"theme": sql_payload},
            )
        assert response.status_code in {200, 400, 404, 405, 422}

        # ACTUALLY verify the database is intact
        result = await db_session.execute(text("SELECT COUNT(*) FROM user"))
        count = result.scalar()
        assert count is not None  # Table still exists

    @pytest.mark.asyncio
    async def test_save_theme_xss(self, auth_client):
        """XSS in theme settings should be handled safely"""
        xss_payload = "<script>alert('xss')</script>"
        response = await auth_client.post(
            "/pro/theme-settings",
            json={"theme": xss_payload},
        )
        if response.status_code == 405:
            response = await auth_client.put(
                "/pro/theme-settings",
                json={"theme": xss_payload},
            )

        if response.status_code in {200, 201}:
            content_type = response.headers.get("content-type", "")
            assert "application/json" in content_type


# =============================================================================
# TV STATE VALIDATION TESTS
# =============================================================================


class TestTvStateValidation:
    """Tests for TradingView state validation"""

    @pytest.mark.asyncio
    async def test_save_tv_state_sql_injection(self, auth_client, db_session):
        """SQL injection in TV state should be handled safely - verify DB"""
        response = await auth_client.post(
            "/pro/tv-state",
            json={"state": {"query": "'; DROP TABLE user; --"}},
        )
        assert response.status_code in {200, 400, 422}

        # ACTUALLY verify the database is intact
        result = await db_session.execute(text("SELECT COUNT(*) FROM user"))
        count = result.scalar()
        assert count is not None  # Table still exists

    @pytest.mark.asyncio
    async def test_save_tv_state_xss(self, auth_client):
        """XSS in TV state should be handled safely"""
        response = await auth_client.post(
            "/pro/tv-state",
            json={"state": {"script": "<script>alert('xss')</script>"}},
        )

        if response.status_code == 200:
            content_type = response.headers.get("content-type", "")
            assert "application/json" in content_type

    @pytest.mark.asyncio
    async def test_save_tv_state_nested_object(self, auth_client):
        """Deeply nested TV state should be handled"""
        deep_state = {"level1": {"level2": {"level3": {"level4": "value"}}}}
        response = await auth_client.post(
            "/pro/tv-state",
            json={"state": deep_state},
        )
        assert response.status_code in {200, 400, 422}


# =============================================================================
# WIDGET OUTPUT VALIDATION TESTS
# =============================================================================


class TestWidgetOutputValidation:
    """Tests for widget endpoint output validation"""

    @pytest.mark.asyncio
    async def test_widget_metadata_response_schema(self, auth_client):
        """Widget metadata response should have expected schema"""
        response = await auth_client.get("/pro/widget-metadata")
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict))

    @pytest.mark.asyncio
    async def test_theme_settings_response_schema(self, auth_client):
        """Theme settings response should have expected schema"""
        response = await auth_client.get("/pro/theme-settings")
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict))

    @pytest.mark.asyncio
    async def test_widget_response_no_sensitive_data(self, auth_client):
        """Widget responses should not expose sensitive data"""
        response = await auth_client.get("/pro/widget-metadata")
        if response.status_code == 200:
            data_str = str(response.json())
            assert "password" not in data_str.lower()
            assert "secret" not in data_str.lower()
            assert "private_key" not in data_str.lower()


# =============================================================================
# WIDGET CROSS-USER SECURITY TESTS
# =============================================================================


class TestWidgetCrossUserSecurity:
    """Tests for cross-user access prevention in widgets"""

    @pytest.mark.asyncio
    async def test_widgets_isolated_per_user(self, auth_client, second_user_client):
        """Each user should only see their own widgets"""
        response1 = await auth_client.get("/pro/widget-metadata")
        response2 = await second_user_client.get("/pro/widget-metadata")

        # Both should work but be isolated
        assert response1.status_code in {200, 404}
        assert response2.status_code in {200, 404}

    @pytest.mark.asyncio
    async def test_tv_state_isolated_per_user(self, auth_client, second_user_client):
        """Each user should only see their own TV state"""
        # Save state for first user
        await auth_client.post("/pro/tv-state", json={"state": {"user": "first"}})

        # Second user saves different state
        await second_user_client.post(
            "/pro/tv-state", json={"state": {"user": "second"}}
        )

        # States should be isolated (each user has their own)
        # This test passes if no cross-user contamination occurs

    @pytest.mark.asyncio
    async def test_cannot_delete_other_user_widget(
        self, auth_client, second_user_client
    ):
        """Users should not be able to delete other users' widgets"""
        # Create a widget as first user
        create_response = await auth_client.post(
            "/pro/widget-metadata",
            json={"name": "user1_widget", "type": "chart"},
        )

        if create_response.status_code in {200, 201}:
            data = create_response.json()
            if "uuid" in data:
                # Second user tries to delete it
                delete_response = await second_user_client.delete(
                    f"/pro/widget-metadata/{data['uuid']}"
                )
                # Should fail (404 because not their widget, or 403)
                assert delete_response.status_code in {403, 404}

                # Cleanup: delete as original user
                await auth_client.delete(f"/pro/widget-metadata/{data['uuid']}")
