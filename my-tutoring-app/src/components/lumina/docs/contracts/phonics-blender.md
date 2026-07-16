# Contract: phonics-blender

- **Derived:** 2026-07-15 · evidence window: curriculum-fit probe 2026-07-15 (live Firestore + Gemini embeddings) + reader-fit PRE 2026-07-15 + grade-fidelity close-out 2026-07-15 + EVAL_TRACKER (RF-1/RF-2, PB2-1..4, SP-7) + K census tally (`qa/reader-fit/BACKLOG.md`) + git to 2026-03.
- **Component:** `primitives/visual-primitives/literacy/PhonicsBlender.tsx` · **Generator:** `service/literacy/gemini-phonics-blender.ts` · **Catalog:** `service/manifest/catalog/literacy.ts:117`
- **Status:** ACTIVE (no open conflicts; 2 resolved on record; 4 gap requirements OPEN; 2 catalog divergences flagged; 1 queued live-probe follow-up — see R2).
- **jsdom band tests:** `.../literacy/__tests__/PhonicsBlender.reader-fit.test.tsx` (7/7 as of 2026-07-15).

Second contract after the sorting-station pilot. phonics-blender is the K-band blending
surface: it absorbed two 2026-07-15 consumer-driven edit waves in one day (RF-1/RF-2 PRE
band-gate in `7cb5e5f`; `clampGradeToK2` grade fix in the same commit), which is exactly the
"edited for one consumer while others depend on it" profile the contract system exists to
protect. The structural parallel to sorting-station is deliberate: the PRE presentation
conflict (C1 here / C2 there) and the tap-simplicity-vs-commit-step near-miss (C2 here /
C3 there) are the same two conflicts, resolved the same two ways (band gate + scoping).

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| K PRE band — CVC blending (`cvc`) | census 2/6 + reader-fit + live | `qa/reader-fit/phonics-blender-PRE-2026-07-15.md`; EVAL_TRACKER RF-1/RF-2 (~474–475); live 3/3 | 2026-07-15 |
| Grade 1 (reader) — `cvce_blend`, `digraph` full-chrome modes | catalog + component reader branch | catalog evalModes (Tier 2/3); component `!isPreReader` path | 2026-07-15 |
| Grade 2 (reader) — `advanced` (r-controlled / diphthong) | catalog + grade ladder | catalog evalModes (Tier 4); `clampGradeToK2` 2→r-controlled | 2026-07-15 |
| Curriculum blend/decode subskills (K blend-CVC, G1 decode-CVC, G2 digraph/blend/vowel-team) | curriculum-fit probe 2026-07-15 | probe best-cosine K 0.813 / G1 0.809 / G2 0.830 (MATCH); several G2 subskills NAME phonics-blender | 2026-07-15 |
| Live tutor (Gemini Live, not TTS) | tutor-report + bespoke journey | `qa/tutor-reports/phonics-blender-live-lesson-2026-07-15.md` (3/3); `build_phonics_blender_journey` | 2026-07-15 |
| Content-contract / phoneme accuracy | EVAL_TRACKER + generator | PB2-1..4 (~626–629); SP-7 (~172–178) | 2026-03-15 |
| Eval-test / IRT calibration (4 modes) | EVAL_TRACKER | 4/4 pass row (~19, 2026-07-15) | 2026-07-15 |
| Grade-fidelity ladder (K/1/2) | git + generator | `qa/topic-fidelity/grade-fidelity-closeout-2026-07-15.md` (Task 4); commit `7cb5e5f` | 2026-07-15 |

> **Note — no support-tier / structural-difficulty consumer.** The generator destructures
> `difficulty` and immediately `void`s it (`gemini-phonics-blender.ts:324,327`); there is no
> `config.difficulty` lever. Difficulty here is carried entirely by the eval-mode ladder
> (cvc → cvce/blend → digraph → advanced), not a support tier. Do not add a "difficulty"
> requirement — none is demanded, and none is wired.

## Requirements

