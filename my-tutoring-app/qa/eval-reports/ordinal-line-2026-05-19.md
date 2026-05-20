# Eval Report: ordinal-line — 2026-05-19

Post-refactor verification of the orchestrator-mixed-type → orchestrator-same-mode
fix shipped today (PRD_WITHIN_MODE_INSTANCE_DENSITY §6g). Every single-mode
eval now produces 4 distinct instances of the pinned type instead of 1.

## Results

| Eval Mode | Status | Issues | challengeCount | Pattern |
|-----------|--------|--------|----------------|---------|
| identify | PASS | — | 4 | pool-service |
| match | PASS | — | 4 | pool-service |
| relative_position | PASS | — | 4 | pool-service |
| sequence_story | PASS | — | 4 | orchestrator (N parallel Gemini calls, pre-randomized clue orderings) |
| build_sequence | PASS | — | 4 | pool-service |

## Notes

- All 5 modes returned `validation.challengeCount === 4` and `typesFound`
  contained only the pinned type — no cross-type bleed.
- Identify: 4 distinct `targetPosition` values per session (e.g., 4/3/8/6) —
  pool service guarantees distinctness via shuffleInPlace.
- Match: variance in pair count + pair subset across challenges (3, 4, 5, 4 pairs).
- Relative_position: 4 distinct (targetPosition, query) tuples; options
  always include the correct character with 3 distractors from the lineup.
- Sequence_story: 4 fully distinct character orderings, each with a Gemini-
  generated story matching its pre-randomized clue assignment. Confirms PRD
  §6a #2 mitigation works — pre-randomizing the clue ordering defeats
  structured-output Gemini convergence.
- Build_sequence: 4 distinct clue subsets of 4 characters each.
- Story mode call latency: 2.68s (4 parallel Gemini calls vs 1.77s for
  pool-service modes). Within budget per PRD §10.
