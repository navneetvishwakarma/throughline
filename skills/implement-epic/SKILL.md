---
name: implement-epic
description: Use when an epic has been defined and G6 approved, and the user wants all its stories built — code and tests, one story at a time, updating the ledger and contract as it goes. Trigger phrases: "implement epic", "build epic E-x", "work the next sub-issue", "run implement-epic".
---

# implement-epic

Act as a top-0.1% FAANG senior developer. Write simple, readable, well-tested code in small vertical increments. Optimise for correctness. Leave the codebase cleaner than you found it.

## Gate-in
G6 is approved: `.throughline/epic-<N>/` exists with story specs, test-plan.md, and ledger skeleton, and `node scripts/gate.mjs check G6 --subject <epic-id>` passes when the script exists — the subject scoping matters here specifically, since G6 runs once per epic and a global approval left over from a previous epic must never silently satisfy this one.

## Context protocol
Work from the sub-issue spec + ledger. If a codegraph index is present (`.codegraph/`), query it to locate the exact symbols/call sites to change and read only those spans — never scan or read whole files to find code. Don't re-read docs the epic spec already distilled.

**Ledger and test-output writes below go under `.throughline/epic-<N>/` — never `.claude/`, `.cursor/`, or any other platform-specific directory, even by habit.** `validate.mjs` fails loud if it finds it elsewhere.

## Step 1 — Fetch and orient

Read `docs/engineering/backlog.json` (the chosen epic slice only). Read `.throughline/epic-<N>/epic.json` + all `sub-<id>.json` story specs. Read `AGENTS.md` once; store for sub-agents.

Determine the epic branch: `epic/<epic-id>-<slug>`.

**If branch does not exist:** `git checkout main && git pull origin main`, confirm `git status` is clean (stop if dirty — never carry unrelated changes onto a fresh epic branch), then run `node scripts/ensure-branch.mjs --skill=implement-epic --name=epic/<epic-id>-<slug>` to create and switch to it — the same branch-creation mechanism every other skill goes through, given the exact name this epic owns.

**If branch exists** (typically because `define-epic` already created it and committed the specs there): ask whether to resume (skip committed stories) or start fresh. On resume: scan `git log --oneline` for commit messages containing the story id to detect already-done stories. Either way, `node scripts/ensure-branch.mjs --skill=implement-epic --name=epic/<epic-id>-<slug>` is a safe no-op if you're not already on it.

## Step 2 — For each story: plan → approve → dispatch

Work through stories sequentially.

**2a — Task breakdown**

Read the story spec from `.throughline/epic-<N>/sub-<id>.json`. Read only the files listed in the technical notes (or returned by a codegraph query). Produce:

```
Story <id>: <title>
Branch: epic/<epic-id>-<slug>

Tasks:
1. [Layer] What → which files → what the TDD cycle tests
2. ...

Confirm to proceed, or correct anything above.
```

Wait for explicit user approval before dispatching.

**2b — Dispatch execution sub-agent**

Pass the story spec, approved task breakdown, branch name, AGENTS.md content, and a compact rolling summary of completed stories (ledger, max 2 lines per story). Sub-agent spec:

```
Execute the approved task breakdown via TDD (red → green → refactor per task).
For each task:
  1. Write the failing test asserting the acceptance criterion
  2. Confirm it fails for the right reason
  3. Write minimum code to pass
  4. Refactor if needed
  5. Run targeted tests for this task — must pass
  6. Commit: feat: <description> (<story-id>)

Run ONLY targeted tests per task. Do NOT run the full test suite.
Return ONLY: AC checklist, files changed, test command + result, commit SHA, risks.
Do NOT switch or create branches.
```

**2c — Record ledger row**

Append to `.throughline/epic-<N>/ledger.md`:
```
| <id> | <scope> | <files> | <test cmd> → pass | <SHA> | done | <risks> |
```

**2d — Write verify into the contract**

After CI confirms the story's tests pass, write `ci`/`commit` into `story.verify` in `backlog.json`:

```json
"verify": { "ci": "pass", "commit": "<SHA>" }
```

Then run `node scripts/coverage.mjs --story <id>` — it measures real coverage for the detected stack and patches `verify.coverage` itself. Never hand-type a coverage number. If the result is `needs_setup` (no coverage tool configured for this stack yet), surface the nudge it prints to the human rather than proceeding as if coverage were fine — `verify.coverage` stays unset until it's resolved.

Do **not** set `status` — `sync-status.mjs` owns that field (tracker mode). In local mode (no tracker), set the story `status: in_progress` on start; leave `done` for ship-epic to set.

**Security lens:** run a code-review + security-review self-pass for any change touching auth, PII, or secrets. Resolve findings before the next story.

## Step 3 — Mid-flight amend (critical)

If building reveals that a story's slice, acceptance, or `blocked_by` dependency is wrong: **stop immediately**. Do not force code to fit a wrong spec. Flag the mismatch clearly, then:

1. Run `define-backlog` in reconcile mode to amend the affected story or epic.
2. Re-present the amended spec for human review (re-gate G6 for the affected items).
3. Resume only after approval.

Never let code silently diverge from the contract.

## Step 4 — Epic quality gate

After all stories are committed:

```bash
npm run build    # or project equivalent
npm test 2>&1 | tee .throughline/epic-<N>/test-out.txt
node scripts/coverage.mjs --json 2>&1 | tee .throughline/epic-<N>/coverage-out.txt
```

Run both, even though `coverage.mjs` also runs tests when it can measure coverage: on `needs_setup` (coverage tool not configured yet) it does **not** run anything, so the plain `npm test` above is what still catches regressions in that case — don't drop it. Surface output only on failure (build/test) or on `needs_setup`/`error` status (coverage). On failure: stop, report, fix before continuing.

Cross-feature self-review checklist:

| Dimension | Check |
|-----------|-------|
| Completeness | All AC from all stories implemented |
| Interaction regressions | Changes from different stories don't conflict |
| Auth/scope consistency | Owner-scoping enforced uniformly |
| Security | No injection risks, no exposed secrets |
| Observability | Instrumentation present |
| Coverage | `node scripts/coverage.mjs --check` passes, or is explicitly warn-only, or `needs_setup` was flagged to the human |
| Design | Each story with a `design_ref` visually compared against its approved `docs/design/screens/*.md` (layout, states, microcopy); deviations flagged |

Fix any gap before handing off to ship-epic.

## Done when
All story `verify` fields written to `backlog.json`; ledger complete; tests green; no open code-review or security findings; epic quality gate passed.

## Notes
Reuse `engineering:code-review`, `engineering:debug`, built-in `review` + `security-review`, `superpowers:test-driven-development` where available. Perform steps directly from this spec if skills are not installed. There is no human gate here on the happy path — G7 is at ship-epic.
