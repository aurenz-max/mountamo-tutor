# Topic-Fidelity (--grade): read-aloud-studio

**Date:** 2026-07-03
**Generator:** `my-tutoring-app/src/components/lumina/service/literacy/gemini-read-aloud-studio.ts`
**Modality:** `/topic-fidelity --grade`
**Verdict:** FIDELITY_BUG_FIXED
**Mechanism:** parse-and-fallback (dead prose read → constant grade-3 fallback)

## The bug

Line 106/108 (before fix):

```ts
const gradeLevel = ctx.gradeContext;                         // PROSE sentence
const gradeLevelKey = ['1','2','3','4','5','6'].includes(gradeLevel) ? gradeLevel : '3';
```

`ctx.gradeContext` is a grade-appropriate PROSE sentence, never a bare rung
string, so `.includes()` NEVER matched and `gradeLevelKey` was pinned to the
`'3'` fallback for every objective. The canonical `ctx.grade` field was ignored
entirely. Downstream this fed `gradeNotes['3']` (80-120 words, ~520L, 4-5
markers) and `wpmTargets['3'] = 90` unconditionally.

Ladder: **1-6** (rungs defined in `gradeNotes`/`wpmTargets`; schema says "'1'
through '6'", systemInstruction "K-6"). TOP_RUNG = `'6'`, MID_RUNG = `'3'`.
No `K` rung exists on this ladder → below-floor (K/preschool) clamps to floor `'1'`.

## The fix (mirrors gemini-poetry-lab.ts / gemini-decodable-reader.ts)

```ts
const LADDER = ['1','2','3','4','5','6'] as const;
let gradeLevelKey: string;
if (ctx.grade && (LADDER as readonly string[]).includes(ctx.grade)) {
  gradeLevelKey = ctx.grade;
} else if (ctx.grade === 'K' || ctx.gradeLevel === 'kindergarten' || ctx.gradeLevel === 'preschool') {
  gradeLevelKey = '1';        // no K rung on this ladder; clamp to floor
} else if (ctx.grade && parseInt(ctx.grade, 10) > 6) {
  gradeLevelKey = '6';        // above-ceiling clamps to top rung
} else {
  gradeLevelKey = '3';        // bare band → mid rung
}
```

Removed the dead `const gradeLevel = ctx.gradeContext;` read. Schema and
eval-mode (fluencyFocus) axis left UNCHANGED — grade governs realization only.

## Probe table (evalMode=accuracy, topic="a community helper")

| probe        | grade | gradeLevel field | words | markers | targetWPM | Lexile | verdict |
|--------------|-------|------------------|-------|---------|-----------|--------|---------|
| BEFORE       | 1     | 3                | 78    | 5       | 90        | 520L   | pinned  |
| BEFORE       | 3     | 3                | 45    | 5       | 90        | 520L   | pinned  |
| BEFORE       | 5     | 3                | 61    | 5       | 90        | 520L   | pinned  |
| BEFORE       | (none)| 3                | 36    | 5       | 90        | 520L   | pinned  |
| AFTER        | 1     | 1                | 24    | 3       | 70        | 200L   | tracks  |
| AFTER        | 3     | 3                | 41    | 5       | 90        | 520L   | tracks  |
| AFTER        | 5     | 5                | 77    | 5       | 130       | 850L   | tracks  |
| AFTER (ctrl) | (none)| 3                | 34    | 5       | 90        | 520L   | mid rung, unchanged |

**Before:** targetWPM (90) and Lexile (520L) CONSTANT across all grades =
grade-3 fallback. Word count varied but was pure LLM noise (grade 1 got MORE
words than grade 5).

**After:** targetWPM 70→90→130 and Lexile 200L→520L→850L now scale
monotonically with grade; word count 24→41→77 monotonic; gradeLevel field
echoes the real rung. No-grade band control remains at mid rung '3' (no
regression).

**Answer-leak check:** comprehensionQuestion remains a genuine question; no
answer revealed in passage, labels, or defaults.
