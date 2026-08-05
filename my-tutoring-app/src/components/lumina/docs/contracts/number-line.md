# Contract: number-line

- **Derived:** 2026-08-03 · evidence window: G1 census 2026-08-01 + eval-reports 2026-03-17→2026-06-27 + authored map (live backend) + git to 2026-03
- **Component:** `primitives/visual-primitives/math/NumberLine.tsx` · **Generator:** `service/math/gemini-number-line.ts` · **Catalog:** `service/manifest/catalog/math.ts:104`
- **Status:** COMPATIBLE (C1 RESOLVED 2026-08-04 by the scoped Grade-1 magnitude + exact-between fork)

Derived as the contract-first step of reader-fit **14m** (systemic grade-resolver pilot).
Channel [4] (calibration) unavailable this run (`/api/calibration/items` → Not authenticated —
same limitation as the coin-counter 2026-07-25 run). Channel [1] = the saved 2026-08-01
G1 census (census of record; not re-run).

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| **8 authored subskills — ALL Grade 1** (only authored consumers): OPS001-03-a count-on ≤20 · OPS001-04-a count-back ≤20 · NBT001-01-a missing numbers ≤120 · NBT001-01-b count backward ≤120 · NBT001-04-b order two-digit · NBT001-05-d two-digit addition · NBT001-07-b subtract multiples of 10 on a linear scale · PTRN001-05-b doubles patterns | authored map [3] | `GET /api/curriculum/primitive-mappings/mathematics` (inverted 2026-08-03) | live |
| G1 EMERGING census — `between` @ NBT001-01-a (1/42 routes; the 14k failure) | census [1] | `qa/topic-traces/g1-count-forward-to-120-2026-08-01.md:3,13,38-41` | 2026-08-01 |
| G1–2 counting-back — resolver pins `jump` | trace [2] | `qa/topic-traces/subtraction-within-20-2026-06-14.md:16,50` | 2026-06-14 |
| K counting topics (identify + resolver-narrowed ranges) — synthetic only; **K census routed number-line 0/42** | eval [2] | `qa/eval-reports/number-line-2026-06-27.md` · `k-*-2026-07-14.md` (absent) | 2026-07-14 |
| G3–5 fractions/decimals band — catalog claim + G4 sweeps (synthetic; **unreachable in production**, see R2) | eval [2] | `qa/eval-reports/number-line-2026-06-20.md` · `evalmode-pin-health-2026-06-13.md:25` | 2026-06-20 |
| Adaptive session (θ-driven `plot` difficulty) | eval [2] | `qa/eval-reports/difficulty-sweep-rollout-2026-06-11.md:16-28` | 2026-06-11 |
| Personalization engine — number-line = the *harder* representation slot (struggling → number-sequencer); theme-neutral | trace [2] | `qa/topic-traces/personalization-ab-counting-2026-06-11.md:22,32` · `persona-voice-ab-counting-2026-06-11.md:39-41` | 2026-06-11 |
| Live tutor loop (gradeBand/range/mode context keys; `useLuminaAI gradeLevel`) | code + sweep [2] | `NumberLine.tsx:398-440` · `qa/tutor-reports/sweep-2026-07-08.json` (passing) | 2026-07-08 |

Real-usage channel [4]: unknown (auth), not zero.

## Requirements

### R1 — Topic/intent range resolution · OBSERVED
- **Property:** When the manifest omits `numberRange` (always — the catalog never emits it), the resolved range tracks topic+intent via `resolveTopicNumberRange` (micro-LLM, `gemini-number-line.ts:693-727`); scope only **narrows** the band default, never widens; `null`/failure → grade-band default with no regression. All targets ≤ the resolved ceiling in every mode.
- **Demanded by:** K/G1 counting topics; every scope-bounded objective (scope-audit class).
- **Evidence:** `qa/eval-reports/number-line-2026-06-27.md:3-6,22-38` (5/5); pre-resolver FAIL `qa/eval-reports/scope-audit-batch.md:10` ("Counting to 10" emitted max 20); reference-implementation status `qa/topic-fidelity/_RESWEEP-2026-06-28.md:42-45`.
- **Probe:** `GET /api/lumina/eval-test?componentId=number-line&evalMode=plot&topic=Counting%20to%205&grade=K` → every target ≤ 5; generic topic → band default, no error.

