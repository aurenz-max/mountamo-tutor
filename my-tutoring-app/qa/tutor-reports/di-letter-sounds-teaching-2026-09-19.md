# di-letter-sounds on the tutor/JEV teaching workspace

Date: 2026-09-19. Executor: `$add-live-tutor-tools`. Owner: LA-14 (retirement), LA-13 (observer).
Fourth workspace adopter, after Counting Board, Shape Sorter and the number train.
First adopter outside math, and the first DI pack to migrate — di-letter-sounds is
DI pack #1, born 2026-07-20.

Scope of this slice: the development live host (`/lumina/live-activity`). Ordinary
lesson wiring is **not** done, the shared judged runner is **not** deleted, and the
standalone scripted drill still runs everywhere else. See "What is not done".

## What the workspace now is

The stage draws two objects and both are real: the **stimulus card** (the printed
grapheme, or the keyword in print for onset isolation) and the **keyword picture**.
The gold ring marks the stimulus, which is the current assignment. The tutor can mark
either object with purple dashed rings to point at it while teaching — pointing at the
moon to say "moon starts with mmm" is the DISTAR keyword route, and it is a teaching
move rather than an answer.

The child answers out loud in every mode. The tutor hears the audio and judges it;
JEV observes the tutor's completed feedback against the assignment; the runtime
commits the outcome. Nothing composes a model line, scans for "Yes" or "My turn",
counts corrections, or advances at a miss cap.

### Advertised modes

| Mode | Ask | Accepted answer |
|---|---|---|
| `letter_sound` | What sound does the letter "m" make? | `mmm` |
| `letter_sound_review` | same, drawn as a wide mixed set | the item's sound |
| `first_sound_in_word` | What is the first sound in "moon"? | `mmm` |

All three are the same act — meet the stimulus, produce the sound — so they bind to
one workspace rather than three. Two forks in the generated pool survive as item facts
rather than as script branches: a **short vowel** is elicited through its keyword
(saying "apple" is the whole answer, because the isolated vowel distorts at this age),
and a **stop** is judged as one clipped release with a small "uh" tolerated, or as its
keyword. The letter's NAME is still not the answer in any mode.

### Advertised actions, and what is withheld

Offered to the tutor: `begin_help`, `demonstrate` with the targets `stimulus` or
`picture` (`[]` clears). Nothing else. The adapter uses `teachingOwner: 'tutor'` and
`canAdvance: false`; `apply_tutor_verdict`, `retry` and `advance` are observer-only and
never advertised. There is no `present` operation — the stimulus is on screen at every
support tier by design, so a timed reveal would be a different task. The tutor cannot
change the letter, replace the picture, write, or answer for the child.

## Files

| File | What it does |
|---|---|
| `primitives/visual-primitives/direct-instruction/diLetterSoundsDomain.ts` (new) | The assignment: item shape, validity gates, asks, accepted answers, success conditions, harness answers. |
| `.../diLetterSoundsScript.ts` | Keeps the retiring control protocol (model/guide/test lead-in, sentinel-opened affirm and correction, judging contract, cues) and re-exports the domain, so the generator, tester, Pip pose and lesson-bench extractor keep one address. |
| `.../DiLetterSoundsTeaching.tsx` (new) | The workspace binding: two objects, scene facts, evaluation submission. |
| `.../DiLetterSounds.tsx` | Props widened; inside a live runtime the resolved mode picks the workspace, otherwise the scripted drill (now `ScriptedDiLetterSounds`). |
| `components/live-activity/adapters/diLetterSoundsLive.ts` (new) | Modes, validation, mounted state, grade gate, picker copy, guidance. |
| `components/live-activity/activityContract.ts`, `liveRenderers.tsx` | One registration row each. |
| `components/live-activity/liveJourneySpec.ts` | One journey row; spoken inputs derived from the domain. |
| `.../DiLetterSounds.teaching.test.tsx` (new) | 19 cases of the TW behavioural matrix in this domain. |
| `scripts/tutor-verdict-probe.mjs` | `--letters`: 16 semantic cases for this domain. |

