# number-bond — Support-Tier Difficulty Sweep (Step 2c)

**Date:** 2026-06-14
**Topic:** "Number bonds to 10" · grade 1 · maxNumber 10 (all tiers)
**Modes swept:** decompose, missing_part, fact_family, build_equation — each easy + hard; plus one null-tier baseline on missing_part.
**Result:** PASS (no CRITICAL, no HIGH). All 9 runs status=pass, 5 challenges each, catalogMeta resolved (single-mode pins).

> Note: catalog eval-mode IDs use underscores (`missing_part`, `fact_family`, `build_equation`); hyphenated IDs return `catalogMeta:null` and fall through to a grade-1 blend (not a tier bug, just the wrong key).

## Per-tier field snapshot

| mode | tier | supportTier | showCounters | showEquation | showFactFamilyHelper |
|------|------|-------------|--------------|--------------|----------------------|
| decompose | easy | easy | true | true | true |
| decompose | hard | hard | false | false | false |
| missing_part | easy | easy | true | true | true |
| missing_part | hard | hard | false | false | false |
| fact_family | easy | easy | true | true | true |
| fact_family | hard | hard | false | false | false |
| build_equation | easy | easy | true | true | true |
| build_equation | hard | hard | false | false | false |
| missing_part | (none) | undefined | true | true | **undefined** (→ component default true) |

## Assertions

1. **Scaffold flips** — PASS. easy = counters+equation+helper all true; hard = all false. Distinct on every mode. supportTier stamped correctly each run.
2. **Structural lever moves (missing-part)** — PASS.
   - easy (5/5): known part = the SMALLER value → unknown is the LARGER part (count-up, easiest). e.g. whole 9, known 2, unknown 7.
   - hard (3/5): known = LARGER → unknown is the small part (harder); 2/5 still smaller-known. Not pinned to larger-unknown (code `unknownSide=null` at hard = no steer). Lever demonstrably moved between tiers.
3. **Magnitude invariance** — PASS. Every whole in the 4–10 band at every tier; maxNumber=10 unchanged; hard is NOT bigger numbers.
4. **No answer leak** — PASS. Hard counters=false on all recall modes (missing_part, fact_family, build_equation) → no dots on given parts to count. Decompose `showWhole` always true. Missing-part stepper stays full 0..maxNumber range (component lines ~1179–1192), never narrowed toward the answer.
5. **Null-tier no-op** — PASS. Baseline supportTier undefined; showFactFamilyHelper undefined → component default `true` (helper always rendered, current behavior); counters/equation at grade-1 defaults (true/true). Byte-identical to pre-tier path.

## Verdict
Support tiers wired correctly. Scaffold withdrawal (dots, live equation, fact-family worked example) and the missing-part unknown-side structural lever both move easy→hard with magnitude held constant and no answer leak. No CRITICAL / HIGH findings.
