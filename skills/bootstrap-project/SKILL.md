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
2. Copy everything from this skill's `assets/` into the project root (templates → `docs/_templates/`, `scripts/`, `docs/engineering/{backlog.schema.json,backlog.seed.json,workflow.md}`).
3. Run `node scripts/init-project.mjs "<project name>"` — builds the doc tree, emits `AGENTS.md` (canonical) + `CLAUDE.md`/`GEMINI.md` pointers, and an empty `backlog.json`.
4. Install a pre-commit hook running `node scripts/validate.mjs` AND a codegraph re-index. Set up CI (test + lint + re-index) if a CI connector is present.
5. If `tracker` is not `local`, create the workflow issue labels `epic` and `feature`. In `local` mode (default) skip this — no account or network needed.
6. Point the define-* skills at `docs/engineering/backlog.json`.

## Done when
A fresh checkout passes `node scripts/validate.mjs`; the operating manual exists; the pre-commit hook is installed. (The codegraph index is empty until code lands — expected.)
