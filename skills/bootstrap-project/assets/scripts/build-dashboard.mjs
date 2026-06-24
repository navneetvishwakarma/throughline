#!/usr/bin/env node
/**
 * Render PROGRESS_DASHBOARD.html from docs/engineering/backlog.json (schema v2).
 *
 * Pure function of the contract — no hand-authored data, no LLM, no deps.
 * Stories are the leaf records that carry status; epic/release/bucket rollups are
 * DERIVED here and never stored. Standard dashboard template for every repo.
 *
 * Shows: schedule verdict (behind/on track/ahead), a prioritized work board
 * (Blocked → In Progress → Next → Done[collapsed]), per-release progress, and
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
function releaseRow(rel) {
  const epicIds = epics.filter((e) => (e.release || '') === rel).map((e) => e.id);
  const relStories = stories.filter((s) => epicIds.includes(s.epic));
  const { total, done: dn, pct: rp, status } = rollup(relStories);
  const m = SM[status] || SM.notstarted;
  return '<div class="relrow"><span class="relname">' + esc(rel || '(untagged)') + '</span>'
    + '<div class="relbar"><div class="relfill" style="width:' + rp + '%;background:' + m.c + '"></div></div>'
    + '<span class="relpct">' + esc(String(rp)) + '%</span>'
    + '<span class="relcount">' + esc(String(dn)) + '/' + esc(String(total)) + '</span></div>';
}
const relSection = releaseOrder.map(releaseRow).join('');

// ---- epic rows ----
function epicRow(e) {
  const cs = byEpic.get(e.id) || [];
  const { total, done: dn, pct: ep, status } = rollup(cs);
  const m = SM[status] || SM.notstarted;
  const badge = '<span class="badge" style="color:' + m.c + ';background:' + (m.bg || '#f5f5f5') + '">' + m.label + '</span>';
  return '<tr><td><span class="eid">' + esc(e.id) + '</span></td>'
    + '<td>' + esc(e.title) + '</td>'
    + '<td>' + badge + '</td>'
    + '<td><div class="ebar"><div class="efill" style="width:' + ep + '%;background:' + m.c + '"></div></div></td>'
    + '<td class="epct">' + esc(String(dn)) + '/' + esc(String(total)) + '</td></tr>';
}

// ---- HTML ----
const css = `*{box-sizing:border-box;margin:0;padding:0}body{font:14px/1.5 system-ui,sans-serif;background:#f8f8f8;color:#1a1a1a}
.wrap{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{font-size:1.5rem;font-weight:700;margin-bottom:4px}
.sub{color:#666;font-size:.85rem;margin-bottom:24px}
.verdict{border-radius:10px;padding:20px 24px;color:#fff;margin-bottom:24px;background:${verdict.grad}}
.verdict h2{font-size:1.1rem;font-weight:600;margin-bottom:4px}
.verdict .hl{font-size:.9rem;opacity:.9;margin-bottom:8px}
.verdict .act{font-size:.85rem;opacity:.8}
.ring{display:inline-flex;align-items:center;gap:12px;background:rgba(255,255,255,.15);border-radius:8px;padding:8px 14px;margin-bottom:12px}
.ringpct{font-size:1.8rem;font-weight:700}
.ringof{font-size:.85rem;opacity:.8}
.board{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:32px}
.col{background:#fff;border-radius:10px;padding:12px}
.col.done{background:#fff;border-radius:10px;padding:0}
details.done summary{padding:12px;cursor:pointer;list-style:none;border-radius:10px}
details.done summary::-webkit-details-marker{display:none}
details.done .cards{padding:0 12px 12px}
.colh{display:flex;align-items:center;gap:8px;font-weight:600;font-size:.85rem;margin-bottom:10px}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.cnt{margin-left:auto;background:#f0f0f0;border-radius:20px;padding:1px 8px;font-size:.8rem;color:#555}
.card{background:#f9f9f9;border-radius:8px;border-left:3px solid #ccc;padding:10px 12px;margin-bottom:8px}
.crow{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.sid{font-weight:700;font-size:.8rem;color:#555}
.title{font-size:.88rem;margin-bottom:4px}
.meta{font-size:.78rem;color:#888}
.echip{background:#eee;border-radius:4px;padding:1px 6px}
.dep{font-size:.78rem;color:#e5484d;margin-top:4px}
.lnk{font-size:.78rem;text-decoration:none;border-radius:4px;padding:1px 6px;margin-left:auto}
.lnk.gh{color:#2c7be5;background:#e9f1fd}
.lnk.prd{color:#6f42c1;background:#f0ebfd}
.lnk.file{color:#555;background:#eee}
.empty{color:#aaa;font-size:.85rem;padding:8px 0}
h2{font-size:1rem;font-weight:600;margin-bottom:12px}
.releases{margin-bottom:28px}
.relrow{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #eee}
.relname{width:80px;font-size:.82rem;font-weight:600;flex-shrink:0}
.relbar{flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden}
.relfill{height:100%;border-radius:4px;transition:width .3s}
.relpct{width:40px;text-align:right;font-size:.82rem;color:#555}
.relcount{width:50px;text-align:right;font-size:.78rem;color:#888}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}
th{text-align:left;font-size:.78rem;font-weight:600;color:#888;padding:8px 12px;border-bottom:2px solid #eee}
td{padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:.85rem;vertical-align:middle}
.eid{font-weight:700;font-size:.78rem;color:#555}
.badge{font-size:.75rem;font-weight:600;border-radius:20px;padding:2px 8px}
.ebar{width:80px;height:6px;background:#eee;border-radius:3px;overflow:hidden}
.efill{height:100%;border-radius:3px}
.epct{color:#888;font-size:.8rem}
.ts{color:#aaa;font-size:.75rem;margin-top:24px;text-align:right}`;

const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(data.project)} — Progress Dashboard</title>
<style>${css}</style></head>
<body><div class="wrap">
<h1>${esc(data.project)}</h1>
<div class="sub">Progress Dashboard &middot; generated ${today} &middot; <a href="${esc(data.prd || '')}">PRD</a></div>
<div class="verdict" style="background:${verdict.grad}">
  <div class="ring"><span class="ringpct">${pct}%</span><span class="ringof">${sd} of ${stories.length} stories done</span></div>
  <h2>${verdict.word}</h2>
  <div class="hl">${esc(headline)}</div>
  <div class="act">${esc(action)}</div>
</div>
<h2>Work board</h2>
<div class="board">
${column('blocked', buckets.blocked, false)}
${column('in_progress', buckets.in_progress, false)}
${column('next', buckets.next, false)}
${column('done', buckets.done, true)}
</div>
${releaseOrder.length ? '<h2>By release</h2><div class="releases">' + relSection + '</div>' : ''}
<h2>Epics</h2>
<table><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Progress</th><th>Done</th></tr></thead>
<tbody>${epics.map(epicRow).join('')}</tbody></table>
<div class="ts">Source: docs/engineering/backlog.json</div>
</div></body></html>`;

writeFileSync(outPath, html, 'utf8');
console.log('OK dashboard written → ' + outPath);
