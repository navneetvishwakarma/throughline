#!/usr/bin/env node
// Sync tracker state into backlog.json status. Per-tracker adapter; default 'local' (no external state).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const backlogPath = join(root, 'docs/engineering/backlog.json');
const throughlineDir = join(root, '.throughline');
const data = JSON.parse(readFileSync(backlogPath, 'utf8'));
const supportedTrackers = ['local', 'github'];
// A project whose stories/epics already carry gh_issue numbers is de-facto GitHub-tracked
// even if it predates the `tracker` field (added after some projects already had gh_issue
// data). Defaulting silently to 'local' would stop GitHub sync with no signal at all.
// Infer 'github' from that evidence instead, and persist it in the write below -- this
// script already owns writing tracker-derived state back into backlog.json, unlike
// validate.mjs/upgrade-project, which never touch it.
let tracker = data.tracker;
let trackerInferred = false;
if (!tracker) {
  const hasGhIssue = (data.epics || []).some((e) => e.gh_issue != null) || (data.stories || []).some((s) => s.gh_issue != null);
  tracker = hasGhIssue ? 'github' : 'local';
  trackerInferred = hasGhIssue;
}
if (!supportedTrackers.includes(tracker)) {
  console.error('Unsupported tracker ' + JSON.stringify(tracker) + '. Supported trackers: ' + supportedTrackers.join(', '));
  process.exit(1);
}
if (trackerInferred) {
  data.tracker = tracker;
  console.log('NOTE tracker was unset but gh_issue data exists — inferred and persisted tracker=github. Set it explicitly in backlog.json to silence this notice.');
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
  else if (state === 'OPEN') s.status = 'in_progress';
  if (s.status !== prev) changed++;
}
let dependenciesChanged = true;
while (dependenciesChanged) {
  dependenciesChanged = false;
  for (const s of data.stories) {
    const blocked = (s.blocked_by || []).some((d) => !isDone(d));
    const state = s.gh_issue != null ? ghState.get(s.gh_issue) : undefined;
    const recovered = tracker === 'github' && s.gh_issue != null
      ? (state === 'CLOSED' ? 'done' : 'in_progress')
      : 'notstarted';
    const next = blocked ? 'blocked' : (s.status === 'blocked' ? recovered : s.status);
    if (next !== s.status) {
      s.status = next;
      changed++;
      dependenciesChanged = true;
    }
  }
}
writeFileSync(backlogPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
const counts = data.stories.reduce((a, s) => ((a[s.status] = (a[s.status] || 0) + 1), a), {});
console.log('OK Synced ' + data.stories.length + ' stories (' + changed + ' changed). tracker=' + tracker);
console.log('  ' + ['done', 'in_progress', 'blocked', 'notstarted'].map((k) => k + ': ' + (counts[k] || 0)).join('  '));
