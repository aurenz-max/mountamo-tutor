# Contract: cvc-speller

- **Derived:** 2026-09-27 · evidence window: eval-reports 2026-03-15→2026-06-25 + misconception-test 2026-07-12 + reader-fit PRE 2026-07-14 + K census trace 2026-07-14 + workspace rollout B2 live 2026-09-24 + authored map (live backend, 2026-09-27) + git to 2026-03
- **Component:** `primitives/visual-primitives/literacy/CvcSpeller.tsx` (+ `cvcSpellerWorkspace.ts`, `cvcSpellerScript.ts` helpers) · **Generator:** `service/literacy/gemini-cvc-speller.ts` · **Catalog:** `service/manifest/catalog/literacy.ts:3130` · **Live adapter:** `components/live-activity/adapters/cvcSpellerLive.ts`
- **Status:** ACTIVE (no open conflicts; 2 catalog divergences flagged below)

Derived as step 1 of handoff 22 (`qa/live-runtime-handoffs/22-literacy-levers.md`), before
in-item levers are added to `spell_word`. Channel [4] (calibration) unavailable this run
(`/api/calibration/items` → Not authenticated, same as number-line 2026-08-03). No fresh
census; channel [1] = the saved 2026-07-14 K census trace.

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| **LA006-07-a** (G1) "Spell common CVC and CVCe words by dragging letters into the correct sequence" — the only authored consumer; its CVCe half is outside this primitive's scope (see Catalog projection) | authored map [3] | `GET /api/curriculum/primitive-mappings/language_arts` (inverted 2026-09-27; 1 of 65 mappings) · description via `qa/curriculum-fit/letter-workshop-2026-09-07.json:106` | live |
| K census — "Decode CVC words with short a": routes spell-word AND word-sort, both in scope | census [1] | `qa/topic-traces/k-cvc-short-a-2026-07-14.md:12-13` | 2026-07-14 |
| K PRE band (pre-reader), all three modes READY | reader-fit [2] | `qa/reader-fit/cvc-speller-PRE-2026-07-14.md`; EVAL_TRACKER RF-1..RF-6 (`qa/EVAL_TRACKER.md:684-688`) | 2026-07-14 |
| Support-tier + structural-difficulty campaign | eval [2] | `qa/eval-reports/cvc-speller-2026-06-25.md` | 2026-06-25 |
| Misconception loop (vowel substitution, final omission) | misconception [2] | `qa/misconception/cvc-speller-letter-sound-link-2026-07-12.md` | 2026-07-12 |
| Shared teaching workspace (tutor/JEV, W1 binding B2) + live journey harness | live [2] + code | `qa/tutor-reports/workspace-rollout-B2-2026-09-24.md:19,45-49`; `liveJourneySpec.ts:965-984` | 2026-09-24 |
| Named misses for the trigger ladder (A5) | code [5] | `1a0cd42a`; catalog `teachingWorkspace.misses` (`literacy.ts:3337`) | 2026-09 |
| Pip shared surface | code [5] | `e7beca56`; `pip/cvcSpellerPipPose.ts` | 2026-09-15 |

Real-usage channel [4]: unknown (auth), not zero.

## Requirements

### R1 — Letter-group scope and word variety · OBSERVED
- **Property:** every word is 3 letters (CVC) and every letter comes from the cumulative letter group (1-4); a vowel focus applies only when the objective names a vowel, otherwise words spread across the group's vowels; a named vowel can only raise the group. No repeated word and no repeated rime in a session (`enforceCvcScopeAndVariety`, code-owned, remove-only, floor of 3 challenges). The manifest never supplies words.
- **Demanded by:** K CVC spelling / short-vowel objectives; LA006-07-a.
- **Evidence:** `gemini-cvc-speller.ts:496-560` (live probe caught `jam`, `fox`, `pat`/`sat`); `qa/topic-traces/k-cvc-short-a-2026-07-14.md:12-13`; `gemini-cvc-speller.test.ts` "topic scope".
- **Probe:** `GET /api/lumina/eval-test?componentId=cvc-speller&evalMode=spell_word&grade=K&topic=short a words` → every letter ∈ group letters, all short-a, no shared rime; generic topic → vowels spread across the group.

