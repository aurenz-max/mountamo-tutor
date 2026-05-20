# PRD: Within-Mode Instance Density — From Demo Sessions to Mastery Sessions

**Status:** Workstream 2 (factor-tree pilot) shipped. Workstream 3 entries #1 (bar-model), #2 (tape-diagram), #3 (place-value-chart), #4 (area-model), #6 (function-machine), #7 (ordinal-line), #8 (array-grid), and #9 (fraction-bar) shipped. Workstream 1 + Workstream 3 entry #5 (percent-bar / double-number-line) + remaining §3a entry (strategy-picker, Bucket B-single) pending. **2026-05-19 audit** (§3a) surfaced three additional unlisted primitives — array-grid (✅ §6h), fraction-bar (✅ §7 row), strategy-picker (pending) — plus re-confirmed the already-listed percent-bar / double-number-line.
**Date:** 2026-05-12 (initial · pilot post-mortem · bar-model ship) · 2026-05-13 (tape-diagram ship) · 2026-05-15 (place-value-chart ship) · 2026-05-19 (area-model ship · AM-2 multiply render-overflow fix · function-machine ship · ordinal-line ship · §3a audit · array-grid ship)
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

## 3a. 2026-05-19 Re-audit — `validation.challengeCount` Under Single-Mode

After ordinal-line surfaced as an unlisted Bucket A failure in production (§6g), we re-ran the audit by **calling `/eval-test` against every math primitive's first single-type eval mode** and reading `validation.challengeCount` from the API response. This catches the bucket §3 missed: primitives whose schema has `challenges: X[]` but whose generator orchestrates one-per-type, degenerating to 1 challenge in single-mode (the **B-mixed** bucket per §6g #1).

### Method

For each math primitive with at least one eval mode whose `challengeTypes` has length 1, request that mode and read `validation.challengeCount`. Three signal values:

- **0** — Schema has no `challenges[]` field. Classic Bucket A (singular). Same shape as factor-tree pre-refactor.
- **1** — Schema has `challenges[]` but the generator emitted exactly one instance. Either B-mixed (orchestrator one-per-type, pinned to a single type) or B-stingy (prompt asks for "a challenge").
- **3+** — Healthy.

Tested 11 primitives flagged as suspect by the cross-codebase audit. Results below sort by remediation effort.

### Results

