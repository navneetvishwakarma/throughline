---
skill-spec: define-epic
type: modify existing
status: draft (review → skill-creator)
updated: 2026-06-16
---

# define-epic — skill spec (modify existing)

> You already have a working `define-epic`. This spec describes the **changes**
> needed to integrate it with the v2 contract; keep your current expansion logic.

## Description
Consume **one epic** from the backlog and expand it into a GitHub epic issue plus a
sub-issue per child story, with full per-story specs and a ledger. Trigger with
"define epic", "define the next epic", "expand epic E-x". Picks the lowest-`order`
epic whose stories' `blocked_by` are all `done`.

## Context (token protocol)
Follow the README *Context & token protocol*. Read only the chosen epic's stories + their `prd_ref` requirement + the linked ADR — never whole docs. **If a codegraph index is present (`.codegraph/`), query it to map the epic to affected symbols/files and read only those spans — never scan the source tree.**

## Persona(s)
- **Lead: Architect** (decomposition, invariants). **Supporting: PM** (scope), **Developer** (implementability).

## Reuse
- `engineering:system-design`, `engineering:testing-strategy`, `product-management:write-spec`, the **Plan** subagent.
- Public add-on (optional): Superpowers › writing-plans / subagent-driven-development.

## Required changes (delta)
1. **Read pickup from the contract:** select the next epic from `docs/engineering/backlog.json` (lowest `order`, deps satisfied) instead of a pasted-in story.
2. **Write back:** after creating GH issues, write `epic.gh_issue` (parent) and each story's `gh_issue` (sub-issue) into `backlog.json`. Do **not** touch `status`.
3. **Per-story spec** for each child story: goal, in/out scope, acceptance, invariants, spec references (PRD `REQ-xx`, ADRs).
4. **Test plan** for the epic (via `engineering:testing-strategy`): what unit/integration/E2E covers each story's acceptance.
5. Keep emitting `.claude/epic-<n>/` (epic.json, sub-<n>.json, ledger.md, test-plan.md) as today.
6. **Local mode (`tracker: local`, the default):** skip all issue creation — the stories ARE the work items, `gh_issue` stays `null`, the specs live in `.claude/epic-<n>/`, and status is tracked in the backlog. No account or network needed.

## Inputs / Outputs
- Reads: `backlog.json`, PRD, architecture/ADRs, design. Writes: GH epic + sub-issues; `.claude/epic-<n>/*`; `gh_issue` fields back into `backlog.json`.

## Automated gate
- Every child story has scope + acceptance + invariants + test coverage in the plan; GH issues created; `validate.mjs` passes after write-back.

## Human gate — G6
- User reviews the epic plan/ledger **before** any code is written.

## Definition of Done
- GH epic + sub-issues exist; `gh_issue` written back; ledger created; contract valid.

## Failure modes
- No unblocked epic available → report and stop. Backlog invalid → stop, run validate.
