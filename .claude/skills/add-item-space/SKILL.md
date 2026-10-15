---
name: add-item-space
description: >-
  Give a math strand an item space: code generates every problem the strand's objective allows,
  computes each problem's difficulty from its structure, picks problems at a requested difficulty
  (`config.difficulty` easy/medium/hard, from a lesson or Pulse), computes the answer and misconception-based wrong
  options, and leaves the LLM only the wording. Use when asking a generator for "harder" does not
  change the problem, or when a strand's numbers converge. Covers adding a new strand and wiring a consumer (knowledge-check, a primitive). Not for
  non-math strands without computable answers, help/simplify levers (/add-support-tiers), or a new
  task identity (/add-eval-modes).
---

# Add an Item Space

## The outcome

For a math strand (add and subtract within 20, multi-digit multiplication, equivalent fractions,
elapsed time), a consumer asks for problems in a difficulty band and gets problems that are harder in
a way a teacher would recognize, varied, correct by construction, and tagged with a predicted beta
that the learner's first-try results can later correct. The LLM never chooses a number, an answer or
a wrong option.

**Why this exists (2026-10-13 demo, `my-tutoring-app/qa/difficulty-demo/2026-10-13/REPORT.md`):**

- A prompt that asks for a harder problem does not produce one. Knowledge-check at the recall tier
  gave "What is 7 × 8?" 6 of 6 times; at the analyze tier it stopped computing and asked "Why does
  9 + 5 equal 10 + 4?" (a different task, not a harder problem).
- Per-primitive tiers barely move. number-line `jump` on "numbers 11 to 20": easy and medium were the
  same problem (a hop of 1 to 5 inside the teens). addition-subtraction-scene moved the unknown slot
  but opened three runs with the same four problems.
- When code chose the problem, it changed exactly as asked: 36 of 36 items kept code's numbers, and a
  blind rater placed the three levels at 93%, 76%, 60% correct.
- Before this, the knowledge-check registry never passed `config.difficulty`, so a lesson tier did
  nothing at all.
- number-line `jump` on add-sub-20 (same day): easy became single hops mostly inside a ten, medium
  crossing ten, subtraction and easy two-hop jumps, hard two-hop jumps that cross ten.
- Measuring first matters. number-line plot, order and between already had code-owned tier levers
  that changed the problem, so they got no space. The same probe found two bugs in them instead:
  order chips shown already sorted (the answer on screen), and a plot target repeated three times.

## Invariant principles (hold for every math strand)

These are about what makes a math problem hard. They are not about counting, and none of them assumes
the strand is whole-number arithmetic.

**1. Difficulty is a property of the problem, computed by code.** It is never a word in a prompt.
The generator does not "make it harder"; code picks a harder problem from the strand's space and the
LLM describes it.

**2. A strand is defined by its task, and the task does not change with difficulty.** Every problem
in an item space asks the learner to do the objective's thing. Harder means the same task with more
demand. An explanation question, a "which is greater" comparison or a "what happens if" question is
a different task: it belongs to another eval mode or Bloom pin, never to a harder band of this space
(knowledge-check keeps `analyze`/`evaluate` pins out of the item-space path for this reason).

**3. Sort every number into one of three kinds before using it.**
- *Scope*: the range the objective allows ("within 20", "up to 1000", "denominators 2, 3, 4, 6, 8").
  It bounds the space. It is not difficulty.
- *Structure-bearing*: a number property that changes what the learner must do. Crossing ten, a
  regrouping in a column, a zero in the middle of a number, a fact family (×2, ×5, ×10 vs ×7, ×8),
  unlike denominators, a time crossing the hour. These are difficulty features.
- *Incidental*: digits that can change without changing what the learner does (3 + 4 vs 2 + 5).
  They give variety and must not move the predicted beta. A jitter control (same structure, different
  digits) is part of every verification.

The old rule "difficulty is structural, never magnitude" is this principle stated loosely. Magnitude
counts only where it is structure-bearing or a measured effect (the problem-size effect in basic
facts is real: 8 × 7 is harder than 2 × 3 for reasons beyond its digits).

**4. Difficulty features come from what the learner must do.** Across strands they fall into a small
number of families. Pick the ones that apply and name them as features:
- *Steps*: how many operations, in what order; a step the problem does not state.
- *Unknown position*: result, change or start unknown; a missing factor; solve for a variable on one
  side or both.
