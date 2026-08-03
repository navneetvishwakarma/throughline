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
