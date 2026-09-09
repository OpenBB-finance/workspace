"""Multi-user Workspace MCP load simulator against the LIVE local stack (http://localhost:8001).

Spins up N simulated users that concurrently:
  * GET  /pro/dash/validate-and-sync      ("validate and sync" — heavy DB read)
  * POST /pro/dash/sync                    (save a dashboard — DB write, round-trips real content)
  * POST /mcp  get_workspace_snapshot      (command through the MCP bridge -> browser WS)
  * POST /mcp  update_widget_layout        ("move things around" through the bridge)

A single shared browser WebSocket (the "open Workspace tab") auto-answers bridge commands.
Throughout the run it samples /metrics and reports how the DB pool / thread pool / event-loop
lag move under load, plus per-action throughput and latency.

Usually launched via run_stress.sh (which brings up the stack first). To run directly against an
already-running stack:
    BASE_URL=http://localhost:8001 USERS=20 DURATION=20 python tests/stress/load_simulator.py

Config via env: BASE_URL, USERS, DURATION, RAMP, MCP_USERS, API_MCP, ADMIN_EMAIL, ADMIN_PASSWORD,
THINK_MIN, THINK_MAX, FRONTEND_UA. See tests/stress/README.md.

NOTE: in single-process dev (uvicorn --reload, WORKERS=1) MCP commands take the bridge's
local fast path; the redis publish/reply path only fires with WORKERS>1. Session/presence
redis writes and all DB/thread-pool load are exercised either way.
"""

import asyncio
import json
import os
import random
import re
import time
import uuid as uuidlib
from collections import defaultdict

import aiohttp

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")
USERS = int(os.environ.get("USERS", "12"))
DURATION = float(os.environ.get("DURATION", "30"))
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@openbb.co")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "asdQWE123!")
THINK_MIN = float(os.environ.get("THINK_MIN", "0.2"))
THINK_MAX = float(os.environ.get("THINK_MAX", "1.0"))
RAMP = float(
    os.environ.get("RAMP", "5")
)  # stagger user arrivals over this many seconds
# Experiment knobs: hold API load fixed (USERS) and optionally add a separate pool of MCP-only
# hammerers (MCP_USERS) to measure MCP's impact on the main API. API_MCP=0 makes the API users
# pure-API (no MCP in their mix) so the comparison is clean.
MCP_USERS = int(os.environ.get("MCP_USERS", "0"))
API_MCP = os.environ.get("API_MCP", "1") != "0"
MCP_ACTIONS = {"mcp_snapshot", "mcp_move"}
SAMPLE_INTERVAL = float(os.environ.get("SAMPLE_INTERVAL", "0.25"))
# Must contain OPENBB_FRONTEND_USER_AGENT to be exempt from rate limiting. This dev stack
# sets it to "test" in envs/.env (the config default is "colinlovedrust"). Override if yours differs.
UA = f"{os.environ.get('FRONTEND_UA', 'test')}-loadsim"

# Action mix (weights). Tune to taste.
ACTIONS = [
    ("validate_and_sync", 4),
    ("sync_save", 6),  # POST /pro/dash/sync — the big "how we save", called often
    ("api_source", 2),
    ("apps", 2),
    ("shared", 2),
    ("display_settings", 2),
    ("resource_permissions", 2),
    ("mcp_snapshot", 3),
    ("mcp_move", 2),
]

# Authenticated GET reads (Bearer access_token). action -> path.
GET_PATHS = {
    "validate_and_sync": "/pro/dash/validate-and-sync",
    "api_source": "/pro/data-connectors/api-source",
    "apps": "/pro/user-apps/sync",
    "shared": "/pro/dash/sync/shared",
    "resource_permissions": "/pro/resource-permissions",
}

# Anchored to line start (re.M) so the `# HELP/# TYPE` comment lines are never matched.
_GAUGE_PATTERNS = {
    "pool_checked_out": re.compile(
        r'^db_pool_connections\{engine="([^"]+)",state="checked_out"\}\s+([0-9.eE+-]+)$',
        re.M,
    ),
    "threadpool_borrowed": re.compile(
        r'^threadpool_tokens\{state="borrowed"\}\s+([0-9.eE+-]+)$', re.M
    ),
    "loop_lag": re.compile(r"^event_loop_lag_seconds\s+([0-9.eE+-]+)$", re.M),
}


