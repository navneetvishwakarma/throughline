---
status: approved
---

# Brief: Throughline 0.3.2 — Truthful Coverage and Scaffold Synchronization

## Problem
Throughline 0.3.1's coverage gate and generated CI scaffold can report a successful upgrade and passing coverage when neither is true for a pnpm (or any multi-workspace) monorepo: malformed `coverage.mode`/`coverage.min`/`--threshold` silently degrade to no enforcement instead of failing, coverage detection only inspects the root `package.json` so workspace-level Vitest/Jest installs are invisible, the generated CI workflow suppresses real installation and coverage-command failures with `|| true`, and the dashboard can report a false "0/0 on track" when `release_in_flight` is missing but epics declare explicit releases.

## Target user
Developers using throughline's `bootstrap-project`/`adopt-project`/`upgrade-project` skills to stand up or maintain the coverage-gate and CI contract on their own product repos — especially monorepo setups (pnpm/npm/yarn workspaces) with per-workspace test runners. Not aimed at teams needing a full test-orchestration platform, non-GitHub-Actions CI, or a UI/dashboard product beyond the existing static HTML dashboard.

## Core bet
Throughline's gates (`validate.mjs`, `coverage.mjs`, CI) are only useful if they fail loudly on malformed or incomplete configuration instead of silently degrading to "no enforcement." Making that failure mode impossible — and making the generated CI workflow honest about real failures — is what makes a green gate actually mean something.

## Scope boundary
This release fixes six specific truthfulness defects, confirmed against the current code before scoping: (1) `validate.mjs` never validates the `coverage` object's shape; (2) `coverage.mjs` treats an invalid `mode`/`min`/`--threshold` as if it were `off`; (3) `coverage.mjs` only auto-detects a single root-level stack, with no explicit multi-workspace target support; (4) `sync-plugin.mjs` treats the generated CI workflow as a fully-managed file with no way to mark it project-owned; (5) `build-dashboard.mjs` invents a lowercase `v1` release when `release_in_flight` is missing but epics declare explicit releases; (6) `ensure-branch.mjs` will check a caller directly onto `main`/`master` if asked via `--name=`. Non-goals: no new coverage-tool backends beyond the five already supported (Node/Python/Go/Java/Rust), no non-GitHub-Actions CI target, no product UI work, no telemetry or usage tracking.

## Riskiest assumption
That seed-only (never-auto-overwrite) treatment of the generated CI workflow is the right trade-off — i.e., that a human will actually notice and act on a "differs from current render" report rather than silently drifting forever on a stale, `|| true`-laden workflow that predates this fix.

## Risk decision
**Accept-as-risk.** This is a reporting/UX risk, not a correctness risk: the file is never silently clobbered either way, and the alternative (forcing overwrites of a project's CI file) is strictly worse and contradicts the whole "never touch project-owned scaffold" contract the rest of `sync-plugin.mjs` already relies on. No spike needed before proceeding.
