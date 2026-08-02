# Topic Fidelity: numeric grade generator boundary — 2026-08-01

Reader-fit item: **14e**. Scope: the shared manifest-to-generator boundary only; no
primitive-local fixes from 14f/14h/14i/14k are included.

## Verdict

**FIDELITY BUG → fixed.** Topic-driven Grade-1 lessons now stamp the manifest's raw
`Grade 1`/`1` spelling into each component's `objectiveGrade`; the canonical
`normalizeObjectiveGrade` parser resolves it to `ctx.grade === '1'`. Numeric inputs
also map through that same parser into the existing prompt bands instead of reaching
the unknown-input fallback.

## Mechanism and change

- `flattenManifestToLayout` previously sourced `objectiveGrade` only from curriculum-launched
  objectives. Curator-authored objectives have no grade field, so `ctx.grade` was absent.
- `normalizeGradeLevel` recognized named bands only. It now calls the exported canonical
  `normalizeObjectiveGrade` and maps K/1–5/6–8/9–12 into the existing band enum.
- Final assessments receive the same lesson-uniform `objectiveGrade`, including the
  `lessonObjectives` entries used by knowledge-check orchestration.
- No second grade parser and no new return values were introduced.

## Non-vacuous regression

Before the implementation, the new focused tests failed in six assertions: the topic-driven
component had no `objectiveGrade`, and K/6/8/9/12 numeric spellings fell to `elementary`.
After the implementation, the focused suite passed **41/41**. The production-path test also
asserts `Grade 1` stamped by the flatten resolves to `ctx.grade === '1'`.

## Real topic-trace replays

Both replays used the live curator → manifest → generator route with
`gradeLevel=Grade 1` on 2026-08-01.

| Topic | Components | Boundary result | Census symptom re-check |
|---|---:|---|---|
| Count forward within 120 | 7 | 7/7 generator inputs stamped `objectiveGrade: Grade 1` | `number-sequencer` and `foundation-explorer` emit grade 1; `hundreds-chart` still emits 2 and DI still emits generic grades 1–5 prose |
| Silent-e long vowels | 8 | 8/8 generator inputs stamped `objectiveGrade: Grade 1` | `phonics-blender` K → **1**; `word-sorter`, comparison panel, reader, and foundation explorer emit 1; DI generic prose and spelling-pattern-explorer's Grade 2 remain local follow-ups |

The boundary cleared the `phonics-blender` symptom for free and proved precise grade is now
available to every replayed generator. Remaining hardcoded or prose-only symptoms stay in their
existing primitive/workstream items; they are not part of 14e.

## Verification

- `npm test`: **100 files, 1,076 tests passed** (shared workspace final state).
- `npm run typecheck:lumina`: **0 errors**.
- `tsc --noEmit`: **803 error lines before and after**, all pre-existing; **0** in touched files.
- Runtime: two real `/topic-trace` replays, **15/15** generated items with a Grade-1 objective stamp.
