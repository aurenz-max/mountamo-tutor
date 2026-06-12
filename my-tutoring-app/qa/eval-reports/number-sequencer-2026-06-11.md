# Eval Report: number-sequencer — 2026-06-11

Investigated from user screenshot: "Count forward from 1!" with inputs 2,3,4,5,6 entered → "Not quite — try again!"

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| count_from | **PASS** (fixed 2026-06-11) | — |
| before_after | PASS (step fixed at 1) | — |
| order_cards | PASS (all values visible) | — |
| fill_missing | PASS (step derivable from shown terms) | — |
| decade_fill | PASS (instruction names decades, step 10) | — |

## Notes — Fixed Issues

### NS-2: count_from — Hidden skip-count step made the challenge unanswerable (FIXED 2026-06-11)

- **Was:** At MID/HIGH difficulty, `numberSequencerStepBand` returned step 2 or 5 for `count_from`, but the instruction template only says `Count forward from ${startNumber}!`. Nothing visible communicated the step, so counting by ones (the only reading the instruction supports) was marked wrong. Reproduced at θ=5.9: `instruction: "Count forward from 1!"`, `correctAnswers: [6, 11, 16]` — exactly the screenshot case. Rule G4 violation; tagged SP-22.
- **Fix (option 1, user decision):** Pinned `step = 1` for `count_from` in `numberSequencerStepBand` ([gemini-number-sequencer.ts](../../src/components/lumina/service/math/gemini-number-sequencer.ts)). The mode's own pedagogy doc says "sequential counting, Grades K-1" — skip counting belongs to `fill_missing` (step derivable from shown terms) and skip-counting-runner. Difficulty still scales via maxBand ([5,10] → [10,20] → [20,30]), continuation length (4 → 5 → 6), and backward counting at high levels.
- **Verification:**
  - θ=5.9: 5/5 challenges consecutive (e.g., "Count forward from 11!" → [12..16]; "Count backward from 6!" → [5,4,3,2,1]); rangeMax ≤ 28, within the HIGH [20,30] band.
  - θ=1.0: forward-only, length 4, within [5,10] — LOW band intact.
  - All 5 modes re-tested at θ=5.9: PASS, no regression (fill_missing/order_cards keep stepped sequences, steps still derivable from visible data).
  - tsc clean (1441 global errors, at baseline; none in this file).
- **Note:** the eval-test API's structural validation cannot catch instruction/data semantic mismatches — it reported `pass` while the bug was live.

## Difficulty sweep note

The 2026-06-11 rollout sweep verified band monotonicity and scope capping (both still hold — `rangeMax` stays ≤ window). It did not check instruction/answer derivability, which is how NS-2 slipped through. SP-22's fix pattern calls for a HIGH-θ derivability spot-check in future sweeps; other rollout pool-service generators still need that audit.
