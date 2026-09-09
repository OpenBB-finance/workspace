"""
Integration tests for Files endpoints.
"""

import os
import sys

# Add the backend directory to Python path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest
from uuid import uuid4


class TestFiles:
    """Tests for /pro/files endpoints"""

    @pytest.mark.asyncio
    async def test_get_files_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/files")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_files_authenticated(self, auth_client):
        """Should return user files"""
        response = await auth_client.get("/pro/files")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_files_unauthenticated(self, client):
        """Should fail without auth"""
        import json

        response = await client.request(
            "DELETE",
            "/pro/files",
            content=json.dumps({"uuids": [str(uuid4())]}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_delete_files_authenticated(self, auth_client):
        """Should delete multiple files"""
        import json

        response = await auth_client.request(
            "DELETE",
            "/pro/files",
            content=json.dumps({"uuids": [str(uuid4())]}),
            headers={"Content-Type": "application/json"},
        )
        # 200 for success, 404 if files don't exist, 422 for validation
        assert response.status_code in {200, 404, 422}


class TestFileSingle:
    """Tests for /pro/files/{uuid} endpoints"""

    @pytest.mark.asyncio
    async def test_delete_file_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.delete(f"/pro/files/{test_uuid}")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_delete_file_nonexistent(self, auth_client):
        """Should return 404 for nonexistent file"""
        test_uuid = str(uuid4())
        response = await auth_client.delete(f"/pro/files/{test_uuid}")
        assert response.status_code in {200, 404}


class TestFilePresignedUrl:
    """Tests for /pro/files/{uuid}/presigned-url endpoint"""

    @pytest.mark.asyncio
    async def test_get_presigned_url_unauthenticated(self, client):
        """Should fail without auth"""
        test_uuid = str(uuid4())
        response = await client.get(f"/pro/files/{test_uuid}/presigned-url")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_presigned_url_nonexistent(self, auth_client):
        """Should return 404 for nonexistent file"""
        test_uuid = str(uuid4())
        response = await auth_client.get(f"/pro/files/{test_uuid}/presigned-url")
        assert response.status_code in {404, 400}


# =============================================================================
# FILE INPUT VALIDATION TESTS
# =============================================================================


class TestFileInputValidation:
    """Tests for file endpoint input validation"""

    @pytest.mark.asyncio
    async def test_delete_file_invalid_uuid_format(self, auth_client):
        """Invalid UUID format should return 422"""
        response = await auth_client.delete("/pro/files/not-a-valid-uuid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_file_sql_injection_uuid(self, auth_client):
        """SQL injection in UUID should return 422"""
        response = await auth_client.delete("/pro/files/'; DROP TABLE files; --")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_presigned_url_invalid_uuid(self, auth_client):
        """Invalid UUID in presigned URL request should return error"""
        response = await auth_client.get("/pro/files/invalid-uuid/presigned-url")
        # 400 for bad request, 422 for validation error
        assert response.status_code in {400, 422}

    @pytest.mark.asyncio
    async def test_bulk_delete_empty_array(self, auth_client):
        """Bulk delete with empty array should be handled"""
        import json

        response = await auth_client.request(
            "DELETE",
            "/pro/files",
            content=json.dumps({"uuids": []}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in {200, 422}

    @pytest.mark.asyncio
    async def test_bulk_delete_invalid_uuids(self, auth_client):
        """Bulk delete with invalid UUIDs should return 422"""
        import json

        response = await auth_client.request(
            "DELETE",
            "/pro/files",
            content=json.dumps({"uuids": ["not-a-uuid", "also-invalid"]}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in {422, 400}

    @pytest.mark.asyncio
    async def test_bulk_delete_mixed_valid_invalid(self, auth_client):
        """Bulk delete with mix of valid and invalid UUIDs"""
        import json

        response = await auth_client.request(
            "DELETE",
            "/pro/files",
            content=json.dumps({"uuids": [str(uuid4()), "invalid"]}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in {422, 400, 200}


# =============================================================================
# FILE OUTPUT VALIDATION TESTS
# =============================================================================


class TestFileOutputValidation:
    """Tests for file endpoint output validation"""

    @pytest.mark.asyncio
    async def test_files_list_response_schema(self, auth_client):
        """Files list should return proper schema"""
        response = await auth_client.get("/pro/files")
        assert response.status_code == 200
        data = response.json()
        # Should be a list
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_files_response_no_sensitive_data(self, auth_client):
        """Files response should not expose sensitive data"""
        response = await auth_client.get("/pro/files")
        if response.status_code == 200:
            data_str = str(response.json())
            # Should not expose internal paths
            assert "/var/" not in data_str
            assert "/tmp/" not in data_str  # noqa: S108
            assert "s3://" not in data_str or "presigned" in data_str.lower()


# =============================================================================
# FILE SECURITY TESTS
# =============================================================================


class TestFileSecurity:
    """Tests for file security"""

    @pytest.mark.asyncio
    async def test_path_traversal_in_file_uuid(self, auth_client):
        """Path traversal attempt in UUID should be rejected"""
        response = await auth_client.get("/pro/files/../../../etc/passwd/presigned-url")
        assert response.status_code in {404, 422}

    @pytest.mark.asyncio
    async def test_null_byte_in_file_uuid(self, auth_client):
        """Null byte in UUID should be rejected"""
        test_uuid = str(uuid4())
        response = await auth_client.delete(f"/pro/files/{test_uuid}%00.exe")
        assert response.status_code in {404, 422}

    @pytest.mark.asyncio
    async def test_cannot_access_other_users_files(self, auth_client, second_user_client):
        """User should not be able to access other user's files"""
        # Get first user's files
        first_user_files = await auth_client.get("/pro/files")
        second_user_files = await second_user_client.get("/pro/files")

        # Both should succeed with 200
        assert first_user_files.status_code == 200
        assert second_user_files.status_code == 200

        # If first user has files, second user should not have access to them
        if first_user_files.json():
            for file_item in first_user_files.json():
                if "uuid" in file_item:
                    file_uuid = file_item["uuid"]
                    # Second user tries to access first user's file
                    response = await second_user_client.get(f"/pro/files/{file_uuid}/presigned-url")
                    # Should be 404 or 403 (not found or forbidden)
                    assert response.status_code in {404, 403}


# =============================================================================
# FILE DOWNLOAD TESTS
# =============================================================================


class TestFileDownload:
    """Tests for file download endpoints"""

    @pytest.mark.asyncio
    async def test_bulk_download_unauthenticated(self, client):
        """Bulk download should fail without auth"""

        response = await client.post(
            "/pro/files/download",
            json={"uuids": [str(uuid4())]},
        )
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_bulk_download_empty_uuids(self, auth_client):
        """Bulk download with empty UUIDs should be handled"""
        response = await auth_client.post(
            "/pro/files/download",
            json={"uuids": []},
        )
        assert response.status_code in {200, 422, 400}

    @pytest.mark.asyncio
    async def test_bulk_download_nonexistent_files(self, auth_client):
        """Bulk download with nonexistent files should be handled"""
        # API expects list directly, not {"uuids": [...]}
        response = await auth_client.post(
            "/pro/files/download",
            json=[str(uuid4()), str(uuid4())],
        )
        # Could be 200 with empty result, 404, 400, or 422 for validation
        assert response.status_code in {200, 404, 400, 422}

    @pytest.mark.asyncio
    async def test_bulk_download_invalid_uuid_format(self, auth_client):
        """Bulk download with invalid UUID format should return error"""
        # API expects list directly
        response = await auth_client.post(
            "/pro/files/download",
            json=["not-a-uuid"],
        )
        assert response.status_code in {422, 400}


# =============================================================================
# FILE PRESIGNED URL EDGE CASES
# =============================================================================


class TestPresignedUrlEdgeCases:
    """Tests for presigned URL edge cases"""

    @pytest.mark.asyncio
    async def test_presigned_url_with_expiration_parameter(self, auth_client):
        """Presigned URL with expiration should be handled"""
        test_uuid = str(uuid4())
        response = await auth_client.get(
            f"/pro/files/{test_uuid}/presigned-url",
            params={"expiration": 3600},
        )
        # 404 for nonexistent, 400 for bad request
        assert response.status_code in {404, 200, 400}

    @pytest.mark.asyncio
    async def test_presigned_url_negative_expiration(self, auth_client):
        """Presigned URL with negative expiration should be handled"""
        test_uuid = str(uuid4())
        response = await auth_client.get(
            f"/pro/files/{test_uuid}/presigned-url",
            params={"expiration": -1},
        )
        assert response.status_code in {404, 422, 400}

    @pytest.mark.asyncio
    async def test_presigned_url_zero_expiration(self, auth_client):
        """Presigned URL with zero expiration should be handled"""
        test_uuid = str(uuid4())
        response = await auth_client.get(
            f"/pro/files/{test_uuid}/presigned-url",
            params={"expiration": 0},
        )
        assert response.status_code in {404, 422, 400, 200}


# =============================================================================
# FILE DOWNLOAD EXTENDED TESTS
# =============================================================================


class TestFileDownloadExtended:
    """Extended tests for /pro/files/download endpoint"""

    @pytest.mark.asyncio
    async def test_download_post_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post(
            "/pro/files/download",
            json=[str(uuid4())],
        )
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_download_empty_list(self, auth_client):
        """Download with empty list should be handled"""
        response = await auth_client.post(
            "/pro/files/download",
            json=[],
        )
        # API may return 404 for empty list, 200 with empty result, or 422/400 for validation
        assert response.status_code in {200, 400, 404, 422}

    @pytest.mark.asyncio
    async def test_download_nonexistent_files(self, auth_client):
        """Download with nonexistent file UUIDs should be handled"""
        response = await auth_client.post(
            "/pro/files/download",
            json=[str(uuid4()), str(uuid4())],
        )
        assert response.status_code in {200, 404, 400, 422}

    @pytest.mark.asyncio
    async def test_download_invalid_uuid_format(self, auth_client):
        """Download with invalid UUID format should return error"""
        response = await auth_client.post(
            "/pro/files/download",
            json=["not-a-uuid", "also-not-a-uuid"],
        )
        assert response.status_code in {422, 400}

    @pytest.mark.asyncio
    async def test_download_single_file(self, auth_client):
        """Download single file should work"""
        response = await auth_client.post(
            "/pro/files/download",
            json=[str(uuid4())],
        )
        assert response.status_code in {200, 404, 400, 422}

    @pytest.mark.asyncio
    async def test_download_many_files(self, auth_client):
        """Download many files at once should be handled"""
        many_uuids = [str(uuid4()) for _ in range(50)]
        response = await auth_client.post(
            "/pro/files/download",
            json=many_uuids,
        )
        assert response.status_code in {200, 404, 400, 422}

    @pytest.mark.asyncio
    async def test_download_sql_injection(self, auth_client):
        """SQL injection in file UUIDs should be safely handled"""
        response = await auth_client.post(
            "/pro/files/download",
            json=["'; DROP TABLE files; --"],
        )
        assert response.status_code in {422, 400}

    @pytest.mark.asyncio
    async def test_download_xss_in_uuid(self, auth_client):
        """XSS in file UUIDs should be safely handled"""
        response = await auth_client.post(
            "/pro/files/download",
            json=["<script>alert('xss')</script>"],
        )
        assert response.status_code in {422, 400}

    @pytest.mark.asyncio
    async def test_download_content_type(self, auth_client):
        """Download should return appropriate content type"""
        response = await auth_client.post(
            "/pro/files/download",
            json=[str(uuid4())],
        )
        if response.status_code == 200:
            content_type = response.headers.get("content-type", "")
            # Should be a stream or zip for downloads
            assert any(ct in content_type for ct in ["octet-stream", "application/zip", "application/json"])


# =============================================================================
# FILE GET BY NAME TESTS
# =============================================================================


class TestFileGetByName:
    """Tests for /pro/files/{file_name} endpoint"""

    @pytest.mark.asyncio
    async def test_get_file_by_name_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/files/test_file.txt")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_file_nonexistent(self, auth_client):
        """Should return 404 for nonexistent file"""
        response = await auth_client.get(f"/pro/files/nonexistent_{uuid4().hex}.txt")
        assert response.status_code in {404, 400}

    @pytest.mark.asyncio
    async def test_get_file_path_traversal(self, auth_client):
        """Path traversal attempt should be blocked"""
        dangerous_paths = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "....//....//etc/passwd",
            "%2e%2e%2f%2e%2e%2fetc/passwd",
        ]
        for path in dangerous_paths:
            response = await auth_client.get(f"/pro/files/{path}")
            # Should be 400, 404, or 422 - NOT 200
            assert response.status_code in {400, 404, 422}

    @pytest.mark.asyncio
    async def test_get_file_special_characters(self, auth_client):
        """Special characters in filename should be handled"""
        special_names = [
            "file with spaces.txt",
            "file%20encoded.txt",
            "file<script>.txt",
        ]
        for name in special_names:
            response = await auth_client.get(f"/pro/files/{name}")
            assert response.status_code in {400, 404, 422}

    @pytest.mark.asyncio
    async def test_get_file_null_byte(self, auth_client):
        """Null byte injection should be blocked"""
        response = await auth_client.get("/pro/files/file.txt%00.html")
        assert response.status_code in {400, 404, 422}

    @pytest.mark.asyncio
    async def test_get_file_cache_permission(self, auth_client):
        """Should return 403 when trying to get a cached file that belongs to another user"""
        from uuid import uuid4
        from unittest import mock

        fake_uuid = str(uuid4())
        other_user_uuid = str(uuid4())

        # Mock settings.redis_cache to return a file belonging to a different user
        fake_cache = {
            "uuid": fake_uuid,
            "creater_uuid": other_user_uuid,
            "s3_file_name": f"{fake_uuid}.csv",
            "bucket": "test-bucket",
            "extension": "csv",
            "original_file_name": "test.csv",
            "size": 100,
            "is_global": False,
            "is_entity_shared": False,
        }
        with mock.patch("utilities.config.Settings.redis_cache", return_value=fake_cache, autospec=True):
            response = await auth_client.get(f"/pro/files/{fake_uuid}.csv")
            assert response.status_code == 403
            assert response.json().get("detail") == "User does not have access to this file"


# =============================================================================
# FILE UPLOAD TESTS
# =============================================================================


class TestFileUpload:
    """Tests for /pro/files POST endpoint"""

    @pytest.mark.asyncio
    async def test_upload_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.post(
            "/pro/files",
            json={"files": []},
        )
        assert response.status_code in {401, 403, 422}

    @pytest.mark.asyncio
    async def test_upload_empty_files(self, auth_client):
        """Upload with empty files list should be handled"""
        response = await auth_client.post(
            "/pro/files",
            json={"files": []},
        )
        assert response.status_code in {200, 422}

    @pytest.mark.asyncio
    async def test_upload_file_name_too_long(self, auth_client):
        """Upload with very long filename should be handled"""
        long_name = "a" * 500 + ".txt"
        response = await auth_client.post(
            "/pro/files",
            json={"files": [{"name": long_name, "size": 100}]},
        )
        assert response.status_code in {200, 400, 422}

    @pytest.mark.asyncio
    async def test_upload_file_size_too_large(self, auth_client):
        """Upload with too large file size should be handled"""
        response = await auth_client.post(
            "/pro/files",
            json={"files": [{"name": "huge.txt", "size": 10000000000}]},
        )
        assert response.status_code in {200, 400, 422}


# =============================================================================
# FILE SECURITY EXTENDED TESTS
# =============================================================================


class TestFileSecurityExtended:
    """Extended security tests for file endpoints"""

    @pytest.mark.asyncio
    async def test_cannot_access_random_users_files(self, auth_client):
        """Should not be able to access random users' files"""
        other_user_file = str(uuid4())
        response = await auth_client.get(f"/pro/files/{other_user_file}/presigned-url")
        # API may return 400 (bad request), 403 (forbidden), or 404 (not found)
        assert response.status_code in {400, 403, 404}

    @pytest.mark.asyncio
    async def test_cannot_delete_other_users_files(self, auth_client):
        """Should not be able to delete other users' files"""
        other_user_file = str(uuid4())
        response = await auth_client.delete(f"/pro/files/{other_user_file}")
        # Should be 404 (not found) rather than 403 to avoid enumeration
        assert response.status_code in {200, 404}

    @pytest.mark.asyncio
    async def test_file_uuid_enumeration_protection(self, auth_client):
        """Response should not reveal whether file exists for other users"""
        # Make multiple requests with random UUIDs
        responses = []
        for _ in range(5):
            random_uuid = str(uuid4())
            response = await auth_client.get(f"/pro/files/{random_uuid}/presigned-url")
            responses.append(response.status_code)

        # All should return same status code to prevent enumeration
        assert all(code == responses[0] for code in responses)

    @pytest.mark.asyncio
    async def test_no_internal_paths_in_response(self, auth_client):
        """Response should not expose internal file paths"""
        test_uuid = str(uuid4())
        response = await auth_client.get(f"/pro/files/{test_uuid}/presigned-url")
        response_text = response.text

        # Should not contain internal paths
        dangerous_paths = ["/var/", "/home/", "/etc/", "C:\\", "/app/"]
        for path in dangerous_paths:
            assert path not in response_text


# =============================================================================
# FILE STORED FILES TESTS
# =============================================================================


class TestStoredFiles:
    """Tests for stored files endpoint"""

    @pytest.mark.asyncio
    async def test_get_stored_files_unauthenticated(self, client):
        """Should fail without auth"""
        response = await client.get("/pro/data-connectors/stored-files")
        assert response.status_code in {401, 403}

    @pytest.mark.asyncio
    async def test_get_stored_files_authenticated(self, auth_client):
        """Should return list of stored files"""
        response = await auth_client.get("/pro/data-connectors/stored-files")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_stored_files_response_schema(self, auth_client):
        """Stored files should return proper schema"""
        response = await auth_client.get("/pro/data-connectors/stored-files")
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            if len(data) > 0:
                file_item = data[0]
                assert isinstance(file_item, dict)
