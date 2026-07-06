# Eval Test — Quick QA for Lumina Primitives

Test that a primitive's generated data works with its component. Report only what's actually broken.

**This is the QA loop of the primitive lifecycle** (`my-tutoring-app/src/components/lumina/docs/PRIMITIVE_LIFECYCLE.md`): a layer only counts as done when eval-test passes at that layer — single-mode at birth (L0), per-mode + the Auto/mixed path after `/add-eval-modes` (L1), tier sweep (`&difficulty=`) after `/add-support-tiers` / `/add-structural-difficulty` (L3/L4). Findings route through `/eval-fix`.

**Arguments:** `/eval-test <primitive-id> [eval-mode]`
- Omit eval-mode to test all modes for that primitive
- Omit both to list all primitives with eval modes
- `/eval-test all` runs every primitive x mode combination

## Workflow

### Step 0: Quick File Lookup

Show the user the key file locations for the primitive:

```
Component:  src/components/lumina/primitives/visual-primitives/math/<Name>.tsx
Generator:  src/components/lumina/service/math/gemini-<name>.ts
Catalog:    src/components/lumina/service/manifest/catalog/math.ts
```

(Use `literacy/` instead of `math/` for literacy primitives.)

Do a fast pre-check: read the catalog entry's `challengeTypes` and grep the component for each one. If a challenge type has no code path in the component, flag it — that mode is structurally broken.

### Step 1: Curl the API

```bash
# Single mode
curl -s "http://localhost:3000/api/lumina/eval-test?componentId=<id>&evalMode=<mode>"

# List all primitives
curl -s "http://localhost:3000/api/lumina/eval-test"
```

If connection refused, tell the user: `cd my-tutoring-app && npm run dev`

Display the returned JSON so the user can see what was generated.

### Step 2: Analyze — CRITICAL and HIGH Only

Read the component source and the generated JSON. **Only flag issues that are actually broken.** If it works, say it works.

