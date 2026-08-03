---
name: define-epic
description: Use when the backlog is approved and the next epic needs to be expanded into a full plan — per-story specs, test plan, and (when using a remote tracker) GitHub epic + sub-issues. Trigger phrases: "define epic", "define the next epic", "expand epic E-x", "run define-epic". Picks the lowest-order unblocked epic from the contract. This is gate G6.
---

# define-epic

Act as a top-0.1% FAANG principal architect. Decompose one epic into airtight per-story specs. Consult PM (scope) and Developer (implementability) as supporting lenses.

## Gate-in
`docs/engineering/backlog.json` is valid (`node scripts/validate.mjs` passes); G5 is approved (`node scripts/gate.mjs check G5` when available); at least one epic's stories all have `blocked_by` deps satisfied (all `done`). If none is unblocked: report and stop.

## Context protocol
Load `AGENTS.md` + only the chosen epic's stories + their `prd_ref` requirement from the PRD + the ADR linked to the epic. Never load whole docs. If a codegraph index is present (`.codegraph/`), query it to map the epic to affected symbols/files and read only those spans — never scan the source tree.

## Step 1 — Pick the epic

Read `docs/engineering/backlog.json`. Select the epic with the lowest `order` whose stories all have satisfied `blocked_by` dependencies (every referenced story id is `done`). Report the chosen epic.

## Step 2 — Expand each story

For each child story of the chosen epic, write a per-story spec in `.throughline/epic-<N>/sub-<story-id>.json`:

```json
{
  "id": "<story id>",
  "title": "<story title>",
  "goal": "<one sentence>",
  "in_scope": ["<item>"],
  "out_of_scope": ["<item>"],
  "acceptance": "<testable acceptance from backlog.json or elaborated>",
  "invariants": ["<invariant>"],
  "prd_ref": "<REQ-xx>",
  "adr_ref": "<ADR file if relevant>",
  "design_ref": "<docs/design/screens/*.md if backlog.json set one, else omit>"
}
```

If `design_ref` is set, fold the referenced screen's approved layout/states/microcopy into `acceptance` — "matches the approved screen doc" is part of what makes the story done, not a separate untracked expectation.

## Step 3 — Test plan

Write `.throughline/epic-<N>/test-plan.md` covering each story: what unit, integration, and E2E tests verify each acceptance criterion. Use `engineering:testing-strategy` if available; otherwise produce the plan directly.

## Step 4 — Ledger skeleton

Initialize `.throughline/epic-<N>/ledger.md`:

```
| story | scope | files | tests | commit | status | risks |
|-------|-------|-------|-------|--------|--------|-------|
```

## Step 5 — Tracker integration

**If `tracker: local` (the default):** skip all issue creation. Stories are the work items; `gh_issue` stays `null`; specs live in `.throughline/epic-<N>/`. No account or network needed.

**If `tracker: github`:**

Create the GitHub epic parent issue:

```bash
gh issue create \
  --title "<epic title>" \
  --body "<goal, scope, acceptance, sub-issues placeholder>" \
  --label "epic"
```

For each story, create a sub-issue and link it:

```bash
gh issue create --title "<story title>" --body "<per-story spec>" --label "feature"
# Link:
gh issue sub-issue add <epic-number> --issue <story-number>
# Fallback if gh version < 2.49:
CHILD_ID=$(gh api /repos/:owner/:repo/issues/<story-number> --jq '.id')
gh api --method POST /repos/:owner/:repo/issues/<epic-number>/sub_issues \
  --field sub_issue_id=$CHILD_ID
```

Append a header to `docs/MANUAL-TESTS.md` for this epic and its sub-issues (create the file if absent).

**If `tracker` is anything else:** stop. Add a tracker adapter before claiming support.

**Write back:** After issue creation, write `epic.gh_issue` (parent number) and each `story.gh_issue` (sub-issue number) into `backlog.json`. Do **not** touch `status`.

Run `node scripts/validate.mjs` after any write-back; fix until it passes.

## Gate (G6)
Present the epic plan, per-story specs, and test plan. Ask the user to approve **before any code is written**. On approval run `node scripts/gate.mjs approve G6 --note "epic plan approved"` when available. Then the epic is ready for `implement-epic`.

## Done when
`.throughline/epic-<N>/` exists with all story specs, test-plan.md, and ledger skeleton; `gh_issue` written back (tracker mode only); `validate.mjs` passes; G6 approved.

## Failure modes
- No unblocked epic → report which epics are blocked and by what; stop.
- Backlog invalid → run `validate.mjs`, fix, and retry.
- Story acceptance is ambiguous → clarify from PRD before writing the spec; never invent acceptance.
