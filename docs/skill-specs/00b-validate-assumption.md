---
skill-spec: validate-assumption
type: new
status: draft (review → skill-creator)
updated: 2026-06-16
---

# validate-assumption — skill spec

## Description
De-risk the brief's riskiest assumption with the cheapest possible test *before*
investing in a full PRD, architecture, and backlog. Trigger with "validate the
assumption", "run a spike", "de-risk this", "prototype the bet", or automatically
after `define-brief` when G1 chose "validate". Sits **between brief and PRD** — the
most expensive thing to get wrong is the core bet, so test it first.

## Context (token protocol)
Follow the README *Context & token protocol*. Read only `00-brief.md` (the riskiest-assumption section). **If a codegraph index is present (`.codegraph/`), query it for any code lookup; a throwaway spike may live outside the index.**

## Persona(s)
- **Lead: PM** (frames the cheapest decisive test). **Supporting: Architect/Developer** (technical spikes), **UX** (user/desirability tests).

## Reuse
- `product-management:product-brainstorming` (test design), `design:user-research` (interviews/usability), `engineering:debug`/`system-design` (technical spike).
- Public add-on (optional): Superpowers › writing-plans for the spike plan.

## Inputs
- `docs/product/00-brief.md` — the riskiest assumption + the G1 validation decision.

## Gate-in
- Brief is `status: approved` and G1 chose **validate** (skip this skill if G1 chose accept-as-risk).

## Procedure
1. Restate the riskiest assumption as a falsifiable hypothesis with a clear success/kill threshold.
2. Pick the cheapest decisive test: technical spike, throwaway prototype, landing-page/demand test, or user interviews.
3. Run it (or hand the user a runbook if it needs real users/time).
4. Record the result against the threshold.

## Outputs
- `docs/product/00b-validation.md`: hypothesis, method, result, and a **decision: proceed / pivot / kill**.
- **Sequencing:** runs *before* `bootstrap-project`. The spike itself is throwaway (a separate sandbox / landing page / interviews) — do **not** build it in the real repo; you only bootstrap the real project after a `proceed`.

## Automated gate
- Validation doc has a falsifiable hypothesis, a threshold, a result, and a decision.

## Human gate — G1.5
- You decide **proceed / pivot / kill** based on the result. Pivot loops back to `define-brief`; kill stops here.

## Definition of Done
- Result recorded; proceed/pivot/kill decision made and logged.

## Failure modes
- No decisive cheap test exists → say so; recommend the smallest real-world test and timebox it.
- Result is ambiguous → do not record "proceed"; design a sharper test or escalate to the user.
