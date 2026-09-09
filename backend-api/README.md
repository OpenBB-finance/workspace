# openbb-hub

Backend and admin tooling for [OpenBB Workspace](https://openbb.co).

## Repository Structure

| Directory | Description |
|---|---|
| `backend/` | FastAPI application — API server, database models, migrations, background workers |
| `admin_cli/` | CLI tool for managing users, entities, and backend operations |
| `admin_frontend/` | Admin dashboard (Vite + React) |
| `frontend/` | Legacy Hub frontend (deprecated) |

## Getting Started

See [DEVELOPMENT_SETUP.md](DEVELOPMENT_SETUP.md) for local development instructions.

## Infrastructure

- `docker-compose.yml` — full-stack deployment (API + workers + DB + Redis)
- `docker-compose-local-dev.yml` — infrastructure only (DB + Redis + worker) for local backend development
