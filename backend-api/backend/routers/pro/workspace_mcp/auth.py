import hashlib
import secrets
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security.utils import get_authorization_scheme_param
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api import base, models
from api.database import aget_write_db

WORKSPACE_MCP_TOKEN_TYPE = "workspace_mcp"  # noqa: S105
WORKSPACE_MCP_TOKEN_PREFIX = "obb_mcp_"  # noqa: S105
DISPLAY_TOKEN_PREFIX_LENGTH = 20

workspace_mcp_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate Workspace MCP credentials",
)


def generate_workspace_mcp_token() -> str:
    return f"{WORKSPACE_MCP_TOKEN_PREFIX}{secrets.token_urlsafe(32)}"


def hash_workspace_mcp_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def display_token_prefix(token: str) -> str:
    return token[:DISPLAY_TOKEN_PREFIX_LENGTH]


async def get_workspace_mcp_token_user_uuid(
    request: Request,
    db: Annotated[AsyncSession, Depends(aget_write_db)],
) -> UUID:
    scheme, token = get_authorization_scheme_param(request.headers.get("Authorization"))
    if scheme.lower() != "bearer" or not token:
        raise workspace_mcp_credentials_exception

    return await validate_workspace_mcp_token(db, token)


async def validate_workspace_mcp_token(db: AsyncSession, token: str) -> UUID:
    token_hash = hash_workspace_mcp_token(token)
    result = await db.execute(
        select(models.PersonalAccessToken).where(
            models.PersonalAccessToken.token_hash == token_hash,
            models.PersonalAccessToken.token_type == WORKSPACE_MCP_TOKEN_TYPE,
            models.PersonalAccessToken.revoked_at.is_(None),
        )
    )
    personal_access_token = result.scalar_one_or_none()
    if personal_access_token is None:
        raise workspace_mcp_credentials_exception

    personal_access_token.last_used_at = base.get_now()
    await db.commit()
    return personal_access_token.user_uuid
