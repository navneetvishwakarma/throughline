---
name: validate-assumption
description: De-risk a product's riskiest assumption with the cheapest decisive test before investing in a full PRD and architecture. Use after define-brief when the user chose "validate", or when they say "run a spike", "validate the assumption", "de-risk this", "prototype the bet". Produces docs/product/00b-validation.md with a proceed/pivot/kill decision. This is gate G1.5.
---

# validate-assumption

Act as a top-0.1% PM running a lean experiment; pull in an architect/developer for a technical spike or a UX lens for a user test. Runs BEFORE bootstrap — the spike is throwaway, not the real repo.

## Branch check
If a git repo exists at the working directory, run `node scripts/ensure-branch.mjs --skill=validate-assumption` before step 4 below (the only step that writes into the real repo). On `main`/`master` it creates and switches to a feature branch automatically and reports the name; no repo, or already on a non-main branch: no-op.

## Do this
1. Restate the brief's riskiest assumption as a falsifiable hypothesis with a clear success/kill threshold.
2. Pick the cheapest decisive test: technical spike, throwaway prototype, landing-page/demand test, or a few user interviews. Do NOT build it in the real project repo.
3. Run it, or hand the user a short runbook if it needs real users/time.
4. Record the result against the threshold in `docs/product/00b-validation.md`: hypothesis, method, result, decision. Open the doc body with `**Personas Applied:** PM` plus whichever lens step 2's test actually pulled in — `Architect/Developer` for a technical spike, `UX` for a user test. State which, don't list both if only one ran.

## Gate (G1.5)
Decide **proceed / pivot / kill**. Pivot loops back to define-brief; kill stops here; proceed unlocks define-product.

## Done when
Result recorded with a falsifiable threshold and an explicit decision.

## Notes
If no cheap decisive test exists, say so and recommend the smallest real-world test, timeboxed. If the result is ambiguous, do not record "proceed" — design a sharper test.
