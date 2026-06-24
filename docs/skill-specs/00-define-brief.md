---
skill-spec: define-brief
type: new
status: draft (review → skill-creator)
updated: 2026-06-16
---

# define-brief — skill spec

## Description
Turn a raw, vague product idea into a one-page brief that every downstream doc
inherits. Trigger when the user says "I have an idea", "new product idea",
"sharpen this idea", "let's start a new product", or pastes a rough concept and
wants to begin. Runs first in the pipeline. Also runs at the start of each new
version cycle (v2+), where it is grounded in metrics + user feedback.

## Context (token protocol)
Follow the README *Context & token protocol*. Load `AGENTS.md` + only the slice needed — never whole docs or source trees. **If a codegraph index is present (`.codegraph/`), query it for any code lookup and read only the spans returned.** Don't re-read what `backlog.json` or an upstream artifact already carries.

## Persona(s)
- **Lead: PM** — starts from the user problem and a measurable outcome, never the solution; ruthless on scope; states assumptions explicitly.

## Reuse
- `product-management:product-brainstorming` (core thinking partner).
- Public add-on (optional): Superpowers › brainstorming.

## Inputs
- The user's raw idea (free text / chat).
- For v2+: `docs/product/07-success-metrics.md` outcomes, any research notes.

## Gate-in
- None — this is the entry point. (For v2: the previous release's measure-and-learn output should exist.)

## Procedure
1. Interview the user with the PM persona until five things are crisp; do not pad.
2. Pressure-test each: reflect back the problem and target user in two sentences; if the user is still hedging ("kind of like X but also Y"), keep probing.
3. Identify the single riskiest assumption and propose how to validate it (spike / landing page / interviews) vs accept-as-risk.
4. Write the brief; keep it to ~1 page.

## Outputs
- `docs/product/00-brief.md` with exactly these sections: **Problem**, **Target user (and non-users)**, **Core bet**, **Scope boundary + non-goals**, **Riskiest assumption + validation decision**.
- Front-matter `status: draft`.
- **Sequencing:** runs *before* `bootstrap-project`. Create `docs/product/` if absent — don't depend on the full tree. bootstrap's idempotent `init-project` later fills the rest around this file without overwriting it.

## Automated gate
- All five sections present and non-empty; problem + user each ≤2 sentences.

## Human gate — G1
- User approves the framing **and** records the riskiest-assumption decision (validate now / accept). On approval, set brief front-matter `status: approved`.

## Definition of Done
- `00-brief.md` exists, all five sections filled, `status: approved`, risk decision logged.

## Failure modes
- Idea too vague to state a problem → keep interviewing, don't fabricate.
- User wants to skip straight to features → redirect to the problem/user first.
