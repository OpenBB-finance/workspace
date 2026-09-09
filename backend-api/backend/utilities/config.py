import json
import os
import ssl
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime, timedelta
from pathlib import Path
from ssl import SSLContext
from typing import Any, Literal, TypeVar, overload
from uuid import UUID

import aioboto3
import boto3
import hubspot
import mailchimp_marketing
import mailchimp_transactional
from aiobotocore.config import AioConfig
from aiobotocore.session import AioSession
from azure.identity import DefaultAzureCredential
from azure.storage.blob.aio import BlobClient, BlobServiceClient
from botocore.client import BaseClient, Config
from botocore.session import Session
from fastapi.encoders import jsonable_encoder
from pydantic import (
    BaseModel as PydanticBaseModel,
    ConfigDict,
    EmailStr,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict
from redis import Redis
from redis.asyncio import Redis as AsyncRedis
from redis.asyncio.cluster import RedisCluster as AsyncRedisCluster
from redis.cluster import RedisCluster
from sqlalchemy import AsyncAdaptedQueuePool, create_engine
from sqlalchemy.engine.base import Engine
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

_RedisCacheT = TypeVar("_RedisCacheT")


class BaseModel(PydanticBaseModel):
    """BaseModel subclass that ignores Cython-compiled methods.

    When this module is compiled by Cython 3, plain `def method(self): ...`
    bodies become `cyfunction` objects on the class. Pydantic's metaclass
    scans the class namespace for unannotated attributes and treats anything
    that isn't a recognised callable type (FunctionType, property, etc.) as
    a malformed field. `cyfunction` is not in its default ignore list.

    `type(lambda: None)` evaluates to FunctionType in plain Python and to
    the cyfunction type when this file is compiled — adding whichever it
    happens to be is a no-op in dev and the real fix in the lite build.

    Project Pydantic models should inherit from this class instead of
    pydantic.BaseModel directly.
    """

    model_config = ConfigDict(ignored_types=(type(lambda: None),))


def create_path(*path: str) -> str:
    base_path = os.path.dirname(os.path.abspath(__file__))
    in_between = os.path.dirname(base_path)
    default_path = os.path.join(in_between, *path)
    return default_path


def get_url(self: "DatabaseSettings", access: Literal["READ", "WRITE"] = "READ") -> str:
    if self.DATABASE_TYPE == "sqlite":
        return f"sqlite:///{self.DB_PATH}"

    user = getattr(self, f"{access}_DB_USER")
    password = getattr(self, f"{access}_DB_PASSWORD")
    the_host = self.DB_HOST
    the_port = self.DB_PORT
    name = self.DB_NAME

    if self.DATABASE_TYPE == "postgresql":
        return f"postgresql+psycopg2://{user}:{password}@{the_host}:{the_port}/{name}"

    return f"mysql+pymysql://{user}:{password}@{the_host}:{the_port}/{name}?charset=utf8mb4"


class DatabaseConnectArgs(BaseModel):
    model_config = {"arbitrary_types_allowed": True}

    ssl: SSLContext | None = None


DB_POOL_SIZE = {
    "mysql": {"max": 150, "default": 50, "overflow": 20},
    "postgresql": {"max": 100, "default": 50, "overflow": 10},
    # SQLite doesn't support multiple concurrent connections
    "sqlite": {"max": 1, "default": 1, "overflow": 0},
}


class DatabaseEngineSettings(BaseModel):
    pool_pre_ping: bool = True
    pool_size: int = 50
    max_overflow: int = 20  # allowed extra connections above pool_size
    pool_timeout: int = 30  # this is in seconds
    pool_recycle: int = 1800  # this is also in seconds
    echo: bool = False
    connect_args: DatabaseConnectArgs = DatabaseConnectArgs()

    @model_validator(mode="after")
    def _adjust_pool_size(self):
        """Adjust pool_size and max_overflow based on DATABASE_TYPE and WORKERS to prevent connection starvation
        or exceeding DB connection limits.

        Example
        -------
        For MySQL with a max of 150 connections:
            - If `WORKERS=4`
            - Default `pool_size=50 and overflow=20` would allow up to 280 connections `(4*(50+20))`,
            which exceeds the limit.
            - The scale_factor would be `150/(4*70) = 0.535`, resulting in an adjusted
            pool_size of 26 and max_overflow of 10, allowing up to 144 connections `(4*(26+10))`.
        """

        limits = DB_POOL_SIZE[settings.DATABASE_TYPE]
        self.pool_size = limits["default"]
        self.max_overflow = limits["overflow"]

        total_connections_per_worker = limits["default"] + limits["overflow"]
        if settings.WORKERS * total_connections_per_worker > limits["max"]:
            # Scale down pool_size and max_overflow proportionally
            scale_factor = limits["max"] / (
                settings.WORKERS * total_connections_per_worker
            )
            self.pool_size = max(1, int(self.pool_size * scale_factor))
            self.max_overflow = max(0, int(self.max_overflow * scale_factor))

        return self

    @staticmethod
    def custom_timeout(_timeout: int):
        connect_args = DatabaseConnectArgs()
        return DatabaseEngineSettings(connect_args=connect_args)

    @classmethod
    def with_custom_ssl(cls, ssl_context: SSLContext | None = None):
        connect_args = DatabaseConnectArgs(ssl=ssl_context)
        return cls(connect_args=connect_args)


class DatabaseSessionManager:
    def __init__(self, host: str, **engine_kwargs: Any):
        host = host.replace("pymysql", "aiomysql").replace("psycopg2", "asyncpg")

        is_sqlite = host.startswith("sqlite")
        if is_sqlite:
            host = host.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
            # A single connection serialized through pool checkout: concurrent
            # sessions queue for it. StaticPool must not be used here — it hands
            # the same connection to overlapping sessions, so their transactions
            # interleave and one session's COMMIT persists another's partial writes.
            engine_kwargs["pool_size"] = 1
            engine_kwargs["max_overflow"] = 0
            # timeout = SQLite busy_timeout (seconds): block on write-lock contention instead of erroring.
            engine_kwargs["connect_args"] = {"check_same_thread": False, "timeout": 5}

        self._engine = create_async_engine(
            host, **engine_kwargs, poolclass=AsyncAdaptedQueuePool
        )
        self._sessionmaker = async_sessionmaker(
            self._engine, expire_on_commit=False, autocommit=False, autoflush=True
        )

    async def close(self):
        if self._engine is None:
            raise Exception("DatabaseSessionManager is not initialized")
        await self._engine.dispose()

        self._engine = None
        self._sessionmaker = None

    @asynccontextmanager
    async def connect(self) -> AsyncGenerator[AsyncConnection]:
        if self._engine is None:
            raise Exception("DatabaseSessionManager is not initialized")

        async with self._engine.begin() as connection:
            try:
                yield connection
            except Exception:
                await connection.rollback()
                raise

    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession]:
        if self._sessionmaker is None:
            raise Exception("DatabaseSessionManager is not initialized")

        session = self._sessionmaker()
        try:
            yield session
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()


