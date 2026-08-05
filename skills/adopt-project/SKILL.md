---
name: adopt-project
description: Use when an existing repo needs to be brought onto the workflow without starting over — stand up the rails, retrofit the backlog contract, and reconcile in-flight work. Trigger phrases: "adopt this repo", "migrate to the workflow", "onboard an existing project", "bring this in line with the workflow". Replaces bootstrap-project for brownfield codebases. This is gate G5 (adopt).
---

# adopt-project

Act as a top-0.1% FAANG principal architect running a brownfield onboarding. Audit first, never assume. Reconcile what exists into one contract; never discard or double-count.

## Gate-in
A git repo exists at the working directory. No brief or PRD required — this is reverse-onboarding from code and history.

## Branch check
Run `node scripts/ensure-branch.mjs --skill=adopt-project` before anything else below. If the repo is on `main`/`master`, it creates and switches to a feature branch automatically and reports the name — never write or commit on `main` directly. Already on a non-main branch: no-op.

## Context protocol
Audit via section reads and the codegraph query, not whole-tree reads. **If no codegraph index is present, build it first** (`codegraph init` or equivalent) — it is the cheapest way to understand the existing codebase. Then query it; never scan source trees.

## Do this

1. **Audit** — detect and report what's already present:
   - Docs tier: product docs, PRD, architecture, design, backlog files.
   - Design assets: does the repo already render real UI (pages/screens/components) with no `docs/design/` journeys or screens documenting it? Report ✓ design docs present / ✗ real UI exists but undocumented — this flag matters because `define-design` will otherwise start in seed mode and try to *invent* journeys for a product that already has real, shipped flows.
   - Tracker: `.throughline/ship-*/`, `.throughline/epic-*/`, GitHub issues, roadmap/progress files.
   - CI, pre-commit hooks, codegraph index.
   - Coverage tooling: run `node scripts/coverage.mjs --json` once code exists — report ✓ `<tool>` configured / ✗ none detected for `<stack>`.
   - Security surfaces: auth/PII/secrets already in the codebase (flag for the security lens).
   Print a one-page audit: ✓ present / ✗ missing per item.

2. **Rails** — run `node scripts/init-project.mjs "<name>"` (non-destructive: never overwrites existing files). Add `AGENTS.md` plus platform pointer files, pre-commit hook (`node scripts/validate.mjs`), and CI config if a CI connector is present. Build or refresh the codegraph index. If the audit flagged missing coverage tooling for a repo that already has code, run `node scripts/coverage.mjs --setup`, present the diff, and ask before installing the new dependency or committing — never install silently.

3. **Contract** — reconcile existing work into `docs/engineering/backlog.json`:
   - Existing tracker items (GH epic issues + sub-issues, roadmap slices) → epics + stories with `gh_issue` where relevant.
   - Orphan roadmap items with no tracker counterpart → stories without `gh_issue`.
   - **Seed status from the most authoritative source: ledger files and commits, not stale tracker state.** A closed GH issue wins over a stale "in_progress" in a roadmap file.
   - Do not double-count: one epic/story per work item, regardless of how many places it appears.

4. **Dedup** — merge duplicate tracking universes (e.g. roadmap slices that overlap tracker sub-issues). Flag any ambiguous cases for the human to resolve; never guess.

5. **Cut over** — point the dashboard at `backlog.json` (`node scripts/build-dashboard.mjs`). Archive (do not delete) old progress files; note their location.

6. **Verify (subagent)** — run `node scripts/validate.mjs`; confirm rollups match reality; cross-check story counts vs the old tracker. Report any discrepancy.

Supporting lenses: PM (map existing work to the PRD's REQ-xx where a PRD exists), Security (flag existing PII/auth surfaces found during audit).

## Outputs
Rails + `AGENTS.md` + a populated, validated `backlog.json` + a working `PROGRESS_DASHBOARD.html`; old trackers archived.

## Automated gate
`node scripts/validate.mjs` exits 0; every existing tracked item is represented exactly once in `backlog.json`; `build-dashboard.mjs` renders without error.

## Gate (G5 — adopt)
Present the audit report and the reconciled backlog. For existing projects with an existing PRD, this gate collapses G2 and G5 into one. Ask the user to approve the backlog and the seeded statuses. On approval the project is live on the workflow.

## Done when
One contract reflects reality; dashboard renders; no double-counting; old trackers archived not deleted; G5 approved.

## Failure modes
- Stale tracker state contradicts commits or ledgers → trust commits/ledgers; flag the conflict in the audit; never silently pick one.
- Ambiguous mapping (one roadmap item = multiple issues or vice versa) → flag for human, do not guess.
- `validate.mjs` failures → fix before presenting for G5.
