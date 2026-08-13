#!/usr/bin/env node
/**
 * Render PROGRESS_DASHBOARD.html from docs/engineering/backlog.json (schema v2).
 *
 * Pure function of the contract — no hand-authored data, no LLM, no deps.
 * Stories are the leaf records that carry status; epic/release/bucket rollups are
 * DERIVED here and never stored. Standard dashboard template for every repo.
 *
 * Shows: schedule verdict (behind/on track/ahead) and a prioritized work board
 * (Blocked → In Progress → Next → Done[collapsed]) SCOPED TO THE CURRENT RELEASE
 * (backlog.json's release_in_flight — untagged epics count as the implicit first
 * release, matching define-backlog's own convention). Shipped releases (100% done)
 * and upcoming ones (release_in_flight hasn't reached them yet) are collapsed into
 * <details> — referenced, not hidden, and not cluttering the main view. Deep links
 * from each item to its GitHub issue (when available) or to the responsible
 * doc/section.
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

// ---- coverage summary (reads scripts/coverage.mjs's output; never throws if absent) ----
const coverageSummary = (() => {
  try { return JSON.parse(readFileSync(join(root, '.throughline/coverage/summary.json'), 'utf8')); }
  catch { return null; }
})();
function coverageSection() {
  const threshold = data.coverage?.min ?? coverageSummary?.threshold ?? 0.7;
  if (!coverageSummary || coverageSummary.status === 'skipped') {
    return '<div class="covrow"><span class="covlabel">Coverage</span><span class="covmuted">not measured yet</span></div>';
  }
  if (coverageSummary.status === 'needs_setup') {
    return '<div class="covrow"><span class="covlabel">Coverage</span><span class="covmuted">tool not configured — run <code>node scripts/coverage.mjs --setup</code></span></div>';
  }
  const pct = coverageSummary.aggregate?.pct;
  if (pct == null) {
    return '<div class="covrow"><span class="covlabel">Coverage</span><span class="covmuted">' + esc(coverageSummary.status) + '</span></div>';
  }
  const passed = coverageSummary.passed;
  const color = passed ? '#1a9b59' : '#e5484d';
  const reports = (coverageSummary.stacks || [])
    .filter((s) => s.status === 'ok')
    .map((s) => '<a class="covlink" href="' + esc(s.reportPath) + '" target="_blank" rel="noopener">' + esc(s.stack) + ' report</a>')
    .join(' ');
  return '<div class="covrow"><span class="covlabel">Coverage</span>'
    + '<span class="covpct" style="color:' + color + '">' + (pct * 100).toFixed(1) + '%</span>'
    + '<span class="covmin">min ' + (threshold * 100).toFixed(0) + '%</span>'
    + reports + '</div>';
}
// ---- gate pipeline (reads scripts/gate.mjs's output; never throws if absent) ----
const GATE_ORDER = ['G1', 'G1.5', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9'];
const gatesData = (() => {
  try { return JSON.parse(readFileSync(join(root, '.throughline/gates.json'), 'utf8')); }
  catch { return null; }
})();
function gateSection() {
  if (!gatesData) {
    return '<div class="gaterow"><span class="gatelabel">Gates</span><span class="gatemuted">not tracked yet</span></div>';
  }
  let markedCurrent = false;
  const pills = GATE_ORDER.map((g) => {
    const status = gatesData.gates?.[g]?.status || 'pending';
    const isCurrent = !markedCurrent && status !== 'approved';
    if (isCurrent) markedCurrent = true;
    const cls = 'gate ' + status + (isCurrent ? ' current' : '');
    return '<span class="' + cls + '" title="' + esc(g) + ': ' + esc(status) + '">' + esc(g) + '</span>';
  }).join('');
  return '<div class="gaterow"><span class="gatelabel">Gates</span><div class="gatestrip">' + pills + '</div></div>';
}
function releaseWarningSection() {
  if (!releaseConfigWarning) return '';
  return '<div class="covrow" style="background:#fdecec"><span class="covlabel" style="color:#e5484d">Config warning</span><span>' + esc(releaseConfigWarning) + '</span></div>';
}
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

// ---- release classification ----
// Epics with no release tag belong implicitly to the first release (define-backlog's own
// convention — v1 epics are typically untagged; only v2+ epics get an explicit tag).
// release_in_flight is the one field naming which release is currently being worked
// (advanced by define-backlog, never define-product — see its own reconcile rules).
const epicRelease = (e) => e.release || 'v1';
const hasExplicitEpicRelease = epics.some((e) => e.release != null);
const releaseOrder = [];
for (const e of epics) { const r = epicRelease(e); if (!releaseOrder.includes(r)) releaseOrder.push(r); }
function releaseEpics(rel) { return epics.filter((e) => epicRelease(e) === rel); }
function releaseStoryList(rel) { const ids = new Set(releaseEpics(rel).map((e) => e.id)); return stories.filter((s) => ids.has(s.epic)); }
// validate.mjs requires release_in_flight once any epic declares an explicit release, so this
// fallback only fires against a backlog.json that was never validated, or predates this check.
// It must pick a real declared release and say so -- never invent a lowercase 'v1' that could
// report a false 0/0 "on track" for a release that has no epics at all.
let currentRelease = data.release_in_flight;
let releaseConfigWarning = null;
if (!currentRelease) {
  if (hasExplicitEpicRelease) {
    currentRelease = releaseOrder.find((r) => rollup(releaseStoryList(r)).status !== 'done') || releaseOrder[0];
    releaseConfigWarning = 'release_in_flight is not set, but epics declare explicit release(s) (' + releaseOrder.join(', ') + '). Showing "' + currentRelease + '" — set release_in_flight in backlog.json to make this authoritative.';
  } else {
    currentRelease = 'v1';
  }
}
const currentEpics = releaseEpics(currentRelease);
const currentEpicIds = new Set(currentEpics.map((e) => e.id));
const currentStories = stories.filter((s) => currentEpicIds.has(s.epic));
const otherReleases = releaseOrder.filter((r) => r !== currentRelease);

// ---- current-release progress (the dashboard's headline) ----
const allDone = stories.filter((s) => s.status === 'done').length;
const sd = currentStories.filter((s) => s.status === 'done').length;
const pct = currentStories.length ? Math.round((sd / currentStories.length) * 100) : 0;
const buckets = {
  blocked: currentStories.filter((s) => s.status === 'blocked'),
  next: currentStories.filter((s) => s.status === 'notstarted'),
  in_progress: currentStories.filter((s) => s.status === 'in_progress'),
  done: currentStories.filter((s) => s.status === 'done'),
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
const overdueCount = currentEpics.filter((e) => isOverdue(e, rollup(byEpic.get(e.id) || []).status)).length;
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
function releaseRow(rel, labelOverride) {
  const { total, done: dn, pct: rp, status } = rollup(releaseStoryList(rel));
  const m = SM[status] || SM.notstarted;
  const tag = labelOverride ? '<span class="reltag">' + esc(labelOverride) + '</span>' : '';
  return '<div class="relrow"><span class="relname">' + esc(rel) + '</span>' + tag
    + '<div class="relbar"><div class="relfill" style="width:' + rp + '%;background:' + m.c + '"></div></div>'
    + '<span class="relpct">' + esc(String(rp)) + '%</span>'
    + '<span class="relcount">' + esc(String(dn)) + '/' + esc(String(total)) + '</span></div>';
}

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
const EPIC_THEAD = '<thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Progress</th><th>Done</th></tr></thead>';
function epicTable(epicList) {
  return '<table>' + EPIC_THEAD + '<tbody>' + epicList.map(epicRow).join('') + '</tbody></table>';
}

// ---- other releases (shipped or upcoming — collapsed, referenced not duplicated) ----
function otherReleaseGroup(rel) {
  const status = rollup(releaseStoryList(rel)).status;
  const label = status === 'done' ? 'Shipped' : status === 'notstarted' ? 'Upcoming' : 'In progress';
  return '<details class="relgroup"><summary>' + releaseRow(rel, label) + '</summary>'
    + '<div class="relgroup-body">' + epicTable(releaseEpics(rel)) + '</div></details>';
}

// ---- current release (always expanded — the dashboard's main focus) ----
function currentReleaseSection() {
  return '<div class="relgroup current"><div class="relrow-wrap">' + releaseRow(currentRelease, 'Current') + '</div>'
    + '<div class="relgroup-body">' + (currentEpics.length ? epicTable(currentEpics) : '<div class="empty">No epics yet for this release.</div>') + '</div></div>';
}

// ---- roadmap: all releases in order, phase-grouped when backlog.json declares phases[] ----
const phases = (data.phases || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const phaseById = new Map(phases.map((p) => [p.id, p]));
function roadmapReleaseBlock(rel) {
  const relEpics = releaseEpics(rel).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let body;
  if (phases.length) {
    const groups = phases.map((p) => ({ phase: p, epics: relEpics.filter((e) => e.phase === p.id) }));
    groups.push({ phase: { id: 'unphased', name: 'Unphased' }, epics: relEpics.filter((e) => !e.phase || !phaseById.has(e.phase)) });
    body = groups.filter((g) => g.epics.length)
      .map((g) => '<div class="phasegroup"><h3 class="phaseh">' + esc(g.phase.name) + '</h3>' + epicTable(g.epics) + '</div>')
      .join('');
  } else {
    body = epicTable(relEpics);
  }
  return '<div class="roadmap-release"><h3 class="relhead">' + esc(rel) + '</h3>' + body + '</div>';
}
function roadmapSection() {
  return '<div class="roadmap">' + releaseOrder.map((r) => roadmapReleaseBlock(r)).join('') + '</div>';
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
.relrow{display:flex;align-items:center;gap:10px;padding:6px 0}
.relname{width:80px;font-size:.82rem;font-weight:600;flex-shrink:0}
.reltag{font-size:.7rem;font-weight:600;color:#888;background:#f0f0f0;border-radius:10px;padding:1px 8px;flex-shrink:0}
.relbar{flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden}
.relfill{height:100%;border-radius:4px;transition:width .3s}
.relpct{width:40px;text-align:right;font-size:.82rem;color:#555}
.relcount{width:50px;text-align:right;font-size:.78rem;color:#888}
.relgroup{background:#fff;border-radius:10px;margin-bottom:8px;overflow:hidden}
.relgroup summary{padding:8px 14px;cursor:pointer;list-style:none}
.relgroup summary::-webkit-details-marker{display:none}
.relgroup.current{margin-bottom:24px}
.relrow-wrap{padding:8px 14px}
.relgroup-body{padding:0 14px 14px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}
th{text-align:left;font-size:.78rem;font-weight:600;color:#888;padding:8px 12px;border-bottom:2px solid #eee}
td{padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:.85rem;vertical-align:middle}
.eid{font-weight:700;font-size:.78rem;color:#555}
.badge{font-size:.75rem;font-weight:600;border-radius:20px;padding:2px 8px}
.ebar{width:80px;height:6px;background:#eee;border-radius:3px;overflow:hidden}
.efill{height:100%;border-radius:3px}
.epct{color:#888;font-size:.8rem}
.ts{color:#aaa;font-size:.75rem;margin-top:24px;text-align:right}
.covrow{display:flex;align-items:center;gap:10px;background:#fff;border-radius:8px;padding:10px 14px;margin-bottom:24px;font-size:.85rem}
.covlabel{font-weight:600;color:#555}
.covpct{font-weight:700;font-size:1rem}
.covmin{color:#888}
.covmuted{color:#aaa}
.covlink{margin-left:auto;font-size:.78rem;color:#2c7be5;text-decoration:none}
.gaterow{display:flex;align-items:center;gap:10px;background:#fff;border-radius:8px;padding:10px 14px;margin-bottom:24px;font-size:.85rem}
.gatelabel{font-weight:600;color:#555}
.gatemuted{color:#aaa}
.gatestrip{display:flex;gap:6px;flex-wrap:wrap}
.gate{font-size:.72rem;font-weight:700;border-radius:6px;padding:3px 7px;background:#f0f0f0;color:#888}
.gate.approved{background:#e7f6ee;color:#1a9b59}
.gate.rejected{background:#fdecec;color:#e5484d}
.gate.pending{background:#fcf0e3;color:#d9730d}
.gate.current{outline:2px solid #2c7be5;outline-offset:1px}
.roadmap-release{margin-bottom:20px}
.relhead{font-size:.9rem;font-weight:700;margin-bottom:8px}
.phasegroup{margin-bottom:14px}
.phaseh{font-size:.8rem;font-weight:600;color:#666;margin-bottom:6px}`;

const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(data.project)} — Progress Dashboard</title>
<style>${css}</style></head>
<body><div class="wrap">
<h1>${esc(data.project)}</h1>
<div class="sub">Progress Dashboard &middot; generated ${today} &middot; <a href="${esc(data.prd || '')}">PRD</a></div>
<div class="verdict" style="background:${verdict.grad}">
  <div class="ring"><span class="ringpct">${pct}%</span><span class="ringof">${sd} of ${currentStories.length} stories done</span></div>
  <h2>${verdict.word}</h2>
  <div class="hl">${esc(headline)}</div>
  <div class="act">${esc(action)}</div>
</div>
${releaseWarningSection()}
${coverageSection()}
<h2>Work board &middot; ${esc(currentRelease)}</h2>
<div class="board">
${column('blocked', buckets.blocked, false)}
${column('in_progress', buckets.in_progress, false)}
${column('next', buckets.next, false)}
${column('done', buckets.done, true)}
</div>
<h2>Epics &middot; ${esc(currentRelease)}</h2>
${currentReleaseSection()}
${otherReleases.length ? '<h2>Other releases</h2><div class="releases">' + otherReleases.map((r) => otherReleaseGroup(r)).join('') + '</div>' : ''}
<h2>Planning</h2>
${gateSection()}
${roadmapSection()}
<div class="ts">${stories.length !== currentStories.length ? 'All releases: ' + allDone + ' of ' + stories.length + ' stories done &middot; ' : ''}Source: docs/engineering/backlog.json</div>
</div></body></html>`;

writeFileSync(outPath, html, 'utf8');
console.log('OK dashboard written → ' + outPath);