class Stats:
    def __init__(self):
        self.latencies: dict[str, list[float]] = defaultdict(list)
        self.ok: dict[str, int] = defaultdict(int)
        self.fail: dict[str, int] = defaultdict(int)
        self.status: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.fail_msgs: dict[str, dict[str, int]] = defaultdict(
            lambda: defaultdict(int)
        )

    def record(
        self, action: str, ms: float, ok: bool, status: str = "", detail: str = ""
    ):
        self.latencies[action].append(ms)
        (self.ok if ok else self.fail)[action] += 1
        if status:
            self.status[action][status] += 1
        if not ok and detail:
            self.fail_msgs[action][detail] += 1


async def login(session: aiohttp.ClientSession) -> str:
    async with session.post(
        f"{BASE_URL}/pro/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "remember": False},
    ) as resp:
        body = await resp.json()
        if resp.status != 200 or "access_token" not in body:
            raise RuntimeError(f"login failed: {resp.status} {body}")
        return body["access_token"]


async def create_mcp_token(session: aiohttp.ClientSession, access_token: str) -> str:
    async with session.post(
        f"{BASE_URL}/pro/workspace-mcp/tokens",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"name": "loadsim"},
    ) as resp:
        body = await resp.json()
        if resp.status != 200 or "token" not in body:
            raise RuntimeError(f"token creation failed: {resp.status} {body}")
        return body["token"]


async def fetch_dashboards(
    session: aiohttp.ClientSession, access_token: str
) -> list[tuple[str, dict]]:
    async with session.get(
        f"{BASE_URL}/pro/dash/sync",
        headers={"Authorization": f"Bearer {access_token}", "User-Agent": UA},
    ) as resp:
        body = await resp.json()
    owned = body.get("owned", {})
    return [(uuid, d.get("content") or {}) for uuid, d in owned.items()]


async def provision_user_dashboards(
    session: aiohttp.ClientSession, access_token: str, base_content: dict, n: int
) -> list[str]:
    """Create one dashboard per user so saves don't contend on the same rows."""
    auth = {"Authorization": f"Bearer {access_token}", "User-Agent": UA}
    uuids = [str(uuidlib.uuid4()) for _ in range(n)]

    async def create(u: str):
        async with session.post(
            f"{BASE_URL}/pro/dash/sync",
            headers=auth,
            json={"items": {u: {"content": base_content, "name": f"loadsim-{u[:8]}"}}},
        ) as r:
            await r.read()
            return r.status == 200

    await asyncio.gather(*[create(u) for u in uuids])
    return uuids


async def cleanup_dashboards(
    session: aiohttp.ClientSession, access_token: str, uuids: list[str]
):
    auth = {"Authorization": f"Bearer {access_token}", "User-Agent": UA}
    async with session.post(
        f"{BASE_URL}/pro/dash/sync",
        headers=auth,
        json={"items": {u: "DELETE" for u in uuids}},
    ) as r:
        await r.read()


async def start_bridge_browser(
    session: aiohttp.ClientSession, access_token: str, stop: asyncio.Event
):
    """Open a bridge session + WebSocket and auto-answer command_requests like the Workspace UI."""
    async with session.post(
        f"{BASE_URL}/pro/workspace-mcp/bridge/session/start",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"client_name": "workspace-ui"},
    ) as resp:
        body = await resp.json()
    ws_url = body["websocket_url"]

    ws = await session.ws_connect(ws_url, heartbeat=20)

    async def pump():
        async for msg in ws:
            if msg.type != aiohttp.WSMsgType.TEXT:
                continue
            event = json.loads(msg.data)
            if event.get("type") == "command_request":
                command = event["command"]
                await ws.send_json(
                    {
                        "type": "command_result",
                        "result": {
                            "ok": True,
                            "command": command.get("command", "unknown"),
                            "request_id": command.get("request_id"),
                            "message": "ok",
                            "data": {
                                "session_context": {"current_dashboard_uuid": None}
                            },
                        },
                    }
                )

    task = asyncio.create_task(pump())
    await stop.wait()
    task.cancel()
    await ws.close()


def _parse_sse_result(text: str) -> dict | None:
    for line in text.splitlines():
        if line.startswith("data:"):
            try:
                return json.loads(line[len("data:") :].strip())
            except json.JSONDecodeError:
                return None
    return None


