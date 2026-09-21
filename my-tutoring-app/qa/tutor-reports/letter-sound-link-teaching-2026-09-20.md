# letter-sound-link on the teaching workspace — seventh adopter

Date: 2026-09-20 · Owner: roadmap LA-14 · Skill: `/add-live-tutor-tools`
Scope: `letter-sound-link`, all three eval modes, development live host **and** ordinary
lesson entry (the adapter declares `bindsTeachingWorkspace`, so no mode is withheld).

The first literacy primitive outside the DI packs, and the first binding with **two
response channels in one primitive**. Nothing was deleted; the scripted drill remains the
standalone path.

## Why this one

`hear_see` is a mode whose answer the tutor must not be told. A letter NAME is a blocked
response class (b/p/d/e/g are homophonic to a judge), so the grapheme is touched rather
than spoken, and a tutor handed the target letter ends the item by naming it. That made
this the cheapest test of two things the contract had never been asked for:

1. a workspace item with **no `expectedAnswer` at all**, graded entirely by the activity;
2. a mode that **offers no `demonstrate`**, because every object on its stage is an
   answer option and marking either one answers for the child.

Both hold. Neither needed a new observer rule, a backend branch or a teaching state machine.

| Direction | Eval mode | The child | Channel | Expected answer published? |
|---|---|---|---|---|
| Say the Sound | `see_hear` | says the sound the printed letter makes | speech | yes — the tutor judges the audio |
| Find the Letter | `hear_see` | taps one of two confusable letters | gesture | **no** — the activity checks the tap |
| Say the Word | `keyword_match` | says the picture word that starts with the sound | speech | yes |

## What was built

- `letterSoundLinkDomain.ts` (new, split from `letterSoundLinkScript.ts`, S1-style): the
  continuant gate, the keyword anchor map, the item shape, the cross-item session build
  gate, the letter-name map, and the workspace ask/accept/assignment builders. The script
  re-exports it, so the generator, the tester, the drive plan and the lesson-bench
  extractor keep one address. The script's own `itemsFromChallenges` behaviour is
  unchanged: askability filtering is opt-in (`askableOnly`) and only the workspace path
  passes it, so the retiring runner still builds exactly what it built before.
- `LetterSoundLinkTeaching.tsx` (new) and `adapters/letterSoundLinkLive.ts` (new);
  registry rows in `activityContract.ts`, `liveRenderers.tsx` and `liveJourneySpec.ts`;
  `LetterSoundLink.tsx` now exports through `withTeachingWorkspace`.
- `LetterSoundLink.teaching.test.tsx` (new, 25 cases): the TW behavioural matrix in this
  domain, plus the four cases that exist only here (no expected answer, one shared object
  group, no demonstration, the tap keeping grading authority).

### Scene decisions worth carrying

- **The keyword anchor is not on the stage.** Unlike di-letter-sounds, where the keyword
  picture sits beside the card at every tier, here the picture *encodes the sound*. It is
  drawn only once a correct attempt is committed, it is never a workspace object, and for
  `see_hear` the anchor word is absent from the packet entirely — a tutor that had it
  could hand over the sound with it. Verified: `JSON.stringify(packet)` contains no `map`
  on an `m` item.
- **`markMeaning` is not a fact.** It is in the adapter guidance instead, which is the
  direction [brief 11 item 3](../live-runtime-handoffs/11-structure-review-residuals.md)
  asks for. The other five adopters still publish it inside `facts` and still need that
  move; this binding simply does not add to the pile. Guidance is 1854 chars against the
  2000 cap, and carries no fifth variant of the "name the answer back" sentence.
- **Reveals are keyed on the committed attempt** (`state.attempts`), like di-word-reading's
  reward trail, because `apply_tutor_verdict` submits and advances in one `flushSync` and
  there is no `phase === 'affirmed'` window on this path.

## Verification

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| full `tsc --noEmit` | 770 — baseline, unchanged |
| Lumina test suite | 7,150 pass / 10 skipped (25 new; one census assertion in `lessonWorkspacePlan.test.ts` updated) |
| Learner-intent probe (`--links`, 16 cases × 3) | 42/48, **0 false help/stop requests**, median 182 ms |
| Real JEV cases (`--links`, 21 cases × 3) | **57/63**, both failing families abstain rather than credit |
| Connected journeys, `see_hear` text | **3/3 PASS**, demonstration performed 3/3 |
| Connected journeys, `see_hear --audio` | 1/3 — see the produced-sound limit below |
| Connected journeys, `hear_see --audio` | **3/3 PASS** |
| Connected journeys, `keyword_match --audio` | 2/3 after the guidance repair (1/3 before) |

Raw evidence: `letter-sound-link-learner-intent-2026-09-20.json`,
`letter-sound-link-tutor-verdict-2026-09-20.json`,
`letter-sound-link-runtime-{see_hear,see_hear-text,hear_see,keyword_match}-*-2026-09-20.json`,
`letter-sound-link-runtime-keyword_match-after-2026-09-20.json`.

## LA-13: the shape is the whole reply, not the sound and not the channel

This domain adds a fifth and sixth cell to the sub-threshold-affirmation table, and a
deterministic isolation that contradicts the di-math-facts reading.

