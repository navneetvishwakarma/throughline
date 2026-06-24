---
skill-spec: bootstrap-project
type: new
status: draft (review → skill-creator)
updated: 2026-06-16
---

# bootstrap-project — skill spec

## Description
Stand up a new project so AI-assisted development can run on a fixed contract.
Trigger with "bootstrap the project", "set up the repo", "scaffold a new project",
"initialize the structure". First cycle only; safe to re-run (never overwrites).

## Context (token protocol)
Follow the README *Context & token protocol*. Load `AGENTS.md` + only the slice needed — never whole docs or source trees. **If a codegraph index is present (`.codegraph/`), query it for any code lookup and read only the spans returned.** (This step also *builds/verifies* the codegraph index as part of setup.)

## Persona(s)
- None — mechanical/deterministic. (Defers all judgment to later gated steps.)

## Reuse
- `anthropic-skills:skill-creator` — to generate the pipeline's other custom skills.
- `anthropic-skills:schedule` — to register the scheduled progress digest.
- Public add-on (optional): Superpowers › using-git-worktrees.

## Inputs
- Project name; the approved `docs/product/00-brief.md`.

## Gate-in
- `00-brief.md` exists and is `status: approved` (don't scaffold around an unapproved idea).
- **Runs inside a git repo the user owns.** If none exists, offer a plain local `git init` (decision-free). **Never create the remote, nor choose visibility/license** — that's the user's call.

## Scope boundary
- **Plugin owns (inside the repo):** doc tree, `AGENTS.md`, contract, scripts, pre-commit + CI config, codegraph setup, workflow issue labels, pointing skills at the contract.
- **User owns:** the repo existing, its host, visibility (private/public), and license.

## Procedure
1. Confirm a git repo exists; if not, offer a plain local `git init` only (no remote, no visibility/license decision).
2. Run `node scripts/init-project.mjs "<name>"` — builds the doc tree, `AGENTS.md`, empty `backlog.json` (schema v2), copies templates.
3. Create the workflow issue **labels** (`epic`, `feature`) on the configured `tracker` — **skipped entirely in `local` mode (the default), which needs no account or network**. **Do not create the remote repo, choose visibility, or pick a license** — the user owns those.
4. Install a **pre-commit hook** that runs `node scripts/validate.mjs` **and a codegraph re-index** (so the graph never goes stale).
5. Set up **CI** (test + lint + codegraph re-index) so `verify.ci` is real from day one.
6. Point the define-* skills at `docs/engineering/backlog.json` as their pickup source.
7. Register a scheduled digest (`sync-status` + `build-dashboard`) via the schedule skill.

## Outputs
- Initialized repo: doc tree, `AGENTS.md`, `backlog.json` (empty), scripts, hook, CI config, GitHub repo + labels, scheduled task.

## Automated gate
- `validate.mjs` passes on the empty contract; CI green on empty repo; `AGENTS.md` present; pre-commit hook + codegraph re-index installed. (The index is empty until code lands — expected.)

## Human gate
- None (mechanical). User just confirms the repo/CI exist.

## Definition of Done
- Fresh clone of the repo passes `validate.mjs`, CI is green, and `define-brief`/`define-product` can find the contract.

## Failure modes
- Brief not approved → stop. Repo already initialized → skip init, report what exists, don't clobber.
