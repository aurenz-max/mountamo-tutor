# Eval Report: addition-subtraction-scene — 2026-03-16

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| act_out | PASS | — |
| build_equation | PASS | — |
| solve_story | PASS | — |
| create_story | PASS | — |

## Notes

### AS-1 (RESOLVED): Invalid objectTypes render as fallback emoji

**Fix:** Added `VALID_OBJECT_TYPES` enum to schema constraining objectType to the 14 values in the component's `OBJECT_EMOJI` map. Added `SCENE_DEFAULT_OBJECTS` fallback in post-process for any invalid objectType. Added explicit list to prompt requirement #8.

### AS-2 (RESOLVED): Story/operation mismatch (storyType vs operation)

**Fix:** Added post-process derivation: `join` → `addition`, `separate` → `subtraction`. Compare and part-whole left as-is (both operations valid). Existing math recomputation (resultCount + equation rebuild) cascades correctly from the corrected operation.
