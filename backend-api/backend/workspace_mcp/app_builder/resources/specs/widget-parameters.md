---
title: Widget Parameters
uri: openbb://workspace/specs/widget-parameters
use_when: You are defining widget params (text, number, boolean, date, endpoint dropdowns) and need the right type and option-source choice.
language_specific: false
related:
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/apps-json
  - openbb://workspace/specs/widget-types
---

# Widget Parameters

Widget controls live under a widget's `params` array in `widgets.json`. The right `type` is the one that **matches the shape of the value**, not the easiest to implement.

## Common fields

Every param object should have:

| Field | Required | Notes |
|-------|----------|-------|
| `paramName` | Yes | Query/body key sent to the data endpoint. |
| `type` | Yes | Renderer — see below. |
| `label` | Yes | Display label in the param panel. |
| `description` | Yes (in practice) | Tooltip help shown on hover. Don't omit. |
| `value` | Usually | Default value. |
| `show` | Optional | When `false`, the param is hidden in the UI but still sent — used for cellOnClick patterns. |
| `multiSelect` | Optional | For dropdowns that allow selecting multiple values. Use a comma-separated default string unless the app's existing convention uses an array. |
| `optionsEndpoint` | When `type: "endpoint"` | Backend path that returns the options list. |
| `optionsParams` | Optional | Dependent options — e.g. `{ "country": "$country" }` re-fetches when the named param changes. |
| `options` | When `type: "text"` with a curated list | Inline `[{label, value}]` array. |

## Type cheatsheet

Pick the right type before defaulting to `text` with options. Wrong type → clunky UX even though it "works".

| Param shape | Correct `type` | Wrong choice |
|-------------|----------------|--------------|
| Yes/no flag | `boolean` (renders as toggle) | `text` with `[{label:"Yes",value:"true"},{label:"No",value:"false"}]` |
| Free-form integer (limit, days, count) | `number` | `text` with hardcoded options |
| Free-form text (search query) | `text` (no `options`) | `text` with curated options |
| Date or date range | `date` with `$currentDate` modifiers | `text` with hardcoded date strings |
| Curated short list (3–6 fixed values) | `text` with `options` | OK — this is the intended use |
| Symbol / ticker picker | `endpoint` with `optionsEndpoint` | `text` (forces user to type ticker) |
| Dropdown that depends on another param | `endpoint` with `optionsParams: {key: "$other"}` | static `text` options |

## Type examples

### `text`

```json
{ "paramName": "query", "type": "text", "label": "Search Query",
  "description": "Enter search term", "value": "" }
```

### `number`

```json
{ "paramName": "limit", "type": "number", "label": "Limit",
  "description": "Maximum rows to return", "value": 10 }
```

### `boolean`

```json
{ "paramName": "include_extended", "type": "boolean", "label": "Include Extended Hours",
  "description": "Include pre/post-market data", "value": false }
```

### `date`

```json
{ "paramName": "start_date", "type": "date", "label": "Start Date",
  "description": "Window start", "value": "$currentDate-1M" }
```

Date modifiers: `$currentDate`, `$currentDate-1d`, `$currentDate-1w`, `$currentDate-1M`, `$currentDate-1y`. Avoid hardcoded date strings — they get stale.

### Static dropdown — `text` with `options`

```json
{ "paramName": "interval", "type": "text", "label": "Interval",
  "description": "Bar size", "value": "1d",
  "options": [
    { "label": "1 Day",   "value": "1d" },
    { "label": "1 Week",  "value": "1w" },
    { "label": "1 Month", "value": "1m" }
  ] }
```

### Dynamic dropdown — `endpoint`

```json
{ "paramName": "symbol", "type": "endpoint", "label": "Select Symbol",
  "description": "Choose a ticker",
  "optionsEndpoint": "/symbols" }
```

The `optionsEndpoint` should return an array of `{ label, value }` objects.

Keep dropdown options simple. Use `{label, value}` for normal dropdowns; add `category` only when Workspace needs that category for grouping/search semantics. Avoid `extraInfo` unless the user explicitly wants an advanced/search-rich dropdown.

### Multi-select dimensions

For filters like years, geographies, countries, sectors, or business units:

```json
{ "paramName": "years", "type": "endpoint", "label": "Years",
  "description": "Reporting years to include",
  "optionsEndpoint": "/year_options",
  "multiSelect": true,
  "value": "2020,2021,2022,2023,2024" }
```

Prefer real individual choices over fake aggregate choices:

- Good: options `2020`, `2021`, `2022`, `2023`, `2024` with all selected by default.
- Avoid: a selectable `2020-2024` option unless it is a real domain value users should choose.
- Good: options `Portugal`, `Angola`, `Brazil`.
- Avoid: a selectable `All Geographies` option unless it is a real source row users should choose directly.

### Dependent dropdown — `optionsParams`

```json
{ "paramName": "city", "type": "endpoint", "label": "City",
  "description": "City within the selected country",
  "optionsEndpoint": "/cities",
  "optionsParams": { "country": "$country" } }
```

When the user changes the `country` param, the `city` dropdown re-fetches with `?country=...` appended.

## Hidden params for click-through navigation

When a table column drives a synchronized param via `renderFn: "cellOnClick"`, the receiving widget often needs a *hidden* param entry so the value flows in without showing a duplicate dropdown:

```json
{ "paramName": "symbol", "type": "endpoint", "label": "Symbol",
  "optionsEndpoint": "/search_tickers", "value": "AAPL", "show": false }
```

The rule: a widget that *receives* a synchronized param AND has its own column emitting `cellOnClick` for that same param must use `show: false` on the param. Otherwise both controls compete and the click stops propagating reliably. Pure-emitter widgets (no matching param of their own) need no entry at all.

## What this spec does not cover

- The widget-level shape that contains `params` — see `openbb://workspace/specs/widgets-json`.
- App-level `groups[].type` choice (`param` vs `endpointParam` vs `ticker`) — see `openbb://workspace/specs/apps-json`.
- Click-through layout wiring — see `openbb://workspace/specs/layout-grid`.
