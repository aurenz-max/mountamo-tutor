# Observation alias migration, Phase A (math) — 2026-09-15

Phase A of `qa/HANDOFF-observation-alias-migration-2026-09-15.md`. All 11 math packs moved from the deprecated
`diagnosisObservation` alias to the one `observation(item, { heard, verdict })` callback. No cues, sentinels or items
changed.

## A gap the handoff did not name

The runner collects every attempt in `summary.learningResponses`, but the shared observation capture and
`LearningResponsePreview` read `studentWork.learningResponses`. Only counting-board, ten-frame, base-ten-blocks and
place-value-chart put it there. Migrating the callback alone would still have submitted no right answers. Every Phase A
component now submits it. Bar-model and spatial-scene run the judged loop as one beat inside a larger primitive, so
their beat records it on the per-challenge result and the host puts the combined list into student work. The four packs
from this morning's capture repairs (ordinal-line, decodable-reader, 3d-shape-explorer, picture-vocabulary) had the
same gap and got the same line. Phases B–D need this line in every host too.

## Per pack

| Pack | Challenge now states | Observed now |
|---|---|---|
| compare-objects | objects left to right and the spoken ask | `Heard "…"` / touch order / `No transcript was captured.` |
| sorting-station | unchanged except pick_rule names the pictures on screen | `Heard "…"` / no transcript |
| fraction-circles touch | the ask and every picture shown ("2 of 4 equal parts shaded") | the picture touched; `which one was not recorded` when the ref is empty |
| bar-model explanation | the ask and the rows with their counts (both graphs when two) | `Heard "…"` / no transcript |
| number-bond | the bond, the counters by place, found pairs, the move asked for | the split, the whole-group move made with the resulting counters, or the tiles built |
| addition-subtraction-scene | the story or the number sentence given | `Heard "…"`, tiles built, or how many objects the picture ended with |
| number-sequencer | challenge type plus the spoken ask (already stated the train) | cards in placed order / `Heard "…"` |
| shape-sorter | the drawn shape: kind, size, colour, rotation, everyday object; sort groups | `Said "…"` / no transcript |
| balance-scale equality, workshop | the ask plus the scale as it stands (`describeBoard` / `scene`) | `Heard "…"` / no transcript; hand and explain steps still record nothing (ungraded) |
| spatial-scene description | the ask (target, reference, YOU arrow) | `Heard "…"` / no transcript |

The alias is also gone from the docblocks of nine math script modules, so no `diagnosisObservation` remains under `math/`.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck:lumina` | 0 |
| Phase A script, stage, capture and Pip suites + runner/evidence suites | 46 files / 703 tests pass |
| Mounted capture test `math/SortingStation.capture.test.tsx` | wrong-first run submits all 8 attempts as `learningResponses` (5 affirmed), no verdict words, challenge names the card, gate fires at `firstResponseScore` 40. Fails with the submit line removed |
| Verdict-word grep over the migrated files | nothing |
| Census `RUN=alias-math --only compare-objects,sorting-station,fraction-circles` vs run2 | sorting-station hypothesis still names the signature miss (labels the item instead of the group); compare-objects abstains as in run2 (the fixture's wrong attribute varies per item); fraction-circles is gesture-only and not driveable by the voice census, as in run2. No source regressed |
| Full vitest | 519 files passed, 3 skipped (6,577 tests); no failures, including the known `AppChrome` flake |

Production diff: 167 added / 110 removed lines across 23 files; one 74-line test.

## Residual

- fraction-circles touch and the gesture branches of number-bond / addition-subtraction-scene / number-sequencer are not
  exercised by the census (voice only); their text is covered by typecheck and read-through only.
- Phases B (literacy), C (DI), D (other), E (delete the alias) per the handoff, each adding the `learningResponses`
  submit line.
