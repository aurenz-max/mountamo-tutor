# Topic Fidelity (--grade): foundation-explorer — 2026-07-15

Axis under test: the objective's canonical curriculum grade (`ctx.grade`) → the
primitive's pre-reader (K) render. Trigger for the audit: student hit
foundation-explorer inside a Kindergarten-stage daily session, but it rendered the
STANDARD two-column layout instead of the picture-primary K render.

## Generator probes (eval-test, config.objectiveGrade → data.gradeLevel)

| Probe | grade | data.gradeLevel out | mode | verdict |
|-------|-------|---------------------|------|---------|
| honored        | K | `'K'` + optionEmojis present | PRE (picture-primary) | HONORED |
| discrimination | 2 | `'2'`, no emojis             | standard | tracks |
| no-regression  | (absent) | `None`                | standard (band default) | correct |

**Generator verdict: HONORED.** When `config.objectiveGrade='K'` reaches it, the
generator (`resolvePreReaderGradeKey` → `data.gradeLevel`) correctly produces the K
render. This is NOT a generator fidelity bug.

## Real defect: grade dropped UPSTREAM at the manifest flatten join

The `grade=` (absent) probe reproduces the exact broken production state
(`data.gradeLevel = None` → standard). So the question was never "does the generator
honor grade" — it was "does grade arrive." It doesn't, on the daily-session path:

- The manifest schema (`gemini-manifest.ts`) instructs the LLM to emit SYNTHETIC
  `objectiveId`s (`'obj1'`, `'obj2'`) and never surfaces the real objective ids.
- The daily session replaces objectives with `id: subskill_id` (`App.tsx`), which
  carry the real `grade` (`planGrade`).
- `flattenManifestToLayout` joins `objectiveById.get(block.objectiveId)` — `'obj1'`
  vs `subskill_id` → MISS → `auth` undefined → `grade` (and subskillId/skillId)
  drop to undefined in config.
- subskillId/skillId are rescued at render from `EvaluationContext`
  (`ManifestOrderRenderer`, "config IDs may be hallucinated"). **Grade had no such
  rescue** → `ctx.grade` undefined → `data.gradeLevel` unset → standard render, even
  while the session ran on the Kindergarten stage (which turns on off the band
  `gradeLevel`, a different signal).

Mechanism class: this is the grade analog of a broken contract link — grade reaches
the generator boundary as `undefined` because the id JOIN that carries it fails on
the curriculum-launched path. Not "dead field," not "constant fallback" — a dropped
JOIN key.

## Fix (single change, in the flatten)

`flattenManifest.ts`: a lesson-uniform grade fallback. A daily block is single-grade
by construction (App stamps one `planGrade` on every objective) and the join is
all-or-nothing, so recover grade from the first objective that carries one when the
synthetic-id join misses:

```
const lessonGrade = (objectives ?? []).find(o => o.grade)?.grade;
...
grade: auth?.grade ?? lessonGrade,
```

Delivers grade through the exact channel the generator already consumes
(`config.objectiveGrade` → `ctx.grade`). subskill/skill IDs are deliberately NOT
recovered this way (per-component; already rescued authoritatively at render).

- tsc: 808 total (baseline 808), 0 in flattenManifest.ts.
- Tests: `flattenManifest.test.ts` — 6/6 pass, incl. new
  "recovers the lesson grade when the manifest uses synthetic objectiveIds" and
  "leaves grade undefined ... (brief path)" (no-regression).
- Generator probes re-confirmed HONORED (above).

## Verification status

- Generator side: exercised at runtime (eval-test probes). ✓
- Flatten side: exercised via unit test with the daily-session-shaped input. ✓
- **Live daily session end-to-end: NOT browser-verified here** (needs a real plan
  doc with `grade_level='K'` + a K student). Filed as HUMAN-CHECK.

## Follow-up (out of scope, noted)

The same failing JOIN means skill-scoped misconception matching
(`misconceptionMatchesComponent` needs `auth.skillId`) is also blind on the
curriculum-launched path — worth a broader "make the manifest objectiveId join
reliable" fix (surface real ids to the LLM, or positional fallback), which would fix
grade, skill-scoped remediation, and config attribution together. Not done here;
this change is the tight grade fix only.
