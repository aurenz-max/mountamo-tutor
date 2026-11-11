# K Mathematics audit, 2026-11-10

Scope: `MATHEMATICS`, grade K, 166 published subskills in 6 units (`snapshot.json`, sha256 `a111a199…6a4c7278`).
The subskill set and text are identical to the September atlas in this folder (`review.json`). Model spend: $0 (no
model was called). Records and routes: `audit.json`.

Method: four read-only agents (one per unit or unit pair) wrote an action, evidence and access line for every
subskill and routed the families from the live catalog, the canvas specs and the agent kit. Level 2 means a
generator or component read confirmed the action and the scoring, or a 2026-09-09 atlas probe for that subskill's
mode passed every content check. The main session merged 8 families that two units had named in different words
(sorting, ordinal places, counting back, comparing groups, ordering picture cards, patterns) and confirmed the cap
findings below in code. It moved TIME001-03-C down to level 1: its probe passed, but the clock defect below blocks its
objective. The subitize panel's four records carried over unchanged.

## Score

**90 of 166 at level 2 (54%). 0 played. 0 served.** 70 are at level 1 and 9 at level 0.

| Unit | Subskills | Level 2 | Level 1 | Level 0 |
|---|---|---|---|---|
| Counting and Cardinality | 37 | 17 | 20 | 0 |
| Operations and Algebraic Thinking | 21 | 16 | 5 | 0 |
| Geometry | 13 | 9 | 4 | 0 |
| Measurement and Data | 59 | 29 | 25 | 5 |
| Patterns and Sorting | 20 | 8 | 8 | 4 |
| Time and Calendar | 16 | 11 | 5 | 0 |

| Route | Subskills | At level 2 |
|---|---|---|
| specialist | 123 | 88 |
| repair | 22 | 2 |
| add-mode | 13 | 0 |
| canvas-new | 6 | 0 |
| ambiguous | 2 | 0 |

The 35 specialist subskills at level 1 are routed from catalog text and have not had a code read. Each one needs a
`verify <id>` read, not a build.

K math is different from K Language Arts. Every strand already has a specialist with the child's hands (counting
board, number sequencer, ten frame, number bond, comparison builder, measure lab, length lab, sorting station,
pattern builder, analog clock, calendar). The gaps are caps and missing modes on those primitives, and only 6
subskills need a canvas.

## Class finding: K caps below the objective

Seven primitives fix a K band that is lower than the numbers the objective names. Confirmed in code:

| Primitive | Cap | Objective | Subskills |
|---|---|---|---|
| number-tracer | K digits 0-9 (`gemini-number-tracer.ts:368, 510`) | write 0-20 | COUNT001-01-B |
| number-bond | K bonds to 5 even when `maxNumber` is set (`gemini-number-bond.ts:552, 671`) | within 10 | OPS001-02-G |
| number-sequencer | K counts forward only, values clamped to at least 1 (`gemini-number-sequencer.ts:841`) | count back 10 to 0 | COUNT001-02-H, OPS001-03-A |
| comparison-builder `compare_numbers` | K numerals to 10, so every 11-20 pair becomes 10 vs 10 | compare 11-20 | COUNT001-03-G |
| counting-board | `give_me_n` asks for 2-6 from a pile of 12; group counting is G1 only | count out teens; count by 2s | COUNT001-02-D, -02-F |
| sorting-station | K 4-6 objects | up to 10 per group | MEAS001-02-C |
| analog-clock | K grid is 30 minutes, with no whole-hour grid (`analogClockItemSpace.ts:30-37`) | o'clock | TIME001-03-C, -E, -F |

These are one fix applied to each primitive: the generator reads the objective's window through the shared
`resolveScopeRange` (comparison-builder has used it since CB-5) and keeps the grade band only as the default. The
atlas probes for `give_me_n` and clock `read` passed because their checks never test the cap.

## Canvases to build

| Rank | Family | Action | Subskills | Cost |
|---|---|---|---|---|
| 1 | MD29 sand-timer race | run timer, compare two activity durations | MEAS001-04-G, -07-B, -07-D | new program |
| 2 | G5 solid shapes test | roll, slide, stack solids, then sort | GEOM001-02-E | new program |
| 3 | MD28 growing bean | measure a plant with cubes each day | MEAS001-04-F | new program |
| 4 | MD27 thermometer zones | read or set a thermometer level | MEAS001-06-D | new program |