### R1 — PRE-READER HOW-TO-PLAY, durable ORIENT carrier · OBSERVED (live 3/3, committed 7cb5e5f)
- **Property:** at Grade K the tutor voices the play protocol (tap each sound → put the sounds in order → say the whole word) at `[ACTIVITY_START]`, and voices "tap the tiles in the order you hear them" at `[PHASE_TO_BUILD]` — answer-free (never says which tile is correct or spells the word), and **explicitly overriding the lesson one-sentence cap** because the on-screen labels the K band-gate hid (R3) are the child's only other instruction channel. A pre-reader who cannot read "Tap each sound"/"Arrange the sounds"/"Sound Bank"/the Check button gets the whole protocol by voice.
- **Demanded by:** K PRE band.
- **Evidence:** catalog `PRE-READER HOW TO PLAY` aiDirective (`literacy.ts:201–213`); EVAL_TRACKER RF-1; live report activity_start + phase_to_build beats (3/3).
- **Probe:** `/tutor-test phonics-blender --probe` — 0 findings, all contextKeys resolve, PRE directive present in the prompt preview. Runtime: `run_tutor_live.py --lesson --runs 3` with `build_phonics_blender_journey` at Grade K → a tap/listen action + the first word voiced at activity-start, "put the sounds in order" at build, survives the cap.

### R2 — per-tap STIMULUS is spoken · OBSERVED (component emit; live-tap UNVERIFIED — see caveat)
- **Property:** tapping a sound tile speaks that phoneme, and tapping the word speaks the whole word — via a per-tap `[PRONOUNCE_SOUND]` sendText that carries its own self-contained content ("This sound is /k/. /k/."). This is a per-tap message, NOT the greeting/switch path, so it is never subject to the lesson one-sentence cap (the key contrast with `addition-subtraction-scene`, whose whole story had to ride the capped greeting).
- **Demanded by:** K PRE band (a pre-reader receives the sound only by voice) + every reader grade (the sound channel is the point of the primitive).
- **Evidence:** component `[PRONOUNCE_SOUND]` sends (`PhonicsBlender.tsx:282,295`); jsdom test "tapping a sound tile speaks it via [PRONOUNCE_SOUND]"; reader-fit Audit B STIMULUS = PASS.
- **Probe:** jsdom `PhonicsBlender.reader-fit.test.tsx` — tapping `sound /k/` fires exactly one `[PRONOUNCE_SOUND]`. **Live-tap probe (queued):** drive a K session and tap a tile → the tutor actually says the sound.
- **⚠ Caveat (queued verification):** the component emits `[PRONOUNCE_SOUND]` but the catalog `PRONUNCIATION COMMANDS` directive (`literacy.ts:221`) triggers on `[PRONOUNCE]` — a tag-prefix mismatch (`[PRONOUNCE_SOUND]` does not literally start with `[PRONOUNCE]`). In practice the message body is self-executing so Gemini most likely still pronounces it, and the live-lesson runs never tapped a tile, so tap-pronunciation is **verified in jsdom (emit) but unverified at runtime (Gemini response)**. Queued as a phonics-blender reader-fit follow-up (executor `/tutor-test`, add a tap-pronounce beat) — do NOT "fix" the tag by renaming in place without a `--check` run; a rename touches every reader grade's audio path.

### R3 — K band-gate presentation (letter-primary, chrome hidden) · OBSERVED (live 3/3, committed 7cb5e5f)
- **Property:** at `isPreReaderGrade(gradeLevel)` (Grade K) the tiles are **letter-primary** — the letter the child sees in the built word is the tile face, and the `/k/` slash notation (rule-6 unreadable) is gone (the sound is still spoken on tap, R2); the phase stepper (Listen/Build/Blend), the "Word N of M / N completed" counter, the Grade/pattern + phase-description badges are hidden (rule 7); the instruction labels ("Tap each sound to hear it", "Arrange the sounds", "Sound Bank", "Blended together") are hidden (the tutor voices them, R1); the redundant text feedback card is hidden (drop-zone slot flash + SFX + spoken `[BUILD_CORRECT/INCORRECT]` carry it, rule 5); the Clear affordance is dropped (tap a placed tile to remove). **Grade 1+ demands the inverse** — full chrome, `/k/` notation, instruction labels, Clear — the gate is `isPreReaderGrade`, nothing leaks across (see C1).
- **Demanded by:** K PRE band. Grade 1+ demands the inverse.
- **Evidence:** component `isPreReader` gate (`PhonicsBlender.tsx:178`, `:647`); `isPreReaderGrade` import from `utils/kindergartenMode`; EVAL_TRACKER RF-2; reader-fit Audit C rules 1/3/6/7.
- **Probe:** jsdom `PhonicsBlender.reader-fit.test.tsx` at `makeData('K')` vs `makeData('1')` — K hides counter/badges/stepper/labels/`/k/`, tiles letter-primary; Grade 1 keeps counter, "Grade 1" badge, "Tap each sound to hear it:", `/k/` notation, Clear + "Sound Bank:".

