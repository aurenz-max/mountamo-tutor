# PRD: Within-Mode Instance Density — From Demo Sessions to Mastery Sessions

**Status:** Workstream 2 (factor-tree pilot) shipped. Workstream 3 entry #1 (bar-model) shipped. Workstream 1 + Workstream 3 entries #2-#6 pending.
**Date:** 2026-05-12 (initial · pilot post-mortem · bar-model ship)
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

The Lumina tester forwards generator output as-is via `Parameters<typeof Component>[0]['data']`. If your generator output type changes (which it will — `rootValue` → `challenges[]`), the tester picks it up automatically through structural typing. The original plan's "1 hour tester update" was unnecessary for factor-tree. *Caveat: this only holds if the primitive is **already registered** in the tester — see §6a #10 for the case where it isn't.*

### 7. Orchestrator-same-mode vs orchestrator-mixed-type

§6a #1's "orchestrator" decision rule needs a sub-split. When the session pins to ONE eval mode (the common case — IRT calibration picks exactly one `challengeType` per render), the orchestrator simplifies to **N parallel calls of the single per-mode sub-generator**, not "one call per type":

| Sub-pattern | When | Reference |
|---|---|---|
| **Orchestrator-same-mode** | Session pins to one eval mode AND the primitive already has internal per-mode dispatch (one sub-generator function per mode, each emitting one challenge). | `bar-model` — fans out 4 parallel calls of the selected sub-generator. |
| **Orchestrator-mixed-type** | Session can mix multiple challenge types in one render. | `coin-counter` — one call per type, results merged. |

The same-mode variant is the lowest-friction refactor target because per-mode sub-generators don't need rewriting — only their return shape changes (drop session-level fields, return one `{ title, description, challenge }` tuple). Audit Workstream 3 candidates for existing per-mode dispatch before scoping.

### 8. Handler-driven completion: stale-state guard lives in submit, not effect

§6a #3 placed the stale-state guard in a completion `useEffect` (factor-tree detects "all leaves prime" passively). For primitives where the user *explicitly* submits — button click, option pick, drag-and-drop release — there is no completion effect. The guard moves into the submit helper itself:

```ts
const submitResult = (correct: boolean, extras = {}) => {
  if (!currentChallenge) return;
  // Stale-state guard: in-flight click after advance() can race ahead of the
  // reset useEffect. Match a per-challenge content field before recording.
  const stateMatches = builtValues[0]?.label === currentChallenge.values[0]?.label;
  if (!stateMatches) return;
  // ... incrementAttempts, setFeedback, recordResult ...
};
```

Same principle as §6a #3 (content match, not flag match), different location. Effect-driven primitives put the guard in the completion effect; handler-driven primitives put it in submit.

### 9. Legacy `onComplete` → `usePrimitiveEvaluation` migration is in scope

Several Bucket A primitives still expose a lightweight `onComplete: (results: ChallengeResult[]) => void` callback rather than `usePrimitiveEvaluation` + `onEvaluationSubmit`. The multi-instance refactor is the natural place to upgrade — once the session has real aggregate metrics worth submitting, the legacy callback is no longer sufficient.

Concrete migration steps:
1. Define `XxxMetrics extends BasePrimitiveMetrics` in [evaluation/types.ts](../evaluation/types.ts); add to the `AnyPrimitiveMetrics` union.
2. Re-export `XxxMetrics` from [evaluation/index.ts](../evaluation/index.ts).
3. Component: replace `onComplete?: (results) => void` with `onEvaluationSubmit?: (result: PrimitiveEvaluationResult<XxxMetrics>) => void`.
4. Add `usePrimitiveEvaluation<XxxMetrics>({ primitiveType, instanceId, skillId, subskillId, objectiveId, exhibitId, onSubmit })` with a stable instance-id ref.
5. Session-complete useEffect builds aggregate metrics and calls `submitEvaluation(goalMet, score, metrics, { studentWork })`. Don't fire per-challenge.
6. `PhaseSummaryPanel` reads `submittedResult?.score` and `elapsedMs`.

Audit pending: `tape-diagram`, `percent-bar`, `place-value-chart`, `double-number-line` for the same gap.

### 10. Tester registration is a delivery step, not an afterthought

The math primitives tester ([MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx)) is not auto-derived from the catalog. If the primitive isn't registered there, the structural-typing relief from §6a #6 doesn't apply — there's literally no render path. Each new/refactored primitive needs **five** edits to that file:

