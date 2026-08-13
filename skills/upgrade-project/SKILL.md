---
name: upgrade-project
description: Bring an existing throughline project's scaffold (scripts, workflow.md, templates, CI, hooks, AGENTS.md) up to date with the currently installed plugin version, without touching backlog.json, .throughline/ working state, or already-written product/architecture/design docs. Use when the user says "upgrade the workflow", "sync throughline", "update to the latest throughline version", "is this project behind the plugin". Mechanical and idempotent (safe to re-run). For a repo that has never run any throughline skill, use adopt-project instead.
---

# upgrade-project

Deterministic scaffold sync. No product judgment, no touching project content — this only refreshes the platform-owned files a project got at bootstrap/adopt time. This skill bundles no new assets of its own; it reuses `bootstrap-project`'s own `assets/` as the source of truth.

## Gate-in
`AGENTS.md` and `docs/engineering/backlog.json` both exist. If either is missing, this is not an existing throughline project — stop and point to `bootstrap-project` (new repo) or `adopt-project` (existing repo, never on the workflow).

## Branch check
Run `node scripts/ensure-branch.mjs --skill=upgrade-project` before anything else below. If the repo is on `main`/`master`, it creates and switches to a feature branch automatically and reports the name — never write or commit on `main` directly. Already on a non-main branch: no-op.

## Do this
1. **Locate the source, and bootstrap the sync tool itself if it's missing.** `scripts/sync-plugin.mjs` is what performs every step below — but any project bootstrapped before this skill existed doesn't have it yet, and this skill's own gate-in (`AGENTS.md` + `backlog.json` exist) doesn't check for it. If `scripts/sync-plugin.mjs` is absent, copy it by hand first: find the currently installed plugin (Claude Code: `~/.claude/plugins/cache/local/throughline/<version>/`; Codex: `~/plugins/throughline/`) and copy its `skills/bootstrap-project/assets/scripts/sync-plugin.mjs` into this project's `scripts/` directory. Only once it exists, run `node scripts/sync-plugin.mjs` with no flags — it auto-detects the currently installed plugin (or accepts `--from=<path>` for Antigravity or a dev checkout). This is a report-only dry run; it writes nothing yet.
2. **Read the report.** It classifies every platform-owned file into:
   - **added** — exists in the current plugin but not in this project (a capability the project never had, e.g. `coverage.mjs` for a pre-coverage-era project, or the design-tier templates for a pre-UI/UX-era one).
   - **unchanged** — byte-identical to the plugin's current copy. Nothing to do.
   - **needs review** — exists in both places but differs. This could be normal version drift, or it could be a hand-customization to a script/hook/CI file the project's owner made deliberately. The script cannot tell which — never assume.
3. **Apply the safe part.** Run `node scripts/sync-plugin.mjs --apply` — writes only the **added** files. Never overwrites anything that already exists.
4. **Resolve the flagged files with the human.** For each file in **needs review**, show the human what differs (open both, or summarize the delta) and ask: keep the project's version, or accept the plugin's. Only after an explicit per-file yes, run `node scripts/sync-plugin.mjs --force=<path1>,<path2>` naming only the files just approved — `--force` (bare, no `=`) overwrites every flagged file and should only be used if every single one has actually been reviewed, not as a shortcut. `.github/workflows/throughline.yml` is seed-only, not managed, as of 0.3.2: it never appears in **needs review** and `--force` never touches it, so there's nothing to resolve for it here — the report prints it separately (seeded / up to date / differs from current render / deferred) once it exists.

   **Self-bootstrapping note for this specific upgrade (pre-0.3.2 → 0.3.2):** `scripts/sync-plugin.mjs` is itself one of the files above, so until the human accepts the new copy and this step is re-run, everything above still runs under the *old* script's rules — including still treating `.github/workflows/throughline.yml` as a plain managed file that can show up in **needs review**. Accept `scripts/sync-plugin.mjs` first (`--force=scripts/sync-plugin.mjs`; `scripts/lib/render-workflow.mjs` is new, so it lands normally as **added** in step 3, no force needed), then re-run `node scripts/sync-plugin.mjs --apply`. That second run, now executing the new script, is what actually reclassifies the CI workflow as seed-only and stops flagging it.
5. **Materialize any new template-backed docs.** Run `node scripts/init-project.mjs "<project name>"` again — it's idempotent (never overwrites a file that already exists), so this only adds doc-tier files the project never had (e.g. `docs/design/README.md` for a project bootstrapped before the design tier existed). Never touches a doc that's already there, filled in or not.
6. **Check for misplaced working state.** Run `node scripts/sync-plugin.mjs --repair-state` — this has come up in practice: an agent writing epic ledgers or gate state into `.claude/` (or another platform-specific directory) instead of `.throughline/`, out of habit rather than instruction. If it finds anything, rerun with `--apply` to move it into `.throughline/` — it refuses to overwrite if something already exists at the destination, flagging that for the human instead.
7. **Validate.** Run `node scripts/validate.mjs` against the existing `backlog.json` — this is the real safety check that whatever new schema/script logic just landed is still compatible with the project's actual data, and it also fails loud if any working state is still misplaced. A failure (exit 1) means stop and fix before going further; never patch over it by hand-editing the contract. A `WARN`-only run (exit 0) is a different, complete outcome, not a failure: it means this project's first-ever sync found pre-existing stories that predate a requirement added since (`prd_ref`, `acceptance`, or done-story verify evidence) and `.throughline/plugin-version.json` was stamped with `legacyContractGrace: true` to reflect that honestly. Backfill those warnings over time through the normal workflow (define-backlog, ship-epic) — never by hand-writing placeholder values into `backlog.json` just to silence them, and never by hand-editing the grace flag itself except to turn it off once the backlog is actually clean.
8. **Confirm the version stamp.** `.throughline/plugin-version.json` now reflects the plugin version just synced from.

Supporting lens: none needed beyond care not to clobber. This is infrastructure maintenance, not a design or product decision.

## Outputs
Whatever scaffold files were missing get added; `.throughline/plugin-version.json` updated; a summary of what was added / left unchanged / still needs the human's review.

## Automated gate
`node scripts/validate.mjs` still passes after the sync. Nothing under `docs/product|architecture|design/` with real content was touched. `backlog.json`, `.throughline/gates.json`, and `.throughline/epic-*|ship-*/` were not touched at all.

## Gate
None (mechanical, same as `bootstrap-project`) — but never run `--force` on a flagged file without the human explicitly choosing the plugin's version over the project's for that specific file.

## Done when
`sync-plugin.mjs --apply` has run; every flagged file has been explicitly resolved one way or the other (not silently left ambiguous); `validate.mjs` passes; `.throughline/plugin-version.json` matches the currently installed plugin's version.

## Notes
This is what makes the cross-platform handoff guarantee durable over time, not just at bootstrap: a project scaffolded six months ago on an older plugin version, then opened in Codex today, gets brought current the same way regardless of which platform originally bootstrapped it. Re-run this any time you suspect drift — it's cheap and idempotent.