### R4 — Check retained at K for multi-item construction · OBSERVED (committed 7cb5e5f)
- **Property:** arranging the sound tiles into the target word is a multi-part construction, so the explicit **Check confirm stays even at Grade K** (rule-2 exception — tap=choose applies to atomic single-tap tasks, not to committing a multi-tile build). PRE declutter pressure (which dropped Clear) is the counter-party — decluttering must not remove the commit-your-work step (see C2, the same near-miss as sorting-station R7/C3).
- **Demanded by:** pedagogy (multi-part evaluation semantics); K PRE declutter is the counter-party.
- **Evidence:** reader-fit Audit C rule 2 ("Check KEPT (arranging sounds is a multi-part construction, rule-2 exception)"); jsdom test "build phase keeps the Check confirm but drops the Clear affordance".
- **Probe:** jsdom — at K, the build phase renders a `Check` button and no `Clear`; at Grade 1, `Clear` returns.

### R5 — grade ladder tracks the canonical grade (K is not the default) · OBSERVED (probe-confirmed, committed 7cb5e5f)
- **Property:** the pattern ladder reads the canonical curriculum grade `ctx.grade` via `clampGradeToK2` — Grade K → `cvc`, Grade 1 → `blend` (default), Grade 2 → `r-controlled`; grade > 2 clamps to `'2'` (a K-2 primitive tops out by design — grade-above is WRONG-PRIMITIVE, not a taller rung). Grades 1–2 must **NOT** be served pinned-K CVC content. This was a real dead lever before `7cb5e5f`: the generator read the PROSE band (`ctx.gradeContext`, "kindergarten students…") and matched it against `['K','1','2']`, which never equaled a grade key, so every objective fell to the `'K'` fallback — and it destructured `objectiveGrade` then immediately `void`ed it.
- **Demanded by:** grade-fidelity sweep (`7cb5e5f`); Grade 1 and Grade 2 reader consumers.
- **Evidence:** generator `clampGradeToK2(ctx.grade, …)` (`gemini-phonics-blender.ts:228–232`); grade-fidelity close-out Task 4 (before: `grade 1 → cvc/K`; after: `grade 1 → blend/1`, `grade 2 → r-controlled/2`).
- **Probe:** grade-discrimination draw via `eval-test?...&grade=K|1|2` with NO pinned mode → K emits `cvc`/K, 1 emits `blend`/1, 2 emits `r-controlled`/2 (the close-out's confirmation line). tsc is never this probe.

### R6 — phoneme letters concatenate exactly to the target word · OBSERVED
- **Property:** every word's `phonemes[]` is in blending order and the concatenation of all `letters` fields (no separator) exactly spells `targetWord`; every sound gets its own phoneme entry (no skipped sounds — "nine" = 4 phonemes, not 2). This is not cosmetic: the build mechanic IS "arrange the tiles to spell the word," so a broken concatenation makes the challenge unsolvable or mis-keyed.
- **Demanded by:** every eval mode (the interaction depends on it); content-contract consumer (PB2-2, SP-7).
- **Evidence:** generator CRITICAL PHONEME RULES (`gemini-phonics-blender.ts:276–292`); EVAL_TRACKER PB2-2, SP-7; jsdom fixture (letters `c`+`a`+`t` = `cat`).
- **Probe:** oracle-style — for every generated word, `word.phonemes.map(p => p.letters).join('') === word.targetWord`. eval-test `cvc` @ K passes today (5 CVC words, letters concatenate).
- **⚠ Note:** SP-7's status line claims phonics-blender cvce has *post-generation validation*, but the current generator enforces the concatenation rule via **prompt only** (no code-level validator in `gemini-phonics-blender.ts`). Treat R6/R7 as prompt-enforced; the probe is the oracle check above, not a code path. A code-level validator is a candidate hardening (not a demand — no consumer has reported a failure since the 2026-03 prompt fix).

### R7 — silent-e is its own phoneme; irregular words excluded (cvce) · OBSERVED
- **Property:** in `cvce` words the silent-e is its **own** phoneme (sound `"//"`, letters `"e"`) and the vowel before it uses its long sound; **never** underscore notation (`a_e`, `i_e`) in the `letters` field; irregular words that don't follow the pattern are excluded (one, done, gone, come, some, love, have, give, live).
- **Demanded by:** `cvce_blend` mode consumer (Grade 1); content-contract (PB2-1, PB2-3).
- **Evidence:** generator guidelines + rules (`gemini-phonics-blender.ts:198–201,285–290`), CHALLENGE_TYPE_DOCS.cvce (`:27–36`), schema `letters` description (`:113–116`); EVAL_TRACKER PB2-1, PB2-3.
- **Probe:** pin `cvce_blend` → each cvce word carries a silent-e phoneme with `letters:'e'` and `sound:'//'`; no `letters` field contains `_`; no word is in the irregular-exclusion list.

### R8 — one emoji per word (the visual anchor) · OBSERVED
- **Property:** every word carries exactly one emoji as the picture anchor for young/pre-readers; it is schema-`required`. At K this is load-bearing (the word emoji is the picture surface the reader-fit audit relies on when text is hidden).
- **Demanded by:** K PRE band (picture stimulus); schema contract.
- **Evidence:** schema `emoji` required (`gemini-phonics-blender.ts:122–125,131`); prompt emoji rules (`:269–273`); reader-fit Audit A (word emoji COVERED — "emoji is schema-REQUIRED"); jsdom "the word emoji still shows".
- **Probe:** every generated word has a non-empty single-emoji `emoji`; jsdom renders `🐱` at K.

### R9 — mode purity under a pinned targetEvalMode · OBSERVED
- **Property:** a pinned `config.targetEvalMode` constrains the `patternType` enum to that mode's challenge types (`constrainChallengeTypeEnum`) so the draw is homogeneous — per-mode β anchors stay clean (a `cvc` pin never yields a `digraph` word). If Gemini drops `patternType`, post-process injects it from the eval constraint → config → grade default.
- **Demanded by:** eval-test / IRT calibration (4/4 modes; β is per-mode).
- **Evidence:** generator `resolveEvalModeConstraint` + `constrainChallengeTypeEnum` (`:164–176`) + post-process patternType injection (`:335–339`, PB2-4); EVAL_TRACKER 4/4 pass.
- **Probe:** pin each of the 4 eval modes ×2 → `patternType` and every word's phoneme structure match that mode's challenge types.

### R10 — intent leans word choice but never overrides phonics accuracy · OBSERVED
- **Property:** `ctx.intent` (specific focus under a broad topic) biases the WORD/theme selection but the prompt explicitly subordinates it to the phonics/decoding accuracy rules — the sort of "always prioritize the phonics rules over this focus" guard that keeps a themed request from producing linguistically wrong phoneme breakdowns.
- **Demanded by:** topic/intent consumers (topic-fidelity discipline).
- **Evidence:** generator SPECIFIC FOCUS clause "ALWAYS prioritize the phonics/decoding accuracy rules below over this focus" (`gemini-phonics-blender.ts:246`).
- **Probe:** fixed grade + pattern, vary intent ×2 → the word theme shifts toward intent, but R6/R7 phoneme accuracy holds on every word.

## Conflicts

### C1 — PRE letter-primary/declutter (R3) vs Grade-1+ full chrome — RESOLVED 2026-07-15 via fork rung 2 (band gate)
Both demands are right for their consumers: a pre-reader cannot read `/k/` notation or the instruction labels, while a Grade 1+ reader is served by them (and by the phoneme notation itself, which is part of what they're learning). Resolved with the `isPreReaderGrade` presentation gate — one component, two presentations, zero leakage (committed `7cb5e5f`, jsdom 7/7, live 3/3). Structurally identical to sorting-station C2. A future edit in this zone (e.g. a shared PRE-pattern extraction with rhyme-studio) must preserve the gate, not collapse the two presentations.

### C2 — PRE tap-simplicity vs multi-item construction commit-step — RESOLVED 2026-07-15 via scoping (near-miss)
The PRE declutter pass dropped the Clear affordance (tap a placed tile to remove instead). A tempting over-general edit — "at K, tap=choose everywhere, drop Check too" — would have ablated the sort/build family's commit-your-work step. Resolved by scoping the declutter: Clear goes, **Check stays** because arranging sounds is a multi-part construction (R4). Recorded because the over-general "auto-submit at K" edit is exactly what a future declutter or K-stage pass would reach for. Same near-miss class as sorting-station C3 (R7 there).

## Gap requirements (close matches — the improvement queue)

Source: `curriculum_fit_probe.py --primitive phonics-blender --domain literacy --grades K,1,2`
run 2026-07-15 (subject `LANGUAGE_ARTS`). Verdicts: **K ABSTAIN (diffuse)** best-cosine
0.8133 — the top single match "Blend three phonemes into a CVC word (/d/ /o/ /g/ → dog)" is a
near-perfect fit and is fully served today; the "diffuse" flag comes from coherent-skill
count (2 < 3), i.e. *adjacent* tasks (segmentation, onset-rime) crowd the neighborhood.
**G1 ABSTAIN (diffuse)** best-cosine 0.8091 — the neighborhood is split between decoding
(served: "Decode short vowel CVC words", 0.7945) and **encoding/spelling** subskills
(0.8091/0.7910 — NOT ours, see G4). **G2 MATCH** best-cosine 0.8301, 5 coherent — and
several G2 subskills **name phonics-blender explicitly in their authored constraints**. The
core blend identity is served; the gaps are the adjacent tasks the neighborhood demands.

### G1 — CVC segmentation (word → sounds, the inverse of blending) · OPEN
- **Near-consumer:** K `Segment a CVC word into three phonemes (dog → /d/ /o/ /g/)` (probe 0.8034) + `Blend and segment individual sounds in CVC words using manipulatives` (LA001-03-D, 0.8054). The published K curriculum pairs blend AND segment on the same skill node ("Phoneme Blending & Segmentation").
- **Shortfall:** the primitive only **blends** (arrange sound tiles → build the word). There is no **segment** task (hear/see the word → break it into its sounds). At K this must be tap/spoken, not typed.
- **Path:** eval-mode split (`segment`) → `/add-eval-modes` (reuse the phoneme model; the interaction inverts: start from the whole word, produce the ordered tiles). If the segment answer is spoken, `/add-spoken-judge` ([[production-modality-roadmap]]).
- **Relation to R-series:** additive — shares R6's phoneme model but reverses the interaction. No conflict.

### G2 — onset-rime blending (2-part grain) · OPEN
- **Near-consumer:** K `Blend onset and rime (/c/ + /at/ → cat)` (probe 0.7919).
- **Shortfall:** the primitive tiles at the **phoneme** grain (3 tiles for cat: /k/ /a/ /t/). Onset-rime is a coarser 2-part grain — one onset tile + one rime chunk (/c/ + /at/) — a legitimate earlier decoding step the K curriculum teaches before full phoneme segmentation.
- **Path:** eval-mode split or config axis (`onset_rime`) where the tile set is `[onset, rime]` rather than per-phoneme → `/add-eval-modes`. Touches the "one phoneme per tile" assumption baked into the schema/prompt — the fork declares the coarser grain as its task identity.
- **Relation to R-series:** touches R6 (concatenation still holds: onset-letters + rime-letters = word) but relaxes "every sound its own tile" for this mode only. Additive; the fork carries the exemption in its declared identity, not by weakening R6.

### G3 — vowel teams at Grade 2 (ai, ay, ee, ea, oa, ow) · OPEN — STRONGEST (curriculum names the primitive)
- **Near-consumer:** G2 `Vowel Teams — blend and read words with long vowel team patterns … manipulate letter tiles to build words in the phonics-blender` (LA001-01-a, probe **0.8301 — the TOP Grade-2 match**). The curriculum author wrote "in the phonics-blender" directly into the subskill constraint — this subskill was authored to route here.
- **Shortfall:** phonics-blender has **no vowel-team eval mode**. Its Grade-2 modes are `r-controlled` and `diphthong` (`advanced`, Tier 4) only. Vowel teams (ai/ay/ee/ea/oa/ow) are a distinct "multiple letters, one vowel sound" pattern — the same *shape* the schema already handles for digraphs/r-controlled/diphthongs (a multi-letter `letters` field = one phoneme), just not enumerated.
- **Path:** eval-mode split (`vowel_team`) → `/add-eval-modes` — add a CHALLENGE_TYPE_DOCS entry, extend the `patternType` enum + the Grade-2 guidelines, mirror the digraph one-phoneme-two-letters treatment. Low-friction because the phoneme model already supports the shape.
- **Relation to R-series:** additive; extends R9's mode family and R6/R7's multi-letter-phoneme handling. No conflict. Sequence this FIRST among the gaps — highest cosine, explicitly authored to the primitive, cheapest lift.

### G4 — decode↔encode routing boundary (NOT a build gap) · BOUNDARY NOTE
- **Near-consumer / non-consumer:** at Grade 1 the diffuse verdict is driven by **encoding/spelling** subskills sitting next to phonics-blender's decode identity: `Spell common CVC and CVCe words by dragging letters` (LA006-07-a, 0.8091), `Encode all three sounds in a CVC word` (LA002-02-b, 0.7910).
- **Ruling:** these are **cvc-speller's** job (encode/spell: word → produce spelling), not phonics-blender's (decode/blend: sounds → build/read the word). This is the same routing boundary as sorting-station↔comparison-builder. Do NOT build spelling/encoding into phonics-blender to "win" these matches — that would blur two β ladders and duplicate cvc-speller. Recorded so a future densifier reads the boundary instead of re-discovering it. If the manifest is mis-routing encode subskills HERE, that's a catalog-description sharpening job (see projection), not a primitive gap.
- **Relation to R-series:** none — this protects the primitive's identity, not a requirement.

## Catalog projection

Curator prompt sees `id`/`description`/`constraints` only (`gemini-manifest.ts` catalogContext).
**These are proposals — NOT applied in this derive-only run** (phonics-blender catalog is out of
scope per the handoff; only the sorting-station rider was authorized). Queue the apply behind a
`--check` run.

- **description:** **DIVERGENT ×2.**
  - "Audio playback via **TTS**" is wrong — phonics audio is **Gemini Live**, not TTS
    ([[audio-architecture-gemini-live]]); every pronunciation rides `sendText`/`[PRONOUNCE_SOUND]`
    through the live tutor. Proposed: "Sounds and words are voiced by the live tutor on tap."
  - "AI-generated word **images** on success" overstates — the visual is a single schema-required
    **emoji** per word (R8), not a generated image. Proposed: "an emoji word-picture per word."
  - The blend-vs-encode identity could be sharpened (lead "decode/blend sounds into words" so the
    curator stops drawing G4's encoding subskills here).
- **constraints:** currently "Grades K-2 only. Requires phonics/decoding content." — thin vs the
  enforced band reality. Proposed BAND FLOOR (mirroring decodable-reader / sorting-station):
  "BAND FLOOR: at Kindergarten route only `cvc` (pre-reader letter-primary tiles, sounds voiced on
  tap); `cvce`/`blend`/`digraph` are Grade 1; `r-controlled`/`diphthong` are Grade 2. Decode/blend
  only — spelling/encoding is cvc-speller's job."
- **evalModes:** the four per-mode descriptions are terse but accurate and load-bearing for the
  resolver. No change proposed (adding grade-band notes would help the resolver but eval-mode
  descriptions are deliberately excluded from catalogContext for load — a resolver-only edit).

## Changelog

- 2026-07-15 — derived (initial, second contract after the sorting-station pilot). 10 requirements (all OBSERVED; R2 carries a queued live-tap caveat, R6 a prompt-vs-code note), 2 conflicts (both RESOLVED via the same band-gate + scoping forks as sorting-station C2/C3), 4 gap requirements from `curriculum_fit_probe` (K/G1 ABSTAIN-diffuse, G2 MATCH): G1 segmentation, G2 onset-rime, G3 vowel-teams (strongest — curriculum names the primitive), G4 decode↔encode boundary ruling. 2 catalog divergences flagged (TTS→Gemini-Live, images→emoji) — projection NOT applied (derive-only). Evidence: curriculum-fit probe 2026-07-15, reader-fit PRE + live 3/3, grade-fidelity close-out, EVAL_TRACKER RF-1/RF-2 + PB2 + SP-7, git to 2026-03.
