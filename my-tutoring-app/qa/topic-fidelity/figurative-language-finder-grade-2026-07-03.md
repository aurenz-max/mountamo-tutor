# Grade Fidelity — figurative-language-finder

**Date:** 2026-07-03
**Modality:** `/topic-fidelity --grade`
**Generator:** `my-tutoring-app/src/components/lumina/service/literacy/gemini-figurative-language-finder.ts`
**Verdict:** FIDELITY_BUG_FIXED
**Mechanism:** parse-and-fallback (dead field + missing canonical read)

## The bug

The generator read the grade from the wrong source and then matched it against a
numeric ladder that the source string can never satisfy:

```ts
const gradeLevel = ctx.gradeContext;                                   // PROSE sentence
...
const gradeLevelKey = ['3','4','5','6'].includes(gradeLevel) ? gradeLevel : '4';
```

`ctx.gradeContext` is a prose sentence (and `ctx.gradeLevel` is a band key like
`'elementary'`). Neither ever equals `'3'|'4'|'5'|'6'`, so `gradeLevelKey` was
**pinned to `'4'` for every objective**. The canonical `ctx.grade` (`'K'|'1'..'12'`)
was never read. Because `gradeLevelKey` drives `gradeNotes`, `typesByGrade`
(`availableTypes`), and `INSTANCE_CAP_BY_GRADE`, the entire grade axis was inert —
a grade-3 and a grade-6 objective produced the same grade-4 realization.

## The fix

Mirrors the reference fix (`gemini-poetry-lab.ts`, `gemini-decodable-reader.ts`).
Grade ladder for this generator is **3-6** (the rungs `gradeNotes`/`typesByGrade`
define). Read `ctx.grade`; above-ceiling clamps to top rung `'6'`; below-ladder
(K/1/2) clamps to bottom rung `'3'`; missing grade falls back to band
(`kindergarten`/`preschool` → `'3'`, else mid rung `'4'`):

```ts
const GRADE_LADDER = ['3','4','5','6'] as const;
let gradeLevelKey: string;
if (ctx.grade && GRADE_LADDER.includes(ctx.grade)) gradeLevelKey = ctx.grade;
else if (ctx.grade && parseInt(ctx.grade,10) > 6) gradeLevelKey = '6';
else if (ctx.grade && Number.isFinite(parseInt(ctx.grade,10)) && parseInt(ctx.grade,10) < 3) gradeLevelKey = '3';
else gradeLevelKey = ctx.gradeLevel === 'kindergarten' || ctx.gradeLevel === 'preschool' ? '3' : '4';
```

The dead `const gradeLevel = ctx.gradeContext;` was removed. Schema, eval-mode axis,
and support-tier axes are unchanged — grade governs realization (reading level,
`availableTypes`, instance cap), never the cognitive kind of the eval mode.

## Probe table

Eval mode `simile`; topic `"why leaves change color"`; `gradeLevel=elementary`.

### Before (parse-and-fallback → constant grade 4)

| probe | grade | gradeLevel field | availableTypes | instances | passage words | verdict |
|-------|-------|------------------|----------------|-----------|---------------|---------|
| A | 3 | **4** | simile, metaphor, personification, hyperbole | 5 | 63 | pinned |
| B | 5 | **4** | simile, metaphor, personification, hyperbole | 5 | 71 | pinned |
| C | 6 | **4** | simile, metaphor, personification, hyperbole | 5 | 70 | pinned |
| D | (none) | 4 | (same 4-type set) | 4 | 83 | band → 4 |

All rows identical grade key → **CONSTANT**. Grade axis dead.

### After (tracks ctx.grade)

| probe | grade | gradeLevel field | availableTypes (count) | instances | passage words | verdict |
|-------|-------|------------------|------------------------|-----------|---------------|---------|
| A | 3 | **3** | simile, alliteration (2) | 4 | 53 | tracks |
| B | 5 | **5** | 7 types (adds idiom, imagery, onomatopoeia) | 6 | 89 | tracks |
| C | 6 | **6** | all 8 types | 7 | 107 | tracks |
| D | (none) | 4 | 4-type set (2) | 5 | 82 | band → 4, **unchanged** |

Structural signals now scale monotonically with grade: `availableTypes` widens
(2 → 7 → 8), embedded-instance count rises (4 → 6 → 7), and passage length grows
(53 → 89 → 107 words). The no-grade control (probe D) still lands on the mid rung
`'4'`, byte-behaviourally identical to before — no regression on free-form lessons.

## Leak check

No answer leak introduced. The fix only selects the grade key; the passage and
figurative instances are still LLM-authored and the neutral-title rule is untouched.
The echoed `gradeLevel` field now wraps genuinely grade-differentiated content
(not a constant), so it reports real state rather than masking a pinned value.
