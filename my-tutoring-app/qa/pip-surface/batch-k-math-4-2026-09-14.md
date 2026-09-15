# Pip shared-surface batch: equation-builder, shape-tracer, shape-composer, hundreds-chart, balance-scale (equality) — 2026-09-14

Previous batch: `batch-k-math-3-2026-09-14.md`. Policies and the target table: `src/components/lumina/pip/README.md`.

## What Pip does

| Primitive | Family | Points at (this item's cue) | Never points at | Receives |
| --- | --- | --- | --- | --- |
| equation-builder | classic, sync check | slot row (build, rewrite); the printed "?" (missing value incl. missing operand, balance); whole equation (true/false) | a pool tile, number option, True/False, the number box | — |
| shape-tracer | classic, sync check | the canvas, every mode | any dot, vertex or grid corner | — |
| shape-composer | classic, sync check | the canvas, every mode | a palette piece, a decompose shape button | — |
| hundreds-chart | classic, sync check | the chart, every mode | a cell, an option | — |
| balance-scale `equality` | judged runner (`BalanceScaleEquality`) | right pan (build); gathered weights (say the total); unnumbered left weight (find the left weight) | a tray weight, a placed block | the settled right pan while the match is judged |

Looks: Equation Builder follows a picked tile to its slot and a removed tile back to the pool; Shape Tracer the dot tapped (wrong dots included); Shape Composer the piece added or dragged; Hundreds Chart the cell painted or option tapped; Balance the pan a weight went to, or the tray.

The user's table expected `receive` on shape-tracer and shape-composer. Both check synchronously (last correct dot, Check Shape, Check Answer), so there is no judging window; adding one would mean delaying the verdict. Balance Scale is a judged runner, not a Comparison Builder-style classic, so it follows the Counting Board family. `equality_hard` and the other four balance modes render `BalanceScaleWorkshop`, which has no surface (perch).

## Host changes

- `MathPrimitivesTester`: shape-tracer now receives the preview `instanceId` (it generated its own).

## Gates

- Vitest: 40 files / 163 tests (all `pip/*` incl. the helper attach test, BalanceScaleEquality/Workshop, balance models and DI script, hundreds-chart oracle). 5 new surface tests, 15 tests.
- `typecheck:lumina` 0. Full tsc 771 (777 at the previous batch); none in touched files.

## Runtime drives (headless Chromium, :3000 + :8000)

No sign-in, 1400px and 760px, every primitive: `bodies=1 inDock=true anchor=true` on generation (classic `working`, balance `idle` before Start), new dock with one body after regeneration, no OVERLAP or PAGE-OVERFLOW-X. Touch → `look`: Equation Builder pool tile (build) and option (missing operand); Shape Tracer vertex; Shape Composer decompose button and palette piece; Hundreds Chart cell and option.

Signed in, live tutor speech:

| Primitive (mode) | Cue observed |
| --- | --- |
| equation-builder (missing operand) | point@gap[ring]; connector rises from the dock to the "?" without crossing the options |
| hundreds-chart (find skip value) | point@chart[region] |
| shape-tracer (connect dots) | point@canvas[region] (live, then injected audio) |
| shape-composer (decompose, 760px) | point@canvas[region] |
| balance-scale (equality) | Start → point@right[region] once the scale is in view; Add 5 → look; the [BE_CHANGE] coaching line → point@right again |

After Start the helper scrolls to the action panel, leaving the scale above the viewport; the actor correctly draws no pointer to an off-screen target. Injected audio did not register as speech on hundreds-chart and shape-composer (it did on shape-tracer); live speech covered those cues.

## Findings queued (EVAL_TRACKER, executor `/eval-fix`)

- **SCMP-1 CRITICAL** — decompose buttons are built from the key (only the right shapes) and turn green at the expected count.
- **SCMP-2 CRITICAL** — decompose instructions name the parts ("rectangle made of squares"); 10/10 in two draws, 0/10 in two others.
- **SCMP-3 HIGH** — "house shape with square and triangle" hits the square+triangle branch: a square keyed 2 triangles under a house ask.
- **BSE-1 MEDIUM** — the tilted beam runs through the right pan; pans do not rest on it (screenshot).

## Not verified

- `receive` on the balance build step and `celebrating` everywhere come from phase tests only (no drive reached a matched pan or a correct check).
- Reduced motion, mouth timing against real speech, and the lesson scroll-focus claim were not inspected.
