---
title: Build an App
uri: openbb://workspace/guides/build-an-app
use_when: You are building a new OpenBB Workspace app from scratch and need the workflow.
language_specific: false
related:
  - openbb://workspace/overview/what-is-workspace
  - openbb://workspace/overview/ai-agent-contract
  - openbb://workspace/contract/backend
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/apps-json
  - openbb://workspace/examples/generic-http/minimal
  - openbb://workspace/examples/python-fastapi/minimal
  - openbb://workspace/validation/common-errors
---

# Build an App

A linear workflow for going from "I want a Workspace app for X" to a working backend that Workspace can connect to.

## 0. Build the mental model first

If this is your first time, read `openbb://workspace/overview/what-is-workspace` and `openbb://workspace/overview/ai-agent-contract` before drafting anything. They cover what Workspace is, what's native vs. what your backend supplies, and how the AI Agent reads widget metadata — all of which shape design choices below.

## 1. Define the user goal and data sources

Write down, in plain English, what the user wants to see and do. Identify the actual data sources you'll call (an API, a database, a CSV, an internal service). Note any auth, rate limits, or refresh expectations now — they shape later choices.

## 2. Choose a backend implementation

Workspace is language-agnostic. Pick the framework you (or the project) already use. **FastAPI is the documented starter path** because most of OpenBB's examples are in Python — but anything that can serve JSON over HTTP works.

- Existing project? Use whatever framework it uses.
- Greenfield with no constraints? Use FastAPI. See `openbb://workspace/examples/python-fastapi/minimal`.
- Want a framework-neutral picture first? See `openbb://workspace/examples/generic-http/minimal`.

## 3. Define the HTTP contract

Read `openbb://workspace/contract/backend`. Confirm you understand:

- `GET /widgets.json` returns a JSON object keyed by widget id.
- `GET /apps.json` returns a JSON array of app templates (only if you ship templates).
- Each widget references a data endpoint. Pick paths that read well — `/stock_prices`, `/news`, `/portfolio_metrics`.
- CORS allows `https://pro.openbb.co`, `https://pro.openbb.dev`, and `http://localhost:1420`.
- Auth strategy: header (preferred), query string, or none.

## 4. Draft `widgets.json`

For each widget:

1. Pick a stable widget id (becomes the dict key and the layout's `i`).
2. Pick a business-readable `name` and description. The name should describe the metric/question, not the implementation (`Executive ESG KPI Snapshot`, not `KPI Cards`).
3. Pick the right `type`. See `openbb://workspace/specs/widget-types`. Don't default to `table` for articles or markdown for tables.
4. Define the params. See `openbb://workspace/specs/widget-parameters`. Use `boolean`, `number`, `date`, `endpoint` types — not `text` dropdowns of "true"/"false".
   - Prefer individual multi-select choices over fake aggregate options such as `All Geographies` or `2020-2024`; default all values selected when the intended starting scope is "all".
   - Keep option objects simple: usually `{label, value}`. Add `category` only when it has a concrete Workspace role.
5. For tables, sketch the columns under `data.table.columnsDefs`.
6. Decide which columns should be clickable for cross-widget navigation (`renderFn: "cellOnClick"`).

See `openbb://workspace/specs/widgets-json` for the field shape.

## 5. Draft `apps.json` (optional but usually wanted)

Skip if you're shipping a backend without canned dashboards. Otherwise:

1. Plan the tabs. Most apps fit one tab. 3–5 is a healthy ceiling.
2. Lay widgets out on the 40-column grid. Sketch on paper or in ASCII first. See `openbb://workspace/specs/layout-grid`.
3. Define parameter groups for synchronized widgets. Prefer `Group 1`, `Group 2`, ... names for strict compatibility; put human-readable meaning in descriptions/categories.
4. Add `"groups": []` and `"prompts": []` even when empty — several validators expect those keys to exist.
5. Populate `img`, `img_dark`, and `img_light` when feasible. Prefer a small served SVG/PNG via `/thumbnails/{name}` or a stable hosted image URL over empty strings.

See `openbb://workspace/specs/apps-json`.

## 6. Implement endpoints

For each widget, implement the data endpoint to return the shape the widget type expects (see `openbb://workspace/contract/backend` § "Data endpoint response expectations"):

- Tables → JSON array of row objects.
- Charts → Plotly figure JSON; support `?raw=true` for the underlying rows.
- Metrics → array of `{label, value, ...}`.
- Markdown → a markdown string.
- Newsfeed → array of `{title, date, author, excerpt, body, ...}`.

Keep things deterministic when you can — Workspace's failure messages are clearer when the endpoint is well-typed.

## 7. Validate the JSON and semantic output

Before going to the browser:

- `widgets.json` is an object (`{...}`), not an array.
- `apps.json` is an array (`[...]`), not an object.
- Layout `i` matches a key in `widgets.json`.
- Group `name` uses `Group 1`, `Group 2`, ... unless you have browser-tested descriptive names.
- Table columns live at `data.table.columnsDefs`.
- `formatterFn` uses one of `int|none|percent|normalized|normalizedPercent|dateToYear`.

Then run a semantic output pass. Schema-valid is not enough:

- Inspect the source data first: row counts, years, geographies/entities, and any explicit aggregate rows.
- Hit every widget endpoint with default params and confirm non-empty, type-correct data.
- Test at least three parameter scenarios when params exist: default, one period/category, and a meaningful subset.
- For table widgets, confirm every declared `columnsDefs[].field` exists in the endpoint output.
- For `apps.json` chart state, confirm every `chartModel.cellRange.columns` entry exists in the widget output.
- If the source provides explicit consolidated rows, use those for full consolidated defaults rather than recomputing from granular rows.
- For single-period selections, return snapshots or `delta: n/a`; do not emit fake comparisons such as `2024 vs 2024`.
- Confirm units and formatting match the metric meaning, especially intensity fields like `*_per_revenue`, `*_per_employee`, or `*_per_MEUR`.

See `openbb://workspace/validation/common-errors` for the full list.

## 8. Validate the live backend

Two paths — pick whichever is available; both validate against the same Workspace schema.

- **Preferred — `workspace_mcp`.** If you have the Workspace MCP companion connected, register the backend with `manage_backends(operation="add", url=...)` then confirm with `list_available_widgets` and `manage_apps(operation="list")`. Headless and returns structured errors.
- **Fallback — browser.** Navigate to `https://pro.openbb.co` → Settings → Data Connectors → Connect Backend → Test.

If validation fails, trust the validator over docs — the running validator is the source of truth.

## 9. Register and use

Once validation passes, the backend is registered and apps appear in the gallery. Open one to confirm the layout looks right and parameter groups link correctly. Click a row in a discovery table to confirm cross-widget navigation works.

## After it ships

- **Widget config changes**: refresh the backend in Workspace (right-click → "Refresh backend") rather than restarting your server.
- **Code changes**: restart the backend.
- **Major schema changes**: open a fresh app instance from the gallery so cached state doesn't mask the change.
