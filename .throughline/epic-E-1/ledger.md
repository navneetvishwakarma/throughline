| story | scope | files | tests | commit | status | risks |
|-------|-------|-------|-------|--------|--------|-------|
| S-1 | coverage contract shape validation | scripts/validate.mjs, docs/engineering/backlog.schema.json | node --test tests/throughline.test.mjs (75/75) → pass | ca0bb82 | done | this repo's own coverage.mjs --story run errors (c8 not fully wired for `npm test`'s node:test runner) -- coverage.mode is warn (non-blocking), not part of any story's acceptance, tracked separately not fixed here |
| S-2 | coverage.mjs runtime fail-safety | scripts/coverage.mjs | node --test tests/throughline.test.mjs (80/80) → pass | b80545e | done | none |
| S-3 | monorepo coverage.targets | scripts/coverage.mjs | node --test tests/throughline.test.mjs (85/85) → pass | 45a283a | done | initial implementation resolved summary/lcov relative to repo root instead of cwd -- caught by the weighted-aggregation test, fixed before commit |
| S-4 | CI seed-only + lockfile rendering | scripts/lib/render-workflow.mjs (new), scripts/sync-plugin.mjs, SKILL.md x3 | node --test tests/throughline.test.mjs (89/89) → pass | ac8aa9a, 7c2a44b | done | first commit's `git add -A --` with a stale pathspec silently aborted, only staging the deletion + new file; caught by git status before ledger write, fixed in a follow-up commit |
| S-5 | | | | | | |
| S-6 | | | | | | |
| S-7 | | | | | | |