The objective records (objective, not credit, misconceptions, progression, evidence) are on each family in
`audit.json`. **None was built.** Math canvases are already waiting on your play: `two-ways` (G1 panel B) and
`ring-the-tens` (G1 panel A). The audit rule holds the build until those are played.

## Converge

No strand needs a new specialist primitive. One strand is recorded so that no canvas is built for it:

| Strand | Signals | Target | Executor | Canvases absorbed |
|---|---|---|---|---|
| CV1 sorting and classifying, 21 subskills (MEAS001-01/02/08, PTRN001-02) | same world in 8 families; a large share of two units; levers and named misses already on the primitive | `sorting-station`: draw cards at their real size for size sorts, a K window up to 10, credit for the child's own valid rule, a say-the-rule turn | `/eval-fix`, then `/add-eval-modes` | none |

Size sorts today test what the child knows about the objects, not what they see: every card is drawn at the same
emoji size (`SortingStation.tsx`).

## Modes to add

- `counting-board` count-to-numeral 0-10, including zero (COUNT001-01-A)
- `length-lab` measure several objects, then compare by count (MEAS001-01-D, -05-F)
- `measure-lab` empty or full, and which of two identical containers holds more (MEAS001-08-A, -08-B)
- `bar-model` predict, then collect (MEAS001-03-F)
- `time-sequencer` order three activities by duration (MEAS001-07-C; the key is world knowledge the model writes); missing middle step (PTRN001-03-E)
- `pattern-builder` copy a model row (PTRN001-01-B); fill the gap (PTRN001-01-E)
- `sorting-station` say the rule (PTRN001-02-B, -F, -G)

## Repairs (besides the caps)

- `counting-board` `recount_moved`: object size never varies, which COUNT001-02-C asks for
- `strategy-picker`: the K strategy set leaves out doubles and has no ten-frame strategy (OPS001-01-F)
- `shape-tracer` trace and complete refuse a wrong tap instead of scoring it (`shapeTracer.card.ts:10-12`) (GEOM001-02-D)
- `pattern-builder` create: no ABC or AABB at K, and no rule turn (PTRN001-01-G)
- `sorting-station` `sort_attribute`: a valid rule the child chose counts as the `other_rule` miss (PTRN001-02-E)
- `time-sequencer` time-of-day: no evening at K, no sun picture, and an invalid period turns into "morning" in the answer key (TIME001-01-A)
- `analog-clock` `set_time` at K: fix the minute hand at 12 (TIME001-03-E)

## Ambiguous curriculum

- PTRN001-03-B, -03-D: copy, repeat or make up a body-movement sequence (clap, jump). Nothing in Lumina takes body
  movement as input. Your call through `/curriculum-author`: restate it as a sequence of picture tokens, or mark it a
  classroom observation.
- COUNT001-01-B also asks for number words ("seven"). No mode writes them; whether a K child is asked to is a
  curriculum question.

## Atlas rows now out of date

`number-sequencer` has `spot_error` (COUNT001-01-G is now level 2). `shape-sorter` has `find_real_object`.
`bar-model` has `say_what_it_shows` and `compare_two_graphs`. `calendar-explorer` has `day_sequence`, `day_offset`,
`interval_count` and `mark_events`. The weight hint `balance-scale` (MEAS001-04-D) is wrong: `measure-lab
balance_predict` is the weight mode.

## Not verified

- No generation was run. The level-2 subskills that rest on probes rest on 09-09 draws; their generators have changed
  since.
- Nothing was played, and nothing was served through a manifest.
- No voice path was tested. `ordinal-line` `sequence_story` says the child "reads" the story; whether a pre-reader
  hears it read aloud needs `/reader-fit`.

## Build, 2026-11-11

Every item above except the level-1 `verify` reads and the ambiguous-curriculum rulings is built, uncommitted.
The caps go through one new shared helper, `resolveObjectiveRange` (`service/objectiveNumberWindow.ts`): it reads the
range the objective names and returns null when none is named, so the grade default stays. The four canvases pass
`canvas-check` and are not promoted. `test:primitive` passed on all 14 changed primitives; `typecheck:lumina` is 0;
about 40 real generations cost $0.21. Nothing has been played in a browser or with the Live tutor. Status and next
steps: `WORKSTREAMS.md` row 24.
