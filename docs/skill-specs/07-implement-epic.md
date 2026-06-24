---
skill-spec: implement-epic
type: modify existing
status: draft (review → skill-creator)
updated: 2026-06-16
---

# implement-epic — skill spec (modify existing)

> You already have a working `implement-epic`. This spec describes the **changes**
> to wire it to the contract + CI evidence; keep your current build logic.

## Description
Build the sub-issues of a defined epic — code + tests, one vertical story at a time
— updating the ledger as it goes. Trigger with "implement epic", "build epic E-x",
"work the next sub-issue".

## Context (token protocol)
Follow the README *Context & token protocol*. Work from the sub-issue spec + ledger. **If a codegraph index is present (`.codegraph/`), query it to locate the exact symbols/call sites to change and read only those spans — never scan or read whole files to find code.** Don't re-read docs the epic spec already distilled.

## Persona(s)
- **Lead: Developer** (simple, tested, small increments; correctness over cleverness).
- **Supporting: Security** (review changes touching auth/PII/secrets).

## Reuse
- `engineering:code-review` (self-review), `engineering:debug`, built-in `review` + `security-review`.
- Public add-on (recommended): Superpowers › test-driven-development, root-cause-tracing; qodo › qodo-pr-resolver.

## Required changes (delta)
1. **Verification evidence into the contract:** after a story's tests pass in CI, write `story.verify = { ci, coverage, commit }` in `backlog.json`. Do **not** set `status` (sync owns it — status flips when the GH issue closes at ship).
2. Update `.throughline/epic-<n>/ledger.md` per story (files, tests, commit, risks) as today.
3. Run code-review + security-review self-passes before opening/marking a story ready.
4. Keep each change scoped to one story; no cross-story drift.
5. **Mid-flight amend (critical):** if building reveals the slice/acceptance/dependency is wrong, **stop** — do not force the code to fit a wrong spec. Flag it, run `define-backlog` in reconcile mode to amend the affected story/epic, and re-clear **G6** before resuming. Never let code silently diverge from the contract.
6. **Local mode (no tracker):** the skill is the status adapter — set the story `in_progress` on start and write `verify` from local test runs; leave `done` to ship-epic. (With a tracker, `sync-status` owns status instead.)

## Inputs / Outputs
- Reads: `.throughline/epic-<n>/*`, codebase. Writes: code + tests; ledger; `story.verify` fields.

## Automated gate
- Tests pass, lint clean, code-review + security-review self-pass, `verify.ci: pass` recorded.

## Human gate
- None here — human review happens at ship (G7).

## Definition of Done
- All sub-issues implemented, tests green, ledger + `verify` updated.

## Failure modes
- Tests failing / review findings open → keep the story in progress, do not record done.
- Security finding on auth/PII → block until fixed.
