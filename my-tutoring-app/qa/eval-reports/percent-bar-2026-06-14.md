# percent-bar — Support-Tier Difficulty Sweep (Step 2c)

**Date:** 2026-06-14  **Topic:** "Percent of a number"  **Grade:** grade 6  **Tolerance:** ±2% (const, untouched)
**Sweep:** identify_percent (baseline + easy + hard), find_part (easy/hard), find_whole (easy/hard), convert (easy/hard) — 9 calls, all HTTP 200, status=pass, 4 challenges each. No CRITICAL.

## Result: PASS

### Per-mode (supportTier → scaffold)
| call | tier | %Labels | valLabels | benchmarkLines | doubleBar | showCalc | rates | wholes |
|---|---|---|---|---|---|---|---|---|
| identify_percent base | _undef_ | true | true | 25,50,75 | false | **true** | 70,30,60,60 | 50,25,20,20 |
| identify_percent easy | easy | true | true | 25,50,75 | true | true | **50,25,75,75** (all benchmark) | 60,80,60,80 |
| identify_percent hard | hard | **false** | **false** | **[]** | false | **false** | 60,90,60,20 (non-bench) | 50,100,25,80 |
| find_part easy | easy | true | true | 25,50,75 | false | true | 60,50,40,60 | 30,40,40,30 |
| find_part hard | hard | false | false | [] | false | false | 70,90,50,90 | 50,120,20,40 |
| find_whole easy | easy | true | true | 25,50,75 | false | true | 12,10,25,7 | 100,80,20,100 |
| find_whole hard | hard | false | false | [] | false | false | 15,5,10,7 | 30,30,20,60 |
| convert easy | easy | true | true | 25,50,75 | false | true | 80,35,35,50 | 100,100,100,100 |
| convert hard | hard | false | false | [] | false | false | 80,60,75,35 | 100,100,100,100 |

### Assertions
1. **Scaffold flips (all 4 visual flips easy→hard):** PASS. Every mode: easy = labels on / benchmarkLines [25,50,75] / showCalculation on; hard = all four off / [] / off. doubleBar flips true→false on identify_percent (the only mode that turns it on at easy).
2. **LEAK CLOSED (key check):** PASS. `showCalculation=false` at hard for all 4 modes. Hard hints strategy-only — no target percent and no `100-rate` arithmetic. (Easy leaks for contrast: identify "slide the bar to 75%"; find_part "100 - 40 = ?"; convert "Pick the larger of 35 and 20". Hard equivalents name the strategy only: "subtract what is discounted", "place that percent", "place whichever is larger".) Digit scan of hard hints found only `100%`/`0%–100%` bar-frame literals — structural framing, never the answer.
3. **Structural rate lever:** PASS. identify_percent easy rates all ∈ {25,50,75}; identify_percent hard rates non-benchmark (60,90,20). Lever is `direct`-only by design; other modes draw their own pools (verified in code, not a regression).
4. **Magnitude invariance:** PASS. Wholes stay in each mode's fixed pool across tiers; hard is NOT systematically bigger (e.g. find_part easy wholes 30–40 vs hard 20–120; identify easy 60–80 vs hard 25–100). Target percents bounded by mode pool both tiers. TOLERANCE = `const 2`, never read by tier code.
5. **Null-tier no-op:** PASS. Baseline: supportTier=undefined, showCalculation=true (default), labels on, benchmarkLines [25,50,75], doubleBar false — grade-band defaults stand.

### Findings
None CRITICAL/HIGH. Design working as specified: tier withdraws all four visual aids + the calc panel + swaps explicit→strategy hints at hard; benchmark-rate structural lever moves on `direct`; magnitude + tolerance invariant; null tier is a clean no-op.
