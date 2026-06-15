# hundreds-chart — Support-Tier Difficulty Sweep (eval-test Step 2c)

Date: 2026-06-14 · topic: "Skip counting on the hundreds chart" · grade 2
Generator: `src/components/lumina/service/math/gemini-hundreds-chart.ts`
Component: `src/components/lumina/primitives/visual-primitives/math/HundredsChart.tsx`
Levers: generator-side (givenCells prefill + distractor closeness + instruction/hint). No showOptions.

## Result: PASS — no CRITICAL / no HIGH

All 9 calls returned status=pass with non-empty challenges. No code changes made.

## Sweep matrix

| call | mode | tier | n | given (per ch) | distractors |
|---|---|---|---|---|---|
| hs_easy | highlight_sequence | easy | 7 | 0 | n/a (no MC) |
| hs_hard | highlight_sequence | hard | 7 | 0 | n/a (no MC) |
| cs_easy | complete_sequence | easy | 5 | **5** | n/a |
| cs_hard | complete_sequence | hard | 5 | **2** (floor) | n/a |
| cs_baseline | complete_sequence | null | 5 | **3** (default) | n/a |
| ip_easy | identify_pattern | easy | 5 | full seq | FAR pool (scattered / whole grid / every row) |
| ip_hard | identify_pattern | hard | 5 | full seq | NEAR-miss shapes (checkerboard / diagonal stripe / every other row) |
| fsv_easy | find_skip_value | easy | 5 | **5** | FAR pool (e.g. sv=2 → {10,2,5,3}) |
| fsv_hard | find_skip_value | hard | 5 | **3** (floor) | NEAR ±1..±2 (sv=2→{2,3,4,5}, sv=5→{3,4,5,6}, sv=10→{8,9,10}) |

## Assertions

1. **Structural lever moves — PASS.** complete_sequence given 5→2; find_skip_value given 5→3 + distractors tighten from far pool to adjacent (sv±1..±2); identify_pattern distractors tighten from obvious far-pool to plausible near-miss shapes. highlight_sequence has no structural lever (expected — instruction/hint only).
2. **Floors respected — PASS.** complete_sequence hard given=2 (= floor, never below). find_skip_value hard given=3 (= floor, never below).
3. **Magnitude invariance — PASS.** skipValue pool stayed {2,5,10} (grade-2 band) at every tier; hard tiers used identical numbers to easy. No bigger numbers, no out-of-scope values.
4. **No answer leak / solvability — PASS.** cs/fsv prefilled givenCells never appear in the answer set (cs: correctCells = fullSeq − given, leak=[]; fsv: given cells are evidence, answer is the MC option). identify_pattern's givenCells==correctCells==fullSeq is BY DESIGN (whole sequence shown; the answer is the option choice, not cells) — not a leak. Hint present (non-null) on every challenge at every tier incl. hard. The (tightened) correct option is present in every MC option set at every tier.
5. **Null-tier no-op — PASS.** cs_baseline: supportTier undefined, prefill = default 3, distractor pools at defaults. Matches the documented byte-identical default path.

## Notes
- find_skip_value sv=10 hard yields only 3 options ({8,9,10}) because sv+1..sv+3 clamp at the 10 ceiling and sv-2 (8) / sv-1 (9) fill the rest — still contains the correct answer, still a valid near-miss set. Expected, not a defect.
- supportTier correctly stamped on every challenge when difficulty present; absent on baseline.
