# Eval Report: era-explorer — 2026-08-23

Birth QA (L0, core mode `era_sort`). Route: `GET /api/lumina/eval-test?componentId=era-explorer&evalMode=era_sort&…` (no catalog evalModes at L0, so route-side type validation is skipped — G-rules audited by hand on `fullData`).

## Results

| Run | Topic / grade | Status | Duration | Challenges | Issues |
|-----|---------------|--------|----------|------------|--------|
| 1 | Pioneer life in America / G3 | PASS | 2.8s | 5 (era×3, today×1, both×1) | statements 3/5 near-verbatim from lens bodies (see fix) |
| 2 | long ago and today / K | PASS | 2.8s | 5 (era×2, today×1, both×2) | — (K-short statements, correct) |
| 3 | Colonial America / G5 | PASS | 3.0s | 5 (era×2, today×1, both×2) | — (era honored, inferential statements) |
| 4 | Pioneer life in America / G3 (post-fix) | PASS | 2.8s | 5 (era×2, today×1, both×2) | — |

## G1–G5 Sync Check

- **G1 required fields:** PASS all runs — title/description/eraName/eraPeriod, 3 lenses (title/body/icon), per-challenge statement/correctPlacement/explanation/lensHint, ids index-derived.
- **G2 flat-field reconstruction:** N/A — schema uses real bounded arrays, no flat fields.
- **G3 eval-mode differentiation:** N/A at birth (single mode; /add-eval-modes layer).
- **G4 answer derivability:** PASS — every statement decidable from the lens card + everyday knowledge; placement distribution covers all three bins in every run; lensHint always equals a real lens title.
- **G5 fallback audit:** PASS — content fields are rejection-gated (no `?? default`); the only `??` chains are lensHint snapping (intended normalization) and grade parsing. Curated "Pioneer Times" fallback fires only after both attempts fail, logged with console.error.

## Issue found & fixed

**Verbatim lens copying (run 1, MEDIUM):** grade-3 statements leaned on lens sentences
(e.g. "heavy wooden wagons pulled … by … oxen"), degrading the sort toward string-match lookup.
Prompt already forbade it — channel closed in code instead: `copiesLensSentence()` rejects any
statement sharing a ≥7-consecutive-word run with a lens body (anchor phrases survive; run 1's
worst legit overlap was 5 words). Run 4 re-verified PASS.

Verdict: **PASS** — birth QA closed. Watch item for `/add-eval-modes`: same-topic repeat calls
converge on similar eras (flash structured-output convergence); session-internal dedup is in
place, cross-session variety is a ladder concern.
