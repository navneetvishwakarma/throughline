---
name: define-architecture
description: Use when the approved PRD is ready and the architecture tier needs to be filled — stack, data model, API shape, and ADRs. Trigger phrases: "design the architecture", "decide the stack", "data model", "API design", "write an ADR", "run define-architecture". Runs in parallel with define-design. This is gate G4.
---

# define-architecture

Act as a top-0.1% FAANG principal architect. Design the simplest system that satisfies the requirements and bends under change. Default to boring, proven technology. Record every significant decision as an ADR with alternatives considered.

## Gate-in
`docs/product/06-prd.md` is `status: approved`. If not, stop and say so.

## Branch check
Run `node scripts/ensure-branch.mjs --skill=define-architecture` before anything else below. If the repo is on `main`/`master`, it creates and switches to a feature branch automatically and reports the name — never write or commit on `main` directly. Already on a non-main branch: no-op.

## Mode — seed vs. reconcile (architecture review)
**Seed** if `docs/architecture/01-system-overview.md` is not `status: approved` — author fresh. **Reconcile** once it is `approved` — this is an **architecture review** pass over the new release's `REQ-xx`, not a fresh design. A v2+ pass never regenerates `02-tech-stack.md`/`03-data-model.md`/`05-api-design.md` from scratch — it amends them and appends ADRs, mirroring `define-backlog`'s append-only philosophy.

**Reconcile procedure:** for each new-release `REQ-xx`, classify into exactly one bucket:

| Classification | Meaning | Action |
|----------------|---------|--------|
| Fits unchanged | Existing stack/data model/API already supports it | No architecture change. Note it in the review, move on. |
| Additive extension | New table/column/endpoint; no breaking change to anything shipped | Amend `02-tech-stack.md` / `03-data-model.md` / `05-api-design.md` in place. No new ADR required unless the extension itself is a non-obvious call. |
| Breaking / structural revision | Touches a shipped data shape or contract | **New ADR required.** Never edit an accepted ADR — mark the superseded one `status: superseded-by ADR-NNNN`. Emit an explicit **migration story** into the next `define-backlog` reconcile pass (a real backlog item, not just a note in prose) so the human sees and schedules the migration work. |

**Worked v2 example:** `REQ-41: recurring segments` → additive: new `recurrence` table + `PATCH /segments/:id/recurrence` endpoint; `03-data-model.md` and `05-api-design.md` amended in place; no shipped table touched; ADR-0007 logged only because the recurrence-rule format itself was a real design choice (RRULE vs. custom cron-like syntax).

## Context protocol
Load `AGENTS.md` + the PRD `## Requirements` section only. If mockups are available (`docs/design/`), read the relevant screen; don't read the whole design tier. If a codegraph index exists (`.codegraph/`), query it for any data-model or dependency lookup; read only the spans returned.

## Do this

1. **Stack** — choose the tech stack (seed only; reconcile skips this unless a new REQ genuinely needs a stack-level change, which is itself a breaking/structural revision per the table above). Default to proven technology; justify any non-standard choice with an ADR. Also record the coverage tool for the chosen stack in `docs/architecture/02-tech-stack.md` (`@vitest/coverage-v8` for Vitest, Jest's built-in coverage, `c8` for plain `node --test`, `coverage.py` for Python, `go test -coverprofile` for Go, JaCoCo for Java/Kotlin, `cargo-llvm-cov` for Rust — `scripts/coverage.mjs` already defaults to these, so most projects need no override). Only log an ADR for this if a non-default tool or a `coverage.command`/`coverage.stacks` override in `backlog.json` is required (e.g. a monorepo or non-default test runner). Write `docs/architecture/02-tech-stack.md`.
2. **Data model** — seed: design the schema covering only the first epics' requirements. Reconcile: classify each new REQ per the table above; amend `03-data-model.md` in place for additive changes. Write `docs/architecture/03-data-model.md`.
3. **API shape** — seed: define the endpoints/interfaces the first epics need. Reconcile: same classify-and-amend treatment for `05-api-design.md`.
4. **Security threat-model** — run a security pass on the design (seed: full pass; reconcile: scoped to what the new REQs touch): auth, authz, PII, secrets handling, and hostile input paths. Record findings in `docs/architecture/01-system-overview.md` or a dedicated `security-threat-model.md`. Tag any must-fix item clearly. `01-system-overview.md` comes from the shared generic doc template (also used by 10+ unrelated docs), so it has no seeded line for this — add `**Personas Applied:** Architect, Security` under its title by hand (seed: write it; reconcile: leave it, both lenses still ran). Append `, Developer` only if implementability concerns were actually flagged and resolved this pass.
5. **ADRs** — write one ADR in `docs/architecture/decisions/ADR-NNNN-<title>.md` for each significant decision (stack choice, data model approach, auth mechanism, breaking/structural revisions, etc.). Each ADR must include: decision, status, context, alternatives considered, and the `REQ-xx` / epic that triggered it. Never edit an accepted ADR — supersede it with a new one.
6. **Dependencies** — note which architectural dependencies will become `blocked_by` links in downstream stories. On reconcile, also hand off any migration story (from the classification table) for `define-backlog` to intake.

Supporting lenses: Security (threat-model, auth/PII — can block G4), Developer (flag implementability concerns before G4, not after).

## Outputs
`docs/architecture/` — system overview, tech-stack, data model, API design, infrastructure (as needed); ADRs in `decisions/`, amended not regenerated on reconcile.

## Automated gate
Before presenting for G4, run `node scripts/check-docs.mjs --tier=architecture` — it mechanically checks: `01-system-overview.md` status enum; every ADR has a valid `status` (`proposed|accepted|superseded`, or `superseded-by ADR-NNNN` pointing at an ADR that actually exists in `decisions/`). Also run `node scripts/validate.mjs` — still must pass. Neither script can judge whether the data model and API actually *cover* the requirements, whether an ADR's reasoning and alternatives are sound, or whether the security threat-model is any good — that's judgment, exercised directly and surfaced at the human gate below. Any breaking/structural revision still needs its migration story emitted into the next `define-backlog` reconcile pass (a real check that it was emitted, not just claimed, happens when `define-backlog` runs — this skill's job is to emit it).

## Gate (G4)
Present the ADRs and architecture. Ask the user to accept.

**🔒 Security is a hard gate.** Any auth / OAuth-scope / PII surface that carries a must-fix finding blocks G4 until either fixed or explicitly accepted-with-mitigation. Record the acceptance decision in the ADR. G4 does not clear until this is resolved.

On G4 approval set the overview doc `status: approved`.

## Done when
First-epic architecture documented; ADRs accepted; security threat-model logged and cleared (or accepted-with-mitigation); G4 approved.

## Note — sequencing
For data-heavy products (schema or pipeline first), this skill may lead define-design so design builds on settled data shapes. Parallel by default.

## Notes
Reuse `engineering:system-design`, `engineering:architecture` (ADRs), `engineering:testing-strategy`, `data:explore-data`, `data:sql-queries`, built-in `security-review` where available. If not installed, perform steps directly from this spec. Over-designing beyond the first epics' needs is a failure mode — defer anything not required now.
