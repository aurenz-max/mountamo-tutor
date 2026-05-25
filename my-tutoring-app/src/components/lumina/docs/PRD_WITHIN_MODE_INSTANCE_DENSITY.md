# PRD: Within-Mode Instance Density — From Demo Sessions to Mastery Sessions

**Status (as of 2026-05-23):**
- **Workstream 2** (factor-tree pilot, §6) — ✅ shipped.
- **Workstream 3** (Bucket A schema refactors, §7) — 17 of 18 shipped: bar-model, tape-diagram, place-value-chart, area-model, function-machine, ordinal-line, array-grid, fraction-bar, function-sketch, balance-scale, measurement-tools, slope-triangle, matrix, **histogram (§6o, 2026-05-22)**, **systems-equations (§6p, 2026-05-23)**, **percent-bar (§6q, 2026-05-23)**, **double-number-line (§6r, 2026-05-23)**. **Only remaining:** `two-way-table` (upper-grade, deferred). The mid-grade Bucket A queue is closed. Strategy-picker (Bucket B-single) re-verified 2026-05-23 — `challengeCount=4` for `guided`, structurally healthy; one component-side answer-leak issue (STP-6, `TallyViz` / `DoublesViz` printing the sum as a text label) surfaced and fixed in `StrategyPicker.tsx`.
- **Workstream 1** (Bucket B prompt-floor sweep + §6n 3-point audit, §5) — 6 of ~18 generators have the prompt floor at 4-6; pattern-builder is the only one with the full §6n audit applied. **Now the highest-priority remaining queue** post-A1/A2 ship. Remaining: see §5 table.
- **Audits feeding the backlog:** §3a (2026-05-19 runtime `validation.challengeCount`) and §3b (2026-05-20 full-folder static-scan) are both closed. Strategy-picker re-verification (§3a stale row) done — see status above.
- **Latest lessons** (§6o-§6r, 2026-05-22 / 2026-05-23): pool-service variance scales hierarchically — from numeric values (factor-tree) to operation families (function-machine) to *distribution shapes* (histogram) to *template-bearing scenarios* (percent-bar §6q #3) to *LLM-supplied scenario + locally-derived ask-point pools* (double-number-line §6r #1, the hybrid pattern). Mode-specific answer-leak gating is now a required audit step for any visualization-shaped refactor (§6o #2). Back-solving from the integer answer beats forward-search rejection sampling whenever per-challenge data must satisfy a *constraint that depends on the answer* (§6p #1, generalized in §6r #2 as "enforce structural constraints via code, not prompts"); dual-form representations let one canvas drive multiple display modes without parse-at-render foot-guns (§6p #2). Net-new evaluation wiring is now mechanical — the 5-step checklist (§6p #3) is stable. Per-mode `targetPercent` / answer derivation IS the eval-mode pedagogical distinction (§6q #1); bar-only and other input-constrained primitives force mode-framing audits before pool authoring (§6q #2). Last-state-only metrics arrays (`pointResults[]`, per-phase fields) are deadweight — collapse to canonical 9-field aggregates per §6r #3 / §6q #4. Pre-existing tester gaps where `supportsEvaluation: true` meets a bare render case are a §5 rule 21 audit candidate primitive-wide (§6r #4).

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

**Additional Bucket A entries identified by §3b static-scan (2026-05-20):**

| Primitive | Generator | Shape | Grade band |
|-----------|-----------|-------|------------|
| ~~`function-sketch`~~ ✅ SHIPPED 2026-05-20 (§6i) | ~~[gemini-function-sketch.ts:711](../service/math/gemini-function-sketch.ts#L711)~~ Orchestrator-same-mode fan-out | ~~Effective Bucket A~~ Fixed | 5-8 |
| ~~`balance-scale`~~ ✅ SHIPPED 2026-05-21 (§6j) | ~~[gemini-balance-scale.ts:200](../service/math/gemini-balance-scale.ts#L200)~~ Pool-service per-mode builders | ~~Effective Bucket A — `challenges?` optional on interface; generator emits flat `leftSide`/`rightSide` from one Gemini call~~ Fixed | K-5+ |
| ~~`measurement-tools`~~ ✅ SHIPPED 2026-05-21 (§6k) | ~~[gemini-measurement-tools.ts:150](../service/math/gemini-measurement-tools.ts#L150)~~ Pool-service per-mode width pools | ~~Singular tool-config; "Generate 3 to 5 shapes" is inside one rendered tool, not N pedagogical instances. Reclassified from §5.~~ Fixed | 3-5 |
| `histogram` | [gemini-histogram.ts:9](../service/math/gemini-histogram.ts#L9) | `data: number[]`, `binWidth`, `binStart` — one histogram per session | 6-8 |
| ~~`matrix`~~ ✅ SHIPPED 2026-05-22 (§6m) | ~~[gemini-matrix.ts:22](../service/math/gemini-matrix.ts#L22)~~ Pool-service per-operation builders | ~~`values: number[][]` — one matrix display~~ Fixed | 8-12 |
| `slope-triangle` | [gemini-slope-triangle.ts:31](../service/math/gemini-slope-triangle.ts#L31) | `attachedLine` + `triangles[]` (visual triangles on one line, not pedagogical instances) | 8 |
| `systems-equations` | [gemini-systems-equations.ts:30](../service/math/gemini-systems-equations.ts#L30) | `equations: SystemEquation[]` — one system | 8 |
| `two-way-table` | [gemini-two-way-table.ts:9](../service/math/gemini-two-way-table.ts#L9) | `frequencies: number[][]` — one table | 7-8 |

**K-3 scope from Bucket A:** `factor-tree` (loud, no), `tape-diagram` (loud), `bar-model` (loud), `place-value-chart` (loud), `area-model` (verify). Mid-elementary (3-5) additions from §3b: `function-sketch`, `balance-scale`, `measurement-tools`. Upper-grade additions (6+) from §3b are lower priority — see §3b "Sequencing implications" for the full ordering.

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
| `pattern-builder` | `extend` | **4** | Healthy | ✅ Already passing — full 5-mode §6a re-audit shipped 2026-05-23 (§6n) |
| `ratio-table` | `build_ratio` | **3** | Healthy | ✅ Already passing |
| `hundreds-chart` | `highlight_sequence` | **5** | Healthy | ✅ Already passing |
| `coordinate-graph` | `plot_point` | **5** | Healthy | ✅ Already passing |
| `equation-workspace` | `guided-solve` | **5** | Healthy | ✅ Already passing |
| `strategy-picker` | `guided` | **1** | **Bucket B-single** | ⚠️ Row may be stale per §3b (2026-05-20): code now has `if (allowedTypes.size === 1)` branch with `TARGET_INSTANCE_COUNT=4` at [gemini-strategy-picker.ts:946](../service/math/gemini-strategy-picker.ts#L946). Re-run `/eval-test strategy-picker --evalMode guided` to confirm — likely already ✅. |
| `array-grid` | `build_array` | **0** | **Bucket A** | ✅ **Shipped 2026-05-19 (§6h)** — pool-service, default 4 challenges/session |
| `fraction-bar` | `identify` | **0** | **Bucket A** | ✅ **Shipped 2026-05-19 (§7 row)** — pool-service, default 3 challenges/session |
| `percent-bar` | `identify_percent` | **0** | **Bucket A** (re-confirmed) | ❌ Singular schema — pending (Workstream 3 entry #5) |
| `double-number-line` | `equivalent_ratios` | **0** | **Bucket A** (re-confirmed) | ❌ Singular schema — pending (Workstream 3 entry #5) |

### Interpretation

**6/11 already passing.** Workstream 1's prompt-floor work appears to have landed for the multi-challenge generators that had stingy prompts (number-line, pattern-builder, ratio-table, hundreds-chart). Coordinate-graph and equation-workspace were already healthy. The original §3 Bucket B audit overstated the remaining work — most of those generators now produce 3-6 challenges per single-mode session unprompted.

**3 newly-discovered Bucket A primitives — 2 shipped, 1 pending.** `array-grid` (§6h) and `fraction-bar` (§7 row) shipped 2026-05-19 — both turned out to be value-only and adopted the pool-service template directly. Only `strategy-picker` remains (Bucket B-single, `challengeCount=1` — schema already has the array, generator just emits one).

**2 re-confirmed Bucket A primitives.** ~~`percent-bar` and `double-number-line` were already in the §7 plan and remain on it.~~ Both ✅ SHIPPED 2026-05-23 (§6q / §6r) — see updated backlog table directly below.

### Updated Workstream 3 backlog (Bucket A — schema refactor required)

| Primitive | Bucket | Pattern (per §6a #1) | Notes |
|-----------|--------|----------------------|-------|
| ~~`percent-bar`~~ ✅ SHIPPED 2026-05-23 (§6q) | A | Pool-service per-mode scenario builders (4 modes × 5-7 templates × rate/base pools) | Phase navigator dropped per [§5 rule 13](#5-the-playbook-refactor-rules). Canonical 9-field metrics (collapsed from 21 per-phase fields). |
| ~~`double-number-line`~~ ✅ SHIPPED 2026-05-23 (§6r) | A | Hybrid: 1 Gemini call wrapper (`topLabel` / `bottomLabel` / `unitRateOutput` / `askInputs[]` pool) + local per-mode pool construction | Context coherence enforced by construction — wrapper pins `(topLabel, bottomLabel, unitRate)` once per session; per-challenge code can only sample asks against it. **New "hybrid wrapper + local pool" generator pattern** documented in §6r #1 — sweet spot for primitives where N challenges share a scenario but vary one numeric parameter. |
| `array-grid` ✅ **SHIPPED** | A | Pool-service (per-mode dimension generators) | Shipped 2026-05-19 (§6h). Pool-service with per-mode `dimensionRangeFor` switch (no `createOperandPairs` dep — see §6h #1). |
| `fraction-bar` ✅ **SHIPPED** | A | Pool-service (per-mode operand generators) | Shipped 2026-05-19 (§7 row). All four modes (identify, build, compare, add_subtract) turned out value-only — single per-mode operand generator + local MC distractor builder; no per-mode UI dispatch needed. Same template as area-model / array-grid. |
| `strategy-picker` | B-single | Pool-service (equations) | **§3a:** `challengeCount=1` not 0 — schema already has `challenges[]`, generator just emits one. **§3b update (2026-05-20):** code now has `if (allowedTypes.size === 1)` branch with `TARGET_INSTANCE_COUNT=4` at [gemini-strategy-picker.ts:946](../service/math/gemini-strategy-picker.ts#L946). Re-run `/eval-test strategy-picker --evalMode guided` — likely already shipped, just needs ✅ confirmation. |

### What this audit does NOT tell us

- **Within-challenge interaction depth.** A primitive can score `challengeCount=4` and still feel demo-y if each challenge takes 5 seconds. The audit measures count, not engagement.
- **Variance quality.** `challengeCount=4` with four identical surface features (same root number, same scenario) still fails the §10 "Variance" criterion. Manual UI walks remain the only check for this.
- **Auto-mode behavior.** All tests above used single-mode (one challenge type). Auto-mode (all types) is the engine's responsibility per PRD §11.

### Audit script

The single-mode count check is cheap enough to run as CI. The full procedure used today: for each primitive, find one eval mode whose `challengeTypes` has length 1, request `/api/lumina/eval-test?componentId=<id>&evalMode=<mode>`, and assert `validation.challengeCount >= 3`. Add as a Workstream 1.5 deliverable so any future Bucket B-mixed regression fails CI immediately.

---

## 3b. 2026-05-20 Full-Math-Folder Static-Scan Audit — Beyond `validation.challengeCount`

§3a's audit relied on `/eval-test` to measure runtime `challengeCount`. That caught the B-mixed bucket (§6g #1) but only covered primitives that already had eval-test wiring. A static-scan audit across **all 57 generators** in [my-tutoring-app/src/components/lumina/service/math/](../service/math/) surfaces three more failure shapes the earlier audit missed.

### Method

For each `gemini-*.ts` file (excluding `numberPoolService.ts`):
1. Read the top-level data interface; check for `challenges: X[]` (or analogous plural array).
2. If the interface declares `challenges?`, verify the generator function actually populates it with N≥1 distinct entries (not just `[oneThing]`).
3. Read the public `generateXxx` export; check whether it branches on `allowedTypes.size === 1` or fans out a per-type orchestrator without one.
4. Locate the in-prompt instance-count instruction (`Generate N challenges`, `count: N`, `DEFAULT_INSTANCE_COUNT`).

### Results — three new failure shapes

**Shape 1: Effective Bucket A** — schema declares `challenges[]` but the generator literally returns one. Worse than classic Bucket A because the type system advertises multi-instance, so any audit that stops at "does the interface have `challenges[]`?" returns a false positive.

| Primitive | File:Line | Evidence |
|---|---|---|
| `function-sketch` | [gemini-function-sketch.ts:711](../service/math/gemini-function-sketch.ts#L711) | Returns `challenges: [result.challenge]` literally — exactly one challenge per session, every time. Per-mode sub-generators exist (`generateIdentifyFeatures`, `generateClassifyShape`, `generateSketchMatch`, `generateCompareFunctions`) but each emits a singular result that gets wrapped in a one-element array. |
| ~~`balance-scale`~~ ✅ SHIPPED 2026-05-21 (§6j) | ~~[gemini-balance-scale.ts:200](../service/math/gemini-balance-scale.ts#L200)~~ Pool-service per-mode builders | ~~Data interface has `challenges?: BalanceScaleChallenge[]` (optional), but the generator never populates it~~ Fixed via per-mode builders + canonical-key dedup |

**Shape 2: Upper-grade Bucket A** — classic singular schema, but in primitives the §3 K-3 scope didn't survey. PRD §11 Open Q #6 ("K-3 only, or all-math sweep?") explicitly flagged this. Resolving it here: yes, the same Bucket A pattern exists in upper grades and is just as pedagogically wasteful.

| Primitive | File:Line | Grade band | Singular field(s) |
|---|---|---|---|
| `histogram` | [gemini-histogram.ts:9](../service/math/gemini-histogram.ts#L9) | 6-8 | `data: number[]`, `binWidth`, `binStart` — one histogram per session |
| ~~`matrix`~~ ✅ SHIPPED 2026-05-22 (§6m) | ~~[gemini-matrix.ts:22](../service/math/gemini-matrix.ts#L22)~~ Pool-service per-operation builders | 8-12 | ~~`values: number[][]` — one matrix display~~ Fixed |
| `slope-triangle` | [gemini-slope-triangle.ts:31](../service/math/gemini-slope-triangle.ts#L31) | 8 | `attachedLine`, `triangles: SlopeTriangleConfig[]` (visual triangles on one line, not pedagogical instances) |
| `systems-equations` | [gemini-systems-equations.ts:30](../service/math/gemini-systems-equations.ts#L30) | 8 | `equations: SystemEquation[]` — one system per session |
| `two-way-table` | [gemini-two-way-table.ts:9](../service/math/gemini-two-way-table.ts#L9) | 7-8 | `frequencies: number[][]` — one table |
| ~~`measurement-tools`~~ ✅ SHIPPED 2026-05-21 (§6k) | ~~[gemini-measurement-tools.ts:150](../service/math/gemini-measurement-tools.ts#L150)~~ Pool-service per-mode width pools | 3-5 | ~~"Generate 3 to 5 shapes" — one tool config with N shapes inside, not N pedagogical instances. **Reclassified from §5 (Workstream 1) to Bucket A.** Bumping the shape count doesn't fix the structural issue that the session is one rendered tool.~~ Fixed via `selectMeasurementChallenges` pool service + `challenges: MeasurementToolsChallenge[]` per the canonical multi-instance pattern. |

**Shape 3: §3a stale row** — code updated since the eval-test run.

| Primitive | §3a row | Current code | Action |
|---|---|---|---|
| `strategy-picker` | "❌ challengeCount=1 — Bucket B-single, pending" | [gemini-strategy-picker.ts:946](../service/math/gemini-strategy-picker.ts#L946) has `if (allowedTypes.size === 1)` branch with `count = config?.challengeCount ?? TARGET_INSTANCE_COUNT` where `TARGET_INSTANCE_COUNT = 4` ([line 30](../service/math/gemini-strategy-picker.ts#L30)). | **Re-run `/eval-test strategy-picker --evalMode guided`** and update §3a row. Likely already healthy; mark ✅ once confirmed. |

### Workstream 1 status — partially complete

A line-by-line check of current code against the original §5 table:

**Shipped (floor now 4-6):** `pattern-builder` ([line 316](../service/math/gemini-pattern-builder.ts#L316)), `base-ten-blocks` (all branches), `hundreds-chart` ([line 261](../service/math/gemini-hundreds-chart.ts#L261)), `number-line` (multiple lines), `comparison-builder` ([line 249](../service/math/gemini-comparison-builder.ts#L249)), `fraction-circles` ([line 235](../service/math/gemini-fraction-circles.ts#L235)).

**Still stingy (floor 3-5 or 3-4):** `counting-board`, `length-lab`, `shape-builder`, `skip-counting-runner`, `3d-shape-explorer`, `ratio-table`, `parameter-explorer` (3-4), plus config-defaulted `equation-builder` and `number-bond` (default `3-5`).

**Missing from §5 but stingy** (newly identified, see §5 update below): `ten-frame` ([gemini-ten-frame.ts:291](../service/math/gemini-ten-frame.ts#L291) — "Generate 3-5"), `regrouping-workbench` ([gemini-regrouping-workbench.ts:304](../service/math/gemini-regrouping-workbench.ts#L304) — "Generate 3-5").

### Already-healthy (no PRD work needed)

The audit confirmed these primitives produce ≥4 in single-mode without any refactor or prompt change since the PRD's last edit, beyond what's already shipped per §6/§7:

`coordinate-graph` (5 per call), `equation-workspace` (`typePlan` of 5 same-type in single-mode), `sorting-station` (`isSingleMode ? 4 : 1`), `time-sequencer` (`ceil(5/allowedTypes.length)`), `spatial-scene` (3 per type subgenerator — meets §10 floor exactly), `coin-counter` (5-6 per type), `net-folder` (`Generate exactly N`), `shape-composer` (5-6 most modes; free-create at 3-4 is a known exception), `shape-sorter` (4-5), `shape-tracer` (4-6), `number-sequencer` (default 5), `number-tracer` (default 5), `compare-objects` (orchestrator-mixed-type with subgenerator counts), `dot-plot` (per-mode subgenerator dispatch).

### Out-of-scope by design

- **`practice-problem`** ([PracticeProblem.tsx:75](../primitives/visual-primitives/math/PracticeProblem.tsx#L75)) — single annotated worked-example primitive; one solution per session by design. Multi-instance doesn't apply here (this is the production-modality slot per [feedback_production-modality-roadmap.md](../../../../../../C:/Users/xbox3/.claude/projects/c--Users-xbox3-claude-web-tutor/memory/feedback_production-modality-roadmap.md)).
- **`digit-evaluation`** ([gemini-digit-evaluation.ts:76](../service/math/gemini-digit-evaluation.ts#L76)) — LLM judge for student handwriting. Not a renderable primitive; scores artifacts produced elsewhere.

### Sequencing implications

Total Bucket A backlog grew from 2 (percent-bar, double-number-line per §3a) to **10** after this audit. As of 2026-05-23, **9 of 10 are ✅ SHIPPED** — only `two-way-table` (#10, upper-grade, deferred) remains:

| # | Primitive | Grade | Shape | Priority |
|---|-----------|-------|-------|----------|
| 1 | ~~`percent-bar`~~ ✅ SHIPPED 2026-05-23 (§6q) | 5-8 | ~~Classic Bucket A~~ Fixed via pool-service per-mode scenario builders | ~~K-3 adjacent (PRD-listed)~~ |
| 2 | ~~`double-number-line`~~ ✅ SHIPPED 2026-05-23 (§6r) | 5-7 | ~~Classic Bucket A~~ Fixed via hybrid (1-call wrapper + local pool construction) | ~~K-3 adjacent (PRD-listed)~~ |
| 3 | ~~`function-sketch`~~ ✅ SHIPPED 2026-05-20 (§6i) | 5-8 | ~~Effective Bucket A (`[result]` wrapper)~~ Fixed via orchestrator-same-mode | ~~Mid (5.OA / 6.EE function-sketching)~~ |
| 4 | ~~`balance-scale`~~ ✅ SHIPPED 2026-05-21 (§6j) | K-5+ | ~~Effective Bucket A (optional `challenges?` never populated)~~ Fixed via pool-service per-mode builders | ~~Mid (equality / algebra prep)~~ |
| 5 | ~~`measurement-tools`~~ ✅ SHIPPED 2026-05-21 (§6k) | 3-5 | ~~Singular tool-config~~ Fixed via pool-service per-mode width pools | ~~Mid (3.MD measurement)~~ |
| 6 | ~~`histogram`~~ ✅ SHIPPED 2026-05-22 (§6o) | 6-8 | ~~Upper-grade singular~~ Fixed via pool-service with distribution-shape builders (symmetric / right-skewed / left-skewed / bimodal / uniform) + mode-specific answer-leak UI gating + continuous-tolerance scoring | ~~Low~~ |
| 7 | ~~`matrix`~~ ✅ SHIPPED 2026-05-22 (§6m) | 8-12 | ~~Upper-grade singular~~ Fixed via per-operation pool-service builders + judgment loop | ~~Low~~ |
| 8 | ~~`slope-triangle`~~ ✅ SHIPPED 2026-05-22 (§6l) | 8 | ~~Upper-grade singular~~ Fixed via pool-service per-mode slope+run pools, first net-new evalModes wiring (3 modes: identify_slope / calculate / draw_triangle) | ~~Low~~ |
| 9 | ~~`systems-equations`~~ ✅ SHIPPED 2026-05-23 (§6p) | 8 | ~~Upper-grade singular~~ Fixed via pool-service with back-solving builders (slope-intercept + elimination) + dual-form representations + net-new evaluation wiring (3 modes: graph / substitution / elimination) | ~~Low~~ |
| 10 | `two-way-table` | 7-8 | Upper-grade singular — last remaining upper-grade Bucket A. Pool-service per-mode; likely reuses `MatrixInput` from §6m #3 + mode-specific UI gating from §6o #2. | Low |

~~K-3 priority remains entries #1-#2 (already in §7).~~ Entries #1-#2 ✅ SHIPPED 2026-05-23 — the K-3-adjacent Bucket A queue is now closed. ~~Mid-elementary (entries #3-#5) join Workstream 3 ahead of upper-grade entries.~~ #3-#5 ✅ SHIPPED. Upper-grade Bucket A entries (#6-#9) ✅ SHIPPED; only #10 (`two-way-table`) remains, deferred. Same pool-service / orchestrator / hybrid (§6r #1) decision rule from §6a #1 applies to the remaining deferred entry.

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

## 5. Workstream 1: Bucket B Prompt-Floor Sweep + §6n 3-Point Audit

### Goal

Every multi-instance generator produces **at least 4 instances** per single-mode session, **and** is wired through the §6a multi-instance checklist (catalog context keys, evaluation barrel re-export, tester metrics breakdown). The original "1-line prompt edit" framing was incomplete — pattern-builder's audit on 2026-05-23 (§6n) showed every Bucket B primitive needs the same surgical 3-point audit on top of the prompt bump.

### What "shipping a Workstream 1 entry" now means

Per primitive, the work is **4 touches**:

| # | Touch | File | What it does |
|---|---|---|---|
| 1 | Prompt floor bump | `service/math/gemini-<primitive>.ts` | `Generate 3-5 challenges` → `Generate 4-6 challenges` (single line) |
| 2 | Catalog context keys (§6a #5) | `service/manifest/catalog/math.ts` | Add `currentChallengeIndex` and `totalChallenges` to `contextKeys`; template `{{totalChallenges}}` into `taskDescription` |
| 3 | Metrics barrel re-export (§6a #9 step 2) | `evaluation/index.ts` | Add `<Primitive>Metrics` to the math-phase-2 export block; switch the component to import from the public barrel |
| 4 | Tester metrics breakdown (§6a #10 step 5) | `components/MathPrimitivesTester.tsx` | Add `result.metrics.type === '<primitive>'` block to the results panel |

Per-primitive effort: ~30 min coding + `/eval-test` per single-mode tier. See `pattern-builder-2026-05-23.md` and §6n for the canonical example.

### Pending — primitives still needing both prompt-bump AND §6n audit

Ordered by routing volume / grade-band impact (K-3 first, since the engine routes most heavily there today).

| # | Primitive | Prompt site | Grade band | Notes |
|---|---|---|---|---|
| 1 | `ten-frame` | [gemini-ten-frame.ts:291](../service/math/gemini-ten-frame.ts#L291) — `Generate 3-5` | K-1 | Added in §3b; high-routing K-1 primitive |
| 2 | `number-bond` | [gemini-number-bond.ts:287](../service/math/gemini-number-bond.ts#L287) — `'3-5'` config default | K-3 | Config-driven default — change default, not call sites |
| 3 | `counting-board` | [gemini-counting-board.ts:283](../service/math/gemini-counting-board.ts#L283) — `Generate 3-5` | K-2 | — |
| 4 | `regrouping-workbench` | [gemini-regrouping-workbench.ts:304](../service/math/gemini-regrouping-workbench.ts#L304) — `Generate 3-5` | 1-3 | Added in §3b |
| 5 | `skip-counting-runner` | [gemini-skip-counting-runner.ts:298](../service/math/gemini-skip-counting-runner.ts#L298) — `Generate 3-5` | 1-3 | — |
| 6 | `length-lab` | [gemini-length-lab.ts:266](../service/math/gemini-length-lab.ts#L266) — `Generate 3-5` | 3-5 | — |
| 7 | `shape-builder` | [gemini-shape-builder.ts:406](../service/math/gemini-shape-builder.ts#L406) — `Generate 3-5` | 3-5 | — |
| 8 | `3d-shape-explorer` | [gemini-3d-shape-explorer.ts:279](../service/math/gemini-3d-shape-explorer.ts#L279) — `Generate 3-5` | 3-5 | — |
| 9 | `equation-builder` | [gemini-equation-builder.ts:967](../service/math/gemini-equation-builder.ts#L967) — `'3-5'` config default | 3+ | Config-driven default |
| 10 | `ratio-table` | [gemini-ratio-table.ts:193](../service/math/gemini-ratio-table.ts#L193) — `Generate 3-5` | 3-5 | §3a tested at 3 — borderline; prompt bump should resolve |
| 11 | `parameter-explorer` | [gemini-parameter-explorer.ts:299](../service/math/gemini-parameter-explorer.ts#L299) — `Generate 3-4` | 3-5+ | — |
| 12 | `strategy-picker` | Bucket B-single per §3a; code already has `TARGET_INSTANCE_COUNT=4` at [gemini-strategy-picker.ts:30](../service/math/gemini-strategy-picker.ts#L30) | 3+ | **Prompt likely already shipped** — needs `/eval-test strategy-picker --evalMode guided` confirmation + §6n audit only |

### Pending — primitives with prompt floor already at 4-6, needing only the §6n audit

These were swept during the original §5 prompt-bump pass but never got the §6a checklist applied (same gap pattern-builder had before 2026-05-23). Each needs touches #2, #3, #4 above — but not #1.

| Primitive | Prompt floor | Audit status |
|---|---|---|
| `base-ten-blocks` | 4-6 (all branches) | §6n audit pending |
| `hundreds-chart` | 4-6 | §6n audit pending |
| `number-line` | 4-6 (all sub-generators) | §6n audit pending |
| `comparison-builder` | 4-6 | §6n audit pending |
| `fraction-circles` | 4-6 | §6n audit pending |
| `pattern-builder` | 4-6 | ✅ §6n audit shipped 2026-05-23 |

### Shipped log (for reference)

Prompt floor bumped from stingy → 4-6 in earlier passes: pattern-builder, base-ten-blocks, hundreds-chart, number-line (4 sub-generators), comparison-builder, fraction-circles. §6n full audit: pattern-builder.

### Reclassified out of §5 (do not bump prompt — needs schema refactor)

`measurement-tools` was originally in this sweep with "Generate 3 to 5 shapes." §3b reclassified it as Bucket A — bumping the shape count inside one rendered tool doesn't multiply pedagogical instances. Shipped via §6k schema refactor instead.

### Validation per primitive

1. `npx tsc --noEmit` clean for touched files.
2. `/eval-test <primitive> --evalMode <each-single-mode-tier>` — assert `validation.challengeCount >= 4` for every eval mode whose `challengeTypes` length is 1.
3. Manual UI render — confirm distinct per-challenge content (no surface-feature repetition across N instances).
4. Token/cost sanity — Gemini Flash Lite output approximately doubles for some primitives; verify within budget.

### Out of scope for Workstream 1

- Generators in Bucket A (singular schema — need refactor, not a bump).
- Generators in Bucket C (already 4+).
- Schema changes, component changes, backend registry changes.

### Revised effort estimate

- **Per primitive:** ~30 min (4 file touches + eval-test sweep).
- **Pending Workstream 1 entries with prompt bump needed:** 12 primitives × 30 min ≈ 6 hours.
- **Pending §6n-only audits (already-shipped prompt floor):** 5 primitives × 20 min ≈ 100 min.
- **Total remaining Workstream 1:** ~1.5 days of focused work.

### Suggested sequencing

1. Re-verify strategy-picker (5 min — likely already passing, just confirm).
2. K-3 batch: ten-frame, number-bond, counting-board, regrouping-workbench (highest engine routing volume).
3. Mid-elementary batch: skip-counting-runner, length-lab, shape-builder, 3d-shape-explorer.
4. Mid-grade batch: equation-builder, ratio-table, parameter-explorer.
5. §6n-only audits on already-shipped Bucket B primitives (5 quick passes).

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

## 6i. Function-sketch Post-Mortem (Workstream 3 entry #10) ✅ SHIPPED

### Why function-sketch next

§3b's full-folder static-scan audit (2026-05-20) flagged `function-sketch` as the lowest-friction Bucket A entry to refactor next, ahead of `balance-scale` and `measurement-tools`. The §3b row predicted: "the per-mode subgenerators already exist (`generateIdentifyFeatures`, `generateClassifyShape`, `generateSketchMatch`, `generateCompareFunctions`); each emits a singular result that just needs to be called N times in parallel and wrapped as `challenges[0..N-1]`. Same shape as bar-model's pilot refactor." This was confirmed in the file: the schema/component were already multi-instance-aware (`challenges: FunctionSketchChallenge[]`, `useChallengeProgress`, `usePhaseResults`, `PhaseSummaryPanel`, `usePrimitiveEvaluation`, `FunctionSketchMetrics`); only [gemini-function-sketch.ts:711](../service/math/gemini-function-sketch.ts#L711) was returning `challenges: [result.challenge]`.

### What shipped (vs the §3b / §7 row)

| Plan (§3b / §7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Orchestrator-same-mode** (per §6a #7) — N parallel calls of the per-mode sub-generator | **Orchestrator-same-mode**, N=4 parallel calls of the selected sub-generator via `Promise.all`. Same shape as bar-model / tape-diagram. New `instanceCount` config (default 4, max 6). Orchestrator reassigns IDs to `fs-${challengeType}-${idx + 1}` to avoid `Date.now()` collisions in parallel calls. | No deviation. The sub-generators already returned `SubGeneratorResult { title, context, challenge }` — they only needed an orchestrator above them. |
| `challenges: FunctionSketchChallenge[]` (default 3-6) | `challenges: FunctionSketchChallenge[]`, default **4**, max 6. No interface changes — the schema was already correct. | Per-challenge owns its own type, instruction, axes config, and mode-specific content. The session-level `title` + `context` come from the first sub-result. |
| Stale-state guard per §6a #3 / §6a #8 | Handler-driven guard via `recordedRef`: set true on `recordResult`, reset to false in the per-challenge reset effect. Reset effect re-keyed from `currentIndex` to `challenge?.id` per §7 #5. | Submit is button-driven (no passive completion effect), so a single `recordedRef.current` check at the top of `handleCheck` is sufficient. No content-match predicate needed — the click is direct user intent, not derived from async state. |
| Evaluation: §6a #9 eval-hook migration | **Skipped (already done)**: function-sketch had already migrated to `usePrimitiveEvaluation` + `FunctionSketchMetrics`. Only the metrics shape needed work. | Pre-existing prior-pass migration, same as tape-diagram / place-value-chart / area-model / function-machine / array-grid. |
| Metrics: not explicitly scoped | **Flattened per §6a #11**: dropped 7 mode-specific within-challenge fields (`featuresCorrect`, `featuresTotal`, `sketchAccuracy`, `classificationCorrect`, `controlPointsPlaced`, `completionTime`, `totalAttempts`). New shape mirrors `BarModelMetrics` / `ArrayGridMetrics` / `FunctionMachineMetrics`. | The old metrics encoded ONE challenge's mode-specific state into session-level fields (`controlPointsPlaced` was literally the *current* sketch's point count when submit fired). After multi-instance, those fields measured the last challenge, not the session. |
| Tester wiring | **Added** `onEvaluationSubmit` prop (was missing despite the eval-hook migration — silent gap that would have suppressed all metrics submission from the tester). **Added** new `result.metrics.type === 'function-sketch'` breakdown block (was absent). | Same shape as area-model / array-grid metrics-display. Discovered the missing `onEvaluationSubmit` while wiring the metrics block — would have been invisible in production except that the tester is where eval-test exercises the primitive. |
| Catalog `taskDescription` / `contextKeys` | **Updated** to multi-instance template — `{{challengeType}}`, `{{totalChallenges}}`, `{{currentChallengeIndex}}` in `taskDescription`; `contextKeys` reshaped from `['title', 'context', 'challenges']` to `['title', 'context', 'challengeType', 'currentChallengeIndex', 'totalChallenges']`. **Added** `MULTI-FUNCTION PACING` aiDirective per the array-grid pattern. Description + constraints rewritten to reflect multi-function sessions. | Pre-refactor `contextKeys` exported `'challenges'` (the entire array) which would have flooded the tutor prompt with curve point data. Switched to scalar session-level keys + the standard pacing directive. |

### Files changed

- [gemini-function-sketch.ts](../service/math/gemini-function-sketch.ts) — added `DEFAULT_INSTANCE_COUNT = 4` / `MAX_INSTANCE_COUNT = 6` constants, `subGeneratorFor` dispatcher, and a `Promise.all` fan-out orchestrator at the bottom. Sub-generators unchanged. Orchestrator reassigns IDs to `fs-${challengeType}-${idx + 1}` so parallel calls don't collide on `Date.now()`.
- [FunctionSketch.tsx](../primitives/visual-primitives/math/FunctionSketch.tsx) — re-keyed per-challenge reset effect from `[currentIndex]` to `[challenge?.id]` per §7 #5; added `recordedRef` stale-state guard at the top of `handleCheck` per §6a #8; rewrote `handleNext`'s `submitResult` payload to the flattened `FunctionSketchMetrics` shape; removed unused `controlPoints.length` from the metrics computation dependency list.
- [evaluation/types.ts](../evaluation/types.ts) — `FunctionSketchMetrics` flattened from 8 fields to 9 (mode-specific → canonical aggregate). Mirrors `BarModelMetrics`.
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `description` rewritten to lead with "Multi-challenge…orchestrator-same-mode pattern"; `constraints` clarifies the manifest must NOT supply specific functions, expressions, curves, or features; `taskDescription` templates `{{challengeType}}` + `{{totalChallenges}}` + `{{currentChallengeIndex}}`; `contextKeys` shrunk to scalar session-level keys; new `MULTI-FUNCTION PACING` aiDirective.
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — added `onEvaluationSubmit` prop to the render case (was silently missing); added `result.metrics.type === 'function-sketch'` metrics-breakdown block.

### FunctionSketchMetrics shipped (post-flattening)

```ts
export interface FunctionSketchMetrics extends BasePrimitiveMetrics {
  type: 'function-sketch';
  challengeType: 'identify-features' | 'classify-shape' | 'sketch-match' | 'compare-functions';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;          // Total tries across all challenges
  firstTryCount: number;          // attempts === 1 && correct
  hintsViewed: number;            // attempts > 1 (saw a wrong-answer hint)
  overallAccuracy: number;        // 0-100, decayed by attempts
  averageAttemptsPerChallenge: number;
}
```

### Lessons (additions to §6a)

#### §6i #1. "Component already multi-instance, generator already same-mode-dispatched" is the cheapest refactor shape

Function-sketch is the second primitive in Workstream 3 (after fraction-bar) where the heavy lifting — component rewrite, per-challenge reset effect, eval-hook migration, `FunctionSketchMetrics` interface — was already done in a prior pass. The audit ([§3b](#3b-2026-05-20-full-math-folder-static-scan-audit--beyond-validationchallengecount), [gemini-function-sketch.ts:711](../service/math/gemini-function-sketch.ts#L711)) caught a generator that *looked* multi-instance at the type level (`challenges: FunctionSketchChallenge[]`) but was returning a one-element array. The fix was ~30 lines of orchestrator at the bottom of the generator + 5 surgical edits across component / metrics / catalog / tester. Total effort ~45 min vs the §7 "~1.5 days per primitive" estimate.

**Generalization:** the static-scan audit shape from §3b (read the public `generateXxx`, check whether it fans out N or returns `[oneThing]`) is a better predictor of refactor difficulty than the §3a `challengeCount` audit. A `challenges?` field on the interface is necessary but not sufficient — the generator can advertise multi-instance shape and still ship singleton sessions. **Audit hook:** for every primitive whose interface has `challenges[]`, grep the generator for `challenges: [` (literal one-element wrap) before assuming it's healthy.

#### §6i #2. `Date.now()` IDs in sub-generators are a parallel-call hazard

The pre-refactor sub-generators each assigned `id: '${type}-${Date.now()}'`. With `await` calls in serial this was fine (each `Date.now()` differed by the network round-trip). With `Promise.all` across the same tick, all N calls resolve in the same millisecond and collide. `useChallengeProgress` uses these IDs as React keys and for `getChallengeId`, so collisions would silently break the per-challenge reset effect (effect re-runs on `challenge?.id` change; two challenges with the same ID = no re-run = phantom state from challenge N-1).

**Resolution applied:** the orchestrator reassigns IDs to `fs-${challengeType}-${idx + 1}` after `Promise.all` returns. This is the same fix bar-model used (`bm-${idx + 1}`, [gemini-bar-model.ts:705](../service/math/gemini-bar-model.ts#L705)).

**Generalization (extension of §6a #7):** when refactoring a singleton sub-generator into a parallel orchestrator, audit any per-call uses of `Date.now()`, `Math.random()`, or other timing-derived identifiers and replace with index-derived IDs. The sub-generators don't need to know about the orchestrator's parallelism — the orchestrator owns ID assignment.

#### §6i #3. The catalog `contextKeys: ['challenges']` smell

The pre-refactor catalog entry exported `contextKeys: ['title', 'context', 'challenges']`. Including `'challenges'` in the tutor context would have serialized the entire challenges array (20 curve points × 4 challenges × multiple modes-worth of features = hundreds of numeric fields) into the AI tutor's prompt every turn. Even though `function-sketch` had only ever returned ONE challenge before this refactor, exporting the full array as a context key was always cost-wasteful at session level.

**Resolution applied:** dropped `'challenges'`; added scalar session-level keys `'challengeType'`, `'currentChallengeIndex'`, `'totalChallenges'`. The tutor sees the *pacing* and *mode*, not the curve data — which it doesn't need anyway since the student is looking at the rendered canvas.

**Generalization:** never put per-challenge array fields in `contextKeys`. Tutor context should be cheap scalars that describe *where the student is in the session* and *what shape of work they're doing*, not the work itself. The student sees the work; the tutor sees the pacing.

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (FunctionSketch, gemini-function-sketch, MathPrimitivesTester, evaluation/types, catalog/math all clean; pre-existing scratch-pad variance noise unrelated) |
| `/eval-test function-sketch` across all 4 eval modes | ⏳ Owed |
| Manual UI walk: pin `classify-shape`, finish 4 distinct curves, observe `PhaseSummaryPanel` + tester metrics breakdown | ⏳ Owed |
| Manual UI walk: pin `identify-features`, verify 4 distinct curves with varying feature counts | ⏳ Owed |
| Manual UI walk: pin `sketch-match`, verify per-challenge reset clears control points + reveal between challenges | ⏳ Owed |
| Manual UI walk: pin `compare-functions`, verify two-curve render across 4 distinct comparison scenarios | ⏳ Owed |
| Cost spot-check (4× per-session token spend — content-bearing variance per §6a #2) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors) |

### Actual effort

~45 min total: generator orchestrator ~10 min (lifted from bar-model template), component edits ~10 min (reset-effect rekey + `recordedRef` guard + `handleNext` rewrite), metrics flattening ~5 min, catalog tweaks ~10 min, tester wiring ~5 min, type-check + audit ~5 min. **Confirmed §3b's "same shape as bar-model's pilot refactor" prediction.** Faster than bar-model itself because the eval-hook migration was already complete from a prior pass — only the generator-tier fix + metrics-flattening + catalog/tester wiring remained.

### Next steps (function-sketch + Workstream 3 carry-forward)

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **Manual UI walks for all 4 modes** | Eng | Per §6i validation table. Pin each mode in the tester, complete 4 distinct functions, confirm "Next Challenge" advances (not replays) and the summary panel aggregates correctly. |
| 2 | **Cost spot-check** for function-sketch (4× per-session content-bearing Gemini cost) | Eng | Per §10 — orchestrator-same-mode primitives ~4× pre-refactor cost expected. Compare to bar-model / tape-diagram baselines. |
| 3 | Workstream 3 entry #11: `balance-scale` refactor | Eng | Next §3b mid-elementary entry. Pool-service (value-only — `(leftSide, rightSide, variableValue)` tuples per eval mode). Same shape as factor-tree. |
| 4 | Workstream 3 entry #12: `measurement-tools` refactor | Eng | Next §3b mid-elementary entry. Pool-service (value-only — `(shapeType, dimensions)` tuples per challenge). |
| 5 | Workstream 3: `percent-bar` + `double-number-line` refactor | Eng | Still the *originally-listed* remaining Workstream 3 entries from §7. Both orchestrator-mixed-type. `double-number-line` needs context-coherence enforcement. |
| 6 | Workstream 3: `strategy-picker` refactor | Eng | Bucket B-single (`challengeCount=1`). Audit before scoping. |
| 7 | Workstream 1 (prompt-floor sweep) | Eng | Still pending. |

---

## 6j. Balance-scale Post-Mortem (Workstream 3 entry #11) ✅ SHIPPED

### Why balance-scale next

§3b sequenced balance-scale immediately after function-sketch as mid-elementary entry #11. The §3b row predicted: **pool-service** (value-only) — equations decompose into deterministic `(leftSide, rightSide, variableValue)` tuples per eval mode. Same shape as factor-tree. Confirmed in the audit: the component was already wired for multi-instance (`useChallengeProgress`, `usePhaseResults`, `PhaseSummaryPanel`, `usePrimitiveEvaluation`, `BalanceScaleMetrics`, advance/recordResult wiring, optional `challenges?: BalanceScaleChallenge[]` interface field) — only the generator and a few stale-state edges were Bucket A.

### What shipped (vs the §3b / §7 row)

| Plan (§3b / §7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Pool service** (value-only — `(leftSide, rightSide, variableValue)` tuples per eval mode) | **Pool service** with **per-mode equation builders** — `buildEquality`, `buildEqualityHard`, `buildOneStep`, `buildOneStepHard`, `buildTwoStepIntro`, `buildTwoStep`. Each enforces mode-specific shape constraints (single-variable objects, multiple-x coefficient stacks, additive/subtractive direction) and emits one `EquationSpec`. `selectBalanceScaleChallenges` then runs the selected builder N times (default 4), deduping by canonical equation key, and orders easier-to-harder by right-side magnitude. | Same call as area-model (§6e #4) and array-grid (§6h #1) — per-mode constraint shapes diverge enough that a per-mode builder beats a shared `createOperandPairs`. The K-2 `equality_hard` mode and the `one_step_hard` mode in particular require fundamentally different object-array shapes (mystery-number additive form vs k copies of x), so a single shared helper would not have helped. |
| `challenges: BalanceScaleChallenge[]` (3-6, required) | `challenges: BalanceScaleChallenge[]`, **default 4, max 6**. Per-challenge owns `type`, `instruction`, `leftSide`, `rightSide`, `variableValue`, `hint`. Session-level `leftSide`/`rightSide`/`variableValue` are populated from challenge #0 for backward compatibility with the legacy single-challenge data shape. | The interface already had `challenges?` (optional) but it was dead code — the generator never populated it. Flipping it to required would be a breaking change for any direct callers; instead, the generator always emits it and the component prefers it over the root-level fields. |
| Stale-state guard per §6a #3 / §6a #8 | **Handler-driven** guard via `recordedRef.current` at the top of `handleVerify`. Also flipped back to `false` in the per-challenge reset useEffect on `currentChallengeId` change. | The verify-button click is direct user intent; no content-match predicate needed beyond "already recorded for this challenge." Similar to function-sketch's `recordedRef`-only guard (§6i). |
| Evaluation: §6a #9 eval-hook migration | **Skipped (already done)**: balance-scale already used `usePrimitiveEvaluation` + `BalanceScaleMetrics`. Only the metrics shape needed work. | Pre-existing prior-pass migration, same as tape-diagram / place-value-chart / area-model / function-machine / array-grid / function-sketch. |
| Metrics: not explicitly scoped | **Flattened per §6a #11**: dropped 10 within-challenge fields (`targetEquation`, `solutionFound`, `solutionValue`, `operationsPerformed`, `stepsToSolve`, `optimalSteps`, `efficiency`, `phaseProgression`, `balanceMaintained`, plus the legacy union-typed `evalMode`). New shape mirrors `BarModelMetrics` / `TapeDiagramMetrics` / `PlaceValueChartMetrics` / `AreaModelMetrics` / `FunctionMachineMetrics` / `ArrayGridMetrics` / `FunctionSketchMetrics`. | The old metrics encoded ONE equation's per-step solve trace into session-level fields. After multi-instance, `operationsPerformed` would have measured the LAST equation, `efficiency` would be tautological, `balanceMaintained` was always true under the existing click-to-remove-both-sides UI invariant. |
| Tester wiring | **Updated**: render case previously only passed `data` (no evaluation props). Now passes `instanceId`/`skillId`/`subskillId`/`objectiveId`/`onEvaluationSubmit`. Added new `result.metrics.type === 'balance-scale'` breakdown block. | Per §6a #10: balance-scale was registered with the old shape (data-only render); the eval-hook migration was complete but the tester never picked up `onEvaluationSubmit`, so the tester would have shown no metrics breakdown despite the component computing them correctly. Silent gap identical to function-sketch's §6i row. |
| Catalog `taskDescription` / `contextKeys` | **Updated** to multi-equation template — `{{challengeType}}`, `{{currentChallengeIndex}}`, `{{totalChallenges}}`, `{{currentEquation}}`, `{{phase}}`, `{{stepCount}}` in `taskDescription`. `contextKeys` reshaped: dropped per-challenge `leftSide`/`rightSide` arrays (per §6i #3 — never put per-challenge arrays in tutor context); added scalar session-level keys. Added `MULTI-EQUATION PACING` aiDirective. `constraints` clarifies the manifest must NOT supply specific numbers, sides, or solutions. Description rewritten. | Same shape as function-sketch / array-grid catalog updates. |

### Files changed

- [gemini-balance-scale.ts](../service/math/gemini-balance-scale.ts) — full rewrite around the pool service. Slim wrapper schema (Gemini emits title/description/challengeType/gradeBand/showTilt only). Six per-mode equation builders (`buildEquality`, `buildEqualityHard`, `buildOneStep`, `buildOneStepHard`, `buildTwoStepIntro`, `buildTwoStep`); `ALLOW_OPS_BY_TYPE` and `GRADE_BAND_BY_TYPE` lookup tables drive mode-derived defaults. `selectBalanceScaleChallenges` runs the selected builder N times with canonical-key dedup; falls back to accepting duplicates rather than blocking generation. Drops the legacy in-prompt `randomEquations` seed array + the post-Gemini balance-validation fallbacks (no longer needed because the pool service is mathematically deterministic and balanced by construction).
- [BalanceScale.tsx](../primitives/visual-primitives/math/BalanceScale.tsx) — added `BalanceScaleChallengeType` (widened from 3 to 6 modes); extended `PHASE_TYPE_CONFIG` to all 6 modes; replaced the imperative per-challenge reset in `advanceChallenge` with a `useEffect` keyed on `currentChallengeId`; added `recordedRef` + `hintViewedRef` + `hintsViewedRef`; `handleVerify` now uses the standard §6a #11 score formula and stores `score` on `ChallengeResult`; new session-complete useEffect builds flattened metrics and calls `submitEvaluation` exactly once; `usePhaseResults` now passes a custom `getScore` that averages stored per-challenge scores; `aiPrimitiveData` rewritten to use `currentChallenge` (not `initialLeft`/`initialRight`); "Next Challenge" button relabelled to "Next Equation →" to match place-value-chart/area-model interstitial pattern.
- [evaluation/types.ts](../evaluation/types.ts) — `BalanceScaleMetrics` flattened from 11 fields to 9 (mirrors `BarModelMetrics` / `TapeDiagramMetrics` / `PlaceValueChartMetrics` / `AreaModelMetrics` / `FunctionMachineMetrics` / `ArrayGridMetrics` / `FunctionSketchMetrics`).
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `description` rewritten to lead with "Multi-equation balance scale session (3-6 equations of the same difficulty tier)"; `constraints` clarifies the manifest must NOT supply specific numbers, sides, or solutions; `taskDescription` templates `{{challengeType}}` + `{{currentChallengeIndex}}` + `{{totalChallenges}}`; `contextKeys` dropped per-challenge array fields, added scalar session-level keys; new `MULTI-EQUATION PACING` aiDirective.
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — render case now passes evaluation props; added `result.metrics.type === 'balance-scale'` metrics-breakdown block per §6a #10.

### BalanceScaleMetrics shipped (post-flattening)

```ts
export interface BalanceScaleMetrics extends BasePrimitiveMetrics {
  type: 'balance-scale';
  challengeType: 'equality' | 'equality_hard' | 'one_step' | 'one_step_hard' | 'two_step_intro' | 'two_step';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;          // Total tries across all challenges
  firstTryCount: number;          // Challenges scoring 100 (first-try correct)
  hintsViewed: number;            // Challenges where student viewed the answer
  overallAccuracy: number;        // 0-100, average per-challenge score
  averageAttemptsPerChallenge: number;
}
```

### Lessons (additions to §6a)

#### §6j #1. The "interface advertises `challenges?` but the generator never populates it" anti-pattern

Function-sketch (§6i) shipped `challenges: [result.challenge]` — a literal one-element wrap. Balance-scale was one degree worse: `challenges?: BalanceScaleChallenge[]` was declared as an *optional* field, and the generator simply never set it at all. The component then guarded on `challenges.length > 0`, so the entire multi-instance code path was dead under the live generator. The audit hook from §6i #1 (grep for `challenges: [`) doesn't catch this case — there's nothing to grep, the field literally does not appear in the generator. Stronger audit hook: for every interface with `challenges?: X[]`, search the corresponding `gemini-*.ts` for the substring `.challenges` (lowercase property access). If it never appears, the field is dead.

This generalizes: optional `challenges?` fields are a smell. New primitives should declare `challenges` as required (and provide a generator that always populates it), so the type system enforces the multi-instance contract. The §8 canonical schema pattern already specifies "required" — but legacy primitives that grew the field optionally have this latent gap.

#### §6j #2. "Replace imperative reset with useEffect" is its own micro-refactor

The pre-refactor `advanceChallenge` ran an imperative block of state-resets after `advanceProgress()` returned true: `setCurrentLeft(next.leftSide)`, `setCurrentRight(next.rightSide)`, `setPhase('explore')`, etc. — eight setState calls inline. That worked but had two bugs hiding in it:

1. When `advanceProgress()` returned `false` (last challenge), the resets were skipped — fine. But the function also did `sendText(...)` referencing `challenges[currentChallengeIndex + 1]?.instruction` which was undefined at session-end, sending a malformed AI message.
2. If anything *other* than `advanceChallenge` ever advanced the index (e.g. a future "skip" button), the resets wouldn't fire. The effect-based reset (keyed on `currentChallengeId`) is self-correcting.

**Generalization (extension of §6c "reset every per-challenge state slot"):** the reset should live in a `useEffect([currentChallengeId])`, not inline in the advance handler. The handler should only call `advanceProgress()` and emit a tutor "next item" message; the effect owns state reset. This makes the reset robust against future index-changing code paths.

#### §6j #3. Mode-derived constants beat manifest config when the mode itself implies them

Balance-scale's pre-refactor generator accepted manifest config for `allowOperations`, `stepHistory`, and `gradeBand`. After the refactor, these are derived from `challengeType` (`ALLOW_OPS_BY_TYPE[type]`, `GRADE_BAND_BY_TYPE[type]`). The manifest can still override `instanceCount` and `showTilt`, but it CANNOT override the operation set — because the operation set is intrinsic to the difficulty tier (`equality_hard` is `['add', 'subtract']` by definition; `one_step_hard` is `['multiply', 'divide']` by definition). Letting the manifest override that would produce nonsensical sessions like a "one_step_hard" tier that doesn't allow multiplication.

**Generalization:** when a primitive has eval-mode-defined config (operation sets, allowed object kinds, scaffolding-level flags), derive it from the mode in the generator post-Gemini and ignore manifest overrides. The catalog `constraints` field should document this so authors don't try.

#### §6j #4. Dropping the post-Gemini balance-validation fallback is a sign the refactor is correct

The pre-refactor generator had a ~30-line block that detected an unbalanced equation in Gemini's output and tried to "fix" it by recomputing `variableValue` from the variable-coefficient differential. That block existed because Gemini's structured output occasionally returned `leftSide`/`rightSide`/`variableValue` triples that didn't satisfy the balance invariant — the prompt told Gemini to make them balance, but it wasn't always reliable. After the pool-service refactor, every equation is built by deterministic code from numeric primitives (`x + b = c` where `c = x + b` is computed locally), so the balance invariant is guaranteed by construction. The 30-line fixer is gone.

**Generalization:** any "post-Gemini auto-correction" block in a generator is a smell that the prompt is asking Gemini to do something the type system or pool service should do. After moving from prompt-level constraints to in-code construction, those blocks become dead code and can be deleted. Audit hook: grep generators for `console.warn(...adjusting`, `console.warn(...not balanced`, `Math.abs(... > 0.01)`, etc. — these are usually post-hoc fixers covering for prompt unreliability.

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (BalanceScale joins the existing scratch-pad `PrimitiveRenderer` variance noise list per §6e — expected) |
| `/eval-test balance-scale` across all 6 eval modes | ⏳ Owed |
| Manual UI walk: pin `one_step`, finish 4 distinct equations, observe `PhaseSummaryPanel` + tester metrics breakdown | ⏳ Owed |
| Manual UI walk: pin `equality_hard`, verify subtractive-form (□ - 3 = 5) rendering | ⏳ Owed |
| Manual UI walk: pin `one_step_hard`, verify k-copies-of-x rendering for 3x = 12 | ⏳ Owed |
| Manual UI walk: pin `two_step`, verify subtractive-form (2x - 3 = 7) rendering | ⏳ Owed |
| Cost spot-check (1× per-session Gemini call — wrapper only, big savings vs orchestrator primitives) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors) |

### Actual effort

~1.5 hours total: generator refactor (per-mode equation builders + pool-service runner + dedup) ~40 min, component edits (per-challenge reset useEffect + recordedRef + flattened metrics + session-complete useEffect + custom getScore + aiPrimitiveData rewrite) ~30 min, metrics flattening ~5 min, catalog updates ~10 min, tester wiring ~5 min, type-check + audit ~5 min. Comparable to function-sketch (§6i) — the component was already multi-instance-aware from a prior pass, so most of the work was the generator and pulling reset logic into the canonical effect pattern.

### Next steps (balance-scale + Workstream 3 carry-forward)

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **Manual UI walks for all 6 modes** | Eng | Per §6j validation table. Pin each mode in the tester, complete 4 distinct equations, confirm "Next Equation →" advances (not replays) and the summary panel aggregates correctly. |
| 2 | **Cost spot-check** for balance-scale (wrapper-only Gemini call) | Eng | Per §10 — pool-service primitives should land within 2× pre-refactor cost. Compare to factor-tree / place-value-chart / area-model / function-machine / array-grid baselines. |
| 3 | ~~Workstream 3 entry #12: `measurement-tools` refactor~~ ✅ **SHIPPED** | Eng | Shipped 2026-05-21. See §6k. |
| 4 | Workstream 3: `percent-bar` + `double-number-line` refactor | Eng | Still the *originally-listed* remaining Workstream 3 entries from §7. Both orchestrator-mixed-type. `double-number-line` needs context-coherence enforcement. |
| 5 | Workstream 3: `strategy-picker` refactor | Eng | Bucket B-single (`challengeCount=1`). Audit before scoping. |
| 6 | Workstream 1 (prompt-floor sweep) | Eng | Still pending. |
| 7 | Apply §6j #1 audit (grep `gemini-*.ts` for property access on `.challenges`) across remaining Bucket A candidates | Eng | Catches any other "optional `challenges?` interface field never populated by generator" gaps that §6i #1's `challenges: [` grep would miss. |

---

## 6k. Measurement-tools Post-Mortem (Workstream 3 entry #12) ✅ SHIPPED

### Why measurement-tools next

§3b sequenced measurement-tools immediately after balance-scale as mid-elementary entry #12. The §3b row predicted: **pool-service** (value-only — `(shapeType, dimensions)` tuples per challenge). Confirmed in the audit: the component was already wired for multi-instance walking (`useChallengeProgress`, `usePhaseResults`, `PhaseSummaryPanel`, `usePrimitiveEvaluation`, `MeasurementToolsMetrics`, advance/recordResult, per-shape progress dots and "Next shape!" tutoring messages) — the schema-level field was named `shapes: MeasurementShape[]` instead of `challenges: MeasurementToolsChallenge[]`, and Gemini owned generation of those shapes. So this was a "schema-renaming + per-challenge reset effect + pool-service generator" refactor, not a structural rewrite. Same shape as ordinal-line (§6g) where the component was already correctly wired.

### What shipped (vs the §3b / §7 row)

| Plan (§3b / §7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Pool service** (value-only — `(shapeType, dimensions)` tuples per challenge) | **Pool service** with per-mode width pools — `poolConfigFor(mode, gradeBandHint)` returns `{widthCandidates, precisionStep, gradeBand}` per challengeType. `selectMeasurementChallenges` shuffles, dedups, and sorts; `pickShapeType(idx)` deterministically mixes 70% rectangles / 30% squares; colors cycle through a 6-entry pool; hints are pre-written strings sampled from a 6-entry pool. | Same call as area-model (§6e #4) / array-grid (§6h #1) / balance-scale (§6j) — per-mode constraint shapes diverge enough that a per-mode width-range table beats sharing `createOperandPairs`. The constraints are: `measure` whole 1-8 (K-2) / 2-10 (3-5); `compare` whole 2-8 / 3-9 (similar-but-distinct); `estimate` half-precision 2-10 excluding whole numbers (forces between-tick reading); `convert` clean inches→cm picks `[2, 3, 4, 5, 6, 8, 10]`. The `estimate` mode's "exclude whole-number widths" rule is what makes between-tick reading non-trivial — students never get a "freebie" 4.0-inch shape in estimate mode. |
| `challenges: MeasurementChallenge[]` (default 3-6) | `challenges: MeasurementToolsChallenge[]`, default **4**, max 6. Per-challenge owns `id`, `shapeType`, `widthInches`, `heightInches`, `color`, `label`, `hint`. Session-level: `title`, `description`, `challengeType`, `rulerLengthInches`, `unit`, `precision`, `gradeBand`, `convertToUnit?`. | Renamed the field `type` → `shapeType` on the per-challenge interface to avoid colliding with the `type` discriminant on `MeasurementToolsMetrics`. The session-level `convertToUnit` is derived in the generator from `unit` (always the opposite) and stays at session level because every challenge in a convert-mode session uses the same unit pair. |
| Stale-state guard per §6a #3 / §6a #8 | **Handler-driven** guard via `recordedRef.current` inside a shared `completeChallenge` helper, plus a `submittedRef` for the session-complete useEffect. `recordedRef` flips to `false` in the per-challenge reset useEffect on `currentChallengeId` change. | Submit is button-driven for every mode. The shared `completeChallenge` helper centralizes the result-recording for both single-step modes (measure / estimate) and the multi-step convert mode — same pattern as balance-scale (§6j) but with the added complexity of multi-step scoring (see §6k #2 below). |
| Evaluation: §6a #9 eval-hook migration | **Skipped (already done)**: measurement-tools already used `usePrimitiveEvaluation` + `MeasurementToolsMetrics`. Only the metrics shape needed work. | Pre-existing prior-pass migration, same as nearly every Workstream 3 entry from tape-diagram onward. |
| Metrics: not explicitly scoped | **Flattened per §6a #11**: dropped 6 mode-specific fields (`measureCorrect`, `measureTotal`, `compareCorrect`, `compareTotal`, `convertCorrect`, `convertTotal`). New shape mirrors `BarModelMetrics` / `BalanceScaleMetrics` — 9 canonical aggregate fields including `challengeType` as the discriminator. | The old metrics double-counted: `measureCorrect`/`measureTotal` were always populated (all modes measure), while `compareCorrect`/`convertCorrect` were only populated in their respective modes. After flattening, `correctCount` is the universal "challenges completed correctly" signal regardless of mode; compare-mode comparison correctness is rolled into `overallAccuracy` via the 60/40 blend rather than its own field. |
| Tester wiring | **Replaced hardcoded mock fixture** with the canonical `{ ...(data as Parameters<typeof Component>[0]['data']), instanceId, skillId, subskillId, objectiveId, onEvaluationSubmit }` shape. **Added** new `result.metrics.type === 'measurement-tools'` breakdown block. | Pre-refactor the tester render case constructed a hardcoded `MeasurementToolsData` object with 3 fake shapes (Blue Rectangle 4", Pink Square 3", Green Rectangle 5.5") regardless of what the generator returned — a latent integration bug that would have masked all generator behavior in the tester preview. Also missing `onEvaluationSubmit`. Both fixed. |
| Catalog `taskDescription` / `contextKeys` | **Updated** to multi-shape template — `{{challengeType}}`, `{{currentChallengeIndex}}`, `{{totalChallenges}}`, `{{currentShape}}`, `{{shapeWidth}}`, `{{unit}}`, `{{precision}}`, `{{isOnRuler}}` in `taskDescription`. `contextKeys` reshaped to scalar session-level + active-challenge keys (no per-challenge arrays per §6i #3). Added `MULTI-SHAPE PACING` aiDirective. `constraints` clarifies the manifest must NOT supply shape widths, colors, labels, or hints. Description rewritten to lead with "Multi-shape ruler measurement session". | Same shape as function-sketch / array-grid / balance-scale catalog updates. |

### Files changed

- [gemini-measurement-tools.ts](../service/math/gemini-measurement-tools.ts) — full rewrite around the pool service. Slim wrapper schema (Gemini emits title/description/challengeType/unit/gradeBand only — five fields, no shape data). `poolConfigFor(mode, gradeBandHint)` returns `{widthCandidates, precisionStep, gradeBand}` per challengeType. `selectMeasurementChallenges` shuffles, dedups, sorts widths; `pickShapeType(idx)` enforces deterministic rectangle/square mix; `COLOR_POOL` / `LABEL_PREFIX` / `HINT_POOL` cycle through pre-written content. `estimate` mode filters the width pool to exclude whole numbers (force between-tick reading). Dropped the ~120-line post-Gemini fallback shape-array, color/label/hint defaulting, and precision-alignment loops — pool service is deterministic so the fallbacks are no longer needed (per §6j #4).
- [MeasurementTools.tsx](../primitives/visual-primitives/math/MeasurementTools.tsx) — full rewrite. New `MeasurementToolsChallenge` and `MeasurementToolsChallengeType` exported; `MeasurementToolsData` reshaped with `challenges[]` + session-level keys. Per-challenge reset useEffect resets twelve state slots (answerInput, feedback, showHint, measureAttempts, convertStep, convertInput, convertFeedback, measuredValue, convertAttempts, hintViewedRef, recordedRef, plus shape position re-initialization for the current challenge). Shared `completeChallenge` helper centralizes per-challenge result recording with mode-aware scoring (§6k #2 below). New `PHASE_CONFIG` covers all four modes (measure / compare / estimate / convert). New `submittedRef` prevents double-submission of the session-complete metrics — needed because compare mode's `isFullyComplete` depends on `comparisonDone` flipping, which can cause the effect to fire twice without a ref guard.
- [evaluation/types.ts](../evaluation/types.ts) — `MeasurementToolsMetrics` flattened from 7 mode-specific fields to 9 canonical aggregate fields (mirrors `BarModelMetrics` / `BalanceScaleMetrics`).
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `description` rewritten to lead with "Multi-shape ruler measurement session (3-6 distinct shapes of the same challenge type)"; `constraints` clarifies the manifest must NOT supply shape widths, colors, labels, or hints; `taskDescription` templates `{{challengeType}}` + `{{currentChallengeIndex}}` + `{{totalChallenges}}` + active-challenge fields; `contextKeys` reshaped to scalar session-level + active-challenge keys; new `MULTI-SHAPE PACING` aiDirective.
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — render case replaces the hardcoded 3-shape fixture with the canonical `...(data as Parameters<...>[0]['data'])` spread + evaluation props; added `result.metrics.type === 'measurement-tools'` metrics-breakdown block.

### MeasurementToolsMetrics shipped (post-flattening)

```ts
export interface MeasurementToolsMetrics extends BasePrimitiveMetrics {
  type: 'measurement-tools';
  challengeType: 'measure' | 'compare' | 'estimate' | 'convert';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;          // Total tries across all challenges (+ compare attempts in compare mode)
  firstTryCount: number;          // Challenges scoring 100 (first-try correct)
  hintsViewed: number;            // Challenges where the student opened the hint panel
  overallAccuracy: number;        // 0-100, average per-challenge score (60/40 blended with comparison in compare mode)
  averageAttemptsPerChallenge: number;
}
```

### Lessons (additions to §6a)

#### §6k #1. The "component already iterates, generator owns the loop" anti-pattern

Measurement-tools was the second primitive in Workstream 3 (after ordinal-line) where the component was ALREADY wired for multi-instance walking via `useChallengeProgress` + `usePhaseResults`, but the generator owned the multi-shape loop and the data interface called the array `shapes` rather than the canonical `challenges`. Functionally the session DID iterate, but:

1. The naming difference made it invisible to the §3b "interface has `challenges[]`?" static-scan — `shapes` looks like a singular tool-config field even though it carries the same multi-instance semantics.
2. Gemini owned per-shape generation, so structured-output convergence (§6a #2) applied: the same 3-5 shapes appeared every call within a mode, with the same widths and colors. Variance was prompt-controlled and unreliable.
3. The post-Gemini sanitization layer (~120 lines: precision alignment, color defaulting, fallback shape array, ruler-length minimum, etc.) existed to cover for Gemini's unreliability. After moving to pool service, all of that is dead code per §6j #4.

**Generalization:** when auditing a Bucket A candidate, don't trust the interface field name. Read the generator to see whether per-instance variance comes from a deterministic in-code source or from Gemini's per-call output. If the latter, the primitive is effectively Bucket A even if its data interface uses a plural field name. Rename the field to `challenges` during the refactor for consistency with the §8 canonical schema, even when the multi-instance walking is already structurally correct.

#### §6k #2. Multi-step scoring in a multi-instance session: 50/50 by sub-step, not by attempt count

§6e #3 introduced the 70/30 weighted formula for area-model's forward mode (per-cell × sum split). Convert mode's measure-then-convert flow is the same shape, just with a 50/50 split and only two sub-steps:

```ts
const mAttempts = Math.max(1, measureAttemptsRef.current);
const cAttempts = Math.max(1, convertAttemptsRef.current);
score = correct
  ? Math.round(phaseScore(mAttempts) * 0.5 + phaseScore(cAttempts) * 0.5)
  : 0;
```

Two `useRef`s track measure vs convert attempts separately so the formula has access to both counters. A single combined attempts counter would not work — a student who got measure right first try and convert right first try would have `attempts === 2`, which `phaseScore` would decay to 80, not the 100 they actually deserve.

**Generalization:** when a challenge has within-step sub-phases (measure → convert; identify → value → build; per-cell → sum), track each sub-phase's attempts in its own ref. Average via `phaseScore` per sub-phase, then weight (50/50 for two equal-difficulty steps; 70/30 for unequal-difficulty steps). Store the resulting score on `ChallengeResult.score` and pass `getScore: (r) => r.score ?? 0` to `usePhaseResults` (already documented in §6d for place-value-chart).

#### §6k #3. Session-level affordances (compare mode) blend into `overallAccuracy`, not per-challenge scores

Compare mode is the only mode where post-measurement work happens at the session level (order all shapes shortest-to-longest). It would be tempting to model this as a "fifth challenge" or to stuff `compareAttempts` into a per-challenge result. Both are wrong:

- Modeling as a fifth challenge inflates `totalChallenges` arbitrarily and breaks `averageAttemptsPerChallenge` semantics (one of the four is structurally different).
- Stuffing into a per-challenge result attributes the ordering to whichever shape happens to be last, which is meaningless.

**Resolution:** keep `totalChallenges === challenges.length`. Roll `compareAttempts` into `attemptsCount` so total work is accurately reflected. Compute `overallAccuracy` as a 60/40 blend of the per-challenge measurement-score average and the comparison score (the comparison score also uses `phaseScore(compareAttempts)`). This is the same shape as area-model's per-mode score-formula divergence (§6e #3): session-level structure differs by mode, but the canonical 9-field metrics interface stays stable.

**Generalization:** session-level affordances that aren't per-challenge — comparison ordering in compare mode, optional verification steps in build-then-verify primitives, summative free-response writeups in future primitives — should fold into `attemptsCount` and `overallAccuracy` via a weighted blend, not into `totalChallenges` or per-challenge fields. The 9-field interface stays canonical; the blend formula is the mode-specific bit.

#### §6k #4. Tester mock fixtures are a Bucket A tell of their own

Pre-refactor the math tester's measurement-tools case constructed a hardcoded `MeasurementToolsData` object with three specific shapes:

```ts
case 'measurement-tools': {
  const measurementData: MeasurementToolsData = {
    title: 'Measure the Shapes',
    shapes: [
      { id: 'shape-1', type: 'rectangle', widthInches: 4, ... },
      { id: 'shape-2', type: 'square', widthInches: 3, ... },
      { id: 'shape-3', type: 'rectangle', widthInches: 5.5, ... },
    ],
    // ...
  };
  return <MeasurementTools data={measurementData} />;
}
```

This means: **regardless of what the generator returned, the tester always rendered the same three shapes.** Generator changes were invisible in the tester preview. The user (and any audit) would have seen "Bucket A" behavior — same 3 shapes every time — but the cause wasn't the generator; it was the tester's hardcoded fixture.

Every other multi-instance primitive in the math tester passes generator output through structural typing (`...(data as Parameters<typeof Component>[0]['data'])`). Mock fixtures inside the tester are a smell.

**Audit hook for remaining Bucket A candidates:** before scoping a refactor, search [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) for the primitive's render case. If the case constructs a hardcoded data object with literal field values rather than spreading the `data` prop, the tester has been masking generator changes — fix the tester first so the next iteration cycle gives accurate signal.

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (MeasurementTools, gemini-measurement-tools, MathPrimitivesTester, evaluation/types, catalog/math all clean; pre-existing scratch-pad `PrimitiveRenderer` variance noise unrelated and unchanged) |
| `/eval-test measurement-tools` across all 4 eval modes | ⏳ Owed |
| Manual UI walk: pin `measure`, finish 4 distinct shapes (K-2 widths 1-8), observe `PhaseSummaryPanel` + tester metrics breakdown | ⏳ Owed |
| Manual UI walk: pin `estimate`, verify all 4 widths land on half-precision tick marks (no whole numbers) | ⏳ Owed |
| Manual UI walk: pin `compare`, measure 4 shapes then verify the comparison phase + 60/40 blend in `overallAccuracy` | ⏳ Owed |
| Manual UI walk: pin `convert`, verify per-challenge measure-then-convert two-step flow + 50/50 score blend | ⏳ Owed |
| Cost spot-check (1× per-session Gemini call — wrapper only, big savings vs the pre-refactor full shape-array generation) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors) |

### Actual effort

~1.5 hours total: generator refactor (per-mode width pools + `selectMeasurementChallenges` + color/hint pools) ~30 min, component rewrite (renaming + per-challenge reset useEffect + `completeChallenge` helper + multi-step scoring refs + flattened metrics + new `submittedRef`) ~45 min, metrics flattening ~5 min, catalog updates ~10 min, tester wiring (replacing the hardcoded fixture + adding the metrics-breakdown block) ~5 min, type-check + audit ~5 min. Comparable to balance-scale (§6j) — the component was already multi-instance-aware, so the bulk of the work was generator and renaming.

### Next steps (measurement-tools + Workstream 3 carry-forward)

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **Manual UI walks for all 4 modes** | Eng | Per §6k validation table. Pin each mode in the tester, complete 4 distinct shapes, confirm progress dots fill correctly and the summary panel aggregates correctly. The estimate mode walk is the most interesting — verify all widths land between tick marks. |
| 2 | **Cost spot-check** for measurement-tools (wrapper-only Gemini call) | Eng | Per §10 — pool-service primitives should land within 2× pre-refactor cost. Expect significant savings vs pre-refactor since the wrapper schema dropped from ~12 fields with a nested shape array to 5 scalar fields. |
| 3 | Workstream 3: `percent-bar` + `double-number-line` refactor | Eng | **Now the only remaining originally-listed Workstream 3 entry from §7.** Both orchestrator-mixed-type. `double-number-line` needs context-coherence enforcement (one ratio relationship per session). |
| 4 | Workstream 3: `strategy-picker` refactor (or re-verification) | Eng | Bucket B-single (`challengeCount=1`) per §3a; §3b noted the code may already be healthy. Re-run `/eval-test strategy-picker --evalMode guided` first — likely already shipped, just needs confirmation. |
| 5 | Workstream 1 (prompt-floor sweep) | Eng | Still pending. Fastest workstream by far — ~15 generator prompt edits, no schema changes. The K-3 mid-elementary Workstream 3 backlog is now clear; Workstream 1 should be next. |
| 6 | Apply §6k #4 audit (search tester for hardcoded data fixtures) across remaining math primitives | Eng | Catches any other primitives where the tester is masking generator changes. Cheap one-pass grep on `MathPrimitivesTester.tsx`. |

---

## 6l. Slope-triangle Post-Mortem (Workstream 3 entry #15 / first upper-grade Bucket A) ✅ SHIPPED

### Why slope-triangle next

§3b sequenced slope-triangle as upper-grade entry #15 (low priority within Workstream 3, but the first upper-grade entry to clear). The §3b row predicted: classic Bucket A — `attachedLine` + `triangles[]` was structurally singular (one line, several visual triangles on it, no pedagogical instance count). Confirmed in the audit: pre-refactor the primitive had **zero eval-mode wiring** — no `evalModes` in the catalog, no `usePrimitiveEvaluation`, no `useChallengeProgress`, no `SlopeTriangleMetrics`. The previous "session" was a pure visualization (drag the triangle, watch the slope stay constant) with no challenge, no submission, and no score. This was the first §6/§7 entry where the multi-instance refactor coincided with **first-time evaluation wiring** end-to-end (eval modes added, metrics interface created, tester upgraded from pure render to evaluation-aware spread).

### What shipped (vs the §3b / §7 row)

| Plan (§3b / §7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Pool service** (value-only — `(attachedLine, triangleConfig)` tuples per challenge) | **Pool service** with per-mode slope + run candidate pools — `SLOPE_POOL_BY_TYPE[challengeType]` returns `(rise, run)` integer pairs; `RUN_POOL_BY_TYPE[challengeType]` returns horizontal-leg sizes; `chooseYIntercept` snaps to integer intercepts that keep both base and top points inside the [-10, 10] viewport; `formatEquation` / `labelEquation` emit the canonical `y = m*x + b` form (with explicit `*` so the canvas evaluator parses it) plus a pretty-printed display label. `selectSlopeTriangleChallenges` shuffles, dedups by canonical `(slope, intercept, position, run, rise)` key, and sorts gentler-slopes-first by `|slope|`. | Same call as factor-tree / balance-scale / measurement-tools — per-mode slope ranges diverge enough (integer-only for `identify_slope`, mix of integer + fractional for `calculate`, integer-only clean slopes for `draw_triangle`) that a per-mode table beats sharing pool primitives. The `chooseYIntercept` helper is the slope-triangle-specific bit: most pool-service entries didn't need viewport-safety logic because their per-challenge data wasn't graphed on a fixed-bounds canvas. |
| `challenges: SlopeTriangleChallenge[]` (default 3-6) | `challenges: SlopeTriangleChallenge[]`, default **4**, max 6. Per-challenge owns `id`, `type`, `attachedLine` (with `slope`, `yIntercept`, `equation`, `label`), `triangle`, `expectedRise`, `expectedRun`, `expectedSlope`, `instruction`, `hint`. Session-level: `title`, `description`, `xRange`, `yRange`, `gridSpacing`, `showAxes`, `showGrid`, `notation`, `gradeBand`. | Each challenge is a separate **line + question + correct answers**, not a separate viewport. Critically: `expectedSlope` / `expectedRise` / `expectedRun` live on the challenge, not derived at render time from a numerically-eval'd equation string, so submit-time scoring doesn't depend on the canvas evaluator. The structured `attachedLine.slope`/`yIntercept` numeric fields complement the legacy `equation` string field (kept for the canvas drawing path that already parses string equations). |
| Stale-state guard per §6a #3 / §6a #8 | **Handler-driven** guard via `recordedRef.current` inside a shared `completeChallenge` helper that fires only when the submit handler reports correct. The reset useEffect on `currentChallenge?.id` flips `recordedRef.current = false` plus resets twelve state slots (trianglePos, riseInput, runInput, slopeInput, feedback, feedbackType, showHint, draggingHandle, plus the three submit-input strings). A separate `submittedRef` guards the session-complete useEffect. | Submit is button-driven for every mode (Check buttons in `identify_slope` / `calculate` / `draw_triangle`). Same pattern as balance-scale (§6j) / measurement-tools (§6k). Drag handles only appear in `draw_triangle` mode; the per-challenge reset re-seeds `trianglePos` from `currentChallenge.triangle` so any prior drag work doesn't leak into the next challenge. |
| Evaluation: §6a #9 eval-hook migration | **Net-new wiring**: pre-refactor the component had no evaluation hook at all. Added `usePrimitiveEvaluation<SlopeTriangleMetrics>`, new `SlopeTriangleMetrics` interface (`evaluation/types.ts`), added to `AnyPrimitiveMetrics` union, re-exported from `evaluation/index.ts`. | First Workstream 3 entry to do the full eval-hook ground-up (every prior entry already had `usePrimitiveEvaluation` in place from a previous pass). Mirrors the 9-field canonical shape (`type`, `challengeType`, `totalChallenges`, `correctCount`, `attemptsCount`, `firstTryCount`, `hintsViewed`, `overallAccuracy`, `averageAttemptsPerChallenge`) without any mode-specific fields — same flattened shape as BalanceScale / MeasurementTools. |
| Catalog wiring | **Net-new evalModes block**: pre-refactor the catalog entry had `tutoring` but no `evalModes` array. Added 3 modes (`identify_slope` β 3.5, `calculate` β 5.0, `draw_triangle` β 6.5) matching the PRD_EVAL_MODES_ROLLOUT §35 plan exactly. `taskDescription` rewritten to multi-challenge template (`{{challengeType}}` / `{{currentChallengeIndex}}` / `{{totalChallenges}}` / `{{equation}}` / `{{expectedSlope}}` / `{{expectedRise}}` / `{{expectedRun}}`). `contextKeys` reshaped to scalar session-level + active-challenge keys. `constraints` rewritten to explicitly state the manifest must NOT supply equations, slopes, or triangle dimensions. New `MULTI-LINE PACING` aiDirective; `SLOPE CONSTANCY DISCOVERY` rewritten for the multi-line case (slope constancy *within* a line, slope variance *across* lines). Added `supportsEvaluation: true`. | Same shape as the catalog updates for function-sketch (§6i) / balance-scale (§6j) / measurement-tools (§6k), but the evalModes block itself is net-new — slope-triangle had been in the catalog as a visualization-only primitive since the original ship per `PRD_EVAL_MODES_ROLLOUT` §35 (which flagged the rollout but it hadn't shipped). |
| Tester wiring | Replaced the bare `<SlopeTriangle data={...} />` render case with the canonical `{ ...data, instanceId, skillId, subskillId, objectiveId, onEvaluationSubmit }` spread. Added `result.metrics.type === 'slope-triangle'` breakdown block. | Pre-refactor the tester rendered slope-triangle as a pure visualization with no evaluation routing. Same five-edit pattern as every other multi-instance ship; the bare render case had to become an evaluation-aware spread because the component now expects evaluation props. |

### Files changed

- [gemini-slope-triangle.ts](../service/math/gemini-slope-triangle.ts) — full rewrite around the pool service. Slim wrapper schema (Gemini emits title/description/challengeType/gradeBand only — four fields, no per-line/triangle data). `SLOPE_POOL_BY_TYPE` / `RUN_POOL_BY_TYPE` per challengeType. `chooseYIntercept` keeps the triangle inside [-10, 10]. `selectSlopeTriangleChallenges` shuffles, dedups via canonical key, and sorts by `|slope|` ascending. Old per-call Gemini-driven generation (300+ lines of prompt + post-processing for one line + 1-3 triangles) replaced with ~400 lines of pure pool-service plumbing.
- [SlopeTriangle.tsx](../primitives/visual-primitives/math/SlopeTriangle.tsx) — full rewrite. New `SlopeTriangleChallenge` and `SlopeTriangleChallengeType` exported; `SlopeTriangleData` reshaped with `challenges[]` + session-level keys + evaluation props. Per-challenge reset useEffect resets twelve state slots. Shared `completeChallenge` helper centralizes per-challenge result recording. New mode-specific submit handlers (`handleSubmitIdentifySlope` / `handleSubmitCalculate` / `handleSubmitDrawTriangle`) — each parses input, scores against `expectedRise` / `expectedRun` / `expectedSlope`, runs the stale-state guard, and calls `completeChallenge(true)` on correct. Calculate mode accepts both decimal and fraction inputs (`2`, `2/3`). Drag handles render only in `draw_triangle` mode. New progress-dots row keyed on `challenges[].id`. Pre-refactor `useState` + 760 lines of canvas-only logic replaced with multi-instance shell + canvas (canvas drawing reduced from the old 300+ lines of multi-triangle rendering to ~100 lines for one triangle per challenge).
- [evaluation/types.ts](../evaluation/types.ts) — added `SlopeTriangleMetrics` (9 canonical fields, same shape as BalanceScale/MeasurementTools); added to `AnyPrimitiveMetrics` union.
- [evaluation/index.ts](../evaluation/index.ts) — re-exported `SlopeTriangleMetrics` next to the other math metrics.
- [catalog/math.ts](../service/manifest/catalog/math.ts) — added 3-mode `evalModes` array, rewrote `description` to lead with "Multi-challenge slope triangle session", rewrote `constraints` to forbid the manifest supplying equations/slopes/positions, multi-challenge `taskDescription` + `contextKeys`, new `MULTI-LINE PACING` aiDirective, multi-line variant of `SLOPE CONSTANCY DISCOVERY`, `supportsEvaluation: true`.
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — render case spreads evaluation props; added `result.metrics.type === 'slope-triangle'` metrics-breakdown block.

### SlopeTriangleMetrics shipped

```ts
export interface SlopeTriangleMetrics extends BasePrimitiveMetrics {
  type: 'slope-triangle';
  challengeType: 'identify_slope' | 'calculate' | 'draw_triangle';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;
  firstTryCount: number;
  hintsViewed: number;
  overallAccuracy: number;
  averageAttemptsPerChallenge: number;
}
```

### Lessons (additions to §6a)

#### §6l #1. First-time evaluation wiring fits inside the multi-instance refactor

Slope-triangle was the first Workstream 3 entry where the underlying primitive shipped originally as a pure visualization — no evaluation hook, no metrics interface, no eval modes in the catalog. The §3b audit listed it under "upper-grade Bucket A" alongside histogram / matrix / systems-equations / two-way-table, and the §6a #9 migration step assumed (correctly for K-3 / mid-elementary, less so for upper-grade entries) that prior passes had already added `usePrimitiveEvaluation`. For slope-triangle they hadn't.

**Practical consequence:** the multi-instance refactor was also a "first time this primitive is interactive in an evaluable sense" refactor. That added ~15 minutes of net-new metrics interface + catalog-evalModes work, but **didn't change the shape** of the refactor — every other Workstream 3 step (pool service, useChallengeProgress, reset useEffect, stale-state guard, PhaseSummaryPanel, tester wiring) ran the same way.

**Generalization for the remaining upper-grade Bucket A entries (#16-#17):** expect histogram / matrix / systems-equations / two-way-table to be in the same "evaluation hook is also net-new" state. Budget +15-20 min for the metrics interface + catalog-evalModes addition; the rest of the refactor follows the K-3 / mid-elementary template unchanged.

#### §6l #2. Pure-visualization primitives become multi-challenge by adding a *question*, not by multiplying the visualization

Pre-refactor the slope-triangle primitive was a sandbox — drag the triangle, resize it, watch the slope value update in real time. There was no question. Making it multi-instance required defining *what the student is being asked to do per challenge* — and the right answer wasn't "show 4 sandboxes," it was "ask 4 questions, each anchored to one line."

This is the same call PRD §11 made for `function-machine` ("N rules per session, not N inputs of one rule"). The deeper pattern: when a Bucket A primitive is a sandbox, the §6 refactor isn't really "make the data structure plural" — it's "**give the student something to do**, then plural-ize that." Identify rise/run, calculate slope, construct triangle — three distinct asks, each with its own grading rule, each scaling to 3-6 instances per session.

**Generalization:** the §6a #1 schema decision rule (pool vs orchestrator) implicitly assumed the primitive already had a question shape. For sandbox primitives, add an explicit zeroth step: **define 2-3 candidate eval-mode questions before scoping the schema**. Without that step the refactor will either land as "render 4 sandboxes" (still demo-shaped) or get stuck on what to put in `challenges[].expected*` fields.

#### §6l #3. Numeric per-challenge fields beat parsing equation strings at submit time

The pre-refactor component parsed `attachedLine.equation` (a string like `"y = 2*x + 1"`) at every triangle render to compute the slope numerically. That worked for visualization but is a foot-gun for scoring: if the equation string ever shifts format (locale-dependent decimal separators, accidental whitespace, `x` vs `*x` confusion), the numeric parse silently returns NaN and the student's correct answer reads as wrong.

Adding `attachedLine.slope` and `attachedLine.yIntercept` as numeric fields alongside the `equation` string solved this — the canvas drawing path still parses the string (so future visualization tweaks don't need to change the data shape), but the submit handlers compare directly against `expectedSlope` / `expectedRise` / `expectedRun` numeric fields on the challenge object.

**Generalization:** for any primitive where the per-challenge answer is computed from a string (equations, expressions, dimensional formulas), pre-compute the structured numeric answer at generation time and store it on the challenge. The canvas evaluator stays as a rendering utility; submit-time scoring never depends on it.

#### §6l #4. Viewport-safe pool generation needs a "snap-and-clamp" helper

Pool-service primitives that don't have a fixed canvas viewport (factor-tree, balance-scale equations) can pick values freely from their candidate set. Slope-triangle is different: every generated `(slope, run, position)` triple has to fit inside [-10, 10] x [-10, 10], or the line/triangle gets clipped. The pool generator picks slope + run + start-x freely, but then `chooseYIntercept` back-solves the intercept that keeps both base and top points inside the viewport, snapping to an integer y-intercept for clean equation display.

**Generalization:** any pool-service primitive with a fixed-bounds canvas needs a small per-mode "fit-the-viewport" helper. For graphed-line primitives that's an intercept-snap. For other primitives (matrix scaling, histogram bin widths) it's whatever per-instance derived field needs to stay in a renderable range. The helper is small (~10 lines), runs after the random pick, and clamps before the canonical-key dedup check.

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (gemini-slope-triangle.ts, SlopeTriangle.tsx, evaluation/types.ts, evaluation/index.ts, catalog/math.ts, MathPrimitivesTester.tsx all clean; the lone `PrimitiveRenderer.tsx` "LazyExoticComponent" complaint on the slope-triangle row is a pre-existing widespread issue affecting all 22 primitives in that registry and is not new). |
| `/eval-test slope-triangle` across all 3 eval modes | ⏳ Owed |
| Manual UI walk: pin `identify_slope`, finish 4 distinct lines, observe `PhaseSummaryPanel` + tester metrics breakdown | ⏳ Owed |
| Manual UI walk: pin `calculate`, verify fractional-slope input parses (`2/3` form) and the score scales by attempt count | ⏳ Owed |
| Manual UI walk: pin `draw_triangle`, drag base and right handles to build a triangle with the target run, verify the Check button accepts it | ⏳ Owed |
| Cost spot-check (1× per-session Gemini call — wrapper only, big savings vs the pre-refactor full schema generation) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (the new evalModes ship with sensible β + scaffolding defaults from PRD_EVAL_MODES_ROLLOUT §35; no new beta priors in `problem_type_registry.py` required because slope-triangle had no pre-existing calibration). |

### Actual effort

~2 hours total: audit + design decision (5 candidate question shapes, settled on the 3 from PRD_EVAL_MODES_ROLLOUT §35) ~20 min, generator rewrite (per-mode slope pools + `chooseYIntercept` + canonical-key dedup + wrapper schema) ~30 min, component rewrite (multi-challenge shell + 3 mode-specific submit handlers + canvas reduction to one triangle + reset useEffect + progress dots) ~50 min, metrics interface + AnyPrimitiveMetrics union + index re-export ~5 min, catalog evalModes + multi-challenge taskDescription + aiDirectives ~10 min, tester render-case spread + metrics-breakdown block ~5 min. The 50 min on the component is the longest single chunk because the canvas drawing had to be re-anchored from "many triangles on one line" to "one triangle on one line" and the reset useEffect has to play nicely with the canvas redraw effect.

### Next steps (slope-triangle + Workstream 3 carry-forward)

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **Manual UI walks for all 3 modes** | Eng | Per §6l validation table. Calculate mode is the most interesting — verify the fraction parser handles `2/3`, `-2/3`, `0.667`, and rejects malformed input gracefully. Draw-triangle mode walk should verify drag handles work on touch as well as mouse. |
| 2 | **Cost spot-check** for slope-triangle (wrapper-only Gemini call) | Eng | Per §10 — pool-service primitives should land within 2× pre-refactor cost. Expect significant savings vs pre-refactor since the wrapper schema dropped from ~10 fields with a nested triangles array to 4 scalar fields. |
| 3 | Workstream 3: `histogram` / `systems-equations` / `two-way-table` refactors (~~`matrix`~~ ✅ shipped 2026-05-22, §6m) | Eng | Three remaining upper-grade Bucket A entries from §3b. Expect the same "evaluation hook is net-new" budget hit per §6l #1 / §6m #1. Pool-service for all three (per §3b sequencing table). |
| 4 | Workstream 3: `percent-bar` + `double-number-line` + `strategy-picker` | Eng | Originally-listed §7 entries still pending. Both orchestrator-mixed-type. `double-number-line` needs context coherence (one ratio relationship per session). |
| 5 | Workstream 1 (prompt-floor sweep) | Eng | Still pending. ~15 one-line generator edits per §5 table. |
| 6 | Apply §6l #2 audit (look for sandbox-shape Bucket A primitives in other domains) | Eng | The "no question, just a sandbox" pattern almost certainly exists in physics / chemistry / biology primitives that were authored as exploration tools. Run the same `grep`/eyeball pass across non-math primitives before scoping multi-instance there. |

---

## 6m. Matrix-display Post-Mortem (Workstream 3 entry #14 / second upper-grade Bucket A) ✅ SHIPPED

### Why matrix-display next

§3b sequenced matrix-display as upper-grade entry #14 (immediately after slope-triangle / #15 — entries were ordered by file but #14 sits next to #15 in scope and grade band). The §3b row predicted: classic singular schema — `rows: number`, `columns: number`, `values: number[][]` plus optional `secondMatrix`. Recommended pattern: pool-service with per-mode `(rows, columns, values, operationType)` tuples. Confirmed in the audit: pre-refactor the primitive had **even less evaluation surface than slope-triangle**. Slope-triangle was an interactive visualization (drag, watch slope stay constant); matrix-display was a passive demo with click-to-reveal step-by-step Sarrus/multiplication SVG infographics. **Zero student work was ever judged.** No `usePrimitiveEvaluation`, no `MatrixDisplayMetrics`, no submit handlers, no Check / Next affordance. The catalog had `supportsEvaluation: true` and four `evalModes` declared, but those were never wired through to a scoring path.

This is the most extreme version of §6l #1's "first-time evaluation wiring fits inside the multi-instance refactor" lesson: the refactor had to add the judgment loop itself, not just upgrade an existing one.

### What shipped (vs the §3b / §7 row)

| Plan (§3b / §7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Pool service** (value-only — `(rows, columns, values, operationType)` tuples per challenge) | **Pool service** with per-operation builders — `buildTransposeChallenge`, `buildAddSubtractChallenge`, `buildMultiplyChallenge`, `buildDeterminantChallenge`, `buildInverseChallenge`. Each enforces operation-specific shape constraints (transpose alternates 2×3/3×2; add/subtract uses 2×2 or 2×3 same-shape; multiply alternates 2×2 × 2×2 and 2×3 × 3×2; determinant uses 2×2 (grade 7-8) or 2×2/3×3 (algebra2+); inverse always 2×2 with det = ±1). `selectMatrixChallenges` runs the selected builder N times with canonical-key dedup; falls back to accepting duplicates rather than blocking generation. Each builder pre-computes the **expected result** (`expectedScalar` for determinant; `expectedMatrix` for everything else) so submit-time scoring is deterministic and doesn't need to re-derive the answer in the component. | Same call as area-model (§6e #4) / array-grid (§6h #1) / balance-scale (§6j) / measurement-tools (§6k) / slope-triangle (§6l) — per-operation shape constraints diverge enough that a per-mode builder beats sharing `createOperandPairs`. The inverse-mode constraint that det ∈ {±1} is enforced by an integer-search loop in `buildInverseChallenge`: pick (a, b, c) freely; solve d = (targetDet + bc)/a; reject if d is non-integer or out of range. ~100 attempts is enough in practice; falls back to `[[2,1],[3,2]]` (det = 1) if every attempt fails. |
| `challenges: MatrixDisplayChallenge[]` (default 3-6) | `challenges: MatrixDisplayChallenge[]`, default **3**, max 6. Per-challenge owns `id`, `challengeType`, `instruction`, `rows`, `columns`, `values`, optional `secondMatrix`, `expectedScalar?`, `expectedMatrix?`, `hint`. Session-level: `title`, `description`, `challengeType` (mirrors per-challenge `challengeType` since the session is single-mode), `educationalContext?`, `gradeBand?`. | Default 3 instead of 4 because multi-step operations (inverse, 3×3 determinant, multiply) take longer per challenge than the K-3 / mid-elementary primitives. Pilot at 3 mirrors place-value-chart's §6d "3 instances is the right answer when each challenge has multi-step interactions" rationale — here each challenge has multiple cell entries to fill in, not a single number. |
| Stale-state guard per §6a #3 / §6a #8 | **Handler-driven** guard via `recordedRef.current` at the top of `handleCheck`, flipped back to `false` in the per-challenge reset useEffect on `currentChallenge?.id`. Also `submittedRef` for the session-complete useEffect (mirrors balance-scale / measurement-tools / slope-triangle pattern). | Submit is button-driven (Check Answer). No content-match predicate beyond `recordedRef` is needed because the click is direct user intent and the expected values are stored on the challenge — there's no async derived state to disagree with the active challenge. Same shape as function-sketch's §6i `recordedRef`-only guard. |
| Evaluation: §6a #9 eval-hook migration | **Net-new wiring (deeper than slope-triangle)**: pre-refactor the component had no evaluation hook, no metrics interface, AND **no submit/check UI at all**. Added `usePrimitiveEvaluation<MatrixDisplayMetrics>`, new `MatrixDisplayMetrics` interface in `evaluation/types.ts`, added to `AnyPrimitiveMetrics` union, re-exported from `evaluation/index.ts`. **Also added the entire judgment-loop UI**: `MatrixInput` for editable result cells (with per-cell correctness coloring after submit), scalar input for determinant mode, Check Answer / Show steps / Next Matrix / Skip buttons, per-challenge feedback panel. | Slope-triangle (§6l) at least had drag interactions and Check buttons before its evaluation wiring. Matrix-display had clicks-that-reveal-infographics and nothing more. The judgment loop is a new pedagogy here — pre-refactor a student could "complete" a matrix session by clicking nothing or by skipping straight to Show Steps, which gave the answer away with zero student work. |
| Catalog wiring | Pre-refactor the catalog had `evalModes` (4 modes: transpose, add_subtract, multiply, determinant_inverse) BUT no wired scoring. Refactor kept the 4 evalModes verbatim and rewrote `description` + `constraints` + `taskDescription` + `contextKeys` + `aiDirectives` to multi-challenge form. `contextKeys` reshaped from per-challenge `['rows', 'columns', 'operationType', 'values']` (which would have flooded tutor context with per-cell matrix data per §6i #3) to scalar session-level + active-challenge keys: `['title', 'challengeType', 'currentChallengeIndex', 'totalChallenges', 'gradeBand']`. New `MULTI-MATRIX PACING` aiDirective; `OPERATION-AWARE COACHING` rewritten to drop the dead row-operations branch and add inverse / transpose coaching that matches the actual shipped operations. | The catalog kept the evalModes-already-declared structure intact, so this was a wire-up + content rewrite, not an evalModes-block addition like slope-triangle's §6l. The `values` per-challenge array dropped from `contextKeys` per §6i #3 — even though the previous wiring never honored it, leaving it in would have been a future cost waste once the tutor context honored it. |
| Tester wiring | Replaced the bare `<MatrixDisplay data={...} />` render case with the canonical `{ ...data, instanceId, skillId, subskillId, objectiveId, onEvaluationSubmit }` spread. Added `result.metrics.type === 'matrix-display'` breakdown block (same 9-field display shape as balance-scale / measurement-tools / slope-triangle). | Pre-refactor the tester rendered matrix-display as a pure visualization with no evaluation routing — same gap as slope-triangle's §6l row. |
| Step-by-step visualizations (the 800+ lines of SVG infographics for 2×2 determinant Sarrus diagrams, multiplication row-by-column animations, etc.) | **Dropped from the active interaction**, replaced with a tighter `StepsReveal` component (~60 lines) gated behind the on-demand "Show steps" button. Reveal panel shows: 2×2 determinant `ad − bc = …` step trace; 3×3 cofactor formula; transpose / add / subtract / multiply / inverse formula + the correct result matrix. | The 800-line SVG infographics were *demo-shape content* — gorgeous but encouraged passive viewing, exactly the §1 "demo session" failure mode. The new gated-reveal preserves the most-useful explanatory content (the formula trace) while making it the student's choice rather than the default. If a future iteration wants the rich SVG visualizations back, they can be re-introduced as a *post-correct* reveal panel rather than the only thing rendered. |

### Files changed

- [gemini-matrix.ts](../service/math/gemini-matrix.ts) — full rewrite around the pool service. Slim wrapper schema (Gemini emits title/description/challengeType/educationalContext/gradeBand only — five fields, no per-matrix data). Per-operation builders (`buildTransposeChallenge`, `buildAddSubtractChallenge`, `buildMultiplyChallenge`, `buildDeterminantChallenge`, `buildInverseChallenge`) each construct one `MatrixDisplayChallenge` with values + pre-computed expected answer. `selectMatrixChallenges` shuffles, dedups via `canonKey`, and falls back to duplicates rather than blocking. `inferGradeBand` parses the gradeLevel string. Dropped the ~250-line pre-refactor Gemini-driven generation + validation block — pool service is deterministic so the post-Gemini fallbacks are no longer needed (§6j #4).
- [MatrixDisplay.tsx](../primitives/visual-primitives/math/MatrixDisplay.tsx) — **full rewrite**, 1349 lines → ~570 lines. New `MatrixDisplayChallenge` and `MatrixChallengeType` exported; `MatrixDisplayData` reshaped with `challenges[]` + session-level keys + evaluation props. `MatrixRenderer` for read-only display, `MatrixInput` for editable result with per-cell correctness coloring, `StepsReveal` for the on-demand walkthrough. Per-challenge reset useEffect resets six state slots. Shared `handleCheck` does both scalar and matrix-input scoring against `expectedScalar` / `expectedMatrix`. `handleNext` records an unrecorded challenge as incorrect (covers the "Skip" path) before calling `advanceProgress`. Session-complete useEffect submits aggregate metrics exactly once. CLAUDE.md shadcn theming throughout (Card, Button, Badge).
- [evaluation/types.ts](../evaluation/types.ts) — added `MatrixDisplayMetrics` (9 canonical fields, same shape as BalanceScale/MeasurementTools/SlopeTriangle); added to `AnyPrimitiveMetrics` union.
- [evaluation/index.ts](../evaluation/index.ts) — re-exported `MatrixDisplayMetrics` next to the other math metrics (auto-resorted by the linter to sit between `HistogramMetrics` and `SlopeTriangleMetrics`).
- [catalog/math.ts](../service/manifest/catalog/math.ts) — rewrote `description` to lead with "Multi-challenge matrix practice session", rewrote `constraints` to forbid the manifest supplying matrix values/dimensions/per-challenge content, multi-challenge `taskDescription` + `contextKeys` (scalar session-level only — per §6i #3), new `MULTI-MATRIX PACING` aiDirective, `OPERATION-AWARE COACHING` rewritten for the actual shipped operations.
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — render case spreads evaluation props; added `result.metrics.type === 'matrix-display'` metrics-breakdown block.

### MatrixDisplayMetrics shipped

```ts
export interface MatrixDisplayMetrics extends BasePrimitiveMetrics {
  type: 'matrix-display';
  challengeType: 'transpose' | 'add' | 'subtract' | 'multiply' | 'determinant' | 'inverse';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;          // Total tries across all challenges
  firstTryCount: number;          // Challenges scoring 100 (first-try correct)
  hintsViewed: number;            // Challenges where the student opened the steps panel
  overallAccuracy: number;        // 0-100, average per-challenge score
  averageAttemptsPerChallenge: number;
}
```

### Lessons (additions to §6a)

#### §6m #1. "Catalog declares supportsEvaluation, component implements nothing" is its own Bucket A failure mode

Slope-triangle (§6l) had no `evalModes` at all in the catalog and no evaluation hook in the component — a self-consistent demo. Matrix-display had **four evalModes declared in the catalog** (`transpose`, `add_subtract`, `multiply`, `determinant_inverse`) plus `supportsEvaluation: true`, but the component shipped without `usePrimitiveEvaluation`, without a metrics interface, without any submit handler. The eval modes existed for the IRT calibration system to route students to a primitive that couldn't actually score them. Every session pinned to one of these modes terminated with no IRT update — worse than the §1 evidence (one binary signal) because there was *no* signal at all.

**Audit hook (broader than §6l #1):** for every catalog entry with `supportsEvaluation: true`, grep the component for `usePrimitiveEvaluation`. If absent, the catalog claim is a lie and the IRT routing is collecting zero signal from that primitive. This is the inverse of §6l's discovery (catalog had no evalModes but the visualization existed) — both shapes need to be searched.

#### §6m #2. Pre-computing expected answers in the generator beats re-deriving at submit time

The pre-refactor component had a `calculateDeterminant()` helper inside the component that re-derived the answer at render time from the live `matrixValues` state. After the refactor, every challenge ships with `expectedScalar` / `expectedMatrix` pre-computed by the generator's builder. Submit-time scoring is a straight `parseFloat(input) === expected` (with 1e-6 tolerance for floats) — no re-derivation, no risk of the answer drifting if state mutates between render and submit.

**Generalization:** for primitives whose challenges have deterministic correct answers (everything in the matrix pool — every operation is pure), pre-compute and store the answer on the challenge object. Don't make the component re-derive at submit. Re-derivation is a class of stale-state bug (§6a #3) that you avoid entirely by storing the answer upstream.

#### §6m #3. Editable result cells with per-cell correctness coloring is reusable for any matrix / table primitive

The new `MatrixInput` component (read-only label cells + editable text inputs in a grid, with optional `highlightCorrect: boolean[][]` for per-cell red/green borders after submit) is a small reusable surface for any primitive whose answer is a 2D number grid: matrix-display (this), but also two-way-table (entry #17 in §3b), and potentially future `gaussian-elimination` or `system-of-equations-solver` primitives. The pattern (`gridTemplateColumns`, `<input inputMode="numeric">` per cell, optional border-color state) is small enough to inline per-component rather than extracting now, but worth noting as the obvious shared component when the next 2D-grid-answer primitive lands.

#### §6m #4. Demo-shape SVG content is a legitimate post-correct reveal, not a default render

The 800+ lines of pre-refactor Sarrus / row-by-column / determinant SVG infographics are *good content* — visually rich and pedagogically clear. They were not the wrong thing to build; they were the wrong thing to render by default. After the refactor they're dropped (the compact `StepsReveal` shows formula + result matrix), but they're a candidate for a future *post-correct* reveal panel: after the student gets the answer right, show the full visualization as the "here's how to think about it" celebration. That keeps the student in the judgment loop until they commit AND preserves the explanatory content.

**Audit hook for future upper-grade Bucket A refactors (histogram, systems-equations, two-way-table):** when the pre-refactor primitive has hundreds of lines of explanatory/visualization code, don't delete it outright — file it as a future post-correct reveal candidate. The refactor's job is to *put* the student in the judgment loop, not to *erase* good explanatory content.

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (no new errors in matrix-display, gemini-matrix, MathPrimitivesTester, evaluation/types, catalog/math; the pre-existing scratch-pad `PrimitiveRenderer` variance noise remains and is unrelated — MatrixDisplay joins the same list as BarModel / PlaceValueChart / TapeDiagram / FactorTree / AreaModel / FunctionMachine / ArrayGrid / FunctionSketch / BalanceScale / MeasurementTools / SlopeTriangle per §6e). |
| `/eval-test matrix-display` across all 4 eval modes | ⏳ Owed |
| Manual UI walk: pin `transpose`, finish 3 distinct matrices (alternating 2×3 / 3×2), observe `PhaseSummaryPanel` + tester metrics breakdown | ⏳ Owed |
| Manual UI walk: pin `add_subtract`, verify per-cell red/green correctness coloring after a wrong submit | ⏳ Owed |
| Manual UI walk: pin `multiply`, verify 2×3 × 3×2 result enters as 2×2 grid | ⏳ Owed |
| Manual UI walk: pin `determinant_inverse`, verify det 2×2 scalar input AND inverse 2×2 matrix input both work | ⏳ Owed |
| Cost spot-check (1× per-session Gemini call — wrapper only, big savings vs the pre-refactor multi-stage generation) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors). |

### Actual effort

~2 hours total: scope audit (component, catalog, tester, types) ~20 min, generator rewrite (per-operation builders + canonical-key dedup + inverse det = ±1 search) ~30 min, component rewrite (1349 → 570 lines including MatrixRenderer + MatrixInput + StepsReveal + judgment loop) ~50 min, metrics interface ~5 min, catalog updates ~10 min, tester wiring (render case + breakdown block) ~5 min, type-check ~5 min. Higher than slope-triangle (§6l) because the judgment-loop UI was net-new (slope-triangle already had Check buttons). Lower than estimated for a "first-time evaluation wiring + UI" entry because so much of the pre-refactor code (the SVG infographics) was *droppable* without losing essential function — the refactor's net-line-count went *down*, not up.

### Next steps (matrix-display + Workstream 3 carry-forward)

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **Manual UI walks for all 4 modes** | Eng | Per §6m validation table. Pin each mode in the tester, complete 3 distinct matrices, confirm "Next Matrix →" advances and the summary panel aggregates correctly. The `determinant_inverse` walk is the most important — verify both the scalar-input determinant path and the matrix-input inverse path within the same session (the mode mixes the two challenge types). |
| 2 | **Cost spot-check** for matrix-display (wrapper-only Gemini call — 5 scalar fields) | Eng | Per §10 — expect significant savings vs pre-refactor since the wrapper schema dropped from ~12 fields with nested per-matrix value arrays to 5 scalar fields. |
| 3 | Workstream 3: `histogram` / `systems-equations` / `two-way-table` refactors | Eng | Three remaining upper-grade Bucket A entries from §3b. Expect the same judgment-loop-is-net-new budget hit per §6l #1 / §6m #1. Pool-service for all three. Two-way-table likely reuses the `MatrixInput` pattern from §6m #3. |
| 4 | Apply §6m #1 audit (grep `supportsEvaluation: true` catalog entries for components without `usePrimitiveEvaluation`) | Eng | Cheap one-pass grep across the catalog + primitives directory. Catches any other primitives where the catalog claims evaluation support but the component doesn't honor it. |
| 5 | Workstream 3: `percent-bar` + `double-number-line` + `strategy-picker` | Eng | Originally-listed §7 entries still pending. Both orchestrator-mixed-type. `double-number-line` needs context coherence. |
| 6 | Workstream 1 (prompt-floor sweep) | Eng | Still pending. |

---

## 6n. Pattern-builder §6a Compliance Audit (Bucket B retrofit) ✅ SHIPPED 2026-05-23

### Why this is a Bucket B retrofit, not a refactor

`pattern-builder` was a Workstream 1 Bucket B primitive — schema already had
`challenges: PatternBuilderChallenge[]`, generator already produced 4-6 per
single-mode session (§5 row shipped, §3a confirmed). It was tagged ✅
Healthy on 2026-05-19 because `challengeCount=4` for `extend`. But the §6a
multi-instance checklist itself was authored during Workstream 2/3 for Bucket A
*refactors* — Bucket B primitives never got run through it. This audit closes
that gap retroactively. No schema, generator, or component logic changed.

### Single-mode re-verification (all five tiers)

| Eval mode | challengeCount | Variance check |
|---|---|---|
| `extend` | 4 | Per-challenge `sequence` differs across all 4; cores escalate AB → AAB → +N → longer-core |
| `identify_core` | 4 | PASS |
| `translate` | 4 | PASS |
| `create` | 4 | PASS |
| `find_rule` | 5 | PASS |

Per-challenge override fields (`sequence`, `translationMapping`,
`availableTokens`) are populated correctly for all single-mode generations,
confirming the §6a #1 "value-only vs content-bearing" boundary doesn't apply
here — pattern-builder's per-challenge data is content-bearing (token lists,
sequences) and Gemini delivers distinct content via a single response schema.
This is the **counterexample** to §6a #2: structured-output Gemini *can* produce
variance for string-array fields when the schema makes per-challenge
differentiation explicit (each challenge's `sequence` is a separate sub-object).

### Gaps closed

| # | §6a item | Status before | Action |
|---|----------|---------------|--------|
| 1 | §6a #5 — catalog `contextKeys` includes `currentChallengeIndex` and `totalChallenges` | Missing | Added to `catalog/math.ts` pattern-builder entry; `taskDescription` prefixed with `"{{totalChallenges}} pattern challenges (currently {{currentChallengeIndex}})"`. Component's `aiPrimitiveData` already supplied both keys. |
| 2 | §6a #9 step 2 — metrics type re-exported from `evaluation/index.ts` | Missing | Added `PatternBuilderMetrics` to the math-phase-2 metrics block; switched the component import to the public barrel. |
| 3 | §6a #10 step 5 — tester results panel has a metrics breakdown | Missing | Added a `result.metrics.type === 'pattern-builder'` block to `MathPrimitivesTester.tsx` rendering the existing domain-specific fields. |

### Out of scope (deferred)

- **§6a #11 — canonical-aggregate metrics shape.** Pattern-builder's metrics
  predate the canonical `correctCount / totalChallenges / firstTryCount /
  averageAttemptsPerChallenge` shape. Current fields are domain-specific
  booleans (`coreIdentifiedCorrectly`, `ruleArticulated`, `patternCreated`,
  `translationCorrect`) that degenerate to `correctCount > 0` in single-mode.
  Migration is recommended but non-blocking — would touch backend evaluation
  consumers. Left for a follow-up; tester panel renders the existing shape so
  no visible regression.
- **`patternTypesExplored` field.** Always reports `1` (initialized to a
  one-element Set with no setter exposed). Drop when the metrics shape is
  canonicalized.

### Lesson — the Bucket B checklist gap

This is the first time the §6a checklist has been applied to a Bucket B
primitive (one that always had `challenges[]`). The audit surfaced three
non-trivial gaps (catalog context keys, barrel re-export, tester breakdown) on
a primitive previously tagged Healthy. **Implication for Workstream 1's
remaining work:** when the §5 prompt-floor sweep lands on `counting-board`,
`length-lab`, `shape-builder`, `skip-counting-runner`, `3d-shape-explorer`,
`ratio-table`, `parameter-explorer`, `ten-frame`, `regrouping-workbench`,
`equation-builder`, `number-bond`, each one needs the §6a #5 / #9 step 2 /
#10 step 5 audit applied — not just the one-line prompt bump. Same template
as pattern-builder's audit; same three files touched (catalog/math.ts,
evaluation/index.ts, MathPrimitivesTester.tsx).

### Files changed

- `service/manifest/catalog/math.ts` — pattern-builder `tutoring.contextKeys`
  and `taskDescription` updated.
- `evaluation/index.ts` — `PatternBuilderMetrics` added to the math-phase-2
  export block.
- `primitives/visual-primitives/math/PatternBuilder.tsx` — metrics import
  consolidated to the public barrel.
- `components/MathPrimitivesTester.tsx` — added pattern-builder metrics
  breakdown panel.

### Validation

- `npx tsc --noEmit` — no new errors in touched files. (Pre-existing
  `ManifestViewer.tsx(12,7)` error unrelated to this work.)
- `/eval-test pattern-builder` across all 5 single-mode tiers — all PASS,
  `challengeCount` ∈ [4, 5].

### Effort

~30 min including the eval-test sweep. No code logic changed; only
registration / catalog / tester surface edits.

---

## 6o. Histogram Post-Mortem (Workstream 3 entry #13 / upper-grade Bucket A) ✅ SHIPPED

### Why histogram next

§3b sequenced histogram as upper-grade entry #13. The §3b row predicted: classic singular schema — `data: number[]`, `binWidth`, `binStart` all flat on the data root. Confirmed in the audit: the pre-refactor primitive shipped ONE dataset per session with a single mode-specific prompt — sometimes correct (shape recognition is a 5-second judgment), but always one binary signal per session per §1 evidence. Like slope-triangle (§6l) and matrix-display (§6m) this was first-time multi-instance wiring; unlike them the per-challenge data isn't a value-pair, it's an entire dataset shaped to a target distribution. The pool-service decision rule from §6a #1 still applies — datasets are value-only — but the "value" is an array of 25-50 numbers sampled from a distribution, not a single scalar.

### What shipped (vs the §3b / §7 row)

| Plan (§3b / §7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Pool service** (value-only — `(data, binWidth, binStart)` tuples per challenge) | **Pool service** with per-mode **distribution-shape builders** — `buildSymmetric`, `buildRightSkewed`, `buildLeftSkewed`, `buildBimodal`, `buildUniform` each emit a dataset with the named shape signature; per-mode builders (`buildIdentifyShape`, `buildFindModalBin`, `buildReadFrequency`, `buildEstimateCenter`) wrap the shape builders with mode-specific context (test scores, heights, temperatures, etc.), bin configs, and pre-computed expected answers. `selectHistogramChallenges` runs the selected mode builder N times with shape-rotation and context-rotation across the N challenges. | Earlier pool-service entries (factor-tree, place-value-chart, area-model) selected from numeric candidate sets. Histogram needs sampled arrays — the "candidate set" is a finite list of *distribution shapes* + a list of *real-world contexts*, and the per-challenge dataset is materialized by sampling from the chosen shape's PDF. Builders are deterministic-on-shape, stochastic-on-sample — every shape produces a structurally correct histogram, but the specific point cloud varies. |
| `challenges: HistogramChallenge[]` (default 3-6) | `challenges: HistogramChallenge[]`, **default 4, max 6**. Per-challenge owns `data`, `binWidth`, `binStart`, `contextTitle`, `xAxisLabel`, `yAxisLabel`, `prompt`, `hint?`, plus mode-specific answer fields (`expectedShape`/`shapeOptions` for identify_shape; `expectedBinStart`/`expectedBinEnd` for find_modal_bin; `targetBinStart`/`targetBinEnd`/`targetFrequency` for read_frequency; `targetStatistic`/`targetAnswer`/`tolerance` for estimate_center). Session-level: `title`, `description`, `challengeType`, `gradeBand`, `showStatistics`. | Mode-specific answer fields on the challenge interface are wider than other primitives (4 distinct mode sub-shapes), but they're optional and only the active mode's fields are populated. Mode dispatch in the component reads `currentChallenge.challengeType` and uses the corresponding answer field set. |
| Stale-state guard per §6a #3 / §6a #8 | **Handler-driven** guard via `recordedRef.current` inside a shared `completeChallenge` helper, with `submittedRef` for the session-complete useEffect. Per-challenge reset effect on `currentChallenge?.id` flips both refs and resets nine state slots (selectedBin, highlightedBin, userAnswer, feedback, feedbackType, attempts, hintViewed, selectedShape, sliderValue). | Submit is button-driven across all four modes — same `recordedRef`-only guard shape as function-sketch (§6i) and balance-scale (§6j). |
| Evaluation: §6a #9 eval-hook migration | **Net-new wiring**: pre-refactor the component had no evaluation hook, no metrics interface, no eval modes wired (catalog had `evalModes` declared but with `supportsEvaluation` semantics not honored end-to-end). Added `usePrimitiveEvaluation<HistogramMetrics>`, new `HistogramMetrics` interface in `evaluation/types.ts`, added to `AnyPrimitiveMetrics` union, re-exported from `evaluation/index.ts`. Same shape as slope-triangle (§6l #1) and matrix-display (§6m #1). | Third Workstream 3 entry where the judgment loop itself was net-new. Same +15-20 min budget hit as slope-triangle predicted. |
| Tester wiring | Render case spreads evaluation props; added `result.metrics.type === 'histogram'` breakdown block. Same 9-field display shape as balance-scale / measurement-tools / slope-triangle / matrix-display. | Per §6a #10. |
| Catalog `taskDescription` / `contextKeys` / aiDirectives | Multi-histogram template — `{{challengeType}}`, `{{currentChallengeIndex}}`, `{{totalChallenges}}`, `{{contextTitle}}`, `{{prompt}}` in `taskDescription`. `contextKeys` includes scalar session-level + active-challenge keys (no per-challenge dataset arrays per §6i #3). New `MULTI-HISTOGRAM PACING` aiDirective covers all four modes. `constraints` clarifies the manifest must NOT supply specific data arrays, bin widths, bin starts, contexts, or answer keys. | Same shape as the catalog updates for slope-triangle (§6l) / matrix-display (§6m). |
| Answer-revealing UI gates (not scoped in PRD) | **`showStatistics: false` for `estimate_center`** — the stats panel that displays mean / median / stdDev is auto-hidden in estimate-center mode so the student can't read the answer off the side panel. **Frequency labels hidden for `find_modal_bin` and `read_frequency`** — the per-bar height labels above each bar would give away the modal bin / target frequency directly. | This is the histogram-specific instance of CLAUDE.md's "never reveal answers in placeholder text, labels, or default UI state." The pre-refactor primitive showed the stats panel + frequency labels universally — for a sandbox demo that's fine; for an evaluable session it's assessment-defeating. See §6o #2 below. |

### Files changed

- [gemini-histogram.ts](../service/math/gemini-histogram.ts) — full rewrite around the pool service. Slim wrapper schema (Gemini emits title/description/challengeType/gradeBand only — four fields, no per-challenge data). Distribution-shape builders (`buildSymmetric`, `buildRightSkewed`, `buildLeftSkewed`, `buildBimodal`, `buildUniform`) emit datasets with named shape signatures. Per-mode builders (`buildIdentifyShape`, `buildFindModalBin`, `buildReadFrequency`, `buildEstimateCenter`) wrap shape builders with mode-specific context (test-score / height / temperature / etc. pools), bin configs, and pre-computed expected answers. `selectHistogramChallenges` runs N challenges with shape + context rotation. `snapToBin` helper rounds estimate-center input to the nearest bin midpoint for tolerance-based scoring. Old per-call Gemini-driven generation replaced.
- [Histogram.tsx](../primitives/visual-primitives/math/Histogram.tsx) — full rewrite. New `HistogramChallenge` and `HistogramChallengeType` exported; `HistogramData` reshaped with `challenges[]` + session-level keys + evaluation props. Per-challenge reset useEffect resets nine state slots. Shared `completeChallenge` helper centralizes per-challenge result recording. Mode-specific submit handlers; `HistogramChart` subcomponent now reads `clickable` / `showFrequency` / `targetBin` / `selectedBinIndex` flags from the active mode. Stats panel auto-hides when `showStatistics === false`. Frequency labels hide for find_modal_bin / read_frequency. New `PHASE_CONFIG` covers all four modes.
- [evaluation/types.ts](../evaluation/types.ts) — added `HistogramMetrics` (9 canonical fields, same shape as BalanceScale / MeasurementTools / SlopeTriangle / MatrixDisplay); added to `AnyPrimitiveMetrics` union.
- [evaluation/index.ts](../evaluation/index.ts) — re-exported `HistogramMetrics`.
- [catalog/math.ts](../service/manifest/catalog/math.ts) — rewrote `description` to lead with "Multi-histogram analysis session"; rewrote `constraints` to forbid the manifest supplying datasets / bin widths / contexts / answer keys; multi-challenge `taskDescription` + `contextKeys`; new `MULTI-HISTOGRAM PACING` aiDirective; mode-specific scaffolding levels.
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — render case spreads evaluation props; added `result.metrics.type === 'histogram'` metrics-breakdown block.

### HistogramMetrics shipped

```ts
export interface HistogramMetrics extends BasePrimitiveMetrics {
  type: 'histogram';
  challengeType: 'identify_shape' | 'find_modal_bin' | 'read_frequency' | 'estimate_center';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;
  firstTryCount: number;
  hintsViewed: number;
  overallAccuracy: number;
  averageAttemptsPerChallenge: number;
}
```

### Lessons (additions to §6a)

#### §6o #1. Pool-service variance can be at the *shape* level, not the *value* level

Factor-tree (§6a #1) varied numeric values from a candidate set. Place-value-chart varied `targetNumber`. Function-machine (§6f #3) introduced operation-family variance. Histogram extends this to **distribution-shape variance**: the pool isn't `{2, 3, 5, 7, ...}` numbers, it's `{symmetric, right-skewed, left-skewed, bimodal, uniform}` shapes. Each "value" in the pool is a *function that samples a dataset* matching the named shape. The shape selector then enforces "≥1 of each shape category appears across the N challenges when N ≥ 5" — the histogram analog of factor-tree's "≥1 odd composite" guarantee.

**Generalization (extension of §6f #3):** pool-service variance is hierarchical. Numeric-value pools (factor-tree, place-value-chart, area-model) live at the leaf. Operation-family pools (function-machine) live one level up. Shape / pattern pools (histogram, future stats primitives) live another level up — the "value" is a function that produces a different artifact each call. The variance-enforcement loop (`families.has(ruleFamily(rule))`-style) generalizes to "shape categories" without changing structure.

#### §6o #2. Mode-specific answer-revealing UI must be gated, not just hidden

Pre-refactor the histogram showed: per-bar frequency labels above each bar, a stats panel with mean / median / stdDev / skew, and a tooltip on hover showing the exact bin count. For a sandbox visualization that's a good UX; for an evaluable session it gives away the answer for `find_modal_bin` (visible bar heights make modal trivial), `read_frequency` (the number above each bar IS the answer), and `estimate_center` (the stats panel literally prints the mean).

**Per-mode UI gating** — the active challenge's mode flips the visibility flags:

| Mode | `showStatistics` | Frequency labels | Bars clickable |
|---|---|---|---|
| `identify_shape` | true | shown | no |
| `find_modal_bin` | true | **hidden** | yes |
| `read_frequency` | true | **hidden** | no |
| `estimate_center` | **false** | shown | no |

The gates are session-level (set on `HistogramData` at generation time) for `showStatistics`, and challenge-derived for the others. The component reads `currentChallenge.challengeType` and switches the relevant UI surface flags on render.

**Generalization (extension of CLAUDE.md's "never reveal answers in placeholder text"):** when refactoring a sandbox-shaped primitive into a multi-instance evaluable session, audit every label, tooltip, panel, and default value in the rendered UI for what it discloses about the current challenge's correct answer. **A primitive's labels can be correct as defaults but wrong as challenges.** Same lesson as slope-triangle's `attachedLine.slope` exposed at render time (§6l #3), but generalized — anything the renderer shows must be okay to expose for the current mode.

#### §6o #3. Continuous-tolerance scoring needs a snap-and-compare pattern

`estimate_center` is the first eval mode in Workstream 3 where the answer is **continuous** — the student types a number like "32.5" or "41" and the correct answer is the dataset's mean (e.g. 32.7) or median. Strict equality is too brittle (32.5 vs 32.7 should both be "correct enough"); blanket float tolerance is too loose (28.0 should not pass when mean=32.7). The shipped pattern: pre-compute `targetAnswer` (the actual mean/median, 32.7) and `tolerance` (±1 bin width, e.g. ±2 for `binWidth = 2`) on the challenge object. Submit-time scoring: `Math.abs(snapToBin(studentAnswer, ...) - snapToBin(targetAnswer, ...)) <= tolerance`. Snapping both sides to the nearest bin midpoint normalizes "32 vs 32.7" to the same bin.

**Generalization:** for continuous-answer modes, store both `targetAnswer` and `tolerance` on the challenge object. Score with `|snap(student) - snap(target)| <= tolerance`, not `Math.abs(student - target) <= tolerance` directly — the snap step is what makes the tolerance pedagogically meaningful (a student rounding to the bin should count the same as a student giving the exact value). This pattern will reappear in any future primitive whose answer is "estimate something visual" (estimate-position-on-numberline, estimate-area, etc.).

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (Histogram joins the existing scratch-pad `PrimitiveRenderer` variance noise list per §6e — expected). |
| `/eval-test histogram` across all 4 eval modes | ✅ All 4 pass — see [histogram-2026-05-22.md](../../../../qa/eval-reports/histogram-2026-05-22.md). Bin frequencies match labeled shapes; modal bins line up with `expectedBinStart`/`expectedBinEnd`; bin filter counts match `targetFrequency`; estimate-center mean/median computations match `targetAnswer` after snap; `showStatistics: false` in estimate-center confirmed hiding the stats panel; frequency labels confirmed hidden in find_modal_bin / read_frequency. |
| Manual UI walk: pin `identify_shape`, finish 4 distinct histograms (each a different shape), observe `PhaseSummaryPanel` + tester metrics breakdown | ⏳ Owed |
| Manual UI walk: pin `find_modal_bin`, verify bar-click interaction + answer-leak prevention (no frequency labels) | ⏳ Owed |
| Manual UI walk: pin `read_frequency`, verify highlighted target bin renders + numeric entry submits | ⏳ Owed |
| Manual UI walk: pin `estimate_center`, verify stats panel hidden + tolerance scoring accepts within ±1 bin width | ⏳ Owed |
| Cost spot-check (1× per-session Gemini call — wrapper only, big savings vs the pre-refactor full schema generation) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors). |

### Actual effort

~2 hours total: scope audit + answer-leak inventory ~20 min, generator rewrite (distribution-shape builders + per-mode wrappers + snapToBin) ~40 min, component rewrite (multi-challenge shell + mode-aware UI gating + per-mode submit handlers + reset useEffect) ~50 min, metrics interface + AnyPrimitiveMetrics union + index re-export ~5 min, catalog updates ~10 min, tester wiring ~5 min. The distribution-shape builders were the longest single chunk — five distribution shapes × small sampling helpers each. Less than slope-triangle (§6l) and matrix-display (§6m) on net because the pre-refactor component already had the histogram chart and stats panel components; the refactor only needed to gate them.

### Next steps (histogram + Workstream 3 carry-forward)

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **Manual UI walks for all 4 modes** | Eng | Per §6o validation table. Identify-shape is the most interesting — verify shape rotation across 4 challenges (no four-in-a-row symmetrics). Estimate-center walk should verify stats panel stays hidden across all 4 challenges. |
| 2 | **Cost spot-check** for histogram (wrapper-only Gemini call) | Eng | Per §10 — expect significant savings vs pre-refactor since the wrapper schema dropped from ~10 fields with nested per-bin arrays to 4 scalar fields. |
| 3 | Apply §6o #2 audit (mode-specific answer-leak inventory) to remaining Bucket A candidates | Eng | Run before the next visualization-shaped primitive refactor. Two-way-table likely has the same exposure (frequency cells visible by default; conditional-probability mode needs them hidden). |
| 4 | Workstream 3: `systems-equations` refactor | Eng | Next §3b upper-grade entry. Pool-service value-only — `(equationA, equationB, intersectionPoint)` tuples per challenge. |
| 5 | Workstream 3: `two-way-table` refactor | Eng | Last §3b upper-grade entry. Pool-service value-only — `(rowCategories, columnCategories, frequencies)` tuples per challenge. Likely reuses the `MatrixInput`-style editable grid from §6m #3. |
| 6 | Workstream 3: `percent-bar` + `double-number-line` + `strategy-picker` | Eng | Originally-listed §7 entries still pending. |
| 7 | Workstream 1 (prompt-floor sweep) | Eng | Still pending. |

---

## 6p. Systems-equations Post-Mortem (Workstream 3 entry #16 / upper-grade Bucket A) ✅ SHIPPED

### Why systems-equations next

§3b sequenced systems-equations as upper-grade entry #16. The §3b row predicted: classic singular schema — `equations: SystemEquation[]` was a flat two-entry array (one system per session, two lines), with no pedagogical instance count. Confirmed in the audit: the pre-refactor primitive shipped ONE system per session — one binary signal per session per §1 evidence. Like slope-triangle (§6l) and matrix-display (§6m) and histogram (§6o), this was first-time multi-instance wiring AND first-time evaluation wiring end-to-end — pre-refactor the component shipped without `usePrimitiveEvaluation`, without a metrics interface, without a Check / Next affordance. Just a static visualization of two lines and their intersection.

### What shipped (vs the §3b / §7 row)

| Plan (§3b / §7 row) | What shipped | Why the deviation |
|---|---|---|
| Generation pattern: **Pool service** (value-only — `(equationA, equationB, systemType, intersectionPoint)` tuples per challenge) | **Pool service** with **two per-form builders** — `buildSlopeInterceptChallenge` for `graph` / `substitution` modes (equations rendered in y = m·x + b form) and `buildEliminationChallenge` for `elimination` mode (equations rendered in a·x + b·y = c form). Each builder uses the **back-solving pattern**: pick an integer solution `(x₀, y₀)` freely, then derive equation parameters so both lines pass through it. For slope-intercept: pick distinct slopes from `SLOPE_POOL_BY_TYPE`, derive `yIntercept = y₀ - slope * x₀`, reject if non-integer or out of viewport. For elimination: pick small-integer coefficients `(a, b)` from `ELIM_COEF_POOL`, compute `c = a*x₀ + b*y₀`, reject if `det == 0` (parallel) or `|c| > 18` (unreasonable arithmetic). `selectSystemsEquationsChallenges` runs the selected builder N times with canonical-key dedup; sorts gentler-systems first by `|x₀| + |y₀|`. | Two builders instead of one because the *display form* differs by mode — graph and substitution show `y = m*x + b`, elimination shows `a*x + b*y = c`. They share the back-solving structure but emit different `systemForm` and `equationA`/`equationB` fields. |
| `challenges: SystemsEquationsChallenge[]` (default 3-6) | `challenges: SystemsEquationsChallenge[]`, **default 4, max 6**. Per-challenge owns `id`, `type`, `systemForm` (`'slope-intercept'` or `'standard'`), `equationA`, `equationB`, `expectedX`, `expectedY`, `instruction`, `hint`. The `SystemEquation` interface carries BOTH structured numeric fields (`slope`, `yIntercept`) AND optional standard-form fields (`a`, `b`, `c`) — slope/yIntercept are always present for canvas drawing; a/b/c populate only for elimination's standard form. The `display` string is the rendered equation for the student. | The dual-form representation is the systems-equations-specific design call. Canvas drawing path always reads `slope` + `yIntercept` (one render path for both forms); display label reads `display` (which is form-aware); submit scoring compares against pre-computed `expectedX` / `expectedY`. Same pattern slope-triangle (§6l #3) used to avoid string-equation parsing at submit time. |
| Stale-state guard per §6a #3 / §6a #8 | **Handler-driven** guard via `recordedRef.current` inside `completeChallenge`. Per-challenge reset effect on `currentChallenge?.id` flips both refs and resets all per-challenge state (x-input, y-input, feedback, attempts, hint-state). | Submit is button-driven (Check Answer). Same `recordedRef`-only shape as function-sketch (§6i) / balance-scale (§6j) / histogram (§6o). |
| Evaluation: §6a #9 eval-hook migration | **Net-new wiring**: pre-refactor the component had no evaluation hook, no metrics interface, no submit handler at all. Added `usePrimitiveEvaluation<SystemsEquationsMetrics>`, new `SystemsEquationsMetrics` interface in `evaluation/types.ts` (note `type: 'systems-equations-visualizer'` matches the catalog id, not a shorter slug), added to `AnyPrimitiveMetrics` union, re-exported from `evaluation/index.ts`. | Fourth Workstream 3 entry where the judgment loop itself was net-new. Same +15-20 min budget hit as slope-triangle / matrix-display / histogram predicted. |
| Tester wiring | Render case spreads evaluation props; added `result.metrics.type === 'systems-equations-visualizer'` breakdown block. Same 9-field display shape as the other multi-instance metrics. | Per §6a #10. |
| Catalog `taskDescription` / `contextKeys` / aiDirectives | Multi-system template — `{{challengeType}}`, `{{currentChallengeIndex}}`, `{{totalChallenges}}`, `{{equationA}}`, `{{equationB}}` in `taskDescription`. `contextKeys` includes scalar session-level + active-challenge equation display strings (per §6i #3: equation display strings ARE scalar, just per-challenge — fine for tutor context). New `MULTI-SYSTEM PACING` aiDirective; `METHOD-AWARE COACHING` covers graph / substitution / elimination separately. `constraints` clarifies the manifest must NOT supply specific equations, slopes, intercepts, or solutions. | Same shape as the catalog updates for slope-triangle (§6l) / matrix-display (§6m) / histogram (§6o). |

### Files changed

- [gemini-systems-equations.ts](../service/math/gemini-systems-equations.ts) — full rewrite around the pool service. Slim wrapper schema (Gemini emits title/description/challengeType/gradeBand only — four fields). `SLOPE_POOL_BY_TYPE` per challengeType; `ELIM_COEF_POOL` for elimination coefficients. `buildSlopeInterceptChallenge` back-solves y-intercepts from a chosen (x₀, y₀); `buildEliminationChallenge` back-solves c from chosen (a, b, x₀, y₀). Both use `inViewport()` to reject lines that wouldn't be drawable. `selectSystemsEquationsChallenges` shuffles, dedups via canonical key, sorts by `|x₀| + |y₀|`.
- [SystemsEquationsVisualizer.tsx](../primitives/visual-primitives/math/SystemsEquationsVisualizer.tsx) — full rewrite. New `SystemsEquationsChallenge` and `SystemsEquationsChallengeType` exported; `SystemsEquationsVisualizerData` reshaped with `challenges[]` + session-level keys + evaluation props. Per-challenge reset useEffect resets all per-challenge state. Shared `completeChallenge` helper. New ordered (x, y) input pair with parse + scoring against `expectedX` / `expectedY`. Canvas drawing reads `slope` / `yIntercept` for both forms (one drawing path); equation display reads `display` (form-aware). New `PHASE_CONFIG_BY_TYPE` covers all three modes.
- [evaluation/types.ts](../evaluation/types.ts) — added `SystemsEquationsMetrics` with `type: 'systems-equations-visualizer'` (matches catalog id, not a shorter slug); added to `AnyPrimitiveMetrics` union.
- [evaluation/index.ts](../evaluation/index.ts) — re-exported `SystemsEquationsMetrics`.
- [catalog/math.ts](../service/manifest/catalog/math.ts) — `description` rewritten to lead with "Multi-challenge systems-of-equations session"; `constraints` rewritten to forbid the manifest supplying equations / slopes / intercepts / solutions; multi-challenge `taskDescription` + `contextKeys`; new `MULTI-SYSTEM PACING` aiDirective; mode-specific scaffolding levels.
- [MathPrimitivesTester.tsx](../components/MathPrimitivesTester.tsx) — render case spreads evaluation props; added `result.metrics.type === 'systems-equations-visualizer'` metrics-breakdown block.

### SystemsEquationsMetrics shipped

```ts
export interface SystemsEquationsMetrics extends BasePrimitiveMetrics {
  type: 'systems-equations-visualizer';
  challengeType: 'graph' | 'substitution' | 'elimination';
  totalChallenges: number;
  correctCount: number;
  attemptsCount: number;
  firstTryCount: number;
  hintsViewed: number;
  overallAccuracy: number;
  averageAttemptsPerChallenge: number;
}
```

### Lessons (additions to §6a)

#### §6p #1. Back-solving from the answer beats forward-search for integer-solution constraints

The pre-refactor approach (and the naïve refactor draft) was to randomly pick equation parameters and then check whether the resulting solution `(x, y)` was an integer pair. For two equations in two unknowns, the integer-solution density is low — most random `(slope_A, yIntercept_A, slope_B, yIntercept_B)` quadruples produce a non-integer intersection. Even with rejection sampling the success rate was ~5%, requiring 20+ attempts per challenge.

**Back-solving** inverts this: pick the integer solution `(x₀, y₀)` first, then derive equation parameters that make both lines pass through it. For slope-intercept: pick `slope_A`, `slope_B` freely (from a curated small-integer pool); derive `yIntercept = y₀ - slope * x₀`. Integer y-intercepts come for free as long as `slope * x₀` is integer — guaranteed when both are integer-from-pool. Success rate goes from ~5% to ~95% (only viewport-failure and parallel-line rejects remain).

For elimination: pick `(a_A, b_A, a_B, b_B)` freely from the integer pool; compute `c = a*x₀ + b*y₀` (always integer when inputs are). Reject only when `det = a_A*b_B - a_B*b_A = 0` (parallel) or when `|c| > 18` (unreasonable RHS magnitude).

**Generalization (extension of §6m #2 "pre-compute expected answers"):** when the per-challenge data must satisfy a *constraint that depends on the answer* (integer solution, balanced equation, clean-output rule, etc.), back-solve from the answer to the data. This is the same shape as §6m #2 ("pre-compute expected answers in the generator") but generalized to "*construct the question from the answer.*" Forward-search rejection sampling is the failure mode this avoids. Applies to: future primitives with integer-solution constraints (Diophantine equations, percent problems with whole-number answers, ratio problems with integer step sizes).

#### §6p #2. Dual-form representations let one canvas drive multiple display modes

Systems-equations renders the same canvas (two lines on a coordinate plane) for all three modes, but the equation *label* is form-aware: slope-intercept for graph / substitution; standard form for elimination. Encoding both forms on the `SystemEquation` interface (`slope` + `yIntercept` always; `a` + `b` + `c` for standard form) lets the canvas drawing code stay form-agnostic — it always reads `slope` + `yIntercept` — while the display label can be authored per form.

The temptation is to convert at render time ("if standard form, parse a*x + b*y = c into m, b") — that's the same submit-time foot-gun slope-triangle (§6l #3) flagged for equation strings, just at render time instead. Pre-compute both forms at generation time and store them on the challenge.

**Generalization (extension of §6l #3):** for any primitive whose challenge has multiple representations (slope-intercept vs standard form; expanded form vs scientific notation vs decimal; vertex form vs standard form vs factored form), store ALL representations on the challenge at generation time. Canvas drawing reads one; display label reads another; submit scoring reads a third (pre-computed numeric answer). Never convert at render or submit.

#### §6p #3. Net-new evaluation wiring becomes a checklist, not a surprise

Slope-triangle (§6l) was the first net-new evaluation entry — the lesson there (§6l #1) was "expect this to happen for upper-grade entries." Matrix-display (§6m) was the second; histogram (§6o) the third; systems-equations the fourth. The same five-step setup applies every time:

1. Add `XxxMetrics` to `evaluation/types.ts` (9 canonical fields).
2. Add to `AnyPrimitiveMetrics` union.
3. Re-export from `evaluation/index.ts`.
4. In the component: `usePrimitiveEvaluation<XxxMetrics>` + session-complete useEffect + `submitEvaluation(goalMet, score, metrics, { studentWork })`.
5. In the tester: render-case spread of evaluation props + `result.metrics.type === 'xxx'` breakdown block.

Plus the catalog: if `evalModes` aren't declared yet, add them (matrix-display had them; slope-triangle didn't; histogram had them but they were aspirational; systems-equations didn't). Add `supportsEvaluation: true`.

**Audit hook (extension of §6m #1):** before scoping any remaining Bucket A refactor, grep the component for `usePrimitiveEvaluation`. If absent, budget +15-20 min for the net-new wiring. The pattern is now mechanical — no design decisions left.

### Validation status

| Step | Status |
|---|---|
| `npx tsc --noEmit` on touched files | ✅ Clean (SystemsEquationsVisualizer joins the existing scratch-pad `PrimitiveRenderer` variance noise list per §6e — expected). |
| `/eval-test systems-equations-visualizer` across all 3 eval modes | ⏳ Owed |
| Manual UI walk: pin `graph`, finish 4 distinct systems, observe `PhaseSummaryPanel` + tester metrics breakdown | ⏳ Owed |
| Manual UI walk: pin `substitution`, verify (x, y) input pair parses, integer solutions enforced | ⏳ Owed |
| Manual UI walk: pin `elimination`, verify standard-form display + integer-coefficient enforcement, no parallel lines | ⏳ Owed |
| Cost spot-check (1× per-session Gemini call — wrapper only) | ⏳ Owed |
| Backend calibration | ✅ No changes needed (mode-level beta priors). |

### Actual effort

~2 hours total: scope audit ~15 min, generator rewrite (back-solving builders + viewport check + canonical-key dedup) ~40 min, component rewrite (multi-challenge shell + dual-form canvas + (x, y) input pair + reset useEffect + session-complete metrics) ~50 min, metrics interface + AnyPrimitiveMetrics union + index re-export ~5 min, catalog updates ~10 min, tester wiring ~5 min, type-check + audit ~5 min. Same order of magnitude as histogram (§6o) and slope-triangle (§6l). The back-solving builders were the longest single chunk — designing them right took two iterations to land at the current shape (forward-search rejected, replaced with back-solving per §6p #1).

### Next steps (systems-equations + Workstream 3 carry-forward)

| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **`/eval-test systems-equations-visualizer`** | Eng | Per §6p validation table. Verify all 3 modes produce 4 distinct integer-solution systems with no parallel-line collisions. |
| 2 | **Manual UI walks for all 3 modes** | Eng | Per §6p validation table. Elimination walk is the most interesting — verify the standard-form display (a*x + b*y = c) renders with correct sign-aware spacing, and that the coefficient pool stays within `{±1, ±2, ±3}` so the arithmetic is K-3-adjacent in difficulty even though the algebra is grade 8+. |
| 3 | **Cost spot-check** for systems-equations (wrapper-only Gemini call) | Eng | Per §10 — expect significant savings vs pre-refactor since the wrapper schema dropped from a per-equation array to 4 scalar fields. |
| 4 | Workstream 3: `two-way-table` refactor | Eng | **Now the only remaining upper-grade Bucket A entry.** Pool-service value-only — `(rowCategories, columnCategories, frequencies)` tuples per challenge. Likely reuses `MatrixInput`-style editable grid from §6m #3 + histogram's mode-specific UI gating from §6o #2 (conditional-probability mode hides cell totals). |
| 5 | Workstream 3: `percent-bar` + `double-number-line` + `strategy-picker` | Eng | Originally-listed §7 entries still pending. Both orchestrator-mixed-type. `double-number-line` needs context coherence enforcement. |
| 6 | Workstream 1 (prompt-floor sweep) | Eng | Still pending. |

---

## 7. Workstream 3: Apply Template to Remaining Bucket A Primitives

After `factor-tree` establishes the pattern, apply to:

| Primitive | Singular field today | Refactor target | Generation pattern (per §6a #1) | Notes |
|-----------|----------------------|-----------------|---------------------------------|-------|
| `tape-diagram` ✅ **SHIPPED** | ~~`wordProblem`, `part1/2/3Value/Label`~~ → `challenges: TapeDiagramChallenge[]` (default 4, max 6) | Shipped | **Orchestrator-same-mode** (per §6a #7) — N parallel calls of the per-mode sub-generator. See §6c for ship details. Pattern matched bar-model: internal per-mode dispatch existed, so same-mode reduction applied. |
| `bar-model` ✅ **SHIPPED** | ~~`challenge?: BarModelChallenge`~~ → `challenges: BarModelChallenge[]` (default 4, max 6) | Shipped | **Orchestrator-same-mode** (per §6a #7) — N parallel calls of the per-mode sub-generator. See §6b for ship details. |
| `place-value-chart` ✅ **SHIPPED** | ~~`targetNumber`~~ → `challenges: PlaceValueChartChallenge[]` (default 3, max 6 per §6d pilot decision) | Shipped | **Pool service** (value-only — leverages existing `createNumberPool` per [NUMBER_POOL_SERVICE.md](../service/math/NUMBER_POOL_SERVICE.md)) | Shipped. See §6d for ship details. Pilot at 3 instances. New within-challenge "challenge-done" phase with explicit "Next Number" affordance — candidate pattern for other multi-phase primitives. |
| `percent-bar` ✅ **SHIPPED** | ~~single `scenario`/`challengeType` + in-component `explore → practice → apply` phase walk on one problem~~ → `challenges: PercentBarChallenge[]` (default 4, max 6) | Shipped | **Pool service** (per-mode scenario builders: 4 modes × 5-7 templates × rate/base pools) | Shipped 2026-05-23. See §6q. Confirmed the §6f #1 in-component phase navigator anti-pattern (explore/practice/apply walk on one shared problem). Refactor: dropped the navigator, made each challenge an independent percent problem of the pinned eval mode (`direct` / `subtraction` / `addition` / `comparison`), and used a pre-authored scenario template pool — scenarios like "$50 shirt, 25% off" are parameterized from `(rate, base) => string` template functions per mode. Per-mode `targetPercent` derivation is now in code (§6q #1) — subtraction targets `100 - rate`, comparison targets `max(rateA, rateB)`. Canonical 9-field metrics collapsed from a 21-field per-phase shape (§6q #4). |
| `double-number-line` ✅ **SHIPPED** | ~~single `contextQuestion`/labels + 3-phase explore→practice→apply walk~~ → `challenges: DoubleNumberLineChallenge[]` (default 4, max 6) with shared session-level `topLabel` / `bottomLabel` / `unitRate` | Shipped | **Hybrid: 1 Gemini wrapper call + local per-mode pool construction** (new pattern, §6r #1) | Shipped 2026-05-23. See §6r. Context coherence enforced by construction — the wrapper Gemini call pins `(topLabel, bottomLabel, unitRateOutput)` once per session and emits a pool of candidate `askInputs: number[]`; local per-mode builders (`buildEquivalentRatiosChallenge` / `buildFindMissingChallenge` / `buildUnitRateChallenge`) deterministically derive `givenPoints` / `targetPoints` / `prompt` / `hint` per challenge. Same phase-navigator anti-pattern as percent-bar (§6q) — dropped. Includes `correctInvertedRatio` validator catching Gemini emitting `unitRate=1/N` when context states `1 X = N Y` (§6r #2). New "hybrid" generator pattern is now a documented third option alongside Fork A (pool-service) and Fork B (orchestrator). |
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
5. ~~`percent-bar`, `double-number-line` — older grades, lower K-3 priority. Both orchestrator-mixed-type; double-number-line needs context coherence enforcement.~~ ✅ **BOTH SHIPPED 2026-05-23** — percent-bar via pool-service per-mode scenario builders (§6q); double-number-line via the new hybrid wrapper + local-pool pattern (§6r #1) which solves the context-coherence problem structurally rather than via prompt rules.
6. ~~`function-machine` — special case, design discussion first.~~ ✅ **SHIPPED** — third pool-service entry. Design Q resolved: N rules per session. See §6f.
7. ~~`ordinal-line` — K-1 number sense. Discovered as Bucket B-mixed in production after the original §3 audit.~~ ✅ **SHIPPED 2026-05-19** — mixed-pattern primitive (pool-service for 4 modes, orchestrator for sequence-story). See §6g.
8. ~~`array-grid` — K-2 multiplication intro. Newly identified via §3a re-audit; pool-service, value-only.~~ ✅ **SHIPPED 2026-05-19** — fourth pool-service entry in Workstream 3. See §6h.
9. ~~`fraction-bar` — elementary fraction introduction (2-6). Newly identified via §3a re-audit; pool-service, value-only across all four modes.~~ ✅ **SHIPPED 2026-05-19** — fifth pool-service entry. Per-mode operand generators + local MC distractor builder; component refactored to walk N fractions sequentially via `useChallengeProgress`. `strategy-picker` remains on backlog.

**§3b additions (2026-05-20):** the full-folder static-scan audit added **8 new Bucket A primitives** to the long-term backlog. K-3 priorities (#1-#2 above) unchanged; mid-elementary additions:

10. ~~`function-sketch` — function-sketching (5.OA / 6.EE). Effective Bucket A (`challenges: [result.challenge]` wrapper). Recommended pattern: **orchestrator-same-mode** (per §6a #7) — the per-mode subgenerators already exist (`generateIdentifyFeatures`, `generateClassifyShape`, `generateSketchMatch`, `generateCompareFunctions`); each emits a singular result that just needs to be called N times in parallel and wrapped as `challenges[0..N-1]`. Same shape as bar-model's pilot refactor.~~ ✅ **SHIPPED 2026-05-20** — see §6i. Confirmed the §3b "same shape as bar-model's pilot refactor" prediction; ~45 min total because the eval-hook migration was already complete from a prior pass.
11. ~~`balance-scale` — equality / algebra prep (K-5+). Effective Bucket A (`challenges?` declared but never populated). Recommended pattern: **pool-service** (value-only) — equations decompose into deterministic `(leftSide, rightSide, variableValue)` tuples per eval mode. Same shape as factor-tree.~~ ✅ **SHIPPED 2026-05-21** — see §6j. Per-mode equation builders + canonical-key dedup; component already multi-instance-aware so the refactor was generator-heavy (~1.5 hours total). Confirmed the §3b "same shape as factor-tree" prediction.
12. ~~`measurement-tools` — 3.MD measurement. Reclassified from §5 to Bucket A. Recommended pattern: **pool-service** (value-only — `(shapeType, dimensions)` tuples per challenge).~~ ✅ **SHIPPED 2026-05-21** — see §6k. Confirmed the §3b "pool-service value-only" prediction; per-mode width pools (measure / compare / estimate / convert) + canonical-key dedup; component already had `useChallengeProgress` wiring so the rewrite was mostly schema-renaming + reset useEffect + flattened metrics (~1.5 hours total).

Upper-grade Bucket A entries (#13-#17 below) are tracked but lower priority — the engine's content-density pressure compounds where students are routed most. Pick up only after K-3 + mid-elementary backlog is clear:

13. ~~`histogram` (6-8) — `(data, binWidth, binStart)` tuples per challenge.~~ ✅ **SHIPPED 2026-05-22** — see §6o. Pool-service with distribution-shape builders (symmetric / right-skewed / left-skewed / bimodal / uniform) emitting datasets with named shape signatures; per-mode wrappers (`buildIdentifyShape`, `buildFindModalBin`, `buildReadFrequency`, `buildEstimateCenter`) attach mode-specific context, bin configs, and pre-computed expected answers. Introduced mode-specific answer-leak UI gating (§6o #2) and continuous-tolerance scoring with snap-to-bin (§6o #3). All 4 eval modes pass eval-test (see [histogram-2026-05-22.md](../../../../qa/eval-reports/histogram-2026-05-22.md)).
14. ~~`matrix` (8-12) — `(rows, columns, values, operationType)` tuples per challenge.~~ ✅ **SHIPPED 2026-05-22** — see §6m. Pool-service with per-operation builders (`buildTransposeChallenge`, `buildAddSubtractChallenge`, `buildMultiplyChallenge`, `buildDeterminantChallenge`, `buildInverseChallenge`); inverse-mode enforces det = ±1 so A⁻¹ has integer entries; expected results pre-computed on the challenge. First Workstream 3 entry where the **judgment loop itself was net-new** (catalog claimed `supportsEvaluation: true` but the component had no submit / no scoring path — see §6m #1).
15. ~~`slope-triangle` (8) — `(attachedLine, triangleConfig)` tuples per challenge.~~ ✅ **SHIPPED 2026-05-22** — see §6l. Confirmed the §3b "pool-service value-only" prediction; per-mode slope + run pools with viewport-safe intercept selection; net-new evaluation hook + SlopeTriangleMetrics + 3-mode evalModes block.
16. ~~`systems-equations` (8) — `(equationA, equationB, systemType, intersectionPoint)` tuples per challenge.~~ ✅ **SHIPPED 2026-05-23** — see §6p. Pool-service with two per-form builders (`buildSlopeInterceptChallenge` for graph/substitution; `buildEliminationChallenge` for elimination); **back-solving** from the integer (x₀, y₀) solution to equation parameters guarantees integer-solution constraints with ~95% sample acceptance (vs ~5% for forward-search rejection sampling — see §6p #1). Dual-form representations (slope-intercept + standard form) on `SystemEquation` let the canvas draw form-agnostically while the display label stays form-aware (§6p #2). Net-new evaluation wiring + 3-mode evalModes block.
17. `two-way-table` (7-8) — `(rowCategories, columnCategories, frequencies)` tuples per challenge. **Last remaining upper-grade Bucket A entry.** Pool-service per-mode; expected to reuse `MatrixInput`-style editable grid from §6m #3 + mode-specific UI gating from §6o #2 (conditional-probability mode hides cell totals to prevent answer leak).

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
6. ~~**K-3 only, or all-math sweep?**~~ **Resolved (2026-05-20, §3b):** static-scan across all 57 math generators confirmed the Bucket A pattern persists in upper grades (histogram, matrix, slope-triangle, systems-equations, two-way-table) and mid-elementary (function-sketch, balance-scale, measurement-tools). Workstream 1 prompt-floor updates apply across all math (and §3b added ten-frame / regrouping-workbench / equation-builder / number-bond to the §5 table). Workstream 3 schema refactors are prioritized K-3 first, mid-elementary second, upper-grade last — see §3b sequencing table. The "K-3 only" framing was a useful initial scope; the pattern itself isn't grade-band-specific.
7. **(New, from pilot)** Should `selectFactorTreeRootValues` be generalized into the shared `numberPoolService` as a `createCandidateSetPool({ candidates, count, varianceGuarantees })` helper? Workstream 3 has two more value-only primitives (`place-value-chart`, `area-model`) — if their selection logic looks similar, generalize after the second use, not before.
