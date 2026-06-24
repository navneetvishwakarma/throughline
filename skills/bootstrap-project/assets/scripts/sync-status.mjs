#!/usr/bin/env node
// Sync tracker state into backlog.json status. Per-tracker adapter; default 'local' (no external state).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const backlogPath = join(root, 'docs/engineering/backlog.json');
const throughlineDir = join(root, '.throughline');
const data = JSON.parse(readFileSync(backlogPath, 'utf8'));
const tracker = data.tracker || 'local';
const supportedTrackers = ['local', 'github'];
if (!supportedTrackers.includes(tracker)) {
  console.error('Unsupported tracker ' + JSON.stringify(tracker) + '. Supported trackers: ' + supportedTrackers.join(', '));
  process.exit(1);
}
// GitHub adapter: scan .throughline/ship-*/issue-*.json.
const ghState = new Map();
if (tracker === 'github' && existsSync(throughlineDir)) {
  for (const dir of readdirSync(throughlineDir)) {
    if (!dir.startsWith('ship-')) continue;
    const shipDir = join(throughlineDir, dir);
    for (const f of readdirSync(shipDir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const issue = JSON.parse(readFileSync(join(shipDir, f), 'utf8'));
        if (typeof issue.number === 'number' && issue.state) ghState.set(issue.number, String(issue.state).toUpperCase());
      } catch {}
    }
  }
}
const byId = new Map(data.stories.map((s) => [s.id, s]));
const isDone = (id) => byId.get(id)?.status === 'done';
let changed = 0;
for (const s of data.stories) {
  const prev = s.status;
  const state = s.gh_issue != null ? ghState.get(s.gh_issue) : undefined;
  if (state === 'CLOSED') s.status = 'done';
  else if (state === 'OPEN' && s.status === 'notstarted') s.status = 'in_progress';
  if (s.status !== prev) changed++;
}
for (const s of data.stories) {
  if (s.status === 'done') continue;
  const blocked = (s.blocked_by || []).some((d) => !isDone(d));
  const next = blocked ? 'blocked' : (s.status === 'blocked' ? (s.gh_issue != null ? 'in_progress' : 'notstarted') : s.status);
  if (next !== s.status) { s.status = next; changed++; }
}
writeFileSync(backlogPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
const counts = data.stories.reduce((a, s) => ((a[s.status] = (a[s.status] || 0) + 1), a), {});
console.log('OK Synced ' + data.stories.length + ' stories (' + changed + ' changed). tracker=' + tracker);
console.log('  ' + ['done', 'in_progress', 'blocked', 'notstarted'].map((k) => k + ': ' + (counts[k] || 0)).join('  '));
