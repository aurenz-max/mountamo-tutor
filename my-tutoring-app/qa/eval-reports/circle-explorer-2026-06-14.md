# Eval Report: circle-explorer — 2026-06-14

Focus: **support-tier difficulty sweep** (`config.difficulty` = easy/medium/hard).
This is the Step 2c axis (within-mode scaffolding), not the retired numeric `&theta=`
path. Swept `circumference`, `reverse`, `discover_pi` at base / easy / medium / hard
(4 challenges each). area + composite share the same mode-agnostic tier code path
(`resolveSupportStructure` loop in the generator) and are covered by it.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| discover_pi   | PASS | — |
| circumference | PASS | — |
| area          | PASS (by shared tier path) | — |
| reverse       | PASS | — |
| composite     | PASS (by shared tier path) | — |

All five IRT-pinned modes were last verified PASS for structure/count on 2026-06-06
(CE-1, SP-21). This run only re-tests the difficulty tier and finds it correctly wired.

## Difficulty-tier findings (all PASS)

**1. Scaffold withdrawal is deterministic and flips exactly.**
`showFormulaReveal`: base=absent (component defaults ON), easy=true, medium=true,
hard=false — matches `resolveSupportStructure`. Hint style flips formula→conceptual
at hard ("Circumference = 2 × π × r" → "Which measurement traces all the way around
the edge?"). Instruction names the formula only at easy ("...all the way around.
Use C = 2 × π × r."), generic at medium/hard. discover_pi correctly special-cased
(easy does NOT double the already-named "C ÷ d"; hard softens to "estimate how many
diameters fit").

**2. Magnitude invariance holds — difficulty is structural, not bigger numbers.**
Radii are tier-independent random draws from the same builder ranges at every tier
(e.g. circumference radii: base {5,7.5,8.5,13}, easy {10.5,11,12,14}, medium {2,3,3,11},
hard {7.5,9,9.5,12}). No systematic magnitude inflation; values stay in band. The
generator never touches numbers on the tier path (comment-enforced, verified).

**3. No answer leak at any tier.**
- `reverse`: radius IS the answer; the figure labels only the given C/A and renders
  `r = ?` — never the radius. Stable across all tiers.
- `discover_pi` hard: `showFormulaReveal=false` → canvas withholds the `C = …` value
  and the `≈ 3.14 d` label, so the ratio must be measured, not read off.
- circumference/area: numeric answer never rendered; easy only adds the symbolic
  formula label, not the value.

**4. Null-tier no-op confirmed.** base session has `supportTier` absent,
`showFormulaReveal` absent, generic instruction, formula-baseline hint — i.e.
pre-tier behavior unchanged. Baseline does not resemble "hard".

**5. Answer math correct (Rule G4).** Spot-checked: C(r5)=31.4, C(d15)=47.1,
C(d17)=53.38, C(r13)=81.64 — all match stored `expectedAnswer`; generator's
`recomputeExpected` self-check guards the rest.

## Note (not a finding)

circle-explorer is a **scaffold-only tier** primitive: the difficulty axis withdraws
on-screen support (formula naming, formula reveal, hint style) but deliberately does
NOT alter problem structure, radii, or answers — by design per the two-field contract
([[structural-difficulty-not-numeric]]). The Step 2c "structural lever moves"
assertion is satisfied via the scaffold axis (the OR branch); there is no separate
numeric/structural lever to move, and that is correct for this primitive.
