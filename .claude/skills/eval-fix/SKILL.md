# Eval Fix — Structured Fix Workflow for Eval-Test Issues

Fix issues identified by `/eval-test`, with architectural understanding before code changes. Matches issues to known systemic patterns and applies targeted fixes — not broad rewrites.

**Arguments:** `/eval-fix <primitive-id>` or `/eval-fix <issue-id>`
- `/eval-fix rhyme-studio` — fix all open issues for rhyme-studio
- `/eval-fix RS-5` — fix only issue RS-5

## Core Principles

1. **Read before writing.** Understand the generator, component, and report before touching code.
2. **Match to SP-\* patterns.** Apply known fix approaches from EVAL_TRACKER.md, not ad-hoc solutions.
3. **Targeted over broad.** Exclude bad words from prompt rather than remove all validation. Add a post-process clamp rather than rewrite the schema.
4. **Propose before coding.** Describe the fix strategy to the user; wait for approval.
5. **Verify after fixing.** Re-run eval-test and confirm the fix didn't break other modes.

---

## Phase 0: Parse Arguments & Load Context

1. **Parse the argument.**
   - If it matches an issue ID pattern (2+ uppercase letters + hyphen + digit, e.g., `RS-5`): extract the primitive from the tracker.
   - If it's kebab-case (e.g., `rhyme-studio`): load all open issues for that primitive.

2. **Read the eval tracker:** `my-tutoring-app/qa/EVAL_TRACKER.md`
   - Find all open issues (CRITICAL/HIGH tables) matching the primitive.
   - Note which SP-\* patterns are tagged.
   - If the issue ID doesn't exist, tell the user and stop.

3. **Read the eval report:** `my-tutoring-app/qa/eval-reports/<primitive-id>-<YYYY-MM-DD>.md`
   - Get the full issue description, data samples, and "Fix in" recommendation.

4. **Identify the domain** from the primitive ID:

   | Domain | Generator Dir | Component Dir |
   |--------|---------------|---------------|
   | math | `service/math/` | `primitives/visual-primitives/math/` |
   | literacy | `service/literacy/` | `primitives/visual-primitives/literacy/` |
   | engineering | `service/engineering/` | `primitives/visual-primitives/engineering/` |
   | physics | `service/physics/` | `primitives/visual-primitives/physics/` |
   | astronomy | `service/astronomy/` | `primitives/visual-primitives/astronomy/` |
   | science | `service/science/` | `primitives/visual-primitives/science/` |

   All paths are relative to `my-tutoring-app/src/components/lumina/`.

5. **Read the generator:** `service/<domain>/gemini-<primitive-id>.ts`

6. **Read the component** (only if any issue has `Fix in: COMPONENT`): `primitives/visual-primitives/<domain>/<PascalName>.tsx`

7. **Read the catalog entry** (only if relevant): `service/manifest/catalog/<domain>.ts` — search for `id: '<primitive-id>'`.

8. **Display to the user:**

   ```
   Eval Fix: <primitive-id>
   Report:    qa/eval-reports/<primitive-id>-<date>.md
   Generator: service/<domain>/gemini-<primitive-id>.ts
   Component: primitives/visual-primitives/<domain>/<PascalName>.tsx

   Open Issues:
   | ID   | Severity | Mode        | SP Pattern | Fix Location | Summary |
   |------|----------|-------------|------------|--------------|---------|
   | RS-5 | HIGH     | recognition | SP-7       | GENERATOR    | ...     |
   ```

---

## Phase 1: Diagnose & Classify Each Issue

For each open issue, walk the **decision tree** to determine the fix category.

### Decision Tree

