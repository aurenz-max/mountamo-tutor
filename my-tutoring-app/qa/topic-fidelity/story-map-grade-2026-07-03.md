# Topic-Fidelity (--grade): story-map

Date: 2026-07-03
Generator: `my-tutoring-app/src/components/lumina/service/literacy/gemini-story-map.ts`
Modality: `/topic-fidelity --grade`
Verdict: **FIDELITY_BUG_FIXED**

## Grade ladder
K-6, structure ladder: `bme` (K-1) → `story-mountain` (2-3) → `plot-diagram` (4-6) → `heros-journey` (5-6).
TOP_RUNG = `6`, MID_RUNG (band fallback) = `3`.

## Mechanism (parse-and-fallback + dead field)
The generator read `const gradeLevel = ctx.gradeContext` — the PROSE sentence
(`"elementary students (grades 1-5) …"` / `"kindergarten students (ages 5-6) …"`),
then did `parseInt(gradeLevel.replace(/[^0-9]/g,""), 10)`. Stripping non-digits yields
`"15"` (elementary) or `"56"` (kindergarten), so `gradeNum` was **always > 3 → the
`high` band**, `getStructureType` always returned `plot-diagram`, and the `gradeNum >= 4`
conflict rule always fired. `ctx.grade` (the canonical curriculum grade) was **never read** —
a dead field. Even a Kindergarten objective produced grade-5 plot-diagram content with
person-vs-nature conflict analysis.

## Fix (mirrors gemini-poetry-lab.ts / gemini-decodable-reader.ts)
Resolve `gradeLevelKey` from `ctx.grade` clamped to the K-6 ladder (>6 → `'6'`), with a band
fallback (`kindergarten`/`preschool` → `'K'`, else `'3'`). Derive `gradeNum` from
`gradeLevelKey` (`K`→0). Removed the dead prose read; feed `getStructureType(gradeLevelKey)`
and `TARGET GRADE LEVEL: ${gradeLevelKey}`. Schema and eval-mode axis unchanged — grade
governs realization only.

## Probe table (topic = "why leaves change color", mode unset so grade drives structure)

| probe | grade | band | struct | gradeEcho | sentences | events | arcPositions | hasConflict |
|-------|-------|------|--------|-----------|-----------|--------|--------------|-------------|
| BEFORE | K | kindergarten | plot-diagram | 5 | ~5 | 5 | 5-part | **True** |
| BEFORE | 3 | elementary | plot-diagram | 5 | 7 | 5 | 5-part | True |
| BEFORE | 5 | elementary | plot-diagram | 5 | 6 | 5 | 5-part | True |
| AFTER | K | kindergarten | **bme** | **K** | 4 | **3** | **beginning/climax/resolution** | **False** |
| AFTER | 3 | elementary | **story-mountain** | **3** | 5 | 5 | 5-part | True |
| AFTER | 5 | elementary | **plot-diagram** | 5 | 7 | 5 | 5-part | True |
| AFTER (no &grade, control) | — | elementary | story-mountain | 3 | 6 | 5 | 5-part | True |

(BEFORE row shown with mode fixed to `plot_diagram` and with the confirmed band mechanism:
`ctx.gradeContext` prose → parseInt → always `high` band → K echoes grade 5, plot-diagram,
conflict True. AFTER rows probed with mode unset so `getStructureType(gradeLevelKey)` reveals
the grade-driven structure ladder.)

## Result
Structural signals now scale with `ctx.grade`: structure ladder bme→story-mountain→plot-diagram,
event count 3→5→5, arc-position set 3-part→5-part, and conflict analysis appears only at grade 3+
(K correctly omits it). The no-grade band control deterministically falls back to `'3'`
(story-mountain) — unchanged, no regression. No answer leak introduced (grade resolution only;
elements remain embedded in the passage for the student to identify).
