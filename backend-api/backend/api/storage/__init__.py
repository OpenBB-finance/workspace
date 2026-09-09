"""Storage abstract class."""

from typing import Any, BinaryIO, Literal

from fastapi.responses import StreamingResponse

from api.schemas import StoredFileSchema
from utilities.config import settings

from .abstract import StorageAbstract


class Storage(StorageAbstract):
    def __new__(cls) -> StorageAbstract:
        from api.storage import aws, azure, gcp, local  # noqa: F401, PLC0415

        if not hasattr(cls, "_instance"):
            if settings.STORAGE_PROVIDER == "aws":
                cls._instance = aws.S3Storage()
            elif settings.STORAGE_PROVIDER == "azure":
                cls._instance = azure.AzureStorage()
            elif settings.STORAGE_PROVIDER == "gcp":
                cls._instance = gcp.GCPStorage()
            elif settings.STORAGE_PROVIDER == "folder":
                cls._instance = local.LocalStorage()

        return cls._instance


storage = Storage()


class FileStorage:
    @staticmethod
    async def create_presigned_url(bucket_name: str, object_name: str, expiration: int = 3600) -> None | str:
        return await storage.create_presigned_url(bucket_name, object_name, expiration)

    @staticmethod
    async def upload_file(local_file: BinaryIO, bucket: str, s3_file: str) -> bool:
        return await storage.upload_file(local_file, bucket, s3_file)

    @staticmethod
    async def upload_pending_file(local_file: BinaryIO, pending_file: StoredFileSchema) -> StoredFileSchema:
        return await storage.upload_pending_file(local_file, pending_file)

    @staticmethod
    async def delete_file(bucket: str, s3_file: str) -> bool:
        return await storage.delete_file(bucket, s3_file)

    @staticmethod
    async def check_file_exists(store_file: StoredFileSchema) -> bool:
        return await storage.check_file_exists(store_file)

    @staticmethod
    async def get_file(bucket: str, s3_file: str) -> None | BinaryIO:
        return await storage.get_file(bucket, s3_file)

    @staticmethod
    def get_stream(store_file: StoredFileSchema, **kwargs: Any) -> StreamingResponse:
        return storage.get_stream(store_file, **kwargs)

    @staticmethod
    def validate_presigned_url(file_name: str, Expires: int, Signature: str) -> dict[Literal["s3_file_name"], str] | None:
        return storage.validate_presigned_url(file_name, Expires, Signature)
