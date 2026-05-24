# Eval Report: pattern-builder — 2026-05-23

> Audit-only run to close PRD_WITHIN_MODE_INSTANCE_DENSITY §6a gaps for a
> Bucket B primitive. `pattern-builder` already passed Workstream 1 (prompt
> floor 4-6) per §3a (extend mode → 4) on 2026-05-19. This run re-verifies all
> five single-mode tiers and closes three §6a checklist gaps the original
> Bucket B sweep did not address.

## Results

| Eval Mode      | challengeCount | Status |
|----------------|----------------|--------|
| extend         | 4              | PASS   |
| identify_core  | 4              | PASS   |
| translate      | 4              | PASS   |
| create         | 4              | PASS   |
| find_rule      | 5              | PASS   |

Per-challenge variance is strong in single-mode: each challenge ships its own
`sequence.given` / `sequence.hidden` / `sequence.core` plus per-challenge
`availableTokens` (correct answers + 3–5 distractors). Spot-check on `extend`:
[2,4]-repeat → [5,5,10]-repeat → +3 growing → [1,2,3,1]-longer-core. Difficulty
ratchets across the four challenges as the prompt instructs.

## §6a Compliance Gaps Closed

### PB-1 — Catalog `contextKeys` + `taskDescription` missed multi-instance keys (RESOLVED)
- **Gap (§6a #5):** `aiPrimitiveData` already included `currentChallengeIndex`
  and `totalChallenges`, but `tutoring.contextKeys` and `taskDescription` in
  the catalog did not surface them — so the tutor template could not interpolate
  session position.
- **Fix:** `service/manifest/catalog/math.ts` — added both keys to `contextKeys`
  and prefixed `taskDescription` with the
  `"{{totalChallenges}} pattern challenges (currently {{currentChallengeIndex}})"`
  template.

### PB-2 — `PatternBuilderMetrics` not re-exported from `evaluation/index.ts` (RESOLVED)
- **Gap (§6a #9 step 2):** the component was importing the metrics type from
  the internal `evaluation/types` path; all other Bucket A primitives import
  from the public `evaluation` barrel.
- **Fix:** added `PatternBuilderMetrics` to the math-phase-2 metrics block in
  `evaluation/index.ts` and switched `PatternBuilder.tsx` to import via the
  barrel.

### PB-3 — Tester results panel had no pattern-builder breakdown (RESOLVED)
- **Gap (§6a #10 step 5):** `MathPrimitivesTester.tsx` had per-primitive
  metrics breakdown blocks for factor-tree / bar-model / tape-diagram /
  area-model / function-machine / array-grid / function-sketch /
  balance-scale / measurement-tools / histogram / matrix-display /
  slope-triangle / fraction-bar / place-value-chart — but not pattern-builder.
- **Fix:** added a metrics block keyed on `result.metrics.type === 'pattern-builder'`
  rendering the existing domain-specific fields (`extensionsCorrect/Total`,
  `coreIdentifiedCorrectly`, `ruleArticulated`, `patternCreated`,
  `translationCorrect`, `attemptsCount`).

## Out of Scope for This Run

- **Canonical-aggregate metrics migration (§6a #11).** The current
  `PatternBuilderMetrics` shape uses domain-specific booleans (one per phase)
  rather than the canonical `correctCount / totalChallenges / firstTryCount /
  averageAttemptsPerChallenge` shape used by all recent Bucket A ships. In
  single-mode usage (the IRT default) most booleans degenerate to
  `correctCount > 0`. Migrating is recommended but non-blocking — left as a
  follow-up because the existing shape works and changing it would touch
  backend evaluation consumers.
- **`patternTypesExplored` field.** Initialized to a one-element Set with no
  setter exposed; always reports `1`. Drop when the metrics shape is
  canonicalized.

## G1-G5 Sync Verification

| Rule | Result |
|------|--------|
| G1 — required fields present | PASS — every challenge has id, type, instruction, answer, hint, narration, availableTokens, sequence |
| G2 — flat-field reconstruction | N/A — schema is already a `challenges[]` array |
| G3 — eval mode differentiation | PASS — five tiers (extend β1.5 → find_rule β5.5), each pinned to its own challengeType |
| G4 — answer derivability | PASS — for extend/find_rule, `challenge.answer === challenge.sequence.hidden` (enforced by generator post-processing) |
| G5 — fallback quality | PASS — fallback path only fires on empty `data.challenges`; not observed in any of 5 runs |
