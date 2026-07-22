# Engineering Tutoring-Scaffold Wiring — BACKLOG

**Goal:** bring every engineering primitive up to **L2** — a complete, sufficient
AI tutoring scaffold (`/add-tutoring-scaffold`). Surfaced by the 2026-07-21
engineering read-aloud sweep: read-aloud routes through the live tutor voice
(`sendText` from `useLuminaAI`), so a primitive with no tutor channel can't carry
read-aloud OR any other L2 scaffolding. Wiring the scaffold ALSO unlocks the
young-learner read-aloud capability on these primitives (same channel), so this
stream is the prerequisite for finishing the read-aloud rollout across engineering.

**Executor skills:** `/add-tutoring-scaffold` (L2, primary) → `/tutor-test` (L2
plumbing gate) → `/reader-fit` (add read-aloud once the channel exists). Some may
want `/add-eval-modes` (L1) first if they're still single-mode.

**Definition of done (per primitive):**
1. `useLuminaAI({ primitiveType, instanceId, primitiveData, gradeLevel })` wired,
   with a meaningful `primitiveData` bag (the tutor's runtime state).
2. Catalog `tutoring` block: `taskDescription` + `contextKeys` +
   `scaffoldingLevels` (1/2/3) + `commonStruggles` + `aiDirectives` for the
   primitive's key moments. No `{{#if}}` handlebars (they render literal); every
   `{{key}}` forwarded into `aiPrimitiveData` by the component.
3. Component `sendText` moments fire at the real interaction beats (start,
   correct/incorrect, struggle, completion), silent where they're system triggers.
4. `/tutor-test` passes (Tier-1 + Tier-2, 0 unresolved keys).
5. THEN `/reader-fit <id> --fix` to add the young-learner read-aloud (the sweep
   pattern: cyan `LuminaReadAloud` on prose + shared `ReadMeButton` on questions).

---

## Phase A — 12 engineering primitives with NO tutor channel (`useLuminaAI` absent)
Confirmed 2026-07-21 (grep of `visual-primitives/engineering/`). Mostly
direct-manipulation sims; text-heavier ones first (highest read-aloud payoff).

| # | Primitive | Component | Notes / text load |
|---|---|---|---|
| A1 | machine-profile | `MachineProfile.tsx` | profile-card prose (fact-file cousin) — heaviest text load; top payoff |
| A2 | dump-truck-loader | `DumpTruckLoader.tsx` | density job-board scenarios (engine-judged) — has mission/goal prose |
| A3 | bridge-builder | `BridgeBuilder.tsx` | build sim; challenge/goal prompts |
| A4 | tower-stacker | `TowerStacker.tsx` | build sim; challenge/goal prompts |
| A5 | gear-train-builder | `GearTrainBuilder.tsx` | build sim; ratio challenge prompts |
| A6 | pulley-system-builder | `PulleySystemBuilder.tsx` | build sim; mechanical-advantage prompts |
| A7 | lever-lab | `LeverLab.tsx` | manipulation sim; predict/challenge text |
| A8 | ramp-lab | `RampLab.tsx` | manipulation sim; predict/challenge text |
| A9 | wheel-axle-explorer | `WheelAxleExplorer.tsx` | manipulation sim; challenge text |
| A10 | shape-strength-tester | `ShapeStrengthTester.tsx` | manipulation sim; challenge text |
| A11 | foundation-builder | `FoundationBuilder.tsx` | manipulation sim; challenge text |
| A12 | blueprint-canvas | `BlueprintCanvas.tsx` | drawing/blueprint tool; instruction text |

**Pilot-then-sweep:** wire A1 (machine-profile) end-to-end first (channel →
catalog block → tutor-test → reader-fit read-aloud), exercise it live, and only
then roll the pattern across A2–A12. Do NOT batch-wire before the pilot is
runtime-verified (CLAUDE.md pilot-then-sweep + verification doctrine).

## Phase B — audit the 12 that already have `useLuminaAI` for L2 COMPLETENESS
The read-aloud sweep confirmed these have the channel + a catalog tutoring block,
but "has a block" ≠ "sufficient scaffold." Run `/tutor-test` (and `/reader-fit`
Audit B sufficiency) on each; fix any thin/incomplete scaffolds. Primitives:
vehicle-comparison-lab, propulsion-timeline, engine-explorer, transport-challenge,
propulsion-lab, paper-airplane-designer, construction-sequence-planner,
vehicle-design-studio, flight-forces-explorer, airfoil-lab, hydraulics-lab,
excavator-arm-simulator. (excavator-arm-simulator already got an L2 scaffold pass
2026-07-15 — HUMAN-CHECKS #23; use as the reference for a "done" block.)

---

## Origin & cross-refs
- Surfaced by the engineering read-aloud sweep, 2026-07-21 (12 primitives wired;
  reports `qa/reader-fit/*-PRE-2026-07-21.md`; live audio = HUMAN-CHECKS #40).
- Memory: `project_lumina-read-aloud` (rollout note + the reusable pattern),
  `project_di-bench-live-judged` (DI = the other tutor-scaffold family).
- Backend lesson-mode caveat: read-aloud/ORIENT beats belong in catalog
  `aiDirectives` (survive the lesson `[PRIMITIVE SWITCH]` one-sentence cap), not
  only a component `sendText` clause — see `/reader-fit` SKILL Phase 5 Tier 1.
