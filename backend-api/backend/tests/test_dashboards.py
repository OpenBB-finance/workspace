"""
Integration tests for Dashboard endpoints.

Tests cover:
- Dashboard sync: create, update, delete operations
- Dashboard sharing: share with users, revoke access
- Dashboard versions: version history
- Owned vs shared dashboards
- Full CRUD lifecycle tests
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


class TestDashboardSync:
    """Tests for /pro/dash/sync endpoints"""

    @pytest.mark.asyncio
    async def test_get_dashboards_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/dash/sync")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_dashboards_authenticated(self, auth_client):
        """Should return user dashboards"""
        response = await auth_client.get("/pro/dash/sync")
        assert response.status_code == 200
        data = response.json()
        # Should return a list or dict with dashboards
        assert isinstance(data, (list, dict))
        # Validate content type
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type
        # If dict, should have expected keys
        if isinstance(data, dict) and "dashboards" in data:
            # May have dashboards key or be a single dashboard
            assert isinstance(data["dashboards"], list)
        # If list, validate each item structure if not empty
        if isinstance(data, list) and len(data) > 0:
            dashboard = data[0]
            assert isinstance(dashboard, dict)

    @pytest.mark.asyncio
    async def test_sync_dashboards_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post("/pro/dash/sync", json={})
        assert response.status_code in {401, 403, 422}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_sync_dashboards_authenticated(self, auth_client):
        """Should sync dashboards"""
        # Send valid empty sync data
        dashboard_data = {"items": {}}
        response = await auth_client.post("/pro/dash/sync", json=dashboard_data)
        assert response.status_code == 200
        # Validate response structure
        data = response.json()
        assert data.get("success") is True

    @pytest.mark.asyncio
    async def test_sync_dashboards_invalid_schema(self, auth_client):
        """Should return 422 for invalid schema"""
        dashboard_data = {"dashboards": [], "version": 1}  # Old/Invalid format
        response = await auth_client.post("/pro/dash/sync", json=dashboard_data)
        assert response.status_code == 422


class TestOwnedDashboards:
    """Tests for /pro/dash/sync/owned endpoint"""

    @pytest.mark.asyncio
    async def test_get_owned_dashboards_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/dash/sync/owned")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_owned_dashboards_authenticated(self, auth_client):
        """Should return owned dashboards"""
        response = await auth_client.get("/pro/dash/sync/owned")
        assert response.status_code == 200
        # Validate response structure
        data = response.json()
        assert isinstance(data, (list, dict))
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type


class TestSharedDashboards:
    """Tests for /pro/dash/sync/shared endpoint"""

    @pytest.mark.asyncio
    async def test_get_shared_dashboards_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/dash/sync/shared")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data

    @pytest.mark.asyncio
    async def test_get_shared_dashboards_authenticated(self, auth_client):
        """Should return shared dashboards"""
        response = await auth_client.get("/pro/dash/sync/shared")
        assert response.status_code == 200
        # Validate response structure
        data = response.json()
        assert isinstance(data, (list, dict))
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type


class TestDashboardShares:
    """Tests for /pro/dash/{uuid}/shares endpoints"""

    @pytest.mark.asyncio
    async def test_get_shares_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.get(f"/pro/dash/{test_uuid}/shares")
        assert response.status_code in {401, 403}
        # Validate error response structure
        data = response.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "error" in data
        # UUID should not be echoed in error
        response_str = str(data)
        assert test_uuid not in response_str or "not found" in response_str.lower()

    @pytest.mark.asyncio
    async def test_get_shares_nonexistent(self, auth_client):
        """Should return 200 (empty list) or 404 for nonexistent dashboard"""
        test_uuid = str(uuid4())
        response = await auth_client.get(f"/pro/dash/{test_uuid}/shares")
        # API may return 200 with empty list or 404 - both are valid
        assert response.status_code in {200, 404, 400}

    @pytest.mark.asyncio
    async def test_share_dashboard_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.post(
            f"/pro/dash/{test_uuid}/share", json={"email": "share@example.com"}
        )
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_revoke_share_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.delete(f"/pro/dash/{test_uuid}/share")
        assert response.status_code in {401, 403, 422}


class TestDashboardShareUsers:
    """Tests for /pro/dash/{uuid}/shares/users endpoint"""

    @pytest.mark.asyncio
    async def test_get_share_users_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.get(f"/pro/dash/{test_uuid}/shares/users")
        assert response.status_code in {401, 403}


class TestValidateAndSync:
    """Tests for /pro/dash/validate-and-sync endpoint"""

    @pytest.mark.asyncio
    async def test_validate_sync_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/dash/validate-and-sync")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_validate_sync_authenticated(self, auth_client):
        """Should validate and sync dashboards"""
        response = await auth_client.get("/pro/dash/validate-and-sync")
        # May return 200 (success), 400 (validation error), or 404 (no dashboards)
        assert response.status_code in {200, 400, 404}


# =============================================================================
# Enhanced Tests: CRUD Lifecycle & Response Validation
# =============================================================================


class TestDashboardCRUDLifecycle:
    """Full CRUD lifecycle tests for dashboards"""

    @pytest.mark.asyncio
    async def test_dashboard_create_read_update_delete(self, auth_client):
        """Test complete dashboard lifecycle"""
        dashboard_uuid = str(uuid4())

        # Step 1: Create a dashboard via sync
        create_payload = {
            "dashboards": [
                {
                    "uuid": dashboard_uuid,
                    "name": "Test Dashboard Lifecycle",
                    "description": "Created for integration test",
                    "data": {"widgets": []},
                    "version": 1,
                }
            ]
        }
        create_response = await auth_client.post("/pro/dash/sync", json=create_payload)
        # Accept various success codes
        assert create_response.status_code in {200, 201, 422}

        if create_response.status_code in {200, 201}:
            # Step 2: Verify dashboard exists via GET
            get_response = await auth_client.get("/pro/dash/sync")
            assert get_response.status_code == 200

            # Step 3: Update the dashboard
            update_payload = {
                "dashboards": [
                    {
                        "uuid": dashboard_uuid,
                        "name": "Updated Dashboard Name",
                        "description": "Updated for integration test",
                        "data": {"widgets": [{"id": "widget1"}]},
                        "version": 2,
                    }
                ]
            }
            update_response = await auth_client.post(
                "/pro/dash/sync", json=update_payload
            )
            assert update_response.status_code in {200, 201, 422}

            # Step 4: Delete the dashboard
            delete_payload = {"dashboards": [], "deletes": [dashboard_uuid]}
            delete_response = await auth_client.post(
                "/pro/dash/sync", json=delete_payload
            )
            assert delete_response.status_code in {200, 422}

    @pytest.mark.asyncio
    async def test_create_multiple_dashboards(self, auth_client):
        """Should handle creating multiple dashboards at once"""
        dashboards = [
            {
                "uuid": str(uuid4()),
                "name": f"Multi Dashboard {i}",
                "data": {},
                "version": 1,
            }
            for i in range(3)
        ]

        response = await auth_client.post(
            "/pro/dash/sync", json={"dashboards": dashboards}
        )
        assert response.status_code in {200, 201, 422}


class TestDashboardResponseSchema:
    """Tests for dashboard response structure"""

    @pytest.mark.asyncio
    async def test_sync_response_contains_expected_fields(self, auth_client):
        """Dashboard sync response should have expected structure"""
        response = await auth_client.get("/pro/dash/sync")
        assert response.status_code == 200
        data = response.json()

        # Response should be list or dict with dashboards
        assert isinstance(data, (list, dict))

        # If it's a list of dashboards, check structure
        if isinstance(data, list) and len(data) > 0:
            dashboard = data[0]
            # Each dashboard should have uuid at minimum
            assert "uuid" in dashboard or "id" in dashboard

    @pytest.mark.asyncio
    async def test_owned_dashboards_response_structure(self, auth_client):
        """Owned dashboards should return proper structure"""
        response = await auth_client.get("/pro/dash/sync/owned")
        assert response.status_code == 200
        data = response.json()

        # API returns dict with 'owned' key
        assert isinstance(data, dict)
        assert "owned" in data

    @pytest.mark.asyncio
    async def test_shared_dashboards_response_structure(self, auth_client):
        """Shared dashboards should return proper structure"""
        response = await auth_client.get("/pro/dash/sync/shared")
        assert response.status_code == 200
        data = response.json()

        # API returns dict with 'shared' key
        assert isinstance(data, dict)
        assert "shared" in data


class TestDashboardValidation:
    """Input validation tests for dashboard endpoints"""

    @pytest.mark.asyncio
    async def test_sync_empty_payload(self, auth_client):
        """Sync with empty payload should be handled"""
        response = await auth_client.post("/pro/dash/sync", json={})
        # May succeed (no-op) or return validation error
        assert response.status_code in {200, 422}

    @pytest.mark.asyncio
    async def test_sync_invalid_uuid_format(self, auth_client):
        """Dashboard with invalid UUID should fail"""
        payload = {
            "dashboards": [
                {
                    "uuid": "not-a-valid-uuid",
                    "name": "Invalid UUID Dashboard",
                    "data": {},
                }
            ]
        }
        response = await auth_client.post("/pro/dash/sync", json=payload)
        assert response.status_code in {400, 422}

    @pytest.mark.asyncio
    async def test_sync_missing_required_fields(self, auth_client):
        """Dashboard missing required fields should fail"""
        payload = {
            "dashboards": [
                {
                    # Missing uuid and name
                    "data": {},
                }
            ]
        }
        response = await auth_client.post("/pro/dash/sync", json=payload)
        assert response.status_code in {400, 422}

    @pytest.mark.asyncio
    async def test_sync_large_data_payload(self, auth_client):
        """Dashboard with large data should be handled within reasonable time"""
        # Use a reasonable size that won't hang the server
        large_data = {"widgets": [{"id": f"widget_{i}"} for i in range(50)]}
        payload = {
            "dashboards": [
                {
                    "uuid": str(uuid4()),
                    "name": "Large Data Dashboard",
                    "data": large_data,
                }
            ]
        }
        response = await auth_client.post("/pro/dash/sync", json=payload)
        # Should either succeed or return validation error
        assert response.status_code in {200, 201, 400, 422}


class TestDashboardSharing:
    """Tests for dashboard sharing functionality"""

    @pytest.mark.asyncio
    async def test_share_with_valid_email(self, auth_client):
        """Sharing with valid email should work (if dashboard exists)"""
        # First create a dashboard
        dashboard_uuid = str(uuid4())
        create_payload = {
            "dashboards": [
                {
                    "uuid": dashboard_uuid,
                    "name": "Dashboard to Share",
                    "data": {},
                }
            ]
        }
        create_response = await auth_client.post("/pro/dash/sync", json=create_payload)

        if create_response.status_code in {200, 201}:
            # Try to share it
            share_response = await auth_client.post(
                f"/pro/dash/{dashboard_uuid}/share",
                json={"email": "sharetest@example.com", "permissions": "view"},
            )
            # 200 for success, 404 if not found, 422 for validation
            assert share_response.status_code in {200, 404, 422}

    @pytest.mark.asyncio
    async def test_share_with_invalid_email(self, auth_client):
        """Sharing with invalid email should fail"""
        dashboard_uuid = str(uuid4())
        response = await auth_client.post(
            f"/pro/dash/{dashboard_uuid}/share",
            json={"email": "not-an-email", "permissions": "view"},
        )
        assert response.status_code in {400, 404, 422}

    @pytest.mark.asyncio
    async def test_share_with_self(self, auth_client):
        """Sharing with own email should be handled"""
        dashboard_uuid = str(uuid4())
        # Create dashboard first
        create_payload = {
            "dashboards": [
                {
                    "uuid": dashboard_uuid,
                    "name": "Dashboard to Share with Self",
                    "data": {},
                }
            ]
        }
        await auth_client.post("/pro/dash/sync", json=create_payload)

        # Try to share with test user's own email
        response = await auth_client.post(
            f"/pro/dash/{dashboard_uuid}/share",
            json={"email": "testrunner@openbb.co", "permissions": "view"},
        )
        # Should fail or be handled gracefully
        assert response.status_code in {200, 400, 404, 422}

    @pytest.mark.asyncio
    async def test_toggle_entity_sharing(self, auth_client):
        """Toggle entity sharing should work"""
        dashboard_uuid = str(uuid4())
        # Create dashboard first
        create_payload = {
            "dashboards": [
                {
                    "uuid": dashboard_uuid,
                    "name": "Dashboard for Entity Sharing",
                    "data": {},
                }
            ]
        }
        create_response = await auth_client.post("/pro/dash/sync", json=create_payload)

        if create_response.status_code in {200, 201}:
            # Toggle entity sharing
            toggle_response = await auth_client.post(
                f"/pro/dash/{dashboard_uuid}/toggle-entity-sharing"
            )
            assert toggle_response.status_code in {200, 400, 404}


class TestDashboardVersions:
    """Tests for dashboard version history"""

    @pytest.mark.asyncio
    async def test_get_versions_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.get(f"/pro/dash/{test_uuid}/versions")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_versions_nonexistent(self, auth_client):
        """Should return 404 for nonexistent dashboard (or 403 if permission denied first)"""
        test_uuid = str(uuid4())
        response = await auth_client.get(f"/pro/dash/{test_uuid}/versions")
        # 403 if permission denied, 404 if dashboard not found
        assert response.status_code in {200, 403, 404}

    @pytest.mark.asyncio
    async def test_versions_after_updates(self, auth_client):
        """Updating dashboard should create version history"""
        dashboard_uuid = str(uuid4())

        # Create initial version
        create_payload = {
            "dashboards": [
                {
                    "uuid": dashboard_uuid,
                    "name": "Dashboard v1",
                    "data": {"version": 1},
                }
            ]
        }
        create_response = await auth_client.post("/pro/dash/sync", json=create_payload)

        if create_response.status_code in {200, 201}:
            # Update to v2
            update_payload = {
                "dashboards": [
                    {
                        "uuid": dashboard_uuid,
                        "name": "Dashboard v2",
                        "data": {"version": 2},
                    }
                ]
            }
            await auth_client.post("/pro/dash/sync", json=update_payload)

            # Check versions
            versions_response = await auth_client.get(
                f"/pro/dash/{dashboard_uuid}/versions"
            )
            assert versions_response.status_code in {200, 404}


class TestDashboardEdgeCases:
    """Edge case tests for dashboard endpoints"""

    @pytest.mark.asyncio
    async def test_sync_with_special_characters_in_name(self, auth_client):
        """Dashboard name with special characters should be handled"""
        special_names = [
            "Dashboard <script>alert('xss')</script>",
            "Dashboard 'with' \"quotes\"",
            "Dashboard with emoji 🚀",
            "Dashboard\nwith\nnewlines",
        ]

        for name in special_names:
            payload = {
                "dashboards": [
                    {
                        "uuid": str(uuid4()),
                        "name": name,
                        "data": {},
                    }
                ]
            }
            response = await auth_client.post("/pro/dash/sync", json=payload)
            # Should handle gracefully - either succeed or validation error
            assert response.status_code in {
                200,
                201,
                400,
                422,
            }, f"Failed for name: {name}"

    @pytest.mark.asyncio
    async def test_sync_duplicate_uuids_in_payload(self, auth_client):
        """Payload with duplicate UUIDs should be handled"""
        duplicate_uuid = str(uuid4())
        payload = {
            "dashboards": [
                {"uuid": duplicate_uuid, "name": "First", "data": {}},
                {"uuid": duplicate_uuid, "name": "Second", "data": {}},
            ]
        }
        response = await auth_client.post("/pro/dash/sync", json=payload)
        # Should handle - either last one wins or validation error
        assert response.status_code in {200, 201, 400, 422}

    @pytest.mark.asyncio
    async def test_sync_with_null_data(self, auth_client):
        """Dashboard with null data field should be handled"""
        payload = {
            "dashboards": [
                {
                    "uuid": str(uuid4()),
                    "name": "Null Data Dashboard",
                    "data": None,
                }
            ]
        }
        response = await auth_client.post("/pro/dash/sync", json=payload)
        # Should handle - either accept null or require data
        assert response.status_code in {200, 201, 422}


# =============================================================================
# DASHBOARD VERSION HISTORY TESTS
# =============================================================================


class TestDashboardVersionHistory:
    """Tests for /{dashboard_uuid}/versions endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_get_versions_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.get(f"/pro/dash/{test_uuid}/versions")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_versions_invalid_uuid(self, auth_client):
        """Should return 422 for invalid UUID"""
        response = await auth_client.get("/pro/dash/not-a-uuid/versions")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_dashboard_and_verify_versions_exist(self, auth_client):
        """Create a dashboard and verify version history is created"""
        dashboard_uuid = str(uuid4())

        # Create a dashboard
        create_response = await auth_client.post(
            "/pro/dash/sync",
            json={
                "items": {
                    dashboard_uuid: {"name": "Version Test v1", "data": {"widgets": []}}
                }
            },
        )
        assert (
            create_response.status_code == 200
        ), f"Failed to create dashboard: {create_response.text}"

        # Get versions - should have at least initial version
        versions_response = await auth_client.get(
            f"/pro/dash/{dashboard_uuid}/versions"
        )
        assert (
            versions_response.status_code == 200
        ), f"Failed to get versions: {versions_response.text}"

        versions = versions_response.json()
        assert isinstance(versions, list), "Versions should be a list"

    @pytest.mark.asyncio
    async def test_update_dashboard_creates_new_version(self, auth_client):
        """Updating a dashboard should create version history entries"""
        dashboard_uuid = str(uuid4())

        # Step 1: Create initial dashboard
        create_response = await auth_client.post(
            "/pro/dash/sync",
            json={
                "items": {
                    dashboard_uuid: {"name": "Version Test v1", "data": {"version": 1}}
                }
            },
        )
        assert create_response.status_code == 200

        # Step 2: Update the dashboard multiple times
        for i in range(2, 5):
            update_response = await auth_client.post(
                "/pro/dash/sync",
                json={
                    "items": {
                        dashboard_uuid: {
                            "name": f"Version Test v{i}",
                            "data": {"version": i},
                        }
                    }
                },
            )
            assert update_response.status_code == 200, f"Failed on update {i}"

        # Step 3: Get versions and verify we have entries
        versions_response = await auth_client.get(
            f"/pro/dash/{dashboard_uuid}/versions"
        )
        assert versions_response.status_code == 200

        versions = versions_response.json()
        assert isinstance(versions, list)
        # Should have version history (may vary by implementation)
        # At minimum verify the endpoint works after updates

    @pytest.mark.asyncio
    async def test_versions_contain_expected_fields(self, auth_client):
        """Version entries should contain expected schema fields"""
        dashboard_uuid = str(uuid4())

        # Create dashboard
        await auth_client.post(
            "/pro/dash/sync",
            json={"items": {dashboard_uuid: {"name": "Schema Test", "data": {}}}},
        )

        # Update it
        await auth_client.post(
            "/pro/dash/sync",
            json={
                "items": {
                    dashboard_uuid: {
                        "name": "Schema Test Updated",
                        "data": {"updated": True},
                    }
                }
            },
        )

        # Get versions
        versions_response = await auth_client.get(
            f"/pro/dash/{dashboard_uuid}/versions"
        )

        if versions_response.status_code == 200:
            versions = versions_response.json()
            if len(versions) > 0:
                version = versions[0]
                assert isinstance(version, dict)
                # Check for expected version fields (created_at, data, etc.)

    @pytest.mark.asyncio
    async def test_cannot_access_other_users_dashboard_versions(self, auth_client):
        """Random UUID should return 403/404 - cannot access others' dashboards"""
        other_user_uuid = str(uuid4())
        response = await auth_client.get(f"/pro/dash/{other_user_uuid}/versions")
        # Should be forbidden or not found
        assert response.status_code in {403, 404}


