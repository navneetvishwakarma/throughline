---
name: define-feature
description: Use to spec one unit of implementable work before code — either a single story that's a building block of an already-planned epic (a lighter, one-story-at-a-time alternative to expanding define-epic's whole story list at once), or standalone non-epic work with a logical boundary (a hotfix, plugin/scaffold maintenance, a doc-only change, a small feature) substantial enough to want a spec first. Grills for ambiguities, applies the right expert personas, writes a full spec, self-reviews it. Trigger phrases: "define feature for story S-x", "spec story S-x of E-x", "define this feature", "spec out this fix", "run define-feature". Skip entirely for trivial one-liners. This has no numbered gate of its own — epic-linked work inherits that epic's G6; standalone work's only checkpoint is G7 at ship-feature.
---

# define-feature

Act as a top-0.1% FAANG senior PM/architect. Grill before spec, self-review before publish — an implementer should never have to guess.

## Step 0 — Determine mode
A **feature** is one unit of implementable work: either a single **story** — the building block of an epic — or a standalone piece of **non-epic work with a logical boundary**. Which mode depends on what's being asked for, not on the size of the change:

- **Epic-linked mode**: the request names a specific story (`S-x`) or epic+story (`E-x`/`S-x`) from an already-planned, G6-approved epic. Use this instead of re-running all of `define-epic`'s "expand each story" when you only need to spec (or re-spec) one story.
- **Standalone mode**: everything else — a hotfix, plugin/scaffold maintenance, a doc-only change, a small feature never scoped as part of any epic.

If ambiguous (e.g. the description sounds like it could belong to a planned epic but no story id was given), ask which mode before proceeding — the state location, branch, and tracker behavior differ.

## Scope
For an **entire epic's** stories, use `define-epic` — it expands all of an epic's stories in one pass and owns the epic's GitHub parent/sub-issue creation. Use `define-feature` in epic-linked mode for a single story from an epic already planned there, or in standalone mode for anything `ship-feature` covers that never went through `define-epic`.

## Active personas
Auto-select based on what the feature touches; state selected personas and one-line rationale at the top of the spec. Same in both modes.

| Persona | Select when |
|---------|-------------|
| **PM** | Always |
| **Architect** | Backend logic, data changes, integrations, infrastructure |
| **UX Designer** | Any user-facing UI or interaction |
| **Security Consultant** | Auth, payments, sensitive data, permissions, API exposure |

---

## Epic-linked mode

### Gate-in
The epic's G6 is approved: `node scripts/gate.mjs check G6 --subject <epic-id>` passes. The named story exists under that epic in `backlog.json`.

### Branch check
Resolve `<slug>` per `workflow.md`'s **Resolving `<slug>`** rule (reuse the existing `epic/<epic-id>-*` branch if one exists; only derive fresh from the epic's title, kebab-case, if none does) — never guess a new one. Then run `node scripts/ensure-branch.mjs --skill=define-feature --name=epic/<epic-id>-<slug>` — the **same** branch `define-epic`/`implement-epic` share, not a new one. Writing this story's spec anywhere else orphans it: `implement-epic` (or `implement-feature` in epic-linked mode) only ever continues on `epic/<epic-id>-<slug>`.

### Step 1 — Grill, then write the spec
Grill for ambiguities same as standalone mode (below). Write/refine `.throughline/epic-<N>/sub-<story-id>.json` — `define-epic`'s own per-story shape, so `implement-epic`/`implement-feature` read it identically regardless of which skill wrote it:
```json
{
  "id": "<story id>", "title": "<story title>", "goal": "<one sentence>",
  "in_scope": ["<item>"], "out_of_scope": ["<item>"],
  "acceptance": "<testable acceptance from backlog.json or elaborated>",
  "invariants": ["<invariant>"], "prd_ref": "<REQ-xx>",
  "adr_ref": "<ADR file if relevant>", "design_ref": "<docs/design/screens/*.md if set, else omit>"
}
```
If `design_ref` is set, fold the approved screen's layout/states/microcopy into `acceptance`. Refine this story's row/section in the epic's **existing** `.throughline/epic-<N>/ledger.md` and `test-plan.md` in place if `define-epic` already wrote one — append only if genuinely absent. Never create a second, parallel state directory for a story that already belongs to an epic, and never duplicate a row that already exists.

