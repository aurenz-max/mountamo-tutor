# Number Pool Service

## The Problem

Gemini structured output (`responseMimeType: "application/json"`) is near-deterministic. Regardless of `temperature`, it converges on the same numbers every time:
- base-ten-blocks: always 425
- place-value-chart: always 5,831
- number-line: always 600-610

Prompt-based hints like "vary the numbers" or "use these as inspiration" are ignored. The model latches onto examples in the prompt or its own internal defaults and returns the same JSON every call.

## The Fix

**We own the randomness. Gemini owns the pedagogy.**

The `numberPoolService` generates random numbers before the Gemini call and injects them into the prompt as mandatory values. Gemini builds the titles, descriptions, challenges, and hints around numbers it didn't choose.

## Architecture

```
Manifest (Gemini)                    Generator (Gemini)
────────────────                     ──────────────────
Picks primitive + numberRange   →    numberPoolService picks random
based on grade + scaffolding         numbers within range
mode (e.g. {min:100, max:999})  →    Injects pool into prompt
                                →    Gemini builds pedagogy around them
```

The range flows: **Backend IRT** → **Manifest** (grade+mode aware) → **Hydrator** (passes through config) → **Generator** (creates pool, injects into prompt).

### Where does `numberRange` come from?

The **manifest Gemini call** decides the range — not the backend. The backend only influences it indirectly via `target_mode` (scaffolding level 1-6) and `grade_level`.

| Scenario | What happens | Numbers varied? |
|---|---|---|
| **Pulse (with backend)** | Backend sends `target_mode` + `grade_level` → manifest uses scaffolding context to pick `numberRange` → pool service randomizes | Yes |
| **Practice (no backend)** | `generatePracticeManifest` called with `topic` + `gradeLevel` → manifest Gemini picks `numberRange` from grade context alone | Yes |
| **Direct generator call (no manifest)** | `config.numberRange` is undefined → `createNumberPool(undefined)` returns null → generator falls back to old grade-band guidelines | No — old deterministic behavior |

The third case (direct call) doesn't happen in production — all generator calls go through the manifest → hydrator → registry pipeline. But if you're calling a generator in a test or preview tool, pass `numberRange` explicitly to get variety.

## Three Functions

### `createNumberPool(range, options)` — General purpose

For primitives that need a set of numbers to pick from (most math primitives).

```ts
import { createNumberPool } from './numberPoolService';

const pool = createNumberPool(config?.numberRange, { minNonZeroDigits: 2 });
// pool.numbers  → [738, 291, 854, 163, 527, 482, 619, 345, 976, 408]
// pool.primary  → 738 (first number, convenience accessor)
// pool.range    → { min: 100, max: 999 }

const promptSection = pool?.toPromptSection() ?? '';
// Insert promptSection into Gemini prompt
```

**Options:**

| Option | Default | Purpose |
|---|---|---|
| `count` | 10 | How many numbers to generate |
| `integers` | true | Force integers (vs decimals) |
| `decimals` | 1 | Decimal precision when `integers: false` |
| `minNonZeroDigits` | 0 | Ensure numbers have N+ non-zero digits (good for place-value) |
| `sorted` | false | Sort ascending |
| `unique` | true | No duplicate values |

**Use for:** base-ten-blocks, place-value-chart, ten-frame, counting-board, balance-scale, number-bond, comparison-builder, hundreds-chart, factor-tree, coin-counter, etc.

---

### `createSubRangePool(range, options)` — Display window

For primitives that show a number line or sequence where the visible range should be a narrower window within the full grade-appropriate range.

```ts
import { createSubRangePool } from './numberPoolService';

const pool = createSubRangePool(config?.numberRange, { sorted: true, unique: true });
// pool.displayRange  → { min: 34, max: 52 }  (random sub-window)
// pool.numbers       → [35, 37, 39, 41, 44, 46, 48, 50]  (within sub-window)
// pool.range         → { min: 0, max: 100 }  (original full range)

const promptSection = pool?.toPromptSection() ?? '';
```

**Extra options (on top of NumberPoolOptions):**

| Option | Default | Purpose |
|---|---|---|
| `spanFraction` | [0.2, 0.4] | Sub-range is 20-40% of full range |
| `minSpan` | 5 | Minimum sub-range width |

**Use for:** number-line, skip-counting-runner, number-sequencer, double-number-line.

---

### `createOperandPairs(range, operation, count)` — Arithmetic pairs

For primitives that need matched operand pairs where the result stays reasonable.

```ts
import { createOperandPairs } from './numberPoolService';

const pairs = createOperandPairs(config?.numberRange, '+', 5);
// pairs → [
//   { a: 34, b: 17, result: 51, operation: '+' },
//   { a: 8,  b: 45, result: 53, operation: '+' },
//   ...
// ]
```

Supported operations: `'+'`, `'-'`, `'×'`