async def mcp_call(
    session: aiohttp.ClientSession, mcp_token: str, tool: str, arguments: dict
) -> tuple[bool, str, str]:
    async with session.post(
        f"{BASE_URL}/mcp",
        headers={
            "Authorization": f"Bearer {mcp_token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": tool, "arguments": arguments},
        },
    ) as resp:
        text = await resp.text()
        status = str(resp.status)
    payload = _parse_sse_result(text)
    if not payload or "result" not in payload:
        return False, status, "unparseable"
    structured = payload["result"].get("structuredContent") or {}
    ok = bool(structured.get("ok", True))
    detail = "" if ok else (structured.get("message") or "unknown")
    return ok, status, detail


async def user_loop(
    name: str,
    session: aiohttp.ClientSession,
    access_token: str,
    mcp_token: str,
    save_uuid: str,
    save_content: dict,
    deadline: float,
    stats: Stats,
    ramp_delay: float = 0.0,
    allowed: set[str] | None = None,
    do_validate: bool = True,
):
    await asyncio.sleep(ramp_delay)  # staggered arrival, not a thundering herd
    auth = {"Authorization": f"Bearer {access_token}", "User-Agent": UA}
    # validate-and-sync is the once-per-session "dashboard open" call; do it once then work.
    rotation = [
        (a, w)
        for a, w in ACTIONS
        if a != "validate_and_sync" and (allowed is None or a in allowed)
    ]
    names = [a for a, _ in rotation]
    weights = [w for _, w in rotation]

    if do_validate:
        vstart = time.perf_counter()
        vstatus, vok = "", False
        try:
            async with session.get(
                f"{BASE_URL}{GET_PATHS['validate_and_sync']}", headers=auth
            ) as r:
                await r.read()
                vstatus = str(r.status)
                vok = r.status == 200
        except Exception as exc:  # noqa: BLE001
            vstatus = type(exc).__name__
        stats.record(
            "validate_and_sync", (time.perf_counter() - vstart) * 1000, vok, vstatus
        )

    while time.perf_counter() < deadline:
        action = random.choices(names, weights=weights, k=1)[0]
        start = time.perf_counter()
        ok = False
        status = ""
        detail = ""
        try:
            if action in GET_PATHS:
                async with session.get(
                    f"{BASE_URL}{GET_PATHS[action]}", headers=auth
                ) as r:
                    await r.read()
                    status = str(r.status)
                    ok = r.status == 200
            elif action == "sync_save":
                async with session.post(
                    f"{BASE_URL}/pro/dash/sync",
                    headers=auth,
                    json={"items": {save_uuid: {"content": save_content}}},
                ) as r:
                    await r.read()
                    status = str(r.status)
                    ok = r.status == 200
            elif action == "display_settings":
                async with session.post(
                    f"{BASE_URL}/pro/display-settings",
                    headers=auth,
                    json={"theme": "dark"},
                ) as r:
                    await r.read()
                    status = str(r.status)
                    ok = r.status == 200
            elif action == "mcp_snapshot":
                ok, status, detail = await mcp_call(
                    session, mcp_token, "get_workspace_snapshot", {}
                )
            elif action == "mcp_move":
                ok, status, detail = await mcp_call(
                    session,
                    mcp_token,
                    "update_widget_layout",
                    {"x": 0, "y": 2, "w": 20, "h": 8, "widget_id": "sim-widget"},
                )
        except Exception as exc:  # noqa: BLE001 - count transport failures, keep the loop alive
            status = type(exc).__name__
        stats.record(action, (time.perf_counter() - start) * 1000, ok, status, detail)
        await asyncio.sleep(random.uniform(THINK_MIN, THINK_MAX))


async def sample_metrics(session: aiohttp.ClientSession, stop: asyncio.Event) -> dict:
    peak = {"pool": defaultdict(float), "threadpool_borrowed": 0.0, "loop_lag": 0.0}
    baseline = {"pool": {}, "loop_lag": 0.0}
    first = True
    while not stop.is_set():
        try:
            async with session.get(f"{BASE_URL}/metrics") as r:
                text = await r.text()
        except Exception:  # noqa: BLE001
            await asyncio.sleep(SAMPLE_INTERVAL)
            continue
        for engine, value in _GAUGE_PATTERNS["pool_checked_out"].findall(text):
            v = float(value)
            peak["pool"][engine] = max(peak["pool"][engine], v)
            if first:
                baseline["pool"][engine] = v
        m = _GAUGE_PATTERNS["threadpool_borrowed"].search(text)
        if m:
            peak["threadpool_borrowed"] = max(
                peak["threadpool_borrowed"], float(m.group(1))
            )
        m = _GAUGE_PATTERNS["loop_lag"].search(text)
        if m:
            lag = float(m.group(1))
            peak["loop_lag"] = max(peak["loop_lag"], lag)
            if first:
                baseline["loop_lag"] = lag
        first = False
        await asyncio.sleep(SAMPLE_INTERVAL)
    return {"peak": peak, "baseline": baseline}


