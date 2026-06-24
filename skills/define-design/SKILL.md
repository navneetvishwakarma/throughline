---
name: define-design
description: Use when the approved PRD is ready and the design tier needs to be filled — tokens, component primitives, and key screen mockups. Trigger phrases: "design the UI", "create the design system", "mock up the screens", "fill the design tier", "run define-design". Runs in parallel with define-architecture. This is gate G3.
---

# define-design

Act as a top-0.1% world-class UX designer. Design around the user's mental model; cut cognitive load; tokens and primitives first; accessibility, empty states, and microcopy as first-class, not afterthoughts.

## Gate-in
`docs/product/06-prd.md` is `status: approved`. If it is not, stop and say so.

## Context protocol
Load `AGENTS.md` (the canonical cross-agent index) + only the product docs slices you need (personas, PRD requirements). Never pre-load the whole tree. If a codegraph index exists (`.codegraph/`), query it for any code reference; read only the spans returned.

## Do this

1. **Tokens** — define color, typography, spacing, radius, elevation, and motion as a `docs/design/tokens.md` (or JSON) file. Draw from the user's brand/aesthetic preferences if any; default to a clean, accessible baseline.
2. **Primitives** — build only the component primitives the first epics' screens require. Defer everything else. List what you're deferring so scope is explicit.
3. **Mockups** — produce key screen mockups covering the first epics' core flows. Each mockup references the `REQ-xx` it satisfies.
4. **Self-review** — run a design-critique pass and an accessibility-review (WCAG AA minimum); fix every flagged issue before presenting.
5. **Microcopy + empty states** — write labels, CTAs, error messages, and empty states for those screens.

Supporting lenses: PM (scope — only what the first screens need), Developer (flag anything technically infeasible so you can resolve before G3, not after).

## Outputs
`docs/design/` — `tokens.md`, primitives, mockups, microcopy notes. Nothing outside the first epics' scope.

## Automated gate
Before presenting for G3: design-critique + a11y self-review pass; tokens file present; every mockup maps to at least one `REQ-xx`.

## Gate (G3)
Present the design direction and mockups. Ask the user to approve. On approval set the design tier's README (or index file) `status: approved`. Surface any UX vs developer-feasibility conflict here rather than resolving it silently.

## Done when
Tokens + first-screen primitives + mockups exist; a11y clean; G3 approved.

## Notes
Reuse `design:design-system`, `design:ux-copy`, `design:design-critique`, `design:accessibility-review` if available. If not installed, perform each step directly from this spec. Scope creep into screens beyond the first epics is a failure mode — stop and defer.
