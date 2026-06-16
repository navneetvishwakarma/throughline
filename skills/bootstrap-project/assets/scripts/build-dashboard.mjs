#!/usr/bin/env node
/**
 * Render PROGRESS_DASHBOARD.html from docs/engineering/backlog.json (schema v2).
 *
 * Pure function of the contract — no hand-authored data, no LLM, no deps.
 * Stories are the leaf records that carry status; epic/release/bucket rollups are
 * DERIVED here and never stored. Standard dashboard template for every repo.
 *
 * Shows: schedule verdict (behind/on track/ahead), a prioritized work board
 * (Blocked → Next → In Progress → Done[collapsed]), per-release progress, and
 * deep links from each item to its GitHub issue (when available) or to the
 * responsible doc/section.
 *
 * Usage: node scripts/build-dashboard.mjs [--out PROGRESS_DASHBOARD.html]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const outPath = outArg !== -1 ? args[outArg + 1] : join(root, 'PROGRESS_DASHBOARD.html');

const data = JSON.parse(readFileSync(join(root, 'docs/engineering/backlog.json'), 'utf8'));
const stories = data.stories || [];
const epics = (data.epics || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const repo = (data.repo || '').replace(/\/$/, '');
const prdPath = data.prd || 'docs/product/06-prd.md';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const SM = {
  blocked:     { label: 'Blocked',     c: '#e5484d', bg: '#fdecec' },
  next:        { label: 'Next up',     c: '#d9730d', bg: '#fcf0e3' },
  in_progress: { label: 'In progress', c: '#2c7be5', bg: '#e9f1fd' },
  done:        { label: 'Done',        c: '#1a9b59', bg: '#e7f6ee' },
  notstarted:  { label: 'Next up',     c: '#d9730d', bg: '#fcf0e3' },
};
const epicById = new Map(epics.map((e) => [e.id, e]));

// ---- rollup ----
function rollup(cs) {
  const total = cs.length, done = cs.filter((s) => s.status === 'done').length;
  let st = 'notstarted';
  if (total && done === total) st = 'done';
  else if (cs.some((s) => s.status === 'blocked')) st = 'blocked';
  else if (cs.some((s) => s.status === 'in_progress' || s.status === 'done')) st = 'in_progress';
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0, status: st };
}
const byEpic = new Map(epics.map((e) => [e.id, []]));
for (const s of stories) { if (!byEpic.has(s.epic)) byEpic.set(s.epic, []); byEpic.get(s.epic).push(s); }

// ---- overall ----
const sd = stories.filter((s) => s.status === 'done').length;
const pct = stories.length ? Math.round((sd / stories.length) * 100) : 0;
const buckets = {
  blocked: stories.filter((s) => s.status === 'blocked'),
  next: stories.filter((s) => s.status === 'notstarted'),
  in_progress: stories.filter((s) => s.status === 'in_progress'),
  done: stories.filter((s) => s.status === 'done'),
};
const ord = (a, b) => (a.order - b.order) || a.id.localeCompare(b.id);
for (const k of Object.keys(buckets)) buckets[k].sort(ord);

// ---- verdict ----
const HEALTH = {
  behind:   { word: 'Behind',   c: '#e5484d', grad: 'linear-gradient(135deg,#e5484d,#b83036)' },
  on_track: { word: 'On track', c: '#1a9b59', grad: 'linear-gradient(135deg,#1a9b59,#0f7a45)' },
  ahead:    { word: 'Ahead',    c: '#2c7be5', grad: 'linear-gradient(135deg,#2c7be5,#1a56b8)' },
};
const today = new Date().toISOString().slice(0, 10);
const isOverdue = (e, st) => !!(e.target_date && e.target_date < today && st !== 'done');
const overdueCount = epics.filter((e) => isOverdue(e, rollup(byEpic.get(e.id) || []).status)).length;
const h = data.health || {};
const ATRISK = { word: 'At risk', c: '#d9730d', grad: 'linear-gradient(135deg,#d9730d,#b35a08)' };
const verdict = HEALTH[h.overall] || (overdueCount ? HEALTH.behind : buckets.blocked.length ? ATRISK : HEALTH.on_track);
const headline = h.headline || (overdueCount
  ? overdueCount + ' epic(s) past their target date.'
  : buckets.blocked.length
  ? buckets.blocked.length + ' blocked item(s) need attention.'
  : pct === 100 ? 'All stories complete.' : 'Work in progress, no blockers.');
const action = h.action || (buckets.blocked.length
  ? 'Unblock: ' + buckets.blocked.map((s) => s.id).join(', ')
  : buckets.next.length ? 'Next up: ' + buckets.next.slice(0, 3).map((s) => s.id).join(', ') : '—');

// ---- links: GH issue when available, else responsible doc/section ----
function linkFor(item, isEpic) {
  if (repo && item.gh_issue != null) return { href: repo + '/issues/' + item.gh_issue, label: '#' + item.gh_issue, kind: 'gh' };
  if (item.prd_ref) { const r = Array.isArray(item.prd_ref) ? item.prd_ref[0] : item.prd_ref; return { href: prdPath + '#' + slug(r), label: r, kind: 'prd' }; }
  if (isEpic && item.title) return { href: prdPath + '#' + slug(item.title), label: 'PRD', kind: 'prd' };
  return { href: 'docs/engineering/backlog.json', label: 'backlog', kind: 'file' };
}
function linkChip(item, isEpic) {
  const l = linkFor(item, isEpic);
  const ic = l.kind === 'gh' ? '&#9711;' : '&#128196;';
  return '<a class="lnk ' + l.kind + '" href="' + esc(l.href) + '" target="_blank" rel="noopener" title="' + (l.kind === 'gh' ? 'GitHub issue' : 'source: ' + esc(l.href)) + '">' + ic + ' ' + esc(l.label) + '</a>';
}

// ---- story card ----
function card(s, bucketKey) {
  const m = SM[bucketKey] || SM.notstarted;
  const e = epicById.get(s.epic);
  const ec = e ? '<span class="echip">' + esc(e.id) + ' ' + esc(e.title) + '</span>' : '';
  const dep = (bucketKey === 'blocked' && (s.blocked_by || []).length)
    ? '<div class="dep">&#9940; waiting on ' + esc(s.blocked_by.join(', ')) + '</div>' : '';
  return '<div class="card" style="border-left-color:' + m.c + '">'
    + '<div class="crow"><span class="sid">' + esc(s.id) + '</span>' + linkChip(s, false) + '</div>'
    + '<div class="title">' + esc(s.title) + '</div>'
    + '<div class="meta">' + ec + '</div>' + dep + '</div>';
}
function column(key, items, collapsed) {
  const m = SM[key];
  const head = '<div class="colh"><span class="dot" style="background:' + m.c + '"></span>'
    + '<span class="colt">' + m.label + '</span><span class="cnt">' + items.length + '</span></div>';
  const cards = items.length ? items.map((s) => card(s, key)).join('') : '<div class="empty">Nothing here.</div>';
  if (collapsed) return '<details class="col done"><summary>' + head + '</summary><div class="cards">' + cards + '</div></details>';
  return '<section class="col"><div class="colh-wrap">' + head + '</div><div class="cards">' + cards + '</div></section>';
}

// ---- release progress ----
const releaseOrder = [];
for (const e of epics) { const r = e.release || ''; if (!releaseOrder.includes(r)) releaseOrder.push(r); }
funct