# Eval-Test 2c — Support-Tier Difficulty Sweep: function-machine

- **Date:** 2026-06-14
- **Primitive:** `function-machine`
- **Step:** 2c (Support-Tier Difficulty Sweep)
- **Topic/grade:** "Function machine rules" / grade 4
- **Modes:** observe, predict, discover_rule, create_rule (each easy + hard) + 1 discover_rule baseline (no tier)
- **Result:** PASS — no CRITICAL/HIGH. Code NOT modified. EVAL_TRACKER.md NOT touched.

## Sweep matrix (per-challenge fields from fullData)

| run | mode | tier | showRule (all ch) | prefilledPairCount | pairsRequiredToComplete | hintLevel | badge | complexity |
|---|---|---|---|---|---|---|---|---|
| 1 | observe | easy | true | null | null | full | true | oneStep |
| 2 | observe | hard | true | null | **5** | none | **false** | oneStep |
| 3 | predict | easy | true | null | null | full | true | oneStep |
| 4 | predict | hard | true | null | **5** | none | **false** | oneStep |
| 5 | discover_rule | easy | **false** | **5** | null | full | true | oneStep |
| 6 | discover_rule | hard | **false** | **3** | null | none | true | twoStep* |
| 7 | create_rule | easy | **false** | **5** | null | full | true | oneStep |
| 8 | create_rule | hard | **false** | **3** | null | none | true | oneStep |
| 9 | discover_rule | BASELINE | **false** | null | null | null | undefined | oneStep |

All 9 runs: status=pass, catalogMeta present, challengeCount = 5 (observe/predict) / 4 (discover/create), supportTier stamped (undefined on baseline).

## Assertions

1. **Scaffold flips easy→hard — PASS.** observe/predict: hintLevel full→none, badge true→false, hard adds `pairsRequiredToComplete=5` (full queue). discover: `prefilledPairCount` 5→3, hintLevel full→none. create: `prefilledPairCount` 5→3, hintLevel full→none.

2. **showRule INVARIANT (KEY CHECK) — PASS.** observe/predict = `true` at every tier (easy AND hard). discover_rule + create_rule = `false` at every tier (easy AND hard) AND at baseline. **No tier flipped showRule anywhere.** Mode identity preserved; no answer leak. Ground-truth confirms `resolveSupportStructure` and the per-challenge tier loop never touch `showRule` (stamped from `MODE_PROFILES[mode].showRule` in `buildChallenges`).

3. **create_rule ≥2 rows at hard — PASS.** prefilledPairCount = **3** = `Math.max(2, ceil(5/2))`. Generator clamp (≥2) + component `createRulePairs` `Math.max(2, prefill)` both enforce. Rule stays uniquely determinable.

4. **Magnitude invariance — PASS (tier-invariant by construction).** Tier code never reads/writes `ruleComplexity` or the rule pool; rules differ run-to-run only by the per-call shuffle (`selectFunctionMachineRules`), which is randomized, not tier-driven. *Caveat (run 6):* discover_rule hard came back `twoStep` while easy was `oneStep` — this is **per-call LLM wrapper nondeterminism** on the `ruleComplexity` field (grade-4 admits both bands; eval-test passes no `config.ruleComplexity` override), NOT the tier changing magnitude. Verified in source: `ruleComplexity` is set only from the Gemini wrapper / `config.ruleComplexity`; the support-tier path leaves it untouched. Not a defect.

5. **Null-tier no-op (baseline) — PASS.** supportTier `undefined`; prefilledPairCount / pairsRequiredToComplete / hintLevel all `null`; showComplexityBadge `undefined` (component default true). Byte-identical to pre-tier behavior; showRule still `false`.

## Verdict
No CRITICAL, no HIGH. The mode-identity guard (showRule never tier-flipped) holds at every tier in every rule-hidden mode, the create_rule ≥2-row invariant holds at hard, scaffold levers flip correctly, magnitude is tier-invariant by construction, and the null-tier path is a clean no-op.
