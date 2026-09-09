"""Runtime observability gauges: DB pool usage, threadpool saturation, event-loop lag.

These are the signals for "are we holding up the DB or threads?". A background task on the
event loop samples them every few seconds (reading the anyio limiter requires the loop) and a
Prometheus collector serves the latest snapshot. Registered with the default REGISTRY, so the
values appear on `/metrics` and the `:6970` endpoint alongside the existing instrumentation.

Exposed gauges:
  - db_pool_connections{engine,state}  - SQLAlchemy pool counters per engine
  - threadpool_tokens{state}           - anyio default threadpool limiter (FastAPI sync routes)
  - event_loop_lag_seconds             - scheduling delay beyond the sampler's sleep
"""

from __future__ import annotations

import asyncio
import contextlib
import os
import time
from collections.abc import Mapping
from typing import Any

import anyio
from loguru import logger
from prometheus_client import REGISTRY
from prometheus_client.core import GaugeMetricFamily

_POOL_COUNTERS = (
    ("checked_out", "checkedout"),
    ("checked_in", "checkedin"),
    ("size", "size"),
    ("overflow", "overflow"),
)

_snapshot: dict[str, Any] = {"pools": {}, "threadpool": {}, "loop_lag_seconds": 0.0}
_started = False


def _pool_stats(engines: Mapping[str, Any]) -> dict[str, dict[str, float]]:
    """Read SQLAlchemy pool counters per engine, defensively (counters can raise if detached)."""
    stats: dict[str, dict[str, float]] = {}
    for name, engine in engines.items():
        pool = getattr(engine, "pool", None)
        if pool is None:
            continue
        engine_stats: dict[str, float] = {}
        for state, attr in _POOL_COUNTERS:
            fn = getattr(pool, attr, None)
            if not callable(fn):
                continue
            try:
                engine_stats[state] = float(fn())
            except Exception:  # noqa: BLE001, S112 - a single bad counter must not drop the rest
                continue
        if engine_stats:
            stats[name] = engine_stats
    return stats


def _engines() -> dict[str, Any]:
    """Resolve the four live engines (sync read/write, async read/write)."""
    from api import database  # noqa: PLC0415 - lazy import avoids a circular dependency at module load

    engines: dict[str, Any] = {}
    for name, attr in (
        ("sync_read", "ReadSessionLocal"),
        ("sync_write", "WriteSessionLocal"),
    ):
        sessionmaker_ = getattr(
            database, attr, None
        )  # removed in the async migration; tolerate absence
        bind = sessionmaker_.kw.get("bind") if sessionmaker_ is not None else None
        if bind is not None:
            engines[name] = bind
    for name, manager in (
        ("async_read", database.AsyncReadSessionLocal),
        ("async_write", database.AsyncWriteSessionLocal),
        ("async_validate", getattr(database, "AsyncValidateUserSessionLocal", None)),
    ):
        engine = getattr(manager, "_engine", None) if manager is not None else None
        if engine is not None:
            engines[name] = engine
    return engines


class _RuntimeCollector:
    def collect(self):  # noqa: PLR6301 - prometheus Collector interface requires an instance method
        pools = GaugeMetricFamily(
            "db_pool_connections",
            "SQLAlchemy connection pool counters",
            labels=["engine", "state"],
        )
        for engine_name, states in _snapshot["pools"].items():
            for state, value in states.items():
                pools.add_metric([engine_name, state], value)
        yield pools

        threadpool = GaugeMetricFamily(
            "threadpool_tokens",
            "anyio default threadpool capacity limiter (FastAPI sync routes)",
            labels=["state"],
        )
        for state, value in _snapshot["threadpool"].items():
            threadpool.add_metric([state], value)
        yield threadpool

        lag = GaugeMetricFamily(
            "event_loop_lag_seconds",
            "Event loop scheduling delay (elapsed beyond the sampler's sleep)",
        )
        lag.add_metric([], float(_snapshot["loop_lag_seconds"]))
        yield lag


async def _sampler(interval: float) -> None:
    while True:
        start = time.perf_counter()
        await asyncio.sleep(interval)
        _snapshot["loop_lag_seconds"] = max(0.0, time.perf_counter() - start - interval)

        try:
            limiter = anyio.to_thread.current_default_thread_limiter()
            _snapshot["threadpool"] = {
                "borrowed": float(limiter.borrowed_tokens),
                "total": float(limiter.total_tokens),
            }
        except Exception as exc:  # noqa: BLE001
            logger.debug(f"threadpool sample failed: {exc}")

        try:
            _snapshot["pools"] = _pool_stats(_engines())
        except Exception as exc:  # noqa: BLE001
            logger.debug(f"pool stats sample failed: {exc}")


def start_runtime_metrics(interval: float | None = None) -> None:
    """Register the collector once and start the background sampler on the running loop.

    The sample interval defaults to RUNTIME_METRICS_INTERVAL (seconds, default 2.0); drop it
    to ~0.25 during load tests to catch short-lived pool checkouts.
    """
    global _started  # noqa: PLW0603 - module-level one-time init guard
    if interval is None:
        interval = float(os.environ.get("RUNTIME_METRICS_INTERVAL", "2.0"))
    if _started:
        return
    _started = True
    with contextlib.suppress(ValueError):  # already registered (e.g. after a reload)
        REGISTRY.register(_RuntimeCollector())
    asyncio.create_task(_sampler(interval))
