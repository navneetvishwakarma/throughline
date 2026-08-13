#!/usr/bin/env node
// Detect the target repo's stack, run its own established coverage tool, and record
// the top-line result. Dependency-free. Never re-implements per-file reporting — each
// stack's native standard-format report (lcov, cobertura xml, jacoco xml, go cover
// profile) is left on disk exactly where that tool writes it; this script only reads
// the one summary percentage back out of it.
//
// Usage: node scripts/coverage.mjs [--json] [--check] [--reuse] [--setup]
//                                  [--story <id>] [--stack <id>] [--threshold <0-1>]
//                                  [--out <path>]
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const val = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };

const asJson = flag('--json');
const doCheck = flag('--check');
const doSetup = flag('--setup');
const doReuse = flag('--reuse');
const storyId = val('--story');
const stackFilter = val('--stack');
const thresholdArg = val('--threshold');

const backlogPath = join(root, 'docs/engineering/backlog.json');
const summaryPath = val('--out') || join(root, '.throughline/coverage/summary.json');

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function sh(cmd, cmdArgs, opts = {}) {
  // Windows can't spawnSync a .cmd/.bat shim (e.g. node_modules/.bin/vitest.cmd) without a shell.
  const shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd);
  return spawnSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8', windowsHide: true, shell, ...opts });
}
function ok(result) { return result && !result.error && result.status === 0; }
function binPath(name) {
  const exe = process.platform === 'win32' ? name + '.cmd' : name;
  const p = join(root, 'node_modules/.bin', exe);
  return existsSync(p) ? p : null;
}
function hasPkgDep(pkg, name) {
  return !!(pkg?.dependencies?.[name] || pkg?.devDependencies?.[name]);
}

const backlog = readJson(backlogPath);
const coverageConfig = backlog?.coverage || null; // absent key = enforcement off, per contract

const VALID_MODES = ['off', 'warn', 'enforce'];
const rawMode = coverageConfig?.mode;
const resolvedMode = rawMode === undefined ? 'off' : rawMode;
if (!VALID_MODES.includes(resolvedMode)) {
  console.error('Invalid coverage.mode: ' + JSON.stringify(rawMode) + ' (must be one of ' + VALID_MODES.join('|') + '). Refusing to guess -- fix docs/engineering/backlog.json (validate.mjs also rejects this).');
  process.exit(2);
}

function isValidFraction(n) { return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1; }

const rawMin = coverageConfig?.min;
if (rawMin !== undefined && !isValidFraction(rawMin)) {
  console.error('Invalid coverage.min: ' + JSON.stringify(rawMin) + ' (must be a finite number from 0 through 1).');
  process.exit(2);
}
const baseThreshold = rawMin ?? 0.7;

let threshold = baseThreshold;
if (thresholdArg != null) {
  const parsedThreshold = Number(thresholdArg);
  if (!isValidFraction(parsedThreshold)) {
    console.error('Invalid --threshold: ' + JSON.stringify(thresholdArg) + ' (must be a finite number from 0 through 1).');
    process.exit(2);
  }
  threshold = parsedThreshold;
}
const stackAllowlist = coverageConfig?.stacks;

// ---- istanbul-style json-summary reader (vitest/jest/c8) ----
function readIstanbulSummary(relPath) {
  const data = readJson(join(root, relPath));
  const t = data?.total?.lines;
  if (!t) return null;
  return { covered: t.covered, total: t.total, pct: t.total ? t.covered / t.total : 0 };
}

// ---- Go cover profile reader (exact line counts, no third-party parser needed) ----
function readGoCoverProfile(relPath) {
  const text = (() => { try { return readFileSync(join(root, relPath), 'utf8'); } catch { return null; } })();
  if (!text) return null;
  let covered = 0, total = 0;
  for (const line of text.split('\n').slice(1)) {
    const m = line.match(/\s(\d+)\s+(\d+)\s*$/);
    if (!m) continue;
    const numStmt = Number(m[1]), count = Number(m[2]);
    total += numStmt;
    if (count > 0) covered += numStmt;
  }
  if (!total) return null;
  return { covered, total, pct: covered / total };
}

// ---- coverage.py json reader ----
function readCoveragePyJson(relPath) {
  const data = readJson(join(root, relPath));
  const t = data?.totals;
  if (!t) return null;
  return { covered: t.covered_lines, total: t.num_statements, pct: (t.percent_covered ?? 0) / 100 };
}

