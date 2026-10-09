# measurement-tools levers, all modes (2026-10-09)

`/add-support-tiers` on measure, compare, estimate and convert, in the same run as the W1 binding
(`qa/tutor-reports/measurement-tools-w1-2026-10-09.md`). Non-interactive batch run: the lever table was built without
stopping for review.

## Failure inventory

- **Real-learner evidence:** none (no demonstrations, misconception reports or remediation modules name the primitive).
- **Synthetic:** the journey's scripted wrong answers (one unit over, a whole number for a half, the measured number
  kept instead of converted, the order reversed).
- **Documented:** the catalog tutoring block's `commonStruggles` (counting from 1 instead of 0; not aligning to 0;
  reading between marks) and the convert feedback text (multiply vs divide).
- **Observable side:** every miss below is named by `measurementMiss`. Not aligning to 0 cannot happen: the shape
  snaps with its left edge at 0, so it has no miss and no lever.

| Mode | Misses (class) |
|---|---|
| measure, compare shapes | one_over (synthetic + documented: counting from 1), one_short, too_long, too_short (inferred) |
| estimate | whole_not_half (synthetic + documented: reading between marks), one_over, one_short, too_long, too_short (inferred) |
| convert | the measure misses, then same_number (synthetic), wrong_operation (documented), too_small, too_large (inferred) |
| compare ordering | longest_first (synthetic), two_swapped, out_of_order (inferred) |

**Evidence corrupted, fixed first:** the generator sorted the shapes shortest first, so compare's ordering buttons
listed the answer top to bottom; and the hard tier's wrong-conversion card stated the rule the tier hides. Both fixed
in the W1 slice (contract R2, R3).

## Lever table (built)

All levers are drawn (`carrier: shown`) and write no number.

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| reading (all) | `space_shading`: every other unit space tinted, the whole ruler | help | one_over, one_short | Runs the ruler's full length, never stops at the shape; no text added (test: text unchanged). |
| reading (all) | `edge_line`: dashed line from the shape's right edge across the ruler | help | one_over, one_short, too_long, too_short (+ whole_not_half on estimate) | No label. Refused until the shape is on the ruler. |
| estimate | `half_marks`: half ticks taller and brighter | help | whole_not_half | No label added (a "label every half" lever was rejected: it newly prints the key, J13). |
| measure, compare, estimate | `shorter_shape`: a shorter practice rectangle (3 or 2; 1.5 on estimate) | simplify | too_long, too_short (+ whole_not_half) | `practiceLeaks`: never the item's id, length or a session label; shorter; estimate keeps the half. None on a 1-2 unit item. |
| convert, step 2 | `inch_model`: a one-inch bar over a centimeter scale, outside the item | help | same_number, wrong_operation, too_small, too_large | Words only, no digit; never the item's length. |
| convert | `smaller_length`: practice measure-and-convert of one inch (or five cm) | simplify | the measure and convert misses | `practiceLeaks`; none on a cm item of 5 or less. |
| ordering | `order_steps`: wordless bars growing short to long | help | longest_first | Fixed bars; marks no shape. |
| ordering | `own_lengths`: each button shows the length the learner measured and had checked | help | two_swapped, out_of_order, longest_first | Only lengths already checked right and shown earlier; no order is stated. |
| ordering | `three_shapes`: three practice shapes 6/10/2, listed out of order | simplify | two_swapped, out_of_order | `practiceLeaks`: no session label; never listed shortest first. Only when the session has >3 shapes or two within one unit. |

**Starting positions:** the generator's existing tier harness (ruler label density, method text, conversion hint)
stays the starting position. No new tier code.

## What was built

- `measurementToolsLevers.ts`: declarations, practice builders, `practiceLeaks`, `leverTextLeaks`, `leverFacts`,
  `practiceParent`.
- `MeasurementTools.tsx`: lever state keyed by the session item; a practice item (shape or ordering) renders in place
  of the session item with a "Practice" marker; `pullLever` / `endPractice` on `workspace.current`; `onScreen` and
  `practice` scene facts; Ruler `shadeSpaces` / `halfMarks`; edge line; `InchModel`; `OrderSteps`; own-length tags.
- `measurementToolsWorkspace.ts`: an ordering item may carry its own practice shapes (`orderShapes`).
- Catalog `levers: true`; journey row rebuilds `~simpler` items; contract R5.

## Gates

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| `measurementToolsLevers.test.ts` | 29/29 (builders over every generator width and compare orderings, leak rules, miss → lever, every catalog miss answered) |
| `MeasurementTools.levers.workspace.test.tsx` + `.workspace.test.tsx` | 6/6 + 9/9 |
| journeySweep + workspaceContract + misses + activityContract + lessonWorkspacePlan + MathWorkspaces.surface | 9 files, 3141 passed. measurement-tools: 0 findings on all 4 payloads (J1-J13); misses 17/17 named; J10 clean 100, J11 recover 67; lever inventory: every miss answered by an item lever |
| tutor replay (gemini-3.8-flash, 4 payloads × 5 samples, r5) | 0 check misses on every check, `stuck no_change_before_receipt` 0/20, `lever` 0/20. Read by hand: stuck replies pull the lever first and describe it after the receipt; lever replies say what to look at and ask ("Which mark does that line point to?", "will 10 inches have more centimeters or fewer?"). None names a length. Saved `qa/tutor-reports/replay/measurement-tools-2026-10-09-r5.json` |

## Failures with no lever

None by mode. Per item: a 1-2 unit shape and a cm item of 5 or less have no simplify, and three far-apart shapes
have no ordering simplify; their help levers answer every miss. Real-learner evidence is still zero.