class DatabaseSettings(BaseModel):
    READ_DB_USER: str | None = None
    READ_DB_PASSWORD: str | None = None
    WRITE_DB_USER: str | None = None
    WRITE_DB_PASSWORD: str | None = None
    DB_HOST: str | None = None
    DB_NAME: str | None = None
    DB_PORT: int | None = None
    DB_PATH: str = "local.db"
    DATABASE_TYPE: Literal["mysql", "postgresql", "sqlite"] = "mysql"
    SSL_CA: str | None = None
    SSL_CERT: str | None = None
    SSL_KEY: str | None = None

    @model_validator(mode="after")
    def _validate_db_settings(self):
        """Enforce that connection fields are set for MySQL/PostgreSQL."""
        if self.DATABASE_TYPE == "sqlite":
            return self
        required = [
            "READ_DB_USER",
            "READ_DB_PASSWORD",
            "WRITE_DB_USER",
            "WRITE_DB_PASSWORD",
            "DB_HOST",
            "DB_NAME",
            "DB_PORT",
        ]
        missing = [f for f in required if getattr(self, f) is None]
        if missing:
            msg = (
                f"Fields {missing} are required when DATABASE_TYPE={self.DATABASE_TYPE}"
            )
            raise ValueError(msg)
        return self

    def get_ssl_config(self) -> SSLContext | None:
        """Build an SSLContext for the DB driver from env-configured paths.

        Env vars consumed:
            - SSL_CA: path to CA certificate file. Used to verify the server cert.
                If unset, the system CA bundle is used.
            - SSL_CERT: path to client certificate file (mTLS). Must be set with SSL_KEY.
            - SSL_KEY:  path to client private key file (mTLS). Must be set with SSL_CERT.

        Returns None when no SSL env vars are set (driver connects without TLS).
        To tune other TLS knobs (verify_mode, check_hostname, ciphers, etc.),
        configure them on the returned SSLContext at the call site.
        """
        if not (self.SSL_CA or self.SSL_CERT or self.SSL_KEY):
            return None
        if bool(self.SSL_CERT) != bool(self.SSL_KEY):
            raise ValueError("SSL_CERT and SSL_KEY must be set together (or neither)")
        ctx = ssl.create_default_context(cafile=self.SSL_CA)
        if self.SSL_CERT and self.SSL_KEY:
            ctx.load_cert_chain(certfile=self.SSL_CERT, keyfile=self.SSL_KEY)
        return ctx

    def get_read_url(self) -> str:
        return get_url(self)

    @staticmethod
    def _sqlite_engine_kwargs() -> dict[str, Any]:
        """Return engine kwargs appropriate for SQLite."""
        return {
            # One connection serialized via pool checkout (see
            # DatabaseSessionManager) — never StaticPool, which shares the
            # connection across threads and interleaves transactions.
            "connect_args": {"check_same_thread": False, "timeout": 5},
            "pool_size": 1,
            "max_overflow": 0,
        }

    def get_read_engine(self, settings: DatabaseEngineSettings | None = None) -> Engine:
        if self.DATABASE_TYPE == "sqlite":
            return create_engine(self.get_read_url(), **self._sqlite_engine_kwargs())
        if settings is None:
            settings = DatabaseEngineSettings.with_custom_ssl(self.get_ssl_config())
        return create_engine(self.get_read_url(), **settings.model_dump())

    def get_read_session(
        self, settings: DatabaseEngineSettings | None = None
    ) -> DatabaseSessionManager:
        if settings is None:
            settings = DatabaseEngineSettings.with_custom_ssl(self.get_ssl_config())
        return DatabaseSessionManager(self.get_read_url(), **settings.model_dump())

    def get_write_url(self) -> str:
        return get_url(self, access="WRITE")

    def get_write_engine(
        self, settings: DatabaseEngineSettings | None = None
    ) -> Engine:
        if self.DATABASE_TYPE == "sqlite":
            return create_engine(self.get_write_url(), **self._sqlite_engine_kwargs())
        if settings is None:
            settings = DatabaseEngineSettings.with_custom_ssl(self.get_ssl_config())
        return create_engine(self.get_write_url(), **settings.model_dump())

    def get_write_session(
        self, settings: DatabaseEngineSettings | None = None
    ) -> DatabaseSessionManager:
        if settings is None:
            settings = DatabaseEngineSettings.with_custom_ssl(self.get_ssl_config())
        return DatabaseSessionManager(self.get_write_url(), **settings.model_dump())

    def get_validate_user_session(
        self, settings: DatabaseEngineSettings | None = None
    ) -> DatabaseSessionManager:
        if settings is None:
            settings = DatabaseEngineSettings.with_custom_ssl(self.get_ssl_config())
        return DatabaseSessionManager(self.get_write_url(), **settings.model_dump())


