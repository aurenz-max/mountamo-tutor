# number-tracer levers (2026-10-08 class sweep)

`/add-support-tiers` on number-tracer, modes trace, copy, write, sequence. The Phase 2 confirmation stop was waived for this sweep.

## Failure inventory

| Mode | Failure (miss id) | Evidence class |
|---|---|---|
| all | `shape_off`, `part_left_out` (geometry, no trusted judge reading) | observed-synthetic (journey sweep: the trace drawn 160 px off the guide gives `shape_off`) |
| all | `other_numeral`, `digits_swapped`, `not_readable`, `poorly_formed` (the vision judge's reading) | documented (`numberTracerMiss`, catalog `commonStruggles`: "score below 50% on trace", "strokes in wrong order", "sequence off by one") |
| sequence | off-by-one number in the gap | documented (`commonStruggles`) |

There is no real-learner evidence. Demonstration logs, tutor reports and misconception reports have nothing for this primitive. `numberTracerRemediation.ts` covers between-item remediation only. The miss function already existed, so none was added. No contract doc exists (`docs/contracts/number-tracer.md`).

## Lever table

| Mode | Lever | Kind | Answers | Carrier | Leak rule |
|---|---|---|---|---|---|
| trace | `ghost_path` dotted numeral on the canvas (starts pulled unless the tier withdrew it) | help | shape_off, other_numeral, not_readable, digits_swapped, part_left_out | shown | none needed: trace shows the numeral by design |
| trace, copy, write | `start_dots` green dot at each stroke start, numbered in drawing order | help | shape_off, poorly_formed, not_readable, other_numeral, digits_swapped | shown | points only, never a stroke's shape |
| trace | `stroke_arrows` arrows along each stroke | help | poorly_formed, shape_off, part_left_out | shown | trace only |
| write | `first_part` opening of the first stroke, dotted | help | part_left_out, shape_off, poorly_formed, not_readable, other_numeral | shown | at most a third of the numeral's points, a prefix of stroke 1, never the whole stroke (`firstPartLeaks`) |
| copy | `model_strokes` the model drawn as its strokes (numbered start dot and arrow on each) in the model panel | help | poorly_formed, shape_off, part_left_out, not_readable, other_numeral | shown | stays off the canvas, so copy does not become trace |
| sequence | `count_dots` a row of dots under each shown number | help | other_numeral, not_readable | shown | no dots under the gap; runs up to 20 only; the fact has no digits (`countDotsLeak`) |
| trace | `trace_part` practice: one stroke, or the first half of a one-stroke numeral, checked by geometry alone (≥70) | simplify | all six | shown | not applicable: trace has no hidden answer |
| copy, write | `one_digit` practice: the first digit alone (numbers ≥10 only) | simplify | poorly_formed, shape_off, part_left_out, not_readable, digits_swapped, other_numeral | shown | never the source number |
| sequence | `count_on_run` practice: a run of the same length with the last number missing | simplify | other_numeral, not_readable, digits_swapped | shown | the run never shows or asks this item's answer (`runLeaks`); not offered when the gap is already last |

**No lever:** on sequence, `poorly_formed`, `part_left_out` and `shape_off` have none. Any guide for forming the numeral would draw the hidden answer (NT-7). These three are listed in the catalog's `unanswered.sequence`.

**Per item:** every checked miss has a lever on every item, including easy-tier items where every guide starts pulled. The exceptions are the three sequence misses above. Unit tests check this over numerals 0–20 plus 101 and 120 in trace, copy and write, and over sequence runs starting at 0–16.

**Reach on the saved payloads:** `trace_part` is offered on 5 of 5 trace items and `count_on_run` on 5 of 5 sequence items. `one_digit` is offered on none: all K payloads use single digits. It applies only to Grade 1 copy and write numbers 10–120.

## Built

- `numberTracerLevers.ts` (new): the lever declarations, starting positions, facts, leak rules and the three simplify builders.
- `NumberTracer.tsx`:
  - Lever state and practice state live in the component, keyed by item.
  - The tier's painted guides become the levers' starting positions (pulled, never recorded).
  - Canvas guides paint from tier plus pulls, exposed as `data-guides` on the canvas.
  - New renders for `model_strokes` and `count_dots`.
  - A `strokePart` geometry-only check.
  - A practice check writes no session result and no response record.
  - The workspace publishes `levers`, `pullLever`, `endPractice` and `onScreen`/`practice` facts.
- Catalog: `unanswered: { sequence: [...] }`.
- `liveJourneySpec.ts`: the trace row rebuilds a `~simpler` item from its parent with `tracePart`.
- No generator change. `config.difficulty` already sets the guides each tier paints, and those are now the levers' starting positions.

## Tests

- `numberTracerLevers.test.ts`: 123 pass. Covers lever sets, per-item miss coverage, the `nextLever` table, the three leak rules, and the builders over many items (the sequence builder over 400 random runs).
- `NumberTracer.levers.workspace.test.tsx`: 5 pass, all mounted through `workspaceHarness`:
  - A trace help pull changes the canvas guides and `onScreen` in one commit.
  - The next attempt records the lever.
  - A refused pull leaves demand, levers, attempts and HTML unchanged.
  - `trace_part` opens an ungraded practice item, then the full item comes back blank and is credited.
  - Write `first_part`, copy `model_strokes`, sequence `count_dots` and `count_on_run` each change what is on screen.
- Existing number-tracer tests (13 files, 187 tests) pass. `workspaceContract` and `observerLever` pass with the number-tracer filter.
- `typecheck:lumina` = 0.
- Not run, per the sweep brief: journey sweep, tutor replay, Live.
- Needs a browser check: what the canvas paints (dots, arrows, first part). jsdom has no 2D context, so the tests read `data-guides`, not pixels.
