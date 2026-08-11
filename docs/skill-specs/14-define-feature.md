---
skill-spec: define-feature
type: new
status: draft (review → skill-creator)
updated: 2026-08-11
---

# define-feature — skill spec

## Description
Turn non-epic work — a hotfix, plugin/scaffold maintenance, a doc-only change, a small
standalone feature — into a spec before code, when it's substantial enough that skipping
one would mean guessing at scope or acceptance later. Grills for ambiguities first,
applies the right expert personas, writes a full spec, self-reviews it against five
quality dimensions, then either files it as a GitHub issue (`tracker: github`) or keeps
it local (`tracker: local`, the default). Trigger with "define this feature", "spec out
this fix", "plan this change". Not every `ship-feature` needs this — a genuine one-liner
skips straight to `implement-feature` or `ship-feature`.

## Context (token protocol)
Follow the README *Context & token protocol*. If a codegraph index is present
(`.codegraph/`), query it rather than reading files broadly.

## Persona(s)
Auto-selected per feature: PM (always), Architect (backend/data/infra), UX Designer
(user-facing UI), Security Consultant (auth/payments/sensitive data). Stated at the top
of every spec with rationale.

## Reuse
- None required; produces the spec directly if no accelerator plugin is installed.

## Inputs
- A feature description, hotfix report, or task from the user.

## Gate-in
- None — this is the entry point for feature-track work, parallel to how `define-epic`
  is the entry point once `backlog.json` is approved. Anyone can call it directly.

## Procedure
1. **Branch check** — `ensure-branch.mjs --skill=define-feature --name=feature/<slug>`,
   the same continuous-branch pattern `define-epic`/`implement-epic` use for
   `epic/<epic-id>-<slug>`, so `implement-feature` continues on this exact branch rather
   than orphaning the spec.
2. **Grill** — batch every ambiguity that would change AC/scope/approach, max 5, ranked
   by impact. Skip if none.
3. **Write the spec** to `.throughline/feature-<slug>/spec.md`: user story, problem,
   outcome, in/out of scope, assumptions, BDD acceptance criteria, DoD, tests (doubles
   as the test plan — no separate file, since a feature is one unit, not many stories),
   and persona-specific sections.
4. **Self-review** against five dimensions (completeness, effectiveness, clarity,
   testability, traceability) — fix and re-check until all pass.
5. **Tracker integration** — local mode: done, `spec.md` is the record. GitHub mode:
   file as a single issue (`gh issue create --label feature`), add the issue URL to the
   top of `spec.md` as a mirror pointer — the issue never replaces `spec.md` as the
   source of truth `implement-feature` reads from.

## Outputs
- `.throughline/feature-<slug>/spec.md` (+ ledger skeleton), and (github mode only) a
  filed GitHub issue mirroring it.

## Automated gate
- None. Self-review is the only mechanical check, and it's a checklist walked by the
  agent, not a script.

## Human gate
- None (no numbered gate). The task-breakdown approval inside `implement-feature` is
  the first human checkpoint; G7 at `ship-feature` is the only formal gate.

## Definition of Done
- `spec.md` exists, passes all five self-review dimensions, and (github mode) is filed.

## Failure modes
- Ambiguity slips into the spec unaddressed → stop, grill, then write.
- A self-review dimension fails → fix inline, never file with a known gap.
- `gh repo view` fails (github mode) → stop; never guess the repo.
