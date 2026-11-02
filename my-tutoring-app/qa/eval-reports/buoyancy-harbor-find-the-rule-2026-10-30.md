# buoyancy-harbor `find_the_rule` (2026-10-30, `/add-eval-modes`, SB-4)

**Mode:** the learner drops 2-3 tests after a Float/Sink guess (never graded). Then, without testing, they call each of
1-2 things on yellow stands float or sink, pick what decides it (how big it is / how heavy it is / what it is made of),
and press Check. Code judges: every call right and the rule is "what it is made of". A right check drops the sorted
things in. β 0.5, scaffoldingMode 2, answer `tap`, catalog + backend registry.

| Tier | Tests | To sort |
|---|---|---|
| easy | 2, each the other size of a thing to sort, at least one fools the eye | a floater and a sinker sized as the eye expects |
| medium | 3 (a third stuff) | a floater and a sinker, at least one fools the eye |
| hard | 3, exactly one fools the eye (the third stuff) | a big floater and a small sinker |

Fairness (`ruleFair`, also in `validate`): each thing to sort has exactly one test of its stuff, in another size; some
test is a big floater or a small sinker, so the tests themselves show size does not decide it.

**Misses:** `sorted_by_size` (wrong call on a thing whose size fools the eye) → xray, side_by_side; `sort_slip` →
material_tags, one_step_less; `wrong_rule` (right sort, size or weight picked) → side_by_side, one_step_less. The easier
item: two tests and one thing to sort, sized as the eye expects, none of the item's stuff.

**3D:** the pier holds a row of up to five, the things to sort on yellow stands, long things turned end-on; rule items use
a wider `row` camera view. The drop test, boat and salt layouts are unchanged (`pierLayout` without stands).

**Card:** tutor guidance was at 3,998 of 4,000 chars; the other modes' `moves` and `job` were shortened to fit the new
mode. A test now guards the length.

**Verification:**
- `ruleModel.test.ts` 14 (check, tiers, fairness, validator, scene leak, levers, guidance length); 2 mounted workspace
  tests (wrong rule → Try again keeps the sort → pass drops them in; practice item).
- physics folder 197/197 + workspace 12/12, `test:primitive buoyancy-harbor` 727/727, `typecheck:lumina` 0, full tsc 770
  (baseline 770).
- Browser, Grade 1 (`drive-rule.mjs`, `buoyancy-harbor-drive-2026-10-30/rule-g1/`): 29/30. Covered: size-rule miss,
  Try again keeps the sort, sorting by size miss, all four credited, finale. The failure is a hydration warning from the
  tester's IdleScreen `<details open>`, not the harbor. The first drive showed the row clipped at the camera's edges;
  fixed with tighter spacing and the `row` view, then re-driven.
- Spend: $0 (Gemini).

**Not yet run:** `/eval-test`, a 3-5 band drive, a Live sample (user; the tap boss path is unchanged).
