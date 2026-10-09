# math-fact-fluency levers: speed_round, match, visual_fact (2026-10-08)

Class sweep (user opt-in 2026-10-08, Phase 2 stop waived). Builds on the M3 slice of 2026-10-02 (`mathFactFluencyLevers.ts`), which already gave match and visual_fact levers; what was missing was per-item coverage on fingers pictures (J12 rows in `qa/support-levers/QUEUE-item-gaps-2026-10-09.md`) and a recorded decision for speed_round.

## Failure inventory

| Mode | Failure (miss id) | Evidence class |
|---|---|---|
| visual_fact | `other_operation`, `printed_number` | observed-synthetic (journey wrong input on payload c2 = `other_operation`), documented (catalog: subtraction facts) |
| visual_fact | `one_short` / `one_over` / `*_by_more` | observed-synthetic (`mathFactMiss`), inferred |
| match | `one_short` (and every distance miss; a picture-to-equation match prints no fact) | observed-synthetic (payload c3, fingers) |
| speed_round | all six misses | observed-synthetic (`mathFactMiss`) |

No real-learner evidence for any mode. The cause of both J12 gaps was one mechanism: a fingers picture (hand emoji) got no dot lever at all, so items drawn with fingers had only a simplify lever (or none).

## Lever table

| Mode | Failure | Lever | Kind | Carrier | Leak rule | Exists today? |
|---|---|---|---|---|---|---|
| visual_fact (fingers) | other_operation, printed_number | `two_parts`: the fact's two parts as dots in two colours, drawn UNDER the hands | help | shown | dots are the printed numbers only; no numeral; scene fact names what is drawn, no count | no on fingers (built) |
| visual_fact (fingers) | one_short, one_over | `count_marks`: tappable dots under the hands; a tapped dot shows its running count | help | shown | only dots the learner taps are numbered | no on fingers (built) |
| visual_fact (already +1, any picture) | short/over_by_more | `count_marks` now answers by_more when the item has no `smaller_fact` | help | shown | as above | lever existed; per-item `answers` extended |
| match picture→equation (fingers) | every distance miss | `count_marks` under the hands; never split into the fact's parts | help | shown | as above; no `two_parts` on a match | no on fingers (built) |
| speed_round | all | no lever | — | — | user ruling 2026-10-02 (R6): aid-free recall; a picture makes it equation_solve, and recall has no simpler step | listed in catalog `unanswered.speed_round` |

## What was built

- `mathFactFluencyLevers.ts`: fingers pictures get `two_parts` / `count_marks`; `does` and scene fact say the dots are under the hands; `count_marks` answers by_more on a visual fact with no smaller fact.
- `MathFactFluency.tsx` `renderPicture`: on fingers, the hands stay and the lever dots render beneath them.
- Catalog `math-fact-fluency.teachingWorkspace.unanswered = { speed_round: [all six] }`.
- J12 baseline entries for `math-fact-fluency.match` / `.visual_fact` removed; queue rows closed. Contract R6/R7 updated. The journey row already rebuilds `~simpler` items; no change needed.

## Tests

- `mathFactFluencyLevers.test.ts` 49/49: new rows for fingers levers, miss→lever on fingers and on +1 items, leak rules on fingers items, and a per-item check on every saved payload (each wrong choice's miss is answered by a lever on that item; all four lever modes pass).
- `MathFactFluency.levers.workspace.test.tsx` 11/11: fingers `two_parts` changes screen + scene fact in one commit with the hands kept, the next attempt records it, refused pulls leave screen/scene/levers/attempts unchanged; fingers match `count_marks` taps; fingers `smaller_fact` opens 3 + 1 ungraded, the full item returns blank and alone is credited.
- Existing tests (workspace, pip surface, generator unknown-position): pass. 6 files, 90 tests.
- `typecheck:lumina`: 0 errors in these files (the one error at run time is in a sibling's `knowledgeCheckLevers.ts`).
- Not run (batch step): journey sweep, tutor replay. No Live.

## Left without levers

- speed_round, every miss: by user ruling, recorded as `unanswered`.
