# topic-fidelity --grade — spelling-pattern-explorer (2026-07-03)

**Generator:** `my-tutoring-app/src/components/lumina/service/literacy/gemini-spelling-pattern-explorer.ts`
**Modality:** `--grade` (does the objective's canonical curriculum grade shape output?)
**Verdict:** FIDELITY_BUG_FIXED
**Mechanism:** parse-and-fallback (dead prose read → constant hardcoded grade 3)
**Ladder:** grades 1-6 (no K rung; TOP_RUNG='6', MID_RUNG='3', floor='1')

## Root cause

```ts
const gradeLevel = ctx.gradeContext;                                  // PROSE sentence
const gradeLevelKey = ['1','2','3','4','5','6'].includes(gradeLevel) ? gradeLevel : '3';
```

`ctx.gradeContext` is a prose sentence (e.g. "This lesson targets elementary students…"), which is
never a member of `['1'..'6']`, so `gradeLevelKey` silently pinned to `'3'` for every objective.
Both `gradeNotes[gradeLevelKey]` (structural load: pattern/dictation word counts, vocab tier) and
`patternsByGrade[gradeLevelKey]` (which pattern family) were therefore frozen at grade 3.

## Fix (mirrors gemini-poetry-lab.ts / gemini-decodable-reader.ts)

Read the canonical `ctx.grade`; clamp above-ceiling numeric grades to top rung '6'; band-only
fallback (kindergarten/preschool → grade-1 floor since no K rung, else mid rung '3'). Removed the
dead `ctx.gradeContext` read. Schema and eval-mode/challenge-type axis left UNCHANGED — grade
governs realization only.

## Probe table (evalMode=`morphological`, topic="why leaves change color")

| probe | grade | structural signals | verdict |
|-------|-------|--------------------|---------|
| BEFORE | 1 | gradeLevelField=**3**, patternWords=**8**, dictation=**5**, avglen 7.2, pattern=suffix-change | constant |
| BEFORE | 3 | gradeLevelField=**3**, patternWords=**8**, dictation=**5**, avglen 7.8, pattern=suffix-change | constant |
| BEFORE | 5 | gradeLevelField=**3**, patternWords=**8**, dictation=**5**, avglen 6.9, pattern=suffix-change | constant |
| BEFORE | (none) | gradeLevelField=3, patternWords=8, dictation=5, avglen 7.1 | control |
| AFTER | 1 | gradeLevelField=4, patternWords=**6**, dictation=**4**, avglen 7.2, CVC-doubling words | tracks |
| AFTER | 3 | gradeLevelField=3, patternWords=**8**, dictation=**5**, avglen 7.4 | tracks |
| AFTER | 5 | gradeLevelField=5, patternWords=8, dictation=5, avglen **10.5**, pattern=**latin-root** (`transformation`,`observation`,`-tion`) | tracks |
| AFTER | (none) | gradeLevelField=3, patternWords=8, dictation=5, avglen 7.2 | control unchanged |

## Evidence

BEFORE: every grade collapsed to grade-3 realization — `gradeLevelField='3'`, 8 pattern / 5 dictation
words, avglen ~7, suffix-change for grades 1, 3, AND 5. Output was constant.

AFTER: grade 1 → 6/4 words (grade-1 note), grade 3 → 8/5, grade 5 → latin-root `-tion` vocabulary
with avglen 10.5/9.4 (vs 7.2/6.8 at grade 1) — a clear complexity gradient. The no-grade band
control is byte-comparable to BEFORE (mid-rung '3'), confirming no regression. No answer leak
introduced (schema unchanged; `correctRule` is a pre-existing model-answer field, not surfaced to
the student as placeholder text).
