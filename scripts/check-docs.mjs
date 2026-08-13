#!/usr/bin/env node
// Structural checks for the doc tiers (PRD, design, architecture, retros) that were
// previously only "self-checked" by an agent reading a skill's prose Automated-gate
// bullets. This script owns everything objectively checkable (front-matter status
// enums, id formats, id uniqueness, cross-references, required sections). It does NOT
// and CANNOT check semantic quality — whether a requirement is well-written, whether a
// mockup looks good, whether an ADR's reasoning is sound. Those stay human/agent
// judgment, exercised at the gate. Dependency-free. Exits non-zero on error.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const tierArg = args.find((a) => a.startsWith('--tier='))?.split('=')[1];
const asJson = args.includes('--json');
const REQ_RE = /^REQ-[0-9]+$/;
const errors = [];
const err = (m) => errors.push(m);

function docStatus(relPath) {
  const text = readSafe(join(root, relPath));
  if (text == null) return null;
  return frontmatter(text).status;
}

function readSafe(p) {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!kv) continue;
    let [, key, value] = kv;
    value = value.replace(/#.*$/, '').trim(); // strip trailing "# comment"
    if (value.startsWith('[') && value.endsWith(']')) {
      out[key] = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      out[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

function listMdFiles(dir) {
  try { return readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => join(dir, f)); }
  catch { return []; }
}

function hasHeading(text, needle) {
  return new RegExp('^##\\s+.*' + needle + '.*$', 'im').test(text);
}

// ---- PRD ----
// prdIds is used by design's cross-reference check regardless of which --tier was asked
// for, so it's always populated (parsePrd), but PRD's OWN validation errors (checkPrd)
// are only reported when the product tier is actually in scope — otherwise `--tier=design`
// would fail on unrelated PRD issues that have nothing to do with the design tier.
const prdIds = new Set();
function parsePrd() {
  const path = join(root, 'docs/product/06-prd.md');
  const text = readSafe(path);
  if (text == null) return { text: null, rows: [], malformedIds: [] };
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
  const parsed = [];
  const malformedIds = [];
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1).map((c) => c.trim());
    if (!cells.length || !cells[0]) continue;
    const [id, , priority, acceptance, release] = cells;
    if (/^ID$/i.test(id) || cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    if (id.startsWith('REQ-') && !REQ_RE.test(id)) malformedIds.push(id);
    if (!REQ_RE.test(id)) continue; // not a requirement row (e.g. a stray table elsewhere)
    prdIds.add(id);
    parsed.push({ id, priority, acceptance, release });
  }
  return { text, rows: parsed, malformedIds };
}
function checkPrd() {
  const { text, rows, malformedIds } = parsePrd();
  if (text == null) return;
  const fm = frontmatter(text);
  if (!['draft', 'approved'].includes(fm.status)) err('06-prd.md: status must be draft|approved (got ' + JSON.stringify(fm.status) + ')');
  if (!rows.length) err('06-prd.md: Requirements table must contain at least one valid REQ-xx row');
  for (const id of malformedIds) err("06-prd.md: malformed requirement id '" + id + "' must match " + REQ_RE);
  const seen = new Set();
  for (const { id, priority, acceptance, release } of rows) {
    if (seen.has(id)) err('06-prd.md: duplicate requirement id ' + id);
    seen.add(id);
    if (!priority || priority === '…' || priority === '...') err('06-prd.md: ' + id + ' missing Priority');
    if (!acceptance || acceptance === '…' || acceptance === '...') err('06-prd.md: ' + id + ' missing Acceptance');
    if (!release || release === '…' || release === '...') err('06-prd.md: ' + id + ' missing Release tag');
  }
}

// ---- Design tier ----
function checkDesign() {
  const readmePath = join(root, 'docs/design/README.md');
  const readme = readSafe(readmePath);
  if (readme != null) {
    const fm = frontmatter(readme);
    if (!['draft', 'approved'].includes(fm.status)) err('design/README.md: status must be draft|approved (got ' + JSON.stringify(fm.status) + ')');
    if (!existsSync(join(root, 'docs/design/tokens.md'))) err('design/README.md exists but docs/design/tokens.md is missing');
  }

  for (const path of listMdFiles(join(root, 'docs/design/journeys'))) {
    const text = readSafe(path);
    const fm = frontmatter(text);
    const rel = 'design/journeys/' + path.split(/[\\/]/).pop();
    if (!['draft', 'approved'].includes(fm.status)) err(rel + ': status must be draft|approved (got ' + JSON.stringify(fm.status) + ')');
    if (!fm.persona) err(rel + ': persona is required');
    const reqs = Array.isArray(fm.req_ref) ? fm.req_ref : fm.req_ref ? [fm.req_ref] : [];
    if (!reqs.length) err(rel + ': req_ref must reference at least one REQ-xx');
    for (const r of reqs) {
      if (!REQ_RE.test(r)) err(rel + ": req_ref '" + r + "' must match " + REQ_RE);
      else if (prdIds.size && !prdIds.has(r)) err(rel + ": req_ref '" + r + "' is not a requirement in the PRD");
    }
  }

  for (const path of listMdFiles(join(root, 'docs/design/screens'))) {
    const text = readSafe(path);
    const fm = frontmatter(text);
    const rel = 'design/screens/' + path.split(/[\\/]/).pop();
    if (!['draft', 'approved'].includes(fm.status)) err(rel + ': status must be draft|approved (got ' + JSON.stringify(fm.status) + ')');
    if (!['lo-fi', 'hi-fi'].includes(fm.fidelity)) err(rel + ": fidelity must be lo-fi|hi-fi (got " + JSON.stringify(fm.fidelity) + ')');
    if (!fm.req_ref) err(rel + ': req_ref is required');
    else if (!REQ_RE.test(fm.req_ref)) err(rel + ": req_ref '" + fm.req_ref + "' must match " + REQ_RE);
    else if (prdIds.size && !prdIds.has(fm.req_ref)) err(rel + ": req_ref '" + fm.req_ref + "' is not a requirement in the PRD");
    if (!fm.journey) err(rel + ': journey is required');
    if (fm.fidelity === 'hi-fi') {
      const withoutComments = text.replace(/<!--[\s\S]*?-->/g, '');
      const revision = withoutComments.match(/^##\s+Revision history[\s\S]*$/im)?.[0] || '';
      if (!/checkpoint/i.test(revision)) err(rel + ': fidelity is hi-fi but Revision history has no checkpoint line — the wireframe checkpoint step must be recorded before moving to hi-fi (the template\'s own instructional comment does not count)');
    }
  }
}

// ---- Architecture tier ----
const ARCHITECTURE_DOCS = [
  '01-system-overview.md',
  '02-tech-stack.md',
  '03-data-model.md',
  '05-api-design.md',
  '07-infrastructure.md',
];
const PLACEHOLDER_PATTERNS = [
  /One-line purpose of this document\./i,
  /_Why this exists\s*\/\s*what problem it addresses\._/i,
  /_Main content\._/i,
  /^\s*-\s*\[\s*\]\s*(?:…|\.\.\.)\s*$/m,
  /#\s*ADR-XXXX\s*:/i,
  /_The forces at play\s*[—-]\s*what made this decision necessary\._/i,
  /_What we chose\._/i,
  /_Trade-offs accepted, follow-ups created, what this rules out\._/i,
  /^\s*-\s*\*\*Option [AB]\*\*\s*[—-]\s*why not\.\s*$/im,
];

function hasPlaceholder(text) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

function personasApplied(text) {
  const value = text.match(/^\s*\*\*Personas Applied:\*\*\s*(.+)$/im)?.[1] || '';
  const personas = value.split(',').map((persona) => persona.trim().toLowerCase());
  return personas.includes('architect') && personas.includes('security');
}

function substantiveThreatModel(text, sectionOnly) {
  let body = text;
  if (sectionOnly) {
    const match = text.match(/^##\s+Security threat model\s*$/im);
    if (!match) return false;
    body = text.slice(match.index + match[0].length).split(/^##\s+/m)[0];
  }
  body = body
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/^\s*\*\*Personas Applied:\*\*.*$/gim, '');
  return !hasPlaceholder(body) && body.replace(/\s/g, '').length >= 40;
}

function checkArchitecture() {
  const overviewPath = join(root, 'docs/architecture/01-system-overview.md');
  const overview = readSafe(overviewPath);
  if (overview != null) {
    const fm = frontmatter(overview);
    if (!['draft', 'approved'].includes(fm.status)) err('architecture/01-system-overview.md: status must be draft|approved (got ' + JSON.stringify(fm.status) + ')');
  }

  for (const file of ARCHITECTURE_DOCS) {
    const text = readSafe(join(root, 'docs/architecture', file));
    const rel = 'architecture/' + file;
    if (text == null) err(rel + ': required architecture document is missing');
    else if (hasPlaceholder(text)) err(rel + ': contains scaffold placeholder content');
  }

  const decisionsDir = join(root, 'docs/architecture/decisions');
  const adrFiles = listMdFiles(decisionsDir);
  const adrIdOf = (p) => p.split(/[\\/]/).pop().match(/^(ADR-[0-9]+)/)?.[1];
  const knownAdrIds = new Set(adrFiles.map(adrIdOf).filter(Boolean));
  for (const path of adrFiles) {
    const text = readSafe(path);
    const fm = frontmatter(text);
    const rel = 'architecture/decisions/' + path.split(/[\\/]/).pop();
    if (hasPlaceholder(text)) err(rel + ': contains scaffold placeholder content');
    const supersededMatch = String(fm.status || '').match(/^superseded-by\s+(ADR-[0-9]+)$/);
    if (supersededMatch) {
      if (!knownAdrIds.has(supersededMatch[1])) err(rel + ": status references " + supersededMatch[1] + " which does not exist in decisions/");
    } else if (!['proposed', 'accepted', 'superseded'].includes(fm.status)) {
      err(rel + ": status must be proposed|accepted|superseded|'superseded-by ADR-NNNN' (got " + JSON.stringify(fm.status) + ')');
    }
  }
  const threatPath = join(root, 'docs/architecture/security-threat-model.md');
  const threat = readSafe(threatPath);
  if (threat != null && hasPlaceholder(threat)) err('architecture/security-threat-model.md: contains scaffold placeholder content');
  const candidates = [
    overview == null ? null : { text: overview, sectionOnly: true },
    threat == null ? null : { text: threat, sectionOnly: false },
  ].filter(Boolean);
  const substantiveCandidates = candidates.filter(({ text, sectionOnly }) => substantiveThreatModel(text, sectionOnly));
  const validThreatModel = substantiveCandidates.some(({ text }) => personasApplied(text));
  if (!validThreatModel) {
    if (!substantiveCandidates.length) {
      err('architecture: a substantive security threat model is required in 01-system-overview.md or security-threat-model.md');
    } else {
      err('architecture: security threat model must record Architect and Security personas');
    }
  }
}

// ---- Retros ----
function checkRetros() {
  for (const path of listMdFiles(join(root, 'docs/product/retros'))) {
    const text = readSafe(path);
    const fm = frontmatter(text);
    const rel = 'product/retros/' + path.split(/[\\/]/).pop();
    if (!['draft', 'recorded'].includes(fm.status)) err(rel + ': status must be draft|recorded (got ' + JSON.stringify(fm.status) + ')');
    if (!fm.release) err(rel + ': release is required');
    if (!['proceed', 'pivot', 'kill'].includes(fm.decision)) err(rel + ": decision must be proceed|pivot|kill (got " + JSON.stringify(fm.decision) + ')');
    if (!hasHeading(text, 'Metrics')) err(rel + ': missing a Metrics section');
    if (!hasHeading(text, 'Ops health')) err(rel + ': missing an Ops health section');
    if (!hasHeading(text, 'UX signals')) err(rel + ': missing a UX signals / debt section');
    if (!hasHeading(text, 'Decision')) err(rel + ': missing a Decision section');
  }
}

const TIERS = { product: checkPrd, design: checkDesign, architecture: checkArchitecture, retro: checkRetros };
if (tierArg) {
  // Explicit --tier=X is a skill invoking its own pre-approval gate (e.g. define-design
  // deciding whether it's ready to present for G3) — the doc is normally still `draft`
  // at that exact moment, so this always validates fully regardless of status.
  if (!TIERS[tierArg]) { console.error('Unknown --tier ' + tierArg + '. Expected one of: ' + Object.keys(TIERS).join(', ')); process.exit(1); }
  if (tierArg === 'product') checkPrd();
  else { parsePrd(); TIERS[tierArg](); } // populate prdIds for cross-referencing without reporting the PRD's own (out-of-scope) errors
} else {
  // Blanket mode (CI, a repo-wide health check): every product/design/architecture doc
  // is scaffolded with placeholder content from day one, before any skill has actually
  // run — a headless API project's never-touched docs/design/README.md would otherwise
  // fail this forever. Only enforce a tier once its own gate has actually been cleared
  // (status: approved) at least once; before that, the tier's own skill is what governs
  // correctness via its explicit --tier invocation above, not this blanket sweep.
  if (docStatus('docs/product/06-prd.md') === 'approved') checkPrd();
  else parsePrd();
  if (docStatus('docs/design/README.md') === 'approved') checkDesign();
  if (docStatus('docs/architecture/01-system-overview.md') === 'approved') checkArchitecture();
  checkRetros(); // retros are never pre-scaffolded with placeholder content, so no gating needed
}

if (asJson) {
  console.log(JSON.stringify({ passed: errors.length === 0, errors }, null, 2));
} else if (errors.length) {
  console.error('FAIL check-docs found ' + errors.length + ' issue(s):');
  errors.forEach((e) => console.error('  - ' + e));
} else {
  console.log('OK doc-tier structural checks passed' + (tierArg ? ' (' + tierArg + ')' : ''));
}
process.exit(errors.length ? 1 : 0);
