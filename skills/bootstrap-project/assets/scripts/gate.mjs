#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const gatePath = join(root, '.throughline/gates.json');
const gates = ['G1', 'G1.5', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];
const [cmd, rawGate, ...rest] = process.argv.slice(2);

function usage() {
  console.error('Usage: node scripts/gate.mjs <check|approve|reject|next|list> [Gx] [--note "..."]');
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

function requireGate(gate) {
  if (!gates.includes(gate)) {
    console.error('Unknown gate ' + JSON.stringify(gate) + '. Valid gates: ' + gates.join(', '));
    process.exit(2);
  }
}

if (!cmd) usage();
const data = load();

if (cmd === 'list') {
  for (const gate of gates) {
    const state = data.gates[gate]?.status || 'pending';
    console.log(gate + ': ' + state);
  }
  process.exit(0);
}

if (cmd === 'next') {
  const next = gates.find((gate) => data.gates[gate]?.status !== 'approved');
  console.log(next ? next + ' pending' : 'All gates approved');
  process.exit(0);
}

requireGate(rawGate);

if (cmd === 'check') {
  if (data.gates[rawGate]?.status === 'approved') {
    console.log(rawGate + ' approved');
    process.exit(0);
  }
  console.error(rawGate + ' is not approved');
  process.exit(1);
}

if (cmd === 'approve' || cmd === 'reject') {
  data.gates[rawGate] = {
    status: cmd === 'approve' ? 'approved' : 'rejected',
    note: noteFrom(rest),
    updatedAt: new Date().toISOString(),
  };
  save(data);
  console.log(rawGate + ' ' + data.gates[rawGate].status);
  process.exit(cmd === 'approve' ? 0 : 1);
}

usage();
