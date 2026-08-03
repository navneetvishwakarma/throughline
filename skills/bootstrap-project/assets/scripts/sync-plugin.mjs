#!/usr/bin/env node
// Sync platform-owned scaffold files (scripts, templates, workflow.md, schema, CI, hooks,
// AGENTS.md) from the currently installed throughline plugin into this project.
// Never touches backlog.json, .throughline/ working state, or already-materialized
// product/architecture/design docs — those are project content, not scaffold, and are
// left alone whether or not they exist.
//
// Modes:
//   node scripts/sync-plugin.mjs                report only, writes nothing
//   node scripts/sync-plugin.mjs --apply        also write files missing from this project
//   node scripts/sync-plugin.mjs --force=a,b     overwrite only the named flagged files with
//                                                the plugin's version (relative paths, comma-
//                                                separated) — review each one first
//   node scripts/sync-plugin.mjs --force         overwrite ALL flagged files — only after you've
//                                                actually looked at every one; prefer --force=
//   node scripts/sync-plugin.mjs --from=<path>   use an explicit plugin checkout/install
//                                                instead of auto-detecting one
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const root = process.cwd();
const args = process.argv.slice(2);
const forceArg = args.find((a) => a === '--force' || a.startsWith('--force='));
const forceAll = forceArg === '--force';
const forceOnly = forceArg && forceArg.startsWith('--force=') ? new Set(forceArg.slice('--force='.length).split(',').filter(Boolean)) : null;
const apply = args.includes('--apply') || forceAll || forceOnly;
const explicitFrom = args.find((a) => a.startsWith('--from='))?.split('=')[1];

function shouldForce(rel) {
  if (forceAll) return true;
  if (forceOnly) return forceOnly.has(rel);
  return false;
}

function looksLikePluginRoot(p) {
  return existsSync(join(p, 'skills/bootstrap-project/assets')) && existsSync(join(p, 'package.json'));
}

function versionOf(p) {
  try { return JSON.parse(readFileSync(join(p, 'package.json'), 'utf8')).version || '0.0.0'; }
  catch { return '0.0.0'; }
}

function compareSemver(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

function findPluginRoot() {
  if (explicitFrom) {
    if (!looksLikePluginRoot(explicitFrom)) {
      console.error('--from path does not look like a throughline plugin checkout (expected skills/bootstrap-project/assets + package.json): ' + explicitFrom);
      process.exit(1);
    }
    return explicitFrom;
  }
  const home = homedir();
  const candidates = [];
  const claudeBase = join(home, '.claude/plugins/cache/local/throughline');
  if (existsSync(claudeBase)) {
    for (const v of readdirSync(claudeBase)) candidates.push(join(claudeBase, v));
  }
  const codexBase = join(home, 'plugins/throughline');
  if (existsSync(codexBase)) candidates.push(codexBase);
  const valid = candidates.filter(looksLikePluginRoot);
  if (!valid.length) {
    console.error('Could not auto-detect an installed throughline plugin under ~/.claude or ~/plugins.');
    console.error('Pass --from=<path-to-plugin-checkout> (Antigravity installs are per-skill and need this).');
    process.exit(1);
  }
  valid.sort((a, b) => compareSemver(versionOf(a), versionOf(b)));
  return valid[0];
}

const pluginRoot = findPluginRoot();
const assets = join(pluginRoot, 'skills/bootstrap-project/assets');
const pluginPkg = JSON.parse(readFileSync(join(pluginRoot, 'package.json'), 'utf8'));

function readSafe(p) {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

function listTemplates() {
  const dir = join(assets, 'docs/_templates');
  return readdirSync(dir).filter((f) => f.endsWith('.template.md')).map((f) => 'docs/_templates/' + f);
}

const FILES = [
  'scripts/validate.mjs',
  'scripts/gate.mjs',
  'scripts/sync-status.mjs',
  'scripts/build-dashboard.mjs',
  'scripts/coverage.mjs',
  'scripts/init-project.mjs',
  'scripts/sync-plugin.mjs',
  'docs/engineering/workflow.md',
  'docs/engineering/backlog.schema.json',
  'docs/engineering/backlog.seed.json',
  '.githooks/pre-commit',
  '.github/workflows/throughline.yml',
  ...listTemplates(),
];

const results = { added: [], updated: [], unchanged: [], flagged: [] };

function syncFile(rel, newContent) {
  const dest = join(root, rel);
  const oldContent = readSafe(dest);
  if (oldContent == null) {
    results.added.push(rel);
    if (apply) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, newContent, 'utf8'); }
    return;
  }
  if (oldContent === newContent) { results.unchanged.push(rel); return; }
  if (shouldForce(rel)) {
    results.updated.push(rel);
    writeFileSync(dest, newContent, 'utf8');
    return;
  }
  results.flagged.push({ rel, oldLines: oldContent.split('\n').length, newLines: newContent.split('\n').length });
}

