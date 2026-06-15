# tape-diagram — Support-Tier Difficulty Sweep (eval-test Step 2c)

Date: 2026-06-14 · topic "Part-whole word problems" · gradeLevel "grade 3" · dev @ localhost:3000
Sweep: each mode @ easy & hard + one null-tier baseline on solve_part_whole. 9/9 calls HTTP 200, status `pass`, challenges > 0. No CRITICAL, no HIGH.

## Result: PASS (all 4 modes, both axes)

| mode | easy | hard | scaffold flip | structural lever |
|------|------|------|---------------|------------------|
| represent | 2 segs, tier=easy | 4 segs, tier=hard | bracket none (component always showBracket:false in represent) | partCount 2 → 4 ✓ |
| solve_part_whole | phaseScaffold `full`, unknown=`one` `[F,F,T,F]` | phaseScaffold `apply-only`, unknown=`known-part` `[F,T,F,F]` | phase full→apply-only ✓; total stays LABELED (intentional) | unknown placement one → known-part ✓ |
| solve_comparison | showKnown=true, hideNonAnswer=false, unknownPart=`difference` | showKnown=false, hideNonAnswer=true, unknownPart=`quantity1` | hideNonAnswerValue false→true + showKnown true→false ✓ | forcedUnknownPart difference → quantity1 ✓ |
| multi_step | lockSteps=true, `Total = 33`, solveOrder `[2,3]` (4 segs) | lockSteps=false, `Total = ?`, solveOrder `[2,4,5]` (6 segs), step3Hint present | lockSteps true→false ✓; bracket label withdrawn (`Total = N`→`Total = ?`, showBrackets stays true) ✓ | solveOrder len 2 → 3 ✓ |

## Assertions

1. **Scaffold flips** — PASS. comparison hard sets `hideNonAnswerValue=true`; part-whole `phaseScaffold` full→apply-only; multi_step `lockSteps` true@easy/false@hard; multi_step bracket label withdrawn (`Total = ?`). Not identical across tiers.
2. **Structural levers move** — PASS. represent partCount 2→4; part-whole unknown one→known-part; comparison unknownPart difference→quantity1 (forced/deterministic, both hard challenges identical pick); multi_step solveOrder length 2→3.
3. **Magnitude invariance** — PASS. Given/segment values stay in grade-3 band (single-/low-double-digit) at every tier; hard is NOT bigger numbers. Larger multi_step values (15/20/14) are computed *answers* (unknown segments), not inflated givens.
4. **No answer leak** — PASS.
   - The `isUnknown` answer segment value is never displayed (component renders `?` until `feedback===correct`, independent of `showKnownValues`).
   - `showKnownValues` only gates KNOWN segments; comparison hard hides the non-answer known bar via `effectiveShowKnownValues = showKnownValues && !hideNonAnswerValue`.
   - Explore-phase labeled total: component gates `showBracket = showBrackets && currentPhase !== 'explore'`, so the total is shown only from Practice on.
   - multi_step hard 6-segment build: unknown flags `[F,F,T,F,T,T]` = indices {2,4,5} = solveOrder `[2,4,5]` exactly. No unreachable unknown segment.
5. **Null-tier no-op** — PASS. Baseline solve_part_whole: `supportTier`=undefined, `phaseScaffold`=undefined (→component default 'full'/explore), `showKnownValues`=undefined (→default true), `lockSteps`=undefined (→default true), unknown placement = un-tiered `two` (`[F,F,T,T]`). New fields all absent.

## Intentional deviation (NOT a bug)

part-whole keeps the total **LABELED** at hard (`Total = 15`, showBrackets true). Verified the code does this (`bracketLabelMode` hardcoded `'total'` for solve_part_whole at every tier). The total is the GIVEN (this generator's unknowns are always PARTS, never the total); at hard the unknown is segment[1], a known part found by total-minus-part — so the labeled total is required to make the problem solvable and never reveals the answer. The hard "withdraw the number" move lives in multi_step instead (`Total = ?`). No real answer leak. OK.

## CRITICAL / HIGH: none.
