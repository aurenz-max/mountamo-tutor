# Eval-Test Step 2c — Support-Tier Difficulty Sweep

**Primitive:** skip-counting-runner (fluency, no-timer)
**Date:** 2026-06-14
**Topic:** "Skip counting by 5s" · Grade 2
**Run:** easy + hard for 5 modes + 1 null-tier baseline (fill_missing). curl --max-time 90.

## Result: PASS (no CRITICAL/HIGH)

All 11 calls returned `status: pass`, non-null catalogMeta (`evalMode=...` separator worked first try), 5–6 challenges each. No 0-challenge / error responses.

## Per-mode showOptions (easy → hard)

| mode | tier | arcs | equation | array | digitPat | autoPlay | trackLabels | seqChips | **skipValueBadge** | hiddenCount |
|------|------|------|----------|-------|----------|----------|-------------|----------|--------------------|-------------|
| count_along | easy | ✓ | ✓ | ✓ | ✓ | **✓** | ✓ | ✓ | ✓ | — |
| count_along | hard | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | — |
| predict | easy | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | — |
| **predict** | **hard** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✗ LEAK GUARD** | — |
| fill_missing | easy | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | **1** |
| fill_missing | hard | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | **3** |
| find_skip_value | easy | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | — |
| **find_skip_value** | **hard** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓* | ✓* | **✗ LEAK GUARD** | — |
| connect_multiplication | easy | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | — |
| **connect_multiplication** | **hard** | ✗ | **✗ LEAK GUARD** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | — |
| fill_missing | **null (baseline)** | ✓ | ✓ | ✓ | ✓ | ✗ | *(absent→ON)* | *(absent→ON)* | *(absent→ON)* | 1/2/4 (LLM-chosen) |

\* find_skip_value HARD intentionally KEEPS trackLabels + seqChips ON — the landing labels are the DATA the student reasons the interval from (per design comment); the badge/button cue (the answer) is what's suppressed.

## Assertions

1. **Scaffold flips (easy→hard):** PASS. arcs/array/equation/digitPattern/trackLabels/seqChips all true→false at hard across modes.

2. **LEAK CLOSED (key check):** PASS.
   - predict HARD `showSkipValueBadge=false` (gates header badge AND "+N" jump button) ✓
   - find_skip_value HARD `showSkipValueBadge=false` ✓
   - connect_multiplication HARD `showEquation=false` (the jumpCount×skipValue=product readout) ✓
   - All three are `true` at easy → genuine withdrawal, not always-off.

3. **fill_missing structural gap grows:** PASS. easy = exactly 1 hidden / challenge; hard = exactly 3 / challenge. All hidden positions are valid interior multiples of 5 within [startFrom, endAt] (e.g. hard ch: [15,20,35], [10,25,40], [5,20,45] — none are 0 or the endpoint). Code-enforced hiddenCount overrode LLM (baseline run shows raw LLM emitting 1/2/4, proving the enforcement is what produces the exact 1/3).

4. **Magnitude invariance + no timer + autoPlay:** PASS.
   - skipValue = 5 in every run. startFrom = 0 in every run.
   - autoPlay = true ONLY at count_along easy; false in all other easy runs and ALL hard runs. ✓
   - Component renders NO timer/countdown surface (fluency rule); gameMode.timeLimit present in JSON but SkipCountingRunner.tsx never reads gameMode → not rendered. ✓
   - **endAt note (NOT a failure):** endAt varies across calls (30 vs 50). This is per-call LLM choice of track length, NOT tier-driven — `resolveSupportStructure` / the tier-apply block provably never writes startFrom/endAt/skipValue. It is not a within-tier magnitude change (no easy/hard pair was generated from the same base with a tier-shifted endAt). Magnitude invariance holds for the only axis the tier controls.

5. **null-tier no-op (baseline):** PASS. supportTier `undefined`; showOptions contains ONLY the 5 legacy keys (showArray/JumpArcs/Equation/DigitPattern/autoPlay) — the 3 new keys (showTrackLabels/showSequenceChips/showSkipValueBadge) are ABSENT, so the component's `= true` destructure defaults render them ON (byte-identical legacy behavior). hiddenPositions left at LLM values (1/2/4), no tier enforcement applied.

## Findings: none CRITICAL/HIGH.
- Minor observation (not a bug): `gameMode.timeLimit` is still populated by the LLM (e.g. 120/300s) though it is inert (component ignores gameMode). Harmless given the no-timer rule is enforced at the render layer, but a future cleanup could drop gameMode from the schema to avoid confusion.