### R2 — Grade band from canonical grade · OBSERVED (violated until 2026-08-03; the 14m edit zone)
- **Property:** `data.gradeBand` derives from canonical `ctx.grade` when present (K/1/2 → `K-2`; 3+ → `3-5`); `ctx.gradeContext` prose is **fallback only**. The band drives: numberType (K-2 integer / 3-5 decimal), jump-size table (`[1..5]` vs `[2,3,5,7,10]`), order set size (3 vs 4), band default ranges, the K-2 clamp, the header badge, and the tutor `gradeLevel` handoff (`NumberLine.tsx:424`).
- **Demanded by:** all 8 authored G1 consumers (need K-2); G3-5 fraction/decimal topics (need 3-5, currently unreachable: every production prose sentence matches the old K-2 substring test — `"grades 1-5"` contains `1`, middle/high-school prose contains `k` in "thinking"; bare band keys like `elementary` invert to `3-5`).
- **Evidence:** defect `gemini-number-line.ts:890-893` + call sites `:905,1007,1132,1204,1429`; `ctx.grade` read nowhere (whole-file audit 2026-08-03); 14e replay did NOT clear it (`qa/topic-traces/g1-numeric-grade-14e-replay-2026-08-01.md:12-14`); class + template `qa/reader-fit/BACKLOG.md` 14m (calendar-explorer `423c58f`).
- **Probe:** eval-test `evalMode=plot&grade=1` → `gradeBand:"K-2"`; `grade=4` → `gradeBand:"3-5"` + decimal numberType; **no `grade` param** → legacy prose path unchanged.

### R3 — `identify` K floor is a pinned separate path · OBSERVED
- **Property:** `targetEvalMode:'identify'` bypasses band resolution entirely: `gradeBand='K-2'`, integers, range hard-pinned `{0,10}`, every tick labeled, pool `uniqueIntegerPool(0,10)` (`gemini-number-line.ts:904-914`). Semantically distinct from `plot` (β0.5 vs β1.5).
- **Demanded by:** K identify consumers (catalog `math.ts:144-150`).
- **Evidence:** `qa/eval-reports/number-line-2026-06-27.md:38`; `number-line-2026-05-19.md:17`; `number-line-2026-04-06.md:13`.
- **Probe:** eval-test `evalMode=identify&grade=K` → range `{0,10}`, integer targets only, `gradeBand:"K-2"` — must hold regardless of any grade/topic param.

### R4 — `jump` = operation-as-movement, arithmetically valid · OBSERVED
- **Property:** each `show_jump` challenge encodes a real operation (`start op size = landing`, recomputable); jump sizes come from the band table; landing stays in range; counting-back (subtraction) moves left with direction-signed labels. `jump` owns the counting-back-as-movement facet distinctly from `skip-counting-runner`/`math-fact-fluency`.
- **Demanded by:** OPS001-03-a, OPS001-04-a, NBT001-05-d, NBT001-07-b (all G1 authored); G1-2 counting-back trace.
- **Evidence:** `qa/topic-traces/subtraction-within-20-2026-06-14.md:16,50`; `qa/eval-reports/number-line-2026-05-19.md:18`; direction-sign lineage STP-5 `qa/EVAL_TRACKER.md:656`.
- **Probe:** eval-test `evalMode=jump&grade=1&topic=subtraction within 20` → recompute all ops; all K-2 sizes ∈ `[1..5]`; landings in range.

### R5 — `order` set shape · OBSERVED
- **Property:** order challenges give distinct values, 3 per set at K-2 / 4 at 3-5; `orderGap` structural lever (wide/mixed/clustered) reshapes spacing without leaving the range.
- **Demanded by:** NBT001-04-b (G1 authored); G4 structural sweep.
- **Evidence:** `gemini-number-line.ts:1134`; `qa/eval-reports/number-line-2026-06-20.md:10-15`.
- **Probe:** eval-test `evalMode=order&grade=1` → sets of 3 distinct in-range values.

