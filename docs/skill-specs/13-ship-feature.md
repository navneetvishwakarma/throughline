---
skill-spec: ship-feature
type: new
status: draft (review → skill-creator)
updated: 2026-08-05
---

# ship-feature — skill spec

## Description
Land non-epic work — a hotfix, plugin/scaffold maintenance, a doc-only change, anything
that never went through `define-epic`/`implement-epic` — with the same rigor `ship-epic`
applies to tracked epics, minus the epic-specific bookkeeping. Trigger with "ship this",
"ship feature", "open a PR for this". This and `ship-epic` are the *only* two skills
allowed to push to remote; every other skill only ever branches, writes, and commits
locally.

## Context (token protocol)
Follow the README *Context & token protocol*. Work from the branch diff. If a codegraph
index is present (`.codegraph/`), query it for impact/blast-radius rather than reading
files; read only the spans returned.

## Persona(s)
- **Lead: Developer** (clean landing). **Supporting: Security** (secrets, deploy surface, mandatory review on auth/PII changes).

## Reuse
- Built-in `security-review`.

## Inputs
- The current feature branch and its diff against `main`.

## Gate-in
- `node scripts/ensure-branch.mjs --check-only` passes (not on `main`/`master`) — every
  skill's own branch check should already guarantee this; a failure here means
  something ran outside the normal flow.
- The branch carries commits ahead of `main` (`git log main..HEAD` non-empty) — nothing
  to ship otherwise.

## Procedure
1. **Local mode (no remote/tracker):** present a `git diff --stat` against `main` and a
   compact summary of the change. On human approval: record
   `node scripts/gate.mjs approve G7 --subject <feature-slug>`, merge to `main` locally
   (`git merge --no-ff`).
2. **GitHub mode:** run build + full test suite; run `security-review` as a **hard,
   mandatory** gate on any change touching auth/OAuth scopes/PII; confirm planned
   actions with the human before any remote mutation; push, open PR, wait for CI; on
   human approval record `node scripts/gate.mjs approve G7 --subject <feature-slug>`
   and merge (`gh pr merge --merge --delete-branch`).

## Outputs
- Local mode: merged commit on `main`. GitHub mode: pushed branch, PR, merged code.

## Automated gate
- CI green (GitHub mode); security-review pass where required; post-merge
  `validate.mjs` still passes.

## Human gate — G7 (scoped by feature slug)
- User reviews the diff/PR and approves the merge. Record approval with
  `node scripts/gate.mjs approve G7 --subject <feature-slug>` — the same gate
  `ship-epic` uses, scoped by a feature slug instead of an epic id, so a stale
  approval from either kind of ship never silently satisfies the other.

## Definition of Done
- Change merged to `main` (locally or via PR); G7 approved for this feature slug;
  `validate.mjs` still passes.

## Failure modes
- CI red or build/test failing → don't merge; report.
- Security review fails on a sensitive surface → block merge; fix or accept-with-mitigation first.
- Nothing to ship (no commits ahead of `main`) → stop, don't open an empty PR.
- `ensure-branch.mjs --check-only` fails (still on `main`) → stop; there is nothing to ship from `main` itself.
