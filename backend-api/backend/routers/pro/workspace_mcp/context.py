from contextvars import ContextVar, Token
from uuid import UUID

_current_user_uuid: ContextVar[UUID | None] = ContextVar(
    "workspace_mcp_user_uuid",
    default=None,
)


def get_current_user_uuid() -> UUID:
    user_uuid = _current_user_uuid.get()
    if user_uuid is None:
        raise RuntimeError("Workspace MCP user context is not set.")
    return user_uuid


def set_current_user_uuid(user_uuid: UUID) -> Token[UUID | None]:
    return _current_user_uuid.set(user_uuid)


def reset_current_user_uuid(token: Token[UUID | None]) -> None:
    _current_user_uuid.reset(token)