def _pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    return s[min(len(s) - 1, int(len(s) * p))]


async def main():
    print(
        f"Workspace MCP load sim -> {BASE_URL} | users={USERS} duration={DURATION}s "
        f"think={THINK_MIN}-{THINK_MAX}s"
    )
    connector = aiohttp.TCPConnector(limit=0)
    async with aiohttp.ClientSession(connector=connector) as session:
        access_token = await login(session)
        mcp_token = await create_mcp_token(session, access_token)
        existing = await fetch_dashboards(session, access_token)
        base_content = existing[0][1] if existing else {}
        user_uuids = await provision_user_dashboards(
            session, access_token, base_content, USERS
        )
        print(f"authenticated; provisioned {len(user_uuids)} per-user dashboards")

        stop = asyncio.Event()
        browser_task = asyncio.create_task(
            start_bridge_browser(session, access_token, stop)
        )
        metrics_task = asyncio.create_task(sample_metrics(session, stop))
        await asyncio.sleep(0.5)  # let the browser connect + first metrics sample land

        api_allowed = (
            None if API_MCP else {a for a, _ in ACTIONS if a not in MCP_ACTIONS}
        )
        print(f"api_users={USERS} (api_mcp={API_MCP})  mcp_only_users={MCP_USERS}")

        stats = Stats()
        deadline = time.perf_counter() + DURATION
        started = time.perf_counter()
        tasks = [
            user_loop(
                f"a{i}",
                session,
                access_token,
                mcp_token,
                user_uuids[i],
                base_content,
                deadline,
                stats,
                ramp_delay=(i / USERS) * RAMP,
                allowed=api_allowed,
            )
            for i in range(USERS)
        ]
        if MCP_USERS:
            tasks += [
                user_loop(
                    f"m{i}",
                    session,
                    access_token,
                    mcp_token,
                    user_uuids[0],
                    base_content,
                    deadline,
                    stats,
                    ramp_delay=(i / MCP_USERS) * RAMP,
                    allowed=MCP_ACTIONS,
                    do_validate=False,
                )
                for i in range(MCP_USERS)
            ]
        await asyncio.gather(*tasks)
        wall = time.perf_counter() - started

        stop.set()
        metrics = await metrics_task
        browser_task.cancel()
        await cleanup_dashboards(session, access_token, user_uuids)

    total = sum(len(v) for v in stats.latencies.values())
    print(f"\n=== {total} requests in {wall:.1f}s = {total / wall:.0f} req/s ===")
    print(f"{'action':22s} {'count':>6s} {'ok%':>5s} {'p50ms':>8s} {'p95ms':>8s}")
    for action, _ in ACTIONS:
        lat = stats.latencies.get(action, [])
        n = len(lat)
        oks = stats.ok.get(action, 0)
        okpct = (100 * oks / n) if n else 0.0
        dist = " ".join(
            f"{k}:{v}" for k, v in sorted(stats.status.get(action, {}).items())
        )
        print(
            f"{action:22s} {n:>6d} {okpct:>4.0f}% {_pct(lat, 0.5):>8.1f} {_pct(lat, 0.95):>8.1f}   {dist}"
        )
        for msg, c in sorted(
            stats.fail_msgs.get(action, {}).items(), key=lambda kv: -kv[1]
        ):
            print(f"      fail: {msg!r} x{c}")

    peak, baseline = metrics["peak"], metrics["baseline"]
    print("\n=== DB pool checked_out (baseline -> peak) ===")
    for engine in sorted(peak["pool"]):
        print(
            f"  {engine:12s} {baseline['pool'].get(engine, 0):>4.0f} -> {peak['pool'][engine]:>4.0f}"
        )
    print(f"thread pool borrowed (peak): {peak['threadpool_borrowed']:.0f} / 40")
    print(
        f"event-loop lag (baseline -> peak): {baseline['loop_lag'] * 1000:.1f}ms -> {peak['loop_lag'] * 1000:.1f}ms"
    )


if __name__ == "__main__":
    asyncio.run(main())
