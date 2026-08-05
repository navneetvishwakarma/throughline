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
1. **Coverage gate-in:** when `backlog.json`'s `coverage.mode` is `enforce`, run `node scripts/coverage.mjs --check --reuse` before either mode's merge step (Mode A: before presenting G7 review; Mode B: alongside the branch quality gate). `--reuse` validates the summary implement-epic already wrote rather than re-running the full suite. If it fails: stop, send back to `implement-epic`.
2. **Auto-sync after merge:** on issue close, run `node scripts/sync-status.mjs` then `node scripts/build-dashboard.mjs` so the contract + dashboard reflect reality without manual steps.
3. Confirm `sync-status` flipped the shipped stories to `done` (status is its job, not ship's — ship just closes the GH issues that drive it).
4. Run `security-review` as a **hard, mandatory** gate for any PR touching auth / OAuth scopes / PII — it can block the merge. (Resolved: no longer advisory.)
5. **Local mode (no remote/tracker):** there's no PR — G7 becomes a local `git diff` review; on approval, merge the branch to main and the skill writes the shipped stories to `done` in the backlog directly (local status adapter), then runs `build-dashboard`. No remote, no issues, no network.
6. **GitHub mode:** push, open PR, wait for CI, merge on G7 approval, close child issues, then sync status.

## Inputs / Outputs
- Reads: epic branch, `.throughline/ship-<n>/issue-*.json`. Writes: PR, merged code, closed issues; triggers sync + dashboard.

## Automated gate
- CI green; deploy-checklist complete; security-review pass (where required); coverage gate-in passed when `coverage.mode: enforce`; post-merge `validate.mjs` passes.

## Human gate — G7
- User reviews the PR and approves the merge (per-epic quality gate). Record approval with `node scripts/gate.mjs approve G7 --subject <epic-id>` — G7 runs once per epic, and `--subject` prevents a stale approval from a previously shipped epic silently satisfying a later one.

## Definition of Done
- PR merged, issues closed, `sync-status` set stories `done`, dashboard refreshed.

## Failure modes
- CI red or checklist incomplete → don't merge. Security review fails on sensitive surface → block merge.
