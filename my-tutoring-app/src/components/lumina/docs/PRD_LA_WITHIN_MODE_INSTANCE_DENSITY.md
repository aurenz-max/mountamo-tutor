# PRD: Within-Mode Instance Density — Language Arts Edition

**Status:** Draft (2026-05-25)
**Priority:** High — affects every K-6 literacy primitive's ability to legitimately measure mastery
**Audience:** Product, Engineering
**Scope:** K-6 language arts (the ~26 literacy generators in [service/literacy/](../service/literacy/), plus [sentence-analyzer](../service/sentence-analyzer/), [word-builder](../service/word-builder/), [interactive-passage](../service/interactive-passage/), [passage-studio](../service/passage-studio/)). Mirrors [PRD_WITHIN_MODE_INSTANCE_DENSITY](PRD_WITHIN_MODE_INSTANCE_DENSITY.md) §5a for math.
**Companion (forthcoming):** `PLAN_LA_INSTANCE_COUNT_TIER_SWEEP.md` — bag-of-tasks plan to apply this PRD to every shipped LA primitive (analog of [PLAN_INSTANCE_COUNT_TIER_SWEEP](PLAN_INSTANCE_COUNT_TIER_SWEEP.md)).

---

## 1. Problem Statement

The math PRD established that a single-mode session must produce **multiple distinct problem instances** of that eval mode's challenge type, or the session is shaped like a demo, not a mastery practice. The same failure mode exists in language arts — but the calibration is even more uneven because ELA primitives span a wider per-challenge time range than math.

### What's already true in ELA

A static scan of [service/literacy/](../service/literacy/) shows the current count landscape is the opposite of math's pre-sweep state — instead of every generator defaulting to 4, literacy generators sit anywhere from 3 to 9 with no central rule:

