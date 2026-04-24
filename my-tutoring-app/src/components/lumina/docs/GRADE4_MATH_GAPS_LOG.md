# Grade 4 Math — Gap Closure Living Log

> **Generated:** 2026-04-23 via `/lumina-portfolio gaps 4th grade math`
> **Owner:** TBD
> **Status:** OPEN
> **Goal:** Close CCSS Grade 4 math coverage gaps to bring Grade 4 to near-100% primitive alignment.

This is a living document. Update the **Status**, **Notes**, and **Completed** columns as work progresses. When a gap is fully closed (eval mode wired + backend calibrated + eval-tested), move the row to the **Closed** section at the bottom.

---

## Current State (baseline)

- **15 of 25** math primitives serve Grade 4 standards
- **14 of 15** are multi-phase with `PhaseSummaryPanel`
- **67 eval modes** across Grade 4 primitives, all IRT-calibrated (1PL Rasch)
- **7 of 11** CCSS Grade 4 clusters fully covered
- **4 clusters** partially covered (eval modes or components missing)
- **~5 CCSS substandards** with zero coverage

---

## CCSS Grade 4 Coverage Summary

| Cluster | Standard(s) | Status | Primary Primitives |
|---------|------------|--------|---------------------|
| 4.OA.A | 4.OA.1-2 | COVERED | multiplication-explorer, array-grid, area-model |
| 4.OA.B | 4.OA.3 | PARTIAL | tape-diagram (densification needed) |
| 4.OA.C | 4.OA.4-5 | COVERED | factor-tree, skip-counting-runner |
| 4.NBT.A | 4.NBT.1-2 | COVERED | place-value-chart, base-ten-blocks, number-line |
| 4.NBT.B | 4.NBT.3-6 | COVERED | base-ten-blocks, place-value-chart, balance-scale |
| 4.NF.A | 4.NF.1-2 | COVERED | fraction-circles, fraction-bar, number-line |
| 4.NF.B | 4.NF.3-4 | COVERED | fraction-bar, tape-diagram |
| 4.NF.C | 4.NF.5-7 | **GAP** | (decimal primitive missing) |
| 4.MD.A | 4.MD.1-3 | PARTIAL | measurement-tools (perimeter missing) |
| 4.MD.B | 4.MD.4 | PARTIAL | dot-plot (fractional units unconfirmed) |
| 4.MD.C | 4.MD.5-7 | **GAP** | (protractor missing) |
| 4.G.A | 4.G.1-3 | PARTIAL | shape-builder (lines/symmetry gaps) |

---

## Gap Tracker

### Wave 1 — Quick Wins (eval-mode work, ~1-2 days)

| # | Gap | CCSS | Primitive | Action | Effort | Status | Notes |
|---|-----|------|-----------|--------|--------|--------|-------|
| 1 | Line relationships (parallel/perpendicular) | 4.G.1, 4.G.2 | shape-builder | Add `classify_by_lines` eval mode (β=3.0) | SMALL | REVIEW | Shipped 2026-04-24 — awaits tester verification. See Closed notes. |
| 2 | Perimeter | 4.MD.3 | area-model | Add `perimeter` eval mode (β=3.0) | MEDIUM | REVIEW | Shipped 2026-04-24. β=3.0 chosen instead of 3.5 (slot taken by `multiply`). See Closed notes. |
| 3 | Grade-4 symmetry tier | 4.G.3 | shape-builder | Add `identify_symmetric` mode (β≈3.0) below existing `find_symmetry` (β=5.5) | SMALL | OPEN | Difficulty progression fix |
| 4 | Multi-step scaffolding | 4.OA.3 | tape-diagram | Densify `multi_step` into `two_step_additive` (β≈3.5), `two_step_mixed_ops` (β≈4.5), `multi_step_with_remainder` (β≈5.5) | SMALL-MEDIUM | OPEN | `/lumina-densify-primitives tape-diagram` |
| 5 | Line plots with fractional units | 4.MD.4 | dot-plot | Verify/add `fractional_units` mode | SMALL | OPEN | First run `/lumina-portfolio health math` to confirm dot-plot state |

**Wave 1 acceptance:** After all 5 complete, `/eval-test` green on each, beta priors in backend registry, monotonic ordering.

---

### Wave 2 — New Primitive: Protractor (~3-5 days)