// ---- JaCoCo xml reader (last report-level LINE counter; regex, no XML dep) ----
function readJacocoXml(relPath) {
  const text = (() => { try { return readFileSync(join(root, relPath), 'utf8'); } catch { return null; } })();
  if (!text) return null;
  const matches = [...text.matchAll(/<counter type="LINE" missed="(\d+)" covered="(\d+)"\/>/g)];
  if (!matches.length) return null;
  const [, missed, covered] = matches[matches.length - 1];
  const m = Number(missed), c = Number(covered);
  const total = m + c;
  return total ? { covered: c, total, pct: c / total } : null;
}

// ---- cargo-llvm-cov json reader ----
function readCargoLlvmCovJson(text) {
  try {
    const data = JSON.parse(text);
    const lines = data?.data?.[0]?.totals?.lines;
    if (!lines) return null;
    return { covered: lines.covered, total: lines.count, pct: lines.count ? lines.covered / lines.count : 0 };
  } catch { return null; }
}

// ---- stack descriptors ----
const pkg = existsSync(join(root, 'package.json')) ? readJson(join(root, 'package.json')) : null;

function nodeStack() {
  if (!pkg) return null;
  if (hasPkgDep(pkg, 'vitest')) {
    return {
      id: 'node-vitest', tool: '@vitest/coverage-v8', needsPkg: '@vitest/coverage-v8',
      resolvable: () => !!binPath('vitest'),
      run: () => sh(binPath('vitest'), ['run', '--coverage', '--coverage.reporter=json-summary', '--coverage.reporter=lcov']),
      report: () => readIstanbulSummary('coverage/coverage-summary.json'),
      reportFormat: 'lcov', reportPath: 'coverage/lcov.info',
    };
  }
  if (hasPkgDep(pkg, 'jest')) {
    return {
      id: 'node-jest', tool: 'jest (built-in coverage)', needsPkg: null,
      resolvable: () => !!binPath('jest'),
      run: () => sh(binPath('jest'), ['--coverage', '--coverageReporters=json-summary', '--coverageReporters=lcov']),
      report: () => readIstanbulSummary('coverage/coverage-summary.json'),
      reportFormat: 'lcov', reportPath: 'coverage/lcov.info',
    };
  }
  return {
    id: 'node-test', tool: 'c8', needsPkg: 'c8',
    resolvable: () => !!binPath('c8') && !!pkg.scripts?.test,
    run: () => sh(binPath('c8'), ['--reporter=json-summary', '--reporter=lcov', 'npm', 'test']),
    report: () => readIstanbulSummary('coverage/coverage-summary.json'),
    reportFormat: 'lcov', reportPath: 'coverage/lcov.info',
  };
}

function pythonStack() {
  if (!existsSync(join(root, 'pyproject.toml')) && !existsSync(join(root, 'requirements.txt'))) return null;
  const py = ok(sh('python3', ['--version'])) ? 'python3' : ok(sh('python', ['--version'])) ? 'python' : null;
  return {
    id: 'python', tool: 'coverage.py', needsPkg: 'coverage',
    resolvable: () => !!py && ok(sh(py, ['-c', 'import coverage'])),
    run: () => {
      const test = sh(py, ['-m', 'coverage', 'run', '-m', 'pytest']);
      if (!ok(test)) return test;
      return sh(py, ['-m', 'coverage', 'json', '-o', '.throughline/coverage/python-coverage.json']);
    },
    report: () => readCoveragePyJson('.throughline/coverage/python-coverage.json'),
    reportFormat: 'coverage.py-json', reportPath: '.throughline/coverage/python-coverage.json',
  };
}

function goStack() {
  if (!existsSync(join(root, 'go.mod'))) return null;
  return {
    id: 'go', tool: 'go test -coverprofile (built into the Go toolchain)', needsPkg: null,
    resolvable: () => ok(sh('go', ['version'])),
    run: () => sh('go', ['test', './...', '-coverprofile=.throughline/coverage/go.cover']),
    report: () => readGoCoverProfile('.throughline/coverage/go.cover'),
    reportFormat: 'go-cover', reportPath: '.throughline/coverage/go.cover',
  };
}

