# Throughline

> **Status: work in progress.** The core skills (define-brief through define-backlog) and the full bootstrap layer are complete. The epic loop (define-epic → implement-epic → ship-epic) and the release + adopt-project skills are written but not yet field-tested. The npm package is not published yet — install from source for now (see below).

**Solo dev superpowers.** A spec-driven, gated workflow that lets one developer ship like a team. You show up at the gates. The AI runs everything between them.

---

## Install

**From source (available now):**

```bash
git clone https://github.com/navneetvishwakarma/throughline.git
cd throughline

# Claude Code, Windows
./install.ps1

# Claude Code, macOS / Linux
chmod +x install.sh && ./install.sh
```

Then restart the target AI tool.

Codex:

```bash
# Windows
./install.ps1 -Platform codex

# macOS / Linux
./install.sh codex
```

This copies the plugin to `~/plugins/throughline` and updates `~/.agents/plugins/marketplace.json`.

Antigravity:

```bash
# Windows
./install.ps1 -Platform antigravity

# macOS / Linux
./install.sh antigravity
```

This installs namespaced Throughline skills into `~/.agents/skills/`. Antigravity support is skills-folder based until Antigravity has a richer plugin marketplace format.

To update: `git pull`, re-run the install script for your platform, then restart the target AI tool.

To uninstall: `./install.ps1 -Platform codex -Uninstall` or `./install.sh codex --uninstall`. Replace `codex` with `claude` or `antigravity`.

To verify a source checkout:

```bash
npm test
npm run doctor
```

**Via npm (once published):**

```bash
npx skills add throughline
```

Requires Node.js 18+. First-class adapters exist for Claude Code and Codex. Antigravity uses the skills-folder install path. Any coding agent that reads `AGENTS.md` can still follow the core workflow.

---

## Repository layout

Throughline separates the portable workflow from platform packaging:

- `skills/` contains the platform-neutral skills.
- `skills/bootstrap-project/assets/` contains the deterministic scaffold, scripts, templates, and dashboard builder copied into user projects.
- `adapters/claude/` contains Claude Code plugin metadata.
- `adapters/codex/` contains Codex plugin metadata.
- `.codex-plugin/` and `.agents/plugins/marketplace.json` expose the source checkout directly to Codex as a repo-local plugin.
- `.throughline/` is the workflow state directory created inside bootstrapped projects.

---

## The idea

Most AI coding tools are great at writing code but have no opinion about *what* to build or *whether* the right thing got built. Throughline fixes that by wrapping the full product lifecycle — idea → brief → PRD → design → architecture → backlog → epics → ship → release — in a single validated contract.

The contract is `docs/engineering/backlog.json`. Every story in it traces to a requirement. Every requirement is testable. Every epic gets a plan you approve before a line of code is written. The dashboard renders from data, not LLM reasoning.

**You review at 9 gates. The AI runs everything between them.**

---

## Lifecycle at a glance