class RedisSettings(BaseModel):
    REDIS_HOST: str = "redis"
    REDIS_USER: str | None = ""
    REDIS_PASS: str
    REDIS_PORT: int = 6379
    REDIS_SSL_PORT: int = 6380
    REDIS_DB_BOT: int = 0
    REDIS_DB_PRO: int = 1
    REDIS_DB_SDK: int = 12
    REDIS_SSL_CA: str | None = None
    REDIS_SSL_CERT: str | None = None
    REDIS_SSL_KEY: str | None = None
    REDIS_SSL_CERT_REQ: Literal["none", "optional", "required"] | None = None
    REDIS_CLUSTER_MODE: bool = False
    REDIS_RQ_HASH_TAGS: bool = False

    __port: int | None = None
    __schema: str | None = None
    __ssl_config: dict[str, Any] | None = None

    def __init__(self, **data: Any):
        super().__init__(**data)

        ssl_config = self.get_redis_ssl_config()
        self.__ssl_config = ssl_config
        self.__port = self.REDIS_SSL_PORT if ssl_config else self.REDIS_PORT
        self.__schema = "rediss" if ssl_config else "redis"

    @property
    def schema(self) -> str:
        return self.__schema

    @property
    def ssl_config(self) -> dict[str, Any] | None:
        return self.__ssl_config

    @property
    def port(self) -> int:
        return self.__port

    def get_redis_ssl_config(self) -> dict[str, Any] | None:
        ssl_config = {}
        if self.REDIS_SSL_CERT or self.REDIS_SSL_CA:
            ssl_certfile = self.REDIS_SSL_CERT or self.REDIS_SSL_CA
            ssl_config["ssl_ca_certs"] = ssl_certfile
        if self.REDIS_SSL_KEY:
            ssl_config["ssl_keyfile"] = self.REDIS_SSL_KEY

        update = {"ssl": True, "ssl_cert_reqs": self.REDIS_SSL_CERT_REQ}
        if ssl_config or self.REDIS_SSL_CERT_REQ == "none":
            ssl_config.update(update)
            return ssl_config
        return None

    def get_redis_url(self) -> str:
        uri = f"{self.schema}://{self.REDIS_USER}:{self.REDIS_PASS}@{self.REDIS_HOST}:{self.port}/{self.REDIS_DB_PRO}"

        if self.REDIS_CLUSTER_MODE:
            uri = uri.replace(f"/{self.REDIS_DB_PRO}", "")

        query_params = []
        if self.ssl_config:
            for key in ["ssl_ca_certs", "ssl_cert_reqs", "ssl_keyfile"]:
                if key in self.ssl_config:
                    query_params.append(f"{key}={self.ssl_config[key]}")

        if query_params:
            uri += "?" + "&".join(query_params)

        return uri

    def get_redis_session(
        self, database: Literal["bot", "pro", "sdk"]
    ) -> Redis | RedisCluster:
        db_options = {
            "bot": self.REDIS_DB_BOT,
            "pro": self.REDIS_DB_PRO,
            "sdk": self.REDIS_DB_SDK,
        }

        kwargs = {
            "host": self.REDIS_HOST,
            "username": self.REDIS_USER,
            "password": self.REDIS_PASS,
            "port": self.port,
        }

        if self.ssl_config:
            kwargs.update(self.ssl_config)

        # Check if cluster mode is enabled
        if self.REDIS_CLUSTER_MODE:
            # RedisCluster doesn't support db parameter
            return RedisCluster(**kwargs)

        kwargs["db"] = db_options[database]
        return Redis(**kwargs)

    def get_async_redis_session(
        self, database: Literal["bot", "pro", "sdk"]
    ) -> AsyncRedis | AsyncRedisCluster:
        """Async counterpart of get_redis_session for non-blocking pub/sub and keyspace ops.

        Mirrors the cluster/SSL/db branching so callers on the event loop avoid offloading
        synchronous Redis calls to the thread pool.
        """
        db_options = {
            "bot": self.REDIS_DB_BOT,
            "pro": self.REDIS_DB_PRO,
            "sdk": self.REDIS_DB_SDK,
        }

        kwargs = {
            "host": self.REDIS_HOST,
            "username": self.REDIS_USER,
            "password": self.REDIS_PASS,
            "port": self.port,
        }

        if self.ssl_config:
            kwargs.update(self.ssl_config)

        if self.REDIS_CLUSTER_MODE:
            # RedisCluster doesn't support db parameter
            return AsyncRedisCluster(**kwargs)

        kwargs["db"] = db_options[database]
        return AsyncRedis(**kwargs)

    @overload
    def redis_cache(
        self,
        redis_key: str | UUID,
        data: None = ...,
        expire: int | timedelta | None = ...,
        update: bool = ...,
        delete: bool = ...,
    ) -> bool: ...

    @overload
    def redis_cache(
        self,
        redis_key: str | UUID,
        data: "_RedisCacheT",
        expire: int | timedelta | None = ...,
        update: bool = ...,
        delete: bool = ...,
    ) -> "_RedisCacheT": ...

    def redis_cache(
        self,
        redis_key: str | UUID,
        data: "_RedisCacheT | None" = None,
        expire: int | timedelta | None = None,
        update: bool = False,
        delete: bool = False,
    ) -> "_RedisCacheT":
        """Check if key is in redis cache.
            If data is not None, set the data in the cache and return data.
            If data is None and key is in cache, return the data.
            If data is None and the key is not in the cache, return None.

        Parameters
        ----------
        redis_key : str
            Key to check in redis cache
        data : object, optional
            Data to add to redis cache. The default is None.
        expire : int, optional
            Expiration time in seconds. The default is redis_cache_seconds().
        redis_client : redis.Redis, optional
            Redis client. The default is imps.redis_conn.
        update : bool, optional
            If True, update the redis cache. The default is False.

        Returns
        -------
        object
            Data from redis cache if it exists, else data
        """
        if not isinstance(expire, timedelta) and expire is not None:
            expire = timedelta(seconds=expire)

        redis_client = self.get_redis_session("pro")
        redis_key = str(redis_key)

        if self.REDIS_CLUSTER_MODE:
            redis_key = f"pro:{{cluster}}:{redis_key}"

        if redis_client.get(redis_key) and not update:
            if delete:
                redis_client.delete(redis_key)
                return True

            return json.loads(redis_client.get(redis_key))

        if data is None:
            return False

        redis_client.set(
            redis_key, json.dumps(jsonable_encoder(data)), ex=expire if expire else None
        )

        return data


