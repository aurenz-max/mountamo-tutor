# comparison-builder — Support-Tier Difficulty Sweep (Step 2c)

**Date:** 2026-06-14
**Topic:** "Comparing numbers to 20" · **Grade:** grade 1 (maxNumber band = 20)
**Modes swept:** compare_groups, compare_numbers, one_more_less, order — each easy + hard; + 1 baseline (compare_groups, no tier)
**Route:** `GET /api/lumina/eval-test?componentId=comparison-builder&evalMode=…&difficulty=…`
**Result:** All 9 calls `status:pass`, 5 challenges each, 0 errors. **VERDICT: PASS.**

---

## Per-mode results

| Mode | Tier | supportTier | Scaffold flags | Structural lever |
|------|------|-------------|----------------|------------------|
| compare_groups | easy | easy | countBadges=T, correspondence=**live**, alligator=T | gaps 5,6,0(eq),6,6 → far apart |
| compare_groups | hard | hard | countBadges=**F**, correspondence=**off**, alligator=F | gaps **all 1**, never 0 (3v4,6v5,9v10,14v13,18v19) |
| compare_numbers | easy | easy | alligator=**T** | distinct-tens (2v8, 14v5, 7v19, 18v3, 6v17) |
| compare_numbers | hard | hard | alligator=**F** | **same-tens** (11v12, 15v13, 14v17, 19v16, 18v19) |
| one_more_less | easy | easy | targetMarker=**T**, alligator=T | askFor=**one-more** only |
| one_more_less | hard | hard | targetMarker=**F** | askFor=**both** |
| order | easy | easy | slotHints=**T** | dir=**ascending** |
| order | hard | hard | slotHints=**F** | dir=**descending** |
| compare_groups | — (baseline) | **null** | all flags absent/default | LLM-chosen gaps (1,2,0,3,4), no enforcement |

---

## Assertions

1. **Scaffold flips (4 new fields easy→hard):** PASS.
   - compare_groups: `showCountBadges` T→**F**; `correspondenceMode` live→**off**.
   - compare_numbers: `useAlligatorMnemonic` T→**F**.
   - one_more_less: `showTargetMarker` T→**F**.
   - order: `showSlotHints` T→**F**.

2. **Structural levers move:** PASS.
   - compare_groups gap → **exactly 1 at hard, never 0** (equal excluded); far (≥5) at easy.
   - compare_numbers → **same-tens at hard** (shared tens digit, ones-place compare); distinct-tens at easy. Same band (≤20).
   - order → **descending + no slot hints at hard**; ascending + hints at easy.
   - one_more_less → one-more only (easy) → both (hard).

3. **LEAK CLOSED — count badges off at hard for compare_groups:** PASS (key check).
   - `showCountBadges=false` at hard (component hides the "Left: N / Right: N" readout).
   - All 5 hard instructions verified: none state either count. They say "more or fewer … than the right group" — no numbers leaked pre-answer.

4. **Magnitude invariance:** PASS.
   - maxNumber band unchanged (all numbers ≤20 at both tiers, both modes).
   - gap (compare_groups) and digit-overlap (compare_numbers) stay in the same number band; harder tier ≠ bigger numbers.
   - one_more_less keeps the amber Target box (stimulus) — only the number-line pre-highlight `showTargetMarker` is withdrawn at hard.

5. **Null-tier no-op:** PASS.
   - Baseline (no `difficulty`): `supportTier=null`; all four scaffold fields absent → component defaults (badges on, correspondence on-check, marker on, hints on). No structural enforcement (LLM-chosen gaps 1–4 incl. equal). Byte-compatible with pre-tier behavior.

6. **order uses direction + slot-hints, NOT item count:** PASS. Both tiers carry 3–5 items (easy: 3,4,4,5,5; hard: 3,4,5,5,5) — count is NOT a lever; only `direction` (asc→desc) and `showSlotHints` change.

7. **compare_numbers stays a </>/= production task:** PASS. Every hard challenge has `correctSymbol`, no MC `options` field — still a symbol pick, not MC-of-statements.

---

## Issues
None (CRITICAL / HIGH / MED): no errors, no leaks, no magnitude drift. Ship.
