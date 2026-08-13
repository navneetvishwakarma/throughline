# Throughline

Throughline is a lifecycle plugin for AI-assisted software delivery. It turns a rough product idea into a gated, contract-backed workflow that an AI coding agent can follow without inventing process on every run.

The core is platform-neutral: skills, templates, Node scripts, a backlog contract, and generated project instructions. Platform adapters make the same workflow available in Claude Code, Codex, and Antigravity.

## Status

Throughline is public but early.

- Version: `0.3.2`
- Install mode: source checkout
- Published package: not yet
- Field status: core workflow and bootstrap are implemented; the epic, ship, release, and brownfield flows are written and still need wider field use

Use it when you want a structured solo-founder or solo-developer build loop. Do not use it if you only want a small prompt pack or a general coding assistant.

## What It Does

Throughline gives the agent a fixed operating system for product work:

- captures the product brief before implementation starts
- turns requirements into a validated `docs/engineering/backlog.json`
- gates product, design, architecture, backlog, epic planning, merge, and release decisions
- keeps local mode fully offline by default
- optionally mirrors work to GitHub issues
- generates dashboard data from structured files, not from agent memory
- measures code coverage with each stack's own standard tool (Vitest/Jest/`c8`, `coverage.py`, `go test`, JaCoCo, `cargo-llvm-cov`) and gates on it at implement and ship time — auto-detected, never hand-typed
- stores working state under `.throughline/`

The point is simple: the agent can work between gates, but the human still owns the gates.

## Supported Platforms

| Platform | Support level | Install path |
|----------|---------------|--------------|
| Claude Code | First-class adapter | `adapters/claude/.claude-plugin/` |
| Codex | First-class adapter | `.codex-plugin/`, `.agents/plugins/marketplace.json`, `adapters/codex/` |
| Antigravity | Skills-folder install | namespaced skills copied to `~/.agents/skills/` |
| Other agents | Core workflow only | any agent that reads `AGENTS.md` can follow the generated project instructions |

Optional integrations:

- GitHub for issue mirroring
- codegraph for faster code lookup
- Superpowers for planning, TDD, subagent execution, and debugging accelerators
- CI for real `verify.ci` evidence

None of those integrations are required for local operation.

## Install From Source

Requirements:

- Node.js 18+
- Git
- Claude Code, Codex, Antigravity, or another coding agent that can read project instructions

Clone the repository:

```bash
git clone https://github.com/navneetvishwakarma/throughline.git
cd throughline
```

Install for Claude Code:

```powershell
# Windows
./install.ps1 -Platform claude
```

```bash
# macOS / Linux
chmod +x install.sh
./install.sh claude
```

Install for Codex:

```powershell
# Windows
./install.ps1 -Platform codex
```

```bash
# macOS / Linux
chmod +x install.sh
./install.sh codex
```

Codex install copies the plugin to `~/plugins/throughline` and updates `~/.agents/plugins/marketplace.json`.

Install for Antigravity:

```powershell
# Windows
./install.ps1 -Platform antigravity
```

```bash
# macOS / Linux
chmod +x install.sh
./install.sh antigravity
```

Antigravity support uses skills-folder installation until Antigravity exposes a richer plugin marketplace format.

Restart the target AI tool after installation.

Update:

```bash
git pull
./install.sh codex
```

Use the platform you installed: `claude`, `codex`, or `antigravity`.

Uninstall:

```powershell
./install.ps1 -Platform codex -Uninstall
```

```bash
./install.sh codex --uninstall
```

## Quick Start

In a product repository, ask your agent to run the workflow:

```text
Use Throughline to define this product idea: <your idea>
```

For a new repository:

```text
Run bootstrap-project for this repo.
```

For an existing repository:

```text
Run adopt-project for this repo.
```

The bootstrap flow creates:

- `AGENTS.md` as the canonical cross-agent operating manual
- `CLAUDE.md` and `GEMINI.md` as thin platform pointers
- `docs/product/`, `docs/design/`, `docs/architecture/`, and `docs/engineering/`
- `docs/engineering/backlog.json`
- validation, gate, sync, and dashboard scripts
- `.throughline/gates.json` and epic working state as the workflow progresses

## Core Workflow

