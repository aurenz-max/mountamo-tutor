# circuit-workbench `conductor_test` (2026-10-31, `/add-eval-modes`, SB-6)

**Mode:** the circuit has a gap at a pad on the front of the table. The learner guesses Light or Off for each test thing
(never graded) and it goes across the gap; the bulb lights if it conducts. Then, without testing, the learner calls
whether each other thing would light the bulb, and presses Check; a right check puts the last one in the gap. β 1.0,
scaffoldingMode 2, answer `tap`; catalog, backend prior, metrics type, generator (mixed = 3 + 2 + 2).

| Tier | Tests | To decide |
|---|---|---|
| easy | 2 (a conductor and not) | 1, looks the way it acts |
| medium | 3 | 2 (one lights, one not), look the way they act |
| hard | 3 | 2 whose look fools the eye (dull rusty nail / iron washer light; shiny plastic button / spoon, shiny rubber ball do not), each beside a tested thing of its stuff that looks the other way |

20 things in `conductorModel.ts` (metal, pencil lead, rubber, wood, plastic, paper, string, glass). Each thing to decide
shares its stuff with a test (`conductorFair`, also the validator). **Misses:** `judged_by_shine`, `sort_slip`
(unanswered until levers).

**3D:** a pad with two jaw clips at the front, fixed wires from the bulb and the battery's − end, and a mesh per thing
lying across the gap. Drive found the two gap wires crossing; uncrossed. Medium sessions repeated straw/eraser (wood,
paper and string had one thing each); a partner was added for each.

**Verification:** `conductorModel.test.ts` 6, mounted test (gap lights by conductor, shine-fooled call is a named miss,
Try again keeps the tests, right calls pass); `test:primitive circuit-workbench` 723/723; `typecheck:lumina` 0; full
tsc 770. Browser Grade 3 medium `drive-cond.mjs` 20/20 (twice; screenshots `circuit-workbench-drive-2026-10-31/cond-g3/`).
$0 Gemini. Hard tier checked in vitest only.
