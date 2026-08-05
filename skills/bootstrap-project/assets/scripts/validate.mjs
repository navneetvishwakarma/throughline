#!/usr/bin/env node
// Validate docs/engineering/backlog.json (schema v2) and catch skill working state
// misplaced outside .throughline/. Dependency-free. Exits non-zero on error.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const path = join(root, 'docs/engineering/backlog.json');
const STATUS = ['notstarted', 'in_progress', 'blocked', 'done'];
const TRACKERS = ['local', 'github'];
const EPIC_RE = /^E-[0-9]+$/;
const STORY_RE = /^S-[0-9]+[a-z]?$/;
const REQ_RE = /^REQ-[0-9]+$/;
const errors = [];
const err = (m) => errors.push(m);

// Skill working state (epic/ship ledgers, gates) belongs only under .throughline/ —
// every agent (Claude, Codex, Antigravity, Cursor, Gemini) reads that one location the
// same way. An agent defaulting to platform habit instead of following AGENTS.md has
// written it into a platform-specific directory before; catch that here, not just in
// prose, since this is the one check that runs on every commit via the pre-commit hook.
const WRONG_STATE_ROOTS = ['.claude', '.cursor', '.vscode', '.gemini', '.codex', '.antigravity'];
for (const wrongRoot of WRONG_STATE_ROOTS) {
  const base = join(root, wrongRoot);
  if (!existsSync(base)) continue;
  let entries = [];
  try { entries = readdirSync(base); } catch { continue; }
  for (const entry of entries) {
    if (/^(epic|ship)-/.test(entry) || entry === 'gates.json' || entry === 'plugin-version.json') {
      err(wrongRoot + '/' + entry + ': throughline working state must live under .throughline/, not ' + wrongRoot + '/ — run `node scripts/sync-plugin.mjs --repair-state --apply` to move it, or move it by hand.');
    }
  }
}

let data;
try { data = JSON.parse(readFileSync(path, 'utf8')); }
catch (e) {
  errors.forEach((m) => console.error('  - ' + m));
  console.error('Cannot read/parse ' + path + '\n  ' + e.message);
  process.exit(1);
}
if (data.schema !== 2) err('schema must be 2 (got ' + JSON.stringify(data.schema) + ')');
if (!data.project) err('project is required');
if (!data.prd) err('prd path is required');
if (data.tracker && !TRACKERS.includes(data.tracker)) err("tracker must be one of " + TRACKERS.join('|') + " (got " + JSON.stringify(data.tracker) + ")");
if (data.release_in_flight && (data.epics || []).length && !(data.epics || []).some((e) => e.release === data.release_in_flight)) err('release_in_flight ' + JSON.stringify(data.release_in_flight) + ' does not match any epics[].release');
if (!Array.isArray(data.epics)) err('epics must be an array');
if (!Array.isArray(data.stories)) err('stories must be an array');
if ((data.stories || []).length) {
  try {
    const prd = readFileSync(join(root, data.prd), 'utf8');
    const status = prd.match(/^status:\s*([a-z_-]+)/m)?.[1];
    if (status !== 'approved') err('PRD must be approved before backlog contains stories');
  } catch (e) {
    err('cannot read PRD at ' + data.prd + ': ' + e.message);
  }
}
const phaseIds = new Set((data.phases || []).map((p) => p.id));
const epicIds = new Set();
(data.epics || []).forEach((e, i) => {
  const at = 'epics[' + i + '] ' + ((e && e.id) || '');
  if (!e.id || !EPIC_RE.test(e.id)) err(at + ': id must match ' + EPIC_RE);
  if (e.id && epicIds.has(e.id)) err(at + ': duplicate epic id');
  if (e.id) epicIds.add(e.id);
  if (!e.title) err(at + ': title is required');
  if (typeof e.order !== 'number') err(at + ': order must be a number');
  const refs = Array.isArray(e.prd_ref) ? e.prd_ref : e.prd_ref ? [e.prd_ref] : [];
  refs.forEach((r) => { if (!REQ_RE.test(r)) err(at + ": prd_ref '" + r + "' must match " + REQ_RE); });
  if (e.phase && phaseIds.size && !phaseIds.has(e.phase)) err(at + ": phase '" + e.phase + "' not declared in phases[]");
});
const ids = new Set();
(data.stories || []).forEach((s, i) => {
  const at = 'stories[' + i + '] ' + ((s && s.id) || '');
  if (!s.id || !STORY_RE.test(s.id)) err(at + ': id must match ' + STORY_RE);
  if (s.id && ids.has(s.id)) err(at + ': duplicate id');
  if (s.id) ids.add(s.id);
  if (!s.title) err(at + ': title is required');
  if (!s.epic || !EPIC_RE.test(s.epic)) err(at + ': epic is required and must match ' + EPIC_RE);
  else if (epicIds.size && !epicIds.has(s.epic)) err(at + ": epic '" + s.epic + "' is not declared in epics[]");
  if (!s.prd_ref) err(at + ': prd_ref is required');
  else if (!REQ_RE.test(s.prd_ref)) err(at + ": prd_ref '" + s.prd_ref + "' must match " + REQ_RE);
  if (!s.acceptance || !String(s.acceptance).trim()) err(at + ': acceptance is required');
  if (!STATUS.includes(s.status)) err(at + ': status must be one of ' + STATUS.join('|'));
  if (typeof s.order !== 'number') err(at + ': order must be a number');
  if (!Array.isArray(s.blocked_by)) err(at + ': blocked_by must be an array');
  if (s.design_ref && !existsSync(join(root, s.design_ref))) err(at + ": design_ref '" + s.design_ref + "' does not point at a real file");
  if (s.status === 'done' && (s.verify?.ci !== 'pass' || !s.verify?.commit)) err(at + ': done stories require verify.ci pass and verify.commit');
  if (s.status === 'done' && data.coverage?.mode === 'enforce') {
    const min = data.coverage.min ?? 0.7;
    if (s.verify?.coverage == null) err(at + ': done stories require verify.coverage (coverage.mode is enforce) — run node scripts/coverage.mjs --story ' + s.id);
    else if (s.verify.coverage < min) err(at + ': verify.coverage ' + s.verify.coverage + ' is below coverage.min ' + min);
  }
});
(data.stories || []).forEach((s) => {
  (s.blocked_by || []).forEach((dep) => {
    if (dep === s.id) err(s.id + ': cannot depend on itself');
    else if (!ids.has(dep)) err(s.id + ": blocked_by references unknown story '" + dep + "'");
  });
});
const visiting = new Set(), visited = new Set();
function visit(id, stack) {
  if (visiting.has(id)) {
    const cycle = stack.slice(stack.indexOf(id)).concat(id).join(' -> ');
    err('dependency cycle: ' + cycle);
    return;
  }
  if (visited.has(id)) return;
  visiting.add(id);
  const story = (data.stories || []).find((s) => s.id === id);
  (story?.blocked_by || []).forEach((dep) => visit(dep, stack.concat(dep)));
  visiting.delete(id);
  visited.add(id);
}
(data.stories || []).forEach((s) => visit(s.id, [s.id]));
const ews = new Set((data.stories || []).map((s) => s.epic));
(data.epics || []).forEach((e) => { if (e.id && !ews.has(e.id)) err(e.id + ': epic has no stories'); });
if (errors.length) { console.error('FAIL backlog.json invalid — ' + errors.length + ' error(s):'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
console.log('OK backlog.json valid — ' + epicIds.size + ' epics, ' + ids.size + ' stories.');
