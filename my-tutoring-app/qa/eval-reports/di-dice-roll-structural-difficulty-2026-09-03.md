# Structural-Difficulty Promotion Report: di-dice-roll — 2026-09-03

## Outcome

`di-dice-roll` is promoted to **L4 shaped**. The existing `config.difficulty`
key now controls both retry support and honest within-mode problem structure.
The structural axis is generator-owned and deterministic; Gemini remains
restricted to answer-free title and description chrome.

| Eval mode | Structural lever | Easy | Medium | Hard | Floor / cap |
|---|---|---|---|---|---|
| `count_pips` | None available | unchanged | unchanged | unchanged | One standard d6; changing the face range would be numeric difficulty and adding a die would change eval mode |
| `compare_dice` | Non-tie quantity gap | 3 | 2 | 1 | Ties remain ties; all faces stay 1–6 |
| `sum_two_dice` | Right-die count-on path within a fixed total | shortest feasible | middle feasible | longest feasible | Each selected total stays exactly 2–12; faces stay 1–6 and small/extreme totals saturate honestly |

This deliberately rejects the birth note's tentative `count_pips` range idea
(`1–3` → `1–5` → `1–6`). That would make hard mean “larger number,” which is
numeric difficulty rather than a change in problem shape.

## Implementation

- `resolveProblemShape()` is the single source of truth for private tier
  descriptions and code enforcement.
- Comparison reconstruction preserves the original `left | right | same`
  relation when the exact-gap band has unused capacity. If one direction is
  exhausted, it uses an unused pair in the opposite direction before allowing
  a duplicate; all three relations remain represented and the answer is
  rebuilt from the final pair. Non-ties always hit the exact tier gap.
- Addition reconstruction preserves the original total and selects the
  shortest, middle, or longest feasible right-die addend. The challenge is
  then rebuilt, so `total`, `spokenAnswer`, and ASR aliases derive from the
  finalized dice.
- Mixed and curated-blend sessions apply shape from each challenge's own mode.
- A missing or unknown difficulty bypasses every structural branch and retains
  the pre-L4 payload contract.
- The wrapper prompt receives only private, answer-free structural intent. It
  never receives or chooses a die value, relation, total, or answer.

## Verification

| Gate | Result |
|---|---|
| Focused Vitest | **32/32 passed** across the generator and exact judged-script contract |
| Offline builder stress | **7,200 tiered challenges passed** across 200 seeded runs per structural mode × three tiers |
| Live `/api/lumina/eval-test` sweep | **9/9 passed** across three eval modes × easy/medium/hard |
| Lumina typecheck baseline | **0 errors before the edit** |
| Post-edit TypeScript scope check | **0 Dice Roll diagnostics**; a later Lumina run reported two unrelated diagnostics in `CauseEffectChain.di-script.test.ts` |
| Repository-wide TypeScript | Existing red baseline remains; **0 diagnostics** mention Dice Roll files |

The live comparison draws produced exact gap sequences `3/3/0/3/3`,
`2/2/0/2/2`, and `1/1/0/1/1` for easy, medium, and hard. Every relation still
matched its finalized pair, and every five-item live run retained five unique
final pairs.

The live addition draws hit the expected right-die rank for every generated
total. Saturation was visible and valid: total 12 remains `6 + 6` at every
tier because the d6 band contains no alternative decomposition. All other
sampled totals used the exact shortest, middle, or longest feasible path.

## Generator ↔ component gates

| Gate | Verdict | Evidence |
|---|---|---|
| G1 required fields | PASS | Every challenge retains the discriminant and all component-consumed values; tier reshaping removes no fields |
| G2 flat reconstruction | N/A | The generator directly returns nested `challenges[]` |
| G3 mode/tier differentiation | PASS | Eval modes remain distinct; comparison gap and addition count-on depth change inside their own modes |
| G4 answer derivability | PASS | Comparison, total, spoken answer, and aliases are derived after pair finalization |
| G5 fallback/no-tier integrity | PASS | Unknown/absent tiers bypass shaping; malformed controls still fall back as a unit |

## Remaining human gate

No microphone/Tutor sitting was performed. A human should still hear one
incorrect attempt at every tier, confirm the existing support fade, and judge
whether adjacent comparisons and longer right-die count-on paths feel
meaningfully harder without harming touch ergonomics.

## Next lifecycle step

`/add-sound` is L5. Candidate procedural cues remain die press, roll/rattle,
settle, affirmation, retry, and completion, with the microphone/listening
interval kept silent.
