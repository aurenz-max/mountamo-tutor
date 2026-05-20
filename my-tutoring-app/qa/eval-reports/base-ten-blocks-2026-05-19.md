# Eval Report: base-ten-blocks — 2026-05-19

## Results

| Eval Mode     | Status | Challenges | Issues |
|---------------|--------|------------|--------|
| build_number  | PASS   | 5          | —      |
| read_blocks   | PASS   | 5          | —      |
| regroup       | PASS   | 5          | —      |
| operate       | PASS   | 4          | —      |

Workstream 1 prompt-floor sweep verified — all 4 modes produce 4-6 challenges. Math is sound across all modes (operands verified against targetNumber).

## Notes

### read_blocks — Instruction text leaks the block decomposition (BT-3) — RESOLVED
- **Was:** Every `read_blocks` instruction stated block counts in words (e.g. `"Look at these 2 hundreds blocks, 4 tens rods, and 5 ones units. What number do these blocks show?"`). Student could compute `2·100 + 4·10 + 5·1 = 245` from text alone, bypassing the pictorial-recognition skill and defeating the BT-2 UI-side fix at [BaseTenBlocks.tsx:204](../../src/components/lumina/primitives/visual-primitives/math/BaseTenBlocks.tsx#L204).
- **Fix (2026-05-19):** Two-layer fix in [gemini-base-ten-blocks.ts](../../src/components/lumina/service/math/gemini-base-ten-blocks.ts):
  1. **PROMPT-CHANGE** — `read_blocks` promptDoc tightened: explicit negative constraints forbid naming digit counts (`"N hundreds/tens/ones"`) or block words (`"hundreds blocks"`, `"tens rods"`, `"ones units"`, `"flats"`, `"rods"`) in the instruction text. Concrete generic examples provided.
  2. **POST-PROCESS-VALIDATE** — safety net regex detects either pattern in `read_blocks` instructions and replaces with a generic prompt ("Look at the blocks shown above. What number do they represent?").
- **Verification:** Re-ran `read_blocks` 3× (stochastic check). All 3 runs produced 5 clean instructions with zero count-language leaks. Hints still describe block appearance ("long rods", "large squares") which is pedagogically appropriate since hints surface only after failed attempts.
- **No regressions:** build_number, regroup, operate all PASS.
