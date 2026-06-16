---
name: implement-epic
description: Use when an epic has been defined and G6 approved, and the user wants all its stories built — code and tests, one story at a time, updating the ledger and contract as it goes. Trigger phrases: "implement epic", "build epic E-x", "work the next sub-issue", "run implement-epic".
---

# implement-epic

Act as a top-0.1% FAANG senior developer. Write simple, readable, well-tested code in small vertical increments. Optimise for correctness. Leave the codebase cleaner than you found it.

## Gate-in
G6 is approved: `.claude/epic-<N>/` exists with story specs, test-plan.md, and ledger skeleton.

## Context protocol
Work from the sub-issue spec + ledger. If a codegraph index is present (`.codegraph/`), query it to locate the exact symbols/call sites to change and read only those spans — never scan or read whole files to find code. Don't re-read docs the epic spec already distilled.

## Step 1 — Fetch and orient

Read `docs/engineering/backlog.json` (the chosen epic slice only). Read `.claude/epic-<N>/epic.json` + all `sub-<id>.json` story specs. Read `AGENTS.md` (or `CLAUDE.md`) once; store for sub-agents.

Determine the epic branch: `epic/<epic-id>-<slug>`.

**If branch does not exist:**
```bash
git checkout main && git pull origin main
git status   # must be clean — stop if dirty
git checkout -b epic/<epic-id>-<slug>
```

**If branch exists:** ask whether to resume (skip committed stories) or start fresh. On resume: scan `git log --oneline` for commit messages containing the story id to detect already-done stories.

## Step 2 — For each story: plan → approve → dispatch

Work through stories sequentially.

**2a — Task breakdown**

Read the story spec from `.claude/epic-<N>/sub-<id>.json`. Read only the files listed in the technical notes (or returned by a codegraph query). Produce:

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

Append to `.claude/epic-<N>/ledger.md`:
```
| <id> | <scope> | <files> | <test cmd> → pass | <SHA> | done | <risks> |
```

**2d — Write verify into the contract**

After CI confirms the story's tests pass, write `story.verify` in `backlog.json`:

```json
"verify": { "ci": "pass", "coverage": <0–1 or omit>, "commit": "<SHA>" }
```

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
npm test 2>&1 | tee .claude/epic-<N>/test-out.txt
```

Surface test output only on failure. On failure: stop, report, fix before continuing.

Cross-feature self-review checklist:

| Dimension | Check |
|-----------|-------|
| Completeness | All AC from all stories implemented |
| Interaction regressions | Changes from different stories don't conflict |
| Auth/scope consistency | Owner-scoping enforced uniformly |
| Security | No injection risks, no exposed secrets |
| Observability | Instrumentation present |

Fix any gap before handing off to ship-epic.

## Done when
All story `verify` fields written to `backlog.json`; ledger complete; tests green; no open code-review or security findings; epic quality gate passed.

## Notes
Reuse `engineering:code-review`, `engineering:debug`, built-in `review` + `security-review`, `superpowers:test-driven-development` where available. Perform steps directly from this spec if skills are not installed. There is no human gate here on the happy path — G7 is at ship-epic.
