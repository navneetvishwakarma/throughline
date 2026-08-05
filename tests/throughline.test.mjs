import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsRoot = join(repoRoot, 'skills/bootstrap-project/assets');

function runNode(cwd, script, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function makeProject(name) {
  const root = join(tmpdir(), `throughline-${name}-${process.pid}-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  cpSync(assetsRoot, root, { recursive: true });
  const init = runNode(root, join(root, 'scripts/init-project.mjs'), ['Fixture']);
  assert.equal(init.status, 0, init.stderr || init.stdout);
  return root;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function approvePrd(root) {
  const prdPath = join(root, 'docs/product/06-prd.md');
  const prd = readFileSync(prdPath, 'utf8').replace('status: draft', 'status: approved');
  writeFileSync(prdPath, prd, 'utf8');
}

function baseBacklog(overrides = {}) {
  return {
    schema: 2,
    project: 'Fixture',
    prd: 'docs/product/06-prd.md',
    tracker: 'local',
    epics: [
      { id: 'E-1', title: 'Foundation', order: 0, vertical: false, prd_ref: 'REQ-01' },
    ],
    stories: [
      {
        id: 'S-1',
        title: 'Create shell',
        epic: 'E-1',
        prd_ref: 'REQ-01',
        acceptance: 'The app shell renders.',
        blocked_by: [],
        status: 'notstarted',
        order: 0,
      },
    ],
    ...overrides,
  };
}

test('validate rejects story without requirement trace and acceptance', () => {
  const root = makeProject('missing-story-contract');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{ id: 'S-1', title: 'Vague work', epic: 'E-1', status: 'notstarted', order: 0 }],
    }));

    const result = runNode(root, join(root, 'scripts/validate.mjs'));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /prd_ref is required/);
    assert.match(result.stderr, /acceptance is required/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate rejects backlog stories before PRD approval', () => {
  const root = makeProject('prd-gate');
  try {
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());

    const result = runNode(root, join(root, 'scripts/validate.mjs'));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PRD must be approved before backlog contains stories/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate rejects cyclic story dependencies', () => {
  const root = makeProject('cycle');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [
        { id: 'S-1', title: 'A', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'A works.', blocked_by: ['S-2'], status: 'notstarted', order: 0 },
        { id: 'S-2', title: 'B', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'B works.', blocked_by: ['S-1'], status: 'notstarted', order: 1 },
      ],
    }));

    const result = runNode(root, join(root, 'scripts/validate.mjs'));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /dependency cycle/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-status rejects unimplemented tracker adapters', () => {
  const root = makeProject('unsupported-tracker');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ tracker: 'linear' }));

    const result = runNode(root, join(root, 'scripts/sync-status.mjs'));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unsupported tracker/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gate script persists approval state and blocks missing approvals', () => {
  const root = makeProject('gates');
  try {
    const gateScript = join(root, 'scripts/gate.mjs');
    assert.equal(existsSync(gateScript), true);

    const missing = runNode(root, gateScript, ['check', 'G6']);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /G6 is not approved/);

    const approve = runNode(root, gateScript, ['approve', 'G6', '--note', 'plan reviewed']);
    assert.equal(approve.status, 0, approve.stderr || approve.stdout);

    const check = runNode(root, gateScript, ['check', 'G6']);
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.match(check.stdout, /G6 approved/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gate script scopes approval to a subject so a stale global approval from one epic cannot satisfy another', () => {
  const root = makeProject('gate-subject');
  try {
    const gateScript = join(root, 'scripts/gate.mjs');

    const approveE1 = runNode(root, gateScript, ['approve', 'G6', '--subject', 'E-1', '--note', 'epic 1 plan approved']);
    assert.equal(approveE1.status, 0, approveE1.stderr || approveE1.stdout);

    // The global bare check is satisfied (legacy behavior preserved)...
    const bareCheck = runNode(root, gateScript, ['check', 'G6']);
    assert.equal(bareCheck.status, 0, bareCheck.stderr || bareCheck.stdout);

    // ...but a DIFFERENT epic's subject-scoped check must NOT ride on E-1's approval.
    const checkE3 = runNode(root, gateScript, ['check', 'G6', '--subject', 'E-3']);
    assert.notEqual(checkE3.status, 0);
    assert.match(checkE3.stderr, /not approved for E-3/);

    // E-1's own subject-scoped check does pass.
    const checkE1 = runNode(root, gateScript, ['check', 'G6', '--subject', 'E-1']);
    assert.equal(checkE1.status, 0, checkE1.stderr || checkE1.stdout);

    // Approving E-3 separately doesn't disturb E-1's recorded approval.
    const approveE3 = runNode(root, gateScript, ['approve', 'G6', '--subject', 'E-3', '--note', 'epic 3 plan approved']);
    assert.equal(approveE3.status, 0, approveE3.stderr || approveE3.stdout);
    const recheckE1 = runNode(root, gateScript, ['check', 'G6', '--subject', 'E-1']);
    assert.equal(recheckE1.status, 0, recheckE1.stderr || recheckE1.stdout);

    const list = runNode(root, gateScript, ['list']);
    assert.match(list.stdout, /G6: approved \(E-1: approved, E-3: approved\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gate script recognizes G9 (measure-learn) alongside the existing gates', () => {
  const root = makeProject('gate-g9');
  try {
    const gateScript = join(root, 'scripts/gate.mjs');

    const list = runNode(root, gateScript, ['list']);
    assert.equal(list.status, 0, list.stderr || list.stdout);
    assert.match(list.stdout, /G9: pending/);

    const approve = runNode(root, gateScript, ['approve', 'G9', '--note', 'v1 retro reviewed']);
    assert.equal(approve.status, 0, approve.stderr || approve.stdout);

    const check = runNode(root, gateScript, ['check', 'G9']);
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.match(check.stdout, /G9 approved/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs checks release_in_flight against epics[].release', () => {
  const root = makeProject('release-in-flight');
  try {
    approvePrd(root);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ release_in_flight: 'v2' }));
    const mismatch = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /release_in_flight/);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      release_in_flight: 'v2',
      epics: [{ id: 'E-1', title: 'Foundation', order: 0, vertical: false, prd_ref: 'REQ-01', release: 'v2' }],
    }));
    const matched = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(matched.status, 0, matched.stderr || matched.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('bootstrap seeds release_in_flight and validate.mjs accepts it before any epics exist', () => {
  const root = makeProject('release-in-flight-seed');
  try {
    const seeded = JSON.parse(readFileSync(join(root, 'docs/engineering/backlog.json'), 'utf8'));
    assert.equal(seeded.release_in_flight, 'v1');
    assert.deepEqual(seeded.epics, []);

    // Fresh bootstrap has no PRD/stories yet — validate.mjs must not reject
    // release_in_flight just because epics[] is still empty.
    const result = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('bootstrap scaffolds real design tier content: tokens, an example journey, and an example screen', () => {
  const root = makeProject('design-scaffold-full');
  try {
    const tokens = readFileSync(join(root, 'docs/design/tokens.md'), 'utf8');
    assert.match(tokens, /## Color/);
    assert.match(tokens, /## Component primitives/);

    const journey = readFileSync(join(root, 'docs/design/journeys/example-journey.md'), 'utf8');
    assert.match(journey, /doc: journey/);
    assert.match(journey, /## Entry point/);

    const screen = readFileSync(join(root, 'docs/design/screens/example-screen.md'), 'utf8');
    assert.match(screen, /fidelity: lo-fi/);
    assert.match(screen, /## Layout \(lo-fi\)/);
    assert.match(screen, /## Visual design \(hi-fi\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs accepts a story carrying an optional design_ref', () => {
  const root = makeProject('design-ref');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{
        id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: 'REQ-01',
        acceptance: 'The app shell renders.', blocked_by: [], status: 'notstarted', order: 0,
        design_ref: 'docs/design/screens/example-screen.md',
      }],
    }));

    const result = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs rejects a design_ref that does not point at a real file', () => {
  const root = makeProject('design-ref-missing');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{
        id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: 'REQ-01',
        acceptance: 'The app shell renders.', blocked_by: [], status: 'notstarted', order: 0,
        design_ref: 'docs/design/screens/does-not-exist.md',
      }],
    }));

    const result = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /design_ref 'docs\/design\/screens\/does-not-exist\.md' does not point at a real file/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('bootstrap scaffolds a real docs/design/README.md instead of a bare empty directory', () => {
  const root = makeProject('design-scaffold');
  try {
    const readmePath = join(root, 'docs/design/README.md');
    assert.equal(existsSync(readmePath), true);
    assert.match(readFileSync(readmePath, 'utf8'), /status: draft/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('doctor validates plugin package and scaffold fixture', () => {
  const result = runNode(repoRoot, join(repoRoot, 'scripts/doctor.mjs'));

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /OK throughline doctor passed/);
});

test('platform adapters expose Claude and Codex plugin manifests', () => {
  const claudeManifestPath = join(repoRoot, 'adapters/claude/.claude-plugin/plugin.json');
  const codexManifestPath = join(repoRoot, 'adapters/codex/.codex-plugin/plugin.json');
  const codexMarketplacePath = join(repoRoot, '.agents/plugins/marketplace.json');

  assert.equal(existsSync(claudeManifestPath), true);
  assert.equal(existsSync(codexManifestPath), true);
  assert.equal(existsSync(codexMarketplacePath), true);

  const claude = JSON.parse(readFileSync(claudeManifestPath, 'utf8'));
  const codex = JSON.parse(readFileSync(codexManifestPath, 'utf8'));
  const marketplace = JSON.parse(readFileSync(codexMarketplacePath, 'utf8'));

  assert.equal(claude.name, 'throughline');
  assert.equal(codex.name, 'throughline');
  assert.equal(codex.skills, './skills/');
  assert.equal(codex.interface.displayName, 'Throughline');
  assert.equal(marketplace.plugins[0].source.path, './');
  assert.equal(marketplace.plugins[0].policy.installation, 'AVAILABLE');
  assert.equal(marketplace.plugins[0].policy.authentication, 'ON_INSTALL');
});

test('installer supports claude, codex, and antigravity dry runs', () => {
  const installScript = join(repoRoot, 'scripts/install.mjs');

  for (const platform of ['claude', 'codex', 'antigravity']) {
    const result = runNode(repoRoot, installScript, [platform, '--dry-run']);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, new RegExp('platform=' + platform));
  }
});

test('PowerShell installer wrapper passes platform arguments through', () => {
  const result = spawnSync('pwsh', ['./install.ps1', '-Platform', 'codex', '-DryRun'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /platform=codex/);
  assert.match(result.stdout, /dry-run: no files changed/);
});

test('bootstrap scaffold uses platform-neutral throughline working state', () => {
  const root = makeProject('neutral-state');
  try {
    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    const syncStatus = readFileSync(join(root, 'scripts/sync-status.mjs'), 'utf8');

    assert.match(agents, /\.throughline\/epic-<n>\//);
    assert.doesNotMatch(agents, /\.claude\/epic-<n>\//);
    assert.match(syncStatus, /throughlineDir/);
    assert.doesNotMatch(syncStatus, /claudeDir/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs reports skipped for a bare scaffold with no product code', () => {
  const root = makeProject('coverage-skipped');
  try {
    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json']);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, 'skipped');
    assert.deepEqual(summary.stacks, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs nudges instead of failing silently when a stack is detected but not installed', () => {
  const root = makeProject('coverage-needs-setup');
  try {
    writeJson(join(root, 'package.json'), { name: 'fixture', devDependencies: { vitest: '^2.0.0' } });

    const warnRun = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json']);
    assert.equal(warnRun.status, 0, warnRun.stderr || warnRun.stdout);
    const summary = JSON.parse(warnRun.stdout);
    assert.equal(summary.status, 'needs_setup');
    assert.equal(summary.stacks[0].stack, 'node-vitest');
    assert.match(summary.stacks[0].hint, /@vitest\/coverage-v8/);

    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { min: 0.7, mode: 'enforce' } }));
    const enforceRun = runNode(root, join(root, 'scripts/coverage.mjs'), ['--check']);
    assert.notEqual(enforceRun.status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs --setup adds the missing devDependency without touching anything else', () => {
  const root = makeProject('coverage-setup');
  try {
    writeJson(join(root, 'package.json'), { name: 'fixture', scripts: { test: 'node --test' } });

    const setup = runNode(root, join(root, 'scripts/coverage.mjs'), ['--setup']);
    assert.equal(setup.status, 0, setup.stderr || setup.stdout);
    assert.match(setup.stdout, /added "c8"/);

    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.devDependencies.c8, 'latest');
    assert.equal(pkg.scripts.test, 'node --test');

    // --setup never installs the package, so detection still reports needs_setup afterward.
    const after = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json']);
    assert.equal(JSON.parse(after.stdout).status, 'needs_setup');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs --story patches only verify.coverage', () => {
  const root = makeProject('coverage-story');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{
        id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: 'REQ-01',
        acceptance: 'The app shell renders.', blocked_by: [], status: 'in_progress', order: 0,
        verify: { ci: 'pass', commit: 'abc123' },
      }],
    }));

    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--story', 'S-1', '--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const backlog = JSON.parse(readFileSync(join(root, 'docs/engineering/backlog.json'), 'utf8'));
    const story = backlog.stories.find((s) => s.id === 'S-1');
    // Bare scaffold has no product code, so coverage is "skipped" (no numeric pct) —
    // verify.ci/commit must survive untouched either way.
    assert.equal(story.verify.ci, 'pass');
    assert.equal(story.verify.commit, 'abc123');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs runs the real run/parse/aggregate/--story chain end to end via a coverage.command override', () => {
  const root = makeProject('coverage-end-to-end');
  try {
    // A canned "test runner" that writes a real istanbul-shaped json-summary report,
    // so this exercises readIstanbulSummary + the aggregate math + the numeric
    // --story write, not just the skipped/needs_setup early-exit paths.
    writeFileSync(join(root, 'write-coverage.mjs'), `
      import { mkdirSync, writeFileSync } from 'node:fs';
      mkdirSync('coverage', { recursive: true });
      writeFileSync('coverage/coverage-summary.json', JSON.stringify({ total: { lines: { total: 500, covered: 412 } } }));
      writeFileSync('coverage/lcov.info', 'TN:\\nend_of_record\\n');
    `, 'utf8');

    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      coverage: { min: 0.7, mode: 'enforce', command: 'node write-coverage.mjs' },
      stories: [{
        id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: 'REQ-01',
        acceptance: 'The app shell renders.', blocked_by: [], status: 'in_progress', order: 0,
        verify: { ci: 'pass', commit: 'abc123' },
      }],
    }));

    const run = runNode(root, join(root, 'scripts/coverage.mjs'), ['--story', 'S-1', '--json']);
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const summary = JSON.parse(run.stdout);
    assert.equal(summary.status, 'ok');
    assert.equal(summary.aggregate.pct, 412 / 500);
    assert.equal(summary.passed, true);

    const backlog = JSON.parse(readFileSync(join(root, 'docs/engineering/backlog.json'), 'utf8'));
    const story = backlog.stories.find((s) => s.id === 'S-1');
    assert.equal(story.verify.coverage, Math.round((412 / 500) * 1000) / 1000);
    assert.equal(story.verify.ci, 'pass'); // untouched by --story

    // --reuse must re-evaluate against a raised threshold, not trust the stored `passed`.
    writeJson(join(root, 'docs/engineering/backlog.json'), { ...backlog, coverage: { min: 0.95, mode: 'enforce', command: 'node write-coverage.mjs' } });
    const reused = runNode(root, join(root, 'scripts/coverage.mjs'), ['--reuse', '--check']);
    assert.notEqual(reused.status, 0, reused.stderr || reused.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs enforces coverage.min only when coverage.mode is enforce, and stays backward-compatible when the key is absent', () => {
  const root = makeProject('coverage-validate');
  try {
    approvePrd(root);
    const doneStory = {
      id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: 'REQ-01',
      acceptance: 'The app shell renders.', blocked_by: [], status: 'done', order: 0,
      verify: { ci: 'pass', commit: 'abc123', coverage: 0.5 },
    };

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      coverage: { min: 0.7, mode: 'enforce' },
      stories: [doneStory],
    }));
    const enforced = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(enforced.status, 0);
    assert.match(enforced.stderr, /coverage/);

    // Backward-compat guard: identical backlog, no `coverage` key at all -> must still pass.
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ stories: [doneStory] }));
    const noConfig = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(noConfig.status, 0, noConfig.stderr || noConfig.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build-dashboard.mjs renders without throwing when no coverage data exists', () => {
  const root = makeProject('coverage-dashboard');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());

    const result = runNode(root, join(root, 'scripts/build-dashboard.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(root, 'PROGRESS_DASHBOARD.html'), 'utf8');
    assert.match(html, /not measured yet/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build-dashboard.mjs renders the needs_setup nudge and a passing coverage summary without throwing', () => {
  const root = makeProject('coverage-dashboard-states');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());

    writeJson(join(root, '.throughline/coverage/summary.json'), {
      generatedAt: new Date().toISOString(), status: 'needs_setup',
      stacks: [{ stack: 'node-vitest', tool: '@vitest/coverage-v8', status: 'needs_setup', hint: 'npm install -D @vitest/coverage-v8', passed: true }],
      aggregate: { pct: null }, threshold: 0.7, mode: 'warn', passed: true,
    });
    const needsSetupRun = runNode(root, join(root, 'scripts/build-dashboard.mjs'));
    assert.equal(needsSetupRun.status, 0, needsSetupRun.stderr || needsSetupRun.stdout);
    assert.match(readFileSync(join(root, 'PROGRESS_DASHBOARD.html'), 'utf8'), /coverage\.mjs --setup/);

    writeJson(join(root, '.throughline/coverage/summary.json'), {
      generatedAt: new Date().toISOString(), status: 'ok',
      stacks: [{ stack: 'node-vitest', tool: '@vitest/coverage-v8', status: 'ok', reportFormat: 'lcov', reportPath: 'coverage/lcov.info', covered: 412, total: 500, pct: 0.824, passed: true }],
      aggregate: { pct: 0.824 }, threshold: 0.7, mode: 'warn', passed: true,
    });
    const okRun = runNode(root, join(root, 'scripts/build-dashboard.mjs'));
    assert.equal(okRun.status, 0, okRun.stderr || okRun.stdout);
    const html = readFileSync(join(root, 'PROGRESS_DASHBOARD.html'), 'utf8');
    assert.match(html, /82\.4%/);
    assert.match(html, /coverage\/lcov\.info/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('skill eval set covers production workflow risks', () => {
  const evalPath = join(repoRoot, 'evals/evals.json');
  assert.equal(existsSync(evalPath), true);

  const data = JSON.parse(readFileSync(evalPath, 'utf8'));
  assert.equal(data.skill_name, 'throughline');
  assert.ok(data.evals.length >= 5);
  for (const item of data.evals) {
    assert.ok(item.prompt);
    assert.ok(item.expected_output);
    assert.ok(Array.isArray(item.assertions));
    assert.ok(item.assertions.length >= 3);
  }
});

test('sync-plugin.mjs reports a fresh scaffold as fully unchanged and writes nothing by default', () => {
  const root = makeProject('sync-fresh');
  try {
    const result = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /unchanged: \d+ file/);
    assert.doesNotMatch(result.stdout, /needs review/);
    assert.equal(existsSync(join(root, '.throughline/plugin-version.json')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs --apply adds a missing scaffold file and stamps plugin-version.json', () => {
  const root = makeProject('sync-missing');
  try {
    rmSync(join(root, 'scripts/coverage.mjs'));
    const report = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot]);
    assert.match(report.stdout, /added:\s+scripts\/coverage\.mjs/);
    assert.equal(existsSync(join(root, 'scripts/coverage.mjs')), false, 'report-only mode must not write files');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    assert.equal(existsSync(join(root, 'scripts/coverage.mjs')), true);

    const versionPath = join(root, '.throughline/plugin-version.json');
    assert.equal(existsSync(versionPath), true);
    const version = JSON.parse(readFileSync(versionPath, 'utf8'));
    const pluginPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    assert.equal(version.version, pluginPkg.version);
    assert.ok(version.syncedAt);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs never overwrites a locally-edited scaffold file without --force, and withholds the version stamp while it is unresolved', () => {
  const root = makeProject('sync-edited');
  try {
    const workflowPath = join(root, 'docs/engineering/workflow.md');
    const original = readFileSync(workflowPath, 'utf8');
    writeFileSync(workflowPath, original + '\n<!-- project-specific note, do not clobber -->\n', 'utf8');

    const report = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.match(report.stdout, /needs review/);
    assert.match(readFileSync(workflowPath, 'utf8'), /project-specific note/, '--apply alone must not touch a file that differs');

    const version = JSON.parse(readFileSync(join(root, '.throughline/plugin-version.json'), 'utf8'));
    assert.equal(version.version, null, 'must not claim the project is current while a file is still unresolved');
    assert.ok(version.pendingReview.includes('docs/engineering/workflow.md'));

    const forced = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--force']);
    assert.equal(forced.status, 0, forced.stderr || forced.stdout);
    assert.doesNotMatch(readFileSync(workflowPath, 'utf8'), /project-specific note/, '--force should accept the plugin\'s version for a flagged file');

    const versionAfter = JSON.parse(readFileSync(join(root, '.throughline/plugin-version.json'), 'utf8'));
    const pluginPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    assert.equal(versionAfter.version, pluginPkg.version, 'once every flagged file is resolved, the stamp should claim the current version');
    assert.deepEqual(versionAfter.pendingReview, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs --force=<path> resolves only the named file, leaving other flagged files untouched', () => {
  const root = makeProject('sync-scoped-force');
  try {
    const workflowPath = join(root, 'docs/engineering/workflow.md');
    const schemaPath = join(root, 'docs/engineering/backlog.schema.json');
    writeFileSync(workflowPath, readFileSync(workflowPath, 'utf8') + '\n<!-- keep me -->\n', 'utf8');
    writeFileSync(schemaPath, readFileSync(schemaPath, 'utf8').replace('{', '{\n  "_note": "keep me too",'), 'utf8');

    const scoped = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--force=docs/engineering/workflow.md']);
    assert.equal(scoped.status, 0, scoped.stderr || scoped.stdout);
    assert.doesNotMatch(readFileSync(workflowPath, 'utf8'), /keep me/, 'the named file should be overwritten');
    assert.match(readFileSync(schemaPath, 'utf8'), /keep me too/, 'a flagged file not named in --force= must survive untouched');
    assert.match(scoped.stdout, /needs review/, 'the unresolved schema file should still be reported');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs refreshes an already-installed git pre-commit hook when .githooks/pre-commit changes', () => {
  const root = makeProject('sync-hook');
  try {
    const initGit = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
    assert.equal(initGit.status, 0, initGit.stderr);
    const hookPath = join(root, '.git/hooks/pre-commit');
    mkdirSync(dirname(hookPath), { recursive: true });
    writeFileSync(hookPath, '#!/bin/sh\necho stale hook\n', 'utf8');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    const refreshed = readFileSync(hookPath, 'utf8');
    assert.equal(refreshed, readFileSync(join(root, '.githooks/pre-commit'), 'utf8'), 'the live hook should now match .githooks/pre-commit');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs restores a deleted backlog.seed.json so a re-run of init-project.mjs does not crash', () => {
  const root = makeProject('sync-seed');
  try {
    rmSync(join(root, 'docs/engineering/backlog.seed.json'));
    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    assert.equal(existsSync(join(root, 'docs/engineering/backlog.seed.json')), true);

    const rerun = runNode(root, join(root, 'scripts/init-project.mjs'), ['Fixture']);
    assert.equal(rerun.status, 0, rerun.stderr || rerun.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs regenerates AGENTS.md preserving the project name already in it', () => {
  const root = makeProject('sync-agents');
  try {
    const agentsPath = join(root, 'AGENTS.md');
    assert.match(readFileSync(agentsPath, 'utf8'), /^# Fixture — Agent Operating Manual/m);
    const result = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot]);
    assert.doesNotMatch(result.stdout, /needs review.*AGENTS\.md|AGENTS\.md.*needs review/s);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs fails loud when epic working state is written under .claude/ instead of .throughline/', () => {
  const root = makeProject('misplaced-state');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());

    const before = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(before.status, 0, before.stderr || before.stdout);

    mkdirSync(join(root, '.claude/epic-1'), { recursive: true });
    writeFileSync(join(root, '.claude/epic-1/ledger.md'), '# ledger\n', 'utf8');

    const after = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(after.status, 0);
    assert.match(after.stdout + after.stderr, /\.claude\/epic-1.*must live under \.throughline\//);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs --repair-state moves misplaced working state into .throughline/ and validate.mjs passes again', () => {
  const root = makeProject('repair-state');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());

    mkdirSync(join(root, '.claude/epic-1'), { recursive: true });
    writeFileSync(join(root, '.claude/epic-1/ledger.md'), '# ledger\n', 'utf8');
    writeFileSync(join(root, '.claude/gates.json'), '{}', 'utf8');

    const report = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--repair-state']);
    assert.equal(report.status, 0, report.stderr || report.stdout);
    assert.match(report.stdout, /\.claude\/epic-1/);
    assert.match(report.stdout, /\.claude\/gates\.json/);
    assert.equal(existsSync(join(root, '.claude/epic-1')), true, 'report-only mode must not move anything');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--repair-state', '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    assert.equal(existsSync(join(root, '.claude/epic-1')), false);
    assert.equal(existsSync(join(root, '.throughline/epic-1/ledger.md')), true);
    assert.equal(existsSync(join(root, '.throughline/gates.json')), true);

    const validate = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(validate.status, 0, validate.stderr || validate.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs --repair-state flags a conflict instead of overwriting an existing .throughline/ destination', () => {
  const root = makeProject('repair-conflict');
  try {
    mkdirSync(join(root, '.throughline/epic-1'), { recursive: true });
    writeFileSync(join(root, '.throughline/epic-1/ledger.md'), 'real ledger\n', 'utf8');
    mkdirSync(join(root, '.claude/epic-1'), { recursive: true });
    writeFileSync(join(root, '.claude/epic-1/ledger.md'), 'stray duplicate\n', 'utf8');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--repair-state', '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    assert.match(apply.stdout, /CONFLICT/);
    assert.equal(readFileSync(join(root, '.throughline/epic-1/ledger.md'), 'utf8'), 'real ledger\n', 'the real ledger must not be overwritten');
    assert.equal(existsSync(join(root, '.claude/epic-1')), true, 'a conflicting item must be left in place, not silently dropped');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function fillPrd(root) {
  const path = join(root, 'docs/product/06-prd.md');
  let text = readFileSync(path, 'utf8');
  text = text.replace('| REQ-01 | … | P0 | … | v1 |', '| REQ-01 | User can sign up | P0 | Account created | v1 |');
  text = text.replace('| REQ-02 | … | P1 | … | v1 |', '| REQ-02 | User can log in | P1 | Session established | v1 |');
  writeFileSync(path, text, 'utf8');
}

test('check-docs.mjs --tier=product fails against unfilled placeholders and passes once filled', () => {
  const root = makeProject('checkdocs-prd');
  try {
    const before = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=product', '--json']);
    assert.equal(before.status, 1);
    const beforeSummary = JSON.parse(before.stdout);
    assert.equal(beforeSummary.passed, false);
    assert.ok(beforeSummary.errors.some((e) => e.includes('missing Acceptance')));

    fillPrd(root);
    const after = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=product', '--json']);
    assert.equal(after.status, 0, after.stderr || after.stdout);
    assert.equal(JSON.parse(after.stdout).passed, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-docs.mjs catches an invalid PRD status and a duplicate REQ-xx id', () => {
  const root = makeProject('checkdocs-prd-invalid');
  try {
    fillPrd(root);
    const path = join(root, 'docs/product/06-prd.md');
    let text = readFileSync(path, 'utf8');
    text = text.replace('status: draft', 'status: pending-review');
    text = text.replace('| REQ-02 | User can log in | P1 | Session established | v1 |', '| REQ-01 | User can log in | P1 | Session established | v1 |');
    writeFileSync(path, text, 'utf8');

    const result = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=product', '--json']);
    assert.equal(result.status, 1);
    const summary = JSON.parse(result.stdout);
    assert.ok(summary.errors.some((e) => e.includes('status must be draft|approved')));
    assert.ok(summary.errors.some((e) => e.includes('duplicate requirement id REQ-01')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-docs.mjs cross-references a journey/screen req_ref against the real PRD requirements', () => {
  const root = makeProject('checkdocs-design-crossref');
  try {
    fillPrd(root);
    const journeyPath = join(root, 'docs/design/journeys/example-journey.md');
    let journey = readFileSync(journeyPath, 'utf8')
      .replace('persona: ""', 'persona: "New user"')
      .replace('req_ref: []', 'req_ref: [REQ-99]');
    writeFileSync(journeyPath, journey, 'utf8');

    const bad = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=design', '--json']);
    assert.equal(bad.status, 1);
    assert.ok(JSON.parse(bad.stdout).errors.some((e) => e.includes("'REQ-99' is not a requirement in the PRD")));

    writeFileSync(journeyPath, journey.replace('req_ref: [REQ-99]', 'req_ref: [REQ-01]'), 'utf8');
    const screenPath = join(root, 'docs/design/screens/example-screen.md');
    writeFileSync(screenPath, readFileSync(screenPath, 'utf8').replace('req_ref: ""', 'req_ref: "REQ-01"').replace('journey: ""', 'journey: "example-journey"'), 'utf8');

    const good = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=design', '--json']);
    assert.equal(good.status, 0, good.stderr || good.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-docs.mjs requires a real checkpoint line before accepting fidelity: hi-fi, and ignores the template\'s own instructional comment', () => {
  const root = makeProject('checkdocs-checkpoint');
  try {
    fillPrd(root);
    const journeyPath = join(root, 'docs/design/journeys/example-journey.md');
    writeFileSync(journeyPath, readFileSync(journeyPath, 'utf8').replace('persona: ""', 'persona: "New user"').replace('req_ref: []', 'req_ref: [REQ-01]'), 'utf8');
    const screenPath = join(root, 'docs/design/screens/example-screen.md');
    let screen = readFileSync(screenPath, 'utf8')
      .replace('req_ref: ""', 'req_ref: "REQ-01"')
      .replace('journey: ""', 'journey: "example-journey"')
      .replace('fidelity: lo-fi', 'fidelity: hi-fi');
    writeFileSync(screenPath, screen, 'utf8');

    // The unmodified template's HTML comment already contains the word "checkpoint" —
    // must not count as a real record of the checkpoint step having run.
    const stillTemplateComment = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=design', '--json']);
    assert.equal(stillTemplateComment.status, 1);
    assert.ok(JSON.parse(stillTemplateComment.stdout).errors.some((e) => e.includes('no checkpoint line')));

    screen = screen.replace(/<!--[\s\S]*?-->\n?/, '');
    writeFileSync(screenPath, screen, 'utf8');
    const noRealLine = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=design', '--json']);
    assert.equal(noRealLine.status, 1);

    screen = screen + '- 2026-08-03 — wireframe checkpointed, approved to proceed to hi-fi.\n';
    writeFileSync(screenPath, screen, 'utf8');
    const withRealLine = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=design', '--json']);
    assert.equal(withRealLine.status, 0, withRealLine.stderr || withRealLine.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-docs.mjs catches an ADR superseded-by reference pointing at a nonexistent ADR', () => {
  const root = makeProject('checkdocs-adr');
  try {
    mkdirSync(join(root, 'docs/architecture/decisions'), { recursive: true });
    writeFileSync(join(root, 'docs/architecture/decisions/ADR-0002-broken.md'), '---\ndoc: adr\nstatus: superseded-by ADR-9999\nupdated: 2026-08-03\n---\n\n# ADR-0002\n', 'utf8');

    const bad = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=architecture', '--json']);
    assert.equal(bad.status, 1);
    assert.ok(JSON.parse(bad.stdout).errors.some((e) => e.includes('ADR-9999 which does not exist')));

    writeFileSync(join(root, 'docs/architecture/decisions/ADR-9999-real.md'), '---\ndoc: adr\nstatus: accepted\nupdated: 2026-08-03\n---\n\n# ADR-9999\n', 'utf8');
    const good = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=architecture', '--json']);
    assert.equal(good.status, 0, good.stderr || good.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-docs.mjs validates retro front-matter and requires all four sections', () => {
  const root = makeProject('checkdocs-retro');
  try {
    mkdirSync(join(root, 'docs/product/retros'), { recursive: true });
    const retroPath = join(root, 'docs/product/retros/v1.md');
    writeFileSync(retroPath, '---\ndoc: retro\nstatus: draft\nrelease: v1\ndecision: proceed\n---\n\n## Metrics vs. success criteria\ntext\n', 'utf8');

    const incomplete = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=retro', '--json']);
    assert.equal(incomplete.status, 1);
    const errors = JSON.parse(incomplete.stdout).errors;
    assert.ok(errors.some((e) => e.includes('Ops health')));
    assert.ok(errors.some((e) => e.includes('UX signals')));
    assert.ok(errors.some((e) => e.includes('Decision')));

    writeFileSync(retroPath, '---\ndoc: retro\nstatus: recorded\nrelease: v1\ndecision: proceed\n---\n\n## Metrics vs. success criteria\ntext\n## Ops health\ntext\n## UX signals / debt\ntext\n## Decision\ntext\n', 'utf8');
    const complete = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=retro', '--json']);
    assert.equal(complete.status, 0, complete.stderr || complete.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build-dashboard.mjs scopes the headline progress to the current release and collapses shipped/upcoming releases', () => {
  const root = makeProject('dashboard-multi-release');
  try {
    writeJson(join(root, 'docs/engineering/backlog.json'), {
      schema: 2, project: 'Fixture', prd: 'docs/product/06-prd.md', tracker: 'local',
      release_in_flight: 'v2',
      epics: [
        { id: 'E-1', title: 'Foundation', order: 0, vertical: false, prd_ref: 'REQ-01', release: 'v1' },
        { id: 'E-2', title: 'Recurring segments', order: 1, prd_ref: 'REQ-02', release: 'v2' },
        { id: 'E-3', title: 'Multi-city trips', order: 2, prd_ref: 'REQ-03', release: 'v3' },
      ],
      stories: [
        { id: 'S-1', title: 'App shell', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'x', blocked_by: [], status: 'done', order: 0 },
        { id: 'S-2', title: 'Recurring model', epic: 'E-2', prd_ref: 'REQ-02', acceptance: 'x', blocked_by: [], status: 'done', order: 0 },
        { id: 'S-3', title: 'Recurring form', epic: 'E-2', prd_ref: 'REQ-02', acceptance: 'x', blocked_by: [], status: 'in_progress', order: 1 },
        { id: 'S-4', title: 'Multi-city model', epic: 'E-3', prd_ref: 'REQ-03', acceptance: 'x', blocked_by: [], status: 'notstarted', order: 0 },
      ],
    });

    const result = runNode(root, join(root, 'scripts/build-dashboard.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(root, 'PROGRESS_DASHBOARD.html'), 'utf8');

    // Headline ring must reflect only the current release (v2: 1 of 2 done), not all 4 stories.
    assert.match(html, /1 of 2 stories done/);
    // v1 is fully done and not current -> shipped, collapsed via <details>.
    assert.match(html, /<details class="relgroup"><summary><div class="relrow"><span class="relname">v1<\/span><span class="reltag">Shipped<\/span>/);
    // v3 has nothing started and is not current -> upcoming, also collapsed.
    assert.match(html, /<details class="relgroup"><summary><div class="relrow"><span class="relname">v3<\/span><span class="reltag">Upcoming<\/span>/);
    // v2 (current) is NOT wrapped in <details> -- always visible, tagged Current.
    assert.match(html, /<div class="relgroup current">.*<span class="relname">v2<\/span><span class="reltag">Current<\/span>/s);
    // Footer keeps the all-release total for context.
    assert.match(html, /All releases: 2 of 4 stories done/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build-dashboard.mjs treats an untagged epic as the implicit first release, matching define-backlog\'s own v1 convention', () => {
  const root = makeProject('dashboard-untagged-v1');
  try {
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());
    const result = runNode(root, join(root, 'scripts/build-dashboard.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(root, 'PROGRESS_DASHBOARD.html'), 'utf8');
    // No release_in_flight, no epic release tags -> single implicit "v1", nothing collapsed,
    // and behaves exactly like the pre-multi-release dashboard (no "Other releases" section).
    assert.doesNotMatch(html, /Other releases/);
    assert.match(html, /Epics &middot; v1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-docs.mjs blanket mode does not enforce a tier until its own doc has been approved once, but explicit --tier= always does', () => {
  const root = makeProject('checkdocs-blanket-gating');
  try {
    // Fresh scaffold: PRD, design README, architecture overview are all still draft with
    // unfilled placeholders. Blanket mode (what CI would run) must not fail on any of it —
    // a headless project that never touches the design tier must not get permanently
    // blocked by its own untouched scaffold.
    const blanketFresh = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--json']);
    assert.equal(blanketFresh.status, 0, blanketFresh.stderr || blanketFresh.stdout);
    assert.equal(JSON.parse(blanketFresh.stdout).passed, true);

    // But the skill's own explicit pre-approval gate must still catch the same unfilled PRD.
    const explicitProduct = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--tier=product', '--json']);
    assert.equal(explicitProduct.status, 1);
    assert.equal(JSON.parse(explicitProduct.stdout).passed, false);

    // Once the PRD is approved (front-matter only — rows still unfilled), blanket mode now
    // enforces it, catching exactly the same issue explicit mode always caught.
    const prdPath = join(root, 'docs/product/06-prd.md');
    writeFileSync(prdPath, readFileSync(prdPath, 'utf8').replace('status: draft', 'status: approved'), 'utf8');
    const blanketAfterApproval = runNode(root, join(root, 'scripts/check-docs.mjs'), ['--json']);
    assert.equal(blanketAfterApproval.status, 1);
    assert.ok(JSON.parse(blanketAfterApproval.stdout).errors.some((e) => e.includes('missing Acceptance')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
