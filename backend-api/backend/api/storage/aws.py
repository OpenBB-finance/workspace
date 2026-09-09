"""Functions to help with AWS"""

from mimetypes import guess_type
from typing import Any, BinaryIO
from urllib.parse import quote as parse_quote

from botocore.exceptions import ClientError, NoCredentialsError
from fastapi.responses import StreamingResponse
from loguru import logger

from api.schemas import StoredFileSchema
from api.storage import StorageAbstract
from utilities.config import settings


class S3Stream(StreamingResponse):
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

        async for s3_async in settings.s3_client():
            result = await s3_async.get_object(Bucket=self.bucket, Key=self.s3_file)

            async for chunk in result["Body"]:
                if not isinstance(chunk, bytes):
                    chunk = chunk.encode(self.charset)  # noqa: PLW2901
                await send({"type": "http.response.body", "body": chunk, "more_body": True})

        await send({"type": "http.response.body", "body": b"", "more_body": False})


class S3Storage(StorageAbstract):
    @staticmethod
    async def create_presigned_url(bucket_name: str, object_name: str, expiration: int = 3600) -> None | str:
        """Generate a presigned URL to share an S3 object

        Parameters
        ----------
        bucket_name: str
        object_name: str
        expiration: int
            Time in seconds for the presigned URL to remain valid

        Returns
        -------
        url: str
            Presigned URL as string. If error, returns None.
        """

        # Generate a presigned URL for the S3 object
        s3_client = settings.get_s3_client()
        try:
            response = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket_name, "Key": object_name},
                ExpiresIn=expiration,
            )
        except ClientError as e:
            logger.error(e)
            return None

        # The response contains the presigned URL
        return response

    @staticmethod
    async def upload_file(local_file: BinaryIO, bucket: str, s3_file: str) -> bool:
        "Upload an image to aws. This image will always be saved as a png."

        try:
            async with settings.async_s3_client() as s3_async:
                await s3_async.upload_fileobj(local_file, bucket, s3_file, ExtraArgs={"ContentType": "image/png"})
            return True
        except FileNotFoundError:
            logger.error(f"Failed to find file: {local_file}")
        except NoCredentialsError:
            logger.error("Credentials not available")
        except ClientError as e:
            logger.error(f"Client error: {e}")
        return False

    @staticmethod
    async def upload_pending_file(local_file: BinaryIO, pending_file: StoredFileSchema) -> StoredFileSchema:
        "Upload any file type to AWS and save with whatever extension that was provided."

        try:
            async with settings.async_s3_client() as s3_async:
                await s3_async.upload_fileobj(
                    local_file,
                    pending_file.bucket,
                    pending_file.s3_file_name,
                )
            return pending_file
        except FileNotFoundError:
            logger.error(f"Failed to find file: {local_file}")
        except NoCredentialsError:
            logger.error("Credentials not available")
        except ClientError as e:
            logger.error(f"Client error: {e}")

        return pending_file.set_failed()

    @staticmethod
    async def delete_file(bucket: str, s3_file: str) -> bool:
        "Remove a given file from the AWS bucket."

        try:
            async with settings.async_s3_client() as s3_async:
                await s3_async.delete_object(Bucket=bucket, Key=s3_file)
            return True
        except NoCredentialsError:
            logger.error("Credentials not available")
        except ClientError as e:
            logger.error(f"Client error: {e}")
        return False

    @staticmethod
    async def check_file_exists(store_file: StoredFileSchema) -> bool:
        "Check if a file exists in the AWS bucket."
        try:
            async with settings.async_s3_client() as s3_async:
                await s3_async.head_object(Bucket=store_file.bucket, Key=store_file.s3_file_name)
            return True
        except NoCredentialsError:
            logger.error("Credentials not available")
        except ClientError as e:
            logger.error(f"Client error: {e}")
        return False

    @staticmethod
    async def get_file(bucket: str, s3_file: str) -> None | BinaryIO | bytes:
        "Get a file from the AWS bucket."
        try:
            async with settings.async_s3_client() as s3_async:
                stream = await s3_async.get_object(Bucket=bucket, Key=s3_file)
                return await stream["Body"].read()
        except NoCredentialsError:
            logger.error("Credentials not available")
        except ClientError as e:
            logger.error(f"Client error: {e}")
        return None

    @staticmethod
    def get_stream(store_file: StoredFileSchema, **kwargs: Any) -> S3Stream:
        return S3Stream(store_file, **kwargs)
