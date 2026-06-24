# <PROJECT_NAME> — Agent Operating Manual

This is the cross-agent operating manual, read first by every coding agent
(Claude, Cursor, Codex, Gemini, …). It is the machine-facing index of how this repo
works. Keep it short and current. Human-facing detail lives in `docs/`; this is the map.

## The contract

`docs/engineering/backlog.json` is the **single source of truth** for what work
exists, its order, dependencies, and state. Validated by `docs/engineering/backlog.schema.json`.
Do not invent a parallel tracker. To understand project state, read this file —
do not re-derive it from the codebase.

## Status enum

`notstarted` · `in_progress` · `blocked` · `done`.
**`status` is owned by `scripts/sync-status.mjs` in GitHub mode and by the
workflow skills in local mode — never hand-edit it casually.**

## Field ownership (do not clobber)

- Scope (`id`, `title`, `order`, `phase`, `prd_ref`, `acceptance`, `blocked_by`): human + define skill.
- `epic`, `gh_issue`: written back by the define/ship skill after the GH issue exists.
- `status`, `verify`: status adapter + implement/ship evidence.

## Workflow

define → implement → ship. Rules, Definition of Ready/Done, and the human approval
gates are in `docs/engineering/workflow.md`. **Stops:** the PRD must be
`status: approved` before backlog seeding; the epic plan gets a human glance before
implementation.

## Doc map

- `docs/product/` — PM (PRD is `06-prd.md`; requirements carry `REQ-xx` ids).
- `docs/architecture/` — system/data/API/infra; ADRs in `decisions/`.
- `docs/design/` — design system (tokens, components, UI kit).
- `docs/engineering/` — `01-tech-plan.md`, the `backlog.json` contract, `workflow.md`.

## Commands

```
node scripts/validate.mjs         # validate the contract (run before commit/build)
node scripts/gate.mjs check G6    # verify a human gate before proceeding
node scripts/sync-status.mjs      # update local/GitHub status into the contract
node scripts/build-dashboard.mjs  # render PROGRESS_DASHBOARD.html (zero tokens)
```

## Skill working state

`.claude/epic-<n>/` (epic.json, sub-<n>.json, ledger.md) and `.claude/ship-<n>/issue-<n>.json`
are owned by the skills — do not hand-edit. `sy
