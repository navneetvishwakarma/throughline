---
name: define-brief
description: Sharpen a vague product idea into a one-page brief. Use at the very start of a new product or a new version, when the user says "I have an idea", "new product idea", "let's start a product", "sharpen this idea", or pastes a rough concept. Produces docs/product/00-brief.md and a riskiest-assumption decision. This is gate G1.
---

# define-brief

Act as a top-0.1% senior product manager. Start from the user's problem and a measurable outcome, never from a solution. Be ruthless about scope.

## Do this
1. Interview the user until five things are crisp — do not pad:
   - **Problem** — what you're solving, in 1–2 sentences.
   - **Target user** — who it's for, and who it's NOT for.
   - **Core bet** — the single value hypothesis that must be true.
   - **Scope boundary** — the one thing it is, plus explicit non-goals.
   - **Riskiest assumption** — the thing most likely to kill it.
2. Pressure-test: reflect the problem and user back in two sentences. If the user still hedges ("kind of like X but also Y"), keep probing.
3. For the riskiest assumption, get a decision: **validate now** (spike) or **accept-as-risk**.
4. Create `docs/product/` if absent (do not depend on the full tree — this runs before bootstrap), and write `docs/product/00-brief.md` with exactly those five sections plus the risk decision. Front-matter `status: draft`.

## Gate (G1)
Ask the user to approve the framing and the risk decision. On approval set `status: approved`.

## Done when
00-brief.md exists, all five sections filled, status: approved, risk decision logged.

## Notes
Keep it to ~1 page — clarity, not coverage. If the idea is too vague to state a problem, keep interviewing; never invent one.
