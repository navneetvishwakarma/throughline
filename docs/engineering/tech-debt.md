---
doc: tech-debt
project: Throughline
status: draft
updated: 2026-08-15
---

# Throughline — Technical & Architecture Debt Register

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
| TD-1 | infra | `scripts/*.mjs` duplicated between `skills/bootstrap-project/assets/scripts/` and root `scripts/` with no automated sync check | A hand-edit to one copy and not the other silently diverges Throughline's own dogfooded scaffold from what it ships to adopting projects; only caught by `npm test`'s existing byte-diff-free fixtures, not by a dedicated check | S | Consider a `--check` mode on `sync-plugin.mjs` (or a small standalone script) that fails CI if the two trees differ, since `sync-plugin.mjs` already knows how to diff scaffold files. |
| TD-2 | docs | `docs/skill-specs/*.md` and `docs/define-backlog.spec.md` are earlier authoring specs for the live `skills/*/SKILL.md` files and can drift out of sync with them (e.g. the `breaking`/versioning additions in this pass only touched the live `SKILL.md` files) | An agent or contributor reading the spec docs instead of the live skill files gets a stale picture of the actual workflow | S | Either keep both in sync on every SKILL.md change, or mark the spec docs clearly as historical/design-time-only and point readers at `skills/*/SKILL.md` as the live source. |

## Promoted

| ID | Promoted to | Date | Notes |
|----|-------------|------|-------|
| — | — | — | — |

## Resolved

| ID | Title | Resolved via | Date |
|----|-------|---------------|------|
| — | — | — | — |