1. Import the component.
2. Add the ID to the `PrimitiveType` string union (line ~77).
3. Add an entry to `PRIMITIVE_OPTIONS` (icon + topic).
4. Add a render `case` in the switch — use the FactorTree shape for evaluation-hook primitives (pass `instanceId`, `skillId`, `subskillId`, `objectiveId`, `onEvaluationSubmit`).
5. Add a metrics-breakdown block in the results panel keyed on `result.metrics.type === 'xxx'`.

Step 5 is the most-likely-to-be-forgotten. For Workstream 3 primitives that were previously tester-registered with the old shape, the existing breakdown also needs updating — it reads fields that no longer exist on the new metrics interface.

### 11. Keep metrics honest

When designing `XxxMetrics`, drop fields that would always be tautological under the recording rules. Example from bar-model: an initial `datasetCorrectCount?: number` field for `build_graph` mode was proposed and removed, because `recordResult` is only called on `correct === true`, and bar-model's correctness requires `datasetCorrect && stepCorrect` to BOTH be true — so the field would always equal `correctCount` and carry no signal. If richer per-component signal is wanted, add an attempt-level accumulator state and track partial correctness across attempts; otherwise omit the field.

Reusable per-challenge score formula for handler-driven primitives (used by bar-model):

```ts
const perChallengeScore = (r: ChallengeResult) =>
  r.correct ? Math.max(20, 100 - (r.attempts - 1) * 20) : 0;
```

