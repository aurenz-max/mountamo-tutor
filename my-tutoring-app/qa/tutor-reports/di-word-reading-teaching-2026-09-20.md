# di-word-reading on the tutor/JEV teaching workspace

Date: 2026-09-20. Executor: `$add-live-tutor-tools`. Owner: LA-14 (retirement), LA-13 (observer).
Brief: [09-di-word-reading-workspace.md](../live-runtime-handoffs/09-di-word-reading-workspace.md).
Fifth workspace adopter, after Counting Board, Shape Sorter, the number train and
di-letter-sounds. Second DI pack to migrate — di-word-reading is DI pack #2, born
2026-07-23.

Scope: the development live host (`/lumina/live-activity`). Ordinary lesson wiring is
**not** done, the shared judged runner is **not** deleted, and the standalone scripted
drill still runs everywhere else.

**Headline: the brief's two questions are both answered, and the second answer says stop.**
A synthesised whole word IS a fair test of the spoken channel — this primitive ran the
connected audio gate letter sounds could not, and the provider transcribed `cat`, `mat`
and the wrong `dog` correctly. But the sub-threshold-affirmation finding reproduced
here too, in a domain with no produced-sound ambiguity, and in a live journey it
stalled a lesson rather than costing a turn. Per the brief's own "After this slice"
rule, that means: stop adopting, and fix the observer criterion first.

## What the workspace now is

The stage draws ONE printed word and nothing else. On a decodable item its printed
letters are separate workspace objects, so marking one is the real DISTAR sound-out
gesture — point at "s", say sss, sweep the word. On an irregular sight word those
objects do not exist, so a tutor that tries to sound out an irregular word is refused
by the scene rather than by a sentence of guidance. That is the brief's "two word
types, one act" constraint made structural.

The child reads out loud in every mode. The tutor hears the audio and judges it; JEV
observes the tutor's completed feedback against the assignment; the runtime commits the
outcome. Nothing composes a model line, scans for "Yes" or "My turn", counts
corrections, or advances at a miss cap.

### Advertised modes

| Mode | β | Ask | Accepted answer |
|---|---|---|---|
| `cvc_reading` | 2.0 | What word is this? Read it out loud. | the printed word |
| `read_word` | 2.5 | same | the printed word |
| `sight_word` | 3.0 | same | the printed word |
| `word_reading_review` | 3.5 | same | the printed word |

All four are the same act, so they bind to one workspace. **The ask deliberately never
contains the word.** That is the difference from letter sounds and the reason `askFor`
takes no word: the answer IS the stimulus, so a task string naming it would hand the
answer over the moment a tutor read the task aloud. The word is still in
`workspace.objects` and in the facts, because the tutor must have it to judge at all.

### Advertised actions, and what is withheld

Offered: `begin_help`, and `demonstrate` with the target `word` plus, on a decodable
item only, `letter-0…letter-n` (`[]` clears). Nothing else. `teachingOwner: 'tutor'`,
`canAdvance: false`; `apply_tutor_verdict`, `retry` and `advance` are observer-only and
never advertised. No `present` — the word is on screen by design, so a timed reveal
would be a different task. The tutor cannot change the word, add a picture, write, or
answer for the child.

### The reward-reveal decision (brief §"What is genuinely new", item 1)

**The reward picture is not a workspace object, and it is revealed in a read-words trail
under the stage, one entry per committed correct attempt.** Reasons, in order of weight:

1. As a workspace object the tutor could see it and name it before the read. That is
   the same leak the ANSWER-LEAK RULE blocks on screen, but worse, because it arrives
   spoken and the child cannot look away from it.
2. There is no `phase === 'affirmed'` here. `apply_tutor_verdict` submits and advances
   inside one `flushSync`, so a reward keyed on the current item's phase would render on
   the held-success path and never on the advance path. Keying it on the committed
   attempt gives every affirmed word its receipt, with no timer and no phase guess.
3. A trail only contains words already read, so it cannot pre-cue the word in flight or
   any word still to come.

The decision and its reason are in the `DiWordReadingTeaching` docblock. The mounted
test asserts the emoji is absent from the DOM *and* from the runtime packet before the
commit, and present after.

## Files