Throughline uses a gated lifecycle:

```text
idea
  -> define-brief              G1: framing and risk decision
  -> validate-assumption       G1.5: optional proceed, pivot, or kill
  -> bootstrap/adopt project
  -> define-product            G2: PRD approved
  -> define-design             G3: design approved
  -> define-architecture       G4: architecture and security approved
  -> define-backlog            G5: backlog approved
  -> define-epic               G6: epic plan approved
  -> implement-epic
  -> ship-epic                 G7: PR or local merge approved
  -> release                   G8: release go/no-go
  -> measure-learn             G9: proceed, pivot, or kill (waits for real usage data)
  -> loop back to define-brief, in reconcile mode, for v2+
```

The agent works between gates. The user decides at the gates.

## Multiple Releases (v2 and Beyond)

A product is never re-scaffolded for its next release. `define-product`, `define-architecture`, `define-backlog`, and (see below) `define-design` each detect whether they're seeding fresh or reconciling an already-approved doc, and amend in place rather than regenerating:

- `define-product` reconciles once its own `06-prd.md` is already `approved` — new requirements get a new `REQ-xx` (never a renumber), tagged to the new release. (Deliberately independent of `backlog.json`, so a brownfield repo brought on via `adopt-project` — which populates `epics[]` without ever running `define-product` — can't land it in the wrong mode.)
- `define-architecture` reconciles once the architecture overview is already approved — this is a real **architecture review**: each new requirement is classified as fits-unchanged, an additive extension (amend in place), or a breaking/structural revision (new ADR, never edit an accepted one; emits a migration story for the backlog).
- `define-design` reconciles once its own design tier README is already approved — extends the existing design system rather than redesigning it (see [UI/UX](#uiux) below).
- `define-backlog` reconciles once any epic/story carries a tracker issue — append-only, `release: v2` epics, shipped work untouched. In the same write, it advances `backlog.json`'s `release_in_flight` to the new release tag — deliberately not `define-product`'s job, since that would leave the field pointing at a release with no matching epic yet while `define-architecture`/`define-design` run in between, and both validate `backlog.json` as part of their own gates.
- `measure-learn` (G9) closes the loop: once a release has real usage data, it writes `docs/product/retros/<release>.md` (metrics, ops health, UX debt, and a proceed/pivot/kill decision) that the next `define-brief` reads before starting a new cycle, resolving `<release>` from `release_in_flight` — the one field naming which release is currently being worked, so no skill has to infer it.

The dashboard follows the same focus: its headline verdict and work board are scoped to `release_in_flight` only. Shipped releases (100% done) and upcoming ones collapse into a reference-if-needed `<details>` block each — a v1 that's fully done doesn't compete for attention with the v2 work actually happening now, but its epics are one click away, not gone. Below the current-release focus, a Planning section renders the gate pipeline (`.throughline/gates.json`) and a roadmap across all releases, grouped by phase when `backlog.json` declares `phases[]`.

## Keeping a Project in Sync

`bootstrap-project`/`adopt-project` run once and copy a snapshot of the plugin's scaffold (`scripts/*.mjs`, `docs/engineering/workflow.md`, `docs/_templates/*`, hooks, `AGENTS.md`) into the project. That snapshot doesn't update itself — a project bootstrapped before a plugin release gained the coverage tooling, the design tier, or `measure-learn` stays frozen at its old version until something explicitly brings it forward.

`.github/workflows/throughline.yml` is the one exception to "snapshot copy": it's seed-only, project-owned scaffold, not a managed file. `sync-plugin.mjs` renders it once from whichever lockfile the project has (`pnpm-lock.yaml`/`package-lock.json`/`yarn.lock`) — never a byte-for-byte copy — and once it exists it's never overwritten and never shows up as needs-review, even if hand-edited. A later sync still reports whether it matches the current render (up to date / differs), just never touches it. A repo with no `package.json` yet defers seeding rather than baking in a workflow with no install step.

`upgrade-project` is that something. It reads the currently installed plugin, classifies every platform-owned file in the project as added (new capability the project never had), unchanged, or needs-review (differs — could be normal drift or a deliberate local edit, never assumed), and applies the safe part automatically:

```bash
node scripts/sync-plugin.mjs                  # report only, writes nothing
node scripts/sync-plugin.mjs --apply          # write files the project is missing
node scripts/sync-plugin.mjs --force=a,b      # after reviewing them, accept the plugin's version of just files a and b
node scripts/sync-plugin.mjs --force          # accept the plugin's version of every flagged file — only once you've reviewed all of them
```

It never touches `backlog.json`, `.throughline/` working state, or anything already written under `docs/product|architecture|design/` — those are project content, not scaffold, and `place()`'s own idempotency (reused, not reimplemented) is what guarantees that when `upgrade-project` re-runs `init-project.mjs` to materialize newly-added doc-tier files. `.throughline/plugin-version.json` (stamped at bootstrap, updated on every sync) records which plugin version a project is current with.

This is also what makes the cross-platform handoff durable over time, not just at the moment of bootstrap: a project opened in Codex today reads the same `workflow.md` a Claude Code session would, regardless of which platform originally scaffolded it or how long ago.

**Guarding against working state landing in the wrong place.** All of this assumes epic/ship ledgers and gate state actually live under `.throughline/` — but an agent can default to platform habit (writing into `.claude/` instead of following `AGENTS.md`) rather than instruction, and this has happened in practice. Two layers catch it: `node scripts/validate.mjs` (wired into the pre-commit hook, so it runs on every commit) fails loud if it finds epic/ship ledgers or `gates.json` under `.claude/`, `.cursor/`, `.vscode/`, `.gemini/`, `.codex/`, or `.antigravity/` instead of `.throughline/`; and `node scripts/sync-plugin.mjs --repair-state --apply` moves anything found back where it belongs, refusing to overwrite if something already exists at the `.throughline/` destination.

## UI/UX

`define-design` (G3) is a staged process, not a single undifferentiated "make mockups" step:

1. **User journeys** — grounded in `define-product`'s personas and the in-scope requirements; written before any visual work so screen structure follows real user steps.
2. **Tokens / design system** — color, type, spacing, radius, elevation, motion.
3. **Low-fidelity wireframes** — structural layout only, one per key screen from the journey.
4. **Checkpoint** — wireframes are presented for an explicit go/adjust before high-fidelity work starts. Not a separate gate (this workflow stays gate-light for a solo dev) — an always-executed step inside G3, whose approval is recorded as a line in the screen doc's own revision history (the durable proof it happened).
5. **High-fidelity mockups** — tokens/primitives applied to the checkpointed wireframes, same file, `fidelity` flipped from `lo-fi` to `hi-fi` in place.
6. **Accessibility**, split structural (wireframe stage: focus order, tab sequence, landmarks) and visual (mockup stage: contrast, state indicators).
7. **Microcopy + empty states.**

A story can carry `design_ref` — one path to the `docs/design/screens/*.md` it implements — which flows into `define-epic`'s acceptance criteria and `implement-epic`'s quality-gate checklist (a **Design** row: implementation compared against the approved screen). On a v2+ reconcile pass, only new journeys/screens get produced; shipped screens are redesigned only when `measure-learn`'s retro explicitly flags UX debt, never silently. For a brownfield repo adopted via `adopt-project` with real UI already shipped but no design docs, `define-design`'s first pass documents that existing product as built, not hypothetical flows — after that, every later pass is a normal reconcile.

## Local Mode

Throughline defaults to `tracker: local`.

In local mode:

- no GitHub account is required
- no network is required
- `backlog.json` is the tracker
- stories are work items
- `ship-epic` updates story status locally
- the dashboard links to local docs and contract data

To mirror work to GitHub issues, set `tracker` to `github` in `docs/engineering/backlog.json`. GitLab, Linear, and Jira appear in connector docs as future adapter targets, not current support.

## The Backlog Contract

`docs/engineering/backlog.json` is the source of truth for work.

Each story records:

- stable story id
- epic id
- linked `REQ-xx` requirement
- testable acceptance criteria
- dependency list
- status
- verification evidence

The validator enforces the contract:

```bash
node scripts/validate.mjs
```

The dashboard renders from the same data:

```bash
node scripts/build-dashboard.mjs
```

Gate state lives in:

```text
.throughline/gates.json
```

Epic planning and ship state live under:

```text
.throughline/epic-<n>/
.throughline/ship-<n>/
```

## Coverage

Coverage is auto-detected per stack and measured with each stack's own established tool — never a reinvented one:

| Stack marker | Tool |
|---|---|
| `package.json` + Vitest | `@vitest/coverage-v8` |
| `package.json` + Jest | Jest's built-in coverage |
| `package.json`, plain `node --test` | `c8` |
| `pyproject.toml` / `requirements.txt` | `coverage.py` |
| `go.mod` | `go test -coverprofile` (built into the Go toolchain) |
| `pom.xml` / `build.gradle` | JaCoCo |
| `Cargo.toml` | `cargo-llvm-cov` |

Run it manually at any time:

```bash
node scripts/coverage.mjs           # measure and report
node scripts/coverage.mjs --setup   # nudge: add the missing tool for a repo that has code but none configured
node scripts/coverage.mjs --check   # non-zero exit if below threshold (what CI and ship-epic use)
```

It also runs automatically inside `implement-epic` (writes `story.verify.coverage` from a real measured run — never hand-typed) and `ship-epic` (blocks the merge when `coverage.mode: enforce` and coverage is below threshold). The threshold and mode live in `backlog.json`'s `coverage` field (`min`, `mode: off|warn|enforce`); new projects seed `{ min: 0.7, mode: "warn" }` — measured and reported everywhere, nothing blocks until you flip `mode` to `"enforce"`. Absence of the `coverage` key means no enforcement at all, so installs that predate this feature are unaffected. An invalid `mode`, an out-of-range `min`, or an unknown `--threshold`/`--stack` fails loud with exit code 2 — never silently disabling enforcement. Each stack's own standard report (`lcov.info`, `coverage.xml`, `jacoco.xml`, the Go cover profile) is kept on disk and uploaded as a CI artifact — no external account or server required, but any platform that ingests those formats can be pointed at it later.

**Monorepos.** Single-root auto-detection (the table above) only inspects the repo root, which misses workspace-level tools in a pnpm/npm/yarn monorepo. Declare explicit `coverage.targets` instead — every target runs, and results aggregate by total covered / total measurable lines (weighted, not an unweighted average of percentages):

```json
"coverage": {
  "mode": "enforce",
  "min": 0.7,
  "targets": [
    { "id": "backend", "cwd": "apps/backend", "command": "pnpm exec vitest run --coverage --coverage.reporter=json-summary", "summary": "coverage/coverage-summary.json" },
    { "id": "mobile", "cwd": "apps/mobile", "command": "pnpm exec jest --coverage --coverageReporters=json-summary", "summary": "coverage/coverage-summary.json" }
  ]
}
```

`cwd` is relative to the repo root; `summary`/`lcov` are relative to `cwd`. Neither can resolve outside the repo. `node scripts/coverage.mjs --stack backend` runs just one target. A target whose command fails, or whose declared report never appears, fails the run closed.

## Doc-Tier Structural Checks

Every gate that used to rely on an agent eyeballing a prose checklist ("every REQ has an id + priority + acceptance", "every hi-fi screen was checkpointed") now runs `node scripts/check-docs.mjs` instead. It mechanically validates what's objectively checkable — front-matter status enums, id format and uniqueness, `REQ-xx` cross-references between the PRD and design docs, ADR `superseded-by` references pointing at ADRs that actually exist, required retro sections — and refuses to guess at anything it can't verify.

```bash
node scripts/check-docs.mjs                    # check every tier
node scripts/check-docs.mjs --tier=product      # PRD only
node scripts/check-docs.mjs --tier=design       # design tier only
node scripts/check-docs.mjs --tier=architecture # architecture tier only
node scripts/check-docs.mjs --tier=retro        # retros only
```

What it deliberately does **not** check: whether a requirement is actually testable and well-sliced, whether a mockup looks good, whether an ADR's reasoning holds up, whether a retro's decision is well-justified. Those are semantic judgment calls no dependency-free script can make — they stay exactly where they belong, exercised by the agent and confirmed at the human gate. The line is: structure and cross-references are code's job; quality is judgment's job, and neither pretends to be the other.

## Repository Layout

```text
throughline/
  .agents/plugins/marketplace.json       Codex repo-local marketplace entry
  .codex-plugin/plugin.json              Codex root manifest
  adapters/
    claude/.claude-plugin/               Claude Code adapter metadata
    codex/.codex-plugin/                 Codex adapter metadata
  skills/                                platform-neutral workflow skills
  skills/bootstrap-project/assets/        scaffold copied into user projects
  scripts/
    doctor.mjs                           repository health check
    install.mjs                          shared platform installer
    test-coverage.mjs                    real coverage across spawned child-process scripts
  skills/bootstrap-project/assets/scripts/coverage.mjs    stack-detecting coverage gate (scaffolded)
  skills/bootstrap-project/assets/scripts/check-docs.mjs  doc-tier structural checks (scaffolded)
  skills/bootstrap-project/assets/scripts/sync-plugin.mjs upgrade a project's scaffold (scaffolded)
  tests/                                 Node test suite
  CONNECTORS.md                          optional connector matrix
```

## Skills

| Skill | Gate | Purpose |
|-------|------|---------|
| `define-brief` | G1 | frame the product idea and risk decision |
| `validate-assumption` | G1.5 | run or design the cheapest decisive validation |
| `bootstrap-project` | none | initialize a new repo with Throughline rails |
| `adopt-project` | G5 | onboard an existing repo |
| `upgrade-project` | none | sync an existing project's scaffold to the currently installed plugin version |
| `define-product` | G2 | write product docs and requirements |
| `define-design` | G3 | map user journeys, then tokens, wireframes, and mockups |
| `define-architecture` | G4 | decide stack, data model, API shape, and ADRs |
| `define-backlog` | G5 | convert requirements into epics and stories |
| `define-epic` | G6 | expand one epic into story specs and a test plan |
| `implement-epic` | none | build stories and record verification evidence |
| `ship-epic` | G7 | merge locally or via PR and refresh status |
| `define-feature` | none (epic-linked mode inherits that epic's G6) | spec one story from a planned epic (lighter than expanding all of `define-epic` at once) or standalone non-epic work — grill, personas, self-review, file to GitHub only in standalone `tracker: github` mode |
| `implement-feature` | none (reviewed at ship) | build one story from a planned epic (feeds back into the epic, ships via `ship-epic`) or a standalone `define-feature` spec (feeds `ship-feature`) via TDD, quality gate, self-review |
| `ship-feature` | G7 | ship *standalone* non-epic work (hotfix, plugin/scaffold maintenance, doc-only change, or a standalone-mode `define-feature`/`implement-feature` result) — same checks as `ship-epic`, scoped by feature slug instead of epic id |
| `release` | G8 | cut a release, changelog, dashboard, and announcement |
| `measure-learn` | G9 | review metrics/ops/UX signals and decide proceed, pivot, or kill |

## Connectors

Throughline runs without external connectors. See [CONNECTORS.md](CONNECTORS.md) for the full matrix.

Current optional connectors:

- `tracker`: local by default, GitHub supported
- `codegraph`: optional code index
- `ci`: optional verification source
- `Superpowers`: optional workflow accelerators

## Verification

Verify the source checkout:

```bash
npm test
npm run doctor
```

`npm run test:coverage` runs the same suite with real coverage of every script it exercises — including `skills/bootstrap-project/assets/scripts/*.mjs`, which the tests spawn as child processes against throwaway fixture projects rather than requiring in-process (`node --test`'s own `--experimental-test-coverage` only instruments the parent process and misses those entirely). Report at `.coverage/report`; CI runs this on every PR.

Verify a platform install without writing files:

```powershell
./install.ps1 -Platform codex -DryRun
```

```bash
./install.sh codex --dry-run
```

## NPM

The package is not published yet. Source install is the supported path for now.

The intended future install path is:

```bash
npx skills add throughline
```

## Design Principles

- Structured contracts beat agent memory.
- Local mode must work offline.
- External trackers are mirrors, not sources of truth.
- Human approval gates must stay explicit.
- Skills must be useful as plain instructions even when optional accelerator plugins are absent.
- Platform adapters must stay thin. The workflow belongs in the core.

## License

MIT
