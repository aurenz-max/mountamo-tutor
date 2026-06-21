# Structural-Difficulty Eval-Test — shape-tracer (2026-06-20)

Primitive: `shape-tracer` (generator `gemini-shape-tracer.ts`)
Archetype: builder-constructor. Both axes code-enforced.
Sweep grade: **Grade 1** (G1 unlocks the 5-6 vertex pool + rhombus, exposing the full ladder; K saturates at square).

**Two axes:**
- Axis 1 (scaffold withdrawal, `resolveSupportStructure`): easy = guidePath+arrows+nextCue+orderNums all ON; hard = all OFF — *except* connect-dots keeps `showOrderNumbers` ON (the numbers ARE the puzzle).
- Axis 2 (structural shape ladder, `resolveProblemShape` → `applyStructuralShape`): G1 trace/connect-dots/complete = triangle(3)→square(4)→hexagon(6); draw-from-description = triangle→square→**rhombus** (property-load lever, not vertex count).

## Results

| Mode | Tier | Shape (verts/dots) | guide | arrows | nextCue | orderNums | xrange | tier echo |
|------|------|-----|-------|--------|---------|-----------|--------|-----------|
| trace | baseline | LLM mix tri→hex (3-6) | undef | undef | undef | undef | — | none |
| trace | easy | triangle (3) ×5 | T | T | T | T | canonical | easy |
| trace | hard | hexagon (6) ×6 | F | F | F | F | 130-370 | hard |
| connect_dots | easy | triangle (3 dots) ×6 | T | — | T | T | canonical | easy |
| connect_dots | hard | hexagon (6 dots) ×5 | F | — | F | **T** | 130-370 | hard |
| draw_from_description | easy | triangle, sides=3, equal=false ×6 | — | — | — | — | — | easy |
| draw_from_description | hard | rhombus, sides=4, equal=true, non-square corners ×5 | — | — | — | — | — | hard |

## Assertions (easy vs hard)

1. **Scaffold withdrawal (code-set):** PASS. trace flips guide/arrows/nextCue/orderNums T→F. connect_dots flips guide/nextCue T→F but holds orderNums=T at hard (correct — withdrawing the numbers would destroy the ordering task identity, not scaffold it).
2. **Structural lever moves:** PASS, exact. trace/connect_dots: vertex/dot count 3→6 (triangle→hexagon). draw_from_description: property load triangle (3, no equality)→rhombus (4 equal sides + non-square-corner contradiction), matching `ladderShapeForMode`'s rhombus override. medium rung = square(4) per ladder.
3. **Magnitude invariance:** PASS. Hard hexagon xrange 130-370 = canonical `SHAPE_VERTICES.hexagon` on the same 500x400 canvas; no footprint inflation. draw has no rendered geometry (property-only). No value-band growth at any tier.
4. **No answer leak:** PASS. Hard withdraws guide/arrows/cue so nothing is traced for the student; connect_dots keeps the numbers (the puzzle, not the answer). Easy scaffolds genuinely help (full guide path + flow + cue).
5. **Null-tier no-op:** PASS. Baseline has no scaffold fields set (all `undefined` = component defaults), no `supportTier` echoed, and LLM-chosen progressive shapes (tri→hex) — does NOT look already-hard.

No CRITICAL or HIGH issues.

## Verdict: PASS

All 4 eval modes verified. Both code-enforced axes move exactly as declared; scaffolds flip per `resolveSupportStructure` (with the correct connect-dots orderNums exception); structural shape ladder re-selects + reconstructs deterministically in `applyStructuralShape`, holding canonical canvas scale and the grade-band pool. No magnitude inflation, no answer leak, clean null-tier baseline.
