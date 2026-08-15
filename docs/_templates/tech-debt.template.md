---
doc: tech-debt
project: <PROJECT_NAME>
status: draft
updated: <DATE>
---

# <PROJECT_NAME> — Technical & Architecture Debt Register

> Pre-backlog inventory, not the contract. `docs/engineering/backlog.json` only accepts
> stories that trace to a real `REQ-xx` in the approved PRD — `scripts/validate.mjs`
> enforces it — so nothing here is scheduled work yet. This register is where tech/arch
> debt lives *before* it earns a requirement. Not gated, not validated by
> `scripts/check-docs.mjs` — a scratch space for triage, not a doc tier.
>
> Use `engineering:tech-debt` to help identify and prioritize entries. Promote a row to
> real work by adding a `REQ-xx` for it via `define-product` (reconcile mode, same
> append-only rule as any other requirement) and letting `define-backlog` cluster it into
> an existing or new `vertical: false` enabler epic — move the row from Open to Promoted
> when you do. A breaking/structural architecture revision skips this register entirely:
> `define-architecture`'s reconcile pass emits a migration story straight into
> `define-backlog`'s next reconcile pass, flagged `breaking: true`.

## Open

| ID | Area | Title | Impact | Effort | Notes |
|----|------|-------|--------|--------|-------|
| TD-1 | … | … | … | … | … |

## Promoted

| ID | Promoted to | Date | Notes |
|----|-------------|------|-------|
| … | REQ-xx | … | … |

## Resolved

| ID | Title | Resolved via | Date |
|----|-------|---------------|------|
| … | … | … | … |
