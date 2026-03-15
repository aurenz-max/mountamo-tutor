# Eval Mode Issue Tracker

> Single source of truth for all open eval-test issues across primitives.
> Updated automatically by `/eval-test`. Read this instead of individual reports.

## Status Dashboard

| Primitive | Modes | Passed | Failed | Last Tested | Report |
|-----------|-------|--------|--------|-------------|--------|
| regrouping-workbench | 4 | 2 | 2 | 2026-03-15 | [report](eval-reports/regrouping-workbench-2026-03-15.md) |
| array-grid | 3 | 1 | 2 | 2026-03-15 | [report](eval-reports/array-grid-2026-03-15.md) |
| fraction-bar | 4 | 4 | 0 | 2026-03-15 | [report](eval-reports/fraction-bar-2026-03-15.md) |
| percent-bar | 4 | 4 | 0 | 2026-03-15 | [report](eval-reports/percent-bar-2026-03-15.md) |
| measurement-tools | 3 | 3 | 0 | 2026-03-15 | [report](eval-reports/measurement-tools-2026-03-15.md) |
| tape-diagram | 4 | 1 | 3 | 2026-03-15 | [report](eval-reports/tape-diagram-2026-03-15.md) |
| sorting-station | 6 | 4 | 2 | 2026-03-15 | [report](eval-reports/sorting-station-2026-03-15.md) |
| number-sequencer | 5 | 4 | 1 | 2026-03-15 | [report](eval-reports/number-sequencer-2026-03-15.md) |

**Totals:** 23/33 modes passing (70%) | 17 open issues (9 CRITICAL, 6 HIGH, 1 MEDIUM, 1 LOW)

---

## Systemic Patterns

Issues that appear across multiple primitives. Fix the pattern, not just individual instances.

### SP-1: Component ignores challengeType — eval modes render identical UI

**Affected:** array-grid (count_array, multiply_array), tape-diagram (represent, solve_comparison, multi_step)
**Risk:** Likely affects other primitives that added eval modes after the component was built. Check all primitives with 2+ eval modes.
**Root cause:** Eval modes were added to the catalog but the component was never updated to branch on the challenge type field.
**Fix pattern:** Component needs to read `challengeType`/`type` from data and conditionally render different interaction paths (pre-built vs build, number input vs sentence input, etc.).

### SP-2: Generator produces values that overflow component's fixed UI slots

**Affected:** regrouping-workbench (add_regroup Tier 3)
**Risk:** Any primitive with fixed-size input grids, button panels, or column layouts.
**Root cause:** Generator prompt lacks hard constraints on value ranges. Component has hardcoded caps (e.g., `maxLength={1}`, `Math.min(maxRows, 6)`) that don't match what the LLM can produce.
**Fix pattern:** Two-layer defense: (1) generator prompt constraints to keep values in range, (2) component-side post-validation to reject/clamp overflow.

### SP-3: Generator cross-contaminates challenge types within a single eval mode

**Affected:** sorting-station (sort_one — produces count-and-compare and odd-one-out concepts tagged as sort-by-one)
**Risk:** Any primitive where the generator creates multi-challenge sequences and the prompt describes all challenge types — LLM "helpfully" mixes types even when constrained to one.
**Root cause:** Generator prompt describes all available challenge types, and the LLM creates a "progression" that includes other types despite the evalMode constraint.
**Fix pattern:** Generator prompt must strongly constrain: "ALL challenges MUST use type X. Do NOT include comparison questions, odd-one-out, or any other type."

### SP-4: Render path and validation path use different data sources

**Affected:** number-sequencer (decade_fill — renderer uses `correctAnswers` to determine blanks, but check logic uses `blankIndices` from sequence nulls)
**Risk:** Any primitive where rendering is driven by one field but validation by another. When generator doesn't keep both fields in sync, challenges become impossible.
**Root cause:** Decade-fill rendering was written to use the hundred chart grid (correctAnswers-based), but the check logic reuses the fill-missing path (sequence-nulls-based). No invariant enforces that `sequence.filter(v => v === null).length === correctAnswers.length`.
**Fix pattern:** Either (1) component uses a dedicated validation path for decade-fill that reads from correctAnswers directly, or (2) generator ensures sequence has exactly as many nulls as correctAnswers entries.

---

## Open Issues — CRITICAL / HIGH