class AWSSettings(BaseModel):
    S3_ACCESS_KEY: str = os.environ.get("S3_ACCESS_KEY", "")
    S3_SECRET_KEY: str = os.environ.get("S3_SECRET_KEY", "")
    S3_BUCKET_NAME: str = os.environ.get("S3_BUCKET_NAME", "openbb-assets")
    S3_BUCKET_BASE: HttpUrl = HttpUrl("https://openbb-assets.s3.amazonaws.com/")
    S3_FILE_BUCKET: str = os.environ.get("S3_BUCKET", "pro-file-storage-dev")
    S3_FILE_BUCKET_BASE: HttpUrl = HttpUrl(
        f"https://{S3_FILE_BUCKET}.s3.amazonaws.com/"
    )
    S3_IMAGE_BUCKET: HttpUrl = HttpUrl(f"{S3_BUCKET_BASE}profile-pictures/")
    S3_VERIFY_SSL: bool | None = None
    S3_ENDPOINT_URL: str | None = None
    S3_REGION: str | None = os.environ.get("S3_REGION", None)
    S3_SIGNATURE_VERSION: Literal["s3v4", "v4"] = os.environ.get(
        "S3_SIGNATURE_VERSION", "s3v4"
    )

    def async_s3_client(self):
        session = self.get_async_s3_session()
        botocore_config = AioConfig(
            max_pool_connections=20, signature_version=self.S3_SIGNATURE_VERSION
        )
        return session.client(
            "s3",
            config=botocore_config,
            region_name=self.S3_REGION,
            endpoint_url=self.S3_ENDPOINT_URL,
            verify=self.S3_VERIFY_SSL,
        )

    def get_s3_client(self) -> BaseClient:
        return boto3.client(
            "s3",
            aws_access_key_id=self.S3_ACCESS_KEY,
            aws_secret_access_key=self.S3_SECRET_KEY,
            region_name=self.S3_REGION,
            endpoint_url=self.S3_ENDPOINT_URL,
            verify=self.S3_VERIFY_SSL,
            config=Config(signature_version=self.S3_SIGNATURE_VERSION),
        )

    def get_async_s3_session(self) -> aioboto3.Session:
        return aioboto3.Session(
            aws_access_key_id=self.S3_ACCESS_KEY,
            aws_secret_access_key=self.S3_SECRET_KEY,
            region_name=self.S3_REGION,
        )

    def get_profile_url(self, uuid: UUID) -> str:
        return f"{self.S3_IMAGE_BUCKET}{uuid}.png"

    async def s3_client(self):
        session = AioSession()
        botocore_config = AioConfig(
            max_pool_connections=20, signature_version=self.S3_SIGNATURE_VERSION
        )

        try:
            async with session.create_client(
                "s3",
                aws_access_key_id=self.S3_ACCESS_KEY,
                aws_secret_access_key=self.S3_SECRET_KEY,
                region_name=self.S3_REGION,
                endpoint_url=self.S3_ENDPOINT_URL,
                config=botocore_config,
                verify=self.S3_VERIFY_SSL,
            ) as client:
                yield client
        except Exception as e:
            raise e

    def s3_client_sync(self) -> BaseClient:
        session = Session()
        return session.create_client(
            "s3",
            aws_access_key_id=self.S3_ACCESS_KEY,
            aws_secret_access_key=self.S3_SECRET_KEY,
            region_name=self.S3_REGION,
            endpoint_url=self.S3_ENDPOINT_URL,
            verify=self.S3_VERIFY_SSL,
            config=Config(signature_version=self.S3_SIGNATURE_VERSION),
        )


