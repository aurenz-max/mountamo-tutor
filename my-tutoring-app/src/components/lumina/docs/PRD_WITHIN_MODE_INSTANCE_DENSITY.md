# PRD: Within-Mode Instance Density — From Demo Sessions to Mastery Sessions

**Status:** Workstream 2 (factor-tree pilot) shipped. Workstream 1 + 3 pending.
**Date:** 2026-05-12 (initial) · 2026-05-12 (pilot post-mortem)
**Priority:** High — affects every K-3 math primitive's ability to legitimately measure mastery
**Audience:** Product, Engineering
**Scope:** K-3 math (workstream-level); pattern generalizes to all math + science primitives

---

## 1. Problem Statement

When a student is pinned to a single eval mode (e.g. `factor-tree.guided_small`, β 1.5), the primitive often produces **one problem instance** per session. After one factorization the student is done. The session is shaped like a demo, not a mastery practice.

This is distinct from — and downstream of — the difficulty ladder problem that [PRD_K3_CONTENT_DENSITY](PRD_K3_CONTENT_DENSITY.md) addresses. That PRD smooths the *vertical* β gaps between eval modes. This PRD addresses the *horizontal* thinness inside each mode: when the engine routes a student to mode X at β Y, what does the student actually do for 5 minutes?

### The evidence (screenshots from production)

1. **Factor Tree → Guided Small (β 1.5)** → one composite (12), factored, done.
2. **Factor Tree → Guided Medium (β 2.5)** → one composite (60), factored, done.

Both sessions terminate after a single binary correct/incorrect signal. The student barely practices; IRT learns almost nothing about θ; the mode's pedagogical range (10 valid candidate composites in `guided_small`) goes 90% unused.

### Why this is a mastery problem, not a UX problem

- **One instance ≠ mastery.** A student who factors 12 correctly has not demonstrated they can factor `guided_small` composites. They have demonstrated they can factor 12.
- **One instance is a bad IRT update.** A single binary correct/incorrect signal is noisier than 4-6 binary signals against the same θ. The 4-gate mastery engine learns less per session than it should.
- **One instance is gameable on surface features.** The factor tree for 12 has a memorable shape. Mastery requires variance.
- **Auto-mode does NOT fix this.** The engine's auto-mode varies *across* eval modes within a session. It does not — and should not — multiply *within* a single mode's session. That responsibility belongs to the primitive's generator.

### What "mastery-shaped" means for this PRD

A single-mode session should produce **3–6 distinct problem instances** of that eval mode's challenge type, surfaced sequentially. The student progresses through `[instance 1 → result] → [instance 2 → result] → …` within the same primitive render. Final session result is an aggregate across all instances.

---

## 2. Why This Is Different From PRD_K3_CONTENT_DENSITY

| Axis | K3_CONTENT_DENSITY | This PRD |
|------|--------------------|----------|
| Direction | Vertical (β gaps between modes) | Horizontal (instance count inside a mode) |
| Symptom | Adjacent modes jump 1.5 β apart, student hits cliff | Mode is one problem long, student hits "done" wall |
| Fix shape | Insert new atomic eval modes between existing ones | Multiply instances within existing eval modes |
| Risk if ignored | Difficulty progression has cliffs | Sessions can't establish mastery |

These PRDs are complementary. K3 density alone produces a smoother ladder of demos. This PRD alone produces fewer but deeper sessions. Both are needed for a mastery product.

**Re-prioritization implication:** Several proposed inserts in K3_CONTENT_DENSITY (`missing_factor_small`, `fluency_small`, `equivalent_visual`, `expanded_form_3digit`) may be better served by adding *instances* to the existing mode than by splitting the mode further. After Workstream 1 of this PRD ships, the K3 density plan should be re-audited — some of its inserts may become unnecessary.

---

## 3. Evidence: The Three Buckets

Surveyed every math generator in `my-tutoring-app/src/components/lumina/service/math/`. Three classes of behavior:

### Bucket A — Structurally Singular (1 problem per session, schema cannot express more)

The generator's data type has no `challenges: ChallengeDef[]` field. The shape can hold one problem. Fixing requires schema + component refactor.

