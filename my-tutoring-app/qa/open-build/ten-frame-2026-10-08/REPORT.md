# ten-frame `build_pair`: open build, math wave 3 pilot (OB-9M), 2026-10-08

A new mode. `decompose` (split) is unchanged: it still hands the learner a red group to flip. Contract R13.

## What was built
- **Task:** "Make five with red and yellow counters." The frame opens empty. The learner picks a colour from two
  62 px buttons, taps a box to place a counter and taps a counter to take it off, then presses "I'm done!". There is
  no stillness commit. The same total comes back once, asking for "a DIFFERENT way". K.OA.3: the learner makes both
  the whole and its parts.
- **Judge:** code, at "I'm done!", using split's `judgeSplit` against a per-total ledger kept separate from split's.
  It checks the total, that both colours are present, and that the pair is new while an unmade pair remains. Misses:
  the count misses on a wrong total (`one_over`, `one_short`, `filled_frame`, `short_by_more`, `over_by_more`),
  `one_colour` and `same_way_again`.
- **Try again keeps the build.** A new item, or the simplify lever's smaller total, opens an empty frame.
- **Scene facts** are numbers (`countersOnFrame`, `redOnFrame`, `yellowOnFrame`), so `workHistory` records a fix
  such as `countersOnFrame 0 → 6 → 5`.
- **Watcher:** `useBuildWatcher` with `numbers: 'never'` on the frame svg. The five-frame lever mark is now
  `data-aid`, which keeps it out of the picture.
- **Levers**, all bare at the start: `running_count` (the whole only, never per colour), `split_model`,
  `ways_shown` and `smaller_total`. These are split's levers, widened to the new kind.
- **Generator:** code owns every total. `pairTotals` picks three distinct totals in 3..10 inside the bound the lesson
  names ("up to 5" gives 3, 3, 4, 4, 5, 5), each asked twice in a row. The hint, narration and instruction are
  code-written. The frame is single at every band.
- **Registry:** catalog β 2.1, ordered after build_teen (2.0) and before subitize (2.5), with `answers: ['build']`,
  misses and one guidance sentence. Backend prior 2.1. The oracle checks the total range and that no pair appears
  in the prose. Journey driver branch added, and the saved payload is `w1-payloads/ten-frame.build_pair.json`.

About 345 production lines, 170 test lines.

## Gates
| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| full tsc | 771, no error in any touched file (a peer session is editing at the same time, so the total is not comparable to the earlier 770) |
| new suites (`tenFrameBuildPair.test.ts`, `TenFrame.buildPair.workspace.test.tsx`) | 8/8 |
| math + live-activity + catalog + oracle suites | 6120 passed; the one failure was the catalog-order test, updated for the new mode (61/61) |
| journey sweep, real payload | 6 items, 0 findings, 6/6 misses named |
| real generation (`scripts/ten-frame-build-pair-probe.mjs`) | 3/3 clean: K "up to 5" [3,3,4,4,5,5]; K "within 10" [5,5,6,6,10,10]; G1 hard [4,4,6,6,9,9] |
| headless drive in the Math tester (`drive.mjs`, `drive.json`, `shots/`) | 22/24 |

The drive went: one over in two colours → miss → Try again kept 4 → took one off → pass ("2 + 1 = 3"). Item 2 then
showed the same pair → miss → `ways_shown` drew the learner's own way → `running_count` showed "Counters: 3" →
a different pair → pass.

The two failed checks:
1. The drive's leak regex flagged "Bright yellow circles are glowing right beside the red ones!" on the word "right".
   Here it means position, not a verdict, so this is a false flag. The other 4 watcher lines held no number and no
   verdict.
2. When the card is squeezed to 360 px, the cells render at 38 px, below the 44 px tap guideline. Every ten-frame
   mode uses the same frame, so this is not specific to `build_pair`.

## Not verified / open
- No Live run. The tutor's wording on the `[TF_PAIR]` verdict and on the stopped-building fact rides the next class
  Live gate.
- Ten-frame cells at phone width (above). This is a family fix, not part of this mode.
- `twoColorDecompositionsExplored` still counts only split's ledger, not build_pair's.
- Mixed (unpinned) sessions can now draw `build_pair`. That is the same open question as R4 for the wave-1 modes.
