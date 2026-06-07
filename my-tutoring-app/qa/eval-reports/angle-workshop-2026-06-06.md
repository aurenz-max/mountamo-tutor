# QA Eval Report — `angle-workshop`

**Date:** 2026-06-06
**Tester:** Claude Code (eval-test QA)
**Dev server:** http://localhost:3000
**Architecture:** Fork A pool service — all per-challenge data built in code (`selectAngleWorkshopChallenges`), Gemini emits wrapper metadata only (title/description/challengeType/gradeBand).

## Results Table

```
QA Results — angle-workshop
| Eval Mode       | API      | #Ch | G1   | G2  | G3   | G4   | G5   | Verdict |
|-----------------|----------|-----|------|-----|------|------|------|---------|
| measure         | 200 pass |  4  | PASS | N/A | PASS | PASS | PASS | PASS    |
| classify_pairs  | 200 pass |  4  | PASS | N/A | PASS | PASS | PASS | PASS    |
| solve_unknown   | 200 pass |  4  | PASS | N/A | PASS | PASS | PASS | PASS    |
| solve_algebraic | 200 pass |  4  | PASS | N/A | PASS*| PASS | PASS*| PASS    |
| transversal     | 200 pass |  5  | PASS | N/A | PASS | PASS | PASS | PASS    |
```
\* solve_algebraic G3/G5 FAILED on first run (supplementary monoculture via an always-firing fallback). Fixed in the generator — now PASS. See "Fix applied" below.

## Per-mode challenge summary (first run)

### measure (4 ch, aw-1..aw-4)
| id | angleMeasure | expectedAnswer | tol | range 10..170 |
|----|--------------|----------------|-----|---------------|
| aw-1 | 35 | 35 | 2 | ✓ |
| aw-2 | 45 | 45 | 2 | ✓ |
| aw-3 | 50 | 50 | 2 | ✓ |
| aw-4 | 130 | 130 | 2 | ✓ |
G4: expectedAnswer === angleMeasure for all. Variance: 4 distinct measures. Angle drawn, only `?°` labeled (no leak).

### classify_pairs (4 ch)
| id | relationship | expectedRelationship | split | outer | cross | check |
|----|-------------|----------------------|-------|-------|-------|-------|
| aw-1 | complementary | complementary | 70 | – | – | 0<70<90 ✓ |
| aw-2 | supplementary | supplementary | 135 | – | – | 0<135<180 ✓ |
| aw-3 | vertical | vertical | – | – | 60 | 10..170 ✓ |
| aw-4 | adjacent | adjacent | 55 | 120 | – | outer∉{90,180} ✓, 0<55<120 ✓ |
G4: expectedRelationship === relationship for all; adjacent outerAngle=120 ∉ {90,180}. Variance: all 4 relationships present.

### solve_unknown (4 ch)
| id | solveConfig | known | known2 | expected | recomputed | formula |
|----|-------------|-------|--------|----------|-----------|---------|
| aw-1 | vertical | 155 | – | 155 | 155 | k |
| aw-2 | complementary | 25 | – | 65 | 65 | 90−k |
| aw-3 | supplementary | 30 | – | 150 | 150 | 180−k |
| aw-4 | around_point | 130 | 130 | 100 | 100 | 360−k−k2 |
G4: all recomputed answers match, all > 0. Variance: all 4 configs present.

### solve_algebraic (4 ch)
| id | algConfig | a1 | b1 | a2 | b2 | x | recomputed x | angle1 | angle2 | sum/equal | valid |
|----|-----------|----|----|----|----|---|--------------|--------|--------|-----------|-------|
| aw-1 | complementary | 1 | 30 | 1 | 42 | 9 | (90−30−42)/2=9 | 39 | 51 | 90 | ✓ |
| aw-2 | supplementary | 2 | 10 | 1 | 140 | 10 | (180−10−140)/3=10 | 30 | 150 | 180 | ✓ |
| aw-3 | complementary | 1 | 25 | 2 | 38 | 9 | (90−25−38)/3=9 | 34 | 56 | 90 | ✓ |
| aw-4 | vertical | 3 | 10 | 2 | 19 | 9 | (19−10)/(3−2)=9 | 37 | 37 | equal | ✓ |
G4: every x is a positive integer; every angle pair is in range and satisfies its relationship. **G3 NOTE:** on first run the supplementary case was the fixed fallback `(a1:2,b1:10,a2:1,b2:140,x=10)` on EVERY session — a monoculture caused by a bug (see fix). After the fix, supplementary produces varied valid problems.

### transversal (5 ch)
| id | shape | rel | g1 | g2 | expected | recomputed | check |
|----|-------|-----|----|----|----------|-----------|-------|
| aw-1 | triangle_sum | – | 70 | 80 | 30 | 180−70−80=30 | third>0 ✓ |
| aw-2 | triangle_sum | – | 65 | 45 | 70 | 180−65−45=70 | third>0 ✓ |
| aw-3 | parallel_transversal | corresponding | 85 | – | 85 | =g1=85 | <180 ✓ |
| aw-4 | exterior_angle | – | 45 | 55 | 100 | 45+55=100 | <180 ✓ |
| aw-5 | exterior_angle | – | 75 | 65 | 140 | 75+65=140 | <180 ✓ |
G4: all per-shape formulas match; all angles positive and < 180; triangle third angles > 0. Variance: 3 shapes present (triangle_sum, parallel_transversal, exterior_angle).

