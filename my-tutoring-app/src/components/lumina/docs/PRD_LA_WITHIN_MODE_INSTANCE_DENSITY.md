# PRD: Within-Mode Instance Density — Language Arts Edition

**Status:** Draft (2026-05-26 — primitive-by-primitive audit completed)
**Priority:** High — affects every K-6 literacy primitive's ability to legitimately measure mastery
**Audience:** Product, Engineering
**Scope:** K-6 language arts. 27 generators in [service/literacy/](../service/literacy/), plus [sentence-analyzer](../service/sentence-analyzer/gemini-sentence-analyzer.ts), [word-builder](../service/word-builder/gemini-word-builder.ts), [interactive-passage](../service/interactive-passage/gemini-interactive-passage.ts), and [passage-studio/judge.ts](../service/passage-studio/judge.ts). Mirrors [PRD_WITHIN_MODE_INSTANCE_DENSITY](PRD_WITHIN_MODE_INSTANCE_DENSITY.md) §5a for math.
**Companion:** [PLAN_LA_INSTANCE_COUNT_TIER_SWEEP.md](PLAN_LA_INSTANCE_COUNT_TIER_SWEEP.md) — per-primitive worksheet, refactor recipe, status tracker. Use it at the start of every session; this PRD owns the rationale, the plan owns the execution.