function javaStack() {
  const pomPath = join(root, 'pom.xml');
  const gradlePath = existsSync(join(root, 'build.gradle')) ? join(root, 'build.gradle') : join(root, 'build.gradle.kts');
  const isMaven = existsSync(pomPath);
  const isGradle = existsSync(gradlePath) || existsSync(join(root, 'build.gradle.kts'));
  if (!isMaven && !isGradle) return null;
  const configText = (() => { try { return readFileSync(isMaven ? pomPath : gradlePath, 'utf8'); } catch { return ''; } })();
  const jacocoConfigured = /jacoco/i.test(configText);
  return {
    id: isMaven ? 'java-maven' : 'java-gradle', tool: 'JaCoCo', needsPkg: null,
    resolvable: () => jacocoConfigured && ok(sh(isMaven ? 'mvn' : (process.platform === 'win32' ? './gradlew.bat' : './gradlew'), ['--version'])),
    run: () => isMaven ? sh('mvn', ['test']) : sh(process.platform === 'win32' ? './gradlew.bat' : './gradlew', ['test', 'jacocoTestReport']),
    report: () => readJacocoXml(isMaven ? 'target/site/jacoco/jacoco.xml' : 'build/reports/jacoco/test/jacocoTestReport.xml'),
    reportFormat: 'jacoco-xml',
    reportPath: isMaven ? 'target/site/jacoco/jacoco.xml' : 'build/reports/jacoco/test/jacocoTestReport.xml',
    setupHint: 'Add the jacoco-maven-plugin (Maven) or jacoco Gradle plugin with a report task bound to `test`.',
  };
}

function rustStack() {
  if (!existsSync(join(root, 'Cargo.toml'))) return null;
  let capturedJson = '';
  return {
    id: 'rust', tool: 'cargo-llvm-cov', needsPkg: null,
    resolvable: () => ok(sh('cargo', ['llvm-cov', '--version'])),
    run: () => {
      const result = sh('cargo', ['llvm-cov', '--lcov', '--output-path', '.throughline/coverage/rust-lcov.info']);
      if (!ok(result)) return result;
      const summary = sh('cargo', ['llvm-cov', '--summary-only', '--json']);
      capturedJson = summary.stdout || '';
      return summary;
    },
    report: () => readCargoLlvmCovJson(capturedJson),
    reportFormat: 'lcov', reportPath: '.throughline/coverage/rust-lcov.info',
    setupHint: 'cargo install cargo-llvm-cov',
  };
}

function customStack(command) {
  return {
    id: 'custom', tool: command, needsPkg: null,
    resolvable: () => true,
    run: () => sh(process.platform === 'win32' ? 'cmd' : 'sh', process.platform === 'win32' ? ['/c', command] : ['-c', command]),
    report: () => readIstanbulSummary('coverage/coverage-summary.json'),
    summaryPath: 'coverage/coverage-summary.json',
    reportFormat: 'lcov', reportPath: 'coverage/lcov.info',
  };
}

// ---- explicit monorepo targets (coverage.targets) -- take priority over auto-detection ----
function resolveWithinRoot(relPath, label) {
  const abs = resolve(root, relPath);
  const rel = relative(root, abs);
  if (rel !== '' && (rel.startsWith('..') || isAbsolute(rel))) {
    console.error(label + ' escapes the repository root: ' + relPath);
    process.exit(2);
  }
  return { abs, rel: rel === '' ? '.' : rel };
}

function targetStack(t) {
  if (!t || typeof t.id !== 'string' || !t.id.trim() || typeof t.cwd !== 'string' || !t.cwd.trim()
    || typeof t.command !== 'string' || !t.command.trim() || typeof t.summary !== 'string' || !t.summary.trim()) {
    console.error('Malformed coverage.targets entry: ' + JSON.stringify(t) + ' (run node scripts/validate.mjs for details).');
    process.exit(2);
  }
  const cwd = resolveWithinRoot(t.cwd, 'coverage target "' + t.id + '" cwd');
  const summary = resolveWithinRoot(join(t.cwd, t.summary), 'coverage target "' + t.id + '" summary');
  const lcov = t.lcov ? resolveWithinRoot(join(t.cwd, t.lcov), 'coverage target "' + t.id + '" lcov') : null;
  return {
    id: t.id, tool: t.command, needsPkg: null,
    resolvable: () => existsSync(cwd.abs),
    run: () => sh(process.platform === 'win32' ? 'cmd' : 'sh', process.platform === 'win32' ? ['/c', t.command] : ['-c', t.command], { cwd: cwd.abs }),
    report: () => readIstanbulSummary(summary.rel),
    summaryPath: summary.rel,
    reportFormat: 'lcov', reportPath: lcov ? lcov.rel : summary.rel,
  };
}
const explicitTargets = Array.isArray(coverageConfig?.targets) ? coverageConfig.targets : null;

