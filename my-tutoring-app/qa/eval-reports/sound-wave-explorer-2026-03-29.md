# Eval Report: sound-wave-explorer — 2026-03-29

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| observe | PASS | — |
| predict | PASS | — |
| classify | PASS | — |
| apply | PASS | — |

## Notes

### SWE-1 (FIXED)
- **Was:** Generator returns observe/predict types instead of apply — only 2 challenges produced. JSON parse errors at 66K position from schema overload.
- **Root cause:** Schema had ~30 properties (16 flattened obj0-obj3 fields + 13 fields per challenge item). Flash-lite couldn't handle the complexity — produced malformed JSON and ignored type enum constraints.
- **Fix:** SCHEMA-SIMPLIFY. Removed all obj0-obj3 fields from schema — objects are deterministic science facts (drum=low pitch/loud, etc.), picked by grade level in code. Trimmed challenge schema to 8 required fields. Added post-process type forcing as SP-9 safety net. Schema went from ~30 properties to ~8.
