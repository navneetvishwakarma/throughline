---
doc: screen
project: <PROJECT_NAME>
status: draft           # draft | approved
updated: <DATE>
fidelity: lo-fi          # lo-fi | hi-fi — update in place as this screen matures; don't fork a new file
req_ref: ""              # REQ-xx this screen satisfies
journey: ""              # which docs/design/journeys/*.md this screen belongs to
---

# <DOC_TITLE>

## Purpose

_What this screen lets the user do, in one sentence._

## Layout (lo-fi)

_Structural layout only — regions, key elements, information hierarchy. No visual
styling yet. Describe or embed a plain wireframe._

## Visual design (hi-fi)

_Fill in once the wireframe above is checkpointed. Apply tokens/primitives from
`docs/design/tokens.md`. Describe or embed the styled mockup._

## States

_Empty, loading, error, success — whichever apply._

## Microcopy

_Labels, CTAs, error messages, empty-state copy for this screen._

## Accessibility notes

- **Structural** (checked at wireframe stage): focus order, tab sequence, landmarks.
- **Visual** (checked at mockup stage): contrast, state indicators beyond color alone.

## Revision history

- <DATE> — created at `lo-fi`.
<!-- On checkpoint approval, append a line here before flipping fidelity to hi-fi, e.g.:
- <DATE> — wireframe checkpointed, approved to proceed to hi-fi.
This line is the only record the checkpoint happened — the automated gate checks for it. -->
