---
name: pr-review
description: Review backend code changes using the project's Python/FastAPI review checklist. Use when asked to review a PR, review code, check code quality, or validate changes before merge in openbb-hub.
allowed-tools: Read, Glob, Grep, Bash, LSP
---

# Backend PR Review Skill

Reviews changes to `backend/` (FastAPI + SQLAlchemy 2.0 async + Alembic + RQ) against
`REVIEW.md` in this skill folder.

## Instructions

### LLM Review Protocol (must follow)

Scope & evidence:
- Review ONLY changes in the PR diff (or the files explicitly provided). Do not comment
  on unrelated code.
- Every finding must include evidence: file path + line (or nearby identifier) + what
  changed.
- Pre-existing debt is not a finding unless the PR extends it. `api/geo.py`,
  `api/helpers.py`, `api/hubspot.py`, `api/schemas.py`, and
  `utilities/feedback_providers.py` already use sync `requests`; flag it only when the
  PR adds to that pattern or touches the exact call site.

Severity:
- **Blocking** = correctness, security, broken functionality, missing tests for
  meaningful logic changes, lint/type errors, and every **[BLOCKING]** rule in
  `REVIEW.md`.
- **Should fix** = maintainability and pattern issues that increase risk — the
  **[SHOULD]** rules.
- **Suggestions** = style/nits. Default here unless it meaningfully affects
  correctness, security, or performance.

**Async and query violations are BLOCKING** — this is the section that matters most in
this codebase, because one blocking call stalls the event loop for every concurrent
request:
- Blocking I/O (`requests`, `time.sleep`, sync `boto3`, sync file/DB drivers) inside an
  `async def`, with no `run_in_threadpool` wrapper
- Sequential `await`s of independent operations that should be `asyncio.gather`
- `await` inside a loop over ids/rows — a serialized N+1
- CPU-heavy work in a request handler instead of an RQ job
- A read-only route on `aget_write_db`, or a mutating route on `aget_read_db`
- Unbounded `select()` with no filter, limit, or pagination
- `commit()` inside a loop

**Security gaps are BLOCKING**:
- A route taking a client-supplied `uuid` without an ownership/permission check (IDOR)
- Missing `response_model`, or a response model that can leak hashed passwords, tokens,
  API keys, or another user's identifiers
- Secrets or full request headers passed to `logger.*`
- Hardcoded credentials, or config read via `os.getenv` instead of
  `utilities/config.py::settings`
- Raw SQL assembled with f-strings/interpolation

**Migration safety is BLOCKING**:
- A model change with no migration, or a migration that doesn't match the model
- `downgrade()` stubbed out with `pass`
- Migrations importing app code or branching on runtime config
- Destructive ops (`drop_column`, type narrowing, new `NOT NULL` on a populated column)
  with no backfill or stated deploy plan
- Two heads after the merge
- Dialect-specific SQL that breaks MySQL, Postgres, or SQLite (all three are supported)

**Duplicated logic is BLOCKING.** Before accepting any new helper, grep for an existing
one in `api/crud.py`, `api/base.py`, `api/helpers.py`, `routers/routers_helpers.py`,
`routers/pro/helpers.py`. A second implementation of something that already exists is
this repo's most common defect. Say which existing function should be used or extended.

**Unnecessary abstraction is a SHOULD FIX** — a new function/config where adding a
parameter to the existing one would do. Ask: "could this be a change to the existing
helper instead of a new one?"

**Missed simplification is a SHOULD FIX** — for every meaningful change, ask:
- Could this be reframed so branches, mode flags, or helper layers disappear entirely,
  rather than just being tidied?
- Are repeated conditionals signaling a missing model or missing helper?
- Is this a bespoke helper for something the codebase already has a canonical utility
  for?
- Keep the "prefer minimal fixes" rule: suggest the simpler structure, but don't demand
  a large refactor unless the complexity creates real risk.

**Layering violations are a SHOULD FIX**:
- `select(...)` inline in a router instead of in `api/crud.py`
- Request/response shapes defined in a router instead of `api/schemas.py`
- The PR pushing `routers/pro/helpers.py`, `api/schemas.py`, `routers/pro/index.py`, or
  `api/crud.py` further past their already-uncomfortable size with a *new* concern —
  don't flag small edits to those files

Behavior:
- Prefer minimal fixes; don't request large refactors unless they reduce real risk.
- If something can't be verified from the diff (runtime behavior, whether a migration
  applies cleanly), say so and recommend a specific check.
- Do NOT automatically run the test suite. Only run `pytest` if the user explicitly asks
  when invoking the skill. Review test quality from the diff instead.
- Prefer a small number of high-conviction findings over a long list of cosmetic notes.

### Writing style: ASD-STE100 (Simplified Technical English) — MANDATORY

Write every finding, heading, and summary in ASD-STE100 Simplified Technical English. This
applies to the review text only; it does not change what you flag or the severity you
assign. Suggested code stays idiomatic Python.

Rules:
- **One idea per sentence.** Maximum 20 words for a descriptive sentence, 20 for an
  instruction.
