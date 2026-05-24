# Eval Report: histogram — 2026-05-22

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| identify_shape  | PASS | — |
| find_modal_bin  | PASS | — |
| read_frequency  | PASS | — |
| estimate_center | PASS | — |

All 4 challenges per mode generated and verified.

- Bin frequencies match the labeled shape (identify_shape).
- Modal bin from the data matches `expectedBinStart`/`expectedBinEnd` (find_modal_bin).
- Bin filter count matches `targetFrequency` (read_frequency).
- Mean/median computed from data matches `targetAnswer` after snap (estimate_center).
- `showStatistics: false` in estimate_center hides the answer-revealing stats panel.
- Frequency labels are correctly hidden in find_modal_bin and read_frequency.

## Notes (non-blocking)

- estimate_center prompt builds with `xAxisLabel.toLowerCase()`, producing `"temperature (°f)"` / `"height (cm)"`. Cosmetic only.
- identify_shape with n=25-40 occasionally produces a symmetric distribution whose peak sits one bin off-center due to sampling noise (e.g. hg-3 bins 0,3,5,4,6,6,8,2,1). Math is sound; visual ambiguity is borderline but within the acceptable range for "best describes".
