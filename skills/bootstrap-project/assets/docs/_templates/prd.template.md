---
doc: prd
project: <PROJECT_NAME>
status: draft        # draft | approved  — must be `approved` before backlog seeding
updated: <DATE>
---

# <PROJECT_NAME> — Product Requirements

> Approve this doc (set `status: approved`) before any backlog stories are seeded.

## Problem & goal

_What we're solving and the outcome we want._

## Non-goals

_Explicitly out of scope._

## Requirements

> Every requirement carries a stable `REQ-xx` ID. Backlog stories reference these
> IDs via `prd_ref`, which is what makes "is requirement X built and tested?"
> answerable by script. Never renumber a shipped requirement. `Release` tags which
> version wave a requirement belongs to (`v1`, `v2`, ...) — a v2+ change to a shipped
> requirement gets a NEW row tagged to the new release; the shipped row is never edited.

| ID | Requirement | Priority | Acceptance | Release |
|------|-------------|----------|------------|---------|
| REQ-01 | … | P0 | … | v1 |
| REQ-02 | … | P1 | … | v1 |

## Success metrics

_How we know it worked (ties to docs/product/07-success-metrics.md)._

## Open questions

- [ ] …
