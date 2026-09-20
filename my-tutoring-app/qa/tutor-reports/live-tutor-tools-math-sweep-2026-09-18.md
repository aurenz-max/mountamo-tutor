# Live tutor tools — nine math adoptions and a host registry

**Date:** 2026-09-18 · **Skill:** `/add-live-tutor-tools` · **Branch:** `ship/2026-08-10-judged-loop`

User direction for this session was explicit and overrode the skill's one-primitive-per-session
rule: adopt the six primitives in the request, then continue to **10–15 primitives in the host
in total**, with structural adoption at full unit-test depth and the **real-model drive sampled**
rather than run per primitive. That is what this records, including which primitives were NOT
driven.

## What is in the host now

Twelve, up from three.

| Primitive | Family | Adopted | Runtime tests |
|---|---|---|---|
| number-line | tutor | earlier session | (existing) |
| ten-frame | di-runner | earlier session | (existing) |
| counting-board | di-runner | earlier session | (existing) |
| **number-sequencer** | di-runner | this session | 25 |
| **number-bond** | di-runner | this session | 22 |
| **ordinal-line** | di-runner | this session | 18 |
| **sorting-station** | di-runner | this session | 18 |
| **compare-objects** | di-runner | this session | 16 |
| **place-value-chart** | di-runner | this session | 15 |
| **shape-sorter** | di-runner | this session | 13 |
| **number-tracer** | tutor | this session | 14 |
| **comparison-builder** | tutor | this session | 13 |

154 new real-component runtime tests. Full Lumina suite 545 files / 6850 tests, `typecheck:lumina`
0, full `tsc` unchanged at the 770 baseline.

## The structural change that made nine adoptions affordable

Before this session the host hardcoded three primitives in four places: a literal union plus a
per-primitive validator and `initialState` in `activityContract.ts`, a two-way mount ternary and
four copy maps in `LiveActivitySandbox.tsx`, a lesson-start ternary in the same file, and two
`primitiveId === 'ten-frame'` branches in `api/lumina/live-activity/route.ts`. Adding twelve
families through that shape would have been twelve restructures.

It is now a registry:

- `adapters/adapterContract.ts` — the `LiveActivityAdapter` interface, plus the shared runner
  guidance and lesson-start wording every judged family uses.
- `adapters/<primitive>Live.ts` — one file per family: modes, grade gate, validator, mounted
  state, picker copy, lesson-start text, model guidance.
- `activityContract.ts` — composition only. `LIVE_ADAPTERS` uses `satisfies`, so `LivePrimitiveId`
  is the literal union of its keys and a missed registration is a type error at every consumer,
  including `LIVE_JOURNEYS`.
- `liveRenderers.tsx` — the React half, kept out of the server-importable contract. The sandbox's
  two tests now mock this ONE module instead of one per primitive, so an adoption needs no test edit.
- The route's grade gate reads `adapter.grades`; its DI-probe branch reads
  `teachingOwner === 'di-runner'`. No `primitiveId ===` remains in `route.ts`.

Adopting a family is now: an adapter file, a renderer row, a registry line, a journey row, the
runtime hook, and the component wiring.

Two more shared pieces came out of the sweep:

- `runtime/liveScaffolds.ts` — `LiveScaffold<Item, Evidence>`, `resolveScaffolds`, a 0–120
  `heardNumber` and `statesNumber` (the answer-leak sweep every adoption runs). Counting-board's
  own `heardNumber` now delegates to it; its 105 tests still pass.
- `runtime/useLiveAutoStart.ts` — the judged family's "start when the host has mounted me" effect,
  reading the session optionally so a primitive rendered outside a `LuminaAIProvider` still
  renders rather than throwing.

## Two adapter defects a typecheck cannot see

**1. The runtime mount was unstable on five adapters.** I had passed
`evalMode: runner.currentItem?.kind`, which changes when the runner opens the next item, which
rebuilds the `useMemo` mount, which re-registers into a runtime whose owner has not released —
`Error: The current owner has not released the activity`. It only surfaced when a PlaceValue test
drove the runner past item 1; every single-item test passed happily. Fixed on number-bond,
ordinal-line, sorting-station, compare-objects and place-value-chart: the mount now takes the
SESSION's mode from `items[0]`. **Any future adoption that reads `currentItem` for `evalMode` has
this bug and its tests will not catch it.**

