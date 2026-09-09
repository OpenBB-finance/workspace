"""Alembic migration fixture."""

import os

import pytest
from alembic import command
from alembic.config import Config

from .base import _seed_pro_entities


@pytest.fixture(scope="session")
def apply_migrations(db_containers):
    """Apply all migrations to the test database once per session."""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    alembic_cfg_path = os.path.join(base_dir, "alembic.ini")

    if not os.path.exists(alembic_cfg_path):
        raise FileNotFoundError(f"Alembic ini not found at {alembic_cfg_path}")

    alembic_cfg = Config(alembic_cfg_path)

    cwd = os.getcwd()
    os.chdir(base_dir)
    try:
        command.upgrade(alembic_cfg, "head")
    finally:
        os.chdir(cwd)

    _seed_pro_entities()

    yield
