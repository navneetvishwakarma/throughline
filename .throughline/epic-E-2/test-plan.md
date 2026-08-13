**Personas Applied:** Architect, PM, Developer

# Test plan: E-2 V1 enhancements

All automated regressions go in `tests/throughline.test.mjs`. They exercise copied scaffold scripts as real child-process CLIs through the existing `makeProject` and `runNode` helpers. The plan treats the review examples as required negative tests. A security lens applies to the release prerequisite, hook preservation, portable-state, and architecture threat-model checks.

## S-8: Lifecycle gate integrity

- CLI integration: approve subject-scoped G6 and G7 entries, then call bare `check G6` and `check G7`; both exit non-zero and name `--subject`, while scoped checks for the approved subject still pass.
- CLI integration: with G1 approved, G1.5 pending, and G2 pending, `gate.mjs next` reports G2; `list` still reports G1.5 pending.
- Regression: global gates such as G1 through G5, G8, and G9 still support bare checks.
- Skill contract: inspect `skills/release/SKILL.md` and its installed adapter copies to prove the gate-in checks G1 through G5 and subject-scoped G7 for every release epic before G8.
- Negative release fixture: G3 or G4 pending blocks the release procedure even when all stories are done and a global G7 slot is approved.

## S-9: PRD membership and release traceability

- Validator integration: a story with `prd_ref: REQ-999` against a PRD containing only REQ-01 fails and names the dangling story reference.
- Validator integration: an epic with `prd_ref: REQ-999` fails independently of its stories.
- Validator integration: a PRD with REQ-01 and REQ-02 tagged v1 plus a v1 backlog referencing only REQ-01 fails and names orphaned REQ-02.
- Positive fixture: all release-tagged PRD requirements referenced by an epic and at least one story pass.
- Dogfood contract: the repository backlog validates with REQ-08 through REQ-16 all referenced by E-2 stories.

## S-10: Coverage allowlists and report freshness

- CLI integration: a Node fixture with `coverage.stacks: ["node-tset"]` exits 2 and identifies the unknown configured stack.
- CLI integration: a valid configured stack with no detected matching stack exits 2 rather than writing a skipped/pass summary.
- Target integration: seed the declared summary with a passing report, run a target command that exits zero without writing a report, and assert the run fails instead of parsing the seeded file.
- Custom command integration: repeat the stale-report case for the default custom-command summary path.
- Positive target: a command that creates a fresh valid summary passes and contributes its current covered/total values.
- Regression: `--reuse` continues to re-evaluate the stored aggregate deliberately without running commands.

## S-11: Hook and portable-state preservation

- Sync integration: initialize Git, write a custom `.git/hooks/pre-commit`, run `sync-plugin.mjs --apply`, and assert byte-for-byte preservation plus an actionable manual-composition report.
- Sync integration: with no live hook, `--apply` installs the Throughline hook; with a recognized Throughline-managed hook, an upgrade refreshes it safely.
- Repair integration: place `.claude/feature-readme-fix/spec.md`, run report-only repair, and assert it remains in place while output names it.
- Repair integration: rerun with `--apply`, assert the directory moves to `.throughline/feature-readme-fix`, then assert `validate.mjs` passes.
- Conflict case: when both source and destination feature directories exist, repair reports `CONFLICT`, preserves both, and overwrites neither.
- Platform matrix: repeat detection for at least one additional unsupported root from `WRONG_STATE_ROOTS` to guard matcher scope.

## S-12: Document completeness

- Product-tier integration: a PRD with headers but zero requirement rows fails with an explicit no-valid-requirements error.
- Product-tier integration: a REQ-like row with an invalid ID fails instead of being treated as an unrelated table; a truly unrelated table elsewhere remains ignored.
- Architecture-tier integration: the repository's seeded `One-line purpose`, `_Why this exists_`, and `_Main content_` markers fail explicitly.
- Architecture-tier matrix: placeholder markers in system overview, tech stack, data model, API design, infrastructure, and an ADR each fail with the offending file.
- Security contract: architecture validation requires either a substantive security threat-model section in the system overview or a substantive dedicated `security-threat-model.md`, including evidence that the Architect and Security lenses ran.
- Positive fixture: filled architecture documents, a recorded threat model, and valid ADR status/references pass.

## S-13: GitHub reopen synchronization

- Status integration: a linked story starting `done` with an OPEN issue-state fixture becomes `in_progress`.
- Dependency integration: a done direct dependent of that reopened story becomes `blocked`.
- Dependency integration: a three-story chain recomputes transitively so no downstream done story survives an open prerequisite.
- Positive regression: CLOSED linked stories with all dependencies done remain done; local tracker behavior remains unchanged.
- Evidence regression: reopening status does not delete existing `verify` data.

## S-14: Node and c8 engine alignment

- Manifest contract: assert `package.json.engines.node` equals `^20.19.0 || ^22.12.0 || >=23` and README states the same supported range.
- Dependency contract: assert the declared Throughline engine is not broader than the installed c8 12 engine range.
- Runtime verification on the active supported Node: `npm test`, `npm run doctor`, and `npm run test:coverage` exit zero.
- Installer regression: Claude, Codex, and Antigravity installer dry runs continue to exit zero under the supported runtime.
- Manual compatibility check: a strict-engine install under Node 18 or 19 fails at engine validation with the documented supported range rather than reaching an unsupported c8 execution.

## Epic verification

- `node scripts/validate.mjs`
- `node scripts/check-docs.mjs --tier=product`
- `node scripts/check-docs.mjs --tier=architecture` must remain red until the real architecture and security model replace the current placeholders; this is an expected project-state blocker, not a test failure to bypass.
- `npm test`
- `npm run doctor`
- `npm run test:coverage`
- `node install.mjs claude --dry-run`
- `node install.mjs codex --dry-run`
- `node install.mjs antigravity --dry-run`
- `node scripts/gate.mjs check G6 --subject E-2` before implementation; this remains pending until the user approves this plan.
