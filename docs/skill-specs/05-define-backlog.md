---
skill-spec: define-backlog
type: new
status: draft (review → skill-creator)
updated: 2026-06-16
---

# define-backlog — skill spec

> **Full spec:** `../define-backlog.spec.md` (the detailed, build-ready version).
> This file is the index-template summary; review the full spec for the procedure,
> slicing heuristics, reconcile rules, and the v2/versioning section.

## Description
Transform the approved PRD into the `backlog.json` contract: vertically-sliced
**epics** (release-tagged) grouping **user stories**, ordered and dependency-linked.
Trigger with "seed the backlog", "create the backlog", "break the PRD into
epics/stories", "plan the work". Every cycle; reconcile mode for v2.

## Context (token protocol)
Follow the README *Context & token protocol*. Read only the PRD `## Requirements` section + the existing `backlog.json` — never whole docs. **If a codegraph index is present (`.codegraph/`), query it for any code lookup and read only the spans returned.**

## Persona(s)
- **Lead: PM** (slicing for fastest validation, ordering by value/risk).
- **Supporting: Architect** (real `blocked_by` dependencies).

## Fixes applied
- Seed a **Foundation enabler epic** (`order: 0`, `vertical:false`) first.
- Optional `estimate` + `target_date` per epic → objective schedule health.
- Honour the `tracker` field; write `gh_issue` regardless of tracker.

## Reuse
- `product-management:sprint-planning` (sequencing/capacity), `product-management:roadmap-update` (Now/Next/Later framing).
- Public add-on (optional): Superpowers › writing-plans.

## Inputs
- Approved PRD, `01-tech-plan.md`, `docs/architecture/*`, existing `backlog.json`, schema.

## Gate-in
- PRD `status: approved`; requirements have `REQ-xx` ids + acceptance.

## Procedure / Outputs / Reconcile / Versioning
- See `../define-backlog.spec.md` (authoritative). Writes `epics[]` + `stories[]`; never writes `gh_issue` or synced `status`.

## Automated gate
- `node scripts/validate.mjs` passes; every epic has ≥1 story; graph acyclic.

## Human gate — G5
- User approves the proposed epics/stories slice set and order.

## Definition of Done
- Contract validates; every story traces to a `REQ-xx`; no shipped `gh_issue`/`status` overwritten.

## Failure modes
- See full spec (PRD not approved, cyclic deps, would-mutate-shipped-story → flag).
