---
doc: workflow-master
project: <PROJECT_NAME>
status: draft
updated: 2026-06-16
purpose: The complete idea→release pipeline. Every responsibility is a custom skill with an automated self-check (machine gate) and a human review gate. Your involvement is the human gates only.
---

# Master Workflow — Idea to Release

## Principle

Each step is a **skill** that runs unattended between two gates:

- **Automated gate** — a script/check the skill must pass before it can finish (schema validation, tests, lint, build). Zero human, zero tokens. Catches drift.
- **👤 Human gate** — an explicit approve/reject by you. This is the *only* place your time is spent, and it's mandatory: the next skill refuses to start until the gate is `approved`.

Two cycle types:
- **Greenfield** (first time): steps run in full, generating the doc spine.
- **Iteration** (v2+): the doc/backlog skills run in **reconcile mode** — amend, never regenerate. Marked per step below.

## Personas

Skills don't write as a generic assistant — each adopts one or more **expert personas**.
A skill speaks in its **lead** persona's voice and standards, and consults **supporting**
personas as reviewers/cross-checks. Where personas conflict (UX ambition vs developer
feasibility, PM scope vs security risk), the skill **surfaces the tension at the human
gate** rather than silently resolving it.

- **PM — top 0.1% FAANG senior PM.** Starts every decision from a sharply-defined user problem and a measurable business outcome, never from a solution. Ruthlessly prioritizes, writes requirements that are testable and unambiguous, and defends non-goals as hard as goals to kill scope creep. States assumptions explicitly and slices work vertically so the riskiest bet is validated first.

- **Architect — top 0.1% FAANG principal architect.** Designs the simplest system that satisfies the requirements and bends gracefully under change, defaulting to boring, proven technology unless a constraint demands otherwise. Reasons in data flows, failure modes, and trade-offs, and records every significant decision as an ADR with the alternatives considered. Resists over-engineering and premature scale, and keeps interfaces explicit so components stay decoupled.

- **UX designer — top 0.1% world-class, benchmark-setting.** Designs around the user's mental model so the obvious path is the easy path, relentlessly cutting cognitive load and steps. Works systematically from tokens and reusable primitives, and treats accessibility, motion, empty states, and microcopy as first-class, not afterthoughts. Benchmarks against the best products in the world and sweats the details that make an interface feel inevitable.

- **Developer — top 0.1% FAANG senior developer.** Writes simple, readable, well-tested code in small vertical increments, optimizing for correctness and the next maintainer over cleverness. Handles edge cases, errors, and failure paths by default, and leaves the codebase cleaner than found. Verifies with tests before claiming done and keeps every change tightly scoped to its story.

- **Security — top 0.1% software security expert.** Threat-models by default, assumes all input is hostile, and applies least privilege everywhere. Guards secrets, auth/authz, and PII rigorously, never trusts the client, and thinks like an attacker hunting the weakest link. Surfaces risk early and concretely, separating must-fix from accept-with-mitigation.

### Persona assignment per step

| Step / skill | Lead | Supporting |
|--------------|------|-----------|
| 0 define-brief | PM | — |
| 0.5 validate-assumption | PM | Architect/Developer (tech spike), UX (user test) |
| 1 bootstrap-project | — (mechanical) | — |
| 1b adopt-project (brownfield) | Architect | PM, Developer, Security |
| 2 define-product (PRD) | PM | UX (user lens), Security (PII/compliance flags) |
| 3 define-design | UX | PM (scope), Developer (feasibility) |
| 4 define-architecture | Architect | Security (threat model), Developer (implementability) |
| 5 define-backlog | PM | Architect (dependencies) |
| 6 define-epic | Architect | PM (scope), Developer (implementability) |
| 7 implement-epic | Developer | Security (review) |
| 8 ship-epic | Developer | Security (secrets/deploy) |
| 9 release | PM | Security (release risk) |
| 10 measure & learn | PM | UX (research synthesis) |

## Pipeline at a glance