```
[your idea]
     │
     ▼
┌─────────────┐
│define-brief │
└─────────────┘
     │
     ├──── 👤 G1  approve framing · risk decision
     │
     │  ┌── if "validate" ──────────────────────────────┐
     │  ▼                                               │
     │  ┌──────────────────────┐                        │
     │  │  validate-assumption │                        │
     │  └──────────────────────┘                        │
     │       │                                          │
     │       ├── 👤 G1.5  proceed / pivot / kill        │
     │       │   pivot ──► back to define-brief         │
     │       │   kill  ──► stop                         │
     │◄──────┘ proceed ·  or "accept risk" ◄────────────┘
     │
     ▼
┌──────────────────────┐
│  bootstrap-project   │  (adopt-project for existing repos)
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│   define-product     │
└──────────────────────┘
     │
     ├──── 👤 G2  PRD approved  ← pivot from thinking to building
     │
     ├─────────────────────────────────┐
     ▼                                 ▼
┌───────────────┐           ┌──────────────────────┐
│ define-design │           │  define-architecture │
└───────────────┘           └──────────────────────┘
     │                                 │
     ├── 👤 G3  design approved        ├── 👤 G4 🔒  arch + security
     │                                 │              hard gate on
     └──────────────┬──────────────────┘              auth / PII
                    │
                    ▼
           ┌─────────────────┐
           │ define-backlog  │
           └─────────────────┘
                    │
                    ├──── 👤 G5  backlog approved
                    │
    ┌───────────────▼───────────────────────────────┐
    │            epic loop  (repeats per epic)       │
    │                                                │
    │   ┌─────────────┐                              │
    │   │ define-epic │◄── picks lowest unblocked   │
    │   └─────────────┘                              │
    │         │                                      │
    │         ├──── 👤 G6  plan approved             │
    │         │                                      │
    │   ┌─────▼───────────┐    wrong slice?          │
    │   │ implement-epic  │──────────────────────►   │
    │   └─────────────────┘   amend backlog          │
    │         │               re-gate G6 ◄───────────┤
    │   ┌─────▼──────┐                               │
    │   │ ship-epic  │                               │
    │   └────────────┘                               │
    │         │                                      │
    │         ├──── 👤 G7  PR merged                 │
    │         │                                      │
    │         └── next unblocked epic ───────────────┘
    │
    └─────────── all release epics done ─────────────┐
                    │                                 │
                    ▼                                 │
             ┌────────────┐                           │
             │  release   │                           │
             └────────────┘                           │
                    │                                 │
                    ├──── 👤 G8  go / no-go           │
                    │                                 │
                    ▼                                 │
           ┌──────────────────┐                       │
           │ measure & learn  │                       │
           └──────────────────┘                       │
                    │                                 │
           ┌────────┴────────┐                        │
           ▼                 ▼                        │
         pivot            proceed                     │
           └────────┬────────┘                        │
                    ▼                                 │
             define-brief v2  ◄───────────────────────┘
             (reconcile mode)
```

`👤` marks the 9 gates where you make a decision. Everything else runs unattended.

---

## Full development lifecycle

Here is what using Throughline looks like end-to-end, from your first idea to users seeing the product.

### Step 0 — Sharpen the idea (`define-brief`)

You have a rough idea. Run `define-brief` (or just say "I have an idea" to Claude). It interviews you until five things are crisp:

- **Problem** — what you're solving, in 1–2 sentences
- **Target user** — who it's for, and who it's not for
- **Core bet** — the single value hypothesis that must be true
- **Scope boundary** — what it is, and explicit non-goals
- **Riskiest assumption** — the thing most likely to kill it

At the end it asks you to make one decision: validate the riskiest assumption now (run a spike) or accept it as a known risk and proceed. That decision is logged in `docs/product/00-brief.md`.

> **Gate G1:** You approve the framing and the risk decision.

---

### Step 0.5 — De-risk the bet (`validate-assumption`) *(optional)*

Only runs if G1 chose "validate". The skill picks the cheapest decisive test — a throwaway technical spike, a landing-page demand test, or a user interview guide — and runs it or hands you a runbook. It records the result as a falsifiable outcome: hypothesis, threshold, actual result, decision.

> **Gate G1.5:** You decide — proceed, pivot, or kill. Pivot loops back to `define-brief`. Kill stops here. You just saved yourself the cost of the full PRD and architecture.

---

### Step 1 — Make the repo AI-ready (`bootstrap-project`)

Say "bootstrap the project". The skill:

1. Confirms a git repo exists (offers a plain `git init` if not — no remote, visibility, or license decision imposed on you)
2. Copies the doc tree, templates, and scripts into the project
3. Seeds an empty `backlog.json`, generates canonical `AGENTS.md`, and emits platform pointer files
4. Installs a pre-commit hook that validates the contract on every commit
5. Sets up CI (test + lint) if a CI connector is configured

After this step your repo has a fixed, machine-readable structure that every subsequent skill navigates without re-reading the whole tree.

> **No human gate.** This step is mechanical and idempotent. For an existing codebase, use `adopt-project` instead.

---

### Step 2 — Write the PRD (`define-product`)

With the brief approved, `define-product` fills the product document tier top-down: vision → thesis → personas → market → competitive → requirements. Every requirement gets a stable `REQ-xx` id, a priority (P0/P1/P2), and a testable acceptance line. Requirements are vertically sliced — each one maps to future stories, not a horizontal layer.

