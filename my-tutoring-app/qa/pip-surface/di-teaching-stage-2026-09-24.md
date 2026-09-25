# Pip on DiTeachingStage (2026-09-24)

Closes the REOPEN row in `ROLLOUT.md`. The five spoken DI packs (letter-sounds, word-reading,
math-facts, sentence-reading, shapes) lost Pip when their scripted drills were deleted (LA-14 S5,
B3). Pip is now wired once in the shared `DiTeachingStage`, so all five get it back.

**Behavior** (`pip/diStagePipPose.ts`, on top of `stimulusPipPose`):
- One target, `stimulus`: the whole letter, word, fact, sentence or shape. Never one letter, word,
  side or corner, and never the credited trail.
- Points while this item's utterance plays; looks at the stimulus otherwise.
- Celebrates only a committed credit. A held credit celebrates while held. A credit that advances
  is held as the confirmed result over the praise tail, until the tutor's first utterance on the
  new item, which is that item's cue.
- A miss never celebrates.

**Evidence**
- `pip/DiTeachingStage.surface.test.tsx`: 61/61, on every saved W1 payload of the five packs
  (15 payloads), under the real runtime.
- `workspaceHarness` gained an optional `pipStore` and a `speak(on)` helper.
- Gates: typecheck:lumina 0; tsc 770 (baseline); full frontend suite passed.
- DI Lab drives (real tutor audio, headless): Shapes name_shape at 1400, Shapes count_sides at 760,
  Facts answer_fact at 1400. Each had one body in the dock, pointed at `stimulus[region]` (an outline,
  no connector) while the tutor asked, looked otherwise, had no overlap or horizontal overflow, and
  got a fresh dock after regenerating.

**Not exercised in a browser:** celebration, since the drive cannot give a spoken answer (covered by
the unit tests only); Letter Sounds, Word Reading and Sentence Reading (same stage code as the two
driven packs); reduced motion; mouth timing against real speech.

**Removed:** `pip/diShapesPipPose.ts`, an orphan from the deleted drill.