```
[idea]
 0 define-brief ───────────────👤 G1 brief approved
 0.5 validate-assumption ──────👤 G1.5 proceed / pivot / kill   (only if G1 chose "validate")
 1 bootstrap-project ──────────(auto: repo + scaffold + CI + codegraph re-index hook)
 2 define-product (PRD) ───────👤 G2 PRD approved   ← pivot: thinking → building
      ├─ 3 define-design ──────👤 G3 design approved   ┐ (3 & 4 run in parallel)
      └─ 4 define-architecture ─👤 G4 arch + 🔒security (hard gate: auth/PII) ┘  (arch may lead for data-heavy)
 5 define-backlog ─────────────👤 G5 backlog approved   (Foundation enabler epic first)
   ┌─────────────── per epic, lowest-order unblocked ───────────────┐
   │ 6 define-epic ────────────👤 G6 epic plan approved             │
   │ 6 epic plan also yields a TEST PLAN                            │
   │ 7 implement-epic ─────────(auto: TDD+lint+review)              │
   │      └ spec wrong? → amend backlog → re-gate (loop back) ◀──── │
   │ 8 ship-epic ──────────────👤 G7 PR review + 🔒security merge    │
   └────────────────────────────────────────────────────────────────┘
 9 release ────────────────────👤 G8 QA pass + release go/no-go
10 measure & learn (+ ops health) → proceed/pivot/kill → next define-brief (reconcile)
```

Automation runs after every ship and on demand: `validate → sync-status → build-dashboard`.

## The steps

