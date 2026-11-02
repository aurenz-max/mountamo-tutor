# buoyancy-harbor `cargo_two_designs` (2026-10-30, `/add-eval-modes`, SB-4)

**Mode:** compare two boat designs (K-2-ETS1-3, 3-5-ETS1-3). The learner builds boat B (both boats at hard), guesses
which carries more (never graded, locked once a boat is tested), loads each boat with pennies until it sinks, and taps
which carried more. Code judges the claim against `capacity` (the same number the tank shows). Changing a boat clears
its test. β 2.5, scaffoldingMode 3, answers `build` + `tap`, catalog + backend registry. 3 items single, 1 in a mix.

| Tier | Boat A | Rule |
|---|---|---|
| easy | given | any different boat B |
| medium | given | boat B changes one thing (a fair test) |
| hard | learner builds | the item asks a question (material / shape / size, a different one each item); the boats differ only in that |

Fairness (`cargoFair`, also in `validate`): a given boat A floats with at least one penny, and some allowed boat B carries
more and some less, so "the new one wins" is never the rule. Hard: the question part changes the result for some pair; a
material question needs two materials.

**Misses:** `changed_two` / `wrong_change` (unfair test) → `changes_marked` (marks: a "changed" tag beside each part
that differs), then `one_step_less`; `kept_prediction` (claim = the wrong guess) / `misread_results` → `penny_rows`
(layout: each tested boat's pennies as a row of dots, A above B), then `one_step_less`. The easier item: both boats built,
one change apart with a clear difference, never the item's boat A. x-ray is not offered on this mode.

**Tutor guidance:** at the 4,000-char cap again; `find_the_rule` and `build_boat` moves were shortened (guarded in
`cargoModel.test.ts` and `ruleModel.test.ts`).

**3D:** no new scene code; the boat on the panel is the boat on the stand and in the tank.

**Verification:**
- `cargoModel.test.ts` 16 (check, misses, feedback leak, tiers, fairness, generator/validator, scene leak, guidance
  length, lever order, easier item); 2 mounted workspace tests (kept guess → named miss → a changed boat is retested →
  pass → advance; change marks, penny rows, easier item).
- physics folder 215/215 + workspace 14/14, `test:primitive buoyancy-harbor` 729/729, `typecheck:lumina` 0, full tsc
  770 (baseline 770).
- Browser, Grade 2 medium (`drive-cargo.mjs`, `buoyancy-harbor-drive-2026-10-30/cargo-g2/`): 19/19. Item 3's one change
  made boat B carry less (8 vs 2), as fairness intends.
- Spend: $0 (code-only generator; the pinned mode makes no model call).

**Not yet run:** a hard-tier browser drive (the tester has no tier picker; hard is covered by unit and validator
tests), `/eval-test`, a Live sample (user).
