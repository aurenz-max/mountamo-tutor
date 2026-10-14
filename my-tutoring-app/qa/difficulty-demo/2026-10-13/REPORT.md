# Difficulty demo, 2026-10-13

Question (user): when we ask a generator for a harder problem, do we get one? Prompt asks for
"difficult" and the numbers seem not to move ("11-20" gives 11+1 to 13+5, never 11+9-5).

Scripts: `scripts/difficulty-demo-probe.mjs` (knowledge-check, judged blind),
`scripts/difficulty-demo-primitives.mjs` (number-line `jump`, addition-subtraction-scene
`solve_story`). Raw output: `items.json`, `tables.md`, `primitives.json`. About 280 Flash calls.

## 1. Knowledge-check, three levels, two arms, 6 items per cell

- **prompt**: today's Pulse path, target_beta -> Bloom tier (recall / apply / analyze) in the prompt.
- **struct**: tier fixed; code draws the exact expression for the level, the generator writes the item.
  L1 one step within 10; L2 one step crossing ten; L3 two steps or missing addend (15 - 8 + 4, ? + 9 = 17).

Blind judge (Gemini, no arm or level shown), mean % of typical students correct:

| Objective | Arm | L1 | L2 | L3 |
|---|---|---|---|---|
| G1 add/subtract within 20 | prompt | 90 | 74 | 57 |
| | struct | 93 | 76 | 60 |
| G3 multiply/divide within 100 | prompt | 73 | 78 | 49 |
| | struct | 90 | 82 | 73 |
| G3 animal body parts / habitat | prompt | 91 | 89 | 76 |
| | struct | 94 | 88 | 80 |

The averages hide what changed:

- **prompt, the numbers do not move.** Multiply L1: "What is 7 × 8?" 6 of 6 items. Add L1: "10 + 4",
  "10 + 5", "10 + 6", "10 + 6". Add L2: "13 take away 5" 5 of 6. Multiply L2 is judged easier than L1.
