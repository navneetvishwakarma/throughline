#!/usr/bin/env node
// Resolve and (optionally) apply the release version per backlog.json's `versioning`
// policy. package.json's `version` field is the source of truth; `versioning.current`
// in backlog.json and any `versioning.targets` are kept in lockstep by --apply — never
// the other way around, and never guessed silently.
//
// Modes:
//   node scripts/bump-version.mjs                report current version + a suggestion
//                                                 (if the policy computes one), writes nothing
//   node scripts/bump-version.mjs --set=1.2.0     use this exact version instead of any
//                                                 suggestion — always allowed; this is the
//                                                 whole of "manual" mode
//   node scripts/bump-version.mjs --apply         write the resolved version into
//                                                 package.json, versioning.current, and
//                                                 every versioning.targets entry
//   node scripts/bump-version.mjs --set=1.2.0 --apply    resolve + write in one step
//
// versioning.bump: "manual" (the default, and the default when no `versioning` key exists
// at all) refuses --apply without an explicit --set. A resolved version that is not
// strictly greater than the current one also refuses --apply, so a re-run can't silently
// re-stamp the same number as if it were new. Fails loud (exit 2) on malformed config —
// never disables itself quietly, matching coverage.mjs's own convention for config errors.
//
// Every versioning.targets entry is validated AND its new content computed up front, before
// package.json or backlog.json is touched — a single bad target can never leave the repo
// half-bumped (some manifests updated, others not, with the "not greater than current" guard
// then blocking a clean retry).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { SEMVER_RE, checkTargetShape, compareVersions } from './lib/versioning.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const setArg = args.find((a) => a.startsWith('--set='))?.slice('--set='.length);

function fail(msg) { console.error('ERROR ' + msg); process.exit(2); }
function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }
// Preserves the target file's existing line-ending style (CRLF vs LF) instead of always
// emitting bare LF — a JSON.stringify + writeFileSync round-trip on a CRLF file would
// otherwise turn a one-field version bump into a full-file diff on every line.
function detectEol(p) {
  if (!existsSync(p)) return '\n';
  const content = readFileSync(p, 'utf8');
  const idx = content.indexOf('\n');
  return idx > 0 && content[idx - 1] === '\r' ? '\r\n' : '\n';
}
function writeJson(p, value) {
  const eol = detectEol(p);
  const json = JSON.stringify(value, null, 2) + '\n';
  writeFileSync(p, eol === '\r\n' ? json.replace(/\n/g, '\r\n') : json, 'utf8');
}

const pkgPath = join(root, 'package.json');
if (!existsSync(pkgPath)) fail('package.json not found at ' + pkgPath);
const pkg = readJson(pkgPath);
const currentVersion = pkg.version || '0.0.0';
if (!SEMVER_RE.test(currentVersion)) fail('package.json version ' + JSON.stringify(currentVersion) + ' is not valid semver');

const backlogPath = join(root, 'docs/engineering/backlog.json');
let backlog = null;
if (existsSync(backlogPath)) {
  try { backlog = readJson(backlogPath); }
  catch (e) { fail('docs/engineering/backlog.json exists but could not be parsed: ' + e.message); }
}
const versioning = backlog?.versioning || {};
const scheme = versioning.scheme || 'semver';
const bumpMode = versioning.bump || 'manual';
if (scheme !== 'semver') fail("versioning.scheme " + JSON.stringify(scheme) + " is not supported (only 'semver')");

function bumped(v, level) {
  const m = SEMVER_RE.exec(v);
  const major = Number(m[1]), minor = Number(m[2]), patch = Number(m[3]);
  if (level === 'major') return (major + 1) + '.0.0';
  if (level === 'minor') return major + '.' + (minor + 1) + '.0';
  return major + '.' + minor + '.' + (patch + 1);
}

function suggestFromConventionalCommits() {
  let lastTag = null;
  const describe = spawnSync('git', ['describe', '--tags', '--abbrev=0'], { cwd: root, encoding: 'utf8' });
  if (describe.status === 0) lastTag = describe.stdout.trim();
  const range = lastTag ? lastTag + '..HEAD' : 'HEAD';
  const log = spawnSync('git', ['log', range, '--pretty=%s%n%b', '--no-merges'], { cwd: root, encoding: 'utf8' });
  if (log.status !== 0) return { level: null, reason: 'not a git repo or no commits — cannot infer from conventional commits' };
  const text = log.stdout;
  const lines = text.split('\n').filter((l) => l.trim());
  if (/BREAKING CHANGE|^\w+(\([^)]*\))?!:/m.test(text)) return { level: 'major', reason: 'a commit since ' + (lastTag || 'the start of history') + ' declares a breaking change' };
  if (/^feat(\([^)]*\))?:/m.test(text)) return { level: 'minor', reason: 'a feat: commit since ' + (lastTag || 'the start of history') };
  if (lines.length) return { level: 'patch', reason: 'commits since ' + (lastTag || 'the start of history') + ', none feat/breaking' };
  return { level: null, reason: 'no commits since ' + (lastTag || 'the start of history') };
}

// An epic already fully shipped (every one of its stories is done) no longer counts toward
// the breaking check — otherwise a breaking epic keeps forcing a "major" suggestion forever,
// long after that breaking change was captured in an earlier bump.
function isEpicFullyShipped(epicId, stories) {
  const cs = stories.filter((s) => s.epic === epicId);
  return cs.length > 0 && cs.every((s) => s.status === 'done');
}

