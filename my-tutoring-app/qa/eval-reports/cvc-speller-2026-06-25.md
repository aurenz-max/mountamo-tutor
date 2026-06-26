# Eval Report: cvc-speller — 2026-06-25

Focus: Step 2c support-tier + **structural-difficulty** sweep (new axis 2 just added).
Modes swept: fill-vowel, spell-word, word-sort @ kindergarten, vowelFocus short-a
(confusability rank a → [e, o, i, u]). Harness returns a blended set, so all three
task types were checked at each tier.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| fill-vowel | PASS | — |
| spell-word | PASS | — |
| word-sort  | PASS | — |

## Tier sweep (distractor-confusability lever)

**fill-vowel** — decoy vowel (correct = a):

| difficulty | vowelOptions decoy | distance |
|---|---|---|
| (none) | e | legacy nearest |
| easy | u | FAR ✓ |
| hard | e | NEAR ✓ |

**spell-word** — distractor-letter count (support tier) × similarity (structural):

| difficulty | count | example (target → distractors) | similarity |
|---|---|---|---|
| (none) | 2 | LLM-authored | baseline |
| easy | 1 | [t,a,p] → [y] | FAR ✓ |
| hard | 5 | [t,a,p] → [e,q,d,b,l] | NEAR ✓ (e=vowel, q/d/b=p, l=t) |

Distractors never include a target letter (answer stays spellable). pictureCue
withdraws undefined→true(easy)→false(hard) per support tier.

**word-sort** — contrast bucket vowel:

| difficulty | bucket pair | distance |
|---|---|---|
| (none) | a / e | legacy nearest |
| easy | a / u | FAR ✓ |
| hard | a / e | NEAR ✓ |

- **Structural lever moves** across all three modes (far→near). ✓
- **Magnitude invariant**: every word stays 3-letter CVC; vowel focus unchanged. ✓
- **Mode identity preserved**: still binary vowel pick / Elkonin spell / 2-bucket sort. ✓
- **Null-tier no-op**: baseline = supportTier undefined, legacy nearest contrast,
  pictureCue undefined, LLM-authored distractor count. ✓
- **No answer leak** at any tier (correct vowel = targetLetters[1], never revealed).

Verified offline (20k random runs) that distractor-letter selection hits the exact
count, never leaks a target letter, and respects near/far ordering.
