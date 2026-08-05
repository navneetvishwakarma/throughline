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

Idea → define → implement → ship → release → measure → loop. Nine gates (G1–G9),
field ownership, the status enum, and Definition of Ready/Done are all in
`docs/engineering/workflow.md` — that file, not this one, is authoritative for gate
detail. Check where the project actually stands with `node scripts/gate.mjs list`;
never assume a gate is clear from how a doc reads.

## Doc map

- `docs/product/` — PM (PRD is `06-prd.md`; requirements carry `REQ-xx` ids).
- `docs/architecture/` — system/data/API/infra; ADRs in `decisions/`.
- `docs/design/` — design system (tokens, components, UI kit).
- `docs/engineering/` — `01-tech-plan.md`, the `backlog.json` contract, `workflow.md`.

## Commands

```
node scripts/validate.mjs         # validate the contract (run before commit/build)
node scripts/check-docs.mjs       # structural checks on PRD/design/architecture/retro docs
node scripts/gate.mjs check G6 --subject <epic-id>  # G6/G7 run per epic — always scope with --subject
node scripts/gate.mjs list        # show every gate's approval state
node scripts/sync-status.mjs      # update local/GitHub status into the contract
node scripts/coverage.mjs --check # verify coverage against threshold
node scripts/build-dashboard.mjs  # render PROGRESS_DASHBOARD.html (zero tokens)
```

## Skill working state

`.throughline/epic-<n>/` (epic.json, sub-<n>.json, ledger.md) and `.throughline/ship-<n>/issue-<n>.json`
are owned by the skills. Do not hand-edit them. **Never write this state under `.claude/`,
`.cursor/`, `.vscode/`, `.gemini/`, or any other platform-specific directory** — even out
of habit — `.throughline/` is the only location every agent reads the same way, and
`node scripts/validate.mjs` fails loud if it finds epic/ship state anywhere else.

## Any agent can pick this up

This file, `docs/engineering/backlog.json`, `docs/engineering/workflow.md`, and
`.throughline/gates.json` are the complete portable state of the project — plain,
platform-neutral files tracked in git. Claude Code, Codex, Antigravity, or any other
agent reads the same four things and gets the same answer for what's done, what's
next, and what's approved. There is no separate hand-off step between platforms.
