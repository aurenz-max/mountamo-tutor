# Grade Fidelity — revision-workshop

**Generator:** `my-tutoring-app/src/components/lumina/service/literacy/gemini-revision-workshop.ts`
**Modality:** `/topic-fidelity --grade`
**Date:** 2026-07-03
**Verdict:** FIDELITY_BUG_FIXED
**Mechanism:** parse-and-fallback (dead `ctx.gradeContext` read pinned every activity to grade 4)
**Ladder:** 2-6 (rungs defined in `gradeNotes` / `skillsByGrade`)

## The bug

Line 76 read `const gradeLevel = ctx.gradeContext` — a PROSE sentence — then line 78
matched it against `['2','3','4','5','6']`, which never hits. So `gradeLevelKey` was
CONSTANT at the `'4'` fallback for every objective, regardless of the canonical
curriculum grade delivered as `ctx.grade`. `gradeNotes[gradeLevelKey]`,
`skillsByGrade[gradeLevelKey]`, and the `GRADE:` prompt line were all pinned to 4.
`ctx.grade` (the ONLY grade parser, from `normalizeObjectiveGrade`) was never read.

## The fix

Mirrors `gemini-poetry-lab.ts` / `gemini-decodable-reader.ts`: read `ctx.grade` against
the real 2-6 ladder; below-floor grades (K/1) clamp to `'2'`, above-ceiling (>6) clamp to
`'6'`, and the band fallback yields `'2'` for kindergarten/preschool else `'4'` (MID_RUNG).
Removed the dead `ctx.gradeContext` read. Schema, eval-mode axis, and skill-selection logic
UNCHANGED — grade governs realization (structural load, reading level), not the cognitive
KIND of the revision skill. No answer leak introduced (prompt/suggestions untouched).

## Probe table (topic: "a community helper")

| probe | grade | skill (grade-selected) | gradeEcho | sentences | words | avgWordLen | longWords(>=7) | targets | verdict |
|-------|-------|------------------------|-----------|-----------|-------|------------|----------------|---------|---------|
| BEFORE (word_choice, forced skill) | 2 | word-choice | **4** | 7 | 59 | 3.73 | 6 | 3 | pinned |
| BEFORE (word_choice) | 4 | word-choice | **4** | 6 | 43 | 3.79 | 6 | 4 | pinned |
| BEFORE (word_choice) | 6 | word-choice | **4** | 6 | 63 | 4.05 | 8 | 3 | pinned |
| BEFORE (word_choice) | none | word-choice | **4** | 6 | 56 | 3.96 | 8 | 4 | (control) |
| AFTER (gradeNotes active) | 2 | word-choice | 2 | 4 | 25 | 3.28 | 2 | 3 | tracks |
| AFTER | 4 | transitions | 4 | 6 | 45 | 4.29 | 5 | 3 | tracks |
| AFTER | 6 | reorganize | 6 | 5* | 73 | 4.85 | 14 | 5 | tracks |
| AFTER | none | word-choice | 4 | 6 | 42 | 4.19 | 7 | 4 | control unchanged |

\* grade-6 draft is a REORGANIZE task (scrambled sentences); count reflects the scramble, not brevity.

## Reading

BEFORE: `gradeEcho` was pinned to **4** across every grade — direct evidence the `GRADE:`
prompt line never moved. Draft complexity was flat noise (grade 2 had MORE sentences than
grade 6; avgWordLen 3.73→4.05).

AFTER: signals rise monotonically with grade — word count 25→45→73, avgWordLen 3.28→4.29→4.85,
long-word count 2→5→14, target count 3→3→5, and the grade-selected revision skill shifts from
word-choice (G2) to transitions (G4) to reorganize (G6), exactly the `skillsByGrade` ladder.
The no-grade band control stays at grade-4 behavior (MID_RUNG fallback), matching the pre-fix
constant — no regression.