### Step 2 — Self-review
Same five dimensions as standalone mode (below), applied to this one story's spec.

### Tracker integration
None — `define-epic` already created this story's `gh_issue` (if `tracker: github`) when the epic was defined. Re-running `define-feature` on a story never files a second issue.

### Done when
`.throughline/epic-<N>/sub-<story-id>.json` refined and self-reviewed; `validate.mjs` passes. Ready for `implement-epic` or `implement-feature` (epic-linked mode) to pick up.

---

## Standalone mode

### Branch check
Run `node scripts/ensure-branch.mjs --skill=define-feature --name=feature/<slug>` (slug derived from the one-line user story, kebab-case). `implement-feature` (standalone mode) continues on this exact branch.

### Step 1 — Grill for ambiguities
Identify every open question that would materially change acceptance criteria, scope, or technical approach. Batch all questions at once (max 5, ranked by impact) — this is a spec review, not an ongoing conversation. If zero genuine ambiguities, skip straight to Step 2. Aesthetic preferences, minor edge cases, and hypothetical future scope are not real ambiguities — make a call and note it as an assumption instead.

### Step 2 — Write the spec
Write `.throughline/feature-<slug>/spec.md` in this fixed order (omit a persona-specific section only if that persona isn't active and no other active persona has input for it):

```markdown
**Personas Applied:** [Name — one-line rationale each]
**Source:** [Link or name of the conversation/doc this came from, if any]

#### One-Line User Story
As a [actor], I want to [action] so that [outcome].

#### Problem / Context
#### Expected Outcome
#### In Scope
#### Out of Scope
#### Assumptions

#### Acceptance Criteria
Given [context] / When [action] / Then [observable outcome] — 5-10, numbered, BDD, independently testable.

#### Definition of Done
Objective checklist referencing AC numbers.

#### Tests
Scenario-based, grouped happy path -> edge cases -> error states -> security/data. This doubles as the test plan `implement-feature` works from.

#### UX Notes *(if UX Designer active)*
#### Architecture / Technical Notes *(if Architect or Security Consultant active)*
#### Data / Migration Notes *(if Architect active)*
#### Observability / Analytics
#### Risks / Edge Cases
Each risk: likelihood (H/M/L) + mitigation.
```

Also initialize `.throughline/feature-<slug>/ledger.md`:
```
| task | scope | files | tests | commit | status | risks |
|------|-------|-------|-------|--------|--------|-------|
```

### Step 3 — Self-review
Before publishing, check the spec against all five dimensions — fix and re-check until every one passes:

| Dimension | Check |
|-----------|-------|
| Completeness | Every critical behavior and state (empty, loading, error, success) covered |
| Effectiveness | Solves the stated problem without bloated scope |
| Clarity | An implementer can proceed without guessing |
| Testability | Every AC maps to at least one test case |
| Traceability | Source links back to what originated this feature |

### Step 4 — Tracker integration
**If `tracker: local` (the default):** done — `spec.md` is the record, nothing to file.

**If `tracker: github`:** confirm repo context (`gh repo view --json nameWithOwner -q .nameWithOwner`), then:
```bash
gh issue create \
  --title "<one-line user story verbatim>" \
  --body "<full spec.md content>" \
  --label "feature"
```
Add a line to the top of `spec.md`: `**GitHub Issue:** <url>` — the issue is a mirror of the spec, not a replacement for it; `implement-feature` still reads `spec.md` as the source of truth. External trackers are mirrors, never sources of truth.

**If `tracker` is anything else:** stop. Add a tracker adapter before claiming support.

### Done when
`.throughline/feature-<slug>/spec.md` exists, passes all five self-review dimensions, and (tracker: github only) is filed as a GitHub issue. Ready for `implement-feature` (standalone mode).

---

## Failure modes
- Ambiguity survives into the spec because it wasn't grilled first → stop, grill, then write.
- Self-review dimension fails → fix inline in the spec, never file/finish with a known gap.
- Epic-linked mode invoked but G6 isn't approved, or the story doesn't exist under that epic → stop; run `define-epic` first.
- `gh repo view` fails (standalone, github mode) → stop; don't guess the repo.
