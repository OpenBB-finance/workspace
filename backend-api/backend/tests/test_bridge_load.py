"""Load/regression test for the Workspace MCP bridge under concurrency.

Proves the async-redis bridge does NOT consume the thread pool or block the event loop
under load — the property the sync `asyncio.to_thread` version violated. Drives many
concurrent cross-process commands through the real BridgeSessionManager (fake async-redis
broker, no DB/redis needed) and asserts:

  * thread growth stays near zero          (old to_thread path spiked ~+20)
  * a canary thread-pool task stays fast    (i.e. MCP load doesn't starve sync DB calls)
  * event-loop scheduling lag stays low

Runnable two ways:
  * pytest  tests/test_bridge_load.py            (once the suite's autouse fixtures are unblocked)
  * python  tests/test_bridge_load.py            (standalone now; bypasses conftest)
"""

import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)  # backend
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # tests

import asyncio
import json
import statistics
import threading
import time
from uuid import uuid4

import pytest
from routers.pro.workspace_mcp.bridge import BridgeSessionManager
from test_workspace_mcp_bridge import FakeAsyncRedis

HOLDER_WORKER = "holder"
COMMANDS_CHANNEL = f"workspace_mcp:worker:{HOLDER_WORKER}:commands"
DB_WORK_SECONDS = 0.005  # a canary "DB call" run on the thread pool


async def run_bridge_load(*, commands: int, think_seconds: float) -> dict:
    """Fire `commands` concurrent cross-process commands and return load metrics."""
    broker: dict = {"channels": {}, "store": {}}
    user = uuid4()
    broker["store"][f"workspace_mcp:presence:{user}"] = json.dumps(
        {"worker_id": HOLDER_WORKER, "bridge_session_id": "sess"}
    ).encode("utf-8")

    caller = BridgeSessionManager(
        redis_client=FakeAsyncRedis(broker), worker_id="caller"
    )
    responder_redis = FakeAsyncRedis(broker)

    running = True

    # Stand-in for the worker holding the browser socket: reply to each command after think time.
    async def reply_after(env: dict) -> None:
        await asyncio.sleep(think_seconds)
        result = {
            "ok": True,
            "command": env["command"]["command"],
            "request_id": env["request_id"],
            "message": "ok",
        }
        await responder_redis.publish(
            env["reply_channel"],
            json.dumps({"request_id": env["request_id"], "result": result}),
        )

    async def responder() -> None:
        ps = responder_redis.pubsub()
        await ps.subscribe(COMMANDS_CHANNEL)
        inbox = ps._queue
        while running:
            drained = False
            while True:
                try:
                    msg = inbox.get_nowait()
                except asyncio.QueueEmpty:
                    break
                if msg and msg.get("type") == "message":
                    raw = msg["data"]
                    env = json.loads(
                        raw.decode("utf-8") if isinstance(raw, bytes) else raw
                    )
                    asyncio.create_task(reply_after(env))
                    drained = True
            await asyncio.sleep(0 if drained else 0.005)

    # Canary: a sync "DB call" issued on the thread pool while MCP commands are in flight.
    canary_overheads: list[float] = []

    async def canaries() -> None:
        while running:
            start = time.perf_counter()
            await asyncio.to_thread(time.sleep, DB_WORK_SECONDS)
            canary_overheads.append(
                (time.perf_counter() - start - DB_WORK_SECONDS) * 1000
            )
            await asyncio.sleep(0.002)

    # Event-loop lag probe (no extra thread; runs on the loop).
    loop_lags: list[float] = []

    async def lag_probe() -> None:
        while running:
            start = time.perf_counter()
            await asyncio.sleep(0.01)
            loop_lags.append((time.perf_counter() - start - 0.01) * 1000)

    base_threads = threading.active_count()
    peak_threads = base_threads

    async def thread_probe() -> None:
        nonlocal peak_threads
        while running:
            peak_threads = max(peak_threads, threading.active_count())
            await asyncio.sleep(0.002)

    responder_task = asyncio.create_task(responder())
    canary_task = asyncio.create_task(canaries())
    lag_task = asyncio.create_task(lag_probe())
    thread_task = asyncio.create_task(thread_probe())
    await asyncio.sleep(0.05)  # let the responder subscribe

    async def one() -> bool:
        result = await caller.execute_command(
            user, {"command": "get_workspace_snapshot"}
        )
        return bool(result.get("ok"))

    started = time.perf_counter()
    results = await asyncio.gather(*[one() for _ in range(commands)])
    wall_ms = (time.perf_counter() - started) * 1000

    running = False
    for task in (responder_task, canary_task, lag_task, thread_task):
        task.cancel()

    return {
        "completed": sum(results),
        "wall_ms": wall_ms,
        "thread_delta": peak_threads - base_threads,
        "canary_max_ms": max(canary_overheads) if canary_overheads else 0.0,
        "canary_avg_ms": statistics.mean(canary_overheads) if canary_overheads else 0.0,
        "canary_n": len(canary_overheads),
        "loop_lag_max_ms": max(loop_lags) if loop_lags else 0.0,
    }


@pytest.mark.asyncio
async def test_bridge_load_stays_thread_light_and_responsive():
    commands = 150
    metrics = await run_bridge_load(commands=commands, think_seconds=0.05)

    assert metrics["completed"] == commands
    # The async path holds no pool threads; the old to_thread path spiked to the ~20-thread cap.
    assert metrics["thread_delta"] <= 8, metrics
    # A concurrent thread-pool "DB call" must not get starved by MCP load.
    assert metrics["canary_max_ms"] < 75, metrics
    # And the event loop must keep scheduling promptly.
    assert metrics["loop_lag_max_ms"] < 150, metrics


def _main() -> None:
    metrics = asyncio.run(run_bridge_load(commands=200, think_seconds=0.1))
    print(
        f"commands={metrics['completed']}  wall={metrics['wall_ms']:.1f}ms  "
        f"thread_delta=+{metrics['thread_delta']}  "
        f"canary avg={metrics['canary_avg_ms']:.1f}ms max={metrics['canary_max_ms']:.1f}ms "
        f"(n={metrics['canary_n']})  loop_lag_max={metrics['loop_lag_max_ms']:.1f}ms"
    )
    assert metrics["thread_delta"] <= 8, metrics
    assert metrics["canary_max_ms"] < 75, metrics
    print("PASS")


if __name__ == "__main__":
    _main()