The PRD is kept lean: enough to seed the first epics, not a 40-page document.

> **Gate G2:** You approve the PRD. This is the pivot from thinking to building. No architecture or design work starts until G2 clears.

---

### Steps 3 & 4 — Design + Architecture *(run in parallel)*

These two skills run at the same time.

**`define-design`** (UX lead) produces `docs/design/`:
- Design tokens (color, type, spacing, motion)
- The component primitives the first screens need
- Key screen mockups tied to `REQ-xx` requirements
- Microcopy and empty states

It self-reviews with a design-critique and accessibility pass before presenting to you.

> **Gate G3:** You approve the design direction.

**`define-architecture`** (Architect lead) produces `docs/architecture/`:
- Stack decision (proven tech by default; any exotic choice justified in an ADR)
- Data model and API shape for the first epics only
- Security threat model (auth, PII, hostile inputs)
- One ADR per significant decision, each linked to the requirement that triggered it

> **Gate G4:** You accept the ADRs and architecture. Security is a **hard gate** — any auth, OAuth-scope, or PII surface with a must-fix finding blocks G4 until resolved or explicitly accepted-with-mitigation.

---

### Step 5 — Seed the backlog (`define-backlog`)

With the PRD and architecture approved, `define-backlog` turns requirements into the contract. It clusters related requirements into vertically-sliced epics, slices each epic into user stories, and sets their order and dependencies. A **Foundation enabler epic** (infra, auth, CI setup) is always seeded first so feature epics aren't blocked on unstated groundwork.

Every story traces to a `REQ-xx`. The graph is acyclic. Optional `estimate` and `target_date` per epic give the dashboard objective schedule health.

```
node scripts/validate.mjs    ← runs automatically; must pass before the file commits
```

> **Gate G5:** You approve the epic/story slice set, order, and estimates. After this, the AI picks up epics automatically — you don't assign work.

---

### Steps 6 → 7 → 8 — The epic loop *(repeats per epic)*

This is the core build cycle. It repeats for every epic, lowest-order unblocked first.

**`define-epic`** expands one epic from the backlog:
- Reads the chosen epic's stories and their PRD requirements
- Queries the codegraph index (if present) to map the epic to the affected code symbols
- Writes a per-story spec (goal, scope, acceptance, invariants) to `.throughline/epic-N/`
- Produces a test plan covering unit, integration, and E2E coverage for each story
- Creates the GitHub epic parent issue and sub-issues (or operates fully offline in local mode)

> **Gate G6:** You review the epic plan and test plan **before any code is written**. This is the last cheap moment to catch a wrong slice.

**`implement-epic`** builds the stories one at a time:
- Dispatches a fresh sub-agent per story so context stays lean
- Each sub-agent works in TDD — failing test first, minimum code to pass, refactor
- Writes `story.verify` (CI result, coverage, commit SHA) back into `backlog.json`
- Updates the ledger in `.throughline/epic-N/ledger.md`
- Runs a code-review and security-review self-pass before the story is marked done

**Mid-flight amend:** if building reveals the slice or acceptance is wrong, the skill stops, flags the conflict, and runs `define-backlog` in reconcile mode to amend just the affected stories — then re-gates at G6. Code never silently diverges from the contract.

> **No human gate** on the happy path. You review at ship.

**`ship-epic`** lands the completed epic:

*With a remote tracker (GitHub):*
- Validates every story's acceptance criteria against implementation evidence
- Runs a mandatory security-review for any change touching auth, OAuth, or PII — this can block the merge
- Opens the PR, waits for CI, asks you to approve and merge
- Closes the child issues, then the epic parent issue
- Runs `sync-status.mjs → build-dashboard.mjs` to keep the contract and dashboard current

*In local mode (default, no account needed):*
- Presents a `git diff` summary for your review
- On your approval, merges the branch to main
- Sets the shipped stories to `done` in `backlog.json` directly
- Runs `build-dashboard.mjs` to refresh the dashboard

> **Gate G7:** You review the PR (or local diff) and approve the merge.

After G7 the loop returns to `define-epic` with the next unblocked epic.