### 0 · `define-brief` — sharpen the idea
- **Mode:** every cycle (v2 brief is grounded in step 10's metrics/feedback).
- **Wraps:** `product-management:product-brainstorming`.
- **Reads:** your raw idea (+ for v2: metrics, user research).
- **Writes:** `docs/product/00-brief.md` — the 5 answers: problem, target user (and non-users), core bet, scope boundary + non-goals, **riskiest assumption**.
- **Automated gate:** all 5 fields present and non-empty.
- **👤 G1:** you approve the framing **and decide the riskiest assumption**: validate now (a spike / landing-page test / interviews) or accept-as-risk and proceed. *This decision is logged in the brief — it's the step most workflows skip.*

### 0.5 · `validate-assumption` — de-risk the bet *(only if G1 chose "validate")*
- **Mode:** when the brief flags a kill-the-product assumption. Skipped if G1 accepted the risk.
- **Wraps:** `product-management:product-brainstorming`, `design:user-research`, `engineering:system-design`/`debug` (for technical spikes).
- **Reads:** `00-brief.md` (riskiest assumption).
- **Writes:** `docs/product/00b-validation.md` — hypothesis, threshold, method, result, decision.
- **Automated gate:** falsifiable hypothesis + threshold + result + decision present.
- **👤 G1.5:** **proceed / pivot / kill.** Pivot loops back to `define-brief`; kill stops. Validate the bet *before* the expensive PRD/architecture investment.

### 1 · `bootstrap-project` — make it AI-ready
- **Mode:** first cycle only. (Existing repos use `adopt-project` instead — see below.)
- **Does:** runs **inside a repo the user owns** (offers a decision-free local `git init` only if none exists — never the remote, visibility, or license) → `node scripts/init-project.mjs "<name>"` (doc tree, `CLAUDE.md`, empty `backlog.json`) → create the workflow issue **labels** (`epic`, `feature`) on the chosen `tracker` → install the **pre-commit hook** running `validate.mjs` **and a codegraph re-index** → set up **CI** (so `verify.ci` is real) → point the define-* skills at `docs/engineering/backlog.json`.
- **Scope boundary:** the plugin owns everything *inside* the repo; the repo's existence, host, visibility, and license are the user's.
- **Automated gate:** `validate.mjs` passes; CI green; `CLAUDE.md` present; codegraph re-index hook installed.
- **👤 gate:** none (mechanical). *Note:* the codegraph index is empty until code lands — it fills in from implement-epic onward.

### 1b · `adopt-project` — onboard an existing repo *(brownfield, replaces step 1)*
- **Mode:** first cycle for an existing codebase. Audits, stands up the rails, builds the codegraph index, and reconciles existing work into one `backlog.json` (status seeded from ledgers/commits, not stale tracker state). Spec: `skill-specs/10-adopt-project.md`. Gate: **G5 (adopt)**.

### 2 · `define-product` — the PRD
- **Mode:** every cycle (reconcile for v2: append new `REQ-xx`, never renumber).
- **Wraps:** `product-management:write-spec`, `marketing:competitive-brief`.
- **Reads:** `00-brief.md` (+ `00b-validation.md` if a spike ran).
- **Gate-in:** if a spike ran, its decision must be `proceed`.
- **Writes (top-down):** `01-product-vision` → `03-user-personas` → `04-market` / `05-competitive` → `06-prd.md`. Every requirement gets a stable **`REQ-xx`** id, a priority, and testable acceptance. Requirements are **vertically sliced** (each maps to one or more features/stories later). Keep lean — enough for the first slices.
- **Automated gate:** every `REQ` has an id + acceptance; no duplicate/renumbered ids.
- **👤 G2:** set PRD front-matter `status: approved` (v2: approve only the new requirements). **The pivot from thinking to building.**

### 3 · `define-design` — design tier *(parallel with 4)*
- **Mode:** every cycle; first cycle = tokens + a handful of primitives, grow later.
- **Wraps:** Claude design / uiuxpromax, then `design:design-critique` + `design:accessibility-review` as self-review.
- **Reads:** product docs.
- **Writes:** `docs/design/` — tokens, the components the first screens need, key mockups.
- **Automated gate:** design-critique + a11y review pass; tokens file present.
- **👤 G3:** approve the design direction / mockups.

### 4 · `define-architecture` — architecture tier *(parallel with 3; may lead for data-heavy products)*
- **Mode:** every cycle (extend just-in-time; don't over-design).
- **Wraps:** `engineering:system-design`, `engineering:architecture` (ADRs), built-in `security-review`.
- **Reads:** product docs (+ mockups if available).
- **Writes:** `docs/architecture/` — stack, data model, API shape; **ADRs** in `decisions/` for the real calls, each linked to the requirement/epic that triggered it.
- **Automated gate:** data model + API cover the first epics; ADRs have status; **security threat-model recorded**.
- **👤 G4:** accept the ADRs / architecture. **🔒 Security is a hard gate for any auth / OAuth-scope / PII surface — must-fix or explicitly accept-with-mitigation before proceeding.**

### 5 · `define-backlog` — seed the contract
- **Mode:** every cycle (reconcile for v2: append `release: v2` epics/stories, leave shipped work untouched).
- **Reads:** approved PRD + tech-plan + architecture.
- **Writes:** `backlog.json` — **vertically-sliced epics** (release-tagged) grouping **user stories**; orders + `blocked_by`; optional `estimate` + `target_date` per epic (→ objective schedule health). Seed a **Foundation enabler epic** (`vertical:false`) first so feature epics aren't blocked on unstated groundwork. (Spec: `define-backlog.spec.md`.)
- **Automated gate:** `validate.mjs` passes; every epic has ≥1 story; graph acyclic.
- **👤 G5:** approve the proposed epic/story slice set, order, and estimates/dates.

### 6 · `define-epic` — expand one epic *(loop)*
- **Mode:** per epic; picks the lowest-`order` epic whose stories' deps are `done`.
- **Writes:** `.claude/epic-<n>/` (epic.json, sub-issue specs, ledger, **test plan** via `engineering:testing-strategy`) + creates the **GH epic issue + one sub-issue per story**; writes `gh_issue` back into `backlog.json`.
- **Automated gate:** every story has scope + acceptance + invariants + a test plan; GH issues created.
- **👤 G6:** review the epic plan / test plan / ledger before any code is written.

### 7 · `implement-epic` — build *(loop)*
- **Writes:** code + tests per sub-issue; updates the ledger (files, tests, commit) + `story.verify`.
- **Automated gate:** TDD tests pass, lint clean, `engineering:code-review` + `security-review` self-pass, `verify.ci: pass`.
- **Mid-flight amend:** if building reveals the slice/acceptance/dependency is wrong, **stop** — flag it, run `define-backlog` in reconcile to amend the affected story/epic, and re-clear G6. Never let code silently diverge from the contract.
- **👤 gate:** none on the happy path — review happens at ship (G7). The amend path re-enters G6.

### 8 · `ship-epic` — land it *(loop)*
- **Wraps:** `engineering:deploy-checklist`, built-in `security-review`.
- **Does:** open PR, run deploy-checklist, on merge close the issues. Then auto-run `sync-status → build-dashboard`.
- **Automated gate:** CI green; checklist complete; **security-review pass (hard gate for auth/PII changes)**.
- **👤 G7:** PR review + merge approval (your per-epic quality gate).

### 9 · `release` — ship to users
- **Mode:** per release wave.
- **Wraps:** `engineering:deploy-checklist`, `product-management:stakeholder-update`, `marketing:content-creation`.
- **Does:** run a **QA pass** (integration/E2E + `docs/MANUAL-TESTS.md`), generate **changelog/release notes** from shipped epics, tag the version, deploy, refresh the dashboard.
- **Automated gate:** all epics in the release `done`; **QA pass green**; changelog generated; deploy succeeds.
- **👤 G8:** approve the release (go/no-go to users).

### 10 · measure & learn → loop
- **Wraps:** `product-management:metrics-review`, `product-management:synthesize-research`, and **`engineering:incident-response`** for post-release ops health (errors/latency/incidents); write a short **retro / decision log** (ADR-style).
- **Decision:** **proceed / pivot / kill** the next bet based on metrics + ops + research.
- **Output:** feeds the next `define-brief`. The loop returns to step 0 in **reconcile mode** — v2 amends the PRD and backlog, it does not restart.

## Automation layer (scripts/tasks, not skills — never need you)

- **pre-commit hook:** `validate.mjs` (bad contract can't be committed) **+ codegraph re-index** (the graph never goes stale).
- **after every ship:** `sync-status.mjs` (mirror tracker state) → `build-dashboard.mjs`.
- **scheduled digest:** a daily/weekly task that runs sync + dashboard and surfaces blockers + overdue epics, so status is always current without you asking.

## Your definite involvement (the touchpoints)

| Gate | You decide |
|------|-----------|
| G1 | Is the framing right? Validate the risky bet or accept it? |
| G1.5 | After the spike: proceed / pivot / kill |
| G2 | PRD approved → building may begin |
| G3 | Design direction approved |
| G4 | Architecture/ADRs accepted |
| G5 | Backlog slices + order approved |
| G6 | Epic plan sound before coding |
| G7 | PR review + merge (per epic) |
| G8 | Release go/no-go |

Everything else — generation, validation, slicing mechanics, tests, sync, dashboard — runs without you.

## First cycle vs every cycle

- **First cycle only:** `bootstrap-project` (new repo) **or** `adopt-project` (existing repo).
- **When the bet is risky:** `validate-assumption` (after the brief, before the PRD).
- **Every cycle, full first time then reconcile:** define-product, define-design, define-architecture, define-backlog.
- **Every cycle, unchanged:** define-epic → implement → ship → release → measure.

## Portable across coding agents

**Agent-agnostic engine + thin per-agent adapter.** The engine — `backlog.json` + schema,
the Node scripts, the dashboard, the doc spine, and the specs as plain markdown — has zero
Claude dependency; any agent can run `node scripts/*.mjs` and read the docs. Lock-in only
ever lives in the adapter:

- **Operating manual:** `AGENTS.md` is canonical (cross-agent); `CLAUDE.md` / `GEMINI.md` are
  thin pointers emitted by `init-project`. Add `.cursor/rules` the same way.
- **Reuse skills are optional accelerators** — every spec is followable as plain instructions;
  a non-Claude agent performs the step directly. The spec is the source of truth.
- **codegraph** already supports Claude, Cursor, Codex, Gemini, OpenCode; **tracker** is
  abstracted and local by default. Both neutral.
- **The Claude plugin is just the first adapter.** Cursor (`.cursor/rules`), Codex/others
  (`AGENTS.md`), and Aider can each get a thin adapter that drops the same scaffold and points
  at the same engine — no engine changes.

## Works with or without a tracker (public-plugin requirement)

The **backlog contract is the tracker.** An external issue tracker is an optional mirror,
never a dependency:

- **`tracker: local` (default)** — no account, no network. Stories are the work items;
  `define-epic` skips issue creation; `implement-epic`/`ship-epic` set status locally;
  G7 is a local `git diff` review and merge; the dashboard links to the PRD/backlog.
- **`tracker: github`** — opt-in. `define-epic` mirrors stories to issues,
  `sync-status` mirrors their state back, and the dashboard deep-links to them.
  GitLab, Linear, and Jira require adapters before they can be enabled.

Same skills, same gates, same dashboard — the tracker only changes whether work is *also*
mirrored to issues. The plugin works the same for a developer with no GitHub account.

## Fixes applied (process-review v2)

This version closes the gaps from `process-review.md`:
1. **Spike step** (`validate-assumption`, G1.5) validates the riskiest bet *before* PRD/architecture, with proceed/pivot/kill.
2. **Mid-flight amend loop** — implement-epic can flag a wrong slice → reconcile backlog → re-gate (G6).
3. **Objective schedule health** — optional `estimate` + `target_date` per epic; dashboard flags overdue.
4. **Tracker abstraction** — `tracker` field (`local|github` today); sync uses a per-tracker adapter.
5. **Hard security gate** at G4 (architecture) and G7 (ship) for auth/OAuth/PII.
6. **Testing matured** — test plan at define-epic; QA pass (incl. `MANUAL-TESTS.md`) at release.
7. **codegraph freshness** — re-index on the pre-commit hook + CI.
8. **Brownfield path** — `adopt-project` generalizes the migration.
9. **Ops health + kill/pivot** in measure-and-learn.
10. **Foundation enabler epic** seeded first.

## Reuse map — don't reinvent the wheel

Every step should lean on an existing skill where one is good enough; the custom
skill is just the thin orchestrator that adds the gate, the persona, and the
contract write-back. **Available now** = confirmed in your enabled skills (or a
Claude built-in command). **Public add-on** = install separately.

> Notes: **GSD is deliberately excluded** (too heavy) — its plan/execute value is
> covered more lightly by Superpowers + your own define-* skills. **Superpowers** is
> a public plugin, not in the surfaced marketplace; its sub-skill names below are
> indicative — confirm exact names when you install it.

| Step | Available now | Public add-on |
|------|---------------|---------------|
| 0 define-brief | `product-management:product-brainstorming` | Superpowers › brainstorming |
| 0.5 validate-assumption | `product-management:product-brainstorming`, `design:user-research`, `engineering:system-design`/`debug` | Superpowers › writing-plans |
| 1 bootstrap-project | `anthropic-skills:skill-creator` (build the pipeline skills), `anthropic-skills:schedule` (digest task) | Superpowers › using-git-worktrees |
| 1b adopt-project | `engineering:tech-debt`, `engineering:system-design`, `product-management:roadmap-update` | — |
| 2 define-product | `product-management:write-spec`, `:synthesize-research`, `marketing:competitive-brief`, `design:user-research`, `anthropic-skills:doc-coauthoring` | product-tracking-skills (analytics business case) |
| 3 define-design | `design:design-critique`, `:accessibility-review`, `:design-system`, `:ux-copy`, `anthropic-skills:canvas-design`, `theme-factory`, `web-artifacts-builder`, `brand-guidelines` | miro › miro-diagram (flows) |
| 4 define-architecture | `engineering:system-design`, `:architecture` (ADR), `:testing-strategy`, `data:explore-data`/`sql-queries`, built-in `security-review` | miro › miro-code-spec; vanta (if SOC2/compliance) |
| 5 define-backlog | `product-management:sprint-planning`, `:roadmap-update` | Superpowers › writing-plans |
| 6 define-epic | `engineering:system-design`, `:testing-strategy`, `product-management:write-spec`, the **Plan** subagent | Superpowers › writing-plans / subagent-driven-development |
| 7 implement-epic | `engineering:code-review`, `:debug`, built-in `review` + `security-review` | Superpowers › test-driven-development, root-cause-tracing; qodo › qodo-pr-resolver |
| 8 ship-epic | `engineering:deploy-checklist`, `:incident-response`, built-in `security-review` | qodo › qodo-pr-resolver; vanta › test-remediation |
| 9 release | `engineering:deploy-checklist`, `product-management:stakeholder-update`, `marketing:content-creation`, `operations:change-request`/`status-report` | product-tracking › instrument-new-feature |
| 10 measure & learn | `product-management:metrics-review`, `:synthesize-research`, `data:analyze`/`build-dashboard`/`create-viz`, `design:research-synthesis` | product-tracking-skills |

The rule of thumb: if an existing skill does ~80% of a step, the custom skill *calls*
it and adds only the gate + persona + backlog write-back. Build from scratch only
where nothing fits (define-backlog, the epic/ship loop, release orchestration).

## What I added to your draft

1. **Save the brief as a file** (`00-brief.md`) and a **G1 decision on the riskiest assumption** (validate vs accept) — your draft produced the assumption but never acted on it.
2. **bootstrap now includes GitHub repo + CI + pre-commit hook + pointing define-* at the backlog** — not just the empty folders, so `verify.ci` and the validation gate are real from day one.
3. **Design and architecture each got their own automated self-review and human gate** (G3, G4), and are explicitly **parallel**.
4. **`release` is now a real step** with changelog, tag, deploy, and a go/no-go gate (G8) — it was a placeholder.
5. **A measure-and-learn step (10) + the automation layer** (sync/dashboard/scheduled digest) close the loop, and the v2 return path runs in **reconcile mode** rather than restarting.