- *Composition*: regroupings or exchanges and how many; a zero to regroup across; carries that chain.
- *Number knowledge*: known facts vs derived facts; doubles, ×10, +1 vs facts with no anchor;
  benchmark fractions; friendly numbers.
- *Representation and translation*: a picture vs a symbol vs words; compare language ("how many
  more"); a unit to convert; a scale to read.
- *Relations*: comparing two quantities, a ratio held equal, an inverse relation.
- *Load*: how many quantities to hold, distracting information, length of the text.

**5. Predicted beta is a sum of feature weights (a linear logistic test model).** beta = base +
Σ weight × feature, in logits for a typical learner at the strand's grade who was taught it. Start
the weights from the research for that strand and say where they came from in the module's docblock.
They are priors: attempts record `first_try` (P1.2), and the refit replaces them. This keeps item
difficulty inside IRT. Consumers receive one input, `config.difficulty`; the beta stays internal to
the space (picking, and the calibration stamp). Pulse converts its own target beta (a 0-10 mode scale,
not this one) to a tier in code before it reaches a generator, so never pass a Pulse beta to a space.

**6. Pick across structures, not across items.** In a band, first draw a structure (the item with its
digits removed), least-used first, then an item of it. Otherwise the most numerous structure fills the
band (two-step problems are 90% of add/subtract within 20). No two picks in one call share their
computation.

**7. Code computes the answer, and wrong options come from the strand's mistakes.** Near options are
what a learner with a known misconception gets (wrong operation, stopped after one step, the number
shown, smaller-from-larger, added numerators and denominators, read the minute hand as the hour).
Far options are ruled out by half-understanding. Every option is inside the strand's range, at least
one is far (the `drop_far_choice` lever needs one), and harder items carry more near options.

**8. The LLM writes words only, and code checks them.** The wording call receives the computation,
the quantities and the answer, and returns the question and the rationale. Code rejects a question
that drops a quantity, adds a number, states the answer or does not ask; the space's plain question,
built in code, replaces it. A problem never ships off its spec.

**9. Measure before trusting.** A new space is not done when it compiles. It is done when its bands
separate, the jitter control does not move, and its outputs pass the consumer's contract (see
Verification).

## When a strand fits

- The answer is computable from the problem's parameters (an integer, a fraction, a time, a length).
- The problem can be stated with a small set of parameters (operands, an operation, an unknown slot,
  a unit).
- The objective names one task. "Add and subtract within 20" fits; "understand place value" is three
  or four strands (compose, decompose, compare, round), each its own space.

**List or sample.** When the space is small (add/subtract within 20 is about 6,000 items) build it
once and filter by band. When it is large (4-digit by 1-digit multiplication) write `pick` as a
constrained sampler: choose the structure first (which columns regroup, where the zero is), then draw
digits that produce exactly that structure, as `gemini-regrouping-workbench.ts`'s operand builders do.
Both meet the same interface.

**Not a fit:** strands with no computable answer (explain a strategy, describe a pattern in words),
and most non-math strands. K-2 word-level literacy (sounds, rhyme, syllables, decoding, spelling,
word sorts) has its own skill, `/add-word-space`, over the shared word library. For prose tasks the open
design is generate-and-select (the LLM writes a pool, code and narrow judgments score features, code picks
by target); it is not built yet.

## Strand catalog (starting features and mistakes)

These are starting points; read the strand's research before setting weights.

