---
doc: workflow
project: <PROJECT_NAME>
status: standard
updated: <DATE>
purpose: The gates and ownership rules the define/implement/ship skills enforce. Project-agnostic — content here does not change between projects.
---

# Development Workflow

The loop is **define → implement → ship**, driven by one contract:
`docs/engineering/backlog.json`. The LLM only reasons at the *define* step;
everything downstream is data through scripts.

## Status enum (the only legal values)

`notstarted` → `in_progress` → `done`, with `blocked` as an override when a
dependency is unmet. **`status` is owned by the local/GitHub status adapter and
is never hand-edited casually.**

## Field ownership (prevents clobbering)

The backlog is nested: **epics group stories**. Stories are the leaf records that
carry status; **epic status/progress is derived** from child stories by the
dashboard and never stored.

| Field | Owner | Notes |
|-------|-------|-------|
| `epics[]` scope; story `id`, `title`, `epic`, `order`, `prd_ref`, `acceptance`, `blocked_by` | human + define-backlog | The plan. |
| `epics[].gh_issue`, `stories[].gh_issue` | define-epic / ship | Written back after the GH issue is created. |
| story `status`, `verify` | status adapter + implement/ship evidence | Local mode is written by workflow skills; GitHub mode is mirrored from issue state. |
| epic status / progress | derived | Computed by the dashboard from child stories. Never stored. |

## Definition of Ready (a story may be picked up only if)

- The PRD it references has front-matter `status: approved`.
- `prd_ref` points at a real requirement ID (e.g. `REQ-12`).
- `acceptance` is non-empty and testable.
- All `blocked_by` dependencies are `done`.
- The relevant human gate is approved in `.throughline/gates.json`.

## Definition of Done (a story is `done` only when)

- In GitHub mode, its issue is CLOSED. In local mode, `ship-epic` marks it done.
- Acceptance criteria met; tests for the change pass (`verify.ci: pass`).
- The epic ledger (`.claude/epic-<n>/ledger.md`) records files, tests, commit.

## Human approval gates (the agent stops here)

1. **PRD approval** — no backlog stories are seeded until the PRD is `approved`.
2. **Epic plan review** — after `define-epic` produces the plan/ledger, a human
   glances at it before implementation begins.

## Refreshing the dashboard (zero tokens)

```
node scripts/validate.mjs        # gate: fails loud on a bad contract
node scripts/gate.mjs list       # show human gate state
node scripts/sync-status.mjs     # sync local/GitHub status into the contract
node scripts/build-dashboard.mjs # render PROGRESS_DASHBOARD.html
```
