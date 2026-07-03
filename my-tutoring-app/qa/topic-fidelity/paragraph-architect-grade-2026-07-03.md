# Topic Fidelity (--grade): paragraph-architect — 2026-07-03

Ladder intended: K / 1 / 2 / 3 / 4 / 5 / 6 (reading level = vocabulary tier + model-paragraph length + detail count + linking-word sophistication). Eval mode probed: `informational`. Topic: "why leaves change color".

| Probe | grade | gradeLevel field | detail sentences | model words | avg word len | linking words | verdict |
|-------|-------|------------------|------------------|-------------|--------------|---------------|---------|
| honored        | K | K | 2 | 26  | 3.46 | and, but, so, because, then, now | HONORED (after fix) |
| discrimination | 3 | 3 | 4 | 100 | 4.64 | because, for example, in addition, however, therefore, finally, as a result | tracks |
| discrimination | 5 | 5 | 4 | 122 | 5.65 | furthermore, consequently, specifically, nevertheless, moreover, as demonstrated, to illustrate | tracks |
| no-regression  | (band=elementary, no grade) | 3 | 4 | 95 | 4.83 | grade-3 list (unchanged) | band default → mid rung |

**Before fix:** all three grades (K / 3 / 5) returned `gradeLevel: 3`, 4 detail sentences, ~92-98 model words, and the byte-identical grade-3 linking list `[because, also, for example, in addition, however, therefore, first, second, finally, as a result]`. The K, 1, 2, 4, 5, 6 GUIDELINES blocks (lines 168-249) were dead code — never selected.

**Verdict:** FIDELITY BUG → fixed at single tier (grade arrives structured at the registry boundary; no resolver needed).
**Mechanism:** legacy parse-and-fallback — `const gradeLevel = ctx.gradeContext` read the PROSE sentence, then `gradeContext[gradeLevel] || gradeContext['3']` matched prose against keys `['K'..'6']`, which never hit, pinning every activity to the grade-3 guideline.
**Change:** `gemini-paragraph-architect.ts` — removed the dead `gradeLevel = ctx.gradeContext` read; added the canonical `ctx.grade` consumption pattern (LADDER K-6; above-ceiling numeric → '6'; band fallback kindergarten/preschool → 'K' else '3' mid rung); repointed the four prompt `${gradeLevel}` interpolations to `gradeLevelKey`. Schema and eval-mode/paragraphType axis unchanged — grade governs realization only, not the cognitive KIND. No answer leak introduced (frames retain `___` blanks; model paragraph is the intended Explore-phase exhibit). tsc deferred to orchestrator consolidated run.

**After fix (structural signals now track grade):**
- K: 2 detail sentences, 26 model words, avg word len 3.46, primer linking words, "The big leaves turn gold in fall."
- 3: 4 detail sentences, 100 words, avg 4.64, grade-3 academic connectors.
- 5: 4 detail sentences, 122 words, avg 5.65, sophisticated academic linking, "Research shows that the vibrant transformation of leaves in autumn is primarily driven by…"
- Band control (no grade): unchanged, falls back to grade-3 mid rung.
