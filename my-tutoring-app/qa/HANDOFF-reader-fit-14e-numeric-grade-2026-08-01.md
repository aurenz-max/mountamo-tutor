# HANDOFF — reader-fit 14e: numeric Grade-1 generator-boundary dead band (P0, systemic)

Written by `/pm` 2026-08-01 after a line-exact read of the target function. Owning queue:
`my-tutoring-app/qa/reader-fit/BACKLOG.md` item **14e** (TOP of the §14 pull order — 14f/14h/14i/14k
are all gated on this landing first). Executor: `/topic-fidelity` (+ `/topic-trace` for the replay).

## Paste-able prompt

> The 2026-08-01 EMERGING census (`qa/topic-traces/g1-*-2026-08-01.md`, 6 topics, 42 components)
> found a systemic Grade-1 dead band at the generator boundary: the manifest correctly returns
> `Grade 1`/`1`, but `normalizeGradeLevel` collapses either numeric spelling to `elementary`, and
> topic-driven curator objectives never stamp `objectiveGrade`, so precise `ctx.grade` is absent
> downstream. Fix the boundary once (reader-fit BACKLOG item 14e), add a numeric-grade regression
> test, then replay the six census topics and record which downstream symptoms cleared. Read
> `qa/HANDOFF-reader-fit-14e-numeric-grade-2026-08-01.md` first.

## Line-exact anchors (verified 2026-08-01, HEAD `66b3cd8`)

- **The dead band:** `my-tutoring-app/src/components/lumina/service/geminiService.ts:30-37` —
  `normalizeGradeLevel` lowercases/kebabs the input and checks a `VALID_GRADES` set of NAMED bands
  only (`toddler … phd`). `'Grade 1'` → `'grade-1'` → not in set → `'elementary'`; `'1'` →
  `'elementary'`. Directly below, `getGradeLevelContext` (`:39-53`) renders `'elementary'` as
  *"elementary students (grades 1-5)"* — the exact "generic grades-1–5 prose" the census saw in
  media/DI/deep-dive/knowledge-check payloads.
- **Boundary consumers:** `geminiService.ts:145` and
  `service/manifest/practice-content-hydrator.ts:109,142,181` call `normalizeGradeLevel` on
  `manifest.gradeLevel`.
- **The canonical parser (route through it, do NOT write a second one):**
  `service/generation/resolveGenerationContext.ts:38` `normalizeObjectiveGrade`, consumed at `:86`
  from `config.objectiveGrade`. `App.tsx:292` records the doctrine: *"the ONLY grade parser is
  normalizeObjectiveGrade downstream."* The 2026-07-15 grade-fidelity close-out shipped exactly
  this rule — a fix here that adds an ad-hoc numeric parser regresses that close-out.

## The two halves (both likely needed; decide after reading, not by default)

1. **Stamp `objectiveGrade` on topic-driven curator objectives** so `ctx.grade` resolves through
   the canonical parser. This is the half that restores a PRECISE grade (grade = ceiling, per the
   scope-context contract); band prose alone cannot express "Grade 1".
2. **Make `normalizeGradeLevel` numeric-aware** — a numeric grade should land a real band instead
   of silently defaulting. Note the band enum is consumed widely (hydrator, prompt prose); check
   consumers before changing RETURN values vs. mapping numerics into the existing enum.

## Census fallout to replay against (the acceptance evidence)

`phonics-blender` + `word-sorter` stamp K; `sentence-analyzer` stamps 4; `hundreds-chart` stamps 2
in both draws; `fast-fact` stamps 3–5; media/DI/deep-dive/knowledge-check payloads carry generic
grades-1–5 prose. After the fix, re-run at least two of the six census topics via `/topic-trace`
(suggest `g1-count-forward-to-120` — it also feeds 14h/14i/14k — and `g1-silent-e`) and diff the
grade stamps against the 2026-08-01 reports. **Do not fix 14f/14h/14i/14k symptoms in this slice**
— the point of 14e-first is to see which of them clear for free; they stay queued and get re-checked.

## Gates (verification doctrine applies — runtime, not tsc)

- `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` — 0 NEW vs baseline; plus
  `npm run typecheck:lumina` 0.
- New numeric-grade regression test in the vitest suite (`npm test`) — prove non-vacuity (revert
  the fix, the test fails).
- ≥2 real `/topic-trace` replays showing Grade-1 stamps where the census showed K/2/4/3–5.
- Report: `qa/topic-fidelity/` or `qa/topic-traces/` dated file; strike/update 14e in
  `qa/reader-fit/BACKLOG.md` with evidence; update WORKSTREAMS reader-fit "last touched" in the
  same slice.

## Collision discipline

A sibling session may be working **14b (coin-counter G1)** concurrently — do not touch
`CoinCounter.tsx` / `gemini-coin-counter.ts` / `docs/contracts/coin-counter.md`. Shared registers
(`qa/reader-fit/BACKLOG.md`, `WORKSTREAMS.md`, `EVAL_TRACKER.md`) change on disk mid-session:
re-read immediately before editing, commit your fix + your strike in one tight slice.
