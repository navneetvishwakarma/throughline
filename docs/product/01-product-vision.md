---
doc: Product Vision
project: Throughline
status: approved
updated: 2026-08-12
---

# Product Vision

> A green gate in throughline should mean what it says.

## Context

Throughline exists to let a solo developer run AI-assisted development on a fixed, mechanically-enforced contract (backlog, gates, coverage, CI) instead of ad hoc process. That only works if the enforcement is actually trustworthy — a gate that can be silently satisfied by malformed config or a suppressed CI failure is worse than no gate, because it produces false confidence.

## Details

0.3.2 is a truthfulness pass on the existing coverage-gate and CI-scaffold machinery, not a new capability: reject malformed coverage config instead of silently disabling it, support the multi-workspace monorepo shape real projects actually have, stop the generated CI workflow from swallowing its own failures, stop the dashboard from inventing progress data, and stop branch protection from being bypassable via a flag.

## Open questions

- [ ] None open for this release — scope is fixed to the six defects enumerated in `00-brief.md`.
