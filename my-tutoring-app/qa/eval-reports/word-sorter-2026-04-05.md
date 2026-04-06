# Eval Report: word-sorter — 2026-04-05

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| binary_sort | PASS | — |
| ternary_sort | PASS | — |
| match_pairs | PASS | — |

## Bug Fix Verification: Duplicate Challenge IDs

**Status: FIXED**

The duplicate ID bug (each sub-generator producing `ch1, ch2, ch3` independently) is resolved. The generator now reassigns IDs after combining:

```typescript
allChallenges.forEach((ch, i) => {
  ch.id = `${ch.type}-${i}`;
});
```

### Stochastic Completion Trace (9 challenges, all modes)

Generated IDs: `binary_sort-0..2`, `ternary_sort-3..5`, `match_pairs-6..8` — all unique.

`useChallengeProgress.recordResult` uses `findIndex(r => r.challengeId === result.challengeId)`:
- With unique IDs, `findIndex` returns `-1` for each new challenge → **appends** (correct)
- `results.length` reaches 9 → `isComplete` (`results.length >= challenges.length`) becomes `true`
- Auto-submit effect fires → `advanceToNextChallenge()` → hits "All complete" branch → `submitEvaluation()` called

No path exists where completion fails with unique IDs.

### G1-G5 Sync Checks

- **G1 (Required fields):** binary/ternary challenges have `words`, `bucketLabels`, `instruction` — all present. match_pairs challenges have `pairs` — present. No missing fields.
- **G2 (Flat-field reconstruction):** N/A — generator uses array schemas, not flat fields.
- **G3 (Eval mode differentiation):** Each mode uses a distinct `challengeTypes` value. No overlap.
- **G4 (Answer derivability):** `correctBucket` on each word matches one of the `bucketLabels`. Match pairs have `term`/`match` fields. Student can derive answers from visible data.
- **G5 (Fallback quality):** Component guards with `?.words`, `?.bucketLabels`, `?.pairs` — returns null on missing data rather than silent fallback. No hardcoded defaults.
