import contextlib
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api import auth_helpers, base, models
from api.database import aget_write_db
from utilities.config import settings

from .auth import (
    WORKSPACE_MCP_TOKEN_TYPE,
    display_token_prefix,
    generate_workspace_mcp_token,
    hash_workspace_mcp_token,
)
from .bridge import BridgeSessionManager, BrowserUnavailableError
from .schemas import (
    BridgeError,
    BrowserSessionStartRequest,
    BrowserSessionStartResponse,
    ErrorEvent,
    SessionReadyEvent,
    TokenCreateRequest,
    TokenCreateResponse,
    TokenMetadata,
)

router = APIRouter(tags=["workspace-mcp"])
bridge_manager = BridgeSessionManager(
    redis_client=(
        settings.get_async_redis_session("pro") if not settings.is_test() else None
    )
)


@router.get(
    "/pro/workspace-mcp/tokens",
    response_model=list[TokenMetadata],
    dependencies=[Depends(auth_helpers.check_openbb)],
)
async def list_tokens(
    user: Annotated[
        auth_helpers.CustomRow, Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True))
    ],
    db: Annotated[AsyncSession, Depends(aget_write_db)],
):
    result = await db.execute(
        select(models.PersonalAccessToken)
        .where(
            models.PersonalAccessToken.user_uuid == user.uuid,
            models.PersonalAccessToken.token_type == WORKSPACE_MCP_TOKEN_TYPE,
            models.PersonalAccessToken.revoked_at.is_(None),
        )
        .order_by(models.PersonalAccessToken.created_date.desc())
    )
    return result.scalars().all()


@router.post(
    "/pro/workspace-mcp/tokens",
    response_model=TokenCreateResponse,
    dependencies=[Depends(auth_helpers.check_openbb)],
)
async def create_token(
    request: TokenCreateRequest,
    user: Annotated[
        auth_helpers.CustomRow, Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True))
    ],
    db: Annotated[AsyncSession, Depends(aget_write_db)],
):
    raw_token = generate_workspace_mcp_token()
    personal_access_token = models.PersonalAccessToken(
        user_uuid=user.uuid,
        name=request.name,
        token_type=WORKSPACE_MCP_TOKEN_TYPE,
        token_hash=hash_workspace_mcp_token(raw_token),
        token_prefix=display_token_prefix(raw_token),
    )
    db.add(personal_access_token)
    await db.commit()
    await db.refresh(personal_access_token)
    return TokenCreateResponse(
        uuid=personal_access_token.uuid,
        name=personal_access_token.name,
        token_type=personal_access_token.token_type,
        token_prefix=personal_access_token.token_prefix,
        created_date=personal_access_token.created_date,
        updated_date=personal_access_token.updated_date,
        last_used_at=personal_access_token.last_used_at,
        token=raw_token,
    )


@router.delete(
    "/pro/workspace-mcp/tokens/{token_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(auth_helpers.check_openbb)],
)
async def revoke_token(
    token_uuid: UUID,
    user: Annotated[
        auth_helpers.CustomRow, Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True))
    ],
    db: Annotated[AsyncSession, Depends(aget_write_db)],
):
    result = await db.execute(
        select(models.PersonalAccessToken).where(
            models.PersonalAccessToken.uuid == token_uuid,
            models.PersonalAccessToken.user_uuid == user.uuid,
            models.PersonalAccessToken.token_type == WORKSPACE_MCP_TOKEN_TYPE,
            models.PersonalAccessToken.revoked_at.is_(None),
        )
    )
    personal_access_token = result.scalar_one_or_none()
    if personal_access_token is not None:
        personal_access_token.revoked_at = base.get_now()
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/pro/workspace-mcp/bridge/session/start",
    response_model=BrowserSessionStartResponse,
    dependencies=[Depends(auth_helpers.check_openbb)],
)
async def start_bridge_session(
    payload: BrowserSessionStartRequest,
    request: Request,
    user: Annotated[
        auth_helpers.CustomRow, Depends(auth_helpers.GetCurrentUser(["uuid"], pro=True))
    ],
):
    # Behind a reverse proxy that strips a path prefix (nginx rewrites /api/* ->
    # /*), request.base_url loses that prefix, so the websocket_url we build from
    # it would not route back through the proxy. Re-add the prefix the proxy
    # advertises via X-Forwarded-Prefix.
    prefix = request.headers.get("x-forwarded-prefix", "").rstrip("/")
    base_url = str(request.base_url).rstrip("/") + prefix + "/"

    if settings.is_https_deployment() and not base_url.startswith("https://"):
        base_url = base_url.replace("http://", "https://")

    return await bridge_manager.start_session(
        user_uuid=user.uuid, request=payload, base_url=base_url
    )


@router.websocket("/pro/workspace-mcp/bridge/ws")
async def bridge_websocket(websocket: WebSocket):
    await websocket.accept()
    session_id = websocket.query_params.get("session_id", "")
    token = websocket.query_params.get("token", "")

    try:
        user_uuid, session = await bridge_manager.connect_browser(
            session_id=session_id,
            token=token,
            socket=websocket,
        )
    except BrowserUnavailableError as error:
        await websocket.send_json(
            ErrorEvent(
                type="error",
                error=BridgeError(code="unauthorized", message=str(error)),
            ).model_dump(mode="json")
        )
        await websocket.close(code=1008)
        return

    await websocket.send_json(
        SessionReadyEvent(type="session_ready", session=session).model_dump(mode="json")
    )

    try:
        while True:
            message = await websocket.receive_json()
            await bridge_manager.handle_browser_message(user_uuid, message)
    except WebSocketDisconnect:
        pass
    finally:
        await bridge_manager.disconnect_browser(user_uuid, session.session_id)
        with contextlib.suppress(RuntimeError):
            await websocket.close()