### R6 — `between` accept shape (forked) · OBSERVED
- **Property:** one placed point. When `exactTargetValue` is absent, the legacy contract is unchanged: correct iff the point is strictly between the two endpoint `targetValues`. When a Grade-1 missing-number intent requests an exact value, the generator emits additive `exactTargetValue` metadata and adjacent bounds `[n-1,n+1]`; only `n` is correct. Structural `boundGap` reshapes legacy pairs only, so support tiers cannot destroy exact-task adjacency.
- **Demanded by:** legacy between consumers; NBT001-01-a missing-number-within-120; the hard-tier floor by the structural sweep.
- **Evidence:** `qa/eval-reports/number-line-2026-06-20.md:21`; `gemini-number-line.reader-fit-14k.test.ts`; `NumberLine.reader-fit-14k.test.tsx`; oracle `number-line.reader-fit-14k.test.ts`; browser artifact `qa/reader-fit/number-line-14k-reader-fit.png`.
- **Probe:** exact missing-number intent → four adjacent-bound challenges with exact targets in the requested focus window; ordinary `between` → no `exactTargetValue` and any representable interior point remains valid.

### R7 — Support-tier + structural-difficulty invariants · OBSERVED
- **Property:** absent/unknown `config.difficulty` → exact no-op (grade-band defaults stand). With a tier: scaffolds withdraw easy→hard (anchors count, `tickInterval` coarseness, `showJumpArc`); structural levers move (`labelPlacement` on→mid, `jumpSteps` 1→2 chained with landing-of-op1 = start-of-op2, `orderGap`, `boundGap`); **magnitude stays in band at every tier** (hard ≠ bigger numbers); anchors/highlights never equal a target (leak guard `buildAnchorsForChallenge`).
- **Demanded by:** support-tier + structural-difficulty campaigns; G1 "Number line to 20" sweep; adaptive θ path.
- **Evidence:** `qa/eval-reports/number-line-2026-06-14.md:14-28`; `number-line-2026-06-20.md:10-26`; `difficulty-sweep-rollout-2026-06-11.md:16-28` (θ ranges stay inside `modeRange ∩ scopeWindow ∩ difficultyBand`; scope caps the band).
- **Probe:** eval-test same mode ×3 (`difficulty=easy|hard|none`) → compare anchors/tickInterval/levers; assert max target ≈ equal across tiers; no-tier run byte-shape-compatible.

### R8 — Display-window span cap (NL-1/SP-2) · OBSERVED
- **Property:** for integer lines the target pool is drawn from a sub-window of span ≤ 25 (`createSubRangePool maxSpan:25`) regardless of the full authored domain, so tick labels stay legible; the component auto-zooms to that content window. Exact missing-number intents preferentially place this local window over their structured focus range while retaining the honest full domain (for example, 0-120).
- **Demanded by:** every large-range topic (0-1000 class).
- **Evidence:** `qa/EVAL_TRACKER.md:556,743` (NL-1); `qa/eval-reports/number-line-2026-04-03.md:14-17`.
- **Probe:** eval-test `evalMode=plot&topic=numbers to 1000&grade=4` → max(target)−min(target) ≤ 25.

### R9 — Pool distinctness across a session · OBSERVED
- **Property:** per mode, the generated challenge set has no duplicate targets/tuples/sets/pairs (in-code selection, not LLM); counts per mode: plot 5, jump 4, order 4, between 4.
- **Demanded by:** multi-challenge session shape (all consumers).
- **Evidence:** `qa/eval-reports/number-line-2026-05-19.md:16`; counts `gemini-number-line.ts:77-95`.
- **Probe:** any eval-test run → assert distinctness per mode.

### R10 — Theme/interest neutrality · OBSERVED
- **Property:** number-line content does not absorb persona/interest themes even when sibling primitives in the same lesson do.
- **Demanded by:** personalization engine (persona A/B).
- **Evidence:** `qa/topic-traces/persona-voice-ab-counting-2026-06-11.md:39-41`.
- **Probe:** persona-stamped lesson trace → number-line intents remain theme-free.

