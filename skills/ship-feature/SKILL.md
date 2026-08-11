---
name: ship-feature
description: Use when non-epic work (a hotfix, plugin/scaffold maintenance, a doc-only change) is ready to land — open the PR (or merge locally), run the same build/test/security checks ship-epic runs, then merge. Trigger phrases: "ship this", "ship feature", "open a PR for this", "run ship-feature". For epic-tracked work use ship-epic instead. This is gate G7, scoped by feature slug instead of epic id.
---

# ship-feature

Act as a top-0.1% FAANG senior developer landing clean: never merge on red CI, a failing quality gate, or an unresolved review finding. Consult a security lens on any PR touching auth, PII, or OAuth scopes — that gate is hard and can block the merge.

## Scope
For anything tracked as a `backlog.json` epic, use `ship-epic` instead — it has epic-specific bookkeeping (subject-scoped gate, closing child GitHub issues) this skill doesn't do. That includes single stories spec'd/built via `define-feature`/`implement-feature` in **epic-linked mode**: they write to the same shared `epic/<epic-id>-<slug>` branch `implement-epic` uses, and an epic ships as one atomic unit via `ship-epic` once every story on it is done — never one story at a time through here. Use `ship-feature` for everything `define-feature`/`implement-feature` produce in **standalone mode**: hotfixes, plugin/scaffold maintenance, doc-only changes, and any work that never went through `define-epic`. This is the only other path allowed to push to remote — nothing pushes directly.

## Gate-in
`node scripts/ensure-branch.mjs --check-only` passes (i.e. not on `main`/`master`) — if it fails, stop: there is no feature branch to ship. Every skill's own branch check should already guarantee this; treat a failure here as a sign something ran outside the normal flow. Working tree has commits ahead of `main` (`git log main..HEAD` non-empty) — nothing to ship otherwise.

## Context protocol
Work from the branch diff. If a codegraph index is present (`.codegraph/`), query it for impact/blast-radius of the change; read only the spans returned.

---

## Mode A — Local (tracker: local, the default)

In local mode there is no remote repo, no PR, no GitHub. G7 is a local review and merge.

**1. G7 review** — present a `git diff --stat` against `main` and a compact summary of what changed. Ask the user to review and approve the merge.

**2. Merge on approval:**
```bash
node scripts/gate.mjs approve G7 --subject <feature-slug> --note "local feature merge approved"
git checkout main
git merge --no-ff <branch> -m "merge: <feature-slug>"
```
`--subject <feature-slug>` scopes the approval the same way `ship-epic` scopes it by epic id — a stale global G7 approval left over from a previously shipped epic or feature must never silently satisfy this one's merge.

**3. Report** — fixed format, ≤5 lines:
```
Merged: <branch> → main
Summary: <one line>
Residual risks: <list or "none">
Personas: Developer[, Security]
```
Include `Security` only if the diff actually touches auth, PII, or OAuth scopes (this skill's own persona line above is the trigger — Mode A has no separate numbered security step the way Mode B does).

---

## Mode B — Remote tracker (tracker: github)

**1. Branch quality gate** — run build + full test suite. If either fails: stop; do not push.

**2. Security gate (hard)** — run a `security-review` pass on the diff. If the change touches auth, OAuth scopes, or PII this gate is **mandatory and blocking**. Findings must be fixed or explicitly accepted-with-mitigation before G7 clears. Record the decision.

**3. Remote confirmation** — before any remote mutation, present exact planned actions:

> Ready to push `<branch>`, open PR into `<base>`, merge after green checks. Proceed?

**4. Push + PR:**
```bash
git push -u origin <branch>
gh pr create \
  --title "<feature-slug>: <title>" \
  --body "$(cat <<'EOF'
## Summary
-

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
node scripts/gate.mjs approve G7 --subject <feature-slug> --note "PR merge approved"
gh pr merge --merge --delete-branch
```

**7. Report** — fixed format, ≤5 lines:
```
Branch: <name> | PR: #<N> — <url> | Merge: <result>
Residual risks: <list or "none">
Skipped gates: <list or "none">
Personas: Developer[, Security]
```
Include `Security` only if step 2's security gate actually fired on this diff.

---

## Failure modes
- CI red or build/test failing → do not merge; report.
- Security review fails on a sensitive surface → **block merge**; must fix or accept-with-mitigation first.
- Nothing to ship (branch has no commits ahead of `main`) → stop, say so, don't open an empty PR.
- `node scripts/ensure-branch.mjs --check-only` fails (on `main`) → stop; there is nothing to ship from `main` itself.