| # | Gap | CCSS | Primitive | Action | Effort | Status | Notes |
|---|-----|------|-----------|--------|--------|--------|-------|
| 6 | Angle measurement | 4.MD.5, 4.MD.6, 4.MD.7 | **protractor** (new) | Build primitive | MEDIUM | OPEN | PRD spec in `PRD_K3_CONTENT_DENSITY.md` §2.2 |

**Protractor spec hints (from PRD):**
- Drag-to-align protractor onto angles
- Read angle measurement
- Eval modes: `measure` (β≈3.5), `construct` (β≈4.5), `classify` (β≈2.5)
- Grade band: 4+ (reusable for 5-6 geometry)

**Next step:** `/lumina-portfolio scope protractor` → paste scope into fresh chat → `/primitive protractor`

**Wave 2 acceptance:** Component built, catalog registered, generator wired, backend calibrated, `/eval-test protractor` green.

---

### Wave 3 — Decimal Place Value (~2-3 days)

| # | Gap | CCSS | Primitive | Action | Effort | Status | Notes |
|---|-----|------|-----------|--------|--------|--------|-------|
| 7 | Decimal place value | 4.NF.5, 4.NF.6, 4.NF.7 | place-value-chart | Extend with `decimal_places` mode (tenths/hundredths columns) | MEDIUM | OPEN | Reuses existing column-interaction pattern |

**Design notes:**
- Keep whole-number chart as default
- Add toggle or config flag to extend columns right of decimal point
- Two new eval modes: `identify_decimal_place` (β≈3.5), `compare_decimals` (β≈4.5)
- Also sets up Grade 5 decimal operations

**Wave 3 acceptance:** Extension shipped, decimals generate cleanly via Gemini, eval-tested.

---

## Handoff Chain

Each row ends with the skill that should execute it:

- Wave 1 items #1, #2, #3, #5 → `/add-eval-modes`
- Wave 1 item #4 → `/lumina-densify-primitives`
- Wave 2 item #6 → `/lumina-portfolio scope protractor` then `/primitive protractor`
- Wave 3 item #7 → `/lumina-densify-primitives place-value-chart` (decimal extension)

After each item: `/eval-test <primitive>` before marking complete.

---

## Status Key

- **OPEN** — not started
- **SCOPED** — scope doc generated, ready for implementation
- **IN PROGRESS** — component/eval mode being built
- **REVIEW** — awaiting eval-test or calibration check
- **BLOCKED** — has a dependency or issue (put reason in Notes)
- **CLOSED** — fully shipped: component + catalog + generator + registry + eval-tested

---

## Closed

*(move rows here when status = CLOSED, include date + commit hash)*

| # | Gap | CCSS | Primitive | Closed Date | Commit |
|---|-----|------|-----------|-------------|--------|
| 1 | Line relationships (parallel/perpendicular) — REVIEW (awaiting tester) | 4.G.1, 4.G.2 | shape-builder | 2026-04-24 | (uncommitted) |
| 2 | Perimeter — REVIEW (awaiting tester) | 4.MD.3 | area-model | 2026-04-24 | (uncommitted) |

### Gap #1 Implementation Notes

**Eval mode:** `classify_by_lines` @ β=3.0 (between `measure` β=2.5 and `classify` β=3.5).

**Files changed:**
- `service/manifest/catalog/math.ts` — new `evalModes` entry, ordered by β
- `service/math/gemini-shape-builder.ts` — added `CHALLENGE_TYPE_DOCS` entry; added `classify_by_lines` to `challenges[].type` enum; opened up `correctCategory` and `classificationCategories` enums (were hardcoded to Triangles/Quads/Pentagons); canonical category enforcement logic now branches on challenge type; added fallback; auto-enables `parallelMarker` tool for the mode
- `primitives/visual-primitives/math/ShapeBuilder.tsx` — added `ShapeBuilderChallenge.type` to union; added `isClassifyChallenge` helper and replaced 5 `activeMode === 'classify'` usages so classify UI (shape selection, category buttons, feedback) works for line-based sorting too; added `PHASE_TYPE_CONFIG` entry
- `backend/app/services/calibration/problem_type_registry.py` — added `classify_by_lines: PriorConfig(3.0, ...)` prior to `shape-builder` block

**Canonical categories:** `["Has Parallel Sides", "Has Perpendicular Sides", "Has Both", "Has Neither"]` — enforced server-side in the generator; LLM-assigned `correctCategory` values outside this set fall back to "Has Neither" with a warning (side-vertex derivation is non-trivial so LLM is trusted within the enum).