class LocalStorageSettings(BaseModel):
    FOLDER_STORAGE_PATH: str = os.environ.get("FOLDER_STORAGE_PATH", "local_storage")
    LOCAL_STORAGE_SECRET_KEY: str = os.environ.get(
        "LOCAL_STORAGE_SECRET_KEY", "default_secret_key"
    )

    def get_local_file_path(self, s3_file: str) -> Path:
        path = Path(self.FOLDER_STORAGE_PATH) / s3_file
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def generate_signature(self, object_name: str, expiration: int) -> str:
        """The signature is generated using HMAC with SHA256, using the secret key and the message containing
        the object name and expiration time.
        """
        import hashlib  # noqa: E117, PLC0415
        import hmac  # noqa: E117, PLC0415

        secret_key = self.LOCAL_STORAGE_SECRET_KEY.encode()
        message = f"{object_name}:{expiration}".encode()
        signature = hmac.new(secret_key, message, hashlib.sha256).hexdigest()
        return signature

    def validate_signature(
        self, object_name: str, expiration: int, signature: str
    ) -> bool:
        """Validate the signature by comparing it to a freshly generated one."""
        import hmac  # noqa: E117, PLC0415

        expected_signature = self.generate_signature(object_name, expiration)
        if not hmac.compare_digest(expected_signature, signature):
            return False

        return datetime.now(UTC) < datetime.fromtimestamp(expiration, tz=UTC)


