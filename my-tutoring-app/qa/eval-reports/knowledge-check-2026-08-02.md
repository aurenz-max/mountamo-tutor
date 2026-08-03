# Eval Report: knowledge-check — 2026-08-02

## Results

| Eval Mode | Band / topic | Status | Issues |
|---|---|---|---|
| analyze | Grade 1 invention/change | PASS | — |
| mixed | Grade 1 map symbols | PASS | — |
| recall | K map symbols regression | PASS | — |

The `mixed` response has no single catalog mode row, so the endpoint skipped its catalog-type
validation; the payload was inspected directly and passed the generator↔component contract. It
contained a required, non-empty `object-collection`. `analyze` contained a required, non-empty
`comparison-panel`. The K control contained three emoji options and no Grade-1 visual panel.

No CRITICAL or HIGH findings. Visual/pixel confirmation is queued in HUMAN-CHECKS #59.
