# number-line levers: identify, plot, order, between (2026-10-08)

`/add-support-tiers`, class sweep (Phase 2 confirm waived by the user). Jump already had levers (2026-09-27 pilot). A
concurrent session added `build_hops` to the same files; nothing of it was changed here.

## Phase 1: what corrupted the evidence (fixed first)

The auto-zoom fitted each `plot_point` and `find_between` item to its own target, with a minimum window of
`range × 0.128`. So a plot target was always the middle tick of a window of about three ticks (0-10: target 2 shown
as 1..3), and an exact missing number (Grade-1 NBT001-01-a) was the centre of its window. Tapping the middle of the
line answered the item. The fix: plot and between fit the window to every item of their kind in the session
(`autoView`, `numberLineView.ts`); jump and order keep the per-item fit. Identify/plot payloads now show the whole
0-10 line; G1 exact windows stay local (span ≤ 30, unit ticks).

## Failure inventory

There is no real-learner evidence. The other evidence classes: the catalog `commonStruggles` (documented), and the
misses the line's own Check can see (inferred from the task, observed-synthetic on the dry journey).

| Mode | Miss (code) | Class |
|---|---|---|
| identify, plot | `one_short` / `one_past`: one grid step off (counting the 0 tick as 1, misreading a neighbour label) | documented (commonStruggles "far from target", level-2/3 "count tick marks") + synthetic |
| identify, plot | `off_by_more` | documented + synthetic |
| order | `reversed` (largest at the left) | documented ("which value is further left") + synthetic |
| order | `out_of_order` | inferred |
| between | `on_end` (on a given number: "between" read as inclusive) | inferred + synthetic |
| between | `outside` | inferred |
| between | `wrong_inside` (exact item, inside but not the number; fraction/decimal grid only) | inferred |

## Lever table (built)

| Mode | Miss | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|---|
| identify, plot, exact between | one_short, one_past, off_by_more / on_end, outside | `count_hops`: the learner's point counted in numbered unit hops from a label; before placement, hop 1 only | help | both | no hop the learner did not make reaches or passes the target (`countHopsLeak`); the start is a label, never the target |
| identify, plot | off_by_more | `nearer_number`: practice target half as far from the count start | simplify | shown | a different target, nearer the start, in view |
| order | reversed, out_of_order | `bigger_arrow`: an arrow under the line, "smaller" left, "bigger" right | help | both | marks no number; the fact has no digits |
| order | out_of_order, reversed | `fewer_numbers`: k-1 numbers, none from the item, listed out of order | simplify | shown | no value of the item; never listed sorted |
| between (legacy) | on_end, outside | `end_marks`: rings on the two given numbers | help | shown | never a mark between them (`endMarksLeak`) |
| between (legacy) | outside, on_end | `wider_gap`: a pair two farther apart | simplify | shown | gap > the item's, in view, not the item's pair |

Per-item gaps (lesson a): a target less than two from the count start has no model hop and no `nearer_number`; it
gets `count_hops` only after the learner places a point away from the start. A two-number order set has no
`fewer_numbers`. A legacy pair with four or more numbers between has no `wider_gap`. An exact missing-number item
gets no rings (they would leave the answer alone between them) and no simplify (n-1, n+1 is already the plainest
shape): `count_hops` only. Fraction and decimal lines get no levers.

Starting positions: easy starts with the item's help shown (`helpStartsShown`), not recorded as a pull.

## What was built

- `numberLineLevers.ts`: miss functions (`lineMiss`), `countStart`/`countModelHop`/`countHopsLeak`, `endMarks`/`endMarksLeak`,
  builders (`simplerPlot`, `fewerNumbers`, `widerGap`, `simplerItem`), `lineLevers`, `leverFact`, `helpStartsShown`.
- `numberLineView.ts` (new): ticks, labels and auto-zoom as pure code, so the component, the levers and the journey row
  read the same labels from the payload.
- `NumberLine.tsx`: lever state, pull and practice for the four modes, the three help renders, the miss on Check, the
  session-fitted zoom.
- `numberLineWorkspace.ts`: lever facts in the scene; learner work names the hops drawn.
- Catalog (`math.ts`): misses for identify/plot/order/between; `unanswered.between = ['wrong_inside']`.
- `liveJourneySpec.ts`: practice items rebuilt with `simplerItem`; order and between rows now drive (tap chip, then the
  line; one point inside). Baseline entries SW-1 and SW-2 deleted (fixed).
