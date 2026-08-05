# Reader-fit 14j: annotated-example scope/grade binding — 2026-08-04

## Outcome

**CLOSED.** A manifest intent that pins a concrete worked example now keeps its
quantities, entities, units, scenario, and operation family through authoring,
the byte-pinned solver, step generation, challenge hydration, and the final
serialized payload. Generic representative authoring and upper-grade math remain
available through a constraint-presence fork.

## Before evidence

Input held constant across the coin probes:

- Topic: `Count collections of identical coins to determine the total value`
- Canonical grade: `1`
- Intent: `Use this exact worked example: six nickels. Skip-count by 5 cents to 30 cents.`

Three pre-edit real-Gemini draws demonstrated two independent failure channels:

| Draw | Authored problem | Solver/final operation | Verdict |
|---|---|---|---|
| 1 | kept 6 nickels but did not state the pinned 30-cent target | `6 × 5`; final algebra transition said “multiply” | FAIL |
| 2 | kept 6 nickels and requested skip-counting | skip-counted, then verified with `6 × 5 = 30` | FAIL |
| 3 | replaced the exact statement with a generated data-table task; nickels/30 cents were absent from `problemStatement` | addition plus `6 × 5` in the solver body | FAIL |

The supposedly healthy `108, 109, ?, 111` control also failed its pre-edit replay:
the author changed it to a 105–109 number-line problem and the solver answered 108.
This established that one lucky census draw was not evidence of reliable binding.

## Root cause

The handoff premise was confirmed and refined:

1. Registry intent reached `generateAnnotatedExample`, but canonical `ctx.grade`
   was dropped.
2. Intent reached the problem author only as generic `context`, with no binding
   contract or post-authoring validator.
3. The accepted statement was correctly passed as `pinnedProblem`.
4. A fresh probe proved a second independent drift: hydration received no binding
   operation guidance, so the pinned solver and renderers introduced multiplication.

Classification: **FIDELITY BUG**, not wrong primitive. Fix category:
contract wiring + post-process validation + bounded repair + deterministic fallback.

## Implementation

- Added `authoring-contract.ts`: extracts concrete numeric/entity/unit anchors,
  detects constraint presence, reads canonical grade only, and validates exact
  scope plus operation identity.
- `runAnnotatedExampleOrchestrator` now accepts a structured authoring contract.
  A rejected plan gets one repair attempt with structured violation codes; a
  second rejection falls back to the exact manifest intent. Legacy `context`
  remains for `practice-problem`.
- Canonical `ctx.grade` now reaches annotated-example. Grade-1 skip-counting or
  repeated-addition objectives reject generator-introduced multiplication/array
  tasks; explicit multiplication objectives remain legal.
- The solver PROBLEM echo is byte-checked. One bounded pinned-solver repair is
  allowed after a contract rejection.
- The accepted operation guidance reaches every step generator and challenger.
  Contract-invalid optional challenges are dropped rather than dropping the
  session.
- For a strict bounded repeated-addition intent whose quantity × increment equals
  its target, code can derive a denomination-agnostic running-total table as the
  final safe fallback. There is no nickel-specific production branch or hard-coded
  sentence.
- Added `solverDebug.problemEcho` so the final payload and oracle can prove the
  pin is byte-faithful.
- Added and registered the annotated-example final-payload oracle. It checks the
  rendered statement, solver echo/body, student-visible step content, and challenge
  layer independently of the authoring prompt.

## Contract check

Contract: `src/components/lumina/docs/contracts/annotated-example.md`.

**COMPATIBLE WITH CONSTRAINT-PRESENCE FORK.** Strict binding activates only when
intent contains a concrete scenario/exact example. Generic authoring, advanced
inset selection, algebra/calculus, and the `practice-problem` sibling remain on
their existing paths. See `qa/primitive-contracts/annotated-example-check-2026-08-04.md`.

## Verification

### Focused deterministic tests

- `orchestrator.reader-fit-14j.test.ts` + oracle seeded suite: **227/227 PASS**.
- Covers exact six/nickels/30 survival; recorded 4×5 dime/200 rejection;
  repair and safe fallback; generic Grade-1 variation; exact 108–111 control;
  explicit multiplication; upper-grade calculus; practice-problem legacy behavior;
  final-step multiplication detection; deterministic fallback derivation.
- Non-vacuity: the recorded 4×5 dime/200 fixture produces both `scope` and
  `operation-family` oracle violations.

### Real runtime

- Exact coin eval-test: PASS. Statement retained 6 nickels, 5-cent increments,
  and 30 cents. Solver echo was byte-identical. Student-visible work used
  skip-counting/addition; final table reached 30 cents.
- Exact 108–111 control: PASS. Statement retained `108, 109, ?, 111`; solver
  echo was byte-identical; final answer recomputed as 110 using +1.
- Advanced control: PASS. Area between `y=x²` and `y=x` retained graph/algebra/
  calculus operations; final answer recomputed as `1/6`; byte-faithful echo.
- Final oracle, exact coin case: initial post-fix 3-run battery exposed one solver
  residual and later one renderer residual, which drove the bounded/deterministic
  closure. Final battery: **3/3 PASS**, `generationFailures=[]`, `flakinessRate=0/3`,
  `totalViolations=0`, `uncheckedTypes=[]`.

### Repository gates

- Full Vitest: **133 files, 1,542/1,542 PASS**.
- `npm run typecheck:lumina`: 14j adds **0 errors**, but the repository gate is
  not globally green because of two pre-existing/concurrent unrelated errors in
  `service/literacy/gemini-story-map.ts` (`supportTier`, `distractorCharacters`).
  Those files were not changed in this slice.
- No component/UI files changed; no browser/pixel human-check row required.

## Residuals

- April issues AE-1–AE-4 (redundant step planning / weak advanced verification)
  are unchanged and remain owned by SP-16. They were explicit non-goals.
- Live 3/3 is the stochastic gate reached in this slice. The deterministic
  fallback makes the strict repeated-addition case safe if a future LLM draw
  violates the same contract again.
