"""Request-scoped browser bridge runtime for the Workspace MCP sidecar."""

import asyncio
from dataclasses import dataclass
from typing import Any, Protocol
from uuid import uuid4

from pydantic import ValidationError

from workspace_mcp.models import (
    BridgeError,
    BridgeErrorCode,
    BrowserSession,
    BrowserSessionContext,
    BrowserSessionStartRequest,
    BrowserSessionStartResponse,
    CommandRequestEvent,
    PongEvent,
    WorkspaceCommand,
    WorkspaceCommandResult,
    WorkspaceSnapshot,
    browser_message_adapter,
    new_request_id,
    workspace_command_adapter,
)


class BrowserSocket(Protocol):
    """Minimal websocket interface needed by the state manager."""

    async def send_json(self, data: object) -> None:
        """Send one JSON message to the connected browser."""


class BrowserUnavailableError(RuntimeError):
    """Raised when the sidecar cannot reach the Workspace browser."""


@dataclass(slots=True)
class PendingCommand:
    """One command waiting for the browser to reply."""

    command_name: str
    future: asyncio.Future[WorkspaceCommandResult]
    timeout_handle: asyncio.TimerHandle


@dataclass(slots=True)
class ConnectedBrowser:
    """Active browser connection metadata."""

    session: BrowserSession
    socket: BrowserSocket | None = None


