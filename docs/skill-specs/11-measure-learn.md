---
skill-spec: measure-learn
type: new
status: draft (review → skill-creator)
updated: 2026-08-03
---

# measure-learn — skill spec

## Description
Review a shipped release's metrics, ops health, and UX signals once real usage data
exists, then record a proceed/pivot/kill decision that gates the next version cycle.
Trigger with "review the release", "how did v1 do", "run the retro", "measure and
learn". Runs once per release, independently of `release` itself — real usage takes
time to accumulate, so this cannot run at ship time.

## Context (token protocol)
Follow the README *Context & token protocol*. Read `docs/product/07-success-metrics.md`'s
targets for this release + whatever metrics/ops/support data is available; don't re-read
the whole product tier.

## Persona(s)
- **Lead: PM** — grounds every conclusion in available data; states explicitly where the sample is too thin to conclude.
- **Supporting: UX** (usability signals, research synthesis).

## Reuse
- `product-management:metrics-review`, `:synthesize-research`, `data:analyze`/`build-dashboard`, `design:research-synthesis`, `engineering:incident-response` (ops health).

## Inputs
- `docs/product/07-success-metrics.md` (targets for this release), analytics/ops data, support/UX feedback since deploy.

## Gate-in
- `release`'s G8 is approved for this release, and at least 30 days (or the project's own cadence) have passed since deploy. If invoked earlier: proceed only with an explicit caveat that the sample is thin.

## Procedure
1. Compare actuals against the success-metrics targets for this release.
2. Pull ops health: errors, latency, incidents since deploy.
3. Synthesize UX signals/debt: usability issues, drop-off, support themes. Flag anything that means a shipped screen needs a redesign — this is what `define-design`'s next reconcile pass reads.
4. Write `docs/product/retros/<release>.md`, where `<release>` is `backlog.json`'s `release_in_flight` (the release just shipped), per `docs/_templates/retro.template.md`'s shape — never overwrite a prior release's retro.
5. Decide **proceed / pivot / kill**, justified against steps 1-3.

## Outputs
- `docs/product/retros/<release>.md` with metrics, ops health, UX signals/debt, and a recorded decision.

## Automated gate
- All four retro sections present; decision is one of proceed/pivot/kill with a justification.

## Human gate — G9
- User confirms the decision. On confirmation, set the retro's `status: recorded`.

## Definition of Done
- Retro written and `status: recorded`; G9 approved.

## Failure modes
- Run too soon (no real usage yet) → proceed only with an explicit thin-sample caveat, or wait.
- Decision recorded without grounding in steps 1-3 → not done; go back and ground it.
- **kill** recorded → the loop stops here; a new `define-brief` requires an explicit user override to start anyway.