| File | What it does |
|---|---|
| `direct-instruction/diWordReadingDomain.ts` (new) | The assignment: item shape, validity gates, the ask, accepted answer, success condition, harness answers, workspace modes. |
| `.../diWordReadingScript.ts` | Keeps the retiring control protocol and `export *`s the domain, so the generator, the DI tester, the Pip pose and the lesson-bench extractor keep one address. |
| `.../DiWordReadingTeaching.tsx` (new) | The workspace binding: the printed word, per-letter objects on decodable items, scene facts, the reward trail, evaluation submission. |
| `.../DiWordReading.tsx` | Props widened; inside a live runtime the resolved mode picks the workspace, otherwise the scripted drill (now `ScriptedDiWordReading`). |
| `components/live-activity/adapters/diWordReadingLive.ts` (new) | Modes, validation, mounted state, grade gate, picker copy, guidance. |
| `components/live-activity/activityContract.ts`, `liveRenderers.tsx` | One registration row each. |
| `components/live-activity/liveJourneySpec.ts` | One journey row; spoken inputs derived from the domain. |
| `.../DiWordReading.teaching.test.tsx` (new) | 27 cases of the TW behavioural matrix in this domain. |
| `scripts/tutor-verdict-probe.mjs` | `--words`: 16 semantic cases for this domain. |

One behaviour change outside the new files: `isCvc` gained a gate — a decodable item's
graphemes must spell its word. The generator splits the word itself, so no generated
pool changes branch; a malformed pool now takes the whole-word model line instead of
blending to a word that is not on the card.

## Verification

### Deterministic

- `DiWordReading.teaching.test.tsx`: **27 passed.** Covers the advertised action set per
  mode; the ask never containing the word, on every item of every mode; no learner
  response stated as a scene fact; per-letter objects and the blend on a decodable item;
  no letter object and a refused letter target on a sight word; the strict near-neighbour
  success condition in every mode; the reward absent from DOM and packet before a commit
  and present after; whole-word and per-letter demonstration with a visible receipt that
  is not an attempt; assistance retained after clearing a mark; unknown target refused
  without partial mutation; speech held as context until observed feedback; stale
  response id refused; new words reopening; duplicate and stale commands; the full
  observation-to-completion lifecycle with a single evaluation submission; refusal after
  stop; the scripted drill not mounting inside the runtime; the adapter's four modes and
  ownership; guidance inside the backend 2000-character offer cap; the validator
  rejecting unaskable pools.
- One of those cases is worth naming: the probe's fixtures are hand-mirrored from the
  domain because `.mjs` cannot import TypeScript, and mirrored text rots silently. The
  test now reads `tutor-verdict-probe.mjs`, joins its string concatenation and asserts
  the real success-condition sentences appear in it. A drifted mirror fails the suite
  instead of quietly measuring a paraphrase.
- Affected suite (`live-activity`, all of `direct-instruction`, Counting Board, Shape
  Sorter, the number train, `observeDialogue`): **671 passed, 0 failed** across 60 files.
- `typecheck:lumina`: **0**. Full `tsc --noEmit`: **770**, unchanged from baseline.
- Guidance is **1994 characters**, under the 2000 the backend enforces.

### Real JEV (`node scripts/tutor-verdict-probe.mjs --words`)

16 cases × 3 repetitions = 48 real model calls. **45/48 pass** on the shipped success
condition (`di-word-reading-workspace-jev-shipped-2026-09-20.json`).

Passing families: a clean read; a noisy transcript; a blend followed by the whole word
(correct — blending aloud is the skill at this stage); a blend with no whole word at the
end (no credit); a rhyming word affirmed as the printed word (no credit); a homophone
NAMED in the affirmation (no credit, 3/3); help; a correction inviting retry; success
followed by an open question; the tutor reading the word with no learner turn (no
credit); a sight word affirmed; a sight word the tutor wrongly sounds out (credit
stands — the observer grades the assignment, not the teaching); a sight word affirmed
without restating it.

**Two success-condition clauses were tried and reverted.** All three runs are kept:

