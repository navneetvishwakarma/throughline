#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsRoot = join(root, 'skills/bootstrap-project/assets');
const errors = [];

function fail(message) {
  errors.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(path + ': ' + error.message);
    return null;
  }
}

function run(cwd, args) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) fail(args.join(' ') + '\n' + (result.stderr || result.stdout));
  return result;
}

function checkManifest(path, requiredFields) {
  const manifest = readJson(path);
  if (!manifest) return null;
  for (const field of requiredFields) {
    if (!manifest[field]) fail(path + ' missing ' + field);
  }
  return manifest;
}

function checkManifests() {
  const claude = checkManifest(join(root, 'adapters/claude/.claude-plugin/plugin.json'), ['name', 'version', 'description', 'author']);
  const codex = checkManifest(join(root, 'adapters/codex/.codex-plugin/plugin.json'), ['name', 'version', 'description', 'author', 'skills', 'interface']);
  const rootCodex = checkManifest(join(root, '.codex-plugin/plugin.json'), ['name', 'version', 'description', 'author', 'skills', 'interface']);
  const marketplace = readJson(join(root, '.agents/plugins/marketplace.json'));
  if (!claude || !codex || !rootCodex || !marketplace) return;
  if (claude.name !== 'throughline') fail('Claude adapter manifest name must be throughline');
  if (codex.name !== 'throughline') fail('Codex adapter manifest name must be throughline');
  if (rootCodex.name !== 'throughline') fail('Root Codex manifest name must be throughline');
  if (codex.skills !== './skills/') fail('Codex adapter must expose ./skills/');
  if (rootCodex.skills !== './skills/') fail('Root Codex manifest must expose ./skills/');
  const entry = marketplace.plugins?.find((plugin) => plugin.name === 'throughline');
  if (!entry) fail('.agents/plugins/marketplace.json missing throughline entry');
  if (entry?.source?.path !== './') fail('repo Codex marketplace must point at ./');
  if (entry?.policy?.installation !== 'AVAILABLE') fail('repo Codex marketplace install policy must be AVAILABLE');
  if (entry?.policy?.authentication !== 'ON_INSTALL') fail('repo Codex marketplace auth policy must be ON_INSTALL');
}

function checkLegacyManifest() {
  const manifest = readJson(join(root, '.claude-plugin/plugin.json'));
  if (!manifest) return;
  for (const field of ['name', 'version', 'description', 'author']) {
    if (!manifest[field]) fail('.claude-plugin/plugin.json missing ' + field);
  }
}

function checkSkills() {
  const skillsDir = join(root, 'skills');
  const skillNames = [];
  for (const entry of readDir(skillsDir)) {
    const skillPath = join(skillsDir, entry, 'SKILL.md');
    if (!existsSync(skillPath)) continue;
    const text = readFileSync(skillPath, 'utf8');
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) {
      fail(skillPath + ': missing YAML frontmatter');
      continue;
    }
    if (!/^name:\s*\S+/m.test(frontmatter[1])) fail(skillPath + ': missing name');
    if (!/^description:\s*.+/m.test(frontmatter[1])) fail(skillPath + ': missing description');
    skillNames.push(entry);
  }
  if (skillNames.length === 0) fail('No skills found');
}

function readDir(path) {
  try {
    return readdirSync(path);
  } catch (error) {
    fail(path + ': ' + error.message);
    return [];
  }
}

function checkScriptSyntax() {
  for (const script of ['init-project.mjs', 'validate.mjs', 'sync-status.mjs', 'build-dashboard.mjs', 'gate.mjs', 'coverage.mjs', 'sync-plugin.mjs', 'check-docs.mjs', 'ensure-branch.mjs']) {
    run(root, [process.execPath, '--check', join(assetsRoot, 'scripts', script)]);
  }
}

