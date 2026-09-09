# OpenBB Workspace — Product & Architecture Context

_Last reviewed: 2026-01-05. Update whenever the Workspace docs change._

## What the app is

OpenBB Workspace is a browser-based research tool for professional investors. The React app in this repo renders that experience as a dashboard with widgets plus a chat interface, and talks to three major backend surfaces:

1. **Workspace Core API (Python)** - handles tenant and user auth (SSO, RBAC, audit trails), saves dashboards and layouts, manages sharing and permissions, stores user files and notes, and orchestrates jobs or schedules.
2. **Connector Engine (Python workers + vendor SDKs)** - lets users bring their own market, fundamentals, or proprietary feeds into Workspace. Connectors normalize broker or data-vendor responses, enforce entitlements, and expose cleaned datasets as widgets and Copilot tools.
3. **Copilot Service (LLM orchestrator)** - coordinates MCP tools, routes requests through the frontend back toward the connectors for context gathering, and injects widgets, artifacts, or summaries back into the UI with citations.

Widgets always read data via the connector layer, even when Copilot triggers them, so reviewers should assume data fidelity and access control happen server-side while the front end focuses on rendering, routing, and safe user interactions.

## Personas and primary goals

| Persona | Goal | Surfaces they touch |
| --- | --- | --- |
| Equity/credit analyst | Build or watch dashboards, run backtests, capture notes | Dashboard layout, chart widgets, file viewer, watchlists |
| Advisor / PM | Share curated layouts, monitor risk, chat with Copilot | Sharing, permissions, notifications, Copilot |
| Quant/platform team | Plug in proprietary data or tools | Data connector settings, MCP tool config, Copilot SDK |

## Core surfaces seen in PRs

- **Dashboards and widgets** - multi-panel layouts with TradingView charts, tables (ag-grid), PDF or image viewers, and more. Widgets persist as JSON configs and can be referenced by Copilot.
- **Data connectors** - how users bring their own data into the workspace so that widgets and Copilot can act on it.
- **Copilot panel** - chat interface that can fetch data, create charts, summarize PDFs, or trigger MCP tools. Includes reasoning steps, citations, and inline artifacts.
- **Files and notes** - PDF, Excel, JPG, and other assets rendered through widgets.
- **Collaboration** - workspace sharing among users, including live updates and notifications.

## High-level architecture

```
Browser (React + Zustand + TanStack Query)
   ├── REST/WebSocket -> Workspace Core API (FastAPI)
   │        └── Connector Engine (vendor/broker SDKs, jobs, caching)
   └── MCP/WebSocket -> Copilot Service (LLM orchestrator, tool router, policy guardrails)
```

- Workspace Core API never calls the LLM, and Copilot never talks directly to FastAPI; the browser decides when to hit each service, enforcing UX context, auth, and telemetry.
- When Copilot needs data, it asks the browser to run a Workspace tool; the browser then triggers the appropriate API or connector calls, collects the result, and sends artifacts back to Copilot.
- React components fetch data via TanStack Query hooks (for example `~/api/*`), and Copilot conversations call Workspace tooling defined in `widgets.json` or MCP tools.
- User secrets (API keys, OAuth tokens) are stored server-side; the front end only sees capability flags and masked indicators. Treat any client-side exposure as a security bug.

## Example flows

1. **"How is my portfolio looking today"**  
   Copilot inspects on-screen widgets, requests additional data via the browser, the Workspace Core API and connectors return widget payloads, and the frontend packages everything back to Copilot so the LLM can summarize results with citations.

2. **"Explain this PDF"**  
   File is uploaded, the Workspace Core API stores and indexes it, Copilot fetches excerpts through the browser, and the response shows highlighted citations plus optional follow-up widgets.

## Review heuristics for the LLM

- **Data fidelity** - Units, currencies, time zones, and corporate-action adjustments must match Workspace Core API contracts. Double-check props such as `currency`, `period`, `adjusted`.
- **Widget contracts** - Components that serialize to widgets must stay backward compatible (IDs and schema). Breaking changes ripple into saved dashboards and Copilot references.
- **Copilot/tool safety** - Anything Copilot can call must validate user permissions and guard against prompt injection. Never render unchecked HTML or markdown.
- **Performance** - The frontend should batch queries, debounce search, and respect pagination. Workspace API limits requests to avoid hitting vendor quotas.
- **Collaboration context** - Actions should emit telemetry or socket events so collaborators stay in sync (for example `workspaceUpdated` messages).
- **Security** - Never leak API keys, OAuth tokens, or proprietary data in logs or the DOM. Assume users may embed third-party MCP tools and sanitize I/O appropriately.

## Vocabulary

- **Workspace** - a saved layout (dashboard, files, settings) scoped to a team or user.
- **Widget** - a typed artifact (chart, table, note, file viewer) with props and data references.
- **Backend connector** - how the user adds data and widgets to the workspace using `apps.json` and `widgets.json`.
- **`widgets.json`** - the building block of all widgets used in the workspace.
- **`apps.json`** - defines widget positions and quick "apps" the user can add with predefined layouts or experiences.
- **Copilot** - the OpenBB AI assistant; code lives under `~/components/AI` and `~/lib/copilot`.
- **MCP tool** - Model Context Protocol endpoint that Copilot can call (OpenBB native tools plus bring-your-own).
- **Sandbox** - default workspace preloaded with sample data for onboarding.
