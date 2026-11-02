# Birth Certificate — circuit-workbench (2026-10-31)

**Lifecycle layer: L0 (born)** — single core mode `light_it`, bound to the teaching workspace. Science build W2
(`qa/science-build/ROADMAP.md`, SB-6).

- Core task identity: `light_it` (β -0.5, scaffoldingMode 1, answer `build`)
- Generator fork: **C, code-only** (`service/physics/circuit-workbench-generator.ts`); 5 items from `circuitModel.ts`,
  seeded. easy = one wire on, one more closes the loop; medium = a wrong first try (one end only, both clips on one end,
  or a short beside the bulb); hard = two bulbs, light only the named one.
- Model: `circuitModel.ts` joins clips into groups by the wires; a bulb lights when it is on a path from the + group to
  the − group through bulbs; both ends in one group is a short (nothing lights, battery warms).
- Workspace binding: `circuitWorkspace.ts` + `circuitWorkbench.card.ts` + `circuitWorkbench.boss.ts`, bespoke
  `defineBoss` (a build beside a guess); response `gesture`; misses `open_loop`, `both_on_one_end`, `short_circuit`,
  `wrong_bulb`, `lit_both`, all listed `unanswered` until levers exist. `boss-card.mjs` printed; journey row J1 by
  design (WebGL).
- Answer-leak audit: the scene never names the wire that closes the loop; the start never meets the goal (validator
  rejects it); feedback asks, never says which clip. What lights is shown live, because it is the world reacting to
  the learner's own build, not a key.
- Design gate: manipulation = the learner joins clips (3D posts or clip chips); simulation = the circuit model lights
  the bulb and warms a shorted battery; production = the learner builds the circuit; timer = none; layout = no
  pre-solved start, no labels that name the missing wire.
- Curriculum home (SB-0 lookup, not yet `/curriculum-fit`): K `SCI001-03-H` (circuits with batteries), G4
  `SCI001-04-a/b/c`.
- Pip: framework (boss), `<PipDock/>` + `<PipWorkspace>`; surface test passes.

**Verification:** `circuitModel.test.ts` + `CircuitWorkbench.workspace.test.tsx` 8/8; `test:primitive circuit-workbench`
721/721; `typecheck:lumina` 0; full tsc 770 (baseline). Browser, Kindergarten, medium: `drive-light.mjs` 30/30,
including a wire tapped on the 3D posts; screenshots in `circuit-workbench-drive-2026-10-31/light-k/`. $0 Gemini.
Hard tier (two bulbs) checked in vitest only.

## Follow-up queue

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 1 | `/add-eval-modes` | L1 | Roadmap W2: `find_the_break` 0.5, `conductor_test` 1.0, `add_a_switch` 1.8, `build_device` 2.5, `two_bulbs` (G4) 3.2; plus a magnet mode (5 G3 homes, SB-0) |
| 3 | `/add-support-tiers` | L3 | `xray` (marks: charge dots round a closed loop, stopping at a gap) answers `open_loop`/`both_on_one_end`; `follow_the_path` (marks the path from + clip by clip); `one_step_less` (easier: one wire already right) |
| 5 | `/add-sound` | L5 | clip snap on a wire, bulb hum when lit, a fizz on a short |
| — | `/review-live-wiring circuit-workbench`, `/curriculum-fit circuit-workbench` | gates | owed |
| ✓ | `/eval-test circuit-workbench` | QA | owed |
