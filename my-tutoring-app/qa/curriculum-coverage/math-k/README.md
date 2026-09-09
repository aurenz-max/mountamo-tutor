# K Mathematics coverage audit

Open [the HTML atlas](index.html). It is the primary report: 166 live published K
Mathematics requirements (6 units), an explicit primitive/mode review for every row in
both directions, 40 real generation draws over 20 requirement/mode pairs with code-judged
content checks and readable task previews, and a 21-item development queue with modality
prescriptions and acceptance examples. The grade/subject matrix links to the
[K Language Arts atlas](../index.html); that pilot's decisions were not inherited.

2026-09-09 scope: **137 direct candidates, 24 partial fits, 5 development requirements**
(115/43/8 before the slice-7 re-point earlier today; 111/47/8 after slice 5; 91/67/8 at the
09-07 review). These are catalog capability findings, not verified learning outcomes. 26 probed
pairs, all with current draws: the original 21 were REDRAWN on 2026-09-09 against the current
generators and five pairs were added for the slice-7 modes (bar-model `build_one_to_one`,
counting-board `give_me_n`, measure-lab `balance_predict`, analog-clock `hand_name`, length-lab
`estimate_then_tile`). 48 of 52 draws sampled clean; the four failing draws were one finding
(CB-5, below — fixed 09-09). Two slice-7 residuals found by the new pairs (CNB-1, AC-7) were fixed the same
day and redrawn clean. Live tutor interaction and the microphone were not driven.

**Provenance note.** A draw's provenance now hashes the primitive's OWN catalog entry
(`catalog-entry:<id>`), its generator and its component, never the whole `math.ts`. Under the
old whole-file hash every K Math pair read "source changed" after any slice-7 birth, which is
why the 09-09 redraw was taken: every pair now carries current evidence. A pair goes stale only
when its own entry, generator or component changes.

## What the probes found

Confirmed in both draws unless noted. Each was a work item in the atlas queue; the state is
the 2026-09-09 redraw.

