"""Shared utilities for Workspace MCP tool handlers.

Response builders, command-payload translators, and small predicates used by
more than one tool module.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any, get_args
from uuid import uuid4

from workspace_mcp.models import (
    ParamOptionsRequest,
    WidgetDataRequest,
    WorkspaceWidgetConfig,
)
from workspace_mcp.state import BridgeSessionManager

type ToolResponse = dict[str, Any]
type CommandRunner = Callable[[Any], Awaitable[ToolResponse]]

RESULT_REF_URI_TEMPLATE = "openbb://workspace/results/{result_id}"


class ResultOffloadStore:
    """Keep the last few offloaded full tool results, FIFO-evicted.

    Stored per sidecar process for the session's lifetime; no TTL.
    """

    def __init__(self, max_entries: int = 15):
        self._max_entries = max_entries
        self._entries: dict[str, Any] = {}

    def put(self, data: Any) -> str:
        """Store one full result payload and return its result_id."""
        result_id = uuid4().hex
        self._entries[result_id] = data
        while len(self._entries) > self._max_entries:
            self._entries.pop(next(iter(self._entries)))
        return result_id

    def get(self, result_id: str) -> Any:
        """Return the stored payload; raises KeyError when missing or evicted."""
        return self._entries[result_id]


def maybe_offload_result(
    result: ToolResponse,
    store: ResultOffloadStore,
    threshold: int,
    *,
    summarize: Callable[[Any], dict[str, Any]],
    message_template: str,
) -> ToolResponse:
    """Offload a large successful result's data behind an MCP resource.

    Returns the result unchanged when it failed, has no data, or its serialized
    data fits within ``threshold`` chars. Otherwise stores the full data in
    ``store``, replaces ``data`` with ``summarize(data)`` plus ``truncated`` and
    ``result_ref``, and appends ``message_template`` (formatted with ``uri``) to
    the result message.
    """
    data = result.get("data")
    if not result.get("ok") or data is None:
        return result
    if len(json.dumps(data, default=str)) <= threshold:
        return result

    result_id = store.put(data)
    uri = RESULT_REF_URI_TEMPLATE.format(result_id=result_id)
    compact = summarize(data)
    compact["truncated"] = True
    compact["result_ref"] = uri
    note = message_template.format(uri=uri)
    message = f"{result.get('message') or ''} {note}".strip()
    return {**result, "data": compact, "message": message}


def literal_values(alias: Any) -> list[str]:
    """Return the string members of a ``type X = Literal[...]`` alias."""
    return list(get_args(alias.__value__))


# ---------------------------------------------------------------------------
# Widget config builders
# ---------------------------------------------------------------------------


def widget_config(
    *,
    data_args: dict[str, Any] | None,
    ui_args: dict[str, Any] | None,
):
    """Build widget config only when the caller supplied config values."""
    if data_args is None and ui_args is None:
        return None
    return WorkspaceWidgetConfig(data_args=data_args, ui_args=ui_args)


def required_widget_config(
    *, data_args: dict[str, Any] | None, ui_args: dict[str, Any] | None
):
    """Build widget config for commands that always expect the field."""
    return (
        widget_config(data_args=data_args, ui_args=ui_args) or WorkspaceWidgetConfig()
    )


def payload_list(items: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Normalize list payloads so MCP callers can omit optional arrays."""
    return items or []


def has_layout_ui_args(ui_args: dict[str, Any] | None) -> bool:
    """Detect layout-oriented widget UI args that need the layout tool instead."""
    if not isinstance(ui_args, dict):
        return False

    return any(
        key in ui_args
        for key in (
            "x",
            "y",
            "w",
            "h",
            "min_w",
            "min_h",
            "max_w",
            "max_h",
            "minW",
            "minH",
            "maxW",
            "maxH",
            "grid_data",
            "gridData",
            "inner_tab",
            "innerTab",
        )
    )


def is_generative_only_widget(widget_id: str) -> bool:
    """Return whether the widget must be created through add_generative_widget."""
    return widget_id == "rich_note"


# ---------------------------------------------------------------------------
# Tool error envelopes
# ---------------------------------------------------------------------------


