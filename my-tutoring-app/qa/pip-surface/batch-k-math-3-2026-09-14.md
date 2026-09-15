# Pip shared-surface batch: measure-lab, math-fact-fluency, di-shapes, calendar-explorer, number-line — 2026-09-14

Previous batch: `batch-k-math-2-2026-09-14.md`. Policies and the target table: `src/components/lumina/pip/README.md`.

## What Pip does

| Primitive | Family | Points at (this item's cue) | Never points at | Receives |
| --- | --- | --- | --- | --- |
| measure-lab | classic, timed verdict | object pair → scale after the prediction (heavier); both containers (holds more, least to most); container while pouring → cups row once full | one object or container; a count option | — (the 900 ms beam settle and pour are `checking`, watching the scale / containers) |
| math-fact-fluency | classic, sync check | the visual (visual fact, picture-to-equation match); the printed equation otherwise | a number, equation or picture choice; the stepper | — |
| number-line | classic, sync check | the whole line (plot, find between); the marked start (jump); the chip row (order) | a tick, label, or landing | — |
| calendar-explorer | classic grid + judged spoken chain | grid when a date is the answer; starred today cell when an option is the answer; start-day card (days forward); listen card (day/month chain) | a cell that could be the answer; the target-day column; an option | — |
| di-shapes | `useJudgedSpeechLoop` | the whole drawing | a side or corner; the labeled reward | — (spoken) |

Every Measure Lab and Math Fact Fluency target is a region (outline, no connector). Rings: the number-line start point and the calendar today cell.

## Host changes

- `MathPrimitivesTester`: math-fact-fluency now receives the preview `instanceId`; calendar-explorer added under Measurement, Time & Money (eval modes looked up from `CALENDAR_CATALOG`). It had no helper entry.
- `MeasureLab`: the two container rows wrap (`flex-wrap`, smaller gap below `sm`). At 760px the capacity pair overflowed the card and clipped the left container outside Pip's outline.

## Gates

- Vitest: 42 files / 409 tests (all `pip/*`, calendar, number-line, DI Shapes, math-fact-fluency generator, oracles); 5 new surface tests, 22 tests.
- `typecheck:lumina` 0. Full tsc 777 vs 770 at the previous batch; none in touched files, 6 in a concurrent session's untracked `tenFrameRemediation.test.ts`.

## Runtime drives (headless Chromium, :3000 + :8000)

No sign-in, 1400px and 760px: `bodies=1 inDock=true anchor=true` on generation (classic `working`, judged `idle` before Start), new dock with one body after every regeneration, no OVERLAP or PAGE-OVERFLOW-X. Touch → `look` on: Measure Lab prediction, pour and jar taps; Math Fact Fluency option; Number Line line tap and chip; Calendar date cell. Measure Lab balance: loading both pans → `checking/look` → `celebrating` on a right prediction, `working` on a wrong one.

Signed in (live greeting plus injected silent audio):

| Primitive (mode) | Cue observed |
| --- | --- |
| number-line (jump) | point@start[ring], connector from above lands on the start dot without crossing tick labels |
| calendar-explorer (identify) | point@grid[region] (the draw had no today-framed question) |
| calendar-explorer (days in order) | Start → working/look; point@stimulus[region] |
| math-fact-fluency (match) | point@visual[region]; a right equation tap → celebrating, injected audio during praise stays celebrating |
| measure-lab (holds more, least to most; 760px) | point@containers[region] around all containers after the wrap fix |
| di-shapes (count_sides) | Start → working/look; point@shape[region] |

The live DI tutor sent no audio in the DI Shapes or calendar-chain drives; pointing there is from injected audio.

## Findings queued (EVAL_TRACKER, executor `/eval-fix`)

- **MLAB-1 CRITICAL** — a wrong prediction leaves no enabled control (seen at 1400px, reproduced on the component).
- **CE-3 CRITICAL** — one wrong calendar check disables Check and the options; the three-attempt reveal is unreachable (reproduced on the component).
- **MLAB-2 HIGH** — random weights contradict the objects (paper clip 7 > rock 1).
- **MLAB-3 MEDIUM** — pans do not hang from the tilted beam.
- **MFF-2 MEDIUM** — match regeneration 500: runaway 176k-char string, no token cap or retry.

## Not verified

- `receive` does not apply to any of the five; `checking` and `celebrating` for the spoken DI Shapes and calendar chain, the calendar today ring, days-forward and count cues, and Math Fact Fluency visual-fact / equation cues come from the phase tests only.
- Reduced motion, mouth timing against real speech, and the lesson scroll-focus claim were not inspected.
