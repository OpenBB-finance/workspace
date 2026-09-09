"""Pytest hooks for backend test suite."""

import pathlib
import pytest


def pytest_collection_modifyitems(items):
    """Automatically mark all tests in this directory with @pytest.mark.integration."""
    integration_dir = pathlib.Path(__file__).resolve().parents[1]

    for item in items:
        if str(integration_dir) in str(item.fspath):
            item.add_marker(pytest.mark.integration)