def invalid_request(
    command: str, message: str, *, details: dict[str, Any] | None = None
) -> ToolResponse:
    """Build a standard invalid-request tool response."""
    return {
        "ok": False,
        "command": command,
        "request_id": None,
        "message": message,
        "data": None,
        "error": {
            "code": "invalid_request",
            "message": message,
            "details": details,
            "retryable": False,
        },
        "warnings": [],
    }


def require_widget_identifier(
    command: str, *, widget_uuid: str | None, widget_id: str | None
) -> ToolResponse | None:
    """Reject widget-instance commands that carry no usable identifier."""
    if widget_uuid or widget_id:
        return None
    return invalid_request(
        command,
        f"{command} requires widget_uuid (preferred) or widget_id. "
        "Get widget_uuid from manage_dashboard operation='read' or "
        "get_workspace_snapshot.dashboard_composition.",
        details={"required_one_of": ["widget_uuid", "widget_id"]},
    )


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------

_CHART_PARAM_ALIASES: dict[str, str] = {
    "chart_type": "chartType",
    "x_key": "xKey",
    "y_key": "yKey",
    "angle_key": "angleKey",
    "callout_label_key": "calloutLabelKey",
}


def normalize_chart_params(
    chart_params: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Translate snake_case chart_params aliases into the camelCase bridge keys.

    The camelCase key wins when both spellings are present; unknown keys pass
    through untouched.
    """
    if not isinstance(chart_params, dict):
        return chart_params
    normalized: dict[str, Any] = {}
    for key, value in chart_params.items():
        camel_key = _CHART_PARAM_ALIASES.get(key, key)
        if camel_key != key and camel_key in chart_params:
            continue
        normalized[camel_key] = value
    return normalized


def validate_add_generative_widget_request(
    *,
    widget_type: str,
    data: list[dict[str, Any]] | str | None,
    chart_params: dict[str, Any] | None,
) -> str | None:
    """Validate widget-type-specific generative widget payload requirements."""
    if widget_type in {"note", "html"}:
        if not isinstance(data, str):
            return (
                f"add_generative_widget with widget_type='{widget_type}' "
                "requires string data."
            )
        return None
    if not isinstance(data, list):
        return (
            f"add_generative_widget with widget_type='{widget_type}' "
            "requires data as list[dict]."
        )
    if widget_type != "chart":
        return None

    chart_config = chart_params if isinstance(chart_params, dict) else {}
    y_key = chart_config.get("yKey")
    invalid_chart_params = (
        not isinstance(chart_params, dict)
        or not isinstance(chart_config.get("chartType"), str)
        or not isinstance(chart_config.get("xKey"), str)
        or not isinstance(y_key, list)
        or not y_key
        or not all(isinstance(item, str) for item in y_key)
    )
    if invalid_chart_params:
        return (
            "add_generative_widget with widget_type='chart' requires chart_params "
            "with chartType, xKey, and non-empty yKey."
        )

    return None


# ---------------------------------------------------------------------------
# Browser-bridge payload translators
# ---------------------------------------------------------------------------


def data_source_payloads(items: list[WidgetDataRequest]) -> list[dict[str, Any]]:
    """Translate MCP-facing widget data items into the browser command shape."""
    return [
        {
            "origin": item.origin,
            "id": item.widget_id,
            "input_args": item.data_args,
            "widget_uuid": item.widget_uuid,
            "ssm_request": item.ssm_request,
        }
        for item in items
    ]


def param_options_payloads(items: list[ParamOptionsRequest]) -> list[dict[str, Any]]:
    """Translate MCP-facing option-query items into the browser command shape."""
    return [
        {
            "origin": item.origin,
            "id": item.widget_id,
            "param": item.param_name,
            "options_endpoint_input_args": item.data_args,
        }
        for item in items
    ]


# ---------------------------------------------------------------------------
# Prompt content builders
# ---------------------------------------------------------------------------


def session_context_prompt_content(state: BridgeSessionManager) -> str:
    """Describe the currently tracked dashboard and tab session context."""
    session = state.get_session_context()
    if session is None:
        return "No Workspace browser session context is currently available."

    dashboard_id = session.current_dashboard_id or "none"
    tab_id = session.current_tab_id or "none"
    return (
        "Current Workspace browser session context: "
        f"current_dashboard_id={dashboard_id}; "
        f"current_tab_id={tab_id}."
    )
