---
name: define-product
description: Fill the product docs from the approved brief and produce an approved PRD with stable, vertically-sliced requirements. Use when the user says "write the PRD", "define the product", "fill the product docs", "draft requirements". Every cycle; reconcile mode for v2 (append new REQ-xx, never renumber). This is gate G2.
---

# define-product

Act as a top-0.1% senior PM: testable, unambiguous requirements; non-goals defended as hard as goals. Consult a UX lens on personas/flows and a security lens to flag PII/compliance early.

## Gate-in
`docs/product/00-brief.md` is `status: approved`. If a spike ran (`00b-validation.md`), its decision must be `proceed`. (For v2+, `define-brief`'s own gate-in already checked the previous release's retro before this brief could be approved — nothing further to check here.)

## Mode — seed vs. reconcile
**Seed** when `docs/product/06-prd.md` is not `status: approved` (fresh product, or a brownfield repo `adopt-project` brought on without ever running this skill — `adopt-project` never touches the PRD's status, so this stays the reliable signal regardless of what's already in `backlog.json`). **Reconcile** once it is `approved` — the same file this skill itself owns and sets at its own gate, so no other skill can put it in the wrong mode.

## Do this
1. Author top-down into the stubs: vision → thesis → personas → market → competitive → success-metrics. (Reconcile: only touch sections the new release actually changes — ground the new pass in `retros/<release_in_flight>.md`'s metrics/feedback, don't re-author from scratch.)
2. Write `docs/product/06-prd.md`. Give every requirement a stable `REQ-xx` id, a priority (P0/P1/P2), a testable acceptance line, and a `Release` tag (`v1`, `v2`, ...).
3. Make requirements **vertically sliced** — each maps to one or more future stories, not a horizontal layer.
4. Flag any requirement touching auth, OAuth scopes, or PII.
5. Keep it lean — enough to seed the first epics, not a 40-page spec.

`backlog.json`'s `release_in_flight` stays untouched here — `define-backlog` advances it later, in the same write that adds the new release's epics, so the field and `epics[].release` never go out of sync (see `define-backlog`'s reconcile rules).

## Reconcile rules (v2+)

| PRD change | Action |
|------------|--------|
| New requirement | Append a new `REQ-xx` (continue the sequence — never reuse or renumber a shipped id), tagged to the new `Release`. |
| Reworded, same intent | Edit the existing `REQ-xx` row in place; id and `Release` tag stay untouched. |
| Materially changed behavior of a shipped requirement | **Never edit the shipped `REQ-xx`.** Add a new `REQ-xx` describing the change, tagged to the new release, and note in its acceptance line which prior requirement it supersedes. |
| Requirement removed / no longer wanted | **Flag** for the human; do not delete the row. Mark it superseded in the Acceptance column rather than erasing history. |

**Worked v2 example:** shipped PRD has `REQ-01`..`REQ-12` (no `Release` column values — implicitly v1). A v2 pass adds `REQ-13: Recurring segments (Release: v2)` and `REQ-14: Extend manual-add to support recurring segments (Release: v2) — supersedes REQ-04's one-time-only behavior`. `REQ-04` itself is never edited. Only `REQ-13`/`REQ-14` need a fresh `status: approved` — the PRD's front-matter stays `approved` throughout; it's the new rows that get sign-off, not the whole document.

## Gate (G2)
Set `06-prd.md` front-matter `status: approved` (v2: approve only the new requirements, not the whole document again). This is the pivot from thinking to building.

## Done when
PRD approved; every requirement has an id + priority + acceptance + release tag; no duplicate/renumbered ids; PII/compliance flags noted.

## Notes
Reuse `product-management:write-spec`, `marketing:competitive-brief` if available — otherwise do the step directly. A v2 change to a shipped requirement gets a NEW REQ-xx, never a renumber.
