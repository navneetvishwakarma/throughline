#!/usr/bin/env node
// Gates are tracked globally by default (data.gates[gate].status) — fine for a gate that
// clears once per project (G1-G5, G8, G9). G6/G7 run once PER EPIC in a loop, so a bare
// global flag left over from a previous epic would silently satisfy a later epic's
// gate-in check without the human ever approving that epic's plan or merge. Pass
// --subject <epic-id> (or any stable id) to scope approval to that one thing; the
// global slot still updates alongside it for `list`; checks must name the subject.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const gatePath = join(root, '.throughline/gates.json');
const gates = ['G1', 'G1.5', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9'];
const optionalGates = new Set(['G1.5']);
const subjectGates = new Set(['G6', 'G7']);
const [cmd, rawGate, ...rest] = process.argv.slice(2);

function usage() {
  console.error('Usage: node scripts/gate.mjs <check|approve|reject|next|list> [Gx] [--note "..."] [--subject <id>]');
  process.exit(2);
}

function load() {
  if (!existsSync(gatePath)) return { gates: {} };
  return JSON.parse(readFileSync(gatePath, 'utf8'));
}

function save(data) {
  mkdirSync(dirname(gatePath), { recursive: true });
  writeFileSync(gatePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function noteFrom(args) {
  const idx = args.indexOf('--note');
  return idx === -1 ? '' : String(args[idx + 1] || '');
}

function subjectFrom(args) {
  const idx = args.indexOf('--subject');
  return idx === -1 ? null : String(args[idx + 1] || '') || null;
}

function requireGate(gate) {
  if (!gates.includes(gate)) {
    console.error('Unknown gate ' + JSON.stringify(gate) + '. Valid gates: ' + gates.join(', '));
    process.exit(2);
  }
}

// G6/G7 run once per epic, so `next` must derive readiness from subject-scoped decisions for
// every epic in the release actually being worked, never the bare global slot (which is only a
// convenience rollup for `list` and can be stale from a prior or different epic).
function currentReleaseEpicIds() {
  try {
    const backlog = JSON.parse(readFileSync(join(root, 'docs/engineering/backlog.json'), 'utf8'));
    const release = backlog.release_in_flight || 'v1';
    return (backlog.epics || [])
      .filter((epic) => (epic.release || 'v1') === release)
      .map((epic) => epic.id);
  } catch {
    return [];
  }
}

if (!cmd) usage();
const data = load();
const subject = subjectFrom(rest);

if (cmd === 'list') {
  for (const gate of gates) {
    const entry = data.gates[gate];
    const state = entry?.status || 'pending';
    const subjects = entry?.subjects ? Object.entries(entry.subjects) : [];
    const subjectSummary = subjects.length ? ' (' + subjects.map(([id, s]) => id + ': ' + s.status).join(', ') + ')' : '';
    console.log(gate + ': ' + state + subjectSummary);
  }
  process.exit(0);
}

if (cmd === 'next') {
  const epicIds = currentReleaseEpicIds();
  const blocked = (gate) => {
    if (optionalGates.has(gate)) return data.gates[gate]?.status === 'rejected';
    if (subjectGates.has(gate)) {
      return epicIds.some((id) => data.gates[gate]?.subjects?.[id]?.status !== 'approved');
    }
    return data.gates[gate]?.status !== 'approved';
  };
  const next = gates.find(blocked);
  if (!next) {
    console.log('All gates approved');
  } else if (optionalGates.has(next)) {
    console.log(next + ' rejected');
  } else {
    console.log(next + ' pending');
  }
  process.exit(0);
}

requireGate(rawGate);

if (cmd === 'check') {
  if (subjectGates.has(rawGate) && !subject) {
    console.error(rawGate + ' requires --subject <id> because approval is recorded per subject');
    process.exit(2);
  }
  if (subject) {
    if (data.gates[rawGate]?.subjects?.[subject]?.status === 'approved') {
      console.log(rawGate + ' approved for ' + subject);
      process.exit(0);
    }
    console.error(rawGate + ' is not approved for ' + subject);
    process.exit(1);
  }
  if (data.gates[rawGate]?.status === 'approved') {
    console.log(rawGate + ' approved');
    process.exit(0);
  }
  console.error(rawGate + ' is not approved');
  process.exit(1);
}

if (cmd === 'approve' || cmd === 'reject') {
  if (subjectGates.has(rawGate) && !subject) {
    console.error(rawGate + ' requires --subject <id> because approval is recorded per subject');
    process.exit(2);
  }
  const status = cmd === 'approve' ? 'approved' : 'rejected';
  const entry = { status, note: noteFrom(rest), updatedAt: new Date().toISOString() };
  data.gates[rawGate] = { ...(data.gates[rawGate] || {}), ...entry, subjects: data.gates[rawGate]?.subjects };
  if (subject) {
    data.gates[rawGate].subjects = { ...(data.gates[rawGate].subjects || {}), [subject]: entry };
  }
  save(data);
  console.log(rawGate + (subject ? ' (' + subject + ')' : '') + ' ' + status);
  process.exit(cmd === 'approve' ? 0 : 1);
}

usage();
