---
title: Widget Types
uri: openbb://workspace/specs/widget-types
use_when: You are picking the widget type string for a new widget or auditing whether an existing widget uses the right type.
language_specific: false
related:
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/widget-parameters
  - openbb://workspace/guides/convert-endpoint-to-widget
---

# Widget Types

`type` in `widgets.json` selects the renderer. Pick the type that matches the **shape of the data and the user task**, not the type that's easiest to implement.

## Catalog

| Type | Use case | Endpoint returns |
|------|----------|------------------|
| `table` | Sortable/filterable rows of structured fields | JSON array of row objects |
| `table_ssrm` | Large or server-paged table datasets | SSRM-shaped response |
| `chart` | Plotly visualizations with raw-data toggle | Plotly figure JSON (or rows when `raw=true`) |
| `metric` | KPI cards with label/value/delta | JSON array of metric objects |
| `markdown` | Long-form prose, generated commentary | Markdown string |
| `note` | Static or semi-static short text | Short string |
| `newsfeed` | Article and update lists with title/excerpt/body | JSON array of articles |
| `live_grid` | Real-time table with WebSocket updates | Initial rows JSON; live deltas over WS |
| `advanced_charting` | TradingView-style charting experience | TradingView UDF endpoints |
| `chart-highcharts` | Highcharts visualization | Highcharts config JSON |
| `multi_file_viewer` | File or document collection viewer | JSON describing the collection |
| `youtube` | Embedded video content | Video metadata |

> Use the exact widget type string supported by your current Workspace build. Don't invent aliases (`ssrm_table`, `tradingview_chart`, etc.).

## Use-case → type quick selector

Walk this list before defaulting to `table`:

| Data shape | Type |
|------------|------|
| Rows of structured fields (prices, holdings, transactions) | `table` |
| Simple line / bar / area / column / pie / scatter over rows you already have | `table` with `sparkline` cells or `chartView` |
| Candlesticks/OHLC, annotated/multi-axis stock charts, custom subplots | `chart` (Plotly) |
| 3–8 KPI cards with label/value/subvalue | `metric` |
| Long-form prose, generated commentary | `markdown` |
| **Articles with title + body + author + date** | **`newsfeed`** |
| File/PDF collections with viewing UX | `multi_file_viewer` |
| Live ticker / order book / streaming | `live_grid` |
| Static instructions or disclaimers | `note` |

## Choose this, not that

- **Simple visualizations on tabular data → `table` with sparkline cells or `chartView`, not `chart`.** AG Grid supports `line`, `bar`, `area`, `column`, `pie`/`donut`, `scatter`/`bubble`, `histogram`, `heatmap`, `treemap`, `waterfall`, `radar*`, `boxPlot`, `range*` (full list at https://docs.openbb.co/workspace/developers/widget-types/aggrid-table-charts) — both as per-cell sparklines (`type`: `line`/`bar`/`area`) and as a table-wide chart toggle. Reach for `chart` (Plotly) only when (a) AG Grid lacks the type — candlesticks/OHLC are the common one — (b) you need annotations, technical indicators, or custom subplot layouts, or (c) the data isn't naturally row-shaped. A simple "show me a line of values per row" is almost always better as a table sparkline or aggrid chartview than a separate Plotly widget.
- **News and articles → `newsfeed`, not `table`.** The default reflex is `table`, but `newsfeed` renders title/excerpt/body/date layout natively. The wrong choice ends with rich article content jammed into table cells with no formatting.
- **Long-form commentary → `markdown`, not `table`.** Tables are not designed for prose.
- **Document collections where viewing the file is the core UX → `multi_file_viewer`, not links in a table.**
- **Boolean toggles, dates, numeric inputs → use the right param `type`, not a `text` dropdown.** That belongs in `openbb://workspace/specs/widget-parameters`, not here, but the same rule applies: pick the renderer that fits the shape.

## `advanced_charting` and parameter sync

`advanced_charting` (TradingView-style) can join a symbol group, but the wiring is non-obvious:

1. The widget exposes a hidden grouped param like:
   ```json
   { "paramName": "symbol", "type": "endpoint", "label": "Symbol",
     "optionsEndpoint": "/search_tickers", "value": "AAPL", "show": false }
   ```
2. The app-level group uses matching identity: `paramName: "symbol"`, `type: "endpointParam"`.
3. Other grouped widgets share the same `paramName` + `optionsEndpoint`.
4. The chart keeps `data.defaultSymbol` as its startup fallback.
5. The frontend bridges the group's value into TradingView's `setSymbol(...)`, which then triggers `/udf/symbols` and `/udf/history?symbol=...` on the backend.

If those conditions can't be met, prefer a regular `chart` widget.

## What this spec does not cover

- Widget-level metadata fields — see `openbb://workspace/specs/widgets-json`.
- Param types and option sources — see `openbb://workspace/specs/widget-parameters`.
- Layout coordinates and click-through wiring — see `openbb://workspace/specs/apps-json` and `openbb://workspace/specs/layout-grid`.
