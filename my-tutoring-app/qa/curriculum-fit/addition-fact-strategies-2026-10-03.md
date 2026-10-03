# Curriculum-Fit: addition-fact-strategies — 2026-10-03

Scope: MATHEMATICS Grades 1 and 2, live published curriculum (backend :8000). This is a
primitive-side review only. The coverage atlas has no G1/G2 scope (`la-k`, `math-k` only), so
these edges are not in `qa/curriculum-coverage/index.html`; a `math-1`/`math-2` scope is its own
review. Generated sessions: [preview HTML](addition-fact-strategies-2026-10-03.html), raw draws
[JSON](addition-fact-strategies-2026-10-03.json).

## Retrieval (production matcher, `curriculum_fit_probe.py`)

Input regime: verbatim catalog description, no challenge text. `--eval-mode` changed no top-1.

| Grade | Verdict | Best cosine | Coherence | Top-1 |
|---|---|---|---|---|
| 1 | MATCH | 0.807 | 5/5 | OPS001-03-a (count on from the larger addend on a number line, addends to 15) |
| 2 | MATCH | 0.820 | 5/5 | OPS002-04-a (automaticity with addition facts, sums to 20) |

G2 top-1 is the right home. G1 top-1 is a near miss: OPS001-03-a asks for number-line counting
on with teen addends, which this primitive does not do. G1 has no "recall facts by strategy
(doubles, +0, +1)" subskill; its strategy skill OPS001-03 is count on, make ten and
decompose. The mode-specific homes below sit in PTRN001-05 and OPS001-09.

## Reviewed edges

Generation regime: topic = skill title, intent = skill title, objectiveText = verbatim
subskill, no pin (the intent resolver picks the mode). Two real Gemini draws each.

| Requirement | Mode resolved | Verdict | Reason / unmet action |
|---|---|---|---|
| G2 OPS002-04-a "Develop automaticity with addition facts for sums up to 20 … focus on doubles and near-doubles" | doubles + big_facts → facts_mixed ×2 | **Direct (partial on focus)** | Big-fact recall within 20, untimed by design (response time measured silently). One family per session, so a session never mixes doubles with near doubles, and there is no near-doubles family. |
| G1 OPS001-01-c "recalling addition facts with sums up to 10" | mixed → facts_mixed ×2 | **Partial, FIXED this slice** | Before: 18/20 facts summed over 10 (to 17). The generator now reads the objective's sum window (`resolveObjectiveNumberWindow`) and keeps facts and families inside it. After: 20/20 facts ≤ 10. `math-fact-fluency` remains the better home (timed-free recall within 10 is its core). |
| G1 OPS001-09-a "Demonstrate the commutative property … 3+5 and 5+3 result in the same sum" | turnaround ×2 | **Partial** | The child applies the flip (known-fact card after a miss) but never shows both orders are equal. |
| G1 PTRN001-05-a "pattern when adding 1 to consecutive numbers … vertical column" | plus_one ×2 | **Partial** | +1 recall is right; facts are shuffled, so the consecutive pattern is not visible. |
| G1 PTRN001-05-c "identity property … +0 rule … every input produces the same output" | plus_zero ×2 | **Partial** | +0 recall is right; no experiment-then-state-the-rule step. |
| G1 PTRN001-05-b "doubles and doubles-plus-one … related fact pairs" | plus_one + doubles → plus_one ×2 | **Gap** | Neither draw had a double. No near-doubles family exists, so the pair (n+n, n+n+1) is never asked. |
| G1 OPS001-03-a "counting on from the larger addend on a number line" (retrieval top-1) | plus_two ×2 | **Not a home** | Only +2, single-digit, no number line, no teen addends. Retrieval misattribution risk for G1 submissions. |

## Development

- **Near-doubles family** (PTRN001-05-b, OPS002-04-a focus): a `near_doubles` mode
  (n + (n+1), both orders) whose help shows the double it comes from. Needs a component help
  state, not only a pool. Executor: `/add-eval-modes`, then `/add-support-tiers` for the
  "start from the double" lever already listed in the birth queue.
- **G1 curriculum**: no 1.OA.C.6 subskill for strategy recall (doubles, near doubles, +0/+1/+2
  as known facts). Curriculum change, separate decision: `/curriculum-author`.
