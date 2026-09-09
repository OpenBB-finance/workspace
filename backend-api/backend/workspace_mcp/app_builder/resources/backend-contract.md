---
title: Backend Contract
uri: openbb://workspace/contract/backend
use_when: You need to understand what an OpenBB Workspace backend must expose, regardless of language or framework.
language_specific: false
related:
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/apps-json
  - openbb://workspace/examples/generic-http/minimal
  - openbb://workspace/examples/python-fastapi/minimal
---

# Backend Contract

An OpenBB Workspace backend is an **HTTP service** that returns JSON. Workspace fetches metadata and data from your backend over HTTP; it does not import your code, run your runtime, or care which language you use.

Any framework that can serve JSON over HTTP works: FastAPI, Flask, Django, Express, Fastify, Hono, Spring, Actix, ASP.NET, Go's `net/http`, etc. The contract below is identical for all of them.

## Required endpoints

| Method | Path | Returns | Required? |
|--------|------|---------|-----------|
| `GET`  | `/widgets.json` | JSON **object** keyed by widget id | Yes |
| `GET`  | `/apps.json`    | JSON **array** of app templates    | Optional, but required for app templates |
| `GET` (or `POST`) | One per widget | JSON shaped for that widget's `type` | One per widget referenced from `widgets.json` |

The widget data endpoint URL is whatever each widget declares in `widgets.json` under `endpoint`. It can be any path on the same backend.

## Data endpoint response expectations

The shape Workspace expects is determined by the widget's `type`:

| Widget `type` | Endpoint should return |
|---------------|-------------------------|
| `table`, `table_ssrm` | JSON array of row objects |
| `chart` | Plotly figure JSON (or array of rows when `raw=true`) |
| `metric` | JSON array of `{label, value, ...}` objects |
| `markdown` | A markdown string |
| `note` | A short text string |
| `newsfeed` | JSON array of articles `{title, date, author, excerpt, body, ...}` |
| `multi_file_viewer` | JSON describing the file collection |
| `live_grid` | Initial rows JSON; live updates over WebSocket |
| `advanced_charting`, `chart-highcharts` | The shape that widget type expects |

See `openbb://workspace/specs/widget-types` for type guidance and `openbb://workspace/specs/widgets-json` for the metadata shape that wires endpoints to widget types.

## CORS

Workspace runs in a browser. Your backend MUST allow CORS from at least these origins:

- `https://pro.openbb.co`
- `https://pro.openbb.dev`
- `http://localhost:1420` (Workspace desktop app, if used)

Production browsers also block mixed content, so backends used from `https://pro.openbb.co` must serve over HTTPS. Local development over HTTP is fine for `http://localhost`.

## Authentication

Auth is the backend's responsibility, not Workspace's. Common patterns:

- Custom request header (e.g. `X-API-KEY`) configured on the backend connection in Workspace.
- Query parameter (e.g. `?api_key=...`) configured on the backend connection in Workspace.
- No auth at all (local dev, internal trusted network).

Header-based auth is preferred — keys stay out of URLs and access logs. Workspace lets users register backend connections with header or query-string credentials.

## Optional endpoints and behaviors

- `GET /` — A friendly root response. Helpful for sanity checks but not required.
- `GET /thumbnails/{name}` — A simple way to serve app gallery SVG/PNG thumbnails referenced by `apps.json` `img`, `img_dark`, and `img_light`.
- A `theme` query parameter — Widget endpoints often accept `theme=dark|light` so the response (e.g. a Plotly figure) matches the user's UI theme.
- A `raw` query parameter — Chart endpoints often accept `raw=true` to return the underlying rows instead of the rendered figure, so AI agents and table conversions can work with the data.

## Encoding

Always serve UTF-8. If your backend reads JSON files from disk to serve them, open those files explicitly as UTF-8. Defaulting to the OS locale will mangle non-ASCII content (Greek letters, em-dashes, emoji) on systems whose default isn't UTF-8.

## Language and framework neutrality

Nothing on this page is Python-specific. The fastest documented starter is FastAPI (see `openbb://workspace/examples/python-fastapi/minimal`), but `openbb://workspace/examples/generic-http/minimal` shows the same contract framework-neutrally. Pick whatever your project already uses.
