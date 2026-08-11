---
skill-spec: implement-feature
type: new
status: draft (review → skill-creator)
updated: 2026-08-11
---

# implement-feature — skill spec

## Description
Build the change `define-feature` spec'd (or a change small enough to skip a formal
spec) via TDD — task breakdown, one continuous feature branch, red-green-refactor per
task, a build/test/coverage quality gate, self-review, then hand off to `ship-feature`
for the actual merge. Trigger with "implement this feature", "build feature <slug>".
Never touches `backlog.json`, never creates GitHub sub-issues, never merges or pushes —
the same clean split `implement-epic` keeps from `ship-epic`.

## Context (token protocol)
Follow the README *Context & token protocol*. Read `spec.md`'s technical/data notes,
then find closest existing patterns before writing anything. If a codegraph index is
present, query it for exact symbols/call sites; read only those spans.

## Persona(s)
- **Lead: Developer** (clean, tested, spec-to-code implementation). **Supporting:
  Security** (auth/PII/secrets self-pass, mandatory when touched).

## Reuse
- `superpowers:test-driven-development` (required) for the red-green-refactor loop.

## Inputs
- `.throughline/feature-<slug>/spec.md` (preferred), or a direct request for changes
  small enough that a human explicitly says to skip the spec step.

## Gate-in
- A spec exists, **or** the human has explicitly said this one skips `define-feature`.
  If a spec exists, it — not any linked GitHub issue — is the source of truth: external
  trackers are mirrors, never sources of truth (the same principle `sync-status.mjs`
  already follows for epics).

## Procedure
1. **Branch check** — `ensure-branch.mjs --skill=implement-feature --name=feature/<slug>`,
   reusing `define-feature`'s branch if it exists; scan `git log --oneline` for
   already-done tasks before proposing a breakdown.
2. **Task breakdown** from the spec's AC/Tests (schema → domain → API → UI →
   observability order); wait for explicit approval before touching code.
3. **TDD per task**: failing test from the AC → confirm it fails right → minimum code →
   refactor → targeted tests only → commit → ledger row. Full suite runs once, not per
   task. Stop on any blocker; never guess past one.
4. **Mid-flight amend**: if the spec turns out wrong, stop, re-run `define-feature` to
   amend it, re-approve the breakdown, resume.
5. **Feature quality gate**: build + full test suite + `coverage.mjs --json`, all
   logged under `.throughline/feature-<slug>/`.
6. **Self-review** against 8 dimensions (completeness, code quality, security,
   authorization, validation, observability, testability, coverage).
7. **Local spin-up guide**: prerequisites, start command, numbered manual-test steps.

## Outputs
- Committed tasks on `feature/<slug>` with ledger rows; `test-out.txt` /
  `coverage-out.txt`; a local spin-up guide. No merge, no push — handed off to
  `ship-feature`.

## Automated gate
- Build clean; full test suite clean; `coverage.mjs --check` passes, is explicitly
  warn-only, or `needs_setup` was surfaced to the human.

## Human gate
- None on the happy path except the Step 2 task-breakdown approval. G7 is at
  `ship-feature`.

## Definition of Done
- All AC implemented and self-reviewed clean; quality gate passed; ready for
  `ship-feature`.

## Failure modes
- No spec and the change isn't obviously trivial → stop, suggest `define-feature` first.
- Build/test/coverage fails after all tasks → stop, report, do not hand off.
- Blocker mid-task (missing file, contradicted spec, ambiguous instruction) → stop and
  surface it; never speculate.
