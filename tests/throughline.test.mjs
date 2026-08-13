import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  const prd = readFileSync(prdPath, 'utf8')
    .replace('status: draft', 'status: approved')
    .replace('| REQ-01 | … | P0 | … | v1 |', '| REQ-01 | Build the fixture | P0 | The fixture works | v1 |')
    .replace(/^\| REQ-02 \| … \| P1 \| … \| v1 \|\r?\n/m, '');
  writeFileSync(prdPath, prd, 'utf8');
}

function writeApprovedPrd(root, requirements) {
  const rows = requirements
    .map(({ id, release }) => `| ${id} | Requirement ${id} | P0 | ${id} works | ${release} |`)
    .join('\n');
  writeFileSync(join(root, 'docs/product/06-prd.md'), `---\ndoc: prd\nproject: Fixture\nstatus: approved\n---\n\n## Requirements\n\n| ID | Requirement | Priority | Acceptance | Release |\n|---|---|---|---|---|\n${rows}\n`, 'utf8');
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

test('validate.mjs accepts a story prd_ref as an array, matching epic.prd_ref', () => {
  const root = makeProject('story-prd-ref-array');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{
        id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: ['REQ-01'],
        acceptance: 'The app shell renders.', blocked_by: [], status: 'notstarted', order: 0,
      }],
    }));

    const result = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs treats an absent blocked_by as no dependencies, but still rejects a wrong-typed one', () => {
  const root = makeProject('story-blocked-by-absent');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{ id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'The app shell renders.', status: 'notstarted', order: 0 }],
    }));
    const absent = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(absent.status, 0, absent.stderr || absent.stdout);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{ id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'The app shell renders.', blocked_by: 'S-2', status: 'notstarted', order: 0 }],
    }));
    const wrongType = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(wrongType.status, 0);
    assert.match(wrongType.stderr, /blocked_by must be an array/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs rejects a story marked blocked with no blocked_by dependency named (contradictory status)', () => {
  const root = makeProject('blocked-status-no-deps');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{ id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'The app shell renders.', blocked_by: [], status: 'blocked', order: 0 }],
    }));
    const result = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /status is 'blocked' but blocked_by is empty/);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [
        { id: 'S-1', title: 'Dep', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'x', blocked_by: [], status: 'notstarted', order: 0 },
        { id: 'S-2', title: 'Blocked', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'x', blocked_by: ['S-1'], status: 'blocked', order: 1 },
      ],
    }));
    const ok = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs rejects a story marked done while a blocked_by dependency is not done (contradictory status)', () => {
  const root = makeProject('done-status-open-dep');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [
        { id: 'S-1', title: 'Dep', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'x', blocked_by: [], status: 'in_progress', order: 0 },
        { id: 'S-2', title: 'Done too early', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'x', blocked_by: ['S-1'], status: 'done', verify: { ci: 'pass', commit: 'abc123' }, order: 1 },
      ],
    }));
    const result = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /status is 'done' but blocked_by dependency 'S-1' is not done \(status: in_progress\)/);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [
        { id: 'S-1', title: 'Dep', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'x', blocked_by: [], status: 'done', verify: { ci: 'pass', commit: 'abc123' }, order: 0 },
        { id: 'S-2', title: 'Done for real', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'x', blocked_by: ['S-1'], status: 'done', verify: { ci: 'pass', commit: 'def456' }, order: 1 },
      ],
    }));
    const ok = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(ok.status, 0, ok.stderr || ok.stdout);
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

