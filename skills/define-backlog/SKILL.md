---
name: define-backlog
description: Turn the approved PRD into the backlog.json contract — vertically-sliced epics grouping user stories, ordered and dependency-linked. Use when the user says "seed the backlog", "create the backlog", "break the PRD into epics/stories", "plan the work". Every cycle; reconcile (append-only) for v2. This is gate G5.
---

# define-backlog

Act as a top-0.1% PM (slice for fastest validation, order by value/risk); consult an architect for real dependencies. This is the ONLY skill that authors epics[] and stories[].

## Gate-in
PRD is `status: approved`; requirements carry `REQ-xx` ids + acceptance.

## Model
- **Epic** = a vertically-sliced shippable increment grouping stories. Epics are what define-epic consumes.
- **Story** = a leaf work item; carries status. Read `docs/engineering/workflow.md` for field ownership and the status enum — never violate it.

## Do this
1. Cluster related REQ-xx into vertically-sliced epics. Seed a Foundation enabler epic (`order: 0`, `vertical: false`) first.
2. Slice each epic into stories; set `epic`, `prd_ref`, `order`, `blocked_by` (real prerequisites, acyclic). Optional `estimate` + `target_date` per epic.
3. Reconcile mode (v2): append new epics/stories; NEVER overwrite a story carrying a `gh_issue` or change shipped scope — flag conflicts for the human.
4. Write `docs/engineering/backlog.json`. Never write `gh_issue` or synced `status`.
5. Run `node scripts/validate.mjs` — fix until it passes.

## Gate (G5)
The user approves the proposed epics/stories, order, and estimates.

## Done when
`validate.mjs` exits 0; every story traces to a REQ-xx; graph acyclic; nothing shipped was overwritten.
