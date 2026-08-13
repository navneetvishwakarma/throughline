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
const warnings = [];
const warn = (m) => warnings.push(m);
// A project adopting the tracked-version flow for the first time (see sync-plugin.mjs)
// gets a one-time grace period on requirements added after its data was already written:
// missing prd_ref/acceptance and done-story verify evidence become warnings, not failures.
// Structural invariants (ids, references, cycles, PRD gate, coverage-enforce) are never graced.
let legacyContractGrace = false;
try {
  const stamp = JSON.parse(readFileSync(join(root, '.throughline/plugin-version.json'), 'utf8'));
  legacyContractGrace = stamp?.legacyContractGrace === true;
} catch {}

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
    if (/^(epic|ship|feature)-/.test(entry) || entry === 'gates.json' || entry === 'plugin-version.json') {
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
// Two different notions of "release" here: the mismatch check (release_in_flight present)
// compares against each epic's EFFECTIVE release (untagged epics default to v1, matching
// build-dashboard.mjs's own convention), while the required-field check (release_in_flight
// absent) only cares about epics with an EXPLICIT tag -- an all-implicit-v1 backlog never
// needs release_in_flight set at all.
const epicEffectiveReleases = [...new Set((data.epics || []).map((e) => e.release || 'v1'))];
const explicitEpicReleases = [...new Set((data.epics || []).filter((e) => e.release != null).map((e) => e.release))];
if (data.release_in_flight) {
  if ((data.epics || []).length && !epicEffectiveReleases.includes(data.release_in_flight)) err('release_in_flight ' + JSON.stringify(data.release_in_flight) + ' does not match any epics[].release');
} else if (explicitEpicReleases.length) {
  err('epics declare explicit release value(s) (' + explicitEpicReleases.join(', ') + ') but release_in_flight is not set — set it to one of them so the dashboard and gates know which release is current.');
}

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

if (!Array.isArray(data.epics)) err('epics must be an array');
if (!Array.isArray(data.stories)) err('stories must be an array');
function parsePrdRequirements(text) {
  const rows = [];
  let inRequirements = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^##\s+Requirements\s*$/i.test(line.trim())) {
      inRequirements = true;
      continue;
    }
    if (inRequirements && /^##\s+/.test(line.trim())) break;
    if (inRequirements && line.trim().startsWith('|')) rows.push(line);
  }
  const requirements = new Map();
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    if (!cells.length || !cells[0]) continue;
    const [id] = cells;
    const release = cells.at(-1);
    if (/^ID$/i.test(id) || cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    if (!REQ_RE.test(id)) continue;
    requirements.set(id, release);
  }
  return requirements;
}
let prdApproved = false;
let prdRequirements = new Map();
if ((data.epics || []).length || (data.stories || []).length) {
  try {
    const prd = readFileSync(join(root, data.prd), 'utf8');
    const status = prd.match(/^status:\s*([a-z_-]+)/m)?.[1];
    prdApproved = status === 'approved';
    if ((data.stories || []).length && !prdApproved) err('PRD must be approved before backlog contains stories');
    if (prdApproved) {
      prdRequirements = parsePrdRequirements(prd);
    }
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
  refs.forEach((r) => {
    if (!REQ_RE.test(r)) err(at + ": prd_ref '" + r + "' must match " + REQ_RE);
    else if (prdApproved && !prdRequirements.has(r)) err(at + ": prd_ref '" + r + "' does not exist in the approved PRD");
  });
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
  const prdRefs = Array.isArray(s.prd_ref) ? s.prd_ref : s.prd_ref ? [s.prd_ref] : [];
  if (!prdRefs.length) { const msg = at + ': prd_ref is required'; legacyContractGrace ? warn(msg) : err(msg); }
  else prdRefs.forEach((r) => {
    if (!REQ_RE.test(r)) err(at + ": prd_ref '" + r + "' must match " + REQ_RE);
    else if (prdApproved && !prdRequirements.has(r)) err(at + ": prd_ref '" + r + "' does not exist in the approved PRD");
  });
  if (!s.acceptance || !String(s.acceptance).trim()) { const msg = at + ': acceptance is required'; legacyContractGrace ? warn(msg) : err(msg); }
  if (!STATUS.includes(s.status)) err(at + ': status must be one of ' + STATUS.join('|'));
  if (typeof s.order !== 'number') err(at + ': order must be a number');
  if (s.blocked_by !== undefined && !Array.isArray(s.blocked_by)) err(at + ': blocked_by must be an array');
  if (s.design_ref && !existsSync(join(root, s.design_ref))) err(at + ": design_ref '" + s.design_ref + "' does not point at a real file");
  if (s.status === 'done' && (s.verify?.ci !== 'pass' || !s.verify?.commit)) { const msg = at + ': done stories require verify.ci pass and verify.commit'; legacyContractGrace ? warn(msg) : err(msg); }
  if (s.status === 'done' && data.coverage?.mode === 'enforce') {
    const min = data.coverage.min ?? 0.7;
    if (s.verify?.coverage == null) err(at + ': done stories require verify.coverage (coverage.mode is enforce) — run node scripts/coverage.mjs --story ' + s.id);
    else if (s.verify.coverage < min) err(at + ': verify.coverage ' + s.verify.coverage + ' is below coverage.min ' + min);
  }
});
if (prdApproved && ((data.epics || []).length || (data.stories || []).length)) {
  for (const [requirementId, release] of prdRequirements) {
    const releaseEpics = (data.epics || []).filter((epic) => {
      const refs = Array.isArray(epic.prd_ref) ? epic.prd_ref : epic.prd_ref ? [epic.prd_ref] : [];
      return (epic.release || 'v1') === release && refs.includes(requirementId);
    });
    if (!releaseEpics.length) {
      err(requirementId + ' (release ' + release + ') is not referenced by any epic in release ' + release);
      continue;
    }
    const releaseEpicIds = new Set(releaseEpics.map((epic) => epic.id));
    const coveredByStory = (data.stories || []).some((story) => {
      const refs = Array.isArray(story.prd_ref) ? story.prd_ref : story.prd_ref ? [story.prd_ref] : [];
      return releaseEpicIds.has(story.epic) && refs.includes(requirementId);
    });
    if (!coveredByStory) err(requirementId + ' (release ' + release + ') is not referenced by any story in its release epic(s)');
  }
}
const storyById = new Map((data.stories || []).map((s) => [s.id, s]));
(data.stories || []).forEach((s) => {
  const deps = Array.isArray(s.blocked_by) ? s.blocked_by : [];
  deps.forEach((dep) => {
    if (dep === s.id) err(s.id + ': cannot depend on itself');
    else if (!ids.has(dep)) err(s.id + ": blocked_by references unknown story '" + dep + "'");
  });
  // Contradictory status: a merge-corruption signal, not just a schema violation.
  // blocked must name the dependency it's waiting on (workflow.md: "blocked as an
  // override when a dependency is unmet"); done must not outrun an open dependency
  // (Definition of Ready: "All blocked_by dependencies are done").
  if (s.status === 'blocked' && !deps.length) err(s.id + ": status is 'blocked' but blocked_by is empty");
  if (s.status === 'done') {
    deps.forEach((dep) => {
      const depStatus = storyById.get(dep)?.status;
      if (depStatus && depStatus !== 'done') err(s.id + ": status is 'done' but blocked_by dependency '" + dep + "' is not done (status: " + depStatus + ")");
    });
  }
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
  (Array.isArray(story?.blocked_by) ? story.blocked_by : []).forEach((dep) => visit(dep, stack.concat(dep)));
  visiting.delete(id);
  visited.add(id);
}
(data.stories || []).forEach((s) => visit(s.id, [s.id]));
const ews = new Set((data.stories || []).map((s) => s.epic));
(data.epics || []).forEach((e) => { if (e.id && !ews.has(e.id)) err(e.id + ': epic has no stories'); });
if (errors.length) { console.error('FAIL backlog.json invalid — ' + errors.length + ' error(s):'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
if (warnings.length) {
  console.log('WARN ' + warnings.length + ' legacy-contract gap(s) (legacyContractGrace active — backfill via the normal workflow, not by hand-editing backlog.json):');
  warnings.forEach((w) => console.log('  - ' + w));
}
console.log('OK backlog.json valid — ' + epicIds.size + ' epics, ' + ids.size + ' stories.');
