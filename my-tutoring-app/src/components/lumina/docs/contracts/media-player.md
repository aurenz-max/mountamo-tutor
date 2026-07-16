# Contract: media-player

- **Derived:** 2026-07-16 · evidence window: fresh 9-lesson census 2026-07-16 (`qa/topic-traces/media-player-census-2026-07-16.md`) + K census 2026-07-14 + curriculum-fit probe 2026-07-16 (LANGUAGE_ARTS K/1/2) + authored social_studies map + Firestore `item_calibration` + EVAL_TRACKER (MP-1..3, SP-13) + eval report 2026-04-02 + tutor sweep 2026-07-08 + git to 2026-03.
- **Component:** `primitives/MediaPlayer.tsx` · **Generator:** `service/media-player/gemini-media-player.ts` (registered context-native, `service/registry/generators/mediaGenerators.ts:22`) · **Catalog:** `service/manifest/catalog/media.ts:10` · **Types:** `types.ts:1086–1120`
- **Status:** ACTIVE — C1 RESOLVED 2026-07-16 via fork rungs 1+2 (eval-mode split `listen_and_look`/`listen_for_details`/`story_analysis` + `isPreReaderGrade(data.gradeLevel)` presentation gate). EMERGING/ESTABLISHED polish continues in the media-player-reimagining workstream (B2/B3); edits there still read this contract first.

