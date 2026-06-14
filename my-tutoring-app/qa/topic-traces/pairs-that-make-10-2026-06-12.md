# Topic Trace: "pairs that make 10" (Grade 1) — 2026-06-12

Scope intended by the topic: Grade-1 **part-whole relationships within 10**, with 10 as the anchor/destination. The session builds make-10 mastery — this is a *band + destination*, NOT a rule that every instance must literally total 10. A within-primitive difficulty ladder that approaches 10 through smaller wholes (or uses the inverse subtraction facts of 10) is legitimate scaffolding, not scope drift. A real drop would be a number **>10** or an off-domain concept (place value, multiplication) — neither occurred.

Manifest resolved 9 components across 3 objectives (identify / explain / apply). Curator brief + manifest kept scope at every layer. **0 scope drops** — everything stays ≤10 and inside the part-whole-of-10 family.

## Components

| Component | Eval mode | In scope? | Notes |
|-----------|-----------|-----------|-------|
| ten-frame | make_ten | ✓ | make-10 builder |
| number-bond | decompose | ✓ | ladders 6→8→9→10→10 — scaffolds decomposition toward the target |
| math-fact-fluency | match | ✓ | make-10 pairs + inverse facts (10−2, 10−9) = same fact family |
| deep-dive | explain | ✓ | explainer prose |
| strategy-picker | compare | ✓ scope / ⚠ correctness | numbers in band, but see note below |
| addition-subtraction-scene | solve_story | ✓ | 6+4, 5+5, 2+8, 10−3 — all part-whole of 10 |
| equation-builder | missing-operand | ✓ | all anchored to 10 |
| fast-fact | recall | ✓ | make-10 pairs + inverse facts |
| knowledge-check | mixed | ✓ | mixed-mode assessment |

## One correctness question (not scope) — strategy-picker

This is *not* a number-range issue (all values ≤10, in band). It's an instruction-coherence question worth a look:

- ch1 (guided-strategy) teaches the **make-ten strategy** on **4+4**, with the instruction "break apart one of your fours to help turn the other four into a ten." You can't turn 4 into 10 with the parts of another 4 — the make-ten bridging strategy applies to sums that *cross* 10 (e.g. 8+5 → 8+2+3 = 10+3). ch3 then asserts "4+4 solved via doubles AND make-ten."
- So the concern isn't *which numbers* (4+4, 3+6 are fine Grade-1 sums); it's that the **strategy label is mathematically inapplicable** to those sums. If intended, fine; if the generator is stamping "make-ten" onto any addition problem, that's a generator-correctness nit, not scope.
- **Fix target (if confirmed):** `gemini-strategy-picker.ts` — ensure make-ten instances use sums that actually bridge 10.

## Takeaway

For a fixed-destination topic like make-10, do **not** flag a within-primitive difficulty ladder (smaller wholes, inverse facts) as scope drift. Scope = number band + concept domain; difficulty laddering across that band is the desired behavior, not a leak. The only residual here is a possible strategy/number mismatch in strategy-picker — a correctness question, not a scope one.
