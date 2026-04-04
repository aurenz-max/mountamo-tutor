# Eval Report: number-line — 2026-04-03

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| plot      | PASS   | 0      |
| jump      | PASS   | 0      |
| order     | PASS   | 0      |
| between   | PASS   | 0      |

## Resolved Issues

### NL-1 (was HIGH): plot — Sub-range too wide for large number ranges
- **Fixed:** Added `maxSpan` option to `createSubRangePool` in numberPoolService.ts. Number-line generator now passes `maxSpan: 25`, capping the display window at 25 units regardless of the full manifest range. For 0-1000 ranges, this produces spans like 481-506 instead of 459-774.
- **Pattern:** SP-2 (value overflow)
- **Files:** `service/math/numberPoolService.ts`, `service/math/gemini-number-line.ts`
