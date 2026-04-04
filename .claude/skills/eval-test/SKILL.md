# Eval Test — Quick QA for Lumina Primitives

Test that a primitive's generated data works with its component. Report only what's actually broken.

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
