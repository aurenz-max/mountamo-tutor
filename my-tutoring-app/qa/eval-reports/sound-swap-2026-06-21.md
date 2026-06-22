# Eval Report: sound-swap — 2026-06-21

**Step 2c (Support-Tier / structural-difficulty sweep) — BLOCKED.**
The generator throws on every call (decommissioned Gemini model → 404), so no data
is produced at ANY tier for ANY mode. The structural-difficulty + scaffold-withdrawal
wiring could not be exercised against the running server.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| addition (baseline/easy/hard) | FAIL | 1 (generator 404 — blocks all tiers) |
| deletion (baseline/easy/hard) | FAIL | 1 (same root cause) |
| substitution (baseline/easy/hard) | FAIL | 1 (same root cause) |

Sweep modes attempted: addition, deletion, substitution. All 9 curls (3 modes × baseline/easy/hard)
return `status:"error"` with the identical 404. No challenges returned, so checks 1-5
(scaffold withdrawal, structural lever, magnitude invariance, no-leak, null-tier no-op)
are UNVERIFIABLE.

## Issues

### all modes — Generator pinned to a decommissioned Gemini model (blocks the entire primitive)
- **Severity:** CRITICAL
- **What's broken:** `gemini-sound-swap.ts` line 814 hardcodes `model: "gemini-2.0-flash-lite"`, which Google has retired. Every generation call returns `404 NOT_FOUND: "This model models/gemini-2.0-flash-lite is no longer available."` The primitive ships nothing (pedagogy rule #1). This is environment-confirmed primitive-specific, NOT a server/key problem: sibling `cvc-speller` (`evalMode=fill_vowel`) returns `status:"pass"` against the same running server. `sound-swap` is the ONLY literacy generator still on this model — the other 27 literacy generators use `gemini-flash-lite-latest`.
- **Data:** `sound-swap → "gemini-2.0-flash-lite"` (1 occurrence); `cvc-speller (works) → "gemini-flash-lite-latest"`; literacy generator model census: `gemini-2.0-flash-lite ×1`, `gemini-flash-lite-latest ×27`. Error body: `{"code":404,"status":"NOT_FOUND"}`.
- **Fix in:** GENERATOR (change line 814 to `gemini-flash-lite-latest` to match the rest of literacy, then re-run the full Step-2c sweep).

## Note on the structural-difficulty wiring (static read only — UNVERIFIED at runtime)
The axis-2 / axis-1 code in `gemini-sound-swap.ts` looks structurally coherent on read
(`resolveProblemShape` ladder beginning→end→middle with addition honestly saturating
at `end`; `resolveSupportStructure` flipping `showWordImage`/`nameTargetSound`/
`showTargetHighlight`/`optionCount` per tier; per-challenge application gated on
`supportTier`; null-tier leaves fields unset → component defaults ON). But none of this
was confirmed against generated data because the model 404 prevents any generation.
Re-sweep after the model fix to validate the five checks (and, for the full position
ladder on deletion/substitution medial swaps, also try `&gradeLevel=grade%206`).