test('validate.mjs downgrades legacy-contract gaps to WARN when legacyContractGrace is set, but hard-fails the same data without it', () => {
  const root = makeProject('legacy-contract-grace');
  try {
    approvePrd(root);
    const legacyBacklog = baseBacklog({
      stories: [
        { id: 'S-1', title: 'No trace', epic: 'E-1', acceptance: 'It works.', blocked_by: [], status: 'notstarted', order: 0 },
        { id: 'S-2', title: 'Old done work', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'It shipped.', blocked_by: [], status: 'done', order: 1 },
      ],
    });
    writeJson(join(root, 'docs/engineering/backlog.json'), legacyBacklog);

    const withoutGrace = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(withoutGrace.status, 0);
    assert.match(withoutGrace.stderr, /prd_ref is required/);
    assert.match(withoutGrace.stderr, /done stories require verify\.ci pass/);

    writeJson(join(root, '.throughline/plugin-version.json'), { version: null, syncedAt: new Date().toISOString(), pendingReview: [], legacyContractGrace: true });
    const withGrace = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(withGrace.status, 0, withGrace.stderr || withGrace.stdout);
    assert.match(withGrace.stdout, /WARN 2 legacy-contract gap/);
    assert.match(withGrace.stdout, /prd_ref is required/);
    assert.match(withGrace.stdout, /done stories require verify\.ci pass/);
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

test('sync-status.mjs infers and persists tracker=github when gh_issue data exists but tracker is unset, and leaves a tracker-less/gh_issue-less backlog defaulting to local', () => {
  const root = makeProject('sync-status-tracker-infer');
  try {
    approvePrd(root);
    const backlogPath = join(root, 'docs/engineering/backlog.json');
    const withGhIssue = baseBacklog({
      stories: [{ id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'The app shell renders.', blocked_by: [], status: 'notstarted', order: 0, gh_issue: 42 }],
    });
    delete withGhIssue.tracker;
    writeJson(backlogPath, withGhIssue);

    const inferred = runNode(root, join(root, 'scripts/sync-status.mjs'));
    assert.equal(inferred.status, 0, inferred.stderr || inferred.stdout);
    assert.match(inferred.stdout, /inferred and persisted tracker=github/);
    assert.match(inferred.stdout, /tracker=github/);
    assert.equal(JSON.parse(readFileSync(backlogPath, 'utf8')).tracker, 'github');

    const noGhIssue = baseBacklog();
    delete noGhIssue.tracker;
    writeJson(backlogPath, noGhIssue);
    const defaulted = runNode(root, join(root, 'scripts/sync-status.mjs'));
    assert.equal(defaulted.status, 0, defaulted.stderr || defaulted.stdout);
    assert.doesNotMatch(defaulted.stdout, /inferred and persisted/);
    assert.match(defaulted.stdout, /tracker=local/);
    assert.equal(JSON.parse(readFileSync(backlogPath, 'utf8')).tracker, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gate script persists approval state and blocks missing approvals', () => {
  const root = makeProject('gates');
  try {
    const gateScript = join(root, 'scripts/gate.mjs');
    assert.equal(existsSync(gateScript), true);

    const missing = runNode(root, gateScript, ['check', 'G5']);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /G5 is not approved/);

    const approve = runNode(root, gateScript, ['approve', 'G5', '--note', 'backlog reviewed']);
    assert.equal(approve.status, 0, approve.stderr || approve.stdout);

    const check = runNode(root, gateScript, ['check', 'G5']);
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.match(check.stdout, /G5 approved/);
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

    const bareG6Check = runNode(root, gateScript, ['check', 'G6']);
    assert.notEqual(bareG6Check.status, 0);
    assert.match(bareG6Check.stderr, /G6.*--subject/);

    const approveG7 = runNode(root, gateScript, ['approve', 'G7', '--subject', 'E-1', '--note', 'epic 1 ready to merge']);
    assert.equal(approveG7.status, 0, approveG7.stderr || approveG7.stdout);
    const bareG7Check = runNode(root, gateScript, ['check', 'G7']);
    assert.notEqual(bareG7Check.status, 0);
    assert.match(bareG7Check.stderr, /G7.*--subject/);

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

test('validate.mjs rejects an epic prd_ref absent from the approved PRD', () => {
  const root = makeProject('dangling-epic-prd-ref');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      epics: [{ id: 'E-1', title: 'Foundation', order: 0, vertical: false, prd_ref: 'REQ-999' }],
    }));

    const result = runNode(root, join(root, 'scripts/validate.mjs'));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /epics\[0\] E-1: prd_ref 'REQ-999' does not exist in the approved PRD/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs rejects a story prd_ref absent from the approved PRD', () => {
  const root = makeProject('dangling-story-prd-ref');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{
        id: 'S-1', title: 'Invented requirement', epic: 'E-1', prd_ref: 'REQ-999',
        acceptance: 'The invented requirement appears complete.', blocked_by: [], status: 'notstarted', order: 0,
      }],
    }));

    const result = runNode(root, join(root, 'scripts/validate.mjs'));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /stories\[0\] S-1: prd_ref 'REQ-999' does not exist in the approved PRD/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate.mjs requires every release requirement in a same-release epic and story', () => {
  const root = makeProject('prd-release-traceability');
  try {
    writeApprovedPrd(root, [
      { id: 'REQ-01', release: 'v1' },
      { id: 'REQ-02', release: 'v2' },
    ]);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ release_in_flight: 'v1' }));

    const missingEpic = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(missingEpic.status, 0);
    assert.match(missingEpic.stderr, /REQ-02 \(release v2\) is not referenced by any epic in release v2/);

    const epics = [
      { id: 'E-1', title: 'Foundation', order: 0, prd_ref: 'REQ-01', release: 'v1' },
      { id: 'E-2', title: 'Second release', order: 1, prd_ref: 'REQ-02', release: 'v2' },
    ];
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      release_in_flight: 'v1',
      epics,
      stories: [
        ...baseBacklog().stories,
        { id: 'S-2', title: 'Wrong release trace', epic: 'E-2', prd_ref: 'REQ-01', acceptance: 'The work ships.', blocked_by: [], status: 'notstarted', order: 1 },
      ],
    }));

    const missingStory = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(missingStory.status, 0);
    assert.match(missingStory.stderr, /REQ-02 \(release v2\) is not referenced by any story in its release epic/);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      release_in_flight: 'v1',
      epics,
      stories: [
        ...baseBacklog().stories,
        { id: 'S-2', title: 'Second release trace', epic: 'E-2', prd_ref: 'REQ-02', acceptance: 'The work ships.', blocked_by: [], status: 'notstarted', order: 1 },
      ],
    }));

    const complete = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(complete.status, 0, complete.stderr || complete.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gate script next skips optional G1.5 while keeping it visible in list', () => {
  const root = makeProject('gate-next-optional');
  try {
    const gateScript = join(root, 'scripts/gate.mjs');
    const approveG1 = runNode(root, gateScript, ['approve', 'G1', '--note', 'brief approved']);
    assert.equal(approveG1.status, 0, approveG1.stderr || approveG1.stdout);

    const next = runNode(root, gateScript, ['next']);
    assert.equal(next.status, 0, next.stderr || next.stdout);
    assert.match(next.stdout, /G2 pending/);

    const list = runNode(root, gateScript, ['list']);
    assert.match(list.stdout, /G1\.5: pending/);
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
    writeApprovedPrd(root, [{ id: 'REQ-01', release: 'v1' }]);

    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ release_in_flight: 'v2' }));
    const mismatch = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /release_in_flight/);

    writeApprovedPrd(root, [{ id: 'REQ-01', release: 'v2' }]);
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

