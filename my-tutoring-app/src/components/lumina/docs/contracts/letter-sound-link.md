# Contract: letter-sound-link

- **Derived:** 2026-09-28 · evidence window: eval-report 2026-03-15 + misconception-test 2026-07-12 + reader-fit PRE 2026-07-14 + K census trace 2026-07-14 + DI port 7 live reports 2026-08-16 + workspace adoption (LA-14) 2026-09-20/21 + authored map (live backend, 2026-09-28) + git to 2026-03
- **Component:** `primitives/visual-primitives/literacy/LetterSoundLink.tsx` (scripted drill + `withTeachingWorkspace` switch) + `LetterSoundLinkTeaching.tsx` (workspace path) + `letterSoundLinkDomain.ts` (items, session gate, assignment, scene, misses) + `letterSoundLinkScript.ts` (retiring DISTAR pack, re-exports the domain) · **Generator:** `service/literacy/gemini-letter-sound-link.ts` · **Catalog:** `service/manifest/catalog/literacy.ts:2618` · **Live adapter:** `components/live-activity/adapters/letterSoundLinkLive.ts`
- **Status:** ACTIVE (no open conflicts; catalog prose stale, see projection)

Derived as step 1 of handoff 22 L1 (`qa/live-runtime-handoffs/22-literacy-levers.md:50`), before
in-item levers are added to `hear_see`. Channel [4] (calibration) not attempted (auth, as for
cvc-speller 2026-09-27). No fresh census; channel [1] = the saved 2026-07-14 K census trace.

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| Authored map: **none** (0 of 65 language_arts mappings target this primitive) | authored map [3] | `GET /api/curriculum/primitive-mappings/language_arts` (2026-09-28) | live |
| K census — "Decode CVC words with short a": routes letter-sound-link with Group-1 letters, short-a target | census [1] | `qa/topic-traces/k-cvc-short-a-2026-07-14.md:10` | 2026-07-14 |
| K PRE band (pre-reader), READY after `--fix` (RF-1, RF-2) | reader-fit [2] | `qa/reader-fit/letter-sound-link-PRE-2026-07-14.md`; `qa/EVAL_TRACKER.md:694-695` | 2026-07-14 |
| Phonics objectives naming letters no mode can ask (lesson-coverage judge) | lesson-bench [2] | stops ruling `52b6d5ba`; `unaskableLetters` | 2026-09-05 |
| Misconception loop (sound / letter / keyword contrast) | misconception [2] | `qa/misconception/cvc-speller-letter-sound-link-2026-07-12.md` | 2026-07-12 |
| DI port 7 (session invariant, anchor map, sentinel) | live [2] | `qa/tutor-reports/letter-sound-link-live-di-*-2026-08-16.md`; `8daf2a87` | 2026-08-16 |
| Shared teaching workspace (tutor/JEV, LA-14) + live journey harness | live [2] + code | `qa/tutor-reports/letter-sound-link-teaching-2026-09-20.md`; `host-text-source-2026-09-21.md:40` (hear_see 3/3); `liveJourneySpec.ts:847-873` | 2026-09-21 |
| Named misses for the trigger ladder (A5) | code [5] | `1a0cd42a`; catalog `teachingWorkspace.misses` (`literacy.ts:2635`) | 2026-09 |
| Pip shared surface (scripted path) | code [5] | `c6f608e9`; `pip/letterSoundLinkPipPose.ts` | 2026-09-15 |
| Pip shared surface (teaching workspace) | code [5] | `pip/LetterSoundLinkWorkspace.surface.test.tsx`; `LetterSoundLinkTeaching.tsx` | 2026-09-29 |

Real-usage channel [4]: unknown (auth), not zero. With no authored consumer, every consumer is
emergent (manifest routing) or a platform consumer (workspace, harness, misconception, PRE band).

## Requirements

### R1 — Letter-group scope and per-mode askability · OBSERVED
- **Property:** every target and option letter comes from the cumulative letter group (1: s a t i p n; 2 adds c k e h r m d; 3 adds g o u l f b; 4 adds j z w v y x qu). `see-hear` targets only `PRODUCIBLE_LETTERS` (held sounds, short vowels, clipped stops t p c k h d g b); `keyword-match` never targets a letter whose anchor picture does not read as its word (`i`, `x`), and both of its pictures must be nameable; `hear-see` may target any group letter. Illegal draws are retargeted in code; letters the objective names but no session mode can ask are reported as `unaskableLetters`, never dropped silently. The workspace path drops any unaskable item (`askableOnly`).
- **Demanded by:** K census; lesson-coverage judge; DI port 7; workspace.
- **Evidence:** `letterSoundLinkDomain.ts:62-102,150-213,418-436`; `gemini-letter-sound-link.ts:693-805`; `gemini-letter-sound-link.test.ts` "DI content gate".
- **Probe:** `npm test -- gemini-letter-sound-link letterSoundLinkDomain`; eval-test `componentId=letter-sound-link&evalMode=hear_see&grade=K` → every letter in group, exactly 2 options, 1 correct.