```
Is the problem in the GENERATED DATA (wrong values, wrong types, missing fields)?
├── YES → Is the data structurally wrong (wrong type, missing field, schema mismatch)?
│   ├── YES → Is the eval mode wiring broken? (generator ignores targetEvalMode)
│   │   ├── YES → FIX: EVAL-MODE-WIRING (SP-9)
│   │   └── NO  → FIX: SCHEMA-CHANGE
│   └── NO  → Is the data semantically wrong (bad content, wrong math, nonsense)?
│       ├── Can the error be detected programmatically after generation?
│       │   ├── YES → Can you DERIVE the correct value from other generated fields?
│       │   │   ├── YES → FIX: POST-PROCESS-DERIVE (compute, don't validate)
│       │   │   └── NO  → FIX: POST-PROCESS-VALIDATE (reject/clamp)
│       │   └── NO  → FIX: PROMPT-CHANGE
│       └── Is the LLM computing something it can't reliably do? (offsets, phonetics)
│           └── YES → FIX: POST-PROCESS-DERIVE — always recompute, never trust LLM (SP-8)
└── NO → Problem is in the COMPONENT (rendering, state, interaction)
    ├── State initialization bug? → FIX: COMPONENT-INIT (SP-5)
    ├── Missing code path for challenge type? → FIX: COMPONENT-SIDE (SP-1)
    │   └── Flag: "COMPONENT-SIDE, consider deferring" if large (100+ lines new JSX)
    ├── Answer leakage in visible UI? → FIX: COMPONENT-DISPLAY
    └── Render/validation data source mismatch? → FIX: COMPONENT + GENERATOR (SP-4)
```

### Complexity Check — Before Choosing a Fix

After classifying issues, assess whether the generator's complexity is the root cause.
Apply fixes in escalating order — simplest first:

```
1. PROMPT-CHANGE / SCHEMA-CHANGE — try this first for any issue
   └── If this fixes it → done

2. SCHEMA-SIMPLIFY — if the generator has 1 mode but the schema is too complex
   for flash-lite (6+ fields, deeply nested objects, multi-purpose fields),
   simplify the schema: flatten nested objects, remove unused fields, use
   explicit field names instead of generic ones.
   └── If this fixes it → done

3. ORCHESTRATOR-REFACTOR — if the generator has 4+ modes AND multiple issues
   stem from cross-contamination (SP-3), schema overload, or the generator
   needing excessive post-validation to patch LLM mistakes:
   - Split into per-mode sub-generators (each with focused prompt + simple schema)
   - Orchestrator dispatches via Promise.all for parallel execution
   - Orchestrator combines results to preserve the shared output type
   - Reference: tape-diagram (TD-2), sorting-station (SS-1/2/3)
```

**Smell test:** If you find yourself writing 3+ post-process validators for a single generator,
the schema is probably too complex. Step back and consider simplifying or orchestrating
instead of adding more patches. Post-validation should be a safety net, not load-bearing.

### Fix Category Summary Table

Record each issue classification:

| Issue ID | Fix Category | Fix Location | SP Pattern | Approach | Estimated Size |
|----------|-------------|--------------|------------|----------|----------------|
| RS-5 | PROMPT-CHANGE | Generator prompt | SP-7 | Add irregular word exclusion list | Small |
| BT-1 | COMPONENT-INIT | Component useState | SP-5 | Fix initial state from first challenge | Medium |

---

## Phase 2: Propose Fix Strategy — STOP AND WAIT

**Do NOT start coding.** Present the fix plan and wait for user approval.

For each issue, describe:

1. **What changes** — which file, which section (prompt, schema, post-process, component)
2. **Why this approach** — reference the SP-\* pattern if applicable
3. **What won't change** — explicitly state what is preserved
4. **Risk assessment** — what could this break?

### Fix Approach Guide: Simplify → Prompt → Derive → Validate

Three approaches in preference order. Try the simplest first:

| Situation | Recommendation | Rationale |
|-----------|---------------|-----------|
| Generator has 4+ modes and cross-contamination or schema overload | **SIMPLIFY:** orchestrator refactor or schema simplification | Don't patch a complex prompt — make each LLM call simple enough to get right |
| Generator has 1 mode but LLM still gets it wrong | **SIMPLIFY:** reduce schema fields, flatten nesting | If flash-lite can't handle 1 mode, the schema is too complex |
| LLM produces wrong CONTENT but correct structure | **PROMPT** first, then consider post-process | Prompt is cheaper; post-process only if verifiable programmatically |
| LLM stochastically fails (~80% success rate) | **PROMPT** exclusion list | Don't validate what you can't verify — avoid problematic inputs |
| Correct value is derivable from other generated fields (e.g., categories from objects, indices from text) | **DERIVE** post-generation | Compute deterministically — correct by construction, no false negatives |
| LLM computes something unreliable (char offsets, phoneme counts) | **DERIVE:** always recompute | LLMs cannot count characters or phonemes reliably (SP-8) |
| LLM produces wrong TYPE (object instead of array, missing field) | **VALIDATE:** default/reject | Schema should prevent this, but flash-lite is unreliable |
| Content is domain-specific but verifiable (math facts, sums) | **VALIDATE** with concrete checks | e.g., verify `a + b === result`, `word.length === letterCount` |
| Existing validation caused more harm than good (false negatives > true positives) | REMOVE validator + tighten prompt | See RS-3/RS-4: suffix validators broke valid irregular rhymes |

