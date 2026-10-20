# Contract: word-workout

- **Derived:** 2026-09-28 · evidence window: eval-reports 2026-03-15→2026-04-04 + K census trace 2026-07-14 + reader-fit PRE 2026-07-15 + live DI 2026-08-14 + workspace rollout C1 live 2026-09-24 + authored map (live backend, 2026-09-28) + git to 2026-03
- **Component:** `primitives/visual-primitives/literacy/WordWorkout.tsx` (+ boss `wordWorkout.card.ts` / `wordWorkout.boss.ts`, `wordWorkoutDomain.ts`, `wordWorkoutLevers.ts`, `wordWorkoutEarlyDecoding.ts`) · **Generator:** `service/literacy/gemini-word-workout.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`...bossEntry(wordWorkoutCard)`) · **Live journey:** `bossJourney(wordWorkoutBoss)`
- **Status:** ACTIVE (1 open conflict, C1, against the planned `two_far_pictures` lever; 2 catalog divergences flagged below)

Derived as step 1 of handoff 22 L1 (`qa/live-runtime-handoffs/22-literacy-levers.md`), before
in-item levers are added to `picture_match`. Channel [4] (calibration) not read (auth). No fresh
census; channel [1] = the saved 2026-07-14 K census trace.

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| Authored map: **no consumer** (0 of 65 language_arts mappings) | authored map [3] | `GET /api/curriculum/primitive-mappings/language_arts` (inverted 2026-09-28) | live |
| K census — "Decode CVC words with short a": routed; failed on vowel scope, since fixed | census [1] | `qa/topic-traces/k-cvc-short-a-2026-07-14.md:15,21-24` | 2026-07-14 |
| K PRE band: real_vs_nonsense, picture_match, word_chains READY; sentence_reading floored G1+ | reader-fit [2] | `qa/reader-fit/word-workout-word-flip-PRE-2026-07-15.md`; `qa/EVAL_TRACKER.md:33` | 2026-07-15 |
| Content QA (chain validity, sentence answerability) | eval [2] | `qa/eval-reports/word-workout-2026-04-04.md`; EVAL_TRACKER WW-1, WW-2 (`:1040-1041`) | 2026-04-04 |
| Early-decoding expansion (inflected, compound, context) | code [5] | `adae4122`; `WordWorkout.extended-decoding.test.ts` | 2026-09 |
| Shared teaching workspace (W1 binding C1) + live journey | live [2] + code | `qa/tutor-reports/workspace-rollout-C1-2026-09-24.md:32-35,50-51`; `word-workout-w1-picture_match-text-2026-09-24-r2.json` | 2026-09-24 |
| Named misses for the trigger ladder (A5) | code [5] | `1a0cd42a`; catalog `teachingWorkspace.misses` | 2026-09 |
| Pip shared surface | code [5] | `c6f608e9`; `pip/wordWorkoutPipPose.ts` | 2026-09-15 |

Real-usage channel [4]: unknown (auth), not zero.

## Requirements

### R1 — Vowel scope · OBSERVED
- **Property:** when the objective names short vowels, every graded word stays in scope (`inVowelScope`, code filter): chain words, both real/nonsense words, sentence `cvcWords`, extended-decoding pool entries, and on picture-match the target AND every distractor word. A picture-match challenge left with no in-scope distractor is dropped. Empty mode → per-vowel scoped fallback. Consequence: under a one-vowel scope every picture foil shares the target's vowel.
- **Demanded by:** K census short-a; topic fidelity.
- **Evidence:** `gemini-word-workout.ts:141-185`; `qa/topic-traces/k-cvc-short-a-2026-07-14.md:15`.
- **Probe:** `GET /api/lumina/eval-test?componentId=word-workout&evalMode=picture_match&grade=K&topic=short a words` → target and every distractor contain only `a`.

### R2 — Mode identity and answer modality · OBSERVED
- **Property:** `picture_match` is the only tap mode: the printed word is decoded silently and a picture tap is the commit, checked in code (`option.word === item.targetWord`), never by the tutor; a second tap while the verdict stands is not an attempt. Every other mode is answered aloud and judged. The printed words are not buttons. No Check / Next / Finish / Skip button in any mode, no on-screen instruction line.
- **Demanded by:** DI port 16; workspace C1; K PRE band.
- **Evidence:** `WordWorkout.tsx` `handlePictureTap`; card `picture_match: TAP_ONE`, every other mode `SPOKEN` (`wordWorkout.card.ts`); `WordWorkout.reader-fit.test.tsx`; `WordWorkout.support-tiers.test.tsx`; C1 report.
- **Probe:** `npm test -- WordWorkout` → reader-fit and support-tiers regression pins pass.

### R3 — Nothing marks the answer before credit · OBSERVED
- **Property:** picture options render the emoji only, no word label; the target picture is ringed only after the checked right tap; a wrong tap marks only the tapped picture. The `picture_tap` item has a null key (`wordWorkoutKey`), so its assignment carries no `expectedAnswer`, and the tap reads to the tutor as "Tapped the picture of <word>", never the key. Real word, comprehension answer and context answer are marked only after credit; the phonics tint rides the read, not the question.
- **Demanded by:** every consumer (Pedagogy rule #1).
- **Evidence:** `wordWorkoutDomain.ts` `wordWorkoutKey`, `describePictureTap`; `WordWorkout.support-tiers.test.tsx`.
- **Probe:** `npm test -- WordWorkout.support-tiers` "never marked before it is credited".

### R4 — No audio of unread print · OBSERVED
- **Property:** the tutor never says a printed word, a part of one or a sound in it before the learner reads it: the ask never names the print (`askLeaks` on `validate`), the shared doctrine says to let the learner read print first, and each item's scene `constraints` states its own never-say rule. The only audio affordance is hear-again, a silent host request (`runner.requestHear(hearQuestionRequest(item))`) for the instruction or question only. The deleted speaker buttons, whole-sentence model read and per-word tap-to-hear cannot return at any tier.
- **Demanded by:** DI port 16; workspace guidance; handoff 22 leak rule "no audio of unread print".
- **Evidence:** `wordWorkoutDomain.ts` `PRINTED` (scene constraints), `askFor`; `wordWorkoutDomain.test.ts`; `WordWorkout.workspace.test.tsx`; `WordWorkout.support-tiers.test.tsx`.
- **Probe:** `npm test -- WordWorkout.workspace wordWorkoutDomain` (ask never names the word; hear-again silent, never print); `boss.test.ts` askLeaks over the saved payloads.

### R5 — Picture options shape · OBSERVED
- **Property:** options = the target picture + the item's distractor pictures (each with a sayable word, an emoji, not the target), in an id-seeded deterministic shuffle. The generator asks for 2-3 distractors (3-4 pictures); the scoped fallbacks carry 2 (3 pictures); the build gate accepts 1 ("a fair 1-of-2 choice") and drops 0. No code rule relates a foil's sounds to the target: the prompt asks for pictures "distinguishable by MEANING, not by sound", and the fallbacks share sounds (cat/bat/rat share the rime; pig/pin/bin share onset or vowel). Each option is a button with `data-pip-object="picture-<word>"`, which tests, Pip and the journey select by. At most 6 picture-match challenges per session.
- **Demanded by:** workspace C1 journey; Pip surface; PRE band (emoji-primary).
- **Evidence:** `wordWorkoutDomain.ts` (`itemsFromChallenge`, picture-match); `gemini-word-workout.ts:208-214,499-508,916`.
- **Probe:** `npm test -- WordWorkout.reader-fit` "picture-match is picture-primary and its pictures ARE tappable"; eval-test picture_match → 2-4 options, target present once.

### R6 — Support tier · OBSERVED
- **Property:** on the model path the only tier lever is `chainCueLevel` on word-chains (on the word-space path, R13, the tier also picks the items) (full / highlight-only / none, on screen; at none the `changed_letter` lever can light the change back). Absent → full. The stimulus (chain, target word, picture options, sentence) renders at every tier; fallbacks stay unstamped. Picture-match has no tier behaviour today.
- **Demanded by:** support-tiers batch 2; DI port.
- **Evidence:** `gemini-word-workout.ts:730-780`; `WordWorkout.support-tiers.test.tsx:94-122`.
- **Probe:** `npm test -- WordWorkout.support-tiers`.

### R7 — Named picture-tap miss · OBSERVED
- **Property:** a wrong tap commits with `wordWorkoutMiss`: `same_start` (first letter), else `same_end` (last two letters), else `same_vowel` (3-letter, middle letter), else `other_word`, matching the card's `PICTURE_MISSES`. Try again frees the pictures. Pip never taps.
- **Demanded by:** trigger ladder (A5); workspace C1.
- **Evidence:** `wordWorkoutDomain.ts` `wordWorkoutMiss`; `wordWorkoutDomain.test.ts`; `WordWorkout.workspace.test.tsx`.
- **Probe:** `npm test -- wordWorkoutDomain WordWorkout.workspace`.

### R8 — Workspace-only path and evaluation · OBSERVED
- **Property:** runs only when bound (`withWorkspaceOnly`); bound sessions send `tutoring: null` (the catalog carries no tutoring block), so the tutor's instruction is the boss guidance built from the card (`node scripts/boss-card.mjs word-workout`). One evaluation per session: `pictureMatchAccuracy` and `wordMeaningAccuracy` include `picture_tap`; decoding and meaning never share a score; chain fluency is timed silently (no visible timer).
- **Demanded by:** workspace C1 (LA-14 one path); IRT/mastery.
- **Evidence:** `700cbd33`; `WordWorkout.tsx:240-332`.
- **Probe:** `npm test -- WordWorkout.workspace`; `npm run test:primitive -- word-workout` (the boss journey).

### R9 — Pre-reader band · OBSERVED
- **Property:** picture_match is READY at K PRE: the word is the only print, the answer surface is emoji, the tutor voices the ask. The stage renders the same at K and Grade 1 (no band-gated chrome, no vowel-scope label).
- **Demanded by:** K PRE band.
- **Evidence:** `qa/reader-fit/word-workout-word-flip-PRE-2026-07-15.md:30,36,57`; `WordWorkout.reader-fit.test.tsx:137,178`.
- **Probe:** `npm test -- WordWorkout.reader-fit`.

### R10 — Spoken-mode content gates · OBSERVED
- **Property:** chains change exactly one letter per step, no duplicates (`validateWordChain`); sentences have ≥3 `cvcWords`, 3-8 words, answer in the sentence and not in the question; real/nonsense pairs start with different consonants and the nonsense word is not a real word; inflected/compound/context items come only from the code-owned pool. No item word opens with a sentinel ("yes").
- **Demanded by:** WW-1, WW-2; live DI 2026-08-14; early-decoding expansion.
- **Evidence:** EVAL_TRACKER `:1040-1041`; `wordWorkoutDomain.ts` build gates; `wordWorkoutDomain.test.ts`; `WordWorkout.extended-decoding.test.ts`.
- **Probe:** `npm test -- WordWorkout gemini-word-workout`.

### R11 — In-item levers on picture_match · OBSERVED
- **Property:** `wordWorkoutLevers.ts`; the spoken modes declare none (L3). `sound_dots` puts one dot under each grapheme of the printed word and an arrow under it: visual only, nothing sent to the tutor's voice, picture buttons unchanged (R4, R5). `two_far_pictures` (simplify) opens an ungraded practice item: a new picturable CVC word in the lesson's vowels (`masteredVowels`, else the session words' vowels; R1) and two pictures, the foil starting and ending differently from it; never a session word, rime or picture. A pull is a synchronous commit; the next attempt records the lever.
- **Demanded by:** handoff 22 L1; trigger ladder (handoff 21 S2).
- **Evidence:** `qa/eval-reports/word-workout-levers-2026-09-28.md`.
- **Probe:** `npm test -- wordWorkoutLevers WordWorkout.levers.workspace`.

### R12 — In-item levers on the spoken read modes · OBSERVED
- **Property:** every help lever is a visual mark from the shared kit overlay (`LuminaPrintSupport`), carrier `shown`, nothing sent to the tutor's voice (R4): `sound_dots` (real-or-silly both words, the lit chain word, the lit near word), `changed_letter` (chains only where `chainCueLevel` is `none`; releasing it is a lever pull, not a tier change, R6), `chunk_divider` (inflected/compound, offered only once the item has had a wrong try, because the word's chunks show only after a cold attempt), `tracking_underline` (sentence read), `question_word_icon` (sentence question: the kind of answer, never the word, R3). Simplify builds a practice item in code that prints no session word (R3 of handoff 22) and keeps the mode's act: `short_chain` (two new CVC words, first letter changes, no session rime), `easier_ending` (-ing/-ed → a pool -s word in the lesson vowels), `three_word_sentence` (a pool line). Meaning and fit answers get none. All are declared once in `WORD_WORKOUT_LEVERS` (marks, easier, and `question_word_icon` as a shown clue). Unanswered by decision: `wrong_fit` (choose_in_context) and `other_word` (read_compound: a compound has no easier word, and the divider answers the first part alone).
- **Demanded by:** handoff 22 L3.
- **Evidence:** `qa/eval-reports/levers-literacy-L3-2026-09-28.md`.
- **Probe:** `npm test -- wordWorkoutLevers WordWorkout.levers.workspace`.

### R13 — Word space: with a single-mode support tier, code picks every item · OBSERVED 2026-10-13
- **Property:** with a support tier on a single mode and no remediation focus, every mode but sentence_reading draws from `service/wordSpace/wordWorkoutSpaces.ts`. real_vs_nonsense: a familiar CVC decodable with each letter's basic sound (never was, has, son, yes) against a string from `nonsense.json` (built from CMU + hunspell: no word, name or homophone; differs at the first letter, R10); harder = one letter off (cat/zat), hardest = a near first sound (sob/pob). picture_match: harder = a wrong picture one letter off, the vowel hardest (fin vs fan); three distinct pictures. word_chains: four familiar words, each one letter from the last, a different letter each step; harder = vowel changes. read_inflected / read_compound / choose_in_context keep their code tables (R1 vowel scope holds), tiered by ending (-s < -ing < -ed), hardest vowel, and which letter a context pair differs in. Every item passes `challengeAskable`; each carries a `wordSpace` stamp. Short draw → model path.
- **Probe:** `npm test -- src/components/lumina/service/wordSpace/wordWorkoutSpaces.test.ts`; `scripts/word-space-lab/probe.sh word-workout after ...`.

## Conflicts

### C1 — `two_far_pictures` vs R1 — OPEN (pending lever design, handoff 22 L1)
The draft simplify lever asks for a foil sharing no sound position with the word. R1 filters every
foil to the lesson's vowel scope, so under a one-vowel objective every foil shares the middle sound
and no such foil exists in the item or its fallback. Both are right: R1 keeps a short-a lesson on
short a; the lever wants a foil that cannot be confused by sound. Cheapest fork (config axis): the
lever builds its foil in code from a picture pool, and "far" means no shared first letter and no
shared last letter (neither `same_start` nor `same_end`); the vowel may be shared when a vowel scope
is set. The foil word is never printed, so R1's printed-word purpose holds either way; exempting the
foil from scope instead needs a ruling.

## Catalog projection

- **description:** corrected 2026-10-20 (boss migration): "the tutor teaches in its own words; the activity checks each picture tap" replaces the retired DI clock sentence; the read_inflected / read_compound descriptions and the constraints no longer say the tutor models word parts (the divider lever and the post-credit reveal show them).
- **constraints:** faithful.
- **evalModes:** faithful. `picture_match` β comment is correct.
- **tutoring block:** deleted 2026-10-20 with the hand-written `teachingWorkspace` and `audioInput`; the card owns both (`...bossEntry(wordWorkoutCard)`).

## Changelog
- 2026-10-20 — **boss migration** (wave 2, bucket D). One `spokenBoss`: six `SPOKEN` modes keyed by `wordWorkoutKey` (`SpokenKey`; signature errors: the made-up word, the chain word before, the base alone, the near neighbour, a lifted word, a swapped small word), picture_match `TAP_ONE` with a null key played through `show`. Script + workspace merged into `wordWorkoutDomain.ts` (cue lines, judging contracts and pack base deleted); levers moved onto one lever set. Re-based: R2/R3/R4/R7/R8 evidence moved from `wordWorkoutWorkspace.ts` and the catalog guidance to the domain, card and boss; R4's per-item never-say rule is now the scene `constraints`; R6's spoken-correction channel went with the scripted correction; R12's spoken misses are now answered by levers except `wrong_fit` and read_compound `other_word`, and `chunk_divider` is offered only after a first try instead of declared and refused. Content fix: the bedbug meaning ask said its answer ("A bedbug is an insect." before "What kind of thing is a bedbug?"); the sentence is now "A bedbug can bite.". Deleted: adapter, DI_PORTS row, Pip pose + hand Pip + Pip surface test, tutoring block, scripted di-script suite (build-gate assertions moved to `wordWorkoutDomain.test.ts`).
- 2026-10-13 — **R13 word space** (`/add-word-space`). Before (`qa/word-space-lab/2026-10-13/word-workout/before.txt`): real_vs_nonsense cat/zat, pig, dog, sun, bed at every tier with "zed" (a real word) as nonsense; picture_match cat, sun, pen; word_chains cat-cot-pot-pit with "pag" inside a chain of real words; code-table modes identical across tiers. After: real_vs_nonsense easy hit/yez → hard fun/vun, sob/pob; picture_match hard fin vs fan, bug vs bun; chains easy van>tan>ten>men → hard men>met>pet>pat; inflected easy cats → hard rested. New build artifact `service/wordSpace/nonsense.json` (342 strings).

- 2026-09-28 — R12 added (handoff 22 L3). R11's "the spoken modes declare none" is superseded by R12. The chunk divider waits for a first try so it does not undo the cold-read-before-chunks rule of the extended modes.

- 2026-09-28 — R11 added. The R1 conflict the derivation raised for `two_far_pictures` is resolved as it proposed: the foil shares no first or last letter, and both words stay in the lesson's vowels.

- 2026-09-28 — derived (initial), step 1 of handoff 22 L1. 10 requirements (all OBSERVED), 1 open conflict (C1). Lever notes for `picture_match`: help `sound_dots` is compatible if it is picture_match-only, visual only (R4), one dot per grapheme of the printed word, never on or near a picture, and leaves the option buttons and their `picture-<word>` labels unchanged (R3, R5). Simplify `two_far_pictures` fits R2 and R5 (the build gate already accepts 1-of-2) once C1 is settled; it must keep the checked tap (R2), mark nothing before credit (R3), be ungraded and out of `pictureMatchAccuracy` (R8), and a tap on its foil names `other_word` or `same_vowel` (R7). Existing support tiers do nothing for picture_match (R6).
