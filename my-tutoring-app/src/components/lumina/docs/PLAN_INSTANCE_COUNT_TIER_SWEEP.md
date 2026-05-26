# Plan: Instance-Count Tier Sweep

**One-liner:** Apply [§5a tier table](PRD_WITHIN_MODE_INSTANCE_DENSITY.md#5a-per-mode-instance-count-tiers) to every shipped Bucket A/B math primitive. Replace the single `DEFAULT_INSTANCE_COUNT` constant with a per-mode `COUNT_BY_MODE` table so fast-tap modes bump up and nested multi-phase modes hold or drop.

**Owner:** Eng
**Status:** 🟡 In progress (created 2026-05-24). B1 + B2 code changes landed 2026-05-24. **B3 + B4 code changes landed 2026-05-25** — type-check clean across all 25 touched generators. B2 surfaced 1 resolved + 2 remaining open items; B4 surfaced 1 new item (bar-model "count_object" mode-name) — see ["B2 open items"](#b2-open-items-surfaced-by-mechanical-sweep-2026-05-24) and ["B4 open items"](#b4-open-items-surfaced-by-mechanical-sweep-2026-05-25). Pending `/eval-test` + stopwatch walks before B5 is started. Full state in the [Status tracker](#status-tracker) below.
**Source of truth:** [PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a](PRD_WITHIN_MODE_INSTANCE_DENSITY.md#5a-per-mode-instance-count-tiers) — do not re-derive tiers here.

---

## Done when

- Every primitive in the §5a tier table ships its per-mode count via a `COUNT_BY_MODE` table.
- `/eval-test <primitive> --evalMode <mode>` returns the recommended count for every entry.
- Manual stopwatch walk for each touched mode lands inside its tier's target session length (T1 1.5-3 min, T2 2-4 min, T3 3-5 min, T4 4-7 min).
- §5a "Sequencing" list is fully ticked.

---

## Mechanical recipe (per primitive)

Same three touches every time. ~15-20 min per primitive once the pattern is muscle memory.

### 1. Generator — add `COUNT_BY_MODE` next to `MODE_PROFILES`

In `service/math/gemini-<primitive>.ts`:

```ts
const DEFAULT_INSTANCE_COUNT = <tier fallback>;
const MAX_INSTANCE_COUNT = <tier max>;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  // copy from §5a per-mode table
};

// In the existing selection helper / generate function:
const target = Math.max(
  1,
  Math.min(
    MAX_INSTANCE_COUNT,
    config?.instanceCount ?? COUNT_BY_MODE[challengeType] ?? DEFAULT_INSTANCE_COUNT,
  ),
);
```

For **Bucket B prompt-driven** primitives (count baked into prompt text), template the per-mode count into the prompt at build time instead of leaving a "Generate 4-6" range:

```ts
const count = COUNT_BY_MODE[challengeType] ?? DEFAULT_INSTANCE_COUNT;
const prompt = `Generate exactly ${count} challenges...`;
```

### 2. Verify with `/eval-test`

```
/eval-test <primitive>
```

Assert `validation.challengeCount === COUNT_BY_MODE[mode]` for every single-mode eval. If a mode comes back at the wrong count, the `target` clamp is wrong or the prompt is overriding the table.

### 3. Stopwatch walk

Pin each touched mode in the tester, complete the full session at student pace, time end-to-end. Confirm the result lands in the tier's target session length. If a mode misses its tier band, update the `COUNT_BY_MODE` entry (not the §5a tier table).

### Per-primitive PR scope

One PR per primitive. Title: `feat(lumina): per-mode instance counts for <primitive> (§5a)`. Body links the §5a row + the eval-test + stopwatch results.

---

## Batches (ship in order)

Sequenced highest-impact first per §5a. Each batch is independent — different engineers can take different batches in parallel.

### B1 — Validate the framework (1 primitive, ship first) — 🟡 code shipped 2026-05-24

| # | Primitive | Modes touched | Current → Target | Pattern | Status |
|---|-----------|---------------|------------------|---------|--------|
| 1 | `compare-objects` | all 4 (`identify_attribute`, `compare_two`, `order_three`, `non_standard`) | 4-5 → **7** | Per-type sub-generator (one Gemini call per mode; templated `count` into prompt + schema description + `Math.min(count, items.length)` reconstruction clamp) | 🟡 Code shipped 2026-05-24; pending `/eval-test` + stopwatch walk |

**Why first:** the trigger primitive. Validates the tier framework on a real T1 case before touching anything else. Single primitive, no orchestrator-cost risk. **Outcome:** Recipe held; pattern shape ended up matching the "per-type sub-generator" variant (slightly different from the `MODE_PROFILES`-style central-clamp pattern the recipe defaults to) — both shapes are now covered by the recipe and the [B2 mechanical sweep summary](#b2-mechanical-sweep-summary-for-the-record) below.

### B2 — Free T1 bumps (pool-service, no token cost) — 🟡 code shipped 2026-05-24

All pool-service. Going 4→7 is one `COUNT_BY_MODE` table per primitive, no Gemini cost change.

**Status:** Code changes landed across all 10 generators on 2026-05-24. Type-check clean across the full batch. 1 open item was resolved during the sweep (`fraction-bar.identify` pool expansion — see [B2 resolved items](#b2-resolved-items)); 3 open items remain — see [B2 open items](#b2-open-items-surfaced-by-mechanical-sweep-2026-05-24) below. Pending `/eval-test` + stopwatch walks. The two audit hooks below are now standing rules; the second was surfaced by this sweep.

| # | Primitive | Modes touched | Current → Target |
|---|-----------|---------------|------------------|
| 2 | `ordinal-line` | `identify`, `match`, `relative_position` | 4 → **7** |
| 3 | `array-grid` | `count_array`, `multiply_array` | 4 → **7** |
| 4 | `fraction-bar` | `identify` | 3 → **7** |
| 5 | `factor-tree` | `guided_small` | 4 → **7** |
| 6 | `hundreds-chart` | `highlight_sequence` | 4 → **7** |
| 7 | `number-line` | `identify` | 4 → **7** |
| 8 | `pattern-builder` | `extend` (continue-shape modes) | 4 → **6** |
| 9 | `skip-counting-runner` | `count_along`, `predict`, `fill_missing` | 4-5 → **6** |
| 10 | `ten-frame` | `build`, `count_shown`, `subitize` | 4-5 → **7** |
| 11 | `counting-board` | `count_all`, `subitize`, `subitize_perceptual` | 4-5 → **7** |

**Audit hooks (run both before bumping):**
1. **Orchestrator vs pool-service.** Before bumping past 6, confirm the mode is pool-service. If orchestrator, leave at 5 and queue the pool-service migration separately.
2. **Pool size ≥ target count.** For deterministic pool-service primitives, grep the per-mode operand generator for its hardcoded candidate list. If `pool.length < COUNT_BY_MODE[mode]`, the session will cycle through repeats — every student sees the same fraction/shape/number 2-3× per session, which weakens IRT discrimination and invites autopilot. Either expand the pool to ≥ count, OR cap the count at pool size, OR accept the repetition with explicit pedagogical justification (e.g., vocabulary overlearning) noted in the PR body. Surfaced by `fraction-bar.identify` (pool=3, count=7) during the 2026-05-24 sweep.

### B3 — T4 cuts (drop session length back inside the band) — 🟡 code shipped 2026-05-25

| # | Primitive | Modes touched | Current → Target | Why | Status |
|---|-----------|---------------|------------------|-----|--------|
| 12 | `tape-diagram` | `solve_part_whole`, `multi_step` | 4 → **3** | 3-phase explore→practice→apply per challenge × 4 = ~6 min sessions past the T4 7-min ceiling | 🟡 Code shipped 2026-05-25; pending `/eval-test` + stopwatch walk |

Only "cut" in the sweep. Same template as place-value-chart — confirm the cut doesn't break the `usePhaseResults` aggregation.

**Implementation note:** Added per-mode `COUNT_BY_MODE` to `gemini-tape-diagram.ts` covering all four modes (`represent`/`solve_comparison` held at 4 per the §5a T3 row, `solve_part_whole`/`multi_step` cut to 3). `DEFAULT_INSTANCE_COUNT` set to 4 (T3 fallback) and `MAX_INSTANCE_COUNT` set to 5 (T3 hard max) so future modes added without a table entry land in the safe band.

### B4 — T2 bumps (4 → 5, small but broad) — 🟡 code shipped 2026-05-25

Single-step compute or build. Each is a 1-line edit per generator.

**Status:** Code changes landed across all 13 remaining B4 generators on 2026-05-25 (plus the opportunistic `array-grid.build_array` already landed on the same day during B2 stopwatch prep). Type-check clean across the full batch. Pattern distribution observed during the sweep:

- **Central-clamp pattern** (`COUNT_BY_MODE` + `Math.min` clamp at the per-mode selection helper): `balance-scale`, `factor-tree` (non-T1 modes), `function-machine`, `slope-triangle`, `bar-model`, `matrix`. Same shape used in B2.
- **Prompt-template pattern** (per-mode count templated into the prompt + the session description): `histogram`, `area-model`, `function-sketch`. Required hoisting the count resolution above the prompt build using `evalConstraint?.allowedTypes[0]` as the presumed mode.
- **Bucket-B prompt-driven pattern** (count baked into the prompt's "Generate exactly N" line + defensive `slice(0, instanceCount)` after the validation filter): `comparison-builder`, `multiplication-explorer`, `equation-builder`, `number-bond`. The legacy "Generate 3-5/4-6/3-6" range string is now templated to an exact per-mode count; `challengeCount` config still wins when the manifest sets it (`equation-builder` + `number-bond`).

`matrix` is T2 but held at 4 (not 5) per the §5a matrix-specific note (per-mode interaction is heavier than other T2 entries). `bar-model` only bumped the named T2 mode (`compare_bars`) — see [B4 open items](#b4-open-items-surfaced-by-mechanical-sweep-2026-05-25) item #1 for the `count_object` divergence. Other bar-model modes left at the current default of 4 since they aren't classified in §5a.

| # | Primitive | Modes touched | Current → Target |
|---|-----------|---------------|------------------|
| 13 | `bar-model` | `compare_bars`, simple `count_object` | 4 → **5** |
| 14 | `balance-scale` | `equality`, `equality_hard`, `one_step` | 4 → **5** |
| 15 | `comparison-builder` | all | 4-6 → **5** |
| 16 | `multiplication-explorer` | all | 3-6 → **5** |
| 17 | `factor-tree` | `guided_medium`, `unguided`, `unguided_large`, `assessment_intro`, `assessment` | 4 → **5** |
| 18 | `function-machine` | `observe`, `predict` | 3 → **5** |
| 19 | `area-model` | `find_area`, `perimeter`, `factor` | 3 → **5** |
| 20 | `histogram` | all | 4 → **5** |
| 21 | `slope-triangle` | all | 4 → **5** |
| 22 | `equation-builder` | all | 3-5 → **5** |
| 23 | `number-bond` | all | 3-5 → **5** |
| 24 | `array-grid` | `build_array` | 4 → **5** _(✅ landed 2026-05-25, opportunistic alongside B2 stopwatch walks)_ |
| 25 | `function-sketch` | `identify-features`, `classify-shape`, `compare-functions` | 4 → **5** |
| 26 | `matrix` | all | 3 → **4** |

`matrix` is T2 but holds at 4 because the per-mode interaction is heavier than other T2 entries.

### B5 — T3 holds (audit only, no count change)

Re-confirm these are correctly sized at 4. No code change unless stopwatch lands outside the T3 band.

`tape-diagram.represent`, `tape-diagram.solve_comparison`, `bar-model.graph_word_problem`, `percent-bar` (all), `double-number-line` (all), `function-machine.discover_rule` / `create_rule`, `area-model.multiply` / `build_model`, `systems-equations` (all), `function-sketch.sketch-match`, `balance-scale.two_step_intro` / `two_step`, `ordinal-line.sequence_story`.

If any mode lands outside the T3 3-5 min band, file a separate ticket — these are orchestrator-cost-sensitive and need a budget call, not a count bump.

---

## Status tracker

Tick the batch row when every primitive in it has a merged PR + passing eval-test + stopwatch evidence in the PR body. Update this file as part of each PR.

| Batch | Primitives | Status |
|---|---|---|
| B1 — Framework validation | compare-objects | 🟡 Code change landed 2026-05-24 — pending `/eval-test` + stopwatch walk |
| B2 — Free T1 bumps | 10 primitives | 🟡 Code changes landed 2026-05-24, type-check clean across all 10 generators. 1 resolved + 2 remaining open items below. Pending `/eval-test` + stopwatch walks. |
| B3 — T4 cut | tape-diagram | 🟡 Code change landed 2026-05-25, type-check clean. Pending `/eval-test` + stopwatch walk. |
| B4 — T2 bumps | 14 primitives (13 + opportunistic array-grid.build_array) | 🟡 Code changes landed 2026-05-25, type-check clean across all 13 generators. 1 open item below. Pending `/eval-test` + stopwatch walks. |
| B5 — T3 audit | 11 primitive-modes | ⏳ Not started |

### B2 open items (surfaced by mechanical sweep 2026-05-24)

These are the kinds of findings B1's framework-validation step was meant to catch — surfaced now so they can be resolved before `/eval-test` + stopwatch walks.

1. **`ten-frame.count_shown` does not exist as a mode.** Actual ten-frame challenge types are `build`, `subitize`, `make_ten`, `add`, `subtract`. The B2 sweep best-guess-mapped `count_shown` → `make_ten` (semantic match: N counters shown, student finds complement). **Action:** confirm intended mode and update §5a row + this plan; revert the bump if the mapping is wrong.
2. **`number-line.identify` cannot bump to 7 — capped at 5.** The `plot_point` sub-generator (which serves both `identify` and `plot` eval modes) is orchestrator-per-challenge (one Gemini call per challenge), not pool-service. Per the B2 audit hook, capped `plot_point` at 5. **Action:** queue a pool-service migration ticket for `plot_point` so the 7 target can be hit in a follow-up.
3. ✅ **B4 factor-tree mode names diverge from plan** (resolved 2026-05-25). B4 row originally listed `guided_medium`, `guided_large`, `open`; actual modes are `guided_medium`, `unguided`, `unguided_large`, `assessment_intro`, `assessment`. Updated the B4 row above with the correct names — all 5 non-T1 modes go to 5 per T2 in the B4 sweep.

### B4 open items (surfaced by mechanical sweep 2026-05-25)

1. **`bar-model` plan row references a `count_object` mode that does not exist.** B4 row #13 lists "compare_bars, simple count_object" 4 → 5, but `BarModelEvalMode` is `compare_bars | read_scale | picture_graph | scaled_bar_graph | graph_word_problem | build_graph` — there is no `count_object`. The B4 sweep bumped only `compare_bars` to 5 and left the other modes at the current default of 4 (not classified in §5a). **Action:** confirm whether the plan text was a typo for one of the existing modes (most likely `picture_graph` — "count objects" reads like icon-counting) and update §5a + this plan accordingly. If the bump was intended for another mode, file a follow-up B4 PR to add it to `COUNT_BY_MODE`.

### B2 resolved items

- ✅ **`fraction-bar.identify` operand pool expansion** (resolved 2026-05-25). `identifyOperands` originally had only 3 unique unit fractions (1/2, 1/3, 1/4) cycling at count=7 (each fraction seen 2-3× per session, every 3rd challenge). Expanded the pool to the CCSS 3.NF.A.1 canonical set {1/2, 1/3, 1/4, 1/6, 1/8} — 5 unit fractions, so the pool cycles once across a 7-challenge session (one fraction repeats, spaced every 5th challenge instead of every 3rd). Rationale: kept the "unit fractions" identity intact, matched what 3rd-grade textbooks actually show (denominators that decompose into halves/quarters), and avoided 1/5 because it's not in the CCSS list and doesn't decompose cleanly. Updated `gemini-fraction-bar.ts` operand pool + promptDoc, and `catalog/math.ts` description. The pool-size audit dimension this surfaced has been added to the B2 audit hooks above. **Follow-up cleanup (out of scope, low-priority):** the legacy "(2-3)" / "(3-4)" / etc. instance-count hints in `fractionBarWrapperSchema.challengeType.description` and the `fraction-bar` `constraints` string in `catalog/math.ts` are now stale (count is set in code via `COUNT_BY_MODE`, not by Gemini). Harmless but misleading to future readers.

### B2 nits (plan-text only, no code action)

- `ordinal-line`: plan listed mode as `relative_position` (underscore); file's canonical key is `relative-position` (hyphen). Code uses hyphen — no impact, plan can be updated for accuracy.

### B2 mechanical sweep summary (for the record)

All 10 B2 generators received the per-mode `COUNT_BY_MODE` recipe on 2026-05-24. Pattern distribution observed:
- **Central-clamp pattern** (`DEFAULT_INSTANCE_COUNT` + single `Math.min` clamp): `ordinal-line`, `array-grid`, `fraction-bar`, `factor-tree`, `number-line`. Single-line clamp edit; `resolveCount()` keyed off `evalConstraint.allowedTypes[0]` for the constrained path.
- **Prompt-driven single-call pattern** (one Gemini call per session, count baked into prompt + schema description): `hundreds-chart`, `pattern-builder`, `skip-counting-runner`, `ten-frame`, `counting-board`. Required converting a static schema `const` to a `buildXSchema(count)` factory and adding a defensive `slice(0, count)` clamp after the validator filter.
- **Per-type sub-generator pattern** (one Gemini call per challenge type, like B1's compare-objects): none in B2; first observed in compare-objects.

The plan recipe accommodates both shipped patterns. Future primitives should land in one of them, not a fourth shape.

---

## Next steps to close B1 + B2 + B3 + B4

Before B5 audit is started:

1. **Resolve the remaining open items above** — the 2 remaining B2 items (ten-frame mode-name confirmation + number-line pool-service migration ticket) and the 1 new B4 item (bar-model `count_object` mode-name).
2. **Run `/eval-test` for each touched mode** — assert `validation.challengeCount === COUNT_BY_MODE[mode]` for all 25 touched primitive×mode combinations. Bag-of-tasks; parallelizable. Bucket-B prompt-driven primitives (B4 `comparison-builder`, `multiplication-explorer`, `equation-builder`, `number-bond`) are the highest-risk for off-by-one returns from Gemini — the defensive `slice` clamp protects against over-shoot, but under-shoot will show up here.
3. **Stopwatch walks for each touched mode** — confirm T1 1.5-3 min band (B1+B2), T2 2-4 min band (B4), T3 3-5 min band (B3 `represent`/`solve_comparison`), T4 4-7 min band (B3 `solve_part_whole`/`multi_step` at the new count of 3). Single engineer with a stopwatch, ~30 sec setup + 1-3 min per mode.
4. **Re-run `/pulse-agent`** after B1+B2+B3+B4 are stopwatch-confirmed, before B5 audit. Session length changes will shift IRT update density meaningfully — B3 cuts session length for tape-diagram T4 modes by 25%, B4 bumps it ~25% for many T2 modes; the comparison from §10 is the gate.
5. **B5 audit** can run in parallel with steps 2-4 (no code changes unless an outlier surfaces).

---

## Effort estimate

- **B1** — ~30 min (one primitive + framework write-up in the PR for posterity)
- **B2** — 10 × ~15 min = ~2.5 hours
- **B3** — ~20 min (single primitive, but cut needs more careful walk)
- **B4** — 14 × ~15 min = ~3.5 hours
- **B5** — ~10 min per audit × 11 = ~2 hours (no code change unless an outlier surfaces)

**Total:** ~1.5 days of focused work, parallelizable across 2-3 engineers if needed. B2 and B4 are bag-of-tasks and can be split arbitrarily; B1 must ship first so the framework is proven before bulk rollout.

---

## Risks / out of scope

- **Orchestrator-cost surprises.** B2 assumes every T1 entry listed is pool-service. If the audit hook surfaces an orchestrator mode (e.g., a `pattern-builder.extend` variant turns out to be content-bearing), defer that mode to a separate pool-service migration ticket — do not bump it.
- **`/pulse-agent` regression.** Session length changes will shift IRT update density. Re-run the pulse comparison from §10 after B1+B2+B3 land and before B4 starts.
- **Adding new primitives during the sweep.** New primitives land directly on the §5a tier table; they do not block this plan.
- **Non-math primitives.** Explicitly out of scope. The framework generalizes, but apply opportunistically — not as part of this plan.
