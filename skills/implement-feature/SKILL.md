---
name: implement-feature
description: Use after define-feature has produced .throughline/feature-<slug>/spec.md (or standalone, for a hotfix small enough to skip a formal spec) to build the change via TDD — task breakdown, branch, red-green-refactor per task, quality gate, self-review, then hand off to ship-feature for the merge. Trigger phrases: "implement this feature", "build feature <slug>", "run implement-feature". For epic-tracked work use implement-epic instead. There is no human gate here on the happy path except the task-breakdown approval — G7 is at ship-feature.
---

# implement-feature

Act as a top-0.1% FAANG senior developer. Write simple, readable, well-tested code in small vertical increments. Spec to code: AC drives tests, tests drive implementation — never the reverse.

## Scope
For backlog-tracked work, use `implement-epic` instead. This skill never touches `backlog.json`, never creates GitHub sub-issues, and never merges or pushes — that's `ship-feature`'s job, the same clean split `implement-epic` keeps from `ship-epic`.

## Gate-in
`.throughline/feature-<slug>/spec.md` exists (from `define-feature`), **or** the change is small enough that a human explicitly says to skip straight to implementation — don't force a spec on a genuine one-liner. If a spec exists, treat it — not any linked GitHub issue — as the source of truth: external trackers are mirrors, never sources of truth.

## Context protocol
Read `spec.md`'s Architecture/Technical Notes and Data/Migration Notes, then find the closest existing patterns in the codebase for what this needs — reuse before adding. If a codegraph index is present (`.codegraph/`), query it to locate exact symbols/call sites and read only those spans. Don't begin the task breakdown until the existing code is understood well enough to write against without guessing.

**Ledger writes go under `.throughline/feature-<slug>/` — never `.claude/`, `.cursor/`, or any other platform-specific directory, even by habit.** `validate.mjs` fails loud if it finds it elsewhere.

## Step 1 — Branch check
Run `node scripts/ensure-branch.mjs --skill=implement-feature --name=feature/<slug>` — same branch `define-feature` created (or creates fresh off `main` if no spec step ran). Reuse, don't re-fork: if the branch already carries commits (e.g. `define-feature` committed `spec.md` there), scan `git log --oneline` for task ids already done before proposing the breakdown.

## Step 2 — Task breakdown
Generate a visible, reviewable plan from the spec's Acceptance Criteria and Tests (or, spec-less, from the request directly):

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

## Step 3 — Execute via TDD
**Required sub-skill:** `superpowers:test-driven-development` for the red-green-refactor loop within each task.

For each task: read the relevant AC from `spec.md`, write the failing test asserting it, confirm it fails for the right reason, write minimum code to pass, refactor if needed, run targeted tests for this task only (not the full suite), commit (`feat: <description> (<feature-slug>)`), append a row to `.throughline/feature-<slug>/ledger.md`.

**Stop immediately** when: a test won't go green and the fix isn't clear from the spec; an expected file/symbol doesn't exist or has unexpected structure; the spec contradicts the codebase; an instruction is genuinely ambiguous. State what was expected, what was found, what decision is needed — never guess.

**Security lens:** run a code-review + security-review self-pass for any change touching auth, PII, or secrets. Resolve findings before the next task.

## Step 4 — Mid-flight amend
If the spec's scope or acceptance turns out wrong while building: stop, don't force code to fit it. Re-run `define-feature` to amend `spec.md` in place, re-present the task breakdown for approval, resume only after that.

## Step 5 — Feature quality gate
After all tasks are committed:
```bash
npm run build    # or project equivalent
npm test 2>&1 | tee .throughline/feature-<slug>/test-out.txt
node scripts/coverage.mjs --json 2>&1 | tee .throughline/feature-<slug>/coverage-out.txt
```
On failure: stop, report, fix before continuing.

## Step 6 — Self-review
| Dimension | Check |
|-----------|-------|
| Completeness | Every AC implemented; every DoD checkbox tickable |
| Code quality | Clean, no unnecessary abstractions, matches repo patterns |
| Security | No injection risks, no exposed secrets, safe defaults |
| Authorization | Owner-scoping enforced; no privilege-escalation paths |
| Validation | Inputs validated at system boundaries; errors surface clearly |
| Observability | Key events from the spec's Observability section instrumented |
| Testability | Tests assert behavior, not implementation details |
| Coverage | `node scripts/coverage.mjs --check` passes, or is explicitly warn-only, or `needs_setup` was flagged |

Fix any gap before handing off. A gap that requires scope explicitly excluded in the spec: note it, leave it out, flag it.

## Step 7 — Local spin-up guide
Produce a concise "how to test this manually" block: prerequisites (env vars, migrations), start command, numbered steps to exercise the happy path plus one edge case and one error case, expected result.

## Done when
All tasks committed with ledger rows; build/tests/coverage clean; self-review passed; local spin-up guide produced. Hand off to `ship-feature` — this skill never merges or pushes.

## Failure modes
- No spec and the change isn't obviously trivial → stop, suggest `define-feature` first rather than guessing scope.
- Build or full test suite fails after all tasks → stop, report, do not hand off to `ship-feature`.
- Blocker mid-task → stop and surface the conflict; never speculate past it.
