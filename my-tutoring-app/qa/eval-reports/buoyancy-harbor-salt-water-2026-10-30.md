# buoyancy-harbor `salt_water` (2026-10-30, `/add-eval-modes`, SB-4)

**Mode:** the learner drops 1-3 foods into fresh water after a Float/Sink guess (never graded); every food sinks. Then
they add salt a spoon at a time, or pour some out, until the foods the goal names float and the others stay down, and
press I'm done!. Code judges: water density = 1 + 0.02 per spoon; a food floats when its density is below.
β 3.0, scaffoldingMode 3, answer `manipulate`, catalog + backend registry.

| Tier | Item | Window |
|---|---|---|
| easy | one food to float | from its spoon to the jar's 8 |
| medium | float one, keep one down | 2+ spoons |
| hard | three foods | exactly 1 spoon |

Foods (g/cm³): big sweet potato 1.03, egg 1.05, baby carrot 1.07, potato chunk 1.09, grape 1.11. The big one floats
first and the small grape last, so size does not decide it.

**Misses:** `too_little_salt`, `too_much_salt`. **Levers:** `xray` (a sunk food's blue arrow grows with each spoon) and
`one_step_less` (one food alone to float). Try again keeps the water.

**3D:** the water's push uses the salt's density; foods' density gap is drawn 30x wider (clamped 0.35-3) so a spoon shows
within seconds; the water clouds with salt; grains fall on each spoon. Two bugs were found in the drive and fixed: a food
crawled for ~7 s after a spoon (12x gap), and at 30x without a clamp the drawn density went negative.

**Verification:**
- `saltModel.test.ts` (model, tiers, validator, scene leak, levers).
- 2 mounted workspace tests (miss, then Try again keeps the water, then pour out and pass; practice item).
- `test:primitive buoyancy-harbor` 725/725, `typecheck:lumina` 0, full tsc 770 (baseline 770).
- Browser, Grade 4:
  - `drive-salt.mjs` 25/26. The one failure is the offline tester's `observe-dialogue`/`observe-learner` 400s, also present in the 10-29 drives.
  - `drive-salt-levers.mjs` 7/7.
  - Screenshots are in `buoyancy-harbor-drive-2026-10-30/`.
- Spend: $0 (Gemini). The FitGate judge passed salt_water at 0.73.

**Not yet run:** the K-2 band in the browser, `/eval-test`, and a Live sample (the user runs it; the boss path is unchanged).
