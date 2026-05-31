# Eval Report: number-tracer — 2026-05-30

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| trace     | PASS | — |
| copy      | PASS | — |
| write     | PASS | — |
| sequence  | PASS | — |

**Resolved 2026-05-30.** All four modes now return valid JSON and render. The shared generator defect (NT-1) was fixed by removing the dead `strokePaths` field from the schema. A companion SP-17 hardening also removed `instruction` from the schema and synthesizes it deterministically — see Notes.

## Issues

### all modes — Required nested `strokePaths` blows past Gemini's output limit → truncated JSON

- **Severity:** CRITICAL
- **What's broken:** `strokePaths` is in the schema as an array-of-arrays-of-`{x,y}` objects AND listed in `required`, so Gemini Flash Lite must emit it for every challenge. Despite the prompt saying "ALWAYS set strokePaths to []", the schema forces Gemini to fill the nested shape with hundreds of coordinate points across all challenges. The response overflows the max output token limit and is cut off mid-array, so `JSON.parse` throws `Expected ',' or ']' after array element` at position 66381 (a single ~65KB line). Affects every eval mode because the field lives in the shared base schema.
- **The field is dead weight:** The generator discards whatever Gemini returns and force-sets `challenge.strokePaths = []` ([gemini-number-tracer.ts:184](../../src/components/lumina/service/math/gemini-number-tracer.ts#L184)). The component only uses generated paths if non-empty and otherwise falls back to hardcoded `getDigitPaths(digit)` ([NumberTracer.tsx:433-437](../../src/components/lumina/primitives/visual-primitives/math/NumberTracer.tsx#L433-L437)). The round-trip is pure cost — it inflates the payload, invites truncation, and is thrown away on arrival.
- **Data:** `strokePaths` schema = `ARRAY<ARRAY<{x:NUMBER, y:NUMBER}>>`, in `required` at [gemini-number-tracer.ts:75](../../src/components/lumina/service/math/gemini-number-tracer.ts#L75)
- **Fix in:** GENERATOR

## Recommended Fix

Remove `strokePaths` from the schema entirely — delete the property block ([lines 54-68](../../src/components/lumina/service/math/gemini-number-tracer.ts#L54-L68)) and drop it from the `required` array ([line 75](../../src/components/lumina/service/math/gemini-number-tracer.ts#L75)). No component or type changes needed: the component already supplies paths and the generator already zeroes the field at line 184. This shrinks each challenge by ~95% and eliminates the truncation by construction.

This is a new variant of **SP-6** (Flash Lite fails on complex schemas), with the specific failure mode being a *required deeply-nested array* the component never consumes. The schema-simplify fix mirrors the SP-17 resolution pattern (remove the LLM-owned field; supply it deterministically).

## Notes — Fix Applied (2026-05-30)

**Tier 1 (NT-1, the reported crash) — SCHEMA-SIMPLIFY / SP-6:**
Removed the `strokePaths` property block and dropped it from `required` in [gemini-number-tracer.ts](../../src/components/lumina/service/math/gemini-number-tracer.ts). The component already supplies canonical stroke order via hardcoded `getDigitPaths(digit)`; the post-process still force-sets `challenge.strokePaths = []`. Eliminates the output-token overflow by construction — each challenge shrank ~95%. **Pedagogical rationale:** LLM-generated coordinate paths would produce illegible glyphs with arbitrary stroke order, *degrading* the handwriting instruction. Canonical paths belong in code, not the LLM.

**Tier 2 (companion hardening) — SCHEMA-SIMPLIFY / SP-17:**
Also removed the `instruction` field from the schema and now synthesize it deterministically via `buildInstruction(challenge)` after digit/sequence normalization. Rationale: `instruction` is the most prominent visible text on screen, and for `sequence` mode the missing number IS the hidden answer (UI renders `?` at `missingIndex`). Letting the LLM own that prose risked leaking the answer — a direct violation of the no-answer-reveal rule. Deriving it guarantees no leak and no desync by construction. `title`/`description`/`hint` remain the LLM's creative surface; the prompt now forbids the `sequence` hint from naming the missing number.

**Verification (all 4 modes re-tested 2026-05-30, dev server):**
| Mode | Before | After | Notes |
|------|--------|-------|-------|
| trace | FAIL | PASS | 5 challenges, clean JSON, instructions synthesized |
| copy | FAIL | PASS | 5 challenges |
| write | FAIL | PASS | 5 challenges, multi-digit (12,14,18) |
| sequence | FAIL | PASS | G4 verified: `digit === sequenceNumbers[missingIndex]` for all 5; instruction never names the answer |

TypeScript compiles clean (no new errors). No component or type changes required.
