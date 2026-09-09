# syntax=docker/dockerfile:1.6
#
# OpenBB Lite image.
#
# Bundles the FastAPI backend (Cython-compiled lite build), the terminalpro
# SPA (Vite runtime build), Redis, nginx, and supervisord into a single image.
# Defaults to SQLite at /data/openbb.db so a `docker run -d -p 3000:3000` works
# without any -e flags. Override via standard backend env vars (DATABASE_TYPE,
# DB_HOST, ...).
#
# Build context: this repo's root, with backend/ (from openbb-hub) and
# terminalpro/ assembled alongside the Dockerfile. See README.md / build-local.sh.
#   docker build -f Dockerfile -t openbb/lite:latest .
#
###############################################
# Frontend — build terminalpro SPA in runtime mode
###############################################
FROM node:22 AS frontend-build

ARG OPENBB_IMAGE_VARIANT=lite

ENV NODE_OPTIONS="--max-old-space-size=8192"

WORKDIR /app
COPY terminalpro/package.json terminalpro/package-lock.json ./
RUN npm ci

COPY terminalpro/ ./
# Keep terminalpro's release version (bumped there on every release) — the
# variant env COPY below replaces .env, so carry the value across instead of
# hand-maintaining a drifting copy in this repo.
RUN grep '^VITE_RELEASE_VERSION=' .env > /tmp/release-version.env
COPY frontend.env ./frontend.lite.env
COPY frontend.full.env ./frontend.full.env
RUN case "$OPENBB_IMAGE_VARIANT" in \
      lite|full) cp "./frontend.${OPENBB_IMAGE_VARIANT}.env" ./.env ;; \
      *) echo "Unknown OPENBB_IMAGE_VARIANT=$OPENBB_IMAGE_VARIANT" >&2; exit 1 ;; \
    esac
RUN cat /tmp/release-version.env >> .env
# The Lite env selects terminalpro's strict in-repo lock profile; the Full env
# deliberately leaves frontend runtime configuration unlocked.
RUN npm run build:runtime


###############################################
# Backend base — python + poetry deps
###############################################
FROM python:3.13-slim AS python-base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100 \
    POETRY_VERSION=2.3.2 \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    PYSETUP_PATH="/opt" \
    VENV_PATH="/opt/.venv" \
    TZ="America/New_York"

ENV PATH="$POETRY_HOME/bin:$VENV_PATH/bin:$PATH"

RUN python -m pip install --upgrade pip setuptools


FROM python-base AS backend-build

RUN apt-get update -y && apt-get upgrade -y \
    && apt-get install --no-install-recommends -y \
       curl build-essential git unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR $PYSETUP_PATH

RUN pip install --upgrade setuptools poetry

COPY backend/pyproject.toml backend/poetry.lock ./
# Regenerate the lock if it's out of sync with pyproject.toml (e.g. after
# moving deps into an optional group). --no-update keeps existing pins.
RUN poetry lock --no-update || poetry lock
RUN poetry install --only main

RUN $VENV_PATH/bin/pip install "cython>=3.0" "setuptools>=68"

RUN rm -rf $VENV_PATH/src/slowapi/poetry.lock $VENV_PATH/src/slowapi/docs/requirements.txt


###############################################
# Backend compile — produce .so for api / routers / utilities
###############################################
FROM backend-build AS backend-compile

WORKDIR $PYSETUP_PATH/code

COPY backend/setup_compile.py ./
COPY backend/api ./api
COPY backend/routers ./routers
COPY backend/utilities ./utilities

RUN . $VENV_PATH/bin/activate \
    && python setup_compile.py build_ext --inplace

RUN find api routers utilities -name "*.py" ! -name "__init__.py" | while read -r f; do \
        base="${f%.py}"; \
        if ls "${base}".cpython-*.so >/dev/null 2>&1; then rm "$f"; fi; \
    done \
    && find api routers utilities -name "*.c" -delete \
    && find . -type d -name "__pycache__" -prune -exec rm -rf {} + \
    && find api routers utilities -name "*.so" -exec strip --strip-unneeded {} +

# Trim the venv now that compilation is done. Cython was build-only. Bytecode
# (__pycache__/*.pyc) is recreated on first import as needed and adds up to
# ~30-50 MB across site-packages.
#
# DO NOT blindly delete dirs named "tests" / "docs" / "examples" here —
# several packages ship real importable submodules under those names
# (e.g. boto3.docs is a runtime module, not documentation).
RUN $VENV_PATH/bin/pip uninstall -y cython pip setuptools 2>/dev/null || true \
    && find $VENV_PATH -depth -type d -name __pycache__ -exec rm -rf {} + \
    && find $VENV_PATH -depth -name "*.pyc" -delete \
    && find $VENV_PATH -depth -name "*.pyo" -delete