### R2 — Mode identity and answer channel · OBSERVED
- **Property:** `see_hear` = a printed letter, the child SAYS its sound. `keyword_match` = a printed letter and two pictures, the child SAYS the picture word; nothing is tappable. `hear_see` = the tutor says the sound (`facts.soundToSay`), the child TAPS one of exactly two letter cards; the tap is the commit and is checked in code (`checkResponse`), never by the tutor, and nothing spoken is an answer. No Next / Check / Finish / Skip in any mode. On the workspace the hear_see cards are buttons labelled `Tap the letter <X>` with `data-letter-option`; the harness chooses by the uppercase letter.
- **Demanded by:** DI port 7 (letter NAME is a blocked response class); K PRE band; workspace; live harness.
- **Evidence:** `letterSoundLinkDomain.ts:248-260`; `LetterSoundLinkTeaching.tsx:86-91,141-146,181-196`; `LetterSoundLink.teaching.test.tsx:229-260`; `LetterSoundLink.reader-fit.test.tsx:127-190`.
- **Probe:** `npm test -- LetterSoundLink`; `run_live_runtime.py --primitive letter-sound-link --mode hear_see --audio` (paid; only when a change can affect tutor behaviour).

### R3 — Nothing names the answer before credit · OBSERVED
- **Property:** the keyword anchor (word or picture) is never on the stage before a committed correct attempt on that item, in any mode. `see_hear` reveals its anchor only after credit and the anchor word is absent from its packet. `keyword_match` prints the picture word only under the credited picture. `hear_see` never draws its anchor at all, publishes no `expectedAnswer`, puts both letter cards in one scene group that does not say which is right, and offers no `demonstrate` (every object on its stage is an answer option). Letter colours are by vowel/consonant category only.
- **Demanded by:** every consumer (Pedagogy rule #1); K PRE band; workspace.
- **Evidence:** `LetterSoundLinkTeaching.tsx:28-36,127-139,209-221`; `letterSoundLinkDomain.ts:543-572`; `LetterSoundLink.teaching.test.tsx:146,207,217`; `liveJourneySpec.ts:869-872` (`data-letter-revealed` counts 0 before a credit).
- **Probe:** `npm test -- LetterSoundLink.teaching LetterSoundLink.reader-fit`; journey transcript: `data-letter-revealed` = 0 until a committed success.

### R4 — Session invariant: a letter is answered once and never returns as the wrong choice · OBSERVED
- **Property:** across a session no letter is asked twice, and no letter or anchor word that an earlier item has named (answered letter; anchor of a `see-hear`/`keyword-match` item) appears as an option later. `hear-see` does not add its anchor to the named set because it never shows or says it. Enforced at the item-build boundary (`itemsFromChallenges`), so it covers cached and hand-authored payloads; the generator also retargets and excludes spent letters when picking distractors.
- **Demanded by:** DI port 7 (probe drew 3 of 6 items solvable by elimination); N challenges = N problems.
- **Evidence:** `letterSoundLinkDomain.ts:334-402`; `gemini-letter-sound-link.ts:419-458,700-773`; `qa/tutor-reports/letter-sound-link-live-di-*-2026-08-16.md`.
- **Probe:** `npm test -- gemini-letter-sound-link LetterSoundLink.di-script` (session gate cases).

### R5 — hear_see distractor shape · OBSERVED
- **Property:** exactly two options; the wrong letter is a phonologically confusable in-group letter (`CONFUSABLE_DISTRACTORS`: voicing pairs, short-vowel pairs, m/n, l/r), not already answered, preferring one not already shown as wrong; with no in-group confusable (most of group 1) it falls back to any group letter with a different sound. `c` and `k` are never paired; a `c`/`k` target carries `sharedSoundLetters: ["c","k"]`.
- **Demanded by:** hear_see task identity ("which of two confusable letters"); misconception loop (`contrast_letter`).
- **Evidence:** `gemini-letter-sound-link.ts:385-458,621-650,756-758`; catalog description `literacy.ts:2641-2643`.
- **Probe:** eval-test `evalMode=hear_see&grade=K` at groups 2 and 3 → each foil is a table confusable of its target or a group fallback, never the target's same-sound partner.

### R6 — Named miss on a wrong tap · OBSERVED
- **Property:** a wrong `hear_see` tap commits with `letterSoundMiss`: `other_short_vowel` (both vowels), `voicing_partner` (t/d, p/b, s/z, f/v, k/g, c/g), else `other_letter`, matching catalog `teachingWorkspace.misses.hear_see`. The spoken modes emit no named miss. Wrong gesture attempts feed `confusedSoundPairs` (sorted `a↔b` pairs), and nothing else does.
- **Demanded by:** trigger ladder / named misses (A5); IRT metrics.
- **Evidence:** `letterSoundLinkDomain.ts:582-598`; `literacy.ts:2634-2635`; `LetterSoundLink.teaching.test.tsx:388`.
- **Probe:** `npm test -- LetterSoundLink.teaching` ("records the confused letter pair").

### R7 — Support tier invariants · OBSERVED
- **Property:** absent tier → nothing stamped, workspace assumes `medium`. The tier never changes which letter, sound, keyword or correct option is drawn. An objective that asks for independent production forces `hard`. On the workspace the tier reaches the tutor only as `facts.supportTier`, plus `facts.coldAsk` on hard for the two spoken modes (never on `hear_see`). The generator still stamps the legacy per-challenge scaffold (`showKeywordAnchor`, `strategyHint`, `protocolHint`, `showSharedSoundHint`, `auditionBeforeCommit`) and `maxAttempts` (3/3/2); **no render path reads the five scaffold fields** — they are typed on `LetterSoundLinkChallenge` as INERT and `itemFromChallenge` does not carry them.
- **Demanded by:** support-tier campaign; adaptive difficulty; workspace.
- **Evidence:** `gemini-letter-sound-link.ts:29-133,510-517,844-858`; `LetterSoundLink.tsx:101-110`; `letterSoundLinkDomain.ts:563-570`.
- **Probe:** eval-test `evalMode=hear_see&difficulty=easy|hard|none` → same letter scope, scaffold fields stamped/absent; `npm test -- LetterSoundLink.teaching` (coldAsk only on spoken hard).

### R8 — Two mount paths and one evaluation · OBSERVED
- **Property:** `withTeachingWorkspace` mounts `LetterSoundLinkTeaching` inside a live runtime and the scripted DISTAR drill otherwise (the scripted path is not deleted; unlike cvc-speller there is no workspace-only gate). Bound sessions send `tutoring: null`, so the catalog `tutoring` block does not reach the tutor; the tutor's instruction is `teachingWorkspace.guidance` (1854/2000 chars at adoption). The workspace mode comes from the mount pin. One evaluation per session with `LetterSoundLinkMetrics` (`phonemeToGraphemeAccuracy` = hear-see items; keyword-match counts toward neither direction).
- **Demanded by:** workspace (LA-14); IRT/mastery.
- **Evidence:** `LetterSoundLink.tsx:593-599`; `LetterSoundLinkTeaching.tsx:97-123`; `LetterSoundLink.teaching.test.tsx:414`; adoption report.
- **Probe:** `npm test -- LetterSoundLink.teaching lessonWorkspacePlan`.

### R9 — The tutor never names a letter on the hear_see stage · OBSERVED
- **Property:** on `hear_see` the tutor says the sound (`soundToSay`, code-owned utterable spelling from `spokenSoundFor`: stretched for held sounds, slash notation for stops) and stops; it never says, spells or points out either letter on screen, and judges nothing it hears. On the spoken modes a letter NAME is named in the assignment as the miss, not accepted.
- **Demanded by:** workspace guidance (`literacy.ts:2620-2633`); DI port 7.
- **Evidence:** `letterSoundLinkDomain.ts:492-522`; `host-text-source-2026-09-21.md:40` (hear_see 3/3); `LetterSoundLink.teaching.test.tsx:182`.
- **Probe:** live journey transcript on `hear_see`: no letter name of either option before the tap.

### R10 — Pre-reader chrome, scripted path · OBSERVED
- **Property:** on the scripted drill at grade K the group/mode badges are hidden; the challenge counter is dots only. (The workspace card shows "Letter group N" and a mode badge at every grade — not covered by RF-1/RF-2, which predate it.)
- **Demanded by:** K PRE band (RF-2).
- **Evidence:** `LetterSoundLink.tsx:192-193,542-550`; `LetterSoundLink.reader-fit.test.tsx:192-205`.
- **Probe:** `npm test -- LetterSoundLink.reader-fit` chrome gate.

### R11 — Misconception remediation · OBSERVED
- **Property:** a `remediationFocus` stamps a per-mode private `remediationMove` (`contrast_sound` / `contrast_letter` / `contrast_keyword`) and steers the wrong option toward the diagnosed confusion; `hear_see` claims it only when both named letters are in the group. Without a focus the output is untagged. The move is never rendered.
- **Demanded by:** misconception loop.
- **Evidence:** `gemini-letter-sound-link.ts:136-154,764-770`; `gemini-letter-sound-link.test.ts:70-93`; `qa/misconception/cvc-speller-letter-sound-link-2026-07-12.md`.
- **Probe:** `npm test -- gemini-letter-sound-link` remediation cases.

### R12 — In-item levers on hear_see · OBSERVED
- **Property:** `hear_see` declares up to three levers (`letterSoundLinkLevers.ts`), none on the spoken modes. `keyword_under_both` draws a keyword picture under BOTH cards alike, only when both pictures read as their word and neither letter nor keyword comes up in a later item (R4); the scene says "under each card" and never which picture is where. It is the one exception to "the anchor is drawn only after credit" (R3), since it marks neither card. `voice_feel_model` appears only on a voicing-pair item: pictures of another pair (snake sss / bee zzz, or wind fff / race car vvv), no letters. `far_letter_pair` (simplify) opens an ungraded practice item with a new sound whose letters the session never uses, against a foil of the other kind. A pull is a synchronous commit; the next attempt records the lever. `demonstrate` stays refused (R9).
- **Demanded by:** handoff 22 L1; trigger ladder (handoff 21 S2).
- **Evidence:** `qa/eval-reports/letter-sound-link-levers-2026-09-28.md`.
- **Probe:** `npm test -- letterSoundLinkLevers LetterSoundLink.levers.workspace`.

## Conflicts

None open.

## Catalog projection

- **description:** stale. Still the DI clock ("the tutor asks, waits, judges the answer and its own affirmation moves the lesson on", "Requires a microphone"). Proposed: keep the three-direction split; replace the DI sentence with "the tutor teaches in its own words; Find the Letter is checked by the tap". Not applied (catalog edits re-route lessons).
- **constraints:** stale on one point: "Say the Sound can only target letters whose sound can be HELD" — clipped stops t p c k h d g b are askable since the 2026-09-05 ruling (R1). Rest faithful.
- **evalModes:** not re-read this run.
- **tutoring:** stale DI block (`[LSL_TAP]`, scripted correction lines); bound workspace sessions send `tutoring: null` (R8). Removal is an `/add-live-tutor-tools` cleanup.

## Changelog

- 2026-09-29 — handoff 24: `see_hear` and `keyword_match` declare `letter_model` (help, both): another letter card, one the session never asks, offers or pictures, of the item's sound kind; its keyword picture beside it on keyword_match. R3 and R4 hold: the item's anchor stays hidden before credit, and the model letter is no session letter (`letterModelLeak`). `other_sound` unanswered by decision. Catalog `levers: true` set, guidance trimmed 2212 -> under 2000 with every rule kept. "I'm stuck" before a try now pulls the model (trigger ladder); the teaching test's advisory-signal case was updated to expect it. `npm test -- letterSoundLink LetterSoundLink` 132/132.

- 2026-09-28 — R12 added (hear_see levers, handoff 22 L1). R3 narrowed by user approval: symmetric keyword pictures under both cards are allowed as a pulled lever. The `LetterSoundLink.teaching.test.tsx` operations assertion now includes `pull_lever`.

- 2026-09-28 — derived (initial), step 1 of handoff 22 L1. 11 requirements (all OBSERVED), 0 conflicts. Channel [4] not attempted. Lever notes for the `hear_see` slice:
  - **`keyword_under_both`** keeps R3 only as a pulled help (or a tier start, which is a pedagogy decision: with pictures up the item becomes sound→picture-onset matching), with a picture under BOTH cards and never the target alone. It touches R4: once pulled, both letters' anchors are named, so a later item targeting either letter, or offering either letter or anchor, is told or eliminable; the build-time gate cannot see a mid-session pull, so the lever must carry that rule. It cannot serve any pair containing `i` (anchor `itch` 🤏, `namesItsPicture: false`), which in group 1 is every vowel pair (a↔i).
  - **`voice_feel_model`** keeps R3 and the no-`demonstrate`-on-options rule if the model pair shares no letter with the item and none with any session target or option (R4), and any demonstrate it enables targets only the model objects. If it prints letters they must be in-group (R1): group 1 has no voicing pair and group 2 has only t/d, so a disjoint printed pair exists only from group 3; a sounds-only model has no such limit.
  - **`far_letter_pair`**: hear_see already has exactly two choices (R2, `letterSoundChallengeValid`), so the simplification is the foil swap alone. It keeps R1/R4/R5 if the far foil is in-group, a different sound, never the c/k partner, and not an answered letter; its misses will always classify as `other_letter` (R6). Shape distance has no table in code yet. Whether the simplified item is graded, and whether its wrong taps enter `confusedSoundPairs`, needs a ruling (cvc-speller's `small_word` was ungraded and out of metrics).
  - `showKeywordAnchor` / `showSharedSoundHint` are generation-only (R7): stamped at `gemini-letter-sound-link.ts:847-850`, read by no component. `showKeywordAnchor: 'proactive'` (easy) would break R3 on `see_hear` and on the `hear_see` target card if wired as named; only the under-both form fits.
