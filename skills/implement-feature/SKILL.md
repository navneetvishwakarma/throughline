---
name: implement-feature
description: Use to build one unit of implementable work via TDD — either a single story that's a building block of an already-planned epic (a lighter, one-story-at-a-time alternative to implement-epic's whole-epic loop, writing back to the same backlog.json/ledger implement-epic would), or a standalone non-epic change (from a define-feature spec, or spec-less for a trivial fix) that hands off to ship-feature. Trigger phrases: "implement story S-x", "implement feature for S-x of E-x", "implement this feature", "run implement-feature". There is no human gate here on the happy path except the task-breakdown approval — epic-linked work is reviewed at ship-epic; standalone work at ship-feature.
---

# implement-feature

Act as a top-0.1% FAANG senior developer. Write simple, readable, well-tested code in small vertical increments. Spec to code: AC drives tests, tests drive implementation — never the reverse.

## Step 0 — Determine mode
Mirrors `define-feature`'s mode split:

- **Epic-linked mode**: implementing a specific story (`S-x`) from an already-planned epic. This is a scoped-down entry point into the *same* mechanics `implement-epic` runs per story — not a parallel system. It writes to the same `backlog.json` fields and the same `.throughline/epic-<N>/` state `implement-epic` would.
- **Standalone mode**: a non-epic change, spec'd by `define-feature` or explicitly spec-less for a trivial fix.

If a story id is given, use epic-linked mode. Otherwise standalone.

---

## Epic-linked mode

### Gate-in
The epic's G6 is approved (`node scripts/gate.mjs check G6 --subject <epic-id>`), and `.throughline/epic-<N>/sub-<story-id>.json` exists (from `define-epic` or `define-feature` epic-linked mode).

### Context protocol
Read the sub-issue spec + the epic's ledger, same as `implement-epic`'s own context protocol. If a codegraph index is present, query it for exact symbols/call sites. **Ledger writes go under `.throughline/epic-<N>/` — never `.claude/` or any platform-specific directory.**

### Step 1 — Branch check
Resolve `<slug>` per `workflow.md`'s **Resolving `<slug>`** rule — reuse the existing `epic/<epic-id>-*` branch if `define-epic`/`define-feature` already created one; never re-derive from scratch when this runs as a fresh session rather than immediately after them. Then run `node scripts/ensure-branch.mjs --skill=implement-feature --name=epic/<epic-id>-<slug>`. If it already carries commits, scan `git log --oneline` for this story's id before proposing a breakdown, to detect resumed work.

### Step 2 — Task breakdown, then TDD
Same task-breakdown format and approval gate as standalone mode (below), scoped to this one story's spec. **Required sub-skill:** `superpowers:test-driven-development`. Per task: failing test from the story's `acceptance` → confirm it fails right → minimum code → refactor → targeted tests only → commit (`feat: <description> (<story-id>)`) → append a row to `.throughline/epic-<N>/ledger.md`, exactly as `implement-epic` would.

### Step 3 — Contract write-back
After tests pass, write into `backlog.json`:
```json
"verify": { "ci": "pass", "commit": "<SHA>" }
```
Then `node scripts/coverage.mjs --story <id>` to patch `verify.coverage` — never hand-type it. Do **not** set `status` if a tracker adapter owns it; in local mode, set `status: in_progress` on start and leave `done` for `ship-epic`. This is `implement-epic`'s own field-ownership rule, unchanged here.

### Step 4 — Mid-flight amend
If the story's slice or acceptance turns out wrong: stop, don't force code to fit it. Run `define-backlog` in reconcile mode to amend, re-gate G6 for the affected item, resume only after approval — same as `implement-epic`'s Step 3.

### Step 5 — Quality gate and self-review
Run the same build + full test suite + `node scripts/coverage.mjs --json` implement-epic's epic quality gate runs (it's repo-wide either way, not story-scoped), and the same cross-feature self-review checklist implement-epic uses, including the **Design** row when the story carries `design_ref`.

### Done when
This story's `verify` fields written; ledger row added; tests green; no open review findings. **Hand off back into the epic flow** — resume `implement-epic`/`implement-feature` for the next unblocked story, or, once every story in the epic is done, `ship-epic`. This mode never hands off to `ship-feature`: an epic ships as one unit, atomically, once all its stories are complete — `ship-epic`'s own gate-in requires every story's `verify.ci: pass`, so a single story can't be shipped out of the shared epic branch independently.