**Key distinction — DERIVE vs VALIDATE:**
- **Derive** computes the correct value from other data (e.g., derive categories from object attributes, recompute character offsets with `.indexOf()`). Correct by construction — can't produce false negatives.
- **Validate** checks LLM output and rejects/clamps bad values. Can create false negatives if the validator is wrong (RS-3/RS-4 lesson). Use only when derivation isn't possible.

**Red flags that a post-process validator will cause harm:**
- Uses string matching for something phonetic/semantic (spelling suffix ≠ rhyme)
- Has exceptions the code doesn't know about (irregular spellings, silent letters)
- Flips a boolean field (doesRhyme, isCorrect) — creates false content, worse than no validation
- Removing failing items could leave zero challenges (needs fallback that may also be wrong)

**Red flag that the generator needs simplification, not more patches:**
- You're writing 3+ post-process validators for one generator
- The prompt has negative constraints ("do NOT...") for every other mode
- The schema has fields that are only used by some modes (multi-purpose schema)

### Fix Strategy Template

```
## Proposed Fix: <issue-id>

**Pattern:** SP-<N> (<pattern name>)
**Category:** <PROMPT-CHANGE | SCHEMA-CHANGE | SCHEMA-SIMPLIFY | POST-PROCESS-DERIVE | POST-PROCESS-VALIDATE | ORCHESTRATOR-REFACTOR | EVAL-MODE-WIRING | COMPONENT-INIT | COMPONENT-SIDE>
**File:** <file path>
**Section:** <CHALLENGE_TYPE_DOCS | Prompt text | Post-processing | Schema | Component useState>

**Change:**
<2-3 sentences describing the specific code change>

**Preserves:**
<What existing behavior is explicitly NOT touched>

**Risk:**
<What could break — be specific>
```

**Wait for user approval before proceeding to Phase 3.**

---

## Phase 3: Implement Fixes

Apply fixes in this order (least risky first):

1. **EVAL-MODE-WIRING** — fix config propagation, add constrainChallengeTypeEnum
2. **PROMPT-CHANGE** — modify CHALLENGE_TYPE_DOCS, prompt text, system instruction
3. **SCHEMA-CHANGE / SCHEMA-SIMPLIFY** — add/modify/flatten schema fields
4. **POST-PROCESS-DERIVE** — compute correct values from other generated fields
5. **POST-PROCESS-VALIDATE** — reject/clamp bad values after JSON parse
6. **ORCHESTRATOR-REFACTOR** — split generator into per-mode sub-generators (if approved)
7. **COMPONENT-INIT** — fix useState, useEffect initialization
8. **COMPONENT-SIDE** — only if user approved; write complete file replacement

### Known Fix Patterns — Concrete Code Changes

#### SP-2: Generator value overflow
```
LOCATION: Generator prompt + post-process
PROMPT: Add hard range constraints:
  "For Tier 3 (grade 1-2), ALL numbers must be ≤ 99. Results must be ≤ 99."
POST-PROCESS: Clamp after JSON parse:
  ch.operand1 = Math.min(ch.operand1, maxForTier);
  // If clamping invalidates the math, reject challenge and use fallback
```

#### SP-3: Generator cross-contaminates types
```
LEVEL 1 (simple, <4 modes): Prompt constraint
LOCATION: Generator CHALLENGE_TYPE_DOCS
CHANGE: Add strong negative constraints to the active type's promptDoc:
  "ALL challenges MUST be sort-by-one. Do NOT include count-and-compare,
   odd-one-out, or any other interaction type."

LEVEL 2 (complex, 4+ modes or repeated cross-contamination): Orchestrator refactor
LOCATION: Entire generator file
CHANGE: Split into per-mode sub-generators, each with:
  - Focused prompt describing ONLY its mode (can't cross-contaminate)
  - Simplified schema with only that mode's fields
  - Orchestrator dispatches via Promise.all, combines results
REFERENCE: gemini-tape-diagram.ts (4 modes), gemini-sorting-station.ts (6 modes)
NOTE: Full file rewrite — use Write tool, not surgical Edit.
```

