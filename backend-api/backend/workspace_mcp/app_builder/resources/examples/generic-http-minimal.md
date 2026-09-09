---
title: Minimal Backend (Generic HTTP)
uri: openbb://workspace/examples/generic-http/minimal
use_when: You want a framework-neutral picture of what an OpenBB Workspace backend looks like, before committing to a specific language.
language_specific: false
related:
  - openbb://workspace/contract/backend
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/apps-json
  - openbb://workspace/examples/python-fastapi/minimal
---

# Minimal Backend — Generic HTTP

Workspace doesn't care which language or framework you use. This example shows the **HTTP shape** of a minimal backend so you can implement it in whatever stack you already have.

If you're already on Python and want a runnable starting point, see `openbb://workspace/examples/python-fastapi/minimal` instead.

## Routes

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/widgets.json` | JSON object keyed by widget id |
| `GET` | `/apps.json` | JSON array of app templates (optional) |
| `GET` | `/prices?symbol=AAPL` | JSON array of rows for the price table widget |

That's it. Add more data routes for each widget you expose.

## Response shapes

### `GET /widgets.json`

```json
{
  "stock_prices": {
    "name": "Stock Prices",
    "description": "Latest closing prices",
    "type": "table",
    "endpoint": "/prices",
    "gridData": { "w": 20, "h": 12 },
    "params": [
      { "paramName": "symbol", "type": "endpoint", "label": "Symbol",
        "description": "Choose a ticker", "optionsEndpoint": "/symbols", "value": "AAPL" }
    ],
    "data": {
      "table": {
        "columnsDefs": [
          { "field": "date",  "headerName": "Date",  "cellDataType": "dateString" },
          { "field": "price", "headerName": "Price", "cellDataType": "number", "formatterFn": "none" }
        ]
      }
    }
  }
}
```

### `GET /apps.json`

```json
[
  {
    "name": "Prices",
    "description": "Daily closing prices",
    "img": "", "img_dark": "", "img_light": "",
    "allowCustomization": true,
    "tabs": {
      "": {
        "id": "", "name": "",
        "layout": [
          { "i": "stock_prices", "x": 0, "y": 0, "w": 40, "h": 12, "groups": ["Group 1"] }
        ]
      }
    },
    "groups": [
      {
        "name": "Group 1",
        "type": "endpointParam",
        "paramName": "symbol",
        "widgetIds": ["stock_prices"],
        "defaultValue": "AAPL"
      }
    ],
    "prompts": []
  }
]
```

### `GET /prices?symbol=AAPL`

```json
[
  { "date": "2025-04-25", "price": 207.12 },
  { "date": "2025-04-28", "price": 210.04 },
  { "date": "2025-04-29", "price": 211.78 }
]
```

### `GET /symbols`

```json
[
  { "label": "Apple",     "value": "AAPL" },
  { "label": "Microsoft", "value": "MSFT" }
]
```

## CORS

Allow these origins on every route:

```text
Access-Control-Allow-Origin: https://pro.openbb.co
Access-Control-Allow-Origin: https://pro.openbb.dev
Access-Control-Allow-Origin: http://localhost:1420
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: *
```

In practice, send the matching origin from the request rather than echoing a list. Most frameworks have a CORS plugin for this.

## Auth (optional)

If the backend requires auth, accept either:

- A custom header (e.g. `X-API-KEY: <key>`), or
- A query string parameter (e.g. `?api_key=<key>`).

Workspace lets users register the backend connection with header or query-string credentials, which it then attaches to every widget request. Header is preferred — keys stay out of URLs and access logs.

## Encoding

Serve UTF-8 on every response. If you read JSON files from disk, open them explicitly as UTF-8 — defaulting to the OS locale will mangle non-ASCII content (Greek letters, em-dashes, emoji) on systems whose default isn't UTF-8.

## Picking a stack

Anything that can do the above works. Concrete starting points by ecosystem:

- Python — FastAPI, Flask, Starlette, Django REST.
- Node — Express, Fastify, Hono.
- Go — `net/http`, Echo, Gin, Chi.
- Rust — Axum, Actix-web.
- Java/Kotlin — Spring Boot, Ktor.
- C# — ASP.NET Core minimal APIs.

If you want a runnable Python sample to copy from, see `openbb://workspace/examples/python-fastapi/minimal`.