const ALL_STACKS = explicitTargets && explicitTargets.length
  ? explicitTargets.map(targetStack)
  : coverageConfig?.command
  ? [customStack(coverageConfig.command)]
  : [nodeStack, pythonStack, goStack, javaStack, rustStack].map((f) => f()).filter(Boolean);
const unknownConfiguredStack = Array.isArray(stackAllowlist)
  ? stackAllowlist.find((id) => !ALL_STACKS.some((s) => s.id === id))
  : undefined;
if (unknownConfiguredStack !== undefined) {
  console.error('Unknown coverage.stacks identifier "' + unknownConfiguredStack + '". Known: ' + (ALL_STACKS.map((s) => s.id).join(', ') || '(none detected)'));
  process.exit(2);
}
const stacks = ALL_STACKS.filter((s) => (!stackFilter || s.id === stackFilter) && (!stackAllowlist || stackAllowlist.includes(s.id)));
if (stackFilter && !ALL_STACKS.some((s) => s.id === stackFilter)) {
  console.error('Unknown --stack "' + stackFilter + '". Known: ' + (ALL_STACKS.map((s) => s.id).join(', ') || '(none detected)'));
  process.exit(2);
}
if (Array.isArray(stackAllowlist) && !stacks.length) {
  console.error('Configured coverage.stacks selected no detected stack. Known: ' + (ALL_STACKS.map((s) => s.id).join(', ') || '(none detected)'));
  process.exit(2);
}

function setupHintFor(stack) {
  if (stack.setupHint) return stack.setupHint;
  if (stack.needsPkg) return 'npm install -D ' + stack.needsPkg;
  return 'Install/configure ' + stack.tool + ' for this project.';
}

// ---- --setup: non-destructive, prints what a human still needs to run ----
if (doSetup) {
  if (!stacks.length) {
    console.log('No recognized stack to set up.');
    process.exit(0);
  }
  for (const stack of stacks) {
    if (stack.resolvable()) { console.log(stack.id + ': already configured (' + stack.tool + ').'); continue; }
    if (stack.needsPkg && pkg) {
      pkg.devDependencies = pkg.devDependencies || {};
      if (!pkg.devDependencies[stack.needsPkg]) {
        pkg.devDependencies[stack.needsPkg] = 'latest';
        writeJson(join(root, 'package.json'), pkg);
        console.log(stack.id + ': added "' + stack.needsPkg + '": "latest" to devDependencies (pin a real version before installing).');
      }
    }
    console.log(stack.id + ': next step -> ' + setupHintFor(stack));
  }
  process.exit(0);
}

// ---- run / reuse ----
function currentCommit() {
  const r = sh('git', ['rev-parse', 'HEAD']);
  return ok(r) ? r.stdout.trim() : null;
}

function loadExisting() {
  const existing = readJson(summaryPath);
  if (!existing) { console.error('No existing coverage summary at ' + summaryPath + ' — run without --reuse first.'); process.exit(2); }
  return existing;
}

// --reuse must re-evaluate against the CURRENT threshold, not trust the stored
// `passed` flag — otherwise raising coverage.min after the summary was written
// would silently keep passing. It also flags (not blocks on) a stale commit.
function reevaluate(existing) {
  const stacks = (existing.stacks || []).map((s) => ({
    ...s,
    passed: s.status === 'ok' ? s.pct >= threshold : s.status === 'needs_setup' ? resolvedMode !== 'enforce' : false,
  }));
  const pct = existing.aggregate?.pct ?? null;
  const now = currentCommit();
  if (existing.commit && now && existing.commit !== now) {
    console.error('warning: reusing a coverage summary from commit ' + existing.commit + ', but HEAD is now ' + now + '. Re-run without --reuse if the code has changed.');
  }
  return { ...existing, stacks, threshold, mode: resolvedMode, passed: stacks.every((s) => s.passed !== false) && (pct == null || pct >= threshold) };
}

