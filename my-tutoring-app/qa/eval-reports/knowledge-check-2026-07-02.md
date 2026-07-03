# Eval Report: knowledge-check — 2026-07-02

**Trigger:** User flagged that the knowledge check "seems too hard if the student is early
elementary." Live lesson = "Garbage Trucks", gradeLevel `elementary`, KC resolved to Bloom
tier **`evaluate`** (Tier 4, β=6.0 — the hardest tier the primitive offers).

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| evaluate (@ elementary) | PASS (fixed 2026-07-02) | 0 |
| evaluate (@ kindergarten) | PASS | 0 |
| recall / apply / analyze | PASS (no regression) | — |

The primitive itself is not broken. The failure was **grade under-weighted in the KC
orchestrator + generator prompts**: grade reached both stages but as a lone line, while the
Bloom tier was a large forceful block that dominated reading level AND structural load. Both
symptoms surfaced only when a high Bloom tier was paired with a young grade band.

## Resolution (2026-07-02) — grade governs the realization, not a Bloom ceiling

Per the product direction, the fix is **not** a grade→tier ceiling in the resolver/catalog
(the eval-mode ladder is left alone). Instead grade/topic/intent were made the dominant driver
in the two stages that actually shape the output:

1. **Orchestrator** (`gemini-knowledge-check-orchestrator.ts`): added a prominent
   **GRADE-LEVEL FIT (HARD CONSTRAINT)** block that overrides the cognitive tier for BOTH
   reading level and structural/cognitive load (concrete familiar contexts, one concept per
   problem, short sentences, 3–4 options for early grades). Reframed the Cognitive Level
   section so "hard" means "hard *for this grade*," and extended brief rule 5 to carry the
   grade-appropriate reading level + option count into every brief.
2. **Generators** (`gemini-knowledge-check.ts`): `buildBloomsTierPrompt` now closes with a
   **GRADE TAKES PRECEDENCE OVER TIER** clause — the tier sets the KIND of thinking only and
   must not raise vocabulary/sentence complexity above the target grade band. This single edit
   covers all six per-type generators.
3. **Option count** now capped by grade (`getMcOptionLabels(tier, gradeLevel)` +
   `maxOptionsForGrade`): kindergarten & below → 3, elementary → 4, middle-school+ → tier count.
   The `evaluate` tier's hard-coded 5 options no longer reaches young grades.

**Runtime verification** (`evaluate` @ elementary ×3, @ kindergarten ×1; recall/apply/analyze
regression) — all PASS. `evaluate` @ elementary now renders e.g. *"pick the most effective
truck to clean a very long street with 100 houses"* (4 options); @ kindergarten *"which street
is the best and safest place to play with your friends"* (3 options) — grade-appropriate words
and a genuine judgment, versus the pre-fix *"city planners maximize the volume of refuse"*.
tsc: 1417 (baseline 1419), no errors in the edited files.

## Reproduction (same topic + grade, tier is the only variable)

`GET /api/lumina/eval-test?componentId=knowledge-check&topic=Garbage%20Trucks&gradeLevel=elementary&evalMode=…`

- `recall` → *"Based on the definition of hydraulics, what is the main job of the garbage
  truck's hydraulic arm?"* (easy, single-concept, readable)
- `evaluate` → *"The city needs to pick a truck for 'Old Forest Road,' a neighborhood with
  very narrow streets that are only 25 feet wide and often crowded with traffic. Given the
  goal of picking up trash without getting stuck…"* (hard, multi-constraint optimization)

And from the live lesson, even the tier's **planned "easy" warm-up** (the fill_in_blanks
screenshotted) rendered at adult reading level:
> "When **city planners** need to **maximize** the amount of waste a single truck can carry
> during a route, they must decide which **mechanism** is most **effective** for reducing the
> **volume of refuse**… the compactor is the most **essential** tool for the task."

Same grade band. The tier alone drives both the cognitive load and the vocabulary.

## Issues

### evaluate @ elementary — Bloom tier selected without regard to grade band
- **Severity:** HIGH
- **What's broken:** `resolveLessonEvalModes` picked `evaluate` (Tier 4, β=6.0) for a lesson
  at `elementary` (grades 1–5). Its prompt frames eval modes as *"a DISTINCT skill — NOT a
  difficulty level"* and matches purely on the objective verb ("compare") / intent ("select
  the best truck"). But for knowledge-check the eval modes **are** a Bloom difficulty ladder
  (recall β1.5 → evaluate β6.0), so "match the skill, ignore difficulty" hands early
  elementary the top of Bloom's taxonomy. `gradeLevel` is passed into the prompt but **no rule
  uses it to cap the tier**, and there is no grade→max-tier ceiling anywhere in the KC path.
- **Data:** `objectiveVerb=compare` `intent="…select which type of garbage truck is best…"`
  → resolver rationale: *"requires evaluating the suitability of different collection methods
  against environmental constraints"* → `targetEvalMode = "evaluate"`.
- **Fix in:** GENERATOR (resolveLessonEvalModes must cap tier by grade for ladder-style eval
  modes) — or CATALOG (declare a per-grade max tier on knowledge-check's evalModes).

### evaluate @ elementary — no reading-level floor; "elementary" band too broad for one prompt
- **Severity:** HIGH
- **What's broken:** Once `evaluate` is chosen, `BLOOMS_TIER_PROMPTS.evaluate` /
  `getTierGuidance('evaluate')` inject *"mostly hard,"* *"expert reasoning,"* *"GENUINELY
  DEFENSIBLE but ultimately inferior positions,"* *"5 highly plausible options."* These
  dominate the lone *"use age-appropriate vocabulary"* line, so even the planned **easy**
  problem reads at an adult level. Compounding it, `getGradeLevelContext('elementary')`
  collapses grades 1–5 into one prompt string — a single generation can't serve both grade 1
  and grade 5, so it drifts upward.
- **Data:** planned `{ type: fill_in_blanks, difficulty: easy }` → rendered sentence uses
  "city planners / maximize / mechanism / volume of refuse / essential" (grade ~7+ vocabulary
  for a grade-1-eligible band).
- **Fix in:** GENERATOR (make grade-appropriate reading level a hard, tier-independent
  constraint) — and/or upstream: narrow the "elementary" band (early vs upper) so the grade
  string carries a real reading-level target. Product decision — see tracker PD row.

## Notes (post-fix)
- This was **not** a per-mode component bug: KnowledgeCheck.tsx and the six problem
  generators' schemas were left untouched, as diagnosed.
- The diagnosis originally proposed a **grade × Bloom-tier ceiling** at selection time (SP-26).
  Product direction overrode this: the eval-mode ladder is a legitimate difficulty axis and
  should NOT be clamped upstream. The real defect was that **grade was under-weighted in the
  orchestrator + generator prompts** relative to the tier block. Fix = make grade/topic/intent
  the dominant driver of the orchestrator and the per-question generators (reading level,
  structural load, and option count all grade-governed), with the tier setting cognitive KIND
  only. See the Resolution section above.
- KC-1 (cognitive load) and KC-2 (reading level) are both addressed by this single
  grade-precedence change — the tier no longer overrides grade on either axis.
