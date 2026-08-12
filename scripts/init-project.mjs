#!/usr/bin/env node
// Phase A bootstrap — deterministic, no deps. Idempotent (never overwrites). Run at the project root.
import { chmodSync, copyFileSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
const root = process.cwd();
const project = process.argv[2] || '<PROJECT_NAME>';
const T = join(root, 'docs/_templates');
const created = [], skipped = [];
function place(target, content) {
  const abs = join(root, target);
  if (existsSync(abs)) { skipped.push(target); return; }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  created.push(target);
}
function tpl(name, title) {
  const raw = readFileSync(join(T, name), 'utf8');
  return raw.replaceAll('<PROJECT_NAME>', project).replaceAll('<DOC_TITLE>', title || '').replaceAll('<DATE>', new Date().toISOString().slice(0, 10));
}
const generic = (n, title) => place(n, tpl('_doc.template.md', title));
[
  ['docs/product/01-product-vision.md', 'Product Vision'],
  ['docs/product/02-product-thesis.md', 'Product Thesis'],
  ['docs/product/03-user-personas.md', 'User Personas'],
  ['docs/product/04-market-research.md', 'Market Research'],
  ['docs/product/05-competitive-analysis.md', 'Competitive Analysis'],
  ['docs/product/07-success-metrics.md', 'Success Metrics'],
  ['docs/product/10-gtm-strategy.md', 'Go-to-Market Strategy'],
  ['docs/architecture/01-system-overview.md', 'System Overview'],
  ['docs/architecture/02-tech-stack.md', 'Tech Stack'],
  ['docs/architecture/03-data-model.md', 'Data Model'],
  ['docs/architecture/05-api-design.md', 'API Design'],
  ['docs/architecture/07-infrastructure.md', 'Infrastructure'],
].forEach(([p, t]) => generic(p, t));
place('docs/product/06-prd.md', tpl('prd.template.md', 'Product Requirements'));
place('docs/design/README.md', tpl('design-readme.template.md', 'Design'));
place('docs/engineering/01-tech-plan.md', tpl('tech-plan.template.md', 'Technical Plan'));
place('docs/architecture/decisions/ADR-0001-example.md', tpl('adr.template.md', 'Example Decision'));
place('docs/design/tokens.md', tpl('design-tokens.template.md', 'Design Tokens'));
place('docs/design/journeys/example-journey.md', tpl('journey.template.md', 'Example Journey'));
place('docs/design/screens/example-screen.md', tpl('screen.template.md', 'Example Screen'));
place('docs/engineering/backlog.json', readFileSync(join(root, 'docs/engineering/backlog.seed.json'), 'utf8').replaceAll('<PROJECT_NAME>', project));
place('AGENTS.md', tpl('CLAUDE.template.md'));
const manualPtr = '# ' + project + ' — agent operating manual\n\nCanonical manual: see **AGENTS.md** (cross-agent — Claude, Cursor, Codex, Gemini).\n';
place('CLAUDE.md', manualPtr);
place('GEMINI.md', manualPtr);
if (existsSync(join(root, '.git')) && existsSync(join(root, '.githooks/pre-commit'))) {
  const hook = join(root, '.git/hooks/pre-commit');
  if (!existsSync(hook)) {
    mkdirSync(dirname(hook), { recursive: true });
    copyFileSync(join(root, '.githooks/pre-commit'), hook);
    try { chmodSync(hook, 0o755); } catch {}
    created.push('.git/hooks/pre-commit');
  } else {
    skipped.push('.git/hooks/pre-commit');
  }
}
console.log('OK Bootstrapped "' + project + '"');
console.log('  created: ' + created.length);
created.forEach((f) => console.log('    + ' + f));
if (skipped.length) { console.log('  skipped (exist): ' + skipped.length); }
console.log('\nNext: fill the PRD (REQ-xx ids), set status: approved, seed backlog.json, run define-epic.');
