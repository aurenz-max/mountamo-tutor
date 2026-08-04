# di-math-facts — L4 structural difficulty (2026-08-04)

**Layer: L3 → L4.** The tier now drives both the DISTAR fade and the
birth-certificate operand structure. No component, script, catalog copy, or
spoken line changed.

## Gradient

| Tier | Preferred structure | Pool guardrail |
|---|---|---|
| easy | within five | objective/eval-mode ceiling still wins |
| medium | cross five, within ten | explicit named/make-ten identity wins |
| hard | cross ten, within twenty | a within-ten pool honestly saturates at cross-five |

Addition crosses upward from the displayed first addend; subtraction crosses
downward; `counting_next` guarantees the one boundary successor then fills the
same legal upper band. `fact_review` retains its grade-wide taught-set cap, so
the current K/G1 within-ten catalog saturates hard at crossing five. The
generator never widens `factScope` merely because the tier is hard.

`resolveProblemShape(type, tier, poolCeiling)` is the single source for the
prompt description and code selection. `selectVariedForShape` runs the exact
shape’s two variance passes before same-tier and objective-identity fallbacks;
this prevents distinct-answer variance from pulling an out-of-tier fact ahead
of a valid repeated-answer fact. All answer-bearing fields are rebuilt from the
final operands.

## Verification

- Focused structural suite: **17/17**.
- Non-vacuity: bypassing structural selection fails **10/17**; restored suite
  passes.
- Live `/eval-test`: **10/10 PASS** — full easy/medium/hard addition ladder,
  within-ten hard saturation, medium/hard subtraction, hard counting, hard
  review, hard mixed, and no-tier control. Every displayed equation recomputed.
- `typecheck:lumina`: touched DI surface **0 errors**. Global gate is currently
  blocked by two concurrent unrelated math grade-band test errors.
- Project `tsc`: **805 current vs 803 pre-slice baseline**, with **0** errors in
  touched files; both additions are those concurrent grade-band tests.
- Full Vitest suite: **122 files / 1,385 tests PASS**.
- Final hard-within-twenty live probe: all operands remain single-digit or ten,
  while every selected equation crosses ten.

No new ear-check row: selection changed, spoken templates did not. The existing
hard cold-fact check now naturally exercises the hardest legal operand shape.