**What counts as CRITICAL/HIGH:**
- Crash or render failure
- Student literally cannot enter the correct answer (UI overflow, missing input slots)
- Answer is leaked in visible UI text before student interacts
- Math is wrong (operands don't produce the claimed result)
- Impossible challenge (correct answer not in choices, unsolvable)
- Component has no code path for the generated challenge type

**What does NOT get flagged:**
- Minor wording preferences
- Pedagogical style opinions
- "Could be better" suggestions
- Phantom fields the component ignores
- Difficulty tuning within a reasonable range

### Step 3: Visual Check

Tell the user:
> Open MathPrimitivesTester in the app, select **<primitive-id>** and mode **<mode>**, click Generate, then visually confirm the rendering. The "Generated Data (Gemini Output)" panel shows the JSON. Take a screenshot if you want me to review it.

### Step 4: Save Report

Save to: `my-tutoring-app/qa/eval-reports/<primitive-id>-<YYYY-MM-DD>.md`

Overwrite if same primitive + date already exists.

**Report format — keep it short:**

```markdown
# Eval Report: <primitive-id> — <YYYY-MM-DD>

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| <mode>    | PASS/FAIL | <count or "—"> |

## Issues

### <mode> — <issue title>
- **Severity:** CRITICAL | HIGH
- **What's broken:** <1-2 sentences>
- **Data:** `<key field = value>`
- **Fix in:** GENERATOR | COMPONENT | CATALOG

<Repeat only for actual issues. If all modes pass, skip this section entirely.>
```

After saving, tell the user the file path and a one-line summary.

**Do NOT fix code unless the user explicitly asks.**

### Step 5: Update EVAL_TRACKER.md

Update `my-tutoring-app/qa/EVAL_TRACKER.md` so the dev team has a single source of truth for all open issues.

**Read the file first**, then apply these updates:

1. **Status Dashboard table** — Add or update the row for this primitive with mode count, passed, failed, date, and report link. Recalculate the **Totals** line.

2. **Open Issues tables** — For each CRITICAL or HIGH issue found, add a row with a unique ID (format: `XX-N` where XX is a 2-letter primitive abbreviation, e.g. `PB-1` for percent-bar). Include primitive, mode, severity, category, summary, and fix type. Place CRITICAL/HIGH issues in the top table, MEDIUM/LOW in the lower table.

3. **Systemic Patterns** — If the issue matches an existing pattern (e.g., SP-1 "component ignores challengeType"), add this primitive to the **Affected** list. If it represents a new cross-primitive pattern, create a new `SP-N` entry.

4. **Product Decisions Pending** — If a fix requires product input (e.g., "should we remove this mode or build the feature?"), add a row.

If all modes pass and the primitive has no open issues, still add/update the dashboard row (showing 0 failures) but skip the issues tables.

## Batch Testing (`/eval-test all`)

One report file per primitive. Console rollup at the end:

```
Eval Rollup — <date>
| Primitive   | Passed | Issues |
|-------------|--------|--------|
| ten-frame   | 4/4    | 0      |
| area-model  | 2/4    | 3      |
```

## Known Failure Patterns

| Pattern | Example | What Breaks |
|---------|---------|-------------|
| **UI overflow** | 67+85=152 but only 2 input boxes | Can't enter correct answer |
| **Answer leak** | "Find letter S" with S shown on screen | Assessment defeated |
| **Missing choice** | Correct answer not in MC options | Impossible to answer |
| **No code path** | Component doesn't handle challenge type | Mode structurally broken |
| **Wrong math** | Title says 450 but factors give 525 | Factual error |
| **Grid overflow** | 15 items in a 4x3 grid | Items truncated |
| **Hint reveals answer** | Hint contains the exact answer | Defeats the skill being tested |
| **Missing visual data** | Count challenge with no `displayedCoins` | Empty render, can't answer |
| **Silent fallback** | Missing field → hardcoded default | Wrong answer or trivial challenge |
| **Eval mode bleed** | Two modes share challengeType, no differentiation | Mode doesn't test what it claims |
| **Tier not wired** | easy/medium/hard produce identical scaffolds + shape | `config.difficulty` ignored — adaptivity is a no-op |
| **Difficulty = bigger numbers** | hard just inflates magnitude past the band | Violates structural-not-numeric; can break scope |

## Step 2a: Generator↔Component Sync Check (NEW — run for every eval)

After Step 2, perform these additional checks. These catch the class of bugs where the generator produces data that is structurally valid JSON but functionally broken for the component.

### Rule G1: Required fields per challenge type

For each challenge in the generated JSON, check that all fields the component **reads** for that challenge type are present and non-empty. Do NOT rely on the TypeScript type being optional (`?`) — if the component reads it without a fallback, it's required.

**How to check:** Read the component's render function for each challenge type (e.g., `renderIdentifyChallenge`, `renderCountChallenge`). List every field accessed. Cross-check against the generated JSON.

| If component reads... | And JSON has... | Verdict |
|---|---|---|
| `challenge.displayedCoins` with no fallback | `displayedCoins` missing or empty array | **CRITICAL** — empty render |
| `challenge.options` with fallback to hardcoded array | `options` missing | **HIGH** — functional but static, reduced variety |
| `challenge.correctTotal` derived from `displayedCoins` | `correctTotal` present but `displayedCoins` missing | **CRITICAL** — wrong answer, student sees nothing |
| `challenge.groupA` and `challenge.groupB` | Either group missing | **CRITICAL** — one-sided comparison |

### Rule G2: Nullable flat-field reconstruction audit

If the generator uses a flattened schema (e.g., `coin0Type`, `coin1Type` instead of a `coins[]` array), check whether reconstruction actually produced data:

1. Read the generator's reconstruction logic (e.g., `collectCoinDefs`, `collectStrings`)
2. In the API response JSON, check if the reconstructed arrays are populated
3. If arrays are empty/missing for >50% of challenges, flag as **CRITICAL** — the flat schema pattern is unreliable for this field group

**Why this matters:** Gemini Flash Lite frequently skips nullable flat-indexed fields entirely (SP-14 in EVAL_TRACKER). The generator silently produces challenges with missing visual data.

### Rule G3: Eval mode semantic differentiation

When two or more eval modes share the same `challengeTypes` value in the catalog:

1. Identify what makes them pedagogically different (e.g., count-like = single coin type, count-mixed = multiple coin types)
2. Check if the generator enforces that distinction (post-filter, prompt constraint, or separate sub-generator)
3. Generate data for each mode and verify the output actually differs

If two modes produce indistinguishable output, flag as **HIGH** — the eval mode isn't testing what it claims.

### Rule G4: Answer derivability from visible data

For every challenge, verify that the **correct answer can be derived from what the student sees**:

1. If the challenge shows coins/objects and asks for a total → check the displayed items actually sum to `correctTotal`
2. If the challenge shows two groups and asks "which is more?" → check `correctGroup` matches the actual values
3. If the instruction mentions specific items but the data shows different items → flag as **CRITICAL** (instruction-data mismatch)

**Anti-pattern:** Generator computes `correctTotal` from Gemini's claimed value instead of from the actual `displayedCoins`. Always recompute answers from the visual data.

### Rule G5: Fallback quality audit

When the generator has a fallback path (e.g., `?? 10`, `?? "A"`, `|| ['penny','nickel','dime','quarter']`):

1. Check if the fallback is reachable in normal operation (not just edge cases)
2. If it's reachable, check if the fallback produces a **correct** challenge (right answer, solvable)
3. If the fallback fires for >30% of challenges, flag as **HIGH** — the primary generation path is unreliable

**Why this matters:** Silent fallbacks mask broken generation. A `correctTotal ?? 10` that fires on every challenge means students always see "10" regardless of the displayed coins.

## Step 2b: Difficulty Sweep (primitives with a difficulty spec)

For primitives with IRT within-mode difficulty (as of 2026-06-11, **17**:
ten-frame, counting-board, number-line, hundreds-chart, ordinal-line,
number-sequencer, comparison-builder, number-bond, base-ten-blocks,
skip-counting-runner, array-grid, area-model, multiplication-explorer,
math-fact-fluency, regrouping-workbench, addition-subtraction-scene, factor-tree
— pool-service generators exporting numeric band functions like
`tenFrameCountBand`/`numberLineRangeMax`/`comparisonBuilderValueBand`/
`areaModelFactorBands`; the `DIFFICULTY_SPEC_PRIMITIVES` set in
MathPrimitivesTester.tsx is the live list), verify the bands are honored by
sweeping `&theta=` across the mode's range:

```bash
# Pick thetas that land LOW / MID / HIGH within the mode's band:
# level = (clamp(θ − 0.847/a, β±0.75) − (β−0.75)) / 1.5
curl -s ".../eval-test?componentId=counting-board&evalMode=count&topic=Counting%20objects&gradeLevel=kindergarten&theta=0.5"
curl -s "...&theta=1.5"
curl -s "...&theta=5.9"
```

Assert three things:
1. **Monotonicity** — the quantity-bearing fields (counts, targetCounts, startFrom)
   move up with theta and stay inside the band the spec declares for that level.
2. **Scope wins** — repeat the HIGH theta with a topic whose ceiling sits BELOW
   the band (e.g. "Counting to 5" against band 7-10), AND once with a word
   number ("Counting to five") to exercise the wrapper's window extraction.
   Every value must respect the ceiling. In the POOL-SERVICE architecture
   (ten-frame, counting-board, place-value, array-grid) this is guaranteed by
   construction: the wrapper LLM emits only `windowMax` (reading the scope
   language); code draws every value from modeRange ∩ window ∩ difficultyBand.
   Prompt-only enforcement FAILS under conflict (verified 2026-06-11: LLM
   generated 1-7 for a "to 5" topic) — which is why value-generating prompts
   are the wrong architecture for value-only primitives.
3. **Null-theta no-op** — omit `&theta=` and confirm output matches pre-difficulty
   behavior (grade-band defaults).

A spec violation is **HIGH** (fix the spec/cap in the generator); a scope
violation is **CRITICAL** (pedagogy rule #1).

**Span-clamp gotcha (multi-term constructions):** capping the *max band* is not
sufficient when a mode builds a stepped sequence (count-from, order-cards,
fill-missing, skip runs). If `length` and `step` are chosen from the difficulty
bands independently of the capped `maxHi`, the span `(length-1)*step` can exceed
the window — `start` clamps to 1 but the terms walk past the ceiling (verified
2026-06-11 on number-sequencer: "Counting to 10" @ θ2.5 → terms to 21). Fix:
clamp the span to the window (shrink step then length so `(length-1)*step ≤
maxHi-1`) BEFORE constructing terms — scope wins over the length/step axis.
Always sweep a HIGH-θ + small-ceiling case (e.g. "to 5"/"to 10") for any
multi-term mode.

**Product-mode corollary (rollout #2, area-model):** for modes whose scope-bound
quantity is a PRODUCT (arrays, area models, multiplication facts), capping each
factor band independently is insufficient — two separately-capped factors still
multiply past a product ceiling. The product cap must shrink a factor band BELOW
its difficulty `lo` to a structural floor, or it silently fails to bind. And a
value generator that *rejects* every collapsed draw (e.g. requiring a 2×2 grid)
empties the session — make it degrade to the minimal valid pair instead, never
zero challenges. A sweep that returns 0 challenges reads as "scope OK" (max 0 ≤
ceiling) but is actually a CRITICAL empty-render — always assert challenge count > 0.

## Step 2c: Support-Tier Difficulty Sweep (primitives with `config.difficulty`)

This is a DIFFERENT difficulty axis from Step 2b. Step 2b's numeric `&theta=`
within-mode path was retired (no generator reads `config.studentTheta`). The live
within-mode difficulty axis is the **support tier**: the manifest stamps
`config.difficulty = 'easy' | 'medium' | 'hard'` per component, and tier-aware
generators read it. The two-field contract is: `targetEvalMode` = WHICH skill
(task identity), `difficulty` = HOW HARD within it. Per
[[structural-difficulty-not-numeric]] the tier raises difficulty STRUCTURALLY and
withdraws on-screen scaffolds — it must NEVER just inflate raw magnitude or cross
into another eval mode.

The harness now threads the tier: add `&difficulty=easy|medium|hard` to the
eval-test URL (wired in `route.ts` → `config.difficulty`).

**Which primitives have it:** a generator supports tiers if it reads
`config.difficulty`. As of 2026-06-14: **bar-model**, **area-model**,
**addition-subtraction-scene** (more being added via `/add-support-tiers`). Grep
the generator for `difficulty` / `normalizeSupportTier` / `resolveSupportStructure`
/ `resolveProblemShape` to confirm and to read the PER-MODE lever table. If the
generator has no such code, skip this step (there is no tier to test).

### How to sweep

For the pinned eval mode, run the SAME mode at all three tiers (and once with no
tier for the baseline):

```bash
M="read_scale"   # or whichever mode you're testing
curl -s ".../eval-test?componentId=bar-model&evalMode=$M&topic=Books%20read%20this%20week&gradeLevel=grade%202"            # baseline (no tier)
curl -s ".../eval-test?componentId=bar-model&evalMode=$M&topic=Books%20read%20this%20week&gradeLevel=grade%202&difficulty=easy"
curl -s ".../eval-test?componentId=bar-model&evalMode=$M&topic=Books%20read%20this%20week&gradeLevel=grade%202&difficulty=hard"
```

Generation has natural variance (each challenge is an independent Gemini call), so
judge the DISTRIBUTION across a tier's challenges, not one challenge — and compare
easy-vs-hard, not adjacent tiers, for the clearest signal.

### What to assert

**1. Scaffold withdrawal is deterministic (code-set — must flip).**
The generator sets scaffold fields in post-process from the tier, so they are NOT
subject to LLM variance — they MUST change exactly as the generator's support
table declares. For bar-model, read `resolveSupportStructure(mode, tier)` and
check each challenge's `showBarValues`, `showTargetHighlight`, `supportTier`
fields in `fullData.challenges[]`. Example (read_scale): easy→`showBarValues:true,
showTargetHighlight:true`; medium→`false,true`; hard→`false,false`. If a field
that the table says should differ is identical across tiers, the tier is **not
wired** → **HIGH** (fix in GENERATOR).

**2. Structural problem difficulty moves (the PROBLEM gets harder, not bigger).**
Read `resolveProblemShape(mode, tier)` for the mode's ONE structural lever and
assert it moves across tiers. For bar-model:

| Mode | Lever | easy → hard |
|------|-------|-------------|
| `compare_bars` | height gap `\|a−b\|` | 4 → 2 → 1 (bars get closer) |
| `read_scale` | `scale.step` | 1 → 2 |
| `scaled_bar_graph` | `scale.step` | 2 → 5 → 10 (coarser ticks) |
| `picture_graph` | `scale.iconValue` | 2 → 5 |
| `graph_word_problem` | operation depth (read `prompt`) | 1-step diff → total → 2-step |
| `build_graph` | scale-choice ambiguity (read `prompt`/dataset) | obvious → ambiguous |

Numeric levers (gap, step, iconValue) are post-process-enforced → assert exactly.
Prompt-shaped levers (operation depth, ambiguity) are LLM-validated → read the
`prompt` text and judge it moved in the right direction across several challenges.
A lever that doesn't move is **HIGH** (fix in GENERATOR).

**3. Magnitude invariance — difficulty is structural, NOT bigger numbers.**
The whole point ([[structural-difficulty-not-numeric]]): the bar VALUES must stay
inside the SAME mode value band at every tier. Hard must not push values past the
mode's declared range (compare_bars 1-10, read_scale 0-20, scaled_bar_graph 2-60,
picture_graph multiples ≤ iconValue×8, etc.). If the only thing that changes
between tiers is "the numbers got bigger," that's the anti-pattern → **HIGH**.
If hard pushes values past the scope ceiling, that's a scope violation →
**CRITICAL** (pedagogy rule #1).

**4. No answer leak at ANY tier (scaffold withdrawal must not reveal/conceal wrongly).**
Withdrawing a scaffold at hard must not expose the answer, and must not be the
thing that was hiding it. For bar-model the answer bar's value is hidden at EVERY
tier (`answerBarIndex`), independent of `showBarValues`; verify the read-mode
target bar's number is never in the rendered values readout regardless of tier.
Conversely, confirm the EASY scaffold genuinely helps (the aid is present) so the
gradient is real. An answer visible at any tier is **CRITICAL**.

**5. Null-tier no-op.** Omit `&difficulty=` and confirm scaffold fields are
absent/undefined (component defaults them ON), `supportTier` is undefined, and the
structural lever sits at its un-tiered default — i.e. pre-tier behavior is
unchanged. A baseline that already looks like "hard" means the default path
regressed → **HIGH**.

A tier that fails to change scaffolds OR structural shape is a **HIGH** "tier not
wired" finding (the manifest will stamp `difficulty` but the student sees no
difference). Magnitude inflation or scope breakage is the more serious failure —
flag per above.

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/lumina/eval-test/route.ts` | API endpoint |
| `src/components/lumina/service/manifest/catalog/math.ts` | Math eval mode definitions |
| `src/components/lumina/service/manifest/catalog/literacy.ts` | Literacy eval mode definitions |
| `src/components/lumina/primitives/visual-primitives/math/` | Math components |
| `src/components/lumina/primitives/visual-primitives/literacy/` | Literacy components |
| `src/components/lumina/service/math/gemini-*.ts` | Math generators |
| `src/components/lumina/service/literacy/gemini-*.ts` | Literacy generators |
| `my-tutoring-app/qa/eval-reports/` | Report output directory |
| `my-tutoring-app/qa/EVAL_TRACKER.md` | Central issue tracker for dev team — updated every run |