- The **`wrong_then_corrected` shape passes here**: a bare "There you go, you got it!"
  after a corrective turn scores 0.94–0.96 and is accepted 3/3 — on a produced sound,
  where the child's answer and the tutor's own model are the same utterance in the same
  channel. That is the shape di-math-facts named as the failing line. It does not fail here.
- What **does** abstain, 3/3 each, is a reply whose *entire content* is the target token:

  | Case | Tutor reply | Result |
  |---|---|---|
  | `clipped_with_schwa` | "Yes, /t/." | `uncertain_or_invalid`, refused |
  | `tap_correct` | "Yes, sss." | `uncertain_or_invalid`, refused |
  | `clipped_with_schwa_sentence` | "That's right, you said the /t/ sound." | correct/advance @ 0.99 |
  | `tap_correct_sentence` | "That's right, you tapped the letter that makes sss." | correct/advance @ 1.00 |
  | `sound` | "Yes, mmm." | correct/advance @ 0.94–0.96 |

  The diagnostic pair was added *after* the first two abstained, and was run three times
  each. The failing shape is a two-word reply whose only content word is the answer token,
  where the model cannot separate a verdict from the tutor modelling the sound — and it is
  not reliable: the same shape on "mmm" is accepted. Both abstentions are safe (the item
  stays open and the still-open cue fires); the cost is a turn. **Nothing was patched in
  this primitive's layer**; this is shared-criterion input.

### One primitive-layer change, measured before and after

`letter_name_praise` — the child says "em", the tutor says "Yes, em is right!" — was
**accepted as a correct `mmm` on 2 of 3 replays at 0.93–0.94**. This is the primitive's
documented signature error, so a false affirm there is the lesson's central distinction
failing. The success condition said only "the letter's name does not [count]", tucked into
the accept clause; the two directions that name their near miss *by value* refuse theirs
3/3. Naming it the same way — `The letter's NAME — "em" — is not the answer, however
confidently it is said.` — takes it to **0 of 3 accepted**. That is stating the success
condition, not a phrase rule or a threshold, and it is the shape the sibling directions
already used.

## Findings and residuals

1. **Synthetic audio cannot certify `see_hear`**, the same limit di-letter-sounds recorded.
   The provider transcribed a synthesised "aaa" as **"A"**, the letter NAME — which this
   primitive's assignment explicitly blocks — so the tutor correctly refused it and the run
   timed out. The refusal is right behaviour and the run failure is a harness limit. Text
   mode closes the same journey 3/3. Spoken evidence for this direction needs a human
   microphone sitting (**HUMAN-CHECKS #167**).
2. **Demonstration narrated but not performed**, the shared family now past its fifth
   occurrence: 1/3 on `see_hear --audio`, 1/3 on `keyword_match --audio`, 0/3 on `see_hear`
   text and 0/3 on `hear_see` (which offers no demonstration at all). Shared-layer work.
3. **The answer-leak repair on `keyword_match` was a guidance defect, not a tutor failure.**
   The first guidance said "the keyword picture is not on the stage" — true for `see_hear`,
   false for `keyword_match`, which draws two of them — so the sentence that followed was
   incoherent in the one direction it governed, and the tutor named both picture words
   (including the answer) while helping on **2 of 3** runs. Splitting the two facts takes
   it to **0 of 3**, with the passing runs marking the letter card and talking about the
   sound instead. The underlying constraint is di-math-facts': the tutor must hold the
   answer to judge it, so only the guidance can stop it saying it first.
4. **The journey program assumed every mode can demonstrate.** `run_live_runtime.py`
   asserted "Help never changed the actual board" unconditionally, so `hear_see` failed 3/3
   on a capability it deliberately does not have. The assertion now reads the production
   envelope (`state.choices`) for a `demonstrate` operation, exactly as the file's own
   doctrine requires, and records `no_demonstration_offered` otherwise. It names no primitive.
5. **`tap_correct` abstaining does not stall a lesson in practice**: all three `hear_see`
   journeys advanced on the tutor's own affirmation, because a real tutor writes the
   sentence form ("That's it, you found the letter that makes the sss sound!"). The
   learner-owned Try again / Next challenge in the shared shell covers the abstention, and
   the component test drives that control rather than the observer.
6. **Two learner-intent cases fail on the `answer` flag only**, both advisory and neither
   raising a request: `other_picture` ("net" in the picture-word direction) reads 0.71–0.77
   against the 0.8 policy, and `off_task` ("my dog is called Max") reads 0.40–0.48. The
   second is a confounded case of mine — the target letter is `m` and "Max" starts with it —
   and the unconfounded twin added beside it reads 0.07. Both are kept as written.
7. **Census correction, not a status change.** `07-census.md` says 20 surfaces call a runner
   hook and that the nine LA-04 live adapters do not. `TenFrame.tsx:480` calls
   `useJudgedScriptRunner<TenFrameItem>`, and 58 non-test primitive modules contain a real
   call expression. S3–S5 scope is larger than the census states; corrected there.

## Not done

- Human browser/microphone acceptance for all three directions → **HUMAN-CHECKS #167**.
- Pip's shared surface, the support-tier ladder and the catalog scaffolds are untouched on
  the teaching path; the scripted drill keeps them.
- No mastery or student-record semantics changed. Completion submits through the ordinary
  evaluation provider like the other bindings, with `confusedSoundPairs` still derived —
  now from wrong taps recorded as gesture attempts rather than from the scripted runner.
