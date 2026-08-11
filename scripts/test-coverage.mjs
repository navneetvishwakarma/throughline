#!/usr/bin/env node
// Runs the suite with coverage that actually reaches the scripts under test. Most of
// tests/throughline.test.mjs exercises skills/*/assets/scripts/*.mjs by copying the whole
// scaffold into a throwaway temp project (makeProject()) and spawning each script there as
// a real child process (runNode()) -- that's the correct way to test a CLI tool, but it means
// two things node's own `--experimental-test-coverage` gets wrong: (1) it only instruments the
// parent process, silently reporting 0% on everything actually spawned, and (2) even raw
// per-process V8 coverage (NODE_V8_COVERAGE) records the executed file's *temp-copy* path, not
// its source-controlled path under skills/bootstrap-project/assets/scripts/ -- so a plain c8
// report would show nothing for the fixture runs. This script captures NODE_V8_COVERAGE across
// the whole tree (parent + every spawned child), remaps each temp-copy url back to its
// canonical repo path by basename (the copy is byte-identical to the source), then lets c8
// merge and report against the remapped set.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = process.cwd();
const rawDir = join(root, '.coverage', 'raw');
const remappedDir = join(root, '.coverage', 'remapped');
rmSync(join(root, '.coverage'), { recursive: true, force: true });
mkdirSync(rawDir, { recursive: true });
mkdirSync(remappedDir, { recursive: true });

const testFiles = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.mjs')).map((f) => join('tests', f));
const test = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: root, stdio: 'inherit', env: { ...process.env, NODE_V8_COVERAGE: rawDir },
});
if (test.status !== 0) process.exit(test.status ?? 1);

// scripts/*.mjs (this repo's own tooling) and skills/bootstrap-project/assets/scripts/*.mjs
// (the template copied into every scaffolded/spawned project) both need remap-by-basename,
// since the fixture harness copies the latter tree before running anything in it.
const sourceDirs = [join(root, 'scripts'), join(root, 'skills/bootstrap-project/assets/scripts')];
const canonicalByName = new Map();
for (const dir of sourceDirs) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
    canonicalByName.set(f, pathToFileURL(join(dir, f)).href);
  }
}

let remappedCount = 0;
for (const f of readdirSync(rawDir)) {
  const data = JSON.parse(readFileSync(join(rawDir, f), 'utf8'));
  for (const entry of data.result || []) {
    if (!entry.url.startsWith('file://')) continue;
    const name = fileURLToPath(entry.url).split(/[\\/]/).pop();
    const canonical = canonicalByName.get(name);
    if (canonical && entry.url !== canonical) { entry.url = canonical; remappedCount++; }
  }
  writeFileSync(join(remappedDir, f), JSON.stringify(data));
}
console.log('Remapped ' + remappedCount + ' coverage entries to their canonical source path.');

const report = spawnSync(process.execPath, [
  join(root, 'node_modules/c8/bin/c8.js'), 'report',
  '--temp-directory', remappedDir,
  '--reporter', 'text', '--reporter', 'lcov',
  '--report-dir', join(root, '.coverage', 'report'),
  '--include', 'scripts/**',
  '--include', 'skills/bootstrap-project/assets/scripts/**',
], { cwd: root, stdio: 'inherit' });
process.exit(report.status ?? 0);
