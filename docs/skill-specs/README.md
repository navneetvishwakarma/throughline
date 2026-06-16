---
doc: skill-specs-index
project: <PROJECT_NAME>
status: draft
updated: 2026-06-16
purpose: One reviewable spec per pipeline skill. Review here, then hand each file to anthropic-skills:skill-creator to generate the SKILL.md.
---

# Skill specs — review package

These are **specs for review**, not the skills themselves. Once you're happy with
one, pass it to `anthropic-skills:skill-creator` ("create a skill from this spec")
to generate the actual `SKILL.md`. They all follow the same template so review is
fast and the pipeline stays consistent. Context: `../workflow-master.md`,
contract: `../scaffold/docs/engineering/backlog.schema.json`.

## The skills

| # | Spec | Type | Lead persona | Human gate |
|---|------|------|--------------|-----------|
| 0 | `00-define-brief.md` | new | PM | G1 brief approved |
| 0.5 | `00b-validate-assumption.md` | new | PM | G1.5 proceed/pivot/kill |
| 1 | `01-bootstrap-project.md` | new | — (mechanical) | — |
| 1b | `10-adopt-project.md` | new (brownfield) | Architect | G5 (adopt) |
| 2 | `02-define-product.md` | new | PM | G2 PRD approved |
| 3 | `03-define-design.md` | new | UX | G3 design approved |
| 4 | `04-define-architecture.md` | new | Architect | G4 architecture approved |
| 5 | `05-define-backlog.md` | new (full spec linked) | PM | G5 backlog approved |
| 6 | `06-define-epic.md` | modify existing | Architect | G6 epic plan approved |
| 7 | `07-implement-epic.md` | modify existing | Developer | — (review at ship) |
| 8 | `08-ship-epic.md` | modify existing | Developer | G7 PR merge |
| 9 | `09-release.md` | new | PM | G8 release approved |

## Shared template (every spec uses these headings)

```
## Description        — third-person, with trigger phrases (becomes SKILL.md frontmatter)
## Persona(s)         — lead + supporting, and their mandate
## Reuse              — existing skills the skill should CALL (don't reinvent)
## Inputs             — files/data it reads
## Gate-in            — preconditions; refuse if unmet
## Procedure          — numbered steps
## Outputs            — files/fields it writes (+ ownership)
## Automated gate     — self-check that must pass before finishing
## Human gate         — the explicit approve/reject point (Gx)
## Definition of Done
## Failure modes      — when to stop / refuse
```

## Context & token protocol (ALL skills inherit this — do not repeat it per skill)

Every generated `SKILL.md` opens by referencing this protocol instead of restating it.
The goal: never read the same content twice across skills, and never read a whole
file/tree when a slice or a graph query will do.

1. **Load order, cheapest first; stop as soon as you have enough.**
   `CLAUDE.md` (the index) → the *specific slice* of `backlog.json` you need (one epic +
   its stories, never the whole array) → codegraph query for any code → targeted reads of
   only the spans returned. Do not pre-load docs "just in case".
2. **codegraph-first for all code.** **If a codegraph index is present in the repo
   (`.codegraph/codegraph.db`), query it** (via the codegraph skill) for symbols, call sites,
   and dependencies, then read only the file spans it returns. Never scan directories or read
   full source trees to "find" code. If no index is present, fall back to a single targeted
   grep, not a tree read. codegraph indexes **code, not prose** — do **not** route PRD/ADR/design
   docs through it; documentation is handled by the contract + section reads (rules 3–4).
3. **Don't re-read what the contract already carries.** `prd_ref`, `acceptance`, `blocked_by`,
   `verify`, `gh_issue` live in `backlog.json`. Read the referenced doc only when you need
   more than the contract holds.
4. **Read sections, not whole docs.** Pull the `## Requirements` table from `06-prd.md`, the
   one ADR linked to the epic, the few components a screen uses — via anchor/grep, not the
   entire file.
5. **Heavy scans go to a subagent.** Reconcile-across-the-whole-PRD, or a broad code sweep,
   runs in a subagent that returns only the conclusion — keep the main context lean.
6. **Be terse.** Skills produce the artifact and the gate result, not narration. Keep the
   `SKILL.md` itself short; pull persona/contract detail from the referenced docs.

## Who-reads-what (the no-duplication contract)

Each artifact has one writer and a defined, minimal read by downstream — this is what
prevents the same content being parsed again and again.

| Artifact | Written by | Read by → how (minimal) |
|----------|-----------|--------------------------|
| `00-brief.md` | define-brief | define-product (full, once) |
| `06-prd.md` **`## Requirements` table** | define-product | define-design, define-architecture, define-backlog → that **section only** |
| ADRs (`decisions/`) | define-architecture | define-epic → only the ADR linked to the epic |
| design tokens/components | define-design | define-epic / implement → only the components the epic touches |
| `backlog.json` (one epic + stories) | define-backlog | define-epic → the chosen epic slice; dashboard → all (script, no LLM) |
| `.codegraph` index | build/daemon | architecture, define-epic, implement, ship → **query, never file-scan** |
| `story.verify`, ledger | implement-epic | ship, dashboard |

## Other shared conventions

- Personas' full descriptions live in `../workflow-master.md`; specs name lead/supporting only.
- Contract = `docs/engineering/backlog.json` (schema v2); field ownership + status enum in
  `../scaffold/docs/engineering/workflow.md` — never violate.
- Persona conflicts → **surface at the human gate**, never resolve silently.
- Every skill ends with the repo in a `validate.mjs`-passing state.
- **Reuse skills are optional accelerators.** Each spec is followable as plain instructions; if a named skill isn't installed (or the agent isn't Claude), perform the step directly from the spec. The **spec is the source of truth; the skill is a shortcut.** This keeps the workflow runnable by any coding agent.
