# Eval Report: length-lab — 2026-03-29

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| compare | PASS | — |
| tile_and_count | PASS | — |
| order | PASS | Fixed: LL-1, LL-2 |
| indirect | PASS | Fixed: LL-3, LL-4 |

## Fixed Issues

### LL-1 — order: Duplicate object name made challenge uncompletable (CRITICAL → FIXED)

**Was:** `objectName0 = "straw"`, `objectName2 = "straw"` — `OrderingWorkspace` removes available items by name, so clicking the first "straw" removed both; 3rd slot could never be filled.

**Fix:** Post-process `order` case now walks `lengths[1]` and `lengths[2]` through a `usedOrderNames` Set; on collision, picks the first unused name from `objectPool`. Writes back to both `lengths[i].name` and `challenge.objectNameN`. (SP-11)

### LL-2 — order: Instruction text referenced wrong object names (HIGH → FIXED)

**Was:** All 3 order challenge instructions named objects not present in the challenge (e.g. "feather, the book, and the paintbrush" when actual objects were "feather, paintbrush, straw").

**Fix:** After name deduplication, `challenge.instruction` is always overwritten with a template using the actual (deduped) names: `"Put the [n0], [n1], and [n2] in order from shortest to longest!"`. Objects listed in array order (not sorted), so no answer is revealed.

### LL-3 — indirect: Clues don't form valid transitive chain (HIGH → FIXED)

**Was:** `referenceObjectLength` not constrained to be strictly between the two object lengths — `clue1 = "The ruler is much longer than the straw"` but correct answer required ruler < straw.

**Fix:** Post-process `indirect` case now:
1. Ensures `|objectLength0 - objectLength1| >= 2` (nudges longer object +2 if gap < 2)
2. Clamps `referenceObjectLength` strictly between `indShorter` and `indLonger`
3. Always regenerates `clue0` ("The [shorter_obj] is shorter than the [ref].") and `clue1` ("The [ref] is shorter than the [longer_obj].") from corrected lengths
4. Always derives `correctAnswer` from actual lengths (not LLM value)

### LL-4 — indirect: Reference object same length as compared object (HIGH → FIXED)

**Was:** `objectLength0 (crayon) = 6`, `referenceObjectLength (ribbon) = 6` — equal, so `clue0 = "The crayon is longer than the ribbon"` was factually wrong.

**Fix:** Same fix as LL-3 — the strict-between clamp prevents `referenceObjectLength` from equalling either endpoint.
