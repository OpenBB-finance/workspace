---
title: Minimal Backend (Python + FastAPI)
uri: openbb://workspace/examples/python-fastapi/minimal
use_when: You are starting a new Python backend for OpenBB Workspace and want the recommended starter shape.
language_specific: true
related:
  - openbb://workspace/contract/backend
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/apps-json
  - openbb://workspace/examples/generic-http/minimal
---

# Minimal Backend — Python + FastAPI

> This is an **implementation example**, not a platform requirement. Workspace is language-agnostic. If your project already uses a different framework, use that. See `openbb://workspace/examples/generic-http/minimal` for the framework-neutral shape.

FastAPI is the recommended Python starter because most current OpenBB examples are written against it.

## Project shape

```
my-backend/
├── main.py            # FastAPI app + routes
├── widgets.json       # Widget metadata (served from /widgets.json)
├── apps.json          # App templates (served from /apps.json)
└── requirements.txt   # fastapi, uvicorn, ...
```

## `main.py` shape

```python
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
import json

app = FastAPI()

# Required CORS origins for OpenBB Workspace
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pro.openbb.co",
        "https://pro.openbb.dev",
        "http://localhost:1420",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WIDGETS_FILE = Path(__file__).parent / "widgets.json"
APPS_FILE    = Path(__file__).parent / "apps.json"

@app.get("/widgets.json")
def get_widgets():
    # encoding="utf-8" is load-bearing — Windows defaults to cp1252 and will
    # silently mangle any non-ASCII content in the JSON file.
    with open(WIDGETS_FILE, encoding="utf-8") as f:
        return JSONResponse(content=json.load(f))

@app.get("/apps.json")
def get_apps():
    with open(APPS_FILE, encoding="utf-8") as f:
        return JSONResponse(content=json.load(f))

@app.get("/prices")
def prices(symbol: str = Query("AAPL")):
    # Replace with a real data source.
    return [
        {"date": "2025-04-25", "price": 207.12},
        {"date": "2025-04-28", "price": 210.04},
        {"date": "2025-04-29", "price": 211.78},
    ]

@app.get("/symbols")
def symbols():
    return [
        {"label": "Apple",     "value": "AAPL"},
        {"label": "Microsoft", "value": "MSFT"},
    ]
```

## `widgets.json` shape

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

## `apps.json` shape

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

## Run and register

```text
uvicorn main:app --reload --port 7779
```

Then in Workspace: Settings → Data Connectors → Connect Backend → `http://localhost:7779`.

## Notes specific to Python

- **Always pass `encoding="utf-8"` to `open()`.** Defaults to OS locale. cp1252 on Windows will mangle non-ASCII characters silently.
- **No Plotly chart titles.** When a widget is `type: "chart"`, the widget header already shows the title. Setting `fig.update_layout(title="...")` doubles up.
- **Support `raw=True` on chart endpoints.** Return the underlying rows when `raw=True` is passed so AI agents and table conversions can consume the data.
- **Reasonable runButton.** Default to `runButton: false` (or omit). Only set `true` for endpoints that take >5 s.
