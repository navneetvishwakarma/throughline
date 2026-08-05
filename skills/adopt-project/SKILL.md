---
name: adopt-project
description: Use when an existing repo needs to be brought onto the workflow without starting over — stand up the rails, retrofit the backlog contract, and reconcile in-flight work. Trigger phrases: "adopt this repo", "migrate to the workflow", "onboard an existing project", "bring this in line with the workflow". Replaces bootstrap-project for brownfield codebases. This is gate G5 (adopt).
---

# adopt-project

Act as a top-0.1% FAANG principal architect running a brownfield onboarding. Audit first, never assume. Reconcile what exists into one contract; never discard or double-count.

## Gate-in
A git repo exists at the working directory. No brief or PRD required — this is reverse-onboarding from code and history.

## Context protocol
Audit via section reads and the codegraph query, not whole-tree reads. **If no codegraph index is present, build it first** (`codegraph init` or equivalent) — it is the cheapest way to understand the existing codebase. Then query it; never scan source trees.

## Do this

1. **Bootstrap the scaffold tooling itself, non-destructively.** This repo has never run any throughline skill, so none of `scripts/`, `.githooks/`, or the doc templates exist yet — every step below depends on them. Find the currently installed plugin (Claude Code: `~/.claude/plugins/cache/local/throughline/<version>/`; Codex: `~/plugins/throughline/`) and copy its `skills/bootstrap-project/assets/scripts/sync-plugin.mjs` into this project's `scripts/` directory by hand — that's the one file that has to exist before anything else can run. Then run `node scripts/sync-plugin.mjs` (report-only first: a genuine path collision with a file this repo already has for its own unrelated reasons — not a throughline scaffold file — shows as **needs review** here; resolve those with the human before continuing, the same caution `upgrade-project` uses), then `node scripts/sync-plugin.mjs --apply` to write everything **added**. This is what makes every later step that calls `scripts/coverage.mjs`, `scripts/ensure-branch.mjs`, `scripts/init-project.mjs`, or `scripts/validate.mjs` actually work.

2. **Branch check** — run `node scripts/ensure-branch.mjs --skill=adopt-project`. If the repo is on `main`/`master`, it creates and switches to a feature branch automatically and reports the name — everything below lands there, never on `main`.

3. **Audit** — detect and report what's already present:
   - Docs tier: product docs, PRD, architecture, design, backlog files.
   - Design assets: does the repo already render real UI (pages/screens/components) with no `docs/design/` journeys or screens documenting it? Report ✓ design docs present / ✗ real UI exists but undocumented — this flag matters because `define-design` will otherwise start in seed mode and try to *invent* journeys for a product that already has real, shipped flows.
   - Tracker: `.throughline/ship-*/`, `.throughline/epic-*/`, GitHub issues, roadmap/progress files.
   - CI, pre-commit hooks, codegraph index.
   - Coverage tooling: run `node scripts/coverage.mjs --json` once code exists — report ✓ `<tool>` configured / ✗ none detected for `<stack>`.
   - Security surfaces: auth/PII/secrets already in the codebase (flag for the security lens).
   Print a one-page audit: ✓ present / ✗ missing per item.

4. **Rails** — run `node scripts/init-project.mjs "<name>"` (non-destructive: never overwrites existing files) — adds `AGENTS.md` plus platform pointer files and builds the doc tree + empty `backlog.json`. The pre-commit hook and CI workflow were already added in step 1 by `sync-plugin.mjs`; keep the bundled CI workflow unless the repo already has a stronger equivalent — the same rule `bootstrap-project` uses, not a separate one. Build or refresh the codegraph index. If the audit flagged missing coverage tooling for a repo that already has code, run `node scripts/coverage.mjs --setup`, present the diff, and ask before installing the new dependency or committing — never install silently.

5. **Contract** — reconcile existing work into `docs/engineering/backlog.json`:
   - Existing tracker items (GH epic issues + sub-issues, roadmap slices) → epics + stories with `gh_issue` where relevant.
   - Orphan roadmap items with no tracker counterpart → stories without `gh_issue`.
   - **Seed status from the most authoritative source: ledger files and commits, not stale tracker state.** A closed GH issue wins over a stale "in_progress" in a roadmap file.
   - Do not double-count: one epic/story per work item, regardless of how many places it appears.
   - No PRD is required here (per Gate-in) — a story reconciled without one legitimately has no `prd_ref`. Don't invent a requirement id to satisfy the schema; step 8 is what makes that honest.

6. **Dedup** — merge duplicate tracking universes (e.g. roadmap slices that overlap tracker sub-issues). Flag any ambiguous cases for the human to resolve; never guess.

7. **Cut over** — point the dashboard at `backlog.json` (`node scripts/build-dashboard.mjs`). Archive (do not delete) old progress files; note their location.

8. **Re-stamp the contract state** — run `node scripts/sync-plugin.mjs --apply` again, now that `backlog.json` reflects the reconciled reality. `sync-plugin.mjs` only grants `legacyContractGrace` (the flag that lets `validate.mjs` warn instead of hard-fail on a story missing `prd_ref` — expected here, per step 5) by reading `backlog.json` as it stands *right now* — at step 1 it was still empty, so this second stamp is what actually makes the grant accurate.

9. **Labels** — if any reconciled epic/story carries a `gh_issue` (this project is GitHub-tracked — `sync-status.mjs` will infer and persist `tracker: github` from that same evidence the first time it runs), create the workflow issue labels `epic` and `feature` if they don't already exist. Same rule `bootstrap-project` applies when a human explicitly chose `tracker: github`; this just reaches the same state by inference instead of an upfront choice.

10. **Verify (subagent)** — run `node scripts/validate.mjs`; confirm rollups match reality; cross-check story counts vs the old tracker. Report any discrepancy. A `WARN`-only exit (e.g. reconciled stories missing `prd_ref`, expected per step 5) is a complete, passing outcome — not a blocker. An actual exit 1 means something is genuinely wrong; fix before presenting for G5.

Supporting lenses: PM (map existing work to the PRD's REQ-xx where a PRD exists), Security (flag existing PII/auth surfaces found during audit).

## Outputs
Rails + `AGENTS.md` + a populated, validated `backlog.json` + a working `PROGRESS_DASHBOARD.html`; old trackers archived.

## Automated gate
`node scripts/validate.mjs` exits 0 (a `WARN`-only exit for legacy `prd_ref` gaps counts as passing — see step 10); every existing tracked item is represented exactly once in `backlog.json`; `build-dashboard.mjs` renders without error.

## Gate (G5 — adopt)
Present the audit report and the reconciled backlog. For existing projects with an existing PRD, this gate collapses G2 and G5 into one. Ask the user to approve the backlog and the seeded statuses. On approval the project is live on the workflow.

## Done when
One contract reflects reality; dashboard renders; no double-counting; old trackers archived not deleted; G5 approved.

## Failure modes
- Stale tracker state contradicts commits or ledgers → trust commits/ledgers; flag the conflict in the audit; never silently pick one.
- Ambiguous mapping (one roadmap item = multiple issues or vice versa) → flag for human, do not guess.
- `validate.mjs` exits 1 (not just `WARN`) → fix before presenting for G5; never patch over it by hand-editing the contract.
