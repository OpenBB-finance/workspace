import asyncio
import contextlib
import json
import os
import uuid
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Protocol
from uuid import UUID

from loguru import logger
from redis.asyncio import Redis as AsyncRedis

from .schemas import (
    BridgeError,
    BrowserSession,
    BrowserSessionStartRequest,
    BrowserSessionStartResponse,
    CommandRequestEvent,
    PongEvent,
    WorkspaceCommandResult,
    browser_message_adapter,
)

COMMAND_TIMEOUT_SECONDS = 30.0
PRESENCE_TTL_SECONDS = 45
SESSION_TTL_SECONDS = 300
COMPLETED_RESULTS_MAX = 2048


class BrowserSocket(Protocol):
    async def send_json(self, data: object) -> None:
        pass

    async def close(self, code: int = 1000) -> None:
        pass


class BrowserUnavailableError(RuntimeError):
    pass


@dataclass(slots=True)
class ConnectedBrowser:
    user_uuid: UUID
    session: BrowserSession
    socket: BrowserSocket | None = None


@dataclass(slots=True)
class PendingCommand:
    future: asyncio.Future[dict[str, Any]]
    timeout_handle: asyncio.TimerHandle
    user_uuid: UUID


class BridgeSessionManager:
    def __init__(
        self,
        *,
        redis_client: AsyncRedis,
        worker_id: str | None = None,
        command_timeout_seconds: float = COMMAND_TIMEOUT_SECONDS,
        completed_results_max: int = COMPLETED_RESULTS_MAX,
    ):
        self.redis = redis_client
        self.worker_id = worker_id or uuid.uuid4().hex
        self.command_timeout_seconds = command_timeout_seconds
        self._completed_results_max = completed_results_max
        self._sessions_by_id: dict[str, tuple[UUID, BrowserSession]] = {}
        self._active_by_user: dict[UUID, ConnectedBrowser] = {}
        self._pending_commands: dict[str, PendingCommand] = {}
        self._completed_results: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._listener_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    async def ensure_started(self) -> None:
        if self.redis is None or self._listener_task is not None:
            return
        # router.py constructs this manager at import time, which under gunicorn happens in the
        # master before fork — so every worker would inherit the SAME worker_id and subscribe to
        # one shared command channel, fanning every cross-worker command out to all workers.
        # Pin the id to the real (post-fork) pid here, where we first run inside the worker's loop.
        self.worker_id = f"{self.worker_id}-{os.getpid()}"
        self._listener_task = asyncio.create_task(self._listen_for_worker_commands())

    async def start_session(
        self,
        *,
        user_uuid: UUID,
        request: BrowserSessionStartRequest,
        base_url: str,
    ) -> BrowserSessionStartResponse:
        await self.ensure_started()
        async with self._lock:
            existing = self._active_by_user.pop(user_uuid, None)
            if existing is not None:
                existing.socket = None

            session = BrowserSession(
                session_id=str(uuid.uuid4()),
                token=str(uuid.uuid4()),
                client_name=request.client_name,
                current_dashboard_id=request.current_dashboard_id,
                current_tab_id=request.current_tab_id,
            )
            self._sessions_by_id[session.session_id] = (user_uuid, session)
            await self._write_session(user_uuid, session)
            websocket_base = (
                base_url.replace("http://", "ws://", 1)
                .replace(
                    "https://",
                    "wss://",
                    1,
                )
                .rstrip("/")
            )
            websocket_url = (
                f"{websocket_base}/pro/workspace-mcp/bridge/ws"
                f"?session_id={session.session_id}&token={session.token}"
            )
            return BrowserSessionStartResponse(
                session=session, websocket_url=websocket_url
            )

    async def connect_browser(
        self,
        *,
        session_id: str,
        token: str,
        socket: BrowserSocket,
    ) -> tuple[UUID, BrowserSession]:
        await self.ensure_started()
        async with self._lock:
            user_uuid, session = await self._get_session(session_id)
            active_session = await self._get_active_session(user_uuid)
            if session.token != token or active_session.session_id != session_id:
                raise BrowserUnavailableError("Invalid browser session credentials.")

            previous = self._active_by_user.get(user_uuid)
            if previous and previous.session.session_id != session_id:
                await self._close_socket(previous.socket)

            browser = ConnectedBrowser(
                user_uuid=user_uuid, session=session, socket=socket
            )
            self._active_by_user[user_uuid] = browser
            await self._write_presence(user_uuid, session)
            return user_uuid, session

    async def disconnect_browser(
        self, user_uuid: UUID, session_id: str | None = None
    ) -> None:
        async with self._lock:
            browser = self._active_by_user.get(user_uuid)
            if browser is None:
                return
            if session_id and browser.session.session_id != session_id:
                return
            browser.socket = None
            self._active_by_user.pop(user_uuid, None)
            self._fail_pending_commands("Workspace browser disconnected.", user_uuid)
            await self._delete_presence(user_uuid)

    async def handle_browser_message(
        self,
        user_uuid: UUID,
        raw_message: dict[str, Any],
    ) -> None:
        payload = browser_message_adapter.validate_python(raw_message)
        async with self._lock:
            browser = self._active_by_user.get(user_uuid)
            if browser is None:
                raise BrowserUnavailableError("No active Workspace browser connected")

            if payload.type == "command_result":
                request_id = payload.result.request_id
                if request_id and request_id in self._pending_commands:
                    pending = self._pending_commands.pop(request_id)
                    pending.timeout_handle.cancel()
                    result = payload.result.model_dump(mode="json")
                    self._store_completed_result(request_id, result)
                    pending.future.set_result(result)
                return

            if payload.type == "ping":
                await self._write_presence(user_uuid, browser.session)
                if browser.socket is not None:
                    await browser.socket.send_json(
                        PongEvent(type="pong").model_dump(mode="json")
                    )
                return

            if payload.type == "session_context_changed":
                browser.session = browser.session.model_copy(
                    update={
                        "current_dashboard_id": payload.session.current_dashboard_id,
                        "current_tab_id": payload.session.current_tab_id,
                    }
                )
                await self._write_session(user_uuid, browser.session)

    async def execute_command(
        self,
        user_uuid: UUID,
        command: dict[str, Any],
    ) -> dict[str, Any]:
        await self.ensure_started()
        async with self._lock:
            browser = self._active_by_user.get(user_uuid)

        if browser and browser.socket is not None:
            return await self._execute_local_command(browser, command)

        return await self.publish_command(user_uuid, command)

    async def publish_command(
        self,
        user_uuid: UUID,
        command: dict[str, Any],
    ) -> dict[str, Any]:
        if self.redis is None:
            raise BrowserUnavailableError("No active Workspace browser connected")

        presence = await self._get_presence(user_uuid)
        if presence is None:
            raise BrowserUnavailableError("No active Workspace browser connected")

        request_id = command.get("request_id") or f"cmd_{uuid.uuid4().hex}"
        command = {**command, "request_id": request_id}
        reply_channel = f"workspace_mcp:worker:{self.worker_id}:replies:{request_id}"
        envelope = {
            "user_uuid": str(user_uuid),
            "bridge_session_id": presence["bridge_session_id"],
            "request_id": request_id,
            "command": command,
            "reply_channel": reply_channel,
        }
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(reply_channel)
        try:
            await self.redis.publish(
                f"workspace_mcp:worker:{presence['worker_id']}:commands",
                json.dumps(envelope),
            )
            return await self._wait_for_reply(pubsub, request_id)
        finally:
            await pubsub.unsubscribe(reply_channel)
            await pubsub.aclose()

    async def publish_result(
        self,
        reply_channel: str,
        request_id: str,
        result: dict[str, Any],
    ) -> None:
        if self.redis is None:
            return
        await self.redis.publish(
            reply_channel,
            json.dumps({"request_id": request_id, "result": result}),
        )

    def get_session_context(
        self, user_uuid: UUID | None = None
    ) -> dict[str, Any] | None:
        if user_uuid is None:
            return None
        browser = self._active_by_user.get(user_uuid)
        if browser is None:
            return None
        return {
            "current_dashboard_id": browser.session.current_dashboard_id,
            "current_tab_id": browser.session.current_tab_id,
        }

    async def _execute_local_command(
        self,
        browser: ConnectedBrowser,
        command: dict[str, Any],
    ) -> dict[str, Any]:
        request_id = command.get("request_id") or f"cmd_{uuid.uuid4().hex}"
        if request_id in self._completed_results:
            return self._completed_results[request_id]
        if request_id in self._pending_commands:
            return await self._pending_commands[request_id].future

        command = {**command, "request_id": request_id}
        loop = asyncio.get_running_loop()
        future: asyncio.Future[dict[str, Any]] = loop.create_future()
        timeout_handle = loop.call_later(
            self.command_timeout_seconds,
            self._expire_command,
            request_id,
            command["command"],
        )
        self._pending_commands[request_id] = PendingCommand(
            future=future,
            timeout_handle=timeout_handle,
            user_uuid=browser.user_uuid,
        )
        if browser.socket is None:
            raise BrowserUnavailableError("No active Workspace browser connected")
        await browser.socket.send_json(
            CommandRequestEvent(type="command_request", command=command).model_dump(
                mode="json"
            )
        )
        return await future

    def _expire_command(self, request_id: str, command_name: str) -> None:
        pending = self._pending_commands.pop(request_id, None)
        if pending is None or pending.future.done():
            return
        result = WorkspaceCommandResult(
            ok=False,
            command=command_name,
            request_id=request_id,
            message="Workspace command timed out waiting for the browser.",
            error=BridgeError(
                code="timeout",
                message="Workspace command timed out waiting for the browser.",
                retryable=True,
            ),
        ).model_dump(mode="json")
        self._store_completed_result(request_id, result)
        pending.future.set_result(result)

    def _store_completed_result(self, request_id: str, result: dict[str, Any]) -> None:
        """Cache a command result for redelivery dedup, bounded to the most recent N."""
        self._completed_results[request_id] = result
        self._completed_results.move_to_end(request_id)
        while len(self._completed_results) > self._completed_results_max:
            self._completed_results.popitem(last=False)

    def _fail_pending_commands(self, message: str, user_uuid: UUID) -> None:
        for request_id, pending in list(self._pending_commands.items()):
            if pending.user_uuid != user_uuid:
                continue
            self._pending_commands.pop(request_id, None)
            pending.timeout_handle.cancel()
            if pending.future.done():
                continue
            pending.future.set_result(
                WorkspaceCommandResult(
                    ok=False,
                    command="unknown",
                    request_id=request_id,
                    message=message,
                    error=BridgeError(
                        code="unavailable", message=message, retryable=True
                    ),
                ).model_dump(mode="json")
            )

    async def _listen_for_worker_commands(self) -> None:
        pubsub = self.redis.pubsub()
        channel = f"workspace_mcp:worker:{self.worker_id}:commands"
        await pubsub.subscribe(channel)
        try:
            while True:
                await self._consume_worker_command(pubsub)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.exception(f"Workspace MCP Redis listener failed: {error}")
        finally:
            await pubsub.aclose()

    async def _consume_worker_command(self, pubsub: Any) -> None:
        message = await pubsub.get_message(timeout=1.0)
        if not message or message.get("type") != "message":
            return
        asyncio.create_task(self._handle_worker_command(message["data"]))

    async def _handle_worker_command(self, raw_data: bytes | str) -> None:
        envelope = json.loads(
            raw_data.decode("utf-8") if isinstance(raw_data, bytes) else raw_data
        )
        request_id = envelope["request_id"]
        reply_channel = envelope["reply_channel"]
        user_uuid = UUID(envelope["user_uuid"])
        try:
            async with self._lock:
                browser = self._active_by_user.get(user_uuid)
                if (
                    browser is None
                    or browser.session.session_id != envelope["bridge_session_id"]
                ):
                    raise BrowserUnavailableError(
                        "No active Workspace browser connected"
                    )
            result = await self._execute_local_command(browser, envelope["command"])
        except BrowserUnavailableError as error:
            result = WorkspaceCommandResult(
                ok=False,
                command=envelope.get("command", {}).get("command", "unknown"),
                request_id=request_id,
                message=str(error),
                error=BridgeError(
                    code="unavailable", message=str(error), retryable=True
                ),
            ).model_dump(mode="json")
        await self.publish_result(reply_channel, request_id, result)

    async def _wait_for_reply(self, pubsub: Any, request_id: str) -> dict[str, Any]:
        deadline = asyncio.get_running_loop().time() + self.command_timeout_seconds
        while asyncio.get_running_loop().time() < deadline:
            message = await pubsub.get_message(timeout=0.2)
            if not message or message.get("type") != "message":
                continue
            payload = json.loads(
                message["data"].decode("utf-8")
                if isinstance(message["data"], bytes)
                else message["data"]
            )
            if payload.get("request_id") == request_id:
                return payload["result"]
        raise BrowserUnavailableError(
            "Workspace command timed out waiting for the browser."
        )

    async def _get_session(self, session_id: str) -> tuple[UUID, BrowserSession]:
        if session_id in self._sessions_by_id:
            return self._sessions_by_id[session_id]
        if self.redis is None:
            raise BrowserUnavailableError("Invalid browser session credentials.")
        raw = await self.redis.get(self._session_key(session_id))
        if raw is None:
            raise BrowserUnavailableError("Invalid browser session credentials.")
        payload = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
        return UUID(payload["user_uuid"]), BrowserSession.model_validate(
            payload["session"]
        )

    async def _get_active_session(self, user_uuid: UUID) -> BrowserSession:
        browser = self._active_by_user.get(user_uuid)
        if browser is not None:
            return browser.session
        if self.redis is None:
            raise BrowserUnavailableError("Invalid browser session credentials.")
        raw = await self.redis.get(self._active_session_key(user_uuid))
        if raw is None:
            raise BrowserUnavailableError("Invalid browser session credentials.")
        return BrowserSession.model_validate(
            json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
        )

    async def _write_session(self, user_uuid: UUID, session: BrowserSession) -> None:
        if self.redis is None:
            return
        await self.redis.set(
            self._session_key(session.session_id),
            json.dumps(
                {
                    "user_uuid": str(user_uuid),
                    "session": session.model_dump(mode="json"),
                }
            ),
            ex=SESSION_TTL_SECONDS,
        )
        await self.redis.set(
            self._active_session_key(user_uuid),
            session.model_dump_json(),
            ex=SESSION_TTL_SECONDS,
        )

    async def _write_presence(self, user_uuid: UUID, session: BrowserSession) -> None:
        if self.redis is None:
            return
        await self.redis.set(
            self._presence_key(user_uuid),
            json.dumps(
                {"worker_id": self.worker_id, "bridge_session_id": session.session_id}
            ),
            ex=PRESENCE_TTL_SECONDS,
        )

    async def _get_presence(self, user_uuid: UUID) -> dict[str, str] | None:
        if self.redis is None:
            return None
        raw = await self.redis.get(self._presence_key(user_uuid))
        if raw is None:
            return None
        return json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)

    async def _delete_presence(self, user_uuid: UUID) -> None:
        if self.redis is None:
            return
        await self.redis.delete(self._presence_key(user_uuid))

    @staticmethod
    async def _close_socket(socket: BrowserSocket | None) -> None:
        if socket is None:
            return
        with contextlib.suppress(RuntimeError):
            await socket.close(code=1000)

    @staticmethod
    def _session_key(session_id: str) -> str:
        return f"workspace_mcp:bridge_session:{session_id}"

    @staticmethod
    def _active_session_key(user_uuid: UUID) -> str:
        return f"workspace_mcp:active_session:{user_uuid}"

    @staticmethod
    def _presence_key(user_uuid: UUID) -> str:
        return f"workspace_mcp:presence:{user_uuid}"