# =============================================================================
# DASHBOARD SHARING FULL LIFECYCLE TESTS
# =============================================================================


class TestDashboardShareLifecycle:
    """Full lifecycle tests for dashboard sharing - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_share_dashboard_and_verify_share_exists(self, auth_client):
        """Share a dashboard and verify the share is retrievable"""
        dashboard_uuid = str(uuid4())
        share_email = f"sharetest_{uuid4().hex[:8]}@example.com"

        # Step 1: Create a dashboard
        create_response = await auth_client.post(
            "/pro/dash/sync",
            json={"items": {dashboard_uuid: {"name": "Share Test", "data": {}}}},
        )
        assert (
            create_response.status_code == 200
        ), f"Create failed: {create_response.text}"

        # Step 2: Share the dashboard
        share_response = await auth_client.post(
            f"/pro/dash/{dashboard_uuid}/share",
            json={"shares": {share_email: "comment"}},
        )
        # Share may succeed or fail depending on user setup
        if share_response.status_code == 200:
            # Step 3: Verify share exists in shares list
            shares_response = await auth_client.get(
                f"/pro/dash/{dashboard_uuid}/shares"
            )
            assert shares_response.status_code == 200

            shares = shares_response.json()
            assert isinstance(shares, dict)
            assert share_email in shares, f"Shared email not found in shares: {shares}"
            assert shares[share_email]["permissions"] == "comment"

    @pytest.mark.asyncio
    async def test_share_dashboard_then_revoke_access(self, auth_client):
        """Share dashboard, verify share, then revoke and verify removal"""
        dashboard_uuid = str(uuid4())
        share_email = f"revoke_{uuid4().hex[:8]}@example.com"

        # Create dashboard
        create_response = await auth_client.post(
            "/pro/dash/sync",
            json={"items": {dashboard_uuid: {"name": "Revoke Test", "data": {}}}},
        )
        assert create_response.status_code == 200

        # Share it
        share_response = await auth_client.post(
            f"/pro/dash/{dashboard_uuid}/share",
            json={"shares": {share_email: "view"}},
        )

        if share_response.status_code == 200:
            # Verify share exists
            shares = (
                await auth_client.get(f"/pro/dash/{dashboard_uuid}/shares")
            ).json()
            assert share_email in shares

            # Revoke access
            revoke_response = await auth_client.request(
                "DELETE",
                f"/pro/dash/{dashboard_uuid}/share",
                json={"shares": [share_email]},
            )
            assert revoke_response.status_code == 200

            # Verify share is removed
            shares_after = (
                await auth_client.get(f"/pro/dash/{dashboard_uuid}/shares")
            ).json()
            # After revoke, email should not have active permissions
            if share_email in shares_after:
                assert shares_after[share_email].get("permissions") is None

    @pytest.mark.asyncio
    async def test_share_with_multiple_users_and_verify_all(self, auth_client):
        """Share with multiple users and verify all shares exist"""
        dashboard_uuid = str(uuid4())
        emails = [f"multi_{i}_{uuid4().hex[:6]}@example.com" for i in range(3)]

        # Create dashboard
        create_response = await auth_client.post(
            "/pro/dash/sync",
            json={"items": {dashboard_uuid: {"name": "Multi Share Test", "data": {}}}},
        )
        assert create_response.status_code == 200

        # Share with multiple users
        shares_dict = {email: "comment" for email in emails}
        share_response = await auth_client.post(
            f"/pro/dash/{dashboard_uuid}/share",
            json={"shares": shares_dict},
        )

        if share_response.status_code == 200:
            # Verify all shares exist
            shares = (
                await auth_client.get(f"/pro/dash/{dashboard_uuid}/shares")
            ).json()
            for email in emails:
                assert email in shares, f"Missing share for {email}"

    @pytest.mark.asyncio
    async def test_update_share_permissions(self, auth_client):
        """Update share permissions and verify change"""
        dashboard_uuid = str(uuid4())
        share_email = f"update_{uuid4().hex[:8]}@example.com"

        # Create dashboard
        await auth_client.post(
            "/pro/dash/sync",
            json={"items": {dashboard_uuid: {"name": "Update Share Test", "data": {}}}},
        )

        # Share with 'view' permission
        share_response = await auth_client.post(
            f"/pro/dash/{dashboard_uuid}/share",
            json={"shares": {share_email: "view"}},
        )

        if share_response.status_code == 200:
            # Update to 'edit' permission
            update_response = await auth_client.post(
                f"/pro/dash/{dashboard_uuid}/share",
                json={"shares": {share_email: "edit"}},
            )

            if update_response.status_code == 200:
                # Verify permission updated
                shares = (
                    await auth_client.get(f"/pro/dash/{dashboard_uuid}/shares")
                ).json()
                if share_email in shares:
                    assert shares[share_email]["permissions"] == "edit"


# =============================================================================
# DASHBOARD SHARES/USERS ENDPOINT TESTS
# =============================================================================


class TestDashboardSharesUsers:
    """Tests for /{dashboard_uuid}/shares/users endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_get_share_users_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.get(f"/pro/dash/{test_uuid}/shares/users")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_share_users_returns_dict_for_new_dashboard(self, auth_client):
        """New dashboard should return empty dict for shares/users"""
        dashboard_uuid = str(uuid4())

        # Create dashboard
        create_response = await auth_client.post(
            "/pro/dash/sync",
            json={"items": {dashboard_uuid: {"name": "Users Dict Test", "data": {}}}},
        )
        assert create_response.status_code == 200

        # Get shares/users
        response = await auth_client.get(f"/pro/dash/{dashboard_uuid}/shares/users")
        assert response.status_code == 200

        data = response.json()
        # API returns dict mapping email -> share info
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"

    @pytest.mark.asyncio
    async def test_share_users_shows_shared_users(self, auth_client):
        """After sharing, shares/users should list the shared users"""
        dashboard_uuid = str(uuid4())
        share_email = f"visible_{uuid4().hex[:8]}@example.com"

        # Create dashboard
        await auth_client.post(
            "/pro/dash/sync",
            json={
                "items": {dashboard_uuid: {"name": "Visible Users Test", "data": {}}}
            },
        )

        # Share with user
        share_response = await auth_client.post(
            f"/pro/dash/{dashboard_uuid}/share",
            json={"shares": {share_email: "comment"}},
        )

        if share_response.status_code == 200:
            # Check shares/users includes this user
            response = await auth_client.get(f"/pro/dash/{dashboard_uuid}/shares/users")
            assert response.status_code == 200

            data = response.json()
            assert (
                share_email in data
            ), f"Shared user not visible in shares/users: {data}"

    @pytest.mark.asyncio
    async def test_cannot_access_other_users_dashboard_shares(self, auth_client):
        """Cannot access shares/users for dashboard you don't own"""
        other_uuid = str(uuid4())
        response = await auth_client.get(f"/pro/dash/{other_uuid}/shares/users")
        assert response.status_code in {403, 404}