---

### Step 9 — Ship to users (`release`)

When all epics in a release wave are done, `release` cuts the version:

1. Verifies every release epic is `done` (derived from the contract — no manual counting)
2. Runs the full integration/E2E suite and your `docs/MANUAL-TESTS.md` checklist
3. Generates a changelog from the shipped epics' ledgers
4. Runs a final security pass
5. Tags the version and deploys via the deploy checklist
6. Refreshes the dashboard and drafts the user-facing announcement

> **Gate G8:** You give the go/no-go. After approval, the version is live.

---

### Step 10 — Measure and loop

After release, the skill wires analytics for new features, surfaces ops health (errors, latency, incidents), and runs a metrics review. It ends in a **proceed / pivot / kill** decision.

That decision feeds the next `define-brief` — in **reconcile mode**. The second cycle amends the PRD and backlog; it does not start over. Requirements get new `REQ-xx` ids appended. Shipped epics are never touched.

---

## What you do vs what the AI does

| You | AI |
|-----|-----|
| Approve the framing (G1) | Interview until the brief is sharp |
| Decide to validate or accept the bet (G1) | Run the spike / design the experiment |
| Approve the PRD (G2) | Write requirements, personas, competitive analysis |
| Approve design direction (G3) | Produce tokens, primitives, mockups, microcopy |
| Accept architecture + ADRs (G4) | Design the stack, data model, API, threat model |
| Approve backlog slices (G5) | Slice epics from requirements, set order + deps |
| Review epic plan before coding (G6) | Expand stories into specs + test plan |
| Review and merge each PR (G7) | Build, test, self-review, open PR |
| Go/no-go on each release (G8) | QA, changelog, tag, deploy, announce |

Everything between gates runs unattended and stays in sync via the validated contract.

---

## The backlog is the tracker

By default (`tracker: local`) the plugin runs entirely offline — no GitHub account, no API keys, no network. The `backlog.json` contract is the tracker: stories are the work items, skills set their status, and the dashboard links to the PRD and backlog docs.

To mirror work to issues, set `tracker` in `backlog.json` to `github`. Same skills, same gates, same dashboard — GitHub only changes whether work is *also* mirrored to issues. GitLab, Linear, and Jira are intentionally not advertised until their adapters exist.

---

## Dashboard

After every `ship-epic` and on demand:

```bash
node scripts/build-dashboard.mjs
```

Renders `PROGRESS_DASHBOARD.html` — a zero-token, zero-dependency view of your project's schedule health, blocked items, epic progress, and per-release rollup. Pure function of the contract; open it in any browser.

Gate state is persisted in `.throughline/gates.json`:

```bash
node scripts/gate.mjs list
node scripts/gate.mjs check G6
node scripts/gate.mjs approve G6 --note "epic plan approved"
```

---

## Requirements

- Node.js 18+
- A coding agent that reads `AGENTS.md` (Claude Code, Cursor, Codex, Gemini, OpenCode)
- Optional: a GitHub account for issue mirroring
- Optional: [codegraph](https://codegraph.dev) for faster code lookups in implement-epic

---

## Skills reference

| Skill | Gate | What it produces |
|-------|------|-----------------|
| `define-brief` | G1 | `docs/product/00-brief.md` |
| `validate-assumption` | G1.5 | `docs/product/00b-validation.md` |
| `bootstrap-project` | — | Doc tree, scripts, contract, operating manuals |
| `adopt-project` | G5 | Same as bootstrap but for an existing repo |
| `define-product` | G2 | `docs/product/` (PRD with `REQ-xx` ids) |
| `define-design` | G3 | `docs/design/` (tokens, primitives, mockups) |
| `define-architecture` | G4 | `docs/architecture/` (ADRs, data model, API, threat model) |
| `define-backlog` | G5 | `docs/engineering/backlog.json` |
| `define-epic` | G6 | `.throughline/epic-N/` (specs, test plan, ledger) |
| `implement-epic` | — | Code, tests, `story.verify` in contract |
| `ship-epic` | G7 | Merged PR, closed issues, refreshed dashboard |
| `release` | G8 | Changelog, version tag, deployment, announcement |