## Verification

### Deterministic

- `DiLetterSounds.teaching.test.tsx`: 19 passed. Covers the advertised action set per
  mode, factual task with no cue tag, no learner response stated as a scene fact,
  keyword elicitation and clipped-stop acceptance, the onset stage drawing the WORD and
  never the lone grapheme, the letter-name block, demonstration with a visible receipt
  that is not an attempt, assistance retained after clearing a mark, unknown target
  refused without partial mutation, speech held as context until observed feedback,
  stale response id refused, new words reopening, duplicate and stale commands,
  the full observation-to-completion lifecycle with a single evaluation submission,
  refusal after stop, and the scripted drill not mounting inside the runtime.
- Affected suite (`live-activity`, all of `direct-instruction`, Counting Board,
  Shape Sorter, number train, `observeDialogue`, DI services, QA services):
  **1702 passed, 6 skipped, 0 failed.**
- `typecheck:lumina`: **0**. Full `tsc --noEmit`: **770**, unchanged from baseline.

### Real JEV (`node scripts/tutor-verdict-probe.mjs --letters`)

16 cases × 3 repetitions = 48 real model calls against the live service.
**36/48 pass.** Raw evidence: `di-letter-sounds-workspace-jev-2026-09-19.json`
(first run) and `di-letter-sounds-workspace-jev-tightened-2026-09-19.json` (after the
assignment text was tightened). Both are retained; the first is the diagnosis.

Passing families: a named sound, a noisy transcript, praise for naming the picture
(intermediate — no credit), bare praise after a picture substep (no credit), affirming
the letter NAME (no credit), the tutor's own model with no learner turn (no credit),
help, a correction inviting retry, success followed by an open question, a clipped stop
affirmed as a sound, onset isolation, and affirming the whole word on an onset item
(no credit).

Four families abstain, all for the same reason — the verdict sits just under the 0.9
gate rather than being misclassified:

| Case | Tutor reply | Verdict probability |
|---|---|---|
| `unrecognised_audio` | "Perfect, that is exactly the sound." | correct @ 0.83–0.86 |
| `wrong_then_corrected` | "There you go, that is the sound!" | correct @ 0.83–0.88 |
| `keyword_elicitation` | "Yes. Apple starts with short a." | correct @ 0.66–0.71 |
| `clipped_keyword` | "Yes, tent starts with that sound." | correct @ 0.66–0.72 |

No threshold was lowered and no phrase rule was added. The one change made was in this
primitive's own layer: the success-condition sentence was shortened and de-duplicated
(the clipped branch had been stating the letter-name block twice). That moved
`clipped_stop` to 0.99 and `clipped_keyword` from `none @ 0.74` toward `correct`, and
left the other two where they were.

**The finding.** In a produced-sound assignment the tutor's affirmation and the tutor's
own model use the same words, so a reply like "that is the sound" is genuinely ambiguous
between crediting the child and restating the model. The observer abstains, which is the
safe behaviour: the assignment stays open, the "task is still open" cue fires, and the
tutor speaks again. It costs a turn rather than stalling. The two keyword cases are a
narrower version: an affirmation *about the keyword* reads as teaching about the word
rather than as credit for what the child said.

### Connected journeys (`run_live_runtime.py --primitive di-letter-sounds --startup`)

On the shipped configuration, **7 of 10 text-mode runs passed** across all three modes:

| Mode | Result | Evidence |
|---|---|---|
| `letter_sound` | 4/6 | `...-workspace-text2-` (1/3), `...-workspace-text3-` (3/3) |
| `first_sound_in_word` | 2/2 | `...-workspace-onset-` |
| `letter_sound_review` | 1/2 | `...-workspace-review-` |