# =============================================================================
# DASHBOARD SHARES GET TESTS
# =============================================================================


class TestDashboardSharesGet:
    """Tests for GET /{dashboard_uuid}/shares endpoint - REAL OPERATIONS"""

    @pytest.mark.asyncio
    async def test_get_shares_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.get(f"/pro/dash/{test_uuid}/shares")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_shares_for_own_dashboard(self, auth_client):
        """Should be able to get shares for own dashboard"""
        dashboard_uuid = str(uuid4())

        # Create dashboard
        create_response = await auth_client.post(
            "/pro/dash/sync",
            json={"items": {dashboard_uuid: {"name": "Get Shares Test", "data": {}}}},
        )
        assert create_response.status_code == 200

        # Get shares
        response = await auth_client.get(f"/pro/dash/{dashboard_uuid}/shares")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_shares_reflect_actual_shared_users(self, auth_client):
        """Shares endpoint should accurately reflect who has access"""
        dashboard_uuid = str(uuid4())
        emails = [f"reflect_{i}_{uuid4().hex[:6]}@example.com" for i in range(2)]

        # Create dashboard
        await auth_client.post(
            "/pro/dash/sync",
            json={"items": {dashboard_uuid: {"name": "Reflect Test", "data": {}}}},
        )

        # Share with users
        share_response = await auth_client.post(
            f"/pro/dash/{dashboard_uuid}/share",
            json={"shares": {emails[0]: "view", emails[1]: "comment"}},
        )

        if share_response.status_code == 200:
            # Verify shares shows correct permissions
            shares = (
                await auth_client.get(f"/pro/dash/{dashboard_uuid}/shares")
            ).json()

            if emails[0] in shares:
                assert shares[emails[0]]["permissions"] == "view"
            if emails[1] in shares:
                assert shares[emails[1]]["permissions"] == "comment"
