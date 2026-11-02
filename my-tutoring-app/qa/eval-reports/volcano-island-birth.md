# Birth Certificate — volcano-island (2026-10-31)

**Lifecycle layer: L0 (born)** — single core mode `kitchen_volcano`, bound to the teaching workspace. Science build W3
(`qa/science-build/ROADMAP.md`, SB-7).

- Core task identity: `kitchen_volcano` (β -0.5, scaffoldingMode 1, answer `build` + tap)
- Generator fork: **C, code-only** (`service/physics/volcano-island-generator.ts`), 4 items from `volcanoModel.ts`.
  easy = change the amount that runs out first, the other locked; medium = the learner keeps the other the same;
  hard = change an amount that is already more than enough (the foam stays the same).
- Model: foam marks = min(spoons of soda, cups of vinegar), 1-4 each. A fair test changes one amount.
- Workspace binding: `volcanoWorkspace.ts` + `volcanoIsland.card.ts` + `volcanoIsland.boss.ts` (bespoke: a build
  with a tapped claim); response `gesture`; misses `changed_both`, `no_change`, `kept_prediction`, `misread_result`,
  all `unanswered` until levers. Journey row J1 by design (WebGL).
- 3D (`volcano3d.ts`): a kitchen table, clay volcanoes A and B, a four-mark measuring stick behind each; the foam rises
  to its mark and spills down the cone.
- Answer-leak audit: no foam height before an eruption (scene test); B starts as a copy of A; the claim is tapped after
  both erupt; changing B restarts the test (both erupt again, new guess) — found by the mounted test (the guess was
  blocked after A erupted).
- Design gate: manipulation = the learner sets B's amounts; simulation = the reaction model sets the foam; production
  = the learner builds the test; timer = none; layout = no heights until erupted.
- Curriculum home (SB-0): G2 `SCI001-04-b` (chemical changes) is closest; the volcano Earth-science homes (G2
  `SCI003-03-a/b`, G4 `SCI004-06-b/c`) belong to later modes (`layers_over_time`, `save_the_village`).

**Verification:** `volcanoModel.test.ts` 5 + `VolcanoIsland.workspace.test.tsx` 2; `test:primitive volcano-island`
725/725; `typecheck:lumina` 0; full tsc 770. Browser Grade 1 medium `drive-kitchen.mjs` 20/20 (screenshots
`volcano-island-drive-2026-10-31/kitchen-g1/`). $0 Gemini. Hard tier (the same-height trap) in vitest only.

## Follow-up queue

| # | Skill | Layer | Input |
|---|-------|-------|-------|
| 1 | `/add-eval-modes` | L1 | Roadmap W3: `inside_the_volcano` 0.0 (cutaway), `runny_or_sticky` 1.2, `layers_over_time` 2.0, `save_the_village` 2.5 (open build), `cool_the_rock` 3.0. These need the island scene (cutaway volcano and village), a second 3D world beside the kitchen table |
| 3 | `/add-support-tiers` | L3 | `marks` on the measuring stick (count the marks each foam reached); `fizz_pairs` (layout: draw each spoon beside the cup it fizzed with, the leftover alone) for the hard trap; `one_step_less` (the other amount locked) |
| ✓ | `/eval-test volcano-island`, `/curriculum-fit volcano-island` | QA | owed |
