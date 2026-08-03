---
skill-spec: upgrade-project
type: new
status: draft (review → skill-creator)
updated: 2026-08-03
---

# upgrade-project — skill spec

## Description
Bring an existing throughline project's scaffold (scripts, `workflow.md`, templates,
CI, hooks, `AGENTS.md`) up to date with the currently installed plugin version,
without touching `backlog.json`, `.throughline/` working state, or already-written
product/architecture/design docs. Trigger with "upgrade the workflow", "sync
throughline", "update to the latest throughline version", "is this project behind
the plugin". Mechanical and idempotent.

## Why this exists
Every earlier skill in this workflow assumes a project's platform-owned files
(`scripts/*.mjs`, `docs/engineering/workflow.md`, `docs/_templates/*`, CI, hooks,
`AGENTS.md`) stay in sync with whatever plugin version is installed. In practice
they don't: `bootstrap-project`/`adopt-project` run once, copy a snapshot, and never
run again. As the plugin gains capability (coverage automation, the design tier,
`measure-learn`, the G1–G9 gate model), every project bootstrapped before that
point is frozen at its old snapshot. Without this skill, "any agent can pick up
where another left off" is only true at the moment of bootstrap, not afterward —
a project six months old drifts from what the plugin — and any other agent
reading its own copy of the plugin — actually says the workflow is.

## Context (token protocol)
Follow `docs/skill-specs/README.md`'s *Context & token protocol*. This skill reads
its own installed plugin's `assets/` tree (via `sync-plugin.mjs`'s auto-detection)
and the project's existing scaffold files — never the whole codebase.

## Persona(s)
- **Lead: Developer** (mechanical sync, no product judgment).

## Reuse
- None — `sync-plugin.mjs` is dependency-free, matching the rest of the automation layer.

## Inputs
- The currently installed plugin's `skills/bootstrap-project/assets/` tree (source of truth).
- The project's existing copies of the same relative paths (destination).

## Gate-in
- `AGENTS.md` and `docs/engineering/backlog.json` both exist (this is an existing
  throughline project). If not, redirect to `bootstrap-project` or `adopt-project`.

## Procedure
0. **Bootstrap the tool itself if missing.** Any project scaffolded before this skill
   existed has no `scripts/sync-plugin.mjs` — gate-in (`AGENTS.md` + `backlog.json`
   exist) doesn't check for it, and step 1 would otherwise fail outright. If it's
   absent, copy it by hand from the currently installed plugin's
   `skills/bootstrap-project/assets/scripts/sync-plugin.mjs` into this project's
   `scripts/` directory first. This is the one file that has to arrive without the
   tool's own help, because it's the thing that brings everything else.
1. `node scripts/sync-plugin.mjs` (no flags) — report-only. Classifies every
   platform-owned file as **added** (new in the plugin, missing from the project),
   **unchanged** (byte-identical), or **needs review** (differs — could be normal
   drift or a deliberate project-side customization; never assumed).
2. `node scripts/sync-plugin.mjs --apply` — writes only the **added** files.
3. For each **needs review** file, the human decides per file: keep the project's
   version, or accept the plugin's. `--force=<path,...>` scopes acceptance to exactly
   the approved files; bare `--force` (no `=`) overwrites every flagged file and is
   only appropriate once every single one has actually been reviewed — a project that
   followed `bootstrap-project`'s own advice to keep a stronger custom CI workflow
   must not have that file swept up by a blanket force alongside unrelated approvals.
   The script also refreshes the live `.git/hooks/pre-commit` from `.githooks/pre-commit`
   when they differ — `init-project.mjs` only ever installs the hook once, so this is
   the only path that updates it on an already-bootstrapped project.
4. `node scripts/init-project.mjs "<project name>"` again — idempotent (`place()`
   never overwrites), so this only materializes new doc-tier files (e.g. the design
   tier for a pre-UI/UX project) without touching anything that already exists.
5. `node scripts/validate.mjs` — confirms the project's actual `backlog.json` is
   still compatible with whatever new schema/script logic just landed.
6. `.throughline/plugin-version.json` is written/updated. If any file is still
   **needs review** (unresolved) at the end of this run, the recorded `version`
   stays at whatever it was before (or `null` on a first sync) and a `pendingReview`
   array lists what's blocking full sync — the file never claims the project is
   current while something is still outstanding, which is the entire point of
   letting a future run (or a `doctor`-style check) answer "is this project behind"
   without doing a full file diff first.

## What this never touches
- `docs/engineering/backlog.json` — the contract itself; only the workflow skills
  that already own its fields write to it.
- `.throughline/gates.json`, `.throughline/epic-*/`, `.throughline/ship-*/` — skill
  working state.
- Anything under `docs/product|architecture|design/` that already exists with real
  content. `place()`'s own idempotency (never overwrite an existing file) is the
  guarantee here, reused rather than reimplemented.

## Outputs
- New scaffold files added; `.throughline/plugin-version.json` updated; a report of
  added / unchanged / needs-review.

## Automated gate
- `validate.mjs` passes after the sync. No file under the "never touches" list above changed.

## Human gate
- None (mechanical, like `bootstrap-project`) — but every **needs review** file
  requires an explicit per-file human decision before `--force` touches it. This is
  the gate, just not a numbered one in `gate.mjs`.

## Definition of Done
- `sync-plugin.mjs --apply` has run; every flagged file explicitly resolved;
  `validate.mjs` passes; `.throughline/plugin-version.json` matches the installed
  plugin's version.

## Failure modes
- A **needs review** file gets force-overwritten without the human actually looking
  at the diff → the exact clobbering this skill exists to prevent. Never batch
  `--force` across files the human hasn't individually confirmed.
- `validate.mjs` fails after sync → stop, fix the incompatibility, never hand-edit
  the contract to route around a real schema mismatch.