### R11 — Tutor context handoff · INFERRED (sweep-passing; drag-spam half unverified)
- **Property:** the catalog `contextKeys` (`math.ts:109`) resolve from `aiPrimitiveData` (`NumberLine.tsx:398-418`); `gradeBand` reaches the tutor both as a key and as `useLuminaAI gradeLevel`; transient drag/marker position is NOT streamed per-move (SP-12 names number-line "likely affected" — never probed).
- **Evidence:** `qa/tutor-reports/sweep-2026-07-08.json` (passing); SP-12 `qa/EVAL_TRACKER.md:250`; `qa/eval-reports/fraction-bar-state-spam-2026-03-29.md:85`.
- **Probe (when challenged):** `/tutor-test number-line` Tier 1-2; drag a marker continuously and count `updateContext` emissions.

### R12 — Harder-representation slot + `challenging` config · INFERRED
- **Property:** number-line is the harder representation in its objective slot (personalization swaps struggling students to number-sequencer); it must accept a `challenging`-difficulty config without leaving scope.
- **Evidence:** `qa/topic-traces/personalization-ab-counting-2026-06-11.md:22,32`.
- **Probe (when challenged):** eval-test with `difficulty=hard` + scope topic → in-scope, harder structure only.

## Conflicts

### C1 — G1 magnitude demand (≤120) vs K-2 legibility clamp (≤30) — **RESOLVED 2026-08-04**
The implementation takes the contract fork instead of deleting the protective K-2 clamp.
Ordinary K and K-2 consumers retain their existing ceiling. Only a canonical Grade-1
request with an explicit resolved domain above 30 and at most 120 may widen the full
domain, and it remains capped at 120. The structured resolver now separates full domain,
focus window, and exact-missing-number intent; the pool is preferentially drawn from the
focus while R8 keeps the rendered line local and legible. `exactTargetValue` is an
additive challenge property, so legacy `between` acceptance remains intact. Catalog and
tutor scaffolds now describe the visible-window strategy instead of redirecting Grade-1
learners to 0-20. This satisfies NBT001-01-a without changing unrelated K, legacy-between,
or 3-5 behavior.

## Catalog projection

- **description:** now distinguishes small fully labeled Kindergarten lines from readable local Grade-1 windows within an explicit 0-120 domain; the 3-5 negatives/fractions/operations claim remains intact.
- **constraints:** faithful ("Requires numeric range. Jump mode requires operations array.") — note the manifest never actually emits `numberRange`; the resolver supplies it (R1).
- **evalModes:** descriptions match task identities (identify/plot/jump/order/between); no deltas.
- **tutor projection:** context includes visible bounds and optional exact target; scaffolds count from a visible label and explain the auto-zoomed window without leaking the answer.

## Changelog

- 2026-08-03 — derived (initial), as contract-first step of reader-fit 14m. 12 requirements (10 OBSERVED, 2 INFERRED), 1 OPEN conflict (C1 → 14k). Channel [4] unavailable (auth).
- 2026-08-03 — R2 edit (14m pilot): canonical-grade-first band resolution shipped (`numberLineGradeBandFromGrade` + threading, prose fallback kept at all 5 sites). `--check` **COMPATIBLE** — R1/R3-R9 probes hold; 3-5 band reachable at runtime for the first time on the ctx path (grade=4 → 3-5/decimal). C1 remains OPEN (14k replay: band fixed, range/window/accept residuals confirmed live). Report: `qa/primitive-contracts/number-line-check-2026-08-03.md`.
- 2026-08-04 — reader-fit 14k fork shipped: explicit Grade-1 ranges may reach 120, focus-aware local pooling binds the requested 90-110 window, and exact missing-number `between` challenges use adjacent bounds plus additive `exactTargetValue`. Legacy clamp and any-interior semantics remain covered. C1 RESOLVED; `--check` COMPATIBLE. Report: `qa/primitive-contracts/number-line-check-2026-08-04.md`.
