"""Storage abstract class."""

from typing import Any, BinaryIO, Literal

from fastapi.responses import StreamingResponse

from api.schemas import StoredFileSchema


class StorageAbstract:
    @staticmethod
    async def create_presigned_url(bucket_name: str, object_name: str, expiration: int = 3600) -> None | str:
        raise NotImplementedError

    @staticmethod
    async def upload_file(local_file: BinaryIO, bucket: str, s3_file: str) -> bool:
        raise NotImplementedError

    @staticmethod
    async def upload_pending_file(local_file: BinaryIO, pending_file: StoredFileSchema) -> StoredFileSchema:
        raise NotImplementedError

    @staticmethod
    async def delete_file(bucket: str, s3_file: str) -> bool:
        raise NotImplementedError

    @staticmethod
    async def check_file_exists(store_file: StoredFileSchema) -> bool:
        raise NotImplementedError

    @staticmethod
    async def get_file(bucket: str, s3_file: str) -> None | BinaryIO:
        raise NotImplementedError

    @staticmethod
    def get_stream(store_file: StoredFileSchema, **kwargs: Any) -> StreamingResponse:
        raise NotImplementedError

    @staticmethod
    def validate_presigned_url(file_name: str, Expires: int, Signature: str) -> dict[Literal["s3_file_name"], str] | None:
        raise NotImplementedError
