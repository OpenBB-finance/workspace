import asyncio
from uuid import uuid4

import pytest
from routers.pro.workspace_mcp.schemas import BrowserSessionStartRequest


class FakeSocket:
    def __init__(self):
        self.sent: list[object] = []
        self.closed = False

    async def send_json(self, data: object) -> None:
        self.sent.append(data)

    async def close(self, code: int = 1000) -> None:
        self.closed = True


class FakePubSub:
    """Minimal async pub/sub matching the redis.asyncio.client.PubSub surface the bridge uses."""

    def __init__(self, broker: dict):
        self._broker = broker
        self._queue: asyncio.Queue = asyncio.Queue()
        self._channels: set[str] = set()

    async def subscribe(self, channel: str) -> None:
        self._broker["channels"].setdefault(channel, []).append(self._queue)
        self._channels.add(channel)

    async def unsubscribe(self, channel: str | None = None) -> None:
        for chan in [channel] if channel else list(self._channels):
            subscribers = self._broker["channels"].get(chan, [])
            if self._queue in subscribers:
                subscribers.remove(self._queue)
            self._channels.discard(chan)

    async def get_message(
        self, timeout: float = 0.0, ignore_subscribe_messages: bool = False
    ):
        try:
            return await asyncio.wait_for(self._queue.get(), timeout=timeout or 0.01)
        except TimeoutError:
            return None

    async def aclose(self) -> None:
        await self.unsubscribe()


class FakeAsyncRedis:
    """In-memory async Redis double sharing one broker so multiple clients interconnect."""

    def __init__(self, broker: dict | None = None):
        self._broker = broker if broker is not None else {"channels": {}, "store": {}}

    @property
    def broker(self) -> dict:
        return self._broker

    def pubsub(self) -> FakePubSub:
        return FakePubSub(self._broker)

    async def publish(self, channel: str, data: str) -> int:
        payload = data.encode("utf-8") if isinstance(data, str) else data
        subscribers = self._broker["channels"].get(channel, [])
        for queue in list(subscribers):
            queue.put_nowait({"type": "message", "channel": channel, "data": payload})
        return len(subscribers)

    async def get(self, key: str):
        return self._broker["store"].get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._broker["store"][key] = (
            value.encode("utf-8") if isinstance(value, str) else value
        )

    async def delete(self, key: str) -> None:
        self._broker["store"].pop(key, None)

    async def aclose(self) -> None:
        return None


@pytest.mark.asyncio
async def test_bridge_start_session_replaces_existing_user_session():
    from routers.pro.workspace_mcp.bridge import (
        BridgeSessionManager,
        BrowserUnavailableError,
    )

    manager = BridgeSessionManager(redis_client=None, worker_id="test-worker")
    user_uuid = uuid4()

    first = await manager.start_session(
        user_uuid=user_uuid,
        request=BrowserSessionStartRequest(client_name="workspace-ui"),
        base_url="http://test",
    )
    second = await manager.start_session(
        user_uuid=user_uuid,
        request=BrowserSessionStartRequest(client_name="workspace-ui"),
        base_url="http://test",
    )

    assert first.session.session_id != second.session.session_id

    with pytest.raises(BrowserUnavailableError):
        await manager.connect_browser(
            session_id=first.session.session_id,
            token=first.session.token,
            socket=FakeSocket(),
        )


@pytest.mark.asyncio
async def test_bridge_executes_connected_browser_command():
    from routers.pro.workspace_mcp.bridge import BridgeSessionManager

    manager = BridgeSessionManager(redis_client=None, worker_id="test-worker")
    if manager.redis is None:
        return

    user_uuid = uuid4()
    start = await manager.start_session(
        user_uuid=user_uuid,
        request=BrowserSessionStartRequest(client_name="workspace-ui"),
        base_url="http://test",
    )
    socket = FakeSocket()
    await manager.connect_browser(
        session_id=start.session.session_id,
        token=start.session.token,
        socket=socket,
    )

    command_task = asyncio.create_task(
        manager.execute_command(user_uuid, {"command": "get_workspace_snapshot"})
    )
    await asyncio.sleep(0)

    assert socket.sent[0]["type"] == "command_request"
    request_id = socket.sent[0]["command"]["request_id"]

    await manager.handle_browser_message(
        user_uuid,
        {
            "type": "command_result",
            "result": {
                "ok": True,
                "command": "get_workspace_snapshot",
                "request_id": request_id,
                "message": "ok",
                "data": {"dashboards": []},
            },
        },
    )

    result = await command_task

    assert result["ok"] is True
    assert result["data"] == {"dashboards": []}


@pytest.mark.asyncio
async def test_bridge_command_without_browser_is_unavailable():
    from routers.pro.workspace_mcp.bridge import (
        BridgeSessionManager,
        BrowserUnavailableError,
    )

    manager = BridgeSessionManager(redis_client=None, worker_id="test-worker")

    with pytest.raises(BrowserUnavailableError):
        await manager.execute_command(uuid4(), {"command": "get_workspace_snapshot"})


