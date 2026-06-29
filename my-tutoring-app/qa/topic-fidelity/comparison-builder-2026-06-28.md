# Topic Fidelity: comparison-builder — 2026-06-28

Scope/theme intended: the LLM's chosen numbers/group-counts track the per-component
intent's scope, within the grade band (K = 1–10, Grade 1 = 1–20; grade is the CEILING).

## Background — why it was misclassified

The 2026-06-27 MATH_TRIAGE put comparison-builder in the **"DEAD-FIELD, code-picked /
na scope — theme-flavor only, low payoff"** bucket (line 46), under the blanket note
"the LLM only authors title/description." That is **false** for this generator: the LLM
authors every student-facing number (`leftNumber`, `rightNumber`, group `count`s, the
`order` `numbers[]`, `targetNumber`). Code only (a) clamps each to the grade band's
`maxNumber` and (b) **recomputes** the correct answer (`correctSymbol` / `correctAnswer`)
from whatever numbers the LLM picked. So the values ARE LLM-authored — feeding intent
into the prompt is a genuine Tier-1 scope lever, not theme flavor.

`intent` reached the generator (resolver maps `config.intent → ctx.intent`) but the
prompt only interpolated `topic` — a classic **dead field**.

## Probes (intent-discrimination: broad topic FIXED, intent VARIED)

mode `compare_numbers`, grade 1 (band 1–20), topic held at "Comparing numbers":

| Probe | intent | numbers produced | verdict |
|-------|--------|------------------|---------|
| A teen-focus     | "Compare teen numbers between 11 and 20" | (11,15)(18,12)(14,14)(19,16)(13,20) — all 11–20 | HONORED |
| B small-focus    | "Compare small numbers from 1 to 5"      | (1,2)(3,1)(2,2)(4,5)(5,3) — all 1–5             | tracks  |
| C no-regression  | "Practice comparing numbers" (generic)   | 2–20 spread across the full band               | grade default |

Before the fix the same three intents produced statistically identical full-band spreads
(the prompt never saw intent). After: A collapses to the teens, B to ≤5, C stays varied.

**Verdict:** FIDELITY BUG (dead field) → fixed at **Tier 1**.
**Mechanism:** LLM-authored values + intent never interpolated into the prompt.
**Change:** `gemini-comparison-builder.ts` — read `ctx.intent` (`const intent = ctx.intent || topic`)
+ a "THIS ACTIVITY'S SPECIFIC FOCUS: ${intent}" prompt block with grade-ceiling + no-answer-leak
guardrail. Schema unchanged; the existing clamp + answer-recompute keep the ceiling and
correctness safe regardless of what the LLM picks. | tsc: 1417 (no new errors).

## Lesson for the re-sweep

The triage bucketed by "does code touch the value?" — wrong axis. comparison-builder's code
touches the value (clamp + answer recompute) but does NOT *originate* it. The correct
discriminator is **"is code-picking required for CORRECTNESS?"**:
- value originated by the LLM, code only clamps/derives-answer → **Tier-1 wire** (this case).
- value originated by code for arithmetic correctness (derived MC distractors, e.g.
  place-value) → intent legitimately theme-only.
- value originated by code for *entropy/convergence* only (e.g. array-grid dims) → Tier-2
  scoped resolver, NOT "low payoff."