#### SP-5: First challenge uses wrong initial state
```
LOCATION: Component useState
CHANGE:
  BEFORE: const [columns, setColumns] = useState(decomposeNumber(data.numberValue));
  AFTER:  const [columns, setColumns] = useState(() => {
            const first = data.challengesWithIds?.[0];
            return decomposeNumber(first?.targetNumber ?? data.numberValue);
          });
```

#### SP-7: Phonetically incorrect content
```
LOCATION: Generator prompt (exclusion list)
CHANGE: Add exclusion list as a const at module scope:
  const IRREGULAR_WORDS = ['one', 'two', 'four', 'eight', 'there', 'were', 'done', 'gone'];
  Then inject into prompt: "EXCLUDE these irregular-spelling words: ${IRREGULAR_WORDS.join(', ')}"

WARNING: Do NOT add suffix-matching validators for phonetic content.
  Suffix matching fails for irregular words and creates false negatives.
  PREFER: Exclude problematic inputs via prompt over validating outputs.
```

#### SP-8: LLM can't compute character offsets
```
LOCATION: Generator post-process
CHANGE: Recompute all startIndex/endIndex from the generated text:
  for (const instance of data.instances) {
    const idx = passage.indexOf(instance.text);
    if (idx >= 0) {
      instance.startIndex = idx;
      instance.endIndex = idx + instance.text.length;
    }
  }
NOTE: Always trust .indexOf() over LLM-generated offsets.
```

#### SP-9: Generator ignores type constraint
```
LOCATION: Generator eval-mode wiring
4-POINT CHECK:
  1. Does the generator call resolveEvalModeConstraint()? If no → add it.
  2. Does it call constrainChallengeTypeEnum() with correct SchemaConstraintConfig?
     If no → add it (check fieldName: 'mode'/'type'/'operation', rootLevel, arrayName).
  3. Does the generator registration in registry/generators/<domain>Generators.ts
     spread ...item.config? If no → fix it.
  4. Does buildChallengeTypePromptSection() replace hardcoded type docs?
     If no → refactor prompt to use ${challengeTypeSection}.
```

### Implementation Rules

- **For prompt/schema changes**, surgical edits are fine — generators have clear sections.
- **For orchestrator refactors**, write complete file replacement (Write tool). Follow the pattern in `gemini-tape-diagram.ts` / `gemini-sorting-station.ts`:
  - Per-mode schemas (flat, only fields for that type — no multi-purpose fields)
  - Per-mode sub-generator functions with focused prompts
  - Shared helpers for common transforms (e.g., `toLuminaObjects()`, `deriveCategories()`)
  - Orchestrator dispatches allowed types via `Promise.all`, combines results
  - Same exported function signature — callers don't change
- **For component changes**, write complete file replacements (per CLAUDE.md convention).
- **Never remove a working validator** without replacing it with something (prompt constraint or better validator).
- **Prefer derivation over validation.** If the correct value can be computed from other generated fields (categories from object attributes, indices from text via `.indexOf()`), derive it deterministically rather than validating the LLM's attempt. Derivation is correct by construction; validation can have false negatives.
- **If adding a post-process function**, name it descriptively: `validateRecognitionContent()`, `clampOperandRange()`, `recomputeCharOffsets()`.
- **If adding an exclusion list**, define it as a const array at module scope, not inline in the prompt string.

---

## Phase 4: Verify

### 4a. Type Check (mandatory)

```bash
cd my-tutoring-app && npx tsc --noEmit
```

Fix any type errors before proceeding.

### 4b. Re-test Fixed Modes

For each issue that was fixed, re-run the eval-test API:

```bash
curl -s "http://localhost:3000/api/lumina/eval-test?componentId=<id>&evalMode=<mode>"
```

If connection refused, tell the user: `cd my-tutoring-app && npm run dev`

**Check:**
1. Status is `pass`
2. Generated data no longer exhibits the reported bug
3. Challenge types match the eval mode constraint
4. No new issues introduced