| Run | Condition | `read` | `wrong_then_corrected` | `letter_names_praise` |
|---|---|---|---|---|
| `...-jev-2026-09-20.json` | 3 sentences (shipped) | 0.93–0.96 | refused, 0.84 ×3 | credited 0.98–1.00 ×3 |
| `...-jev-tightened-...` | + letters + model clause | 0.91–0.92, once refused | 0.90, 0.91, refused | credited 0.98–0.99 ×3 |
| `...-jev-model-clause-...` | + model clause only | 0.92–0.96 | 0.90, refused, refused | credited 1.00 ×3 |

- *"Naming its letters is not reading it."* **No effect.** A tutor affirming "Correct,
  s-a-m!" still classified at 0.98–1.00. The observer never sees the learner transcript,
  so it cannot tell a spelled word from a read one. That discrimination is only the
  tutor's to make and it stays in the adapter guidance and the catalog block. The probe
  case is now named `letter_names_praise_limit` and records the boundary rather than
  asserting something the layer cannot deliver.
- *"A read that follows the tutor's model still counts."* Lifted one refused case from
  0.84 to the 0.90 gate boundary and no further, while the plain affirmation case fell
  from 0.96 to 0.91 and once below the gate. A sentence whose only measurable effect is
  nudging one case onto the threshold is patching a shared criterion from the wrong
  layer, and it cost certainty on every other case. Reverted.

No threshold was lowered, no phrase rule added, no primitive-specific observer branch
exists.

### Connected journeys (`run_live_runtime.py --primitive di-word-reading --startup`)

**13 runs, 6 passed.** Every one of the 7 failures is one of two shared families. Zero
failures are attributable to this primitive's own contract.

| Batch | Result | Evidence |
|---|---|---|
| `cvc_reading`, text | 3/4 | `...-workspace-smoke-`, `...-workspace-text-` |
| `cvc_reading`, `--audio` | 1/3 | `...-workspace-audio-` |
| `cvc_reading`, `--audio --progression-only` | 1/3 | `...-workspace-audio-progression-` |
| `read_word`, text | 2/3 | `...-workspace-read_word-`, `...-read_word-2-` |
| `word_reading_review`, text | 1/1 | `...-workspace-word_reading_review-` |
| `sight_word`, text | 0/3 | `...-workspace-sight_word-`, `...-sight_word-2-` |

**The audio gate ran, and this is the point of the slice.** In the passing audio run the
provider transcribed the synthesised learner turns correctly and the loop closed on
them: `dog` → `incorrect/retry @ 0.99`, `cat` → `correct/advance @ 1.00`, `mat` →
`correct/advance @ 1.00`, runtime `completed`. Letter sounds scored 0/3 here because TTS
of a held phoneme is not a child producing one; a synthesised whole word is a fair test
of the same channel. The brief's first reason for choosing this primitive holds.

`demonstrate` executed with a visible receipt **before** the narration that claimed it,
in every run that called it — the smoke run marked `letter-0` at t=27.08 and spoke about
it at t=32.22. The per-letter target is real and the tutor reached for it unprompted
("I've marked the first letter for you. This letter makes the sound /c/").

The two failure families, attributed and not fixed per primitive:

1. **Retry path times out (4 runs).** After a recorded incorrect answer the tutor
   encourages or decomposes instead of re-asking, and the journey runs out of turns.
   Predicted by the brief; letter sounds saw it twice. Well past the brief's
   third-occurrence rule — shared-layer work.
2. **A requested demonstration is narrated without being performed (3 runs).** The
   tutor calls `begin_help`, speaks about showing the word, and never calls
   `demonstrate`; the harness reports `Help never changed the actual board`. Text mode
   called `demonstrate` 3/3; audio mode 0/2. This is the recorded Counting Board
   demonstration miss, and audio mode makes it markedly worse.

