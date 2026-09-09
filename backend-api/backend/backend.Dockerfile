###############################################
# Base Image - OpenBB Backend (consolidated)
###############################################
ARG PLATFORM=linux/amd64
FROM --platform=$PLATFORM python:3.13-slim AS python-base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100 \
    PYSETUP_PATH="/opt" \
    VENV_PATH="/opt/.venv" \
    TZ="America/New_York"

ENV PATH="$VENV_PATH/bin:$PATH"

RUN apt-get update -y && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/log/supervisor
# supervisor via pip, not apt: the apt package drags in Debian's system Python
# stack (/usr/lib/python3/dist-packages), incl. vulnerable jaraco.context (CVE-2026-23949)
RUN python -m pip install --upgrade pip setuptools supervisor

###############################################
# Builder Image
###############################################
FROM python-base AS builder-base

RUN apt-get update -qq -y && apt-get upgrade -y \
    && apt-get install --no-install-recommends -y \
    curl build-essential git unzip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade setuptools poetry

WORKDIR $PYSETUP_PATH
COPY ./pyproject.toml ./poetry.lock ./

RUN poetry config virtualenvs.in-project true \
    && poetry config installer.max-workers 10 \
    && poetry install --only main --no-interaction --no-ansi --no-cache

###############################################
# Production Image
###############################################
FROM python-base AS production-stage

COPY --from=builder-base $VENV_PATH $VENV_PATH

RUN useradd -m -s /bin/bash appuser

WORKDIR $PYSETUP_PATH/code
COPY ./ ./

ENV LD_LIBRARY_PATH="$VENV_PATH/lib"

RUN pip install toml

RUN chown -R appuser:appuser $PYSETUP_PATH/code
RUN touch /var/log/supervisor/supervisord.log /var/run/supervisord.pid
RUN chown -R appuser:appuser /var/log/supervisor/supervisord.log /var/run/supervisord.pid

USER appuser

CMD ["bash", "backend_start.sh"]
