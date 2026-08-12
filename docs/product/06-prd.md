---
doc: prd
project: Throughline
status: approved        # draft | approved  — must be `approved` before backlog seeding
updated: 2026-08-12
---

# Throughline — Product Requirements

**Personas Applied:** PM, UX, Security

## Problem & goal

Throughline 0.3.1's coverage gate and generated CI scaffold can report a successful upgrade and passing coverage when neither is true for a pnpm (or any multi-workspace) monorepo. The goal of this release is narrow and mechanical: make every gate this plugin generates fail loudly on malformed or incomplete input instead of silently behaving as if nothing were configured.

## Non-goals

New coverage-tool backends beyond the five already supported (Node/Python/Go/Java/Rust); non-GitHub-Actions CI targets; any UI or dashboard redesign beyond the existing static HTML output; telemetry or usage tracking; a synchronizer/reviewed-override mechanism for CI ownership (seed-only is adopted instead — see ADR below).

## Requirements

> Every requirement carries a stable `REQ-xx` ID. Backlog stories reference these
> IDs via `prd_ref`, which is what makes "is requirement X built and tested?"
> answerable by script. Never renumber a shipped requirement. `Release` tags which
> version wave a requirement belongs to (`v1`, `v2`, ...) — a v2+ change to a shipped
> requirement gets a NEW row tagged to the new release; the shipped row is never edited.

| ID | Requirement | Priority | Acceptance | Release |
|------|-------------|----------|------------|---------|
| REQ-01 | `validate.mjs` and `backlog.schema.json` enforce the full coverage contract's shape (mode/min/command/stacks/targets), unconditionally, regardless of `legacyContractGrace` | P0 | Invalid `coverage.mode`, out-of-range `coverage.min`, blank `coverage.command`, non-string `coverage.stacks` entries, and malformed `coverage.targets` entries (missing fields, duplicate ids) all fail `validate.mjs` with a specific error, even when `legacyContractGrace` is active | v1 |
| REQ-02 | `coverage.mjs` fails safely (exit code 2) on malformed runtime configuration instead of silently disabling enforcement | P0 | An unknown `coverage.mode`, a non-numeric/out-of-range `coverage.min`, an invalid `--threshold`, or an unknown `--stack` all exit 2 with a clear message; only correctly-spelled `off`/`warn` bypass threshold enforcement | v1 |
| REQ-03 | `coverage.mjs` supports explicit `coverage.targets` for monorepo workspaces, running every configured target and aggregating by weighted covered/measurable lines | P0 | Two workspace targets with different report sizes run and aggregate correctly (not an unweighted average); a failing target command or a missing declared report fails the run closed; target paths cannot escape the repository root; `--stack` can select exactly one target; single-root auto-detection is unchanged when `coverage.targets` is absent | v1 |
| REQ-04 | The generated `.github/workflows/throughline.yml` is rendered from the target repo's detected lockfile (pnpm/npm/yarn), never suppresses install/coverage-command failures, and is treated as seed-only project-owned scaffold by `sync-plugin.mjs` | P0 | The rendered workflow includes `permissions: contents: read` and contains no `\|\| true`; a customized or pre-0.3.2 copy is never overwritten and never enters `pendingReview`, but is still reported as differing from the current render; a repo with no `package.json` at all defers seeding rather than baking in a workflow with no install step | v1 |
| REQ-05 | `validate.mjs` requires `release_in_flight` once any epic declares an explicit `release`, and `build-dashboard.mjs` never falls back to an invented `v1` when that data is missing | P1 | An epic with an explicit `release` and no matching `release_in_flight` fails `validate.mjs`; a dashboard rendered against ungated data selects an actual declared release and shows a visible configuration warning instead of a false `0/0` "on track" | v1 |
| REQ-06 | `ensure-branch.mjs --name=main` and `--name=master` are rejected without switching branches, from any starting state including detached HEAD | P0 | Both names exit non-zero and leave the working tree exactly where it was, whether called from a feature branch, from `main` itself, or from detached HEAD | v1 |
| REQ-07 | The plugin version is bumped to `0.3.2` consistently across every manifest and the README | P2 | `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (both version fields), `.codex-plugin/plugin.json`, and `README.md` all read `0.3.2`; `npm run doctor` passes | v1 |

## Success metrics

A green `node scripts/validate.mjs` / `node scripts/coverage.mjs --check` / generated CI run means what it says: no malformed config or suppressed failure can produce a false pass. Measured by the regression test suite added alongside each requirement (see `docs/superpowers/plans/2026-08-12-throughline-0.3.2-truthful-coverage.md`) — no separate analytics needed for a dev-tool plugin with no telemetry.

## Open questions

- [ ] None open for this release. One deliberate, already-decided deviation from the raw feedback is recorded as an ADR-equivalent note here rather than an open question: `coverage.mjs`'s "no supported lockfile" behavior only hard-fails CI when `package.json` exists without a committed lockfile — a repo with no `package.json` at all (a non-Node stack) defers seeding the CI workflow rather than baking in a permanently broken install step, since this plugin's own multi-stack coverage detection already treats that as a legitimate, non-Node project shape.
