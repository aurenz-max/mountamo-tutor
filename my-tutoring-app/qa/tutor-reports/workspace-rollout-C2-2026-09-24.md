# Workspace rollout C2: word-builder, word-sorter, picture-vocabulary, letter-spotter (2026-09-24)

Queue: [`qa/workspace-rollout/ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) row C2. Executor: `/add-live-tutor-tools`.

## What shipped

All four K literacy-words families run only on the teaching workspace, every catalog mode bound (one-path ruling
09-23). All four were runner-era (R) and moved straight to `withWorkspaceOnly` + `useWorkspaceRunner`.

| Primitive | Commit | Items | Production (+/−) |
| --- | --- | --- | --- |
| word-builder | `f005a642` | one spoken word built from the parts board, asked by its meaning (pool is `targets`) | +198 / −82 |
| word-sorter | `371578cc` | one spoken group name or bank partner | +185 / −87 |
| picture-vocabulary | `0230a58e` | five spoken modes; receptive match is a card tap the activity checks | +213 / −142 |
| letter-spotter | `d53dc3d2` | name it is one spoken letter; find it and match it are taps the activity checks | +208 / −148 |

Total production: +804 / −459. Each family has a `<X>.workspace.test.tsx` and two w1 payloads; its render, Pip and
(letter-spotter) capture suites now mount under a runtime.

Properties carried over and now tested on the workspace:

- **word-builder:** the word, its assembly and its definition appear only after credit; the root alone, the parts
  never joined, or the parts in the wrong order is not the word.
- **word-sorter:** a credited word is filed on its mat; the tier's `namesSortCriterion` decides whether the tutor
  may name the groups, and K always may.
- **picture-vocabulary:** association is an open set and its credit shows a mark, never the generated partner; the
  receptive-match key never reaches the tutor.
- **letter-spotter:** match it never names the big letter; the first-response gate still fails a run of corrected
  misses (40), and a confusion pair comes only from a corrected letter, from taps and from single-letter spoken
  misses in the scored attempts.

Shared changes: `useStimulusPipSurface` takes the phases it reads (a structural type), so the workspace runner
drives it; about ten later runner-era primitives use it. The Python drive harness trims a `targets` pool.

## Smoke drives (`--lesson-entry --progression-only`)

| Row | Result | Raw file |
| --- | --- | --- |
| word-builder compound_affix text | PASS on r2 | `word-builder-w1-compound_affix-text-2026-09-24-r2.json` (r1: ws 1012 from the harness edit) |
| word-builder simple_affix `--audio` | PASS | `word-builder-w1-simple_affix-audio-2026-09-24-r2.json` (after the guidance fix below) |
| word-sorter binary_sort text | PASS | `word-sorter-w1-binary_sort-text-2026-09-24.json` |
| word-sorter ternary_sort `--audio` | PASS | `word-sorter-w1-ternary_sort-audio-2026-09-24.json` |
| picture-vocabulary receptive_match text (tap) | PASS | `picture-vocabulary-w1-receptive_match-text-2026-09-24.json` |
| picture-vocabulary naming `--audio` | PASS on r2 | `picture-vocabulary-w1-naming-audio-2026-09-24-r2.json` (r1 kept, below) |
| letter-spotter find_it text (tap) | PASS | `letter-spotter-w1-find_it-text-2026-09-24.json` |
| letter-spotter name_it `--audio` | PASS | `letter-spotter-w1-name_it-audio-2026-09-24.json` |

No silent opening in any C2 drive (C1 had 2 of 10).

## Found and fixed

- **word-builder: the tutor asked about one part before any attempt.** The first `--audio` smoke opened with "which
  prefix on the board means again?", which decomposes the word the learner is meant to build. Guidance now says to
  open each word with the clue and ask for the whole word, and never to ask about one part before an attempt. The
  rerun opened with the clue. One domain's guidance sentence; no shared doctrine touched.

## Findings (recorded, not patched)

- **The tutor emitted a markdown answer key once.** picture-vocabulary naming r1: the opening transcript was "Look at
  the picture and tell me what you see.--- ### Answer Key & Explanation: - **Correct Answer:** Bowl …". If spoken,
  a child hears the answer. This is the only such output in every saved drive (checked all
  `qa/tutor-reports/*.json`), so no change on one sighting; watch for a second.
- **Synthetic audio limit.** Same run: the synthesized "bowl" was transcribed "ball", and the tutor correctly did not
  credit it. A harness artefact, not a binding defect.
- **Generator content.** A ternary set filed "egg" under Snacks with a Birds group present, which is ambiguous.
  Route to `/eval-test` word-sorter if it recurs.

## Gates

`typecheck:lumina` 0; full `tsc` 771 against the 770 baseline of 09-23, with no error in any file this batch changed;
full frontend suite 7,643 passed.

## Owed

- Human sitting (mic, K voice) remains HUMAN-CHECKS #167.