- **Maximum 6 sentences per paragraph.** Prefer bullets to paragraphs.
- **Active voice only.** Write "`get_user_dashboards` blocks the event loop", not "the
  event loop is blocked by `get_user_dashboards`".
- **Say who does what.** Name the actor: the route, the handler, the query, the migration,
  the reviewer, the author.
- **Simple tenses only** — present, simple past, or `will` + verb. No perfect tenses ("has
  caused"), no continuous tenses ("is causing"), no stacked modals ("would have needed to
  be").
- **One word, one meaning.** Use the same word for the same thing each time. Do not switch
  between "route", "endpoint", and "handler" for one object.
- **Approved words.** Prefer short, common verbs and nouns. Code identifiers, file paths,
  table names, library names, and product names are technical names — always allowed as
  written.
- **No -ing forms as verbs or nouns** where a simple verb works. Write "This call blocks
  the event loop", not "This is causing blocking of the event loop".
- **Keep the articles.** Write "the session", not "session".
- **No noun clusters longer than three words.** Break "user dashboard permission check
  helper" into "the helper that checks dashboard permissions".
- **No idioms, slang, metaphors, or hedging.** Do not write "this smells", "footgun",
  "might potentially". State the fact.
- **Give instructions as direct commands.** Write "Wrap the `requests.get` call in
  `run_in_threadpool`." Do not write "It would probably be good to consider wrapping...".
- **State the cause and the effect in separate sentences.** First the fact, then the
  consequence.
- **Write negatives as warnings, not as hidden conditions.** Write "Do not call
  `requests.get` in an `async def`. This call stops all concurrent requests."

Example rewrite:

- Before: "It looks like this endpoint might be susceptible to an IDOR since the uuid is
  being taken from the client without any ownership check being performed, which could
  potentially allow access to other users' data."
- After: "`GET /dashboards/{uuid}` reads `uuid` from the client. The handler does not check
  the owner of the dashboard. A user can read the dashboards of another user. Add an
  ownership check before the query."

### Steps

1. **Read the checklist**: start with `REVIEW.md` in this skill folder.
2. **Identify what to review**:
   - PR number given → `gh pr diff <number>`
   - Files specified → read those files
   - Nothing specified → assume the current branch and diff against `origin/develop`
     (the repo default branch)
3. **Run the lint gate on changed files** — this is what CI runs, so failures are
   Blocking:
   ```bash
   # changed Python files
   gh pr diff <number> --name-only | grep -E '\.py$' > /tmp/pr_files.txt
   # CI's exact command
   cd backend && ruff check --output-format=concise . 2>&1 | tee /tmp/ruff_out.txt
   grep -F -f /tmp/pr_files.txt /tmp/ruff_out.txt
   ```
   Tools are available in `backend/venv/Scripts/` (Windows) or via
   `poetry run`. Also run `ruff format --check` on the changed files.
4. **Run the type gate on changed files**: `ty check <changed files>` (or `mypy
   --ignore-missing-imports`). Report only errors in PR files, as Blocking.
5. **Walk each `REVIEW.md` section** against the diff:
   - Async correctness (highest value — check every new `async def` for blocking calls)
   - Database & SQLAlchemy (read/write session, N+1, unbounded queries, indexes)
   - Migrations (downgrade, destructive ops, dialects, single head)
   - API design & contracts (`response_model`, status codes, leaked fields)
   - Pydantic & validation (boundary validation, field constraints, no I/O in
     validators)
   - Security & auth (ownership checks, superuser dependency, secrets, rate limits)
   - Code quality & duplication (search for the existing helper before accepting a new
     one)
   - Tests (present, negative cases, async client, dependency overrides)
   - Observability & config
6. **Report findings** by severity.
7. **Check the writing before you send it**: re-read the review against the ASD-STE100
   rules above. Split any sentence longer than 20 words. Remove passive voice, -ing forms,
   and hedging words.

## Key files to reference

- `REVIEW.md` (this folder) — the full checklist
- `backend/api/database.py` — session dependencies, naming conventions
- `backend/api/crud.py`, `backend/api/base.py` — canonical query/helper patterns
- `backend/api/auth_helpers.py` — `GetCurrentUser`, superuser dependency
- `backend/tests/fixtures/clients.py` — async test client and dependency overrides
- `backend/pyproject.toml` — ruff rule selection and per-file ignores
- [fastapi-best-practices](https://github.com/zhanymkanov/fastapi-best-practices) —
  external baseline where the repo is silent

## Output format

Write all text in ASD-STE100 Simplified Technical English (see the writing style rules
above).

```
## PR Review: [description]

### Lint / Type Errors (Blocking)
- [ ] `backend/routers/x.py:42` - S608 possible SQL injection

### Blocking Issues
- [ ] Issue 1 (file:line)
- [ ] Issue 2 (file:line)

### Should Fix
- [ ] Issue 1
- [ ] Issue 2

### Suggestions
- Suggestion 1
- Suggestion 2

### What's Good
- Positive observation 1

### System Impact
- Summary: migrations, deploy ordering, worker/queue changes, cross-dialect risk
```
