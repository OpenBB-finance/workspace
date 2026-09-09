# Backend Review Checklist

Review criteria for `backend/` (FastAPI + SQLAlchemy 2.0 async + Alembic + RQ).
Driven by `SKILL.md` in this folder.

Rules marked **[BLOCKING]** must be fixed before merge. Rules marked **[SHOULD]** are
important but negotiable. Everything else is a suggestion.

Baseline references: this repo's own conventions win; where the repo is silent, follow
[fastapi-best-practices](https://github.com/zhanymkanov/fastapi-best-practices).

---

## 1. Async correctness

The single highest-value section. Every route, dependency, and helper in this codebase
is `async def` — a blocking call anywhere in that chain stalls the whole event loop for
every concurrent request, not just the one that made it.

- **[BLOCKING] No blocking I/O inside `async def`.** No `requests.*`, `time.sleep`,
  sync `boto3`, sync file reads, or sync DB drivers in an async function. Use the
  async client the repo already depends on (`httpx.AsyncClient`, `aiohttp`,
  `aioboto3`, `aiosqlite`/`asyncpg`/`aiomysql`), or wrap the sync call:
  `await run_in_threadpool(sync_fn, ...)` (`starlette.concurrency`).
  - Pre-existing sync `requests` calls live in `api/geo.py`, `api/helpers.py`,
    `api/hubspot.py`, `api/schemas.py`, `utilities/feedback_providers.py`. They are
    debt, not precedent — new code must not copy them, and a PR touching one of those
    call sites should convert it if the change is small.
- **[BLOCKING] No CPU-heavy work in a route.** Encryption over large payloads, big
  parses, report generation → RQ (`utilities/workers_queue.py`,
  `api/worker_tasks.py`). Threads don't help; the GIL still serializes them.
- **[BLOCKING] Independent awaits must run concurrently.** Two or more awaits with no
  data dependency must use `asyncio.gather` / `asyncio.create_task`, not sequential
  `await`s. See `routers/pro/dash.py::get_shared_items` for the house pattern.
- **[BLOCKING] No `await` inside a loop over rows/ids** when the work is independent —
  that is a serialized N+1 over the network. Batch into one query
  (`where(col.in_(ids))`) or gather.
- **[SHOULD] Dependencies should be `async def`.** A sync dependency is dispatched to
  the threadpool on every request; that overhead is pointless for non-I/O work.
- **[SHOULD] `BackgroundTasks` only for sub-second, fire-and-forget, loss-tolerant
  work.** Anything you'd want retried, scheduled, or alerted on belongs in RQ.
- Never create a new event loop or call `asyncio.run` inside request-handling code.

## 2. Database & SQLAlchemy

- **[BLOCKING] Read routes use `aget_read_db`; only mutating routes use
  `aget_write_db`.** (`api/database.py`.) A `GET` on the write session needlessly loads
  the primary. Conversely, anything that commits must be on the write session.
- **[BLOCKING] No unbounded queries.** Any query that can grow with users/rows needs
  `.limit()`, pagination (`fastapi-pagination` is a dependency), or a proven-bounded
  `WHERE`. Flag `select(Model)` with no filter and no limit.
- **[BLOCKING] No raw SQL built by string interpolation / f-strings.** Use bound
  parameters or the ORM expression language. Ruff `S608` catches the obvious cases;
  reviewers catch the rest.
- **[BLOCKING] No `commit()` inside a loop.** Build the batch, commit once. Note the
  helper `crud.acreate_helper` already does add → commit → refresh for single rows.
- **[BLOCKING] Load only the columns you need.** `select(Model.a, Model.b)` over
  `select(Model)` when the row is wide; use `defer`/`contains_eager` as `api/crud.py`
  does. Same rule for `GetCurrentUser(["uuid", ...])` — request the narrowest column
  list the route actually reads, and don't add a column "just in case."
- **[SHOULD] Query logic belongs in `api/crud.py`, not in the router.** Routers
  orchestrate: authorize → call crud → shape the response. A router with `select(...)`
  inline is a layering violation.
- **[SHOULD] Do the work in SQL, not in Python.** Joins, aggregation, filtering, and
  counting belong in the query; Pydantic is for validating the final shape. A Python
  loop that filters or sums rows just fetched is a rewrite candidate.
- **[SHOULD]** New foreign keys / frequently-filtered columns need an index; the naming
  convention is set in `api/database.py` (`ix_%(column_0_label)s`,
  `fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s`) — don't hand-name
  around it.
- Watch for cross-dialect breakage: this backend runs on MySQL, Postgres **and**
  SQLite. Dialect-specific SQL (`ON DUPLICATE KEY`, `JSONB`, `RETURNING`) must be
  guarded or avoided — see `tests/test_helpers_dialects.py`,
  `tests/test_migration_dialects.py`.

## 3. Migrations (Alembic)

- **[BLOCKING] A model change without a migration**, or a migration whose `upgrade`
  doesn't match the model change.
- **[BLOCKING] `downgrade()` must be implemented and correct** — not `pass`, not a
  stub, unless the operation is genuinely irreversible and that's stated in a comment.
- **[BLOCKING] Migrations must be static.** No importing app code, no querying at
  import time, no branching on runtime config. Only the data structure is dynamic.
- **[BLOCKING] Destructive operations flagged explicitly.** `drop_column`,
  `drop_table`, type narrowing, and `NOT NULL` added to an existing populated column
  need either a backfill step or a stated deploy plan — deploy order matters, since the
  old app version runs against the new schema during rollout.
- **[SHOULD]** Migrations must work on all three dialects — SQLite has no native
  `ALTER COLUMN`, so batch mode or a documented skip is required.
- Only one new head per PR; a merge that produces two heads is broken.
- Make sure we use todays time for the xxxx- alembic version name of the file.

## 4. API design & contracts

- **[BLOCKING] Every route declares a `response_model`** (or an explicit
  `Response`/`StreamingResponse` return). Returning a bare dict or an ORM object leaks
  whatever columns happen to be loaded — including hashed passwords and tokens.
- **[BLOCKING] Response models must not expose secrets** — password hashes, API keys,
  session tokens, other users' UUIDs, billing identifiers.
- **[SHOULD]** Declare `status_code` explicitly for creates (`201`) and deletes
  (`204`); declare `tags` and a docstring so the OpenAPI page stays usable.
- **[SHOULD]** Path parameter names stay consistent across routes (`dashboard_uuid` is
  `dashboard_uuid` everywhere) so dependencies chain without adapters.
- **[SHOULD]** Prefer `Annotated[X, Depends(...)]` for new parameters. The repo has
  both styles; `Annotated` is the direction of travel — don't convert unrelated lines.
- Raise `HTTPException` with an accurate status code (`400` bad input, `401` unauth,
  `403` not yours, `404` missing, `409` conflict, `429` throttled). Don't return
  `{"error": ...}` with a `200`.
- Error detail strings must not echo internals — no stack traces, SQL, or raw
  exception text in `detail`.

## 5. Pydantic & validation

- **[BLOCKING] Validate at the boundary.** Request bodies are Pydantic models, not
  `dict`/`Any`. Constraints go on the field (`Field(ge=..., max_length=...)`,
  `EmailStr`, `Literal`, enums) rather than as `if` statements in the route.
- **[BLOCKING] No unbounded free-text fields** that get persisted or forwarded — set
  `max_length`. This is a real storage/DoS vector for user-supplied dashboard content.
- **[SHOULD]** Keep validators cheap and side-effect free: FastAPI instantiates the
  model twice per response (encode → validate against `response_model`), so a validator
  that hits the network or DB runs twice. Never do I/O in a validator.
- **[SHOULD]** `ValueError` raised in a `@field_validator` is surfaced to the client —
  write those messages for an external reader.
- Schemas live in `api/schemas.py` / `api/marketplace_schemas.py`; ORM models live in
  `api/models/`. Don't define request/response shapes inline in a router.

## 6. Security & auth

- **[BLOCKING] Every non-public route is authenticated**, and ownership is checked
  separately from authentication. Being logged in ≠ owning the dashboard. Use the
  existing pattern: `crud.*_owner_errors` → `HTTPException(403)`
  (`routers/pro/dash.py::validate_dashboard_ownership`).
- **[BLOCKING] Object references from the client are authorized against the caller.**
  Any route taking a `uuid` from the request body/path must prove the caller may touch
  that object — the classic IDOR. `tests/test_privilege_escalation.py` exists because
  this has bitten us.
- **[BLOCKING] Superuser/admin routes require the superuser dependency**
  (`auth_helpers.get_current_superuser`), not a boolean check inside the handler.
- **[BLOCKING] No secrets in logs.** No tokens, passwords, API keys, or full request
  headers in `logger.*`. (`api/rate_limit.py` logs full headers today — do not extend
  that pattern.)
- **[BLOCKING] No hardcoded secrets/credentials.** Config comes from
  `utilities/config.py::settings`; scattered `os.getenv` reads in feature code are a
  finding.
- **[SHOULD]** New unauthenticated or expensive endpoints carry a rate limit:
  `@limiter.limit(LIMIT_DEFAULT, exempt_when=exempt_user_agent)` — and remember the
  decorator requires a `request: Request` parameter on the handler.
- **[SHOULD]** Ruff `S` (bandit) findings are not to be `# noqa`'d without a comment
  explaining why it's safe.
- User-supplied URLs that the backend fetches need scheme/host validation (SSRF), and
  user-supplied HTML must stay escaped (`api/base.py` has helpers).

## 7. Code quality, reuse, and duplication

- **[BLOCKING] Duplicated logic.** If the PR adds a third near-copy of an existing
  block, it must be extracted. Before accepting a new helper, check whether
  `api/crud.py`, `api/base.py`, `api/helpers.py`, `routers/routers_helpers.py`, or
  `routers/pro/helpers.py` already has it — this codebase's most common defect is a
  second implementation of something that already exists.
- **[SHOULD] Unnecessary abstraction.** A new function/config where extending the
  existing one (an extra parameter, a changed value) would do. Ask directly: "could
  this be a change to the existing helper instead of a new one?"
- **[SHOULD] Missed simplification.** Could the change be reframed so a branch, mode
  flag, or helper layer disappears rather than being tidied? Are repeated conditionals
  signaling a missing model?
- **[SHOULD] File growth.** `routers/pro/helpers.py` (~2.1k lines), `api/schemas.py`
  (~2k), `routers/pro/index.py` (~2k), and `api/crud.py` (~1.6k) are already past
  comfortable. A PR that adds a new *concern* to one of them should split instead.
  Don't flag a small edit to a big pre-existing file.
- **[SHOULD] Type hints on new public functions** — parameters and return. `Any` and
  bare `dict` in a signature need a reason. `# type: ignore` needs a comment.
- **[SHOULD] Docstrings on non-obvious functions**: purpose, assumptions, and the
  non-obvious decisions. The repo uses NumPy-style `Parameters`/`Returns` blocks
  (`api/base.py`, `api/crud.py`) — match the surrounding file.
- No `print` (ruff `T20`) — use `loguru`'s `logger`.
- No bare `except:` or `except Exception: pass` swallowing errors silently; if it's
  deliberate, use `contextlib.suppress` with a comment.
- New `# noqa` on a rule the file doesn't already suppress needs a justification —
  especially `PLR0912`/`PLR0914`/`PLR0915` (complexity), which usually means the
  function should be split.

## 8. Tests

- **[BLOCKING] Meaningful logic changes ship with tests.** New endpoint, changed
  auth/permission rule, new query, changed serialization → a test. Bug fixes get a
  regression test that fails without the fix.
- **[BLOCKING] Auth/permission changes need a negative test** — the unauthorized caller
  gets `401`/`403`, not just the happy path.
- **[SHOULD]** Use the async client, not `TestClient`: `httpx.AsyncClient` with
  `ASGITransport` (`tests/fixtures/clients.py`). `asyncio_mode = auto` is set, so
  `async def test_*` needs no marker.
- **[SHOULD]** Swap collaborators with `app.dependency_overrides[dep] = fake` and clear
  them afterwards, rather than monkeypatching internals.
- **[SHOULD]** New fixtures go in `tests/fixtures/` and get registered in
  `tests/conftest.py`'s `pytest_plugins`, not redefined per test file.
- Tests assert on behavior and payload shape, not on log lines or call counts of
  internals. No network calls in unit tests (`vcr` and mocks are already set up).

## 9. Observability & config

- Log at the right level with context (identifiers, not payloads). Use
  `logger.exception` inside `except` blocks so the traceback survives.
- New settings go on the `settings` object in `utilities/config.py` with a type and a
  default; document required env vars if there's no safe default, and make sure
  `pytest.ini` / `setup.cfg` env blocks cover them so tests don't break.
- Don't add a new global/module-level client that connects at import time — it breaks
  test collection and slows startup.

## 10. Gates that must pass

- `ruff check backend admin_cli` — CI runs exactly this (`.github/workflows/lint.yml`)
  and it is **[BLOCKING]**.
- `ruff format --check` (pre-commit).
- `ty check` / `mypy` on changed files — new type errors are **[BLOCKING]**.
- `pytest tests` — run only when the reviewer is explicitly asked to.
