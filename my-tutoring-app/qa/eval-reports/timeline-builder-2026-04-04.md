# Eval Report: timeline-builder -- 2026-04-04

## Results
| Eval Mode        | Status | Challenges | Issues |
|------------------|--------|------------|--------|
| sequence-daily   | PASS   | 4          | --     |
| sequence-yearly  | PASS   | 4          | --     |
| place-historical | PASS   | 4          | --     |

## G1-G5 Sync Check: ALL PASS

| Rule | Check                          | Result |
|------|--------------------------------|--------|
| G1   | Required fields per challenge  | PASS   |
| G2   | Flat-field reconstruction       | PASS -- all 12 challenges have 5 events each |
| G3   | Eval mode semantic differentiation | PASS -- daily=time-of-day, yearly=months/seasons, historical=decades/centuries |
| G4   | Answer derivability (0-based sequential positions) | PASS -- normalizePositions() guarantees correctness |
| G5   | Fallback quality audit          | PASS -- 4 fallback expressions, all produce valid challenges |

## Notes
- Generator uses flat Gemini schema (event0Label, event0Pos, event0Desc) with robust reconstruction in collectEvents()
- normalizePositions() re-indexes to 0-based sequential after Gemini output, preventing position gaps
- validateChallenge() rejects challenges with missing fields or fewer than 3 events
- Three hardcoded FALLBACKS (daily, yearly, historical) are correct by construction
- All 12 generated challenges had 5 events with descriptions -- no fallbacks triggered