class AzureSettings(BaseModel):
    AZURE_CONNECTION_STRING: str | None = None
    AZURE_STORAGE_CONTAINER: str = os.environ.get(
        "AZURE_STORAGE_CONTAINER", "pro-file-storage-dev"
    )
    AZURE_STORAGE_ACCOUNT: str | None = None
    AZURE_USE_CLI_AUTH: bool | None = (
        AZURE_CONNECTION_STRING is None and AZURE_STORAGE_ACCOUNT
    )

    __token_credential: DefaultAzureCredential | None = None

    @property
    def token_credential(self) -> DefaultAzureCredential:
        if self.__token_credential is None:
            self.__token_credential = DefaultAzureCredential()
        return self.__token_credential

    def check_azure(self):
        if not all([self.AZURE_CONNECTION_STRING, self.AZURE_STORAGE_ACCOUNT]):
            raise Exception(
                "Azure connection string or storage account must be set in environment."
                " (`AZURE_CONNECTION_STRING`, `AZURE_STORAGE_ACCOUNT`)"
            )

    def azure_client(self) -> BlobServiceClient:
        self.check_azure()
        if self.AZURE_USE_CLI_AUTH:
            return BlobServiceClient(
                account_url=f"https://{self.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net",
                credential=self.token_credential,
            )

        return BlobServiceClient.from_connection_string(self.AZURE_CONNECTION_STRING)

    def azure_blob_client(self, blob: str, container: str) -> BlobClient:
        self.check_azure()

        if self.AZURE_USE_CLI_AUTH:
            return BlobClient(
                account_url=f"https://{self.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net",
                container_name=container,
                blob_name=blob,
                credential=self.token_credential,
            )

        return BlobClient.from_connection_string(
            self.AZURE_CONNECTION_STRING, container, blob
        )


class AccessSettings(BaseModel):
    # https://ipgeolocation.io/documentation/ip-geolocation-api.html
    OPENBB_GEO_KEY: str | None = None
    OPENBB_AES_KEY: str


class MailChimpSettings(BaseModel):
    MAILCHIMP_MARKETING: str | None = None
    MAILCHIMP_TRANSACTIONAL: str | None = None
    MAILCHIMP_SERVER: str | None = None
    MAILCHIMP_AUDIENCE_ID: str | None = None

    @property
    def MAILCHIMP(self) -> bool:
        return bool(self.MAILCHIMP_MARKETING and self.MAILCHIMP_TRANSACTIONAL)

    def get_marketing_client(self) -> mailchimp_marketing.Client:
        if not self.MAILCHIMP_MARKETING:
            raise ValueError("Mailchimp marketing is not configured")
        return mailchimp_marketing.Client(
            {"api_key": self.MAILCHIMP_MARKETING, "server": self.MAILCHIMP_SERVER}
        )

    def get_transactional_client(self) -> mailchimp_transactional.Client:
        if not self.MAILCHIMP_TRANSACTIONAL:
            raise ValueError("Mailchimp transactional is not configured")
        return mailchimp_transactional.Client(self.MAILCHIMP_TRANSACTIONAL)


