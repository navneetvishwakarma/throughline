---
skill-spec: define-architecture
type: new
status: draft (review → skill-creator)
updated: 2026-06-16
---

# define-architecture — skill spec

## Description
Fill the architecture tier — stack, data model, API shape — and log the real
decisions as ADRs, grounded in the approved product docs (and mockups if present).
Trigger with "design the architecture", "decide the stack", "data model", "API
design", "write an ADR". Runs in parallel with define-design. Extend just-in-time;
don't over-design.

## Context (token protocol)
Follow the README *Context & token protocol*. Load `AGENTS.md` + only the slice needed — never whole docs or source trees. **If a codegraph index is present (`.codegraph/`), query it for data-model/dependency/code lookups and read only the spans returned.** Don't re-read what `backlog.json` or an upstream artifact already carries.

## Persona(s)
- **Lead: Architect** — simplest system that meets the requirements and bends under change; boring proven tech by default; reasons in data flows, failure modes, trade-offs.
- **Supporting: Security** (threat model, auth/PII), **Developer** (implementability).

## Reuse
- `engineering:system-design`, `engineering:architecture` (ADRs), `engineering:testing-strategy` (test approach), `data:explore-data` / `data:sql-queries` (data model), built-in `security-review` (threat pass).
- Public add-on (optional): miro › miro-code-spec; vanta (if SOC2/compliance is in scope).

## Inputs
- `docs/product/*` (esp. PRD `REQ-xx`); `docs/design/*` mockups if available.

## Gate-in
- PRD is `status: approved`.

## Mode — seed vs. reconcile (architecture review)
- **Seed:** `docs/architecture/01-system-overview.md` is not `status: approved` — author fresh.
- **Reconcile:** it is `approved` — this is an **architecture review** against the new release's `REQ-xx`, not a fresh design. Never regenerate `02-tech-stack.md`/`03-data-model.md`/`05-api-design.md` — amend them and append ADRs (mirrors define-backlog's append-only philosophy).

## Reconcile rules — classify each new-release requirement

| Classification | Action |
|----------------|--------|
| Fits unchanged | No architecture change; note it and move on. |
| Additive extension (new table/column/endpoint, no breaking change) | Amend the relevant doc in place; new ADR only if the extension itself is a non-obvious call. |
| Breaking / structural revision (touches a shipped data shape/contract) | New ADR required (never edit an accepted one — mark it `status: superseded-by ADR-NNNN`); emit an explicit **migration story** into the next `define-backlog` reconcile pass. |

**Worked v2 example:** `REQ-41: recurring segments` → additive: new `recurrence` table + `PATCH /segments/:id/recurrence` endpoint; data model and API docs amended in place; no shipped table touched; a new ADR is logged only because the recurrence-rule format itself was a genuine design choice.

## Procedure
1. Choose the stack (seed only; reconcile skips unless a new REQ needs a stack-level change, itself a breaking/structural revision). Default to proven tech; justify any exotic choice in an ADR. Also record the coverage tool for that stack in `02-tech-stack.md` (`scripts/coverage.mjs` already defaults to the standard tool per stack — Vitest/Jest/`c8` for Node, `coverage.py` for Python, `go test -coverprofile` for Go, JaCoCo for Java/Kotlin, `cargo-llvm-cov` for Rust — so most projects need no override; log an ADR only if a non-default tool or a `coverage.command`/`coverage.stacks` override is required).
2. Seed: design the data model and API shape covering the requirements of the **first epics** only. Reconcile: classify each new REQ per the table above and amend in place.
3. Run a Security threat-model pass (auth, authz, PII, secrets, hostile input) on the design — full pass on seed, scoped to the new REQs on reconcile.
4. Log each significant decision as an ADR in `docs/architecture/decisions/`, linked to the `REQ-xx`/epic that triggered it, with alternatives considered. Never edit an accepted ADR — supersede it.
5. Note dependencies that will become story `blocked_by` links downstream; hand off any migration story for `define-backlog` to intake.

## Outputs
- `docs/architecture/` — `01-system-overview`, `02-tech-stack`, `03-data-model`, `05-api-design`, `07-infrastructure` (as needed); ADRs in `decisions/`, amended not regenerated on reconcile.

## Automated gate
- `node scripts/check-docs.mjs --tier=architecture` — mechanically checks `01-system-overview.md` status and that every ADR's `status` is valid (`proposed|accepted|superseded`, or `superseded-by ADR-NNNN` pointing at a real ADR). Plus `validate.mjs` still passes. Neither can judge whether the data model/API actually cover the requirements, whether an ADR's reasoning is sound, or the security threat-model's quality — that's judgment, surfaced at the human gate.

## Human gate — G4
- User accepts the ADRs / architecture. **🔒 Security is a HARD gate:** any auth / OAuth-scope / PII surface must be must-fixed or explicitly accepted-with-mitigation before G4 clears — security can block.

## Definition of Done
- First-epic architecture documented; ADRs accepted; security threat-model logged and cleared.

## Note — sequencing
For data-heavy products (schema/pipeline-first), this skill **may lead** define-design so design builds on settled data shapes. Parallel by default.

## Failure modes
- Designing for scale/features not yet required → stop (over-engineering).
- Security finds a must-fix on a sensitive surface → **block G4** until resolved or explicitly accepted-with-mitigation.
