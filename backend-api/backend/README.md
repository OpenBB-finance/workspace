# Backend

FastAPI + SQLAlchemy backend for OpenBB Workspace.

## Setup

See [DEVELOPMENT_SETUP.md](../DEVELOPMENT_SETUP.md) for full local development instructions.

Quick start for local UI testing:

```bash
docker compose -f docker-compose-local-dev.yml up --build --watch

# in a second terminal
cd backend
../.venv/bin/python -m scripts.init_users
```

This runs the API and RQ worker in Docker with the local `backend/` folder mounted.
The API reloads automatically, and Compose can restart the worker when files change.
See [DEVELOPMENT_SETUP.md](../DEVELOPMENT_SETUP.md) for the full workflow.

## Project Layout

| Path | Description |
|---|---|
| `api/` | Core application — models, schemas, helpers, auth |
| `routers/` | API route handlers |
| `utilities/` | Configuration, shared utilities |
| `alembic/` | Database migration revisions |
| `envs/` | Environment files (`.env`) |
| `scripts/` | Dev-only scripts and config (excluded from Docker images) |
| `tests/` | Test suite (`pytest`) |
| `run.py` | Application entrypoint (Gunicorn + Uvicorn) |
| `main.py` | FastAPI app factory |

## Conventions

- Use `api.base.get_now()` instead of `datetime.datetime.now`.
- The `User.password` column uses a `PasswordType` TypeDecorator that bcrypt-hashes
  on write. Always pass plaintext passwords — never pre-hash.

## Database Migrations

```bash
# Apply pending migrations
../.venv/bin/python -m alembic upgrade head

# Create a new migration after model changes
../.venv/bin/python -m alembic revision --autogenerate -m "description"
```

## Testing

```bash
../.venv/bin/python -m pytest
```

Requires a running MySQL instance (see [DEVELOPMENT_SETUP.md](../DEVELOPMENT_SETUP.md)).
Coverage report is generated at `htmlcov/index.html`.
