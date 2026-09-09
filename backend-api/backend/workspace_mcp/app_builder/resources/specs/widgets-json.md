---
title: widgets.json Spec
uri: openbb://workspace/specs/widgets-json
use_when: You are authoring or editing widgets.json and need the top-level shape and the critical fields per widget.
language_specific: false
related:
  - openbb://workspace/specs/widget-types
  - openbb://workspace/specs/widget-parameters
  - openbb://workspace/specs/apps-json
  - openbb://workspace/validation/common-errors
---

# `widgets.json` Spec

`widgets.json` is the metadata contract that tells Workspace which widgets your backend offers, what type each one is, and which endpoint serves its data.

## Top-level shape

`widgets.json` is a JSON **object**. Keys are widget ids, values are widget definitions:

```json
{
  "stock_prices": { "...widget definition..." },
  "price_chart":  { "...widget definition..." }
}
```

Returning a JSON array is the most common mistake here — Workspace will reject it. Widget ids are referenced by app layouts (the `i` field in `apps.json` layout items), so they must be stable.

## Widget definition fields

Each value is an object. The high-leverage fields:

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | Display title shown on the widget. |
| `type` | Yes | Widget type string. See `openbb://workspace/specs/widget-types`. |
| `endpoint` | Yes | Path on this backend that serves the widget's data. |
| `description` | Recommended | Tooltip text. |
| `category` / `subCategory` | Optional | Grouping in the widget catalog. |
| `gridData` | Optional | Default placement hint as `{w, h}`. Not the app layout — see below. |
| `params` | Optional | Array of parameter definitions. See `openbb://workspace/specs/widget-parameters`. |
| `data` | Sometimes required | Type-specific config. For tables, `data.table.columnsDefs` is where column metadata lives. |
| `source` | Optional | Array of source labels, e.g. `["API"]`. |
| `runButton` | Optional | When `true`, the widget waits for the user to click Run before fetching. Default `false`. Only set `true` for heavy work (>5 s). |
| `refetchInterval` | Optional | Auto-refresh interval in milliseconds. |

Unknown keys are tolerated by some Workspace builds and ignored by others — don't author speculative fields.

## `gridData` is a hint, not the layout

`gridData` is the default placement when a widget is dragged onto a dashboard from the catalog. It is *not* the layout used by an app template — that lives in `apps.json` under `tabs[].layout[]`. Don't try to express tabs or coordinates inside `widgets.json`.

## Tables: column metadata path

Table column metadata belongs at:

```json
{
  "data": {
    "table": {
      "columnsDefs": [ { "field": "...", "headerName": "...", ... } ]
    }
  }
}
```

Tables can also embed visualizations without a separate `chart` widget:

- Per-cell mini-charts via `columnsDefs[].sparkline` (`{ "type": "line"|"bar"|"area", "options": { ... } }`).
- A whole-table chart toggle via `data.table.chartView` (`{ "enabled": true, "chartType": "line"|"bar"|..., "chartNavigatorEnabled": true, "chartMiniChartEnabled": true }`).

See `openbb://workspace/specs/widget-types` for when to use these instead of a Plotly `chart` widget.

Common mistakes:

- Putting columns at top-level `columns` — rejected.
- Putting columns at `data.columnsDefs` — rejected.
- Using the `formatterFn` value `"currency"` — invalid. Use `"none"` and pre-format the values, or use `"int"`/`"percent"`/`"normalized"`/`"normalizedPercent"`/`"dateToYear"`.
- Setting `defaultViz` — deprecated legacy field, never emit it. Setting it to a chart type disables the table entirely and breaks the table↔chart toggle. Use `"type": "table"` and, for a chart view, `data.table.chartView` as above; the widget then opens as the table with a working chart toggle.

## Endpoint path

`endpoint` is the path the widget calls. It can be any HTTP path on the backend; it does not have to match the widget id. Workspace will issue a `GET` (or, when configured, `POST`) to `<backend-url><endpoint>` and pass the widget's parameters as query string entries (or in the body, depending on backend connection setup).

## Example shape

```json
{
  "stock_prices": {
    "name": "Stock Prices",
    "description": "Latest closing prices",
    "type": "table",
    "endpoint": "/stock_prices",
    "gridData": { "w": 20, "h": 12 },
    "params": [
      { "paramName": "limit", "type": "number", "label": "Limit", "description": "Row count cap", "value": 10 }
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

## What this spec does not cover

- Choosing a widget type — see `openbb://workspace/specs/widget-types`.
- Authoring params — see `openbb://workspace/specs/widget-parameters`.
- Wiring layouts and parameter sync — see `openbb://workspace/specs/apps-json` and `openbb://workspace/specs/layout-grid`.
- Common validation errors — see `openbb://workspace/validation/common-errors`.