###############################################
# Runtime — backend + frontend + redis + nginx + supervisor
###############################################
FROM python-base AS runtime

ARG OPENBB_IMAGE_VARIANT=lite

RUN apt-get update -y \
    && apt-get install --no-install-recommends -y \
       nginx redis-server gettext-base tini \
    && rm -rf /var/lib/apt/lists/* /var/log/nginx/* \
              /usr/share/doc /usr/share/man /usr/share/info /usr/share/locale \
    && mkdir -p /var/log/supervisor /run/nginx

# supervisor via pip, not apt: the apt package drags in Debian's system Python
# stack (/usr/lib/python3/dist-packages), incl. vulnerable jaraco.context (CVE-2026-23949)
RUN python -m pip install supervisor

COPY --from=backend-compile $VENV_PATH $VENV_PATH

RUN useradd -m -s /bin/bash appuser

WORKDIR $PYSETUP_PATH/code

# Compiled backend (.so + __init__.py only).
COPY --from=backend-compile --chown=appuser:appuser $PYSETUP_PATH/code/api ./api
COPY --from=backend-compile --chown=appuser:appuser $PYSETUP_PATH/code/routers ./routers
COPY --from=backend-compile --chown=appuser:appuser $PYSETUP_PATH/code/utilities ./utilities

# Plain-Python entry points + migrations.
COPY --chown=appuser:appuser backend/main.py ./
COPY --chown=appuser:appuser backend/init-db.py ./
COPY --chown=appuser:appuser backend/alembic.ini ./
COPY --chown=appuser:appuser backend/alembic ./alembic
COPY --chown=appuser:appuser backend/scripts ./scripts

# Workspace MCP package (imported by routers/pro/workspace_mcp via main.py).
# Shipped as source — it carries markdown resources loaded with
# importlib.resources, and is not part of the Cython compile stage. For a
# production lite release it should be added to setup_compile.py and compiled
# like api/routers/utilities.
COPY --chown=appuser:appuser backend/workspace_mcp ./workspace_mcp

# Frontend bundle.
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Container config.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY supervisord.conf /etc/supervisor/supervisord.conf
COPY entrypoint.sh /entrypoint.sh
COPY render-frontend-config.sh /usr/local/share/openbb/render-frontend-config.lite.sh
COPY render-frontend-config.full.sh /usr/local/share/openbb/render-frontend-config.full.sh
# Admin-login helper: `docker exec openbb credentials`
COPY credentials.sh /usr/local/bin/credentials

# Account import helper: `docker exec openbb openbb-import /import/<file>.zip`
COPY import.sh /usr/local/bin/openbb-import
RUN case "$OPENBB_IMAGE_VARIANT" in \
      lite|full) cp "/usr/local/share/openbb/render-frontend-config.${OPENBB_IMAGE_VARIANT}.sh" /usr/local/bin/render-frontend-config.sh ;; \
      *) echo "Unknown OPENBB_IMAGE_VARIANT=$OPENBB_IMAGE_VARIANT" >&2; exit 1 ;; \
    esac \
    && chmod +x /entrypoint.sh /usr/local/bin/render-frontend-config.sh /usr/local/bin/credentials /usr/local/bin/openbb-import

ENV PATH="$VENV_PATH/bin:$PATH" \
    LD_LIBRARY_PATH="$VENV_PATH/lib" \
    OPENBB_IMAGE_VARIANT=${OPENBB_IMAGE_VARIANT} \
    PORT=3000 \
    DATABASE_TYPE=sqlite \
    DB_PATH=/data/openbb.db \
    FOLDER_STORAGE_PATH=/data/storage \
    REDIS_HOST=127.0.0.1 \
    REDIS_PORT=6379 \
    REDIS_PASS="" \
    MODE=lite \
    DISABLE_CORS=1 \
    STORAGE_PROVIDER=folder \
    EMAIL_PROVIDER=none \
    HUBSPOT=0 \
    PROMETHEUS=0 \
    WORKERS=1 \
    SUPPRESSED_API_ROUTERS='["bot", "terminal", "sdk", "run_tasks", "testing", "metrics"]' \
    SUPPRESSED_API_ROUTES='[]' \
    SELFURL=http://localhost:3000/api \
    FRONTENDURL=http://localhost:3000 \
    PROURL=http://localhost:3000

# /data holds SQLite, folder storage, and the redis dump. Created here with
# appuser ownership so the first-mount of a named volume inherits it.
# /opt/code's contents were already --chown'd by each COPY; only the WORKDIR
# itself needs its ownership updated (init_users writes user_create.json here),
# so we keep this chown non-recursive to avoid duplicating ~100 MB of files
# into a new layer.
RUN mkdir -p /data /data/storage /data/redis \
    && chown appuser:appuser /data /data/storage /data/redis $PYSETUP_PATH/code

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:${PORT}/api/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
