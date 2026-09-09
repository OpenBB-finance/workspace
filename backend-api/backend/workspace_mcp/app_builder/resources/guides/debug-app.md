---
title: Debug an App
uri: openbb://workspace/guides/debug-app
use_when: An app does not load, widgets render empty, or parameter sync isn't working, and you need a diagnostic order.
language_specific: false
related:
  - openbb://workspace/contract/backend
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/apps-json
  - openbb://workspace/validation/common-errors
---

# Debug an App

Diagnostic order — work top to bottom. The first failure usually masks everything below it, so don't jump steps.

## 1. Fetch `/widgets.json` directly

```text
GET <backend-url>/widgets.json
```

What you should see: a JSON **object** keyed by widget id. Common failures:

- Returns a JSON array → Workspace will reject it. Convert to `{ "widget_id": { ... } }`.
- 404 → route isn't registered. Check the route exists and is `GET`.
- 500 / parse error → likely a JSON file read with the wrong encoding. On Windows, defaulting to `cp1252` mangles non-ASCII. Read JSON files as UTF-8 explicitly.
- CORS error in the browser console → backend isn't allowing `https://pro.openbb.co` (or `pro.openbb.dev` / `localhost:1420`). Add the origin.

## 2. Fetch `/apps.json` directly (if the app ships templates)

```text
GET <backend-url>/apps.json
```

What you should see: a JSON **array** of app objects. Common failures:

- Returns a single object → Workspace will reject it with `Unknown App: [name]: Required` or similar. Wrap in `[ ... ]`.
- Each app missing `allowCustomization`, `groups`, `prompts` → some validators flag these as required. Add them with sensible defaults.
- Each tab missing `id`, `name`, or `layout` → required.

## 3. Validate the JSON shape

Walk these checks before debugging individual widgets:

- `widgets.json` is an object. Every entry has `name`, `type`, `endpoint`.
- `apps.json` is an array. Every layout item uses `i`, not `id`. Every `i` matches a `widgets.json` key.
- Layout coordinates are on the 40-column grid; widgets don't overlap.
- Table columns live at `data.table.columnsDefs` (not `columns`, not `data.columnsDefs`).
- `formatterFn` is one of `int|none|percent|normalized|normalizedPercent|dateToYear` (`"currency"` is invalid).

See `openbb://workspace/validation/common-errors`.

## 4. Hit each widget endpoint with default params

For each widget in `widgets.json`, request:

```text
GET <backend-url><widget.endpoint>
```

(plus the default values of any required params). What you should see depends on the widget `type`:

- `table` → JSON array of row objects.
- `chart` → Plotly figure JSON; if `?raw=true` is supported, that should return the underlying rows.
- `metric` → array of `{label, value, ...}`.
- `markdown` → a markdown string.
- `newsfeed` → array of articles.

Common failures:

- 404 → the widget's `endpoint` doesn't match any registered route.
- 200 but empty array → the endpoint runs but the data fetch returned nothing. Add logging on the backend.
- 200 but wrong shape (e.g. table endpoint returns a Plotly object) → fix the endpoint to match the widget type.
- 500 → backend exception. Check the server log.

## 5. Check CORS and auth

If the backend works from `curl` but fails in Workspace:

- CORS: open the browser devtools network tab while loading the dashboard. CORS failures show as red entries with no response body. Add the missing origin.
- Auth: if the backend requires a header or query string, confirm Workspace's backend connection has it configured (Settings → Data Connectors → edit the connection).
- Mixed content: a backend served over HTTP can't be reached from `https://pro.openbb.co`. Use HTTPS in production.

## 6. Parameter sync isn't working

Symptoms: changing a synced param in one widget doesn't update the others; the widget's link menu shows "No Active Groups."

Walk through:

- Group `name` is `Group 1`, `Group 2`, ... literally — not `"symbol-group"` or anything custom. Custom names validate but never link.
- Group `type` matches the widget param shape: `param` for `text+options`, `endpointParam` for `endpoint+optionsEndpoint`, `ticker` for OpenBB's universal ticker registry. The wrong type silently disables sync.
- The group's `widgetIds` array, every layout item's `groups: [...]`, and the widget's own param config all agree on the same `paramName`.
- For dynamic dropdowns: every widget shares the same `optionsEndpoint`. If they differ, Workspace can't link them.

## 7. Click-through doesn't propagate

Symptom: clicking a row in a discovery table doesn't update the chart or detail widgets.

- The clickable column has `renderFn: "cellOnClick"` and `renderFnParams.actionType = "groupBy"`.
- `renderFnParams.groupBy.paramName` is correct (NOT the legacy `groupByParamName` — that fails silently).
- `renderFnParams.groupBy.valueField` matches the column field that holds the value to send.
- The clickable widget AND the receiving widgets share `"groups": ["Group 1"]` in the layout AND in the group's `widgetIds`.
- The receiving widgets have a param with the matching `paramName`. If they have BOTH a `cellOnClick` column AND a visible param dropdown for the same paramName, set `"show": false` on the receiving param.

## 8. Use Workspace validation if available

The browser/MCP path exposes the *actual* validator the running Workspace uses. When the doc and the validator disagree, **trust the validator** — adjust the files to match what Workspace accepts and then update docs/comments.

- **`workspace_mcp` (preferred)**: `manage_backends(operation="add", ...)` returns schema errors directly. `list_available_widgets(backend_id=...)` and `manage_apps(operation="list", backend_id=...)` confirm what loaded.
- **Browser**: Settings → Data Connectors → Connect Backend → Test surfaces the same errors.

## 9. Refresh, don't restart, for metadata changes

- `widgets.json` / `apps.json` edits → right-click the backend → "Refresh backend".
- Code/handler edits → restart the backend.
- Major schema changes → close the dashboard and open a fresh app instance from the gallery so cached state doesn't lie to you.