| Primitive | Eval mode tested | `challengeCount` | Bucket | Status |
|-----------|------------------|------------------|--------|--------|
| `number-line` | `identify` | **4** | Healthy | ✅ Already passing |
| `pattern-builder` | `extend` | **4** | Healthy | ✅ Already passing |
| `ratio-table` | `build_ratio` | **3** | Healthy | ✅ Already passing |
| `hundreds-chart` | `highlight_sequence` | **5** | Healthy | ✅ Already passing |
| `coordinate-graph` | `plot_point` | **5** | Healthy | ✅ Already passing |
| `equation-workspace` | `guided-solve` | **5** | Healthy | ✅ Already passing |
| `strategy-picker` | `guided` | **1** | **Bucket B-single** | ❌ Single-instance per mode — pending refactor |
| `array-grid` | `build_array` | **0** | **Bucket A** | ✅ **Shipped 2026-05-19 (§6h)** — pool-service, default 4 challenges/session |
| `fraction-bar` | `identify` | **0** | **Bucket A** | ✅ **Shipped 2026-05-19 (§7 row)** — pool-service, default 3 challenges/session |
| `percent-bar` | `identify_percent` | **0** | **Bucket A** (re-confirmed) | ❌ Singular schema — pending (Workstream 3 entry #5) |
| `double-number-line` | `equivalent_ratios` | **0** | **Bucket A** (re-confirmed) | ❌ Singular schema — pending (Workstream 3 entry #5) |

### Interpretation

**6/11 already passing.** Workstream 1's prompt-floor work appears to have landed for the multi-challenge generators that had stingy prompts (number-line, pattern-builder, ratio-table, hundreds-chart). Coordinate-graph and equation-workspace were already healthy. The original §3 Bucket B audit overstated the remaining work — most of those generators now produce 3-6 challenges per single-mode session unprompted.

**3 newly-discovered Bucket A primitives — 2 shipped, 1 pending.** `array-grid` (§6h) and `fraction-bar` (§7 row) shipped 2026-05-19 — both turned out to be value-only and adopted the pool-service template directly. Only `strategy-picker` remains (Bucket B-single, `challengeCount=1` — schema already has the array, generator just emits one).

**2 re-confirmed Bucket A primitives.** `percent-bar` and `double-number-line` were already in the §7 plan and remain on it.

### Updated Workstream 3 backlog (Bucket A — schema refactor required)

| Primitive | Bucket | Pattern (per §6a #1) | Notes |
|-----------|--------|----------------------|-------|
| `percent-bar` | A | Orchestrator-same-mode or pool-service | Already in §7. Each instance is a scenario context (e.g. tip on a meal, discount on a jacket). |
| `double-number-line` | A | Orchestrator | Already in §7. Context coherence required — keep one ratio relationship per session, vary the scenario phrasing per challenge. |
| `array-grid` ✅ **SHIPPED** | A | Pool-service (per-mode dimension generators) | Shipped 2026-05-19 (§6h). Pool-service with per-mode `dimensionRangeFor` switch (no `createOperandPairs` dep — see §6h #1). |
| `fraction-bar` ✅ **SHIPPED** | A | Pool-service (per-mode operand generators) | Shipped 2026-05-19 (§7 row). All four modes (identify, build, compare, add_subtract) turned out value-only — single per-mode operand generator + local MC distractor builder; no per-mode UI dispatch needed. Same template as area-model / array-grid. |
| `strategy-picker` | B-single | Pool-service (equations) | **New (§3a) — still pending.** `challengeCount=1` not 0 — schema already has `challenges[]`, generator just emits one. Could be a one-line prompt bump if the orchestration shape allows it, or a small refactor to pre-select N distinct equations per mode. Audit before scoping. |

### What this audit does NOT tell us

- **Within-challenge interaction depth.** A primitive can score `challengeCount=4` and still feel demo-y if each challenge takes 5 seconds. The audit measures count, not engagement.
- **Variance quality.** `challengeCount=4` with four identical surface features (same root number, same scenario) still fails the §10 "Variance" criterion. Manual UI walks remain the only check for this.
- **Auto-mode behavior.** All tests above used single-mode (one challenge type). Auto-mode (all types) is the engine's responsibility per PRD §11.

### Audit script

The single-mode count check is cheap enough to run as CI. The full procedure used today: for each primitive, find one eval mode whose `challengeTypes` has length 1, request `/api/lumina/eval-test?componentId=<id>&evalMode=<mode>`, and assert `validation.challengeCount >= 3`. Add as a Workstream 1.5 deliverable so any future Bucket B-mixed regression fails CI immediately.

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

### 12. Compact numeric inputs beat the full CalculatorInput keypad

Where a primitive renders multiple unknown slots that each need a small numeric answer (tape-diagram represent has 3 segments side-by-side; place-value-chart and percent-bar will have similar patterns), the shared `CalculatorInput` component dominates the screen — it stacks a 4×4 keypad (~14 rows) under every slot. Multiply by 3 slots and the diagram itself becomes a footnote on the page.

Replace with an inline stepper-plus-text-input: `[−] [typeable orange field] [+]` with a small "Check" button beneath. Reference: `SegmentStepper` helper in [TapeDiagram.tsx](../primitives/visual-primitives/math/TapeDiagram.tsx). Vertical footprint drops from ~14 rows to ~3. Type-in supports larger values; `−/+` supports rapid small adjustments; Enter submits.

**When to apply:** any multi-slot numeric entry primitive (`place-value-chart`, `percent-bar`, `double-number-line`, `area-model`). When in doubt, keep CalculatorInput for single large-number entry contexts (one prominent answer field), swap for stepper when there are 2+ slots rendered together.

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

## 6c. Tape-diagram Post-Mortem (Workstream 3 entry #2) ✅ SHIPPED

### Why tape-diagram second

§7 sequenced tape-diagram second after bar-model on K-3 mastery impact ("workhorse for word-problem standards 2.OA, 2.MD, 3.MD — highest K-3 leverage"). The audit also surfaced that tape-diagram had already migrated to `usePrimitiveEvaluation` + `TapeDiagramMetrics` in a prior pass, so §6a #9 was partly done before the refactor — only the metrics shape needed work.

### What shipped (vs the §7 row)

| Plan (§7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Orchestrator-mixed-type** (per-challenge Gemini call) | **Orchestrator-same-mode** (per §6a #7) — N=4 parallel calls of the per-mode sub-generator. | Tape-diagram already had internal per-mode dispatch (one private sub-generator per eval mode, each emitting one singular `TapeDiagramData`). Session pins to one eval mode, so "one call per type" reduces to "one call." Same path bar-model took — and the §7 row's projection was made before §6a #7 existed. |
| `challenges: TapeDiagramChallenge[]` (per-challenge content-bearing data) | `challenges: TapeDiagramChallenge[]`, default 4, max 6. Per-challenge owns its own `bars`, `wordProblem`, `comparisonMode`, `showBrackets`, `comparisonData?`, `multiStepData?` — moved from session-level into the challenge. | Each challenge has a different word problem and different bar structure. Session-level data is just title/description. |
| Stale-state guard per §6a #3 (effect-driven) | Guard moved into `completeCurrentChallenge` helper (handler-driven completion). See §6a #8. | Tape-diagram has no passive completion effect — every submit is button-driven through one of four mode-specific handlers. |
| Evaluation: §6a #9 eval-hook migration | **Skipped (already done)**: tape-diagram had already migrated to `usePrimitiveEvaluation` + `TapeDiagramMetrics`. Only the metrics shape needed work. | Pre-existing prior-pass migration. The remaining work was flattening the metrics per §6a #11. |
| Metrics: not explicitly scoped | **Flattened per §6a #11**: dropped 17 within-challenge phase fields (`explorePhaseCompleted`, `practiceUnknownsTotal`, `segmentRelationships`, etc.) that were tautological at session level. New shape mirrors `BarModelMetrics`. | The old metrics encoded the within-challenge 3-phase part-whole flow into session-level fields. After multi-instance, those fields measured one challenge's nested phases, not the session — which made them meaningless at the aggregate level. |
| Tester wiring: not explicitly scoped | **Added**: full registration in [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) including the tape-diagram metrics-breakdown block per §6a #10. | Old registration only passed `data` — no `instanceId`/`skillId`/`subskillId`/`objectiveId`/`onEvaluationSubmit`, and no metrics breakdown block. |
| Input UX: not scoped | **Replaced `CalculatorInput` with compact `SegmentStepper`** (per new §6a #12). | The full keypad consumed ~14 vertical rows per segment; with 3 segments side-by-side in represent mode, the diagram became a footnote. Stepper drops to ~3 rows per segment. |

### Files changed

- [gemini-tape-diagram.ts](../service/math/gemini-tape-diagram.ts) — sub-generators now return `SubGenResult { title, description, challenge }`; new `generateTapeDiagram` orchestrator fans out 4 parallel calls of the selected sub-generator via `Promise.all`; first result's title/description become session-level.
- [TapeDiagram.tsx](../primitives/visual-primitives/math/TapeDiagram.tsx) — full rewrite around `useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel`; new `TapeDiagramChallenge` exported and `TapeDiagramData` reshaped; per-challenge reset useEffect keyed on `currentChallenge?.id` resetting every within-challenge state slot (userAnswers, feedback, segmentAttempts, currentPhase, wholeValue, wholeFound, phaseAttempts, currentStepIndex, challengeHintCount); handler-resident stale-state guard in `completeCurrentChallenge`; new `SegmentStepper` helper replaces CalculatorInput for both segment values and the part-whole "Total =" input.
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `taskDescription` templates `{{totalChallenges}}` + `{{currentChallengeIndex}}` + `{{challengeType}}`; `contextKeys` adds session-level keys; `constraints` clarifies the manifest must NOT supply specific values, bars, or word problems.
- [evaluation/types.ts](../evaluation/types.ts) — `TapeDiagramMetrics` flattened from 25 fields to 9 (mirrors `BarModelMetrics`).
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — render case now passes evaluation props; added `result.metrics.type === 'tape-diagram'` metrics-breakdown block.

### TapeDiagramMetrics shipped (post-flattening)

```ts
export interface TapeDiagramMetrics extends BasePrimitiveMetrics {
  type: 'tape-diagram';
  challengeType: 'represent' | 'solve_part_whole' | 'solve_comparison' | 'multi_step';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;          // Total tries across all challenges
  firstTryCount: number;          // attempts === 1 && correct
  hintsViewed: number;            // Challenges where the hint panel was opened
  overallAccuracy: number;        // 0-100, decayed by attempts
  averageAttemptsPerChallenge: number;
}
```

### Within-challenge state reset is the trickiest part of multi-phase primitives

Tape-diagram's `solve_part_whole` mode has an internal 3-phase mini-flow (explore → practice → apply) per challenge. Multi-instance means each challenge has its own 3-phase mini-flow, then advance to the next challenge. The per-challenge reset useEffect had to enumerate **nine** state slots, more than bar-model's four: `userAnswers`, `feedback`, `segmentAttempts`, `showHints`, `challengeHintCount`, `currentPhase`, `wholeValue`, `wholeFound`, `phaseAttempts`, `currentStepIndex`. Missing any one of those leads to challenge N+1 seeing residual state from challenge N.

**General lesson:** when refactoring a multi-phase Bucket A primitive, enumerate every piece of per-challenge state explicitly in the reset effect. If the primitive had within-challenge phases or steps, those reset too. The fastest way to find them all: grep for every `useState` in the component and ask "would this be wrong for the next challenge?" — if yes, reset it.

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (no errors in any touched file) |
| `/eval-test tape-diagram` across all 4 eval modes | ⏳ Owed |
| Manual UI walk: pin `represent`, finish 4 distinct word problems, observe `PhaseSummaryPanel` + tester metrics breakdown | ⏳ Owed |
| Manual UI walk: pin `solve_part_whole`, verify within-challenge 3-phase flow resets correctly between challenges | ⏳ Owed |
| Cost spot-check (4× per-session token spend — content-bearing variance per §6a #2) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors) |

### Actual effort

~2 hours total: generator refactor ~30 min, component rewrite ~60 min, metrics flattening ~10 min, catalog + tester wiring ~15 min, type errors ~10 min. Plus follow-up: math tester layout swap (sticky header + 300px sidebar + flex-1 main, mirroring LanguageArtsPrimitivesTester pattern) to give the now-wider preview the screen real estate it needed, and `SegmentStepper` UX swap. Faster than bar-model because the eval-hook migration was already complete from a prior pass.

---

## 6d. Place-value-chart Post-Mortem (Workstream 3 entry #3) ✅ SHIPPED

### Why place-value-chart third

§7 sequenced place-value-chart third on K-3 mastery impact ("workhorse for place-value standards K-5 NBT"). This is the first **pool-service** entry in Workstream 3 — bar-model and tape-diagram both used orchestrator-same-mode because their per-challenge data is content-bearing. Place-value-chart's per-challenge data is value-only (one `targetNumber` per challenge; MC choices are deterministically derived from it), so it follows factor-tree's pattern.

### Pilot decision: 3 instances, not 4

Per Open Question #1 and the §7 row note, this primitive pilots at **3 instances** rather than the §5 default of 4. Rationale: each challenge runs through a 3-phase within-challenge flow (identify → value → build), so 3 instances = 9 phases per session. 4 instances would be 12 phases — risk of abandonment. We'll measure session-length and adjust if the floor is too high (or push to 4 if 3 feels too short).

### What shipped (vs the §7 row)

| Plan (§7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Pool service** (value-only — leverages existing `createNumberPool`) | **Pool service** — Gemini emits only wrapper metadata (title, description, mode flags); local `buildChallenges()` selects N distinct numbers from `createNumberPool`, then derives `highlightedDigitPlace`, `minPlace`/`maxPlace`, `placeNameChoices`, `digitValueChoices` per challenge in code. Mirrors factor-tree's split. | As predicted by §6a #1 and §6a #2 — structured-output Gemini converges per-call, so the only way to get 3 distinct numbers is to pre-select them. |
| `challenges: PlaceValueChallenge[]` | `challenges: PlaceValueChartChallenge[]`, default 3, max 6. Per-challenge owns its own `targetNumber`, `highlightedDigitPlace`, `minPlace`/`maxPlace`, `placeNameChoices`, `digitValueChoices` — moved from session-level into the challenge. | Each challenge needs its own MC distractors since they depend on `targetNumber` × `highlightedDigitPlace`. |
| Stale-state guard per §6a #3 (effect-driven) | Guard in `completeCurrentChallenge` (handler-driven). See §6a #8. | Build phase ends in an explicit button click — no completion-detect effect. Same shape bar-model and tape-diagram took. |
| Evaluation: **already migrated** in a prior pass | Pre-existing `usePrimitiveEvaluation` + `PlaceValueChartMetrics` retained; **metrics flattened** from 25 fields to 9 (mirrors `BarModelMetrics` / `TapeDiagramMetrics` per §6a #11). | The old metrics encoded the within-challenge 3-phase flow into session-level fields (`correctPlaceName`, `studentPlaceAnswer`, `digitChanges`, `expandedFormParts`, etc.). After multi-instance, those fields became tautological at the session level — they measured one challenge's nested phases, not the session. |
| Tester wiring | Updated: pass `onEvaluationSubmit` (was previously omitted "to avoid double submission" — no longer applicable); rewrote the place-value metrics breakdown block to read the new aggregate shape. | Per §6a #10 the previously-registered tester block read fields that no longer exist on the new metrics interface. |

### Within-challenge state reset (§6c, applied)

Per §6c's general lesson, the per-challenge reset useEffect enumerates **eleven** state slots that all reset on `currentChallenge.id` change:
`currentPhase`, `feedback`, `feedbackType`, `selectedPlaceName`, `placeAttempts`, `selectedValue`, `valueAttempts`, `digits`, `digitChangeCount`, `buildAttempts`, `challengeHintCount`. Plus `recordedRef.current` flipped back to false. This is two more slots than tape-diagram's nine — multi-phase primitives keep growing the reset list. The grep-for-`useState` heuristic from §6c continues to work.

### Per-challenge score formula deviation

The standard formula in §6a #11 (`r.correct ? Math.max(20, 100 - (r.attempts - 1) * 20) : 0`) misbehaves here because each challenge has 3 sub-phases. If `attempts` = sum of all phase-button presses, a first-try-perfect challenge yields `attempts=3` and a score of 60, not 100.

**Resolution:** compute a per-phase score (`phaseScore(attempts) = 100 first-try, -20 per extra, floor 20`), average across the three within-challenge phases, store the result on `ChallengeResult.score`, and use a custom `usePhaseResults` `getScore` that averages the stored scores. Same shape NumberLine took (per [MEMORY.md — Multi-Phase Primitive Hooks](../../../../../../C:/Users/xbox3/.claude/projects/c--Users-xbox3-claude-web-tutor/memory/MEMORY.md)) — `ChallengeResult` has `[key: string]: unknown` so domain fields ride along.

**General lesson for §6a:** when a primitive has within-challenge sub-phases, compute per-challenge `score` directly and use a custom `getScore` averager. Don't try to derive it from a single `attempts` count.

### Between-challenge UI affordance

Unlike bar-model (which auto-advances on submit) and tape-diagram (which has a "Next" handler inside each mode's section), place-value-chart introduces a new fourth pseudo-phase `'challenge-done'` between phase 3 and the next challenge. Rationale: after building the number, the student sees an explicit "Number N complete! Ready for the next number?" panel with a "Next Number →" button. Without this beat, the build-phase celebration message disappears the moment the reset effect fires, and the student loses sight of the achievement before the next challenge appears.

This pattern probably generalizes to any multi-phase primitive whose final phase celebration should be readable for ~2 seconds. Consider adopting in `percent-bar`/`double-number-line` retrofits.

### Files changed

- [gemini-place-value.ts](../service/math/gemini-place-value.ts) — full rewrite around the pool service. Slim wrapper schema (Gemini emits title/description/mode flags only); per-mode `MODE_PROFILES` table drives `numberRange`/`minPlace`/`maxPlace`; local helpers `selectHighlightedPlace`, `buildPlaceNameChoices`, `buildDigitValueChoices`, `computePlaceRange`, `buildChallenges` deterministically construct N challenges.
- [PlaceValueChart.tsx](../primitives/visual-primitives/math/PlaceValueChart.tsx) — full rewrite around `useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel`. New `PlaceValueChartChallenge` exported and `PlaceValueChartData` reshaped with `challenges[]` + session-level `challengeType`. Per-challenge reset useEffect resets eleven state slots; handler-resident stale-state guard in `completeCurrentChallenge`. New `'challenge-done'` between-challenge phase + "Next Number →" affordance.
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `taskDescription` templates `{{totalChallenges}}` + `{{currentChallengeIndex}}` + `{{challengeType}}`; `contextKeys` adds `title`, `challengeType`, `currentChallengeIndex`, `totalChallenges`; `constraints` clarifies manifest must NOT supply specific numbers, place ranges, or MC choices; description rewritten to reflect multi-challenge sessions.
- [evaluation/types.ts](../evaluation/types.ts) — `PlaceValueChartMetrics` flattened from 25 fields to 9 (mirrors `BarModelMetrics` / `TapeDiagramMetrics`).
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — render case now passes `onEvaluationSubmit`; rewrote `result.metrics.type === 'place-value-chart'` breakdown block for the new aggregate shape.

### PlaceValueChartMetrics shipped (post-flattening)

```ts
export interface PlaceValueChartMetrics extends BasePrimitiveMetrics {
  type: 'place-value-chart';
  challengeType: 'identify' | 'build' | 'compare' | 'expanded_form';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;          // Sum of (placeAttempts + valueAttempts + buildAttempts) across challenges
  firstTryCount: number;          // Challenges scoring 100 (all 3 phases first try)
  hintsViewed: number;
  overallAccuracy: number;        // 0-100, average per-challenge averaged-phase score
  averageAttemptsPerChallenge: number;
}
```

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (pre-existing scratch-pad `PrimitiveRenderer` variance noise unchanged) |
| `/eval-test place-value-chart` across all 4 eval modes | ⏳ Owed |
| Manual UI walk: pin `compare`, finish 3 distinct numbers, observe `'challenge-done'` interstitial between each | ⏳ Owed |
| Manual UI walk: pin `expanded_form`, verify decimal-place handling on per-challenge `minPlace` selection | ⏳ Owed |
| Session-length spot-check: time end-to-end vs the 3-5 minute target in §10 (this is the Open Q #1 measurement) | ⏳ Owed |
| Cost spot-check (1× per-session Gemini call — wrapper only, big savings vs orchestrator primitives) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors) |

### Actual effort

~2 hours total: generator refactor ~30 min, component rewrite ~70 min (between-challenge phase + reset useEffect enumeration took the longest), metrics flattening ~5 min, catalog + tester wiring ~10 min. Faster than bar-model because the eval-hook migration was already complete (like tape-diagram), and faster than tape-diagram because the pool-service pattern is simpler than orchestrator-same-mode (no parallel Gemini fan-out logic).

### Open question resolution candidate

Open Question #1 ("session length cap, 12 phases at 4 instances may be too long") becomes a measurable thing once the manual UI walk happens. If 3 instances × 3 phases (≈ 3-5 minutes) feels right, the answer is **3 instances** for any 3-phase Bucket A primitive. If sessions feel too short, push to 4 and revisit.

---

## 6e. Area-model Post-Mortem (Workstream 3 entry #4) ✅ SHIPPED

### Why area-model fourth

§7 sequenced area-model fourth pending the Open Q #5 audit. Two signals triggered the pivot to ship now rather than continuing to `percent-bar`/`double-number-line`:

1. **User-observed regression.** "Try Another Problem" replayed the same factor pair — visible Bucket A bug where `handleReset` cleared local state without regenerating data. This is the exact failure mode the PRD's §1 evidence describes ("one composite, factored, done"), surfacing through a misleading UI affordance.
2. **Audit resolved Open Q #5 cleanly.** The "6-10 number pairs for variety" string in [gemini-area-model.ts:212](../service/math/gemini-area-model.ts) was a prompt-level randomization seed, not multi-instance output. Schema confirmed singular (`factor1Parts: number[]`, `factor2Parts: number[]` at root). Confirmed Bucket A, value-only — second pool-service entry in Workstream 3 after place-value-chart.

### What shipped (vs the §7 row)

| Plan (§7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Pool service** (value-only — operand pairs via `createOperandPairs`) | **Pool service** with per-mode operand generators (not `createOperandPairs`) — `buildModelOperands`, `findAreaOperands`, `perimeterOperands`, `multiplyOperands`, `factorOperands`. Each enforces mode-specific range + decomposition shape (e.g., `multiply` requires 3-part × 2-part, `perimeter` requires single-element parts). | `createOperandPairs` returns flat `{a, b, result}` tuples — area-model needs decomposition arrays (`[100, 40, 5]`) not single numbers, and each mode has wildly different shape constraints. Per-mode generators keep the logic local to each mode's pedagogy. |
| `challenges: AreaModelChallenge[]` (default 3-6) | `challenges: AreaModelChallenge[]`, default 3, max 6. Per-challenge owns its own `factor1Parts`, `factor2Parts`, `showPartialProducts`, `showDimensions`, `algebraicMode`, `highlightCell`, `labels?` — moved from session-level into the challenge. | Each mode toggles display flags differently; making them per-challenge lets a session mix difficulty within a mode (e.g., factor mode flips `showPartialProducts`/`showDimensions` vs find_area). |
| Stale-state guard per §6a #3 (effect-driven) | Guard in `completeCurrentChallenge` (handler-driven). Single predicate `stateMatchesChallenge` compares the active challenge's factor totals against derived `factor1Total`/`factor2Total`. Called from THREE separate submit handlers (`handleSumSubmit`, `handlePerimeterSubmit`, `handleFactorCheck`). | Area-model has 5 modes routed through 3 distinct completion paths (forward modes share `handleSumSubmit`). Per §6e #2 below, a single content-match predicate works as long as all modes share the same derived source-of-truth (`factor1Total`/`factor2Total` are computed from `currentChallenge` in every mode). |
| Evaluation: §6a #9 eval-hook migration | **Skipped (already done)**: area-model already used `usePrimitiveEvaluation` + `AreaModelMetrics`. Only the metrics shape needed work. | Pre-existing prior-pass migration, same as tape-diagram and place-value-chart. |
| Metrics: not explicitly scoped | **Flattened per §6a #11**: dropped 14 within-challenge fields (`targetProduct`, `studentProduct`, `correctFinalAnswer`, `totalPartialProducts`, `correctPartialProducts`, `incorrectPartialProducts`, `skippedPartialProducts`, `attemptedSum`, `correctSum`, `partialProductAccuracy`, `completedInOrder`, `attemptsPerCell`, `isAlgebraic`, `usedDistributiveProperty`) that were tautological at session level. New shape mirrors `BarModelMetrics` / `TapeDiagramMetrics` / `PlaceValueChartMetrics`. | The old metrics encoded one challenge's per-cell + sum state into session fields. After multi-instance, those measured the LAST challenge's state, not the session. |
| Tester wiring | **Updated**: previously the render case only passed `data` (no evaluation props). Now passes `instanceId`/`skillId`/`subskillId`/`objectiveId`/`onEvaluationSubmit`. Added new `result.metrics.type === 'area-model'` breakdown block. | Per §6a #10: registered-with-old-shape primitives need the full integration upgrade during refactor. |
| User-visible bug fix: not scoped in PRD | **"Try Another Problem" → `advance()`**: the button now advances to the next challenge instead of resetting local state on the same data. | This was the visible symptom that prompted the prioritization. The fix is structural — it's what `advance()` is for — but it's worth calling out as a pattern: any Bucket A primitive with a "Try Another" affordance has this same bug today. |

### Files changed

- [gemini-area-model.ts](../service/math/gemini-area-model.ts) — full rewrite around the pool service. Slim wrapper schema (Gemini emits title/description/grade only); per-mode operand generators (`buildModelOperands`, `findAreaOperands`, `perimeterOperands`, `multiplyOperands`, `factorOperands`) each enforce mode-specific range + decomposition shape; `decomposeByPlace` helper splits whole numbers into place-value parts; `canonKey` dedups operand pairs by sorted factor totals; `buildChallenges` assembles the final `AreaModelChallenge[]` with mode-appropriate display flags.
- [AreaModel.tsx](../primitives/visual-primitives/math/AreaModel.tsx) — full rewrite around `useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel`. New `AreaModelChallenge` exported and `AreaModelData` reshaped with `challenges[]` + session-level `challengeType`. Per-challenge reset useEffect resets sixteen state slots; handler-resident stale-state guard in `completeCurrentChallenge`. Between-challenge interstitial card with "Next Problem →" affordance (same pattern as place-value-chart `challenge-done` per §6d). Forward-mode (build_model/find_area/multiply) per-challenge scoring is weighted: 70% partial-product accuracy decayed by avg cell attempts + 30% sum-step decayed by sum attempts.
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `taskDescription` templates `{{totalChallenges}}` + `{{currentChallengeIndex}}` + `{{challengeType}}`; `contextKeys` adds `title`, `challengeType`, `currentChallengeIndex`, `totalChallenges`; `constraints` clarifies the manifest must NOT supply specific factor numbers, decompositions, or display flags; description rewritten to reflect multi-challenge sessions.
- [evaluation/types.ts](../evaluation/types.ts) — `AreaModelMetrics` flattened from 17 fields to 9 (mirrors `BarModelMetrics` / `TapeDiagramMetrics` / `PlaceValueChartMetrics`).
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — render case now passes evaluation props; added `result.metrics.type === 'area-model'` metrics-breakdown block per §6a #10.

### AreaModelMetrics shipped (post-flattening)

```ts
export interface AreaModelMetrics extends BasePrimitiveMetrics {
  type: 'area-model';
  challengeType: 'build_model' | 'find_area' | 'perimeter' | 'multiply' | 'factor';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;          // Total tries across all challenges
  firstTryCount: number;          // Challenges scoring 100 (perfect first attempt)
  hintsViewed: number;            // Challenges where the student opened a hint
  overallAccuracy: number;        // 0-100, average per-challenge score
  averageAttemptsPerChallenge: number;
}
```

### Lessons (additions to §6a)

#### §6e #1. "Try Another Problem" replay is the Bucket A tell

Any primitive whose post-completion button labeled "Try Another", "Next Problem", "New Question", etc. *resets local state without regenerating data* is Bucket A in disguise. The user can't tell the difference from a UI label, but the IRT signal is the same as the §1 evidence — one binary correct/incorrect per session, just with extra clicks. Refactor target audit: grep for `handleReset` / `setX(...)` / "Try Another" in any Bucket A candidate and verify whether the button calls `advance()` (multi-instance) or `setStateBackToInitial()` (replay-same-problem). If the latter, multi-instance refactor is overdue.

In area-model the previous `handleReset` ([AreaModel.tsx:427 pre-refactor](../primitives/visual-primitives/math/AreaModel.tsx)) cleared 14 local state slots and called `resetAttempt()`, but the `data` prop (which held `factor1Parts`/`factor2Parts`) never changed. The student got infinite identical replays of the same factor pair.

#### §6e #2. Single stale-state guard works across N submit handlers if they share derived state

§6a #8 ("handler-driven completion") implicitly assumed one submit handler per primitive. Area-model has THREE distinct submit paths (`handleSumSubmit` for forward modes, `handlePerimeterSubmit`, `handleFactorCheck`), but they all read the same derived `factor1Total`/`factor2Total` from `currentChallenge`. So a single predicate

```ts
const stateMatchesChallenge = (challenge) => {
  const expectedF1 = challenge.factor1Parts.reduce((s, v) => s + v, 0);
  const expectedF2 = challenge.factor2Parts.reduce((s, v) => s + v, 0);
  return expectedF1 === factor1Total && expectedF2 === factor2Total;
};
```

works for all three call sites. The principle: it's not "one guard per handler"; it's "one guard per derived-state-domain." If every submit handler reads from the same `useMemo`-derived values that depend on `currentChallenge`, one predicate suffices. If a primitive maintains multiple independent derived-state pipelines (e.g. one for free-text input, one for drag-drop), each gets its own predicate.

#### §6e #3. Forward-mode (multi-step) score formula extends §6a #11

The standard §6a #11 formula (`r.correct ? Math.max(20, 100 - (r.attempts - 1) * 20) : 0`) doesn't fit forward-mode area-model challenges where the work is split between per-cell calculation + a final sum step. Either step alone misses the picture. Shipped formula:

```ts
const avgCellAttempts = totalCells > 0 ? cellAttempts / totalCells : 1;
const cellComponent = partialAccuracy * phaseScore(Math.round(avgCellAttempts));
const sumComponent = phaseScore(nextSumAttempts);
const score = Math.round((cellComponent * 0.7) + (sumComponent * 0.3));
// + perfect-first-try short-circuit to 100 when no decay applied anywhere
```

70/30 split mirrors the original `submitForwardEvaluation` weighting (which §6a #11 was about flattening away — but the *per-challenge* weighting is the right level for it). Perimeter and factor modes use the plain `phaseScore(attempts)` from §6a #11 unchanged. The principle: §6a #11 is the default; multi-step challenges within one instance get a weighted variant, but only when the steps genuinely measure different skills.

#### §6e #4. Per-mode operand generators beat shared `createOperandPairs` when shapes diverge

`createOperandPairs` in [numberPoolService.ts](../service/math/numberPoolService.ts) returns `{a, b, result}` tuples — fine for arithmetic primitives. Area-model needs decomposition arrays (`[100, 40, 5]`) and each mode has fundamentally different shape requirements (perimeter forbids decomposition; multiply requires 3-part × 2-part minimum; factor requires 2-part × 2-part). Trying to bend `createOperandPairs` into producing these shapes would have meant a thicker post-processing layer than just writing 5 small operand generators in the generator file itself.

**Decision rule:** when per-mode shape constraints diverge by more than a single numeric range, write per-mode operand generators in the generator file. When they diverge only by `{min, max}`, use `createNumberPool`/`createOperandPairs` with per-mode config. Place-value-chart's `MODE_PROFILES` table is the latter pattern; area-model's `selectAreaModelOperands` switch is the former.

#### §6e #5. Bucket A refactors expose latent render-overflow bugs in their hardest mode

Discovered while running `/eval-test area-model` post-ship (AM-2). Multiply mode's per-mode operand generator (`multiplyOperands`) correctly produces 3-digit × 2-digit decompositions per the mode's β 3.5 difficulty (e.g., `[300, 70, 8] × [20, 3]`). The component sized cells with `Math.max(100, part * 8)px` — unbounded linear scaling that worked fine when Gemini stochastically picked smaller numbers in the singular regime, but breaks once the pool-service deterministically targets the mode's intended numeric range. The `300`-part cell rendered at **2400px** inside an `~1152px` container; the cell extended off-screen and was uninteractive. JSON validated `pass` — `/eval-test` cannot detect CSS overflow.

**Pattern:** any Bucket A → multi-instance refactor where the new per-mode operand generator targets the *full* numeric range of the mode (as it should — that's the whole point of pool services per §6a #1) can surface previously-dormant component sizing assumptions. The singular regime never stress-tested the upper end because Gemini's stochastic picks rarely hit it.

**Fix shape (area-model):** replaced unbounded linear sizing with bounded log-scaled helpers at module scope:

```ts
const cellWidthForPart = (part: number) =>
  Math.max(100, Math.log10(Math.max(1, part)) * 80 + 60);
const cellHeightForPart = (part: number) =>
  Math.max(80, Math.log10(Math.max(1, part)) * 60 + 50);
```

Log scale preserves the pedagogical "300-cell visibly wider than 8-cell" place-value cue (300 → 258px vs 8 → 100px) while staying inside the container. Floors at 100/80 — modes with parts < 50 (build_model, find_area, perimeter, factor) are byte-identical to pre-fix.

**Audit hook for remaining Workstream 3 refactors (percent-bar, double-number-line, function-machine):** after the refactor lands and eval-test passes JSON-wise, manually render the *hardest* eval mode at viewport scale before declaring done. Specifically: any component dimension or font size computed as a linear function of a generator-emitted numeric (`width: ${part * K}px`, `fontSize: ${value * K}px`, etc.) needs an upper bound. Search pattern in the touched component file: `Math\.max\([^,]+,\s*\w+\s*\*` — if the right operand of `*` is generator-supplied and unbounded, clamp it.

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (only pre-existing scratch-pad `PrimitiveRenderer` variance noise remains — AreaModel joins BarModel, PlaceValueChart, TapeDiagram, FactorTree in that list, expected per §6b/§6c/§6d) |
| `/eval-test area-model` across all 5 eval modes | ✅ All 5 pass (build_model, find_area, perimeter, multiply, factor — 2026-05-19). |
| Manual UI walk: pin `find_area`, finish 3 distinct factor pairs, verify "Next Problem →" advances (not replays) | ⏳ Owed |
| Manual UI walk: pin `multiply`, verify 3-part × 2-part decompositions render correctly on a 3×2 grid | ✅ AM-2 (render overflow) fixed 2026-05-19 — see §6e #5. Multi-digit factors now bounded; 3-part × 2-part grid fits container. UI walk still owed for interaction confirmation. |
| Manual UI walk: pin `factor`, verify partial products display + dimension inputs work across 3 distinct problems | ⏳ Owed |
| Manual UI walk: pin `perimeter`, verify 1×1 rectangle + perimeter input across 3 distinct rectangles | ⏳ Owed |
| Cost spot-check (1× per-session Gemini call — wrapper only, big savings vs orchestrator primitives) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors) |

### Actual effort

~2 hours total: generator refactor (per-mode operand generators) ~40 min, component rewrite ~60 min (the 16-slot reset useEffect and three-handler stale-state guard wiring took the longest), metrics flattening ~5 min, catalog + tester wiring ~10 min. Comparable to place-value-chart despite the higher mode count (5 vs 4), because most of the per-mode UI was already there — only the data shape and handlers needed restructuring.

### Open question resolution candidate

Workstream 3 entry #4 closes Open Q #5 ("area-model reality check"). Two questions remain open after this ship:

- **Q #1 (session length cap):** area-model's forward modes are single-phase per challenge (unlike place-value-chart's 3 phases), so 3 instances ≈ 3 minutes for find_area/perimeter, 5-6 minutes for multiply. Pilot at 3 instances looks correct; no abandonment risk. If find_area feels too short, bump to 4.
- **Q #7 (generalize selectFactorTreeRootValues):** with three pool-service entries shipped (factor-tree, place-value-chart, area-model), the per-mode selection logic is divergent enough that the abstraction probably isn't worth it. Each uses its own pool-shape: factor-tree picks from a fixed candidate set per mode; place-value-chart uses `createNumberPool` with `minNonZeroDigits`; area-model uses bespoke per-mode operand generators. Lock in the decision: keep them separate.

### Next steps (area-model + Workstream 3 carry-forward)

Ordered by blocking risk. Bold rows are blockers for declaring area-model fully done; non-bold rows are Workstream 3 carry-forward.

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **Manual UI walks for 4 modes** (find_area, factor, perimeter; multiply walk also outstanding for interaction confirmation despite AM-2 fix) | Eng | Per the §6e validation table. Pin each mode in the tester, complete 3 distinct challenges, confirm "Next Problem →" advances (not replays) and the summary panel aggregates correctly. |
| 2 | **Cost spot-check** for area-model (wrapper-only Gemini call) | Eng | Per §10 — pool-service primitives should land within 2× pre-refactor cost. Compare to factor-tree / place-value-chart baselines. |
| 3 | Render-overflow audit on remaining Workstream 3 primitives before they ship | Eng | New §6e #5 hook. Search each touched component file for `Math\.max\([^,]+,\s*\w+\s*\*` patterns where the multiplicand is generator-supplied; clamp or log-scale before declaring done. Cheap one-pass grep per file. |
| 4 | Workstream 3 entry #5: `percent-bar` + `double-number-line` refactor | Eng | Per §7 row + sequencing. Both orchestrator-mixed-type; `double-number-line` needs context-coherence enforcement (one ratio relationship per session, not flour→cookies then cars→hours). Lower K-3 priority — older grades. |
| 5 | ~~Workstream 3 entry #6: `function-machine` design discussion~~ ✅ **SHIPPED** | Product + Eng | Design question ("N rules vs N inputs") resolved in favor of N rules. See §6f. |
| 6 | Workstream 1 (prompt-floor sweep) | Eng | Still pending per the header status line. Fastest workstream by far — ~15 generator prompt edits, no schema changes. Could be parallelized with #4/#5 by a different owner. |
| 7 | Open Q #1 (session length cap) — pilot data | Product | Place-value-chart, area-model, and function-machine all shipped at 3 instances. Need to measure abandonment in production before bumping to 4. |
| 8 | Update CLAUDE.md / ADDING_PRIMITIVES.md | Eng | Per §9 Week 5. Require multi-instance schema for all new primitives. Add §6e #5's overflow-audit hook to the new-primitive checklist. |

---

## 6f. Function-machine Post-Mortem (Workstream 3 entry #6) ✅ SHIPPED

### Why function-machine before percent-bar / double-number-line

§7 sequenced function-machine sixth ("special case, design discussion first") and entry #5 (`percent-bar` + `double-number-line`) fifth. We jumped to #6 because the design discussion the §7 row blocked on resolved in ~5 minutes of audit, and the path forward was clear without product input. The two §7 row notes — "one rule with N inputs is *already* multi-instance practice" and "does a single mode visit N rules, or N inputs of one rule?" — turned out to be a false dichotomy that the rest of Workstream 3 had already resolved.

### Design resolution: N rules per session, not N inputs of one rule

The pre-refactor primitive had **two orthogonal multi-instance dimensions** layered on top of each other:

1. **Within-rule:** multiple inputs flow through one machine.
2. **Within-session:** a 4-phase in-component navigator (Observe → Predict → Discover → Create) walked the student through ALL four interaction shapes on the *same* rule.

The phase navigator's labels literally duplicated the eval-mode names (`observe`, `predict`, `discover_rule`, `create_rule`). Under the new IRT-pinned-per-session model (§6a #7), the engine picks one eval mode per render, so the in-component phase walk became:

- `discover_rule` session → 4 phases of which one is "discover" → 75% of session-time pedagogically wasted on phases the eval mode wasn't measuring.
- Single binary signal per session (did they discover the one rule), same Bucket A failure as factor-tree's §1 evidence.

**Resolution:** drop the in-component phase navigator entirely. Eval mode determines the single interaction shape; the session multiplies on rule count (3 rules per session). Multiple inputs *within* one rule is no longer the multi-instance signal — it's just the per-challenge interaction surface area, varying by mode.

### What shipped (vs the §7 row)

| Plan (§7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Pool service for inputs, orchestrator for rule descriptions** | **Pool service for everything** — Gemini emits only the session wrapper (title, description, challengeType, ruleComplexity, gradeBand, outputDisplay). Local `selectFunctionMachineRules` + `buildChallenges` deterministically pick 3 rules and assemble per-challenge `{id, rule, inputQueue, showRule}`. | Rule descriptions are 1-2 sentence session-level text, not per-rule per-challenge. The per-challenge data is value-only (a short rule string + input queue), so the pool-service pattern from factor-tree / place-value-chart / area-model applies uniformly. No orchestrator needed. |
| `rules: FunctionRule[]` (3-4 rules, multiple inputs each) | `challenges: FunctionMachineChallenge[]` (default 3, max 6). Each challenge owns `id`, `rule`, `inputQueue`, `showRule`. Multiple inputs persist as the within-challenge interaction. | Aligned naming with bar-model / tape-diagram / place-value-chart / area-model (`challenges` not `rules`) so the canonical multi-instance pattern in §8 stays uniform across primitives. |
| Phase navigator preserved (per the original 4-phase Component) | **Phase navigator dropped entirely.** Eval mode === interaction shape. | See "Design resolution" above. The 4-phase UI was a holdover from before eval-mode pinning. |
| Chaining (`chainedMachines`, `chainable`, `MachineConfig`) | **Dropped.** Catalog had no eval mode wired to chaining; the affordance was orphaned. | YAGNI — easier to reintroduce as its own challenge type later if a curriculum need surfaces. The PRD §10 "no regression" criterion is "all previously passing `/eval-test` runs still pass" — chaining wasn't in any eval mode. |
| Evaluation: not explicitly scoped | **Skipped (already done)**: function-machine already used `usePrimitiveEvaluation` + `FunctionMachineMetrics`. Only the metrics shape needed work. | Pre-existing prior-pass migration, same as tape-diagram, place-value-chart, and area-model. |
| Metrics: not explicitly scoped | **Flattened per §6a #11**: dropped 9 within-challenge fields (`functionRule`, `ruleDiscovered`, `inputsExplored`, `outputsObserved`, `attemptsToDiscover`, `hintsUsed`, `predictionsCorrect`, `predictionsTotal`, `phase`, `chainDepth`) that all measured one rule's exploration. New shape mirrors `BarModelMetrics` / `TapeDiagramMetrics` / `PlaceValueChartMetrics` / `AreaModelMetrics`. | The old metrics were per-rule. After multi-instance, they measured the LAST rule, not the session. |
| Tester wiring | **Updated**: render case previously only passed `data`. Now passes `instanceId`/`skillId`/`subskillId`/`objectiveId`/`onEvaluationSubmit`. Added new `result.metrics.type === 'function-machine'` breakdown block. | Per §6a #10. |

### Files changed

- [gemini-function-machine.ts](../service/math/gemini-function-machine.ts) — full rewrite around the pool service. Slim wrapper schema (Gemini emits title/description/challengeType/ruleComplexity/gradeBand/outputDisplay only). `RULE_POOLS` keyed by complexity (`oneStep` / `twoStep` / `expression`); `MODE_PROFILES` per challengeType drives `showRule` and the standard `inputQueue`. `selectFunctionMachineRules` filters for clean-integer-output rules and enforces operation-family variance.
- [FunctionMachine.tsx](../primitives/visual-primitives/math/FunctionMachine.tsx) — full rewrite around `useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel`. New `FunctionMachineChallenge` and `FunctionMachineChallengeType` exported; `FunctionMachineData` reshaped with `challenges[]` + session-level `challengeType`. Per-challenge reset useEffect resets thirteen state slots; handler-resident stale-state guard in `completeCurrentChallenge` (effect-driven for `predict`, handler-driven for the other three). Between-challenge interstitial card with "Next Function →" affordance (same pattern as place-value-chart's `challenge-done` and area-model's "Next Problem →"). Custom `getScore` averager for `usePhaseResults` since each mode produces a per-challenge score (predict by accuracy, discover/create by attempt-decay, observe by exposure count).
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `taskDescription` templates `{{title}}` + `{{challengeType}}` + `{{currentChallengeIndex}}` + `{{totalChallenges}}`; `contextKeys` updated; `constraints` clarifies the manifest must NOT supply specific rules, inputs, or numeric values; description rewritten to reflect multi-rule sessions and drop the dropped chaining feature; AI-directives section gets a new `MULTI-RULE PACING` entry that references the multi-challenge progress.
- [evaluation/types.ts](../evaluation/types.ts) — `FunctionMachineMetrics` flattened from 10 fields to 9 (mirrors `BarModelMetrics` / `TapeDiagramMetrics` / `PlaceValueChartMetrics` / `AreaModelMetrics`).
- [types.ts](../types.ts) — dropped `MachineConfig` re-export (chaining feature removed); added `FunctionMachineChallengeType` re-export.
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — render case now passes evaluation props; added `result.metrics.type === 'function-machine'` breakdown block per §6a #10.

### FunctionMachineMetrics shipped (post-flattening)

```ts
export interface FunctionMachineMetrics extends BasePrimitiveMetrics {
  type: 'function-machine';
  challengeType: 'observe' | 'predict' | 'discover_rule' | 'create_rule';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;          // Total tries across all challenges
  firstTryCount: number;          // Challenges scoring 100 (first-try correct)
  hintsViewed: number;            // Challenges where the student had multiple attempts
  overallAccuracy: number;        // 0-100, average per-challenge score
  averageAttemptsPerChallenge: number;
}
```

### Lessons (additions to §6a)

#### §6f #1. In-component phase navigators are a pre-eval-mode anti-pattern

When primitives were designed before eval-mode pinning, some authors built multi-stage UI flows that walked the student through all interaction shapes on one piece of content (here: 4 phases on one rule; conceptually similar in other primitives that have "Tour → Practice → Apply" or "Watch → Try" sequences in code). Post-eval-mode-pinning, these become double-counting:

- Eval mode picks one shape.
- The in-component navigator offers all four anyway.
- 75% of session-time is pedagogically off-mode.

**Audit hook for remaining refactors:** if a Bucket A primitive has an in-component `setPhase()` or `currentPhase` state that lets the student switch among interaction modes whose labels resemble the eval-mode names, drop the navigator. The eval mode IS the phase. This is a different pattern from within-challenge multi-phase flow (place-value-chart's identify → value → build, tape-diagram's explore → practice → apply): those are *sub-phases of one mode*, structurally beneath the eval mode, not parallel to it. The distinguishing test: does the navigator let the student switch *interaction shape* (which problem they're trying to solve), or only *which step* of the same problem they're working on? If shape — drop it; if step — keep it.

#### §6f #2. Effect-driven vs handler-driven completion: a primitive can be both

§6a #3 was effect-driven (factor-tree's "all leaves prime" completion check). §6a #8 was handler-driven (bar-model's submit button). Area-model and place-value-chart taught us the choice depends on the per-mode interaction. Function-machine has **three modes that use handler-driven completion** (`observe` "Continue" button, `discover_rule` / `create_rule` "Check" button) and **one mode that uses effect-driven completion** (`predict`, where the trigger is "all inputs from the queue have been processed and predicted").

Same primitive, different completion mechanism per mode. The stale-state guard pattern lives in the same shared `completeCurrentChallenge` helper, but the trigger sites differ:

- `observe`: explicit `completeObserve` callback bound to a button.
- `predict`: a `useEffect` that watches `availableInputs.length === 0 && predictionsTotal > 0 && processedPairs.length === currentChallenge.inputQueue.length`. The third clause is the content-match stale-state guard (§6a #3).
- `discover_rule` / `create_rule`: `checkRuleGuess` callback bound to the Check button.

**Pattern for §6a:** don't pick effect-or-handler per primitive; pick per mode. Centralize the recording (one `completeCurrentChallenge`) but let each mode declare its own trigger.

#### §6f #3. Pool-service variance enforcement extends beyond "odd/even"

Factor-tree (§6a #1) guaranteed variance by enforcing "≥1 odd composite." Place-value-chart and area-model used bespoke per-mode generators. Function-machine introduced **operation-family variance** — the pool has additive (`x+3`), multiplicative (`3*x`), two-step (`2*x+1`), and squared (`x^2`) rules. The selection algorithm picks the first member of each new family before back-filling, then force-swaps the last entry if everything ended up the same family.

```ts
const families = new Set<string>();
for (const rule of shuffled) {
  if (selected.length >= target) break;
  if (!families.has(ruleFamily(rule))) {
    selected.push(rule);
    families.add(ruleFamily(rule));
  }
}
// fill remaining slots, then force-swap if monoculture survived
```

**Generalization:** when the pool has structural variants beyond a single binary (odd/even), classify them and enforce one-per-family before filling. The "guarantee at least 2 families when the pool allows 2+" rule generalizes the factor-tree guarantee.

#### §6f #4. Filter the pool for clean outputs at generation time, not eval time

The rule pool is bigger than the eligible set. For a given input queue, some rules produce non-integer or large-magnitude outputs that are bad for the target grade band (e.g., `x/2` with inputs `[1, 2, 3, 4, 5]` produces decimals for half the inputs). The generator filters the pool to rules that yield clean integers ≤ |100| for the mode's standard input queue *before* random selection. If the eligible subset is too small for the target count, falls back to the full pool — never blocks generation.

```ts
const eligible = pool.filter((r) => ruleProducesCleanOutputs(r, profile.inputQueue));
const source = eligible.length >= target ? eligible : pool;
```

This is the function-machine analog to factor-tree's "is this composite in the candidate set" filter and area-model's per-mode operand-shape constraints. Each pool-service primitive needs a small validation predicate to keep generated content on-grade.

#### §6f #5. Dropping orphan features is part of the refactor

Function-machine had `chainable`, `chainedMachines`, and `MachineConfig` plumbed end-to-end (generator config, data type, UI render path, AI context keys) — but no eval mode used them. The refactor dropped all of it. **Audit hook:** when refactoring a Bucket A primitive, grep for feature flags / config fields that aren't referenced by any eval mode in the catalog. Those are usually pre-eval-mode design exploration that never landed in the IRT model. Dropping them simplifies the type surface and removes dead UI branches. If a curriculum need surfaces later, reintroduce as its own eval mode.

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (FunctionMachine joins BarModel / PlaceValueChart / TapeDiagram / FactorTree / AreaModel in the pre-existing scratch-pad `PrimitiveRenderer` variance noise list per §6e — expected). |
| `/eval-test function-machine` across all 4 eval modes | ⏳ Owed |
| Manual UI walk: pin `observe`, complete 3 rules with rule visible, verify "Next Function →" between rules | ⏳ Owed |
| Manual UI walk: pin `predict`, verify prediction-then-input flow across 3 rules, confirm session score equals avg per-rule accuracy | ⏳ Owed |
| Manual UI walk: pin `discover_rule`, hide rule, verify guess-input → reveal flow across 3 rules | ⏳ Owed |
| Manual UI walk: pin `create_rule`, verify pre-populated I/O table + symbolic rule entry across 3 rules | ⏳ Owed |
| Cost spot-check (1× per-session Gemini call — wrapper only, big savings vs orchestrator primitives) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors) |

### Actual effort

~2.5 hours total: generator refactor (rule pools + family-variance selector + clean-output filter) ~40 min, component rewrite ~75 min (the four mode-specific UI branches and the per-mode completion-trigger split took the longest), metrics flattening ~5 min, catalog rewrite ~10 min, tester wiring ~10 min, types.ts re-export update + typecheck cleanup ~10 min. Comparable to area-model. The mode-specific UI branching was the biggest single time sink — four modes × N UI elements each — but easier than expected because the old component's 4-phase code already had most of the per-mode rendering, just under the wrong control flow.

### Open question resolution

Workstream 3 entry #6 closes Open Q #4 ("function-machine-specific design"). Resolution: a single session visits **N distinct rules** of the SAME eval mode (the §7 row's first option). The other option ("N inputs of one rule") would have been a no-op because that's what the old singular-rule primitive already did — and that's what made it Bucket A.

### Next steps (function-machine + Workstream 3 carry-forward)

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **Manual UI walks for all 4 modes** | Eng | Per the §6f validation table. Pin each mode in the tester, complete 3 distinct rules, confirm "Next Function →" advances (not replays) and the summary panel aggregates correctly. |
| 2 | **Cost spot-check** for function-machine (wrapper-only Gemini call) | Eng | Per §10 — pool-service primitives should land within 2× pre-refactor cost. Compare to factor-tree / place-value-chart / area-model baselines. |
| 3 | Workstream 3 entry #5: `percent-bar` + `double-number-line` refactor | Eng | Per §7 row + sequencing. Both orchestrator-mixed-type; `double-number-line` needs context-coherence enforcement (one ratio relationship per session). Now the *only* remaining Workstream 3 entry. |
| 4 | Workstream 1 (prompt-floor sweep) | Eng | Still pending. Fastest workstream by far — ~15 generator prompt edits, no schema changes. |
| 5 | Update CLAUDE.md / ADDING_PRIMITIVES.md | Eng | Per §9 Week 5. Add §6f #1's phase-navigator audit hook + §6f #5's orphan-feature audit to the new-primitive checklist. |

---

## 6g. Ordinal-line Post-Mortem (Workstream 3 entry #7) ✅ SHIPPED

### Why ordinal-line — a primitive that was never in the original audit

Ordinal-line was not in §3's Bucket A or Bucket B tables. It was discovered as a Bucket A failure in production: a user pinned the **Identify (Scaffold 1)** mode in the tester and received exactly **one challenge** ("Tap the eighth one" → done) instead of a session. Eval report: [ordinal-line-2026-05-19.md](../../../../qa/eval-reports/ordinal-line-2026-05-19.md). This raises the audit lesson — see §3a — that the original buckets missed a third category: **B-mixed** (has `challenges: X[]`, but the generator's orchestrator emits ONE challenge per allowed challenge-type, so single-mode → 1 challenge).

### What shipped (vs the §3 / §6a #7 plan)

| Plan / pattern | What shipped | Why the deviation |
|---|---|---|
| Single-mode density via orchestrator-same-mode (§6a #7) | **Branch on `allowedTypes.size === 1`** in the public generator. Single-mode → pool-service / parallel-call builders; multi-mode → unchanged one-per-type orchestration (used by the tester preview). | The existing orchestrator was correct for *auto-mode preview* — it surfaces every challenge shape in one render, useful for development. Replacing it would have broken the tester. Branching preserved both paths. |
| Per-mode generation pattern (pool vs orchestrator) | **Five per-mode builders, mixed pattern:** `identify`, `match`, `relative-position`, `build-sequence` are pure pool-service (no Gemini per challenge — value-only data is built deterministically in code). `sequence-story` is orchestrator-mixed-type's small cousin: **N parallel Gemini calls with pre-randomized clue orderings** to defeat structured-output convergence (§6a #2). | The same primitive needed both patterns. The pedagogically interesting variance for 4/5 modes is value-only (which position, which (target, query) tuple, which subset of pairs). Only the story mode needs LLM-quality text — and even then, the *ordering* (which determines the story's content) is pre-randomized to force variance across the 4 stories. |
| Stale-state guard per §6a #3/#8 | **No new guard needed.** The component already has handler-driven completion (`handleCheckAnswer` → `recordResult`) and its existing `advanceToNextChallenge` resets all per-challenge state in the same handler. With multi-instance of the *same* type, the existing reset list is sufficient because the per-mode UI doesn't change between challenges. | The component was already wired for multi-instance via `useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel` — only the generator was singular. This made the fix unusually narrow. |
| Evaluation: §6a #9 eval-hook migration | **Skipped (already done)**: ordinal-line already used `usePrimitiveEvaluation` + `OrdinalLineMetrics`. Per-mode accuracy fields (`identifyAccuracy`, `matchAccuracy`, etc.) retained — in single-mode they populate exactly one field, in auto-mode preview they populate all five. Borderline §6a #11 (flatten) but not strictly tautological. | The PRD's standard 9-field flattened shape would lose per-mode signal in the auto-mode tester preview. Keeping the fields is harmless under single-mode IRT routing and useful elsewhere. |
| Tester wiring | **No change needed** — tester was already registered with the correct shape (passes `data` to a component that owns its own `usePrimitiveEvaluation` hook via internal `stableInstanceIdRef`). Different from bar-model / tape-diagram / etc., which needed §6a #10 retrofits. | Ordinal-line was registered correctly when it was first built. Confirmed via `/eval-test ordinal-line` — all 5 modes return 4 challenges with no integration changes. |

### Files changed

- [gemini-ordinal-line.ts](../service/math/gemini-ordinal-line.ts) — added the multi-instance builders section (`pickDistinctPositions`, `buildIdentifyChallenges`, `buildMatchChallenges`, `buildRelativeChallenges`, `buildBuildSequenceChallenges`, `buildStoryChallenges`, plus a focused `storySchema` and `generateStoryForOrdering` for per-call Gemini fan-out). The main `generateOrdinalLine` now branches on `allowedTypes.size === 1` before the orchestrator block.
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `taskDescription` now templates `{{totalChallenges}}` + `{{currentChallengeIndex}}`; `contextKeys` adds both. AI tutor now knows it's an N-problem session.
- **No component changes.** OrdinalLine.tsx was already structured around `useChallengeProgress`.

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean |
| `/eval-test ordinal-line` across all 5 eval modes | ✅ All 5 pass — `validation.challengeCount === 4` for every mode (identify, match, relative_position, sequence_story, build_sequence). See [ordinal-line-2026-05-19.md](../../../../qa/eval-reports/ordinal-line-2026-05-19.md) |
| Manual UI walk: pin `identify`, observe 4 distinct positions sequenced with PhaseSummaryPanel | ⏳ Owed |
| Manual UI walk: pin `sequence_story`, verify 4 distinct character orderings and 4 distinct stories | ⏳ Owed |
| Cost spot-check (1× Gemini call for setup + 4× parallel for sequence_story; pool-service modes are 1× total) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors) |

Latency observed in eval-test: pool-service modes ~1.4-1.8s end-to-end; sequence_story 2.7s (4 parallel Gemini calls — the slowest call sets the floor, not 4×).

### Actual effort

~45 minutes total: generator refactor ~30 min (pool-service builders + story fan-out), catalog tweaks ~5 min, eval-test verification ~10 min. Faster than the §7 estimate (~1.5 days/primitive) because (a) the component was already wired, (b) 4/5 modes have value-only data so no Gemini per challenge, and (c) the single-mode branch sits next to — not on top of — the existing orchestrator (no behavior change in auto-mode preview).

### Lessons (additions to §6a)

#### §6g #1. The third Bucket — "B-mixed orchestrator emits one-per-type"

§3's original buckets were:
- **Bucket A** — schema has no `challenges: X[]` field (singular).
- **Bucket B** — schema has `challenges: X[]`, prompt asks for 2-3 (stingy).
- **Bucket C** — schema has `challenges: X[]`, prompt asks for 4+ (healthy).

Ordinal-line was none of these. Its schema has `challenges: OrdinalLineChallenge[]` (so not Bucket A), and its prompt didn't have an instance-count floor at all (so not Bucket B). The generator orchestrated one call per allowed *challenge type* — which produces a healthy 5-challenge session in auto-mode preview but degenerates to **1 challenge in single-mode** (because allowedTypes has size 1).

**The missing bucket — call it B-mixed** — is a multi-instance schema with a mixed-type orchestrator. It looks fine in auto-mode preview and looks broken in single-mode production. The original §3 audit missed it because it surveyed schemas and prompts, not the orchestration shape. The §3a audit (this PRD revision) corrects that omission by also checking what each generator emits when `allowedTypes.size === 1`.

#### §6g #2. Pool-service can be the right answer for *most* modes of a content-bearing primitive

Earlier ship lessons treated the pool-vs-orchestrator decision as primitive-level (§6a #1). Ordinal-line shows it can be **mode-level**. Four modes (identify, match, relative-position, build-sequence) have value-only per-challenge data and ship as pool-service. One mode (sequence-story) has content-bearing per-challenge data and ships as orchestrator (parallel calls with pre-randomized clue orderings).

The cost asymmetry is real: pool-service modes do 1 Gemini call total per session (setup only). The story mode does 5 (setup + 4 parallel). The asymmetric pattern stays within §10's "pool-service primitives within 2× previous cost" criterion for 4/5 modes and within "orchestrator within N×" for the fifth. Don't force one pattern across all modes of a primitive — pick per mode.

#### §6g #3. Pre-randomization is how you defeat structured-output convergence on *non-numeric* fields

§6a #2 noted that structured-output Gemini ignores temperature for numeric/categorical values. Sequence-story extends this to **structured assignment data**: when the schema requires a `clues: [{character, position}]` array, Gemini will deterministically pick the natural left-to-right ordering on every call, even with temperature 0.9.

The fix: pre-randomize the *assignment* (which character goes in which position) before each call, and inject the ordering as a mandatory constraint in the prompt. Gemini then writes a story matching that ordering. Variance comes from the four pre-shuffled orderings, not from prompt phrasing.

This generalizes: any time a per-challenge field is a mapping/assignment between fixed sets (characters↔positions, words↔definitions, equations↔contexts), pre-shuffle the assignment in code, inject it as a constraint, and let Gemini write the prose. Don't ask Gemini to "vary the orderings" — it won't.

#### §6g #4. When the component is already correctly wired, only the generator changes

Ordinal-line's component was the first Workstream 3 entry where **zero component code changed**. The §6a checklist (per-challenge reset useEffect, stale-state guard, metrics flattening, tester wiring) is mandatory only for primitives whose component was originally built for a singular schema. Pre-built multi-instance components (like ordinal-line's) make the refactor a generator-only patch — under an hour total.

**Audit hook:** before scoping a Bucket B-mixed refactor, check whether the component already uses `useChallengeProgress` + `usePhaseResults`. If yes, scope the work as "generator only" and budget hours, not days. If no, scope as a full §6a refactor.

### Next steps (ordinal-line + Workstream 3 carry-forward)

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **Manual UI walks for all 5 modes** | Eng | Per §6g validation table. Confirm sequence-story renders all 4 stories with their distinct orderings; confirm pool-service modes show ≥3 distinct values across challenges. |
| 2 | Apply §3a audit findings to remaining unlisted Bucket A primitives | Eng | array-grid ✅ shipped (§6h). fraction-bar ✅ shipped. strategy-picker still pending — schema refactor per the orchestrator-same-mode / pool-service decision rule (§6a #1). |
| 3 | Workstream 3 entry #5: `percent-bar` + `double-number-line` refactor | Eng | Unchanged — still the *originally-listed* remaining Workstream 3 entry. |
| 4 | Workstream 1 (prompt-floor sweep) | Eng | Still pending. |
| 5 | Audit Bucket B-mixed across literacy primitives | Eng | §6g #1's bucket likely exists outside math too. Any primitive whose generator orchestrates one-call-per-challenge-type is suspect under single-mode IRT routing. |

---

## 6h. Array-grid Post-Mortem (Workstream 3 entry #8) ✅ SHIPPED

### Why array-grid next

§3a flagged three new Bucket A entries — array-grid, fraction-bar, strategy-picker. Array-grid went first because (a) §3a explicitly predicted "likely the easiest of the new Bucket A entries" (value-only per-challenge data, no decomposition shape constraints), (b) the singular schema was the simplest yet — literally two integer fields `targetRows`/`targetColumns`, no nested per-mode dispatch — making the pool-service refactor near-mechanical, and (c) it sits in the K-2 multiplication-intro pedagogy slot where the §1 "demo session" failure mode is most visible (build a 3×5 array once → "done").

### What shipped (vs the §7 / §3a row)

| Plan (§7 / §3a row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Pool service** (operand pairs via `createOperandPairs` or per-mode generator like area-model) | **Pool service** with per-mode `dimensionRangeFor` switch — `(rowMin, rowMax, colMin, colMax)` tuple per challengeType, then `selectDimensionPairs` randInts within range, dedup by canonical (small, large) key, skip squares. | `createOperandPairs` returns `{a, b, result}` shapes — array-grid only needs `(rows, columns)`. The per-mode range table is shorter than wiring through the operand-pair helper. Same call as area-model (§6e #4) — per-mode shape constraints diverge enough (different col/row ranges per mode) that a local switch beats sharing. |
| `challenges: ArrayGridChallenge[]` (default 3-6) | `challenges: ArrayGridChallenge[]`, default **4**, max 6. Per-challenge owns `{ id, targetRows, targetColumns }`. Display flags (`iconType`, `showLabels`, `maxRows`, `maxColumns`) stay session-level. | The session-level defaults from the original singular schema were already correct for multi-challenge — same icon across the session is a feature, not a bug. Defaulted to 4 (§5 floor) instead of place-value-chart's 3, because each array challenge is a single-phase interaction (~30s), not 3-phase like place-value-chart. 4 × 30s = ~2 min target session length. |
| Stale-state guard per §6a #3 / §6a #8 | Guard in `completeCurrentChallenge` (handler-driven). The match predicate is **mode-aware**: for pre-built modes (count_array / multiply_array), match on `currentRows === target && currentColumns === target` (the reset effect sets these to target dims). For build_array, the student-built dims can legitimately disagree with target dims, so the guard is a no-op — `recordedRef.current` is sufficient. | First primitive in Workstream 3 where the guard predicate had to branch by mode. Pre-built modes have an unambiguous content match (the array dims); build mode doesn't (student is mid-build). Documented in §6h #2 below. |
| Evaluation: §6a #9 eval-hook migration | **Skipped (already done)**: array-grid already used `usePrimitiveEvaluation` + `ArrayGridMetrics`. Only the metrics shape needed work. | Pre-existing prior-pass migration, same as tape-diagram / place-value-chart / area-model / function-machine. The eval-hook migration appears to have happened in a batch across the math primitives some time before this PRD, leaving only the multi-instance + metrics-flattening work for the Workstream 3 refactors. |
| Metrics: not explicitly scoped | **Flattened per §6a #11**: dropped 15 within-challenge fields (`taskType`, `goalMet`, `finalRows`, `finalColumns`, `totalItems`, `targetProduct`, `productCorrect`, `dimensionsCorrect`, `commuteRecognized`, `partitionsPlaced`, `correctPartitions`, `partitionAccuracy`, `skipCountSequence`, `skipCountCorrect`, `rowChanges`, `columnChanges`, `cellClicks`, `partitionAttempts`, `finalConfiguration`). New shape mirrors `BarModelMetrics` / `TapeDiagramMetrics` / `PlaceValueChartMetrics` / `AreaModelMetrics` / `FunctionMachineMetrics`. | The old metrics encoded ONE array's state into session-level fields, plus several `partition`/`skip-count` fields that never had an eval mode wired (orphan features per §6f #5). After multi-instance, those fields measured the LAST array, and the orphan-feature fields were dead. |
| Tester wiring | **Render case unchanged** (was already passing eval props). **Added new `result.metrics.type === 'array-grid'` breakdown block** in the results panel — previously absent (per §6a #10 the "previously-registered with old shape, no breakdown block" case). | Same metrics-display shape as area-model / function-machine — mode + correct/total + first-try + attempts + avg + hints + accuracy. |

### Files changed

- [gemini-array-grid.ts](../service/math/gemini-array-grid.ts) — full rewrite around the pool service. Slim wrapper schema (Gemini emits title/description/challengeType/iconType/gradeLevel only). `dimensionRangeFor` per challengeType drives the row/col ranges. `selectDimensionPairs` uses `randInt` + canonical-key dedup + skip-squares heuristic to produce N distinct pairs; falls back to accepting duplicates rather than blocking generation. `buildChallenges` maps pairs to `ArrayGridChallenge[]`.
- [ArrayGrid.tsx](../primitives/visual-primitives/math/ArrayGrid.tsx) — full rewrite around `useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel`. New `ArrayGridChallenge`, `ArrayGridChallengeType`, `ArrayGridIconType` exported; `ArrayGridData` reshaped with `challenges[]` + session-level `challengeType`. Per-challenge reset useEffect resets eight state slots; mode-aware handler-resident stale-state guard in `completeCurrentChallenge`. Between-challenge interstitial card with "Next Array →" affordance (same pattern as place-value-chart's `challenge-done` and area-model's "Next Problem →"). Replaced custom div-based UI with `Card` / `CardHeader` / `Badge` / `Button` shadcn primitives per CLAUDE.md Lumina theming pattern.
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `taskDescription` templates `{{challengeType}}` + `{{totalChallenges}}` + `{{currentChallengeIndex}}`; `contextKeys` adds session-level keys; `constraints` clarifies the manifest must NOT supply specific row/column counts; description rewritten to reflect multi-array sessions; new `MULTI-ARRAY PACING` aiDirective.
- [evaluation/types.ts](../evaluation/types.ts) — `ArrayGridMetrics` flattened from 19 fields to 9 (mirrors `BarModelMetrics` / `TapeDiagramMetrics` / `PlaceValueChartMetrics` / `AreaModelMetrics` / `FunctionMachineMetrics`).
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — added `result.metrics.type === 'array-grid'` metrics-breakdown block per §6a #10.

### ArrayGridMetrics shipped (post-flattening)

```ts
export interface ArrayGridMetrics extends BasePrimitiveMetrics {
  type: 'array-grid';
  challengeType: 'build_array' | 'count_array' | 'multiply_array';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;          // Total tries across all challenges
  firstTryCount: number;          // Challenges scoring 100 (first-try correct)
  hintsViewed: number;
  overallAccuracy: number;        // 0-100, average per-challenge score
  averageAttemptsPerChallenge: number;
}
```

### Lessons (additions to §6a)

#### §6h #1. Reaching for `createOperandPairs` is usually a mistake when the value type is just `(a, b)`

`createOperandPairs` from [numberPoolService.ts](../service/math/numberPoolService.ts) was originally designed for arithmetic primitives where the third field (`result`) carries pedagogical meaning. Array-grid (and percent-bar / double-number-line, when their turn comes) only need a pair — the "result" is computed locally from the pair. Writing a 5-line per-mode range table + `randInt` + dedup is shorter than wiring through `createOperandPairs`'s configuration surface, and it keeps mode-specific constraints (no squares for array-grid; coprime requirements for double-number-line; etc.) co-located with the generator that uses them.

**Generalization of §6e #4:** the threshold for using a shared pool helper isn't "is the value type the same" — it's "is the *constraint shape* the same." `createNumberPool` works because every primitive that uses it agrees on the constraint shape `{ min, max, count, ...filters }`. `createOperandPairs` works for arithmetic primitives because they agree on `{a, b, result}`. Once a primitive needs mode-specific shape constraints, a local generator beats the shared helper.

#### §6h #2. Stale-state-guard predicates must branch by mode when one mode has no content match

§6a #8 ("handler-driven completion: stale-state guard lives in submit") and §6e #2 ("single guard works across N handlers if they share derived state") both assumed the guard predicate could be a single content-match expression. Array-grid showed a third case: a primitive where some modes have a content match and others don't.

- **count_array / multiply_array (pre-built):** the reset effect sets `currentRows = target.rows`, `currentColumns = target.cols`. So at any moment, `currentRows === currentChallenge.targetRows` AND `currentColumns === currentChallenge.targetColumns` if and only if the reset effect has run for this challenge. Strong content match.
- **build_array:** the student starts at `currentRows = 0, currentColumns = 0` and incrementally builds to target. Mid-build, the student's dims legitimately disagree with target — that's the whole point of the mode. There is no content field to match against; the active challenge IS the only challenge until `recordResult` fires for it.

**Resolution:** branch the guard predicate:

```ts
const stateMatchesChallenge = useCallback(
  (challenge: ArrayGridChallenge | null): boolean => {
    if (!challenge) return false;
    if (isPreBuilt) {
      return (
        currentRows === challenge.targetRows &&
        currentColumns === challenge.targetColumns
      );
    }
    // Build mode has no content match; recordedRef alone is sufficient.
    return true;
  },
  [isPreBuilt, currentRows, currentColumns],
);
```

**Generalization:** the stale-state guard's strength scales with the per-challenge content-match surface. When the primitive has handler-driven completion AND the per-challenge state mid-interaction can legitimately diverge from target state, the guard reduces to `recordedRef.current` only — but the reset effect must reset that ref on `currentChallenge.id` change, otherwise the next challenge can never record a result.

#### §6h #3. Orphan task-type fields are a tell for skipped multi-instance refactors

The old `ArrayGridMetrics.taskType` enum had six values: `'build' | 'count' | 'multiply' | 'partition' | 'skip-count' | 'explore'`. Only three (`build` / `count` / `multiply`) corresponded to actual eval modes. Three (`partition` / `skip-count` / `explore`) had partition-related and skip-count-related sibling metric fields, but no eval mode wired in the catalog. This is the same anti-pattern as function-machine's `chainable` / `chainedMachines` (§6f #5) — features explored in metrics but never plumbed into IRT routing.

**Audit hook for remaining Bucket A primitives:** before scoping the refactor, grep the existing `XxxMetrics` interface for enum members or optional fields whose names don't appear in any catalog eval mode for that primitive. They're orphans. Drop them as part of the flattening; if a curriculum need surfaces later, reintroduce as a real eval mode + matching metric.

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (ArrayGrid joins BarModel / PlaceValueChart / TapeDiagram / FactorTree / AreaModel / FunctionMachine in the pre-existing scratch-pad `PrimitiveRenderer` variance noise list per §6e — expected). |
| `/eval-test array-grid` across all 3 eval modes | ⏳ Owed |
| Manual UI walk: pin `build_array`, finish 4 distinct dimension pairs, observe `PhaseSummaryPanel` + "Next Array →" advances | ⏳ Owed |
| Manual UI walk: pin `count_array`, verify pre-built grids render correctly and stale-state guard prevents phantom records on advance | ⏳ Owed |
| Manual UI walk: pin `multiply_array`, verify three-input multiplication-sentence flow across 4 arrays | ⏳ Owed |
| Cost spot-check (1× per-session Gemini call — wrapper only, big savings vs orchestrator primitives) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors) |

### Actual effort

~1.5 hours total: generator refactor ~25 min (`dimensionRangeFor` + `selectDimensionPairs` + canonical-key dedup), component rewrite ~50 min (the per-challenge reset useEffect + mode-aware guard predicate + interstitial wiring), metrics flattening ~5 min, catalog tweaks ~10 min, tester metrics-breakdown block ~5 min. **Confirmed §3a's "easiest of the new Bucket A entries" prediction** — faster than place-value-chart, area-model, function-machine. The single-phase per-challenge interaction (no within-challenge sub-phases like place-value-chart's identify → value → build, or area-model's per-cell → sum) is the simplifier: only one `attempts` counter per challenge, the §6a #11 standard score formula applies directly without modification.

### Next steps (array-grid + Workstream 3 carry-forward)

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **Manual UI walks for all 3 modes** | Eng | Per §6h validation table. Pin each mode in the tester, complete 4 distinct dimension pairs, confirm "Next Array →" advances (not replays) and the summary panel aggregates correctly. |
| 2 | **Cost spot-check** for array-grid (wrapper-only Gemini call) | Eng | Per §10 — pool-service primitives should land within 2× pre-refactor cost. Compare to factor-tree / place-value-chart / area-model / function-machine baselines. |
| 3 | Workstream 3 entry #5: `percent-bar` + `double-number-line` refactor | Eng | Still the *originally-listed* remaining Workstream 3 entry. Both orchestrator-mixed-type. `double-number-line` needs context-coherence enforcement. |
| 4 | ~~Workstream 3: `fraction-bar` refactor~~ | Eng | ✅ **SHIPPED** — see §7. All four modes (identify, build, compare, add_subtract) turned out to be value-only — per-challenge data is `(numerator, denominator)` plus locally-shuffled MC choice arrays. Same pool-service pattern as area-model / array-grid (per-mode operand generator, no orchestrator needed). |
| 5 | Workstream 3: `strategy-picker` refactor | Eng | Newly identified via §3a — Bucket B-single (`challengeCount=1`). Audit before scoping (could be a one-line prompt bump if the orchestration shape allows). |
| 6 | Workstream 1 (prompt-floor sweep) | Eng | Still pending. |

---

## 7. Workstream 3: Apply Template to Remaining Bucket A Primitives

After `factor-tree` establishes the pattern, apply to:

| Primitive | Singular field today | Refactor target | Generation pattern (per §6a #1) | Notes |
|-----------|----------------------|-----------------|---------------------------------|-------|
| `tape-diagram` ✅ **SHIPPED** | ~~`wordProblem`, `part1/2/3Value/Label`~~ → `challenges: TapeDiagramChallenge[]` (default 4, max 6) | Shipped | **Orchestrator-same-mode** (per §6a #7) — N parallel calls of the per-mode sub-generator. See §6c for ship details. Pattern matched bar-model: internal per-mode dispatch existed, so same-mode reduction applied. |
| `bar-model` ✅ **SHIPPED** | ~~`challenge?: BarModelChallenge`~~ → `challenges: BarModelChallenge[]` (default 4, max 6) | Shipped | **Orchestrator-same-mode** (per §6a #7) — N parallel calls of the per-mode sub-generator. See §6b for ship details. |
| `place-value-chart` ✅ **SHIPPED** | ~~`targetNumber`~~ → `challenges: PlaceValueChartChallenge[]` (default 3, max 6 per §6d pilot decision) | Shipped | **Pool service** (value-only — leverages existing `createNumberPool` per [NUMBER_POOL_SERVICE.md](../service/math/NUMBER_POOL_SERVICE.md)) | Shipped. See §6d for ship details. Pilot at 3 instances. New within-challenge "challenge-done" phase with explicit "Next Number" affordance — candidate pattern for other multi-phase primitives. |
| `percent-bar` | single `scenario`/`challengeType` | `challenges: PercentBarChallenge[]` | **Orchestrator** | Each challenge has its own scenario context (e.g. "tip on a meal", "discount on a jacket"). |
| `double-number-line` | single `contextQuestion`/labels | `challenges: DoubleNumberLineChallenge[]` | **Orchestrator** | Each challenge gets its own ratio relationship + context. Keep `topLabel`/`bottomLabel` consistent within a session for coherence (e.g. all flour→cookies, not flour→cookies then cars→hours). |
| `area-model` ✅ **SHIPPED** | ~~singular `factor1Parts`/`factor2Parts`~~ → `challenges: AreaModelChallenge[]` (default 3, max 6) | Shipped | **Pool service** (value-only — local per-mode operand generators in [gemini-area-model.ts](../service/math/gemini-area-model.ts)) | Shipped. See §6e for ship details. Audit resolved Open Q #5: was confirmed Bucket A (the "6-10 number pairs" was prompt-level seed for ONE call, not a multi-instance array). User-visible "Try Another Problem replays the same problem" bug fixed by replacing reset-local-state with `advance()`. |
| `function-machine` ✅ **SHIPPED** | ~~single `rule` with multiple inputs~~ → `challenges: FunctionMachineChallenge[]` (default 3, max 6) | Shipped | **Pool service** (value-only — local `selectFunctionMachineRules` in [gemini-function-machine.ts](../service/math/gemini-function-machine.ts)) | Shipped. See §6f for ship details. Design Q resolved: N rules per session (not N inputs of one rule). Dropped the in-component 4-phase navigator — eval mode === interaction shape (§6f #1). Dropped orphan chaining feature (§6f #5). |
| `ordinal-line` ✅ **SHIPPED** | ~~Bucket B-mixed: orchestrator emitted one challenge per allowed type → 1 challenge in single-mode~~ → branches on `allowedTypes.size === 1` and builds 4 distinct instances of the pinned type | Shipped | **Pool service** for 4 modes (identify, match, relative-position, build-sequence) + **orchestrator (parallel calls with pre-randomized clue orderings)** for sequence-story | Shipped 2026-05-19. See §6g for ship details. **Not in the original §3 audit** — surfaced as the third bucket (B-mixed) via user report. Component required zero changes (already wired to `useChallengeProgress`). |
| `array-grid` ✅ **SHIPPED** | ~~Bucket A (§3a new) — singular `targetRows`/`targetColumns`~~ → `challenges: ArrayGridChallenge[]` (default 4, max 6) | Shipped | **Pool service** (value-only — local per-mode dimension generators in [gemini-array-grid.ts](../service/math/gemini-array-grid.ts)) | Shipped 2026-05-19. See §6h. Confirmed the §3a prediction — "likely the easiest of the new Bucket A entries." Pool-service pattern matched factor-tree / place-value-chart / area-model. |
| `fraction-bar` ✅ **SHIPPED** | ~~Bucket A (§3a new) — singular `numerator` / `denominator`~~ → `challenges: FractionBarChallenge[]` (default 3, max 6) | Shipped | **Pool service** (value-only — local per-mode operand generators in [gemini-fraction-bar.ts](../service/math/gemini-fraction-bar.ts)) | Shipped 2026-05-19. Per-§3a prediction we expected per-mode shape divergence, but in practice all four modes (identify, build, compare, add_subtract) only differ in operand difficulty — the within-challenge interaction shape is identical (numerator MC → denominator MC → shade bar). So a single per-mode operand generator + local MC distractor builder was sufficient; no per-mode UI dispatch needed. Same pool-service template as area-model / array-grid. |
| `strategy-picker` | **Bucket B-single** (§3a new) — `challenges[]` exists but generator emits exactly one | bump generator to pre-select N distinct equations per mode | **Pool service** (equations) | Newly identified in §3a re-audit. `challengeCount=1` not 0 — could be a one-line prompt bump if the orchestration shape allows it, or a small refactor. Audit before scoping. |

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
2. ~~`tape-diagram` — workhorse for word-problem standards (2.OA, 2.MD, 3.MD)~~ ✅ **SHIPPED** — Orchestrator-same-mode pattern matched bar-model. See §6c.
3. ~~`place-value-chart` — workhorse for place-value standards (K-5 NBT). Pool-service pattern; pilot at 3 instances per Open Q #1.~~ ✅ **SHIPPED** — first pool-service entry in Workstream 3. See §6d.
4. ~~`area-model` — multiplication structure (3-5). Audit first per Open Question #5 — may already be plural.~~ ✅ **SHIPPED** — second pool-service entry. Audit resolved Open Q #5 (confirmed Bucket A). See §6e.
5. `percent-bar`, `double-number-line` — older grades, lower K-3 priority. Both orchestrator-mixed-type; double-number-line needs context coherence enforcement.
6. ~~`function-machine` — special case, design discussion first.~~ ✅ **SHIPPED** — third pool-service entry. Design Q resolved: N rules per session. See §6f.
7. ~~`ordinal-line` — K-1 number sense. Discovered as Bucket B-mixed in production after the original §3 audit.~~ ✅ **SHIPPED 2026-05-19** — mixed-pattern primitive (pool-service for 4 modes, orchestrator for sequence-story). See §6g.
8. ~~`array-grid` — K-2 multiplication intro. Newly identified via §3a re-audit; pool-service, value-only.~~ ✅ **SHIPPED 2026-05-19** — fourth pool-service entry in Workstream 3. See §6h.
9. ~~`fraction-bar` — elementary fraction introduction (2-6). Newly identified via §3a re-audit; pool-service, value-only across all four modes.~~ ✅ **SHIPPED 2026-05-19** — fifth pool-service entry. Per-mode operand generators + local MC distractor builder; component refactored to walk N fractions sequentially via `useChallengeProgress`. `strategy-picker` remains on backlog.

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
| Week 3 (revised) | `bar-model` ✅ SHIPPED (see §6b) · `tape-diagram` ✅ SHIPPED (see §6c) · `place-value-chart` ✅ SHIPPED (see §6d) |
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
4. ~~**`function-machine`-specific design.** Is one rule with N inputs already a "multi-instance" session? Or should a single mode visit N rules? Discussion needed before refactor.~~ **Resolved (2026-05-19, §6f):** N rules per session of the SAME eval mode. "N inputs of one rule" was what the pre-refactor primitive already did — and that's what made it Bucket A. Dropped the in-component 4-phase navigator (eval mode === interaction shape) and the orphan chaining feature.
5. ~~**`area-model` reality check.** Prompt at [gemini-area-model.ts:212](../service/math/gemini-area-model.ts#L212) mentions "6-10 number pairs for variety" — is this primitive already in Bucket B (just with weird wording), or is it generating 6-10 cells *within one* multiplication? Audit before scoping.~~ **Resolved (2026-05-19, §6e):** confirmed Bucket A. The "6-10 number pairs" was a prompt-level randomization seed for ONE Gemini call ([gemini-area-model.ts:212-220](../service/math/gemini-area-model.ts) pre-refactor) — Gemini still emitted one `factor1Parts`/`factor2Parts` pair per response. Component-side "Try Another Problem" reset local state without re-generating, replaying the same problem (user-observed bug). Refactored to pool-service multi-instance per §6e.
6. **K-3 only, or all-math sweep?** This PRD scopes K-3 but the Workstream 1 fix applies trivially to all-math (it's just edit-the-floor). Recommendation: do Workstream 1 across all math; scope Workstreams 2-3 to K-3 explicitly.
7. **(New, from pilot)** Should `selectFactorTreeRootValues` be generalized into the shared `numberPoolService` as a `createCandidateSetPool({ candidates, count, varianceGuarantees })` helper? Workstream 3 has two more value-only primitives (`place-value-chart`, `area-model`) — if their selection logic looks similar, generalize after the second use, not before.