### 4c. Re-test ALL Modes (regression check)

Re-run every eval mode for the primitive, not just the fixed one. Prompt and post-process changes can affect other modes.

```bash
curl -s "http://localhost:3000/api/lumina/eval-test?componentId=<id>&evalMode=<mode1>"
curl -s "http://localhost:3000/api/lumina/eval-test?componentId=<id>&evalMode=<mode2>"
# ... all modes
```

Display results:

```
Re-test Results: <primitive-id>
| Eval Mode | Before | After  | Notes |
|-----------|--------|--------|-------|
| mode1     | FAIL   | PASS   | Fixed: <issue-id> |
| mode2     | PASS   | PASS   | No regression |
| mode3     | PASS   | FAIL   | REGRESSION — <describe> |
```

**If a regression is found:** fix it before proceeding. If the fix and the regression are in tension, inform the user and propose alternatives.

### 4d. Stochastic Issue Check

For issues tagged SP-7 (phonetically incorrect content) or described as "stochastic":
- Run the failing mode **3 times**
- If 2/3 pass, the fix is working — note as stochastic in report
- If 0/3 pass, the fix didn't work — go back to Phase 3

---

## Phase 5: Update Reports & Tracker

### 5a. Update the Eval Report

Overwrite `my-tutoring-app/qa/eval-reports/<primitive-id>-<YYYY-MM-DD>.md`:

- Update the Results table with new PASS/FAIL status
- Move fixed issues to a Notes section describing what was fixed
- Add any new issues discovered during re-testing

### 5b. Update the Eval Tracker

Update `my-tutoring-app/qa/EVAL_TRACKER.md`:

1. **Status Dashboard** — update passed/failed counts for this primitive
2. **Open Issues table** — remove rows for fixed issues
3. **Resolved Issues table** — add rows with date and fix description
4. **Systemic Patterns** — update SP-\* entries if the fix affects the pattern status
5. **Recalculate Totals** line

### 5c. Summary to User

```
Eval Fix Complete: <primitive-id>

Fixed:
  + <issue-id>: <1-line summary> (<fix category>)

Deferred:
  ~ <issue-id>: COMPONENT-SIDE — <reason>

Regressions: None

Files Modified:
  - service/<domain>/gemini-<id>.ts (prompt + post-process)
  - qa/eval-reports/<id>-<date>.md
  - qa/EVAL_TRACKER.md

Verification:
  - TypeScript: compiles
  - Eval-test: <N>/<M> modes passing (was <X>/<M>)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `qa/EVAL_TRACKER.md` | Central issue tracker — read first, update last |
| `qa/eval-reports/<id>-<date>.md` | Per-primitive eval report |
| `service/<domain>/gemini-<primitive>.ts` | Generator: prompt, schema, post-process |
| `primitives/visual-primitives/<domain>/<Name>.tsx` | Component: rendering, state, interaction |
| `service/manifest/catalog/<domain>.ts` | Catalog: eval mode definitions |
| `service/registry/generators/<domain>Generators.ts` | Generator registration (config propagation) |
| `service/evalMode/index.ts` | Shared eval mode utilities (do NOT modify) |
| `src/app/api/lumina/eval-test/route.ts` | Eval test API endpoint |

All paths relative to `my-tutoring-app/src/components/lumina/` unless otherwise noted.

## Checklist

- [ ] Read eval tracker and report before touching code
- [ ] Read generator and component source
- [ ] Classified each issue with decision tree → fix category + SP-\* pattern
- [ ] Proposed fix strategy to user and received approval
- [ ] Ran complexity check — considered simplify/orchestrate before piling on post-processing
- [ ] Applied fixes in order: wiring → prompt → schema → derive → validate → orchestrate → component
- [ ] Preferred derivation over validation where possible
- [ ] Checked fix approach guide — post-process validators won't create false negatives
- [ ] TypeScript compiles cleanly (`npx tsc --noEmit`)
- [ ] Re-tested the fixed eval mode(s)
- [ ] Re-tested ALL modes for regressions
- [ ] For stochastic issues: tested 3x
- [ ] Updated eval report
- [ ] Updated eval tracker — dashboard, issues, resolved, totals
- [ ] Reported summary to user
