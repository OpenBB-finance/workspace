###############################################
# Base Image  OpenBB Payments Backend Worker
###############################################
ARG PLATFORM=linux/amd64
FROM --platform=$PLATFORM python:3.13-slim AS python-base

# prepend poetry and venv to path
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

# prepend poetry and venv to path
ENV PATH="$POETRY_HOME/bin:$VENV_PATH/bin:$PATH"

RUN apt-get update -y && apt-get upgrade -y

RUN mkdir -p /var/log/supervisor

RUN apt-get clean
# supervisor via pip, not apt: the apt package drags in Debian's system Python
# stack (/usr/lib/python3/dist-packages), incl. vulnerable jaraco.context (CVE-2026-23949)
RUN python -m pip install --upgrade pip setuptools supervisor

###############################################
# Builder Image
###############################################
FROM python-base AS builder-base

RUN apt-get update -y && apt-get upgrade -y \
    && apt-get install --no-install-recommends -y \
    curl build-essential git unzip


# copy project requirement files here to ensure they will be cached.
WORKDIR $PYSETUP_PATH

# install runtime deps - uses $POETRY_VIRTUALENVS_IN_PROJECT internally
RUN pip install --upgrade setuptools poetry

COPY ./pyproject.toml ./poetry.lock ./

RUN poetry install --only main

# remove slowapi poetry.lock/requirements.txt
RUN rm -rf $VENV_PATH/src/slowapi/poetry.lock
RUN rm -rf $VENV_PATH/src/slowapi/docs/requirements.txt

###############################################
# Production Image
###############################################
FROM python-base AS production-stage
COPY --from=builder-base $VENV_PATH $VENV_PATH

RUN useradd -m -s /bin/bash appuser -p $(openssl passwd -1 appuser)

WORKDIR $PYSETUP_PATH/code
COPY ./ ./

ENV PATH="$VENV_PATH/bin:$PATH"
ENV LD_LIBRARY_PATH="$VENV_PATH/lib"

RUN chown -R appuser:appuser $PYSETUP_PATH/code

# Setup supervisor directories and permissions
RUN mkdir -p /var/log/supervisor /var/run /tmp
RUN touch /var/log/supervisor/supervisord.log /var/run/supervisord.pid
RUN chown -R appuser:appuser /var/log/supervisor /var/run/supervisord.pid
RUN chmod 755 /var/run
RUN chmod 1777 /tmp

# Image hardening
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* /var/lib/dpkg/info/* /usr/share/doc/* && \
    rm -rf /usr/share/man /usr/share/info

USER appuser

CMD ["supervisord", "-c", "supervisord_workers.conf"]