**Use for:** addition-subtraction-scene, regrouping-workbench, math-fact-fluency, multiplication-explorer.

---

## Integration Steps (per generator)

### 1. Add `numberRange` and `difficulty` to the config type

```ts
export const generateMyPrimitive = async (
  topic: string,
  gradeLevel: string,
  config?: {
    intent?: string;
    targetEvalMode?: string;
+   numberRange?: { min: number; max: number };
+   difficulty?: string;
  }
): Promise<MyPrimitiveData> => {
```

This is already wired — the hydrator passes `numberRange` and `difficulty` from the manifest through `item.config` to every generator. You just need to declare the types.

### 2. Create the pool and build the prompt section

```ts
+ import { createNumberPool } from './numberPoolService';

  // After eval mode resolution, before building the prompt:
+ const pool = createNumberPool(config?.numberRange, { minNonZeroDigits: 2 });
+ console.log(`[MyPrimitive] pool:`, pool?.numbers ?? 'none');

+ const rangeSection = pool?.toPromptSection({
+   extraInstructions: '- Use the FIRST number as the primary value.',
+ }) ?? '';
```

### 3. Inject into the Gemini prompt

```ts
  const prompt = `You are generating...

  ${challengeTypeSection}

+ ${rangeSection}

- ${!evalConstraint && !pool ? `
+ GRADE BAND GUIDELINES (fallback when no range):
  ...existing grade-band text...
  ` : ''}
+ ${!evalConstraint && pool ? `
+ INFER GRADE BAND FROM RANGE:
+ - Range max <= 20: ...
+ - Range max <= 999: ...
+ ` : ''}

  REQUIREMENTS:
  ...
  `;
```

The key pattern:
- When `pool` exists: inject the mandatory number pool + range-inference guidelines
- When `pool` is null (no range from manifest): fall back to existing grade-band guidelines
- The pool prompt section tells Gemini to use ONLY numbers from the pool

### 4. Add temperature to the Gemini API call

```ts
  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
+     temperature: 0.9,
+     topP: 0.95,
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });
```

Temperature alone won't fix the convergence (structured output overrides it), but it helps with variety in the non-numeric parts (titles, descriptions, hints).

### 5. Remove hardcoded example numbers from prompt docs

If your `CHALLENGE_TYPE_DOCS` or prompt text says things like `"Use numbers like 3472, 5831"`, replace with generic guidance: `"Choose a number with multiple non-zero digits"`. Gemini latches onto examples.

---

## What the prompt section looks like

When `createNumberPool` generates a pool, `toPromptSection()` produces:

```
MANDATORY NUMBER POOL (pre-selected by the adaptive system):
- Available numbers: 738, 291, 854, 163, 527, 482, 619, 345, 976, 408
- Use the FIRST number (738) as the primary value for the activity.
- Pick from the remaining numbers for individual challenge values.
- All numbers are within [100, 999] and are grade-appropriate.
- Do NOT invent your own numbers. Select from this pool only.
```

When `createSubRangePool` generates a pool, it produces:

```
MANDATORY NUMBER LINE VALUES (pre-selected by the adaptive system):
- Display range: 34 to 52
- Number pool for challenges: 35, 37, 39, 41, 44, 46, 48, 50
- Use the display range EXACTLY as the min/max boundaries.
- Pick challenge values from the number pool above.
- Do NOT invent your own numbers. Select from this pool only.
```

---

## Customizing the prompt section

```ts
pool.toPromptSection({
  // Change the header
  label: 'TARGET VALUES',

  // Add primitive-specific instructions
  extraInstructions: '- Use the FIRST number as targetNumber.\n- Infer maxPlace from digit count.',

  // Don't designate a "primary" number (just pick from pool)
  usePrimaryInstruction: false,
});
```

---

## Already migrated

| Generator | Function used | Notes |
|---|---|---|
| `gemini-base-ten-blocks.ts` | `createNumberPool` | `minNonZeroDigits: 2` |
| `gemini-place-value.ts` | `createNumberPool` | `minNonZeroDigits: 2`, primary = targetNumber |
| `gemini-number-line.ts` | `createSubRangePool` | `sorted: true, unique: true` |

## Not yet migrated (20+ generators)

See the agent survey: 23 generators work with numbers and would benefit. Priority order:
1. **High-value** (generate multiple numeric values): regrouping-workbench, factor-tree, multiplication-explorer, addition-subtraction-scene, math-fact-fluency
2. **Medium-value** (single primary number): ten-frame, counting-board, balance-scale, number-bond, comparison-builder, skip-counting-runner, number-sequencer
3. **Lower-value** (contextual numbers): coordinate-graph, slope-triangle, tape-diagram, ratio-table, coin-counter, dot-plot, histogram

The integration is the same 5 steps for each. ~5 minutes per generator.
