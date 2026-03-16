# Eval Report: paragraph-architect — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| informational | PASS | — |
| narrative | FAIL | 1 (CRITICAL) |
| opinion | FAIL | 1 (CRITICAL) |

## Issues

### narrative, opinion — paragraphType always returns "informational"
- **Severity:** CRITICAL
- **What's broken:** Both narrative and opinion modes return `paragraphType: "informational"` instead of matching the eval mode. Student sees "Informational" label when they should see "Narrative" or "Opinion". IRT calibration data is corrupted since all modes record the same type.
- **Data:** narrative mode: `paragraphType: "informational"`, opinion mode: `paragraphType: "informational"`
- **Fix in:** GENERATOR — challengeTypes/paragraphType constraint not forwarded to LLM prompt
