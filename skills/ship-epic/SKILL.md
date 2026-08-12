---
name: ship-epic
description: Use when an implemented epic is ready to land — open the PR (or merge locally), run the deploy checklist, close the issues, then sync the contract and refresh the dashboard. Trigger phrases: "ship epic", "ship E-x", "open the PR and merge", "run ship-epic". This is gate G7.
---

# ship-epic

Act as a top-0.1% FAANG senior developer landing clean: never merge on red CI, a failing quality gate, or an unresolved review finding. Consult a security lens on any PR touching auth, PII, or OAuth scopes — that gate is hard and can block the merge.

## Gate-in
Epic quality gate passed (all stories' `verify.ci: pass` in `backlog.json`; ledger complete). If not: stop and run `implement-epic` to completion first. If `docs/engineering/backlog.json`'s `coverage.mode` is `enforce`, also run `node scripts/coverage.mjs --check --reuse` — it validates the summary implement-epic already wrote without re-running the full suite. If it fails: stop and send the epic back to `implement-epic`.

## Branch check
Run `node scripts/ensure-branch.mjs --skill=ship-epic --name=epic/<epic-id>-<slug>`. This should be a no-op — `implement-epic` already left you on that branch — but it's a safety net against a stale `main` checkout if this runs standalone.

## Context protocol
Work from the epic branch diff + ledger. If a codegraph index is present (`.codegraph/`), query it for impact/blast-radius of the change; read only the spans returned. Do not re-read source files or whole docs.

**`.throughline/ship-<N>/` writes below go there — never `.claude/`, `.cursor/`, or any other platform-specific directory, even by habit.** `validate.mjs` fails loud if it finds it elsewhere.

---

## Mode A — Local (tracker: local, the default)

In local mode there is no remote repo, no PR, no GitHub. G7 is a local review and merge.

**1. G7 review** — present a `git diff --stat` and a compact summary of what each story implemented (coverage gate-in already checked above; local mode has no CI to fall back on, so this is the only enforcement point). Ask the user to review and approve the merge.

**2. Merge on approval:**
```bash
node scripts/gate.mjs approve G7 --subject <epic-id> --note "local epic merge approved"
git checkout main
git merge --no-ff epic/<epic-id>-<slug> -m "merge: epic <epic-id>"
```
`--subject <epic-id>` scopes the approval to this epic — G7 runs once per epic, and a stale global approval from a previously shipped epic must never silently satisfy this one's merge.

**3. Set stories done** — write `status: done` for every shipped story in `backlog.json`. (In local mode this skill is the status adapter; `sync-status.mjs` is the adapter only when a tracker is wired.)

**4. Sync + dashboard:**
```bash
node scripts/sync-status.mjs && node scripts/build-dashboard.mjs
```

Confirm `build-dashboard.mjs` exits 0 and the dashboard file is updated.

**5. Report** — fixed format, ≤6 lines:
```
Merged: epic/<epic-id>-<slug> → main
Stories done: <id list>
Dashboard: refreshed
Residual risks: <list or "none">
Personas: Developer[, Security]
```
Include `Security` only if the diff actually touches auth, PII, or OAuth scopes (this skill's own persona line above is the trigger — Mode A has no separate numbered security step the way Mode B does).

---

## Mode B — Remote tracker (tracker: github)

**1. Branch quality gate** — run build + full test suite (gate-in's coverage check already ran above; CI will also run it once pushed, but failing fast locally saves a round trip). If either fails: stop; do not push.

**2. Security gate (hard)** — run a `security-review` pass on the PR diff. If the epic touches auth, OAuth scopes, or PII this gate is **mandatory and blocking**. Findings must be fixed or explicitly accepted-with-mitigation before G7 clears. Record the decision.

**3. Remote confirmation** — before any remote mutation, present exact planned actions:

> Ready to push `<branch>`, open PR into `<base>`, merge after green checks, validate and close stories `<ids>`, and refresh the dashboard. Proceed?

**4. Push + PR:**
```bash
git push -u origin epic/<epic-id>-<slug>
gh pr create \
  --title "epic <epic-id>: <title>" \
  --body "$(cat <<'EOF'
## Summary
-

## Stories shipped
<list>

## Verification
<test results + security-review result>

## Risks
<list or none>
EOF
)"
```

**5. Wait for CI** — wait for required checks. If red: stop; do not merge.

**6. G7 merge** — ask the user to approve the PR. On approval:
```bash
node scripts/gate.mjs approve G7 --subject <epic-id> --note "PR merge approved"
gh pr merge --merge --delete-branch
```
`--subject <epic-id>` scopes the approval to this epic, same reason as Mode A.

**7. Close issues** — for each child story with a `gh_issue` in `backlog.json`:
```bash
gh issue view <N> --json state,number > .throughline/ship-<epic-id>/issue-<N>.json
# Mark AC complete, add completion comment, close:
gh issue comment <N> --body "Resolved in #<PR>."
gh issue close <N>
```
Close the epic parent issue last, after all child issues are closed.

**8. Sync + dashboard:**
```bash
node scripts/sync-status.mjs && node scripts/build-dashboard.mjs
```

Confirm `sync-status` flipped every shipped story to `done` in `backlog.json`. Confirm `build-dashboard.mjs` exits 0.

**9. Report** — fixed format, ≤7 lines:
```
Branch: <name> | PR: #<N> — <url> | Merge: <result>
Issues closed: #<list>
Dashboard: refreshed
Residual risks: <list or "none">
Skipped gates: <list or "none">
Personas: Developer[, Security]
```
Include `Security` only if step 2's security gate actually fired on this diff.

---

## Failure modes
- CI red or checklist incomplete → do not merge; report.
- Security review fails on a sensitive surface → **block merge**; must fix or accept-with-mitigation first.
- `sync-status.mjs` exits non-zero → investigate and fix; never leave the contract out of sync.
- Child issue not closed before epic → re-check and close children first.
