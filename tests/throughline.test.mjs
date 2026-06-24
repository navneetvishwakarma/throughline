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

test('doctor validates plugin package and scaffold fixture', () => {
  const result = runNode(repoRoot, join(repoRoot, 'scripts/doctor.mjs'));

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /OK throughline doctor passed/);
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