| ID | Primitive | Mode | Severity | Category | Summary | Fix Type |
|----|-----------|------|----------|----------|---------|----------|
| AG-1 | array-grid | count_array | CRITICAL | Unsupported interaction | Component has no pre-built array mode; count_array requires student to build array first (tests wrong skill) | COMPONENT |
| AG-2 | array-grid | multiply_array | CRITICAL | Unsupported interaction | Component has no pre-built array mode; same as AG-1 | COMPONENT |
| AG-3 | array-grid | multiply_array | CRITICAL | Unsupported interaction | No multiplication sentence input — only single number input for total; can't assess "write the multiplication fact" | COMPONENT |
| RW-1 | regrouping-workbench | subtract_no_regroup | CRITICAL | State management | State bleed on re-generation: switching tiers without page reload leaves workbench in completed state with stale answers | COMPONENT |
| RW-2 | regrouping-workbench | add_regroup | CRITICAL | UI overflow / Grade mismatch | AI generates 3-digit addends/results for Grade 1-2 `maxPlace='tens'` workbench; layout mutates mid-session | GENERATOR |
| RW-3 | regrouping-workbench | subtract_no_regroup | HIGH | Data staleness | Word problem context is per-data not per-challenge; story stays static across problems with mismatched numbers | GENERATOR + COMPONENT |
| AG-4 | array-grid | count_array | HIGH | Answer leakage | Hardcoded instructions reveal target dimensions ("build with 4 rows and 7 columns") — defeats counting task | COMPONENT |
| TD-1 | tape-diagram | represent | CRITICAL | Unsupported interaction | No "build diagram" functionality — component only supports solving; represent mode is identical to solve_part_whole | COMPONENT |
| TD-2 | tape-diagram | all modes | CRITICAL | No code path | challengeType discarded by generator transform; component has zero references to challengeType; all 4 modes identical | GENERATOR + COMPONENT |
| TD-3 | tape-diagram | solve_comparison | HIGH | Unsupported interaction | Generator hardcodes `comparisonMode: false` and single bar; comparison requires 2+ bars | GENERATOR + COMPONENT |
| TD-4 | tape-diagram | multi_step | HIGH | Unsupported interaction | Data identical to solve_part_whole; no chained operations or intermediate calculations | GENERATOR + COMPONENT |
| SS-1 | sorting-station | sort_one | CRITICAL | Impossible challenge | Challenge c4 has 1 category but 4 objects (3 match, 1 doesn't) — unmatchable object has no valid bin; challenge impossible | GENERATOR |
| SS-2 | sorting-station | sort_one | HIGH | Instruction/type mismatch | Generator produces c3 (count-and-compare) and c4 (odd-one-out) concepts tagged as sort-by-one; instruction misleads student | GENERATOR |
| SS-3 | sorting-station | tally_record | HIGH | Orphaned object | Category "Insects & Amphibians" rule only matches type=insect; frog (type=amphibian) vanishes from display | GENERATOR |
| NS-1 | number-sequencer | decade_fill | CRITICAL | Render/check mismatch | Renderer uses correctAnswers to determine blanks but check logic uses blankIndices (from sequence nulls); 3/5 challenges have fewer nulls than answers → impossible | GENERATOR + COMPONENT |

## Open Issues — MEDIUM / LOW

| ID | Primitive | Mode | Severity | Category | Summary |
|----|-----------|------|----------|----------|---------|
| AG-5 | array-grid | build_array | MEDIUM | Answer leakage | Title "Build an Array for 4 × 3" shows multiplication notation before student engages with concept |
| AG-6 | array-grid | all modes | LOW | Phantom field | `challengeType` generated but never read by component |

---

## Resolved Issues

| ID | Primitive | Resolved | How |
|----|-----------|----------|-----|
| PB-1 | percent-bar | 2026-03-15 | Generator prompt updated: addition challenge type docs now explicitly require percentage questions, not dollar amounts. Added rule #7 to CRITICAL REQUIREMENTS. |
| MT-1 | measurement-tools | 2026-03-15 | Estimate mode removed (product decision: not pedagogically sound). |
| MT-2 | measurement-tools | 2026-03-15 | Compare mode implemented: ordering panel after all shapes measured. Student clicks shapes shortest→longest. |
| MT-3 | measurement-tools | 2026-03-15 | Convert mode implemented: after each measurement, student converts to target unit (inches↔cm) with 10% tolerance. |

---

## Product Decisions Pending

Decisions that need product input before engineering can proceed.

| # | From | Decision | Options | Recommendation |
|---|------|----------|---------|----------------|
| 1 | array-grid | count_array and multiply_array exist in catalog but component doesn't support them | A) Build interaction paths (LARGE) B) Remove from catalog until ready (SMALL) | Option B as interim — broken modes produce invalid IRT data |
| 2 | regrouping-workbench | Should word problem context be per-challenge? | A) Per-challenge stories (schema change) B) Generic story without numbers C) Disable for multi-challenge | Option A for best pedagogy, Option B as quick fix |
| 3 | regrouping-workbench | Should component enforce maxPlace as hard cap or expand dynamically? | A) Hard cap (safer) B) Dynamic but suppress leading zeros C) Trust generator | Option A — component should never exceed maxPlace |
| 4 | measurement-tools | **RESOLVED** — estimate removed, compare and convert modes implemented (2026-03-15) | — | — |
| 5 | tape-diagram | represent, solve_comparison, multi_step modes exist but component runs identical 3-phase flow for all | A) Build differentiated interaction paths (LARGE) B) Remove 3 modes, keep solve_part_whole (SMALL) | Option B as interim — only solve_part_whole matches the actual UX |
