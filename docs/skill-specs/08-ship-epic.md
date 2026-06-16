---
skill-spec: ship-epic
type: modify existing
status: draft (review → skill-creator)
updated: 2026-06-16
---

# ship-epic — skill spec (modify existing)

> You already have a working `ship-epic`. This spec describes the **changes** to
> close the loop with the contract + dashboard; keep your current PR/merge logic.

## Description
Land a completed epic: open the PR, run the deploy checklist, merge, close the GH
issues, then refresh the contract and dashboard. Trigger with "ship epic", "ship
E-x", "open the PR and merge".

## Context (token protocol)
Follow the README *Context & token protocol*. Work from the epic branch diff + ledger. **If a codegraph index is present (`.codegraph/`), query it for impact/blast-radius of the change rather than reading files; read only the spans returned.**

## Persona(s)
- **Lead: Developer** (clean landing). **Supporting: Security** (secrets, deploy surface, mandatory review on auth/PII changes).

## Reuse
- `engineering:deploy-checklist`, `engineering:incident-response` (rollback plan), built-in `security-review`.
- Public add-on (optional): qodo › qodo-pr-resolver (address PR comments); vanta › test-remediation (compliance).

## Required changes (delta)
1. **Auto-sync after merge:** on issue close, run `node scripts/sync-status.mjs` then `node scripts/build-dashboard.mjs` so the contract + dashboard reflect reality without manual steps.
2. Confirm `sync-status` flipped the shipped stories to `done` (status is its job, not ship's — ship just closes the GH issues that drive it).
3. Run `security-review` as a **hard, mandatory** gate for any PR touching auth / OAuth scopes / PII — it can block the merge. (Resolved: no longer advisory.)
4. **Local mode (no remote/tracker):** there's no PR — G7 becomes a local `git diff` review; on approval, merge the branch to main and the skill writes the shipped stories to `done` in the backlog directly (local status adapter), then runs `build-dashboard`. No remote, no issues, no network.

## Inputs / Outputs
- Reads: epic branch, `.claude/ship-<n>/issue-*.json`. Writes: PR, merged code, closed issues; triggers sync + dashboard.

## Automated gate
- CI green; deploy-checklist complete; security-review pass (where required); post-merge `validate.mjs` passes.

## Human gate — G7
- User reviews the PR and approves the merge (per-epic quality gate).

## Definition of Done
- PR merged, issues closed, `sync-status` set stories `done`, dashboard refreshed.

## Failure modes
- CI red or checklist incomplete → don't merge. Security review fails on sensitive surface → block merge.
