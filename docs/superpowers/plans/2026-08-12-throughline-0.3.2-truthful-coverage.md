# Throughline 0.3.2: Truthful Coverage and Scaffold Synchronization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `throughline`'s coverage gate and CI scaffold trustworthy for a pnpm/monorepo target: reject malformed coverage config instead of silently disabling it, support explicit per-workspace coverage targets, stop generating a CI workflow that swallows its own failures, stop `sync-plugin.mjs` from flagging or clobbering project-owned CI, stop the dashboard from inventing a fake `v1` release, and stop `ensure-branch.mjs` from ever checking a caller directly onto `main`/`master`.

**Architecture:** All changes are confined to `skills/bootstrap-project/assets/scripts/*.mjs`, `skills/bootstrap-project/assets/docs/engineering/backlog.schema.json`, one new shared lib module, `skills/bootstrap-project/assets/.github/workflows/throughline.yml`, three `SKILL.md` files whose prose describes now-obsolete manual workarounds, and `tests/throughline.test.mjs`. No new dependencies. TDD throughout: every behavior change gets a failing test against the real script (spawned as a child process via the existing `runNode`/`makeProject` fixture harness) before the implementation lands.

**Tech Stack:** Node.js (`node --test`), dependency-free `.mjs` scripts, JSON Schema (structural only, hand-validated — no `ajv`).

---

## Review notes (what's real, what's a judgment call)

Every defect in the feedback was verified directly against the current code before writing this plan — nothing here is taken on faith:

