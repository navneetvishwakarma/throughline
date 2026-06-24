---
skill-spec: release
type: new
status: draft (review → skill-creator)
updated: 2026-06-16
---

# release — skill spec

## Description
Cut a release once a wave of epics is done: generate the changelog, tag the version,
deploy, refresh the dashboard, and kick off the measure-and-learn loop. Trigger with
"cut a release", "release v1", "ship to users", "tag and deploy". Runs per release wave.

## Context (token protocol)
Follow the README *Context & token protocol*. Build the changelog from the `backlog.json` epic slice + `.throughline/epic-*/ledger.md` — never re-read source or whole docs. **If a codegraph index is present (`.codegraph/`), query it for any code reference and read only the spans returned.**

## Persona(s)
- **Lead: PM** (what's shippable, release comms, go/no-go).
- **Supporting: Security** (release-surface risk, secrets, final compliance check).

## Reuse
- `engineering:deploy-checklist`, `product-management:stakeholder-update` (release comms), `marketing:content-creation` (release notes / announcement), `operations:change-request` + `operations:status-report` (change management).
- Public add-on (optional): product-tracking › instrument-new-feature (analytics for the release).

## Inputs
- `backlog.json` (epics with `release: vX`), `.throughline/epic-*/ledger.md`, success metrics doc.

## Gate-in
- All epics tagged to this release are `done` (verified from the contract).

## Procedure
1. Verify every `release: vX` epic rolls up to `done` (derived from stories).
1b. **QA pass:** run integration/E2E + the manual test guide (`docs/MANUAL-TESTS.md`); block on failures.
2. Generate a **changelog / release notes** from the shipped epics' titles + ledgers.
3. Security final pass: secrets, exposed surface, compliance checklist.
4. Tag the version (e.g. `git tag vX`), deploy via the deploy-checklist.
5. Refresh the dashboard; draft the stakeholder/user-facing announcement.
6. Hand off to **measure & learn** (step 10): wire analytics, schedule a metrics review.

## Outputs
- `CHANGELOG.md` entry / release notes, version tag, deployment, refreshed dashboard, announcement draft.

## Automated gate
- All release epics `done`; **QA pass green**; changelog generated; deploy succeeds; dashboard regenerated.

## Human gate — G8
- User approves the release (go/no-go to users).

## Definition of Done
- Version tagged + deployed; changelog + announcement produced; dashboard current; measure-and-learn scheduled.

## Failure modes
- Any release epic not `done` → block. Deploy/checklist failure → halt, invoke incident-response rollback. Security finding → block go.

## Note — measure & learn (step 10)
Not a separate gated skill but the loop-closer; can live inside `release` or as a
small `measure-learn` skill. Reuse `product-management:metrics-review` +
`:synthesize-research`, `data:analyze`/`build-dashboard`, `design:research-synthesis`,
and **`engineering:incident-response`** for post-release ops health (errors/latency/incidents).
Ends in a **proceed / pivot / kill** decision that feeds the next `define-brief` (reconcile mode).
