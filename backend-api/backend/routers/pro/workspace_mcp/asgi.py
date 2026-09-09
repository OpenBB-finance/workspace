from collections.abc import Awaitable, Callable

from fastapi import HTTPException
from fastapi.security.utils import get_authorization_scheme_param
from fastmcp.server.middleware import Middleware, MiddlewareContext
from starlette.types import Lifespan, Receive, Scope, Send

from api import database
from workspace_mcp.server import create_mcp_server

from .auth import validate_workspace_mcp_token
from .bridge_state import WorkspaceMCPBridgeState
from .context import reset_current_user_uuid, set_current_user_uuid
from .router import bridge_manager

ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]
REJECT_HTTP_EXCEPTION = HTTPException(
    status_code=401, detail="Could not validate Workspace MCP credentials"
)


class WorkspaceMCPAuthMiddleware(Middleware):
    @classmethod
    async def on_request(self, context: MiddlewareContext, call_next):
        from fastmcp.server.dependencies import get_http_request  # noqa: PLC0415

        request = get_http_request()
        path = request.url.path

        # The MCP app is mounted at the root path (""), so it receives every
        # request that no router claimed. Only gate the MCP endpoint itself;
        # other unmatched paths must fall through to a normal 404 instead of
        # the credential error.
        if request.scope["type"] != "http" or path != "/mcp":
            return await call_next(context)

        scheme, token = get_authorization_scheme_param(
            request.headers.get("authorization")
        )

        if scheme.lower() != "bearer" or not token:
            raise REJECT_HTTP_EXCEPTION

        async with database.AsyncWriteSessionLocal.session() as db:
            try:
                user_uuid = await validate_workspace_mcp_token(db, token)
            except HTTPException:
                raise REJECT_HTTP_EXCEPTION

        context_token = set_current_user_uuid(user_uuid)
        try:
            return await call_next(context)
        finally:
            reset_current_user_uuid(context_token)


def create_workspace_mcp_server(lifespan: Lifespan | None = None):
    return create_mcp_server(WorkspaceMCPBridgeState(bridge_manager), lifespan)


def create_workspace_mcp_asgi_app(lifespan: Lifespan | None = None):
    mcp = create_workspace_mcp_server(lifespan)
    mcp.add_middleware(WorkspaceMCPAuthMiddleware())
    app = mcp.http_app(
        path="/mcp",
        transport="streamable-http",
        stateless_http=True,
    )

    return app
