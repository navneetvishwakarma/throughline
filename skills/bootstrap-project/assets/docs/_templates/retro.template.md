---
doc: retro
project: <PROJECT_NAME>
status: draft         # draft | recorded — set recorded once the decision below is final
updated: <DATE>
release: ""           # which release this retro covers, e.g. v1
decision: ""          # proceed | pivot | kill
---

# <DOC_TITLE>

> Post-release measurement and decision record for this release. Read by the next
> `define-brief` gate-in before a new version cycle can start.

## Metrics vs. success criteria

_Compare actuals against `docs/product/07-success-metrics.md`'s targets for this release._

## Ops health

_Errors, latency, incidents since release. Anything that changes what's safe to build next._

## UX signals / debt

_Usability issues, drop-off points, support themes. Anything here that should force a
redesign of an already-shipped screen belongs here, not silently discovered later —
`define-design`'s next reconcile pass reads this section for redesign triggers._

## Decision

**proceed / pivot / kill** — _pick one and justify it in 1-2 sentences._

- **proceed** — the next `define-brief` continues the current direction, grounded in the metrics above.
- **pivot** — the next `define-brief` reframes based on what was learned; state what should change.
- **kill** — stop here. A new brief is not started without an explicit user override.