- **prompt L3 changes the task, not the problem.** Add L3 is all "why" questions ("Why does 9 + 5 have
  the same answer as 10 + 4?"); multiply L3 is all "what happens if you double the group size". These
  are harder because they ask for an explanation, not because the arithmetic is harder.
- **struct does what was asked, every time.** 36 of 36 math items kept the code's numbers. Add L3 is
  "15 - 8 + 4" (48%), "18 - 9 + 4" (55%), "? + 9 = 17" (68%); L2 is crossing ten ("6 + 9", "15 - 7").
  Items vary because code draws the numbers.
- **non-math**: a written recipe is followed loosely. Habitat L3 asked for a two-fact inference; the
  judge still put it at 80%. Code cannot draw a structure for prose the way it draws numbers.

## 2. Math primitives, objective "Add and subtract within 20, using numbers 11 to 20", config.difficulty

number-line `jump` (start -> landing per challenge, 3 runs per tier):

| Tier | Challenges |
|---|---|
| easy | 15->18, 18->20, 11->12, 18->16 · 14->16, 14->19, 15->16, 17->20 · 17->12, 13->14, 13->12, 14->18 |
| medium | 17->18, 12->13, 13->15, 16->20 · 18->19, 11->15, 15->18, 12->14 · 18->19, 14->13, 18->20, 14->18 |
| hard | two jumps: 16->13->12, 18->16->11, 15->18->19, ... |

Easy and medium are the same problem: a hop of 1-5 inside the teens, never crossing ten. Hard adds a
second jump, still with small hops.

addition-subtraction-scene `solve_story`: the schema already forces the unknown position per tier
(easy result, medium change, hard start), so the shape does change. The numbers do not: easy runs 0, 1
and 2 open with the same four problems (11+4, 15-3 or 14-3, 12+5, 18-6), medium runs all open with 12+3,
and only one run in nine crosses ten more than once.

## Conclusion

Asking in the prompt changes the label and, at the top tier, the kind of question; it does not make
the arithmetic harder, and it collapses onto one fact per tier. Where code sets the structure (the
struct arm, the scene's unknown-position enum) the problem changes as asked. The missing piece is
code-owned number structure per level: operand range, crossing ten, steps, unknown position.

Limits: the judge is Gemini rating Gemini output. The test that counts is first-try success by level
on real attempts, which attempts now record (`first_try`, P1.2).

## Queue continuation (same day): number-bond, ten-frame, equation-builder, array-grid, bar-model, three new strands

Probes per primitive under `nb/`, `tf/`, `eb/`, `ag/`, `bm/` (`before-*` and `after-*`), knowledge-check on the new
strands under `kc-new/`. Contracts updated: number-bond, ten-frame, equation-builder (array-grid and bar-model have none).

- New spaces: `bonds-10` (number bonds within 10), `add-sub-100`, `add-sub-1000` (sampled), `fraction-add-sub`,
  `round-10-100`. Resolver: 17 of 17 objectives right after two description fixes.
- Wired: number-bond missing_part / related_fact / fact_family / build_equation (bonds-10); ten-frame operate,
  equation-builder missing-result / missing-operand / true-false (add-sub-20); array-grid build / count / multiply
  (mult-div-facts). Code tier windows (no space): number-bond decompose wholes, ten-frame split and build_pair totals.
- Shared changes: `resolveItemSpace(objective, grade, only)` restricts a consumer to the spaces it can draw;
  `tierPick` gives no tier the space when a scope holds fewer than three tiers' worth of items (no more easy from
  the space and medium/hard from the old path); add-sub-20's one-step structure names its anchor (+1, double, 10+n);
  `teenSweep` samples a wide window evenly; knowledge-check rejects a story whose operation contradicts its key
  (`questionMatchesOperation`; a 1/2 − 1/6 item had been told as pouring more water in).
- Fixed on the way: equation-builder shipped "8 + ? = 23" in a within-20 lesson; bar-model put the compare_bars answer
  on the right in 28 of 30 items and repeated one read_scale graph four times per session; rounding offered the
  unrounded number as an option.

## Second continuation: regrouping-workbench, base-ten-blocks, fractions, the rest of the list

- Wired: regrouping-workbench (all four modes) and base-ten-blocks `operate` to add-sub-100 / add-sub-1000;
  fraction-circles `equivalent` to the new `fraction-equivalence` space. The multi-digit spaces gained a seeded
  item list (so `tierPick` can rank a narrow scope) and a short-column feature (3-digit with 2-digit).
- Before: add_regroup gave 27 + 45, 38 + 24, 19 + 36 in 12 of 12 runs; base-ten-blocks operate drew 9036 + 5008 in a
  within-1000 lesson; circles equivalent opened 1/2 -> /4 every run. base-ten-blocks build_number no longer repeats a
  target in a session.
- Not wired, with reasons: fraction-bar `add_subtract` (each item is one fraction to build; there is no operation,
  so the mode does not match its name: needs a component decision), addition-fact-strategies (a session sweeps its
  fact family), place-value-chart (the tier already moves the asked digit), strategy-picker (the task is strategy
  choice; it caps problems at 10 in a within-100 lesson), number-line (no rounding mode; rounding stays KC-only).

## Time and money (analog-clock, coin-counter)

- New spaces: `clock-time` (needs a picture: knowledge-check never gets it), `elapsed-time`, `coin-sets`, `make-change`
  (`service/itemSpace/time.ts`, `money.ts`). Probes: `time-money/` (before-*, after-*, oracle-run.txt, kc-*.txt).
- Before: the clock tiers changed reading aids only; read/match opened 3:15, 7:30, 10:45 at every tier; hard elapsed was
  easier than easy. Coins ran the same 12¢ to 87¢ ramp at every tier; make-change repeated 25 − 15, 50 − 20, 100 − 60 and
  paid with "a 75-cent coin".
- After: every computable mode of both primitives is on the space path with a tier; 30 of 30 tiered sessions pass the live
  validator and the content oracle. Fixed on the way: set_time drew 2:25 on a quarter-hour snap (could not be set);
  untiered elapsed instructions that never named the end time; the fake-coin payment (contract G7).
- Not a fit: coin-counter `identify` (naming a coin), the K clock parts (`hand_name`, `count_face`, `hear_time`).

