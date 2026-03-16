# Eval Report: phonics-blender — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| cvc | PASS | — |
| cvce_blend | PASS | — |
| digraph | PASS | — |
| advanced | PASS | — |

All 4 modes pass after generator fixes. No CRITICAL or HIGH issues found.

## Verified Fixes

| Previous Issue | Status | Verification |
|----------------|--------|--------------|
| cvce_blend — underscore notation (`i_e`, `o_e`) broke letter concatenation | FIXED | All 5 CVCE words use separate silent-e phoneme (`letters: "e"`). Concatenation correct: bike=b+i+k+e, cake=c+a+k+e, tube=t+u+b+e, home=h+o+m+e, made=m+a+d+e |
| cvce_blend — incomplete phoneme breakdown (e.g., "nine" had 2 phonemes) | FIXED | All words have complete phoneme arrays (4 phonemes for CVCE words) |
| cvce_blend — irregular word "one" included | FIXED | No irregular words in output (bike, cake, tube, home, made) |
| ALL MODES — missing patternType field | FIXED | patternType present in all 4 responses: "cvc", "cvce", "digraph", "r-controlled" |

## Data Snapshots

### cvc
- Words: ten, six, run, bed, dot — all 3-phoneme CVC, letters concatenate correctly
- patternType: "cvc" ✓

### cvce_blend
- Words: bike, cake, tube, home, made — all proper CVCE with separate silent-e phoneme
- patternType: "cvce" ✓

### digraph
- Words: ship, chop, chin, thin, rich, wish — digraphs (sh, ch, th) treated as single phonemes
- patternType: "digraph" ✓

### advanced
- Words: farm, fern, bird, horn, hurt — r-controlled vowels (ar, er, ir, or, ur) as single phonemes
- patternType: "r-controlled" ✓
