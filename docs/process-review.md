---
doc: process-review
project: Trazr / workflow
status: draft
updated: 2026-06-16
purpose: Final maturity review of the idea→release workflow — completeness, gaps, ordering, enhancements, and the prerequisites it assumes.
---

# Process review — is the workflow complete & effective?

## Verdict

**Strong and coherent — roughly 85% of a mature pipeline.** The spine is right: one
validated contract, gated stages, personas, codegraph-aware token discipline, a
data-driven dashboard, and a clean distribution model. The gaps are not structural;
they're about **feedback loops, objective scheduling, and a few hardwired assumptions.**
Close the five critical items below and this is a top-tier solo AI-dev process.

## What's already complete & effective (keep)

- Single source of truth (`backlog.json`) with validation as a hard gate — kills the original drift.
- Clear separation: docs = just-in-time, backlog = living, dashboard = pure render.
- 8 explicit human gates; everything else unattended.
- Personas with lead/supporting + conflict-surfacing at gates.
- Token protocol: codegraph for code, contract+sections for docs.
- Reuse map so skills orchestrate existing skills instead of reinventing.
- Plugin distribution with the scaffold bundled in `bootstrap-project`.

## Critical gaps (fix these to mature)

1. **No validation step for the riskiest assumption.** G1 *decides* "validate or accept",
   but nothing in the flow actually runs the spike/prototype/interview before you invest in
   a full PRD, architecture, and backlog. For a bet like Gmail-OAuth feasibility, that's the
   most expensive thing to get wrong. **Add a gated `validate-assumption` (spike) step between
   brief and PRD, with a kill/pivot/proceed decision.**

2. **No feedback path when implementation reveals the plan is wrong.** The flow is one-way
   (define-epic → implement → ship). In reality, implementing a story exposes that the slice,
   acceptance, or dependency was wrong. Today there's no defined "pause, amend the backlog,
   re-gate" loop. **Add a mid-flight escalation: implement → flag → define-backlog reconcile →
   re-approve.** Without it, the contract silently diverges from reality.

3. **Schedule health is subjective.** "Behind / on track / ahead" is a hand-set `health`
   field — there's no estimate or target date to compute it from. **Add optional `estimate`
   and `target_date` to epics; derive health (and a burn-up) objectively.** Otherwise the
   headline KPI is an opinion.

4. **The issue tracker is hardwired to GitHub.** `gh_issue`, `sync-status` reading
   `ship-*/issue-*.json`, and dashboard links all assume GitHub. Fine today, but it blocks
   reuse on GitLab/Linear/Jira. **Abstract it: a `tracker` field + a thin adapter in sync.**

5. **Security is advisory, not enforced, on sensitive surfaces.** For a Gmail/PII product this
   is the riskiest place to be soft. **Make `security-review` a hard gate at G7 (and G4) for any
   change touching auth, OAuth scopes, or PII** — the one open decision still unresolved.

## Secondary gaps

- **Testing strategy is thin.** Unit tests + `verify.ci` exist, but no integration/E2E or a QA
  pass before release (Trazr already has `docs/MANUAL-TESTS.md` — wire it in). Add a test-plan
  output at define-epic and a QA checkpoint at release.
- **codegraph freshness isn't owned.** Skills query the index but nothing guarantees it's
  current. Add re-index on the pre-commit hook / CI so queries never read stale structure.
- **Brownfield adoption isn't generalized.** The Trazr migration plan is bespoke; promote it
  into a reusable `adopt-project` skill for any existing repo.
- **Operational health is missing from the loop.** Measure-and-learn covers product metrics, not
  errors/latency/incidents. Add an ops check (reuse `engineering:incident-response`) post-release.

## Ordering issues

- **Spike before PRD, not after.** Validate the core bet before the expensive doc/architecture
  investment (see gap #1). This is the one real sequencing change.
- **bootstrap builds an empty codegraph index.** At step 1 there's no code yet — the index is
  meaningful only from implement-epic onward. Reword bootstrap to "set up codegraph + re-index
  hook" rather than "verify the index", and expect it to fill in as code lands.
- **Architecture-before-design for data-heavy products.** Optional: for Trazr (Gmail pipeline,
  schema), let architecture lead so design builds on settled data shapes. Keep them parallel by
  default.
- **Seed a Foundation enabler epic first.** App shell, auth, CI scaffolding should be an explicit
  `vertical:false` enabler epic so the first feature epics aren't blocked on unstated groundwork.

## Enhancements that mature the process

- Add `estimate` + `target_date` + objective health/burn-up.
- Add kill/pivot decisions at two points: after the spike (G1.5) and after measure-and-learn.
- Mid-flight amend loop (gap #2) — the single biggest reliability win.
- Tracker abstraction (gap #4) for cross-repo reuse.
- `adopt-project` skill for brownfield.
- Hard security gate for auth/PII.
- Roles/approvers config for when you add collaborators (gates currently assume one approver).

## Assumptions & prerequisites (what the process assumes you already have)

**Tooling on the machine**
- Git, and a **GitHub** account with rights to create repos, issues, labels, PRs (the contract is GitHub-centric today).
- `gh` CLI or a GitHub token for issue/PR automation.
- **Node.js** (scripts are `.mjs`) and **pnpm** (Trazr's package manager).
- **codegraph** installed, with its daemon running and the repo indexed.
- A **CI** provider (GitHub Actions assumed) so `verify.ci` is real.
- A git-hook mechanism (husky or native hooks) for the pre-commit validator.

**Claude / skills environment**
- Cowork/Claude Code with the **custom workflow plugin installed** (the 9–10 skills).
- The **reuse skills installed**: `product-management:*`, `engineering:*`, `design:*`, `marketing:*` plugins — many steps wrap these. (uiuxpromax is NOT installed; design steps fall back to the `design` skills.)
- Optional public add-ons: Superpowers (brainstorming/TDD/plans), qodo (PR), product-tracking, miro.

**Process / human**
- Product & domain judgment from you at the **8 gates** — the process automates execution, not the decisions.
- Availability to actually review at each gate (the loop stalls if gates aren't cleared).
- The **one skill change**: `define-*` skills must read/write `docs/engineering/backlog.json`.
- A working GitHub flow (branch strategy, PR → merge → close issue) that `sync-status` relies on.

**Trazr-specific**
- Supabase, Expo/React Native toolchain, Gmail API credentials, and budget/time for the OAuth security assessment (the known critical-path dependency).

## Recommended fix order

1. Mid-flight amend loop (gap #2) — reliability.
2. Spike step + reorder (gap #1) — avoids expensive wrong bets.
3. Hard security gate (gap #5) — risk, given PII.
4. Objective health: estimates + dates (gap #3).
5. Tracker abstraction (gap #4) — only when you leave GitHub.
