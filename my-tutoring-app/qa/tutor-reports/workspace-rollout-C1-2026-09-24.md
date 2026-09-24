# Workspace rollout C1: syllable-clapper, rhyme-studio, phoneme-explorer, word-workout (2026-09-24)

Queue: [`qa/workspace-rollout/ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) row C1. Executor: `/add-live-tutor-tools`.

## What shipped

All four K literacy-sound families run only on the teaching workspace, every catalog mode bound (one-path
ruling 09-23). All four were runner-era (R) and moved straight to `withWorkspaceOnly` + `useWorkspaceRunner`,
the you-and-me template from B3.

| Primitive | Commit | Items | Production (+/−) |
| --- | --- | --- | --- |
| syllable-clapper | `ff355679` | one spoken answer: the blended word, the count, or the word left | +192 / −111 |
| rhyme-studio | `1745179a` | one spoken answer: yes/no, the rhyming choice, any rhyme, a new rhyme for the family | +235 / −130 |
| phoneme-explorer | `e8411569` | one spoken answer across six modes: a card word, the blended word, the count, the new word | +200 / −116 |
| word-workout | `700cbd33` | a spoken read or answer; picture match is a gesture the activity checks | +235 / −160 |

Total production: +862 / −517. Tests were rewritten on the workspace harness (each family's reader-fit,
support-tier and Pip suites now mount under a runtime; one runner-mock stage test deleted), and each family has
a `<X>.workspace.test.tsx` and two w1 payloads.

Properties carried over and now tested on the workspace:

- **syllable-clapper:** nothing on screen shows the word, its parts or the count before credit. The per-item
  `voicing` fact tells the tutor how to say the stimulus, which inverts between the acts: parts one at a time
  on blend, joined on count and delete (a split before an attempt hands over the count).
- **rhyme-studio:** the ending is never named in the ask; the rhyming choice is marked only after credit;
  `namingChoices` carries the tier's read-aloud lever. Collection fills each spot with the word the learner
  said and tells the next slot which rhymes are taken.
- **phoneme-explorer:** the ask is the pack's own (`askFor`, now exported); the ending and middle sounds and
  the segment word's sounds are never printed before credit; the example or target word said back is not a card.
- **word-workout:** the ask never names a printed word; the scene tells the tutor everything printed is read
  cold. Picture match goes through `commitGesture` with the activity's own check, and its key never reaches
  the tutor. A second tap while the verdict stands is not another attempt. Chain fluency is timed open to credit
  (the workspace outcomes carry no per-item seconds).

Shared change (additive): `onSolved` / `onAffirmed` now receive the credited response, so rhyme collection
records the word the learner said. No other adopter reads it.

## Smoke drives (`--lesson-entry --progression-only`)

| Row | Result | Raw file |
| --- | --- | --- |
| syllable-clapper count_parts text | PASS | `syllable-clapper-w1-count_parts-text-2026-09-24.json` |
| syllable-clapper blend_syllables `--audio` | PASS | `syllable-clapper-w1-blend_syllables-audio-2026-09-24.json` |
| rhyme-studio recognition text | PASS | `rhyme-studio-w1-recognition-text-2026-09-24.json` |
| rhyme-studio identification `--audio` | PASS | `rhyme-studio-w1-identification-audio-2026-09-24.json` |
| phoneme-explorer isolate text | PASS | `phoneme-explorer-w1-isolate-text-2026-09-24.json` |
| phoneme-explorer blend `--audio` | PASS on r2 | `phoneme-explorer-w1-blend-audio-2026-09-24-r2.json` (r1 kept) |
| word-workout picture_match text (gesture) | PASS on r2 | `word-workout-w1-picture_match-text-2026-09-24-r2.json` (r1 kept) |
| word-workout real_vs_nonsense `--audio` | PASS | `word-workout-w1-real_vs_nonsense-audio-2026-09-24.json` |

Tutor lines read, not only PASS: syllable-clapper kept count words joined before the attempt; word-workout never
said a printed word before the learner read or tapped; rhyme-studio named no ending before an attempt.

Undriven at W1: rhyme-studio `production` and `collection` have no code-owned answer (the pack deliberately
has no answer bank), so their journey row throws with the mode name. Their key and the collection fill are
covered in `RhymeStudio.workspace.test.tsx`.

## Findings

- **Silent opening, 2 of 10 drives** (phoneme-explorer blend r1, word-workout picture_match r1): the tutor never
  answered `[LESSON_START]` within 60 s, with no provider resume in the trace. Both reruns passed. This is not
  the cold-reconnect defect (no failed resume). A child would see a lesson that never starts. Queued as a
  shared transport/model finding, executor `/add-live-tutor-tools`.
- rhyme-studio recognition opened with "To hear the lesson, please unmute and say hello." instead of the ask
  (the run still passed). One occurrence; recorded with the silent openings.
- The phoneme blend walk is written `/d/ … ooo … /g/` in the task, as the scripted cue had it, and the tutor's
  transcript repeats the notation. Whether it is voiced as sounds or as "slash d slash" needs a listen (HUMAN-CHECKS
  #167); unchanged from the runner era.

## Gates

`typecheck:lumina` 0; full `tsc` 771 against the 770 baseline of 09-23, with no error in any file this batch
changed (the one Lumina-path error is a generated `.next/types` entry for the untouched eval-test route); full
frontend suite 7,586 passed. The generic W1 contract test now covers the four new families on eight payloads.

## Owed

- Silent opening at lesson start (above).
- Human sitting (mic, K voice) remains HUMAN-CHECKS #167.
