# Workspace rollout B2: cvc-speller, phonics-blender, sound-swap, word-flip (2026-09-24)

Queue: [`qa/workspace-rollout/ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) row B2. Executor: `/add-live-tutor-tools`.

## What shipped

The four K–1 literacy families that ran the hand-rolled `useJudgedSpeechLoop` progression now run
only on the teaching workspace. They went straight to one path (`withWorkspaceOnly` +
`useWorkspaceRunner`), as B1 ended under the 09-23 one-path ruling, instead of a dual-controller
W1 that would have been deleted afterwards. Removed from each: the loop, its correction cap, the
mic panel, the Live connect/start flow and the scripted cues. An unbound mount shows the
needs-the-tutor card; testers already host bound families. Every catalog mode binds.

| Primitive | Commit | Channels | Production lines (+/−) |
| --- | --- | --- | --- |
| phonics-blender | `aa43415e` | spoken word vs `targetWord` | +199 / −468 |
| word-flip | `aa1d6129` | spoken word vs code-derived `answer` | +157 / −471 |
| sound-swap | `6750001f` | spoken word vs `resultWord`; the move names its sound | +166 / −483 |
| cvc-speller | `656131ba` | fill-vowel/word-sort spoken (middle sound); spell-word a gesture the boxes check | +314 / −754 |

Total production: +836 / −2,176. Preceding slice `143ad9a8`: the generic W1 contract test
(`runtime/workspaceContract.test.tsx`), now 21 + 4 families on 58 saved payloads.

What each family keeps: tap-to-hear (a silent host message asking for the sound or word, never the
answer), the K band gate, the tier levers that act on screen, the answer-leak rule (answer and reward
only while a credited item is held) and Pip, re-driven from the workspace. cvc-speller's Try again
keeps the right letters (Elkonin), and its boxes are a scene fact so the tutor can see the build.

## Shared changes

- `workspaceBinding` counts items with the family's own mount state (`initialState().totalChallenges`)
  instead of requiring `data.challenges`; phonics-blender's pool is `words`.
- `run_live_runtime.py` trims whichever pool key the payload has (`challenges` or `words`).

## Smoke drives (`--lesson-entry --progression-only`, saved under `qa/tutor-reports/`)

| Row | Result | Raw file |
| --- | --- | --- |
| phonics-blender cvc text | PASS (dog→retry, cat, dog) | `phonics-blender-w1-cvc-2026-09-24-r2.json` |
| phonics-blender cvc `--audio` | PASS | `phonics-blender-w1-cvc-audio-2026-09-24.json` |
| word-flip plural_s text | PASS (bell→retry, bells, shells) | `word-flip-w1-plural_s-text-2026-09-24.json` |
| word-flip plural_s `--audio` | PASS | `word-flip-w1-plural_s-audio-2026-09-24.json` |
| sound-swap addition text | PASS (at→retry, cat, bat) | `sound-swap-w1-addition-text-2026-09-24-r2.json` |
| sound-swap addition `--audio` | PASS | `sound-swap-w1-addition-audio-2026-09-24.json` |
| cvc-speller spell_word text | PASS (s-a-t→Try again keeps a,t→c; pen) | `cvc-speller-w1-spell_word-text-2026-09-24-r4.json` |
| cvc-speller fill_vowel `--audio` | PASS (cat→retry, aaa; pen) | `cvc-speller-w1-fill_vowel-audio-2026-09-24.json` |

Tutor lines read: none says the answer before the learner tries, cvc-speller never names a letter,
and every credit names what the learner got right.

Failed runs, kept: two ws 1012 closures (a harness edit, then a concurrent session's backend edit),
and three Gemini Live `1011 Internal error` drops after a completed tutor turn (phonics-blender ×1,
cvc-speller ×2; 6 errors across 3 of today's 34 sessions). The backend resumes the session
transparently, but the harness counts `session_resuming` as a failure. **Finding, queued below.**

## Gates

`typecheck:lumina` 0; full `tsc` 770 outside the concurrent adaptation-investigator session's
uncommitted files; 2,306 tests across live-activity, literacy, pip, pulse and components (the one
failure is that session's family, which has no saved payload yet).

## Not done / follow-ups

- ~~Harness: a transparent Live resume fails the drive~~ DONE 09-24: the drive records the resume and
  keeps going; forced-drop baseline FAIL → fixed PASS (1 Live resume)
  (`resume-fault-baseline-2026-09-24.json`, `resume-fault-fixed-2026-09-24-r2.json`). Still open: when
  the resume itself fails (1011) the backend reconnects cold with no `session_resumed` and no steering,
  and the tutor goes silent (`resume-fault-fixed-2026-09-24.json`).
- The script modules stay for their pure helpers and pure script tests; their cue builders now have
  no student-facing caller. `service/qa/lessonBench/journey/extract.ts` still models the retired
  phonics-blender cue (`itemCue`) for the lesson bench; queue with the lesson-bench owner.
- Human sitting (mic, K child voice) remains HUMAN-CHECKS #167; synthetic audio does not certify
  phonemes (fill_vowel's "aaa").
