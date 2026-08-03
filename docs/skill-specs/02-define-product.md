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
Follow the README *Context & token protocol*. Load `AGENTS.md` + only the slice needed — never whole docs or source trees. **If a codegraph index is present (`.codegraph/`), query it for any code lookup and read only the spans returned.** Don't re-read what `backlog.json` or an upstream artifact already carries.

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
- For v2+: nothing further here — `define-brief`'s own gate-in already required the previous release's retro decision before this brief could be approved.

## Mode — seed vs. reconcile
- **Seed:** `06-prd.md` is not `status: approved` (covers both a fresh product and a brownfield repo `adopt-project` brought on without ever running this skill — `adopt-project` never touches the PRD's status).
- **Reconcile:** `06-prd.md` is `approved` — the same file/field this skill itself sets at its own gate, so no other skill (e.g. `adopt-project` populating `backlog.json`) can put it in the wrong mode.

## Procedure
1. Author top-down into existing stubs: `01-product-vision` → `02-product-thesis` → `03-user-personas` → `04-market-research` → `05-competitive-analysis` → `07-success-metrics`. Reconcile: only touch the sections the new release actually changes, grounded in `retros/<release_in_flight>.md`'s metrics/feedback — don't re-author from scratch.
2. Write `06-prd.md`. Give each requirement a stable **`REQ-xx`** id, a priority (P0/P1/P2), a testable acceptance line, and a **`Release`** tag (`v1`, `v2`, ...).
3. Ensure requirements are **vertically sliced** — each maps to one or more future features/stories, not a horizontal layer.
4. Have Security tag any requirement touching auth, PII, or regulated data.
5. Keep it lean — enough to seed the first epics, not a 40-page spec.

`backlog.json`'s `release_in_flight` is not touched here. `define-backlog` advances it later, in the same write that adds the new release's first epic, so the field and `epics[].release` never disagree while `define-architecture`/`define-design` run `validate.mjs` in between.

## Reconcile rules (v2+)

| PRD change | Action |
|------------|--------|
| New requirement | Append a new `REQ-xx` (continue the sequence — never reuse or renumber a shipped id), tagged to the new `Release`. |
| Reworded, same intent | Edit the existing `REQ-xx` row in place; id and `Release` tag untouched. |
| Materially changed behavior of a shipped requirement | Never edit the shipped `REQ-xx`. Add a new `REQ-xx` tagged to the new release, noting which prior requirement it supersedes. |
| Requirement removed / no longer wanted | Flag for the human; mark superseded in the Acceptance column rather than deleting the row. |

**Worked v2 example:** shipped `REQ-01`..`REQ-12` (v1). A v2 pass adds `REQ-13: Recurring segments (Release: v2)` and `REQ-14: Extend manual-add to support recurring segments (Release: v2) — supersedes REQ-04's one-time-only behavior`. `REQ-04` is never edited. Only `REQ-13`/`REQ-14` need fresh approval — the document's `status: approved` front-matter never reverts to draft.

## Outputs
- `docs/product/01..07` filled; `06-prd.md` with `REQ-xx` ids and `Release` tags. PM-tier docs only — no backlog, no architecture.

## Automated gate
- Every `REQ` has an id + priority + acceptance + release tag; no duplicate or renumbered ids; vision/personas/PRD non-empty.

## Human gate — G2
- Set `06-prd.md` front-matter `status: approved` (v2: approve only the new requirements). **The pivot from thinking to building.**

## Definition of Done
- PRD `status: approved`; all requirements have ids + acceptance; PII/compliance flags noted.

## Failure modes
- Requirement not testable or not sliceable → rewrite, don't pass it through.
- v2 change to a shipped requirement → never renumber; add a new `REQ-xx` and flag.