---

## Standalone mode

## Scope
Never touches `backlog.json`, never creates GitHub sub-issues, never merges or pushes — that's `ship-feature`'s job, the same clean split `implement-epic` keeps from `ship-epic`.

## Gate-in
`.throughline/feature-<slug>/spec.md` exists (from `define-feature`), **or** the change is small enough that a human explicitly says to skip straight to implementation. If a spec exists, treat it — not any linked GitHub issue — as the source of truth: external trackers are mirrors, never sources of truth.

## Context protocol
Read `spec.md`'s Architecture/Technical Notes and Data/Migration Notes, then find the closest existing patterns in the codebase for what this needs — reuse before adding. If a codegraph index is present, query it and read only the returned spans. **Ledger writes go under `.throughline/feature-<slug>/` — never `.claude/` or any platform-specific directory.**

### Step 1 — Branch check
Run `node scripts/ensure-branch.mjs --skill=implement-feature --name=feature/<slug>` — same branch `define-feature` created (or fresh off `main` if no spec step ran).

### Step 2 — Task breakdown
```
Task breakdown: <feature slug>
Branch: feature/<slug>
Base: main

Tasks:
1. [Layer] What -> which files -> what the TDD cycle tests
2. ...

DB migrations: yes / no
Env changes: yes / no

Confirm to proceed, or correct anything above.
```
Order: schema/persistence -> domain logic -> API/server layer -> UI -> observability. Wait for explicit approval before touching any code.

### Step 3 — Execute via TDD
**Required sub-skill:** `superpowers:test-driven-development`. Per task: failing test from the AC → confirm it fails right → minimum code → refactor → targeted tests only → commit (`feat: <description> (<feature-slug>)`) → ledger row in `.throughline/feature-<slug>/ledger.md`.

**Stop immediately** when: a test won't go green and the fix isn't clear from the spec; an expected file/symbol doesn't exist or has unexpected structure; the spec contradicts the codebase; an instruction is genuinely ambiguous. State what was expected, what was found, what decision is needed — never guess.

**Security lens:** run a code-review + security-review self-pass for any change touching auth, PII, or secrets. Resolve findings before the next task.

### Step 4 — Mid-flight amend
If the spec turns out wrong while building: stop, re-run `define-feature` to amend `spec.md`, re-present the task breakdown, resume only after approval.

### Step 5 — Feature quality gate
```bash
npm run build
npm test 2>&1 | tee .throughline/feature-<slug>/test-out.txt
node scripts/coverage.mjs --json 2>&1 | tee .throughline/feature-<slug>/coverage-out.txt
```
On failure: stop, report, fix before continuing.

### Step 6 — Self-review
| Dimension | Check |
|-----------|-------|
| Completeness | Every AC implemented; every DoD checkbox tickable |
| Code quality | Clean, no unnecessary abstractions, matches repo patterns |
| Security | No injection risks, no exposed secrets, safe defaults |
| Authorization | Owner-scoping enforced; no privilege-escalation paths |
| Validation | Inputs validated at system boundaries; errors surface clearly |
| Observability | Key events from the spec's Observability section instrumented |
| Testability | Tests assert behavior, not implementation details |
| Coverage | `node scripts/coverage.mjs --check` passes, is explicitly warn-only, or `needs_setup` was flagged |

### Step 7 — Local spin-up guide
Prerequisites (env vars, migrations), start command, numbered steps to exercise the happy path plus one edge case and one error case, expected result.

### Done when
All tasks committed with ledger rows; build/tests/coverage clean; self-review passed; local spin-up guide produced. **Hand off to `ship-feature`** — this mode never merges or pushes itself.

---

## Failure modes
- Epic-linked mode invoked but G6 isn't approved, or no `sub-<story-id>.json` exists → stop; run `define-epic`/`define-feature` (epic-linked) first.
- Standalone mode with no spec and the change isn't obviously trivial → stop, suggest `define-feature` first rather than guessing scope.
- Build/test/coverage fails after all tasks → stop, report, do not hand off.
- Blocker mid-task (missing file, contradicted spec, ambiguous instruction) → stop and surface it; never speculate.