for (const rel of FILES) {
  const src = join(assets, rel);
  if (!existsSync(src)) continue;
  syncFile(rel, readFileSync(src, 'utf8'));
}

// AGENTS.md is rendered (project name substituted), not a raw copy — regenerate it from
// the current template using the name already in the existing file, then diff that.
{
  const raw = readFileSync(join(assets, 'docs/_templates/CLAUDE.template.md'), 'utf8');
  const existingAgents = readSafe(join(root, 'AGENTS.md')) || '';
  const nameMatch = existingAgents.match(/^#\s+(.+?)\s+—\s+Agent Operating Manual/m);
  const project = nameMatch ? nameMatch[1] : '<PROJECT_NAME>';
  syncFile('AGENTS.md', raw.replaceAll('<PROJECT_NAME>', project));
}

// .githooks/pre-commit is the source; .git/hooks/pre-commit is the live, installed copy.
// init-project.mjs only installs the hook if none exists yet, so on a midlife project the
// live hook silently never picks up a newer .githooks/pre-commit unless we refresh it here.
if (apply && existsSync(join(root, '.git')) && existsSync(join(root, '.githooks/pre-commit'))) {
  const hookDest = join(root, '.git/hooks/pre-commit');
  const hookSrc = join(root, '.githooks/pre-commit');
  if (readSafe(hookDest) !== readSafe(hookSrc)) {
    mkdirSync(dirname(hookDest), { recursive: true });
    copyFileSync(hookSrc, hookDest);
    try { chmodSync(hookDest, 0o755); } catch {}
    results.updated.push('.git/hooks/pre-commit (refreshed from .githooks/pre-commit)');
  }
}

if (apply) {
  const versionPath = join(root, '.throughline/plugin-version.json');
  const previous = (() => { try { return JSON.parse(readFileSync(versionPath, 'utf8')); } catch { return null; } })();
  const pendingReview = results.flagged.map((f) => f.rel);
  // Never claim the project is at the new version while files are still unresolved —
  // "is this project behind" has to stay honest even after a partial sync.
  const versionRecord = {
    version: pendingReview.length ? (previous?.version ?? null) : pluginPkg.version,
    syncedAt: new Date().toISOString(),
    pendingReview,
  };
  mkdirSync(dirname(versionPath), { recursive: true });
  writeFileSync(versionPath, JSON.stringify(versionRecord, null, 2) + '\n', 'utf8');
}

console.log('throughline plugin ' + pluginPkg.version + ' (from ' + pluginRoot + ')');
console.log('added:     ' + (results.added.length ? results.added.join(', ') : '(none)'));
console.log('unchanged: ' + results.unchanged.length + ' file(s)');
if (results.updated.length) console.log('updated (forced):   ' + results.updated.join(', '));
if (results.flagged.length) {
  console.log('needs review (differs from your copy, NOT overwritten):');
  results.flagged.forEach((f) => console.log('  - ' + f.rel + '  (' + f.oldLines + ' lines here vs ' + f.newLines + ' in the plugin — diff manually, then rerun with --force=' + f.rel + ' to accept the plugin\'s version of just this file)'));
}
if (!apply) console.log('\nreport only: no files were written. Rerun with --apply to add missing files, or --force=<path,...> once you\'ve reviewed a flagged file.');
else if (results.flagged.length) console.log('\napplied. ' + results.flagged.length + ' file(s) above are still unresolved — the version stamp will not claim this project is fully current until they are.');