Derived as Step 1 of the #9a reimagining — this contract is the "what must survive" ledger
for that rebuild. media-player is an early, ambitious primitive (git: last consumer-driven
feature commit is `3dbc3ea` "evaluation and knowledge checks", 2026-03; everything since is
platform sweeps), with real but thin usage (2 calibration observations, 2026-03) and a
catalog written before the K–2 band system existed.

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| **G1 social_studies narrated-listening** — `SS001-05-c` (Independence Day origins), `SS004-05-c` (invention impact); authored `target_primitive: media-player`, constraints "audio track; 3–4 multiple-choice questions" | authored map + census | primitive-mappings/social_studies; census 07-16 routed **2/2** on these topics ("3-segment narrated story" intents) | 2026-07-16 |
| **K narrated "why" explainer** — needs-vs-wants (07-16), community-helpers (07-14) | census | census 07-16 **1/6**; census 07-14 hit (`k-community-helpers-2026-07-14.md`: KC options are text sentences at K → reader-fit) | 2026-07-16 |
| **Live tutor narration** (Gemini Live) — READ_ALOUD / READ_KNOWLEDGE_CHECK / NEXT_SEGMENT beats + struggle responses | tutor-test | `qa/tutor-reports/sweep-2026-07-08.json` — media-player in the PASSING set; all 9 contextKeys supplied by `aiPrimitiveData` | 2026-07-08 |
| **IRT / calibration** — single item `media-player_default` | Firestore `item_calibration` | 2 observations (2/2 correct), θ-sum 8.0, empirical β 2.0 → calibrated **β 2.9**; created/updated 2026-03-07/08 | 2026-03-08 |
| **Eval-test / QA** — 1 mode tested, 0 pass | EVAL_TRACKER | row (1/0/1, 2026-04-02); MP-1 (CRITICAL title echo), MP-2 (CTA below fold), MP-3 (no evalModes); SP-13 deadlock class | 2026-04-02 |
| **Reader-fit PRE (queued demand, not yet served)** | QA register | explainer-tail 2026-07-15: QUEUED — `PreReaderSelfCheck` fits the per-segment KC; BACKLOG #9a supersedes with full reimagining | 2026-07-16 |
| Grade 3+ (catalog's claimed home) | census | **zero routing** at G3 (water cycle, 07-16) — a claimed consumer with no observed demand | 2026-07-16 |

## Requirements

### R1 — multi-segment narrated walkthrough with a per-segment comprehension gate · OBSERVED
- **Property:** the lesson is N sequential segments (`config.segmentCount`, default 4; curator intents typically ask for 3), each carrying `title` (3–5 words), `script` (2–3 spoken-style sentences), `imagePrompt`, and an MCQ `knowledgeCheck` (`question`, 2–4 `options`, `correctOptionIndex`, optional `explanation`). The student must answer the current segment's check correctly — or exhaust 3 attempts — before the next segment unlocks (`handleNext` gate, `MediaPlayer.tsx:207–228`). This progressive listen→check→unlock loop IS the primitive's identity; both authored G1 homes describe exactly it.
- **Demanded by:** G1 social_studies listening consumers; K explainer consumer; curator (its intents are written segment-by-segment against this shape).
- **Evidence:** schema `gemini-media-player.ts:55–99`; component gate + phase machine (`SegmentPhase`, `MediaPlayer.tsx:42`); SS001-05-c/SS004-05-c constraints; census intents 07-16.
- **Probe:** replay a census body → `segments.length === segmentCount`, every segment has a `knowledgeCheck` with `correctOptionIndex` in range; driven flow: Next stays disabled until the current KC is answered.

### R2 — narration is the Gemini Live tutor, triggered by tagged sendText beats · OBSERVED
- **Property:** ALL audio is the live tutor (no TTS, no audio files — `audioBase64` is a legacy field, always `null`). The component fires, once per segment via ref-latches: `[READ_ALOUD]` with the full script on segment entry (`MediaPlayer.tsx:158–170`), `[READ_KNOWLEDGE_CHECK]` with question + lettered options on check reveal (`:190–204`), `[NEXT_SEGMENT]`, `[ANSWER_CORRECT/INCORRECT]`, `[MAX_ATTEMPTS]`, `[LESSON_COMPLETE]`. Catalog aiDirectives make the tutor read the FULL script (never summarize) and read options A–D neutrally. `aiPrimitiveData` supplies every catalog contextKey (`title`, `currentSegmentIndex`, `totalSegments`, `currentSegmentTitle`, `currentSegmentScript`, `segmentPhase`, `hasKnowledgeCheck`, `knowledgeCheckQuestion`, `knowledgeCheckOptions`) — a broken `{{key}}` renders silent ([[tutor-test-harness]]).
- **Demanded by:** the listening-comprehension consumers (the audio channel is the OBJECTIVE, not chrome — "Focus: Oral comprehension"); live-tutor consumer.
- **Evidence:** catalog `tutoring` block (`media.ts:15–94`); component sendText sites; tutor sweep PASS 2026-07-08.
- **Probe:** `/tutor-test media-player --probe` → 0 findings, all contextKeys resolve, the three READ directives present. Runtime: drive a segment → tutor reads the script verbatim-ish, then the KC with options, no hint.

### R3 — checks are answerable from that segment's narration alone · OBSERVED (prompt-enforced)
- **Property:** each `knowledgeCheck` tests the KEY concept of ITS segment and is answerable ONLY from that segment's script — a student who only listened can answer. Distractors plausible, not trivial-recall.
- **Demanded by:** G1 listening consumers ("check-for-understanding questions" about what was heard); pedagogy.
- **Evidence:** generator KNOWLEDGE CHECK REQUIREMENTS block (`gemini-media-player.ts:110–117`).
- **Probe:** eval-test-style judge on a draw: for each segment, the correct option is derivable from `script` alone (no outside knowledge), distractors are wrong-on-reflection. Prompt-enforced only — no code validator; treat like phonics-blender R6.

### R4 — no answer leak before evaluation · OBSERVED
- **Property:** the correct option is never distinguishable pre-submit (no default selection; options rendered uniformly); `[READ_KNOWLEDGE_CHECK]` and `[ANSWER_INCORRECT]` explicitly forbid hinting; the correct answer is revealed ONLY on a correct submit (explanation) or at max-attempts (R5). Pedagogy rule #1.
- **Demanded by:** every evaluating consumer + IRT (β is garbage if the UI leaks).
- **Evidence:** RadioGroup render (`MediaPlayer.tsx:774–803`); "Do NOT hint" in both sendText bodies + catalog KC directive.
- **Probe:** driven/jsdom: fresh segment → no option pre-selected, DOM identical across options modulo text; incorrect submit → feedback contains no correct-answer text.

### R5 — 3-attempt retry, then reveal + skip; never a hard lock · OBSERVED
- **Property:** `MAX_ATTEMPTS_PER_SEGMENT = 3`; wrong answers give encouraging retry feedback with attempt count; at 3 the correct answer + explanation are shown and voiced (`[MAX_ATTEMPTS]`) and a "Continue" affordance advances — `skippedAfterMaxAttempts` is recorded so scoring stays honest (R6). A struggling student always has a forward path (SP-13's sibling failure — soft-locks — is a known platform hazard).
- **Demanded by:** session-flow consumers (K-stage/daily session must never stall); pedagogy (learn from the reveal).
- **Evidence:** `handleAnswerSubmit`/`handleSkipAfterMaxAttempts` (`MediaPlayer.tsx:236–308`); max-attempts render (`:848–876`).
- **Probe:** driven/jsdom: 3 wrong submits → reveal + working Continue; metrics carry `maxAttemptsReached`/`skippedAfterMaxAttempts: true`.

### R6 — single end-of-lesson evaluation with MediaPlayerMetrics · OBSERVED
- **Property:** exactly one `submitResult` per instance, at lesson completion (effect on `lessonComplete`), with `MediaPlayerMetrics`: per-segment results (question, studentAnswer, attempts, timeToAnswer), `knowledgeCheckAccuracy` as score, `success = allSegmentsCompleted && all correct`, first-attempt rate, skipped count; `studentWork` carries the raw answers. This shape feeds `item_calibration` (`media-player_default`, β 2.9) and the analytics read-model — a reimagining that splits into eval modes must keep one-submission-per-instance semantics and metric names or migrate the calibration identity deliberately ([[misconception-loop]] identity = primitive_type + declared scope).
- **Demanded by:** IRT/calibration consumer; student-analytics read-model; XP/activity log.
- **Evidence:** `submitFinalEvaluation` (`MediaPlayer.tsx:345–410`); `usePrimitiveEvaluation` wiring (`:117–131`); live calibration doc (2 obs, 2026-03).
- **Probe:** drive a full lesson → exactly one submission; metrics validate against `MediaPlayerMetrics`; a Firestore attempt row lands with `primitive_type: media-player`.

### R7 — visuals are on-demand, never upfront · OBSERVED
- **Property:** the generator ships `imagePrompt` + `imageUrl: null` for every segment; images are generated only when the student clicks "Generate Visual" (`/api/lumina` action `generateMediaImage`, 16:9, `imageResolution` config default 1K) — the MachineProfile pattern, deliberately avoiding slow/expensive upfront generation for segments never reached. Failure is non-fatal (error state + retry).
- **Demanded by:** platform cost/latency; the visual channel for the K/G1 consumers.
- **Evidence:** generator doc-comment + `generateMediaImage` export (`gemini-media-player.ts:150–189, 191–220`); component `handleGenerateImage` (`MediaPlayer.tsx:432–467`).
- **Probe:** generator draw → all `imageUrl === null`, non-empty `imagePrompt`; runtime click → image renders or error+retry.

### R8 — grade-banded script language · INFERRED (fragile mechanism — verify by probe when challenged)
- **Property:** scripts/questions adapt to the audience band ("kindergarten students (ages 5-6)…" vs older). Mechanism today: `inferGradeLevel(ctx.gradeContext)` string-matches the PROSE band line, then `getGradeLevelContext` writes the audience sentence. This resolves K correctly when the prose names kindergarten, but grades 1–5 all collapse to generic "elementary" (the prose says "elementary students (grades 1-5)"), and **no `gradeLevel` is stamped into the data** — the component cannot band-gate anything. Same dead-lever class `clampGradeToK2`/`normalizeObjectiveGrade` fixed elsewhere ([[grade-fidelity-dead-band]]); BACKLOG #9a already orders the move to `ctx.grade` + a `gradeLevel` stamp.
- **Demanded by:** K + G1 consumers (age-appropriate oral language).
- **Evidence:** `gemini-media-player.ts:6–19, 29–43, 207`; BACKLOG #9a "Preserved from the old plan".
- **Probe:** trace/generator draw at K vs G2 with realistic `gradeContext` → K script is simpler; today expect NO discrimination between 1 and 2 (that's the recorded shortfall, not a pass).

## Standing defects (consumer demands currently violated — carried from EVAL_TRACKER, still live in code)

- **MP-1 (CRITICAL, GENERATOR):** `title: \`Interactive Lesson: ${topic}\`` (`gemini-media-player.ts:223`) echoes the full curator intent — census 07-16 intents are multi-sentence, so the intro renders a paragraph at 3xl. Also observed verbatim in the 07-14 community-helpers trace.
- **MP-2 (HIGH, COMPONENT):** intro overlay (`MediaPlayer.tsx:520–591`) has no scroll — an oversized title pushes "Begin Lesson" below the fold.
- **MP-3 (HIGH, CATALOG):** `supportsEvaluation: true` with **no `evalModes`** — SP-13 class (adaptive-session deadlock risk; invisible to the eval-mode resolver; one undifferentiated `default` β bucket). See G4.

The reimagining must clear all three; until then any interim edit that touches title/intro/catalog should close them, and they are the reason the eval-test consumer row reads 1 tested / 0 passed.

## Conflicts

### C1 — observed K/PRE + G1 EMERGING demand (census, authored homes) vs grades-3+ text-MCQ presentation — OPEN · resolution pre-ruled 2026-07-16: fork via band-by-band reimagining
The manifest routes media-player at K (1/6 fresh, 2/6 on 07-14) and the only authored homes are Grade 1 listening subskills — but the interaction surface is a text-sentence RadioGroup MCQ with text-heavy chrome, and the catalog itself says "grades 3+ due to knowledge check reading requirements." Both sides are right for their consumers: the narrated listen→check loop is exactly what K/G1 oral comprehension needs, and a text MCQ is fine for established readers. **Ruling (user, 2026-07-16, BACKLOG #9a):** do NOT band-gate-in-place or edit the reader shape over this; REIMAGINE band by band — PRE = read-aloud + picture-primary check (reuse `PreReaderSelfCheck`), EMERGING = read-along + light decoding + tap comprehension, ESTABLISHED = richer interactive segments in the deep-dive spirit — each new capability landing as a forked task identity (eval-mode split → band gate → config axis), closed by `/eval-test` + `/reader-fit` per band. Until each band lands, R1–R7 above are what its edits must not ablate.

## Gap requirements (close matches — the improvement queue)

Probe: `curriculum_fit_probe.py --primitive media-player --domain literacy --grades K,1,2`
(2026-07-16, subject LANGUAGE_ARTS, catalog-description query). Verdicts: **K ABSTAIN-scattered**
best 0.731 · **G1 ABSTAIN-diffuse** best 0.767 · **G2 MATCH** best 0.774 (4/5 coherent, LA003
family). social_studies has no probe domain (cross-cutting) — its consumers came via the authored
map instead.

### G1 — PRE (K) narrated-explainer + picture-primary check · OPEN — the #9a PRE band
- **Near-consumer:** the live K census routing (needs-vs-wants 07-16, community-helpers 07-14 — the 07-14 trace verdict: "knowledgeCheck options are text sentences at K → reader-fit"); probe K top hits are listen-then-choose tasks (LA006-03 "Select the main idea from three choices after listening" 0.731; LA007-01 listen-and-retell 0.715).
- **Shortfall:** no PRE presentation exists — options are read-blocked text, chrome is text-heavy, nothing is band-gated (R8: no `gradeLevel` reaches the component).
- **Path:** reimagining PRE band — `PreReaderSelfCheck` for the picture-MCQ (explainer-tail pilot pattern), PRE read-aloud palette from deep-dive/knowledge-check precedent, generator emoji/picture option fields (flat fields — [[flash-lite-drops-nested-array-under-emoji-ask]] if the model tier ever drops) → `/primitive` layers + `/add-eval-modes` + `/reader-fit`, live `--lesson` close.
- **Relation to R-series:** resolves C1's PRE arm; must preserve R2 (narration beats), R4 (no leak — picture options must not make the answer guessable from layout), R5, R6.

### G2 — G1 EMERGING listening-for-details modes · OPEN — **unserved authored demand (phantom primitive)**
- **Near-consumer:** LA007-06-a "Listening for Details" (probe 0.767) and LA007-01-a "Listen and Answer" (0.763) are authored to **`listen-and-respond` — a primitive that does not exist anywhere in the Lumina codebase** ([[phantom-primitives]] class). These Grade-1 listening subskills are unserveable today. Plus the two live authored social_studies homes (SS001-05-c/SS004-05-c) sit in this same band.
- **Shortfall:** media-player is the closest real primitive to this demand but has no task identities (no eval modes) to declare for it, and its G1 presentation is unexamined (text MCQ is borderline at EMERGING).
- **Path:** EMERGING band of the reimagining → `/add-eval-modes` (e.g. `listen_for_details` vs `main_idea` identities), `/curriculum-fit` to confirm the homes; reconciling the phantom `listen-and-respond` mappings to media-player is a CURRICULUM-side act (draft → lineage → publish), never a contract feed-forward.
- **Relation to R-series:** additive on R1–R3; the check questions' "answerable from narration alone" (R3) is the load-bearing property here.

### G3 — G2 ESTABLISHED recount/evidence/predict segments · OPEN
- **Near-consumer:** the LA003 family — "Students listen to short audio passages and recount key details" (0.774, TOP), "Questions About Messages" (0.773), digital retelling (0.773); probe verdict **MATCH** (4/5 coherent).
- **Shortfall:** per-segment MCQ is the only interaction; no annotate/predict/evidence/recount task shapes (the deep-dive / interactive-passage spirit the #9a plan names).
- **Path:** ESTABLISHED band of the reimagining → `/add-eval-modes` for richer segment tasks; borrow interactive-passage's evidence model rather than invent. Spoken retelling variants ride the clip-judge ladder ([[no-live-audio-judging]] — never flash-lite) if pursued.
- **Relation to R-series:** additive; new task shapes fork as identities, R6's single-submission + metrics contract holds.

### G4 — eval-mode existence (MP-3 as a gap, not just a defect) · OPEN
- **Near-consumer:** the adaptive session + IRT ladder themselves: `supportsEvaluation: true` with zero `evalModes` means the resolver can't discriminate tasks, pulse/adaptive selection risks the SP-13 deadlock, and all attempts pool into one `default` β (2.9 from 2 observations).
- **Shortfall:** no declared task identities at all.
- **Path:** every band mode from G1–G3 lands via `/add-eval-modes`; the existing `default` calibration identity (2 obs) is small enough to retire or map onto the first ESTABLISHED mode — decide at build time, record in changelog.
- **Relation to R-series:** implements R6's identity discipline.

### G5 — routing-boundary ruling (what media-player must NOT absorb) · BOUNDARY NOTE
- media-player's identity is **receptive narrated comprehension in a multi-segment multimedia walkthrough**. Adjacent identities stay where they are: **read-aloud-studio** owns oral *production* (student reads/retells aloud — LA003-01-a/-02-a authored there); **decodable-reader** owns *decoding* connected text; **interactive-passage** owns *text-reading* comprehension with evidence highlighting; **ai-tutor-session** subskills are the density frontier, not this primitive's to claim wholesale. Building student-production or text-decoding INTO media-player to "win" probe neighbors would blur β ladders and duplicate those primitives — same ruling as phonics-blender G4. If the manifest mis-routes production/decoding subskills here, that is a catalog-description sharpening, not a build gap.

## Catalog projection

Curator sees `id`/`description`/`constraints` only. **Proposals — NOT applied in this derive-only
run** (#9a says reconcile the catalog IN the reimagining, band by band, so the constraint text
always describes shipped reality).

- **description: DIVERGENT ×2, identity-soft.**
  - "AI-generated **voiceover** narration" + tutoring prose "when the student presses **play**" — there is no voiceover asset and no play/pause control: narration is the **Gemini Live tutor** auto-triggered on segment entry ([[audio-architecture-gemini-live]]); `audioBase64` is a dead legacy field. The `commonStruggles` entry "Student skips ahead without playing audio" is unreachable.
  - Identity should lead with what routing actually uses it for: *narrated listening-comprehension walkthrough* (listen → check per segment), not generic "multimedia learning experiences."
- **constraints: DIVERGENT.** "Best for grades 3+ due to knowledge check reading requirements" contradicts every observed consumer (K census routing, G1 authored homes, zero G3 routing). After the reimagining: a BAND map ("PRE: picture-primary check + full read-aloud; EMERGING: listen-for-details; ESTABLISHED: recount/evidence segments"). Interim, if touched at all: state the truth ("routed K–2 in practice; text MCQ requires reading — pre-reader support pending").
- **evalModes:** none exist (MP-3/G4). The reimagining authors them; each band mode gets a task-identity description the resolver can discriminate.

## Changelog

- 2026-07-16 (B1 browser confirmation) — user verified the K PRE render in the refactored `MediaPlayerTester` (full-width primitive, canonical-grade + eval-mode controls): picture check + band gate look correct in a real browser. B5 live `--lesson` (tutor narration beats) remains the outstanding runtime probe.
- 2026-07-16 (B1, same day as derivation) — **reimagining B1 landed: C1 → RESOLVED via eval-mode split + band gate.** Generator rebuilt (object schema w/ short `lessonTitle` — MP-1 cleared at source; `gradeToBand(ctx.grade)` + `buildGradeLine` + scope section; stamps `gradeLevel` + `evalMode`; flat per-option PRE emoji fields assembled to `optionEmojis` only when complete+distinct). Component: PRE branch — merged `[MEDIA_CHECK_READ_ALOUD]` beat (script+question+options, no double-speak), `PreReaderSelfCheck` per segment (first-try = mastery), simplified PRE intro + `overflow-y-auto`/`line-clamp-2` intro hardening for all grades (MP-2 cleared); reader path unchanged. Catalog: 3 evalModes (MP-3/SP-13 cleared), listening-comprehension description/constraints rewrite (**projection APPLIED**), PRE READ-ALOUD/RETRY directives, stale "presses play" prose fixed (contextKeys unchanged — R2 intact). **Runtime-verified:** eval-test draws 3/3 bands clean (K: 3 segs, emojis complete+distinct, q≤12w; G1: detail questions matching the authored SS homes; G2: why/how w/ reflective distractors); post-rewrite manifest traces pin `listen_and_look` @ K and `listen_for_details` @ G1 (valid ×2); jsdom 4/4 (`MediaPlayer.reader-fit.test.tsx`); full suite 804/804; typecheck:lumina 0. **R6 amendment:** at PRE, `segmentCorrect` = first-try (fact-file semantics — eliminate-until-correct means eventual-correct is not signal); metrics shape unchanged. Queued: `/tutor-test` probe re-run (directive edits), live `--lesson` @ K, `default`-calibration identity decision (B3).
- 2026-07-16 — derived (initial; 3rd contract, first under an OPEN conflict). 8 requirements (7 OBSERVED, R8 INFERRED-fragile), 3 standing defects carried live from EVAL_TRACKER (MP-1..3), 1 OPEN conflict (C1 — resolution pre-ruled: #9a band-by-band reimagining, fork not edit), 5 gaps (G1 PRE band; G2 EMERGING — includes the **phantom `listen-and-respond`** unserved authored demand; G3 ESTABLISHED — probe MATCH 0.774; G4 eval-mode existence; G5 boundary ruling), catalog projection flagged (voiceover/play-pause fiction; grades-3+ constraint contradicted) — NOT applied. Fresh census: `qa/topic-traces/media-player-census-2026-07-16.md`.
