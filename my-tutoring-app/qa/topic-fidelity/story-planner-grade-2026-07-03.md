# Topic-Fidelity (--grade): story-planner

**Generator:** `my-tutoring-app/src/components/lumina/service/literacy/gemini-story-planner.ts`
**Date:** 2026-07-03
**Modality:** `/topic-fidelity --grade`
**Verdict:** FIDELITY_BUG_FIXED
**Ladder:** K-6 (top rung 6, mid/band-fallback rung 3)

## Mechanism (parse-and-fallback)

The generator read grade from prose and matched it against the numeric ladder, which never hit:

```ts
const gradeLevel = ctx.gradeContext;                 // PROSE sentence, not a rung
...
const gradeLevelKey = ['K','1'..'6'].includes(gradeLevel) ? gradeLevel : '3';  // always '3'
```

`ctx.gradeContext` is a prose sentence and `ctx.gradeLevel` is a band key (`elementary` collapses 1-5), so `.includes()` never matched and `gradeLevelKey` was pinned to the `'3'` fallback for every objective. `gradeNotes[gradeLevelKey]`, the conflictTypes gate (`>= 4`), and the dialoguePrompt gate (`>= 3`) all keyed off that constant, so every grade produced the grade-3 realization.

## Fix

Mirror of `gemini-poetry-lab.ts` / `gemini-decodable-reader.ts`: consume `ctx.grade` (the only canonical numeric grade) against the K-6 ladder, clamp above-ceiling numerics to `'6'`, and fall back to `'K'` for kindergarten/preschool band or `'3'` otherwise. Removed the dead `ctx.gradeContext` read. Schema and eval-mode (planningFocus) axis unchanged — grade governs realization only.

## Probe table (evalMode=story_structure, topic="a community helper")

| probe | grade | structural signals | verdict |
|-------|-------|--------------------|---------|
| before | K | gradeLevel=3, 5 elements, 5-arc, conflictTypes=none, dialogue=yes | pinned to grade-3 |
| before | 3 | gradeLevel=3, 5 elements, 5-arc, conflictTypes=none, dialogue=yes | (baseline) |
| before | 5 | gradeLevel=3, 5 elements, 5-arc, conflictTypes=none, dialogue=yes | pinned to grade-3 |
| after | K | gradeLevel=K, 2 elements [Character, What Happened], 2-arc, conflictTypes=none, dialogue=no | tracks |
| after | 3 | gradeLevel=3, 5 elements, 5-arc, conflictTypes=none, dialogue=yes | tracks |
| after | 5 | gradeLevel=5, 6 elements [Main Char, Supporting Chars, Setting, Subplot, Relationships, Theme], 5-arc, 4 conflictTypes, dialogue=yes | tracks |
| after | (no &grade, band=elementary) | gradeLevel=3, 5 elements, 5-arc, conflictTypes=none, dialogue=yes | control unchanged |

## Evidence

- **Before:** all three grades identical — gradeLevel=3, elementCount=5, 5-arc, no conflictTypes. Only surface wording of arc labels varied (LLM noise), not structure.
- **After:** elementCount 2 → 5 → 6, arcCount 2 → 5 → 5, dialoguePrompt absent at K then present at 3+, conflictTypes appear only at grade 5 (>=4 gate). Element labels escalate from [Character, What Happened] to the grade-5 synthesis set (Subplot, Relationships, Theme).
- **No-regression control:** no `&grade=` with band `elementary` falls back to the grade-3 realization (5 elements, 5-arc) exactly as before the fix.
- **No answer leak:** prompts remain open student-facing questions; no correct plan revealed in labels or placeholders.
