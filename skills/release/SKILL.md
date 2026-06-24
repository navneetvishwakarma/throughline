---
name: release
description: Use when a wave of epics is done and the product is ready to ship to users. Trigger phrases: "cut a release", "release v1", "ship to users", "tag and deploy", "run release". Produces changelog, version tag, deployment, and a refreshed dashboard. This is gate G8.
---

# release

Act as a top-0.1% FAANG senior PM: what's shippable, release comms, go/no-go. Consult a security lens for final compliance and secrets check.

## Gate-in
All epics tagged `release: vX` in `backlog.json` must roll up to `done` (derived from their stories). Verify this first; stop if any are incomplete. If `scripts/gate.mjs` exists, G7 must be approved.

## Context protocol
Build the changelog from the `backlog.json` epic slice + `.claude/epic-*/ledger.md`. Never re-read source files or whole docs. If a codegraph index exists (`.codegraph/`), query it for any code reference; read only the spans returned.

## Do this

1. **Verify done** — read `backlog.json`; confirm every epic tagged to this release has all stories `done`. If any are not: stop, list the blockers, do not proceed.
2. **QA pass** — run the integration/E2E test suite. Read and execute `docs/MANUAL-TESTS.md` for any manual checks. Block on any failure.
3. **Changelog** — generate a `CHANGELOG.md` entry from the shipped epics' titles and ledger summaries. Write user-facing release notes (no internal jargon).
4. **Security final pass** — check for exposed secrets, new attack surface, and any open compliance items. Flag must-fix issues; block go if present.
5. **Tag + deploy** — `git tag vX`, then run the deploy checklist (`engineering:deploy-checklist` if available, otherwise the project's deploy procedure).
6. **Refresh dashboard** — run `node scripts/sync-status.mjs && node scripts/build-dashboard.mjs`.
7. **Announcement** — draft the user-facing announcement / stakeholder update. Optionally generate marketing release notes.
8. **Hand off to measure & learn** — wire analytics for new features, schedule a metrics review (30-day minimum), and set up ops health monitoring (errors, latency, incidents). Record proceed/pivot/kill criteria in the brief for the next cycle.

## Outputs
`CHANGELOG.md` entry, version tag, deployed build, refreshed `PROGRESS_DASHBOARD.html`, announcement draft.

## Automated gate
Before presenting for G8: all release epics `done`; QA pass green; changelog generated; security pass clear (or must-fixes resolved); deploy succeeded; `node scripts/build-dashboard.mjs` exits 0.

## Gate (G8)
Present the QA summary, changelog, and security check result. Ask the user for go/no-go. On go, confirm the tag is pushed and the deployment is live.

## Done when
Version tagged + deployed; changelog + announcement produced; dashboard current; measure-and-learn scheduled; G8 approved.

## Failure modes
- Any release epic not `done` → block; list what remains.
- QA failure → halt; report failures; do not deploy.
- Security must-fix open → block go until resolved.
- Deploy failure → halt; invoke incident-response rollback procedure.

## Notes
Reuse `engineering:deploy-checklist`, `product-management:stakeholder-update`, `marketing:content-creation`, `operations:change-request`, `operations:status-report`, `product-management:metrics-review`, `product-management:synthesize-research` where available. Perform steps directly from this spec if skills are not installed.
