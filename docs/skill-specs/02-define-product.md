---
skill-spec: define-product
type: new
status: draft (review → skill-creator)
updated: 2026-06-16
---

# define-product — skill spec

## Description
Fill the product (PM) doc tier top-down from the approved brief and produce an
approved PRD with stable, vertically-sliced requirements. Trigger with "write the
PRD", "fill the product docs", "define the product", "draft requirements". Every
cycle; reconcile mode for v2 (append new `REQ-xx`, never renumber).

## Context (token protocol)
Follow the README *Context & token protocol*. Load `CLAUDE.md` + only the slice needed — never whole docs or source trees. **If a codegraph index is present (`.codegraph/`), query it for any code lookup and read only the spans returned.** Don't re-read what `backlog.json` or an upstream artifact already carries.

## Persona(s)
- **Lead: PM** — testable, unambiguous requirements; non-goals defended as hard as goals.
- **Supporting: UX** (user-lens sanity check on personas/flows), **Security** (flag PII/compliance requirements early).

## Reuse
- `product-management:write-spec` (the PRD), `product-management:synthesize-research` (personas/feedback), `marketing:competitive-brief` (competitive), `design:user-research` (personas), `anthropic-skills:doc-coauthoring` (structured authoring).

## Inputs
- `docs/product/00-brief.md` (approved); for v2: metrics + research.

## Gate-in
- `00-brief.md` is `status: approved`.
- If a spike ran (`00b-validation.md`), its decision is **proceed** (not pivot/kill).

## Procedure
1. Author top-down into existing stubs: `01-product-vision` → `02-product-thesis` → `03-user-personas` → `04-market-research` → `05-competitive-analysis` → `07-success-metrics`.
2. Write `06-prd.md`. Give each requirement a stable **`REQ-xx`** id, a priority (P0/P1/P2), and a testable acceptance line.
3. Ensure requirements are **vertically sliced** — each maps to one or more future features/stories, not a horizontal layer.
4. Have Security tag any requirement touching auth, PII, or regulated data.
5. Keep it lean — enough to seed the first epics, not a 40-page spec.

## Outputs
- `docs/product/01..07` filled; `06-prd.md` with `REQ-xx` ids. PM-tier docs only — no backlog, no architecture.

## Automated gate
- Every `REQ` has an id + priority + acceptance; no duplicate or renumbered ids; vision/personas/PRD non-empty.

## Human gate — G2
- Set `06-prd.md` front-matter `status: approved` (v2: approve only the new requirements). **The pivot from thinking to building.**

## Definition of Done
- PRD `status: approved`; all requirements have ids + acceptance; PII/compliance flags noted.

## Failure modes
- Requirement not testable or not sliceable → rewrite, don't pass it through.
- v2 change to a shipped requirement → never renumber; add a new `REQ-xx` and flag.