Audio mode also truncated several tutor turns mid-sentence ("You will see a ", "Look at
the word on ") and once duplicated one. Harness/transport artifact, not a teaching
result. All failed runs are kept.

## The open finding, with the probabilities (LA-13)

**`sight_word` 0/3 is the same finding as the probe's `wrong_then_corrected`, and in a
live journey it stalls the lesson.** From `...-sight_word-2-2026-09-20.json`, with no
fixture involved:

```
learner:    "and"                 (a correct read)
priorTutor: "That sounds like a different word, let's try reading it together"
tutor:      "You did it!"
verdict:    correct 0.86  none 0.06  incorrect 0.08   → under the 0.9 gate, REFUSED
transition: advance 0.97
```

The item stayed open, the tutor's next turn was "...", and the run timed out. The probe
reproduces the same shape at 0.84 ×3, and letter sounds saw it at 0.83–0.88.

**This settles the brief's second question, and it settles it the unwelcome way.** Letter
sounds attributed the abstention to produced sound: a tutor affirming a *sound* uses the
same words as its own model of that sound. A printed word is a nameable token, so that
explanation does not apply here — and the abstention happens anyway. The shape that
actually predicts it is **a bare affirmation that names no answer, following a turn in
which the tutor corrected or modelled the target.** `sight_no_restate` ("Perfect
reading!") passes at 0.93–0.95 with no prior tutor turn; the same kind of reply after a
corrective turn sits at 0.84–0.86.

So the finding is not confined to phonemes, and it is not cosmetic: it is the direct
cause of a stalled lesson. The brief's "After this slice" section says what follows —
*if word reading also abstains on ordinary affirmations, stop adopting and fix the
observer first.* That is the recommendation.

A second, narrower boundary is worth recording beside it, because it is structural
rather than a bug: **the observer cannot catch a tutor that over-affirms a wrong read
without revealing what it heard.** `homophone_praise` ("Yes, son. That is the word.")
is correctly refused 3/3 because the tutor named a word that conflicts with the expected
answer. `homophone_unnamed_limit` ("Yes, that's right." after the child said "son") is
credited at 0.94–0.97, and `letter_names_praise_limit` likewise. The learner transcript
is excluded from model input by design, so no observer rule can close this without
becoming a second speech judge. This is exactly the over-affirmation risk the waived
bench gate deferred to the live human check, and only a microphone sitting can test it.

## What is not done

- **Ordinary lessons.** `LessonWorkspace` eligibility was not touched — the brief said
  not to, and that file was being edited by another session. di-word-reading runs on the
  workspace in the development live host only; a normal lesson still mounts the scripted
  drill.
- **No deletion.** The judged runner hooks, the cue functions, the sentinel discipline
  and the catalog DI tutoring block are untouched, and the standalone drill still depends
  on them. This slice moves one census row from `legacy` to `workspace verified`.
- **`sight_word` has no clean connected run.** All three stalled on the shared finding
  above. Its mechanics are covered deterministically and its three JEV cases pass 3/3,
  and the stall rate is a shared-layer property rather than a per-mode one — `cvc_reading`
  stalled 1 of 4 text runs and `read_word` 1 of 3 — so withholding only this mode would
  misattribute a shared defect. All four stay advertised; no mode is stall-free until
  LA-13's criterion is fixed.
- **The `reward` journey probe is registered but unread.** It is served in the journey
  descriptor and any driver can read it, but the current phase program does not assert
  it. The no-reward-before-commit guarantee comes from the mounted test, at the DOM and
  packet level.
- **Support tiers.** As with letter sounds, how much the tutor models before the attempt
  is now the tutor's choice, so no scaffolding ladder is mechanically enforced on this
  path. On `sight_word` the tutor named the word before the first attempt in 2 of 3 runs
  ("I'll touch the whole word for you: and. Now you try reading it!"). That is
  DISTAR-correct — an irregular word is taught by telling — but it means `sight_word` on
  this path is not an independent-read measure.
- **Human acceptance: HUMAN-CHECKS #167.** JSDOM paint and synthetic audio are not a
  microphone sitting. For this primitive the microphone is also the only way to test the
  unnamed-over-affirmation boundary above.

## Next bounded slice

1. **LA-13 first, not a sixth adopter.** The criterion question is now concrete: should a
   whole-assignment affirmation that names no answer be creditable when the prior tutor
   turn corrected or modelled the target? Five adopters and three domains show the same
   0.84–0.86 band. Evidence: this report's table plus
   `di-letter-sounds-teaching-2026-09-19.md`.
2. **The two harness-side families are shared-layer work**, each now at 3+ occurrences
   across primitives: the retry-path timeout and the narrated-but-unperformed
   demonstration. The second is measurably worse in audio mode, which is new information.
3. `di-math-facts` as the sixth adopter, and the four phoneme-level literacy surfaces,
   both wait on item 1.
