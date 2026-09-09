---
title: Convert an Existing Endpoint to a Widget
uri: openbb://workspace/guides/convert-endpoint-to-widget
use_when: You already have an HTTP endpoint that returns JSON and want to expose its response as a Workspace widget.
language_specific: false
related:
  - openbb://workspace/specs/widget-types
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/widget-parameters
  - openbb://workspace/examples/generic-http/minimal
---

# Convert an Existing Endpoint to a Widget

Use this when the backend already exists and you need to wrap one of its endpoints as a Workspace widget. The work is mostly metadata authoring, not code.

## 1. Inspect a sample response

Hit the endpoint with realistic params and read the JSON. Note:

- Top-level shape: array of objects, single object, string, Plotly figure?
- Field names and value types.
- Any timestamp fields and their format.
- Whether numbers are pre-formatted strings or raw numbers.
- Whether the endpoint already supports query params, and how it interprets unknown ones.

## 2. Choose the widget type

Match the response shape to a widget type. See `openbb://workspace/specs/widget-types` for the catalog and the "choose this, not that" rules.

| Sample response shape | Widget type |
|------------------------|-------------|
| Array of row objects with `symbol`, `price`, ... | `table` |
| Plotly figure JSON (`{data, layout}`) | `chart` |
| Array of `{label, value, delta, ...}` cards | `metric` |
| Long markdown string | `markdown` |
| Array of `{title, date, author, excerpt, body, ...}` | `newsfeed` |
| WebSocket or push-style streaming rows | `live_grid` |
| File / PDF collection metadata | `multi_file_viewer` |

If the shape doesn't match any widget type cleanly, change the endpoint to fit the closest type — don't try to force the wrong renderer.

## 3. Pick `endpoint`, `name`, and `widget_id`

- `widget_id` (the dict key in `widgets.json`) should be stable, snake-cased, descriptive. It's referenced from `apps.json` layouts.
- `name` is the user-visible widget title.
- `endpoint` is the path Workspace calls. It's typically the same path your existing handler is on; it doesn't have to match the widget id.

## 4. Translate query params to widget params

Every query param the endpoint accepts becomes a `params` entry in `widgets.json`. Pick the right `type`:

- `boolean` for toggles (don't use `text` with `"true"`/`"false"` options).
- `number` for free-form integers.
- `date` with `$currentDate` modifiers for date inputs.
- `endpoint` with `optionsEndpoint` for dropdowns whose values come from another endpoint.
- `text` with `options` only for genuinely curated short lists (e.g. interval presets).

Every param needs `paramName`, `type`, `label`, `description`, and a sensible `value`. See `openbb://workspace/specs/widget-parameters`.

If a param depends on another (e.g. `city` depends on `country`), wire it via `optionsParams: { "country": "$country" }`.

## 5. Infer columns or chart fields

For `table`:

```json
"data": {
  "table": {
    "columnsDefs": [
      { "field": "symbol", "headerName": "Symbol", "cellDataType": "text", "pinned": "left" },
      { "field": "price",  "headerName": "Price",  "cellDataType": "number", "formatterFn": "none" },
      { "field": "change_pct", "headerName": "Change %", "cellDataType": "number", "formatterFn": "percent", "renderFn": "greenRed" }
    ]
  }
}
```

- Use `formatterFn`: `int`, `none`, `percent`, `normalized`, `normalizedPercent`, `dateToYear`. **`"currency"` is invalid** — use `"none"` and pre-format if needed.
- Use `renderFn` for visual treatment: `greenRed` for up/down, `cellOnClick` for navigation, `hoverCard` for markdown previews.
- Pin identifier columns left (`pinned: "left"`).

For per-row mini-charts, set `sparkline` on a column (`type` of `line`, `bar`, or `area`):

```json
{ "field": "trend", "headerName": "30d",
  "sparkline": { "type": "line", "options": { "stroke": "#2563eb", "strokeWidth": 2 } } }
```

To let users flip the whole table into a chart, set `data.table.chartView`:

```json
"data": {
  "table": {
    "chartView": { "enabled": true, "chartType": "line",
      "chartNavigatorEnabled": true, "chartMiniChartEnabled": true },
    "columnsDefs": [ ... ]
  }
}
```

Supported `chartType`s include `line`, `bar`/`groupedBar`/`stackedBar`, `column`/`groupedColumn`/`stackedColumn`, `area`/`stackedArea`, `pie`, `donut`, `scatter`, `bubble`, `histogram`, `heatmap`, `treemap`, `waterfall`, `radarLine`/`radarArea`, `boxPlot`, `rangeBar`/`rangeArea` (see https://docs.openbb.co/workspace/developers/widget-types/aggrid-table-charts for the full list).

For `chart`: have the endpoint return a Plotly figure (no title — the widget supplies it). Add a `raw=true` query param so AI agents and table conversions can read the underlying rows. Before reaching here, confirm a `table` with sparklines or `chartView` won't do the job — only pick `chart` when AG Grid lacks the type (candlesticks/OHLC, custom subplots) or you need annotations / technical indicators / non-row-shaped data.

## 6. Add descriptions

Every widget should have a `description`. Every param should have a `description`. They drive tooltips and hover help. Skipping them is an easy way to ship a widget that no one understands.

## 7. Produce the widget draft

Combine the above into a `widgets.json` entry:

```json
{
  "stock_prices": {
    "name": "Stock Prices",
    "description": "Latest closing prices",
    "type": "table",
    "endpoint": "/stock_prices",
    "gridData": { "w": 20, "h": 12 },
    "params": [
      { "paramName": "limit", "type": "number", "label": "Limit",
        "description": "Row count cap", "value": 10 }
    ],
    "data": {
      "table": {
        "columnsDefs": [
          { "field": "symbol", "headerName": "Symbol", "cellDataType": "text", "pinned": "left" },
          { "field": "price",  "headerName": "Price",  "cellDataType": "number", "formatterFn": "none" }
        ]
      }
    }
  }
}
```

## 8. Validate

- Confirm `widgets.json` is still a JSON object (not an array) after adding the entry.
- Confirm the `endpoint` path exists and returns the shape the widget type expects with the default params.
- If you're also adding the widget to an `apps.json` template, confirm the layout's `i` matches the new widget id.

See `openbb://workspace/validation/common-errors` for the failure list and `openbb://workspace/guides/debug-app` if something doesn't render.

## 9. Layer on click-through (if it makes sense)

If this widget is a discovery table — movers, screeners, watchlists, IPO calendars — and a downstream widget on the same dashboard accepts a synced param (typically `symbol`), wire `cellOnClick` on the relevant column. See `openbb://workspace/specs/layout-grid` § "Click-through navigation".
