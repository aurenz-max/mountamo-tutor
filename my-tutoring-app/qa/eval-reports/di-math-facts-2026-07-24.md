# Eval Report: di-math-facts — 2026-07-24

**Primitive:** `di-math-facts` (L0 birth, single mode `answer_fact`)
**Component:** `src/components/lumina/primitives/visual-primitives/direct-instruction/DiMathFacts.tsx`
**Generator:** `src/components/lumina/service/direct-instruction/gemini-di-math-facts.ts` (Fork A — pool service; Gemini emits wrapper + factScope hint only, all per-challenge fields code-derived)
**Harness:** `GET /api/lumina/eval-test?componentId=di-math-facts&evalMode=answer_fact` against the running dev server (localhost:3000)
**Verdict: PASS — 6/6 runs clean, no fixes required.**

## Results table

| # | Topic (grade) | Scope expected → observed | n | G1 | G2 | G3 | G4 | G5 |
|---|---|---|---|---|---|---|---|---|
| 1 | `addition facts within 5` (K) | within 5 → all sums ≤ 5 ✓ | 5 | PASS | N/A | N/A | PASS | PASS (5 distinct answers) |
| 2 | `addition` generic (K) | grade default within 5 → all sums ≤ 5 ✓ | 5 | PASS | N/A | N/A | PASS | PASS (4 distinct answers) |
| 3 | `make ten facts` (K) | every a+b === 10 → all 10 ✓ | 5 | PASS | N/A | N/A | PASS | PASS (1 answer — sanctioned make-10 exception; 5 distinct pairs) |
| 4 | `doubles facts` (K) | a === b everywhere → 5/5 doubles ✓ | 5 | PASS | N/A | N/A | PASS | PASS (5 distinct answers) |
| 5 | `practice 2 + 1 and 3 + 2` (K) | named facts present → both shipped as items 1–2 ✓ | 5 | PASS | N/A | N/A | PASS | PASS (5 distinct answers) |
| 6 | `addition facts within 10` (1st grade) | sums ≤ 10 w/ spread → max 10, 5 distinct ✓ | 5 | PASS | N/A | N/A | PASS | PASS (5 distinct answers) |

G2 (flat-field reconstruction) N/A — Fork A pool service, no flat fields. G3 (mode mixing) N/A at birth — single mode.

All checks were run programmatically over the raw JSON (recomputed a+b per challenge; verified `answerNumeral === a+b`, `answerWord === NUMBER_WORDS[a+b]`, `display === "${a} + ${b}"` with no extra sum token, `problem` word form, `asrAliases` ⊇ {answerWord, digit string}, id pattern `dimf-N-ApB`, session `challengeType: 'answer_fact'`, count in 3–6, title/description digit + number-word (zero–twenty) leak scan, canonical-key dedupe, zero-operand cap ≤ 1).

## Raw challenges per run

| Run | Title / description (leak-scanned clean) | Facts |
|---|---|---|
| 1 within-5 | "Math Magic Time!" / "Get ready to speak your fun addition math facts out loud!" | 0+1=1, 3+1=4, 1+2=3, 4+1=5, 1+1=2 |
| 2 generic K | "Math Magic Time" / "Get ready to say your fun math facts out loud!" | 4+1=5, 0+4=4, 1+2=3, 1+1=2, 2+2=4 |
| 3 make-10 | "Super Partner Practice" / "Get ready to say your special partner equations out loud!" | 4+6=10, 7+3=10, 10+0=10, 5+5=10, 2+8=10 |
| 4 doubles | "Twin Time" / "Get ready to say math facts out loud as matching buddies team up." | 2+2=4, 1+1=2, 5+5=10, 3+3=6, 4+4=8 |
| 5 named | "Super Addition Practice" / "Get ready to say your fun math facts out loud!" | 2+1=3, 3+2=5, 1+3=4, 0+1=1, 1+1=2 |
| 6 within-10 G1 | "Math Fun Time!" / "Get ready to say your addition facts out loud!" | 1+1=2, 1+8=9, 9+1=10, 6+1=7, 3+1=4 |

## G5 fallback audit (generator source)

Every `??`/`||`/default in `gemini-di-math-facts.ts` inspected:

- `HOMOPHONES[word] ?? []` — benign; aliases always carry answerWord + digit string regardless.
- `config?.challengeCount ?? 5`, clamped `min(6, max(3, …))` — session always 3–6.
- `resolution?.allowedTypes?.[0] ?? 'answer_fact'` — safe; one identity at birth.
- `title/description` defaults (`'Math Facts'` / `'Let's say our math facts out loud!'`) — fire on Gemini failure OR leak-guard trip; both defaults are themselves digit/number-word free. Correct-firing.
- `scope = textScope ?? modelScope ?? gradeDefaultScope(gradeLevel)` — on the Gemini-failure path `textScope` is still computed from topic/intent/objective by code-owned regexes, so scoped topics (within-N / make-ten / doubles / named) survive an LLM outage; only fully generic topics fall to the grade default (K → within 5, else within 10). Valid scoped session on every path.
- `EASY_SPREAD` final fallback — effectively unreachable (every `buildPool` branch returns a non-empty static pool and selectVaried pass 2 back-fills); if ever reached, yields a valid within-5 spread. No wrong-firing risk.
- Variance verified empirically: no duplicate canonical `min+max` keys in any run; zero-operand facts capped at 1/session in every run; ≥ 4 distinct answers on within-N scopes (make-10's single answer is the documented exception).

## Observations (no action taken)

- Zero-operand facts print their own sum as an operand (`10 + 0` in the make-10 run, `0 + 1` in within-5). Passes the contract as written (the sum is an operand, not an extra token), +0 identity facts are legitimate DISTAR curriculum, and the generator already caps them at one per session. Noting for the /add-eval-modes pass in case a stricter no-identity-facts rule is wanted for make-10.
- The bare `to N` alternative in the within-scope regex (`/(?:within|up to|sums? to|to)\s+(\d{1,2})/i`) could over-trigger on unrelated objective phrasing (e.g. "count to 20 and add"); result is clamped to [5, 20] so never invalid. Watch in a future /topic-fidelity sweep.
- The model `factScope` hint can win over the grade default for generic topics (by design); the prompt pins generic-K to `within_5` and run 2 landed within 5 at runtime.

## Fixes

None — no rule failed; generator untouched.
