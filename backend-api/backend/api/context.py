from contextvars import ContextVar
from uuid import UUID

session_token_ctx: ContextVar[UUID | None] = ContextVar("session_token", default=None)
