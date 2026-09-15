# Pip shared-surface batch: K math next 5 — 2026-09-14

Next five by K math atlas candidate rows: time-sequencer, di-spoken-practice, pattern-builder,
di-math-facts, shape-sorter. Previous batch: `batch-k-math-2026-09-14.md`. Policies and the
target table: `src/components/lumina/pip/README.md`.

## What Pip does

| Primitive | Family | Points at (this item's cue) | Never points at | Receives |
| --- | --- | --- | --- | --- |
| time-sequencer | classic, sync check | ordering list (region); the named event card (time of day, before/after); the duration pair (region); the schedule table | a card to order, a period, an option, a duration button, a schedule row/activity | — |
| pattern-builder | classic, sync check | next "?" slot, then the row when full (extend, find_rule); the row (identify_core); the build zone (create, translate) | a palette token; one token of the row on identify | — |
| shape-sorter | judged, spoken | the ringed shape / the large count shape / the real object | a mat; another pool shape | — (spoken) |
| di-spoken-practice | judged, spoken | the stimulus panel (region); nothing on a listen-only item | one picture of a compare pair, one counted object | — (spoken) |
| di-math-facts | `useJudgedSpeechLoop` | the printed problem (region) | the completed equation; praise still playing for the previous fact | — (spoken) |

di-math-facts was not ported to the runner: `diMathFactsPipPose` maps its own phase word
(`idle/ready/listening/judging/affirmed/done`) onto `pipPhasePose` — `affirmed` (the reward beat)
is the confirmed result, `judging` is checking, and speech counts only when it is this
instance's and began on the printed fact (`useSpeechScope`), so the beat's 3 s ceiling or an
early answer moving the stage mid-praise does not make Pip point at the next fact.

## Host changes

- `MathPrimitivesTester`: shape-sorter now receives the preview `instanceId`.
- `DirectInstructionPrimitivesTester`: renders `CuratorCompanion` beside the primitive, wrapped in
  `data-primitive-instance-id`, so the DI Lab shows Pip as a lesson does. When a session is
  connected the companion's hint tray is fixed bottom-right and covers the right end of the DI
  action panel at 1400px (same chrome as handoff item 4).

## Gates

- Vitest: 57 files / 534 tests — every `pip/*` suite (5 new surface tests, 20 tests) plus the
  direct-instruction folder and `ShapeSorter.di-script`.
- `typecheck:lumina` 0. Full tsc 770 = baseline 770; none in touched files.

## Runtime drives (headless Chromium, :3000 + :8000)

Math helper (`pipdrive.mjs`) and DI Lab (`didrive.mjs`, the same script with DI Lab navigation and
"Reset this run" as regeneration).

No sign-in, 1400px and 760px, all five: `bodies=1 inDock=true anchor=true` on generation (judged
and DI: `idle` before Start; classic: `working`), a new dock with one body after regeneration, no
dock/object overlap, no horizontal overflow. Time Sequencer card tap → `look`; Pattern Builder
token tap → `look`. Modes drawn: shape-sorter identify/count/sort; time-sequencer all six;
pattern-builder extend/find_rule/translate/create; DI presets answer_fact, subtraction_fact,
compare_choice, count_and_say.

Signed in, 1400px:

| Primitive | Cue observed | Child action observed |
| --- | --- | --- |
| time-sequencer (sequence-events) | point@events[region] over the live greeting and again on injected audio | card tap → look |
| pattern-builder (extend) | point@slot-0[ring] over the live intro; point@slot-1[ring] after a token filled slot 0 | token tap → look |
| shape-sorter (identify) | point@shape[ring] on the ringed triangle, connector clear of the other shapes | — (spoken) |
| di-math-facts (answer_fact) | Start → working/look; point@problem[region] on injected audio, twice | — (spoken) |
| di-spoken-practice (compare_choice) | Start → working/look; point@stimulus[region] around both pictures | — (spoken) |

The live DI tutor did not speak in either DI drive (no `ai_audio` frames); pointing there is from
injected silent audio.

## Not verified / limitations

- No spoken answer was judged in the browser, so `checking` and `celebrating` for the three spoken
  primitives are covered by the phase tests only; so are identify_core, create and translate
  pointing, and the time-of-day, before/after, duration and schedule cues.
- The DI Math Facts audio-tail rule (praise playing when the stage moves) is exercised in the phase
  test with fake timers, not against a live tutor.
- Reduced motion, mouth timing against real speech, and the lesson scroll-focus claim were not
  inspected.
