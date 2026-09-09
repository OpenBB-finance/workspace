---
title: What Workspace Is
uri: openbb://workspace/overview/what-is-workspace
use_when: You are about to design widgets or apps and need a mental model of what Workspace is, who uses it, and what is native vs. what your backend provides.
language_specific: false
related:
  - openbb://workspace/overview/ai-agent-contract
  - openbb://workspace/contract/backend
  - openbb://workspace/specs/widget-types
  - openbb://workspace/specs/apps-json
---

# What Workspace Is

OpenBB Workspace is a hosted analytical environment used by financial analysts, portfolio managers, and research teams. They open a **Dashboard**, drop **Widgets** onto it, drive them with linked parameters, and ask the **AI Agent** questions about the data shown. Your backend supplies the data and metadata; Workspace handles rendering, layout, parameter linking, refresh, and AI reasoning over the result.

Designing a widget without this picture in mind leads to widgets that work in isolation but feel wrong inside the product — shipping a custom toolbar that duplicates Workspace's, baking a chart into a table because parameter linking wasn't on your radar, or writing terse descriptions the AI Agent can't use to find the widget.

## Primitives

User-facing nouns. Match them when you write descriptions, titles, and docs.

| Term | What it is |
|------|------------|
| **Dashboard** | A user's working surface. A grid of Widgets plus embedded files/notes, with parameters that synchronize widgets sharing a Group. |
| **Widget** | A single data component (table, chart, metric card, newsfeed, etc.) backed by your endpoint. |
| **App** | A *pre-built dashboard template* shipped via `apps.json`. Bundles layout, default parameter values, parameter Groups, curated **Prompts**, and (optionally) curated AI Agents. Users open an App from the gallery and land on a working dashboard, not a blank page. |
| **Prompts** | Curated query suggestions that ship with an App. They surface as starting points for the AI Agent and reference the widgets in the layout. The empty `"prompts": []` you see in app templates is where these go. |
| **AI Agent** | Built-in assistant that reads the Dashboard's widgets and answers questions across them, runs multi-step analysis, and drops artifacts (text, tables, charts) back into the Dashboard. See `openbb://workspace/overview/ai-agent-contract`. |
| **Widget Gallery** | Browse-and-add catalog. Your widgets surface here once the backend is registered. |

## What Workspace gives you for free

Don't reinvent these — Workspace handles them natively, no backend code needed.

- **Layout & sizing** — drag/drop, resize, duplicate dashboards, folder organization.
- **Auto-refresh** — dashboards refresh data automatically; per-widget `refetchInterval` overrides cadence.
- **Parameter linking** — widgets in the same parameter Group share a value (one ticker drives all of them). Defined in `apps.json`. See `openbb://workspace/specs/apps-json` and `openbb://workspace/specs/layout-grid`.
- **Native content embeds** — users can drop PDFs, images, spreadsheets, and free-form notes onto a Dashboard. You don't need a widget for static content.
- **Click-through navigation** — table cells can drive other widgets via `cellOnClick`. See `openbb://workspace/specs/layout-grid` § "Click-through navigation".
- **In-cell visualizations on tables** — sparklines and a `chartView` toggle turn a table into a chart without a separate widget. See `openbb://workspace/specs/widget-types`.
- **Sharing & roles** — RBAC, share with team, on-prem / private cloud deployment.
- **AI Agent over the dashboard** — the built-in agent already reads widgets via their metadata. You don't ship an agent to make widgets queryable.
- **Export to apps.json** — users can save a Dashboard as an `apps.json` template. Useful debugging shortcut: build a layout manually in Workspace, export, and compare against your hand-authored `apps.json`.

## What your backend provides

- `/widgets.json` — the widget catalog and metadata.
- `/apps.json` — optional: app templates that pre-arrange widgets, parameters, and prompts.
- One data endpoint per widget — returns the JSON shape its `type` expects.

That's the whole contract. See `openbb://workspace/contract/backend`.

## What your backend should NOT do

- **Build a chart toolbar.** `chart` and `table` widgets already have one.
- **Reimplement parameter sync inside one widget.** Use `apps.json` parameter Groups.
- **Embed PDFs / images / static notes inside a widget response.** Users drop these directly onto the Dashboard.
- **Build authentication UI.** Workspace's connection setup handles auth (header / query / none).
- **Format numbers as strings if you want the AI Agent or sparklines to use them.** See `openbb://workspace/overview/ai-agent-contract`.

## "App" means *template*, not *application*

When `apps.json` says "App", it means a dashboard preset:

1. A layout — which Widgets, which grid cells.
2. A default parameter set, with one or more Groups.
3. A `prompts` array — agent query suggestions tied to that layout.
4. Optionally curated Agents.

If you find yourself designing one big monolithic widget with a custom UI inside it, you probably want an *App* instead — split into multiple widgets and link them with a Group.

## Out of scope here

- **Building AI Agent backends.** Agents are a separate backend surface (`/agents.json` + `/query` SSE), not the widget-backend surface this skill covers. See `https://docs.openbb.co/workspace/developers/agents-integration`.
- **Excel Add-in / PWA / enterprise deployment.** End-user / deployment surfaces, not authoring.
- **Specific UI affordances (per-widget chat buttons, fullscreen, etc.).** Runtime features; check Workspace directly if you need to confirm one.
