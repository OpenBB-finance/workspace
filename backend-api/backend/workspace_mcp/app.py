"""ASGI application for the Workspace MCP sidecar."""

import contextlib

from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route, WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect

from workspace_mcp.config import Settings
from workspace_mcp.models import (
    BridgeError,
    BrowserSessionStartRequest,
    ErrorEvent,
    SessionReadyEvent,
)
from workspace_mcp.server import create_mcp_server
from workspace_mcp.state import BridgeSessionManager, BrowserUnavailableError

LOCALHOST_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
DEFAULT_CORS_ALLOW_ORIGINS = ("https://pro.openbb.co",)


def create_app(settings: Settings | None = None) -> Starlette:
    """Create the ASGI application hosting MCP and browser bridge endpoints."""
    settings = settings or Settings.from_env()
    state = BridgeSessionManager(
        base_url=settings.base_url,
        websocket_path=settings.websocket_path,
        command_timeout_seconds=settings.command_timeout_seconds,
    )
    mcp = create_mcp_server(state)
    app = mcp.http_app(
        path=settings.mcp_path,
        transport="streamable-http",
        stateless_http=True,
    )
    if settings.cors_allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_allow_origins),
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(DEFAULT_CORS_ALLOW_ORIGINS),
            allow_origin_regex=LOCALHOST_ORIGIN_REGEX,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
        )

    async def health(_: Request) -> Response:
        return JSONResponse(await state.health())

    async def start_session(request: Request) -> Response:
        payload = BrowserSessionStartRequest.model_validate(await request.json())
        session = await state.start_session(payload)
        return JSONResponse(session.model_dump(mode="json"))

    async def bridge_socket(websocket: WebSocket) -> None:
        await websocket.accept()
        session_id = websocket.query_params.get("session_id", "")
        token = websocket.query_params.get("token", "")

        try:
            session = await state.connect_browser(
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
            SessionReadyEvent(type="session_ready", session=session).model_dump(
                mode="json"
            )
        )

        try:
            while True:
                message = await websocket.receive_json()
                await state.handle_browser_message(message)
        except WebSocketDisconnect:
            pass
        finally:
            await state.disconnect_browser(session_id=session_id)
            with contextlib.suppress(RuntimeError):
                await websocket.close()

    app.routes.extend(
        [
            Route(settings.health_path, health, methods=["GET"]),
            Route(settings.session_start_path, start_session, methods=["POST"]),
            WebSocketRoute(settings.websocket_path, bridge_socket),
        ]
    )
    return app
