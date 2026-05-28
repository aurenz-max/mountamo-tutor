# Plan: LA Instance-Count Tier Sweep

**One-liner:** Apply [PRD_LA_WITHIN_MODE_INSTANCE_DENSITY §4](PRD_LA_WITHIN_MODE_INSTANCE_DENSITY.md#4-per-primitive--per-mode-tier-assignments) to every shipped LA primitive. For Bucket-A/B primitives, replace the single `DEFAULT_INSTANCE_COUNT` with a per-mode `COUNT_BY_MODE` table (math-style). For **Bucket-C primitives, perform the structural refactor below** — these generate 1 artifact per session today and need `instanceCount` plumbed through types, generator, and component.

**Owner:** Eng (1 PR per primitive, 1 primitive per session — see [memory/feedback_mastery-over-demo.md](../../../../../../C:/Users/xbox3/.claude/projects/c--Users-xbox3-claude-web-tutor/memory/feedback_mastery-over-demo.md) for cadence intent)
**Status:** 🟡 In progress (created 2026-05-26).
- ✅ Phase 1 item #1 — `interactive-passage` — landed 2026-05-26.
- ✅ Phase 1 item #2 — `listen-and-respond` — landed 2026-05-27.
- ⏭️ Phase 0 (TTS-cache audit) — **DROPPED**. Literacy audio runs through Gemini Live, not pre-rendered TTS. See PRD §8 Phase 0 note and `memory/feedback_no-tts-cache-gating.md`.
- 🟡 Phase 1 items #3-#13 pending — 1 per session.

**Source of truth:** [PRD_LA_WITHIN_MODE_INSTANCE_DENSITY.md](PRD_LA_WITHIN_MODE_INSTANCE_DENSITY.md). Do not re-derive tiers or counts here.

**Worked example:** the `interactive-passage` PR. Read it before opening any other primitive — same pattern repeats. Diff touches:
- [types.ts:966-980](../types.ts#L966-L980) — split `InteractivePassageData` into `PassageEntry` + `{ passages: PassageEntry[] }` wrapper
- [gemini-interactive-passage.ts](../service/interactive-passage/gemini-interactive-passage.ts) — `DEFAULT_PASSAGE_COUNT`/`MAX_PASSAGE_COUNT` constants, wrapped schema, anti-overlap prompt
- [InteractivePassage.tsx](../primitives/InteractivePassage.tsx) — `PassageView` inner component + container using `useChallengeProgress`

---

## Done when

- Every Bucket-C primitive in [PRD §11](PRD_LA_WITHIN_MODE_INSTANCE_DENSITY.md#11-per-primitive-audit-summary-2026-05-26) ships its per-mode passage/story/excerpt/draft/pattern count via `useChallengeProgress` + per-mode `COUNT_BY_MODE`.
- T5 holds (`heros_journey`, `complex_analysis`, `reorganize`, `concision`) ship `count: 1` formalized in code with comment, not refactored away.
- `/eval-test <primitive> --evalMode <mode>` returns ≥2 instances for every non-T5 mode.
- Manual stopwatch walk per touched primitive lands in the tier's target session length band ([PRD §3](PRD_LA_WITHIN_MODE_INSTANCE_DENSITY.md#3-the-five-ela-tiers)).
- [PRD §8 Phase 1 list](PRD_LA_WITHIN_MODE_INSTANCE_DENSITY.md#phase-1--bucket-c-refactors-ordered-by-routing-volume) fully ticked.

---

## The Bucket-C structural refactor recipe

Same five touches every time. **Read the `interactive-passage` PR first** — every step below has a concrete file to copy the pattern from.

### Step 1 — Identify the per-instance type and rename it `<Primitive>Entry`

Open the component file (e.g., `primitives/visual-primitives/literacy/StoryMap.tsx`). The data interface is usually defined inline near the top. It has fields like `title`, `passage`, `sections`, `characters`, `events`, etc. — these describe **one** unit of the session.

```ts
// Before
export interface StoryMapData {
  title: string;
  storyText: string;
  events: StoryEvent[];
  // ... per-story fields
}

// After
export interface StoryEntry {
  id: string;              // ADD: stable id for useChallengeProgress
  title: string;
  storyText: string;
  events: StoryEvent[];
  // ... per-story fields
}

export interface StoryMapData {
  stories: StoryEntry[];   // wrap N entries
  // Per-session fields (mode, structureType, etc.) stay at this level if they apply to ALL entries
}
```

**Decision:** if the primitive has session-level fields that apply uniformly (e.g., `structureType: 'bme' | 'plot_diagram'`), keep them at the wrapper level. If they vary per-entry, move them into `<Primitive>Entry`.

Reference: `PassageEntry` / `InteractivePassageData` in [types.ts:944-981](../types.ts#L944-L981).

### Step 2 — Generator: add count constants, wrap the schema, rewrite the prompt

In `service/literacy/gemini-<primitive>.ts` (or `service/<primitive>/...` for non-catalog ones):

```ts
// PRD_LA §4 tier assignment for this primitive
const DEFAULT_INSTANCE_COUNT = <tier default>;   // e.g., 2 for T4 passage primitives
const MAX_INSTANCE_COUNT = <tier max>;           // e.g., 4

// If per-mode counts vary (some modes are T5 holds), add a per-mode table
const COUNT_BY_MODE: Record<ChallengeType, number> = {
  // PRD §4 per-mode values — e.g., for story-map:
  // bme: 2, story_mountain: 2, plot_diagram: 2, heros_journey: 1  (T5 hold)
};
```

In the generate function:

```ts
const instanceCount = Math.max(
  1,
  Math.min(
    MAX_INSTANCE_COUNT,
    config?.instanceCount
      ?? COUNT_BY_MODE[challengeType]
      ?? DEFAULT_INSTANCE_COUNT,
  ),
);
```

Wrap the existing per-instance schema in an array:

```ts
const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    stories: {  // or "passages" / "excerpts" / "patterns" / "drafts" / "poems"
      type: Type.ARRAY,
      items: existingPerInstanceSchema,
      description: `Exactly ${instanceCount} distinct entries.`,
    },
  },
  required: ['stories'],
};
```

**Prompt:** the single most important step. Change the prompt from a single-artifact request to N artifacts with **explicit anti-overlap language**:

```
Generate EXACTLY ${instanceCount} distinct <stories/passages/excerpts/...>.
Each must be a separate, self-contained challenge — different content, different
vocabulary, no overlap between entries. The student works through all of them so
they must generalize <comprehension/analysis/spelling pattern> across multiple
instances, not just one.

For EACH entry:
- <existing per-instance instructions>
```

After parsing, attach stable IDs:

```ts
const data: StoryMapData = {
  stories: raw.stories.map((s, i) => ({ ...s, id: `story-${i + 1}` })),
};
```

Reference: [gemini-interactive-passage.ts:1-160](../service/interactive-passage/gemini-interactive-passage.ts).

### Step 3 — Component: split into inner view + container with `useChallengeProgress`

Two-tier component structure. The existing single-instance render becomes an inner `<PrimitiveView>` taking one entry. The outer container manages progression.

```tsx
// Inner: same JSX as today, but takes one entry + completion callback
const StoryMapView: React.FC<{
  story: StoryEntry;
  storyIndex: number;
  totalStories: number;
  onComplete: (result: { correct: boolean; attempts: number }) => void;
}> = ({ story, storyIndex, totalStories, onComplete }) => {
  // existing per-instance state, hooks, JSX
  // Reset local state on story.id change via useEffect

  return (
    <>
      <Badge>Story {storyIndex + 1} of {totalStories}</Badge>
      {/* existing render */}
      <Button
        disabled={!sessionComplete}
        onClick={() => onComplete({ correct: firstTry, attempts })}
      >
        {storyIndex < totalStories - 1 ? 'Next Story' : 'Finish Session'}
      </Button>
    </>
  );
};

// Container: wires useChallengeProgress, renders inner + progress bar + summary
const StoryMap: React.FC<{ data: StoryMapData }> = ({ data }) => {
  const stories = data.stories ?? [];

  const { currentIndex, results, isComplete, recordResult, advance } =
    useChallengeProgress<StoryEntry>({
      challenges: stories,
      getChallengeId: (s) => s.id,
    });

  if (stories.length === 0) return <EmptyState />;

  const current = stories[currentIndex];

  const handleComplete = (result) => {
    recordResult({ challengeId: current.id, ...result });
    advance();
  };

  return (
    <>
      <ProgressBar count={stories.length} doneIds={...} currentIndex={currentIndex} />
      {isComplete ? <SessionSummary results={results} /> : (
        <StoryMapView key={current.id} story={current} ... onComplete={handleComplete} />
      )}
    </>
  );
};
```

Reference: [InteractivePassage.tsx](../primitives/InteractivePassage.tsx) — `PassageView` (inner) + `InteractivePassage` (container).

### Step 4 — Wire to `usePrimitiveEvaluation` correctly

**Critical gotcha** for any primitive with `supportsEvaluation: true` in the catalog (i.e., everything except `interactive-passage`): the evaluation engine expects one submission per session today. With N entries per session, decide:

- **Option A (simpler):** call `usePrimitiveEvaluation.submitResult(...)` once when `isComplete === true`, aggregating across all entries. Metrics object reports aggregates (e.g., `firstTryCount`, `totalAttempts`). This is the path for all Phase 1 items unless a per-entry signal is specifically needed by mastery routing.
- **Option B:** call `submitResult` per-entry. Requires evaluation engine support for multi-call sessions — check current behavior before choosing this.

Reference: search for `usePrimitiveEvaluation` in the existing component before refactoring; the call site is usually wrapped by an `onFinalSubmit`/`handleSubmit` callback that triggers from the final phase's "submit" button. Move that trigger to fire on `isComplete`.

### Step 5 — Type-check + manual walk

```
cd my-tutoring-app && npx tsc --noEmit 2>&1 | grep -i "<primitive-name>"
```

Must return zero new errors. Then run dev server, manually walk through both passages/stories/etc. for one eval mode, confirm session length lands in tier band ([PRD §3](PRD_LA_WITHIN_MODE_INSTANCE_DENSITY.md#3-the-five-ela-tiers)).

---

## Gotchas (from `interactive-passage` and read of remaining components)

1. **Reset inner state on entry change.** The inner view component holds per-instance local state (selections, answers, attempts). Use `useEffect(() => { /* reset */ }, [entry.id])` so navigating between entries doesn't carry stale state. The `key={current.id}` on the inner component also forces a full remount — belt and suspenders, both are good.
2. **`useChallengeProgress` doesn't auto-advance.** Your inner view must explicitly call `onComplete` then `advance()` happens in the container. Don't expect `recordResult` alone to move forward.
3. **Per-mode counts and T5 holds live together.** Several primitives have a mix — e.g., `story-map` has 3 T4 modes (2 stories) and 1 T5 mode (`heros_journey` at 1); `character-web` has 3 T4 modes and `complex_analysis` at T5; `revision-workshop` splits T3 vs T5 modes. Put `COUNT_BY_MODE` per mode, don't try to enforce 2-everywhere.
4. **Per-grade overrides scale with the multi-instance count.** Existing generators often have grade-specific size guidance (`K: 30-60 words`, `G6: 150-200 words`). When the session asks for 2 instances of a G6 passage, the *per-instance* size guidance stays — don't try to compress both into one G6 length budget.
5. **Schema "exactly N"-style prompting is fragile.** If Gemini under-shoots (returns 1 instead of 2), `useChallengeProgress` will silently treat it as a 1-instance session. Consider a runtime check: `if (data.entries.length < expected) console.warn(...)`. Or accept the variance for now and let `/eval-test` catch it.
6. **Anti-overlap is the real point.** The prompt must explicitly forbid content/vocabulary overlap between entries. Without that, Gemini will helpfully produce 2 near-identical passages and we still have the surface-features problem the PRD set out to fix.
7. **`PrimitiveEvaluationResult` metrics aggregation.** When moving from per-instance to per-session evaluation submit, the metrics shape probably needs aggregation logic. Check `evaluation/types.ts` for the metrics interface for this primitive before flattening.
8. **Audio-gated primitives (#2, #7, #8) are NOT blocked.** Phase 0 was dropped — see PRD note. They're flagged "larger" because of multi-phase audio playback machinery (1000+ lines), not because of a cache prerequisite.

---

## Per-primitive worksheet

All paths relative to `my-tutoring-app/src/components/lumina/`. Eval modes verified against [catalog/literacy.ts](../service/manifest/catalog/literacy.ts) on 2026-05-26 — re-confirm at start of each session as catalog may have drifted.

### Phase 1 — Bucket-C refactors

| # | Primitive | Generator | Component | LoC | Catalog L# | Eval modes | Holds | Target | Notes |
|---|-----------|-----------|-----------|-----|------------|------------|-------|--------|-------|
| 1 | `interactive-passage` | `service/interactive-passage/gemini-interactive-passage.ts` | `primitives/InteractivePassage.tsx` | 274 (was) | — *(not in catalog)* | `default` only (editorial primitive) | none | 2 passages | ✅ **Landed 2026-05-26.** Worked example — reference all other sessions against this. No `usePrimitiveEvaluation` wiring. |
| 2 | `listen-and-respond` | `service/literacy/gemini-listen-and-respond.ts` | `primitives/visual-primitives/literacy/ListenAndRespond.tsx` | 1044 | 1093 | `default` | none | 2 passages | **Larger.** Three-phase flow (listen/respond/review) + Gemini TTS audio (`audioBase64` per passage) + `usePrimitiveEvaluation`. Refactor adds an outer passage-progression layer wrapping the existing 3-phase per-passage flow. |
| 3 | `figurative-language-finder` | `service/literacy/gemini-figurative-language-finder.ts` | `primitives/visual-primitives/literacy/FigurativeLanguageFinder.tsx` | 437 | 1284 | `sound_devices`, `comparison`, `advanced`, `idiom` | none | 2 passages per mode | Reclassified T3→T4 by PRD. 4-phase per-passage flow (find/classify/interpret/review). Each mode targets different figurative-language types — anti-overlap means the 2 passages should use different examples within the same type. |
| 4 | `evidence-finder` | `service/literacy/gemini-evidence-finder.ts` | `primitives/visual-primitives/literacy/EvidenceFinder.tsx` | 656 | 966 | `default` | none | 2 passages | CER framework. 1-2 claims per passage today, each with N evidence sentences. Refactor moves the passage to the entry level; claims stay nested. |
| 5 | `text-structure-analyzer` | `service/literacy/gemini-text-structure-analyzer.ts` | `primitives/visual-primitives/literacy/TextStructureAnalyzer.tsx` | 503 | 954 | `chronological_description`, `cause_effect`, `compare_contrast`, `problem_solution` | none | 2 passages per mode | Signal-word detection. Anti-overlap is critical here — different signal-word vocabulary between the 2 passages, or students solve on surface match. |
| 6 | `story-map` | `service/literacy/gemini-story-map.ts` | `primitives/visual-primitives/literacy/StoryMap.tsx` | 1624 | 895 | `bme`, `story_mountain`, `plot_diagram`, `heros_journey` | `heros_journey: 1` (T5) | 2 stories for first 3 modes, 1 for `heros_journey` | **Largest in suite.** Drag-arrange events onto narrative-arc template. Per-mode `COUNT_BY_MODE` essential because `heros_journey` is a T5 hold. |
| 7 | `decodable-reader` | `service/literacy/gemini-decodable-reader.ts` | `primitives/visual-primitives/literacy/DecodableReader.tsx` | 770 | 221 | `default` | none | 2-3 passages (per-grade) | **Larger.** Speech-capture for decoding + audio playback. K-1: 3 passages (2-3 sentences each). G2+: 2 passages (4-8 sentences each). Per-grade override pattern. |
| 8 | `read-aloud-studio` | `service/literacy/gemini-read-aloud-studio.ts` | `primitives/visual-primitives/literacy/ReadAloudStudio.tsx` | 524 | 1102 | _none in catalog_ | needs eval-mode wiring first | 2 passages | **Eval-mode wiring is a separate prerequisite** per [PRD_EVAL_MODES_LITERACY](PRD_EVAL_MODES_LITERACY.md). 3-phase per-passage (model/practice/compare) + mic capture. Multi-passage layer wraps. |
| 9 | `character-web` | `service/literacy/gemini-character-web.ts` | `primitives/visual-primitives/literacy/CharacterWeb.tsx` | 531 | 921 | `simple_traits`, `trait_evidence`, `default`, `complex_analysis` | `complex_analysis: 1` (T5) | 2 stories for first 3 modes, 1 for `complex_analysis` | Node-and-edge graph for character analysis. Same per-mode pattern as `story-map`. |
| 10 | `spelling-pattern-explorer` | `service/literacy/gemini-spelling-pattern-explorer.ts` | `primitives/visual-primitives/literacy/SpellingPatternExplorer.tsx` | 349 | 1324 | `short_vowel`, `long_vowel`, `r_controlled`, `silent_letter`, `morphological` | none | 2 patterns per mode | One of the smallest. Each "pattern" has 6-10 within-challenge words — those stay nested; the **pattern** becomes the entry. |
| 11 | `genre-explorer` | `service/literacy/gemini-genre-explorer.ts` | `primitives/visual-primitives/literacy/GenreExplorer.tsx` | 349 | 943 | `default` | none | 3 excerpts | **Count is 3, not 2.** Each excerpt is short (4-8 sentences). Refactor: `excerpts.length` parameterizes off `instanceCount`, not the grade band as today. |
| 12 | `poetry-lab` (`analysis` mode only) | `service/literacy/gemini-poetry-lab.ts` | `primitives/visual-primitives/literacy/PoetryLab.tsx` | 517 | 933 | `analysis` (this PRD), `composition` (Phase 4) | `composition: 1-2` (Phase 4, T5) | 2 poems for `analysis`, defer `composition` to Phase 4 | **Mode-split refactor.** Only the `analysis` branch becomes multi-instance in this phase. Per-grade override: G5-6 long poems may keep 1 (note in `COUNT_BY_MODE` with comment). |
| 13 | `revision-workshop` | `service/literacy/gemini-revision-workshop.ts` | `primitives/visual-primitives/literacy/RevisionWorkshop.tsx` | 427 | 1077 | `add_details`, `word_choice`, `combine_sentences`, `transitions` (T3); `reorganize`, `concision` (T5) | `reorganize: 1`, `concision: 1` (T5) | 4 drafts for T3 modes, 1 for T5 modes | **Refactor inverts the nesting.** Today: 1 draft, 2-5 targets per draft. After: 4 drafts, 1-2 targets per draft for T3 modes. T5 modes (`reorganize`, `concision`) stay at 1 full-paragraph draft. |

### Phase 2-4 — Bucket-A/B/D (math-style sweep)

Out of scope for the structural-refactor recipe above. Follow the **math `COUNT_BY_MODE` pattern** at [PLAN_INSTANCE_COUNT_TIER_SWEEP.md "Mechanical recipe"](PLAN_INSTANCE_COUNT_TIER_SWEEP.md#mechanical-recipe-per-primitive). Items:

- **Phase 2 (Bucket-B disambiguation):** `letter-spotter`, `letter-sound-link`, `word-workout`, `sentence-analyzer`, `cvc-speller`, `word-sorter`, `word-builder`, `sentence-builder`, `context-clues-detective`
- **Phase 3 (Bucket-A pinned bumps):** `phoneme-explorer`, `rhyme-studio` (per-mode split), `sound-swap` / `syllable-clapper` (`COUNT_BY_MODE` table for consistency)
- **Phase 4 (T5 formalization):** `paragraph-architect`, `story-planner`, `opinion-builder`, `poetry-lab` `composition`, `revision-workshop` `reorganize`/`concision`, `character-web` `complex_analysis` — code comment + count-pin + rubric stability spot check (`passage-studio/judge.ts`, 3 re-runs).

---

## Per-PR scope and naming

One PR per primitive. Title: `feat(lumina): multi-instance refactor for <primitive> (PRD_LA §X)`. Body links:

- The relevant [PRD_LA §4](PRD_LA_WITHIN_MODE_INSTANCE_DENSITY.md#4-per-primitive--per-mode-tier-assignments) row
- The `interactive-passage` reference PR (for pattern alignment)
- `/eval-test` output (post-refactor, ≥2 instances per non-T5 mode)
- Stopwatch timing per touched mode (target session-length band hit?)

---

## Status tracker

| # | Primitive | Status | Notes |
|---|-----------|--------|-------|
| 1 | `interactive-passage` | ✅ Landed 2026-05-26 | Reference PR for all subsequent sessions |
| 2 | `listen-and-respond` | ✅ Landed 2026-05-27 | Per-passage listen→respond→review; outer container aggregates via `useChallengeProgress`; eval submit fires once on `isComplete` |
| 3 | `figurative-language-finder` | ⬜ | |
| 4 | `evidence-finder` | ⬜ | |
| 5 | `text-structure-analyzer` | ⬜ | |
| 6 | `story-map` | ⬜ | Largest in suite |
| 7 | `decodable-reader` | ⬜ | |
| 8 | `read-aloud-studio` | ⬜ | Eval-mode wiring is a prereq |
| 9 | `character-web` | ⬜ | |
| 10 | `spelling-pattern-explorer` | ⬜ | |
| 11 | `genre-explorer` | ⬜ | Count is 3, not 2 |
| 12 | `poetry-lab` (`analysis`) | ⬜ | Mode-split refactor |
| 13 | `revision-workshop` | ⬜ | Inverts nesting (drafts ↔ targets) |

---

## Appendix: per-session checklist

Drop-in for the start of each new session.

```
□ Read PRD_LA_WITHIN_MODE_INSTANCE_DENSITY.md §4 row for this primitive
□ Read PLAN_LA_INSTANCE_COUNT_TIER_SWEEP.md "Per-primitive worksheet" row for this primitive
□ Open the reference PR (interactive-passage) — keep alongside
□ Read the existing generator + component to confirm shape
□ Step 1 — Rename per-instance type to <Primitive>Entry, add `id` field, define wrapper
□ Step 2 — Generator: DEFAULT/MAX/COUNT_BY_MODE constants + wrapped schema + anti-overlap prompt
□ Step 3 — Component: split into <Primitive>View (inner) + container (useChallengeProgress)
□ Step 4 — Wire usePrimitiveEvaluation submit to fire on isComplete (Option A aggregation)
□ Step 5 — npx tsc --noEmit | grep -i "<primitive>"  → 0 new errors
□ Dev server walk: 2 entries fully complete, session-summary screen displays
□ Update PLAN_LA Status tracker row to ✅
□ PR body links: PRD row, interactive-passage PR, eval-test output, stopwatch result
```