**Next step:** Open the Math Primitives Tester, select shape-builder, and exercise each mode:
- Pick `classify_by_lines` mode → verify 4 categories render, shapes are sortable, correct/incorrect feedback fires
- Pick `classify` mode → verify unchanged (regression check)
- Pick no eval mode → verify mixed challenges still generate
- Optionally run `/eval-test shape-builder` for automated QA

Once verified, move this row into Closed and update the Progress Snapshot.

### Gap #2 Implementation Notes

**Eval mode:** `perimeter` @ β=3.0 (between `find_area` β=2.5 and `multiply` β=3.5). Originally specced at β≈3.5 but that slot was already occupied by `multiply`, so β=3.0 was chosen. β=3.0 is also more pedagogically appropriate — perimeter (add 4 sides) is easier than multi-digit multiplication via distributive property.

**Files changed:**
- `service/manifest/catalog/math.ts` — new `evalModes` entry, ordered by β, between `find_area` and `multiply`
- `service/math/gemini-area-model.ts` — added `CHALLENGE_TYPE_DOC` (instructing Gemini to use single-element factor arrays, whole-number side lengths, perimeter-oriented title); added `'perimeter'` to the root-level `challengeType` enum; added post-validation that collapses any LLM-provided decomposition back to single side lengths, forces `showPartialProducts=false` / `algebraicMode=false`, and rewrites the title/description if Gemini slipped back into area/multiplication language
- `primitives/visual-primitives/math/AreaModel.tsx` — added `'perimeter'` to `challengeType` union; added `isPerimeterMode` flag, perimeter state (`perimeterInput`, `perimeterAttempts`, `perimeterCorrect`), submit handler with `AreaModelMetrics` shaped for perimeter (targetProduct = perimeter value, zero cell metrics); guarded all forward-mode UI (progress indicator, step 1 cell input, step 2 sum section, forward-mode feedback) with `!isPerimeterMode`; added new perimeter-specific progress line, equation display (`P = 2×(L+W) = ?`), input card, feedback card, and "How to Use" branch; cell interior is rendered empty in perimeter mode (no `?`, no equation) so the rectangle visually reads as a pure shape with labeled dimensions
- `backend/app/services/calibration/problem_type_registry.py` — added `perimeter: PriorConfig(3.0, ...)` prior to `area-model` block

**Generator constraint:** When `perimeter` is the active eval mode, Gemini produces single-element `factor1Parts` / `factor2Parts` representing the two side lengths (length and width). No decomposition — perimeter isn't about parts.

**Component UX:** Student sees a labeled rectangle with side lengths on top/left, a helper showing `length + width + length + width`, and a single input "What is the perimeter of this rectangle?" The rectangle interior is intentionally empty (no multiplication equation, no `?` placeholder) so the focus stays on the outer boundary.

**Next step:** Open the Math Primitives Tester, select area-model, and exercise each mode:
- Pick `Perimeter (Pictorial)` → verify a clean 1×1 rectangle renders with labeled sides, input submits, perimeter = 2×(L+W) is checked correctly
- Pick `Find Area` and `Multiply` modes → verify unchanged (regression check — classify UI is reused)
- Pick no eval mode → mixed challenges still generate (include an instructor-facing check that the generator can still choose `perimeter` when topic hints at it)
- Optionally run `/eval-test area-model` for automated QA

Once verified, move this row into Closed and update the Progress Snapshot.

---

## Tracked Decisions / Open Questions

- [ ] Confirm whether `dot-plot` is already in the catalog or a ghost entry — run `/lumina-portfolio health math` before starting #5
- [ ] Decide: extend `place-value-chart` with decimal mode (Wave 3 #7) vs. build separate `decimal-place-value` primitive — preference is extension for maintenance
- [ ] Protractor interaction: pure mouse/drag or also keyboard-accessible? Confirm during scope step
- [ ] Should `classify_by_lines` (gap #1) live on shape-builder or as a new lightweight `line-relationships` primitive? Default: eval mode on shape-builder unless interaction feels crammed

---

## Progress Snapshot

> Update this line whenever status changes.

`2 / 7 gaps in REVIEW — 0 / 3 waves complete — baseline date 2026-04-23, last update 2026-04-24`
