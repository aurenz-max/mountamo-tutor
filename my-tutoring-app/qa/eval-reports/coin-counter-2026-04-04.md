# Eval Report: coin-counter — 2026-04-04

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| identify | PASS | — |
| count-like | PASS | — |
| count-mixed | PASS | — |
| make-amount | PASS | — |
| compare | PASS | — |
| make-change | PASS | — |
| fewest-coins | PASS | — |

## Architecture: Orchestrator Refactor (2026-04-04)

The generator was refactored from a single monolithic prompt (40+ nullable flat fields for 5 challenge types) to a **per-type orchestrator** pattern. This eliminates the root cause of SP-14 (Gemini dropping nullable fields) and SP-15 (eval mode bleed).

### Before
- One giant schema with all fields for all 5 types, all nullable
- Gemini Flash Lite dropped fields arbitrarily → silent fallbacks to wrong values
- Required extensive post-reconstruction validation and rejection logic
- count-like vs count-mixed indistinguishable without post-filter

### After
- 5 focused sub-generators, one per challenge type
- Each has a simple schema with only its fields, most required (not nullable)
- Orchestrator dispatches via `Promise.all` based on eval mode constraint
- count-like vs count-mixed differentiated by separate prompts ("single coin type" vs "mix coins")
- All derived values computed deterministically (correctTotal, correctChange, correctGroup)
- Same exported function signature — no caller changes

### Sub-generators
| Function | Type | Key fields (all required) |
|----------|------|--------------------------|
| `generateIdentifyChallenges` | identify | coins, targetCoin, options |
| `generateCountChallenges` | count | displayedCoins (derives correctTotal) |
| `generateMakeAmountChallenges` | make-amount | targetAmount, availableCoins |
| `generateCompareChallenges` | compare | groupA, groupB (derives correctGroup) |
| `generateMakeChangeChallenges` | make-change | paidAmount, itemCost (derives correctChange) |

## Previously Fixed Issues (session 1)

All SP-14/SP-15 issues from the first eval session are now structurally eliminated by the orchestrator refactor:

- **identify** — Options/coins arrays missing (SP-14) → now required in schema
- **count-like** — Mixed coin types violating single-type intent (SP-15) → separate prompt + post-filter
- **count-mixed** — displayedCoins missing (SP-14) → now required in schema, rejected if empty
- **compare** — groupA data missing (SP-14) → now required in schema, rejected if empty
- **make-change** — itemCost missing, fell back to hardcoded 65¢ (SP-14) → now required in schema, rejected if missing or paidAmount <= itemCost