| Strand | Parameters | Difficulty features | Near-option mistakes |
|---|---|---|---|
| Add/subtract within 20 (built: `addSub20.ts`) | a, b, op, unknown slot; two-step a±b∓c | crossing ten, unknown change/start, subtraction, two steps, +1/doubles/10+n (easier), problem size | wrong operation, stopped after step 1, number shown, smaller-from-larger, off by one |
| Number bonds within 10 (built: `bonds10.ts`) | whole, known part, unknown (part or whole) | missing part, whole size, the missing part is the longer count; n and 1, doubles, a 5, ten (easier) | the number shown, added the two, off by one |
| Multi-digit add/subtract (built, sampled: `multiDigit.ts`, `add-sub-100` and `add-sub-1000`) | digits per column, op | regroupings and how many, regrouping across a zero, chained carries, number of digits, unknown slot | no regrouping, regrouped but did not decrement, smaller-from-larger per column, place misaligned |
| Multiplication/division facts (built: `multDivFacts.ts`) | a, b, op, unknown | fact family (×0/1/2/5/10 easy; ×6-9 hard), ties, problem size, missing factor, division | adjacent fact (7×8 → 54), added instead, commuted division |
| Multi-digit multiplication (built: `multiDigitMult.ts`, `mult-multi-digit` grade 4 and `mult-multi-digit-5` with 3 × 2) | digits | partial products, regrouping in products, a zero inside a factor | dropped a partial product, place shift missed |
| Multi-digit division (built: `divisionMultiDigit.ts`, `div-multi-digit` ÷ 1 digit grade 4, `div-multi-digit-5` ÷ 2 digits) | divisor, quotient, remainder | dividend digits, carried remainders, a zero in the quotient, first digit under the divisor, a remainder; grade 5: a divisor that rounds up | the quotient's zero dropped, the remainder left off, a remainder as big as the divisor, the quotient a place off |
| Skip counting (built: `skipCount.ts`, `skip-count`, K-3) | step, start, direction (a line of 8 jumps) | no ones-digit pattern (3, 4, 6-9), off the multiples (23, 33, 43; odd numbers), counting back, crossing a hundred, three-digit; 10s, 100s, 5s and the rote count from 0 easier | counted by ones, the wrong way, one step too far, snapped to the round number |
| Fraction compare (built: `fractionCompare.ts`, `fraction-compare`) | a/b, c/d | the strategy the pair allows (same denominator < same numerator < benchmark 1/2 < one part short < general < equal), closeness, whole-number bias pointing the wrong way, tenths and twelfths | the symbol backwards, "=" on a close pair, the pair swapped |
| Place value: rounding (built: `rounding.ts`, `round-10-100`); compose, decompose, compare not built | number, operation (compose, decompose, round, compare) | zero as placeholder, nonstandard decomposition, rounding at a 5 or across a place | digit read as value, zero dropped, rounded the wrong place |
| Fractions: add/subtract (built: `fractionAddSub.ts`); equivalence (built: `fractionEquivalence.ts`) | numerators, denominators, op | unlike denominators, improper or mixed, simplification needed, unit vs non-unit, benchmark distance | added denominators, compared by denominator only, numerator kept |
| Measurement and data | quantity, unit, scale | unit conversion, a scale not in ones, start not at zero, elapsed across a boundary | counted tick marks not intervals, read from 1, unit not converted |
| Clock reading (built: `time.ts` `clock-time`, needs a picture) | hour, minute; the lesson's minute grid | half past, quarter, five-minute mark, a minute between marks, :40+ (short hand near the next number), twelve | hour read from the nearest number, hands swapped, minute read as the number pointed at, quarter past/to swapped |
| Elapsed time (built: `time.ts` `elapsed-time`) | start, duration (five-minute grid) | crossing an hour mark mid-way, an hour or more, hours and minutes, start off the hour, off the quarter grid, past 12 | clock times subtracted as whole numbers (410 − 350 = 60), minutes only, hours only, a tick miscounted |
| Coin sets (built: `money.ts` `coin-sets`) | count of each coin | kinds of coin, nickels, dimes then nickels, a quarter, coins past four | every coin as one, every coin as the largest, a kind left out, one coin miscounted |
| Making change (built: `money.ts` `make-change`) | paid (a quarter, 50¢, a dollar), cost | a borrow, a borrow across the zeros of 100, a price off the five grid, paying with a dollar | regrouped without decrementing, smaller digit from larger, ten off, the price given back |
| Comparison stories (built: `compareStories.ts`, `compare-20`, `compare-100`) | larger, smaller, unknown (difference, larger, smaller), "more"/"fewer" | inconsistent language (the word points to the other operation), the compared amount unknown, "fewer", crossing ten / regrouping | the keyword error (the other operation), a number in the story, off by one |
| Comparing two numbers (built: `compareNumbers.ts`, `compare-numbers`, within 100) | left, right | shared tens (the ones decide), swapped digits (47 vs 74), closeness (log of the gap), equal; fewer digits (easier). The symbol is incidental | the symbol read backwards, the pair swapped with the symbol kept |
| Ratios: missing value, unit rate (built: `ratioMissingValue.ts`, `ratio-missing-value`, grade 6) | a : b, the scaled first quantity k, which quantity is hidden | a non-whole factor (and not a half), scaling down, finding the first quantity, a decimal or below-one unit rate; a whole rate (or 1/n) lets the learner scale across instead, so the factor features drop | the additive error, the given value copied, the factor applied the wrong way |
| Equal sign within 20 (built: `equivalence20.ts`) | known side, boxed side, box position | work after the equal sign, operations on both sides, box last, shared addend (easier), crossing ten, subtraction | the known side's total in the box, added every number, the number beside the box |
| Two-step equations px + q = r (built: `twoStepEquations.ts`) | p, x, q | division fact family, a borrow in r − q, four or more groups, size | wrong inverse first, stopped after one step, divided first |
| Expressions and equations | coefficients, operations, variable position | variable on both sides, negatives, distribution, order of operations | inverse not applied to every term, left-to-right only |

