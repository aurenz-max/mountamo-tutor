# sorting-station — Support-Tier Difficulty Sweep (Step 2c)

**Date:** 2026-06-14 · **Topic:** "Sorting by attribute" · **Grade:** grade 1 (band `1`)
**Modes:** sort_one, sort_attribute, count_compare, odd_one_out, two_attributes, tally_record
**Sweep:** each mode @ difficulty=easy and =hard + 1 baseline (sort_one, no difficulty). 13 calls, all HTTP 200, all `status=pass`, `catalogMeta` set on every call (correct id separators `componentId=sorting-station` / underscore evalMode IDs).

## Result: PASS (no CRITICAL / HIGH)

### 1. Scaffold flip ✓
- `showCounts`: **easy=true → hard=false** in every mode. Baseline (null tier) = true (default).
- Model item (`modelItemId`/`modelItemBin`): present at **easy ONLY** and **only** for sort_one (obj1/obj5/obj11/obj13) and tally_record (obj1/obj6/obj11/obj16). Absent at hard for those; **never** present on sort_attribute, count_compare, odd_one_out, two_attributes (any tier). Matches `modelEligible` (sort-by-one | tally-record) ∧ easy.

### 2. Structural levers move ✓
- **Bins ramp:** sort_one 2→3, sort_attribute 2→2/3, tally_record 2→2/3, count_compare 2→3. Never > grade cap 4.
- **Objects ramp:** sort_one 4→6, sort_attribute 4→6, tally_record 5→8, odd_one_out 4→8, two_attributes 6→8.
- **count_compare gap (code-enforced, trims only):** easy gaps `[3,2,1,1]` (reaches the wide 3; `enforceCompareGap` never pads up so naturally-narrow sets stay narrow); hard gaps `[2,2,2,2]` (3 groups, clamped tight — never widens past 2). Direction correct.
- **odd_one_out shared-attrs (prompt-shaped):** easy `[0,1,0,0]` (obvious) → hard `[1,2,2,2]` (subtle). Clear ramp.
- **two_attributes:** 6→8 objects, near-miss density prompt-shaped (no numeric handle; correct by design).

### 3. Magnitude invariance ✓
Across ALL 13 results: **0** challenges exceed grade-1 caps (objects ≤8, bins ≤4, `maxCategories` ≤4). Harder tier raises STRUCTURE (gap/shared-attrs/distractors), never raw magnitude past the cap.

### 4. GUARDS ✓ (key checks)
- **Model excluded from grading:** component skips `objId === modelItemId` in grading loops (sort-by-one + tally-record), `gradeableTotal = objects.length − (modelItemId?1:0)`, model is locked/non-removable. Not a free point. ✓
- **Category labels kept** at every tier on sort_attribute (e.g. `['Red','Yellow']`, `['Red','Blue','Yellow']`) and two_attributes (e.g. `['Yellow Fruits','Others']`, `['Blue Clothes','Others']`). The label/attribute IS the task and is preserved. ✓
- **odd_one_out reason never leaked on-screen:** `oddOneOutReason` exists in data but the component renders it ONLY inside the post-correct-answer feedback string — never in any pre-answer render and never in `aiPrimitiveData`; `tutorRevealClause('odd-one-out')` forbids the tutor naming it at every tier. ✓

### 5. Null-tier no-op ✓
Baseline (sort_one, no `difficulty`): `supportTier=undefined`, `showCounts=true` (default), no model items, `maxCategories=2` (natural). Byte-identical to pre-tier behavior.

## CRITICAL/HIGH
None.
