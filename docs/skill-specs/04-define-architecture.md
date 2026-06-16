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
Follow the README *Context & token protocol*. Load `CLAUDE.md` + only the slice needed — never whole docs or source trees. **If a codegraph index is present (`.codegraph/`), query it for data-model/dependency/code lookups and read only the spans returned.** Don't re-read what `backlog.json` or an upstream artifact already carries.

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

## Procedure
1. Choose the stack (default to proven tech; justify any exotic choice in an ADR).
2. Design the data model and API shape covering the requirements of the **first epics** only.
3. Run a Security threat-model pass (auth, authz, PII, secrets, hostile input) on the design.
4. Log each significant decision as an ADR in `docs/architecture/decisions/`, linked to the `REQ-xx`/epic that triggered it, with alternatives considered.
5. Note dependencies that will become story `blocked_by` links downstream.

## Outputs
- `docs/architecture/` — `01-system-overview`, `02-tech-stack`, `03-data-model`, `05-api-design`, `07-infrastructure` (as needed); ADRs in `decisions/`.

## Automated gate
- Data model + API cover the first epics' requirements; every ADR has a status and alternatives; security-review pass recorded.

## Human gate — G4
- User accepts the ADRs / architecture. **🔒 Security is a HARD gate:** any auth / OAuth-scope / PII surface must be must-fixed or explicitly accepted-with-mitigation before G4 clears — security can block.

## Definition of Done
- First-epic architecture documented; ADRs accepted; security threat-model logged and cleared.

## Note — sequencing
For data-heavy products (schema/pipeline-first), this skill **may lead** define-design so design builds on settled data shapes. Parallel by default.

## Failure modes
- Designing for scale/features not yet required → stop (over-engineering).
- Security finds a must-fix on a sensitive surface → **block G4** until resolved or explicitly accepted-with-mitigation.
