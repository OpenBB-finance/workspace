import json
from functools import cache
from pathlib import Path

import pytest

from scripts.export_workspace_mcp_surface import collect_workspace_mcp_surface


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "workspace_mcp_sidecar_surface.json"


@pytest.fixture(autouse=True)
def mock_external_services():
    yield


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    yield


@cache
def _expected_surface() -> dict[str, object]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))["surface"]


@cache
def _actual_surface() -> dict[str, object]:
    return collect_workspace_mcp_surface()


def test_mcp_server_instructions_match_sidecar_fixture():
    assert _actual_surface()["instructions"] == _expected_surface()["instructions"]


def test_mcp_tools_match_sidecar_fixture():
    assert _actual_surface()["tools"] == _expected_surface()["tools"]


def test_mcp_resources_match_sidecar_fixture():
    actual = _actual_surface()
    expected = _expected_surface()

    assert actual["resources"] == expected["resources"]
    assert actual["resource_bodies"] == expected["resource_bodies"]


def test_mcp_prompts_match_sidecar_fixture():
    assert _actual_surface()["prompts"] == _expected_surface()["prompts"]
