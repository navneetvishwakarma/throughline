---
doc: define-backlog-spec
project: <PROJECT_NAME>
status: draft
updated: 2026-06-16
purpose: Specification for the `define-backlog` skill — turns an approved PRD into a nested backlog of vertically-sliced EPICS that group user STORIES. Build the skill from this. Consistent with backlog.schema.json v2.
---

# `define-backlog` — Skill Spec (nested model)

## One-liner

Transform an **approved** PRD into the `backlog.json` contract: **vertically-sliced
epics**, each grouping a set of **user stories** — ordered and dependency-linked —
without ever clobbering the GitHub mappings or status that downstream skills own.

## The model

- **Epic** = a vertically-sliced, shippable increment ("could we ship just this and a
  user notices something new?"). It *groups* stories. Epics are what `define-epic`
  consumes, one at a time.
- **Story** = a leaf work item inside an epic (becomes a GH sub-issue). Stories carry
  the synced `status`. They may be finer-grained / partly horizontal — that's fine,
  because the *epic* is the unit of user value, the stories are its decomposition.
- **Progress is single-sourced:** stories hold status; **epic status/progress is
  derived** (rolled up) by the dashboard, never stored. This is what lets the epic
  layer be added without giving the dashboard/sync a second source of truth to drift
  from.

## Where it sits

```
write-spec (PRD, REQ-xx) → [PRD approved] → define-backlog → [validate] → define-epic (one epic) → implement → ship
```

`define-backlog` is the only skill that authors `epics[]` and `stories[]`.
`define-epic` writes `gh_issue` back; `sync-status.mjs` owns story `status`. `verify.ci`/`verify.commit` are owned by `implement-epic` (the agent's own test run); `verify.coverage` is owned by `scripts/coverage.mjs`, invoked by `implement-epic` — not `sync-status.mjs`, which never touches `verify`.

## Two modes

- **Seed** (first run, `epics[]` empty): produce the initial epics-with-stories.
- **Reconcile** (later runs): diff the PRD against the existing backlog and propose
  *additive* changes only. Default once any epic/story carries a `gh_issue`.

## Inputs (read-only)

| Input | Path | Used for |
|-------|------|----------|
| PRD | `docs/product/06-prd.md` | requirements (`REQ-xx`), acceptance, priority |
| Tech plan | `docs/engineering/01-tech-plan.md` | phases, sequencing |
| Architecture | `docs/architecture/*` | technical dependencies → `blocked_by` |
| Existing contract | `docs/engineering/backlog.json` | reconcile mode |
| Schema | `docs/engineering/backlog.schema.json` | output shape (v2) |

## Preconditions (refuse if not met)

1. PRD front-matter is `status: approved` (the human gate). If `draft`, stop.
2. Requirements have stable `REQ-xx` ids and testable acceptance. Flag any missing.
3. `backlog.json` (v2) and the schema exist.
4. If `scripts/gate.mjs` exists, G2 is approved.

## Outputs (write)

Only `docs/engineering/backlog.json`:

- `epics[]` — `id` (`E-x`), `title`, `phase`, `prd_ref` (string or array), `order`, `release` (e.g. `v1`/`v2`), `vertical` (false for enablers), optional `estimate` + `target_date` (→ objective schedule health), `acceptance`. **No status.**
- `stories[]` — `id` (`S-x`), `title`, `epic` (**required**, `E-x`), `prd_ref`, `order`, `blocked_by`, `acceptance`, `status: "notstarted"`, optional `design_ref` (path to a `docs/design/screens/*.md` when one exists for this story's `REQ-xx` — a single path; a story needing several screens is a signal to split it). `prd_ref`, `acceptance`, and `blocked_by` are required so stories cannot become untraceable work.

**Never** write `gh_issue` (define-epic owns it) or story `status` beyond the initial
`notstarted` (sync owns it) or `verify`.

## Procedure

1. **Preflight.** Check preconditions; determine mode.
2. **Cluster into epics.** Group related `REQ-xx` into vertically-sliced epics — each a shippable increment of user value. Set `prd_ref` to the requirement(s) the epic delivers. Mark foundational work `vertical: false`.
3. **Slice each epic into stories.** Decompose every epic into the stories needed to deliver it. Stories may be layered/horizontal internally; the epic stays the vertical unit. Each story gets `epic`, `prd_ref`, `acceptance`.
4. **Order & link.** Assign epic `order` (topological by dependency, then value/risk) and story `order` within each epic. Set story `blocked_by` from real build dependencies (acyclic).
5. **Reconcile (reconcile mode).** Diff against existing — see rules table. Preserve every existing `gh_issue`/`status`. Only add or flag.
6. **Human review checkpoint.** Present proposed epics + their stories as a diff/table; get explicit approval before writing.
7. **Write & validate.** Write `backlog.json`, run `node scripts/validate.mjs`. Not done until it passes.

## Slicing heuristics

- **Epics are vertical by default.** Each epic cuts UI → logic → data and is independently demoable/shippable. The test applies at the *epic* level.
- **Enabler exception.** Foundational epics (design system, auth scaffolding, infra) are not vertical — set `vertical: false`. Keep them few.
- **Foundation first.** On a fresh project, seed one **Foundation enabler epic** (app shell, auth, CI) at `order: 0` so feature epics aren't blocked on unstated groundwork.
- **Right-size.** An epic ≈ a few days to ~2 weeks of work and a handful of stories. Too big → split into two epics. A story is a few hours to ~2 days.
- **Dependencies are real, not preferential.** `blocked_by` = "cannot start until X is done."
- **Value/risk to the front**, within dependency constraints.

## Field ownership

| Field | Owner | Rule |
|-------|-------|------|
| `epics[].*` (scope), `stories[].{id,title,epic,prd_ref,order,blocked_by,acceptance}` | human + define-backlog | The plan. |
| `epics[].gh_issue`, `stories[].gh_issue` | define-epic / ship | Written after GH issues exist. |
| `stories[].status` | `sync-status.mjs` | Mirrored from GitHub + CI. |
| `stories[].verify.ci`, `.commit` | implement-epic | Written after the agent's own test run passes. |
| `stories[].verify.coverage` | `scripts/coverage.mjs`, invoked by implement-epic | Measured, never hand-typed; `sync-status.mjs` never touches `verify`. |
| epic status / progress | **derived** | Computed by the dashboard from child stories. Never stored. |

## Reconcile rules

| PRD change | Action |
|------------|--------|
| New `REQ-xx` | Add to an existing epic, or create a new epic + stories (`notstarted`). |
| Requirement reworded, same intent | Update the linked epic/story `title`/`acceptance`; keep ids + GH fields. |
| Requirement materially changed | **Flag** for human; never silently mutate anything with a `gh_issue`. |
| Requirement removed | **Flag**; do not auto-delete. Keep `done` work as history. |
| New dependency discovered | Add to story `blocked_by`; re-check acyclicity and re-order. |
| Migration story emitted by `define-architecture`'s reconcile pass (breaking/structural revision) | Add it as a real story (with `blocked_by` on whatever it migrates), not just a note — it's schedulable work like any other. |

## Versioning & releases (v2 and beyond)

A product is never re-scaffolded. v2 is a **reconcile pass** over the same living
PRD and backlog — you amend, you don't restart.

**ID rules (append-only).**
- Never reuse or renumber a shipped `REQ-xx`, `E-x`, or `S-x`. Continue the sequence
  (`REQ-40`, `E-7`, `S-30`…). Shipped ids are permanent — that's what preserves
  history and traceability.
- `done` epics/stories are never mutated or deleted by a reconcile.

**Release tagging.**
- Every epic carries a `release` (`v1`, `v2`, …). New waves get the new tag.
- `release` is the *product-version* axis; `phase` (D1/D2/D3) is the *build* axis.
  They're orthogonal — an epic has both. The dashboard groups by `release`.

**Incremental approval.** Only the *new* PRD requirements need re-approval. Set the
PRD section / front-matter for the v2 additions to `status: approved`; you do not
re-approve shipped v1 requirements.

**Modifying a shipped feature.** If a v2 requirement changes behavior of something
already shipped, create a **new** story (and epic if needed) describing the change —
e.g. `S-31: extend manual-add to support recurring segments`. Do **not** reopen or
edit the shipped story. New work = new id; clean history beats in-place edits.

**The v2 flow.** `measure-learn` retro (proceed/pivot) → `define-brief` (grounded in the
retro) → append new `REQ-xx` to the PRD, tagged to the release → approve the additions
→ `define-architecture` reviews the new REQs (classify fits-unchanged / additive /
breaking — see `define-architecture`'s reconcile rules) and `define-design` extends the
design system just-in-time → `define-backlog` in **reconcile mode** appends new
`release: v2` epics + stories (`notstarted`), including any migration story architecture
emitted, leaving v1 untouched → `define-epic` picks them up → the dashboard shows v1 at
100% and v2 starting.

**Why `release_in_flight` advances here, not in `define-product`.** It was tried in
`define-product` first: advance the field as soon as the new requirements are tagged.
That broke — between `define-product`'s pass and this one, `define-architecture` and
`define-design` both run and both invoke `validate.mjs` as part of their automated gate.
If `release_in_flight` already says `v2` but no epic carries `release: v2` yet (this
skill hasn't run), `validate.mjs`'s consistency check fails for two skills that have
nothing to do with the backlog. Advancing the field in the same write that adds the
first `v2` epic keeps the two always in sync — there's no window where they can disagree.

### v2 worked example

```json
{
  "epics": [
    { "id": "E-3", "title": "Manual trip entry", "release": "v1", "phase": "D1", "order": 3 },
    { "id": "E-7", "title": "Recurring & multi-city trips", "release": "v2", "phase": "D4",
      "prd_ref": ["REQ-40", "REQ-41"], "order": 7, "vertical": true }
  ],
  "stories": [
    { "id": "S-30", "title": "Recurring-segment model + form", "epic": "E-7",
      "prd_ref": "REQ-40", "order": 1, "blocked_by": [], "status": "notstarted" },
    { "id": "S-31", "title": "Extend manual-add for recurrence", "epic": "E-7",
      "prd_ref": "REQ-40", "order": 2, "blocked_by": ["S-30"], "status": "notstarted" }
  ]
}
```

(`E-3`/v1 stays exactly as shipped; the v2 work is appended as `E-7` with new ids.)

## Epic status rollup (how the dashboard derives it — for reference)

- all stories `done` → epic **done**
- any story `blocked` → epic **blocked**
- else any story `in_progress`/`done` → epic **in_progress**
- else → **notstarted**

## Definition of Done (for the step)

- `backlog.json` validates (`validate.mjs` exits 0).
- Every epic has ≥1 story; every story references a real epic.
- Every epic and story traces to ≥1 `REQ-xx`.
- Dependency graph acyclic; orders respect it.
- No existing `gh_issue`/`status` overwritten.
- Human approved the proposed epics + stories.

## Worked example

PRD: `REQ-12 — manually add a trip segment (flight/train/hotel) with date/time/PNR (P0)`,
`REQ-13 — segment appears on the timeline immediately (P0)`.

define-backlog output (one vertical epic grouping its stories):

```json
{
  "epics": [
    { "id": "E-3", "title": "Manual trip entry", "phase": "D1",
      "prd_ref": ["REQ-12", "REQ-13"], "order": 3, "vertical": true,
      "acceptance": "User adds any segment type; it shows on the timeline." }
  ],
  "stories": [
    { "id": "S-08", "title": "Add flight segment form + persist", "epic": "E-3",
      "prd_ref": "REQ-12", "order": 1, "blocked_by": ["S-00"], "status": "notstarted",
      "acceptance": "Flight with date/time/PNR saved." },
    { "id": "S-09", "title": "Add train + hotel variants", "epic": "E-3",
      "prd_ref": "REQ-12", "order": 2, "blocked_by": ["S-08"], "status": "notstarted" },
    { "id": "S-10", "title": "Optimistic timeline insert", "epic": "E-3",
      "prd_ref": "REQ-13", "order": 3, "blocked_by": ["S-08"], "status": "notstarted" }
  ]
}
```

## Handoff to define-epic

`define-epic` picks the lowest-`order` epic whose stories' `blocked_by` are satisfied,
creates the **GH epic (parent) issue + one sub-issue per child story**, and writes
`gh_issue` back onto the epic and each story. The full per-story spec (scope,
invariants, tests) is generated *there* — not in define-backlog.