### R2 — Mode identity and answer modality · OBSERVED
- **Property:** `fill_vowel` and `word_sort` are answered ALOUD (the middle sound, judged as a sound, never a letter name); there are no vowel buttons and no sort buckets. `spell_word` is a build: a letter into each of three Elkonin boxes from a bank, and the third letter landing is the commit, checked in code (`spellingMatches`), never by the tutor. No Check / Next / Finish / Skip / Clear / Stretch button in any mode.
- **Demanded by:** DI port (qa/di/BACKLOG item 16), K PRE band, workspace B2.
- **Evidence:** `CvcSpeller.reader-fit.test.tsx` §1 gate A; `CvcSpeller.workspace.test.tsx:38`; catalog `literacy.ts:3158-3173` comment.
- **Probe:** `npm test -- CvcSpeller` → gate A passes in all three modes; the third tapped letter commits with no other control.

### R3 — Nothing names the answer before credit · OBSERVED
- **Property:** `fill_vowel`: the middle box shows `?` until credited, and the keyword line ("like apple") appears only after credit. `word_sort`: columns are built only from credited answers, labelled when their first word is credited. `spell_word`: the boxes start empty, the bank never marks which letters are the answer (vowels and consonants are coloured by category only, every letter alike), the assignment publishes no `expectedAnswer`, and the scene facts carry only the learner's own boxes. The vowel keyword is correction/credit-only on the spoken modes because there it IS the answer. No dev slug or IPA reaches the child's field.
- **Demanded by:** every consumer (Pedagogy rule #1); K PRE band (RF-4).
- **Evidence:** `CvcSpeller.reader-fit.test.tsx` §1 gate B (asserts no `apple`/`egg` text on fill-vowel at G1); `cvcSpellerWorkspace.ts:24-31,63-73`; `cvcSpellerScript.ts:118-125`.
- **Probe:** `npm test -- CvcSpeller.reader-fit` gate B; mount each mode at grade 1 and assert no vowel keyword and no filled box before a credit.

### R4 — Hear It says the whole word and stops · OBSERVED
- **Property:** one audio affordance in every mode; each tap sends a silent host message asking the tutor to say the current word once, whole (`hearWordRequest`). It never stretches, isolates or spells a sound, and it is never withdrawn by band or tier.
- **Demanded by:** K PRE band (STIMULUS recovery for pre-readers); workspace guidance.
- **Evidence:** `CvcSpeller.reader-fit.test.tsx:177-196`; `CvcSpeller.workspace.test.tsx:68`.
- **Probe:** `npm test -- CvcSpeller` → three taps send three `"<word>"` whole-word requests, no stretch tags.

### R5 — Letter bank shape · OBSERVED
- **Property:** the `spell_word` bank = the 3 target letters + the item's distractor letters (never a target letter), topped up to 5 from `availableLetters` only when smaller; shuffled once per item. Each bank tile is a button labelled `letter <x>` and each box `box <n>` (the live journey harness and the tests select by these labels).
- **Demanded by:** K PRE element load (RF-3: the full union had defeated the tier cap); support tiers (R6); live harness (`liveJourneySpec.ts:980`).
- **Evidence:** `CvcSpeller.tsx` `letterBank`; `CvcSpeller.reader-fit.test.tsx:199-207`; `qa/eval-reports/cvc-speller-2026-06-25.md` (20k runs: exact count, no target leak).
- **Probe:** `npm test -- CvcSpeller.reader-fit` bank test; `run_live_runtime.py --primitive cvc-speller --mode spell_word` presses `letter <x>`.

### R6 — Support-tier invariants · OBSERVED
- **Property:** absent/unknown `config.difficulty` → no-op. With a tier: `showPictureCue` is withdrawn at hard (spell-word, word-sort); spell-word distractor count clean 1 / some 3 / full 5, similarity far → near; word-sort contrast vowel far → near. A tier never changes the words, the vowel focus or the answer.
- **Demanded by:** support-tier + structural-difficulty campaign; adaptive difficulty.
- **Evidence:** `qa/eval-reports/cvc-speller-2026-06-25.md`; `gemini-cvc-speller.ts:57-160,794-835`.
- **Probe:** eval-test `evalMode=spell_word&grade=K&difficulty=easy|hard|none` → distractor counts 1/5/LLM, picture cue true/false/undefined, same word scope.

### R7 — Checked build, named miss, Elkonin retry · OBSERVED
- **Property:** a wrong build commits with a named miss (`cvcMiss`: `first_letter`, `middle_letter`, `last_letter`, `letters_out_of_order`, `two_or_more_letters`), matching the catalog `teachingWorkspace.misses`. Try again keeps the letters that were right and clears only the wrong ones; tapping a filled box empties it. Pip never places a letter or commits.
- **Demanded by:** workspace B2; trigger ladder / named misses (A5); Pip surface.
- **Evidence:** `CvcSpeller.workspace.test.tsx:38`; `cvcSpellerWorkspace.test.ts`; live `qa/tutor-reports/cvc-speller-w1-spell_word-text-2026-09-24-r4.json` (s-a-t → Try again keeps a,t → c).
- **Probe:** `npm test -- CvcSpeller.workspace cvcSpellerWorkspace`.

### R8 — Workspace-only path and evaluation · OBSERVED
- **Property:** the component runs only when bound to the shared teaching workspace (`withWorkspaceOnly`; unbound → "needs the tutor" card). Bound sessions send `tutoring: null` (adapter `workspaceAdapter`, lesson `lessonPrimitiveContext`), so the catalog `tutoring` block does not reach the tutor; the tutor's instruction is `teachingWorkspace.guidance`. The session's mode comes from the mount pin. One evaluation per session, with `CvcSpellerMetrics` (vowel/consonant accuracy from checked builds only) and diagnosis evidence below 60%.
- **Demanded by:** workspace B2 (LA-14 ruling 09-23: one path); IRT/mastery.
- **Evidence:** `656131ba`; `adapters/adapterContract.ts:157-158`; `lessonWorkspacePlan.ts:61-66`; B2 report.
- **Probe:** `npm test -- CvcSpeller.workspace lessonWorkspacePlan`; live `run_live_runtime.py --primitive cvc-speller --mode spell_word --lesson-entry`.

### R9 — Tutor never names, sounds out or spells a letter of the item word · OBSERVED
- **Property:** on every mode the tutor may say the whole word (Hear It, after an attempt as modelling allows) but never the item's middle sound, a letter of it, or its sounds in sequence before credit. On `spell_word` the build is checked by the activity, not judged from the open mic.
- **Demanded by:** K PRE band; workspace guidance (`literacy.ts:3331-3335`).
- **Evidence:** B2 live: "cvc-speller never names a letter" (`workspace-rollout-B2-2026-09-24.md:48`); `leakTokens` in `liveJourneySpec.ts:971`.
- **Probe:** live journey transcript: no letter name or isolated sound of the current word before credit.

### R10 — Pre-reader band presentation · OBSERVED
- **Property:** at K the grade/mode/vowel badges, the challenge counter and the reader hint line are hidden; the picture cue is emoji-only (no `imageDescription` sentence); titles with IPA or `short-x` slugs are replaced in code. At Grade 1 the hint line shows.
- **Demanded by:** K PRE band (RF-3, RF-4).
- **Evidence:** `CvcSpeller.reader-fit.test.tsx:163-175`; `gemini-cvc-speller.ts` title sanitizer.
- **Probe:** `npm test -- CvcSpeller.reader-fit` pre-reader band.

### R11 — Misconception remediation · OBSERVED
- **Property:** a `remediationFocus` stamps a per-mode `remediationMove` (`contrast_vowel` / `phoneme_slots` / `minimal_pair_sort`) and steers word choice inside R1 scope; without a focus the output is untagged. The move is a private trace, never rendered.
- **Demanded by:** misconception loop.
- **Evidence:** `qa/misconception/cvc-speller-letter-sound-link-2026-07-12.md` (0 LEAK, 0 OVERREACH); `gemini-cvc-speller.test.ts`.
- **Probe:** `npm test -- gemini-cvc-speller`; eval-test with `remediationFocus` → move set, words in group.

### R12 — In-item levers on spell_word · OBSERVED
- **Property:** `spell_word` declares four levers (`cvcSpellerLevers.ts`); the spoken modes declare one, `middle_model` (a model word outside the item, middle box lit, its middle sound none the session asks): `vowel_keywords` (every group vowel with its keyword picture, at least two, none marked), `consonant_keywords` (a keyword picture under every bank consonant; no keyword pictures a word or picture of the session), `sound_tokens` (three blank tokens moved only by the learner's taps, never feeding the check), and `small_word` (simplify: an in-group picturable CVC word sharing no session word or rime and at most one box with the item, bank = its 3 letters + 1 far consonant, ungraded, out of metrics). A pull is a synchronous commit that changes the screen and the scene (`levers_on_screen`, `tokens_pushed`); the next attempt records the lever. easy starts with `vowel_keywords` up, which is not a pull.
- **Demanded by:** handoff 22 L1; trigger ladder (handoff 21 S2).
- **Evidence:** `qa/eval-reports/cvc-speller-levers-2026-09-28.md`.
- **Probe:** `npm test -- cvcSpellerLevers CvcSpeller.levers.workspace`.

## Conflicts

None open.

## Catalog projection

- **description:** stale. It still describes the retired DI loop ("the tutor says a CVC word, waits, judges the answer, and its own affirmation moves the lesson on"). Proposed: keep the three-mode split and "encoding, the direction phonics-blender does not cover"; replace the DI clock sentence with "the tutor teaches in its own words; the boxes check the spelling". Not applied here (catalog edits re-route lessons).
- **constraints:** faithful for CVC scope. **Divergence:** the only authored consumer, LA006-07-a, also demands CVCe words (cake, kite, bone), which "Only CVC (3-letter) words" cannot serve. A `/pm` routing question, not a contract requirement.
- **evalModes:** faithful.
- **tutoring.aiDirectives:** stale. All directives order `[DI_CVC_ITEM]` / `[DI_CVC_BUILD]` / `[DI_CVC_MOVE_ON]` / `[DI_CVC_COMPLETE]` / `[SAY_WORD]` turns from the retired runner; the only emitters left are unused exports in `cvcSpellerScript.ts` (exercised only by `CvcSpeller.di-script.test.ts`). Bound workspace sessions send `tutoring: null`, so they do not receive these directives (R8). Removal is an `/add-live-tutor-tools` cleanup, like rhyme-studio's in handoff 22 L2.

## Changelog

- 2026-09-29 — R12 extended (handoff 24): `fill_vowel` and `word_sort` declare `middle_model` (help, both): another picture word in three boxes with the middle lit, never a session word or picture, its middle sound none the session asks (a long-vowel word such as rain when every short vowel is asked). R3 holds: the item's vowel and its keyword stay unshown before credit; `other_vowel` is unanswered by decision. Catalog `levers: true` added (the flag had been missing, so the lever doctrine never reached the tutor). `npm test -- cvcSpeller CvcSpeller` 136/136.

- 2026-09-28 — R12 added (spell_word levers, handoff 22 L1). R3, R5, R8, R9 hold: levers are spell_word-only and shown; the practice bank skips the top-up by design; practice stays out of metrics.

- 2026-09-27 — derived (initial), step 1 of handoff 22. 11 requirements (all OBSERVED), 0 conflicts. Channel [4] unavailable (auth). Lever notes for the `spell_word` slice: keyword pictures under bank letters and a vowel keyword strip keep R3 only if they are `spell_word`-only (on the spoken modes the keyword is the answer), cover every bank letter or every group vowel alike, never picture a word used in the session, keep the `letter <x>` labels (R5), and are shown rather than voiced for the item's own letters (R9). Blank sound tokens keep R2 if they never commit or feed the check and count only the learner's pushes (three boxes already show the count). An ungraded simpler word keeps R1 and R2 if it is an in-group CVC word sharing no word or rime with the session, stays a three-box build, gets its own bank without the R5 top-up, is what Hear It says (R4), and is excluded from metrics and diagnosis evidence (R8, R11).
