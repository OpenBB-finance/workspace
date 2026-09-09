from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter


class Model(BaseModel):
    model_config = ConfigDict(
        extra="forbid", from_attributes=True, populate_by_name=True
    )


class TokenCreateRequest(Model):
    name: str = Field(min_length=1, max_length=100)


class TokenMetadata(Model):
    uuid: UUID
    name: str
    token_type: str
    token_prefix: str
    created_date: Any | None = None
    updated_date: Any | None = None
    last_used_at: Any | None = None


class TokenCreateResponse(TokenMetadata):
    token: str


class BrowserSessionStartRequest(Model):
    client_name: str = "workspace-ui"
    current_dashboard_id: str | None = None
    current_tab_id: str | None = None


class BrowserSessionContext(Model):
    current_dashboard_id: str | None = None
    current_tab_id: str | None = None


class BrowserSession(Model):
    session_id: str
    token: str
    client_name: str
    current_dashboard_id: str | None = None
    current_tab_id: str | None = None


class BrowserSessionStartResponse(Model):
    session: BrowserSession
    websocket_url: str


class BridgeError(Model):
    code: Literal[
        "invalid_request",
        "unauthorized",
        "unavailable",
        "timeout",
        "command_failed",
        "unknown",
    ]
    message: str
    details: dict[str, Any] | None = None
    retryable: bool = False


class WorkspaceCommandResult(Model):
    ok: bool
    command: str
    request_id: str | None = None
    message: str
    data: Any | None = None
    error: BridgeError | None = None


class BrowserCommandResultMessage(Model):
    type: Literal["command_result"]
    result: WorkspaceCommandResult


class BrowserPing(Model):
    type: Literal["ping"]


class BrowserSessionContextChangedMessage(Model):
    type: Literal["session_context_changed"]
    session: BrowserSessionContext


BrowserMessage = Annotated[
    BrowserCommandResultMessage | BrowserPing | BrowserSessionContextChangedMessage,
    Field(discriminator="type"),
]


class SessionReadyEvent(Model):
    type: Literal["session_ready"]
    session: BrowserSession


class CommandRequestEvent(Model):
    type: Literal["command_request"]
    command: dict[str, Any]


class ErrorEvent(Model):
    type: Literal["error"]
    error: BridgeError


class PongEvent(Model):
    type: Literal["pong"]


browser_message_adapter: TypeAdapter[BrowserMessage] = TypeAdapter(BrowserMessage)
