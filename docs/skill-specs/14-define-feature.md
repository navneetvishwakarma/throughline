---
skill-spec: define-feature
type: new
status: draft (review → skill-creator)
updated: 2026-08-11
---

# define-feature — skill spec

## Description
Spec one unit of implementable work — a **feature**, defined as either a single story
(the building block of an already-planned epic) or standalone non-epic work with a
logical boundary — before code. Grills for ambiguities first, applies the right expert
personas, writes a full spec, self-reviews it against five quality dimensions. Trigger
with "define feature for story S-x", "spec story S-x of E-x" (epic-linked), or "define
this feature", "spec out this fix" (standalone). Not every `ship-feature` needs this — a
genuine one-liner skips straight to `implement-feature` or `ship-feature`.

## Context (token protocol)
Follow the README *Context & token protocol*. If a codegraph index is present, query it
rather than reading files broadly.

## Persona(s)
Auto-selected per feature: PM (always), Architect (backend/data/infra), UX Designer
(user-facing UI), Security Consultant (auth/payments/sensitive data). Same in both modes.

## Reuse
- None required; produces the spec directly if no accelerator plugin is installed.

## Inputs
- Epic-linked mode: a story id (`S-x`) belonging to an already-planned, G6-approved epic.
- Standalone mode: a feature description, hotfix report, or task from the user.

## Gate-in
- **Epic-linked mode:** the epic's G6 is approved (`gate.mjs check G6 --subject <epic-id>`)
  and the named story exists under that epic in `backlog.json`.
- **Standalone mode:** none — this is an entry point, parallel to how `define-epic` is
  the entry point once `backlog.json` is approved.

## Procedure
1. **Determine mode** — a named story from a planned epic vs. everything else.
2. **Epic-linked:** branch check reuses `epic/<epic-id>-<slug>` (`define-epic`'s own
   branch, never a new one). Grill, then write/refine
   `.throughline/epic-<N>/sub-<story-id>.json` in `define-epic`'s own per-story shape —
   append to that epic's *existing* ledger/test-plan rather than creating a parallel
   state directory. No new GitHub issue — `define-epic` already filed this story's
   `gh_issue` when the epic was defined.
3. **Standalone:** branch check creates/reuses `feature/<slug>`. Grill (batch, max 5,
   ranked by impact), write `.throughline/feature-<slug>/spec.md` (user story, problem,
   outcome, in/out of scope, assumptions, BDD acceptance criteria, DoD, tests — doubles
   as the test plan), self-review, then (github mode only) file one GitHub issue as a
   mirror of `spec.md`, never a replacement for it.
4. **Self-review** (both modes) against five dimensions: completeness, effectiveness,
   clarity, testability, traceability. Fix and re-check until all pass.

## Outputs
- Epic-linked: a refined `.throughline/epic-<N>/sub-<story-id>.json`.
- Standalone: `.throughline/feature-<slug>/spec.md` (+ ledger skeleton), and (github
  mode) a filed GitHub issue mirroring it.

## Automated gate
- None. Self-review is a checklist walked by the agent, not a script. `validate.mjs`
  still governs `backlog.json` shape in epic-linked mode.

## Human gate
- Epic-linked mode inherits the epic's G6 (already approved as gate-in; not re-approved
  here — this skill only refines one story within an already-approved plan).
- Standalone mode has no numbered gate; the task-breakdown approval inside
  `implement-feature` is the first checkpoint, G7 at `ship-feature` the only formal one.

## Definition of Done
- Epic-linked: `sub-<story-id>.json` refined, self-reviewed, `validate.mjs` passes.
- Standalone: `spec.md` exists, passes all five self-review dimensions, and (github
  mode) is filed.

## Failure modes
- Epic-linked mode invoked but G6 isn't approved, or the story doesn't exist under that
  epic → stop; run `define-epic` first.
- Ambiguity slips into the spec unaddressed → stop, grill, then write.
- A self-review dimension fails → fix inline, never file/finish with a known gap.
- `gh repo view` fails (standalone, github mode) → stop; never guess the repo.