test('coverage.mjs exits 2 when any configured coverage.stacks identifier is unknown', () => {
  const root = makeProject('coverage-unknown-configured-stacks');
  try {
    writeJson(join(root, 'package.json'), { name: 'fixture', devDependencies: { vitest: '^2.0.0' } });
    approvePrd(root);

    for (const stacks of [['does-not-exist'], ['node-vitest', 'does-not-exist']]) {
      writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'warn', stacks } }));
      const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json']);
      assert.equal(result.status, 2, result.stderr || result.stdout);
      assert.match(result.stderr, /Unknown coverage\.stacks identifier "does-not-exist"/);
      assert.match(result.stderr, /Known: node-vitest/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs exits 2 when configured coverage.stacks selects no detected stack', () => {
  const root = makeProject('coverage-no-configured-stack-match');
  try {
    writeJson(join(root, 'package.json'), { name: 'fixture', devDependencies: { vitest: '^2.0.0' } });
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({ coverage: { mode: 'warn', stacks: [] } }));

    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--json']);
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.match(result.stderr, /coverage\.stacks selected no detected stack/);
    assert.match(result.stderr, /Known: node-vitest/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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

test('coverage.mjs rejects a stale custom-command summary when the current command writes no report', () => {
  const root = makeProject('coverage-custom-stale-report');
  try {
    approvePrd(root);
    writeJson(join(root, 'coverage/coverage-summary.json'), { total: { lines: { total: 100, covered: 100 } } });
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      coverage: { mode: 'enforce', min: 0.9, command: 'node -e "process.exit(0)"' },
    }));

    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--check', '--json']);
    assert.notEqual(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, 'error');
    assert.match(summary.stacks[0].message, /no report found/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs rejects a stale explicit-target summary when the current command writes no report', () => {
  const root = makeProject('coverage-target-stale-report');
  try {
    mkdirSync(join(root, 'apps/backend'), { recursive: true });
    approvePrd(root);
    writeJson(join(root, 'apps/backend/coverage/coverage-summary.json'), { total: { lines: { total: 100, covered: 100 } } });
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      coverage: {
        mode: 'enforce', min: 0.9,
        targets: [{ id: 'backend', cwd: 'apps/backend', command: 'node -e "process.exit(0)"', summary: 'coverage/coverage-summary.json' }],
      },
    }));

    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--check', '--json']);
    assert.notEqual(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, 'error');
    assert.match(summary.stacks[0].message, /no report found/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('coverage.mjs accepts an explicit target that regenerates its removed summary', () => {
  const root = makeProject('coverage-target-regenerated-report');
  try {
    mkdirSync(join(root, 'apps/backend'), { recursive: true });
    writeJson(join(root, 'apps/backend/coverage/coverage-summary.json'), { total: { lines: { total: 100, covered: 0 } } });
    writeFileSync(join(root, 'apps/backend/write-coverage.mjs'), `
      import { mkdirSync, writeFileSync } from 'node:fs';
      mkdirSync('coverage', { recursive: true });
      writeFileSync('coverage/coverage-summary.json', JSON.stringify({ total: { lines: { total: 100, covered: 75 } } }));
    `, 'utf8');
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      coverage: {
        mode: 'enforce', min: 0.7,
        targets: [{ id: 'backend', cwd: 'apps/backend', command: 'node write-coverage.mjs', summary: 'coverage/coverage-summary.json' }],
      },
    }));

    const result = runNode(root, join(root, 'scripts/coverage.mjs'), ['--check', '--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, 'ok');
    assert.equal(summary.aggregate.pct, 0.75);
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

test('build-dashboard.mjs never invents a lowercase v1 when release_in_flight is missing but epics declare explicit releases', () => {
  const root = makeProject('dashboard-no-invented-v1');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      epics: [{ id: 'E-1', title: 'V2 work', order: 0, release: 'v2', prd_ref: 'REQ-01' }],
      stories: [{ id: 'S-1', title: 'Create shell', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'It renders.', blocked_by: [], status: 'notstarted', order: 0 }],
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

test('sync-plugin.mjs stamps legacyContractGrace only on a first-ever sync whose existing backlog.json actually predates the newer requirements', () => {
  const root = makeProject('sync-legacy-grace-adopted');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{ id: 'S-1', title: 'Old work', epic: 'E-1', acceptance: 'It works.', blocked_by: [], status: 'notstarted', order: 0 }],
    }));

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    const version = JSON.parse(readFileSync(join(root, '.throughline/plugin-version.json'), 'utf8'));
    assert.equal(version.legacyContractGrace, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs does not grant legacyContractGrace to a first-ever sync of an already-compliant backlog.json', () => {
  const root = makeProject('sync-legacy-grace-compliant');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    const version = JSON.parse(readFileSync(join(root, '.throughline/plugin-version.json'), 'utf8'));
    assert.equal(version.legacyContractGrace, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs preserves an already-granted legacyContractGrace on a later sync, even once the backlog becomes compliant', () => {
  const root = makeProject('sync-legacy-grace-preserved');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{ id: 'S-1', title: 'Old work', epic: 'E-1', acceptance: 'It works.', blocked_by: [], status: 'notstarted', order: 0 }],
    }));
    const first = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(JSON.parse(readFileSync(join(root, '.throughline/plugin-version.json'), 'utf8')).legacyContractGrace, true);

    // Backfill the missing prd_ref -- backlog.json is now fully compliant.
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());
    const second = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(JSON.parse(readFileSync(join(root, '.throughline/plugin-version.json'), 'utf8')).legacyContractGrace, true, 'only a human clears the flag, not a later sync');
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

    const unchangedResync = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(unchangedResync.status, 0, unchangedResync.stderr || unchangedResync.stdout);
    assert.doesNotMatch(unchangedResync.stdout, /needs review/);
    assert.match(unchangedResync.stdout, /seed-only, up to date: \.github\/workflows\/throughline\.yml/);

    writeFileSync(join(root, '.github/workflows/throughline.yml'), rendered + '\n# project-specific: also run e2e\n', 'utf8');
    const resynced = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(resynced.status, 0, resynced.stderr || resynced.stdout);
    assert.doesNotMatch(resynced.stdout, /needs review/);
    assert.match(resynced.stdout, /differs from current render/);
    assert.match(readFileSync(join(root, '.github/workflows/throughline.yml'), 'utf8'), /project-specific: also run e2e/);

    const version = JSON.parse(readFileSync(join(root, '.throughline/plugin-version.json'), 'utf8'));
    assert.ok(!version.pendingReview.includes('.github/workflows/throughline.yml'));
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
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0\n', 'utf8');

    const pnpmRun = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(pnpmRun.status, 0, pnpmRun.stderr || pnpmRun.stdout);
    const pnpmYaml = readFileSync(join(root, '.github/workflows/throughline.yml'), 'utf8');
    assert.match(pnpmYaml, /pnpm\/action-setup/);
    assert.match(pnpmYaml, /pnpm install --frozen-lockfile/);

    rmSync(join(root, 'pnpm-lock.yaml'));
    rmSync(join(root, '.github/workflows/throughline.yml'));
    const noLockfileRun = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(noLockfileRun.status, 0, noLockfileRun.stderr || noLockfileRun.stdout);
    assert.equal(existsSync(join(root, '.github/workflows/throughline.yml')), false);
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

test('sync-plugin.mjs preserves an unrelated project pre-commit hook and requests manual composition', () => {
  const root = makeProject('sync-custom-hook');
  try {
    const initGit = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
    assert.equal(initGit.status, 0, initGit.stderr);
    const hookPath = join(root, '.git/hooks/pre-commit');
    mkdirSync(dirname(hookPath), { recursive: true });
    const customHook = '#!/bin/sh\nnpm run lint\nnpm run security-check\n';
    writeFileSync(hookPath, customHook, 'utf8');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    assert.equal(readFileSync(hookPath, 'utf8'), customHook, 'an unrelated project hook must remain byte-identical');
    assert.match(apply.stdout, /pre-commit.*preserved.*manual.*compos|manual.*compos.*pre-commit/is);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs preserves a partial Throughline-like hook as project-owned', () => {
  const root = makeProject('sync-partial-hook');
  try {
    const initGit = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
    assert.equal(initGit.status, 0, initGit.stderr);
    const hookPath = join(root, '.git/hooks/pre-commit');
    mkdirSync(dirname(hookPath), { recursive: true });
    const partialHook = '#!/bin/sh\nnode scripts/validate.mjs\nnpm run lint\n';
    writeFileSync(hookPath, partialHook, 'utf8');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    assert.equal(readFileSync(hookPath, 'utf8'), partialHook, 'one Throughline command is not enough to claim ownership');
    assert.match(apply.stdout, /pre-commit.*preserved.*manual.*compos|manual.*compos.*pre-commit/is);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs does not claim a hook containing only commented Throughline commands', () => {
  const root = makeProject('sync-commented-hook');
  try {
    const initGit = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
    assert.equal(initGit.status, 0, initGit.stderr);
    const hookPath = join(root, '.git/hooks/pre-commit');
    mkdirSync(dirname(hookPath), { recursive: true });
    const customHook = '#!/bin/sh\n# node scripts/ensure-branch.mjs --check-only\n# node scripts/validate.mjs\nnpm run lint\n';
    writeFileSync(hookPath, customHook, 'utf8');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    assert.equal(readFileSync(hookPath, 'utf8'), customHook, 'commented examples do not make a hook Throughline-managed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs refreshes a recognized older Throughline pre-commit hook', () => {
  const root = makeProject('sync-managed-hook');
  try {
    const initGit = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
    assert.equal(initGit.status, 0, initGit.stderr);
    const hookPath = join(root, '.git/hooks/pre-commit');
    mkdirSync(dirname(hookPath), { recursive: true });
    writeFileSync(hookPath, '#!/usr/bin/env sh\nnode scripts/ensure-branch.mjs --check-only\nnode scripts/validate.mjs\n# Throughline 0.2 hook\n', 'utf8');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    assert.equal(readFileSync(hookPath, 'utf8'), readFileSync(join(root, '.githooks/pre-commit'), 'utf8'));
    assert.match(apply.stdout, /pre-commit \(refreshed from \.githooks\/pre-commit\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs installs a pre-commit hook for the first time, not just refreshes an existing one', () => {
  const root = makeProject('sync-hook-first-install');
  try {
    const initGit = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
    assert.equal(initGit.status, 0, initGit.stderr);
    assert.equal(existsSync(join(root, '.git/hooks/pre-commit')), false, 'no hook installed yet');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    assert.equal(existsSync(join(root, '.git/hooks/pre-commit')), true, 'first-time install must happen, not just refresh');
    assert.equal(readFileSync(join(root, '.git/hooks/pre-commit'), 'utf8'), readFileSync(join(root, '.githooks/pre-commit'), 'utf8'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs recomputes legacyContractGrace on a later --apply once backlog.json goes from empty to containing real gaps (the adopt-project two-phase case)', () => {
  const root = makeProject('sync-grace-two-phase');
  try {
    writeJson(join(root, 'docs/engineering/backlog.json'), { schema: 2, project: 'Fixture', prd: 'docs/product/06-prd.md', epics: [], stories: [] });
    const first = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(JSON.parse(readFileSync(join(root, '.throughline/plugin-version.json'), 'utf8')).legacyContractGrace, false, 'nothing to grace yet -- backlog is still empty');

    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog({
      stories: [{ id: 'S-1', title: 'Reconciled from GH issue', epic: 'E-1', acceptance: 'It works.', blocked_by: [], status: 'notstarted', order: 0, gh_issue: 12 }],
    }));
    const second = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(JSON.parse(readFileSync(join(root, '.throughline/plugin-version.json'), 'utf8')).legacyContractGrace, true, 'the second call must catch the now-real gap the first call could not see yet');

    const validate = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(validate.status, 0, validate.stderr || validate.stdout);
    assert.match(validate.stdout, /WARN 1 legacy-contract gap/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a bare git repo with nothing but a hand-copied sync-plugin.mjs can bootstrap its own full scaffold, matching adopt-project step 1', () => {
  const root = join(tmpdir(), `throughline-adopt-bootstrap-${process.pid}-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  try {
    const initGit = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
    assert.equal(initGit.status, 0, initGit.stderr);
    mkdirSync(join(root, 'scripts'), { recursive: true });
    copyFileSync(join(assetsRoot, 'scripts/sync-plugin.mjs'), join(root, 'scripts/sync-plugin.mjs'));

    const dryRun = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot]);
    assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
    assert.equal(existsSync(join(root, 'scripts/validate.mjs')), false, 'report-only must not have written anything yet');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--from=' + repoRoot, '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    for (const rel of ['scripts/validate.mjs', 'scripts/ensure-branch.mjs', 'scripts/init-project.mjs', 'scripts/coverage.mjs', '.githooks/pre-commit', 'docs/engineering/backlog.schema.json']) {
      assert.equal(existsSync(join(root, rel)), true, rel + ' must exist after --apply');
    }
    assert.equal(existsSync(join(root, '.git/hooks/pre-commit')), true, 'the live hook must be installed, not just the source copy');

    const branchCheck = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--skill=adopt-project']);
    assert.equal(branchCheck.status, 0, branchCheck.stderr || branchCheck.stdout);
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

test('ensure-branch.mjs no-ops when no git repo exists yet', () => {
  const root = makeProject('ensure-branch-no-repo');
  try {
    const result = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--skill=define-brief']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function initGitWithCommit(root) {
  assert.equal(spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: root, encoding: 'utf8' }).status, 0);
  writeFileSync(join(root, 'seed.txt'), 'seed\n', 'utf8');
  assert.equal(spawnSync('git', ['add', 'seed.txt'], { cwd: root, encoding: 'utf8' }).status, 0);
  assert.equal(spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'seed'], { cwd: root, encoding: 'utf8' }).status, 0);
}

function currentBranch(root) {
  return spawnSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).stdout.trim();
}

test('ensure-branch.mjs auto-creates and switches off main, then is a no-op once off it', () => {
  const root = makeProject('ensure-branch-auto');
  try {
    initGitWithCommit(root);
    const first = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--skill=define-brief']);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.match(first.stdout, /Created and switched to feature\/define-brief-/);
    assert.match(currentBranch(root), /^feature\/define-brief-/);

    const second = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--skill=define-brief']);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.match(second.stdout, /-- OK\.$/m);
    assert.match(currentBranch(root), /^feature\/define-brief-/, 'second run must not create yet another branch');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ensure-branch.mjs --name always lands on that exact branch: create, switch, and no-op cases', () => {
  const root = makeProject('ensure-branch-named');
  try {
    initGitWithCommit(root);

    const created = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--skill=define-epic', '--name=epic/E-1-thing']);
    assert.equal(created.status, 0, created.stderr || created.stdout);
    assert.match(created.stdout, /Created and switched to epic\/E-1-thing/);
    assert.equal(currentBranch(root), 'epic/E-1-thing');

    const noop = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--skill=implement-epic', '--name=epic/E-1-thing']);
    assert.equal(noop.status, 0, noop.stderr || noop.stdout);
    assert.match(noop.stdout, /On epic\/E-1-thing already/);

    assert.equal(spawnSync('git', ['checkout', '-q', 'main'], { cwd: root, encoding: 'utf8' }).status, 0);
    const switched = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--skill=implement-epic', '--name=epic/E-1-thing']);
    assert.equal(switched.status, 0, switched.stderr || switched.stdout);
    assert.match(switched.stdout, /^Switched to epic\/E-1-thing/m);
    assert.equal(currentBranch(root), 'epic/E-1-thing');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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

test('ensure-branch.mjs --check-only blocks on main/master without mutating, and passes off it', () => {
  const root = makeProject('ensure-branch-check-only');
  try {
    initGitWithCommit(root);
    const onMain = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--check-only']);
    assert.notEqual(onMain.status, 0);
    assert.match(onMain.stderr, /never commits directly to main/);
    assert.equal(currentBranch(root), 'main', '--check-only must never create or switch branches');

    assert.equal(spawnSync('git', ['checkout', '-qb', 'some/work'], { cwd: root, encoding: 'utf8' }).status, 0);
    const offMain = runNode(root, join(root, 'scripts/ensure-branch.mjs'), ['--check-only']);
    assert.equal(offMain.status, 0, offMain.stderr || offMain.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the bundled pre-commit hook rejects a commit on main via ensure-branch.mjs --check-only, and allows it off main', () => {
  const root = makeProject('pre-commit-branch-backstop');
  try {
    initGitWithCommit(root);
    const hookDest = join(root, '.git/hooks/pre-commit');
    copyFileSync(join(root, '.githooks/pre-commit'), hookDest);
    try { chmodSync(hookDest, 0o755); } catch {}

    writeFileSync(join(root, 'change.txt'), 'change\n', 'utf8');
    spawnSync('git', ['add', 'change.txt'], { cwd: root, encoding: 'utf8' });
    const blocked = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'change on main'], { cwd: root, encoding: 'utf8' });
    assert.notEqual(blocked.status, 0, 'commit on main must be rejected by the hook');
    assert.match(blocked.stderr + blocked.stdout, /never commits directly to main/);

    assert.equal(spawnSync('git', ['checkout', '-qb', 'feature/change'], { cwd: root, encoding: 'utf8' }).status, 0);
    const allowed = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'change on feature branch'], { cwd: root, encoding: 'utf8' });
    assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ship-feature exists alongside ship-epic and scopes G7 by feature slug instead of an epic id', () => {
  const skillPath = join(repoRoot, 'skills/ship-feature/SKILL.md');
  assert.equal(existsSync(skillPath), true);
  const text = readFileSync(skillPath, 'utf8');
  assert.match(text, /name: ship-feature/);
  assert.match(text, /--subject <feature-slug>/);
  assert.match(text, /ensure-branch\.mjs --check-only/);
});

test('release skill requires project prerequisites and subject-scoped G7 for every release epic before G8', () => {
  const text = readFileSync(join(repoRoot, 'skills/release/SKILL.md'), 'utf8');
  assert.match(text, /gate\.mjs check G1/);
  assert.match(text, /gate\.mjs check G2/);
  assert.match(text, /gate\.mjs check G3/);
  assert.match(text, /gate\.mjs check G4/);
  assert.match(text, /gate\.mjs check G5/);
  assert.match(text, /gate\.mjs check G7 --subject <epic-id>/);
  assert.match(text, /each epic tagged.*release/i);
  assert.match(text, /Before presenting for G8:[^\n]*G1[^\n]*G5[^\n]*subject-scoped G7/);
});

test('define-feature and implement-feature exist, standalone mode staying non-backlog-tracked like ship-feature', () => {
  const definePath = join(repoRoot, 'skills/define-feature/SKILL.md');
  const implementPath = join(repoRoot, 'skills/implement-feature/SKILL.md');
  assert.equal(existsSync(definePath), true);
  assert.equal(existsSync(implementPath), true);

  const define = readFileSync(definePath, 'utf8');
  assert.match(define, /name: define-feature/);
  // Shares one continuous branch with implement-feature, the same way define-epic/implement-epic do.
  assert.match(define, /ensure-branch\.mjs --skill=define-feature --name=feature\/<slug>/);
  // Local mode never files a GitHub issue; source of truth stays spec.md either way.
  assert.match(define, /tracker: local.*done/);
  assert.match(define, /tracker: github/);
  assert.match(define, /never a replacement for it|mirrors are never sources of truth|mirrors, never sources of truth/);

  const implement = readFileSync(implementPath, 'utf8');
  assert.match(implement, /name: implement-feature/);
  assert.match(implement, /ensure-branch\.mjs --skill=implement-feature --name=feature\/<slug>/);
  // Standalone mode must never merge/push itself -- that stays ship-feature's job, same split implement-epic keeps from ship-epic.
  assert.match(implement, /never merges or pushes/);
  assert.doesNotMatch(implement, /gh pr merge|git merge --no-ff/);
});

test('define-feature and implement-feature epic-linked mode shares the epic branch and never ships via ship-feature', () => {
  const define = readFileSync(join(repoRoot, 'skills/define-feature/SKILL.md'), 'utf8');
  const implement = readFileSync(join(repoRoot, 'skills/implement-feature/SKILL.md'), 'utf8');

  // Epic-linked mode reuses define-epic/implement-epic's own shared branch, not a fresh feature/<slug> one --
  // orphaning a story's spec off that branch would strand it from implement-epic's continuation.
  assert.match(define, /ensure-branch\.mjs --skill=define-feature --name=epic\/<epic-id>-<slug>/);
  assert.match(implement, /ensure-branch\.mjs --skill=implement-feature --name=epic\/<epic-id>-<slug>/);

  // A single story can never ship out of the shared epic branch on its own -- ship-epic's own gate-in
  // requires every story done, so epic-linked implement-feature must hand off to ship-epic, not ship-feature.
  assert.match(implement, /never hands off to `ship-feature`/);
  assert.match(implement, /ship-epic.*gate-in requires every story/);

  const shipFeature = readFileSync(join(repoRoot, 'skills/ship-feature/SKILL.md'), 'utf8');
  assert.match(shipFeature, /epic-linked mode/);
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

test('validate.mjs fails loud when feature working state is written under .claude/ instead of .throughline/', () => {
  const root = makeProject('misplaced-feature-state');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());

    const before = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(before.status, 0, before.stderr || before.stdout);

    mkdirSync(join(root, '.claude/feature-readme-fix'), { recursive: true });
    writeFileSync(join(root, '.claude/feature-readme-fix/spec.md'), '# spec\n', 'utf8');

    const after = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.notEqual(after.status, 0);
    assert.match(after.stdout + after.stderr, /\.claude\/feature-readme-fix.*must live under \.throughline\//);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs --repair-state reports then moves epic and feature state from every supported legacy root', () => {
  const root = makeProject('repair-state');
  try {
    approvePrd(root);
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());

    mkdirSync(join(root, '.claude/epic-1'), { recursive: true });
    writeFileSync(join(root, '.claude/epic-1/ledger.md'), '# ledger\n', 'utf8');
    mkdirSync(join(root, '.claude/feature-readme-fix'), { recursive: true });
    writeFileSync(join(root, '.claude/feature-readme-fix/spec.md'), '# spec\n', 'utf8');
    mkdirSync(join(root, '.cursor/feature-status-fix'), { recursive: true });
    writeFileSync(join(root, '.cursor/feature-status-fix/spec.md'), '# cursor spec\n', 'utf8');
    writeFileSync(join(root, '.claude/gates.json'), '{}', 'utf8');

    const report = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--repair-state']);
    assert.equal(report.status, 0, report.stderr || report.stdout);
    assert.match(report.stdout, /\.claude\/epic-1/);
    assert.match(report.stdout, /\.claude\/feature-readme-fix/);
    assert.match(report.stdout, /\.cursor\/feature-status-fix/);
    assert.match(report.stdout, /\.claude\/gates\.json/);
    assert.equal(existsSync(join(root, '.claude/epic-1')), true, 'report-only mode must not move anything');
    assert.equal(existsSync(join(root, '.claude/feature-readme-fix')), true, 'report-only mode must not move feature state');
    assert.equal(existsSync(join(root, '.cursor/feature-status-fix')), true, 'report-only mode must not move feature state from another root');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--repair-state', '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    assert.equal(existsSync(join(root, '.claude/epic-1')), false);
    assert.equal(existsSync(join(root, '.claude/feature-readme-fix')), false);
    assert.equal(existsSync(join(root, '.cursor/feature-status-fix')), false);
    assert.equal(existsSync(join(root, '.throughline/epic-1/ledger.md')), true);
    assert.equal(readFileSync(join(root, '.throughline/feature-readme-fix/spec.md'), 'utf8'), '# spec\n');
    assert.equal(readFileSync(join(root, '.throughline/feature-status-fix/spec.md'), 'utf8'), '# cursor spec\n');
    assert.equal(existsSync(join(root, '.throughline/gates.json')), true);

    const validate = runNode(root, join(root, 'scripts/validate.mjs'));
    assert.equal(validate.status, 0, validate.stderr || validate.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sync-plugin.mjs --repair-state flags a feature conflict instead of overwriting an existing .throughline/ destination', () => {
  const root = makeProject('repair-conflict');
  try {
    mkdirSync(join(root, '.throughline/feature-readme-fix'), { recursive: true });
    writeFileSync(join(root, '.throughline/feature-readme-fix/spec.md'), 'real spec\n', 'utf8');
    mkdirSync(join(root, '.claude/feature-readme-fix'), { recursive: true });
    writeFileSync(join(root, '.claude/feature-readme-fix/spec.md'), 'stray duplicate\n', 'utf8');

    const apply = runNode(root, join(root, 'scripts/sync-plugin.mjs'), ['--repair-state', '--apply']);
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    assert.match(apply.stdout, /CONFLICT/);
    assert.equal(readFileSync(join(root, '.throughline/feature-readme-fix/spec.md'), 'utf8'), 'real spec\n', 'the real feature spec must not be overwritten');
    assert.equal(existsSync(join(root, '.claude/feature-readme-fix')), true, 'a conflicting feature must be left in place, not silently dropped');
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

test('build-dashboard.mjs Planning section renders a muted fallback when .throughline/gates.json is absent', () => {
  const root = makeProject('dashboard-gates-absent');
  try {
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());
    const result = runNode(root, join(root, 'scripts/build-dashboard.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(root, 'PROGRESS_DASHBOARD.html'), 'utf8');
    assert.match(html, /<h2>Planning<\/h2>/);
    assert.match(html, /not tracked yet/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build-dashboard.mjs Planning section renders a gate pipeline strip from .throughline/gates.json, marking the first non-approved gate current', () => {
  const root = makeProject('dashboard-gates-present');
  try {
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());
    writeJson(join(root, '.throughline/gates.json'), {
      gates: {
        G1: { status: 'approved' },
        'G1.5': { status: 'approved' },
        G2: { status: 'rejected' },
      },
    });
    const result = runNode(root, join(root, 'scripts/build-dashboard.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(root, 'PROGRESS_DASHBOARD.html'), 'utf8');
    assert.match(html, /<span class="gate approved" title="G1: approved">G1<\/span>/);
    // G2 is the first non-approved gate (rejected still blocks the pipeline) -> "current".
    assert.match(html, /<span class="gate rejected current" title="G2: rejected">G2<\/span>/);
    // G3 has no entry at all -> defaults to pending, and is NOT current (G2 already claimed it).
    assert.match(html, /<span class="gate pending" title="G3: pending">G3<\/span>/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build-dashboard.mjs Roadmap falls back to a flat epic table when backlog.json has no phases', () => {
  const root = makeProject('dashboard-roadmap-no-phases');
  try {
    writeJson(join(root, 'docs/engineering/backlog.json'), baseBacklog());
    const result = runNode(root, join(root, 'scripts/build-dashboard.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(root, 'PROGRESS_DASHBOARD.html'), 'utf8');
    assert.match(html, /<div class="roadmap">/);
    assert.doesNotMatch(html, /class="phasegroup"/);
    assert.match(html, /E-1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build-dashboard.mjs Roadmap groups epics by phase, ordered by phases[].order, with unphased epics last', () => {
  const root = makeProject('dashboard-roadmap-phases');
  try {
    writeJson(join(root, 'docs/engineering/backlog.json'), {
      schema: 2, project: 'Fixture', prd: 'docs/product/06-prd.md', tracker: 'local',
      phases: [
        { id: 'discovery', name: 'Discovery', order: 1 },
        { id: 'build', name: 'Build', order: 0 },
      ],
      epics: [
        { id: 'E-1', title: 'Foundation', order: 0, phase: 'build', release: 'v1', prd_ref: 'REQ-01' },
        { id: 'E-2', title: 'Research', order: 1, phase: 'discovery', release: 'v1', prd_ref: 'REQ-02' },
        { id: 'E-3', title: 'Orphan', order: 2, release: 'v1', prd_ref: 'REQ-03' },
      ],
      stories: [
        { id: 'S-1', title: 'x', epic: 'E-1', prd_ref: 'REQ-01', acceptance: 'x', blocked_by: [], status: 'notstarted', order: 0 },
        { id: 'S-2', title: 'x', epic: 'E-2', prd_ref: 'REQ-02', acceptance: 'x', blocked_by: [], status: 'notstarted', order: 0 },
        { id: 'S-3', title: 'x', epic: 'E-3', prd_ref: 'REQ-03', acceptance: 'x', blocked_by: [], status: 'notstarted', order: 0 },
      ],
    });
    const result = runNode(root, join(root, 'scripts/build-dashboard.mjs'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = readFileSync(join(root, 'PROGRESS_DASHBOARD.html'), 'utf8');
    const roadmap = html.slice(html.indexOf('<div class="roadmap">'));
    const buildAt = roadmap.indexOf('>Build<');
    const discoveryAt = roadmap.indexOf('>Discovery<');
    const unphasedAt = roadmap.indexOf('>Unphased<');
    assert.ok(buildAt !== -1 && discoveryAt !== -1 && unphasedAt !== -1, roadmap);
    // phases[].order: build(0) before discovery(1); unphased epics render last regardless.
    assert.ok(buildAt < discoveryAt, 'Build phase must render before Discovery phase');
    assert.ok(discoveryAt < unphasedAt, 'Unphased epics must render after named phases');
    assert.ok(roadmap.indexOf('E-1') > buildAt && roadmap.indexOf('E-1') < discoveryAt);
    assert.ok(roadmap.indexOf('E-2') > discoveryAt && roadmap.indexOf('E-2') < unphasedAt);
    assert.ok(roadmap.indexOf('E-3') > unphasedAt);
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
