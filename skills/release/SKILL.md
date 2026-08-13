---
name: release
description: Use when a wave of epics is done and the product is ready to ship to users. Trigger phrases: "cut a release", "release v1", "ship to users", "tag and deploy", "run release". Produces changelog, version tag, deployment, and a refreshed dashboard. This is gate G8.
---

# release

Act as a top-0.1% FAANG senior PM running a go/no-go call. Block go on any unresolved QA failure or security must-fix — never let deadline pressure downgrade a red check to a footnote. Consult a security lens for final compliance and secrets check.

## Gate-in
All epics tagged `release: vX` in `backlog.json` must roll up to `done` (derived from their stories). Verify this first; stop if any are incomplete. If `scripts/gate.mjs` exists, run `node scripts/gate.mjs check G1`, `node scripts/gate.mjs check G2`, `node scripts/gate.mjs check G3`, `node scripts/gate.mjs check G4`, and `node scripts/gate.mjs check G5`. Then run `node scripts/gate.mjs check G7 --subject <epic-id>` for each epic tagged to the release. Stop on any failed check. G1.5 remains optional.

## Branch check
None, deliberately — unlike every other skill, this one intentionally operates on `main`: it runs after the release's epics are already merged (G7), and tags/deploys the mainline itself. There is nothing here that belongs on a feature branch.

## Context protocol
Build the changelog from the `backlog.json` epic slice + `.throughline/epic-*/ledger.md`. Never re-read source files or whole docs. If a codegraph index exists (`.codegraph/`), query it for any code reference; read only the spans returned.

## Do this

1. **Verify prerequisites** — check G1 through G5 and subject-scoped G7 for every release epic as specified in Gate-in. Stop and report every failed prerequisite.
2. **Verify done** — read `backlog.json`; confirm every epic tagged to this release has all stories `done`. If any are not: stop, list the blockers, do not proceed.
3. **QA pass** — run the integration/E2E test suite. Read and execute `docs/MANUAL-TESTS.md` for any manual checks. Block on any failure.
4. **Changelog** — generate a `CHANGELOG.md` entry from the shipped epics' titles and ledger summaries. Write user-facing release notes (no internal jargon).
5. **Security final pass** — check for exposed secrets, new attack surface, and any open compliance items. Flag must-fix issues; block go if present.
6. **Tag + deploy** — `git tag vX`, then run the deploy checklist (`engineering:deploy-checklist` if available, otherwise the project's deploy procedure).
7. **Refresh dashboard** — run `node scripts/sync-status.mjs && node scripts/build-dashboard.mjs`.
8. **Announcement** — draft the user-facing announcement / stakeholder update. Optionally generate marketing release notes.
9. **Hand off to measure & learn** — wire analytics for new features, schedule a metrics review (30-day minimum), and set up ops health monitoring (errors, latency, incidents). Record proceed/pivot/kill criteria in the brief for the next cycle.

## Outputs
`CHANGELOG.md` entry, version tag, deployed build, refreshed `PROGRESS_DASHBOARD.html`, announcement draft.

## Automated gate
Before presenting for G8: G1 through G5 approved; subject-scoped G7 approved for every release epic; all release epics `done`; QA pass green; changelog generated; security pass clear (or must-fixes resolved); deploy succeeded; `node scripts/build-dashboard.mjs` exits 0.

## Gate (G8)
Present the QA summary, changelog, and security check result, plus `Personas Applied: PM, Security`. Ask the user for go/no-go. On go, confirm the tag is pushed and the deployment is live. This line stays in the presentation only — `CHANGELOG.md` is user-facing release notes and never carries internal process metadata.

## Done when
Version tagged + deployed; changelog + announcement produced; dashboard current; measure-and-learn scheduled; G8 approved.

## Failure modes
- Any release epic not `done` → block; list what remains.
- G1 through G5 or any release epic's subject-scoped G7 not approved → block; list every failed gate check.
- QA failure → halt; report failures; do not deploy.
- Security must-fix open → block go until resolved.
- Deploy failure → halt; invoke `engineering:incident-response` if available. If not installed, perform the rollback directly: redeploy the last known-good tag/commit, revert the version tag if it was already pushed, and notify the user before retrying — never leave a failed deploy live while re-attempting.

## Notes
Reuse `engineering:deploy-checklist`, `product-management:stakeholder-update`, `marketing:content-creation`, `operations:change-request`, `operations:status-report`, `product-management:metrics-review`, `product-management:synthesize-research` where available. Perform steps directly from this spec if skills are not installed.
