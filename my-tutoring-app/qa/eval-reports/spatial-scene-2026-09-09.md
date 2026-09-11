# Eval Report: spatial-scene — 2026-09-09

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| identify | FAIL | 1 inherited HIGH (`SS-5`) |
| place_in | PASS | — |
| place | PASS | — |
| describe | PASS | — |
| place_between | PASS | — |
| follow_directions | PASS | — |
| describe_scene | PASS | — |

All seven modes generated successfully through `/api/lumina/eval-test` with only their
catalog-allowed challenge type. The new `describe_scene` draw contained four fixed-view
challenges covering left, right, in front of, and behind; all required visual fields were
present and its pre-attempt instruction did not name the answer.

## Issues

### identify — inherited hint synonym reveals the relation

- **Severity:** HIGH
- **What's broken:** The already-tracked `SS-5` remains reproducible. In the current
  three-item live draw, two hints named an answer-equivalent relation (`under` for
  `below`; `next to` for `beside`) before retry.
- **Data:** `2/3 identify hints leak an equivalent position word`
- **Fix in:** GENERATOR

This defect predates and is outside the new fixed-perspective spoken mode; that mode's
hint and judged cue passed the answer-leak checks.

