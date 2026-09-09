---
title: Review an App
uri: openbb://workspace/guides/review-app
use_when: You are reviewing an existing OpenBB Workspace backend or app template and need a structured pass.
language_specific: false
related:
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/apps-json
  - openbb://workspace/specs/layout-grid
  - openbb://workspace/validation/common-errors
---

# Review an App

A structured pass for reviewing an existing app. Read the file you're reviewing first, then walk this list. Don't review prose; review the **contract correctness** first because broken contracts mask everything else.

## 1. Contract correctness

- Does the backend serve `GET /widgets.json` returning a JSON **object**?
- If app templates are shipped, does it serve `GET /apps.json` returning a JSON **array**?
- Are CORS origins configured for `https://pro.openbb.co`, `https://pro.openbb.dev`, and `http://localhost:1420`?
- If the backend is reached from `https://pro.openbb.co` in production, is it served over HTTPS?
- Is the auth path explicit? (header, query string, or none — pick one and document it)

If any of these are wrong, fix before reviewing further.

## 2. `widgets.json` shape

- Top level is an object keyed by widget id.
- Each widget has `name`, `type`, `endpoint`.
- `type` is a real Workspace type (`table`, `chart`, `metric`, `markdown`, `newsfeed`, `live_grid`, etc.). No invented aliases.
- Every param has `paramName`, `type`, `label`, `description`, and a sensible `value`.
- Param types match shape: `boolean` for toggles, `number` for free-form integers, `date` for dates, `endpoint` for dropdowns from a backend.
- Dropdown option objects are simple unless an advanced picker is intentional: usually `{label, value}`. Do not add `extraInfo` by default.
- Multi-select dimensions expose real individual choices. Avoid fake options like `All Geographies` or `2020-2024` unless the backend intentionally treats them as real domain values.
- Table columns are at `data.table.columnsDefs` — not at `columns` and not at `data.columnsDefs`.
- `formatterFn` uses one of `int|none|percent|normalized|normalizedPercent|dateToYear`. (`"currency"` is invalid — use `"none"`.)
- `runButton` is `false` (or absent) unless the work is genuinely heavy (>5 s).
- Widget names and descriptions explain the business content. Names like `KPI Cards` and descriptions like `AG Grid combo chart` are too implementation-focused unless that is the user's explicit language.

See `openbb://workspace/specs/widgets-json` and `openbb://workspace/specs/widget-parameters`.

## 3. `apps.json` shape

- Top level is an array of app objects.
- Each app has `name`, `tabs`, `allowCustomization`. `groups` and `prompts` are present even when `[]`.
- `img`, `img_dark`, and `img_light` are populated when a reasonable thumbnail exists; if blank, note it as a polish gap.
- Each tab has `id`, `name`, `layout`.
- Each layout item uses `i` (not `id`), plus `x`, `y`, `w`, `h`.
- Every layout item's `i` matches a key in `widgets.json`.
- Group `name` follows the literal `Group 1`, `Group 2`, ... pattern.
- Group `type` matches the underlying widget param shape: `param` for static `text+options`, `endpointParam` for `endpoint+optionsEndpoint`, `ticker` for OpenBB's universal ticker registry.
- `groups[].widgetIds`, every layout item's `groups: [...]`, and the widget's own param config all agree.

See `openbb://workspace/specs/apps-json`.

## 4. Layout and widget endpoint compatibility

- Coordinates land on the 40-column grid; widgets don't overlap.
- Tab heights make sense per type (metrics 4–6, tables 8–15, charts 12–15).
- Each widget's data endpoint is reachable and returns the shape its `type` expects (table → array of rows, chart → Plotly JSON, etc.).
- Endpoints honor the params their `widgets.json` declares.
- Every table endpoint row contains every declared `data.table.columnsDefs[].field`.
- Every `apps.json` chart state column (`chartModel.cellRange.columns`) exists in the referenced widget's output.

## 4.5 Semantic data correctness

After contract shape passes, review whether the numbers and parameter behavior make sense:

- Inspect source data dimensions: row counts, categories, time periods, entities, and explicit aggregate rows.
- Compare default aggregate outputs to official aggregate/source rows when they exist. Do not silently recompute consolidated totals from granular rows if the source already provides consolidated rows.
- Test at least three parameter scenarios: default, one period/category, and a meaningful subset.
- Single-period selections should show snapshots or `delta: n/a`, not fake deltas such as `2024 vs 2024`.
- Units and formatting should match the metric meaning, especially intensity fields like `*_per_revenue`, `*_per_employee`, or `*_per_MEUR`.
- Source-table widgets named `Master Database`, `Raw Data`, or similar should serve the full source table as-is unless the user asked for filters.

## 5. Click-through and discovery

For every `table` widget:

- If a column's `field` matches a synced `paramName` (e.g. `ticker` → `symbol`), the column has `renderFn: "cellOnClick"` with `renderFnParams.actionType = "groupBy"` and the right `groupBy.paramName`/`valueField`.
- Discovery tables (movers, screeners, watchlists, IPO calendars, peer comparisons) are listed in the symbol group's `widgetIds` AND have `"groups": ["Group 1"]` on their layout entry — even when they have no `symbol` param.
- Widgets that BOTH receive a synced param AND have a `cellOnClick` column for it use `"show": false` on the receiving param. Otherwise the dual-control breaks the click.

## 6. Common Workspace validation failures

Walk `openbb://workspace/validation/common-errors`. Most reviews find at least one entry from that list.

## 7. Encoding, performance, and tests

- File reads that serve JSON specify UTF-8 explicitly.
- Heavy/slow endpoints either set `runButton: true` or document a caching/throttling story.
- Live endpoint validation has been run (or is easy to run): start the backend, hit `/widgets.json`, hit `/apps.json`, hit each widget endpoint with default params.

## Reporting findings

When you write the review:

- Lead with **broken contract issues** (Workspace can't load the backend). These are blockers.
- Then **shape issues** in `widgets.json` / `apps.json` (Workspace loads but specific widgets fail).
- Then **UX issues** (click-through, discovery, type mismatches that work but feel dead).
- Then **nice-to-haves** (descriptions, heights, prompts).

A reviewer's job is to find *the cheapest fix* that produces the biggest UX uplift — usually that's wiring `cellOnClick` correctly on the discovery tables, not ratcheting borderWidth.
