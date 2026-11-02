# Eval Report: buoyancy-harbor, circuit-workbench, volcano-island — 2026-10-31

All three are code-only (Fork C) generators, so every run is free and repeatable. Each mode was pinned through
`/api/lumina/eval-test` at baseline, easy, medium and hard (harbor: easy/medium/hard), and each tier's structural lever
was asserted on every item (`scratchpad/eval_sweep.py`).

## Results

| Primitive | Eval Mode | Status | Tier lever checked | Issues |
|-----------|-----------|--------|--------------------|--------|
| circuit-workbench | light_it | PASS | one start wire easy; two bulbs hard | — |
| circuit-workbench | find_the_break | PASS | loose wire easy; battery/bulb medium; two bulbs hard | — |
| circuit-workbench | conductor_test | PASS | things to decide 1 / 2 / 2 | — |
| circuit-workbench | magnet_test | PASS | things to decide 1 / 2 / 2 | — |
| circuit-workbench | add_a_switch | PASS | start wires 2 / 2 / 4 | — |
| circuit-workbench | build_device | PASS | devices by tier (fan or light / switched / two loads) | — |
| circuit-workbench | two_bulbs | PASS | row easy; side by side medium | — |
| volcano-island | kitchen_volcano | PASS | other amount locked at easy; change does nothing at hard | — |
| volcano-island | runny_or_sticky | PASS | calls 2 / 2 / 3 | — |
| volcano-island | layers_over_time | PASS | layers 2 / 3 / 3, crack at hard | — |
| volcano-island | save_the_village | PASS | walls allowed 2 / 2 / 3 | — |
| volcano-island | cool_the_rock | PASS | places 2 / 3 / 3, gassy lava at hard | — |
| buoyancy-harbor | all 6 modes | PASS | (types and counts; tiers checked in vitest) | — |

48/48 circuit and volcano runs, 18/18 harbor runs. Step 2a: G1 (required fields) holds by construction (the boss
validator rejects anything missing, `test:primitive` runs it over saved payloads); G2/G5 do not apply (no flat schema,
no fallbacks: every value is code-made); G3 holds (each mode is its own challenge type); G4 holds (every answer is
computed from the model the component renders).

**Not covered here:** the Auto (mixed) path: the route needs a pinned mode. Mixed sessions are covered by the vitest
generator tests (`buildCircuitWorkbench`/`buildVolcanoIsland`/`buildBuoyancyHarbor` with several tasks).

**Harness note (not a product issue):** the route normalizes "grade 4" to the band "elementary" and passes no exact
grade, so `gradeBand` reads K-2 in these runs. In lessons the exact grade comes from the objective (`ctx.grade`), which
the band now reads first.
