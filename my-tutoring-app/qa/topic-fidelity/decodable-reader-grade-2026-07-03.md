# Topic Fidelity (--grade): decodable-reader — 2026-07-03

Ladder intended: K / 1 / 2 (reading level = vocabulary complexity + passage length + phonics-pattern breadth).

| Probe | grade | gradeLevel field | sentences | total words | phonics patterns | verdict |
|-------|-------|------------------|-----------|-------------|------------------|---------|
| honored        | K | K | 2 | 11 | cvc, sight | HONORED (after fix) |
| discrimination | 1 | 1 | 4 | 28 | +blend, +digraph | tracks |
| discrimination | 2 | 2 | 5 | 28 | +r-controlled, +diphthong | tracks |
| no-regression  | (band=kindergarten) | K | 2 | 11 | — | band default |

**Before fix:** all three grades returned `gradeLevel: K`, 2 sentences, ~10 words, cvc/sight only — the Grade-1 and Grade-2 GUIDELINES blocks (lines 245-269) were dead code.

**Verdict:** FIDELITY BUG → fixed at single tier (grade arrives structured; no resolver).
**Mechanism:** legacy parse-and-fallback — read `ctx.gradeContext` (prose sentence) then matched it against `['K','1','2']`, which never hit, pinning every passage to 'K'.
**Change:** `gemini-decodable-reader.ts` — replaced the prose match with the `ctx.grade` consumption pattern (LADDER K/1/2; above-ceiling → '2'; band fallback kindergarten→'K' else '1'); removed the dead `gradeLevel = ctx.gradeContext` read. | tsc: 1101 (baseline, 0 new)
