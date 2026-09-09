"""Functions to help with Azure"""

from datetime import UTC, datetime, timedelta
from mimetypes import guess_type
from typing import Any, BinaryIO
from urllib.parse import quote as parse_quote

from azure.core.exceptions import AzureError, ClientAuthenticationError
from azure.storage.blob import (
    AccountSasPermissions,
    ResourceTypes,
    generate_account_sas,
)
from fastapi.responses import StreamingResponse
from loguru import logger

from api.schemas import StoredFileSchema
from api.storage import StorageAbstract
from utilities.config import settings


class AzureStream(StreamingResponse):
    def __init__(self, store_file: StoredFileSchema, **kwargs: Any) -> None:
        parsed_file_name = parse_quote(store_file.original_file_name)
        kwargs["headers"] = {"Content-Disposition": f'attachment; filename="{parsed_file_name}"'}

        media_type, _ = guess_type(store_file.original_file_name)
        if media_type is not None:
            kwargs["media_type"] = media_type

        super().__init__(None, 200, **kwargs)

        self.s3_file = store_file.s3_file_name
        self.bucket = store_file.bucket

    async def stream_response(self, send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": self.status_code,
                "headers": self.raw_headers,
            }
        )

        try:
            async with settings.azure_blob_client(self.s3_file, self.bucket) as blob_client:
                async for chunk in (await blob_client.download_blob()).chunks():
                    if not isinstance(chunk, bytes):
                        chunk = chunk.encode(self.charset)  # noqa: PLW2901
                    await send({"type": "http.response.body", "body": chunk, "more_body": True})

                await send({"type": "http.response.body", "body": b"", "more_body": False})
        except ClientAuthenticationError:
            logger.error("Failed to authenticate")


class AzureStorage(StorageAbstract):
    @staticmethod
    async def create_presigned_url(bucket_name: str, object_name: str, expiration: int = 3600) -> None | str:
        try:
            async with settings.azure_blob_client(object_name, bucket_name) as blob_client:
                sas_token = generate_account_sas(
                    blob_client.account_name,
                    account_key=blob_client.credential.account_key,
                    resource_types=ResourceTypes(object=True),
                    permission=AccountSasPermissions(read=True),
                    expiry=datetime.now(UTC) + timedelta(seconds=expiration),
                )

                hostname = blob_client._hosts[blob_client._location_mode]
                schema = blob_client.scheme

                return f"{schema}://{hostname}/{bucket_name}/{object_name}?{sas_token}"

        except ClientAuthenticationError:
            logger.error("Failed to authenticate")
        except AzureError as e:
            logger.error(f"Client error: {e}")
        return None

    @staticmethod
    async def upload_file(local_file: BinaryIO, bucket: str, s3_file: str) -> bool:
        try:
            async with settings.azure_blob_client(s3_file, bucket) as blob_client:
                await blob_client.upload_blob(local_file)

            return True
        except FileNotFoundError:
            logger.error(f"Failed to find file: {local_file}")
        except ClientAuthenticationError:
            logger.error("Failed to authenticate")
        except AzureError as e:
            logger.error(f"Client error: {e}")
        return False

    @staticmethod
    async def upload_pending_file(local_file: BinaryIO, pending_file: StoredFileSchema) -> StoredFileSchema:
        try:
            async with settings.azure_blob_client(pending_file.s3_file_name, pending_file.bucket) as blob_client:
                await blob_client.upload_blob(local_file)

                return pending_file
        except FileNotFoundError:
            logger.error(f"Failed to find file: {local_file}")
        except ClientAuthenticationError:
            logger.error("Failed to authenticate")
        except AzureError as e:
            logger.error(f"Client error: {e}")

        return pending_file.set_failed()

    @staticmethod
    async def delete_file(bucket: str, s3_file: str) -> bool:
        try:
            async with settings.azure_blob_client(s3_file, bucket) as blob_client:
                await blob_client.delete_blob()

            return True
        except ClientAuthenticationError:
            logger.error("Failed to authenticate")
        except AzureError as e:
            logger.error(f"Client error: {e}")
        return False

    @staticmethod
    async def check_file_exists(store_file: StoredFileSchema) -> bool:
        try:
            async with settings.azure_blob_client(store_file.s3_file_name, store_file.bucket) as blob_client:
                return await blob_client.exists()

        except ClientAuthenticationError:
            logger.error("Failed to authenticate")
        except AzureError as e:
            logger.error(f"Client error: {e}")
        return False

    @staticmethod
    async def get_file(bucket: str, s3_file: str) -> None | BinaryIO:
        try:
            async with settings.azure_blob_client(s3_file, bucket) as blob_client:
                stream = await blob_client.download_blob()
                return await stream.readall()

        except ClientAuthenticationError:
            logger.error("Failed to authenticate")
        except AzureError as e:
            logger.error(f"Client error: {e}")
        return None

    @staticmethod
    def get_stream(store_file: StoredFileSchema, **kwargs: Any) -> StreamingResponse:
        return AzureStream(store_file, **kwargs)
