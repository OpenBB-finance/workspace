---
title: App Builder Index
uri: openbb://workspace/app-builder/index
use_when: You are about to build, review, debug, or extend an OpenBB Workspace app and need to find the right resource to read next.
language_specific: false
related:
  - openbb://workspace/overview/what-is-workspace
  - openbb://workspace/overview/ai-agent-contract
  - openbb://workspace/contract/backend
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/apps-json
  - openbb://workspace/guides/build-an-app
---

# OpenBB Workspace App Builder

OpenBB Workspace apps are **language-agnostic HTTP backends plus JSON metadata contracts**. A backend can be written in any language or framework; Workspace only requires that it expose the right endpoints and return the right JSON shapes. FastAPI is the recommended starter path because most current examples use Python — not because Workspace requires Python.

## How to use this resource set

If this is your first time touching Workspace, read the two **overview** docs before anything else — they are the consumer-side mental model. Then read the contract, then the spec for the file you are touching, then a guide for the workflow you are in. Examples are read on demand.

| You are about to… | Read |
|-------------------|------|
| **Build a mental model of what Workspace is** | `openbb://workspace/overview/what-is-workspace` |
| **Make widgets the AI Agent can actually use** | `openbb://workspace/overview/ai-agent-contract` |
| Understand what a backend must expose | `openbb://workspace/contract/backend` |
| Author or edit `widgets.json` | `openbb://workspace/specs/widgets-json` + `openbb://workspace/specs/widget-types` + `openbb://workspace/specs/widget-parameters` |
| Author or edit `apps.json` | `openbb://workspace/specs/apps-json` + `openbb://workspace/specs/layout-grid` |
| Build a brand-new app | `openbb://workspace/guides/build-an-app` |
| Review someone else's app | `openbb://workspace/guides/review-app` + `openbb://workspace/validation/common-errors` |
| Debug an app that doesn't load | `openbb://workspace/guides/debug-app` + `openbb://workspace/validation/common-errors` |
| Wrap an existing HTTP endpoint as a widget | `openbb://workspace/guides/convert-endpoint-to-widget` |
| Want a framework-neutral picture of the backend | `openbb://workspace/examples/generic-http/minimal` |
| Want the recommended Python starter | `openbb://workspace/examples/python-fastapi/minimal` |

## Reminders

- The backend is HTTP-only. Workspace never imports your code.
- `widgets.json` is a JSON **object** keyed by widget id. Not an array.
- `apps.json` is a JSON **array** of app objects. Not an object.
- Layout uses `i` for the widget id, not `id`.
- Prefer `Group 1`, `Group 2`, ... names for parameter groups; put human-readable meaning in descriptions/categories.
- A schema-valid app still needs a semantic output pass: verify default aggregates, parameter scenarios, units, table columns, and chart state columns.
- Try to ship app thumbnails via `img`, `img_dark`, and `img_light`; a small backend-served SVG is enough.
- FastAPI is one option. Use whatever fits the project.

## Out of scope here

This resource is a router. It does not contain the specs themselves. If you need the shape of a field, read the matching spec resource instead of inferring.
