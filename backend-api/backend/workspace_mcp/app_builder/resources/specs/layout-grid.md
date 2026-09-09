---
title: Layout Grid and Groups
uri: openbb://workspace/specs/layout-grid
use_when: You are placing widgets, sizing them, or wiring synchronized parameter groups in apps.json.
language_specific: false
related:
  - openbb://workspace/specs/apps-json
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/widget-parameters
---

# Layout Grid and Groups

Workspace lays out widgets on a fixed grid and supports param synchronization via named groups. Both live in `apps.json`.

## Grid

- The grid is **40 columns wide**.
- Common widths: `w=40` full, `w=20` half, `w=10` quarter.
- Minimum widget width: typically 8–10 columns.
- Height is flexible. Minimum is usually 4 rows. Avoid heights above ~20 unless the content really needs it.
- A `navigation_bar` widget, when present, usually occupies `y=0` with `h=2`, so the first content row begins at `y=2`.

Each layout item lives under `tabs[].layout[]` with the shape:

```json
{ "i": "widget_id", "x": 0, "y": 2, "w": 40, "h": 12, "groups": ["Group 1"] }
```

Use `i` for the widget id (not `id`). Use `x`, `y`, `w`, `h` directly (not nested in `gridData`).

## Suggested heights by widget type

| Widget type | Recommended `h` |
|-------------|------------------|
| `metric` | 4–6 |
| `table` (small) | 8–12 |
| `table` (medium) | 12–15 |
| `chart` | 12–15 |
| `newsfeed` | 12–15 |
| `markdown` | 8–12 |

## Tabs

Tabs organize app sections. Use one tab when the dashboard fits on one screen; split into multiple tabs only when it actually helps the user. 3–5 tabs is a healthy ceiling.

For a single, unnamed tab use empty strings:

```json
"tabs": { "": { "id": "", "name": "", "layout": [ ... ] } }
```

## Parameter groups

Groups synchronize a parameter (e.g. `symbol`) across multiple widgets. The runtime is strict:

1. **Group `name` must follow the literal `Group 1`, `Group 2`, ...** Custom names like `"symbol-group"` validate but don't link.
2. **Group `type` must match the widget param's shape** — see `openbb://workspace/specs/apps-json`.
3. **Three places must agree:** `groups[].widgetIds`, each layout item's `groups: ["Group N"]`, and each widget's own param config.

Group object shape:

```json
{
  "name": "Group 1",
  "type": "endpointParam",
  "paramName": "symbol",
  "widgetIds": ["watchlist", "price_chart"],
  "defaultValue": "AAPL"
}
```

## Click-through navigation (apply aggressively)

The single biggest UX upgrade: clicking a row in a discovery table updates the rest of the dashboard. Audit every `table` widget for it before declaring an app done.

**The rule.** For every table column, check the column's `field`. If any `field` matches a `paramName` used by an app-level group (and the cell value is what the param expects, e.g. a ticker symbol), that column MUST have:

```json
{
  "field": "ticker",
  "headerName": "Ticker",
  "cellDataType": "text",
  "pinned": "left",
  "renderFn": "cellOnClick",
  "renderFnParams": {
    "actionType": "groupBy",
    "groupBy": { "paramName": "symbol", "valueField": "ticker" }
  }
}
```

**Requirements for the click to actually fire:**

1. The clickable widget AND target widgets share `"groups": ["Group 1"]` in the layout.
2. Target widgets expose a parameter matching `paramName` (e.g. `symbol`).
3. The clickable widget is also listed in the group's `widgetIds`.
4. Use `renderFnParams.groupBy.paramName`, not `groupByParamName` (legacy name fails silently).
5. Use `valueField` when the cell display differs from the param value (e.g. showing "Apple Inc." but sending "AAPL").

**Discovery widgets (top movers, screeners, watchlists, IPO calendars, peer comparisons) belong in the symbol group's `widgetIds` AND their layout entry must include `"groups": ["Group 1"]` — even if the widget itself has no `symbol` param.** They emit clicks; they don't receive them.

**Sharp edge — `cellOnClick` plus a visible duplicate dropdown breaks the interaction.** If a widget has BOTH a `cellOnClick` column targeting param `X` AND that same `X` exposed as a visible dropdown in its own `params`, the click stops propagating reliably and the user gets a confusing dual-control UX. Pick one:

- Keep the cellOnClick. Add `"show": false` to that param so the dropdown is hidden.
- Or drop the cellOnClick from the column.

This rule applies only when the widget *receives* the click-targeted param. Pure-emitter widgets are unaffected.

## Build-time audit checklist

- [ ] Every `ticker`/`symbol` column in every table has `cellOnClick` with the right `groupBy`.
- [ ] Every discovery table is in the symbol group's `widgetIds`.
- [ ] Every layout entry that participates has `"groups": ["Group 1"]`.
- [ ] For widgets that have BOTH a cellOnClick column AND a matching param: the param has `"show": false`.
- [ ] Render in Workspace and click a row — confirm other widgets refresh.

## What this spec does not cover

- Required `apps.json` fields and tab/layout schema — see `openbb://workspace/specs/apps-json`.
- Widget-side param definitions — see `openbb://workspace/specs/widget-parameters`.
- Type cheatsheet for groups — covered in `openbb://workspace/specs/apps-json`.