class HubspotSettings(BaseModel):
    HUBSPOT: bool | None = False
    HUBSPOT_EMAIL_TOKEN: str | None = None
    HUBSPOT_CONTACT_TOKEN: str | None = None
    HUBSPOT_SERVICE_TOKEN: str | None = None
    HUBSPOT_BASE_URL: HttpUrl | None = HttpUrl("https://api.hubapi.com/")
    HUBSPOT_CONTACTS_URL: HttpUrl | None = HttpUrl(
        f"{HUBSPOT_BASE_URL}crm/v3/objects/contacts"
    )

    def __init__(self, **data: Any):
        super().__init__(**data)

        if any(
            [
                self.HUBSPOT_EMAIL_TOKEN,
                self.HUBSPOT_CONTACT_TOKEN,
                self.HUBSPOT_SERVICE_TOKEN,
            ]
        ):
            self.HUBSPOT = True

        if not self.HUBSPOT:
            self.HUBSPOT_EMAIL_TOKEN = None
            self.HUBSPOT_CONTACT_TOKEN = None
            self.HUBSPOT_SERVICE_TOKEN = None
            self.HUBSPOT_BASE_URL = None
            self.HUBSPOT_CONTACTS_URL = None

    def get_hubspot_email_client(self) -> hubspot.Client:
        if not self.HUBSPOT:
            raise ValueError("Hubspot is disabled")
        return hubspot.Client.create(access_token=self.HUBSPOT_EMAIL_TOKEN)

    def get_hubspot_contact_client(self) -> hubspot.Client:
        if not self.HUBSPOT:
            raise ValueError("Hubspot is disabled")
        return hubspot.Client.create(access_token=self.HUBSPOT_CONTACT_TOKEN)


class JiraSettings(BaseModel):
    JIRA_BASE_URL: str | None = None
    JIRA_USER_EMAIL: str | None = None
    JIRA_API_TOKEN: str | None = None
    JIRA_SERVICE_DESK_ID: str | None = None
    JIRA_DEFAULT_REQUEST_TYPE_ID: str | None = None
    JIRA_REQUEST_TYPE_MAPPING: dict[str, str] = Field(default_factory=dict)

    def get_jira_auth(self) -> tuple[str, str]:
        if not self.JIRA_USER_EMAIL or not self.JIRA_API_TOKEN:
            raise ValueError("Jira credentials not fully configured")
        return (self.JIRA_USER_EMAIL, self.JIRA_API_TOKEN)


class FeedbackSettings(BaseModel):
    FEEDBACK_PROVIDER: Literal["hubspot", "jira"] = "hubspot"


class PrometheusSettings(BaseModel):
    PROMETHEUS: bool | None = False


class ProSettings(BaseModel):
    INVITE_EXPIRATION: timedelta = timedelta(weeks=52)
    PRO_DEVELOPER_MAPPING: UUID = UUID("22222222-2222-2222-2222-222222222222")
    PRO_TRIAL_MAPPING: UUID = UUID("11111111-1111-1111-1111-111111111111")
    PRO_TRIAL_USER: UUID = UUID("11111111-1111-1111-1111-111111111111")
    PRO_TRIAL_EMAIL: EmailStr = "colin.delahunty+registertrial@openbb.finance"
    ON_PREM_ADMIN_MAPPING: UUID | None = None
    PROURL: str

    def __init__(self, **data: Any):
        super().__init__(**data)

        if not (create_user := Path.cwd() / "user_create.json").exists():
            return

        with suppress(Exception):
            json_data = json.loads(create_user.read_text())
            self.PRO_DEVELOPER_MAPPING = UUID(json_data["permissions_uuid"])
            self.PRO_TRIAL_USER = UUID(json_data["inviting_uuid"])
            self.PRO_TRIAL_EMAIL = json_data["inviting_email"]
            self.ON_PREM_ADMIN_MAPPING = UUID(json_data["on_prem_admin_uuid"])