**2. The auto-start effect must be declared AFTER the runtime mount hook.** `runner.start()` spins
waiting for `grantOwnership('runner')`, which cannot be granted until the primitive's mount is
registered. Declared earlier, its effect runs first and the runner never starts — the snapshot
just reports `owner: 'tutor'` and every affordance is missing. This also repaired three Pip-surface
suites that were already failing in the uncommitted tree for the related reason that
`useLuminaAIContext` throws outside a provider.

## Capability sets, and what every family withholds

Every judged adoption advertises `replay` + `scaffold` and withholds `advance`, `retry` and
`point`. `advance`/`retry` are withheld **by construction**, not filtered away: the runner owns
progression and its own `correctionFor` owns the re-ask, so a tutor clock beside it is the defect
the judged family exists to prevent. `point` is withheld per primitive for a stated reason —
usually that indicating the thing IS the answer.

The two tutor-led adoptions (number-tracer, comparison-builder) advertise `advance` after a checked
success and `retry` after a checked failure, both by calling the learner's own handlers, committed
through `flushSync` at the imperative boundary. Their tests assert the new DOM **inside** dispatch.

### The support detour is withheld on eight of the nine

`LiveRuntimeSurface` draws exactly one shape: a row of counters with a subtract / make-ten / count
sentence. That states HOW MANY. None of these nine teaches how many:

| Primitive | Why the counter surface cannot state it |
|---|---|
| number-sequencer | teaches the count SEQUENCE; a row of counters has no ordering to show |
| ordinal-line | teaches WHICH PLACE; the surface states how many |
| sorting-station | teaches classification; identical counters have no attribute to sort by |
| compare-objects | compares a CONTINUOUS attribute — length, weight, capacity |
| place-value-chart | POSITION carries magnitude; one flat row has no positions |
| shape-sorter | two modes are about FORM; the third counts a shape's own sides |
| number-tracer | teaches how to FORM a numeral with a pen |
| comparison-builder | a relationship BETWEEN two collections; the surface draws one |
| number-bond (partial) | `fact-family` and `build-equation` only — the surface can draw a
  part-and-part-make-whole FACT but not the act of WRITING a number sentence |

**number-bond is the one family that gets a detour**, on `decompose`, `missing-part`,
`related-fact` and `ten-and-ones`, drawn as `make-ten` (`a + b = total`), which is exactly
part-and-part-make-whole. Its test asserts the example uses a NEARBY whole, never this bond's own
numbers.

Inventing an artifact for the other eight would have been a pedagogical lie the runtime does not
catch — `validateCounterSupport` checks structure, not truthfulness.

## The misstep inventories, and the lane each excluded misstep was left to

Every mode got a method reminder (level 1) plus error-specific aids (level 2) that fire only once
the published evidence fits. Each adoption's inventory lives beside its primitive, next to the DI
correction lines it deliberately does not duplicate. Full tables are in the source; this is the
shape and the exclusions.

| Primitive | Aids beyond the method reminder | Missteps left to another lane |
|---|---|---|
| number-sequencer | 13 aids across 6 modes, routed on the heard number or the placed cards | count-sequence gaps → remediation; dot arrays / reference line → support tier |
| number-bond | 8 aids; spoken modes route on WHICH of the three numbers was said | count sequence → remediation; pre-built equation → support tier; out-of-range answer → the judge's response class |
| ordinal-line | 7 aids; `match` gets a method reminder only | reading the ordinal card → the correction reads it aloud; ordinal vocabulary → remediation |
| sorting-station | 5 aids, all gated on a WRONG VERDICT | tray labels → band floor (`namesChoices`); attribute vocabulary → remediation; count badges → support tier |
| compare-objects | 6 aids | attribute vocabulary → remediation; pre-aligned objects → support tier; right answer in other words → the judge's accept set |
| place-value-chart | 5 aids | reading the digit → a reading task; right digits in wrong columns → **evidence not published yet**; column headers → support tier |
| shape-sorter | 4 aids | shape vocabulary → remediation; corner dots / mat tallies → support tier; curve counted as a corner → **evidence not published yet** |
| number-tracer | 3 aids | wrong stroke START → **evidence not published yet** (stroke counts are published, stroke origins are not); nothing drawn → the component's own `MIN_STROKE_POINTS` block; ghost guide / arrows → support tier |
| comparison-builder | 8 aids | cannot count either group → remediation, and the wrong skill; correspondence lines / count badges / target marker → support tier; mis-tap → the learner's own clear, which `retry` calls |

