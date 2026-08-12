---
name: bootstrap-project
description: Stand up a new project on the Throughline workflow so AI-assisted development runs on a fixed contract. Use when the user says "bootstrap the project", "set up the repo", "scaffold a new project", "initialize the workflow". Mechanical and idempotent (safe to re-run). For an existing codebase use adopt-project instead.
---

# bootstrap-project

Deterministic setup. No product judgment — defer that to the gated steps. This skill bundles the scaffold in `assets/`.

## Scope boundary
- **You own (inside the repo):** doc tree, the operating manual, the contract, scripts, pre-commit + CI config, codegraph setup, workflow issue labels, pointing skills at the contract.
- **The user owns:** the repo existing, its host, visibility (private/public), and license. Never create a remote, choose visibility, or pick a license.

## Do this
1. Confirm a git repo exists. If not, offer a plain local `git init` only (no remote, no visibility/license decision).
2. Copy everything from this skill's `assets/` into the project root (templates → `docs/_templates/`, `scripts/`, `.githooks/`, `docs/engineering/{backlog.schema.json,backlog.seed.json,workflow.md}`). Do not copy `.github/` -- step 8's `sync-plugin.mjs --apply` seeds `.github/workflows/throughline.yml` itself, rendered for whichever package manager this project's lockfile indicates.
3. **Branch check** — run `node scripts/ensure-branch.mjs --skill=bootstrap-project`. If the repo is on `main`/`master` (or has no commits yet), it creates and switches to a feature branch automatically and reports the name, carrying the just-copied files with it — everything from here on lands there, never directly on `main`.
4. Run `node scripts/init-project.mjs "<project name>"` — builds the doc tree, emits `AGENTS.md` (canonical) + `CLAUDE.md`/`GEMINI.md` pointers, and an empty `backlog.json`.
5. Install the bundled pre-commit hook running `node scripts/ensure-branch.mjs --check-only` + `node scripts/validate.mjs` and an optional codegraph re-index. Keep the bundled CI workflow unless the repo already has a stronger equivalent.
6. If `tracker` is `github`, create the workflow issue labels `epic` and `feature`. In `local` mode (default) skip this — no account or network needed. Other trackers are not supported until an adapter exists.
7. Point the define-* skills at `docs/engineering/backlog.json`.
8. Run `node scripts/sync-plugin.mjs --apply` once — on a fresh scaffold this is a no-op against files you just copied *except* `.github/workflows/throughline.yml`, which this step seeds for the first time (rendered from the detected lockfile, since step 2 deliberately didn't copy it). It also stamps `.throughline/plugin-version.json` with the plugin version, which is what `upgrade-project` later reads to tell whether this project is behind the plugin's current release.

## Done when
A fresh checkout passes `node scripts/validate.mjs`; `node scripts/gate.mjs list` works; the operating manual exists; the pre-commit hook is installed. (The codegraph index is empty until code lands — expected.)
