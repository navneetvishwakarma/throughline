#!/usr/bin/env node
// Ensures the working tree is never left directly on a protected branch (main/master).
// Every throughline skill calls this before any other action -- the predictable pre-hook
// that makes "never work on main directly" true for every skill, not just implement-epic.
//
// Usage:
//   node scripts/ensure-branch.mjs --skill=<name>              on main/master: create and
//                                                                switch to feature/<skill>-<ts>.
//                                                                Already on any other branch: no-op.
//   node scripts/ensure-branch.mjs --skill=<name> --name=<X>   always end up exactly on X --
//                                                                switch if it exists, create off
//                                                                current HEAD if not, no-op if
//                                                                already there. Lets define-epic
//                                                                and implement-epic share one
//                                                                continuous epic/<id>-<slug> branch.
//   node scripts/ensure-branch.mjs --check-only                verify only, never mutates --
//                                                                exits 1 if on main/master. Used
//                                                                by the pre-commit hook as a
//                                                                backstop: redirecting a commit
//                                                                onto a branch the human didn't
//                                                                ask for mid-commit would be a
//                                                                surprise, so this blocks instead.
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const skill = (args.find((a) => a.startsWith('--skill=')) || '').slice('--skill='.length) || 'throughline';
const explicitName = (args.find((a) => a.startsWith('--name=')) || '').slice('--name='.length) || null;
const checkOnly = args.includes('--check-only');
const PROTECTED = ['main', 'master'];

function git(gitArgs) {
  return execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();
}

function isGitRepo() {
  try { git(['rev-parse', '--is-inside-work-tree']); return true; } catch { return false; }
}

// Some skills (define-brief, validate-assumption) can run before a repo exists at all --
// nothing to guard yet.
if (!isGitRepo()) process.exit(0);

function currentBranch() {
  try { return git(['branch', '--show-current']); } catch { return ''; }
}

function branchExists(name) {
  try { git(['rev-parse', '--verify', '--quiet', 'refs/heads/' + name]); return true; } catch { return false; }
}

const current = currentBranch();
const onProtected = PROTECTED.includes(current) || current === '';

if (checkOnly) {
  if (onProtected) {
    console.error('Refusing: working tree is on ' + (current || '(detached HEAD)') + '. Run the skill you are using (or `node scripts/ensure-branch.mjs --skill=<name>`) to switch to a feature branch first -- throughline never commits directly to main.');
    process.exit(1);
  }
  process.exit(0);
}

function switchTo(name, create) {
  git(create ? ['checkout', '-b', name] : ['checkout', name]);
  console.log((create ? 'Created and switched to ' : 'Switched to ') + name + ' (was on ' + (current || '(detached HEAD)') + ').');
}

if (explicitName) {
  // Checked before comparing against `current` so this rejects regardless of starting state --
  // a feature branch, already on main, or detached HEAD (current === '') all hit this the same
  // way, instead of only the "current !== explicitName" branch-switch path.
  if (PROTECTED.includes(explicitName)) {
    console.error('Refusing: --name=' + explicitName + ' names a protected branch. throughline never switches directly onto ' + PROTECTED.join('/') + '.');
    process.exit(1);
  }
  if (current === explicitName) { console.log('On ' + explicitName + ' already -- OK.'); process.exit(0); }
  switchTo(explicitName, !branchExists(explicitName));
  process.exit(0);
}

if (!onProtected) {
  console.log('On ' + current + ' -- OK.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
switchTo('feature/' + skill + '-' + stamp, true);
