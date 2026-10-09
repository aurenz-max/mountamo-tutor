# shape-tracer levers, 2026-10-09

/add-support-tiers on the W1 binding (`qa/tutor-reports/shape-tracer-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or eval reports for shape-tracer). Classes: synthetic
(journey scripted wrongs), documented (catalog `commonStruggles`), inferred.

| Mode | Failure | Class | Observable as |
|---|---|---|---|
| trace | taps corners out of turn | documented | refused tap (not checked) |
| trace | cannot see where the outline goes / which corner is next (hard tier hides all guides) | inferred | refused taps |
| complete | does not see where the shape closes | documented | refused tap (not checked) |
| connect_dots | starts at another number | synthetic | `started_elsewhere` |
| connect_dots | skips a number | documented | `skipped_number` |
| connect_dots | taps a dot already joined | inferred | `went_back` |
| draw_from_description | too few / too many corners for the clue | documented | `too_few_sides`, `too_many_sides` |
| draw_from_description | right count, sides not one length when the clue asks | inferred | `sides_unequal` |

## Lever table
| Mode | Lever | Kind | Answers | Carrier | Leak rule |
|---|---|---|---|---|---|
| trace | `dotted_outline` | help | (no miss) | shown | the corners and the shape are on screen; the path is not a secret |
| trace | `order_numbers` | help | (no miss) | both | as above |
| trace, complete | `next_glow` | help | (no miss) | shown | never on connect-dots (`glowOffered`) |
| complete | `dotted_outline` (new render) | help | (no miss) | shown | as trace |
| connect_dots | `number_strip` (new) | help | started_elsewhere, skipped_number | both | marks no dot on the canvas |
| connect_dots | `fade_joined` (new) | help | went_back | shown | refused while no dot is joined |
| draw | `corner_rings` (new) | help | too_few_sides, too_many_sides | shown | the clue's count against the learner's own |
| draw (equal-sides clue) | `side_bars` (new) | help | sides_unequal | shown | the learner's sides only; refused under two corners |
| all | `simpler_item` | simplify | the mode's misses | shown | `practiceLeaks`: never the item's corners, dots or clue; less to do |

Simpler items: trace and connect_dots, a triangle (none on a three-corner item); complete, another shape with one open
corner (none when one is open); draw, a three-sided clue with no equal sides (none when that is the clue).
Starting positions: the generator's tier guides (outline, numbers, glow) are declared pulled when on. No new generator
starting positions: the new levers have no tier field, and adding one was not needed for any miss.

No-lever cases: none. trace and complete have no checked miss, so their levers answer no miss id; the tutor pulls them
on `when` text after refused taps or "I'm stuck".

## Gates
- `typecheck:lumina`: 0.
- `shapeTracerLevers.test.ts` 17/17, `ShapeTracer.levers.workspace.test.tsx` 6/6, `ShapeTracer.workspace.test.tsx`
  10/10; with workspaceContract, misses, activityContract, lessonWorkspacePlan: 2352/2352.
- Sweep (filtered to shape-tracer, 4 payloads): 0 findings J1-J13; misses named 10/10; lever inventory every miss
  answered (J9), per item (J12, also unit-tested over every payload item).

## Tutor replay (text, gemini-3.8-flash, 4 payloads x 5, `replay/shape-tracer-2026-10-09-r3.json`)
0 misses on every check, `no_change_before_receipt` 0/10. Read by hand: on a miss or "stuck" the tutor pulls the
answering lever itself (number_strip, corner_rings) and points to it after the receipt. connect-dots stuck replies
say "find the dot with number 1"; that item's instruction lists 1, 2, 3, so it is the ask. The replay's key list is
empty after the W1 task change, so no_key is read by hand only.

## Open
- Browser check owed on the strip, rings, bars and ticks (only jsdom so far).
- trace/complete refused taps are not checked, so no miss names them and the observer's auto-pull never fires there;
  the tutor reads the refusal from `learnerWork`.