## G1–G5 Sync Check

- **G1 Required fields — PASS (all modes).** Every challenge carries the full contract field set for its type (id, type, narration, instruction, hint, answerKind, expectedAnswer, tolerance, plus the mode-specific fields). No missing/undefined fields. The post-build `recomputeExpected` self-check guard runs over every numeric challenge before return.
- **G2 — N/A.** Fork A pool service builds challenges locally; there is no flat-field-to-nested reconstruction step. Counts: measure/classify/solve_unknown/solve_algebraic = 4, transversal = 5 (all within 3–6, unique sequential ids `aw-1`..).
- **G3 Variance — PASS (after fix).** measure rotates distinct measures; classify rotates all 4 relationships; solve_unknown rotates all 4 configs; transversal rotates all 3 shapes. solve_algebraic FAILED initially (supplementary stuck on the fallback constant) — fixed; comp/supp/vertical now all vary.
- **G4 Answer derivability — PASS (all modes).** Every numeric answer was independently recomputed from the figure fields and matched `expectedAnswer` exactly; every algebraic x is a positive integer with both resulting angles valid and summing/equal correctly; no out-of-range angles in any mode. classify answers (`expectedRelationship`) match `relationship`.
- **G5 Fallback audit — PASS (after fix).**
  - **buildAlgebraic loop fallback (lines 253–274):** both branches produce contract-valid challenges (vertical: angle1=angle2=30; comp/supp: valid sums). The fallback is meant to fire only after 300 failed tries. **BUG FOUND:** the supplementary branch hit the fallback on 100% of runs because the constant-term cap `b2 > 70` is unsatisfiable for supplementary (angle2 = 180−angle1 is routinely 100–160, so b2 = angle2 − a2·x exceeds 70). The result was a valid-but-identical supplementary problem every session. **Fixed** by scaling the cap with the relationship target (`b2Max = supplementary ? 150 : 70`). After the fix the loop succeeds and the fallback no longer fires in normal operation.
  - **dedup back-fill (lines 464–473):** appends valid challenges from the same `build*` functions; duplicates accepted only when the structural variant space is exhausted. At the requested counts (4–5) the rotation always finds enough distinct challenges, so it does not fire. Valid either way.
  - **recomputeExpected guard (lines 361–398):** covers all numeric modes (measure, solve_unknown all 4 configs, solve_algebraic comp/supp/vertical, transversal all 3 shapes) and corrects any drift before return. Consistent with the contract.

## Fix applied

**File:** `my-tutoring-app/src/components/lumina/service/math/gemini-angle-workshop.ts` (in `buildAlgebraic`)
**Belongs in:** GENERATOR.
**Root cause:** Flat `b2 > 70` cap starved the supplementary branch (its second angle is large), forcing the fallback on every supplementary session → G3 monoculture + G5 fallback-always-firing.
**Change:** Cap the constant term relative to the relationship target:
```ts
const b2Max = cfg === 'supplementary' ? 150 : 70;
if (b2 < -40 || b2 > b2Max) continue;
```
**Verification:** Re-ran solve_algebraic ~9 times; supplementary now yields varied valid problems
(e.g. `(x+10)°/(x+148)°→x=11`, `(x+15)°/(2x+129)°→x=12`, `(2x+30)°/(2x+110)°→x=10`), each summing to 180 with both angles in (0,180). All 5 modes still `status:pass`.

## Answer-leak check
- **measure** — Canvas draws both rays and the wedge but labels only `?°`; the protractor overlay marks where the second ray crosses the scale with a dot (a reading cue), never printing the number. Answer gated behind "Place the protractor." No leak.
- **classify_pairs** — No degree measures rendered; only `α`/`β` symbols. The relationship (the answer) is not labeled. No leak.
- **solve_unknown / solve_algebraic / transversal** — Only the given/known angles (or expressions) are labeled; the unknown is shown as `x°`. No leak.

## Verification
- All 5 modes return `status:"pass"` after the fix.
- `tsc --noEmit` from `my-tutoring-app`: 1441 errors — at/under the 1444 baseline; the edit compiles cleanly with no new errors.

## Non-blocking observations (not G1–G5 failures, no fix applied)
- **`buildMeasure` line 111 dead code:** `r5(randInt(3,33)*5) === 0 ? 90 : randInt(3,33)*5` — `randInt(3,33)*5` is already a multiple of 5 (15..165), so `r5(...)` is identity and never 0; the `? 90 :` branch is unreachable and the ternary makes a wasted second random draw. Output is always a valid 15..165 measure (within the 10..170 contract), so it is not a G-failure. Recommend simplifying to `const angleMeasure = randInt(3, 33) * 5;` in future polish.
