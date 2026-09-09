"""App-builder resource catalog and FastMCP registration.

Each entry binds an ``openbb://workspace/...`` URI to a markdown file shipped
inside this package. The file's YAML frontmatter doubles as the resource's
human-readable title and ``use_when`` description.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from importlib import resources
from importlib.resources.abc import Traversable
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastmcp import FastMCP


RESOURCE_PACKAGE = "workspace_mcp.app_builder"
RESOURCE_DIR = "resources"
MIME_TYPE = "text/markdown"


@dataclass(frozen=True)
class AppBuilderResource:
    """One app-builder knowledge resource backed by a packaged markdown file."""

    uri: str
    title: str
    description: str
    relative_path: str

    def read(self) -> str:
        """Return the markdown body for this resource."""
        traversable = _resource_file(self.relative_path)
        return traversable.read_text(encoding="utf-8")


_INITIAL_RESOURCES: tuple[AppBuilderResource, ...] = (
    AppBuilderResource(
        uri="openbb://workspace/app-builder/index",
        title="App Builder Index",
        description=(
            "Router for the OpenBB Workspace app-builder resources. Read this "
            "first to find the right spec, guide, or example. Only for when the "
            "user has explicitly asked to build, review, debug, or extend a "
            "backend or app — not for composing dashboards from existing widgets."
        ),
        relative_path="app-builder-index.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/overview/what-is-workspace",
        title="What Workspace Is",
        description=(
            "Mental model of OpenBB Workspace from the consumer side — "
            "Dashboards, Apps (templates), Widgets, Prompts, the AI Agent, "
            "and what is native vs. what your backend supplies."
        ),
        relative_path="overview/what-is-workspace.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/overview/ai-agent-contract",
        title="AI Agent Contract",
        description=(
            "How Workspace's built-in AI Agent reads widget metadata and data, "
            "and the description / response-shape rules that make widgets "
            "agent-friendly."
        ),
        relative_path="overview/ai-agent-contract.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/contract/backend",
        title="Backend Contract",
        description=(
            "What an OpenBB Workspace backend must expose over HTTP, "
            "language-agnostic."
        ),
        relative_path="backend-contract.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/specs/widgets-json",
        title="widgets.json Spec",
        description=(
            "Top-level shape and critical fields for widgets.json, the widget "
            "metadata contract."
        ),
        relative_path="specs/widgets-json.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/specs/apps-json",
        title="apps.json Spec",
        description=(
            "Served shape, tab/layout structure, and parameter group wiring "
            "for apps.json."
        ),
        relative_path="specs/apps-json.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/specs/widget-types",
        title="Widget Types",
        description=(
            "Catalog of widget type strings and a use-case-to-type quick "
            "selector."
        ),
        relative_path="specs/widget-types.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/specs/widget-parameters",
        title="Widget Parameters",
        description=(
            "Param types (text, number, boolean, date, endpoint), option "
            "sources, and the type-selection cheatsheet."
        ),
        relative_path="specs/widget-parameters.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/specs/layout-grid",
        title="Layout Grid and Groups",
        description=(
            "40-column grid math, tab/group conventions, and click-through "
            "navigation rules."
        ),
        relative_path="specs/layout-grid.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/guides/build-an-app",
        title="Build an App",
        description=(
            "End-to-end workflow for building a new OpenBB Workspace app from "
            "scratch. Only for when the user has explicitly asked to build one."
        ),
        relative_path="guides/build-an-app.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/guides/review-app",
        title="Review an App",
        description=(
            "Structured review pass for an existing OpenBB Workspace backend "
            "or app template."
        ),
        relative_path="guides/review-app.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/guides/debug-app",
        title="Debug an App",
        description=(
            "Diagnostic order for apps that don't load, widgets that render "
            "empty, or sync that doesn't propagate."
        ),
        relative_path="guides/debug-app.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/guides/convert-endpoint-to-widget",
        title="Convert an Existing Endpoint to a Widget",
        description=(
            "Turn an existing HTTP endpoint into a Workspace widget — type "
            "selection, params, columns, validation."
        ),
        relative_path="guides/convert-endpoint-to-widget.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/examples/generic-http/minimal",
        title="Minimal Backend (Generic HTTP)",
        description=(
            "Framework-neutral picture of an OpenBB Workspace backend — "
            "routes, response shapes, CORS, auth."
        ),
        relative_path="examples/generic-http-minimal.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/examples/python-fastapi/minimal",
        title="Minimal Backend (Python + FastAPI)",
        description=(
            "Recommended Python starter shape for an OpenBB Workspace backend "
            "using FastAPI."
        ),
        relative_path="examples/python-fastapi-minimal.md",
    ),
    AppBuilderResource(
        uri="openbb://workspace/validation/common-errors",
        title="Common Errors",
        description=(
            "Curated list of the most common widgets.json, apps.json, "
            "layout, group, and endpoint failures with fixes."
        ),
        relative_path="validation/common-errors.md",
    ),
)


def app_builder_resources() -> tuple[AppBuilderResource, ...]:
    """Return the registered app-builder resources in stable order."""
    return _INITIAL_RESOURCES


def register_app_builder_resources(
    server: FastMCP,
    *,
    resources_iter: Iterable[AppBuilderResource] | None = None,
) -> None:
    """Register every app-builder resource on the given FastMCP server."""
    items = tuple(resources_iter) if resources_iter is not None else app_builder_resources()
    for resource in items:
        _register_one(server, resource)


def _register_one(server: FastMCP, resource: AppBuilderResource) -> None:
    """Register a single resource on the server.

    The closure captures the resource so each registration reads its own file.
    """

    def read_resource() -> str:
        return resource.read()

    server.resource(
        resource.uri,
        name=resource.title,
        description=resource.description,
        mime_type=MIME_TYPE,
    )(read_resource)


def _resource_file(relative_path: str) -> Traversable:
    """Resolve a packaged resource file by relative path."""
    traversable: Traversable = resources.files(RESOURCE_PACKAGE) / RESOURCE_DIR
    for part in relative_path.split("/"):
        traversable /= part
    return traversable
