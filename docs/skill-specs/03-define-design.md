---
skill-spec: define-design
type: new
status: draft (review → skill-creator)
updated: 2026-06-16
---

# define-design — skill spec

## Description
Produce the design tier — tokens, the component primitives the first screens need,
and key mockups — grounded in the approved product docs. Trigger with "design the
UI", "create the design system", "mock up the screens", "fill the design tier".
Runs in parallel with define-architecture. First cycle = tokens + a few primitives;
grow later.

## Context (token protocol)
Follow the README *Context & token protocol*. Load `AGENTS.md` + only the slice needed — never whole docs or source trees. **If a codegraph index is present (`.codegraph/`), query it for any code lookup and read only the spans returned.** Don't re-read what `backlog.json` or an upstream artifact already carries.

## Persona(s)
- **Lead: UX** — design around the user's mental model; cut cognitive load; tokens/primitives first; a11y, motion, empty states, microcopy as first-class.
- **Supporting: PM** (scope — only what the first screens need), **Developer** (feasibility of the proposed UI).

## Reuse
- `design:design-system`, `design:ux-copy`, then `design:design-critique` + `design:accessibility-review` as self-review. `anthropic-skills:canvas-design` / `theme-factory` / `web-artifacts-builder` for tokens, visuals, interactive mockups; `brand-guidelines` for visual identity.
- Public add-on (optional): miro › miro-diagram for flows.

## Inputs
- `docs/product/*` (vision, personas, PRD); the user's brand/aesthetic preferences if any.

## Gate-in
- PRD is `status: approved` (design serves approved requirements).

## Procedure
1. Define design tokens (color, type, spacing, radius, elevation, motion).
2. Build only the primitives the first screens require; defer the rest.
3. Produce key screen mockups for the first epics' flows.
4. Self-review: run design-critique + accessibility-review; fix flagged issues.
5. Write microcopy / empty states for those screens.

## Outputs
- `docs/design/` — tokens, the needed primitives, mockups, ux-copy. Design tier only.

## Automated gate
- design-critique + accessibility-review pass (WCAG AA); tokens file present; each mockup maps to a PRD requirement.

## Human gate — G3
- User approves the design direction / mockups.

## Definition of Done
- Tokens + first-screen primitives + mockups exist; a11y clean; design approved.

## Failure modes
- Scope creep into screens beyond the first epics → stop, defer.
- A11y failures unresolved → do not mark done.
- UX vs developer-feasibility conflict → surface at G3.
