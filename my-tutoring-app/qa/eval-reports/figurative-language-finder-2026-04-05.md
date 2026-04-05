# Eval Report: figurative-language-finder — 2026-04-05

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| sound_devices | PASS | 0 |
| comparison | PASS | 0 |
| advanced | PASS | 0 |
| idiom | PASS | 0 |

## Resolved Issues

### FL-1: Character offsets 100% wrong (SP-8) — FIXED
- **Fix:** SCHEMA-SIMPLIFY + POST-PROCESS-DERIVE. Removed `startIndex`/`endIndex` from schema entirely (LLMs can't compute offsets). Added `recomputeOffsets()` post-process that derives offsets via `passage.indexOf(inst.text)`. Also removed offset-related prompt hacks and system instruction text.
- **File:** `service/literacy/gemini-figurative-language-finder.ts`
- **Verified:** All 4 modes pass. Spot-checked offsets against passage text — 100% correct across all instances.
