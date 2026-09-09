from datetime import UTC, datetime, timedelta
from mimetypes import guess_type
from pathlib import Path
from typing import Any, BinaryIO, Literal
from urllib.parse import quote as parse_quote
from uuid import uuid4

from anyio.streams.file import FileReadStream, FileWriteStream
from fastapi.responses import StreamingResponse
from loguru import logger

from api.schemas import StoredFileSchema
from api.storage.abstract import StorageAbstract
from utilities.config import settings


class FileStream(StreamingResponse):
    def __init__(self, store_file: StoredFileSchema, **kwargs: Any) -> None:
        parsed_file_name = parse_quote(store_file.original_file_name)
        kwargs["headers"] = {"Content-Disposition": f'attachment; filename="{parsed_file_name}"'}

        media_type, _ = guess_type(store_file.original_file_name)
        if media_type is not None:
            kwargs["media_type"] = media_type

        super().__init__(None, 200, **kwargs)

        self.local_file_path = settings.get_local_file_path(store_file.s3_file_name)

    async def stream_response(self, send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": self.status_code,
                "headers": self.raw_headers,
            }
        )

        async with await FileReadStream.from_path(self.local_file_path) as stream:
            async for chunk in stream:
                await send({"type": "http.response.body", "body": chunk, "more_body": True})

        await send({"type": "http.response.body", "body": b"", "more_body": False})


async def write_to_file(local_file: BinaryIO, local_file_path: Path) -> None:
    async with await FileWriteStream.from_path(local_file_path) as stream:
        await stream.send(local_file.read())


class LocalStorage(StorageAbstract):
    @staticmethod
    async def create_presigned_url(bucket_name: str, object_name: str, expiration: int = 3600) -> None | str:
        base_url = f"{settings.SELFURL}/pro/files/presigned"

        extension = object_name.rsplit(".", maxsplit=1)[-1]
        new_object_name = f"{uuid4()}.{extension}"
        expires_at = int((datetime.now(UTC) + timedelta(seconds=expiration)).timestamp())
        signature = settings.generate_signature(new_object_name, expires_at)

        settings.redis_cache(
            f"presigned_url:{new_object_name}",
            {"s3_file_name": object_name},
            expire=timedelta(seconds=expiration),
        )

        return f"{base_url}/{new_object_name}?Expires={expires_at}&Signature={signature}"

    @staticmethod
    async def upload_file(local_file: BinaryIO, bucket: str, s3_file: str) -> bool:
        try:
            local_file_path = settings.get_local_file_path(s3_file)
            await write_to_file(local_file, local_file_path)
            return True
        except Exception as e:
            logger.error(f"Error uploading file to local storage: {e}")
            return False

    @staticmethod
    async def upload_pending_file(local_file: BinaryIO, pending_file: StoredFileSchema) -> StoredFileSchema:
        try:
            local_file_path = settings.get_local_file_path(pending_file.s3_file_name)
            await write_to_file(local_file, local_file_path)
            return pending_file
        except Exception as e:
            logger.error(f"Error uploading file to local storage: {e}")

        return pending_file.set_failed()

    @staticmethod
    async def delete_file(bucket: str, s3_file: str) -> bool:
        try:
            settings.get_local_file_path(s3_file).unlink()
            return True
        except FileNotFoundError:
            return False

    @staticmethod
    async def check_file_exists(store_file: StoredFileSchema) -> bool:
        return settings.get_local_file_path(store_file.s3_file_name).exists()

    @staticmethod
    async def get_file(bucket: str, s3_file: str) -> None | BinaryIO | bytes:
        try:
            return settings.get_local_file_path(s3_file).read_bytes()
        except FileNotFoundError:
            return None

    @staticmethod
    def get_stream(store_file: StoredFileSchema, **kwargs: Any) -> StreamingResponse:
        return FileStream(store_file, **kwargs)

    @staticmethod
    def validate_presigned_url(file_name: str, Expires: int, Signature: str) -> dict[Literal["s3_file_name"], str] | None:
        if not settings.validate_signature(file_name, Expires, Signature):
            return None

        return settings.redis_cache(f"presigned_url:{file_name}")