**Headline finding from the 2026-05-26 audit (see [§11](#11-per-primitive-audit-summary-2026-05-26)):** of 30 LA generators, **15 currently emit exactly 1 instance per session** — almost every passage-shaped, production-shaped, and analysis-shaped primitive. The suite-wide instance density is the inverse of the math suite's pre-sweep state. This is the single largest mastery-measurement gap in the literacy catalog.

---

## 1. Problem Statement

The math PRD established that a single-mode session must produce **multiple distinct problem instances** of that eval mode's challenge type, or the session is shaped like a demo, not a mastery practice. The same failure mode exists in language arts — but the calibration is even more uneven because ELA primitives span a wider per-challenge time range than math.

### What's already true in ELA

The current count landscape (2026-05-26 audit of all 30 generators — full table in [§11](#11-per-primitive-audit-summary-2026-05-26)) splits the suite into **three failure modes**:

**Bucket A — "Goldilocks already." Pool-service tap primitives, count pinned via `config?.challengeCount ?? N`.**

| Primitive | Current count | Pattern site |
|---|---|---|
| `rhyme-studio` | **9** | [gemini-rhyme-studio.ts:185](../service/literacy/gemini-rhyme-studio.ts#L185) — `config?.challengeCount ?? 9` |
| `sound-swap` | **9** | [gemini-sound-swap.ts:439](../service/literacy/gemini-sound-swap.ts#L439) — `config?.challengeCount ?? 9` |
| `syllable-clapper` | **8** | [gemini-syllable-clapper.ts:138](../service/literacy/gemini-syllable-clapper.ts#L138) — `config?.challengeCount ?? 8` |
| `phoneme-explorer` | **5** | [gemini-phoneme-explorer.ts](../service/literacy/gemini-phoneme-explorer.ts) — sub-T1, bump needed |
| `word-workout` | **5** | [gemini-word-workout.ts:457](../service/literacy/gemini-word-workout.ts#L457) — `config?.challengeCount \|\| 5` |

**Bucket B — "Range in the prompt, no pinning." Count only constrained by an English phrase Gemini may ignore.**

| Primitive | Prompt range | Pattern site | Audit note |
|---|---|---|---|
| `letter-spotter` | "Generate 6-8 challenges" | [gemini-letter-spotter.ts:221](../service/literacy/gemini-letter-spotter.ts#L221) | But per-mode docs say "2-3 challenges per session" ([L27,33,40](../service/literacy/gemini-letter-spotter.ts#L27)) — **prompt is internally contradictory.** |
| `letter-sound-link` | "Generate 6-8 challenges" | [gemini-letter-sound-link.ts:306](../service/literacy/gemini-letter-sound-link.ts#L306) | Same contradiction with per-mode "2-3 challenges per session" ([L23,30,38](../service/literacy/gemini-letter-sound-link.ts#L23)). |
| `cvc-speller` | "4-6 challenges total" | [gemini-cvc-speller.ts:265](../service/literacy/gemini-cvc-speller.ts#L265) | Schema-level range, no pin. |
| `word-sorter` | "Generate 3-4 challenges" | [gemini-word-sorter.ts:304](../service/literacy/gemini-word-sorter.ts#L304) | Three prompt sites (binary/ternary/match_pairs each repeat). |
| `sentence-builder` | "3-4 challenges per session" | [gemini-sentence-builder.ts:192](../service/literacy/gemini-sentence-builder.ts#L192) | Per-grade ranges 3-4 across modes, varying with grade. |
| `context-clues-detective` | "3-4 challenges" | [gemini-context-clues-detective.ts:243](../service/literacy/gemini-context-clues-detective.ts#L243) | Per-grade override (3 for G2, 3-4 for G3+). |
| `word-builder` | 4-6 `targets` per activity | [gemini-word-builder.ts](../service/word-builder/gemini-word-builder.ts) | Uses `targets[]`, not `challenges[]`. |
| `sentence-analyzer` | unspecified | [gemini-sentence-analyzer.ts](../service/sentence-analyzer/gemini-sentence-analyzer.ts) | No count instruction; Gemini decides. **Worst form of Bucket B.** |

**Bucket C — "Structurally 1 instance per session." The mastery-measurement crisis.** Every passage-shaped, production-shaped, and single-artifact analysis primitive. See [§11](#11-per-primitive-audit-summary-2026-05-26) for the full list — `interactive-passage`, `listen-and-respond`, `read-aloud-studio`, `decodable-reader`, `story-map`, `text-structure-analyzer`, `character-web`, `evidence-finder`, `figurative-language-finder`, `genre-explorer`, `poetry-lab` (both modes), `paragraph-architect`, `story-planner`, `opinion-builder`, `revision-workshop`, `spelling-pattern-explorer`. **Fifteen of thirty.**

The high end of Bucket A (9 challenges of `rhyme-studio`) is fine *for that primitive's per-challenge active time* (~5-8s tap to pick a rhyme), but applied uncritically to `paragraph-architect` would produce a 30-minute writing session. The Bucket C state — 1 instance per session — is the opposite failure: a 30-second-to-3-minute session that the mastery engine treats as a single high-variance IRT signal.

### The problem this PRD solves

There is no tier framework calibrating per-mode count against per-challenge active time, so:

1. **New LA primitives ship with ad-hoc counts.** Each generator's author picks `?? N` based on gut feel. There is no §5a equivalent to copy from.
2. **Already-shipped LA primitives drift in opposite directions.** Bucket C (1 instance per session) and Bucket A (9 instances per session) coexist with no shared rationale. `interactive-passage` is a 1-passage render; `sound-swap` runs 9 phoneme manipulations back-to-back. Both ship today; neither has been timed end-to-end against a target session length.
3. **Production primitives have no count guidance at all.** Should `poetry-lab` ship 1 poem, 2 poems, or 4 poems per session? The math tier table doesn't address this because math has nothing analogous to a 5-10-minute composition task.
4. **Three primitives have prompt-internal contradictions.** `letter-spotter` and `letter-sound-link` ask Gemini for "6-8 challenges total" in the outer prompt but "2-3 challenges per session" inside each per-mode doc string — the model is being given conflicting orders and the realized count is non-deterministic.
5. **IRT update density varies by 30× across the suite** with no pedagogical justification. The mastery engine learns very differently from a `sound-swap` session (9 binary signals) vs a `paragraph-architect` session (1 rubric-scored signal). When a Bucket C primitive routes to the mastery engine, the engine is asked to update beta on a single observation — equivalent to a 1-question quiz.

### Why this is a mastery problem

Identical to the math case (see PRD §1):

- **One instance ≠ mastery.** Reading one passage and answering its questions does not demonstrate the student can comprehend passages at this Lexile band — it demonstrates they can comprehend *that passage*.
- **One instance is a bad IRT update.** Especially for production primitives where the signal is a 0-3 rubric score rather than binary correct/incorrect; a single rubric reading is high-variance and the 4-gate mastery engine should not be making mastery decisions from it.
- **One instance is gameable on surface features.** A figurative-language detection task with one simile is solvable by surface match (`"like a"` → simile). Mastery requires variance.
- **Auto-mode does NOT fix this.** As in math, the engine's auto-mode varies *across* eval modes; it does not multiply *within* a single mode's session. That responsibility belongs to the primitive's generator.

---

## 2. Why ELA Differs From Math — Four Adjustments to the Math Tier Framework

The math §5a tier table assumes (a) every "challenge" is a discrete numeric/visual problem, (b) per-challenge active time correlates linearly with cognitive load, (c) Gemini token cost is the only generation-side gate. None of these hold cleanly in ELA.

### Adjustment 1 — Production primitives need a fifth tier below T4

Math's lowest count is **T4 = 3** (nested multi-phase per challenge, 90-180s active time per challenge, 4-7 min target session). ELA's writing-production primitives blow past T4's ceiling. A single paragraph-architect challenge is 3-8 minutes of student composition; running 3 of them in a row produces a 20-minute session that no K-6 student will finish.

This PRD adds **T5 — Extended production** with a recommended count of **1-2** per session, with explicit acknowledgement that for some production modes, 1 is correct.

### Adjustment 2 — Passage primitives nest M questions inside 1 passage

Math's "challenge" is naturally atomic (one tape diagram, one balance scale, one factor tree). ELA's passage-shaped primitives have a different nesting: **the passage is the challenge, and the M within-passage questions are sub-phases** — analogous to math's within-challenge multi-phase nesting (`place-value-chart` 3 phases per challenge, `tape-diagram` explore→practice→apply).

This means a `listen-and-respond` session with one passage + 4 questions is *not* a 4-instance session. It is a **1-instance session with 4 within-challenge phases**, exactly the T4 shape from math §5a. The §5a "Hold at 3" rule applies: 2-3 passages per session, each with their own question set.

For each passage-shaped primitive, the PRD assignment below specifies the count of **passages**, not the count of questions. Internal question counts stay as the generator currently emits them.

### Adjustment 3 — Audio-generation cost is the new orchestrator-cost gate

The math PRD's T1 bump from 4→7 is "free for pool-service primitives (1 Gemini call regardless of N)." Several LA primitives have an additional axis: **TTS / audio synthesis cost per instance**.

- `listen-and-respond`, `read-aloud-studio`, `decodable-reader` — every challenge needs one or more TTS calls (passage audio, sound-out audio, question audio). 1.5× count = 1.5× audio synthesis spend + 1.5× perceived latency on the student's first interaction with the session.
- `letter-sound-link`, `phonics-blender` — per-letter sound audio. Pool-able (each letter's sound is a fixed asset), but only if the audio is cached.

**Audit hook for the §5 sweep plan:** before bumping a count past 6 on any audio-generating primitive, confirm the audio is cached / pool-able. If each instance triggers a fresh TTS call, treat it as orchestrator-cost (per math §5a) and either keep at 4-5 or wire caching first.

### Adjustment 4 — Speech-capture primitives have a longer "active time" floor

Tap interactions in math T1 are 5-15s per challenge. Speech-capture interactions in ELA (read this word aloud, repeat this phoneme, segment this word) are bounded below by **how long it takes a student to physically produce the utterance + the mic capture window** — usually 8-20s minimum even for the fastest task.

This pushes most speech-capture primitives into T2 (5-6 challenges) rather than T1 (7-10), regardless of how "simple" the cognitive task is. The bound is physical, not cognitive.

---

## 3. The Five ELA Tiers

Same construction as math §5a — per-challenge active time × within-challenge phase count × cognitive load — extended downward by one tier for production work.

| Tier | Per-challenge active time | Within-challenge shape | Recommended count | Hard max | Target session length |
|---|---|---|---|---|---|
| **T1 — Tap / pick / decode** | 3-10s | Single phoneme/letter/word recognition | **7-10** | 12 | 1.5-3 min |
| **T2 — Speak / build / spell** | 10-45s | Speech utterance, type one word, or compose one short construct | **5-6** | 7 | 2-4 min |
| **T3 — Sentence-level analyze or transform** | 45-90s | Read sentence + parse + answer or revise | **4** | 5 | 3-5 min |
| **T4 — Short passage + multi-question (passage-shaped)** | 2-5 min per passage | Read passage + 2-4 within-passage questions | **2-3 passages** | 4 | 5-12 min |
| **T5 — Extended production (write / compose)** | 3-10 min per piece | Compose original paragraph / poem / story plan | **1-2** | 2 | 5-15 min |

**Decision rule:** when scoping an LA primitive (or per-mode count within one), time the active interaction in the tester at student pace including any required listening/reading, then assign the tier. If a primitive straddles tiers across its modes — common for primitives like `word-workout` where `match` is T1 and `compose-sentence` is T3 — pick per mode, not per primitive.

**Comparison to math §5a:**
- T1 here is a count bump (7-10 vs math's 6-8). Justification: ELA tap interactions are faster than math taps (single phoneme vs single multi-attribute compare), and the high end of currently-shipped LA primitives (rhyme-studio at 9, sound-swap at 9) is already there.
- T2-T4 are direct analogs of math T2-T4 with counts adjusted for slightly different reading-load shapes.
- T5 is net-new for ELA.

---

## 4. Per-Primitive / Per-Mode Tier Assignments

The tables below are the **proposed canonical assignment** as of 2026-05-26, with eval-mode keys verified against each generator's `CHALLENGE_TYPE_DOCS` and `service/manifest/catalog/literacy.ts` `evalModes` array. Each row names the actual eval-mode key that ships in the catalog. Per-mode assignment lives in `COUNT_BY_MODE` (see [§5](#5-implementation-pattern-count_by_mode-same-as-math-5a)).

A two-line glossary for column meanings:

- **"Current"** is what the generator/prompt produces *today*. "1 (structural)" means a Bucket-C primitive that emits exactly one artifact per session by schema design — a count bump alone won't fix it; the generator's challenge unit has to change.
- **"Recommended"** is the post-sweep target. Arrows: `↑` = bump, `↓` = drop, `(hold)` = keep, `[refactor]` = Bucket-C structural change required first.

### T1 — Tap / pick / decode (count 7-10)

Phoneme-, letter-, and rhyme-level recognition. Most of these are already in or near the T1 range; the bump formalizes the per-mode table and clamps modes that drifted below 7.

| Primitive | Eval modes (catalog keys) | Current | Recommended | Pattern | Notes |
|---|---|---|---|---|---|
| `rhyme-studio` | `recognition`, `identification`, `production` | 9 (pinned) | **9 / 9 / 6 ↓** | Pool-service | `production` is speech-capture (per Adjustment 4) — drop to 6 (T2 ceiling). `recognition` / `identification` stay at 9. |
| `sound-swap` | `addition`, `deletion`, `substitution` | 9 (pinned) | **9** (hold) | Pool-service | Already correctly sized; verify session timing under 3 min. |
| `syllable-clapper` | `easy`, `medium`, `hard` | 8 (pinned) | **8** (hold) | Pool-service + cached TTS | Each clap is ~3-5s; 8 fits the T1 ceiling. Audio is per-word pool-able. |
| `letter-spotter` | `name_it`, `find_it`, `match_it` | 6-8 (prompt, contradictory) | **8 / 8 / 10 ↑** | Pool-service | Resolve outer-vs-per-mode contradiction. `name_it` reads a sentence aloud (audio-gated, hold at 8). `find_it` is one 4×4 letter grid (8 sessions). `match_it` is pure visual tap (10 — pushes upper T1). |
| `letter-sound-link` | `see_hear`, `hear_see`, `keyword_match` | 6-8 outer / 2-3 per-mode (contradictory) | **8** (formalize) | Pool-service + cached audio | Each challenge is a binary discrimination with 2 TTS speaker buttons (`see_hear`) or auto-played phoneme (`hear_see`). Pool-able only if `/audio/phonemes/{x}.mp3` is cached — see Adjustment 3 audit hook. |
| `phoneme-explorer` | `isolate`, `blend`, `segment`, `manipulate` | 5 (hardcoded) | **7 ↑** | Pool-service + audio | Bump — 5 is sub-T1. `isolate` and `manipulate` auto-play phonemes (audio-gated, formal cache check before deploy). |
| `word-workout` | `real_vs_nonsense`, `picture_match`, `word_chains`, `sentence_reading` | 5 (pinned) | **8 / 7 / 4 / 4 ↓** (split) | Pool-service | **Per-mode split needed.** `real_vs_nonsense` is a 3-5s binary tap (T1, 8). `picture_match` is a 6-10s word-meaning tap (T1, 7). `word_chains` is a 30-60s 4-6-word chain (T3 within-challenge multi-phase, 4). `sentence_reading` is a 20-40s decodable sentence + comprehension question (T3, 4). |

### T2 — Speak / build / spell (count 5-6)

Single-word production, short-construct assembly, speech-capture utterance, or multi-phase per-word phonics. The bound is utterance length + a brief consider/select step, or the within-challenge phase count.

| Primitive | Eval modes (catalog keys) | Current | Recommended | Notes |
|---|---|---|---|---|
| `cvc-speller` | `fill_vowel`, `spell_word`, `word_sort` | 4-6 (prompt range) | **6 / 5 / 5** | Each mode is audio-first; progressive scaffolding plays the word 3 ways per instance. Pool-able TTS per word. |
| `phonics-blender` | `cvc`, `cvce_blend`, `digraph`, `advanced` | unspecified | **6 / 5 / 5 / 5** | Each "word" is itself 3 within-challenge phases (Listen tiles → Build → Blend). Multi-phase shape per Adjustment 2 keeps count at T2 ceiling, not T1. Audio is per-phoneme pool-able. |
| `word-builder` | `simple_affix`, `compound_affix`, `greek_latin`, `multi_morpheme` | 4-6 targets | **6 / 5 / 4 / 4** | Targets, not challenges. `simple_affix` is 2-part word build (~20s, T2). `compound_affix` is 3-part build (~35s). `greek_latin` / `multi_morpheme` are analysis-heavy (T3 — drop to 4). |
| `word-sorter` | `binary_sort`, `ternary_sort`, `match_pairs` | 3-4 (prompt range) | **5 / 4 / 5 ↑** | Each sort wraps 6-10 within-challenge word cards (multi-phase). `ternary_sort` (8-10 cards) is heavier — hold at 4 (T3). |
| `sentence-builder` | `simple`, `compound`, `complex`, `compound_complex` | 3-4 (per-grade prompt) | **5 / 4 / 4 / 4** | Drag-arrange tiles. `simple` (3-5 tiles, ~20s) is T2. Compound+ is T3 once tile count exceeds 6 and grammatical reasoning kicks in. |
| `read-aloud-studio` | _(no eval mode wired)_ | 1 passage (structural) | **2 passages [refactor]** | T4-shape, but per Adjustment 4 each passage requires student-paced read-aloud (1-3 min). Treat as T4 with 2 passages. **Refactor required:** generator emits 1 passage today; needs `passageCount` field. |
| `decodable-reader` | `default` | 1 passage (structural) | **2-3 passages [refactor]** | T4-shape. Per-grade passage size: K-1 (2-3 sentences each — 3 passages OK), G2+ (4-8 sentences — 2 passages). **Refactor required.** Audio-gated. |

### T3 — Sentence-level analyze or transform (count 4)

One sentence read + parse + answer or rewrite. The interaction is comprehension-bound, not motor-bound.

| Primitive | Eval modes (catalog keys) | Current | Recommended | Notes |
|---|---|---|---|---|
| `sentence-analyzer` | `identify_pos`, `identify_role`, `label_all`, `parse_structure` | unspecified | **5 / 5 / 4 / 4** | `identify_pos` / `identify_role` are single-word-pick from 4 options (~15-25s — T2 ceiling, 5). `label_all` labels every word + classifies sentence type (T3, 4). `parse_structure` is two-step subject/predicate + sentence type (T3, 4). |
| `context-clues-detective` | `definition`, `synonym`, `antonym`, `example`, `inference` | 3-4 (per-grade prompt) | **4** (all modes) | Each challenge is a short passage (3-8 sentences) + target word + 4-option meaning pick. Borderline T3/T4 — counts the passage but each is short enough to belong in T3. |
| `revision-workshop` | `add_details`, `word_choice`, `combine_sentences`, `transitions` | 1 draft / 2-5 targets per draft | **4 drafts [refactor]** | Each draft = one sentence-level revision target. **Refactor:** today the generator emits 1 draft with 2-5 targets — push to 4 drafts each with 1-2 targets so the IRT signal is per-draft not per-target. Modes `reorganize`/`concision` move to T5 (full-paragraph revision). |
| `word-workout` `word_chains`, `sentence_reading` | _(see T1 split above)_ | 5 | **4** | Listed here for completeness — these two modes drop from T1's pool of 5 to a T3 count of 4. |

### T4 — Passage + multi-instance per passage (count 2-3 passages per session)

Passage-shaped primitives. **The count is in passages, not questions or within-passage instances.** Internal within-passage instance count stays as the generator currently emits (3-7 typically). Per Adjustment 2.

All Bucket-C primitives in this tier (every row marked `[refactor]`) need a structural change before the count is meaningful — the generator currently treats one passage as one render. The refactor pattern is the same as math's Bucket-A passage refactor (`useChallengeProgress` + per-challenge `passage` field).

| Primitive | Eval modes (catalog keys) | Current | Recommended | Notes |
|---|---|---|---|---|
| `interactive-passage` | _(single `default` flow)_ | 1 multi-section passage (structural) | **2 passages [refactor]** | Highest-impact sweep item. Bucket-C. Current shape is 1 multi-section passage with N inline questions + 1 highlight task — that's a 1-instance session no matter how long. Audio-cost-gated only if section TTS becomes default. |
| `listen-and-respond` | `default` | 1 passage / 3-5 questions (structural) | **2 passages [refactor]** | Audio-cost gated — entire passage is TTS, plus optional question TTS. **Hold at 2 until TTS-cache audit (see Adjustment 3 hook).** 3 is the goal for short K-1 passages once cached. |
| `decodable-reader` | `default` | 1 passage (structural) | **2-3 passages [refactor]** | Listed under T2 above as the speech-capture variant; classification depends on whether comprehension Q or decoding speech is the IRT signal. |
| `story-map` | `bme`, `story_mountain`, `plot_diagram`, `heros_journey` | 1 story (structural) | **2 stories per mode [refactor]** | One story per session is the demo shape — 2 forces structural-vocabulary variance. `heros_journey` may stay at 1 (T5 — story length is K-6 ceiling for the deeper arc). |
| `text-structure-analyzer` | `chronological_description`, `cause_effect`, `compare_contrast`, `problem_solution` | 1 passage (structural) | **2 passages per mode [refactor]** | Bucket-C. Structural type is sticky on surface features — 1 passage lets students solve by signal-word detection rather than structural reasoning. 2 forces transfer. |
| `character-web` | `simple_traits`, `trait_evidence`, `default`, `complex_analysis` | 1 story / 1-3 chars (structural) | **2 stories ↑ / hold `complex_analysis` at 1 (T5)** | Bucket-C. `simple_traits` and `trait_evidence` are 2-3-minute single-graph fills — 2 stories per session is right. `complex_analysis` (foils, motivations, themes) is genuinely T5-paragraph-of-thinking — 1 story is correct. |
| `genre-explorer` | `default` | 1-2 excerpts (structural) | **3 excerpts ↑ [refactor]** | Each excerpt is 4-8 sentences plus a 5-8 feature checklist. 3 short excerpts in one session is realistic at T4 ceiling. Refactor: `excerpts.length` must be parameterized off `instanceCount`, not grade. |
| `figurative-language-finder` | `sound_devices`, `comparison`, `advanced`, `idiom` | 1 passage / 3-7 instances (structural) | **2 passages per mode [refactor]** | **Reclassified from T3 to T4** by the 2026-05-26 audit — each "instance" is within-passage, so today's 1-passage shape is structurally identical to `interactive-passage` Bucket-C. 2 passages forces students to generalize past one author's voice/topic. |
| `evidence-finder` | `default` | 1 passage / 1-2 claims (structural) | **2 passages [refactor]** | Bucket-C. Each passage carries 1-2 claims with N evidence sentences within — 1 passage = 1 session is gameable on surface-claim-keyword match. 2 forces re-application. |
| `poetry-lab` (`analysis`) | `analysis` | 1 poem (structural) | **2 poems [refactor]** | Bucket-C. Short poems (K-3) can do 2 per session inside T4 band. Long/complex poems (G5-6) may belong in T5; per-grade override required. |
| `spelling-pattern-explorer` | `short_vowel`, `long_vowel`, `r_controlled`, `silent_letter` | 1 pattern / 6-10 within (structural) | **2 patterns per mode [refactor]** | The 6-10 words inside ARE the within-challenge density — the pattern *is* the challenge unit, and there is currently only one per session. 2 patterns forces cross-pattern transfer. |

### T5 — Extended production (count 1-2 pieces per session)

Compose original work or carry out an extended deep analysis. Count of **1** is valid and explicitly endorsed for the longest production modes — the variance lever for these primitives is the prompt/topic, not the count.

| Primitive | Eval modes (catalog keys) | Current | Recommended | Notes |
|---|---|---|---|---|
| `paragraph-architect` | `informational`, `narrative`, `opinion` | 1 paragraph | **1** (formalize) | Per-mode hold. Each paragraph is 5-10 min of structured composition + rubric scoring. Pair with §6 step 3 rubric-stability check before shipping. |
| `story-planner` | `default` | 1 plan | **1** (formalize) | One plan per session. The variance lever is the writing-prompt prompt, not the count. |
| `opinion-builder` | `oreo`, `cer` | 1 piece | **1** (formalize) | Both modes are full-paragraph composition with framework scaffold. CER (G5-6) is the heaviest; OREO (G2-4) could in principle bump to 2 but the rubric load is the same as paragraph-architect. |
| `poetry-lab` (`composition`) | `composition` | 1 poem | **1-2** (per-template) | Per Adjustment 1, the count varies by template type. Template-level table: haiku=2, acrostic=2, limerick=1, free_verse=1, sonnet_intro=1. Document in generator near `templateType` enum. |
| `revision-workshop` (`reorganize`, `concision`) | `reorganize`, `concision` | 1 draft | **1** (formalize) | Paragraph-level revision. T5 modes; the other revision modes stay in T3 (4 drafts per session). |
| `character-web` (`complex_analysis`) | `complex_analysis` | 1 story | **1** (formalize) | T5 deep-analysis mode. Foils + multi-layered motivation + thematic relationship analysis is rubric-scored extended thinking; 1 story is correct. |

### Proposed K primitives (deferred until ship)

These primitives are proposed in [PRD_KINDERGARTEN_PHONICS_AND_ALPHABET](PRD_KINDERGARTEN_PHONICS_AND_ALPHABET.md) but do not yet exist in [service/literacy/](../service/literacy/) as of 2026-05-26. Their entries below are forward-looking — apply on ship, do not include in the §8 sweep.

| Primitive | Best-effort modes | Tier | Recommended | Notes |
|---|---|---|---|---|
| `letter-tracing` | `trace_letter` | T1 | **8** | Pool-service. Per-letter tracing is ~5-8s. |
| `alphabet-sequence` | `sequence` | T1 | **7** | One ordering, 7 letters into slots. |
| `rhyming-pairs` | `match_rhyme` | T1 | **8** | Tap-pair match. |
| `sight-word-card` | `recognize` | T1 | **10** | Pure recognition tap; spaced-repetition density argues for upper T1. |
| `sound-sort` | `sort_by_sound` | T1 | **7** | Tap-sort. |

### Out of scope for this PRD

- `passage-studio/judge.ts` is a judge service, not a renderable primitive. No instance count applies.
- `tutoring-scaffold` audio sessions (Gemini Live) are turn-based real-time, not instance-counted. Out of scope.
- `flashcard-deck` has its own spaced-repetition density logic; if a vocabulary primitive (`word-builder`, `word-workout`) integrates with it, that primitive's count owns the session shape, not the deck.

---

## 5. Implementation Pattern: `COUNT_BY_MODE` (same as math §5a)

The implementation pattern is **identical to math** — see [PRD_WITHIN_MODE_INSTANCE_DENSITY §5a "Implementation pattern: `COUNT_BY_MODE` next to `MODE_PROFILES`"](PRD_WITHIN_MODE_INSTANCE_DENSITY.md#implementation-pattern-count_by_mode-next-to-mode_profiles).

Short form, reproduced here so the sweep plan can be self-contained:

```ts
// service/literacy/gemini-<primitive>.ts

const DEFAULT_INSTANCE_COUNT = <tier fallback>;
const MAX_INSTANCE_COUNT = <tier hard max>;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  // copy from §4 per-mode table for this primitive
};

const target = Math.max(
  1,
  Math.min(
    MAX_INSTANCE_COUNT,
    config?.challengeCount ?? COUNT_BY_MODE[challengeType] ?? DEFAULT_INSTANCE_COUNT,
  ),
);
```

For prompt-driven primitives (count baked into the prompt text — e.g., `letter-spotter`'s `"Generate 6-8 challenges"`, `word-sorter`'s `"Generate 3-4 challenges"`), template the per-mode count into the prompt at build time instead of leaving a range string:

```ts
const count = COUNT_BY_MODE[challengeType] ?? DEFAULT_INSTANCE_COUNT;
const prompt = `Generate exactly ${count} challenges...`;
```

The math sweep plan's [B2 audit hooks](PLAN_INSTANCE_COUNT_TIER_SWEEP.md#b2-open-items-surfaced-by-mechanical-sweep-2026-05-24) (orchestrator-vs-pool-service check, pool size ≥ target count) apply unchanged to LA. Two additional hooks specific to ELA:

- **Audio cache check** (Adjustment 3) — before bumping any audio-generating primitive past 5, confirm the TTS output is cached / re-used across runs. If each instance triggers a fresh synthesis, file an audio-caching ticket and hold at the current count.
- **Passage-vs-question count check** (Adjustment 2) — for any passage-shaped primitive, confirm that `COUNT_BY_MODE[mode]` is interpreted by the generator as the count of **passages**, not the count of questions. If the generator currently emits one passage with M questions, the refactor is structural (a Bucket-A-style refactor per math §6) — defer to a separate ticket and do not just bump the question count.

---

## 6. Validation per primitive

Same two-step validation as math §5a:

1. **Time-the-walk:** for each eval mode, manually time one student-paced walk-through in the tester, including any required listening/reading and any speech-capture utterance. Compare against the tier's "per-challenge active time" column. If a mode lands in the wrong tier (e.g., a `word-workout.compose` mode you assigned T2 actually plays at T3 speed once the student composes the example sentence), update the `COUNT_BY_MODE` entry, not the tier table.
2. **Total session length:** end-to-end session time at the chosen count should land in the tier's "target session length" column. If it's significantly over (>1 min past the top of the range), drop the count by 1 and re-check.

Additionally, for T5 production modes:

3. **Rubric-stability spot check.** Because T5 sessions reach the IRT engine with only 1 signal per session, the signal is high-variance unless the rubric is stable. Before shipping a T5 count of 1, confirm the generator's rubric / `judge.ts` produces consistent scores across 3+ re-runs on the same student response (no flip between 2/3 and 3/3 from prompt sensitivity). If unstable, this PRD doesn't fix the count problem — the rubric fix has to land first.

---

## 7. Success Criteria

| Test | Criteria | Verification |
|---|---|---|
| **Per-mode instance count** | Every K-6 LA primitive's count is set per the §4 tier table; per-mode tier matches measured active-interaction time. | `/eval-test` for the count + stopwatch walk-through for the tier classification. |
| **Session length** | Single-mode sessions land inside the tier's target session length band (T1: 1.5-3 min, T2: 2-4 min, T3: 3-5 min, T4: 5-12 min, T5: 5-15 min). | Manual stopwatch timing per primitive per mode. |
| **Passage-shaped primitives** | Every T4 entry emits ≥2 passages per session (not 1 passage with N questions). | `/eval-test` `challengeCount` ≥ 2 for the passage-level entity, not the question-level entity. |
| **Audio cost contained** | Bumping any audio-generating primitive past 5 either reuses cached audio or is accompanied by an explicit audio-spend approval in the PR body. | PR-body checklist item. |
| **T5 rubric stability** | Production primitives with count=1 have a rubric that produces consistent scores across 3 re-runs on the same student response. | Spot-check before shipping each T5 primitive. |

The math PRD's "instance floor ≥3" criterion is **deliberately replaced** for ELA — T5's count of 1 violates the math floor but is the correct shape for extended writing. The floor concept is replaced by the per-tier "target session length" band, which is the actual mastery-shape criterion.

---

## 8. Sequencing

Sequenced by **impact × cost**, where impact = (grade-band routing volume × distance from target count) and cost = (single-line bump vs. Bucket-C structural refactor). The 2026-05-26 audit reshuffled the math PRD's borrowed sequencing — Bucket-C refactors dominate the high-impact slots, and the lowest-cost bumps (single-`?? N` edits) are now back-loaded into a bag-of-tasks sweep.

### Phase 0 — ~~TTS-cache audit~~ (DROPPED 2026-05-26)

**Original assumption:** audio-generating primitives need a TTS-cache audit before count bumps to avoid multiplying audio-synthesis spend.

**Reality (user-confirmed 2026-05-26):** literacy audio in this codebase runs through Gemini Live (real-time turn-based AI tutor over a backend WebSocket), not pre-synthesized TTS. There is no per-instance synthesis cost to gate against. See `memory/feedback_no-tts-cache-gating.md` and `memory/project_audio-architecture-gemini-live.md`. Adjustment 3 (§2) is moot; the "audio cost contained" success criterion in §7 is moot; the per-row "Audio (pool)" annotations in §11 are descriptive of the Gemini Live path, not a caching requirement.

**Implication for sequencing below:** items #2 (`listen-and-respond`), #7 (`decodable-reader`), #8 (`read-aloud-studio`) are NOT blocked. Proceed directly to the structural refactor.

### Phase 1 — Bucket-C refactors, ordered by routing volume

These are the structural changes — each generator currently emits 1 artifact per session and needs `instanceCount` plumbed through schema, prompt, and render. Sized as 1-3 day tickets each, not 1-line edits. Highest grade-band volume first.

1. **`interactive-passage` (G2-6 reading comprehension)** — the loudest Bucket-C failure. One multi-section passage with N inline questions + 1 highlight task is `passage-studio` shape, not `tape-diagram` shape. Refactor to 2 passages per session with `useChallengeProgress`. Single-PR-sized refactor.
2. **`listen-and-respond` (K-6 audio comprehension)** — same refactor pattern as `interactive-passage`. Gated on Phase 0 TTS-cache audit; do not bump until passage TTS is confirmed pool-able.
3. **`figurative-language-finder` (G3-6 reading)** — reclassified to T4 by this audit. Each "instance" is within-passage today; refactor to 2 passages per mode so within-passage instances aren't double-counted against the mastery signal.
4. **`evidence-finder` (G2-6 reading)** — Bucket-C. CER framework is sticky on surface claim-keyword features at 1 passage. 2 passages required for transfer.
5. **`text-structure-analyzer` (G2-6 informational)** — Bucket-C. Signal words make 1-passage detection trivial; 2 passages forces structural reasoning.
6. **`story-map` (K-6 narrative)** — Bucket-C. 2 stories per session for `bme` / `story_mountain` / `plot_diagram`; `heros_journey` stays at 1 (T5).
7. **`decodable-reader` (K-2 reading)** — Bucket-C. Phase 0 audio audit prerequisite.
8. **`read-aloud-studio` (G1-6 fluency)** — Bucket-C. Refactor to 2 passages per session; fluency requires across-text variance, not just within-text rereads.
9. **`character-web` (G2-6 literary analysis)** — Bucket-C for the three lower modes; hold `complex_analysis` at 1.
10. **`spelling-pattern-explorer` (G1-6 spelling)** — Bucket-C. 2 patterns per session.
11. **`genre-explorer` (G1-6)** — Bucket-C. 3 excerpts per session.
12. **`poetry-lab` `analysis` (G3-6)** — Bucket-C. 2 poems per session in analysis mode.
13. **`revision-workshop` (G2-6 writing)** — Bucket-C. Refactor draft-per-session into 4 drafts per session for T3 modes (`add_details`, `word_choice`, `combine_sentences`, `transitions`); hold `reorganize` / `concision` at 1.

### Phase 2 — Bucket-B disambiguation (per-mode `COUNT_BY_MODE` table)

These primitives have prompt-internal contradictions or unpinned ranges. Each is a single-PR generator edit that introduces the `COUNT_BY_MODE` table per [§5](#5-implementation-pattern-count_by_mode-same-as-math-5a).

14. **`letter-spotter` (K-1)** — resolve the "6-8 total" vs "2-3 per mode" prompt contradiction. Per-mode table: `name_it=8`, `find_it=8`, `match_it=10`.
15. **`letter-sound-link` (K-1)** — same contradiction; per-mode table: `see_hear=8`, `hear_see=8`, `keyword_match=8`. Phase 0 audio audit prerequisite.
16. **`word-workout` (K-2)** — split the single `?? 5` into per-mode counts. `real_vs_nonsense=8`, `picture_match=7`, `word_chains=4`, `sentence_reading=4`.
17. **`sentence-analyzer` (G2-8)** — no count instruction at all today (worst Bucket B). Add per-mode table.
18. **`cvc-speller`, `word-sorter`, `word-builder`, `sentence-builder`, `context-clues-detective`** — convert prompt ranges to per-mode exact counts. Five separate single-line PRs in parallel.

### Phase 3 — Bucket-A pinned bumps (single-line edits)

19. **`phoneme-explorer` bump 5 → 7 (T1)** — single-line edit, K-1 routing.
20. **`rhyme-studio` per-mode split** — `recognition`/`identification` hold at 9, `production` drops to 6 (Adjustment 4 speech floor).
21. **`sound-swap`, `syllable-clapper`** — hold (already correctly sized); the PR adds the `COUNT_BY_MODE` table for consistency only.

### Phase 4 — T5 formalization + rubric audit

22. **`paragraph-architect`, `story-planner`, `opinion-builder`, `poetry-lab` `composition`, `revision-workshop` `reorganize` / `concision`, `character-web` `complex_analysis`** — formalize count=1 in code with explanatory comment so future authors don't "fix" it by bumping to 3. Pair with §6 step 3 rubric-stability check; run 3 re-passes on a fixed student response through `passage-studio/judge.ts` for each T5 mode and confirm score stability before declaring the formalization done. If `judge.ts` is unstable on any mode, the rubric fix has to land first.

### Phase 5 — Pulse re-baseline

23. After each phase, run `/pulse-agent` to re-baseline. The Phase 1 batch will produce the biggest IRT update-density shift — student journeys that previously logged 1 update per `interactive-passage` session will now log 2. The mastery-engine 4-gate thresholds may need recalibration; do not declare the sweep complete until pulse confirms gate transitions still trigger sensibly.

---

## 9. Risks / Out of Scope

- **Mode-name guessing.** §4 tables use best-effort mode names inferred from generator filenames. Before each primitive's sweep PR lands, the sweep plan must confirm the exact eval-mode keys against the generator's `MODE_PROFILES` (or equivalent) and update the §4 row if names diverge. This is the same audit hook that surfaced [B2 #1 (ten-frame.count_shown)](PLAN_INSTANCE_COUNT_TIER_SWEEP.md#b2-open-items-surfaced-by-mechanical-sweep-2026-05-24) and [B4 #1 (bar-model.count_object)](PLAN_INSTANCE_COUNT_TIER_SWEEP.md#b4-open-items-surfaced-by-mechanical-sweep-2026-05-25) in the math sweep.
- **Passage primitives may need Bucket-A refactors, not bumps.** Per §5 passage-vs-question check, if any T4 primitive currently emits one passage with N questions, the refactor is structural — file a separate ticket using the math §6 Bucket-A refactor pattern (`useChallengeProgress` / `usePhaseResults` hooks) before applying this PRD's count.
- **Audio-cost surprises.** If TTS caching is not in fact in place for `listen-and-respond` / `read-aloud-studio`, the recommended T4 counts will multiply audio-synthesis spend. Audio-caching may need to be a Phase 0 prerequisite for those entries.
- **Eval-mode wiring not yet shipped for some primitives.** Per [PRD_EVAL_MODES_LITERACY](PRD_EVAL_MODES_LITERACY.md), several LA primitives still need eval modes wired. This PRD's per-mode count table assumes eval modes exist — primitives that don't have them yet are deferred until the eval-mode rollout lands for them.
- **`/pulse-agent` re-baseline.** Session length changes will shift IRT update density meaningfully — especially the T5 count=1 formalization, which says "this is intentionally 1 signal per session, the engine should not treat that as a fault." Re-run pulse after each batch lands, before declaring the sweep complete.
- **Production-modality scope.** This PRD does not change the math production-modality roadmap. Adding more T5 LA primitives is in scope for *that primitive's own* PRD, not this one. This PRD only calibrates the count for production primitives that already exist.

---

## 10. Open Questions

1. **Should `interactive-passage` evolve to T4 (2-3 passages, structural refactor) or stay as T5 (1 passage, treat as production)?** *Resolved 2026-05-26 by audit: T4 with 2 passages.* The current 1-passage shape is comprehension scaffolding, not production — the student isn't generating an artifact, they're answering N comprehension questions across one text. That's the math T4 nesting (challenge=passage, phase=within-passage question). Pooling the IRT signal across within-passage questions doesn't fix the surface-features-gameable problem; the fix is variance across passages.
2. **For audio primitives, is per-instance TTS cost actually a blocker, or is it already cached?** Phase 0 of the §8 sweep. The cache state for each of the 10 audio-gated primitives must be documented as a per-row annotation in §11 before any audio-primitive count bump ships.
3. **Does the `flashcard-deck` spaced-repetition density logic supersede this PRD's tier when a vocabulary primitive uses it?** If yes, `word-builder` / `word-workout` may inherit deck-level counts when integrated. Currently neither integrates with `flashcard-deck`; defer until that integration is proposed.
4. **T5 rubric stability — is the existing `passage-studio/judge.ts` rubric stable enough today, or does it need calibration work before any T5 primitive can ship a count of 1 in good conscience?** Phase 4 prerequisite. Run 3 re-passes on a fixed student response per T5 mode before the formalization PR; if any mode flips between rubric bands across re-passes, calibration work blocks that mode's formalization.
5. **`character-web` `complex_analysis` mode split — should it move to T5 in this PRD, or be replaced by a dedicated `literary-analysis-essay` primitive?** Today the mode lives inside `character-web` but the rubric output looks more like `paragraph-architect` than a character graph. Out-of-scope for this PRD; flagged for the production-modality roadmap.
6. **Pre-passage-refactor mitigations — for the 13 Bucket-C primitives, should they ship a deprecation banner during the refactor window so K-6 routing avoids them, or continue routing as-is with the understanding that the 1-instance shape is a known mastery-signal weakness?** Mastery-engine product call; flag to user before Phase 1 starts.

---

## 11. Per-Primitive Audit Summary (2026-05-26)

Verified by reading each generator's `CHALLENGE_TYPE_DOCS` (or schema enum), `service/manifest/catalog/literacy.ts` `evalModes` array, and the per-grade prompt blocks. Bucket column references the §1 classification.

**Bucket A — Pinned via `?? N` constant. Lowest-cost sweep targets.**

| Primitive | Generator pattern site | Modes | Current | Tier | Recommended | Audio | Speech |
|---|---|---|---|---|---|---|---|
| `rhyme-studio` | [L185](../service/literacy/gemini-rhyme-studio.ts#L185) | `recognition`, `identification`, `production` | 9 | T1 (prod → T2) | 9 / 9 / 6 | Yes (pool) | `production` only |
| `sound-swap` | [L439](../service/literacy/gemini-sound-swap.ts#L439) | `addition`, `deletion`, `substitution` | 9 | T1 | 9 (hold) | Yes (pool) | — |
| `syllable-clapper` | [L138](../service/literacy/gemini-syllable-clapper.ts#L138) | `easy`, `medium`, `hard` | 8 | T1 | 8 (hold) | Yes (pool) | — |
| `phoneme-explorer` | [L302](../service/literacy/gemini-phoneme-explorer.ts) | `isolate`, `blend`, `segment`, `manipulate` | 5 | T1 | 7 ↑ | Yes (pool) | — |
| `word-workout` | [L457](../service/literacy/gemini-word-workout.ts#L457) | `real_vs_nonsense`, `picture_match`, `word_chains`, `sentence_reading` | 5 | T1 / T3 split | 8 / 7 / 4 / 4 | Yes (TTS directives) | — |

**Bucket B — Range in prompt or unspecified. Disambiguation sweep targets.**

| Primitive | Source of "count" | Modes | Current | Tier | Recommended | Audit note |
|---|---|---|---|---|---|---|
| `letter-spotter` | [L221](../service/literacy/gemini-letter-spotter.ts#L221) outer + per-mode docs | `name_it`, `find_it`, `match_it` | 6-8 outer / 2-3 per-mode | T1 | 8 / 8 / 10 | **Prompt contradicts itself**; resolve in PR |
| `letter-sound-link` | [L306](../service/literacy/gemini-letter-sound-link.ts#L306) outer + per-mode docs | `see_hear`, `hear_see`, `keyword_match` | 6-8 outer / 2-3 per-mode | T1 | 8 / 8 / 8 | Same contradiction; Phase 0 audio gated |
| `cvc-speller` | [L265 prompt](../service/literacy/gemini-cvc-speller.ts#L265) | `fill_vowel`, `spell_word`, `word_sort` | 4-6 prompt | T2 | 6 / 5 / 5 | Audio per word (pool-able) |
| `word-sorter` | [L304](../service/literacy/gemini-word-sorter.ts#L304), [L357](../service/literacy/gemini-word-sorter.ts#L357), [L411](../service/literacy/gemini-word-sorter.ts#L411) | `binary_sort`, `ternary_sort`, `match_pairs` | 3-4 prompt | T2 / T3 | 5 / 4 / 5 | Each sort has 6-10 within-challenge cards |
| `word-builder` | `targets[]` length per [generator](../service/word-builder/gemini-word-builder.ts) | `simple_affix`, `compound_affix`, `greek_latin`, `multi_morpheme` | 4-6 targets | T2 / T3 | 6 / 5 / 4 / 4 | Uses `targets`, not `challenges` |
| `sentence-builder` | [L180-237 per-grade](../service/literacy/gemini-sentence-builder.ts#L180) | `simple`, `compound`, `complex`, `compound_complex` | 3-4 prompt | T2 / T3 | 5 / 4 / 4 / 4 | Per-grade ranges currently |
| `context-clues-detective` | [L159-200 per-grade](../service/literacy/gemini-context-clues-detective.ts#L159) | `definition`, `synonym`, `antonym`, `example`, `inference` | 3-4 prompt | T3 | 4 (all modes) | Each "challenge" has its own 3-8s passage |
| `sentence-analyzer` | _none_ | `identify_pos`, `identify_role`, `label_all`, `parse_structure` | unspecified | T2 / T3 | 5 / 5 / 4 / 4 | **No count instruction in code** — worst Bucket B |

**Bucket C — Structurally 1 instance per session. Refactor required.**

| Primitive | Per-session artifact today | Modes | Tier | Recommended | Refactor type |
|---|---|---|---|---|---|
| `interactive-passage` | 1 multi-section passage | `default` | T4 | 2 passages | Add `passageCount`; use `useChallengeProgress` hook |
| `listen-and-respond` | 1 audio passage / 3-5 questions | `default` | T4 | 2 passages | Same + Phase 0 TTS-cache gate |
| `decodable-reader` | 1 passage | `default` | T4 (T2 speech) | 2-3 passages | Same + Phase 0 |
| `read-aloud-studio` | 1 passage | _(none — no eval mode wired)_ | T4 | 2 passages | Same + Phase 0 + eval-mode wiring per [PRD_EVAL_MODES_LITERACY](PRD_EVAL_MODES_LITERACY.md) |
| `story-map` | 1 story | `bme`, `story_mountain`, `plot_diagram`, `heros_journey` | T4 (T5 for `heros_journey`) | 2 stories per mode | Add `storyCount` |
| `text-structure-analyzer` | 1 passage | `chronological_description`, `cause_effect`, `compare_contrast`, `problem_solution` | T4 | 2 passages per mode | Same |
| `character-web` | 1 story / 1-3 chars | `simple_traits`, `trait_evidence`, `default`, `complex_analysis` | T4 / T5 | 2 stories ↑ / hold T5 at 1 | Same except `complex_analysis` |
| `genre-explorer` | 1-2 excerpts | `default` | T4 | 3 excerpts | Parameterize `excerpts.length` off `instanceCount` not grade |
| `figurative-language-finder` | 1 passage / 3-7 within | `sound_devices`, `comparison`, `advanced`, `idiom` | T4 (reclassified) | 2 passages per mode | Same |
| `evidence-finder` | 1 passage / 1-2 claims | `default` | T4 | 2 passages | Same |
| `poetry-lab` `analysis` | 1 poem | `analysis` | T4 | 2 poems | Same; per-grade override may keep 1 for long poems |
| `spelling-pattern-explorer` | 1 pattern / 6-10 words within | `short_vowel`, `long_vowel`, `r_controlled`, `silent_letter` | T4 | 2 patterns per mode | Add `patternCount` |
| `revision-workshop` (T3 modes) | 1 draft / 2-5 targets | `add_details`, `word_choice`, `combine_sentences`, `transitions` | T3 | 4 drafts | Add `draftCount`; each draft = 1-2 targets |

**Bucket D — Intentionally 1 per session (T5 formalization, no count change).**

| Primitive | Modes | Tier | Recommended | Notes |
|---|---|---|---|---|
| `paragraph-architect` | `informational`, `narrative`, `opinion` | T5 | 1 (formalize) | Rubric-stability check required |
| `story-planner` | `default` | T5 | 1 (formalize) | Variance lever is the writing prompt |
| `opinion-builder` | `oreo`, `cer` | T5 | 1 (formalize) | Rubric-stability check required |
| `poetry-lab` `composition` | `composition` | T5 | 1-2 per template | haiku/acrostic=2; sonnet/limerick/free_verse=1 |
| `revision-workshop` (T5 modes) | `reorganize`, `concision` | T5 | 1 (formalize) | Paragraph-level revision |
| `character-web` `complex_analysis` | `complex_analysis` | T5 | 1 (formalize) | Foils + motivations + thematic relationships |

**Suite-wide totals (verified 2026-05-26):**

- **Bucket A (5 primitives, ~17 modes):** ~3 minutes per single-line PR. The cheap wins.
- **Bucket B (8 primitives, ~26 modes):** ~30 minutes per PR (generator edit + per-mode table + prompt rewrite). Two of the eight (`letter-spotter`, `letter-sound-link`) have an *additional* contradiction-fix step.
- **Bucket C (13 primitives, ~29 modes):** 1-3 days per PR. Schema + generator + render layer changes. Dominates the engineering cost of this PRD.
- **Bucket D (6 primitives, ~10 modes):** ~15 minutes per PR (code comment + count-pin formalization). Gated on `passage-studio/judge.ts` rubric stability spot check.

The 15 Bucket-C primitives (some primitives have modes in both C and D, hence the discrepancy with the headline) are the structural mastery-measurement gap. Phase 1 of the §8 sweep is sized at ~15-30 PR-days. Phases 2-4 collectively are sized at ~3-5 PR-days.

---

## Appendix: Mapping ELA Tiers to Math Tiers

| ELA Tier | Math Equivalent | Key difference |
|---|---|---|
| T1 (count 7-10) | math T1 (count 6-8) | ELA tap interactions are faster (single phoneme); upper bound bumped to 10. |
| T2 (count 5-6) | math T2 (count 5) | Speech-capture utterance floor (Adjustment 4) keeps the count grounded; only +1 on math. |
| T3 (count 4) | math T3 (count 4) | Direct analog. |
| T4 (count 2-3 passages) | math T4 (count 3, nested-multi-phase per challenge) | ELA's "challenge" = passage, "phase" = within-passage question. Same nesting concept, different surface. |
| T5 (count 1-2) | _no math equivalent_ | Net-new for ELA. Math doesn't have a 5-10 minute composition production primitive. |
