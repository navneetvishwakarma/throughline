---
skill-spec: implement-feature
type: new
status: draft (review → skill-creator)
updated: 2026-08-11
---

# implement-feature — skill spec

## Description
Build one unit of implementable work via TDD — either a single story from an
already-planned epic (a lighter, one-story-at-a-time alternative to `implement-epic`'s
whole-epic loop, writing back to the same `backlog.json`/ledger `implement-epic` would),
or a standalone non-epic change from a `define-feature` spec (or spec-less, for a
trivial fix). Trigger with "implement story S-x", "implement feature for S-x of E-x"
(epic-linked), or "implement this feature" (standalone). Epic-linked mode never touches
`ship-feature`; standalone mode never touches `backlog.json` or merges/pushes itself.

## Context (token protocol)
Follow the README *Context & token protocol*. Epic-linked: read the sub-issue spec + the
epic's ledger, same as `implement-epic`. Standalone: read `spec.md`'s technical/data
notes, then find closest existing patterns before writing anything. If a codegraph index
is present, query it for exact symbols/call sites; read only those spans.

## Persona(s)
- **Lead: Developer** (clean, tested, spec-to-code implementation). **Supporting:
  Security** (auth/PII/secrets self-pass, mandatory when touched).

## Reuse
- `superpowers:test-driven-development` (required) for the red-green-refactor loop.

## Inputs
- Epic-linked: `.throughline/epic-<N>/sub-<story-id>.json` (from `define-epic` or
  `define-feature` epic-linked mode).
- Standalone: `.throughline/feature-<slug>/spec.md` (preferred), or a direct request for
  changes small enough that a human explicitly says to skip the spec step.

## Gate-in
- **Epic-linked:** the epic's G6 is approved (`gate.mjs check G6 --subject <epic-id>`)
  and the story's spec file exists.
- **Standalone:** a spec exists, or the human has explicitly said this one skips
  `define-feature`. If a spec exists, it — not any linked GitHub issue — is the source
  of truth: external trackers are mirrors, never sources of truth.

## Procedure
1. **Determine mode**, same split as `define-feature`.
2. **Epic-linked:** branch check reuses `epic/<epic-id>-<slug>`; scan `git log
   --oneline` for this story's id to detect resumed work. Task breakdown → TDD per task
   (required sub-skill) → ledger row in the epic's *shared* `ledger.md` → write
   `story.verify.ci`/`verify.commit` into `backlog.json` → `coverage.mjs --story <id>`
   patches `verify.coverage` → set `status: in_progress` only where the status adapter
   doesn't own it (identical field-ownership rule to `implement-epic`). Mid-flight
   amend: stop, reconcile via `define-backlog`, re-gate G6, resume. Quality gate + self
   review (incl. Design row when `design_ref` set) — same as `implement-epic`'s own.
3. **Standalone:** branch check reuses/creates `feature/<slug>`. Task breakdown → wait
   for approval → TDD per task → ledger row in `.throughline/feature-<slug>/ledger.md`.
   Mid-flight amend: stop, re-run `define-feature`, re-approve, resume. Feature quality
   gate (build + full suite + `coverage.mjs --json`) → self-review (8 dimensions) →
   local spin-up guide.

## Outputs
- Epic-linked: committed tasks on the shared epic branch, ledger row(s), `backlog.json`
  verify fields written. No merge, no push, no `ship-feature` — resumes the epic flow
  (next story, or `ship-epic` once the epic is complete).
- Standalone: committed tasks on `feature/<slug>` with ledger rows; `test-out.txt` /
  `coverage-out.txt`; a local spin-up guide. Handed off to `ship-feature`.

## Automated gate
- Build clean; full test suite clean; `coverage.mjs --check` passes, is explicitly
  warn-only, or `needs_setup` was surfaced to the human. Same check, same script, both
  modes — it's repo-wide either way, never story- or feature-scoped.

## Human gate
- None on the happy path except the Step-2 task-breakdown approval. Epic-linked work is
  reviewed at `ship-epic`; standalone work at `ship-feature` — G7 either way, never here.

## Definition of Done
- Epic-linked: this story's AC implemented and self-reviewed clean; quality gate
  passed; ready for the next story or `ship-epic`.
- Standalone: all AC implemented and self-reviewed clean; quality gate passed; ready
  for `ship-feature`.

## Failure modes
- Epic-linked mode invoked but G6 isn't approved, or no `sub-<story-id>.json` exists →
  stop; run `define-epic`/`define-feature` (epic-linked) first.
- Standalone mode with no spec and the change isn't obviously trivial → stop, suggest
  `define-feature` first rather than guessing scope.
- Build/test/coverage fails after all tasks → stop, report, do not hand off.
- Blocker mid-task (missing file, contradicted spec, ambiguous instruction) → stop and
  surface it; never speculate.