- ~~**P0 answer leak.**~~ **CLOSED (slice 1).** `number-sequencer / count_from` recited its
  answers in 10/10 instructions. Redraw: the easy tier models one step ("Start at 3. The next
  number is 4. Keep counting."), 0/10 leaks.
- ~~**P0 teen numbers.**~~ **CLOSED (slice 2)** by an eval-mode FORK, not by widening the K
  frame cap: `ten-frame` gained `build_teen` / `decompose_teen`, `number-bond` gained
  `ten_and_ones`; the seven K.NBT.1 rows are candidates. Redraw: 18/18, 16/16 and 18/18 checks.
  Why the in-place edit was refused: `qa/primitive-contracts/ten-frame-check-2026-09-08.md`.
- ~~**P1 caps below the published objective.**~~ **CLOSED (slice 3)** for `ordinal-line`
  (redraw: maxPosition 10, ten characters, targets sixth through tenth) and
  `addition-subtraction-scene` (redraw: maxNumber 10, results to 8), both through an objective
  window read from the text, grade kept as the default. `math-fact-fluency / missing_number`
  was a routing question, not a cap: the missing difference is `equation_solve` by design and
  the review pairs both modes (slice 6 fixed the tier preference; redraw alternates the blank).
  Still open in this family: `strategy-picker` carries the same K=5 policy and was not edited.
- ~~**P1 repetition.**~~ **CLOSED (slice 4)**: code owns the pooled counts, the blank index
  and the interval pool. Redraw: five distinct `fill_missing` lines with blanks in three
  positions; `hundreds-chart` pool `[2,5]` with no by-10s drift; `compare_groups` pairs differ
  across draws with an equal case in each. Two residuals: HC-5 (a two-interval objective has
  exactly two distinct problems, under the three-item floor) and CB-5 below.
- ~~**P1 above-band demand.**~~ **CLOSED (slice 5).** `time-sequencer / sequence-3` told a K
  child to read the clock time on each card; the tier resolver now takes the band and the K
  scaffold is a sun-position cue. Redraw: 0/10 items mention a time. The spoken half (hearing
  the tutor name the sky strategy) is still owed. [report](../../reader-fit/time-sequencer-PRE-2026-09-08.md).
- ~~**P2 framing and yield.**~~ **CLOSED (slice 6).** Redraw: `calendar-explorer / identify`
  frames every question on a marked today; `sorting-station` shows hot, warm and cold in every
  challenge (the collapse was the easy tier's group count overriding the named set, not
  variance); `compare-objects` returns six and seven items.
- ~~**NEW on the redraw, P1 (CB-5).**~~ **CLOSED 2026-09-09.** `comparison-builder /
  compare_groups` varied its counts but rolled them over the K band (1-10) instead of the
  objective's window: COUNT001-03-A and MEAS001-02-B both name groups of UP TO 5, and 13 of 20
  comparisons exceeded it (5v9, 10v4, 3v8). The pool anchors now sit inside the range the
  objective names, read by the shared `resolveScopeRange` micro-call — a schema, not a regex,
  which is what reads the 6-10 FLOOR in COUNT001-03-B that a ceiling-only parse cannot. Post-fix
  draws: A x2 and MEAS001-02-B every count in 1-5, B (easy and medium) every count in 6-10, all
  5/5 distinct with an equal case; a K objective naming no range still spans 1-10.

Two catalog constraints were overturned by the draws and the review was updated:
`hundreds-chart` honors "2s and 5s to 50" at K (it self-promotes the band), and
`pattern-builder / create` emits clean AB creation at K although its text says grades 2-3.

Legacy `target_primitive` labels on the published rows are provenance only. Twenty-two of
them name `knowledge-check` and three name `balance-scale` for weight comparison; the
review routes none of those as recommendations (balance-scale balances equations).

## Reproduce

Run from `my-tutoring-app`, in order, with the backend on 8000 and the frontend on 3000:

```text
node scripts/curriculum-coverage-snapshot.mjs --scope math-k
node scripts/curriculum-coverage-catalog-diff.mjs --scope math-k  # what changed in the catalog since the export (the basis note)
node scripts/curriculum-coverage-basis.mjs --scope math-k        # first time only; --refresh --note after reviewing that diff
python scripts/curriculum-coverage-review-math-k.py
node scripts/curriculum-coverage-probe.mjs --scope math-k        # keeps stale draws; --redraw replaces them
                                                                # (--only <ids> limits a slice's redraw)
node scripts/curriculum-coverage-check.mjs --scope math-k
node scripts/curriculum-coverage-artifact.mjs --scope math-k
node --test scripts/curriculum-coverage-artifact-math-k.test.mjs
```

Scopes live in `scripts/lib/curriculum-coverage-scopes.mjs` (probe pairs, per-primitive
source hashes, catalog files frozen by the basis). The math basis freezes only
`math.ts`, `di.ts`, `calendar.ts`, `assessment.ts`, `core.ts` and `index.ts`; the review
asserts every edge cites one of them, so another subject's catalog edit cannot stale it.
Content checks are in `scripts/lib/curriculum-coverage-checks/math-k.mjs`; every check
names the curriculum demand it enforces. `review-basis.json` is frozen: never refresh it
to silence a stale-review error; review the changed rows first, then `--refresh --note`.

Band-floor policy for this review follows the standing ruling that a generator cap below
what the published objective names is a repair, not a curriculum problem. **That re-audit
ran on 2026-09-08** ([report](../../reader-fit/k-band-floor-2026-09-08.md)): twelve floored
modes each got a verdict, ten floors came down (sorting-station ×5, `compare-objects /
order_three`, `length-lab / order`, `time-sequencer / sequence-5, before-after,
duration-compare`) and two HELD as WRONG-BAND at PRE — `number-bond / fact_family` types
four equations, and `time-sequencer / read-schedule` reads printed clock times as its task.
Three rows still sit behind those two holds.

## Execution plan (2026-09-08)

Each queue item in the atlas now carries a "Where it originates" note (file and line of
the cap, leak or repetition) and a slice number. Slices are ordered by what reaches a K
student first and grouped so one generator edit closes several rows. Every slice ends with
`--redraw` of its pairs, `curriculum-coverage-check.mjs`, an atlas rebuild and the tests.

| Slice | Items | Executor | Edit shape |
|---|---|---|---|
| 1 — CLOSED 2026-09-08 | `count-from-answer-leak` | `/eval-fix number-sequencer` | Easy tier models one step, not three (`gemini-number-sequencer.ts:133`); post-parse leak validator; contract line 86-87 amended so continuation values fall under the answer-leak rule. |
| ~~2~~ | ~~`teen-numbers-ten-plus`~~ **DONE 09-08** | — | Shipped as forecast: `build_teen` / `decompose_teen` on the double frame and `ten_and_ones` with a 10 + n accept set; the seven edges are re-pointed and all seven rows are now CANDIDATE. Two additions the plan did not forecast: the teen numbers are code-owned (`teenWindow.ts`) because the model drifted below the objective's window, and `decompose_teen`'s group is SCATTERED because a top-frame-first seed would be solvable without counting. |
| ~~3~~ | ~~`ordinal-to-tenth`, `k-story-problems-within-10`~~ **DONE 09-08**, verified on the 09-09 redraw | — | Shipped as forecast: an objective window read from the text raises the K cap, grade kept as the default (ordinal-line maxPosition 10 with ten characters; scene maxNumber 10). Control draws with no window keep 5. Report: `qa/eval-reports/objective-window-caps-2026-09-08.json`. Not done: `strategy-picker` still carries K=5; OPS001-01-F stays partial and the item stays open for that half. |
| ~~4~~ | ~~`k-session-variety`~~ **DONE 09-08**, verified on the 09-09 redraw | — | Shipped as forecast: pooled counts (`/add-number-pool-service`), code-chosen blank index with duplicate rejection, interval pool narrowed to what the lesson names. Two defects fixed on the way (comparison-builder took its band from Gemini; a hundreds-chart fallback hint leaked the skip value). Report: `qa/eval-reports/k-session-variety-2026-09-08.md`. Residuals: HC-5 (two-interval objectives yield two problems) and CB-5 (pool ignores the objective's "up to 5"), the latter queued as `compare-groups-objective-window` and **CLOSED 09-09**. |
| ~~5~~ | ~~`time-sequencer-k-prereader`, `k-band-floor-reaudit`~~ **DONE 09-08** | — | Shipped as forecast: `resolveSupportStructure` takes the band, and at K the easy scaffold is a sun-position picture derived from the same `typicalTime`. Twelve floored modes got a verdict each before any floor moved; ten came down, two held. Three things the plan did not forecast: the sun cue is a POSITION on a challenge-windowed strip rather than a sky emoji (three events in one morning would otherwise share one picture); it is WITHDRAWN when the times disagree with `correctOrder`, because a scaffold that can lie is worse than none; and `sequence-5` was silently returning three cards, which had to be fixed for the floor move to deliver anything. |
| ~~6~~ | ~~`missing-difference-form`, `calendar-today-framing`, `k-draw-yield-variance`~~ **CLOSED 2026-09-08** | — | Shipped as forecast on three of four; the fourth was misdiagnosed in this plan. `sorting-station` did not need a yield fix — the easy tier's "about 2 groups" was overriding a three-group objective, so the named set now sets the bin count. `todayDate` went on the CHALLENGE type, not the Gemini schema: a today-framed identify set has nothing generative in it and is built in code. |
| 7 — IN PROGRESS | see the slice-7 status table below | `/add-eval-modes`, `/primitive`, `/curriculum-author` | New task identities, not edits in place. Five of eleven shipped, re-pointed in the review and carrying their own atlas draws (K data graphs, counting-board family, measure-lab birth, analog-clock parts, length-lab extensions); the two catalog-text refreshes are done; six not started. |

### Slice 7 status (2026-09-09)

Shipped means the modes are in the live catalog with an eval report; re-point means the review
edges for the item's rows still cite the old modes, so the rows keep their prior verdict until
the shipping slice re-points them and rebuilds the atlas.

| Item | Rows | State | Evidence |
|---|---|---|---|
| `k-data-recording` | 9 | **Shipped + re-pointed**: `bar-model` `build_one_to_one`, `read_one_to_one`, `most_least`, `match_to_bar`; 7 rows candidate | 16/16 slice draws + Chrome drive (`qa/eval-reports/bar-model-k-data-2026-09-08.json`); atlas pair MEAS001-03-D 2/2 clean. Open on this item: a spoken say-what-the-graph-shows turn (MEAS001-03-G) and a two-graph comparison (MEAS001-09-E). |
| `counting-extensions` | 5 | **Shipped + re-pointed**: `counting-board` `give_me_n`, `recount_moved`, `add_more`, `take_away`, K route for `count_on`; 4 rows candidate | 15/15 slice draws (`qa/eval-reports/counting-board-k-family-2026-09-08.json`); atlas pair COUNT001-02-D: one draw's requests were 2,2,5,2,5 (CNB-1, fixed and redrawn clean the same day: 5/5 distinct). COUNT001-02-F stays partial for the Grade-1 `group` floor. |
| `measure-sim-weight-capacity` | 5 | **Born + re-pointed** as `measure-lab`: `balance_predict`, `capacity_predict`, `pour_count`, `order_capacity`; 5 rows candidate (MEAS001-01-F left the observation list) | 8/8 slice draws + Chrome drive (`qa/eval-reports/measure-lab-birth-2026-09-08.json`, `-chrome-drive-2026-09-09.json`); atlas pair MEAS001-04-D 2/2 clean. L1+ ladder (support tiers, DI loop) not started. |
| `analog-clock-k-parts` | 3 | **Shipped + re-pointed**: `hand_name`, `count_face`, `hear_time`; 3 rows candidate (two were development) | Probed live and driven in Chrome by the slice-7 session (no report file yet); atlas pair TIME001-03-A: draw 2 returned one item (AC-7, fixed with a session floor and redrawn clean: 4 and 5 items). |
| `length-lab-extensions` | 3 | **Shipped + re-pointed**: `estimate_then_tile`, `two_unit_compare`, body-part units, named unit honored; 3 rows candidate | Probed live by the slice-7 session (no report file yet); atlas pair MEAS001-04-B 2/2 clean. |
| `k-band-floor-reaudit` (the two held floors) | 3 | **Shipped + re-pointed**: `number-bond` `related_fact` (spoken fact family, K+G1) and `time-sequencer` `clock-sequence` (order cards carrying an analog face at a whole hour, K); 3 rows candidate | 18/18 + 8/8 slice draws and a 9/9 Chrome drive ([report](../../eval-reports/k-held-floors-2026-09-09.md)). Both redirects the 09-08 review named were probed first and neither carried its objective: `missing_part` returned ten unknown-addend turns with no subtraction in them, and `analog-clock / read` has no sequence while `sequence-5` bans clock times at K. Owed: a live mic drive of the two-turn bond loop, and `/eval-test` on both modes. |
| `pattern-k-gaps` | 2 | **Half done**: both catalog-text refreshes landed (pattern-builder K creation, hundreds-chart K skip counts); missing-element and missing-step challenge types not started | — |
| `count-to-100-k` | 1 | Not started | — |
| `calendar-days-k` | 1 | Not started | — |
| `shapes-in-the-world` | 2 | Not started | — |
| `picture-thermometer` | 1 | Not started | — |
| `physical-observation` | 9 | Not started (no draft-curriculum edit recorded); MEAS001-01-F left the list when measure-lab gave capacity a screen home | — |

Also open outside slice 7: `sorting-station-k-draw-quality` (P2, 2 rows), the strategy-picker half of
`k-story-problems-within-10` (1 row), and the spoken half of `time-sequencer-k-prereader` (a mic
drive). `k-band-floor-reaudit`'s two held floors CLOSED 09-09 — see the slice-7 table above; the
mic drive it owes is the same one `time-sequencer-k-prereader` owes, plus one for the bond loop.

Re-probe rule: after a slice lands, run `curriculum-coverage-probe.mjs --scope math-k --redraw
--only <ids>` for that slice's pairs only; the other pairs keep their saved evidence, and
the atlas marks a draw stale if its generator changed underneath it.

## Closed slices

**Slice 5 — `time-sequencer-k-prereader` + `k-band-floor-reaudit`, 2026-09-08.** One missing
argument and twelve stale floors.

`resolveSupportStructure(pinnedType, tier)` took no grade — the band WAS resolved in the same
file, 90 lines later, where it did nothing but label the payload. So the easy tier printed a
clock time on every card and told the child to read it, at every band, and every probe ran at
easy: the pre-reader's *support* was a reading task. It takes the band now. At K the anchor is
a sun-position picture `dayFractionFor(typicalTime)` derives from the time the model already
supplies; `SkyStrip` draws it on a slice of sky windowed to the challenge's own span, because
7:00, 8:00 and 9:00 are five pixels apart on a 24-hour strip. The cue is withdrawn, and the copy
that names it rewritten, whenever the times disagree with `correctOrder`. Grade 1-2 is untouched
— reading a clock is a real Grade-1 skill; offering it as *help* to a five-year-old was the bug.
Two caps surfaced on the way, both below the published objective: `sequence-5` returned three
cards (the schema required three slots and described the rest as "use empty string if fewer"),
and `event{n}Time` was optional, which at K silently costs the whole scaffold.
Evidence: 0 of 25 K items mention a time (was 10/10 on sequence-3); the Grade-1 control still
reads the clock 5/5; 0 of 20 challenges have a cue that contradicts the answer; Chrome renders
the markers 27px apart on a 150px strip with no clock time on screen; 192/192 math tests.
[report](../../reader-fit/time-sequencer-PRE-2026-09-08.md).

The floors were the second half. Sixteen K rows landed on modes floored at Grade 1 for reading
reasons that predate the spoken ports — and the sorting-station five had been floored against a
surface that no longer exists: the port removed every printed answer path, and
`sortingStationScript.ts` already carries an `isPreReader` flag whose comment reads "Forces the
options to be named aloud at EVERY tier". The pre-reader path was built during the port; only
the floors were left standing. Ten came down with a K draw behind each; two held, and holding
them is the audit's success case rather than its failure — `fact_family` types four equations
and `read-schedule` reads printed times, and both objectives have a K-reachable home elsewhere
(`missing_part`, `sequence-5` + `analog-clock`). Thirteen rows moved partial → candidate.
[report](../../reader-fit/k-band-floor-2026-09-08.md).

Owed: no live drive of either half. Every sorting-station verdict rests on the script and the
draw, not on a heard session, and the five newly-K modes have never been driven at K with a mic.
One bookkeeping residual: `sorting-station-k-draw-quality` was filed to slice 6 after the last
successful artifact build, and a concurrent session's edit to `catalog/math.ts` has staled the
review since, so the item is in `work-items.json` but not yet in `index.html`. It appears on the
next rebuild, which that session owes anyway once it re-reviews its own catalog change.


**Slice 3 — `ordinal-to-tenth` + `k-story-problems-within-10`, 2026-09-08 (verified 09-09).**
One axis for two caps: an objective window read from the lesson text. ordinal-line already
resolved "6th through 10th" but clamped it to the grade twice; the grade is now the default a
named window may raise, up to the benched tenth. The scene's `maxNumber` got the same axis as a
config-axis fork of its contract line (K 5 by default, raised to the named window). Evidence:
`qa/eval-reports/objective-window-caps-2026-09-08.json` (window and no-window controls, two
draws each, all pass) and the 09-09 redraw (COUNT001-04-D 5 items over a ten-long line, targets
6-10; OPS001-01-E results to 8, no zero, no leak). Not done: `strategy-picker` was named in the
plan and not touched; OPS001-01-F stays partial.

**Slice 4 — `k-session-variety`, 2026-09-08 (verified 09-09).** One cause under three findings:
a field the model was free to choose, chosen the same way every run. Code now owns the two
group counts (pool service), the blank index (least-used slot, duplicates rejected) and the
interval pool (what the lesson names). Report: `qa/eval-reports/k-session-variety-2026-09-08.md`.
The 09-09 redraw confirmed the variety and found the one thing the pool did not read: the
objective's own ceiling. COUNT001-03-A and MEAS001-02-B name groups of up to 5 and the pool
rolled 5v9, 10v4, 3v8. Filed as CB-5 / `compare-groups-objective-window` and **CLOSED the same
day**: the pool anchors on the objective's range (shared `resolveScopeRange` micro-call, with
the band as the outer ceiling), the tier's count gap refits when a narrow window cannot supply
five distinct pairs, and post-fix draws hold 1-5 and 6-10 with an equal case in each. HC-5 (two
named intervals yield two problems) stays a decision, not a generator bug.

**Slice 1 — `count-from-answer-leak`, 2026-09-08.** The easy-tier prompt line that
modelled all three continuation values now models one; `instructionLeaksAnswers` in
`gemini-number-sequencer.ts` rejects, after the support-tier reshape, any count-from
challenge whose instruction states every `correctAnswers` value; contract R9 says the
sequence exemption never covers the instruction text. Evidence: COUNT001-01-I redrawn,
both draws `sampled` with "instruction does not recite the answers" green on all 10
items (was 10/10 failing); 15 live draws at easy/medium/hard with zero leaks;
`/oracle-test number-sequencer count_from` 3 runs, 0 violations.

**Slice 6 — `missing-difference-form`, `calendar-today-framing`, `k-draw-yield-variance`,
2026-09-08.** Four repairs, one per primitive, and one of them was not the defect the plan
named.

- `math-fact-fluency / missing_number` — the tier had declared an unknown-position
  preference since the structural axis landed, and it only ever reached the prompt.
  `missingNumberPosition` now assigns the blank in code, after the operand/result
  reconciliation (the subtraction swap can exchange the operands, so an earlier assignment
  would name the wrong side) and before `correctAnswer` is derived from it. Easy and medium
  alternate count-on and start-unknown so a session holds both forms the objective names;
  hard stays start-unknown. The missing DIFFERENCE is result-unknown, which is
  `equation_solve` by design — probed, and that is what it returns.
- `calendar-explorer / identify` — the component had no notion of today, so the mode could
  only ask about arbitrary dates. `todayDate` marks a cell with a star from the moment the
  question appears; `highlightDates` land only after a correct answer and could never carry
  it. A today-framed objective is built in code: the frame, question, key and options all
  follow from one date, so there was nothing to ask a model for. The Gemini identify schema
  is untouched and plain date lookups keep the LLM path.
- `sorting-station / sort_one` — **not variance.** The easy tier asked for "about 2 groups"
  while the objective named three, and one draw obeyed the tier. The groups an objective
  names are resolved through a schema (a regex that catches "into hot, warm and cold" also
  catches "by color or shape", which names an axis, not a bin set) and they set the bin
  count the tier would otherwise ramp; the required set goes in the prompt and a challenge
  missing one of its groups is rejected and redrawn once. The redraw caught two further
  faults the same gate now covers: an object count under the K floor, and a tile whose
  "emoji" was the text `Ic`.
- `compare-objects / identify_attribute` — shipped `min(count, returned)` with no floor, so
  a draw that under-returned became the session. It asks count+2, holds a floor of three,
  and redraws once when short, merging both draws deduped on the object pair.

Evidence: eight probe draws (two per pair) all `sampled` with zero failing checks, plus a
bounded live matrix — sorting-station 3 consecutive draws with all three bins in 4/4
challenges and 6 objects each; compare-objects 3 draws at 7/6/6 items; math-fact-fluency 2
easy draws with `operand2` present, alternating, 15/15 equations true within 10;
calendar-explorer 2 draws of TIME001-02-B and one of TIME001-02-C, every question framed on
the marked day with keys computed independently. Focused vitest: 4 new suites (13 tests) and
3 render tests added to `CalendarExplorer.support-tiers.test.tsx`; `typecheck:lumina` 0.

**Residuals.** (1) The atlas HTML could not be rebuilt in this slice: the review is stale
against `catalog/math.ts`, which a concurrent session is editing for the slice-5 K band-floor
re-audit. The draws and content checks are saved and current; the rebuild and the work-item
removals wait on that review. (2) Two draws of a code-owned calendar set are the same
session by construction — variety there comes from the frames, not the draw. (3) The star
marker is verified in jsdom (marked cell, legend, survives selection); its size and contrast
still want eyes.
