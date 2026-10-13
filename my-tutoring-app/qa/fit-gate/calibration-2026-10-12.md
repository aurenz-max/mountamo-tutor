# Fit gate calibration, 2026-10-12

26 visual items from replays of student 1004's 6 Pulse picks (K / G1 math), labelled by hand
(fits the subskill or not), judged by `judgeFit` (Jev, ~300 ms, ~100-350 input tokens per item).

| Signal | Misses (11) | Fits (15) |
|---|---|---|
| teaches (P) | 0.02-0.15, one 0.32 | 0.28-0.94 |
| numbers = some_outside | 5 of 11 at >= 0.68 | 1 of 15 (r6#1, base-ten built 20 for "11-19": a real miss, relabelled) |
| grade_fit | lowest 0.09 (place-value chart, tenths, for a G1 sum) | all >= 0.77 |

Cuts: teaches < 0.2, numbers some_outside >= 0.6, grade_fit < 0.25. With these, 26/26 agree
with the labels (after the r6#1 relabel). The teaches margin is thin (0.15 vs 0.28): re-fit
from the ledger (`node scripts/fit-gate-report.mjs`) once more labelled items exist.
