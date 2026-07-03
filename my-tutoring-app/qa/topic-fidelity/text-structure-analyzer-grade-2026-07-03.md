# Topic-Fidelity (--grade) — text-structure-analyzer — 2026-07-03

**Generator:** `my-tutoring-app/src/components/lumina/service/literacy/gemini-text-structure-analyzer.ts`
**Modality:** `/topic-fidelity --grade`
**Verdict:** FIDELITY_BUG_FIXED
**Mechanism:** parse-and-fallback (grade pinned constant at `'4'`)

## The bug

Lines 407-409 read the grade from `ctx.gradeContext` (a PROSE sentence) and matched it
against `['2','3','4','5','6']`:

```ts
const gradeLevel = ctx.gradeContext;
const gradeLevelKey = ['2','3','4','5','6'].includes(gradeLevel) ? gradeLevel : '4';
```

The prose string never matches a bare digit, so `gradeLevelKey` was ALWAYS `'4'`. Every
grade produced the grade-4 band: `gradeNotes['4']`, `structuresByGrade['4']` (all 5
structures), 6-7 sentences, 2-3 regions. `ctx.grade` (the canonical parsed grade) was never
read.

Grade ladder: **2-6** (`gradeNotes` / `structuresByGrade` define rungs 2,3,4,5,6).
TOP_RUNG=6, MID/band-fallback=4, floor=2 (K/1 clamp to floor).

## The fix

Mirrors gemini-poetry-lab.ts / gemini-decodable-reader.ts: read `ctx.grade` against the real
ladder, clamp above-ceiling numeric grades to `'6'`, fall back to `'2'` for kindergarten/
preschool band and `'4'` otherwise. Removed the dead `const gradeLevel = ctx.gradeContext`.
Schema, eval-mode axis, and support-tier axes unchanged.

## Probe table (topic = "why leaves change color", evalMode requested = chronological)

| probe | grade | structureType | sents | words | signal | keyIdeas | regions | authorPurpose | field.gradeLevel |
|-------|-------|---------------|-------|-------|--------|----------|---------|---------------|------------------|
| BEFORE | 2 | cause-effect *(illegal @G2)* | 6 | 64 | 5 | 6 | 2 | no | **4** |
| BEFORE | 3 | cause-effect | 6 | 69 | 5 | 5 | 2 | no | **4** |
| BEFORE | 5 | problem-solution | 6 | 82 | 5 | 5 | 2 | yes | **4** |
| BEFORE | none | problem-solution | 6 | 94 | 4 | 5 | 2 | no | **4** |
| AFTER | 2 | chronological *(G2-legal)* | 4 | 30 | 4 | 4 | 2 | no | **2** |
| AFTER | 3 | cause-effect | 5 | 55 | 5 | 4 | 2 | no | **3** |
| AFTER | 5 | cause-effect | 7 | 94 | 6 | 5 | 2 | yes | **5** |
| AFTER | none | problem-solution | 6 | 81 | 5 | 5 | 2 | no | **4** (band control — unchanged) |

## Evidence

- **BEFORE:** `field.gradeLevel` constant at `4` for all grade params; sentences constant at 6;
  grade 2 emitted `cause-effect`, which is NOT in `structuresByGrade['2']` (chronological/
  description only) — direct proof the `'4'` fallback drove availableStructures.
- **AFTER:** grade tracks the param (2→3→5). Word count scales 30→55→94; sentences 4→5→7;
  grade 2 now emits a grade-2-legal `chronological` structure; `authorPurposeExplanation`
  appears only at grade 5 (the grade-5/6 rung feature). Band control (no `&grade=`) stays at
  the mid rung `4` — no regression.
- No answer leak introduced: only grade resolution changed; the neutral-title/no-answer-in-
  focus rules and schema are untouched.
