---
name: measure-learn
description: Review a shipped release's metrics, ops health, and UX signals, then record a proceed/pivot/kill decision that gates the next version cycle. Use when the user says "review the release", "how did v1 do", "run the retro", "measure and learn", or a scheduled metrics review comes due (30 days minimum after release). This is gate G9.
---

# measure-learn

Act as a top-0.1% FAANG senior PM running a release retro. Ground every conclusion in the data available; call out where there isn't enough yet rather than guessing. Consult a UX lens for usability signals.

## Gate-in
`release`'s G8 approved this release, and at least 30 days (or the project's own review cadence) have passed since deploy — there needs to be real usage to measure, not just a ship event. If invoked earlier, say so and offer to wait or proceed with the caveat that the sample is thin.

## Branch check
Run `node scripts/ensure-branch.mjs --skill=measure-learn` before anything else below. If the repo is on `main`/`master`, it creates and switches to a feature branch automatically and reports the name — never write or commit on `main` directly. Already on a non-main branch: no-op.

## Do this
1. **Metrics** — compare actuals against `docs/product/07-success-metrics.md`'s targets for this release. Cite real numbers; don't editorialize without them.
2. **Ops health** — pull errors, latency, and incident history since deploy. Anything here that changes what's safe to build next is load-bearing for the decision.
3. **UX signals / debt** — usability issues, drop-off points, support themes. If something here means a shipped screen needs a redesign, say so explicitly — this is what the next `define-design` reconcile pass reads to know a shipped screen is back in scope.
4. **Write the retro** — `docs/product/retros/<release>.md`, where `<release>` is `backlog.json`'s `release_in_flight` (the release just shipped — `define-product` hasn't advanced it to the next one yet). One file per release, never overwritten, following `docs/_templates/retro.template.md`'s shape: metrics vs. success criteria, ops health, UX signals/debt, and the decision. The template seeds `**Personas Applied:** PM, UX` — leave it as-is, both run unconditionally per this skill's own persona line above.
5. **Decide** — proceed / pivot / kill, justified in 1-2 sentences, grounded in steps 1-3.

## Automated gate
Before presenting for G9, run `node scripts/check-docs.mjs --tier=retro` — it mechanically checks the retro's front-matter (`status`, `release`, `decision` enum) and that all four sections (Metrics, Ops health, UX signals/debt, Decision) exist. Fix until it passes. It cannot judge whether the metrics analysis is actually grounded in real numbers or the decision is well-justified — that's judgment, exercised at the human gate below.

## Gate (G9)
Present the retro. Ask the user to confirm the decision. On confirmation set the retro's front-matter `status: recorded`.

**kill** stops the loop — a new `define-brief` is not started without an explicit user override. **proceed**/**pivot** both unlock the next `define-brief`, which reads this retro as its v2+ grounding (per `define-brief`'s own gate-in).

## Done when
`node scripts/check-docs.mjs --tier=retro` passes; a justified decision recorded; `status: recorded`; G9 approved.

## Notes
Reuse `product-management:metrics-review`, `:synthesize-research`, `data:analyze`/`build-dashboard`, `design:research-synthesis`, and `engineering:incident-response` where available. If not installed, perform each step directly from this spec. Don't run this the same day as `release` — it's the one step in the workflow that deliberately waits for real usage data before it's meaningful.
