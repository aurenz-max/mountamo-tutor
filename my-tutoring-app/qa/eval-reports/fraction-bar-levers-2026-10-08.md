# fraction-bar levers: identify, build, compare, add_subtract (2026-10-08)

`/add-support-tiers`, class sweep (lever-table stop waived by the user). build_equal's levers already existed and are unchanged.

## The item

All four modes run the same three-step item: pick the numerator from four numbers, pick the denominator from four numbers, shade the bar. The modes differ only in the fraction window (identify unit 1/2-1/8; build non-unit d 3-6; compare d 4-12; add_subtract d 3-10). So one lever set serves all four, and each lever's availability depends on the step and on the item.

## Failure inventory

| Miss (`fractionBarMiss`) | Step | Evidence |
|---|---|---|
| `chose_denominator` / `chose_numerator` (swapped the two numbers) | pick | documented (catalog commonStruggles x2; remediation move `contrast_shared_digit_roles`); observed-synthetic (journey wrong input) |
| `other_numerator` / `other_denominator` (neither number) | pick | inferred |
| `shaded_all` (shaded the denominator) | shade | documented (same confusion as a swap) |
| `shaded_the_rest` (shaded the unshaded count) | shade | inferred (fraction-circles documents it) |
| `one_short` / `one_over` / `short_by_more` / `over_by_more` | shade | documented ("shading wrong number of parts"); observed-synthetic (journey one over) |

No real-learner evidence. `logs/demonstrations/2026-09-27.jsonl` has a "2/5 + 1/5 = 3/10" diagnosis, but no mode on this primitive asks for a sum (see Finding).

## Lever table

| Lever | Kind | Steps | Answers | Carrier | Leak rule (code) |
|---|---|---|---|---|---|
| `model_fraction` | help | all | swaps, neither-number, shaded_all, shaded_the_rest | both | the model shares no number with the item and is not its value (`modelLeaks`). Its fact describes what is drawn only |
| `running_count` | help | shade | count misses | both | the learner's own count. Nothing turns green at the right number |
| `number_parts` | help | shade | count misses | shown | place numbers 1..N in the parts (position, not the count) |
| `smaller_fraction` | simplify | all | all ten | shown | a practice fraction with fewer parts that stays in the mode's window. Never the item's value or bar (`practiceLeaks`). Two choices per pick: its own numerator and denominator |

Starting positions (Phase 6): `running_count` and `number_parts` start pulled wherever the generator's tier already shows the readout or the numerals (easy, medium, no tier). A starting position is not recorded as a pull. `model_fraction` starts released at every tier. The generator needed no change.

**Coverage per item:** the simplify lever does not exist on each mode's plainest items: identify 1/2, build x/3, compare x/4, add_subtract x/3. On those items, once the model has been pulled, a pick miss has no lever left (unit-tested on identify 1/2). On a no-tier or easy item both counting levers start pulled, so after a count miss the next lever is `smaller_fraction`, or `model_fraction` on a plainest item, which shows the meaning but not the count. No catalog `unanswered` entry: every catalog miss for these four modes is answered by some lever.

## What was built

- `fractionBarLevers.ts` (new): the levers, `modelFraction`/`modelLeaks`, `smallerFraction`/`practiceLeaks`, `barPractice` (dispatches to `smallerBarTarget` for build_equal), `stepLeverFacts`.
- `FractionBar.tsx`: the three-step levers are published per step. The simplify lever opens a `~smaller` practice item through the existing practice path. New render: the model card and the lever-driven readout and numerals. **Leak fix:** the readout count and the bar border turned emerald when the shaded count reached the numerator, which gave a verdict before Submit at every tier. Both are now neutral.
- `fractionBarWorkspace.ts`: `FractionBarView.leverFacts` goes into `onScreen`.
- `liveJourneySpec.ts` (fraction-bar row only): rebuilds the practice item with `barPractice` for every mode.

## Tests

- `FractionBar.levers.workspace.test.tsx` (new, 33): leak rules and the simplify builder over every fraction in every mode's window, the miss table, the `nextLever` table, and lever coverage on the plainest item. Mounted: a pull changes the screen and the scene fact in one commit; the credited answer records `[model_fraction, running_count]`; a refused pull leaves the demand, levers and attempts unchanged; at the right count nothing turns green; the practice item is ungraded and stays open on Try again, the full item comes back at step one and is credited with both levers; the tier's readout and numerals are not pulls.
- The fraction-bar suites (5 files, 48 tests) and the W1 `workspaceContract` (fraction-bar, 21) pass. Service math and oracle tests pass.
- `typecheck:lumina`: 0 errors in these files. The 9 errors reported are all in sibling files being edited at the same time (EquationBuilder, numberLineView, PatternBuilder).
- Not run, as instructed: the journey sweep, tutor replay and Live.

## Finding (not fixed here)

`compare` and `add_subtract` assess nothing their names say. Each is the identify/build three-step item with a wider fraction window: there is no comparison and no operation. The catalog betas (3.5, 4.5) price skills the item does not ask for. Owner: `/add-eval-modes` (a real task identity per mode) or `/eval-fix`.
No `docs/contracts/fraction-bar.md` exists. The contract was not derived in this slice.