Three rows say "evidence not published yet" rather than shipping an aid that cannot be routed.
Those are the honest next increments, not gaps to paper over.

### Every hint is swept against its own answer

Each adoption has a test that walks every advertised scaffold's quoted line against every answer
that mode can demand. **The sweep caught two real leaks during development**, both the same
failure mode — an ordinary English word that is also a number word:

- number-tracer `check-it-against-the-model`: "Look at **the one** on the screen again" states the
  answer on a `digit: 1` item.
- number-sequencer `not-the-number-we-started-on`: "Say **the one** that comes after it" — same,
  on a `count_from` answer of 1.

The sweeps also guard non-numeric answers: ordinal WORDS and character names (ordinal-line),
comparison words and symbols (comparison-builder), place names (place-value-chart), shape names and
group labels (shape-sorter, sorting-station).

## Gates run

```
cd my-tutoring-app && npm run typecheck:lumina        → 0
cd my-tutoring-app && ./node_modules/.bin/tsc --noEmit → 770 (unchanged baseline)
cd my-tutoring-app && npm test -- --run src/components/lumina
                                                      → 545 files / 6850 tests passed
```

## Real-model drive — four harness bugs, and what it proved about the adapters

Driving number-sequencer (`--runs 3`) and counting-board (`--runs 1`) against the real model
found **four assumptions in `run_live_runtime.py` and `liveJourneySpec.ts` that held only for the
three original primitives**. Every failing run was a harness defect, not an adapter one. Each is
fixed, and each would have broken every later adoption:

1. **A judged ITEM is not a generated CHALLENGE.** `first_id` came from `data.challenges[0].id`,
   but six of the nine expand one challenge into several asks with derived ids
   (`seq1` → `seq1:1-answer`). "Did it advance?" became "is this a different string?", so a
   *correct* correction failed the run. Now reads the runtime's own `task.itemId`.
2. **The shared `spoken()` helper resolved DI answers by challenge id**, so it always fell back to
   `diItems[0]` and spoke the FIRST ask's answer on every later ask — which the runner then
   correctly judged wrong. `JourneyContext` now carries `itemId` and the helper matches on it.
3. **The programs assumed every family has a worked example.** Eight of the nine truthfully
   advertise none. Both programs now skip the detour when the journey declares no `example`
   prompt, and assert positively that `request_support` was never offered — turning the absence
   into evidence instead of a crash.
4. **A session was assumed to be two items.** A `count-from` challenge expands into one ask per
   continuation step, so the program waited for a closing while the runner asked a third item.
   It now answers until the runner submits, bounded by a 12-item cap.

A fifth, smaller one: counting-board's own `exampleTaught` regex wanted the literal `"each one"`
and rejected the tutor's truthful *"count each once"* — and could never have matched
*"count each BLOCK once"*, since the object noun is the board's own. Widened.

### What the drive did establish, from the receipts rather than the transcript

- The runner opens, asks and corrects correctly: *"My turn: counting forward, after 12 comes 13.
  Your turn…"*, with `task.itemId` unchanged across the correction.
- **The adapter's scaffold reaches the model and is spoken verbatim.** The tutor said
  *"Start on the number I just said, then say what comes next."* — the exact `say-what-comes-next`
  method reminder — after a `scaffold` command committed with `support.level: 1` and a painted
  `[data-runtime-hint]` line.
- **The withheld detour is visible in the live `choices` the model is given**: `replay` and
  `scaffold` only, no `request_support`. The withholding is not just a unit-test claim.