class GeneralSettings(BaseModel):
    JWT_SECRET: str = os.environ.get("JOSESECRET", None)
    SNOWFLAKE_ACCOUNT: str = os.environ.get("SNOWFLAKE_ACCOUNT", "")
    SNOWFLAKE_HOST: str = os.environ.get("SNOWFLAKE_HOST", "")
    IS_WORKER_CONTAINER: bool = False
    DISABLE_REGISTRATION: bool = False

    FRONTENDURL: str = "https://my.openbb.co"
    SELFURL: str
    MODE: Literal["production", "local", "test", "onprem", "lite"]
    EMAIL_PROVIDER: str = "mailchimp"  # "hubspot" or "mailchimp"
    OPENBB_FRONTEND_USER_AGENT: str = "colinlovedrust"
    OKTA_DOMAIN: str | None = None
    # These are characters that cannot be in our url
    UNUSABLE_JSON_CHARACTERS: set[str] = {"?"}
    # Users made before this date are bot users
    HUB_RELEASE_DATE: datetime = datetime(2023, 4, 25)
    MAX_DICT_LEN: int = 100_000
    WORKERS: int = 3
    # Per-worker address-space cap in GiB (RLIMIT_AS, applied in run.py).
    # None = auto: 75% of the container's cgroup memory limit. 0 = disabled.
    WORKER_ADDRESS_SPACE_LIMIT_GB: float | None = None
    PORT: int = 8000
    LOGURU_COLORIZE: bool = True
    JSON_LOGS: bool = False
    LOG_LEVEL: str = "INFO"
    RQ_TIMEOUT: int = 10
    DISABLE_CORS: bool = False
    CLEAR_UNCONFIRMED_FILES_DATE: str = "2024-10-07"
    OPENBB_AUTH_TOKEN: str | None = None
    BACKEND_CORS_ORIGINS: list[str] | str = [
        "http://10.5.2.231:5173",
        "https://pro.openbb.co",
        "https://pro.openbb.dev",
        "https://openbb-excel-add-in.vercel.app",
        "https://excel.openbb.co",
        "https://excel.openbb.dev",
        "https://admin.openbb.co",
        "https://admin.openbb.dev",
        "https://bofa.openbb.dev",
    ]
    SPECIAL_EMAILS: set[EmailStr] = {
        "colin99delahunty@gmail.com",
        "colindelahunty@openbb.finance",
        "andrewkenreich@gmail.com",
        "andrewkenreich@openbb.co",
        "andrewkenreich@openbb.finance",
        "juanalfonso@openbb.co",
        "juanalfonso@openbb.finance",
        "jamesmaslek@openbb.co",
        "jamesmaslek@openbb.finance",
    }
    SUPPRESSED_API_ROUTERS: list[str] | None = Field(default_factory=list)
    SUPPRESSED_API_ROUTES: list[str] | None = Field(default_factory=list)
    STORAGE_PROVIDER: Literal["aws", "azure", "gcp", "folder"] = "aws"
    ALLOWED_MCP_HOSTNAMES: list[str] = Field(default_factory=list)
    STRIPE_WEBHOOK_SECRET: str | None = None
    STRIPE_WEBHOOK_TOLERANCE_SECONDS: int = 300
    # Private provisioning lambda invoked via the AWS SDK; authorized by the
    # pod's IAM role. Set empty to skip provisioning + install email.
    LITE_LAMBDA_FUNCTION_NAME: str = "dev-lite-onboarding"
    # Docker tag customers pull (e.g. "0.3.1"). Bump per release; rendered into
    # the install email so the `docker pull / run` commands stay current.
    # This is ignored for now - I made it "latest" by default
    OPENBB_LITE_DOCKER_TAG: str = "0.0.3"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]

        if isinstance(v, str):
            return json.loads(v)
        return v

    @staticmethod
    def get_snowflake_email(user: str, subdomain: str) -> str:
        # If user is already an email address (federated identity), use it directly
        if "@" in user:
            return user

        host_parts = subdomain.split("-")
        account = "-".join(host_parts[1:])

        return f"{user}@{account}.snowflakecomputing.app"

    def is_test(self) -> bool:
        return self.MODE == "test"

    def is_prod(self) -> bool:
        return self.MODE in {"production", "onprem", "lite"}

    def is_onprem(self) -> bool:
        return self.MODE == "onprem"

    def is_lite(self) -> bool:
        return self.MODE == "lite"

    def set_is_worker(self, is_worker: bool) -> None:
        self.IS_WORKER_CONTAINER = is_worker


class Settings(
    BaseSettings,
    AccessSettings,
    GeneralSettings,
    ProSettings,
    DatabaseSettings,
    RedisSettings,
    AWSSettings,
    AzureSettings,
    LocalStorageSettings,
    HubspotSettings,
    JiraSettings,
    FeedbackSettings,
    MailChimpSettings,
    PrometheusSettings,
):
    model_config = SettingsConfigDict(
        env_file=create_path("envs", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def get_file_bucket(self) -> str:
        if self.STORAGE_PROVIDER == "aws":
            return self.S3_FILE_BUCKET

        if self.STORAGE_PROVIDER == "azure":
            return self.AZURE_STORAGE_CONTAINER

        if self.STORAGE_PROVIDER == "folder":
            return "local_storage"

        return "pro-file-storage-dev"

    def setup_logging(self):
        """Set up logging for the application."""
        from .log_helpers import setup_logging  # noqa: F401, PLC0415

        setup_logging(self)

    def is_https_deployment(self) -> bool:
        """Determine if the current deployment is an HTTPS deployment."""
        return self.SELFURL.startswith("https://")


settings = Settings()  # type: ignore[call-arg]
