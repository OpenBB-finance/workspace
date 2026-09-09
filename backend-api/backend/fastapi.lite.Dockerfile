###############################################
# Base — shared by builder + production stages
###############################################
ARG PLATFORM=linux/amd64
FROM --platform=$PLATFORM python:3.13-slim AS python-base

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

###############################################
# Builder — install runtime deps + Cython
###############################################
FROM python-base AS builder-base

RUN apt-get update -y && apt-get upgrade -y \
    && apt-get install --no-install-recommends -y \
       curl build-essential git unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR $PYSETUP_PATH

RUN pip install --upgrade setuptools poetry

COPY ./pyproject.toml ./poetry.lock ./
RUN poetry install --only main

# Install build tooling into the project venv (not the system Python), since
# setup_compile.py runs under that venv. setuptools is not a runtime dep so
# poetry didn't include it; Cython needs it for the Extension/setup machinery.
RUN $VENV_PATH/bin/pip install "cython>=3.0" "setuptools>=68"

RUN rm -rf $VENV_PATH/src/slowapi/poetry.lock $VENV_PATH/src/slowapi/docs/requirements.txt

###############################################
# Compile — produce .so for api / routers / utilities
###############################################
FROM builder-base AS compile-stage

WORKDIR $PYSETUP_PATH/code

COPY ./setup_compile.py ./
COPY ./api ./api
COPY ./routers ./routers
COPY ./utilities ./utilities

# Use the project venv so Cython links against the same Python the runtime uses.
RUN . $VENV_PATH/bin/activate \
    && python setup_compile.py build_ext --inplace

# Strip the source .py only where a sibling .so exists — this keeps both the
# __init__.py files and any modules excluded from compilation (Pydantic-heavy
# files; see setup_compile.py EXCLUDE_FILES). Also drop intermediate .c files
# and any pycache.
RUN find api routers utilities -name "*.py" ! -name "__init__.py" | while read -r f; do \
        base="${f%.py}"; \
        if ls "${base}".cpython-*.so >/dev/null 2>&1; then rm "$f"; fi; \
    done \
    && find api routers utilities -name "*.c" -delete \
    && find . -type d -name "__pycache__" -prune -exec rm -rf {} +

###############################################
# Production — minimal image, no build tooling
###############################################
FROM python-base AS production-stage
COPY --from=builder-base $VENV_PATH $VENV_PATH

RUN useradd -m -s /bin/bash appuser

WORKDIR $PYSETUP_PATH/code

# Compiled extensions (only .so + __init__.py inside these dirs).
COPY --from=compile-stage --chown=appuser:appuser $PYSETUP_PATH/code/api ./api
COPY --from=compile-stage --chown=appuser:appuser $PYSETUP_PATH/code/routers ./routers
COPY --from=compile-stage --chown=appuser:appuser $PYSETUP_PATH/code/utilities ./utilities

# Stays as .py: entry point, migrations, bootstrap scripts.
COPY --chown=appuser:appuser ./main.py ./
COPY --chown=appuser:appuser ./alembic.ini ./
COPY --chown=appuser:appuser ./alembic ./alembic
COPY --chown=appuser:appuser ./scripts ./scripts
# Workspace MCP package (imported by routers/pro/workspace_mcp). Shipped as source for now;
# for a production lite release it should be added to setup_compile.py and compiled like the rest.
COPY --chown=appuser:appuser ./workspace_mcp ./workspace_mcp

ENV PATH="$VENV_PATH/bin:$PATH"
ENV LD_LIBRARY_PATH="$VENV_PATH/lib"

# Persistent-data mount point. Created with appuser ownership before the
# user switch so the named volume (lite-data) inherits these permissions
# the first time it's initialised. SQLite needs to create files here.
RUN mkdir -p /data && chown appuser:appuser /data

# WORKDIR was created by Docker as root; the COPYs above only chown'd the
# files they pulled in. appuser also needs write to /opt/code itself
# (init_users writes user_create.json there) and to the scripts dir.
RUN chown -R appuser:appuser $PYSETUP_PATH/code

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "python -m alembic upgrade head && exec python -m uvicorn main:app --host 0.0.0.0 --port 8000"]