let summary;
if (doReuse) {
  summary = reevaluate(loadExisting());
} else if (!stacks.length) {
  summary = { generatedAt: new Date().toISOString(), status: 'skipped', stacks: [], commit: currentCommit(), aggregate: { pct: null }, threshold, mode: resolvedMode, passed: true };
} else {
  const results = stacks.map((stack) => {
    if (!stack.resolvable()) {
      return { stack: stack.id, tool: stack.tool, status: 'needs_setup', hint: setupHintFor(stack), passed: resolvedMode !== 'enforce' };
    }
    let runResult;
    try {
      if (stack.summaryPath) rmSync(join(root, stack.summaryPath), { force: true });
      runResult = stack.run();
    } catch (e) { return { stack: stack.id, tool: stack.tool, status: 'error', message: String(e?.message || e), passed: false }; }
    if (!ok(runResult)) {
      return { stack: stack.id, tool: stack.tool, status: 'error', message: (runResult.stderr || runResult.stdout || 'command failed').slice(0, 2000), passed: false };
    }
    let parsed;
    try { parsed = stack.report(); } catch { parsed = null; }
    if (!parsed) return { stack: stack.id, tool: stack.tool, status: 'error', message: 'coverage ran but no report found at ' + (stack.summaryPath || stack.reportPath), passed: false };
    return {
      stack: stack.id, tool: stack.tool, status: 'ok',
      reportFormat: stack.reportFormat, reportPath: stack.reportPath,
      covered: parsed.covered, total: parsed.total, pct: parsed.pct,
      passed: parsed.pct >= threshold,
    };
  });
  const okResults = results.filter((r) => r.status === 'ok');
  const coveredSum = okResults.reduce((a, r) => a + r.covered, 0);
  const totalSum = okResults.reduce((a, r) => a + r.total, 0);
  const aggregatePct = totalSum ? coveredSum / totalSum : null;
  const status = results.every((r) => r.status === 'ok') ? 'ok'
    : results.some((r) => r.status === 'error') ? 'error'
    : 'needs_setup';
  summary = {
    generatedAt: new Date().toISOString(), status, stacks: results, commit: currentCommit(),
    aggregate: { pct: aggregatePct }, threshold, mode: resolvedMode,
    passed: results.every((r) => r.passed !== false) && (aggregatePct == null || aggregatePct >= threshold),
  };
  writeJson(summaryPath, summary);
}

// ---- --story: patch verify.coverage, nothing else ----
// Confirmation goes to stderr (not stdout) so stdout stays pure, parseable JSON for --json callers.
if (storyId) {
  if (!backlog) { console.error('Cannot read ' + backlogPath); process.exit(2); }
  const story = (backlog.stories || []).find((s) => s.id === storyId);
  if (!story) { console.error('Unknown story ' + storyId); process.exit(2); }
  if (summary.aggregate.pct != null) {
    story.verify = { ...(story.verify || {}), coverage: Math.round(summary.aggregate.pct * 1000) / 1000 };
    writeJson(backlogPath, backlog);
    console.error('OK wrote verify.coverage=' + story.verify.coverage + ' for ' + storyId);
  } else {
    console.error('No numeric coverage available for ' + storyId + ' (status=' + summary.status + '); verify.coverage left untouched.');
  }
}

// ---- report ----
if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log('Coverage: ' + summary.status + (summary.aggregate.pct != null ? ' — ' + (summary.aggregate.pct * 100).toFixed(1) + '% (min ' + (threshold * 100).toFixed(0) + '%)' : ''));
  for (const s of summary.stacks || []) {
    if (s.status === 'ok') console.log('  ' + s.stack + ': ' + (s.pct * 100).toFixed(1) + '% via ' + s.tool + ' (' + s.reportPath + ')');
    else if (s.status === 'needs_setup') console.error('  ' + s.stack + ': coverage tool not set up. Recommended: ' + s.tool + '. Run `node scripts/coverage.mjs --setup`, or manually: ' + s.hint);
    else if (s.status === 'error') console.error('  ' + s.stack + ': error — ' + s.message);
  }
}

// ---- exit code ----
if (summary.status === 'skipped' || resolvedMode !== 'enforce') process.exit(0);
if (doCheck && !summary.passed) process.exit(1);
process.exit(0);