@pytest.mark.asyncio
async def test_disconnect_only_fails_that_users_pending_commands():
    from routers.pro.workspace_mcp.bridge import BridgeSessionManager, ConnectedBrowser

    manager = BridgeSessionManager(redis_client=None, worker_id="test-worker")

    async def connect(user_uuid):
        start = await manager.start_session(
            user_uuid=user_uuid,
            request=BrowserSessionStartRequest(client_name="workspace-ui"),
            base_url="http://test",
        )
        # Register the browser directly: the credential handshake in
        # connect_browser requires Redis-backed active-session lookup.
        manager._active_by_user[user_uuid] = ConnectedBrowser(
            user_uuid=user_uuid, session=start.session, socket=FakeSocket()
        )

    user_a = uuid4()
    user_b = uuid4()
    await connect(user_a)
    await connect(user_b)

    task_a = asyncio.create_task(
        manager.execute_command(user_a, {"command": "get_workspace_snapshot"})
    )
    task_b = asyncio.create_task(
        manager.execute_command(user_b, {"command": "get_workspace_snapshot"})
    )
    await asyncio.sleep(0.01)
    assert len(manager._pending_commands) == 2

    # User A's browser disconnects.
    await manager.disconnect_browser(user_a)

    # User A's in-flight command fails fast.
    result_a = await task_a
    assert result_a["ok"] is False

    # User B's browser is still connected, so its command must stay pending.
    await asyncio.sleep(0.01)
    assert not task_b.done()

    task_b.cancel()


@pytest.mark.asyncio
async def test_completed_results_cache_is_bounded():
    from routers.pro.workspace_mcp.bridge import BridgeSessionManager, ConnectedBrowser

    cap = 5
    manager = BridgeSessionManager(
        redis_client=None, worker_id="test-worker", completed_results_max=cap
    )
    user = uuid4()
    start = await manager.start_session(
        user_uuid=user,
        request=BrowserSessionStartRequest(client_name="workspace-ui"),
        base_url="http://test",
    )
    socket = FakeSocket()
    manager._active_by_user[user] = ConnectedBrowser(
        user_uuid=user, session=start.session, socket=socket
    )

    for i in range(cap * 3):
        task = asyncio.create_task(
            manager.execute_command(user, {"command": "get_workspace_snapshot"})
        )
        while len(socket.sent) < i + 1:
            await asyncio.sleep(0)
        request_id = socket.sent[-1]["command"]["request_id"]
        await manager.handle_browser_message(
            user,
            {
                "type": "command_result",
                "result": {
                    "ok": True,
                    "command": "get_workspace_snapshot",
                    "request_id": request_id,
                    "message": "ok",
                    "data": {},
                },
            },
        )
        await task

    assert len(manager._completed_results) <= cap


@pytest.mark.asyncio
async def test_ensure_started_pins_worker_id_to_pid():
    """Guards the multi-worker fix: a manager constructed pre-fork must not keep a shared
    worker_id once it starts in a worker process, or all workers share one command channel.
    """
    import os

    from routers.pro.workspace_mcp.bridge import BridgeSessionManager

    manager = BridgeSessionManager(redis_client=FakeAsyncRedis(), worker_id="shared")
    await manager.ensure_started()
    try:
        assert manager.worker_id == f"shared-{os.getpid()}"
    finally:
        if manager._listener_task is not None:
            manager._listener_task.cancel()


@pytest.mark.asyncio
async def test_bridge_routes_command_across_processes_via_redis():
    """A command issued on one worker reaches a browser held by another worker over Redis."""
    from routers.pro.workspace_mcp.bridge import BridgeSessionManager

    broker: dict = {"channels": {}, "store": {}}
    holder = BridgeSessionManager(
        redis_client=FakeAsyncRedis(broker), worker_id="holder"
    )
    caller = BridgeSessionManager(
        redis_client=FakeAsyncRedis(broker), worker_id="caller"
    )

    user_uuid = uuid4()
    start = await holder.start_session(
        user_uuid=user_uuid,
        request=BrowserSessionStartRequest(client_name="workspace-ui"),
        base_url="http://test",
    )
    socket = FakeSocket()
    await holder.connect_browser(
        session_id=start.session.session_id,
        token=start.session.token,
        socket=socket,
    )

    # caller has no local browser for this user -> must publish over Redis to holder.
    command_task = asyncio.create_task(
        caller.execute_command(user_uuid, {"command": "get_workspace_snapshot"})
    )

    # Wait for holder's listener to relay the command to the browser socket.
    for _ in range(200):
        if socket.sent:
            break
        await asyncio.sleep(0.005)
    assert socket.sent, "command was not relayed to the browser socket"
    assert socket.sent[0]["type"] == "command_request"
    request_id = socket.sent[0]["command"]["request_id"]

    await holder.handle_browser_message(
        user_uuid,
        {
            "type": "command_result",
            "result": {
                "ok": True,
                "command": "get_workspace_snapshot",
                "request_id": request_id,
                "message": "ok",
                "data": {"dashboards": []},
            },
        },
    )

    result = await asyncio.wait_for(command_task, timeout=2.0)
    assert result["ok"] is True
    assert result["data"] == {"dashboards": []}

    if holder._listener_task is not None:
        holder._listener_task.cancel()