| Primitive | Current count | Pattern site |
|---|---|---|
| `rhyme-studio` | **9** | [gemini-rhyme-studio.ts:185](../service/literacy/gemini-rhyme-studio.ts#L185) — `config?.challengeCount ?? 9` |
| `sound-swap` | **9** | [gemini-sound-swap.ts:439](../service/literacy/gemini-sound-swap.ts#L439) — `config?.challengeCount ?? 9` |
| `syllable-clapper` | **8** | [gemini-syllable-clapper.ts:138](../service/literacy/gemini-syllable-clapper.ts#L138) — `config?.challengeCount ?? 8` |
| `letter-spotter` | **6-8** | [gemini-letter-spotter.ts:221](../service/literacy/gemini-letter-spotter.ts#L221) — prompt range |
| `letter-sound-link` | **6-8** | [gemini-letter-sound-link.ts:306](../service/literacy/gemini-letter-sound-link.ts#L306) — prompt range |
| `phoneme-explorer` | **5** | [gemini-phoneme-explorer.ts:302](../service/literacy/gemini-phoneme-explorer.ts#L302) — hardcoded |
| `word-workout` | **5** | [gemini-word-workout.ts:457](../service/literacy/gemini-word-workout.ts#L457) — `config?.challengeCount \|\| 5` |
| `cvc-speller` | **4-6** | [gemini-cvc-speller.ts:159](../service/literacy/gemini-cvc-speller.ts#L159) — schema description |
| `word-sorter` | **3-4** | [gemini-word-sorter.ts:304](../service/literacy/gemini-word-sorter.ts#L304) — prompt range |
| _everything else_ | unknown / ad-hoc | _not surveyed in this PRD_ |

The high end (9 challenges of `rhyme-studio`) is fine *for that primitive's per-challenge active time* (~5-8s tap to pick a rhyme), but applied uncritically to e.g. `paragraph-architect` would produce a 30-minute writing session. The low end (3-4 sorts in `word-sorter`) is fine for that mode (each sort takes 30-60s) but applied to `letter-spotter` would produce a 20-second session.

### The problem this PRD solves

There is no tier framework calibrating per-mode count against per-challenge active time, so:

1. **New LA primitives ship with ad-hoc counts.** Each generator's author picks `?? N` based on gut feel. There is no §5a equivalent to copy from.
2. **Already-shipped LA primitives drift in opposite directions.** Some passage-shaped primitives produce 1-instance sessions (interactive-passage with N within-passage questions is *one* render); some fast-tap primitives produce 9-instance sessions that may be fine but have never been timed end-to-end.
3. **Production primitives have no count guidance at all.** Should `poetry-lab` ship 1 poem, 2 poems, or 4 poems per session? The math tier table doesn't address this because math has nothing analogous to a 5-10-minute composition task.
4. **IRT update density varies by 9× across the suite** with no pedagogical justification. The mastery engine learns very differently from a `sound-swap` session (9 binary signals) vs a `paragraph-architect` session (1 rubric-scored signal).

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

The tables below are the **proposed canonical assignment** as of 2026-05-25. Rows marked _unconfirmed_ require an `/eval-test` run or generator inspection to confirm the mode names and current count before they're swept. Per-mode assignment lives in `COUNT_BY_MODE` (see §5).

Modes are quoted as best-effort inferences from generator names; the sweep plan will confirm exact eval-mode keys from each generator's `MODE_PROFILES` (or equivalent) and update this PRD before the code change lands.

### T1 — Tap / pick / decode (count 7-10)

Phoneme-, letter-, and rhyme-level recognition. Most of these are already in or near the T1 range; the bump formalizes the per-mode table and clamps modes that drifted below 7.

| Primitive | Modes (best-effort) | Current | Recommended | Pattern | Notes |
|---|---|---|---|---|---|
| `rhyme-studio` | all rhyme-pick modes | 9 | **9** _(hold)_ | Pool-service | Already T1-shaped. Confirm `/eval-test` mid-session walk stays inside 1.5-3 min. |
| `sound-swap` | all phoneme-manipulation modes | 9 | **9** _(hold)_ | Pool-service | Same — already correctly sized. |
| `syllable-clapper` | all | 8 | **8** _(hold)_ | Pool-service | Each clap is ~3-5s; 8 fits the T1 ceiling. |
| `letter-spotter` | all | 6-8 (prompt range) | **8** _(formalize)_ | Pool-service | Convert prompt range to per-mode exact count. |
| `letter-sound-link` | all | 6-8 (prompt range) | **8** _(formalize)_ | Pool-service + cached audio | Audio cost gated by phoneme-asset cache (Adjustment 3). |
| `phoneme-explorer` | all | 5 | **7** ↑ | Pool-service | Bump — 5 is sub-T1 for this interaction class. |
| `letter-tracing` _(if eval-mode wired)_ | trace-letter | unconfirmed | **8** | Pool-service | Trace per letter is fast; high count is the variance lever. |
| `alphabet-sequence` _(if eval-mode wired)_ | sequence | unconfirmed | **7** | Pool-service | One ordering, 7 letters into slots. |
| `phonics-blender` | blend-cvc, blend-onset-rime | unconfirmed | **7** | Pool-service + cached audio | Each blend is fast; 5+ phonemes per item is the cognitive load, not count. |
| `rhyming-pairs` (existing K) | match-rhyme | unconfirmed | **8** | Pool-service | Tap-pair match. |
| `sight-word-card` (existing K) | recognize | unconfirmed | **10** | Pool-service | Pure recognition tap; sight-word decks naturally want N≥10 per session for spaced-repetition density. |
| `sound-sort` (existing K) | sort-by-sound | unconfirmed | **7** | Pool-service | Tap-sort. |

### T2 — Speak / build / spell (count 5-6)

Single-word production, short construct assembly, speech-capture utterance. The bound is utterance length + a brief consider/select step.

| Primitive | Modes (best-effort) | Current | Recommended | Notes |
|---|---|---|---|---|
| `cvc-speller` | fill-vowel, spell-word, word-sort | 4-6 (schema range) | **6** | Formalize exact count via per-mode table; bump low end. |
| `word-workout` | match-meaning, fill-blank, identify-affix | 5 | **6** | Per-mode; analysis modes may drop to T3 (see below). |
| `spelling-pattern-explorer` | identify-pattern, apply-pattern | unconfirmed | **5** | Build/spell variant. |
| `word-builder` | combine-morphemes (build-word) | unconfirmed | **5** | Each build is a 20-40s drag-assemble + check. |
| `word-sorter` | sort-by-prefix/suffix/root, match-roots | 3-4 (prompt range) | **5** ↑ | Bump from current 3-4; sort per challenge is ~30s. Confirm no within-challenge accumulation pushes it to T3. |
| `sentence-builder` | build-simple, build-compound | unconfirmed | **5** | Drag-arrange sentence pieces, 20-40s per build. |
| `read-aloud-studio` | repeat-word, repeat-phrase | unconfirmed | **5** | Speech-capture utterance (Adjustment 4 — physical floor pushes this from T1 to T2). Audio-cost gated. |
| `decodable-reader` | decode-word, decode-phrase | unconfirmed | **5** | Speech-capture; same Adjustment 4 logic. |

### T3 — Sentence-level analyze or transform (count 4)

One sentence read + parse + answer or rewrite. The interaction is comprehension-bound, not motor-bound.

| Primitive | Modes (best-effort) | Current | Recommended | Notes |
|---|---|---|---|---|
| `sentence-analyzer` | identify-parts, diagram, label | unconfirmed | **4** | One-sentence analysis. |
| `context-clues-detective` | infer-meaning, identify-clue-type | unconfirmed | **4** | Per-item: read sentence with target word, infer/select. |
| `figurative-language-finder` | identify-simile/metaphor/personification | unconfirmed | **4** | Per-item: read sentence, classify the device. |
| `revision-workshop` | fix-fragment, fix-runon, combine, replace-wordy | unconfirmed | **4** | One-sentence revise. |
| `evidence-finder` | find-supporting-quote | unconfirmed | **4** | Short passage + select-evidence; if passage length >100w, reclassify as T4. |
| `opinion-builder` | scaffolded-claim, scaffolded-reason | unconfirmed | **4** | T3 only when the claim/reason is sentence-length; T5 if asked to write the full paragraph. |
| `word-workout` | analyze-shade-of-meaning, compare-words | _(if mode exists)_ | **4** | The analysis modes; production modes stay at T2. |

### T4 — Passage + multi-question (count 2-3 passages per session)

Passage-shaped primitives. **The count is in passages, not questions.** Internal within-passage question count stays as the generator currently emits (typically 3-5 questions per passage). Per Adjustment 2.

| Primitive | Modes (best-effort) | Current | Recommended | Notes |
|---|---|---|---|---|
| `interactive-passage` | comprehension, evidence, inference | unconfirmed (likely 1) | **2 passages** ↑ | Almost certainly currently emits 1 passage per session — the structural Bucket-A failure described in §1. First-priority sweep item. |
| `listen-and-respond` | audio-comprehension | unconfirmed (likely 1) | **2 passages** ↑ | Audio-cost gated (Adjustment 3) — confirm TTS caching before bumping to 3. |
| `decodable-reader` | read-and-comprehend | unconfirmed | **2-3 passages** | Higher end OK if passages are 1-2 sentences each (K-1); drop to 2 for longer texts. |
| `story-map` | identify-elements (char/setting/problem/solution) | unconfirmed (likely 1) | **2 passages** | One story per session is the demo shape; 2 forces variance. |
| `text-structure-analyzer` | identify-structure (compare/sequence/cause) | unconfirmed (likely 1) | **2 passages** | Same. |
| `character-web` | map-characters, map-relationships | unconfirmed (likely 1) | **2 passages** | Same — one web per passage. |
| `genre-explorer` | classify-genre, identify-features | unconfirmed | **3** | Per-instance is one excerpt + classify — shorter than other T4 entries. |
| `poetry-lab` (analysis modes only) | identify-device, identify-form | unconfirmed | **3** | Production modes belong in T5. |

### T5 — Extended production (count 1-2 pieces per session)

Compose original work. Count of **1** is valid and explicitly endorsed for the longest production modes — the variance lever for these primitives is the prompt/topic, not the count.

| Primitive | Modes (best-effort) | Current | Recommended | Notes |
|---|---|---|---|---|
| `paragraph-architect` | write-paragraph (any framework) | unconfirmed | **1** | One paragraph per session. 5-10 min of composition + rubric scoring. |
| `story-planner` | plan-story (outline → draft) | unconfirmed | **1** | One plan per session. |
| `opinion-builder` | compose-opinion-paragraph | unconfirmed | **1** | Stays at 1 in compose mode; scaffolded sub-modes belong in T3. |
| `poetry-lab` (composition modes) | compose-poem (any form) | unconfirmed | **1-2** | 1 for sonnet/long-form; 2 for haiku / acrostic where 2 fits inside the T5 session band. |
| `revision-workshop` (paragraph-level mode) | revise-paragraph | _(if mode exists)_ | **1** | T5 when the revision target is a full paragraph; T3 for single-sentence modes. |

### Out of scope for this PRD

- `passage-studio/judge.ts` is a judge service, not a renderable primitive. No instance-count applies.
- `tutoring-scaffold` audio sessions (Gemini Live) are turn-based real-time, not instance-counted. Out of scope.
- `flashcard-deck` already has its own spaced-repetition density logic; if it integrates with a vocabulary primitive, that primitive's count owns the session shape.

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

Highest impact first. The sweep is a follow-up across already-shipped LA primitives — not a workstream blocker for any new LA primitive. New LA primitives should land directly on the §4 tier table; existing ones can be swept opportunistically.

1. **`interactive-passage` passage-count refactor (T4)** — the loudest structural failure if the current shape is in fact 1-passage-per-session. Touches reading-comprehension routing volume across grades 2-6. Probably a Bucket-A-style structural refactor, not a count-bump; sized accordingly.
2. **`letter-spotter` + `letter-sound-link` per-mode formalization (T1)** — convert "Generate 6-8" range to per-mode exact count. K-1 routing volume.
3. **`phoneme-explorer` bump 5 → 7 (T1)** — single-line edit, K-1 routing.
4. **`word-sorter` bump 3-4 → 5 (T2)** — single-line edit, validates the T2 tier on a primitive that's currently under-counted.
5. **`paragraph-architect` and other T5 entries** — formalize the count=1 decision in code with explanatory comments so future authors don't "fix" it by bumping to 3. Pair with the rubric-stability spot check (§6 step 3).
6. **Bulk sweep of remaining T1/T2/T3 entries** — 1-line edits per primitive, bag-of-tasks, parallelizable.
7. **T4 passage primitives other than `interactive-passage`** — `listen-and-respond`, `story-map`, `text-structure-analyzer`, `character-web`. Each may be a structural refactor (per Adjustment 2 / §5 passage-vs-question check); confirm shape before deciding bump-vs-refactor.

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

1. **Should `interactive-passage` evolve to T4 (2-3 passages, structural refactor) or stay as T5 (1 passage, treat as production)?** If the passage is truly a single long-form text studied across multiple modes (annotation, evidence, inference), the right shape may be 1-passage-per-session with the IRT signal pooled across the within-passage questions. This is a pedagogical call that affects the sweep ordering — answer before writing the sweep plan.
2. **For audio primitives, is per-instance TTS cost actually a blocker, or is it already cached?** Audit `LiveAssistant.tsx` / `media-player` audio paths before assuming the audit hook needs to fire.
3. **Does the `flashcard-deck` spaced-repetition density logic supersede this PRD's tier when a vocabulary primitive uses it?** If yes, vocabulary primitives drop out of the §4 table and inherit count from the deck.
4. **T5 rubric stability — is the existing `passage-studio/judge.ts` rubric stable enough today, or does it need calibration work before any T5 primitive can ship a count of 1 in good conscience?** Same answer affects all 4-5 T5 entries.

---

## Appendix: Mapping ELA Tiers to Math Tiers

| ELA Tier | Math Equivalent | Key difference |
|---|---|---|
| T1 (count 7-10) | math T1 (count 6-8) | ELA tap interactions are faster (single phoneme); upper bound bumped to 10. |
| T2 (count 5-6) | math T2 (count 5) | Speech-capture utterance floor (Adjustment 4) keeps the count grounded; only +1 on math. |
| T3 (count 4) | math T3 (count 4) | Direct analog. |
| T4 (count 2-3 passages) | math T4 (count 3, nested-multi-phase per challenge) | ELA's "challenge" = passage, "phase" = within-passage question. Same nesting concept, different surface. |
| T5 (count 1-2) | _no math equivalent_ | Net-new for ELA. Math doesn't have a 5-10 minute composition production primitive. |
