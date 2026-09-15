# Capture repairs for the four census abstains — 2026-09-15

Follow-up to `judged-evidence-census-2026-09-14.md`, whose run2 found four declared judged sources whose evidence
phases omitted the stimulus the error is about. Each pack now states it, and each moved from the deprecated
`diagnosisObservation` alias to the one `observation` callback while it was open. Fictional runs, real generation, the
mounted pack's own callback, the real distiller through Next on :3000; no account, no store writes.

## What changed in the evidence

| Source | Before (run2 phase) | After (run4 phase) |
|---|---|---|
| ordinal-line | `identify: who is in place 2 of 5.` | `identify: the line from the front is Rabbit, Turtle, Monkey, Penguin, Lion (5 in line); who is in place 2?` Relative-position asks name the anchor, story asks quote the story, build asks list the clues |
| decodable-reader | `Answer aloud from the story: What animal sat on a mat?` | `… The story sentence it draws on: "The fat cat sat on a mat."` Choice asks also list the cards on screen |
| 3d-shape-explorer | `identify_shape from the visible or spoken stimulus` | `identify_shape: a cube (6 flat faces, 0 curved surfaces) shown large, unlabeled; say its name.` Match, face and riddle asks name the object, the highlighted face or the spoken clues |
| picture-vocabulary | `Name the pictured vocabulary item aloud.` | `Name the pictured item aloud: a picture of a dog (🐶) is shown.` Opposite and association asks name the shown picture |

Verdict-worded fallbacks ("The tutor judged the answer wrong from the audio", "Tapped a picture that did not match",
"Named a choice the story does not support", "No matching answer was heard") became "No transcript was captured" or
"Tapped a picture; which one was not recorded", because the same text is now recorded on right answers.

## Distiller, run4 (same fixture as run2: three of five items wrong first with the pack's own signature miss)

| Source | run2 | run4 | Reading |
|---|---|---|---|
| ordinal-line | abstain: "no directional rule" | **hypothesis: counts ordinal positions from the back of the line** | the capture gap was the whole problem |
| decodable-reader | abstain: perseveration | abstain: "the same word even when it was not present in the reference sentence" | evidence now adequate; the pack's harness decoy is by design the longest content word of the whole passage (three probe-driven passes, documented in `decodableReaderHarnessAnswers`), so the fixture says "fat" on a question whose sentence is "A rat ran to the cat." A real child lifting a word from the sentence in front of them would be diagnosable |
| 3d-shape-explorer | abstain: two rules | abstain: "switching from 2-D names to an unrelated solid" | evidence now adequate; the harness `alternateShape` mixes classes by design (square for cube, circle for sphere, cone for cylinder) |
| picture-vocabulary | abstain: placeholder | abstain: "generic placeholder or task-avoidance" | evidence now adequate; the harness signature "a thing" was chosen deliberately over "animal" (the probe drew bed, door, soap), and the distiller reads a bare superordinate as avoidance, not a rule |

So one of four became a hypothesis, and the other three abstains are now judgements on the fixture rather than on
missing facts. The harness signatures were left as they are: they belong to the DI drive and each carries its
reasoning in code. A census-only fixture with a single consistent rule per source (the sentence's own word, the
solid's face name every time, "an animal") would separate the two questions and is the cheap next step if a real
observation from these sources ever abstains.

## Verification

| Layer | Result |
|---|---|
| `typecheck:lumina` | 0 |
| The four packs' script, stage and Pip-surface suites | 8 files / 203 tests pass (no test pinned the old observation text) |
| Census run4 (`artifacts/learning-applicability/judged-census/run4`) | gate 4/4; ordinal-line hypothesis; three abstains as above |
| Full tsc | 771 total, 0 under `components/lumina/` (the extra over 770 is a generated `.next/types` route file) |
| Full vitest | 517 of 518 files passed (6,575 tests); the one failure was `layout/AppChrome.test.tsx`, the known cold lazy-import flake (`dbc7c9bc`), outside Lumina and green when rerun alone |

## Residual

- Alias migration: 67 files still reference `diagnosisObservation` (the four above are done); 25 verdict-worded
  `observed` strings across them need the same rewording before each moves to `observation`.
- Drive-adapter gaps (di-dice-roll, read-aloud-studio) unchanged.