- **Confirmed as described, unchanged from the report:** Node 20 + `npm ci --ignore-scripts || true` + a second `|| true` on the coverage step (`throughline.yml:45-46`); root-only `package.json` inspection in `coverage.mjs`'s `nodeStack()`; `resolvedMode = coverageConfig?.mode || 'off'` combined with `if (resolvedMode !== 'enforce') process.exit(0)` (`coverage.mjs:53,346`) — a typo'd mode silently behaves exactly like `off`; zero coverage-object validation anywhere in `validate.mjs` or `backlog.schema.json`; `sync-plugin.mjs` treats `.github/workflows/throughline.yml` as a fully-managed diffed file with no seed-only concept; `build-dashboard.mjs:111` (`data.release_in_flight || 'v1'`) with no corresponding "epics have explicit releases but `release_in_flight` is missing" check in `validate.mjs`; `ensure-branch.mjs`'s `--name=` path (`ensure-branch.mjs:67-71`) never checks the requested name against `PROTECTED` before switching.
- **Already correct, no change needed (verify with a regression test only):** the aggregation math in `coverage.mjs` (`coveredSum / totalSum` at lines 303-306) is already a weighted total-covered/total-measurable ratio, not an unweighted average of percentages. Task 3 adds the two-target test proving this rather than "fixing" already-correct code.
- **One deliberate deviation from the literal spec text, flagged here rather than silently resolved:** the spec's CI-rendering rule lists exactly four lockfile cases and says "no supported lockfile: emit an explicit setup warning, do not use `|| true`" — read literally, that would hard-fail the CI install step for a legitimate non-Node project (Python/Go/Java/Rust) that has no `package.json` at all, which contradicts this plugin's own multi-stack design (`coverage.mjs` already supports Python/Go/Java/Rust) and its explicit instruction not to hardcode Node-shaped assumptions. Task 4 distinguishes "`package.json` exists but no lockfile is committed" (real hygiene gap → hard fail, no suppression) from "no `package.json` at all" (not a Node project yet → don't seed the file at all; see below). Reject this plan step and ask for the literal 4-case behavior instead if you'd rather not carry that distinction.
- **Two correctness gaps caught in advisor review of this plan, both fixed below before execution:**
  1. *Greenfield bootstrap would permanently bake in a coverage job with no install step.* `skills/bootstrap-project/assets/` has no `package.json`, so at bootstrap time `detectLockfile` would return `no-node` and seed-only would render (and never revisit) a `coverage` job that never installs anything. Once the human later adds `package.json` + a lockfile and real tests, CI would still skip installing, `coverage.mjs` would report `needs_setup`, and the workflow's own eval step treats `needs_setup` as a warning, not a failure — green CI, coverage never actually measured. That is the exact 0.3.1 defect this release exists to kill, reintroduced through the bootstrap path. Fix: when no `package.json` exists at all, don't seed the file — defer it, and report that plainly, so a later `sync-plugin.mjs --apply` (once a lockfile exists) is what actually creates it.
  2. *Existing (pre-0.3.2) projects would never learn their CI workflow is stale.* Every already-adopted project already has `.github/workflows/throughline.yml` with the old `|| true` suppressions. Seed-only means "exists → never touch, never flag" — silently full stop, with no signal to the human that a better version exists. Fix: on every sync, still compute what the current render *would* be and compare it against what's on disk (read-only, never written back); report existing seed files as either "matches current render" or "differs from current render — seed-only, not auto-updated, review by hand," instead of a single undifferentiated "project-owned" bucket.
- **Everything else in the feedback is applicable as written** and is covered by a task below: coverage.mjs exit-2 fail-safety, monorepo `coverage.targets`, seed-only CI ownership, the `release_in_flight` fix, and the `ensure-branch.mjs` protected-name fix.
- **Two operational caveats for `upgrade-project`, documented rather than coded around:**
  1. *Self-bootstrapping lag.* An upgrade's *first* `sync-plugin.mjs --apply` still runs the project's **old** (0.3.1) copy of the script — the one that treats `.github/workflows/throughline.yml` as a plain managed file and can flag it under `needs review` if it was customized. That same run writes the new script and the new `lib/render-workflow.mjs` into the project. Seed-only treatment only takes effect starting with the *second* `--apply` (now running the new script). `upgrade-project`'s SKILL.md is updated in Task 4 to say this explicitly, so nobody `--force`s away a real customization during the transitional run.
  2. *`release_in_flight` becomes a new hard failure.* A backlog.json that previously validated (epics with explicit `release` values, no `release_in_flight`) now fails `validate.mjs` — including through the pre-commit hook. This is intentional (it's the fix for the invented-`v1` dashboard bug) and is not covered by `legacyContractGrace`. `upgrade-project`'s SKILL.md step 7 is updated in Task 5 to name this as an expected new failure with a one-line fix (set `release_in_flight` to the release actually in flight).

---

## File map

| File | Change |
|---|---|
| `skills/bootstrap-project/assets/docs/engineering/backlog.schema.json` | Add `coverage.targets` schema |
| `skills/bootstrap-project/assets/scripts/validate.mjs` | Coverage contract validation (mode/min/command/stacks/targets); `release_in_flight` vs explicit epic releases |
| `skills/bootstrap-project/assets/scripts/coverage.mjs` | Exit-2 fail-safety; `coverage.targets` monorepo support; path-traversal guard |
| `skills/bootstrap-project/assets/scripts/lib/render-workflow.mjs` | **New.** Lockfile detection + CI YAML rendering, shared by `sync-plugin.mjs` |
| `skills/bootstrap-project/assets/scripts/sync-plugin.mjs` | Seed-only handling for `.github/workflows/throughline.yml`: defer when no package manager detected yet, diff-aware reporting when it already exists, `--force` no-op notice; wires in the new lib file |
| `skills/bootstrap-project/assets/scripts/build-dashboard.mjs` | No invented `v1`; config-warning banner |
| `skills/bootstrap-project/assets/scripts/ensure-branch.mjs` | Reject `--name=main`/`--name=master` |
| `skills/bootstrap-project/assets/.github/workflows/throughline.yml` | **Deleted** (with the now-empty `assets/.github/` directory) — `lib/render-workflow.mjs` is the sole source of this file's content now, so a static copy would only go stale |
| `skills/bootstrap-project/SKILL.md` | Step 2 no longer wholesale-copies `.github/`; step 8 notes it now seeds the CI file |
| `skills/adopt-project/SKILL.md` | Minor wording: "generated" not "bundled" CI workflow |
| `skills/upgrade-project/SKILL.md` | Remove the now-obsolete manual-vigilance paragraph about `--force` sweeping up the CI workflow; add the self-bootstrapping-lag note (run `--apply` twice) and the new `release_in_flight` hard-failure note |
| `tests/throughline.test.mjs` | All new regression tests |
| `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (both version fields), `.codex-plugin/plugin.json`, `README.md` | Version bump to `0.3.2` |

---

### Task 1: Coverage contract validation (`validate.mjs` + `backlog.schema.json`)

**Files:**
- Modify: `skills/bootstrap-project/assets/docs/engineering/backlog.schema.json:33-42`
- Modify: `skills/bootstrap-project/assets/scripts/validate.mjs`
- Test: `tests/throughline.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add after the existing test `'validate.mjs enforces coverage.min only when coverage.mode is enforce, and stays backward-compatible when the key is absent'` (around line 680):

```js
test('validate.mjs rejects an invalid coverage.mode and a non-numeric or out-of-range coverage.min', () => {
  const root = makeProject('coverage-contract-mode-min');
  try {
    approvePrd(root);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'enforcee', min: 0.7 } }));
    const badMode = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(badMode.status, 0);
    assert.match(badMode.stderr, /coverage\.mode must be one of off\|warn\|enforce/);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'warn', min: 'high' } }));
    const nonNumericMin = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(nonNumericMin.status, 0);
    assert.match(nonNumericMin.stderr, /coverage\.min must be a finite number from 0 through 1/);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'warn', min: 1.5 } }));
    const tooHigh = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(tooHigh.status, 0);
    assert.match(tooHigh.stderr, /coverage\.min must be a finite number from 0 through 1/);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'warn', min: -0.1 } }));
    const negative = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(negative.status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs rejects a non-object coverage value, an empty coverage.command, and non-string coverage.stacks entries', () => {
  const root = makeProject('coverage-contract-shape');
  try {
    approvePrd(root);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: 'enforce' }));
    const notObject = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(notObject.status, 0);
    assert.match(notObject.stderr, /coverage must be an object/);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { command: '   ' } }));
    const blankCommand = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(blankCommand.status, 0);
    assert.match(blankCommand.stderr, /coverage\.command must be a non-empty string/);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { stacks: ['node-vitest', ''] } }));
    const blankStack = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(blankStack.status, 0);
    assert.match(blankStack.stderr, /coverage\.stacks must be an array of non-empty strings/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs rejects malformed coverage.targets entries: missing fields and duplicate ids', () => {
  const root = makeProject('coverage-contract-targets');
  try {
    approvePrd(root);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      coverage: { mode: 'warn', targets: [{ id: 'backend', cwd: 'apps/backend' }] },
    }));
    const missingFields = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(missingFields.status, 0);
    assert.match(missingFields.stderr, /coverage\.targets\[0\]\.command is required/);
    assert.match(missingFields.stderr, /coverage\.targets\[0\]\.summary is required/);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      coverage: {
        mode: 'warn',
        targets: [
          { id: 'backend', cwd: 'apps/backend', command: 'pnpm test', summary: 'coverage/coverage-summary.json' },
          { id: 'backend', cwd: 'apps/mobile', command: 'pnpm test', summary: 'coverage/coverage-summary.json' },
        ],
      },
    }));
    const dup = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(dup.status, 0);
    assert.match(dup.stderr, /coverage\.targets\[1\]\.id "backend" is duplicated/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs still rejects an invalid coverage.mode even when legacyContractGrace is active', () => {
  const root = makeProject('coverage-contract-grace-override');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'nope' } }));
    writeJson(join(root, '.throughline/plugin-version.json'), { version: null, syncedAt: new Date().toISOString(), pendingReview: [], legacyContractGrace: true });

    const result = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(result.status, 0, 'legacyContractGrace only softens prd_ref/acceptance/done-verify gaps, never coverage-contract shape');
    assert.match(result.stderr, /coverage\.mode must be one of/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/throughline.test.mjs --test-name-pattern="coverage.mjs rejects|coverage-contract|coverage.mode must be one of"` — this pattern is loose on purpose; simplest is just `npm test 2>&1 | grep -A3 "coverage contract\|coverage.targets\|coverage-contract"`.
Expected: FAIL — `validate.mjs` currently exits 0 for all of these because it never inspects `data.coverage` at all except the `min`-vs-done-story check.

- [ ] **Step 3: Add `coverage.targets` to the schema**

In `skills/bootstrap-project/assets/docs/engineering/backlog.schema.json`, replace the `coverage` property block (lines 33-42):

```json
    "coverage": {
      "type": "object", "additionalProperties": false,
      "description": "Optional code-coverage gate. Absence of this key means no enforcement (backward-compatible with installs that predate this feature).",
      "properties": {
        "min": { "type": "number", "minimum": 0, "maximum": 1, "default": 0.7, "description": "Minimum aggregate line coverage required when mode is 'enforce'." },
        "mode": { "enum": ["off", "warn", "enforce"], "default": "warn", "description": "off = ignored; warn = measured and reported, never blocks; enforce = blocks done stories/ship-epic/CI below min." },
        "command": { "type": "string", "minLength": 1, "description": "Override: exact command to run instead of stack auto-detection." },
        "stacks": { "type": "array", "items": { "type": "string", "minLength": 1 }, "description": "Override: restrict detection to these stack ids (e.g. for a monorepo)." },
        "targets": {
          "type": "array",
          "description": "Explicit per-workspace coverage targets for a monorepo. Takes priority over stack auto-detection when present; every target runs and results are aggregated by total covered / total measurable lines.",
          "items": {
            "type": "object", "additionalProperties": false,
            "required": ["id", "cwd", "command", "summary"],
            "properties": {
              "id": { "type": "string", "minLength": 1, "description": "Unique identifier; selectable via --stack." },
              "cwd": { "type": "string", "minLength": 1, "description": "Workspace directory, relative to the repo root." },
              "command": { "type": "string", "minLength": 1, "description": "Coverage command to run inside cwd." },
              "summary": { "type": "string", "minLength": 1, "description": "istanbul-style json-summary report path, relative to cwd." },
              "lcov": { "type": "string", "minLength": 1, "description": "Optional lcov report path, relative to cwd, linked from the dashboard." }
            }
          }
        }
      }
    },
```

- [ ] **Step 4: Add coverage-contract validation to `validate.mjs`**

In `skills/bootstrap-project/assets/scripts/validate.mjs`, insert immediately after line 56 (`if (data.release_in_flight && ...) err(...)`) and before line 57 (`if (!Array.isArray(data.epics)) ...`):

```js
const COVERAGE_MODES = ['off', 'warn', 'enforce'];
function validateCoverage(coverage) {
  if (coverage === undefined) return;
  if (typeof coverage !== 'object' || coverage === null || Array.isArray(coverage)) { err('coverage must be an object'); return; }
  if (coverage.mode !== undefined && !COVERAGE_MODES.includes(coverage.mode)) err('coverage.mode must be one of ' + COVERAGE_MODES.join('|') + ' (got ' + JSON.stringify(coverage.mode) + ')');
  if (coverage.min !== undefined) {
    const min = coverage.min;
    if (typeof min !== 'number' || !Number.isFinite(min) || min < 0 || min > 1) err('coverage.min must be a finite number from 0 through 1 (got ' + JSON.stringify(min) + ')');
  }
  if (coverage.command !== undefined && (typeof coverage.command !== 'string' || !coverage.command.trim())) err('coverage.command must be a non-empty string');
  if (coverage.stacks !== undefined) {
    if (!Array.isArray(coverage.stacks) || coverage.stacks.some((s) => typeof s !== 'string' || !s.trim())) err('coverage.stacks must be an array of non-empty strings');
  }
  if (coverage.targets !== undefined) {
    if (!Array.isArray(coverage.targets)) { err('coverage.targets must be an array'); return; }
    const targetIds = new Set();
    coverage.targets.forEach((t, i) => {
      const at = 'coverage.targets[' + i + ']';
      if (!t || typeof t !== 'object' || Array.isArray(t)) { err(at + ' must be an object'); return; }
      if (!t.id || typeof t.id !== 'string' || !t.id.trim()) err(at + '.id is required and must be a non-empty string');
      else if (targetIds.has(t.id)) err(at + '.id "' + t.id + '" is duplicated');
      else targetIds.add(t.id);
      if (!t.cwd || typeof t.cwd !== 'string' || !t.cwd.trim()) err(at + '.cwd is required and must be a non-empty string');
      if (!t.command || typeof t.command !== 'string' || !t.command.trim()) err(at + '.command is required and must be a non-empty string');
      if (!t.summary || typeof t.summary !== 'string' || !t.summary.trim()) err(at + '.summary is required and must be a non-empty string');
      if (t.lcov !== undefined && (typeof t.lcov !== 'string' || !t.lcov.trim())) err(at + '.lcov must be a non-empty string');
    });
  }
}
// Runs unconditionally -- unlike prd_ref/acceptance/done-verify gaps, the coverage contract's
// *shape* is never softened by legacyContractGrace: a malformed mode/min/target is a config
// bug, not a pre-existing-data gap that a grace period is meant to cover.
validateCoverage(data.coverage);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — the 4 new tests, and no regression in the existing `'validate.mjs enforces coverage.min only when coverage.mode is enforce...'` test (it uses `{ min: 0.7, mode: 'enforce' }`, a valid shape, so `validateCoverage` adds no new errors there).

- [ ] **Step 6: Commit**

```bash
git add skills/bootstrap-project/assets/docs/engineering/backlog.schema.json skills/bootstrap-project/assets/scripts/validate.mjs tests/throughline.test.mjs
git commit -m "validate.mjs: enforce the coverage contract's shape unconditionally"
```

---

### Task 2: `coverage.mjs` fails safely on malformed mode/min/threshold/`--stack`

**Files:**
- Modify: `skills/bootstrap-project/assets/scripts/coverage.mjs:51-55`
- Test: `tests/throughline.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add after the existing test `'coverage.mjs runs the real run/parse/aggregate/--story chain end to end via a coverage.command override'`:

```js
test('coverage.mjs exits 2 for an unknown coverage.mode, never treating a typo as off', () => {
  const root = makeProject('coverage-runtime-bad-mode');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'enforcee', min: 0.9 } }));

    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--check']);
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.match(result.stderr, /Invalid coverage\.mode/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs exits 2 for a non-numeric or out-of-range coverage.min', () => {
  const root = makeProject('coverage-runtime-bad-min');
  try {
    approvePrd(root);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'warn', min: 'high' } }));
    const nonNumeric = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json']);
    assert.equal(nonNumeric.status, 2, nonNumeric.stderr || nonNumeric.stdout);
    assert.match(nonNumeric.stderr, /Invalid coverage\.min/);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'warn', min: 1.5 } }));
    const outOfRange = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json']);
    assert.equal(outOfRange.status, 2, outOfRange.stderr || outOfRange.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs exits 2 for an invalid --threshold, including a non-numeric string', () => {
  const root = makeProject('coverage-runtime-bad-threshold');
  try {
    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json', '--threshold', 'nope']);
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.match(result.stderr, /Invalid --threshold/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs treats mode off and warn as non-blocking only when spelled correctly', () => {
  const root = makeProject('coverage-mode-spelling');
  try {
    writeFileSync(join(root, 'write-coverage.mjs'), `
      import { mkdirSync, writeFileSync } from 'node:fs';
      mkdirSync('coverage', { recursive: true });
      writeFileSync('coverage/coverage-summary.json', JSON.stringify({ total: { lines: { total: 100, covered: 1 } } }));
    `, 'utf8');
    approvePrd(root);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'off', min: 0.99, command: 'node write-coverage.mjs' } }));
    const off = runNode(root, join(root, 'scripts/coverage.mjs'), ['--check']);
    assert.equal(off.status, 0, off.stderr || off.stdout);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'warn', min: 0.99, command: 'node write-coverage.mjs' } }));
    const warn = runNode(root, join(root, 'scripts/coverage.mjs'), ['--check']);
    assert.equal(warn.status, 0, warn.stderr || warn.stdout);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'Off', min: 0.99, command: 'node write-coverage.mjs' } }));
    const wrongCase = runNode(root, join(root, 'scripts/coverage.mjs'), ['--check']);
    assert.equal(wrongCase.status, 2, wrongCase.stderr || wrongCase.stdout, 'a mode typo must never silently behave like off');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs exits 2 for an unknown --stack identifier requested explicitly', () => {
  const root = makeProject('coverage-unknown-stack');
  try {
    writeJson(join(root, 'package.json'), { name: 'fixture', devDependencies: { vitest: '^2.0.0' } });
    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json', '--stack', 'does-not-exist']);
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.match(result.stderr, /Unknown --stack "does-not-exist"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — today `coverage.mjs` never validates `mode`/`min`/`--threshold`/`--stack`; a typo'd mode falls through to `resolvedMode !== 'enforce'` at the bottom and exits 0, and an unknown `--stack` just filters everything out to zero stacks (`status: 'skipped'`, exit 0) instead of erroring.

- [ ] **Step 3: Implement the runtime guards**

In `skills/bootstrap-project/assets/scripts/coverage.mjs`, replace lines 51-55:

```js
const backlog = readJson(backlogPath);
const coverageConfig = backlog?.coverage || null; // absent key = enforcement off, per contract
const resolvedMode = coverageConfig?.mode || 'off';
const threshold = thresholdArg != null ? Number(thresholdArg) : (coverageConfig?.min ?? 0.7);
const stackAllowlist = coverageConfig?.stacks;
```

with:

```js
const backlog = readJson(backlogPath);
const coverageConfig = backlog?.coverage || null; // absent key = enforcement off, per contract

const VALID_MODES = ['off', 'warn', 'enforce'];
const rawMode = coverageConfig?.mode;
const resolvedMode = rawMode === undefined ? 'off' : rawMode;
if (!VALID_MODES.includes(resolvedMode)) {
  console.error('Invalid coverage.mode: ' + JSON.stringify(rawMode) + ' (must be one of ' + VALID_MODES.join('|') + '). Refusing to guess -- fix docs/engineering/backlog.json (validate.mjs also rejects this).');
  process.exit(2);
}

function isValidFraction(n) { return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1; }

const rawMin = coverageConfig?.min;
if (rawMin !== undefined && !isValidFraction(rawMin)) {
  console.error('Invalid coverage.min: ' + JSON.stringify(rawMin) + ' (must be a finite number from 0 through 1).');
  process.exit(2);
}
const baseThreshold = rawMin ?? 0.7;

let threshold = baseThreshold;
if (thresholdArg != null) {
  const parsedThreshold = Number(thresholdArg);
  if (!isValidFraction(parsedThreshold)) {
    console.error('Invalid --threshold: ' + JSON.stringify(thresholdArg) + ' (must be a finite number from 0 through 1).');
    process.exit(2);
  }
  threshold = parsedThreshold;
}
const stackAllowlist = coverageConfig?.stacks;
```

Then, immediately after the existing line `const stacks = ALL_STACKS.filter((s) => (!stackFilter || s.id === stackFilter) && (!stackAllowlist || stackAllowlist.includes(s.id)));` (line 221), add:

```js
if (stackFilter && !ALL_STACKS.some((s) => s.id === stackFilter)) {
  console.error('Unknown --stack "' + stackFilter + '". Known: ' + (ALL_STACKS.map((s) => s.id).join(', ') || '(none detected)'));
  process.exit(2);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. Also re-run the pre-existing coverage tests (`'coverage.mjs reports skipped for a bare scaffold...'`, `'...nudges instead of failing silently...'`, `'...--setup adds...'`, `'...--story patches...'`, `'...runs the real run/parse/aggregate/--story chain...'`) to confirm no regression — none of them set an invalid mode/min/threshold, and the `--stack` guard only fires when `--stack` is actually passed, which none of the pre-existing tests do except implicitly through `stackAllowlist` (a different mechanism, untouched).

- [ ] **Step 5: Commit**

```bash
git add skills/bootstrap-project/assets/scripts/coverage.mjs tests/throughline.test.mjs
git commit -m "coverage.mjs: exit 2 on malformed mode/min/threshold/--stack instead of silently disabling enforcement"
```

---

### Task 3: `coverage.mjs` monorepo `coverage.targets` support

**Files:**
- Modify: `skills/bootstrap-project/assets/scripts/coverage.mjs:12` (imports), and the block around lines 208-221 (stack construction)
- Test: `tests/throughline.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test('coverage.mjs runs two workspace targets and aggregates by weighted covered/total, not an unweighted average of percentages', () => {
  const root = makeProject('coverage-targets-weighted');
  try {
    mkdirSync(join(root, 'apps/backend'), { recursive: true });
    mkdirSync(join(root, 'apps/mobile'), { recursive: true });
    writeFileSync(join(root, 'apps/backend/write-coverage.mjs'), `
      import { mkdirSync, writeFileSync } from 'node:fs';
      mkdirSync('coverage', { recursive: true });
      writeFileSync('coverage/coverage-summary.json', JSON.stringify({ total: { lines: { total: 100, covered: 80 } } }));
    `, 'utf8');
    writeFileSync(join(root, 'apps/mobile/write-coverage.mjs'), `
      import { mkdirSync, writeFileSync } from 'node:fs';
      mkdirSync('coverage', { recursive: true });
      writeFileSync('coverage/coverage-summary.json', JSON.stringify({ total: { lines: { total: 900, covered: 90 } } }));
    `, 'utf8');

    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      coverage: {
        mode: 'warn',
        targets: [
          { id: 'backend', cwd: 'apps/backend', command: 'node write-coverage.mjs', summary: 'coverage/coverage-summary.json' },
          { id: 'mobile', cwd: 'apps/mobile', command: 'node write-coverage.mjs', summary: 'coverage/coverage-summary.json' },
        ],
      },
    }));

    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.stacks.length, 2);
    assert.equal(summary.stacks.find((s) => s.stack === 'backend').pct, 0.8);
    assert.equal(summary.stacks.find((s) => s.stack === 'mobile').pct, 0.1);
    // weighted: (80 + 90) / (100 + 900) = 0.17 -- a naive average of the two percentages
    // would be (0.8 + 0.1) / 2 = 0.45, which this must NOT match.
    assert.equal(summary.aggregate.pct, 170 / 1000);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs fails closed when a target command fails, and separately when its declared report is missing', () => {
  const root = makeProject('coverage-targets-failure');
  try {
    mkdirSync(join(root, 'apps/backend'), { recursive: true });
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      coverage: {
        mode: 'enforce', min: 0,
        targets: [
          { id: 'crashes', cwd: 'apps/backend', command: 'node -e "process.exit(1)"', summary: 'coverage/coverage-summary.json' },
          { id: 'no-report', cwd: 'apps/backend', command: 'node -e "0"', summary: 'coverage/does-not-exist.json' },
        ],
      },
    }));

    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--check', '--json']);
    assert.notEqual(result.status, 0);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.stacks.find((s) => s.stack === 'crashes').status, 'error');
    assert.equal(summary.stacks.find((s) => s.stack === 'no-report').status, 'error');
    assert.equal(summary.passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs rejects a target path that escapes the repository root', () => {
  const root = makeProject('coverage-targets-traversal');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      coverage: {
        mode: 'warn',
        targets: [{ id: 'escape', cwd: '../../outside', command: 'node -e "0"', summary: 'coverage/coverage-summary.json' }],
      },
    }));

    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json']);
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.match(result.stderr, /escapes the repository root/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs --stack selects exactly one configured target, running and reporting only that one', () => {
  const root = makeProject('coverage-targets-select-one');
  try {
    mkdirSync(join(root, 'apps/backend'), { recursive: true });
    mkdirSync(join(root, 'apps/mobile'), { recursive: true });
    writeFileSync(join(root, 'apps/backend/write-coverage.mjs'), `
      import { mkdirSync, writeFileSync } from 'node:fs';
      mkdirSync('coverage', { recursive: true });
      writeFileSync('coverage/coverage-summary.json', JSON.stringify({ total: { lines: { total: 10, covered: 10 } } }));
    `, 'utf8');
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      coverage: {
        mode: 'warn',
        targets: [
          { id: 'backend', cwd: 'apps/backend', command: 'node write-coverage.mjs', summary: 'coverage/coverage-summary.json' },
          { id: 'mobile', cwd: 'apps/mobile', command: 'node -e "process.exit(1)"', summary: 'coverage/coverage-summary.json' },
        ],
      },
    }));

    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json', '--stack', 'backend']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.stacks.length, 1);
    assert.equal(summary.stacks[0].stack, 'backend');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs preserves single-root auto-detection when coverage.targets is absent', () => {
  const root = makeProject('coverage-targets-absent-backward-compat');
  try {
    writeJson(join(root, 'package.json'), { name: 'fixture', devDependencies: { vitest: '^2.0.0' } });
    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, 'needs_setup');
    assert.equal(summary.stacks[0].stack, 'node-vitest');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Add `mkdirSync` to the existing `node:fs` import at the top of `tests/throughline.test.mjs` if not already present (it already is — `mkdirSync` is imported at line 3).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `coverage.mjs` has no concept of `coverage.targets` today; `ALL_STACKS` only ever comes from `customStack(coverageConfig.command)` or the five auto-detect functions, so these backlog configs produce zero stacks (`status: 'skipped'`) instead of running the targets.

- [ ] **Step 3: Implement `coverage.targets`**

In `skills/bootstrap-project/assets/scripts/coverage.mjs`, change the import line (line 12):

```js
import { dirname, join } from 'node:path';
```
to:
```js
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
```

Then, immediately before the line `const ALL_STACKS = coverageConfig?.command` (line 218), insert:

```js
// ---- explicit monorepo targets (coverage.targets) -- take priority over auto-detection ----
function resolveWithinRoot(relPath, label) {
  const abs = resolve(root, relPath);
  const rel = relative(root, abs);
  if (rel !== '' && (rel.startsWith('..') || isAbsolute(rel))) {
    console.error(label + ' escapes the repository root: ' + relPath);
    process.exit(2);
  }
  return { abs, rel: rel === '' ? '.' : rel };
}

function targetStack(t) {
  if (!t || typeof t.id !== 'string' || !t.id.trim() || typeof t.cwd !== 'string' || !t.cwd.trim()
    || typeof t.command !== 'string' || !t.command.trim() || typeof t.summary !== 'string' || !t.summary.trim()) {
    console.error('Malformed coverage.targets entry: ' + JSON.stringify(t) + ' (run node scripts/validate.mjs for details).');
    process.exit(2);
  }
  const cwd = resolveWithinRoot(t.cwd, 'coverage target "' + t.id + '" cwd');
  const summary = resolveWithinRoot(t.summary, 'coverage target "' + t.id + '" summary');
  const lcov = t.lcov ? resolveWithinRoot(t.lcov, 'coverage target "' + t.id + '" lcov') : null;
  return {
    id: t.id, tool: t.command, needsPkg: null,
    resolvable: () => existsSync(cwd.abs),
    run: () => sh(process.platform === 'win32' ? 'cmd' : 'sh', process.platform === 'win32' ? ['/c', t.command] : ['-c', t.command], { cwd: cwd.abs }),
    report: () => readIstanbulSummary(summary.rel),
    reportFormat: 'lcov', reportPath: lcov ? lcov.rel : summary.rel,
  };
}
const explicitTargets = Array.isArray(coverageConfig?.targets) ? coverageConfig.targets : null;

```

Then replace the existing `ALL_STACKS` assignment (line 218-220):

```js
const ALL_STACKS = coverageConfig?.command
  ? [customStack(coverageConfig.command)]
  : [nodeStack, pythonStack, goStack, javaStack, rustStack].map((f) => f()).filter(Boolean);
```
with:
```js
const ALL_STACKS = explicitTargets && explicitTargets.length
  ? explicitTargets.map(targetStack)
  : coverageConfig?.command
  ? [customStack(coverageConfig.command)]
  : [nodeStack, pythonStack, goStack, javaStack, rustStack].map((f) => f()).filter(Boolean);
```

The rest of the pipeline (the `stacks` filter, the run/report loop, the weighted `coveredSum/totalSum` aggregate, and `writeJson(summaryPath, summary)`) already treats every entry in `ALL_STACKS` generically by `id`/`resolvable`/`run`/`report`/`reportFormat`/`reportPath` — no further changes are needed for "run every configured target," "record every target in summary.json," or "fail when a target command fails or its report is missing." The `--stack`-selects-one-target behavior and the unknown-`--stack` exit-2 guard added in Task 2 also apply unchanged, since target ids flow into `ALL_STACKS` the same way auto-detected stack ids do.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. Also re-run `'coverage.mjs runs the real run/parse/aggregate/--story chain end to end via a coverage.command override'` to confirm the `coverage.command` (non-monorepo) path is untouched (`explicitTargets` is `null` when `coverage.targets` is absent, so the ternary falls through exactly as before).

- [ ] **Step 5: Commit**

```bash
git add skills/bootstrap-project/assets/scripts/coverage.mjs tests/throughline.test.mjs
git commit -m "coverage.mjs: support explicit coverage.targets for monorepo workspaces"
```

---

### Task 4: CI workflow becomes seed-only and lockfile-aware

**Files:**
- Create: `skills/bootstrap-project/assets/scripts/lib/render-workflow.mjs`
- Modify: `skills/bootstrap-project/assets/scripts/sync-plugin.mjs`
- Delete: `skills/bootstrap-project/assets/.github/workflows/throughline.yml`
- Modify: `skills/bootstrap-project/SKILL.md`, `skills/adopt-project/SKILL.md`, `skills/upgrade-project/SKILL.md`
- Test: `tests/throughline.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add after the existing test `'sync-plugin.mjs never overwrites a locally-edited scaffold file without --force, and withholds the version stamp while it is unresolved'`:

```js
test('sync-plugin.mjs seeds .github/workflows/throughline.yml rendered for the detected lockfile, then never overwrites a customized copy but still reports that it differs from the current render', () => {
  const root = makeProject('sync-ci-seed-only');
  try {
    // The real bootstrap-project skill no longer wholesale-copies .github/ -- this file is
    // seeded exclusively by sync-plugin.mjs --apply. Simulate that starting state.
    rmSync(join(root, '.github/workflows/throughline.yml'), { force: true });
    writeJson(join(root, 'package-lock.json'), { name: 'fixture' });

    const seeded = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const rendered = readFileSync(join(root, '.github/workflows/throughline.yml'), 'utf8');
    assert.match(rendered, /npm ci/);
    assert.match(rendered, /permissions:\n\s*contents: read/);
    assert.doesNotMatch(rendered, /\|\| true/);
    assert.match(seeded.stdout, /seeded: \.github\/workflows\/throughline\.yml/);

    // Re-syncing with no changes at all: the seed file is untouched and reported up to date,
    // never diffed into pendingReview like a managed file would be.
    const unchangedResync = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(unchangedResync.status, 0, unchangedResync.stderr || unchangedResync.stdout);
    assert.doesNotMatch(unchangedResync.stdout, /needs review/);
    assert.match(unchangedResync.stdout, /seed-only, up to date: \.github\/workflows\/throughline\.yml/);

    writeFileSync(join(root, '.github/workflows/throughline.yml'), rendered + '\n# project-specific: also run e2e\n', 'utf8');
    const resynced = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(resynced.status, 0, resynced.stderr || resynced.stdout);
    assert.doesNotMatch(resynced.stdout, /needs review/);
    assert.match(resynced.stdout, /differs from current render/, 'a customized/stale seed file must still be surfaced, just never auto-touched');
    assert.match(readFileSync(join(root, '.github/workflows/throughline.yml'), 'utf8'), /project-specific: also run e2e/, 'content must never be overwritten');

    const version = JSON.parse(readFileSync(join(root, '.throughline/plugin-version.json'), 'utf8'));
    assert.ok(!version.pendingReview.includes('.github/workflows/throughline.yml'), 'a customized CI workflow must never enter pendingReview');
    const pluginPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    assert.equal(version.version, pluginPkg.version, 'a project-owned CI file must never block the version stamp');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs renders pnpm install steps when pnpm-lock.yaml is present, and defers seeding entirely when there is no package.json at all', () => {
  const root = makeProject('sync-ci-lockfile-variants');
  try {
    rmSync(join(root, '.github/workflows/throughline.yml'), { force: true });
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0\n', 'utf8'); // presence is what matters, content is irrelevant

    const pnpmRun = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(pnpmRun.status, 0, pnpmRun.stderr || pnpmRun.stdout);
    const pnpmYaml = readFileSync(join(root, '.github/workflows/throughline.yml'), 'utf8');
    assert.match(pnpmYaml, /pnpm\/action-setup/);
    assert.match(pnpmYaml, /pnpm install --frozen-lockfile/);

    rmSync(join(root, 'pnpm-lock.yaml'));
    rmSync(join(root, '.github/workflows/throughline.yml'));
    const noLockfileRun = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(noLockfileRun.status, 0, noLockfileRun.stderr || noLockfileRun.stdout);
    assert.equal(existsSync(join(root, '.github/workflows/throughline.yml')), false, 'with no package.json at all, seed it later rather than render a workflow with no install step at all');
    assert.match(noLockfileRun.stdout, /deferred.*\.github\/workflows\/throughline\.yml/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs emits an explicit failing install step when package.json exists but no lockfile is committed', () => {
  const root = makeProject('sync-ci-package-json-no-lockfile');
  try {
    rmSync(join(root, '.github/workflows/throughline.yml'), { force: true });
    writeJson(join(root, 'package.json'), { name: 'fixture' });

    const result = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const yaml = readFileSync(join(root, '.github/workflows/throughline.yml'), 'utf8');
    assert.doesNotMatch(yaml, /\|\| true/);
    assert.match(yaml, /No supported lockfile/);
    assert.match(yaml, /exit 1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs --force on the seed-only CI workflow is a no-op with an explicit notice, never a silent skip or an overwrite', () => {
  const root = makeProject('sync-ci-force-noop');
  try {
    rmSync(join(root, '.github/workflows/throughline.yml'), { force: true });
    writeJson(join(root, 'package-lock.json'), { name: 'fixture' });
    const seeded = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);

    writeFileSync(join(root, '.github/workflows/throughline.yml'), '# hand-customized, deliberately not matching the render\n', 'utf8');
    const forced = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--force=.github/workflows/throughline.yml']);
    assert.equal(forced.status, 0, forced.stderr || forced.stdout);
    assert.match(forced.stdout, /ignored: \.github\/workflows\/throughline\.yml is seed-only/);
    assert.match(readFileSync(join(root, '.github/workflows/throughline.yml'), 'utf8'), /hand-customized/, '--force must never touch a seed-only file');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `sync-plugin.mjs` currently syncs `.github/workflows/throughline.yml` as a plain managed file (byte-copy from the plugin asset, diffed like every other file), so the fixture's `rmSync` before each run leaves it missing until a plain copy re-adds the static asset content (still containing `npm ci --ignore-scripts || true`, no lockfile awareness, no `permissions:` block, and never "deferred" for a project with no `package.json`).

- [ ] **Step 3: Create the shared render-workflow lib**

Create `skills/bootstrap-project/assets/scripts/lib/render-workflow.mjs`:

```js
#!/usr/bin/env node
// Renders .github/workflows/throughline.yml for a target repo, chosen by which lockfile it
// has committed. Shared by sync-plugin.mjs so every path that can place this file (fresh
// bootstrap, adopt-project, upgrade-project) agrees on its content instead of each
// re-implementing the choice.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const HEAD = `name: Throughline

on:
  pull_request:
  push:
    branches: [main, master]

permissions:
  contents: read

jobs:
  validate-contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node scripts/validate.mjs
      - run: node scripts/check-docs.mjs
      - run: node scripts/build-dashboard.mjs --out /tmp/PROGRESS_DASHBOARD.html

  # Add a matching setup step (setup-python / setup-go / setup-java / dtolnay/rust-toolchain)
  # if this repo isn't Node -- coverage.mjs itself is a Node script, so setup-node always runs
  # regardless of the product's own stack.
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
`;

const INSTALL_STEPS = {
  pnpm: `      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
`,
  npm: `      - run: npm ci
`,
  yarn: `      - run: corepack enable
      - run: yarn install --immutable
`,
  'package-json-no-lockfile': `      - run: |
          echo "::error::No supported lockfile (pnpm-lock.yaml, package-lock.json, or yarn.lock) found at the repository root. Commit one before coverage can run reproducibly in CI."
          exit 1
`,
  'no-node': '',
};

const TAIL = `      - run: node scripts/coverage.mjs --json > /tmp/coverage-summary.json
      - name: Evaluate coverage result
        run: |
          node -e "
            const s = JSON.parse(require('fs').readFileSync('/tmp/coverage-summary.json', 'utf8'));
            console.log('coverage status:', s.status, s.aggregate?.pct != null ? (s.aggregate.pct * 100).toFixed(1) + '%' : '');
            if (s.status === 'needs_setup' || s.status === 'skipped') {
              console.log('::warning::coverage.mjs status=' + s.status + ' -- see job output above for the recommended setup command.');
              process.exit(0);
            }
            process.exit(s.passed ? 0 : 1);
          "
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: |
            coverage/lcov.info
            coverage.xml
            .throughline/coverage/**
          if-no-files-found: ignore
`;

// 'none' here means "package.json exists but no lockfile is committed" -- a real hygiene gap,
// not "this isn't a Node project". A repo with no package.json at all (Python/Go/Java/Rust)
// gets no install step at all: coverage.mjs is dependency-free and reports 'skipped' on its
// own when no stack is detected, so forcing a Node install failure there would be a false
// positive, not a truthful one.
export function detectLockfile(root) {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'package-lock.json'))) return 'npm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  return existsSync(join(root, 'package.json')) ? 'package-json-no-lockfile' : 'no-node';
}

export function renderWorkflow(root) {
  return HEAD + INSTALL_STEPS[detectLockfile(root)] + TAIL;
}
```

- [ ] **Step 4: Wire the lib into `sync-plugin.mjs` as a seed-only file**

In `skills/bootstrap-project/assets/scripts/sync-plugin.mjs`:

Add the import after the existing imports (after line 28, `import { homedir } from 'node:os';`):
```js
import { detectLockfile, renderWorkflow } from './lib/render-workflow.mjs';
```

Remove `.github/workflows/throughline.yml` from the `FILES` array (delete the line `'.github/workflows/throughline.yml',` at line 159), and add the new lib file to `FILES` so it stays a normally-managed, synced file on upgrade (insert it alongside the other `scripts/` entries, e.g. right after `'scripts/sync-plugin.mjs',` at line 154):
```js
  'scripts/sync-plugin.mjs',
  'scripts/lib/render-workflow.mjs',
```

Add the seed-only handling. Insert this block right after the main `for (const rel of FILES) { ... }` loop (after line 186, before the `// AGENTS.md is rendered` comment):

```js
// Seed-only files: repository-specific (a generated CI workflow needs the project's own
// package manager and toolchain choices). Rendered fresh on every run rather than byte-copied,
// but only ever WRITTEN when missing -- once present, this loop only reads it back to report
// whether it still matches the current render, never to overwrite or flag it. That's what makes
// "keep the bundled CI workflow unless the repo has a stronger equivalent" (bootstrap-project's
// own advice) actually safe to follow without hand-tracking which files are exempt from sync.
// If there's no package.json at all yet, don't seed a workflow with no install step baked in
// forever -- defer until a lockfile exists, so a later --apply is what actually creates it.
const SEED_ONLY_FILES = [
  { rel: '.github/workflows/throughline.yml', render: renderWorkflow, canRender: (r) => detectLockfile(r) !== 'no-node' },
];
const seedOnly = { seeded: [], upToDate: [], differs: [], deferred: [] };
for (const item of SEED_ONLY_FILES) {
  const dest = join(root, item.rel);
  const existing = readSafe(dest);
  if (existing != null) {
    if (item.canRender(root) && existing === item.render(root)) seedOnly.upToDate.push(item.rel);
    else seedOnly.differs.push(item.rel);
    continue;
  }
  if (!item.canRender(root)) { seedOnly.deferred.push(item.rel); continue; }
  if (apply) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, item.render(root), 'utf8'); }
  seedOnly.seeded.push(item.rel);
}
// --force must never silently no-op on a seed-only file -- say so, instead of leaving a human
// staring at an unchanged file wondering whether their --force did anything.
for (const item of SEED_ONLY_FILES) {
  if (shouldForce(item.rel)) console.log('ignored: ' + item.rel + ' is seed-only and is never overwritten by --force.');
}
```

Then extend the final console output block. Replace:
```js
if (!apply) console.log('\nreport only: no files were written. Rerun with --apply to add missing files, or --force=<path,...> once you\'ve reviewed a flagged file.');
else if (results.flagged.length) console.log('\napplied. ' + results.flagged.length + ' file(s) above are still unresolved -- the version stamp will not claim this project is fully current until they are.');
```
with:
```js
if (seedOnly.upToDate.length) console.log('seed-only, up to date: ' + seedOnly.upToDate.join(', '));
if (seedOnly.differs.length) console.log('seed-only, differs from current render (never auto-updated -- review by hand if you want the latest): ' + seedOnly.differs.join(', '));
if (seedOnly.seeded.length) console.log((apply ? 'seeded: ' : 'would seed: ') + seedOnly.seeded.join(', ') + ' (rendered from the detected lockfile)');
if (seedOnly.deferred.length) console.log('deferred (no package manager detected yet, seed-only): ' + seedOnly.deferred.join(', ') + ' -- rerun `node scripts/sync-plugin.mjs --apply` once a lockfile is committed.');

if (!apply) console.log('\nreport only: no files were written. Rerun with --apply to add missing files, or --force=<path,...> once you\'ve reviewed a flagged file.');
else if (results.flagged.length) console.log('\napplied. ' + results.flagged.length + ' file(s) above are still unresolved -- the version stamp will not claim this project is fully current until they are.');
```

`SEED_ONLY_FILES` entries never enter `results.flagged`/`results.added`/`results.updated`/`results.unchanged` (they were removed from `FILES` and handled by a separate loop), so `pendingReview` (built from `results.flagged` in the existing `--apply` block) can never include `.github/workflows/throughline.yml` — satisfying "do not add an existing modified workflow to pendingReview" by construction, not by a special-case exclusion that could be forgotten later. The `differs`/`upToDate` split is read-only reporting (`item.render(root)` is called to compare, never to write over an existing file), which is what surfaces a stale pre-0.3.2 CI workflow to the human without ever touching it.

- [ ] **Step 5: Delete the static asset workflow file**

`skills/bootstrap-project/assets/.github/workflows/throughline.yml` is no longer read by anything: it was removed from `FILES` in Step 4, and `scripts/lib/render-workflow.mjs` is now the sole source of this file's content. A static copy left behind would only ever go stale. Delete it — this also empties (and so removes) `skills/bootstrap-project/assets/.github/workflows/` and `skills/bootstrap-project/assets/.github/`, since git does not track empty directories:

```bash
git rm skills/bootstrap-project/assets/.github/workflows/throughline.yml
```

- [ ] **Step 6: Update `SKILL.md` prose to match the new ownership model**

In `skills/bootstrap-project/SKILL.md`, change step 2 (line 16) from:
```markdown
2. Copy everything from this skill's `assets/` into the project root (templates → `docs/_templates/`, `scripts/`, `.githooks/`, `.github/`, `docs/engineering/{backlog.schema.json,backlog.seed.json,workflow.md}`).
```
to:
```markdown
2. Copy everything from this skill's `assets/` into the project root (templates → `docs/_templates/`, `scripts/`, `.githooks/`, `docs/engineering/{backlog.schema.json,backlog.seed.json,workflow.md}`). Do not copy `.github/` -- step 8's `sync-plugin.mjs --apply` seeds `.github/workflows/throughline.yml` itself, rendered for whichever package manager this project's lockfile indicates.
```

Change step 8 (line 22) from:
```markdown
8. Run `node scripts/sync-plugin.mjs --apply` once — on a fresh scaffold this is a no-op against files you just copied, but it stamps `.throughline/plugin-version.json` with the plugin version, which is what `upgrade-project` later reads to tell whether this project is behind the plugin's current release.
```
to:
```markdown
8. Run `node scripts/sync-plugin.mjs --apply` once — on a fresh scaffold this is a no-op against files you just copied *except* `.github/workflows/throughline.yml`, which this step seeds for the first time (rendered from the detected lockfile, since step 2 deliberately didn't copy it). It also stamps `.throughline/plugin-version.json` with the plugin version, which is what `upgrade-project` later reads to tell whether this project is behind the plugin's current release.
```

In `skills/adopt-project/SKILL.md`, step 4, change:
```markdown
The pre-commit hook and CI workflow were already added in step 1 by `sync-plugin.mjs`; keep the bundled CI workflow unless the repo already has a stronger equivalent — the same rule `bootstrap-project` uses, not a separate one.
```
to:
```markdown
The pre-commit hook and CI workflow were already added in step 1 by `sync-plugin.mjs` (the workflow is generated from this repo's actual lockfile, not copied verbatim); keep it unless the repo already has a stronger equivalent — the same rule `bootstrap-project` uses, not a separate one.
```

In `skills/upgrade-project/SKILL.md`, step 4, replace the sentence describing manual vigilance around `--force` and the CI workflow:
```markdown
   - **needs review** — exists in both places but differs. This could be normal version drift, or it could be a hand-customization to a script/hook/CI file the project's owner made deliberately. The script cannot tell which — never assume.
```
(keep this line as-is; it's still accurate for genuinely managed files) and replace the following sentence:
```markdown
4. **Resolve the flagged files with the human.** For each file in **needs review**, show the human what differs (open both, or summarize the delta) and ask: keep the project's version, or accept the plugin's. Only after an explicit per-file yes, run `node scripts/sync-plugin.mjs --force=<path1>,<path2>` naming only the files just approved — `--force` (bare, no `=`) overwrites every flagged file and should only be used if every single one has actually been reviewed, not as a shortcut. This matters concretely for `.github/workflows/throughline.yml`: `bootstrap-project` itself told the human to keep the bundled CI workflow *unless the repo already has a stronger equivalent* — a project that took that advice will show this file as flagged, and it must never be swept up by a blanket `--force` alongside files the human actually meant to accept.
```
with:
```markdown
4. **Resolve the flagged files with the human.** For each file in **needs review**, show the human what differs (open both, or summarize the delta) and ask: keep the project's version, or accept the plugin's. Only after an explicit per-file yes, run `node scripts/sync-plugin.mjs --force=<path1>,<path2>` naming only the files just approved — `--force` (bare, no `=`) overwrites every flagged file and should only be used if every single one has actually been reviewed, not as a shortcut. `.github/workflows/throughline.yml` is seed-only, not managed, as of 0.3.2: it never appears in **needs review** and `--force` never touches it, so there's nothing to resolve for it here — the report prints it separately (seeded / up to date / differs from current render / deferred) once it exists.

   **Self-bootstrapping note for this specific upgrade (pre-0.3.2 → 0.3.2):** `scripts/sync-plugin.mjs` is itself one of the files above, so until the human accepts the new copy and this step is re-run, everything above still runs under the *old* script's rules — including still treating `.github/workflows/throughline.yml` as a plain managed file that can show up in **needs review**. Accept `scripts/sync-plugin.mjs` first (`--force=scripts/sync-plugin.mjs`; `scripts/lib/render-workflow.mjs` is new, so it lands normally as **added** in step 3, no force needed), then re-run `node scripts/sync-plugin.mjs --apply`. That second run, now executing the new script, is what actually reclassifies the CI workflow as seed-only and stops flagging it.
```

Also add a note to step 7 (the `validate.mjs` paragraph) about the new `release_in_flight` requirement. Change:
```markdown
7. **Validate.** Run `node scripts/validate.mjs` against the existing `backlog.json` — this is the real safety check that whatever new schema/script logic just landed is still compatible with the project's actual data, and it also fails loud if any working state is still misplaced. A failure (exit 1) means stop and fix before going further; never patch over it by hand-editing the contract. A `WARN`-only run (exit 0) is a different, complete outcome, not a failure: it means this project's first-ever sync found pre-existing stories that predate a requirement added since (`prd_ref`, `acceptance`, or done-story verify evidence) and `.throughline/plugin-version.json` was stamped with `legacyContractGrace: true` to reflect that honestly. Backfill those warnings over time through the normal workflow (define-backlog, ship-epic) — never by hand-writing placeholder values into `backlog.json` just to silence them, and never by hand-editing the grace flag itself except to turn it off once the backlog is actually clean.
```
to:
```markdown
7. **Validate.** Run `node scripts/validate.mjs` against the existing `backlog.json` — this is the real safety check that whatever new schema/script logic just landed is still compatible with the project's actual data, and it also fails loud if any working state is still misplaced. A failure (exit 1) means stop and fix before going further; never patch over it by hand-editing the contract. A `WARN`-only run (exit 0) is a different, complete outcome, not a failure: it means this project's first-ever sync found pre-existing stories that predate a requirement added since (`prd_ref`, `acceptance`, or done-story verify evidence) and `.throughline/plugin-version.json` was stamped with `legacyContractGrace: true` to reflect that honestly. Backfill those warnings over time through the normal workflow (define-backlog, ship-epic) — never by hand-writing placeholder values into `backlog.json` just to silence them, and never by hand-editing the grace flag itself except to turn it off once the backlog is actually clean. As of 0.3.2, one new *hard* failure (never graced, and enforced by the pre-commit hook too) is expected here if this project uses `epics[].release`: `release_in_flight` is now required once any epic declares one. The fix is one line — set `release_in_flight` in `backlog.json` to whichever release is actually in flight.
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. Also re-run the pre-existing `sync-plugin.mjs` tests (`'...reports a fresh scaffold as fully unchanged...'`, `'...--apply adds a missing scaffold file...'`, the three `legacyContractGrace` tests, `'...never overwrites a locally-edited scaffold file...'`) to confirm the removal of `.github/workflows/throughline.yml` from `FILES` and the addition of `scripts/lib/render-workflow.mjs` to it don't change their outcomes — none of them assert on the workflow file, and the new lib file syncs as a normal file (present identically in both the fixture's copy and the plugin's own copy immediately after this task, so it reports `unchanged`).

- [ ] **Step 8: Commit**

The deletion from Step 5 is already staged via `git rm`; add everything else and commit together:

```bash
git add skills/bootstrap-project/assets/scripts/lib/render-workflow.mjs skills/bootstrap-project/assets/scripts/sync-plugin.mjs skills/bootstrap-project/SKILL.md skills/adopt-project/SKILL.md skills/upgrade-project/SKILL.md tests/throughline.test.mjs
git commit -m "sync-plugin.mjs: render the CI workflow from the detected lockfile and treat it as seed-only, project-owned scaffold"
```

---

### Task 5: `release_in_flight` — no invented `v1`

**Files:**
- Modify: `skills/bootstrap-project/assets/scripts/validate.mjs:56`
- Modify: `skills/bootstrap-project/assets/scripts/build-dashboard.mjs:106-120,336-344`
- Test: `tests/throughline.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add after the existing test `'validate.mjs checks release_in_flight against epics[].release'`:

```js
test('validate.mjs requires release_in_flight once any epic declares an explicit release', () => {
  const root = makeProject('release-in-flight-required');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      epics: [{ id: 'E-1', title: 'Foundation', order: 0, release: 'v2', prd_ref: 'REQ-01' }],
    }));

    const result = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /epics declare explicit release value\(s\) \(v2\) but release_in_flight is not set/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Add after the existing test `'build-dashboard.mjs renders the needs_setup nudge and a passing coverage summary without throwing'`:

```js
test('build-dashboard.mjs never invents a lowercase v1 when release_in_flight is missing but epics declare explicit releases', () => {
  const root = makeProject('dashboard-no-invented-v1');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      epics: [{ id: 'E-1', title: 'V2 work', order: 0, release: 'v2', prd_ref: 'REQ-01' }],
      stories: [{ id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'It renders.', blocked_by: [], status: 'notstarted', order: 0 }],
      // release_in_flight deliberately omitted -- simulates a backlog.json that predates this
      // validate.mjs check, or was hand-edited without re-running validate.mjs.
    }));

    const result = runNode(root, join(root, 'scripts/build-dashboard.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(root, 'PROGRESS_DASHBOARD.html'), 'utf8');
    assert.match(html, /Epics &middot; v2/, 'must select the actual declared release, not an invented v1');
    assert.doesNotMatch(html, /Epics &middot; v1/);
    assert.match(html, /Config warning/);
    assert.match(html, /release_in_flight is not set/);
    assert.match(html, /1 of 1 stories done|0 of 1 stories done/, 'the 1/1-scoped-to-v2 story must be counted, not a false 0/0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build-dashboard.mjs keeps implicit v1 when no epic declares an explicit release and release_in_flight is absent', () => {
  const root = makeProject('dashboard-implicit-v1-unchanged');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());

    const result = runNode(root, join(root, 'scripts/build-dashboard.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(root, 'PROGRESS_DASHBOARD.html'), 'utf8');
    assert.match(html, /Epics &middot; v1/);
    assert.doesNotMatch(html, /Config warning/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `validate.mjs`'s existing `release_in_flight` check only fires when `release_in_flight` is present and mismatched, not when it's absent while epics declare explicit releases; `build-dashboard.mjs:111` unconditionally falls back to `'v1'`, so the dashboard test's `E-1` (release `v2`, 1 story) never shows up under "Epics · v1" and the config-warning banner doesn't exist yet.

- [ ] **Step 3: Fix `validate.mjs`**

Replace line 56:
```js
if (data.release_in_flight && (data.epics || []).length && !(data.epics || []).some((e) => e.release === data.release_in_flight)) err('release_in_flight ' + JSON.stringify(data.release_in_flight) + ' does not match any epics[].release');
```
with:
```js
const epicReleases = [...new Set((data.epics || []).filter((e) => e.release != null).map((e) => e.release))];
if (data.release_in_flight) {
  if (epicReleases.length && !epicReleases.includes(data.release_in_flight)) err('release_in_flight ' + JSON.stringify(data.release_in_flight) + ' does not match any epics[].release');
} else if (epicReleases.length) {
  err('epics declare explicit release value(s) (' + epicReleases.join(', ') + ') but release_in_flight is not set — set it to one of them so the dashboard and gates know which release is current.');
}
```

- [ ] **Step 4: Fix `build-dashboard.mjs`**

Replace lines 106-120:
```js
// ---- release classification ----
// Epics with no release tag belong implicitly to the first release (define-backlog's own
// convention — v1 epics are typically untagged; only v2+ epics get an explicit tag).
// release_in_flight is the one field naming which release is currently being worked
// (advanced by define-backlog, never define-product — see its own reconcile rules).
const currentRelease = data.release_in_flight || 'v1';
const epicRelease = (e) => e.release || 'v1';
const releaseOrder = [];
for (const e of epics) { const r = epicRelease(e); if (!releaseOrder.includes(r)) releaseOrder.push(r); }
function releaseEpics(rel) { return epics.filter((e) => epicRelease(e) === rel); }
function releaseStoryList(rel) { const ids = new Set(releaseEpics(rel).map((e) => e.id)); return stories.filter((s) => ids.has(s.epic)); }
const currentEpics = releaseEpics(currentRelease);
const currentEpicIds = new Set(currentEpics.map((e) => e.id));
const currentStories = stories.filter((s) => currentEpicIds.has(s.epic));
const otherReleases = releaseOrder.filter((r) => r !== currentRelease);
```
with:
```js
// ---- release classification ----
// Epics with no release tag belong implicitly to the first release (define-backlog's own
// convention — v1 epics are typically untagged; only v2+ epics get an explicit tag).
// release_in_flight is the one field naming which release is currently being worked
// (advanced by define-backlog, never define-product — see its own reconcile rules).
const epicRelease = (e) => e.release || 'v1';
const hasExplicitEpicRelease = epics.some((e) => e.release != null);
const releaseOrder = [];
for (const e of epics) { const r = epicRelease(e); if (!releaseOrder.includes(r)) releaseOrder.push(r); }
function releaseEpics(rel) { return epics.filter((e) => epicRelease(e) === rel); }
function releaseStoryList(rel) { const ids = new Set(releaseEpics(rel).map((e) => e.id)); return stories.filter((s) => ids.has(s.epic)); }
// validate.mjs requires release_in_flight once any epic declares an explicit release, so this
// fallback only fires against a backlog.json that was never validated, or predates this check.
// It must pick a real declared release and say so -- never invent a lowercase 'v1' that could
// report a false 0/0 "on track" for a release that has no epics at all.
let currentRelease = data.release_in_flight;
let releaseConfigWarning = null;
if (!currentRelease) {
  if (hasExplicitEpicRelease) {
    currentRelease = releaseOrder.find((r) => rollup(releaseStoryList(r)).status !== 'done') || releaseOrder[0];
    releaseConfigWarning = 'release_in_flight is not set, but epics declare explicit release(s) (' + releaseOrder.join(', ') + '). Showing "' + currentRelease + '" — set release_in_flight in backlog.json to make this authoritative.';
  } else {
    currentRelease = 'v1';
  }
}
const currentEpics = releaseEpics(currentRelease);
const currentEpicIds = new Set(currentEpics.map((e) => e.id));
const currentStories = stories.filter((s) => currentEpicIds.has(s.epic));
const otherReleases = releaseOrder.filter((r) => r !== currentRelease);
```

Then add a rendering function near `gateSection()` (after line 78, which closes `gateSection`):
```js
function releaseWarningSection() {
  if (!releaseConfigWarning) return '';
  return '<div class="covrow" style="background:#fdecec"><span class="covlabel" style="color:#e5484d">Config warning</span><span>' + esc(releaseConfigWarning) + '</span></div>';
}
```

And insert it into the HTML template. Replace:
```js
${coverageSection()}
<h2>Work board &middot; ${esc(currentRelease)}</h2>
```
with:
```js
${releaseWarningSection()}
${coverageSection()}
<h2>Work board &middot; ${esc(currentRelease)}</h2>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. Also re-run `'validate.mjs checks release_in_flight against epics[].release'` and `'bootstrap seeds release_in_flight and validate.mjs accepts it before any epics exist'` to confirm no regression — the first still errors on a genuine mismatch (unchanged branch), and the second has `release_in_flight` set with zero epics, so `epicReleases.length` is `0` and the new `else if` branch never fires.

- [ ] **Step 6: Commit**

```bash
git add skills/bootstrap-project/assets/scripts/validate.mjs skills/bootstrap-project/assets/scripts/build-dashboard.mjs tests/throughline.test.mjs
git commit -m "validate.mjs, build-dashboard.mjs: require release_in_flight once epics declare explicit releases; never invent v1"
```

---

### Task 6: `ensure-branch.mjs` rejects `--name=main`/`--name=master`

**Files:**
- Modify: `skills/bootstrap-project/assets/scripts/ensure-branch.mjs:67-71`
- Test: `tests/throughline.test.mjs`

- [ ] **Step 1: Write the failing test**

Add after the existing test `'ensure-branch.mjs --name always lands on that exact branch: create, switch, and no-op cases'`:

```js
test('ensure-branch.mjs rejects --name=main and --name=master without switching branches, from any starting state', () => {
  const root = makeProject('ensure-branch-protected-name');
  try {
    initGitWithCommit(root);
    assert.equal(spawnSync('git', ['checkout', '-qb', 'some/work'], { cwd: root, encoding: 'utf8' }).status, 0);

    const rejectMain = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--skill=implement-epic', '--name=main']);
    assert.notEqual(rejectMain.status, 0);
    assert.match(rejectMain.stderr, /protected branch/);
    assert.equal(currentBranch(root), 'some/work', '--name=main must never switch the working tree');

    const rejectMaster = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--skill=implement-epic', '--name=master']);
    assert.notEqual(rejectMaster.status, 0);
    assert.equal(currentBranch(root), 'some/work');

    // Already sitting directly on main and asked to "confirm" --name=main: still rejected,
    // never treated as a no-op affirmation of being on a protected branch.
    assert.equal(spawnSync('git', ['checkout', '-q', 'main'], { cwd: root, encoding: 'utf8' }).status, 0);
    const rejectFromMain = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--skill=implement-epic', '--name=main']);
    assert.notEqual(rejectFromMain.status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — today `--name=main` from `some/work` hits `current === explicitName` (`'some/work' === 'main'` → false), falls through to `switchTo('main', !branchExists('main'))`, and since `main` exists, runs `git checkout main` — the test's `currentBranch(root)` assertion fails because the tree really did move onto `main`.

- [ ] **Step 3: Implement the guard**

In `skills/bootstrap-project/assets/scripts/ensure-branch.mjs`, replace lines 67-71:
```js
if (explicitName) {
  if (current === explicitName) { console.log('On ' + explicitName + ' already -- OK.'); process.exit(0); }
  switchTo(explicitName, !branchExists(explicitName));
  process.exit(0);
}
```
with:
```js
if (explicitName) {
  // Checked before comparing against `current` so this rejects regardless of starting state --
  // a feature branch, already on main, or detached HEAD (current === '') all hit this the same
  // way, instead of only the "current !== explicitName" branch-switch path.
  if (PROTECTED.includes(explicitName)) {
    console.error('Refusing: --name=' + explicitName + ' names a protected branch. throughline never switches directly onto ' + PROTECTED.join('/') + '.');
    process.exit(1);
  }
  if (current === explicitName) { console.log('On ' + explicitName + ' already -- OK.'); process.exit(0); }
  switchTo(explicitName, !branchExists(explicitName));
  process.exit(0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS. Also re-run `'ensure-branch.mjs --name always lands on that exact branch: create, switch, and no-op cases'` to confirm non-protected `--name=` values (`epic/E-1-thing`) are unaffected.

- [ ] **Step 5: Commit**

```bash
git add skills/bootstrap-project/assets/scripts/ensure-branch.mjs tests/throughline.test.mjs
git commit -m "ensure-branch.mjs: reject --name=main and --name=master instead of switching onto them"
```

---

### Task 7: Version bump to 0.3.2

**Files:**
- Modify: `package.json:3`, `.claude-plugin/plugin.json:3`, `.claude-plugin/marketplace.json:8,15`, `.codex-plugin/plugin.json:3`, `README.md:11`

- [ ] **Step 1: Bump every version field**

```bash
node -e "
  const fs = require('fs');
  for (const p of ['package.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.version = '0.3.2';
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
  }
  const m = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf8'));
  m.metadata.version = '0.3.2';
  m.plugins[0].version = '0.3.2';
  fs.writeFileSync('.claude-plugin/marketplace.json', JSON.stringify(m, null, 2) + '\n', 'utf8');
"
```

Then edit `README.md:11` with the Edit tool:
- old_string: `` - Version: `0.3.1` ``
- new_string: `` - Version: `0.3.2` ``

- [ ] **Step 2: Verify**

Run: `grep -rn "0.3.1" package.json .claude-plugin .codex-plugin README.md`
Expected: no output (nothing left at the old version in those files).

- [ ] **Step 3: Commit**

```bash
git add package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json README.md
git commit -m "release: bump to 0.3.2"
```

---

### Task 8: Full verification

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all tests pass, including every test added in Tasks 1-6 and every pre-existing test (no regressions).

- [ ] **Step 2: Run coverage**

Run: `npm run test:coverage`
Expected: completes without error; review the report for any newly-added, entirely-uncovered branch in the modified scripts (in particular the new `lib/render-workflow.mjs` and the `targetStack`/`resolveWithinRoot` functions in `coverage.mjs` — Tasks 3 and 4's tests should already exercise all four `detectLockfile` branches and both the success and traversal-rejection paths, but confirm).

- [ ] **Step 3: Run doctor**

Run: `npm run doctor`
Expected: exits 0 — this cross-checks the plugin manifests (now all at `0.3.2`) and runs the scaffold fixture end-to-end, which will also catch any place a hardcoded `assets/.github/workflows/throughline.yml` reference was missed.

- [ ] **Step 4: Manual smoke check of the generated CI workflow**

Run:
```bash
node -e "
  const { renderWorkflow } = require('./skills/bootstrap-project/assets/scripts/lib/render-workflow.mjs');
" 2>&1 || node --input-type=module -e "
  import { renderWorkflow } from './skills/bootstrap-project/assets/scripts/lib/render-workflow.mjs';
  console.log(renderWorkflow('.'));
"
```
Expected: prints a workflow with `permissions:` / `contents: read`, no `|| true` anywhere, and an install step matching this repo's own `package-lock.json` (`npm ci`) — this repository is itself a valid smoke-test target since it has a real `package-lock.json` at its root.

- [ ] **Step 5: Final commit (if Steps 1-4 required any fixes)**

```bash
git add -A
git status
```
Review before committing — only commit here if Steps 1-4 surfaced something to fix; if everything already passed after Task 7's commit, there is nothing further to commit.

---

## Self-review checklist (already run once, plus one independent advisor pass; re-run after any deviation during execution)

The advisor review caught two real gaps in the first draft of Task 4 (greenfield bootstrap baking in an install-less CI job permanently; existing projects never learning their seeded workflow was stale) and one edge case (`--force` silently no-op'ing on a seed-only file). All three are incorporated above (the `canRender`/`deferred` path, the `upToDate`/`differs` read-only comparison, and the explicit `ignored:` notice) rather than left as known gaps. The advisor's two operational notes (self-bootstrapping lag; `release_in_flight` as a new hard failure) are documented in the review section and in Task 4/5's `SKILL.md` edits rather than coded around, since both are inherent to how `upgrade-project` already works and a code fix would be out of scope for this release.


- **Spec coverage:** §1 validate.mjs contract → Task 1. §2 fail-safe runtime → Task 2. §3 monorepo targets → Task 3. §4 CI seed-only + lockfile rendering → Task 4. §5 release selection → Task 5. §6 branch protection → Task 6. Regression test list → covered per-task above, plus two pre-existing tests (`sync-plugin.mjs never overwrites...`, `coverage.mjs runs the real run/parse/aggregate/--story chain...`) already double as the "managed-file differences still create pendingReview" and "existing single-package coverage... remain compatible" regressions respectively — re-run, not rewritten. Version bump → Task 7. `npm test` / `npm run test:coverage` / `npm run doctor` → Task 8.
- **Synchronizer alternative:** explicitly not implemented, per the spec's own "seed-only is the simpler recommendation" — noted in the review section above rather than built as an unused option.
- **Placeholder scan:** no task contains "add error handling" or "write tests for the above" without code; every code block is complete and copy-pasteable against the exact line numbers read from the current source.
- **Type/name consistency:** `renderWorkflow(root)` / `detectLockfile(root)` signatures match between Task 4's Step 3 (definition) and Steps 1/7 (test expectations) and Task 8 (smoke check). `targetStack`/`resolveWithinRoot` in Task 3 are used consistently within that task only (no cross-task references). `releaseConfigWarning` / `hasExplicitEpicRelease` in Task 5 are used consistently between the classification block and the new render function.
