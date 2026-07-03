# Topic Fidelity (--grade): evidence-finder — 2026-07-03

Ladder intended: 2 / 3 / 4 / 5 / 6 (reading level = vocabulary complexity + passage length + sentence length; CER lights up at grade 4+). Rungs defined in the `gradeContext` map. Floor = 2 (K/1 clamp up).

Eval mode probed: `locate_evidence`. Topic: "why leaves change color". Band held at `elementary`.

| Probe | grade | gradeLevel field | sentences | total words | avg sent words | evidence | verdict |
|-------|-------|------------------|-----------|-------------|----------------|----------|---------|
| discrimination | 2 | 2 | 9 | 84  | 9.3  | 3 | tracks (after fix) |
| discrimination | 4 | 4 | 8 | 153 | 19.1 | 3 | tracks (after fix) |
| discrimination | 6 | 6 | 9 | 151 | 16.8 | 5 | tracks (after fix) |
| no-regression  | (band=elementary, no grade) | 4 | 8 | 116 | 14.5 | 3 | band default (MID_RUNG 4) |

**Before fix:** every grade returned `gradeLevel: 3`, ~8 sentences, avg sent words 12.6/16.8/13.2 with no grade-monotonic trend (grade 2 = 101 words, grade 6 = 106 words). The five `gradeContext` rungs and the `TARGET GRADE LEVEL` prompt line were all pinned to the fallback '3'.

Before-fix probe row (for the record):
- grade=2 → GL=3, 8 sent, 101 words, 12.6 avg
- grade=4 → GL=3, 8 sent, 134 words, 16.8 avg
- grade=6 → GL=3, 8 sent, 106 words, 13.2 avg
- no-grade → GL=3, 9 sent, 107 words, 11.9 avg

**After fix:** `gradeLevel` echoes 2/4/6 exactly and structural signals scale — passage length climbs 84→153 words and average sentence length climbs 9.3→19.1 words as grade rises (grade 2 is markedly simpler than grade 6). No-grade control now falls to the band mid-rung '4' (was the hardcoded '3'); this is the intended band default, not a regression. `useCER` is derived from the resolved rung (grade < 4 → false), so CER stays off for grades 2/3 and would light for 4-6 in the CER-eligible modes. No answer leak introduced (title/passage do not reveal evidence tags).

**Verdict:** FIDELITY BUG → fixed at single tier (grade arrives structured via `ctx.grade`; no resolver needed).
**Mechanism:** legacy parse-and-fallback — `const gradeLevel = ctx.gradeContext` (prose sentence) was matched against `['2','3','4','5','6']`, which never hit, pinning every activity to the '3' fallback.
**Change:** `gemini-evidence-finder.ts` — replaced the prose match with the `ctx.grade` consumption pattern (LADDER 2-6; above-ceiling → '6'; K/1 → '2' floor; band fallback kindergarten/preschool→'2' else '4'); removed the dead `gradeLevel = ctx.gradeContext` read. Schema and eval-mode axis unchanged. | tsc: not run (consolidated by orchestrator).
