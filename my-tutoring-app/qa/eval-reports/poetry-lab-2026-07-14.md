# Eval Report: poetry-lab — 2026-07-14

## Results

| Eval Mode | Eval-test | ContentOracle (3 live runs) | Issues |
|---|---|---|---|
| `rhyme_hunt` (K) | PASS ×3 | PASS — 0 violations, 0/3 flakiness | — |
| `analysis` (Grade 3) | Existing dispatcher path | PASS — 0 violations, 0/3 flakiness | — |
| `composition` (Grade 4) | Existing dispatcher path | PASS — 0 violations, 0/3 flakiness | — |

## Contract checks

- G1: every rhyme round has four poem lines, four derived ending-word candidates,
  actual emoji pictures, and two answer words that belong to the ending set.
- G2: N/A — the rhyme schema uses bounded arrays, not nullable flat fields.
- G3: root `mode` is `rhyme_hunt`; dedicated schema/prompt/post-validation keep
  it distinct from analysis and composition.
- G4: the component judges the unordered pair of answer TEXT fields against the
  visible candidate words; no positional answer pointer exists.
- G5: invalid rounds are rejected and logged, never repaired with fabricated
  content. A full generation retries once when fewer than three rounds survive.

## Additional gates

- `typecheck:lumina`: 0 errors.
- Behavioral jsdom: tap-two immediate judge, wrong-pair reset, auto-advance,
  and first-try session scoring pass.
- Seeded oracle suite: 209 tests pass; deliberate schema and answer-key mutations
  are detected.
- Full Vitest suite: 49 files, 766 tests pass.
- Tutor-test Tier 1 + probe: PASS, zero findings; all 11 context keys resolve and
  `[ACTIVITY_START]`, `[ROUND_START]`, `[RHYME_MISS]`, `[RHYME_CORRECT]`, and
  `[ACTIVITY_COMPLETE]` are silent tagged sends.
- Tier-3 K lesson journey: PASS 2/2 after correcting a harness Markdown
  normalization false positive. See
  [live transcript](../tutor-reports/poetry-lab-live-lesson-2026-07-14.md).
