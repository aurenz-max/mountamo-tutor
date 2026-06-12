# Difficulty Sweep: ten-frame + counting-board keystone — 2026-06-11

First verification of IRT within-mode difficulty (step 3b keystone). Contract:
mode = WHAT (pinned by pedagogy), difficulty = HOW HARD within the mode's beta
band, computed code-side from `config.studentTheta` (2PL inverted at P*=0.70
using the mode's catalog discrimination), scope-capped, with a code-side
post-generation cap.

## Sweep results (live generators via /api/lumina/eval-test?theta=)

### counting-board · `count` (β1.0, a=1.8, band 0.25–1.75)

| θ | level | expected band | generated counts | arrangements | verdict |
|---|-------|---------------|------------------|--------------|---------|
| 0.5 | 0.00 (sat. low) | 3–6, line | 3,4,4,5,5,6,6 | line/circle | PASS |
| 1.5 | 0.52 | 6–12 | 7,8,9,10,10,11,12 | line/circle | PASS |
| 5.9 | 1.00 (sat. high) | 12–20, scattered | 12,13,14,15,16,18,20 | scattered | PASS |

### ten-frame · `build` (β1.5, a=1.8, band 0.75–2.25)

| θ | level | expected band | generated targetCounts | verdict |
|---|-------|---------------|------------------------|---------|
| 1.0 | 0.00 | 1–4 | 1,2,2,3,3,4,4 | PASS |
| 2.2 | 0.65 | 4–7 | 4,5,5,6,6,7,7 | PASS |
| 6.0 | 1.00 (sat. high) | 7–10 | 7,7,8,8,9,9,10 | PASS |

### Scope-vs-difficulty conflict (the test that mattered)

Topic "Counting to 5" + θ=6.0 (band says 7–10):

- **Prompt-only enforcement FAILED**: first run generated counts 1–7 — the LLM
  split the difference between "scope wins" prose and the difficulty band.
- **Fix (final architecture, after design review)**: ceiling discovery is a
  single-purpose orchestrated LLM call (`resolveScopeCeiling` in
  `service/difficulty/scopeCeiling.ts` — two-field schema, cached per
  objective; regex `extractScopeCeiling` demoted to failure fallback only).
  Enforcement is layered: `capBand` collapses the band to [5,5] BEFORE the
  prompt is built (no conflicting instruction ever emitted) → schema
  `minimum`/`maximum` stamped on the count field via `constrainNumericRange`
  (out-of-band values unrepresentable; pinned-mode only, since mixed modes
  have non-uniform field semantics) → post-generation cap as the flash-lite
  backstop (per /eval-fix hierarchy).
- **Re-run: PASS** — all targetCounts exactly 5 (the hardest parameterization
  the scope allows). High-band regression (topic "to 10") unaffected: 7–10.
- **Word-number test (regex-impossible case): PASS** — topic "Counting to
  five" (word, not digit) + θ=6.0 → all targetCounts exactly 5. The LLM
  extractor reads language; the regex provably could not.

## FINAL ARCHITECTURE — pool-service refactor (same day, after design review)

The prompt-defense layers above were superseded: both keystone generators were
refactored to the **pool-service pattern** (place-value/array-grid/factor-tree
precedent). Gemini emits ONLY wrapper metadata + a `windowMax` schema field
(reading the scope language); local code builds every challenge from
`modeRange ∩ scopeWindow ∩ difficultyBand(withinModeLevel)`. The LLM never
touches a number, so scope/difficulty violations are impossible by
construction — `scopeCeiling.ts` (dedicated extraction call), the schema
min/max constraint usage, and the post-caps were all deleted, replaced by one
range intersection.

Full acceptance suite re-run against the pool generators (all PASS):
- counting-board count θ 0.5/1.5/5.9 → 3-6 / 6-12 / 12-20 (full band coverage,
  gentle progression — better distributions than the LLM produced)
- ten-frame build θ 1.0/2.2/6.0 → 1-4 / 4-7 / 7-10
- scope-conflict "Counting to 5" + θ 6.0 → all exactly 5
- word-number "Counting to five" + θ 6.0 → all exactly 5 (wrapper window
  extraction reads language; the deleted regex provably could not)

## Verdict

Both keystone generators honor calibrated, monotonic, scope-safe difficulty.
The load-bearing lesson: **numeric constraints must be resolved in code before
the prompt** — "scope wins" as prose is advisory, `capBand` + post-cap is a
guarantee. This is now baked into the DifficultyParamSpec contract
(`service/difficulty/difficultyContext.ts`) and the /add-eval-modes checklist.

Rollout backlog: the other ~50 eval-mode primitives get specs via the
/add-eval-modes contract; /eval-test Step 2b is the per-primitive acceptance gate.
