# Eval Report: addition-fact-strategies — 2026-10-02

## Results (eval-test, `evalMode=recall`, grade 1, 7 runs)
| Topic | Strategy routed | Facts | Status |
|-------|-----------------|-------|--------|
| Doubles facts (×2) | doubles | 8, all n+n, intro 1+1 / 4+4 not asked | PASS |
| Turn-around facts | turnaround | 8, knownFact = flip on each, intro 2+7 not asked | PASS |
| Adding zero | plus_zero | 8, both orders (0+1, 0+9), intro 0+5 not asked | PASS |
| Addition within 20 | facts_mixed | 10, all three bands | PASS |
| Adding 2 by counting on | plus_two | 8, both orders | PASS |
| Facts with 7 and 8 | facts_7_8 | 6 (pool size), no adjacent repeat pair | PASS |

## G1-G5 Sync Check: ALL PASS
- G1 required fields: a, b, sum, id, type present on every challenge; knownFact on every turnaround challenge.
- G2 N/A — no flat-field reconstruction (Fork A: facts built in code).
- G3 N/A at birth.
- G4 sum === a + b on every challenge (computed in code).
- G5 fallbacks: only objectEmoji and leak-guarded title/description; facts never depend on Gemini.

## Runtime (headless Chromium, Math Primitives Tester, 1400 and 390 px)
Intro card → Let's play → miss 1 shows countable objects → miss 2 counts them aloud → correct fills the slot → missed fact returns as "Comeback!" after two more facts → summary (7/8 first try, 91%) → evaluation submitted. One Pip dock, no page errors, no horizontal overflow.

## Unit tests
- `gemini-addition-fact-strategies.test.ts` 12/12 (9 strategies × 50 seeded runs + mocked-Gemini wrapper paths)
- `AdditionFactStrategies.test.tsx` 4/4 (no answer before answering, turn-around help order, comeback + single submit, last-fact comeback)
- `pip/AdditionFactStrategies.surface.test.tsx` 2/2, `pip/MathPrimitivesTester.surface.test.tsx` green
