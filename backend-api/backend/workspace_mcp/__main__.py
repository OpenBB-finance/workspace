"""CLI entrypoint for the Workspace MCP sidecar."""

import argparse
import os

import uvicorn

from workspace_mcp.app import create_app
from workspace_mcp.config import ENV_PREFIX, Settings, parse_csv


def parse_cors_allow_origins(values: list[str] | None) -> tuple[str, ...]:
    """Parse repeated or comma-separated CORS origin arguments."""
    if not values:
        return ()
    origins: list[str] = []
    for value in values:
        origins.extend(parse_csv(value))
    return tuple(origins)


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser for the sidecar."""
    parser = argparse.ArgumentParser(
        description="Run the OpenBB Workspace MCP sidecar.",
        epilog="Example: workspace-mcp --host 127.0.0.1 --port 8787 --mcp-path /mcp",
    )
    parser.add_argument(
        "-H",
        "--host",
        default="127.0.0.1",
        help="Host interface for the sidecar HTTP server.",
    )
    parser.add_argument(
        "-p",
        "--port",
        type=int,
        default=8787,
        help="Port for the sidecar HTTP server.",
    )
    parser.add_argument(
        "-m",
        "--mcp-path",
        default="/mcp",
        help="Path for the FastMCP streamable HTTP endpoint.",
    )
    parser.add_argument(
        "-t",
        "--command-timeout-seconds",
        type=float,
        default=15.0,
        help="Seconds to wait for one browser command result.",
    )
    parser.add_argument(
        "-r", "--reload", action="store_true", help="Enable hot reload on code changes"
    )
    parser.add_argument(
        "-c",
        "--cors-allow",
        action="append",
        metavar="ORIGIN",
        help=(
            "CORS origin to allow. Repeat the flag or use comma-separated origins. "
            "When omitted, local loopback origins are allowed."
        ),
    )
    return parser


def main() -> None:
    """Run the sidecar server."""
    parser = build_parser()
    args = parser.parse_args()
    settings = Settings(
        host=args.host,
        port=args.port,
        mcp_path=args.mcp_path,
        command_timeout_seconds=args.command_timeout_seconds,
        cors_allow_origins=parse_cors_allow_origins(args.cors_allow),
    )
    if args.reload:
        for key, value in {
            "HOST": settings.host,
            "PORT": settings.port,
            "MCP_PATH": settings.mcp_path,
            "HEALTH_PATH": settings.health_path,
            "SESSION_START_PATH": settings.session_start_path,
            "WEBSOCKET_PATH": settings.websocket_path,
            "COMMAND_TIMEOUT_SECONDS": settings.command_timeout_seconds,
            "CORS_ALLOW_ORIGINS": ",".join(settings.cors_allow_origins),
        }.items():
            os.environ[f"{ENV_PREFIX}{key}"] = str(value)

        uvicorn.run(
            "workspace_mcp.app:create_app",
            host=settings.host,
            port=settings.port,
            reload=True,
            factory=True,
        )
        return

    uvicorn.run(create_app(settings), host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
