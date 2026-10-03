# di-worked-procedure: failure inventory and lever table (2026-10-03)

**BUILT 2026-10-03** (rulings R1-R10 as recommended): `qa/eval-reports/di-worked-procedure-levers-2026-10-03.md`.
Rulings carried over: DI gets in-item levers; DI's correction is a parallel-item model (2026-10-02). This pack judges
a MOVE (`procedure_step`) and every step is spoken; no lever changes that.

## What an item is here

A session item is one STEP of a problem, not the problem: a `decide` step per column (regroup, or subtract
cleanly) and, after a regroup, a `subtract` step (`diWorkedProcedureScript.ts` `stepsForPlan`). The page scribes
each credited step. The pack mounts through `DiTeachingStage`, so lever state is per step, which is right for
credit: a help kept on screen into the next step would let that step's attempts read as unassisted.

## Phase 1: failure inventory

Evidence: **no observed-real.** Synthetic = the `spoken_miss` ids (`workedProcedureSpokenMisses`; sweep
`qa/tutor-reports/spoken-miss/wired-all-2026-09-29.log`: no_regroup 34/34, regroup 28/28, 0 false positives) and
the 09-07 Live signature bench (9/9 refused, `di-worked-procedure-live-di-signature-2026-09-07.md`). Documented =
catalog `commonStruggles` (upside-down column, forgot to decrement, bare number on a decide ask, silence).
`logs/demonstrations` has no entries. No `docs/contracts/di-worked-procedure.md` (Phase 3 derives it).

| Mode (β) | Step | Failure (miss id) | Class |
|---|---|---|---|
| subtract_no_regroup (2.0) | decide | regroups a clean column (`regrouped_needlessly`) | synthetic + documented (script key) |
| subtract_no_regroup | decide | off by one or more (`one_short`, `one_over`, `short_by_more`, `over_by_more`) | synthetic |
| subtract_no_regroup | decide | reads a crossed-out digit (`read_crossed_out`) | **unreachable**: this mode never lends, so the catalog entry is dead |
| subtract_regroup (3.5) | decide, regroup column | subtracts top from bottom (`upside_down_column`) | synthetic + documented |
| subtract_regroup | decide, regroup column | regroups but leaves the place above unchanged (`no_decrement`) | synthetic + documented |
| subtract_regroup | decide, regroup column | says no regroup, or subtracts straight away (`said_no_regroup`) | synthetic |
| subtract_regroup | decide, clean column | regroups a clean column (`regrouped_needlessly`) | synthetic (not sampled in the sweep) |
| subtract_regroup | decide, lent clean column | uses the crossed-out digit (`read_crossed_out`) | synthetic (not sampled in the sweep) |
| subtract_regroup | subtract | off-by; digits flipped (`upside_down_column`, as a number) | synthetic |
| both | any | bare number on a decide ask | documented; no miss id (lands as a wrong move); answered by the model only |
| both | any | silence after the ask | documented; no lever (a waiting problem) |

Every miss here is spoken; none is a code check of the page.

## Phase 2: lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| both | every miss | `model_problem`: a small card beside the problem with a DIFFERENT subtraction of the same width, fully worked (strikes, small digits, every difference). subtract_regroup: always at least one regroup column and one clean column, in a fixed pattern per width that does not depend on the item. subtract_no_regroup: all clean. The tutor walks the whole model column by column as "My turn", then asks the ringed column again | help | both | No model column has the same top/bottom pair as any column of the item, or its flip. No number the model says equals any step answer of the item's problem (`newAbove`, `effectiveTop`, each difference); per step kind, the model's answer is not within 1 of the item's. `saysWords` over the model's spoken lines. The model's regroup pattern is fixed per width and mode, so it carries nothing about which of the item's columns regroup. `does`: voice every column of the model in order, never only the one that matches the child's step, never apply it to their problem | no (the old scripted "My turn" re-modelled the child's own column; deleted in LA-14 S5) | picker + leak check over enumerated pairs; mini `ProblemColumns` render |
| both | upside_down_column, no_decrement, said_no_regroup, regrouped_needlessly, read_crossed_out, off-by on a decide step | `top_blocks`: under each column, that column's top digit as it reads now (after any credited lend) drawn as place pieces (cubes, rods, flats) | help | shown | Draws the top number only. Never draws the bottom number, never crosses anything out, never draws a trade or the regrouped counts, never labels a count | no | render + scene fact |
| subtract_regroup (subtract steps); subtract_no_regroup (every step) | off-by, upside_down_column (as a number) | `take_away_cubes`: the column's top (`effectiveTop`, or the digit in no_regroup) as cubes, the last `bottom` of them crossed out (the di-math-facts `take_away_dots` shape) | help | shown | Never counts or labels what is left. Refused on a decide step in subtract_regroup: crossing out shows whether there are enough, which is the decision | no | render + scene fact |
| subtract_regroup | no_decrement | `fewer_columns`: the ones-column regroup decide step of a 2-digit, one-regroup problem; ungraded, then the full step | simplify | both | Declared only on a regroup decide step in the tens column of a 3-digit problem, and only after a `no_decrement` miss on it. Keeps the regroup (mode floor). Not the item's column pair or its flip; its `newAbove` and `effectiveTop` differ from the item's | builder exists at generation only (`drawProblems`/`clampShape` in `diWorkedProcedurePlan.ts`; `baseTenOperands.buildSubtractionOperands` takes an injected `rand`) | runtime builder (enumerate + `planSubtraction` gates) |

