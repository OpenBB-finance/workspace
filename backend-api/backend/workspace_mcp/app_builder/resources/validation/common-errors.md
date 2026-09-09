---
title: Common Errors
uri: openbb://workspace/validation/common-errors
use_when: A widget or app failed to load and you want a curated list of the most likely shape, layout, and contract failures.
language_specific: false
related:
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/apps-json
  - openbb://workspace/specs/layout-grid
  - openbb://workspace/guides/debug-app
---

# Common Errors

The mistakes that catch real apps. When validation fails, walk this list before exploring.

## `widgets.json` shape

| Symptom | Cause | Fix |
|---------|-------|-----|
| `widgets.json must be object` | Top-level is `[ ... ]` | Change to `{ "widget_id": { ... } }` |
| `Missing required field: name` | Widget has no `name` | Add `"name": "Widget Name"` |
| `Invalid widget type: xxx` | Typo or invented alias | Use a real type — `table`, `chart`, `metric`, `markdown`, `newsfeed`, `table_ssrm`, `live_grid`, `advanced_charting`, `chart-highcharts` |
| `Invalid formatterFn: currency` | `"currency"` is not a valid value | Use `"none"` and pre-format the value if needed |
| `data.columnsDefs must be an array` | Columns nested at the wrong path | Move to `data.table.columnsDefs` |
| `gridData.w out of range` | Width too small/large | Use `w` between 10 and 40 |
| Widget endpoint 404 | Path mismatch | Confirm `endpoint` matches a real route |

## `apps.json` shape

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Unknown App: [name]: Required` | apps.json is an object, not array | Wrap in `[ ... ]` |
| `[tabs]: Required` | Missing or wrong tab structure | Each tab needs `id`, `name`, `layout` |
| `allowCustomization: Required` | Field missing | Add `"allowCustomization": true` |
| App has no thumbnail | `img`, `img_dark`, and `img_light` are empty | Prefer a stable hosted image URL or serve a small SVG/PNG from `/thumbnails/{name}` |
| `groups: Recommended` | `groups` field absent | Add `"groups": []` as the safe default |
| `prompts: Required` | `prompts` field absent | Add `"prompts": []` as the safe default |
| `Widget 'xxx' not found` | Layout `i` doesn't match any widget id | Fix typo or align with `widgets.json` keys |
| `Widgets overlap at (x,y)` | Layout collision | Adjust `x`/`y`/`w`/`h` |
| `id` rejected | Top-level `id` doesn't match `^custom-.+` | Use `custom-<slug>` or omit `id` |

## Layout fields

| Symptom | Cause | Fix |
|---------|-------|-----|
| Widget never appears | Layout used `id` instead of `i` | Rename the key to `i` |
| Coordinates ignored | Layout used `gridData: {x,y,w,h}` | Use `x`, `y`, `w`, `h` directly on the layout item |
| Click-through silently broken | Used `groupByParamName` (legacy) | Use `renderFnParams.groupBy.paramName` |
| Click-through doesn't propagate | Widget receives the param AND has a visible matching dropdown | Set `"show": false` on the receiving param, or remove the `cellOnClick` |

## Parameter groups

| Symptom | Cause | Fix |
|---------|-------|-----|
| Group exists, no widget joins | Group `name` may not be compatible with runtime group matching | Prefer `Group 1`/`Group 2`/... and put human-readable meaning in `description`/`category`; browser-test custom names before shipping |
| Group exists but sync silently disabled | Group `type` doesn't match the underlying param shape | `param` for static `text+options`, `endpointParam` for `endpoint+optionsEndpoint`, `ticker` for OpenBB's universal ticker registry |
| Sync works for some widgets, not others | A widget is missing from the group's `widgetIds`, or its layout entry is missing `"groups": [...]`, or its widget config uses a different `paramName`/`optionsEndpoint` | Make all three places agree |
| Discovery widget doesn't drive the dashboard | Discovery widget isn't in the symbol group | Add it to `widgetIds` and add `"groups": ["Group 1"]` to its layout entry |

## Endpoint and CORS

| Symptom | Cause | Fix |
|---------|-------|-----|
| CORS error in browser | Backend doesn't allow the Workspace origin | Add `https://pro.openbb.co`, `https://pro.openbb.dev`, `http://localhost:1420` |
| `Mixed content blocked` | HTTPS Workspace can't reach HTTP backend | Serve the backend over HTTPS in production |
| 404 on widget endpoint | Path typo or missing route | Confirm the route is registered; match `endpoint` exactly |
| Wrong response shape | Endpoint returns the wrong kind of JSON for the widget type | Tables → array of rows; charts → Plotly figure JSON; metrics → array of `{label, value, ...}`; markdown → string; newsfeed → array of articles |
| Garbled non-ASCII | JSON file read with OS locale (cp1252 on Windows) | Open files with `encoding="utf-8"` (Python) or your language's UTF-8 equivalent |

## State and styling

| Symptom | Cause | Fix |
|---------|-------|-----|
| `state.style` field rejected | `state.style` is closed | Use only `borderWidth` (0–24), `radius` (0–64), `contentPadding` (0–64), `shadow` (`none|sm|md|lg`) |
| `state.style.headerMode` set, no visible effect | Schema accepts it; renderer ignores it | Remove |
| Speculative `state.*` field appears to do nothing | Schema-but-not-runtime field | Remove unless verified visually in Workspace |

## When the doc and the validator disagree

Trust the running validator. Workspace's actual validator is the source of truth — adjust the files to match what it accepts, then update docs.

- **Preferred check** — `workspace_mcp`: `manage_backends(operation="add", url=...)` returns schema errors directly.
- **Browser check**: Settings → Data Connectors → Connect Backend → Test.

See `openbb://workspace/guides/debug-app` for the full diagnostic order.
