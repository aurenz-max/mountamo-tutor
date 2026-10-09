# Contract: shape-tracer

- **Derived:** 2026-10-09 (W1 workspace binding, C11). Not a full `/primitive-contract` census: it records what the
  binding relies on and the requirements already in the code.
- **Component:** `primitives/visual-primitives/math/ShapeTracer.tsx` · **Domain:** `shapeTracerWorkspace.ts` ·
  **Generator:** `service/math/gemini-shape-tracer.ts` · **Adapter:** `components/live-activity/adapters/shapeTracerLive.ts`
- **Modes (4):** `trace`, `connect_dots`, `complete`, `draw_from_description`.

## Requirements

### R1 — answer-bearing geometry is code-built · OBSERVED
- Trace paths, connect-dots dots and order (labels 1..n, order 0..n-1), complete's drawn sides and open corners, and
  the draw clue's properties under a structural tier all come from `placeShape` / `SHAPE_VERTICES` / `SHAPE_PROPS`,
  never from LLM coordinates.

### R2 — only connect-dots and draw-from-description have a wrong check · OBSERVED
- A trace or completion tap out of turn is refused on the dot (no attempt). A connect-dots dot out of order counts
  as an attempt; Check Shape checks corner count, then equal sides when the clue asks for them.

### R3 — the check asks only what the screen asks · OBSERVED (NEW 2026-10-09)
- A trace with no order numbers and no next-dot glow (the hard tier) accepts any start corner and either direction
  (`freeTrace`, `traceAccepts`); with either cue on, the numbered order is the task.
- `allSidesEqual` holds only when the clue says equal or same (the 10-09 payload asked "3 straight sides" and checked
  equal sides). The fallback pentagon clue now says equal.
- The shape's name is not on screen on draw-from-description (the clue's properties are the task), nor on
  connect-dots until every dot is joined.

### R4 — shared teaching workspace (W1, plain shape) · OBSERVED (NEW 2026-10-09)
- `withWorkspaceController('shape-tracer', ...)`; a finished trace or completion, a connect-dots dot out of order and
  Check Shape each call `commitCheck(describeShapeWork, correct, shapeTracerMiss)`. The task is the instruction plus
  the drawing's clue, or a numbered trace's corner numbers; the tutor never gets the dot order or an unrevealed shape.
- On the workspace path: no Next, no scripted `sendText`, `useLuminaAI` disabled, and taps/Undo/Check closed while
  the check waits for Try again (what Try again keeps: R5).
- Misses: `started_elsewhere`, `skipped_number`, `went_back` (connect_dots); `too_few_sides`, `too_many_sides`,
  `sides_unequal` (draw_from_description).
- **Probe:** `ShapeTracer.workspace.test.tsx`; journey sweep on `w1-payloads/shape-tracer.*.json`.

### R5 — levers never draw or say the answer · OBSERVED (NEW 2026-10-09)
- Every mode declares levers (`shapeTracerLevers.ts`, catalog `levers: true`). The tier's guides are the starting
  positions: a guide the tier shows is declared pulled; every other lever starts released.
- Leak rules in code, unit-tested (`shapeTracerLevers.test.ts`): no next-dot glow on connect-dots (`glowOffered`);
  the number strip marks no dot on the canvas; the side bars are the learner's own sides (`sideBars`); the corner
  rings are the clue's count against the learner's; lever facts carry no digit and name no shape.
- Simplify (`simpler_item`) stays in the mode, is code-built and ungraded, and never repeats the item's corners,
  dots or clue (`practiceLeaks`). A pull that would change nothing (`fade_joined` with no dot joined, `side_bars`
  with fewer than two corners) is refused with a reason.
- Try again on connect-dots keeps the joined dots (they were all right); on a drawing it clears the corners.
- **Probe:** `ShapeTracer.levers.workspace.test.tsx`; sweep J9, J12, J13.

## History
- 2026-10-09 — derived at the W1 binding; R3 fixes found while saving payloads. R5 levers the same day.
