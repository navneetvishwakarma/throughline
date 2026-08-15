---
doc: workflow
project: <PROJECT_NAME>
status: standard
updated: <DATE>
purpose: The gates and ownership rules the define/implement/ship skills enforce. Project-agnostic — content here does not change between projects.
---

# Development Workflow

The loop is **idea → define → implement → ship → release → measure → loop**, driven
by one contract: `docs/engineering/backlog.json`. The agent reasons at each *define*
step and at implementation; ownership, sequencing, and gate state are data, checked
by scripts — never re-derived by reading the codebase or re-argued from memory.

## Any agent can pick this up

This file, `AGENTS.md`, `docs/engineering/backlog.json`, and `.throughline/gates.json`
are the **complete, portable state of where the project is** — plain files, tracked
in git, with nothing platform-specific in any of them. Claude Code, Codex, Antigravity,
or any other agent reading this repo gets the same answer to "what's done, what's next,
what's approved" by reading the same four things. There is no separate hand-off step:
whichever agent picks up the repo next reads this state and resumes.

This guarantee only holds if working state actually lives in `.throughline/` — an agent
that writes epic ledgers or gate state into `.claude/`, `.cursor/`, or any other
platform-specific directory (out of habit, not instruction) breaks it for whoever picks
up the repo next. `node scripts/validate.mjs` checks for exactly this and fails loud if
it finds skill working state in the wrong place; `node scripts/sync-plugin.mjs
--repair-state --apply` moves it back.

## Branch discipline

No skill ever writes or commits directly on `main`/`master`. Every skill's own
`## Branch check` step runs `node scripts/ensure-branch.mjs --skill=<name>` before
anything else — off `main` already, it's a no-op; on `main` (or no commits yet), it
creates and switches to `feature/<skill>-<timestamp>` automatically and reports the
name. `define-epic` and `implement-epic` share one continuous `epic/<epic-id>-<slug>`
branch instead (`ensure-branch.mjs --name=epic/<epic-id>-<slug>`), so the epic's specs,
implementation, and ship all land on the same history. `define-feature` and
`implement-feature` run in one of two modes and branch accordingly: **epic-linked**
(spec'ing/building a single story that's a building block of an already-planned epic —
a lighter, one-story-at-a-time alternative to expanding `define-epic`/looping
`implement-epic` all at once) shares that same `epic/<epic-id>-<slug>` branch, because
the story's work still ships only as part of the whole epic, atomically, via
`ship-epic`; **standalone** (non-epic work with a logical boundary — a hotfix,
plugin/scaffold maintenance, a doc-only change) shares `feature/<slug>` instead, and
ships via `ship-feature`. Trivial standalone changes can skip the spec step entirely and
go straight to `implement-feature` or `ship-feature`. `release` is the one deliberate
exception — it runs after a release's epics are already merged and operates on `main`
itself.

**Resolving `<slug>` for a shared `epic/<epic-id>-<slug>` branch.** `ensure-branch.mjs
--name=<X>` takes a literal, already-resolved branch name — it never derives the slug
itself, so whichever skill runs first must resolve it the same deterministic way every
other skill touching that epic will: check for an existing local branch matching
`epic/<epic-id>-*` (`git branch --list "epic/<epic-id>-*"`, then `git branch -r --list
"origin/epic/<epic-id>-*"` if none local) and reuse that exact name if found; only if
none exists yet, derive it from the epic's `title` in `backlog.json` using the same
kebab-case rule `build-dashboard.mjs`'s own `slug()` helper uses (lowercase,
non-alphanumeric runs collapsed to `-`, trimmed). This matters most for
`define-feature`/`implement-feature` in epic-linked mode, which can be invoked standalone
in a fresh session rather than immediately after `define-epic` — resolving from an
existing branch first, not re-deriving from scratch, is what prevents a second
`epic/<epic-id>-<other-slug>` branch from silently forking the epic's history.

Pushing to remote only ever happens through **`ship-epic`** (backlog-tracked epic work,
including any single story spec'd/built via `define-feature`/`implement-feature` in
epic-linked mode — a story never ships out of the shared epic branch on its own) or
**`ship-feature`** (standalone non-epic work: hotfixes, plugin/scaffold maintenance,
doc-only changes, and features spec'd/built by `define-feature`/`implement-feature` in
standalone mode), both gated the same way (build/test, a security lens where relevant,
explicit human approval) and both scoping G7 by subject (`--subject <epic-id>` or
`--subject <feature-slug>`) so
a stale approval from one ship never satisfies another's.

The bundled pre-commit hook backstops all of this with
`node scripts/ensure-branch.mjs --check-only`, which hard-blocks any commit made
directly on `main`/`master` regardless of which skill (or a human bypassing the skills
entirely) is running.

## Gate sequence (the pipeline)

```
define-brief            G1    framing + riskiest-assumption decision
validate-assumption      G1.5  (optional) proceed / pivot / kill after a spike
bootstrap-project / adopt-project     (mechanical — no human gate)
define-product           G2    PRD approved
define-design            G3    design tier approved      \  run in parallel
define-architecture      G4    architecture/ADRs accepted /
define-backlog           G5    epics + stories approved
define-epic              G6    one epic's story specs + test plan approved
implement-epic                 (no gate — reviewed at ship)
ship-epic                G7    PR/local merge approved
release                  G8    release go/no-go
measure-learn            G9    proceed / pivot / kill, from real usage data
  -> loops back to define-brief in RECONCILE mode for the next release
```