- Contract R15 + changelog.

## Results

- `numberLineLevers.line.test.ts`: 34/34 (miss tables, leak rules over every K-2 target on three label grids, builders
  over 40+ plot / 200+ order / every small between item, `nextLever` per miss, no lever on fractions).
- `NumberLine.lineLevers.workspace.test.tsx`: 8/8 (pull changes screen + fact in one commit, refused pull changes
  nothing, next try records the lever, practice ungraded then full item blank and credited, exact-between gets count
  hops only, easy start not a pull).
- Existing number-line suites: 23 files, 181/181.
- Journey sweep scoped to number-line (7 payloads): 7/7, every checked miss named, J9 clean.
- `typecheck:lumina`: 0 errors (final run).
- Not run: browser, `/eval-test`, tutor replay, Live. Should work; needs a browser check of the identify/plot window
  (whole line, target no longer centred) and the arrow/ring placement under the tick labels.

## Left without a lever

- between `wrong_inside`: fraction/decimal grid only, where no lever is built (catalog `unanswered`).
- Easy-tier between anchors from the generator (`buildAnchorsForChallenge`) sit strictly between the bounds, which is
  an answer on a legacy item. Not changed here; queue for `/eval-fix`.

## Addendum 2026-10-09: per-item gaps (J12), identify and jump

Two J12 rows (`qa/support-levers/QUEUE-item-gaps-2026-10-09.md`): a checked miss on a saved payload item with no
lever on that item. Both are item shapes where the existing help lever would draw the answer.

| Payload item | Miss (class) | Why no lever existed | Lever built | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|---|---|
| identify `plot_point-3` (place 0, placed 1) | `one_past` (synthetic; documented "far from target") | the target is the line's first label, so `count_hops` would start on the answer; no `nearer_number` either | `last_try`: a dashed ring on the learner's own last wrong point, kept after Try again | help | both (ring; the tutor says "you put it here") | the ring is only ever on a checked wrong point, never the target (`lastTryLeak`); declared only where `countStart` is null |
| jump `show_jump-2` (3 back 1, placed on 3) | `wrong_direction` (synthetic; R13 misconception "start counting") | a jump of 1 has no model hop (hop 1 is the landing); a placement on the start leaves no hop to number; `ceil(1/2)` gives no simpler jump | `which_way`: a short arrow at the first start pointing the jump's way, 0.4 of a unit long | help | both | starts at the item's first start, tip under half a unit away (`wayArrowLeak`); declared only on a first jump of 1 (longer jumps already show the way with model hop 1) |

Neither has a simplify lever: both items are already the plainest shape of their mode (a single target at the line's
start; a single jump of 1). `last_try` is the weaker of the two: it shows the learner where their own try was, not how
to find 0; the step from "my point is on 1" to "0 is the one before" stays with the learner, as it must. Easy tier now
also starts a jump of 1 with `which_way` shown (with `numbered_hops`), not recorded as a pull.

Built: `numberLineLevers.ts` (`wayArrow`, `wayArrowLeak`, `which_way` in `jumpLevers`; `lastTry`, `lastTryLeak`,
`last_try` in `lineLevers` and `leverFact`), `NumberLine.tsx` (wrong-point state kept across retry, both pulls, both
renders, the arrow fact), `numberLineWorkspace.ts` (a jump's lever facts combine). Catalog unchanged (both misses were
already listed). Journey baseline: both number-line J12 entries removed.

Results: `numberLineLevers.test.ts` + `.line.test.ts` 58/58 (arrow leak over every K-2 jump, ring never on the
target, `nextLever` on both payload items); `NumberLine.levers.workspace.test.tsx` + `NumberLine.lineLevers.workspace.test.tsx`
22/22 (pull changes screen and fact in one commit, refused pull changes nothing, next attempt records the lever, lever
cleared on the next item); all number-line suites 23 files 191/191; journey sweep scoped to number-line 7/7 with the
J12 entries gone; `typecheck:lumina` 0. Not run: browser, tutor replay, Live. Should work; needs a browser check of the
arrow and ring placement.