20-point decay per extra attempt, floored at 20, with 100 on first try. Standardize unless the primitive has a domain-specific signal that warrants something else (e.g., NumberLine's accuracy averaging).

---

## 6b. Bar-model Post-Mortem (Workstream 3 entry #1) ✅ SHIPPED

### Why bar-model first (out of §7's original sequencing)

§7 originally sequenced `tape-diagram` → `place-value-chart` → `bar-model` by K-3 mastery impact. We pivoted to bar-model first because:

1. **Lowest-friction orchestrator shape.** Bar-model already dispatched per-mode internally (one private sub-generator per eval mode, each emitting one challenge). The refactor only needed each sub-generator's return shape changed; schemas and prompts stayed put. This made it an ideal Workstream 3 pilot — same role factor-tree played for Workstream 2.
2. **Tester gap discovered.** Audit surfaced that bar-model was never registered in the math tester. Fixing that triggered the full integration path (catalog → tester → metrics panel), generating the §6a #10 playbook for the remaining Bucket A primitives.

### What shipped (vs the §7 row)

| Plan (§7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Orchestrator** (one call per challenge-type, per coin-counter) | **Orchestrator-same-mode**: N=4 parallel calls of the single per-mode sub-generator. See §6a #7. | A bar-model session pins to one eval mode, so "one call per type" reduces to "one call." Variance comes from independent generations of the same sub-generator. |
| `challenges: BarModelChallenge[]` (3-6, required) | `challenges: BarModelChallenge[]`, default 4, max 6. Per-challenge owns its own `values: BarValue[]`, `graphStyle`, and `scale?` — moved from session-level into the challenge. | Each challenge has a different graph, not just a different question over a shared graph. |
| Stale-state guard per §6a #3 (effect-driven) | Guard moved into `submitResult` (handler-driven completion). See §6a #8. | Bar-model has no passive completion-detect effect — submit is button-driven. |
| Evaluation: not explicitly scoped | **Upgraded**: legacy `onComplete` → `usePrimitiveEvaluation` + `BarModelMetrics`. See §6a #9. | Same gap likely exists in tape-diagram, percent-bar, place-value-chart, double-number-line. |
| Tester wiring: not explicitly scoped | **Added**: full registration in [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) including the bar-model metrics-breakdown block. See §6a #10. | Discovered during smoke-test attempt. |

### Files changed

- [gemini-bar-model.ts](../service/math/gemini-bar-model.ts) — sub-generators now return `SubGenResult { title, description, challenge }`; new `generateBarModel` orchestrator fans out 4 parallel calls of the selected sub-generator via `Promise.all`; first result's title/description become session-level.
- [BarModel.tsx](../primitives/visual-primitives/math/BarModel.tsx) — full rewrite around `useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel`; per-challenge reset useEffect keyed on `currentChallenge?.id`; handler-resident stale-state guard; `usePrimitiveEvaluation` + aggregate `BarModelMetrics` on session complete.
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `taskDescription` templates `{{totalChallenges}}` + `{{currentChallengeIndex}}`; `contextKeys` adds both; `constraints` clarifies manifest must NOT supply specific values/scales/datasets.
- [evaluation/types.ts](../evaluation/types.ts) — new `BarModelMetrics` interface; added to `AnyPrimitiveMetrics`.
- [evaluation/index.ts](../evaluation/index.ts) — re-exports `BarModelMetrics`.
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — five edits per §6a #10.

### BarModelMetrics shipped

```ts
export interface BarModelMetrics extends BasePrimitiveMetrics {
  type: 'bar-model';
  evalMode: BarModelEvalMode;
  graphStyle: BarModelGraphStyle;
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;          // Total tries including wrong attempts
  firstTryCount: number;          // attempts === 1 && correct
  hintsViewed: number;            // attempts > 1 (saw a wrong-answer hint)
  overallAccuracy: number;        // 0-100, decayed by attempts
  averageAttemptsPerChallenge: number;
}
```

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (pre-existing scratch-pad variance errors are unrelated) |
| `/eval-test bar-model` across all 6 eval modes | ⏳ Owed |
| Manual UI walk: pin `compare_bars`, finish 4 distinct K-1 graphs, observe `PhaseSummaryPanel` + tester results breakdown | ⏳ Owed |
| Manual UI walk: pin `graph_word_problem`, verify content-bearing variance across 4 independent Gemini generations | ⏳ Owed |
| Cost spot-check (4× per-session token spend — see §10 revised criterion) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors) |

### Actual effort

~2-3 hours total: schema/types ~30 min, component rewrite ~60 min, evaluation-hook migration ~30 min, tester wiring ~30 min, type errors ~15 min. Faster than §7's "~1.5 days per primitive" estimate — the per-mode sub-generators were already structurally correct, so only their return type needed work. The original PRD predicted this ("`bar-model` is structurally close"), validated.

---

## 7. Workstream 3: Apply Template to Remaining Bucket A Primitives

After `factor-tree` establishes the pattern, apply to:

| Primitive | Singular field today | Refactor target | Generation pattern (per §6a #1) | Notes |
|-----------|----------------------|-----------------|---------------------------------|-------|
| `tape-diagram` | `wordProblem`, `part1/2/3Value/Label` | `challenges: TapeDiagramChallenge[]` | **Orchestrator** (per-challenge Gemini call; content-bearing) | Each challenge has its own word problem + parts. Highest K-3 leverage. Use [gemini-coin-counter.ts](../service/math/gemini-coin-counter.ts) as the structural reference. |
| `bar-model` ✅ **SHIPPED** | ~~`challenge?: BarModelChallenge`~~ → `challenges: BarModelChallenge[]` (default 4, max 6) | Shipped | **Orchestrator-same-mode** (per §6a #7) — N parallel calls of the per-mode sub-generator. See §6b for ship details. |
| `place-value-chart` | `targetNumber` | `challenges: PlaceValueChallenge[]` | **Pool service** (value-only — leverages existing `createNumberPool` per [NUMBER_POOL_SERVICE.md](../service/math/NUMBER_POOL_SERVICE.md)) | Each challenge is one number going through its 3-phase flow. Total session = N×3 phases. May be too long — pilot with 3 challenges. |
| `percent-bar` | single `scenario`/`challengeType` | `challenges: PercentBarChallenge[]` | **Orchestrator** | Each challenge has its own scenario context (e.g. "tip on a meal", "discount on a jacket"). |
| `double-number-line` | single `contextQuestion`/labels | `challenges: DoubleNumberLineChallenge[]` | **Orchestrator** | Each challenge gets its own ratio relationship + context. Keep `topLabel`/`bottomLabel` consistent within a session for coherence (e.g. all flour→cookies, not flour→cookies then cars→hours). |
| `area-model` | (verify first) | likely `challenges: AreaModelChallenge[]` | **Pool service** (value-only — operand pairs via [createOperandPairs](../service/math/numberPoolService.ts)) | Run audit first — prompt mentions "6-10 number pairs" so schema may already be plural in a non-obvious way. |
| `function-machine` | single `rule` with multiple inputs | likely `rules: FunctionRule[]` (3-4 rules, multiple inputs each) | **Pool service for inputs, orchestrator for rule descriptions** | Special case — multiple inputs per rule is *already* multi-instance practice. Question is whether a single session should explore multiple rules. Probably yes for mastery, but discuss. |

### Mandatory checklist for each Bucket A refactor (derived from pilot)

For every primitive in this workstream, in addition to the per-row notes above:

1. **Schema decision** — apply §6a #1 (pool vs orchestrator). Document the choice at the top of the generator file.
2. **Pool service** — if value-only, use or extend [numberPoolService.ts](../service/math/numberPoolService.ts). Don't roll your own random selection unless the candidate space is small + per-mode constrained (factor-tree case).
3. **Variance guarantee** — if the pool has structural variants (odd/even, small/large), enforce a representative pick in code, not in the prompt.
4. **`useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel`** — follow the recipe in [MIGRATING_TO_PHASE_SUMMARY.md](MIGRATING_TO_PHASE_SUMMARY.md). All 7 steps. No shortcuts.
5. **Per-challenge reset useEffect** — keyed on `currentChallenge?.id`. Resets per-challenge state, sets `treeCompleteTriggeredRef.current = false`.
6. **Stale-state guard in the completion useEffect** (§6a #3) — match a *content* field (`tree.get('0').value`, `currentInput`, etc.) against the current challenge's expected value before recording. This is non-optional — without it you'll get phantom-completion bugs.
7. **Aggregate metrics in `submitEvaluation`** — sum per-challenge `attempts`, `hintsUsed`, `resetCount`, etc. into one session-level `XxxMetrics` payload. Don't submit per-challenge.
8. **Catalog tutoring update** ([catalog/math.ts](../service/manifest/catalog/math.ts)) — add `currentChallengeIndex` + `totalChallenges` to `contextKeys`; template `{{totalChallenges}}` in `taskDescription`; update `constraints` if the manifest should stop supplying primitive-specific values.
9. **No tester changes** unless the tester seeds data directly (most don't — they forward generator output). *Caveat: this only applies if the primitive is already registered — see step 11.*
10. **Evaluation-hook migration** (per §6a #9) — If the primitive still uses the legacy `onComplete?: (results) => void` callback, replace with `usePrimitiveEvaluation` + `onEvaluationSubmit`. Add `XxxMetrics` to [evaluation/types.ts](../evaluation/types.ts) and re-export from [evaluation/index.ts](../evaluation/index.ts). Compute aggregate metrics in the session-complete useEffect; call `submitEvaluation(goalMet, score, metrics, { studentWork })` exactly once. Use the standard per-challenge score decay (§6a #11) unless domain-specific scoring is warranted.
11. **Tester registration** (per §6a #10) — Add five edits to [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx): import, `PrimitiveType` union, `PRIMITIVE_OPTIONS` entry, render `case` (FactorTree shape for eval-hook primitives), metrics-breakdown block keyed on `result.metrics.type === 'xxx'`. If the primitive WAS already registered with the old shape, the metrics breakdown almost certainly reads fields that no longer exist — update or remove it.

### Per-primitive estimate

~1.5 days per primitive following the `factor-tree` template. Bar-model actuals (per §6b): ~2-3 hours including eval-hook migration and tester wiring, because it already had per-mode sub-generators internally. Expect similarly low effort for any primitive that's already internally per-mode-dispatched. Slower estimates (~2 days) hold for primitives needing new content-bearing schemas — `double-number-line`'s context coherence, `tape-diagram`'s multi-type orchestrator. Always include §6a #9 + #10 work in the estimate.

### Sequencing within Workstream 3

Two competing orderings — K-3 mastery impact vs refactor-friction. Original plan optimized for impact; the bar-model ship demonstrated that picking the lowest-friction primitive first as the Workstream 3 "pilot" generates the playbook (§6a #7-#11) for the rest at lower risk. Recommended order:

1. ~~`bar-model` — data representation (2.MD.D, 3.MD.B)~~ ✅ **SHIPPED** — served as the Workstream 3 pilot. See §6b.
2. `tape-diagram` — workhorse for word-problem standards (2.OA, 2.MD, 3.MD). Highest K-3 leverage. **Orchestrator-mixed-type** (per §6a #1) since it spans multiple challenge structures; apply §6a #9 eval-hook migration.
3. `place-value-chart` — workhorse for place-value standards (K-5 NBT). **Pool service** (value-only per §6a #1). Pilot with 3 instances first per Open Question #1 (12 phases at 4 instances may be too long).
4. `area-model` — multiplication structure (3-5). Audit first per Open Question #5 — may already be plural.
5. `percent-bar`, `double-number-line` — older grades, lower K-3 priority. Both orchestrator-mixed-type; double-number-line needs context coherence enforcement.
6. `function-machine` — special case, design discussion first.

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

  // Session-level defaults — keep these flat. Per-challenge overrides are YAGNI.
  // ... session-wide config
}
```

### Generator: pick a fork

Per §6a #1:

**Fork A — pool service (value-only per-challenge data).** Reference: [gemini-factor-tree.ts](../service/math/gemini-factor-tree.ts).

```ts
// 1. Gemini call emits ONLY the wrapper (title, description, mode flags).
// 2. Local service deterministically selects per-challenge values.
const rootValues = selectFooValues(challengeType, { count: 4 });
// 3. Build challenges array in-generator.
const challenges = rootValues.map((v, i) => ({ id: `foo-${i + 1}`, value: v }));
return { ...wrapper, challenges };
```

**Fork B — orchestrated parallel Gemini calls (content-bearing per-challenge data).** Reference: [gemini-coin-counter.ts:657-755](../service/math/gemini-coin-counter.ts#L657).

```ts
// One Gemini call per challenge type; results merged.
const generators: Promise<FooChallenge[]>[] = [];
for (const type of allowedTypes) {
  generators.push(generateFooChallengesOfType(type, ...));
}
const results = await Promise.all(generators);
const challenges = results.flat().map((c, i) => ({ ...c, id: `foo-${i + 1}` }));
```

### Component wiring (both forks)

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

// Per-challenge reset: keyed on currentChallenge.id, runs whenever advance() flips it.
useEffect(() => {
  if (!current) return;
  setMyInteractionState(initial(current));
  resetAttemptsCounter();
  alreadyRecordedRef.current = false;
}, [current?.id]);

// Completion detection — MUST include the stale-state guard (§6a #3).
useEffect(() => {
  if (!current) return;
  if (!stateLooksComplete) return;
  if (alreadyRecordedRef.current) return;
  // Stale-state guard: setX() in the reset effect is async; without this check we
  // record a phantom completion for the new challenge using old state.
  if (!stateBelongsToChallenge(myInteractionState, current)) return;
  alreadyRecordedRef.current = true;
  recordResult({ challengeId: current.id, correct, attempts });
}, [stateLooksComplete, current, myInteractionState]);

// When isComplete: render PhaseSummaryPanel and submit aggregated metrics ONCE.
```

This pattern is used by `TenFrame`, `CountingBoard`, `NumberLine`, `FunctionMachine`, `PatternBuilder`, and (as of this PRD) `FactorTree` (per [MEMORY.md — Multi-Phase Primitive Hooks](../../../../../../C:/Users/xbox3/.claude/projects/c--Users-xbox3-claude-web-tutor/memory/MEMORY.md)).

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
| ~~Week 3 (original)~~ | ~~`tape-diagram` → `place-value-chart` → `bar-model`~~ |
| Week 3 (revised) | `bar-model` ✅ SHIPPED (see §6b) · `tape-diagram` · `place-value-chart` (pilot with 3 instances per Open Q #1) |
| Week 4 | `area-model` (audit first per Open Q #5) · `percent-bar` · `double-number-line` · `function-machine` design discussion |

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
| **No cost blow-up** | **Pool-service primitives** within 2× previous (factor-tree, place-value-chart, area-model). **Orchestrator primitives** within N× where N = `instanceCount` (4× default) — accepted trade-off for content-bearing variance per §6a #2. Bar-model precedent. | Cost report per primitive |

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
2. **Variance enforcement.** ~~How strictly does the generator need to vary surface details across instances?~~ **Resolved by pilot:** for value-only data, deterministic pool selection with a "≥1 odd"-style variance guarantee beats anything prompt-based. Don't rely on Gemini for variance — structured output is convergent. For content-bearing data, the orchestrator pattern (one Gemini call per type) gives natural variance from independent generations.
3. **Tester UI implications.** ~~The Lumina tester currently renders one configuration.~~ **Resolved by pilot:** the tester forwards generator output via structural typing and worked unchanged after factor-tree's shape change. Existing primitive-internal navigation (Next Challenge button + progress dots) is sufficient — no tester-side affordance needed.
4. **`function-machine`-specific design.** Is one rule with N inputs already a "multi-instance" session? Or should a single mode visit N rules? Discussion needed before refactor.
5. **`area-model` reality check.** Prompt at [gemini-area-model.ts:212](../service/math/gemini-area-model.ts#L212) mentions "6-10 number pairs for variety" — is this primitive already in Bucket B (just with weird wording), or is it generating 6-10 cells *within one* multiplication? Audit before scoping.
6. **K-3 only, or all-math sweep?** This PRD scopes K-3 but the Workstream 1 fix applies trivially to all-math (it's just edit-the-floor). Recommendation: do Workstream 1 across all math; scope Workstreams 2-3 to K-3 explicitly.
7. **(New, from pilot)** Should `selectFactorTreeRootValues` be generalized into the shared `numberPoolService` as a `createCandidateSetPool({ candidates, count, varianceGuarantees })` helper? Workstream 3 has two more value-only primitives (`place-value-chart`, `area-model`) — if their selection logic looks similar, generalize after the second use, not before.