| Primitive | Generator | Singular field | Grade band |
|-----------|-----------|----------------|------------|
| `factor-tree` | [gemini-factor-tree.ts:100](../service/math/gemini-factor-tree.ts#L100) | `rootValue: number` | 3-7 |
| `percent-bar` | [gemini-percent-bar.ts](../service/math/gemini-percent-bar.ts) | single `scenario` + `challengeType` | 5-8 |
| `double-number-line` | [gemini-double-number-line.ts](../service/math/gemini-double-number-line.ts) | single `contextQuestion`, given/target points | 5-7 |
| `tape-diagram` | [gemini-tape-diagram.ts](../service/math/gemini-tape-diagram.ts) | single `wordProblem` + part1/2/3 fields | 2-5 |
| `bar-model` | [gemini-bar-model.ts:67](../service/math/gemini-bar-model.ts#L67) | `challenge?: BarModelChallenge` (singular) | 2-5 |
| `place-value-chart` | [gemini-place-value.ts](../service/math/gemini-place-value.ts) | `targetNumber` (singular, multi-phase on one number) | K-5 |
| `area-model` | [gemini-area-model.ts](../service/math/gemini-area-model.ts) | needs verification — claims "6-10 number pairs for variety" in prompt but data shape unclear | 3-5 |
| `function-machine` | [gemini-function-machine.ts](../service/math/gemini-function-machine.ts) | single rule with multiple inputs — borderline; processes N inputs per render but the "rule" is one problem | 3-7 |

**K-3 scope from Bucket A:** `factor-tree` (loud, no), `tape-diagram` (loud), `bar-model` (loud), `place-value-chart` (loud), `area-model` (verify).

### Bucket B — Multi-Problem But Thin (schema supports an array; prompt says 2-3)

Schema is `challenges: ChallengeDef[]`. Component already loops correctly. Generator prompt is stingy. One-line fixes per file.

| Primitive | Current floor | File:Line |
|-----------|---------------|-----------|
| `pattern-builder` | **2-3** | [gemini-pattern-builder.ts:316](../service/math/gemini-pattern-builder.ts#L316) |
| `base-ten-blocks` | **2-3** (low range branch) | [gemini-base-ten-blocks.ts:230](../service/math/gemini-base-ten-blocks.ts#L230) |
| `hundreds-chart` | **3-4** | [gemini-hundreds-chart.ts:253](../service/math/gemini-hundreds-chart.ts#L253) |
| `number-line` | **3-4** | [gemini-number-line.ts:380](../service/math/gemini-number-line.ts#L380) |
| `counting-board` | 3-5 (lean) | [gemini-counting-board.ts:283](../service/math/gemini-counting-board.ts#L283) |
| `skip-counting-runner` | 3-5 (lean) | [gemini-skip-counting-runner.ts:298](../service/math/gemini-skip-counting-runner.ts#L298) |
| `length-lab` | 3-5 (lean) | [gemini-length-lab.ts:266](../service/math/gemini-length-lab.ts#L266) |
| `shape-builder` | 3-5 (lean) | [gemini-shape-builder.ts:406](../service/math/gemini-shape-builder.ts#L406) |
| `3d-shape-explorer` | 3-5 (lean) | [gemini-3d-shape-explorer.ts:279](../service/math/gemini-3d-shape-explorer.ts#L279) |
| `ratio-table` | 3-5 | [gemini-ratio-table.ts:193](../service/math/gemini-ratio-table.ts#L193) |

### Bucket C — Already Healthy (4+ instances per session)

| Primitive | Floor |
|-----------|-------|
| `comparison-builder`, `analog-clock`, `fraction-circles` | 4-6 |
| `multiplication-explorer` | 3-6 |
| `coin-counter` | 5-6 |
| `addition-subtraction-scene` | 4-8 |
| `math-fact-fluency` | 6-10 |

---

## 4. Solution Overview

Three workstreams, in order:

1. **Prompt-floor sweep (Bucket B)** — Sweep generators that have multi-instance schemas but stingy prompts. Bump the floor to 4-6 instances. One-line changes. No schema or component work. Ships in 1 day.
2. **Schema refactor — `factor-tree` (Bucket A pilot)** — Refactor `factor-tree` first as the canonical multi-instance template using existing `useChallengeProgress` / `usePhaseResults` hooks. This produces a reusable pattern.
3. **Schema refactor — remaining Bucket A primitives** — Apply the `factor-tree` template to `tape-diagram`, `bar-model`, `place-value-chart`, `percent-bar`, `double-number-line` (and `area-model` if verified singular).

Workstream 1 should ship before 2 and 3 because:
- It's the cheap win that immediately improves most K-3 sessions
- The success metric (4-6 instances per session) gets validated cheaply before we invest schema work
- It buys breathing room to refactor Bucket A correctly

---

## 5. Workstream 1: Prompt-Floor Sweep

### Goal

Every multi-instance generator produces **at least 4 instances** per single-mode session. Modes that justify higher counts (fluency, fact recall) can be higher; the floor is 4.

### Per-file changes

| File | Current text | New text |
|------|--------------|----------|
| `gemini-pattern-builder.ts:316` | `Generate 2-3 challenges, ALL of type ...` | `Generate 4-6 challenges, ALL of type ...` |
| `gemini-base-ten-blocks.ts:230` | `2-3 challenges max` (low range branch) | `4-6 challenges` |
| `gemini-base-ten-blocks.ts:246` | `3-5 challenges` (mid/high range) | `4-6 challenges` |
| `gemini-hundreds-chart.ts:253` | `Generate 3-4 challenges` | `Generate 4-6 challenges` |
| `gemini-number-line.ts:380` | `Generate 3-4 challenges` | `Generate 4-6 challenges` |
| `gemini-number-line.ts:453,512,563` | `Generate 3 challenges with increasing difficulty` | `Generate 4-6 challenges with increasing difficulty` |
| `gemini-counting-board.ts:283` | `Generate 3-5 challenges` | `Generate 4-6 challenges` |
| `gemini-skip-counting-runner.ts:298` | `Generate 3-5 challenges` | `Generate 4-6 challenges` |
| `gemini-length-lab.ts:266` | `Generate 3-5 challenges` | `Generate 4-6 challenges` |
| `gemini-shape-builder.ts:406` | `Generate 3-5 challenges` | `Generate 4-6 challenges` |
| `gemini-3d-shape-explorer.ts:279` | `Generate 3-5 challenges` | `Generate 4-6 challenges` |
| `gemini-ratio-table.ts:193` | `Generate 3-5 challenges that PROGRESS in difficulty` | `Generate 4-6 challenges that PROGRESS in difficulty` |
| `gemini-hundreds-chart.ts:253` | `Generate 3-4 challenges` | `Generate 4-6 challenges` |
| `gemini-parameter-explorer.ts:299` | `Generate 3-4 challenges` | `Generate 4-6 challenges` |
| `gemini-measurement-tools.ts:150` | `Generate 3 to 5 shapes` | `Generate 4 to 6 shapes` |

### Validation steps

For each modified generator:
1. `npx tsc --noEmit` — pass
2. `/eval-test <primitive>` — confirm generator still emits valid data
3. Manual UI check — open the Lumina tester, pin to a single eval mode, render, count instances
4. Token/cost sanity check — Gemini Flash Lite output size approximately doubles for some primitives; verify within budget

### Out of scope for Workstream 1

- Generators in Bucket A (those have no instance-count line to bump because the schema is singular)
- Generators in Bucket C (already 4+)
- Schema changes
- Component changes
- Backend registry changes

### Estimated effort

- **Coding:** 1 hour (1-line edits × ~15 files)
- **Validation:** 3-4 hours (`/eval-test` per primitive + manual inspection)
- **Total:** 1 day

---

## 6. Workstream 2: Schema Refactor — `factor-tree` as Template ✅ SHIPPED

### Goal

Refactor `factor-tree` to carry **3-6 problem instances per session**, walked sequentially, with results aggregated. Produce a reusable pattern other Bucket A primitives can adopt.

### Why `factor-tree` first

- The screenshot evidence is right there.
- The pedagogical waste is maximally visible — within `guided_small`, the candidate set (6, 8, 10, 12, 14, 15, 16, 18, 20, 24) has 10 distinct factorization shapes. Pinning to mode + producing one composite uses 10% of available variance.
- The interaction is fast (one factorization takes ~30 seconds). 3-6 fits comfortably in a 3-5 minute session.
- The data shape is simple (one number), so the refactor is the minimal viable example of the pattern.

### What shipped (vs the original plan)

| Plan (original §6) | What shipped | Why the deviation |
|---|---|---|
| Gemini emits `challenges: [{id, rootValue}, ...]` in the response schema | Gemini emits **only** wrapper metadata (`title`, `description`, `challengeType`, mode flags). The `challenges` array is built in-generator from a **deterministic local pool service**. | Per-challenge data is just a number. Structured-output Gemini is documented to converge deterministically on the same number every call (see [NUMBER_POOL_SERVICE.md](../service/math/NUMBER_POOL_SERVICE.md)) — it cannot deliver variance even with `temperature: 0.9`. Pre-selecting the pool guarantees spread and removes a class of failure modes (duplicates, out-of-range picks, "too many items" schema failures the user flagged in the brief). |
| Prompt-level "spread coverage" instructions to Gemini | Spread guarantee enforced in-code (`selectFactorTreeRootValues`): always includes ≥1 odd composite when one exists in the candidate set; orders easier-to-harder by prime-factor count. | Prompts cannot enforce invariants; code can. |
| `validateRootValue` per challenge with reject-on-duplicate | Not needed — the pool service is the only source, and it picks distinct values. | Removed entire validation surface. |
| Per-challenge override fields on `FactorTreeChallenge` (`highlightPrimes?`, `guidedMode?`, etc.) | Per-challenge data is just `{id, rootValue}`. All flags are session-level. | YAGNI — no per-instance differentiation came up in practice. |
| Component re-render uses existing tree logic "unchanged" | Required a non-trivial **stale-state guard** in the completion `useEffect` (see Lessons §6a #3). | The original plan glossed over the per-challenge state reset — it's the trickiest part of the refactor. |

### Files changed

- [gemini-factor-tree.ts](../service/math/gemini-factor-tree.ts) — new `FactorTreeChallenge` type; exported `selectFactorTreeRootValues(challengeType, options)` orchestrator; slim Gemini schema (wrapper only); `CANDIDATE_POOLS` per eval mode.
- [FactorTree.tsx](../primitives/visual-primitives/math/FactorTree.tsx) — full rewrite around `useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel`; per-challenge tree state with `useEffect`-keyed reset; aggregated `FactorTreeMetrics` at session end.
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `taskDescription` and `contextKeys` updated for multi-challenge (`currentChallengeIndex`, `totalChallenges`); `constraints` clarifies manifest must NOT supply specific numbers.

### Shipped schema

```ts
export interface FactorTreeChallenge {
  id: string;
  rootValue: number;
}

export interface FactorTreeData {
  title: string;
  description: string;
  /** 3-6 challenges. Required. Built in-generator from the local pool service. */
  challenges: FactorTreeChallenge[];
  // Session-level flags only — no per-challenge overrides.
  highlightPrimes?: boolean;
  showExponentForm?: boolean;
  guidedMode?: boolean;
  allowReset?: boolean;
}
```

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on modified files | ✅ Clean |
| `/eval-test factor-tree` across all 6 eval modes | ⏳ Owed |
| Manual UI walk: pin `guided_small`, factor 4 distinct composites, observe `PhaseSummaryPanel` | ⏳ Owed |
| `/pulse-agent` mastery-signal-density comparison | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors) |

### Actual effort

~3 hours including bug-fix iteration. The deviations (pool service + slim schema) made schema and generator faster than estimated; the stale-state guard added ~30 min of debugging not in the original estimate.

---

## 6a. Pattern Refinements From the Pilot

These are the *general* lessons from the `factor-tree` ship that should inform Workstream 3 and future multi-instance primitives. They replace the original §6 plan's implicit assumption that Gemini owns per-challenge data.

### 1. Decision rule: pool service vs orchestrated Gemini

Before writing the schema, classify the per-challenge data:

| If per-challenge data is… | Use | Examples |
|---|---|---|
| **Value-only** (a number, a coordinate, a target) | Local pool service. Gemini emits wrapper only. | `factor-tree` (rootValue), `place-value-chart` (targetNumber), `area-model` (number pairs) |
| **Content-bearing** (word problem text, scenario context, label sets) | Orchestrated parallel Gemini calls per challenge type — pattern in [gemini-coin-counter.ts](../service/math/gemini-coin-counter.ts) lines 657-755 | `tape-diagram`, `bar-model`, `percent-bar`, `double-number-line` |

The orchestrator pattern (one Gemini call per challenge-type, results merged via `Promise.all`) is the right answer when *any* per-instance field requires LLM-quality text. Don't try to one-shot 4-6 word problems in a single response schema — it's exactly the failure mode the user flagged.

### 2. Structured-output Gemini convergence is the gravitational pull

When the schema has a `responseMimeType: "application/json"` and a `responseSchema`, Gemini **ignores temperature** for numeric/categorical values. It returns the same composites (12, 24, 36…), same coordinates, same scenarios on every call. This is documented in [NUMBER_POOL_SERVICE.md](../service/math/NUMBER_POOL_SERVICE.md) and was directly observable in the pilot — the original prompt-based "spread coverage" instruction was not going to work no matter how carefully phrased. Always pre-randomize the value-only fields and inject them as mandatory.

### 3. The stale-state guard (React-effects pitfall)

Every multi-instance primitive that resets per-challenge UI state on advance will hit this:

When `useChallengeProgress.advance()` increments the index, the render that follows has the **new** `currentChallenge` but **old** per-challenge state (the reset `useEffect`'s `setX(...)` calls are scheduled, not applied until the next render). If a completion-detection `useEffect` runs in the same batch, it sees `(newChallenge, oldCompletedState)` and records a phantom success for the upcoming challenge. Symptom: completing 2 challenges reports 4 done.

**Fix pattern** — guard completion effects on a *content* match, not just a flag:

```tsx
useEffect(() => {
  if (!currentChallenge) return;
  if (!stateLooksComplete) return;
  if (alreadyRecordedRef.current) return;
  // Stale-state guard: ensure the UI state belongs to the active challenge.
  // The reset useEffect's setX() is async — without this guard we'd record
  // results for the *next* challenge using the *previous* challenge's state.
  if (!stateMatchesChallenge(currentChallenge)) return;
  alreadyRecordedRef.current = true;
  recordResult(...);
}, [stateLooksComplete, currentChallenge, /* ... */]);
```

For `factor-tree` the match is `tree.get('0').value === currentChallenge.rootValue`. For other primitives it's whatever uniquely identifies the per-challenge work product. Resetting a `ref` alone is not enough — the ref reset and the new-challenge-id are *both* visible to the completion effect on the same render.

### 4. PhaseSummaryPanel with a single phase

When all challenges in a session share one eval mode (the common case post-refactor), use a one-entry `PhaseConfig`:

```ts
const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  factor: { label: 'Factor', icon: '🌳', accentColor: 'amber' },
};
// In usePhaseResults: getChallengeType: () => 'factor'
```

The panel renders as one row showing aggregate stats. This is fine and visually clean — no special-case rendering needed.

### 5. AI tutoring context keys

Every multi-instance refactor must:
- Add `currentChallengeIndex` and `totalChallenges` to `aiPrimitiveData`.
- Update the catalog entry's `tutoring.contextKeys` to include both.
- Update `taskDescription` to template `{{totalChallenges}}` so the tutor knows it's a session, not a single problem.
- Emit `[ACTIVITY_START]` once on mount (session-level), `[TREE_COMPLETE]` / `[PHASE_COMPLETE]` per challenge, `[ALL_COMPLETE]` once at the end with the phase score breakdown.

### 6. Tester component: usually no change

The Lumina tester forwards generator output as-is via `Parameters<typeof Component>[0]['data']`. If your generator output type changes (which it will — `rootValue` → `challenges[]`), the tester picks it up automatically through structural typing. The original plan's "1 hour tester update" was unnecessary for factor-tree.

---

## 7. Workstream 3: Apply Template to Remaining Bucket A Primitives

After `factor-tree` establishes the pattern, apply to:

| Primitive | Singular field today | Refactor target | Notes |
|-----------|----------------------|-----------------|-------|
| `tape-diagram` | `wordProblem`, `part1/2/3Value/Label` | `challenges: TapeDiagramChallenge[]` | Each challenge has its own word problem + parts. Highest K-3 leverage. |
| `bar-model` | `challenge?: BarModelChallenge` (already typed but optional/singular) | `challenges: BarModelChallenge[]` (required, 3-6) | Minimal change — type is already named correctly. |
| `place-value-chart` | `targetNumber` | `challenges: PlaceValueChallenge[]` | Each challenge is one number going through its 3-phase flow. Total session = N×3 phases. May be too long — pilot with 3 challenges. |
| `percent-bar` | single `scenario`/`challengeType` | `challenges: PercentBarChallenge[]` | Verify each challenge can preserve scenario context coherently. |
| `double-number-line` | single `contextQuestion`/labels | `challenges: DoubleNumberLineChallenge[]` | Each challenge gets its own ratio relationship + context. Be careful that switching context between challenges isn't jarring (e.g. flour→cookies one challenge, cars→hours the next). May want to keep `topLabel`/`bottomLabel` consistent across a session. |
| `area-model` | (verify first) | likely `challenges: AreaModelChallenge[]` | Run audit first — prompt mentions "6-10 number pairs" so schema may already be plural in a non-obvious way. |
| `function-machine` | single `rule` with multiple inputs | likely `rules: FunctionRule[]` (3-4 rules, multiple inputs each) | Special case — multiple inputs per rule is *already* multi-instance practice. Question is whether a single session should explore multiple rules. Probably yes for mastery, but discuss. |

### Per-primitive estimate

~1.5 days per primitive following the `factor-tree` template. Some go faster (`bar-model` is structurally close); some go slower (`double-number-line`'s context coherence).

### Sequencing within Workstream 3

In order of K-3 mastery impact:
1. `tape-diagram` — workhorse for word-problem standards (2.OA, 2.MD, 3.MD)
2. `place-value-chart` — workhorse for place-value standards (K-5 NBT)
3. `bar-model` — data representation (2.MD.D, 3.MD.B)
4. `area-model` — multiplication structure (3-5)
5. `percent-bar`, `double-number-line` — older grades, lower K-3 priority
6. `function-machine` — special case, design discussion first

---

## 8. Canonical Multi-Instance Schema Pattern (Reference)

For any future primitive in Lumina:

```ts
export interface FooChallenge {
  id: string;
  // ... per-challenge problem data
}

export interface FooData {
  title: string;
  description: string;
  /** 3-6 challenges. Required. */
  challenges: FooChallenge[];

  // Session-level defaults — overridable per challenge
  // ... session-wide config
}
```

Component wiring:
```tsx
const {
  currentIndex,
  results,
  isComplete,
  recordResult,
  advance,
} = useChallengeProgress<FooChallenge>({
  challenges: data.challenges,
  getChallengeId: c => c.id,
});

const current = data.challenges[currentIndex];
// ... render `current` interaction
// on complete: recordResult({ challengeId: current.id, correct, attempts })
// then advance()
// when isComplete: show summary
```

This pattern is already used by `TenFrame`, `CountingBoard`, `NumberLine`, `FunctionMachine`, and `PatternBuilder` (per [MEMORY.md — Multi-Phase Primitive Hooks](../../../../../../C:/Users/xbox3/.claude/projects/c--Users-xbox3-claude-web-tutor/memory/MEMORY.md)).

---

## 9. Execution Plan

### Week 1: Workstream 1 (prompt sweep)

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Edit all 15 generator prompt lines per §5 table | PRs touching ~15 files |
| Mon | `npx tsc --noEmit`, fix any drift | Clean compile |
| Tue | `/eval-test` sweep across all touched primitives | Pass log for each |
| Tue | Manual UI inspection — pin each primitive to its lowest eval mode, count instances | Inspection checklist |
| Wed | Token budget verification — Gemini call sizes | Cost report |
| Wed | Ship Workstream 1 | All multi-instance generators floor at 4 |

**Week 1 success:** Every Bucket B primitive produces 4-6 instances per single-mode session.

### Week 2: Workstream 2 (factor-tree refactor — pilot)

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Refactor `FactorTreeData` + `gemini-factor-tree.ts` per §6 | New schema + generator |
| Tue | Refactor `FactorTree.tsx` to use `useChallengeProgress` | Component working with array |
| Wed | Update tester; `/eval-test factor-tree` | Pass |
| Wed | Manual walk: pin guided_small, confirm 4 distinct composites with summary panel | UI verified |
| Thu | `/pulse-agent` run on factor-tree-heavy student journey | Pulse report |
| Fri | Buffer / fix issues | Ship Workstream 2 |

**Week 2 success:** `factor-tree` produces 4-6 distinct composites per session. The pattern is documented in code and ready to apply elsewhere.

### Weeks 3-4: Workstream 3 (apply template to Bucket A)

| Week | Primitives |
|------|-----------|
| Week 3 | `tape-diagram` (Mon-Tue), `place-value-chart` (Wed-Thu), `bar-model` (Fri) |
| Week 4 | `area-model` (Mon-Tue), `percent-bar` (Wed-Thu), `double-number-line` + `function-machine` design discussion (Fri) |

**Weeks 3-4 success:** All Bucket A primitives produce 3-6 instances per session.

### Week 5: Re-audit K3_CONTENT_DENSITY

| Task | Notes |
|------|-------|
| Re-audit K3 density PRD's proposed inserts | Some may be unnecessary after instances multiply |
| Reprioritize remaining β gaps | Only insert where ladder cliffs persist |
| Update CLAUDE.md / ADDING_PRIMITIVES.md | Require multi-instance schema for all new primitives |

---

## 10. Success Criteria

| Test | Criteria | Verification |
|------|----------|--------------|
| **Instance floor** | Every K-3 math primitive produces ≥3 distinct problem instances when pinned to a single eval mode | Automated audit script: render each primitive in each eval mode, count instances |
| **Variance** | Within a single-mode session, instance #1 and instance #4 differ in surface details (different numbers, different word-problem contexts) | Manual inspection across 5+ generations per primitive |
| **Mastery signal density** | Pulse runs show ≥3× the IRT updates per student-minute compared to pre-PRD baseline | `/pulse-agent` comparison report |
| **Time-on-task** | Single-mode sessions take 3-5 minutes (up from 30-60 seconds for Bucket A) | Manual timing across primitives |
| **No regression** | All previously passing `/eval-test` runs still pass | Test sweep |
| **No cost blow-up** | Gemini token spend per session within 2x previous | Cost report |

---

## 11. What This PRD Does NOT Cover

- **Cross-mode mixing within a session.** That responsibility belongs to the engine's auto-mode (manifest layer), not the primitive. Explicitly retracted from earlier discussion.
- **Eval mode densification (β gaps).** Covered by [PRD_K3_CONTENT_DENSITY](PRD_K3_CONTENT_DENSITY.md). This PRD is complementary, not a replacement — but may obviate some of K3's proposed inserts (see §2).
- **Generator quality (challenge variety beyond rootValue selection).** Within an eval mode, the generator should produce *meaningfully different* problems, not just different numbers. Out of scope here; revisit if §10's "variance" criterion fails.
- **Backend calibration changes.** Beta priors in `problem_type_registry.py` are mode-level, not instance-level. No backend changes needed.
- **Non-math primitives.** The pattern generalizes to physics, biology, chemistry primitives — but those are out of scope here. Apply opportunistically.

---

## 12. Open Questions

1. **Session length cap.** 3-phase primitives (`place-value-chart`) at 4 instances = 12 phases. Is that too long? Pilot with 3 instances and measure abandonment.
2. **Variance enforcement.** How strictly does the generator need to vary surface details across instances? Should we add a post-generation deduplication step ("no two instances share the same rootValue / same word problem template")?
3. **Tester UI implications.** The Lumina tester currently renders one configuration. After this PRD, every primitive renders a 4-6-step flow. Does the tester need an "advance through challenges" affordance or do we trust the primitive's internal navigation?
4. **`function-machine`-specific design.** Is one rule with N inputs already a "multi-instance" session? Or should a single mode visit N rules? Discussion needed before refactor.
5. **`area-model` reality check.** Prompt at [gemini-area-model.ts:212](../service/math/gemini-area-model.ts#L212) mentions "6-10 number pairs for variety" — is this primitive already in Bucket B (just with weird wording), or is it generating 6-10 cells *within one* multiplication? Audit before scoping.
6. **K-3 only, or all-math sweep?** This PRD scopes K-3 but the Workstream 1 fix applies trivially to all-math (it's just edit-the-floor). Recommendation: do Workstream 1 across all math; scope Workstreams 2-3 to K-3 explicitly.
