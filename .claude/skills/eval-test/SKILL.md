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
