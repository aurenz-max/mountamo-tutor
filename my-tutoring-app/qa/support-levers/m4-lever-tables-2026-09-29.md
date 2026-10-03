# M4 lever tables (patterns, charts, space, money, writing numbers, 2026-09-29)

Handoff 32, `/add-support-tiers` Phases 1-2, one primitive at a time. No real-learner evidence exists for any M4
primitive: evidence is each primitive's miss function (synthetic), catalog `commonStruggles` (documented) and inference.

## ten-frame — DONE 09-29 (contract R12)

`build` and `build_teen` already have `running_count`, `five_frame`, `smaller_build` (`tenFrameLevers.ts`). This
table covers the five modes without levers. Misses are what `frameMiss` (gesture) and `tenFrameSpokenMisses` (spoken)
name today; the brief's 09-27 appendix draft was checked against the component and corrected (see below).

| Mode | Lever | Kind | Carrier | Answers | Leak rule |
|---|---|---|---|---|---|
| decompose | `split_model` | help | both | none_flipped, all_flipped | a model frame beside the item, a total no split item in the session uses, shown as two coloured groups; never a pair of the item's total |
| decompose | `ways_shown` | help | shown | same_way_again | small frames of the ways the learner already showed for this total; never an unshown way. Offered only once the ledger has a way |
| decompose | `smaller_total` | simplify | shown | none_flipped, all_flipped | a split of a smaller total (2+), not the item's and no session split total; practice commits never enter the ledger |
| decompose_teen | `running_count` | help | both | one_short, one_over | counts the counters turned yellow; starts withdrawn (as build's count) |
| decompose_teen | `ten_model` | help | both | all_flipped, short_by_more, over_by_more | one full model frame outside the item marked "10"; never outlines the item's own counters |
| decompose_teen | `smaller_teen` | simplify | shown | short_by_more, over_by_more, all_flipped | a teen number with about half the ones, scattered by the same producer; never the item's teen number; none on 11 |
| make_ten (K, fill) | `empty_glow` | help | shown | one_short, short_by_more | the empty boxes pulse; no count, no numeral |
| make_ten (both bands) | `near_ten` | simplify | shown | short_by_more (+ over_by_more at 1-2) | a make-ten with 1-3 missing, not the item's shown count, no session make-ten's shown count |
| make_ten (1-2, spoken) | `fill_model` | help | both | said_shown, said_capacity | a five-frame model outside the item ("3 and 2 more make 5"); none of its numbers the item's shown count or answer; none on five |
| make_ten (1-2, spoken) | `five_frame` | help | shown | one_short, one_over | top row outlined, marked 5; refused when the shown count or the answer is 5 (so make_ten on five has no help lever, only `near_ten`) |
| subitize | `hide_empty` | help | shown | empty_count | empty boxes fade during the look; counters unchanged |
| subitize | `five_frame` | help | shown | one_short, one_over, short_by_more, over_by_more | top row outlined, marked 5, during the look; refused when the answer is 5 |
| subitize | `longer_look` | help | shown | one_short, one_over, short_by_more, over_by_more | the next look lasts twice as long; the counters still hide before the answer |
| subitize | `fewer_dots` | simplify | shown | short_by_more, over_by_more | a look at about half as many (2+), not the item's number, no session subitize answer |
| operate | `operation_model` | help | both | said_addend, said_start, said_change | a model frame outside the item with a problem of the same operation whose numbers share none with the item or the session's operate items, drawn in two colours (add) or with the taken-away counters crossed (subtract), and its result; none of its numbers is the item's answer |
| operate | `five_frame` | help | shown | one_short, one_over | top row outlined, marked 5; refused when the answer is 5 |
| operate | `smaller_numbers` | simplify | shown | short_by_more, over_by_more | same operation, second number 1 or 2, first number at most 5, a smaller answer that is no operate answer still ahead |

Corrections to the brief's draft:
- `showEquation` (operate) is not a lever: it is text, hidden for pre-readers, and names the addends the tutor already
  says. The spoken misses it would answer (`said_addend`, `said_start`, `said_change`) are answered by a model instead.
- Crossing out the item's own taken-away counters is not a lever: it leaves the answer on screen to count, the same
  leak as the number-line arc drawn to the landing. The crossing happens on a model only.
- A yellow-gather (turned-yellow counters moving into one frame) on decompose_teen is not a lever: it turns the item
  back into "fill the top frame", the layout cue the scatter exists to remove.
- `showEmptyCount` stays unrendered (it states the make-ten complement).
- Number marks in the empty boxes (make_ten 1-2) are not a lever: the last mark is the answer.

No lever: make_ten K `one_over` cannot occur (the frame commits when full).

Changes made while building (09-29), each a tighter leak rule:
- make_ten's model is `fill_model`, a five-frame, not a model ten: the saved 1-2 session uses every pair to ten from 9+1
  to 3+7, so any ten model states an answer still ahead.
- "No session number" became "no answer still ahead" (the current item and the items after it) for every model and
  practice item. An answer the learner already gave leaks nothing; with the stricter rule the saved make_ten and operate
  sessions had no model or practice item at all.
- A model's numbers never include the item's answer (a "3 and 2 more make 5" model next to a make-ten whose answer is 3
  put the answer in the scene fact).
- A take-away practice item has a smaller answer, not only a different one.

Built: `tenFrameLevers.ts` (`practiceItem`, `leverView`, `leverFacts`, one builder per mode), `TenFrame.tsx` (model
frames beside the item, empty-box glow and fade, the long look, the yellow count, the ledger skips practice splits),
the journey row rebuilds any `~smaller` item with `practiceItem`. No starting positions: every new lever starts withdrawn.
Gate (vitest): `tenFrameModeLevers.test.ts` 47, `TenFrameModes.levers.workspace.test.tsx` 6, journey sweep J1-J9 on the
eight ten-frame payloads, ten-frame + live-activity suites 2163 passed; `typecheck:lumina` 0; tsc 771 (baseline 773).
About 360 net production lines (lever module +293, component +69) against 355 of new tests.
