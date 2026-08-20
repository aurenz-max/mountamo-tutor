# Eval Report: cell-builder — 2026-08-18

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| `cell_inventory` | PASS* | — |
| `organelle_placement` | PASS* | — |
| `structure_function` | PASS* | — |
| `cell_specialization` | PASS* | — |
| Auto / mixed | PASS* | — |

`PASS*` means generator schema pinning and runtime component contracts passed focused tests (10/10). A real Gemini draw through `/api/lumina/eval-test` could not start because the shared registry currently imports a missing, unrelated `service/literacy/gemini-word-flip` module. No cell-builder CRITICAL/HIGH failure was observed.

## Contract checks

- Each catalog `challengeTypes` value has an explicit component render path.
- Pinned schemas constrain root `challengeType` to exactly one mode; Auto preserves all four.
- Placement grades one discrete region per organelle; the former overlapping-boundary mechanism is gone.
- Correct placement/quantity reasoning is absent before commit and revealed only afterward.
- First committed answers are locked and submitted; corrective feedback cannot rescore the attempt.
- Catalog and backend beta priors match: 2.5 / 3.5 / 5.0 / 6.5.

## External gate

Re-run the five eval-test API draws after the missing `gemini-word-flip` baseline import is restored, then visually inspect the Biology Primitives Tester at desktop and narrow widths.
