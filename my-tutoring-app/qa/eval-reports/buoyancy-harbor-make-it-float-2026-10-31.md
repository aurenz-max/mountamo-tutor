# buoyancy-harbor `make_it_float` (2026-10-31, `/add-eval-modes`, SB-4)

**Ruling applied (user 10-30: "rework as an easier rung or drop"):** reworked as the rung below `build_boat`. The stuff
(clay) and its size are fixed and only the shape changes, so the lesson is "same clay, same weight, a shape with
sides floats". β 1.0 sits between find_the_rule 0.5 and build_boat 1.5. scaffoldingMode 2, answer `build`.

| Tier | Item | Passing shapes |
|---|---|---|
| easy | float it empty | low or tall sides |
| medium | carry 1 to low-sides capacity (small 2, big 7) | low or tall sides |
| hard | carry more than low sides can (small 3-8, big 8-19) | tall sides only |

The ball and the flat sheet sink at every tier. The clay goes in on a Float/Sink guess (never graded); the notebook
records shape, guess, pennies and result. The panel shows "a small piece of clay · 24 grams, whatever its shape".

**Misses:** `kept_a_lump`, `flat_sinks`, `sides_too_low`. **Levers:** `xray` (on the clay in the water) and
`one_step_less` (the same clay, float it empty; none at easy).

**Files:** `shapeModel.ts` (new, reuses `boatModel` numbers); component reuses the boat panel with stuff/size locked;
`shapeScene` in `buoyancyWorkspace.ts`; card, boss validator, levers, generator, catalog, backend prior, metrics type.
Card guidance was 4,138/4,000 chars; trimmed drop_test, find_the_rule and salt_water `moves`.

**Verification:**
- `shapeModel.test.ts` (model, tiers, validator, scene leak, levers) + 2 mounted workspace tests (miss → Try again keeps
  the shape → pass; levers and the easier item). Physics folder 231/231.
- `test:primitive buoyancy-harbor` 729/729, `typecheck:lumina` 0, full tsc 770 (baseline 770).
- Browser, Grade 1, medium: `drive-shape.mjs` 29/30. The one failure is the offline tester's observer 400s, also in
  the 10-29/10-30 drives. Screenshots in `buoyancy-harbor-drive-2026-10-31/shape-g1/`.
- Spend: $0 (code-only generator).

**Not yet run:** easy/hard tiers in the browser (covered by vitest), `/eval-test`, a Live sample (user; boss path
unchanged).
