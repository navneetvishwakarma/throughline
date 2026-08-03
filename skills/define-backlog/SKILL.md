---
name: define-backlog
description: Turn the approved PRD into the backlog.json contract — vertically-sliced epics grouping user stories, ordered and dependency-linked. Use when the user says "seed the backlog", "create the backlog", "break the PRD into epics/stories", "plan the work". Every cycle; reconcile (append-only) for v2. This is gate G5.
---

# define-backlog

Act as a top-0.1% PM (slice for fastest validation, order by value/risk); consult an architect for real dependencies. This is the ONLY skill that authors epics[] and stories[].

## Gate-in
PRD is `status: approved`; requirements carry `REQ-xx` ids + acceptance. If the project has `scripts/gate.mjs`, `node scripts/gate.mjs check G2` must pass.

## Model
- **Epic** = a vertically-sliced shippable increment grouping stories. Epics are what define-epic consumes.
- **Story** = a leaf work item; carries status. Read `docs/engineering/workflow.md` for field ownership and the status enum — never violate it.

## Do this
1. Cluster related REQ-xx into vertically-sliced epics. Seed a Foundation enabler epic (`order: 0`, `vertical: false`) first.
2. Slice each epic into stories; set `epic`, `prd_ref`, `acceptance`, `order`, `blocked_by` (real prerequisites, acyclic). Optional `estimate` + `target_date` per epic. If a `docs/design/screens/*.md` doc exists covering the story's `REQ-xx`, set `design_ref` to its path (one screen per story — a story needing several is a signal to split it).
3. Reconcile mode (v2): append new epics/stories; NEVER overwrite a story carrying a `gh_issue` or change shipped scope — flag conflicts for the human. Also intake any migration story emitted by `define-architecture`'s reconcile pass as a real story (with `blocked_by` on whatever it migrates). In the same write, advance `release_in_flight` to the new release tag (e.g. `v1` → `v2`) — this is the one place that field moves forward. Do it here, not in `define-product`: `release_in_flight` and `epics[].release` must change together, or `validate.mjs`'s consistency check fails for every skill that runs between the PRD pass and this one (architecture, design).
4. Write `docs/engineering/backlog.json`. Never write `gh_issue` or synced `status`.
5. Run `node scripts/validate.mjs` — fix until it passes.

## Gate (G5)
The user approves the proposed epics/stories, order, and estimates. Then run `node scripts/gate.mjs approve G5 --note "backlog approved"` when the script exists.

## Done when
`validate.mjs` exits 0; every story traces to a REQ-xx; graph acyclic; nothing shipped was overwritten.