## Procedure

### 0. Read before touching
- The demo report above and the reference: `service/itemSpace/types.ts` (the contract),
  `addSub20.ts` (a listed space), `index.ts` (registry, resolver, `TIER_BANDS`, `difficultyBand`),
  `service/knowledge-check/itemSpaceProblems.ts` (a consumer).
- The contract of every consumer you will wire (`docs/contracts/<id>.md`); run
  `/primitive-contract --check` before editing a generator.

### 0b. Measure the consumer before building
**A primitive means every eval mode it has** (user ruling 2026-10-13). List the modes from the catalog
and give each one a verdict in the final report: wired to a space, measured and left alone (its tier
levers already change the problem), or not a fit (no computable answer, a different task, nothing the
space can draw), with the reason. Wiring one mode and leaving the rest unmeasured is not done.

For each primitive mode, run the wiring probe at each tier first (3 runs per tier, `--mode <mode>` on
`scripts/difficulty-lab/nl-jump-tier-wiring-probe.mjs` or a copy for the primitive). Read the payload
the learner gets, not the log line. A space is warranted only when the tiers give the same problem
(easy = medium), or the numbers converge across runs. When the existing levers already change the
problem, build nothing; fix whatever the probe shows instead (answers visible in the display order,
repeated items, an unsolvable instruction), and record it in the contract.

### 1. Define the strand
Write the objective's task in one sentence and the scope in numbers. List the parameters and the
structure key (the item without its digits). Decide list or sample.

### 2. Write the space: `service/itemSpace/<strand>.ts`
Implement `ItemSpace<I>`: `id`, `describe` (what the resolver matches), `grades`, `criterion`,
`wordingGrade`, `pick`, `solve` (answer, shown quantities as they appear in text, a one-line `spec`),
`distractors`, `plainQuestion`. Items carry `beta` and `structure`. Put the features and their
weights in the file with a docblock naming the research behind them.

### 3. Register it
Add it to `SPACES` in `service/itemSpace/index.ts`. The resolver (one flash-lite enum call: the LLM
fits an objective to a strand, code picks the problems) offers it to every consumer at once. Check the
`describe` text against two objectives that should match and two near ones that should not.

### 4. Wire consumers
- **knowledge-check** is generic: any registered space works with no change. It applies when
  `config.difficulty` is set, the check covers at most one objective, the learner reads, and the
  pin is absent, `recall` or `apply`.
