#!/usr/bin/env node
// Validate docs/engineering/backlog.json (schema v2). Dependency-free. Exits non-zero on error.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const path = join(root, 'docs/engineering/backlog.json');
const STATUS = ['notstarted', 'in_progress', 'blocked', 'done'];
const EPIC_RE = /^E-[0-9]+$/;
const STORY_RE = /^S-[0-9]+[a-z]?$/;
const errors = [];
const err = (m) => errors.push(m);
let data;
try { data = JSON.parse(readFileSync(path, 'utf8')); }
catch (e) { console.error('Cannot read/parse ' + path + '\n  ' + e.message); process.exit(1); }
if (data.schema !== 2) err('schema must be 2 (got ' + JSON.stringify(data.schema) + ')');
if (!data.project) err('project is required');
if (!data.prd) err('prd path is required');
if (!Array.isArray(data.epics)) err('epics must be an array');
if (!Array.isArray(data.stories)) err('stories must be an array');
const phaseIds = new Set((data.phases || []).map((p) => p.id));
const epicIds = new Set();
(data.epics || []).forEach((e, i) => {
  const at = 'epics[' + i + '] ' + ((e && e.id) || '');
  if (!e.id || !EPIC_RE.test(e.id)) err(at + ': id must match ' + EPIC_RE);
  if (e.id && epicIds.has(e.id)) err(at + ': duplicate epic id');
  if (e.id) epicIds.add(e.id);
  if (!e.title) err(at + ': title is required');
  if (typeof e.order !== 'number') err(at + ': order must be a number');
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
  if (!STATUS.includes(s.status)) err(at + ': status must be one of ' + STATUS.join('|'));
  if (typeof s.order !== 'number') err(at + ': order must be a number');
  if (s.blocked_by && !Array.isArray(s.blocked_by)) err(at + ': blocked_by must be an array');
});
(data.stories || []).forEach((s) => {
  (s.blocked_by || []).forEach((dep) => {
    if (dep === s.id) err(s.id + ': cannot depend on itself');
    else if (!ids.has(dep)) err(s.id + ": blocked_by references unknown story '" + dep + "'");
  });
});
const ews = new Set((data.stories || []).map((s) => s.epic));
(data.epics || []).forEach((e) => { if (e.id && !ews.has(e.id)) err(e.id + ': epic has no stories'); });
if (errors.length) { console.error('FAIL backlog.json invalid — ' + errors.length + ' error(s):'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
console.log('OK backlog.json valid — ' + epicIds.size + ' epics, ' + ids.size + ' stories.');