### Rejected and no-lever rows

- **Ring the place above, or the column's digits as "3 vs 8".** Either tells the child the column regroups. The
  regroup decision is half the decide step's answer, so it gets the model (outside the item) and `top_blocks` only.
- **A model that mirrors the item's regroup pattern** (the model's tens regroup because the item's do) is a
  template the child maps column by column. The pattern is fixed per width instead.
- **`fewer_columns` after `upside_down_column` or `said_no_regroup`.** The practice step regroups, so taking it
  right before the full step hands over "regroup". It answers only `no_decrement`, where the child already said
  regroup. On a ones column, or any 2-digit problem, there is no fewer-column version of the same decision: refused.
- **subtract_no_regroup has no simplify.** Each step is one clean single-digit fact. Fewer columns changes the page,
  not the step; a smaller fact is di-math-facts `subtraction_fact`, a different primitive.
- **subtract steps have no simplify.** The step is a teen-minus-digit fact; a smaller one leaves the procedure.
- **A whole smaller problem as practice.** The runtime's practice is one item (`openPractice`); a multi-step
  practice would need a TeachingSession change and would re-teach the procedure, not the step.
- **`lent_ring`** (ring the small digit above a crossed-out one): `top_blocks` already draws the lent value on a
  lent column; a second lever for the same miss is not worth its render.
- **Silence:** no lever.

## Phase 6: starting positions

| Tier | Starts on screen | Today |
|---|---|---|
| easy | `model_problem` (not recorded as a pull) | the ask states the column's digits ("Look at the ones column: three minus eight") |
| medium, hard | none | same ask, no digits |

No tier is medium in this pack (`contextFor` defaults to `medium`), unlike dice and math-facts, which treat no tier
as easy. The generator's tier shape stays: hard on 3 digits draws two regroups (`shapeFor`).

**Finding: the easy column phrase conflicts with the ruling.** On a lent column it says `topAfterLend`, which is
the `read_crossed_out` answer (the script's own docblock: stating "four minus two" hands the decrement over). The
slice should drop the digits from the easy ask and let the model card be the easy support, as di-math-facts did
with its support fact. The catalog `tutoring.scaffoldingLevels.level2` ("Model the column once more") also
describes modelling the child's own column; the bound path does not read it, but the guidance line should point to
`model_problem`.

## Build notes

- **Lever module** `diWorkedProcedureLevers.ts`: declarations with `answers`, `modelFor(item)` computed per
  PROBLEM (so the easy card does not change between steps) and checked against every step answer of that problem,
  the `fewer_columns` builder, scene facts. Runtime builders must not call `drawProblems`: it advances the module's
  shared xorshift seed, so the model would change between renders and the generator's pool state would shift.
  Enumerate 2-digit pairs (about 4000) through `planSubtraction`, and a fixed candidate list for 3 digits.
- **Unit test must show** every askable 2-digit item (enumerable) and a large random 3-digit sample have a
  non-leaking model; a model column never equals an item column; `fewer_columns` keeps a regroup and never repeats.
- **Render:** a small read-only `ProblemColumns` with all marks drawn for the model; `top_blocks` and
  `take_away_cubes` under the columns. The practice step is a first (ones) step, so it needs no earlier marks; the
  stimulus must pass `[practiceItem]` as its steps when `view.practice`, because filtering `items` by `problemId`
  returns nothing for it.
- **Payloads:** both modes exist (`w1-payloads/di-worked-procedure.subtract_no_regroup.json`, `.subtract_regroup.json`),
  but every problem in them is 2-digit and has no tier. Make a 3-digit hard `subtract_regroup` payload (one Flash
  generation) so J9 and the replay see `fewer_columns`, lent regroup columns and the 3-digit model.
- **Catalog:** `levers: true`; guidance names `model_problem`; drop `read_crossed_out` from the no_regroup miss list.

### Open questions for the user

1. **`top_blocks` on a decide step.** It draws only the printed top number, but "3 cubes over a printed 8" makes
   "not enough" easier to see, and the regroup decision is half the step's answer. If that counts as showing the
   relationship, decide steps keep only `model_problem`.
2. **Drop the easy column phrase** in this slice (see the finding above), as di-math-facts did with its support fact.

### Shared-stage changes needed

One, small: `DiStageLevers.declare` (and `simpler`) receive the session step's last miss, read from
`lesson.state.attempts`, so `fewer_columns` is declared only after `no_decrement`. Optional parameter; existing
packs unchanged. Lever state stays keyed per step.
