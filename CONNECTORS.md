# Connectors

Throughline is tool-agnostic. Everything works with no external connector at all.

| Category | Placeholder | Options | Required? |
|----------|-------------|---------|-----------|
| Issue tracker | `~~tracker` | GitHub, GitLab, Linear, Jira | No — default is `local` (offline) |
| Code index | codegraph | codegraph (Claude/Cursor/Codex/Gemini/OpenCode) | No — optional; speeds up code lookups |
| CI | `~~ci` | GitHub Actions, GitLab CI, etc. | No — enables real `verify.ci` |

In `local` mode the backlog IS the tracker: stories are the work items, status is set by the skills, and the dashboard links to the PRD/backlog instead of issues.
