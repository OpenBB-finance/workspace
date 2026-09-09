# OpenBB Lite — Docker image

A single Docker image that bundles the FastAPI backend, the `terminalpro` SPA,
Redis, nginx, and supervisord. It defaults to SQLite, generates its own secrets
on first start, and creates an admin user automatically — so the
Metabase-style quick start is genuinely one command.

## Quick start

```bash
docker run -d -p 3000:3000 \
  -v openbb-data:/data \
  --name openbb \
  openbb/lite:latest
```

That's it. Open <http://localhost:3000> and log in as
`admin@openbb.co` — the password is auto-generated on first start. Print it
anytime with:

```bash
docker exec openbb credentials
```

It is stored at `/data/secrets.env` inside the container (and therefore
inside the `openbb-data` volume), so it survives restarts. It is also printed
at the end of the startup logs (`docker logs openbb --tail 15`).

To run on a different port (say 8080):

```bash
docker run -d -p 8080:3000 -v openbb-data:/data --name openbb openbb/lite:latest
```

## Overriding configuration

Every value the image auto-generates can be replaced with `-e` at run time.
Anything you pass in wins; the image only fills in what's missing.

### Custom admin

```bash
docker run -d -p 3000:3000 \
  -v openbb-data:/data \
  -e OPENBB_ADMIN_EMAIL=me@example.com \
  -e OPENBB_ADMIN_PASSWORD='super-secret' \
  openbb/lite:latest
```

### Bring your own database (Postgres / MySQL)

```bash
docker run -d -p 3000:3000 \
  -e DATABASE_TYPE=postgresql \
  -e DB_HOST=my-postgres-host \
  -e DB_PORT=5432 \
  -e DB_NAME=openbb \
  -e WRITE_DB_USER=openbb \
  -e WRITE_DB_PASSWORD=...\
  -e READ_DB_USER=openbb \
  -e READ_DB_PASSWORD=... \
  --name openbb openbb/lite:latest
```

(MySQL works the same way with `DATABASE_TYPE=mysql` and `DB_PORT=3306`.)

### External Redis

```bash
docker run -d -p 3000:3000 \
  -e REDIS_HOST=my-redis-host \
  -e REDIS_PORT=6379 \
  -e REDIS_PASS=... \
  --name openbb openbb/lite:latest
```

Redis still runs *inside* the container as well — it's harmless and lets
the image stay self-contained. If you'd rather skip the embedded one,
edit `supervisord.conf` and rebuild.

### Custom secrets

By default the image generates `JWT_SECRET`, `OPENBB_AUTH_TOKEN`,
`OPENBB_AES_KEY` and `LOCAL_STORAGE_SECRET_KEY` on first start and persists
them to `/data/secrets.env`. To bring your own, pass any of them with `-e`:

```bash
docker run -d -p 3000:3000 \
  -e JWT_SECRET=$(openssl rand -hex 48) \
  -e OPENBB_AES_KEY=$(openssl rand -hex 8) \
  ...
```

`OPENBB_AUTH_TOKEN` must be a JWT (HS256) signed with `JWT_SECRET`. If you set
`JWT_SECRET` without providing `OPENBB_AUTH_TOKEN`, the image will mint a
matching token for you.

### Frontend runtime config

The SPA reads `/config.js` at load time, and the image regenerates that file
on every start from the env vars below (see
[`render-frontend-config.sh`](./render-frontend-config.sh)):

