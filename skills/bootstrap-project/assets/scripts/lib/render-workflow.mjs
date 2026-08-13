#!/usr/bin/env node
// Renders .github/workflows/throughline.yml for a target repo, chosen by which lockfile it
// has committed. Shared by sync-plugin.mjs so every path that can place this file (fresh
// bootstrap, adopt-project, upgrade-project) agrees on its content instead of each
// re-implementing the choice.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const HEAD = `name: Throughline

on:
  pull_request:
  push:
    branches: [main, master]

permissions:
  contents: read

jobs:
  validate-contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node scripts/validate.mjs
      - run: node scripts/check-docs.mjs
      - run: node scripts/build-dashboard.mjs --out /tmp/PROGRESS_DASHBOARD.html

  # Add a matching setup step (setup-python / setup-go / setup-java / dtolnay/rust-toolchain)
  # if this repo isn't Node -- coverage.mjs itself is a Node script, so setup-node always runs
  # regardless of the product's own stack.
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
`;

const INSTALL_STEPS = {
  pnpm: `      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
`,
  npm: `      - run: npm ci
`,
  yarn: `      - run: corepack enable
      - run: yarn install --immutable
`,
  'package-json-no-lockfile': `      - run: |
          echo "::error::No supported lockfile (pnpm-lock.yaml, package-lock.json, or yarn.lock) found at the repository root. Commit one before coverage can run reproducibly in CI."
          exit 1
`,
  'no-node': '',
};

const TAIL = `      - run: node scripts/coverage.mjs --json > /tmp/coverage-summary.json
      - name: Evaluate coverage result
        run: |
          node -e "
            const s = JSON.parse(require('fs').readFileSync('/tmp/coverage-summary.json', 'utf8'));
            console.log('coverage status:', s.status, s.aggregate?.pct != null ? (s.aggregate.pct * 100).toFixed(1) + '%' : '');
            if (s.status === 'needs_setup' || s.status === 'skipped') {
              console.log('::warning::coverage.mjs status=' + s.status + ' -- see job output above for the recommended setup command.');
              process.exit(0);
            }
            process.exit(s.passed ? 0 : 1);
          "
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: |
            coverage/lcov.info
            coverage.xml
            .throughline/coverage/**
          if-no-files-found: ignore
`;

// 'package-json-no-lockfile' means a real hygiene gap (package.json exists, no lockfile
// committed) -- not "this isn't a Node project". A repo with no package.json at all
// (Python/Go/Java/Rust) gets no install step: coverage.mjs is dependency-free and reports
// 'skipped' on its own when no stack is detected, so forcing a Node install failure there
// would be a false positive, not a truthful one.
export function detectLockfile(root) {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'package-lock.json'))) return 'npm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  return existsSync(join(root, 'package.json')) ? 'package-json-no-lockfile' : 'no-node';
}

export function renderWorkflow(root) {
  return HEAD + INSTALL_STEPS[detectLockfile(root)] + TAIL;
}
