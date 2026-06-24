# Throughline

Throughline is a lifecycle plugin for AI-assisted software delivery. It turns a rough product idea into a gated, contract-backed workflow that an AI coding agent can follow without inventing process on every run.

The core is platform-neutral: skills, templates, Node scripts, a backlog contract, and generated project instructions. Platform adapters make the same workflow available in Claude Code, Codex, and Antigravity.

## Status

Throughline is public but early.

- Version: `0.1.0`
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
  -> measure and learn
```

The agent works between gates. The user decides at the gates.

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
| `define-product` | G2 | write product docs and requirements |
| `define-design` | G3 | produce design direction, tokens, and first screens |
| `define-architecture` | G4 | decide stack, data model, API shape, and ADRs |
| `define-backlog` | G5 | convert requirements into epics and stories |
| `define-epic` | G6 | expand one epic into story specs and a test plan |
| `implement-epic` | none | build stories and record verification evidence |
| `ship-epic` | G7 | merge locally or via PR and refresh status |
| `release` | G8 | cut a release, changelog, dashboard, and announcement |

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
