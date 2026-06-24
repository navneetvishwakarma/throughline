#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const args = process.argv.slice(2);
const platform = args.find((arg) => !arg.startsWith('-')) || 'claude';
const dryRun = args.includes('--dry-run');
const uninstall = args.includes('--uninstall');
const home = process.env.HOME || process.env.USERPROFILE;
const name = 'throughline';
const marketplace = 'local';
const version = pkg.version;

if (!home) {
  console.error('Cannot resolve HOME or USERPROFILE.');
  process.exit(1);
}

if (!['claude', 'codex', 'antigravity'].includes(platform)) {
  console.error('Usage: node scripts/install.mjs [claude|codex|antigravity] [--dry-run] [--uninstall]');
  process.exit(1);
}

function log(message) {
  console.log(message);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function copyRepo(target, adapterDir) {
  if (dryRun) return;
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(root, target, {
    recursive: true,
    filter: (source) => {
      const relative = source.slice(root.length).replaceAll('\\', '/');
      return !relative.startsWith('/.git') && !relative.startsWith('/node_modules');
    },
  });
  cpSync(join(root, adapterDir), target, { recursive: true });
}

function updateClaudeRegistry(cacheDir) {
  const registryPath = join(home, '.claude/plugins/installed_plugins.json');
  const key = `${name}@${marketplace}`;
  const now = new Date().toISOString();
  const registry = existsSync(registryPath)
    ? JSON.parse(readFileSync(registryPath, 'utf8'))
    : { plugins: {} };
  registry.plugins ||= {};
  if (uninstall) {
    delete registry.plugins[key];
  } else {
    registry.plugins[key] = [{
      scope: 'user',
      installPath: cacheDir,
      version,
      installedAt: now,
      lastUpdated: now,
      gitCommitSha: 'unknown',
    }];
  }
  if (!dryRun) writeJson(registryPath, registry);
}

function updateCodexMarketplace(pluginDir) {
  const marketplacePath = join(home, '.agents/plugins/marketplace.json');
  const entry = {
    name,
    source: {
      source: 'local',
      path: './plugins/throughline',
    },
    policy: {
      installation: 'AVAILABLE',
      authentication: 'ON_INSTALL',
    },
    category: 'Productivity',
  };
  const catalog = existsSync(marketplacePath)
    ? JSON.parse(readFileSync(marketplacePath, 'utf8'))
    : { name: 'personal', interface: { displayName: 'Personal' }, plugins: [] };
  catalog.plugins = (catalog.plugins || []).filter((plugin) => plugin.name !== name);
  if (!uninstall) catalog.plugins.push(entry);
  if (!dryRun) writeJson(marketplacePath, catalog);
  return { marketplacePath, pluginDir };
}

function installClaude() {
  const cacheDir = join(home, `.claude/plugins/cache/${marketplace}/${name}/${version}`);
  log(`platform=claude target=${cacheDir}`);
  if (uninstall) {
    if (!dryRun) rmSync(cacheDir, { recursive: true, force: true });
    updateClaudeRegistry(cacheDir);
    return;
  }
  copyRepo(cacheDir, 'adapters/claude');
  updateClaudeRegistry(cacheDir);
}

function installCodex() {
  const pluginDir = join(home, 'plugins/throughline');
  log(`platform=codex target=${pluginDir}`);
  if (uninstall) {
    if (!dryRun) rmSync(pluginDir, { recursive: true, force: true });
    updateCodexMarketplace(pluginDir);
    return;
  }
  copyRepo(pluginDir, 'adapters/codex');
  updateCodexMarketplace(pluginDir);
}

function transformSkillName(text, skillName) {
  return text.replace(/^name:\s*.+$/m, `name: throughline-${skillName}`);
}

function installAntigravity() {
  const skillsTarget = join(home, '.agents/skills');
  log(`platform=antigravity target=${skillsTarget}`);
  const skillNames = readdirSync(join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const skillName of skillNames) {
    const target = join(skillsTarget, `throughline-${skillName}`);
    if (uninstall) {
      if (!dryRun) rmSync(target, { recursive: true, force: true });
      continue;
    }
    if (dryRun) continue;
    rmSync(target, { recursive: true, force: true });
    cpSync(join(root, 'skills', skillName), target, { recursive: true });
    const skillPath = join(target, 'SKILL.md');
    writeFileSync(skillPath, transformSkillName(readFileSync(skillPath, 'utf8'), skillName), 'utf8');
  }
}

if (platform === 'claude') installClaude();
if (platform === 'codex') installCodex();
if (platform === 'antigravity') installAntigravity();

if (dryRun) log('dry-run: no files changed');
else if (uninstall) log(`${name} uninstalled for ${platform}. Restart the target AI tool.`);
else log(`${name} ${version} installed for ${platform}. Restart the target AI tool.`);
