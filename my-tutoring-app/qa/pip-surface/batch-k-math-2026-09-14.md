# Pip shared-surface batch: K math top 5 — 2026-09-14

Next five primitives by K math atlas candidate rows: addition-subtraction-scene (14),
bar-model (13), length-lab (12), analog-clock (11), ten-frame (10). Policies and the
per-primitive target table: `src/components/lumina/pip/README.md`.

## What Pip does

| Primitive | Family | Points at (this item's cue) | Never points at | Receives |
| --- | --- | --- | --- | --- |
| ten-frame | judged | the frame (every mode; subitize before the flash) | a box or counter; nothing on a subitize frame is followed | placement / flip items |
| addition-subtraction-scene | judged | the story picture; the empty tray on build-equation | an object, a tile, the add button | act-out K, build-equation, create-story |
| bar-model | classic (+ spoken sub-modes) | the whole graph; the highlighted row (read modes, only while the tier shows the highlight); the group to count (match); the controls (build graph) | a row on most/fewest, compare, match; a number option | — (synchronous check) |
| length-lab | classic | the objects; the clues; the object with its unit row | a unit tick, the tile count, an answer or guess button | — |
| analog-clock | classic | the clock face as a region; the option faces on hear-the-time | a hand (a touch on the dial is watched as the dial), a numeral | — |

## Gates

- Vitest: 26 files / 258 tests pass — every `pip/*` suite (5 new surface tests) plus the
  existing TenFrame, AdditionSubtractionScene and BarModel suites.
- `typecheck:lumina` 0. Full tsc 770 = baseline 770; none in touched files.

## Runtime drives (headless Chromium, math helper, :3000 + :8000)

No sign-in, 1400px: all five show `bodies=1 inDock=true anchor=true` on generation
(judged: `idle` before Start; classic: `working`), a new dock with one body after
regeneration, no dock/object overlap, no horizontal overflow. Length Lab `+` → `look`;
Analog Clock dial tap → `look`; Bar Model row tap → `celebrating` (the tapped row was
right).

Signed in, 1400px (`start`/`speak:3`, live tutor where Gemini spoke):

| Primitive | Cue observed | Child action observed |
| --- | --- | --- |
| ten-frame (Build) | point@frame[region] on the live ask and again on the correction | box tap → stillness commit → checking/receive |
| addition-subtraction-scene (Act Out, G1 draw) | point@scene[region] | voice item; no hands action to drive |
| bar-model (Most and Fewest) | point@graph[region] over the live greeting | right row → celebrating, held through the praise |
| length-lab (Tile & Count) | point@measure[region] | `+` → look |
| analog-clock (Read Time) | point@clock[region] | dial tap → look once speech ended |

No sign-in, 760px: same results as 1400px for all five — one body in the dock, new dock
on regeneration, no overlap, no horizontal overflow; Length Lab and Analog Clock touches
→ `look`.

## Not verified / limitations

- K act-out (enact) and build-equation hands turns were not driven in the browser; the
  helper drew a Grade 1 voice item. Covered by the phase tests.
- Bar Model's spoken modes (say what it shows, compare two graphs) run their own judged
  runner inside `BarModelExplanation`; Pip reads them as classic, so it can point at the
  graph while the runner's affirmation is still playing, before the result is recorded.
- Reduced motion, mouth timing against real speech, and the lesson scroll-focus claim
  were not inspected.