function checkEvals() {
  const evals = readJson(join(root, 'evals/evals.json'));
  if (!evals) return;
  if (evals.skill_name !== 'throughline') fail('evals/evals.json skill_name must be throughline');
  if (!Array.isArray(evals.evals) || evals.evals.length < 5) fail('evals/evals.json must contain at least 5 evals');
  for (const item of evals.evals || []) {
    if (!item.prompt) fail('eval ' + item.id + ' missing prompt');
    if (!item.expected_output) fail('eval ' + item.id + ' missing expected_output');
    if (!Array.isArray(item.assertions) || item.assertions.length < 3) fail('eval ' + item.id + ' needs at least 3 assertions');
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function checkScaffold() {
  const tmp = mkdtempSync(join(tmpdir(), 'throughline-doctor-'));
  try {
    cpSync(assetsRoot, tmp, { recursive: true });
    run(tmp, [process.execPath, join(tmp, 'scripts/init-project.mjs'), 'Doctor Fixture']);
    run(tmp, [process.execPath, join(tmp, 'scripts/validate.mjs')]);

    // A fresh scaffold's PRD placeholders are unfilled by design — explicit --tier=product
    // must catch that (not report a false pass). Blanket (no --tier) mode deliberately does
    // NOT check an unapproved tier (a headless project's untouched docs/design/README.md
    // must not fail CI forever), so this has to ask for the product tier explicitly — the
    // same way define-product's own automated gate does. Must run before the PRD gets
    // flipped to `approved` below for the backlog-validation checks. Call spawnSync
    // directly: a non-zero exit here is the correct outcome, not a doctor failure.
    const checkDocsTier = spawnSync(process.execPath, [join(tmp, 'scripts/check-docs.mjs'), '--tier=product', '--json'], { cwd: tmp, encoding: 'utf8', windowsHide: true });
    const checkDocsTierSummary = JSON.parse(checkDocsTier.stdout || '{}');
    if (checkDocsTierSummary.passed !== false || !(checkDocsTierSummary.errors || []).some((e) => e.includes('missing Acceptance'))) {
      fail('check-docs.mjs --tier=product should report the fresh scaffold\'s unfilled PRD placeholders as failures (parser regression?):\n' + checkDocsTier.stdout);
    }

    // Blanket mode on that same still-unapproved scaffold must report a clean pass — the
    // regression guard for the approved-gating logic itself.
    const checkDocsBlanket = spawnSync(process.execPath, [join(tmp, 'scripts/check-docs.mjs'), '--json'], { cwd: tmp, encoding: 'utf8', windowsHide: true });
    const checkDocsBlanketSummary = JSON.parse(checkDocsBlanket.stdout || '{}');
    if (checkDocsBlanketSummary.passed !== true) {
      fail('check-docs.mjs (blanket, no --tier) should pass on a fresh scaffold where nothing has been approved yet — it must not enforce a tier before its own gate has been cleared once:\n' + checkDocsBlanket.stdout);
    }

    const prdPath = join(tmp, 'docs/product/06-prd.md');
    writeFileSync(prdPath, readFileSync(prdPath, 'utf8').replace('status: draft', 'status: approved'), 'utf8');
    writeJson(join(tmp, 'docs/engineering/backlog.json'), {
      schema: 2,
      project: 'Doctor Fixture',
      prd: 'docs/product/06-prd.md',
      tracker: 'local',
      epics: [{ id: 'E-1', title: 'Foundation', order: 0, vertical: false, prd_ref: 'REQ-01' }],
      stories: [{
        id: 'S-1',
        title: 'Create shell',
        epic: 'E-1',
        prd_ref: 'REQ-01',
        acceptance: 'The shell renders.',
        blocked_by: [],
        status: 'notstarted',
        order: 0,
      }],
    });
    run(tmp, [process.execPath, join(tmp, 'scripts/validate.mjs')]);
    run(tmp, [process.execPath, join(tmp, 'scripts/gate.mjs'), 'approve', 'G6', '--note', 'doctor fixture']);
    run(tmp, [process.execPath, join(tmp, 'scripts/gate.mjs'), 'check', 'G6']);
    run(tmp, [process.execPath, join(tmp, 'scripts/build-dashboard.mjs')]);
    if (!existsSync(join(tmp, 'PROGRESS_DASHBOARD.html'))) fail('dashboard was not generated');

    const coverage = run(tmp, [process.execPath, join(tmp, 'scripts/coverage.mjs'), '--json']);
    const coverageSummary = JSON.parse(coverage.stdout || '{}');
    if (coverageSummary.status !== 'skipped') fail('coverage.mjs should report "skipped" against a fixture with no product code (got ' + coverageSummary.status + ')');

    const sync = run(tmp, [process.execPath, join(tmp, 'scripts/sync-plugin.mjs'), '--from=' + root]);
    if (!/added:\s+\(none\)/.test(sync.stdout) || !/unchanged: \d+ file/.test(sync.stdout) || /needs review/.test(sync.stdout)) {
      fail('sync-plugin.mjs against a freshly-scaffolded fixture should report nothing added, everything unchanged, no needs-review — the allowlist or AGENTS.md rendering has drifted from what init-project.mjs actually produces:\n' + sync.stdout);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

checkLegacyManifest();
checkManifests();
checkSkills();
checkScriptSyntax();
checkEvals();
checkScaffold();

if (errors.length) {
  console.error('FAIL throughline doctor found ' + errors.length + ' problem(s):');
  for (const error of errors) console.error('  - ' + error);
  process.exit(1);
}

console.log('OK throughline doctor passed');
