---
skill-spec: adopt-project
type: new
status: draft (review → skill-creator)
updated: 2026-06-16
---

# adopt-project — skill spec (brownfield)

## Description
Bring an **existing** repo onto the workflow without starting over: stand up the
rails, retrofit a contract from whatever tracking already exists, and reconcile
in-flight work. Trigger with "adopt this repo", "migrate to the workflow",
"onboard an existing project", "bring this in line with the workflow". The
generalized form of the Trazr migration plan.

## Context (token protocol)
Follow the README *Context & token protocol*. Audit via sections + the contract, not whole-tree reads. **If a codegraph index is absent, build it first (it's the cheapest way to understand existing code); then query it — never scan the source tree.**

## Persona(s)
- **Lead: Architect** (audit + reconciliation). **Supporting: PM** (map existing work to PRD epics), **Developer** (codegraph build), **Security** (flag existing PII/auth surfaces).

## Reuse
- `engineering:tech-debt` (audit), `engineering:system-design` (reverse-arch), `product-management:roadmap-update`. codegraph build for code understanding.

## Inputs
- Existing repo: any current local/GitHub tracker state (`.claude/ship-*`, issues), roadmap/progress files, docs, code.

## Gate-in
- A git repo exists. (No brief/PRD prerequisite — this is reverse-onboarding.)

## Procedure
1. **Audit**: detect existing docs tier, tracker, progress files, and the codegraph index; report what's present/missing.
2. **Rails**: run `init-project.mjs` (non-destructive), add `CLAUDE.md`, hooks/CI, and **build/refresh the codegraph index**.
3. **Contract**: reconcile existing work into `backlog.json` — existing tracker items (epics/sub-issues) become epics/stories with `gh_issue`; orphan roadmap items become stories. **Seed status from the most authoritative source (ledgers/commits), not stale tracker state.**
4. **Dedup**: merge duplicate tracking universes (e.g. roadmap slices vs tracker sub-issues) — never double-count.
5. **Cut over**: repoint the dashboard to `backlog.json`; archive old progress files.
6. **Verify** (subagent): `validate.mjs` passes; rollups match reality; counts cross-check vs the old tracker.

## Outputs
- Rails + `CLAUDE.md` + a populated, validated `backlog.json` + a working dashboard; old trackers archived.

## Automated gate
- `validate.mjs` exits 0; every existing tracked item is represented exactly once.

## Human gate — G5 (adopt)
- You approve the reconciled backlog + seeded statuses (the migration's G2/G5 collapse here for an existing PRD).

## Definition of Done
- One contract reflects reality; dashboard renders; no double-counting; old trackers archived not deleted.

## Failure modes
- Stale tracker state contradicts ledgers → trust ledgers, flag the conflict. Ambiguous mapping → flag for human, don't guess.