`begin_help` and `demonstrate` executed with a **visible receipt in 12 of 13 runs**;
the Counting Board failure of narrating a demonstration without performing one did not
reproduce in text mode. The three text-mode failures:

1. Model output artifact: one run leaked its own reasoning ("I have used
   `perform_runtime_action` with `begin_help`…") into a spoken turn and tripped the
   harness leakage assertion — **after** both items had been credited at 0.97 and 0.99
   and advanced. The teaching loop succeeded; the transcript did not.
2. Two timeouts in the retry path: after a recorded incorrect answer the tutor kept
   encouraging instead of re-asking, and the journey ran out of turns.

**Synthetic audio cannot certify this primitive: 0/3.** `--audio` synthesises the
learner turn with TTS, and TTS of "mmm" is not a child producing a held phoneme — in
two runs the tutor reported hearing "sss" or a letter name, which is a correct
judgement of what it was actually sent. Raw evidence is kept in
`...-workspace-audio-2026-09-19.json`. For a phoneme-production task the synthetic-audio
gate measures the synthesiser, not the workspace, so spoken evidence here depends on a
human microphone sitting. This is the limit the shared contract warned about; the
shape-naming pilot's audio result does not transfer.

### Diagnosis kept from the earlier runs

The first connected run stalled exactly where the JEV probe predicted: after a correct
sound the tutor said "That's it, exactly!" straight after asking a *smaller* step
("say moon and stretch the first sound"), so the reply credited only that step. Two
adapter-guidance repairs followed, both about how evidence works rather than what to
say: return to the original question before affirming the whole thing, and affirm the
child for the sound they made rather than stating a fact about the letter.

An intermediate version of that guidance quoted an example sentence, and the model
recited it — one run's whole affirmation was the flat "You said mmm.", which JEV read
at 0.68. The quoted examples were removed. Worth recording as a general rule: **an
example sentence in adapter guidance becomes a script.**

A third defect was found by the backend: guidance is capped at 2000 characters by
`live_activity_tools.parse_activity_spec`, and exceeding it closes the socket with
`Invalid activity offer`. The shipped guidance is 1844 characters.

## What is not done

- **Ordinary lessons.** `LessonWorkspace` eligibility still admits only Counting Board
  `count` and Shape Sorter `identify`. di-letter-sounds runs on the workspace in the
  development live host only; in a normal lesson it still mounts the scripted drill.
  That file was being edited by another session during this slice and was left alone.
- **No deletion.** `useJudgedScriptRunner`/`useJudgedSpeechLoop`, the cue functions,
  the sentinel discipline and the catalog DI tutoring block are all untouched, and the
  standalone drill still depends on them. This slice moves a row from `legacy` to
  `workspace verified`, nothing further.
- **Human acceptance: HUMAN-CHECKS #167.** JSDOM paint and synthetic audio are not a
  microphone sitting, and for this primitive the microphone is the only way to test the
  actual assignment. Nothing here closes that.
- **Support tiers.** `supportTier` is published as an item fact, but how much the tutor
  models before the attempt is now the tutor's choice, so the L3 ladder is no longer
  mechanically enforced on this path. Whether that ladder should survive as guidance,
  as a constraint, or not at all is a pedagogy decision, not a code one.

## Next bounded slice

1. The four abstaining JEV families are one question for **LA-13**: should a
   whole-assignment affirmation of a *produced* answer (a sound, and later a phoneme
   blend or a read word) be creditable when the tutor names the target without naming
   the learner? That is a shared-criterion decision, and it should not be settled by a
   per-primitive rule or a lowered threshold.
2. The retry-path timeout appears in both this primitive and the earlier pilots. It is
   worth attributing once, in the shared layer, rather than per adopter.
3. Ordinary-lesson eligibility for these three modes, once the `LessonWorkspace` file
   is free — with the caveat that a lesson mounting this primitive still needs a
   microphone to be worth anything.