Check where a project actually stands with `node scripts/gate.mjs list` — that reads
`.throughline/gates.json` directly and is authoritative. Never assume a gate is clear
because a doc "looks" approved; check the gate.

`G6` and `G7` run once **per epic**, not once per project — always pass
`--subject <epic-id>` when approving/checking them (`gate.mjs approve G6 --subject E-3`,
`gate.mjs check G7 --subject E-3`). Without `--subject`, a stale global approval left
over from a previously shipped epic would silently satisfy a later epic's gate-in.

| Gate | You decide |
|------|-----------|
| G1 | Is the framing right? Validate the risky bet, or accept it as-is? |
| G1.5 | After a spike: proceed / pivot / kill |
| G2 | PRD approved — building may begin |
| G3 | Design tier (journeys, tokens, wireframes, mockups) approved |
| G4 | Architecture/ADRs accepted; security threat model recorded |
| G5 | Backlog epics/stories, order, and estimates approved |
| G6 | Epic plan sound before coding starts |
| G7 | PR review / local merge approved |
| G8 | Release go/no-go |
| G9 | Post-release retro: proceed / pivot / kill |

## Seed vs. reconcile (first release vs. v2+)

`bootstrap-project`/`adopt-project` run once. Every other define-tier skill runs in
**seed** mode the first time and **reconcile** mode on every release after — each has
its own mechanical trigger (a specific file's approval status, never a guess):

| Skill | Reconcile trigger | What reconcile means |
|-------|--------------------|-----------------------|
| `define-product` | `06-prd.md` already `approved` | Append new `REQ-xx`, never renumber a shipped one. |
| `define-design` | `docs/design/README.md` already `approved` | Extend tokens/primitives in place; only new journeys/screens for the new release. |
| `define-architecture` | `01-system-overview.md` already `approved` | A real review: classify each new requirement fits-unchanged / additive / breaking. |
| `define-backlog` | any epic/story already carries a tracker issue | Append `release: v2` epics/stories; advance `release_in_flight` in the same write. Shipped work untouched. |

`measure-learn` is the loop-closer: it writes `docs/product/retros/<release>.md` once
real usage data exists, and `define-brief`'s own gate-in requires that retro (with a
recorded decision) before a new cycle can start. `backlog.json`'s `release_in_flight`
names which release is currently being worked — read it, don't infer it from context.

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
| `stories[].design_ref` | define-backlog | Path to the `docs/design/screens/*.md` the story implements, when one exists. Optional; one screen per story. |
| story `status` | status adapter | Local mode is written by workflow skills; GitHub mode is mirrored from issue state. |
| story `verify.ci`, `verify.commit` | implement-epic | Written after the agent's own test run passes. |
| story `verify.coverage` | `scripts/coverage.mjs`, invoked by implement-epic | Never hand-typed — patched from the measured summary via `--story <id>`. |
| epic status / progress | derived | Computed by the dashboard from child stories. Never stored. |
| `release_in_flight` | define-backlog | The release currently being worked. Advanced only here — in the same write as the first epic tagged to the new release — so it can never point at a release with no matching epic while other skills' gates run `validate.mjs` in between. |
| `epics[].breaking` | define-backlog | Set true when intaking a migration story that `define-architecture`'s reconcile pass flagged as breaking/structural. Feeds `scripts/bump-version.mjs`'s `epic-driven` mode. |
| `versioning.current` | `release`, via `scripts/bump-version.mjs --apply` | Mirrors `package.json`'s version; `package.json` stays authoritative. |

## Definition of Ready (a story may be picked up only if)

- The PRD it references has front-matter `status: approved`.
- `prd_ref` points at a real requirement ID (e.g. `REQ-12`).
- `acceptance` is non-empty and testable.
- All `blocked_by` dependencies are `done`.
- The relevant human gate is approved in `.throughline/gates.json`.

## Definition of Done (a story is `done` only when)

- In GitHub mode, its issue is CLOSED. In local mode, `ship-epic` marks it done.
- Acceptance criteria met; tests for the change pass (`verify.ci: pass`).
- Repo coverage meets `coverage.min` when `coverage.mode: enforce` (measured by `scripts/coverage.mjs`, repo-wide — not yet scoped to just the story's own changed files).
- If the story carries a `design_ref`, the implementation has been visually compared against that approved screen doc and deviations flagged.
- The epic ledger (`.throughline/epic-<n>/ledger.md`) records files, tests, commit.

## Human approval gates (the agent stops here)

See the gate table above — `G1` through `G9`. In short: no backlog stories are seeded
until the PRD is `approved` (G2); no coding starts on an epic until its plan gets a
human glance (G6); no merge happens without review (G7).

## Refreshing the dashboard (zero tokens)

```
node scripts/validate.mjs         # gate: fails loud on a bad contract
node scripts/gate.mjs list        # show human gate state — the authoritative source
node scripts/sync-status.mjs      # sync local/GitHub status into the contract
node scripts/coverage.mjs --check # verify coverage against threshold
node scripts/bump-version.mjs     # resolve/apply the release version per versioning policy (release, G8)
node scripts/build-dashboard.mjs  # render PROGRESS_DASHBOARD.html (work board + Planning section)
```