- **A primitive** (number-line, a scene, a fact drill): in its generator, when `config.difficulty` is set
  and `resolveItemSpace` returns a space, take the challenge parameters from `space.pick` and let the
  LLM write only the instruction text. Reference: `service/math/numberLineItemSpace.ts` (pure, tested
  without Gemini) and `jumpsFromItemSpace` in `gemini-number-line.ts`.
  - **Resolve on the mode's task, scoped by the lesson.** The eval mode already fixes the task, so
    the resolver objective names it and the line or scene it runs in: "Jump forward or back on a
    number line from 0 to 20 to add or subtract (lesson: Numbers 11 to 20)". A topic alone ("numbers
    11 to 20") reads as counting and resolves to none. When the task text is generic ("find the
    product of a multiplication fact"), put the lesson first ("Lesson: X. In this activity the
    learner ..."): task-first, "multiply a two-digit number by a one-digit number" resolved to the
    facts strand. Run `scripts/difficulty-lab/resolver-check.mjs` on two objectives that should
    match and two near ones that should not.
  - **A failed wording call must not fail the lesson on the space path:** code owns the numbers, so
    catch it and ship the space's plain asks (math-fact-fluency: 3 of 30 match runs failed on a
    runaway or empty reply).
  - **Check the primitive's own scope cap against the strand.** multiplication-explorer capped grade 3
    at products of 50 (grade 2's band), so its hard tier could never fill and no grade-3 session ever
    held 7 × 8. A cap below the objective is a bug; fix it in the same slice.
  - **An adapter per space turns an item into challenge parameters, or null when the primitive
    cannot draw it.** Pass it to `pick` as `accept`, so the structure spread happens over drawable
    items only (filtering after the pick leaves a band short or one-structure). The primitive's
    contract decides what is drawable: number-line jump takes result-unknown items only (a missing
    start has no landing to place), hops from its band table, every value on the line, the lesson's
    direction. Say so in the contract.
  - **Prefer the lesson's focus window, then the full scope**, as the primitive's own pickers do.
  - **A narrow scope cannot fill every tier's band** (within 10, no one-step result-unknown sum is
    "hard"). Pass `tierPick(space, log, scope)` as `pick`: when any tier's band is short for the
    scope, every tier takes its third of the drawable items by beta, so easy < medium < hard holds.
    `scope` is the tier-independent filter (mode + range); never decide from a tier-specific accept
    (build-equation's part-whole tier takes additions only, and judged alone it lost the medium band).
    Skip it where the primitive has its own window fallback (number-line jump: thirds of an 11-20
    window made every easy jump a hop of 1).
  - **Fewer picks than the session needs: keep the primitive's own path whole.** Never mix code
    picks with old-path items in one session.
  - **The space owns the problem's shape at every tier.** Per-tier shape logic
    (`resolveProblemShape`, a fixed "hard = two steps") and its prompt lines must not run on the
    space path; they would contradict the item (medium can hold an easy two-step item). Scaffolds
    (labels, arcs, anchors, starting levers) still follow the tier. The shape logic stays for
    objectives no space fits.
  - **Paths that rewrite the primitive's own items keep that path** (number-line's observation-driven
    start contrast, R13), unless you port them onto the space's items.
  - Stamp `itemSpace` {space, structure, beta} on each challenge for calibration; add it to the
    challenge type and confirm the tutor context does not spread the challenge object.
- **Pulse** needs no wiring: it sets `config.difficulty` from its target beta (practice-manifest.ts).

### 5. Verify
- Unit tests next to the space: every item is inside scope and its answer is the unknown slot; every
  tier band yields distinct items across more than two structures; the hard band holds more
  structure-heavy items than the easy band; the `ItemSpace` contract (three distinct wrong options,
  never the answer, at least one far, a plain question that passes `questionFitsSpec`).
- The wiring probe through the real registry generator, per tier, plus a no-tier run and one
  objective no space fits (both must keep the old path). Templates:
  `my-tutoring-app/scripts/difficulty-lab/kc-tier-wiring-probe.mjs` (knowledge-check),
  `nl-jump-tier-wiring-probe.mjs` (a primitive: prints each challenge's parameters, its structure and
  beta, its text, and a recomputed answer key). Read every instruction: can the learner do the item
  from the words plus what the screen shows?
- A primitive's unit test over the adapter: every drawable item maps to valid parameters, every
  non-drawable one to null; every tier fills a session of distinct items across several structures;
  harder tiers carry more structure.
- A jitter control: items of one structure with different digits should be rated alike.
- Optional, cheap: a blind rater per band (`scripts/difficulty-demo-probe.mjs`). It is Gemini rating
  Gemini, so it checks direction, not weights.
- `typecheck:lumina` 0 and the consumer's tests.

### 6. Record
- The consumer's contract changelog: what the item-space path changes and which requirements hold.
- When real first-try data exists for the strand, refit the weights and note the before and after in
  the module.

### 7. Final report (required in the reply, user ruling 2026-10-13)
The reply ends with the per-tier table read from the probe output, one row per primitive mode (and
per scope when a mode was probed at two scopes), with real problems from the runs, not descriptions:

