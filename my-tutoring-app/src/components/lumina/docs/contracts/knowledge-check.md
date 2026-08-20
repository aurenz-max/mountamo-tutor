# Contract: knowledge-check

- **Derived:** 2026-08-02 · evidence window: eval/reader-fit reports 2026-06-07 →
  2026-07-14, Grade-1 census 2026-08-01, git log to `66b3cd8`
- **Component:** `primitives/KnowledgeCheck.tsx` plus
  `primitives/problem-primitives/*` · **Generator:**
  `service/knowledge-check/gemini-knowledge-check.ts` +
  `gemini-knowledge-check-orchestrator.ts` · **Oracle:**
  `service/qa/oracles/knowledge-check.ts` · **Catalog:**
  `service/manifest/catalog/assessment.ts:11`
- **Status:** ACTIVE (C1 and C2 resolved by band/task gates; no open conflict)

## Consumers (blast radius)

Knowledge-check is a cross-cutting assessment carrier rather than a subject-specific
primitive. Its curriculum identity comes from the content and per-problem objective
attribution. In the 2026-08-01 Grade-1 census it was the most-routed primitive:
**6/42 generated components, in every lesson**.

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K/PRE final checks across topic families (`recall` / `apply`) | K reader-fit census + live tutor | `qa/reader-fit/knowledge-check-PRE-2026-07-14.md`; `qa/tutor-reports/knowledge-check-live-lesson-2026-07-14.md` | 2026-07-14 |
| G1 visual interpretation — neighborhood map symbols/key (`mixed`) | Grade-1 census | `qa/topic-traces/g1-map-legends-2026-08-01.md` | 2026-08-01 |
| G1 listening/impact analysis — invention narration with promised picture support (`analyze`) | Grade-1 census | `qa/topic-traces/g1-invention-listening-2026-08-01.md` | 2026-08-01 |
| G1 decoding — silent-e/CVCe (`mixed`) | Grade-1 census | `qa/topic-traces/g1-silent-e-2026-08-01.md` | 2026-08-01 |
| G1 grammar — common nouns (`mixed`) | Grade-1 census | `qa/topic-traces/g1-common-nouns-2026-08-01.md` | 2026-08-01 |
| G1 number sequence through 120 (`mixed`) | Grade-1 census | `qa/topic-traces/g1-count-forward-to-120-2026-08-01.md` | 2026-08-01 |
| G1 identical-coin totals through 30¢ (`recall|apply`) | Grade-1 census | `qa/topic-traces/g1-identical-coins-2026-08-01.md` | 2026-08-01 |
| Cross-objective final assessment | manifest flatten + registry + evaluation pipeline | `service/manifest/flattenManifest.ts`; `service/registry/generators/coreGenerators.ts` | 2026-08-01 |
| Content-driven curriculum attribution | held-out Grade-1 fit probe | `qa/curriculum-fit/knowledge-check-2026-06-07.md` (14/14 in-scope topic families found the correct family once subject-scoped) | 2026-06-07 |

**Live contract channels:** the derivation began from the saved six-topic census because
localhost was unavailable. Post-edit, the real app/model channel supplied targeted
`/eval-test` probes and two full `/topic-trace` replays; see
`qa/reader-fit/knowledge-check-14f-2026-08-02.md`. The authored map is not a complete forward
index for this cross-cutting primitive because its consumers are selected emergently by the
manifest.

## Requirements

### R1 — answer-bearing fields resolve to rendered choices · OBSERVED
- **Property:** every MCQ `correctOptionId` names one rendered option; every matching
  mapping and categorization key resolves to a rendered item/category. Duplicate visible
  choices never create ambiguous identity.
- **Demanded by:** every subject/band consumer.
- **Evidence:** `service/qa/oracles/knowledge-check.ts`; EVAL_TRACKER SP-25 precedent.
- **Probe:** run the knowledge-check oracle over every generated set; require zero
  `answer-key-desync` and `schema` violations. For MCQ, recompute
  `options.some(o => o.id === correctOptionId)`.

### R2 — K/PRE is picture-primary, spoken, and type-floored · OBSERVED
- **Property:** at toddler/preschool/kindergarten, every MCQ option carries an emoji;
  MCQ renders picture-primary with tap=choose, auto-read/replay, and no adult chrome;
  generated types are limited to `multiple_choice` / `true_false`. The tutor reads the
  question and every MCQ choice without leaking the answer.
- **Demanded by:** the K/PRE final-check consumer.
- **Evidence:** `qa/reader-fit/knowledge-check-PRE-2026-07-14.md`; live lesson 3/3 in
  `qa/tutor-reports/knowledge-check-live-lesson-2026-07-14.md`; oracle checks
  `option-modality` + `reader-fit`.
- **Probe:** eval-test at kindergarten for recall + apply; all types MCQ/TF, every MCQ
  option has emoji, oracle clean. Run `MultipleChoiceProblem.reader-fit.test.tsx` and
  the saved live tutor journey when tutor/catalog behavior changes.

