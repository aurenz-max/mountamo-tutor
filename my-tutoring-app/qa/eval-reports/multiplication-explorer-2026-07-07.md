# multiplication-explorer — Oracle-Fix Report (2026-07-07)

**Source:** `/oracle-test` (code-judged content contract), not `/eval-test`.
**Severity:** CRITICAL — `answer-key-desync` (correct answers marked wrong).

## The bug

`multiplication-explorer` is architected as a **single-fact explorer**: title, the
big equation, all five representations, fact-family and area-model all render from
one shared `data.fact`. But its `fluency` eval mode inherently drills **many**
facts — the generator emits challenges like `2 × 2 = 4`, `3 × 3 = 9`, `2 × 5 = 10`,
`4 × 4 = 16`, `4 × 5 = 20` while the shared fact is a single one (e.g. `4 × 5 = 20`).

`getExpectedAnswer()` graded **every** challenge against that one shared fact,
keyed only on `hiddenValue`, never reading the per-challenge `targetFact`. Result:
a student who correctly answers `4` to "Quick! What is 2 × 2?" is marked **wrong**
— only the challenge whose fact coincides with the shared fact (`4 × 5`) grades
correct. **4 of 5 fluency challenges mark correct answers wrong, deterministic.**

Oracle evidence: 20 `answer-key-desync` violations across 5 runs (0 flakiness).
Reproduced live and confirmed in source before fixing.

## The fix (COMPONENT — per-challenge fact)

`MultiplicationExplorer.tsx`:
- Added `parseTargetFact("a × b = c")` → `{factor1, factor2, product}` (product
  **recomputed** from the factors; a disagreeing RHS is ignored).
- `activeFact = useMemo(() => parseTargetFact(currentChallenge?.targetFact) ?? fact)`
  — the per-challenge fact, falling back to the shared fact for exploration modes
  (whose `targetFact` equals it) and for any unparseable string.
- `getExpectedAnswer()` and the big equation display now both read `activeFact`, so
  **what is asked and what is judged can never disagree**. Fluency becomes a real
  multi-fact drill; the single-fact modes are unchanged (correct by construction,
  since their `targetFact` equals `data.fact`).

Direction chosen over "generator pins every challenge to the shared fact" because
the latter would make single-mode fluency 5 near-identical cards — which the
oracle's own duplicate-card check would then flag. Multi-fact recall is what
fluency *is*; the component simply needed to honor the per-challenge fact.

## Oracle update (contract changed)

The oracle's core cross-check was "intended (from targetFact) vs judged (from the
shared fact)" — correct for the *old* contract, but it would now false-positive on
exactly the legitimate fluency variety. Rewrote `service/qa/oracles/multiplication-explorer.ts`
to the corrected contract: verify each `targetFact` is internally consistent
(a × b = c → `schema`, since it no longer misgrades) and in scope; keep the
missing_factor-hides-a-factor desync guard, the shared-product regression guard,
the code-owned answer-leak guard, and the duplicate-card check. Seeded tests updated
to prove the new contract (a distinct-fact fluency drill is now clean).

## Verification

| Mode | Before | After | Notes |
|------|--------|-------|-------|
| fluency | FAIL — 20 answer-key-desync / 5 runs | **PASS** — 0 violations / 25 challenges | critical bug closed |
| build | (not swept) | PASS (1 intermittent `schema` across 5 runs) | LLM-written self-contradictory `targetFact` string; no longer misgrades post-fix — cosmetic generation-quality flag |

- `npm run typecheck:lumina` — 0 errors.
- Oracle unit suite — 115/115 (multiplication-explorer 10/10, including the post-fix contract test).
- **Contract verified at runtime** via the oracle over real generations. The component
  grading path (getExpectedAnswer + display both read the same parsed `activeFact`)
  is correct by construction; a UI click-through was not performed — recommend a
  30-second browser check: answer `4` to a fluency "2 × 2" card and confirm "Correct!".

## Follow-ups (not this fix)

- `build`/etc. emit occasional self-contradictory `targetFact` strings (~1/10). Harmless
  to grading now; a generator prompt tweak ("targetFact RHS must equal a × b") would clean it.
- Pre-existing (out of scope): the big equation display shows both factors for
  `missing_factor`, which reveals the hidden factor. Unchanged by this fix (behavior
  preserved). Worth a separate look.
