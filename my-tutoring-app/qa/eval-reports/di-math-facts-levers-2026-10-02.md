# di-math-facts levers: the DI pilot (2026-10-02)

`/add-support-tiers`, the first DI family. User rulings 2026-10-02: DI gets in-item levers, and DI's correction is a **parallel-item model** (model a different fact, then ask the child's). Table and failure inventory: `qa/support-levers/di-math-facts-lever-table-2026-10-02.md`. No real-learner evidence. Every failure is synthetic (the spoken-miss ids) or documented (the catalog miss lists).

## What was built

| Mode | Help | Simplify |
|---|---|---|
| all five | `model_fact`: a small solved card of a different fact, voiced as "My turn" | — |
| answer_fact, fact_review | `dot_model` | `smaller_fact` |
| subtraction_fact | `take_away_dots` | `take_one_away` |
| counting_next | `number_path` | `inside_decade` (numbers ending in 9) |
| name_numeral | — | `single_digit` (10 and up) |

- **Shared, once for 9 DI packs:** `DiTeachingStage` takes an optional `levers` prop (declare, onScreen, starting, simpler). It owns lever state per item and the practice item. Packs without it are unchanged (R13).
- **Starting position:** easy starts with `model_fact` on screen and records nothing. This replaces the old easy/medium `support` fact, which licensed modelling the child's own fact (in conflict with the ruling).
- **Catalog:** `levers: true`; the guidance now forbids modelling the problem and points to `model_fact` (trimmed back under the 2000-character cap). The `description` and answer_fact mode text described the old model-the-item drill and were corrected.

**Size:** 247 lines of lever module plus ~170 lines of component, stage and catalog changes, against 254 lines of new tests.

## Measured

| Gate | Result |
|---|---|
| Unit (`diMathFactsLevers.test.ts`, 38) | leak table; every askable item (addition and subtraction to 20, counting to 120, numerals to 120) has a non-leaking model; help draws only printed numbers; builders keep the mode and never repeat the item; miss → lever; every named miss answered |
| Mounted (`DiMathFacts.levers.workspace.test.tsx`, 4) | pull changes screen and scene in one commit; the attempt records the lever; practice is ungraded, survives a retry, returns the full item; the easy start is not a pull; a refused pull changes nothing |
| Suites + sweep J1-J9 | 87 files / 2766 tests pass |
| typecheck | lumina 0; full tsc 771 |
| Text replay (Flash, 5 payloads × 5) | 0 flags. Read by hand: start = "My turn: one plus two is three. Your turn: what is four plus one?"; after a miss or "I'm stuck" the tutor pulls the lever that fits and talks about the screen |

**Two leaks the tests caught, both fixed:**
- A scene fact said "the printed one", which reads as the answer "one" on `0 →`.
- The model "one hundred two" beside the numeral 100 says "one hundred". `modelLeaks` now checks the model's spoken words (`saysWords`), not only its numbers.

## Not covered

- **name_numeral below 10:** after the easy model card, no lever is left; the tutor falls back to words (replay: shape cues, no leak). Any other help would draw or count the numeral, which crosses the mode.
- **Two facts on screen:** the 07-25 browser check found two facts at once overload a K child. The easy model card adds a second, smaller one. HUMAN-CHECKS #183.
- Not browser-checked. No Live run: the DI class gate waits until all 37 DI modes have levers (ruling 09-28).

## Next

The shared stage plumbing is in, so each further DI pack is a lever module plus render branches. Next pack: di-dice-roll (count_pips, compare_dice, sum_two_dice), the closest numeric sibling.