- Per-item DI answers now judge correctly across items: *"Yes, 13."* then *"Yes, 14."*
- Counting-board ran its whole program end to end — opening, wrong, hint, example, return with
  non-vacuous preserved work (`counted: 2`, `vacuous: false`), right, next item, closing.

### Status, stated plainly: number-sequencer is 1/3, not 3/3

After the four harness fixes the final `--runs 3` gave **PASS / FAIL / FAIL**. Run 1 went the whole
way — opening, wrong answer, correction, hint, correct, next item, and on through every remaining
ask to a clean close with one submission.

Runs 2 and 3 both died the same way: at the `right` phase the tutor emitted degenerate speech
(`-` and `Tutor.` respectively) instead of the affirmation, so the runner never advanced and the
program hit its 300s timeout. That is the **known gemini-3.8 watch item** — an empty or degenerate
turn on a scripted cue — not an adapter fault: the same adapter, same cues and same commands
produced a full green run minutes earlier.

All three runs recorded `no_detour_by_design` with the live choices `['replay', 'scaffold']`, so
the withheld worked example is confirmed against the real model three times over even where the
run later failed.

**The roadmap's smoke gate is `--runs 3` green. number-sequencer is 1/3, so it does NOT pass that
gate.** Treat it as *driven once, end to end, with two model-flake failures*. The other eight
remain **undriven**. Raw evidence:
`qa/tutor-reports/number-sequencer-runtime-count_from-live-2026-09-18.json` and
`counting-board-runtime-count-live-2026-09-18.json`.

One accounting note: re-running counting-board **overwrote** an untracked evidence file of the
same name from the 2026-09-17 session. That prior run's JSON is gone.

## Limitations — read these before trusting the adoption status

1. **Seven of the nine were not driven against the real model.** They have real-component,
   real-runner, real-runtime, real-transport tests and a production capability envelope, and that
   is all. Structural adoption is not a live certification.
2. **No browser sitting, no microphone sitting, on any of the twelve.** Both remain owed, as they
   were before this session.
3. **The two tutor-led journeys declare `inputsFor: () => []`.** The mounted driver's vocabulary is
   `place / check / touch / give / answer`; it has no verb for drawing a numeral or tapping a
   comparison tile. Those journeys certify the COMMAND surface and leave the learner gesture to the
   browser sitting. That is recorded rather than faked with a synthetic verdict.
4. **One mode per primitive was mounted in most routing tests.** The per-mode `it.each` covers the
   advertised capability SET on every mode, but the misstep ROUTING is driven on the modes named in
   each table above.
5. **`place-value-chart` grade range is a guess from the catalog**, not from a curriculum read:
   Grade 1–5. Worth a check against the published objectives before a pilot.
6. **The dev server on :3000 was already unresponsive** when this session started and still is;
   the drive ran against the healthy instance on :3001. I also started a second `next dev` before
   confirming the port state, which is the footgun CLAUDE.md names. It was killed within two
   minutes and `node_modules/.bin` (138 entries) and the Lumina typecheck were both verified intact
   afterwards.

## Next bounded session

0. Re-run number-sequencer `--runs 3` for a clean 3/3, or characterise the degenerate-turn flake
   properly against [[gemini-3.8-live A/B]]'s existing watch item rather than re-rolling until green.
   Two of three runs stalling on a scripted cue is worth a look before more adoptions are driven.
1. Drive the remaining eight, one at a time: `run_live_runtime.py --primitive <id> --runs 3
   --frontend http://localhost:3001`. No harness edits — each already has its `LIVE_JOURNEYS` row,
   and the four assumptions above are now fixed for all of them.

   One leak seen in the passing run and worth chasing: the tutor twice SPOKE
   `<!-- The runner-owned activity manages responses and progression. -->`, an HTML comment from
   the context channel. Harmless to the gate, wrong in a child's ear.
2. Publish the three missing evidence channels, each of which unlocks a real aid already designed:
   stroke ORIGINS (number-tracer), per-column digit placement (place-value-chart), per-feature
   counts (shape-sorter).
3. Add a driver verb for a drawing gesture and a comparison tap, so the two tutor-led journeys stop
   declaring empty `inputsFor`.
4. The browser and microphone sittings, which no amount of this work replaces.
