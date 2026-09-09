---
title: AI Agent Contract
uri: openbb://workspace/overview/ai-agent-contract
use_when: You are writing widget descriptions, parameter metadata, response shapes, or apps.json prompts and want them to be usable by Workspace's AI Agent.
language_specific: false
related:
  - openbb://workspace/overview/what-is-workspace
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/widget-parameters
  - openbb://workspace/specs/apps-json
---

# AI Agent Contract

Workspace ships a built-in AI Agent that reads the widgets on a Dashboard and answers questions across them — running calculations, identifying patterns, and dropping artifacts (text, tables, charts) back into the Dashboard. It does this by reading the same `widgets.json` metadata you author and the same data endpoints the renderer hits.

This means metadata you might treat as "tooltip text" is **agent discoverability text**. A widget with a vague `description` will not be picked up reliably when a user asks a question that should be answered by it.

## What the agent reads to discover widgets

The agent uses these `widgets.json` fields to know what each widget is and when to use it:

| Field | Use to the agent |
|-------|------------------|
| `name` | User-visible title. Weak signal on its own. |
| `description` | **Primary discovery signal.** Should describe the *data* (what it is, what entity, what time range), not the *widget shape*. |
| `category` / `subCategory` | Grouping signals — agents auto-tag widgets by these when answering Prompts. |
| `source` | Provenance, used in attribution. |
| `params[].paramName` / `label` / `description` | Tells the agent which inputs the endpoint takes and what they mean. |

If the agent is consistently failing to pick the right widget for an obvious question, the `description` is almost always the cause.

## Description-writing rules

Write descriptions for the agent first, the human second. The human gets a tooltip; the agent gets the *only* signal.

- **Lead with entity and metric.** "Daily closing prices for US equities, last 30 days." Not "A view of stock prices."
- **State time range and granularity.** "Hourly", "Daily", "Last 90 days", "Year-to-date", "Trailing twelve months".
- **Name the source if it's distinguishing.** "From SEC filings", "From the user's connected portfolio".
- **Don't describe the widget shape.** "A sortable table that shows..." wastes tokens; the agent already knows the type.
- **Same rules apply to params.** A `description` of `"limit"` is useless; `"Maximum number of rows to return; default 10, max 1000"` is usable.

## How the agent reads data

For `chart` widgets, the agent **does not parse Plotly figures** — it calls the endpoint with `raw=true` to get the underlying rows. Every chart endpoint must accept `raw=true` and, when set, return the same array-of-rows shape a `table` would. This same toggle powers the user-facing "view as table" affordance.

For `table`, `metric`, and `newsfeed` widgets, the agent calls the endpoint as the renderer does and reads the rows directly.

## Make responses agent-readable

- **Numbers must be numbers.** Returning `"4.21%"` as a string defeats reasoning, sorting, and downstream calculation. Return `0.0421` and let `formatterFn: "percent"` handle display.
- **Timestamps must be ISO-8601 strings or epoch numbers.** Locale-formatted strings like `"Apr 21, 2026"` force the agent to parse them.
- **Field names should be self-describing.** `change_pct` and `market_cap_usd` beat `c` and `mc`. The agent reads field names and uses them in its responses.
- **Keep the row shape stable per call.** Don't return rows whose keys vary by parameter; the agent assumes one schema per response.
- **Cap row counts sensibly.** A discovery widget returning 50,000 rows wastes the agent's context. Add a `limit` param with a sensible default.

## `prompts` in `apps.json`

The `prompts` array on an App is a curated list of starter queries surfaced when a user opens that App. They reference data the App's widgets actually expose — equal parts user onboarding and agent demo.

- Write prompts as questions a user would actually ask, not feature descriptions. "Which holdings dragged the portfolio down today?" beats "Show portfolio losers."
- Reference entities present in the default parameter set ("What's driving today's move in `$ticker`?" where `ticker` is in the default Group).
- Skip prompts that need widgets the App doesn't include.
- Keep them short — they render as buttons.

Empty `"prompts": []` is valid; ship at least 3–5 if you want the App to feel alive on first open.

## Out of scope here

- **Building your own AI Agent backend.** That's a separate backend surface (`/agents.json` + `/query` SSE) — see `https://docs.openbb.co/workspace/developers/agents-integration`. The Agent described here is the one Workspace ships and runs against your widgets.
- **External agent-skill packaging.** The generated `openbb-app-builder` skill is only a compatibility package for clients that cannot read MCP resources directly; the canonical app-builder content remains this resource catalog.
