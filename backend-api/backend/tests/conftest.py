"""Test fixture registration for backend tests."""

from os import environ

pytest_plugins = [
    "tests.fixtures.hooks",
    "tests.fixtures.containers",
    "tests.fixtures.migrations",
    "tests.fixtures.db",
    "tests.fixtures.clients",
    "tests.fixtures.mocks",
]


environ["PYTEST_IS_RUNNING"] = "true"