| Primitive | Easy | Medium | Hard |
|---|---|---|---|
| Scene `solve_story`, within 20 | 7+1, 20−1, 15−10; answer unknown | 3+?=18, 7+?=10, 18−7; the added number unknown, crossing ten | ?+8=15, ?−11=8, ?−9=1; the start unknown, crossing ten |
| Explorer `missing_factor` | ?×3=6, 4×?=8, ?×3=15 | ?×4=12, ?×3=24, 3×?=18 | 8×?=72, ?×6=54, 9×?=63 |

Under it, one line on what the same tiers gave before (from the measurement in 0b), then the weak
spots seen while reading (a medium pick that reads easy, a scope the space ignored). Below that, the
mode verdicts from 0b: every mode of the primitive, wired / left alone / not a fit, with the reason.

## Gotchas
- **A primitive's consumers so far:** knowledge-check (any space); number-line `jump` (add-sub-20;
  identify and build_hops got code tier targets, plot/order/between already separated);
  addition-subtraction-scene, all four modes (add-sub-20); multiplication-explorer, all six modes
  (mult-div-facts); math-fact-fluency, all five modes (add-sub-20); number-bond missing_part, related_fact,
  fact_family, build_equation (bonds-10; decompose gets code tier wholes); ten-frame operate (add-sub-20;
  split and build_pair get tier windows of totals); equation-builder missing-result, missing-operand,
  true-false (add-sub-20); array-grid build, count, multiply (mult-div-facts, over its own admissible
  arrays); addition-fact-strategies big_facts, turnaround, facts_3_4 (add-sub-20 beta ranks each family, `tierWindow`;
  the other families are one structure); tape-diagram solve_comparison (compare-20/-100); comparison-builder
  compare_numbers (compare-numbers in the objective's numeral window) and one_more_less (code tier targets);
  ratio-table missing_value, unit_rate and double-number-line find_missing (ratio-missing-value; the DNL session's
  base ratio is the lever, chosen by tierWindow over bases); measurement-tools measure/compare (code tier widths);
  equation-builder balance-both-sides (equivalence-20); balance-scale one_step (add-sub-20 change-unknown
  additions), one_step_hard (mult-div-facts quotients, 2-6 parcels), two_step_intro and two_step (two-step-equations),
  equality and equality_hard (tier windows of the target); area-model build_model, find_area, factor, multiply
  (mult-multi-digit / -5; each mode keeps its grid shape), perimeter (tier windows of length + width). bar-model has no space (reading tasks; its tier levers
  already change the problem); analog-clock read, set_time, match (clock-time,
  on the lesson's minute grid), elapsed (elapsed-time); coin-counter count-like, count-mixed, make-amount, show-amount
  (coin-sets), compare (pairs of coin sets), make-change (make-change); identify and the K clock parts are not a fit.
  skip-counting-runner, all five modes (skip-count: one line per session; connect_multiplication from 0 only);
  hundreds-chart highlight_sequence, complete_sequence, find_skip_value (skip-count, each count its own start;
  identify_pattern left alone, its shape is the step's); fraction-circles compare (fraction-compare; grade 3 same
  numerator or denominator only); length-lab tile_and_count, estimate_then_tile (tierWindow of counts; compare and
  order already separate). Division (div-multi-digit, -5) has no primitive consumer: knowledge-check only.
- **A strand whose task is reading the equation** (equivalence-20, two-step-equations) sets `equation` in `solve`:
  knowledge-check then asks the wording call to print it, and rejects a question without it. A story turns
  "8 + 4 = ? + 5" into a compare problem.
- **Pass `only` to `resolveItemSpace`** with the spaces the consumer can draw. Adding bonds-10 made a
  within-10 fact objective resolve to it, which the fact drills cannot use; `only` keeps each consumer's
  choice to its own spaces. Knowledge-check passes none (it draws any space).
- **A narrow scope gives no tier the space.** When the scope holds fewer than three tiers' worth of items,
  `tierPick` returns nothing at every tier, so easy never comes from the space while medium and hard come
  from the old path. A consumer whose distinct items are fewer than its items (number-bond: a bond and
  its turnaround) counts distinct ones itself (`scopeBondCount`).
- **An answer with a part the computation does not ask for declares `asks` in `solve`.** A division with a
  remainder keys "73 R 1"; a story asking only "how many in each" was accepted until the check required "left
  over" in the question.
- **Thirds of a narrow scope can be one structure.** A forward count on a board of 100 never reaches the hard
  band, and 45 odd-number counts share β 0.3, so item thirds put only them in hard; the hundreds chart takes
  thirds of the distinct betas instead. In a grade-3 fraction-compare scope the only high structure was the equal
  pair: every hard answer was "=". Look at the hard third's structures, not only its betas.
- **A one-operation item declares `operation` in `solve`.** Knowledge-check rejects wording whose story
  reads as the other operation (`questionMatchesOperation`): a 1/2 − 1/6 item was told as pouring more in.
- **Quantile thirds collapse on tied betas.** `tierPick` thirds are beta quantiles: when most items share one
  beta (7,794 of 8,100 two-digit compare pairs at -1.2), easy and medium draw the same items. Give the space a
  graded feature (compare-numbers: closeness = 1 - log10(gap)/2), not only a threshold flag.
- **An incidental feature that splits a third makes an answer pattern.** compare-numbers weighted "<" +0.2, so
  every easy card of a two-digit session was ">". Keep answer-identity features (a symbol, a side) at weight 0
  and in the structure key, so the spread alternates them.
- **Model the learner's easier route.** A ratio item with a whole rate (3 : 6) is "double it" whatever its
  factor k/a is; scoring it by the factor ranked a 3:6 double-number-line session as hard. When two strategies
  solve an item, its features are the cheaper strategy's.
- **A session-level parameter is the lever when items share it.** double-number-line shares one given pair per
  session; ranking bases (tierWindow) moved the tiers, picking asks inside a base by count alone did not.
- **A mode whose difficulty is one ordered quantity** (how many splits a whole has, a total to split) needs
  no space: `tierWindow` gives each tier its slice of the ordered values.
- **Measure the layout, not only the numbers.** The bar-model probe found the answer on the same side in
  28 of 30 items; a read-mode answer position must rotate through the session. `scripts/difficulty-lab/tier-probe.mjs`
  probes any primitive per tier (add a printer for its challenge shape). Run each probe to its own
  file and wait for it: a second run into the same file interleaves with the first.
  `scripts/difficulty-lab/item-space-table.mjs <space>` prints each band's picks without Gemini.
- **The answer may legitimately appear in the text** when it is also a given quantity (8 − 4 + 4 = 8).
  `questionFitsSpec` allows that in a knowledge-check; do not "fix" it there. A primitive differs
  when its text or screen names that quantity as something else: the number-line start marker is
  8, so "jump back 4, then forward 4" states its own landing ("back to where you started"). Exclude
  such items in the primitive's adapter.
- **The text must carry every quantity the screen does not show.** The number line shows only the
  first start, so a two-hop instruction that says "then jump again to your final spot" cannot be
  solved. Check in code that the text names each one (`jumpTextNamesEveryHop`), and make the code
  template name them too. This was broken on the old hard-tier path as well.
- **A Pulse beta is not an item-space beta.** Pulse's target beta is on its 0-10 eval-mode scale;
  item-space betas are logits around 0. Pulse sends `config.difficulty` (practice-manifest.ts), and
  consumers read nothing else. Do not add a beta input to a consumer.
- **A task that needs a picture the space does not draw** (reading a clock face) sets `needsPicture`: the resolver
  offers it only to a consumer that names it in `only`, so knowledge-check never words "What time does the clock
  show?" with no clock. The resolver's "none" list drops money and time when a money or time space is offered.
- **Pre-readers** keep the generated path: their options need pictures, which a space does not draw.
- **A check spanning several objectives** keeps the orchestrator; replacing it with one strand's
  arithmetic would drop the others.
- **Trivial items hide in a listed space**: "? + 0 = 10" or a missing 1 test a different rule. Exclude
  them in the builder and say why.
- **Options outside the scope** (38 for a within-20 problem) are never tempting. Keep every option
  inside the strand's range.
- **Do not add per-item wording calls.** A new consumer words the whole set in one flash-lite call.
  A primitive that already words per item with its own leak checks (number-line jump: one call per
  challenge, `jumpTextNamesPosition`) keeps that text step and feeds it the space's parameters.
- **The LLM's tier label is not the difficulty.** The problem's `difficulty` field comes from its
  predicted beta, and `itemSpace.beta` / `itemSpace.structure` ride on the problem for calibration.
  They are never rendered or sent to the tutor.
