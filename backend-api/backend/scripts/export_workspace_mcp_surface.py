from __future__ import annotations

import argparse
import asyncio
import inspect
import json
import sys
from pathlib import Path
from typing import Any

from workspace_mcp.server import SERVER_INSTRUCTIONS, create_mcp_server
from workspace_mcp.state import BridgeSessionManager

FIXTURE_NOTE = (
    "Generated from the canonical Workspace MCP sidecar surface. Update this "
    "fixture only when the MCP contract changes intentionally."
)


async def _maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


def _normalize_message(item: Any) -> dict[str, str]:
    if isinstance(item, dict):
        return {"role": item["role"], "text": item["content"]}

    content = getattr(item, "content")
    text = getattr(content, "text", content)
    return {"role": getattr(item, "role"), "text": text}


async def _collect_workspace_mcp_surface() -> dict[str, Any]:
    state = BridgeSessionManager(
        base_url="http://127.0.0.1:8787",
        websocket_path="/bridge/ws",
        command_timeout_seconds=1,
    )
    server = create_mcp_server(state)

    tools = []
    for tool in await server.list_tools():
        tools.append(
            {
                "name": tool.name,
                "title": getattr(tool, "title", None),
                "description": tool.description,
                "parameters": tool.parameters,
                "output_schema": getattr(tool, "output_schema", None),
                "annotations": getattr(tool, "annotations", None),
                "meta": getattr(tool, "meta", None),
                "tags": sorted(getattr(tool, "tags", []) or []),
            }
        )

    resources = []
    resource_bodies = {}
    for resource in await server.list_resources():
        uri = str(resource.uri)
        resources.append(
            {
                "uri": uri,
                "name": resource.name,
                "title": getattr(resource, "title", None),
                "description": resource.description,
                "mime_type": resource.mime_type,
                "annotations": getattr(resource, "annotations", None),
                "meta": getattr(resource, "meta", None),
                "tags": sorted(getattr(resource, "tags", []) or []),
            }
        )
        result = await server.read_resource(uri)
        resource_bodies[uri] = [
            {"mime_type": content.mime_type, "content": content.content}
            for content in result.contents
        ]

    prompts = []
    for prompt in await server.list_prompts():
        raw_messages = await _maybe_await(prompt.fn())
        prompts.append(
            {
                "name": prompt.name,
                "title": getattr(prompt, "title", None),
                "description": prompt.description,
                "arguments": getattr(prompt, "arguments", []),
                "annotations": getattr(prompt, "annotations", None),
                "meta": getattr(prompt, "meta", None),
                "tags": sorted(getattr(prompt, "tags", []) or []),
                "messages": [_normalize_message(item) for item in raw_messages],
            }
        )

    return {
        "instructions": SERVER_INSTRUCTIONS,
        "tools": sorted(tools, key=lambda item: item["name"]),
        "resources": sorted(resources, key=lambda item: item["uri"]),
        "resource_bodies": resource_bodies,
        "prompts": sorted(prompts, key=lambda item: item["name"]),
    }


def collect_workspace_mcp_surface() -> dict[str, Any]:
    return asyncio.run(_collect_workspace_mcp_surface())


def fixture_payload() -> dict[str, Any]:
    return {
        "_note": FIXTURE_NOTE,
        "surface": collect_workspace_mcp_surface(),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Export the Workspace MCP surface parity fixture.",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("tests/fixtures/workspace_mcp_sidecar_surface.json"),
        help="fixture path to write",
    )
    parser.add_argument(
        "-c",
        "--check",
        action="store_true",
        help="verify the existing fixture matches the current surface",
    )
    args = parser.parse_args(argv)

    payload = fixture_payload()
    content = json.dumps(payload, sort_keys=True, indent=2) + "\n"

    if args.check:
        if not args.output.exists():
            sys.stderr.write(f"missing fixture: {args.output}\n")
            return 1
        if args.output.read_text(encoding="utf-8") != content:
            sys.stderr.write(f"stale fixture: {args.output}\n")
            return 1
        sys.stdout.write(f"fixture is current: {args.output}\n")
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content, encoding="utf-8")
    sys.stdout.write(f"wrote fixture: {args.output}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