| Variable | Default | Purpose |
| --- | --- | --- |
| `BACKEND_URL` | `/api` | Base URL the SPA uses for backend calls |
| `AI_API_URL` | empty | AI service URL used by Workspace AI features |
| `PLATFORM_URL` | empty | Platform service URL |
| `DATABASE_API_URL` | empty | Database service URL |
| `AUTHENTICATION_SEND_USER_EMAIL_AS_HEADER` | `false` | Send the signed-in user's email as a request header |
| `AI_COPILOT_ENABLED` | `true` | Show Copilot UI |
| `AI_COPILOT_OPENBB_COPILOT` | `false` | Offer OpenBB Copilot (needs OpenBB's AI backend) |
| `AI_COPILOT_AI_ENHANCEMENTS` | `true` | Enable AI enhancement UI |
| `UI_SHOW_COMPANION_MCP_MODE` | `true` | Show the MCP companion |
| `UI_SHOW_MINIMIZE_WIDGET` | `true` | Show widget minimize controls |
| `UI_SHOW_CHART_GENERATION` | `true` | Show chart generation controls |
| `UI_SHOW_CHANGELOG` | `true` | Show the in-app changelog |
| `UI_SHOW_COPILOT_SWITCHER` | `true` | Show the Copilot switcher |
| `UI_SHOW_MARKETPLACE` | `true` | Show the Apps Marketplace tab |
| `MCP_DEFAULT_SERVER_ENABLED` | `true` | Add the default MCP server for new users |
| `DATA_ALLOW_HTML_JS_EXECUTION` | `true` | Allow HTML widgets to execute JavaScript |

These are the only frontend fields an operator can change. Everything else
(branding, registration, ToS, telemetry, ...) is **locked**: its values are
baked into the JS bundle at build time by the strict Lite profile
(`terminalpro/config-profiles/lite.locked.json`) and forcibly override
`config.js` at runtime, so editing or replacing `config.js` cannot flip them.
If a variable you pass seems to have no effect, start the container with
`-e DEBUG=1` and check the logs — provided values for locked fields are
reported and ignored.

If you need finer control over the *overridable* fields, mount your own
`config.js` instead (locked fields still win):

```bash
docker run -d -p 3000:3000 \
  -v $(pwd)/my-config.js:/usr/share/nginx/html/config.js:ro \
  -v openbb-data:/data \
  openbb/lite:latest
```

### Changing what Lite locks

The lock policy is a **strict profile** that lives in the sibling `terminalpro/` directory:
`config-profiles/lite.locked.json`. Every field in terminalpro's
`RuntimeConfigSchema` must be triaged there — either **locked** (given a
value) or listed in **`_unlocked`** (operator-configurable). A terminalpro
test fails any PR that adds a config field without making that call, and its
error message points at this section.

**To lock a field off (or on) in Lite** — one change, in terminalpro:

1. Add the field with its forced value to `config-profiles/lite.locked.json`
   (and remove it from `_unlocked` if it was there). The value is baked into
   the JS bundle at the next image build; operators can never change it.

**To make a field operator-configurable** — the profile change plus the
runtime plumbing in this repo:

1. terminalpro: add the field's path (e.g. `"ui.showChangelog"`) to
   `_unlocked` in `config-profiles/lite.locked.json`. `group.*` wildcards
   mark a fully overridable group.
2. this repo: expose the knob in
   [`render-frontend-config.sh`](./render-frontend-config.sh) — a `:=`
   default at the top and a `${VAR}` interpolation in the heredoc. Without
   this the field is neither locked nor reachable; the SPA just uses its
   schema default.
3. this repo: optionally add a `VITE_*` build-time fallback to
   [`frontend.env`](./frontend.env), and document the new variable in the
   table above (and in the Workspace docs).

Changes to the profile ship with the next image build: terminalpro merges
first, then rebuild the image (CI or `./build-local.sh`). The build log's
`[locked-config] locking N field(s): ...` line confirms what got baked in.

## Building the image

This is a standalone repo: it holds the Dockerfile and container config, but the
backend comes from `backend-api/` in this monorepo (standalone mirror: [`OpenBB-finance/openbb-hub`](https://github.com/OpenBB-finance/openbb-hub))
(its `backend/` directory) and the frontend from
[`OpenBB-finance/terminalpro`](https://github.com/OpenBB-finance/terminalpro).
The build assembles both source trees next to the Dockerfile, then builds.

### In CI (GitHub Actions)

The [`Build & publish`](./.github/workflows/build.yml) workflow checks out both
source repos at a configurable ref and builds + pushes a multi-arch image to
GHCR. Run it from the **Actions** tab (`workflow_dispatch`):

- `hub_ref` / `terminalpro_ref` — default `develop`. Set either to a branch,
  tag, commit SHA, or **a PR** via `refs/pull/<N>/head`.
- `push_image` — uncheck to build without pushing.

It authenticates to the (private) source repos with a fine-grained PAT stored
as the `SOURCE_REPOS_PAT` secret (Contents: Read on both repos). The image push
uses the built-in `GITHUB_TOKEN`.

### Locally

Use [`build-local.sh`](./build-local.sh), which assembles the context the same
way CI does and runs a single-arch `docker build --load`:

```bash
# Both repos at develop (clones them into ./backend and ./terminalpro):
./build-local.sh

# Point either source at a PR / branch / SHA:
./build-local.sh --backend-branch refs/pull/42/head --workspace-branch my-feature-branch

# Build the full image for AMD64:
./build-local.sh --variant full --platform linux/amd64 --backend-branch develop --workspace-branch develop

# Or build from checkouts you already have on disk (picks up local edits):
./build-local.sh --local   # defaults to the sibling ../backend-api and ../terminalpro directories
```

Prefer to do it by hand? Clone the two repos beside the Dockerfile and build:

```bash
git clone -b develop --depth 1 https://github.com/OpenBB-finance/terminalpro.git terminalpro
git clone -b develop --depth 1 https://github.com/OpenBB-finance/openbb-hub.git _hub
mv _hub/backend ./backend && rm -rf _hub
DOCKER_BUILDKIT=1 docker build -f Dockerfile -t openbb/lite:latest .
```

The assembled `backend/`, `terminalpro/`, and `_hub/` directories are
git-ignored, so they won't pollute this repo.

## What's inside the container

- `nginx` on `${PORT}` (default 3000). Serves the SPA and reverse-proxies
  `/api/*` → backend at `127.0.0.1:8000` (stripping the `/api` prefix).
- `uvicorn` running the FastAPI backend on `127.0.0.1:8000`.
- `redis-server` on `127.0.0.1:6379`, dumping to `/data/redis`.
- `supervisord` as PID 1's child (tini as PID 1).

All three are managed by [supervisord.conf](./supervisord.conf). nginx and
redis log to stdout/stderr so `docker logs` shows everything.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage build (frontend → backend → runtime) |
| `entrypoint.sh` | Secret bootstrap, migrations, admin user, then exec supervisord |
| `supervisord.conf` | Runs redis + uvicorn + nginx |
| `nginx.conf.template` | Site config; `${PORT}` is substituted on start |
| `render-frontend-config.sh` | Renders `/usr/share/nginx/html/config.js` from env |
| `frontend.env` | Vite build-time env for the runtime SPA build |
| `.github/workflows/build.yml` | CI (standalone-repo era, inert in this monorepo): assemble source, build & push to GHCR |
| `build-local.sh` | Local build helper (assembles context, single-arch `--load`) |
| `publish.sh` | Local multi-arch build + push to GHCR |
| `VERSION` | Image version tag |