class BridgeSessionManager:
    """Coordinate browser sessions and in-flight bridge requests."""

    def __init__(
        self,
        *,
        base_url: str,
        websocket_path: str,
        command_timeout_seconds: float,
    ):
        self._base_url = base_url
        self._websocket_path = websocket_path
        self._command_timeout_seconds = command_timeout_seconds
        self._browser: ConnectedBrowser | None = None
        self._pending_commands: dict[str, PendingCommand] = {}
        self._lock = asyncio.Lock()

    async def start_session(
        self, request: BrowserSessionStartRequest
    ) -> BrowserSessionStartResponse:
        """Create the next browser session and replace any previous one."""
        async with self._lock:
            session = BrowserSession(
                session_id=str(uuid4()),
                token=str(uuid4()),
                client_name=request.client_name,
                current_dashboard_id=request.current_dashboard_id,
                current_tab_id=request.current_tab_id,
            )
            self._browser = ConnectedBrowser(session=session)
            self._fail_pending_commands(
                self._error(
                    code="unavailable",
                    message="Browser session was replaced by a new bootstrap request.",
                )
            )
            return BrowserSessionStartResponse(
                session=session,
                websocket_url=(
                    f"{self._base_url.replace('http', 'ws', 1)}"
                    f"{self._websocket_path}?session_id={session.session_id}&token={session.token}"
                ),
            )

    async def connect_browser(
        self,
        *,
        session_id: str,
        token: str,
        socket: BrowserSocket,
    ) -> BrowserSession:
        """Attach the websocket for the currently bootstrapped browser session."""
        async with self._lock:
            browser = self._require_session()
            if browser.session.session_id != session_id or browser.session.token != token:
                raise BrowserUnavailableError("Invalid browser session credentials.")
            browser.socket = socket
            return browser.session

    async def disconnect_browser(self, *, session_id: str | None = None) -> None:
        """Detach the current browser websocket and fail pending commands."""
        async with self._lock:
            browser = self._browser
            if browser is None:
                return
            if session_id and browser.session.session_id != session_id:
                return
            browser.socket = None
            self._fail_pending_commands(
                self._error(
                    code="unavailable",
                    message="Workspace browser disconnected from the sidecar.",
                )
            )

    async def handle_browser_message(self, raw_message: dict[str, Any]) -> None:
        """Apply one browser websocket message to the sidecar state."""
        try:
            payload = browser_message_adapter.validate_python(raw_message)
        except ValidationError as error:
            async with self._lock:
                self._require_session()
                self._fail_pending_commands(
                    self._error(
                        code="invalid_request",
                        message=(
                            "Workspace browser sent an invalid websocket payload. "
                            "This can happen when the connected browser build does "
                            "not implement the requested bridge command."
                        ),
                        details={"errors": error.errors()},
                    )
                )
            return

        async with self._lock:
            self._require_session()

            if payload.type == "command_result":
                request_id = payload.result.request_id
                if request_id and request_id in self._pending_commands:
                    pending = self._pending_commands.pop(request_id)
                    pending.timeout_handle.cancel()
                    pending.future.set_result(payload.result)
                return

            if payload.type == "ping":
                browser = self._require_session()
                if browser.socket is not None:
                    await browser.socket.send_json(
                        PongEvent(type="pong").model_dump(mode="json")
                    )
                return

            if payload.type == "session_context_changed":
                browser = self._require_session()
                browser.session = browser.session.model_copy(
                    update={
                        "current_dashboard_id": payload.session.current_dashboard_id,
                        "current_tab_id": payload.session.current_tab_id,
                    }
                )
                return

            return

    async def execute_command(
        self, command: WorkspaceCommand | dict[str, Any]
    ) -> WorkspaceCommandResult:
        """Forward a command to the browser and wait for the structured result."""
        command = workspace_command_adapter.validate_python(command)

        async with self._lock:
            browser = self._require_browser()
            if browser.socket is None:
                raise BrowserUnavailableError("No active Workspace browser connected.")
            request_id = command.request_id or new_request_id()
            command = command.model_copy(update={"request_id": request_id})
            loop = asyncio.get_running_loop()
            future: asyncio.Future[WorkspaceCommandResult] = loop.create_future()
            timeout_handle = loop.call_later(
                self._command_timeout_seconds,
                self._expire_command,
                request_id,
            )
            self._pending_commands[request_id] = PendingCommand(
                command_name=command.command,
                future=future,
                timeout_handle=timeout_handle,
            )
            await browser.socket.send_json(
                CommandRequestEvent(type="command_request", command=command).model_dump(
                    mode="json"
                )
            )

        result = await future
        return await self._normalize_result(command_name=command.command, result=result)

    async def health(self) -> dict[str, object]:
        """Return a compact sidecar health snapshot."""
        async with self._lock:
            browser = self._browser
            return {
                "ok": True,
                "browser_connected": bool(browser and browser.socket),
                "pending_commands": len(self._pending_commands),
                "session": (
                    browser.session.model_dump(
                        mode="json", exclude={"token"}, exclude_none=True
                    )
                    if browser
                    else None
                ),
            }

    def get_session_context(self) -> BrowserSessionContext | None:
        """Return the currently tracked dashboard and tab context, if any."""
        browser = self._browser
        if browser is None:
            return None
        return BrowserSessionContext(
            current_dashboard_id=browser.session.current_dashboard_id,
            current_tab_id=browser.session.current_tab_id,
        )

    def _expire_command(self, request_id: str) -> None:
        pending = self._pending_commands.pop(request_id, None)
        if pending is None or pending.future.done():
            return
        pending.future.set_result(
            self._result_error(
                command=pending.command_name,
                request_id=request_id,
                code="timeout",
                message=(
                    "Workspace command timed out waiting for the browser. "
                    "If retries keep timing out, verify identifiers exist via "
                    "get_workspace_snapshot."
                ),
                retryable=True,
            )
        )

    def _fail_pending_commands(self, error: BridgeError) -> None:
        for request_id, pending in list(self._pending_commands.items()):
            self._pending_commands.pop(request_id, None)
            pending.timeout_handle.cancel()
            if pending.future.done():
                continue
            pending.future.set_result(
                self._result_error(
                    command=pending.command_name,
                    request_id=request_id,
                    code=error.code,
                    message=error.message,
                    details=error.details,
                    retryable=error.retryable,
                )
            )

    def _require_session(self) -> ConnectedBrowser:
        if self._browser is None:
            raise BrowserUnavailableError("No browser session has been started.")
        return self._browser

    def _require_browser(self) -> ConnectedBrowser:
        browser = self._require_session()
        if browser.socket is None:
            raise BrowserUnavailableError("No Workspace browser is connected.")
        return browser

    async def _normalize_result(
        self, *, command_name: str, result: WorkspaceCommandResult
    ) -> WorkspaceCommandResult:
        if command_name == "get_workspace_snapshot" and result.ok:
            try:
                snapshot = WorkspaceSnapshot.model_validate(result.data)
            except ValidationError as error:
                return self._result_error(
                    command=command_name,
                    request_id=result.request_id,
                    code="invalid_request",
                    message="Browser returned an invalid workspace snapshot payload.",
                    details={"errors": error.errors()},
                )
            result = result.model_copy(
                update={
                    "data": snapshot.model_dump(
                        mode="json", exclude_defaults=True, exclude_none=True
                    )
                }
            )

        return self._inject_session_context(result)

    def _inject_session_context(
        self, result: WorkspaceCommandResult
    ) -> WorkspaceCommandResult:
        """Annotate every successful command result with the tracked session context.

        Saves callers a follow-up get_workspace_snapshot before any safe write.
        For commands that just navigated (manage_dashboard create activate=true,
        navigate_workspace dashboard), the explicit dashboard_id in the same
        response is authoritative — session_context may lag by one round-trip
        until the browser fires session_context_changed.
        """
        if not result.ok or not isinstance(result.data, dict):
            return result
        if "session_context" in result.data:
            return result
        ctx = self.get_session_context()
        if ctx is None:
            return result
        ctx_payload = {
            "current_dashboard_uuid": ctx.current_dashboard_id,
            "current_tab_id": ctx.current_tab_id
        }
        return result.model_copy(
            update={"data": {**result.data, "session_context": ctx_payload}}
        )

    @staticmethod
    def _error(
        *,
        code: BridgeErrorCode,
        message: str,
        details: dict[str, Any] | None = None,
        retryable: bool = False,
    ) -> BridgeError:
        return BridgeError(
            code=code,
            message=message,
            details=details,
            retryable=retryable,
        )

    @classmethod
    def _result_error(
        cls,
        *,
        command: str,
        request_id: str | None,
        code: BridgeErrorCode,
        message: str,
        details: dict[str, Any] | None = None,
        retryable: bool = False,
    ) -> WorkspaceCommandResult:
        return WorkspaceCommandResult(
            ok=False,
            command=command,
            request_id=request_id,
            message=message,
            error=cls._error(
                code=code,
                message=message,
                details=details,
                retryable=retryable,
            ),
        )