### R3 — grade governs realization; Bloom governs thinking kind · OBSERVED
- **Property:** higher Bloom tiers never raise vocabulary, sentence/clause load,
  scenario complexity, concepts-per-problem, or option count above the learner's grade.
  The `recall → apply → analyze → evaluate` ladder remains available; grade does not
  ceiling away a valid cognitive move.
- **Demanded by:** all early-grade consumers, especially the Grade-1 `analyze` invention
  check.
- **Evidence:** KC-1/KC-2 and `qa/eval-reports/knowledge-check-2026-07-02.md`.
- **Probe:** generate `analyze` and `evaluate` at Grade 1 plus an upper-elementary
  control. Grade 1 must keep one concept, short single-clause stems, short distractors,
  and no more than four options while still requiring the pinned cognitive move.

### R4 — eval-mode task identity reaches both planning stages · OBSERVED
- **Property:** single pins and blends normalize safely; `recall`, `apply`, `analyze`,
  and `evaluate` change the cognitive task identity in both the orchestrator brief and
  per-problem prompt. `mixed` remains an open, diverse plan rather than an invalid tier
  lookup.
- **Demanded by:** all six Grade-1 consumers (`mixed`, `analyze`, and `recall|apply` all
  appeared) plus calibrated items.
- **Evidence:** catalog eval modes; `normalizeBloomsTier`; KC-1/KC-2; six-topic census.
- **Probe:** eval-test every single mode plus `mixed` and `recall|apply`; require no
  dispatch error, requested single-mode cognitive identity honored, and sets of 3+
  retain at least two completable problem types unless a per-problem band/task gate is
  required.

### R5 — a visual task assesses the rendered visual, not its prose description · OBSERVED
- **Property:** when the objective/intent makes a map symbol, coin, picture, shape,
  color, diagram, or before/after visual the evidence source, the generated problem
  renders that evidence and the question is answerable by inspecting it. It must not
  replace the picture with text such as “a green tree icon.” Non-visual topics may stay
  text-primary.
- **Demanded by:** G1 map-symbol (`mixed`) and invention-listening (`analyze`) consumers.
- **Evidence:** `qa/topic-traces/g1-map-legends-2026-08-01.md` and
  `g1-invention-listening-2026-08-01.md` (both failed this property); the problem
  components already render `visual`/`inset` evidence above the task.
- **Probe:** eval-test Grade-1 map-symbol `mixed` and invention `analyze`; at least one
  problem in each set must carry rendered visual data, refer to that visible evidence,
  and remain answerable without decoding a prose description of the picture.

### R6 — MCQ/TF voice control keeps one viewport-gated mic · OBSERVED
- **Property:** only the active, unanswered, in-view MCQ/TF may arm voice; non-sayable
  MCQ options (KaTeX/numbers/symbols) do not arm. Tap/click remains available.
- **Demanded by:** committed knowledge-check voice pilot.
- **Evidence:** `KnowledgeCheck.tsx` `activeVoiceEligible`; MCQ/TF voice hooks;
  HUMAN-CHECKS #11/#44.
- **Probe:** existing voice unit tests/typecheck plus HUMAN-CHECKS #11/#44 for the real
  mic/viewport loop. Generator-only edits must leave component voice plumbing untouched.

### R7 — composite evaluation ids complete the K stage · OBSERVED
- **Property:** problem N submits under `${instanceId}::pN`; a knowledge-check section is
  complete only after all expected prefixed ids report. The container's fallback
  `instanceId` remains memoized.
- **Demanded by:** `KindergartenStage` and all multi-problem assessment consumers.
- **Evidence:** `KnowledgeCheck.tsx` per-problem stamp and `KindergartenStage.tsx`
  prefix/count gate.
- **Probe:** component test a two-problem check: emitted ids are `kc::p0`, `kc::p1`, and
  the stage gate stays locked after one result then unlocks after two.

### R8 — final assessment preserves precise grade and per-objective attribution · OBSERVED
- **Property:** final-assessment config carries `objectiveGrade` plus every lesson
  objective's id/text/subskill/skill/grade; the registry passes the lesson objectives to
  the KC orchestrator; the selected `objectiveId` is validated and its curriculum ids are
  stamped on the generated problem. The KC subject guess, when valid, is stamped too.
- **Demanded by:** cross-objective lesson-final assessments and submission attribution.
- **Evidence:** `flattenManifest.ts`, `coreGenerators.ts`, orchestrator validation,
  `flattenManifest.test.ts`, and the 14e handoff.
- **Probe:** flatten a numeric Grade-1 final assessment with two objectives, resolve its
  generation context, and assert `ctx.grade==='1'`; generated problems may name only the
  supplied objective ids and retain the matching subskill/skill ids.

### R9 — rich evidence and question are generated atomically · OBSERVED
- **Property:** whenever an inset/visual is planned, its schema is included in the same
  structured generation call and the question explicitly depends on it; missing required
  evidence is rejected rather than silently described or replaced with an unrelated
  fallback.
