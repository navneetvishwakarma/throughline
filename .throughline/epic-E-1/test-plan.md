**Personas Applied:** Architect, PM, Developer

# Test plan — E-1: Truthful coverage and scaffold synchronization

All tests are added to `tests/throughline.test.mjs`, following the existing convention of spawning each script as a real child process (`runNode`) against a throwaway fixture project (`makeProject`) copied from `skills/bootstrap-project/assets/`. No mocking of the scripts under test — they are exercised as the real CLI tools projects actually invoke.

## S-1 — validate.mjs coverage contract shape
- Unit/integration (via runNode): invalid `coverage.mode` ('enforcee') → non-zero exit, error mentions `coverage.mode must be one of`.
- Non-numeric / out-of-range `coverage.min` (`'high'`, `1.5`, `-0.1`) → non-zero exit, error mentions the finite-0-to-1 message.
- Non-object `coverage` (a string), blank `coverage.command`, non-string `coverage.stacks` entry → each its own non-zero exit with a specific message.
- Malformed `coverage.targets` (missing `command`/`summary`, duplicate `id`) → non-zero exit naming the offending index/field.
- Same invalid `coverage.mode` with `legacyContractGrace: true` stamped in `.throughline/plugin-version.json` → still a hard failure (grace never applies to contract shape).

## S-2 — coverage.mjs runtime fail-safety
- `coverage.mode: 'enforcee'` with `--check` → exit code exactly 2, stderr mentions `Invalid coverage.mode`.
- `coverage.min: 'high'` and `coverage.min: 1.5` → exit 2.
- `--threshold nope` → exit 2, stderr mentions `Invalid --threshold`.
- `mode: 'off'` / `mode: 'warn'` (correctly spelled) with a deliberately-failing coverage command → exit 0 (non-blocking); `mode: 'Off'` (wrong case) → exit 2, never treated as `off`.
- `--stack does-not-exist` against a real detected stack → exit 2, stderr lists known stacks.

## S-3 — coverage.mjs monorepo targets
- Two targets (`apps/backend` 100/80 lines, `apps/mobile` 900/90 lines) → `summary.aggregate.pct === 170/1000`, proving weighted (not `(0.8+0.1)/2`) aggregation.
- One target whose command exits 1, another whose declared report is never written → both report `status: 'error'`, overall `summary.passed === false`.
- A target `cwd: '../../outside'` → exit 2, stderr mentions "escapes the repository root".
- `--stack backend` against two configured targets (one deliberately broken) → only `backend` runs and is reported.
- No `coverage.targets` key at all, root `package.json` declares `vitest` → unchanged `needs_setup` auto-detect behavior (regression guard).

## S-4 — CI seed-only + lockfile rendering
- Fresh fixture, `package-lock.json` present, `.github/workflows/throughline.yml` absent → `sync-plugin.mjs --apply` seeds it with `npm ci`, `permissions: contents: read`, no `|| true`.
- Re-running `--apply` with no changes → reported "seed-only, up to date", never "needs review".
- Hand-edit the seeded file, re-run `--apply` → content untouched, reported "differs from current render", never in `pendingReview`, version stamp still reaches the current plugin version.
- `pnpm-lock.yaml` present → rendered workflow uses `pnpm/action-setup` + `pnpm install --frozen-lockfile`.
- No `package.json` at all → file is never created; stdout reports "deferred".
- `package.json` present with no lockfile → rendered workflow hard-fails the install step (`exit 1`, `No supported lockfile`), no `|| true`.
- `--force=.github/workflows/throughline.yml` on an existing customized copy → content untouched, stdout says "ignored: ... is seed-only".

## S-5 — release_in_flight / no invented v1
- `validate.mjs`: an epic with `release: 'v2'` and no `release_in_flight` → non-zero exit, error names the epic's declared release(s).
- `build-dashboard.mjs`: same ungated data → rendered HTML shows "Epics · v2" (not "Epics · v1"), a visible "Config warning" banner, and the correct story counts scoped to v2 — never a false 0/0.
- Baseline backlog (no explicit epic releases, no `release_in_flight`) → unchanged "Epics · v1", no warning banner (regression guard).

## S-6 — ensure-branch.mjs protected --name
- From a feature branch, `--name=main` and `--name=master` → non-zero exit, `currentBranch()` unchanged, stderr mentions "protected branch".
- From directly on `main`, `--name=main` → still rejected, not treated as a no-op affirmation.

## S-7 — version bump
- `grep -rn "0.3.1"` across `package.json`, `.claude-plugin/`, `.codex-plugin/`, `README.md` → no matches.
- `npm run doctor` → exits 0.

## Full-suite regression gate (ship-epic quality gate, not a separate story)
`npm test`, `npm run test:coverage`, `npm run doctor` all pass with zero regressions in any pre-existing test.
