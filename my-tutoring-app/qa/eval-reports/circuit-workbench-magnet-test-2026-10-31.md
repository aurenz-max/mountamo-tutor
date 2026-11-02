# circuit-workbench `magnet_test` (2026-10-31, `/add-eval-modes`, SB-6, G3)

**Mode:** a red horseshoe magnet held above a pad on the workbench. The learner guesses Pulls or Stays for each test
thing (never graded) and it goes under the magnet; a thing with iron in it jumps up to the magnet. Then, without
testing, the learner calls whether the magnet pulls each other thing, and presses Check. β 1.5, scaffoldingMode 2,
answer `tap`. Homes (SB-0): G3 `SCI001-05-a/b`, K `SCI001-01-F`.

15 things (`magnetModel.ts`): steel paper clip, iron nail, steel washer, steel bolt (pulled); aluminium foil and can
tab, copper coin and wire, brass key (metals that stay put); plastic, wood, rubber, paper, glass.

| Tier | Tests | To decide |
|---|---|---|
| easy | an iron thing and a non-metal | 1 |
| medium | iron, a non-iron metal, a non-metal | 2 (one pulled, one not) |
| hard | the same | 2 metals, one of them not iron |

**Misses:** `all_metal_sticks`, `sort_slip`. **Levers:** `magnet_tags` (legend: what each thing is made of: iron or
steel, another metal, or not a metal) and `one_step_less`. The circuit x-ray is now scoped to the circuit modes (no
circuit in a magnet test).

**Verification:** `magnetModel.test.ts` 5; mounted test (copper coin called pulled is `all_metal_sticks`; right calls
pass); `test:primitive circuit-workbench` passed; `typecheck:lumina` 0; full tsc 770. Browser Grade 3 medium
`drive-magnet.mjs` 20/20. $0 Gemini. Hard in vitest only.

**Found on the way:** `circuitLevers.test.ts` had been failing since `build_device` (its `missing_part`/`extra_part` are
answered by the easier item, not the x-ray); `test:primitive` does not run that file, so the gate did not show it.
Fixed. **Seen, not fixed:** the battery stays on the table in a magnet test, where it does nothing.