- **Demanded by:** every inset/visual consumer.
- **Evidence:** `injectInsetIntoSchema`, `buildInsetPrompt`, `extractInset`; the two G1
  modality failures show why prompt-only promises are insufficient.
- **Probe:** for every problem with planned evidence, assert the emitted `visual`/`inset`
  is present and structurally non-empty before accepting it; question/evidence coherence
  remains an eval-test semantic judgment.

## Conflicts

### C1 — R2 K picture primacy vs R3 Grade-1 independent reading — RESOLVED via band + task gate (2026-08-02)
Both consumers are right. K needs picture-primary MCQ and read-aloud everywhere; a Grade-1
reader should read short sentences and must not inherit the entire K surface. The ruling is:
use precise Grade 1 to cap reading load, and attach visual support only when the assessed
task is inherently visual. Do not widen `preReader`, the K type floor, or K chrome rules to
all Grade-1 problems.

### C2 — R4 mixed-type diversity vs R5 visual evidence — RESOLVED per problem (2026-08-02)
Mixed checks need task diversity, while a visual objective cannot be honestly assessed by a
text-only matching/description task. The ruling is per planned problem: a problem whose
evidence is inherently visual uses a visual-capable task/schema; sibling non-visual problems
keep the normal mixed palette. Do not flatten an entire Grade-1 mixed set merely because one
problem needs a picture.

## Gap requirements (close matches — the improvement queue)

### G1 — precise Grade-1 reading-load gate · BUILT 2026-08-02
- **Near-consumer:** all six Grade-1 census lessons; severe in invention `analyze`.
- **Resolution:** the registry now passes canonical `ctx.grade`; Grade 1 has hard prompt and
  response-schema bounds for stems/options and every non-MCQ problem shape. Live `analyze`
  retained comparison thinking with a 13-word stem and four short options.
- **Path:** generator grade consumption → `/eval-fix` + `/reader-fit --fix`.
- **Relation to R-series:** repairs R3 under C1; no tier ceiling.

### G2 — schema-backed visual support for visual Grade-1 tasks · BUILT 2026-08-02
- **Near-consumer:** map-symbol `mixed` and invention `analyze` census failures.
- **Resolution:** the plan carries one of two bounded existing visual types; the MCQ schema
  atomically requires flat visual fields and reconstructs `ObjectCollection` or
  `ComparisonPanel`, rejecting omitted evidence. A code-owned Grade-1 task gate catches
  visual topics and the prior text-column matching failure without flattening nonvisual
  siblings. K continues to use its separate emoji-option surface.
- **Path:** reuse bounded existing visual primitives in the orchestrator and per-question
  schema, with a visual-task gate → `/eval-fix`; avoid a free-form image URL/base64 field.
- **Relation to R-series:** builds R5/R9 under C1/C2.

### G3 — true/false PRE surface parity · OPEN
- **Near-consumer:** K/PRE `true_false`, already allowed by the type floor.
- **Shortfall:** the container forwards PRE props but TrueFalseProblem still lacks the MCQ
  picture/read-aloud/chrome branch.
- **Path:** component band gate → `/reader-fit --fix`.
- **Relation to R-series:** completes R2; explicitly outside reader-fit 14f.

## Catalog projection

- **description:** materially faithful as a broad type inventory, but “scenario, short
  answer” are listed while the live orchestrator palette does not plan them. No edit in this
  derivation; changing catalog prose can re-route lessons.
- **constraints:** “Typically one per exhibit, at the end” is faithful.
- **evalModes:** cognitive identities are faithful. `analyze`/`evaluate` descriptions mention
  long/multi-step/4–5-option realizations without stating the grade-precedence rule captured
  by R3. Keep code-side grade precedence; a future projection may sharpen the prose after
  runtime verification.

## Changelog

- 2026-08-02 — derived (initial) as reader-fit 14f's required contract-first step.
  9 requirements, 2 conflicts resolved by band/task gates, 3 gaps (G1/G2 queued in 14f;
  G3 remains the separate PRE true/false follow-up).
- 2026-08-02 — reader-fit 14f implemented. G1/G2 built; `/primitive-contract --check`
  **COMPATIBLE**. Real-Gemini `analyze` G1, map `mixed`, and K regression passed; both failing
  census topics replayed clean. G3 remains open and out of scope.
- 2026-08-18 — categorization surface: drag-batch → MICROSTEP (one item at a time, tap the
  group, per-item verdict; one tap per item, missed items land in the correct group marked ✗).
  Aggregate submission byte-compatible (`CategorizationActivityMetrics`, single submit), so
  R1/R7/R8 hold unchanged; R4's completability improves (no HTML5 drag → works on touch).
  Manual R-sweep only, no `--check` run; jsdom pins in
  `CategorizationActivityProblem.microstep.test.tsx`, browser walk = HUMAN-CHECKS #109.
  Plan of record incl. the slice-2 judged-loop port: `qa/di/BACKLOG.md` item 23.
