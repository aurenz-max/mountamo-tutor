# Next DI adopter: di-word-reading on the teaching workspace

> **EXECUTED 2026-09-20.** All four modes bind in the dev host.
> [Report](../tutor-reports/di-word-reading-teaching-2026-09-20.md).
> Both questions this brief was written to answer are answered: a synthesised whole word
> IS a fair test of the spoken channel (audio gate ran, `dog`/`cat`/`mat` transcribed and
> judged to completion), and the sub-threshold-affirmation finding is **not** specific to
> produced sound — it reproduced at `correct @ 0.86` and stalled a live lesson. Per this
> brief's own "After this slice" rule, the next work is LA-13's criterion, not a sixth
> adopter. The text below is the original brief, kept as written.

Date: 2026-09-19. Executor: `$add-live-tutor-tools`. Owner: LA-14 (retirement), LA-13 (observer).
This is an execution brief for those existing rows, not another backlog. Per-surface
state stays in [07-census.md](07-census.md); the plan stays in
[07-sunset-scripted-tutoring.md](07-sunset-scripted-tutoring.md).

## The recommendation, and why this one

**di-word-reading** (DI pack #2, born 2026-07-23). Four modes: `cvc_reading` (β 2.0),
`read_word` (2.5), `sight_word` (3.0), `word_reading_review` (3.5). Response class
`short_spoken_word`. Currently standalone-only — no live adapter.

It is the right next slice for four reasons, in order of weight:

1. **It can close the gate di-letter-sounds could not.** The letter-sounds adoption
   proved the workspace but could not certify spoken evidence: TTS of a held phoneme is
   not a child producing one, so `--audio` journeys measured the synthesiser and scored
   0/3. A whole printed word is exactly what speech synthesis and transcription handle
   well, so this primitive can run the full connected audio gate the pilots run.
2. **It isolates the open observer finding.** Letter sounds left four JEV families
   abstaining at 0.83–0.89 because a tutor affirming a *produced sound* uses the same
   words as its own model of that sound. A word is a nameable token, so an affirmation
   restates it. If word reading passes cleanly, the finding is specific to phoneme
   production and LA-13 can scope its criterion question narrowly. If it does not, the
   problem is broader than one domain and that changes what LA-13 should fix.
3. **Literacy is the ruled priority**, and this is the literacy DI pack whose answer the
   current contract actually supports.
4. **It brings real new domain work** rather than a fourth copy of the same binding —
   see the next section. A slice that only re-proves the existing contract teaches
   nothing.

Rejected alternatives, with the reason:

| Candidate | Why not now |
|---|---|
| `di-math-facts` | Lowest risk, least information. Spoken number answers are already proven twice, by Counting Board and the number train. Good fallback if word reading turns out to be blocked. |
| `di-shapes` | Its `name_shape` mode duplicates Shape Sorter `identify`, which is already a verified adopter. `count_sides`/`count_corners` are the substep family the observer abstains on by design. |
| `di-sentence-reading` | `sentence_read_aloud` is a long production. `expectedAnswer` is a string for bounded answers; a sentence needs the rubric and evidence contract the shared contract explicitly does not have yet. |
| `CvcSpeller`, `PhonicsBlender`, `SoundSwap`, `WordFlip` | All four are phoneme-level and would inherit the unresolved produced-sound finding four more times. They should wait for the LA-13 criterion decision. They also each call **both** runner hooks, so they are the most expensive migrations in the census. |

## Start from the implemented state

Read, in this order:

- [The letter-sounds report](../tutor-reports/di-letter-sounds-teaching-2026-09-19.md) —
  the closest precedent, including three defects found the hard way.
- [TEACHING_WORKSPACE.md](../../src/components/lumina/docs/TEACHING_WORKSPACE.md) —
  TW-1 to TW-11 and the behavioural matrix.
- `primitives/visual-primitives/direct-instruction/diLetterSoundsDomain.ts` and
  `DiLetterSoundsTeaching.tsx` — the template for a DI domain extraction and binding.

Four workspace adopters exist: Counting Board `count`, Shape Sorter `identify`, the
number train, and di-letter-sounds (all three modes). Do not restart the S0 census, the
S1 domain extractions, or the S2 two-mode lesson wiring. Nothing has been deleted from
the legacy runner, and this slice should not delete anything either.

Three findings from the letter-sounds slice that will cost time if rediscovered:

- **An example sentence in adapter guidance becomes a script.** Guidance that quoted
  `"you said mmm" is evidence` produced a tutor whose entire affirmation was the flat
  "You said mmm." Write the principle, never a sentence the tutor can recite.
- **Guidance is capped at 2000 characters** by `live_activity_tools.parse_activity_spec`.
  Exceeding it closes the socket with `Invalid activity offer`, which does not obviously
  read as a length problem.
- **A success-condition sentence that says the same thing twice reads as two
  conditions.** De-duplicating one moved a JEV case from 0.74 to 0.99.

## What is genuinely new here

This primitive is not a re-skin of letter sounds. Three constraints have no precedent
on the workspace, and getting them wrong breaks the teaching rather than the plumbing:

1. **The answer is the stimulus.** The child reads the printed word, so the word must be
   on screen and the tutor must have it — there is no answer side to withhold. But that
   inverts the letter-sounds scene: `diWordReadingScript.ts` carries an explicit
   ANSWER-LEAK RULE that **no picture, emoji, or audio pre-cue may appear before the
   read**. The challenge's `emoji` is a post-affirmation reward only. The stage today
   renders `rewardEmoji` solely when `phase === 'affirmed'`.

   On the workspace there is no `phase === 'affirmed'` to key off, because success is
   committed by the observer. The reward reveal has to follow the committed outcome and
   its visible receipt, not a local phase guess. Decide deliberately whether the reward
   picture is a workspace object at all: if the tutor can see it in `workspace.objects`
   before the read, it can name it, and that is an answer leak through the tutor rather
   than through the screen.

2. **Near neighbours must be corrected, not affirmed.** The response class is UNBENCHED
   — gate 1 was waived on 2026-07-22 by user ruling, with the over-affirmation risk
   explicitly deferred to this primitive's live human check. `sun`/`son`, `red`/`read`
   and the rest live in `asrAliases` for reporting, never as a judge. The judging
   contract is deliberately strict, and that strictness is domain content that must
   survive into the assignment's success condition. It also makes an obvious JEV case
   family: a tutor affirming a homophone as the printed word must not record success.

3. **Two word types, one act.** `cvc` words are sounded out and blended; `sight` words
   are recalled whole and must never be sounded out, because they are irregular.
   `graphemes` exists on CVC items for the sound-out model. That is a real teaching
   constraint for the adapter guidance, and a real fact for the scene.

## The slice

1. **Extract the domain** to `diWordReadingDomain.ts`, following
   `diLetterSoundsDomain.ts`: item shape, validity gates, the ask, the accepted answer,
   the success condition, harness answers, and `DI_WORD_READING_WORKSPACE_MODES`. Leave
   the cue wording, sentinels and judging contract in `diWordReadingScript.ts`, and have
   it `export *` from the domain so the generator, tester and any extractor keep one
   address. Check the current consumers first — `gemini-di-word-reading.ts` and the DI
   tester at least.
2. **Bind** `DiWordReadingTeaching.tsx` with `useTeachingWorkspace`. Keep the SVG/DOM the
   standalone stage already uses where you can, and give the scene a stable probe
   attribute for the journey.
3. **Adapt and register**: `adapters/diWordReadingLive.ts`, plus one row each in
   `activityContract.ts`, `liveRenderers.tsx` and `liveJourneySpec.ts`. Read the grade
   gate off the catalog entry rather than assuming it. `canAdvance: false`,
   `teachingOwner: 'tutor'`, `tutoring: null`.
4. **Fork the component** on the resolved mode, as `DiLetterSounds.tsx` does. The
   scripted drill stays the standalone path.
5. **Decide the reward-reveal question** from §"What is genuinely new", and write the
   decision into the binding's docblock with its reason.

Advertise only the modes you verify. All four share one act, as letter sounds' three
did, so one binding is likely right — but `sight_word` and `cvc_reading` differ in what
the tutor may do (sounding out an irregular word is a teaching error), so they need
separate JEV cases even if they share a binding.

## Verification

Do not call this verified on a partial run. From `my-tutoring-app`:

```powershell
npm.cmd test -- --run src/components/lumina/components/live-activity src/components/lumina/primitives/visual-primitives/direct-instruction src/components/lumina/primitives/visual-primitives/math/CountingBoard.runtime.test.tsx src/components/lumina/primitives/visual-primitives/math/ShapeSorter.runtime.test.tsx src/components/lumina/primitives/visual-primitives/math/NumberSequencer.teaching.test.tsx src/components/lumina/service/typesafe/observeDialogue.test.ts
npm.cmd run typecheck:lumina
node scripts/tutor-verdict-probe.mjs --words qa/tutor-reports/di-word-reading-workspace-jev-2026-09-XX.json
```

The probe takes a new `--words` branch beside `--letters`. Cases that matter here:
a clean read affirmed; a homophone or near neighbour affirmed as the printed word
(**must not** record success); praise after a sound-out substep with the whole word
still unread; the tutor reading the word itself with no learner turn; help; a
correction inviting retry; success followed by an open question; a sight word affirmed;
a sight word the tutor wrongly sounds out. (Superseded 2026-09-21: the probe now imports
the domain's `workspaceAssignment`/`workspaceScene` through the Vite module runner; nothing
is copied. See brief 11 item 6.)

From the repository root, with :3000 and :8000 already running:

```powershell
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_live_runtime.py --primitive di-word-reading --mode cvc_reading --runs 3 --startup --audio --output my-tutoring-app/qa/tutor-reports/di-word-reading-workspace-audio-2026-09-XX.json
```

**Run the audio gate here.** It is the whole point of choosing this primitive: unlike
letter sounds, a synthesised whole word is a fair test of the spoken channel. Run the
text-mode variant too, and report both. Expect the same two harness-side failure
families the letter-sounds runs showed — an occasional model turn that leaks its own
reasoning into speech, and a retry path that times out when the tutor encourages
instead of re-asking. Attribute them; do not fix them per primitive. A third occurrence
makes them shared-layer work.

Keep every failed run. Inspect transcripts for a demonstration narrated without being
performed, and for the reward picture appearing before a committed success.

## What not to do

- Do not lower the 0.9 verdict threshold, add a phrase rule, or add a primitive-specific
  observer branch. If word reading also abstains on affirmations, that is the finding —
  record it and hand it to LA-13 with the probabilities.
- Do not wire ordinary lessons in this slice. `LessonWorkspace` eligibility is its own
  gate and was being edited by another session as of 2026-09-19; check before touching.
- Do not delete the shared runner, the cue functions or the catalog DI tutoring block.
  Nineteen surfaces still depend on them.
- Do not touch attempts, evaluations or mastery persistence without `$student-data-loop`.

## After this slice

If word reading passes the audio gate cleanly, the produced-sound finding is confined
to phonemes, and the next decisions are: LA-13's criterion question for phoneme
production, then `di-math-facts` as the third DI adopter, and only then the four
phoneme-level literacy surfaces. If word reading also abstains on ordinary
affirmations, stop adopting and fix the observer first — four adopters is already
enough evidence to act on.

HUMAN-CHECKS #167 remains the open browser and microphone acceptance for every adopter,
including this one. JSDOM paint and synthetic audio are not a human sitting.
