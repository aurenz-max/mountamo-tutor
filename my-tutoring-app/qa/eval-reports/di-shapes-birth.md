# di-shapes — Birth Certificate (L0)

**Born:** 2026-08-06, commit `cabb3f0` · **Family:** direct-instruction (pack #5)
**Origin:** user modality call, same-day — *"another modality would be DI shapes?
this is a triangle, what is this, how many sides does it have"*.

## What it is

Live-judged DISTAR shape naming over the committed judged-loop engine
(`useJudgedSpeechLoop` → `judgedLoopModel` + `useLiveVoiceTurns`): the tutor
models a drawn 2D shape's name ("Listen: this shape is a triangle."), guides it
chorally, then tests ("Your turn. What shape is this?") and judges the spoken
SHAPE NAME from the audio in-band. Verdict sentinels are the engine defaults
("Yes" / "My turn"), collision-scanned in `diShapesScript.test.ts`.

- **L0 mode:** `name_shape` (β 1.5). The "how many sides" half of the user's
  call is deliberately the L1 rung (`count_sides` — spoken number words, the
  #46-benched class), not squeezed into birth.
- **Stage:** code-owned SVG geometry per shape, rendered at a generator-stamped
  rotation (K.G.2 is "regardless of orientation", so orientation actually
  varies; square capped ±10° so it never reads as a diamond).
- **Generator:** `gemini-di-shapes.ts`, Fork A menu service. Code owns the
  9-shape menu (K core five: circle, triangle, square, rectangle, hexagon;
  extended: oval, pentagon, rhombus, trapezoid) with article/sides/aliases/
  rotation caps. Shapes NAMED in the objective win outright; then the model's
  enum-constrained hint filtered to the grade menu; then the core five.
  Wrapper leak-guard: a shape name in the title/description reverts to safe
  defaults ("diamond" included).
- **Pedagogy guards:** rectangle draws ≥1.6:1 and oval clearly non-circular so
  square-vs-rectangle / circle-vs-oval each have exactly ONE defensible name
  per drawing (the rule-#1 / R12 class, closed by geometry, not prose).
  "Diamond" is a judged alternate of rhombus, stated per-item in the contract.
  Contrastive correction names the child's wrong shape ("not rectangle — this
  shape is a square") — the near-name is the error class this pack exists on.
- **Answer-leak rule:** the name never appears on screen, in the wrapper, or in
  RUNTIME STATE (contextKeys = `challengeType` only — stricter than math-facts
  because the name IS the whole answer). Labels render post-affirmation only;
  missed shapes recap unnamed.
- **Family wiring at birth:** catalog tutoring block (lesson mode day one),
  `audioInput: {manual_activity: true}`, run-log flush pattern (pre-connect
  runId, run-end + tail + teardown), stall recovery + post-run disconnect,
  `loop-deaf` re-arm, misconception evidence (primitive scope; task identity
  named in `challengeSummary`), silent `meanResponseMs`.

## Registration (all landed in `cabb3f0`)

catalog `di.ts` · `diGenerators` · `primitiveRegistry` · `ComponentId` ·
`DiShapesMetrics` · DI tester pack · `lessonVoiceTurnPolicy` 420ms · bench
`Shapes` probe set + `shape` cue branches (`diScript.ts`, `DIItemKind`) ·
backend `problem_type_registry.py` (`name_shape` β 1.5) · `di-shapes →
MATHEMATICS` in `_PRIMITIVE_TO_SUBJECT`.

## Gates

| Gate | Result |
|---|---|
| Focused suites (script collision, generator scope, bench roster, lesson policy) | 45/45 |
| Whole DI-family + hooks sweep | 304/304 |
| Full Vitest | **1791/1791** |
| typecheck:lumina / whole-tree tsc | 0 / 805 (unchanged) |
| Backend py_compile | clean |
| Real-pipeline probes (dev server :3000, real Gemini) | **3/3** — generic K → exactly the core five; "name triangles and circles" → those two only; "recognize and sort diamonds" → rhombus ×5 with `spokenAlternates: ['diamond']`; no wrapper leaked a shape name |

## Honest gaps → the queue

1. **L0 live loop UNVERIFIED — HUMAN-CHECKS #72** (mic + browser): drive the
   bench `Shapes` probe (deliberately wrong across square↔rectangle and
   circle↔oval; say "diamond" at the rhombus — must affirm) + one DiShapes
   tester run. Folds into the same session as #63's re-run.
2. **`/curriculum-fit di-shapes` unmeasured** — K.G.2 naming home is
   near-certain but the retrieval probe needs the backend up.
3. **Ladder:** L1 `count_sides`/`count_corners`/`shape_review` →
   L3 support tiers (script-composed fade) → L4 structural (rotation
   magnitude, size, non-prototypical exemplars) → L5 sound. Queue of record:
   `qa/di/BACKLOG.md` item 14.
