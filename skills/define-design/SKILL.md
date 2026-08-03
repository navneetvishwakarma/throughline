---
name: define-design
description: Use when the approved PRD is ready and the design tier needs to be filled — user journeys, tokens, wireframes, and mockups. Trigger phrases: "design the UI", "create the design system", "mock up the screens", "map the user journey", "fill the design tier", "run define-design". Runs in parallel with define-architecture. This is gate G3.
---

# define-design

Act as a top-0.1% world-class UX designer. Design around the user's mental model; cut cognitive load; journeys and tokens/primitives first; accessibility, empty states, and microcopy as first-class, not afterthoughts.

## Gate-in
`docs/product/06-prd.md` is `status: approved`. If it is not, stop and say so.

## Mode — seed vs. reconcile
**Seed** if `docs/design/README.md` is not `status: approved`. **Reconcile** once it is — extend the existing design system (tokens/primitives amended, not regenerated); only produce new journeys/screens for the new release's `REQ-xx`. Shipped screens are untouched unless `docs/product/retros/<release_in_flight>.md`'s UX-signals/debt section explicitly flags one for redesign — treat that the same way `define-backlog` treats "modifying a shipped feature": describe the change as new work, don't silently edit the shipped screen doc in place.

**Retrofit case (seed mode, brownfield):** if `adopt-project`'s audit flagged real UI already shipped with no design docs, seed mode here means *documenting the existing product as it is* — write journeys/screens describing what's already built and live, not hypothetical flows invented from a blank slate. Once that retrofit pass is done and `README.md` is approved, every later pass is a normal reconcile.

## Context protocol
Load `AGENTS.md` (the canonical cross-agent index) + only the product docs slices you need (personas, PRD requirements). Never pre-load the whole tree. If a codegraph index exists (`.codegraph/`), query it for any code reference; read only the spans returned.

## Do this

1. **User journeys** — grounded in `define-product`'s personas (`docs/product/03-user-personas.md`, read-only — PM owns who the user is, this skill designs for them) and the in-scope `REQ-xx`. Per epic/flow, write `docs/design/journeys/<slug>.md`: entry point, key screens/decisions, completion. Do this *before* tokens — structure settles before visual investment. Reconcile: only new journeys for the new release's REQs; shipped journeys untouched.
2. **Tokens / design system** — define color, typography, spacing, radius, elevation, and motion in `docs/design/tokens.md`. Seed: draw from the user's brand/aesthetic preferences if any, default to a clean accessible baseline. Reconcile: amend in place, never regenerate.
3. **Component primitives** — build only what the journeys' screens require. Defer everything else; list what's deferred so scope stays explicit.
4. **Low-fidelity wireframes** — one per key screen from step 1, in `docs/design/screens/<slug>.md` with `fidelity: lo-fi`. Structural layout only — regions, key elements, information hierarchy. No token application yet. Run the **structural** a11y pass here: focus order, tab sequence, landmarks.
5. **Checkpoint** — present the wireframes. Get an explicit go/adjust from the human before investing in high-fidelity work. This is not a new gate (no `status:` field, not tracked in `gate.mjs`) — it's an always-executed step in this procedure, not something to assume happens implicitly. On approval, append a line to the screen doc's own **Revision history** section (e.g. "`<date> — wireframe checkpointed, approved to proceed to hi-fi`") before moving to step 6 — this is the only durable record the checkpoint happened, and the automated gate checks for it.
6. **High-fidelity mockups** — once a screen's checkpoint line is recorded, apply tokens/primitives to its doc; flip front-matter to `fidelity: hi-fi` in place (same file — don't fork a new one). Each still references the `REQ-xx` it satisfies. Run the **visual** a11y pass here: contrast, state indicators beyond color alone (WCAG AA minimum). Fix every flagged issue before presenting.
7. **Microcopy + empty states** — write labels, CTAs, error messages, and empty states for those screens.

Supporting lenses: PM (scope — only what the first screens need), Developer (flag anything technically infeasible so you can resolve before G3, not after).

## Outputs
`docs/design/` — `README.md` (tier index), `tokens.md`, `journeys/*.md`, `screens/*.md` (wireframe → mockup, same file), microcopy notes. Nothing outside the in-scope requirements.

## Automated gate
Before presenting for G3: structural + visual a11y self-review pass; tokens file present; every journey maps to at least one `REQ-xx`; every screen maps to a journey step and a `REQ-xx`; every screen at `fidelity: hi-fi` has a checkpoint line in its Revision history (the durable proof step 5 ran before step 6).

## Gate (G3)
Present the journeys, wireframes (already checkpointed), and mockups. Ask the user to approve. On approval set `docs/design/README.md` `status: approved`. Surface any UX vs developer-feasibility conflict here rather than resolving it silently.

## Done when
Journeys + tokens + first-screen primitives + wireframes + mockups exist; a11y clean (structural and visual); G3 approved.

## Notes
Reuse `design:design-system`, `design:ux-copy`, `design:design-critique`, `design:accessibility-review` if available. If not installed, perform each step directly from this spec. Scope creep into screens beyond the first epics/current release is a failure mode — stop and defer.
