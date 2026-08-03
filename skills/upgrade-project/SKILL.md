---
name: upgrade-project
description: Bring an existing throughline project's scaffold (scripts, workflow.md, templates, CI, hooks, AGENTS.md) up to date with the currently installed plugin version, without touching backlog.json, .throughline/ working state, or already-written product/architecture/design docs. Use when the user says "upgrade the workflow", "sync throughline", "update to the latest throughline version", "is this project behind the plugin". Mechanical and idempotent (safe to re-run). For a repo that has never run any throughline skill, use adopt-project instead.
---

# upgrade-project

Deterministic scaffold sync. No product judgment, no touching project content — this only refreshes the platform-owned files a project got at bootstrap/adopt time. This skill bundles no new assets of its own; it reuses `bootstrap-project`'s own `assets/` as the source of truth.

## Gate-in
`AGENTS.md` and `docs/engineering/backlog.json` both exist. If either is missing, this is not an existing throughline project — stop and point to `bootstrap-project` (new repo) or `adopt-project` (existing repo, never on the workflow).

## Do this
1. **Locate the source, and bootstrap the sync tool itself if it's missing.** `scripts/sync-plugin.mjs` is what performs every step below — but any project bootstrapped before this skill existed doesn't have it yet, and this skill's own gate-in (`AGENTS.md` + `backlog.json` exist) doesn't check for it. If `scripts/sync-plugin.mjs` is absent, copy it by hand first: find the currently installed plugin (Claude Code: `~/.claude/plugins/cache/local/throughline/<version>/`; Codex: `~/plugins/throughline/`) and copy its `skills/bootstrap-project/assets/scripts/sync-plugin.mjs` into this project's `scripts/` directory. Only once it exists, run `node scripts/sync-plugin.mjs` with no flags — it auto-detects the currently installed plugin (or accepts `--from=<path>` for Antigravity or a dev checkout). This is a report-only dry run; it writes nothing yet.
2. **Read the report.** It classifies every platform-owned file into:
   - **added** — exists in the current plugin but not in this project (a capability the project never had, e.g. `coverage.mjs` for a pre-coverage-era project, or the design-tier templates for a pre-UI/UX-era one).
   - **unchanged** — byte-identical to the plugin's current copy. Nothing to do.
   - **needs review** — exists in both places but differs. This could be normal version drift, or it could be a hand-customization to a script/hook/CI file the project's owner made deliberately. The script cannot tell which — never assume.
3. **Apply the safe part.** Run `node scripts/sync-plugin.mjs --apply` — writes only the **added** files. Never overwrites anything that already exists.
4. **Resolve the flagged files with the human.** For each file in **needs review**, show the human what differs (open both, or summarize the delta) and ask: keep the project's version, or accept the plugin's. Only after an explicit per-file yes, run `node scripts/sync-plugin.mjs --force=<path1>,<path2>` naming only the files just approved — `--force` (bare, no `=`) overwrites every flagged file and should only be used if every single one has actually been reviewed, not as a shortcut. This matters concretely for `.github/workflows/throughline.yml`: `bootstrap-project` itself told the human to keep the bundled CI workflow *unless the repo already has a stronger equivalent* — a project that took that advice will show this file as flagged, and it must never be swept up by a blanket `--force` alongside files the human actually meant to accept.
5. **Materialize any new template-backed docs.** Run `node scripts/init-project.mjs "<project name>"` again — it's idempotent (never overwrites a file that already exists), so this only adds doc-tier files the project never had (e.g. `docs/design/README.md` for a project bootstrapped before the design tier existed). Never touches a doc that's already there, filled in or not.
6. **Validate.** Run `node scripts/validate.mjs` against the existing `backlog.json` — this is the real safety check that whatever new schema/script logic just landed is still compatible with the project's actual data. A failure here means stop and fix before going further; never patch over it by hand-editing the contract.
7. **Confirm the version stamp.** `.throughline/plugin-version.json` now reflects the plugin version just synced from.

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
