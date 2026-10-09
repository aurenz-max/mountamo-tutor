# equation-builder levers — six modes (2026-10-08 class sweep, built 2026-10-09)

`/add-support-tiers` on build-simple, missing-result, true-false, missing-operand, balance-both-sides, rewrite. make-n
already had levers (unchanged). Lever table not confirmed with the user first: the 10-08 class sweep waived that stop.

## Failure inventory

No real-learner evidence for any mode (no demonstrations, no misconception runs). Sources: the misses
`equationBuilderMiss` already names (code, every mode), the journey's scripted wrong answers (synthetic), the catalog's
`commonStruggles` (documented).

| Mode | Failure (miss id) | Class |
|---|---|---|
| build-simple | not an equation yet: tiles in the wrong slots, a sign at an end (`unfinished_equation`) | documented + synthetic (journey drops the last tile) |
| build-simple | sides differ (`false_equation`) | inferred |
| build-simple | true, but the other sign or other numbers (`other_operation`, `other_numbers`) | inferred |
| missing-result / missing-operand | a printed number, the printed numbers added, one off, far off | synthetic (journey picks another option) + inferred |
| true-false | guesses without working out each side (`said_true`, `said_false`) | documented + synthetic |
| balance-both-sides | types the left side's total: "= means the answer comes next" (`other_side_total`); one/far off | documented + synthetic (+1) |
| rewrite | builds the printed equation again (`same_as_printed`), another true form not accepted (`other_form`), other numbers, not an equation | synthetic + inferred |

## Lever table

| Mode | Failure | Lever | Kind | Carrier | Leak rule |
|---|---|---|---|---|---|
| build-simple | `unfinished_equation` | `equation_frame`: empty boxes in the target's shape, circle for the sign, = in place | help | shown | no number, no + or − (`frameLeaks`) |
| build-simple, rewrite | `false_equation` | `number_dots`: dots under each number tile in the learner's row | help | shown | learner's numbers only; never a side's value |
| missing-result, missing-operand, true-false, balance | number misses, `said_*`, `other_side_total` | `printed_dots`: dots under each printed number | help | shown | none under the ?; never a total (`printedDots`) |
| rewrite | `same_as_printed`, `other_form`, `unfinished_equation` | `rewrite_model`: an example equation and the same one turned around the =, other numbers | help | shown | no number of the item, not an accepted form (`rewriteModelLeaks`) |
| rewrite | `other_numbers` | `match_marks`: ring on pool tiles showing a printed number | help | shown | numbers only; no sign, no order |
| all six | far off, `sum_of_printed`, `other_operation`, `other_numbers`, `other_form` | `smaller_numbers`: practice item `<id>~smaller`, same type and sign, numbers about half | simplify | shown | never the item's numbers (`repeatsItem`), never the item's missing number |

Easy (`data.supportTier`) starts the dots lever shown; it is not recorded as a pull. make-n still starts bare.

## Built

- `equationBuilderLevers.ts`: `equationBuilderLevers`, `equationLeverFacts`, `practiceItem` (one builder per type, plus
  make-n's `smallerMakeN`), `practiceParent`, the leak-rule functions above. The `~smaller` suffix is now one constant.
- `EquationBuilder.tsx`: levers published on every mode; dots/frame/model/marks render; simplify swaps in the practice
  item with its own pool. Fixed while testing: the runtime reports "full item back after practice" as a retry of that
  item, so `reopen` read a stale `practice` and reopened the practice pool on the full item; it now reads a ref.
- `liveJourneySpec.ts` row: rebuilds a `~smaller` item from its parent (also covers make-n's practice item, which the
  row could not find before). Catalog comment only; every catalog miss now has a lever, so no `unanswered` entries added.
- Contract R6.

## Tests

- `equationBuilderLevers.test.ts` 30/30: each practice builder over 300 generated items (type, sign, solvable by its own
  key, not the item's numbers or missing number), each leak rule, the miss → `nextLever` table (18 rows), every catalog
  miss answered, easy start.
- `EquationBuilder.levers.workspace.test.tsx` 5/5: pull changes screen + `onScreen` in the commit; refused pull leaves
  demand, levers, attempts and DOM unchanged; next attempt records the lever as assisted; build practice is ungraded,
  keeps its own pool on Try again, and the full item comes back blank and is credited with all three levers.
- All equation-builder files (6) 80/80. `npm run typecheck:lumina` 0.
- Not run (per batch plan): journey sweep, tutor replay, Live.

## Without a lever

- No mode is left without levers. Per item: `smaller_numbers` is absent on the plainest items (a sum below 3, a
  subtraction from below 3, a balance left side below 3, a missing-value item whose only smaller fact has the same missing
  number, e.g. `? + 3 = 4`). There `sum_of_printed` and `other_operation` fall back to the help dots/frame, which do not
  address the sign; a sign-specific help was not built (a text-only sign word is the weak lever this skill avoids).
- Balance items with a subtraction on the right (`? - 2`) get no practice item (the builder handles `+` only).

Ratio: about 360 production lines (lever module ~300, component ~60 net) against ~300 test lines.
