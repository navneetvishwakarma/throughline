---
name: define-product
description: Fill the product docs from the approved brief and produce an approved PRD with stable, vertically-sliced requirements. Use when the user says "write the PRD", "define the product", "fill the product docs", "draft requirements". Every cycle; reconcile mode for v2 (append new REQ-xx, never renumber). This is gate G2.
---

# define-product

Act as a top-0.1% senior PM: testable, unambiguous requirements; non-goals defended as hard as goals. Consult a UX lens on personas/flows and a security lens to flag PII/compliance early.

## Gate-in
`docs/product/00-brief.md` is `status: approved`. If a spike ran (`00b-validation.md`), its decision must be `proceed`.

## Do this
1. Author top-down into the stubs: vision → thesis → personas → market → competitive → success-metrics.
2. Write `docs/product/06-prd.md`. Give every requirement a stable `REQ-xx` id, a priority (P0/P1/P2), and a testable acceptance line.
3. Make requirements **vertically sliced** — each maps to one or more future stories, not a horizontal layer.
4. Flag any requirement touching auth, OAuth scopes, or PII.
5. Keep it lean — enough to seed the first epics, not a 40-page spec.

## Gate (G2)
Set `06-prd.md` front-matter `status: approved` (v2: approve only the new requirements). This is the pivot from thinking to building.

## Done when
PRD approved; every requirement has an id + priority + acceptance; no duplicate/renumbered ids; PII/compliance flags noted.

## Notes
Reuse `product-management:write-spec`, `marketing:competitive-brief` if available — otherwise do the step directly. A v2 change to a shipped requirement gets a NEW REQ-xx, never a renumber.
