# Eval Report: sentence-builder — 2026-06-25

Focus: Step 2c support-tier + **structural-difficulty** sweep (new axis 2 just added).
Mode swept: `simple` @ grade 2, topic "Animals at the zoo". Harness returned a
blended challenge set, so the per-challenge (blended) tier path was exercised too.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| simple    | PASS   | —      |

## Tier sweep (decoy-tile lever)

| difficulty | supportTier | decoys/challenge | similarity | hint | arrLen |
|---|---|---|---|---|---|
| (none)  | undefined | 0 | — | present | 4 |
| easy    | easy | 0 | — (clean) | present | 4 |
| medium  | medium | 1 | far (e.g. "Pizza"(subject), "Yesterday"(modifier)) | present | 4 |
| hard    | hard | 2 | near (same role/wrong word: "The bear"(subject), "sleeps"(predicate)) | stripped | 4 |

- **Structural lever moves**: decoys 0 → 1 → 2; similarity far → near. ✓
- **Magnitude invariant**: `validArrangements[0].length` = 4 at every tier (sentence
  type/length never changed). ✓
- **Answer-safe**: decoy tiles appear in no `validArrangement`; the checked answer is
  unchanged across tiers. ✓
- **Null-tier no-op**: baseline = supportTier undefined, 0 decoys, hint present. ✓
- **No answer leak** at any tier.

Verified offline (40k random runs) that the decoy-count trim is an exact ceiling and
never drops an answer-bearing tile.