function suggestFromEpics() {
  if (!backlog) return { level: null, reason: 'backlog.json not readable' };
  const release = backlog.release_in_flight || 'v1';
  const epics = (backlog.epics || []).filter((e) => (e.release || 'v1') === release);
  if (!epics.length) return { level: null, reason: 'no epics found for release ' + JSON.stringify(release) };
  const stories = backlog.stories || [];
  const openBreaking = epics.filter((e) => e.breaking === true && !isEpicFullyShipped(e.id, stories));
  if (openBreaking.length) return { level: 'major', reason: 'epic(s) ' + openBreaking.map((e) => e.id).join(', ') + ' in release ' + release + ' are flagged breaking: true and not yet fully shipped' };
  return { level: 'minor', reason: 'epics shipped in release ' + release + ', no unshipped epic flagged breaking' };
}

let suggestion = { level: null, reason: null };
if (bumpMode === 'conventional-commits') suggestion = suggestFromConventionalCommits();
else if (bumpMode === 'epic-driven') suggestion = suggestFromEpics();

const suggestedVersion = suggestion.level ? bumped(currentVersion, suggestion.level) : null;

let resolved = null;
if (setArg) {
  if (!SEMVER_RE.test(setArg)) fail('--set=' + JSON.stringify(setArg) + ' is not valid semver (expected X.Y.Z)');
  resolved = setArg;
} else if (suggestedVersion) {
  resolved = suggestedVersion;
}

console.log('current version: ' + currentVersion + ' (package.json)');
console.log('versioning.bump: ' + bumpMode + (versioning.bump ? '' : ' (default — no versioning key in backlog.json)'));
if (bumpMode !== 'manual') {
  console.log(suggestedVersion ? 'suggested: ' + suggestedVersion + ' (' + suggestion.reason + ')' : 'suggested: none (' + suggestion.reason + ')');
}
if (setArg) console.log('using --set: ' + setArg);

if (!apply) {
  console.log('\nreport only: no files were written. Rerun with --apply' + (resolved ? '' : ' (and --set=X.Y.Z, since versioning.bump is manual and no suggestion was computed)') + ' to write.');
  process.exit(0);
}

if (!resolved) fail('nothing to apply — versioning.bump is ' + JSON.stringify(bumpMode) + (bumpMode === 'manual' ? '; pass --set=X.Y.Z' : '; no suggestion could be computed, pass --set=X.Y.Z explicitly'));
if (compareVersions(resolved, currentVersion) <= 0) fail('resolved version ' + resolved + ' is not greater than the current version ' + currentVersion + ' — refusing to apply (already applied? check package.json)');

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== 'object') fail("target path '" + path + "' does not exist in the file");
    cur = cur[parts[i]];
  }
  if (cur == null || typeof cur !== 'object') fail("target path '" + path + "' does not exist in the file");
  const last = parts[parts.length - 1];
  if (!(last in cur)) fail("target path '" + path + "' does not exist in the file");
  cur[last] = value;
}

const targets = versioning.targets || [];
const byPath = new Map();
targets.forEach((t, i) => {
  checkTargetShape(t, 'versioning.targets[' + i + ']', fail);
  if (!byPath.has(t.path)) byPath.set(t.path, []);
  byPath.get(t.path).push(t);
});

// Pass 1: validate every target and compute its new content, writing nothing yet.
const pendingWrites = [];
for (const [relPath, edits] of byPath) {
  const abs = join(root, relPath);
  if (!existsSync(abs)) fail("versioning.targets path '" + relPath + "' does not exist");
  const kinds = new Set(edits.map((e) => e.kind));
  if (kinds.size > 1) fail("versioning.targets path '" + relPath + "' mixes kind json and text — split into separate paths, one kind per file");
  const kind = edits[0].kind;
  if (kind === 'json') {
    const json = readJson(abs);
    for (const e of edits) setPath(json, e.jsonPath, resolved);
    pendingWrites.push({ relPath, abs, kind: 'json', value: json });
  } else {
    let content = readFileSync(abs, 'utf8');
    for (const e of edits) {
      const re = new RegExp(e.pattern, 'd');
      const m = re.exec(content);
      if (!m) fail("versioning.targets pattern for '" + relPath + "' did not match");
      if (m.length - 1 !== 1) fail("versioning.targets pattern for '" + relPath + "' must match with exactly one capture group (found " + (m.length - 1) + ")");
      const span = m.indices && m.indices[1];
      if (!span) fail("versioning.targets pattern for '" + relPath + "' capture group did not participate in the match");
      const [start, end] = span;
      content = content.slice(0, start) + resolved + content.slice(end);
    }
    pendingWrites.push({ relPath, abs, kind: 'text', content });
  }
}

// Pass 2: every target validated and computed — now write. package.json first (the
// documented source of truth), then backlog.json, then every target.
pkg.version = resolved;
writeJson(pkgPath, pkg);
const applied = ['package.json'];

if (backlog) {
  backlog.versioning = { ...versioning, scheme, bump: bumpMode, current: resolved };
  writeJson(backlogPath, backlog);
  applied.push('docs/engineering/backlog.json (versioning.current)');
}

for (const w of pendingWrites) {
  if (w.kind === 'json') writeJson(w.abs, w.value);
  else writeFileSync(w.abs, w.content, 'utf8');
  applied.push(w.relPath);
}

console.log('\napplied: ' + resolved);
applied.forEach((f) => console.log('  - ' + f));
