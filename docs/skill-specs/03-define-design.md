---
skill-spec: define-design
type: new
status: draft (review → skill-creator)
updated: 2026-06-16
---

# define-design — skill spec

## Description
Produce the design tier — user journeys, tokens, the component primitives the first
screens need, low-fidelity wireframes, and high-fidelity mockups — grounded in the
approved product docs. Trigger with "design the UI", "create the design system",
"mock up the screens", "map the user journey", "fill the design tier". Runs in
parallel with define-architecture. First cycle = journeys + tokens + a few
primitives + wireframes/mockups for the first epics; reconcile mode extends it.

## Context (token protocol)
Follow the README *Context & token protocol*. Load `AGENTS.md` + only the slice needed — never whole docs or source trees. **If a codegraph index is present (`.codegraph/`), query it for any code lookup and read only the spans returned.** Don't re-read what `backlog.json` or an upstream artifact already carries.

## Persona(s)
- **Lead: UX** — design around the user's mental model; cut cognitive load; tokens/primitives first; a11y, motion, empty states, microcopy as first-class.
- **Supporting: PM** (scope — only what the first screens need), **Developer** (feasibility of the proposed UI).

## Reuse
- `design:design-system`, `design:ux-copy`, then `design:design-critique` + `design:accessibility-review` as self-review. `anthropic-skills:canvas-design` / `theme-factory` / `web-artifacts-builder` for tokens, visuals, interactive mockups; `brand-guidelines` for visual identity.
- Public add-on (optional): miro › miro-diagram (now optional polish for journeys — the journey step itself is a first-party deliverable, not gated on this add-on).

## Inputs
- `docs/product/*` (vision, personas, PRD); the user's brand/aesthetic preferences if any; for reconcile, `docs/product/retros/<release_in_flight>.md`'s UX-signals/debt section.

## Gate-in
- PRD is `status: approved` (design serves approved requirements).

## Mode — seed vs. reconcile
- **Seed:** `docs/design/README.md` is not `status: approved`.
- **Reconcile:** it is — extend the design system (tokens/primitives amended in place); only new journeys/screens for the new release's requirements. A retro-flagged UX-debt item on a shipped screen is handled as new work, mirroring `define-backlog`'s "modifying a shipped feature" rule — never silently edit the shipped screen doc.
- **Retrofit (seed, brownfield):** if `adopt-project`'s audit flagged real UI already shipped with no design docs, this seed pass documents the existing product as built, not hypothetical flows. Once approved, later passes are normal reconciles.

## Procedure
1. Write user journeys (`docs/design/journeys/*.md`) grounded in personas + in-scope `REQ-xx`, before tokens — structure settles before visual investment.
2. Define/amend design tokens (color, type, spacing, radius, elevation, motion) in `docs/design/tokens.md`.
3. Build only the primitives the journeys' screens require; defer the rest.
4. Low-fidelity wireframes per key screen (`docs/design/screens/*.md`, `fidelity: lo-fi`) — structural layout only. Run the structural a11y pass (focus order, tab sequence, landmarks).
5. **Checkpoint:** present wireframes; get explicit go/adjust before hi-fi. Not a new gate — an always-executed procedure step. On approval, append a line to the screen doc's Revision history (e.g. "checkpointed, approved to proceed to hi-fi") — the only durable record the checkpoint happened.
6. High-fidelity mockups: apply tokens/primitives to each checkpointed screen, flip its front-matter to `fidelity: hi-fi` in place (same file, not a new one). Run the visual a11y pass (contrast, state indicators beyond color, WCAG AA).
7. Write microcopy / empty states for those screens.

## Outputs
- `docs/design/` — `README.md`, `tokens.md`, `journeys/*.md`, `screens/*.md` (wireframe → mockup in one file), ux-copy. Design tier only.

## Automated gate
- Structural + visual a11y pass (WCAG AA); tokens file present; every journey maps to a `REQ-xx`; every screen maps to a journey step and a `REQ-xx`; every `hi-fi` screen has a checkpoint line in its Revision history.

## Human gate — G3
- User approves the journeys / wireframes (already checkpointed) / mockups. On approval, `docs/design/README.md` → `status: approved`.

## Definition of Done
- Journeys + tokens + first-screen primitives + wireframes + mockups exist; a11y clean (structural + visual); design approved.

## Failure modes
- Scope creep into screens beyond the first epics/current release → stop, defer.
- A11y failures unresolved (either pass) → do not mark done.
- UX vs developer-feasibility conflict → surface at G3.
- Skipping the wireframe checkpoint and going straight to hi-fi → redo; the checkpoint exists precisely to avoid wasted visual-polish work.
