# DI item 10 — counting_next to 120, built (user-ruled build-ahead) + DI-120-1 fix

**Date:** 2026-08-06 · **Commit:** `3986f77` · **Ruling:** user, same day —
*"i feel like we can move forward directly now with DI primitives to 120"* —
supersedes item 10's "do NOT start before the sitting" clause. **#63's re-run
is now the ACCEPTANCE drive for the shipped config, not a build gate.**

## What shipped (the item's own post-sitting spec, executed)

- **`numberWordFor` (0..120)** — code-owned numeral builder, bench-canonical
  forms ("fifty-one", "one hundred seven", no "and"); hard-throws outside the
  ceiling so an over-range pool bug can never speak `undefined` into a cue.
  Replaces every `NUMBER_WORDS[n]` lookup (`answerWord`, `problem`,
  `aliasesFor`). Aliases mirror the probe set (space variant, digits,
  "fourty", "a hundred …", "one hundred and …") and NEVER cross-alias a teen
  with its decade — the alias check stays the disagreement meter for exactly
  that confusion.
- **Ceiling raise, counting-scoped** — `resolveTextScope` clamp 20 → 120 keeps
  the RAW ask; new `benchedCeilingFor(type)` intersects per identity (counting
  120, every fact identity 20). A "within 120" ask can no longer build
  "119 − 3" or >20 sums by construction.
- **Windowed counting pool** — above twenty: every decade transition in range
  (29→30 … 119→120) + the ~24-start window under the ceiling + teen anchors
  (12..17). Never rote-from-zero; starts <12 stay with within-20 asks.
- **Judging contract, counting-scoped additions** (answers ≥13 only — every
  fact mode and within-twelve counting stays byte-identical to the #46-proven
  text): teen/decade strictness + compound completeness, ported from the bench
  criteria the sitting drives.
- **Catalog** — NUMBER WORDS directive gains the multi-word clause;
  description/constraints name the 120 counting range.
- **Close timing** — pack-scoped `silenceCloseMs` 1000 when a session carries
  compound answers (standalone path; #63(b) confirms the number). Lesson-mode
  policy unchanged (420ms) — content-aware lesson policy queued, not built.
- **L4 shape guard** — the operand-boundary axis is defined on the ≤20 fact
  space; above it the windowed pool owns structure (a transition-count rung is
  /add-structural-difficulty territory). Support-tier DISTAR withdrawal still
  stamps per-challenge.

## DI-120-1 (item 12) — fixed in the same slice

`MIN_BARGE_BAR 0.03` floor in `voiceTurnCalibration` (calibrated + fallback
paths): the 08-06 sitting's 0.018 leakage class cannot open turns; real
barge-in speech (≥0.045 every sitting) keeps 33%+ headroom; the AMBIENT bar is
untouched. Unit pins replay the device numbers. **Design question settled
AGAINST cap-skipping:** a no-transcript correction still counts — transcript
absence is not evidence of silence (DI-1), and a transcript rule would have
contradicted the pinned Tier-A evidence behavior. The channel is closed where
the turn opens.

## Gates

| Gate | Result |
|---|---|
| Focused suites (scope/structural/remediation/support-tiers/calibration/bench/misconception/lesson-arm) | 96/96 |
| Full Vitest | **1778/1778** |
| typecheck:lumina / whole-tree tsc | 0 / 805 (803 baseline + 2 pre-existing legacy, 0 in lumina) |
| Real-pipeline probes (dev :3000, real Gemini) | **5/5** below |

| # | Probe | Result |
|---|---|---|
| A | census 120 objective, `counting_next`, G1 | `105 → one hundred six`, `117 → one hundred eighteen`, teen anchors 13/16 present; max answer 118; zero `undefined` |
| B | same + `difficulty=hard` | all stamped `supportTier: hard`; decade transitions drilled (`59 → sixty`, `79 → eighty`); max answer 119 |
| C | CONTROL `answer_fact` "within 10" | unchanged — sums ≤ 9 |
| D | CONTROL K "count forward within 5" | unchanged — starts 0–4 |
| E | census objective, `subtraction_fact` | minuends ≤ 19, single-word answers only |

## Honest residuals

1. **The judge's live discrimination on multi-word numerals is UNPROVEN** —
   exactly #63's three criteria (deliberate teen/decade break, compound
   completeness incl. a mid-numeral pause, cue drag). If (a) fails live, the
   rollback is one constant (`benchedCeilingFor('counting_next')` → 20).
2. Lesson-mode close timing is still the flat per-primitive 420ms.
3. The 07-19 echo-blip class at 0.033 sits above the new 0.03 floor; the
   escalation path if it recurs is threshold-above-residual → AEC, never a
   cap rule.

Registers updated in this slice: `qa/di/BACKLOG.md` (items 10, 12, new 14),
`qa/HUMAN-CHECKS.md` (#63 note + #72), `WORKSTREAMS.md`.
