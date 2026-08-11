---
name: define-feature
description: Use for non-epic work (a hotfix, plugin/scaffold maintenance, a doc-only change, a small standalone feature) that's substantial enough to want a spec before code — grills for ambiguities, applies the right expert personas, writes a full spec, self-reviews it, then either files it as a GitHub issue (tracker: github) or keeps it local (tracker: local, the default). Trigger phrases: "define this feature", "spec out this fix", "plan this change", "run define-feature". Skip this entirely for trivial one-liners — go straight to implement-feature or even ship-feature. For anything tracked as a backlog.json epic, use define-epic instead. This has no numbered gate; G7 (at ship-feature) is the only checkpoint.
---

# define-feature

Act as a top-0.1% FAANG senior PM/architect. Grill before spec, self-review before publish — an implementer should never have to guess.

## Scope
For backlog-tracked work, use `define-epic` instead — it owns `backlog.json` epic/story ids, GitHub sub-issues, and G6. Use `define-feature` for everything else, the same territory `ship-feature` covers: hotfixes, plugin/scaffold maintenance, doc-only changes, small standalone features. Not every `ship-feature` needs this first — a one-line fix doesn't need a spec. Reach for this when the change is non-trivial enough that skipping a spec would mean guessing at scope or acceptance later.

## Active personas
Auto-select based on what the feature touches; state selected personas and one-line rationale at the top of the spec.

| Persona | Select when |
|---------|-------------|
| **PM** | Always |
| **Architect** | Backend logic, data changes, integrations, infrastructure |
| **UX Designer** | Any user-facing UI or interaction |
| **Security Consultant** | Auth, payments, sensitive data, permissions, API exposure |

## Branch check
Run `node scripts/ensure-branch.mjs --skill=define-feature --name=feature/<slug>` (slug derived from the one-line user story, kebab-case). This is deliberate, not the generic per-skill branch check: `implement-feature` continues on this exact branch, the same way `define-epic`/`implement-epic` share `epic/<epic-id>-<slug>` — a spec written to a throwaway branch would be silently orphaned once `implement-feature` forks its own.

## Step 1 — Grill for ambiguities
Identify every open question that would materially change acceptance criteria, scope, or technical approach. Batch all questions at once (max 5, ranked by impact) — this is a spec review, not an ongoing conversation. If zero genuine ambiguities, skip straight to Step 2. Aesthetic preferences, minor edge cases, and hypothetical future scope are not real ambiguities — make a call and note it as an assumption instead.

## Step 2 — Write the spec
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
Scenario-based, grouped happy path -> edge cases -> error states -> security/data. This doubles as the test plan `implement-feature` works from — there is no separate test-plan.md the way `define-epic` writes one, since a feature is one unit, not many stories.

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

## Step 3 — Self-review
Before publishing, check the spec against all five dimensions — fix and re-check until every one passes:

| Dimension | Check |
|-----------|-------|
| Completeness | Every critical behavior and state (empty, loading, error, success) covered |
| Effectiveness | Solves the stated problem without bloated scope |
| Clarity | An implementer can proceed without guessing |
| Testability | Every AC maps to at least one test case |
| Traceability | Source links back to what originated this feature |

## Step 4 — Tracker integration

**If `tracker: local` (the default):** done — `spec.md` is the record, nothing to file.

**If `tracker: github`:** confirm repo context (`gh repo view --json nameWithOwner -q .nameWithOwner`), then:
```bash
gh issue create \
  --title "<one-line user story verbatim>" \
  --body "<full spec.md content>" \
  --label "feature"
```
Add a line to the top of `spec.md`: `**GitHub Issue:** <url>` — the issue is a mirror of the spec, not a replacement for it; `implement-feature` still reads `spec.md` as the source of truth (external trackers are mirrors, never sources of truth — same principle `ship-epic`/`sync-status.mjs` already follow).

**If `tracker` is anything else:** stop. Add a tracker adapter before claiming support.

## Done when
`.throughline/feature-<slug>/spec.md` exists, passes all five self-review dimensions, and (tracker: github only) is filed as a GitHub issue. Ready for `implement-feature`.

## Failure modes
- Ambiguity survives into the spec because it wasn't grilled first → stop, grill, then write.
- Self-review dimension fails → fix inline in the spec, never file/finish with a known gap.
- `gh repo view` fails (github mode) → stop; don't guess the repo.
