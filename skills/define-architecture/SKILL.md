---
name: define-architecture
description: Use when the approved PRD is ready and the architecture tier needs to be filled — stack, data model, API shape, and ADRs. Trigger phrases: "design the architecture", "decide the stack", "data model", "API design", "write an ADR", "run define-architecture". Runs in parallel with define-design. This is gate G4.
---

# define-architecture

Act as a top-0.1% FAANG principal architect. Design the simplest system that satisfies the requirements and bends under change. Default to boring, proven technology. Record every significant decision as an ADR with alternatives considered.

## Gate-in
`docs/product/06-prd.md` is `status: approved`. If not, stop and say so.

## Context protocol
Load `AGENTS.md` + the PRD `## Requirements` section only. If mockups are available (`docs/design/`), read the relevant screen; don't read the whole design tier. If a codegraph index exists (`.codegraph/`), query it for any data-model or dependency lookup; read only the spans returned.

## Do this

1. **Stack** — choose the tech stack. Default to proven technology; justify any non-standard choice with an ADR. Write `docs/architecture/02-tech-stack.md`.
2. **Data model** — design the schema covering only the first epics' requirements. Write `docs/architecture/03-data-model.md`.
3. **API shape** — define the endpoints / interfaces the first epics need. Write `docs/architecture/05-api-design.md`.
4. **Security threat-model** — run a security pass on the design: auth, authz, PII, secrets handling, and hostile input paths. Record findings in `docs/architecture/01-system-overview.md` or a dedicated `security-threat-model.md`. Tag any must-fix item clearly.
5. **ADRs** — write one ADR in `docs/architecture/decisions/ADR-NNNN-<title>.md` for each significant decision (stack choice, data model approach, auth mechanism, etc.). Each ADR must include: decision, status, context, alternatives considered, and the `REQ-xx` / epic that triggered it.
6. **Dependencies** — note which architectural dependencies will become `blocked_by` links in downstream stories.

Supporting lenses: Security (threat-model, auth/PII — can block G4), Developer (flag implementability concerns before G4, not after).

## Outputs
`docs/architecture/` — system overview, tech-stack, data model, API design, infrastructure (as needed); ADRs in `decisions/`.

## Automated gate
Before presenting for G4: data model and API cover the first epics' requirements; every ADR has a `status:` line and alternatives; security threat-model recorded; `validate.mjs` still passes.

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
