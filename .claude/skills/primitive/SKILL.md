# Add New Lumina Primitive

All primitive code lives under `my-tutoring-app/src/components/lumina/`. Do NOT search in `src/components/primitives/`, `src/services/`, `src/types/`, `src/registry/`, or `src/catalog/` — those paths do not exist.

All paths below are relative to `my-tutoring-app/src/components/`.

## Architecture: Sequential Focused Agents

This skill uses **sequential agent phases** to maximize quality at each step. The main agent handles creative work (component design), then hands off to focused agents with tight mandates:

```
Phase 1: Requirements        (main agent)
Phase 2: Component            (main agent — creative work)
Phase 3: Mechanical registration (4-5 parallel subagents — types, catalog, eval, tester, backend)
Phase 4: Generator             (FOCUSED agent — schema, prompt, post-validation)
Phase 5: Type check            (main agent — compile everything)
Phase 6: QA                    (FOCUSED agent — eval-test + G1-G5 sync rules)
Phase 7: Report / Fix loop     (main agent)
```

**Why the generator gets its own phase:** The generator is where quality lives or dies. It needs the component's render logic as input (to know which fields are required per challenge type) and focused attention on schema design and post-validation. Doing it in parallel with mechanical tasks produces sloppy generators.

**DO NOT read `ADDING_PRIMITIVES.md` or `ADDING_TUTORING_SCAFFOLD.md`** — those are 1500+ lines of reference docs meant for humans. Everything you need is in this skill file.

---

## Phase 1: Gather Requirements (Main Agent)

**If a PRD file is passed as an argument**, extract all requirements from it instead of asking the user. Read the PRD, identify the primitive(s) defined, and confirm with the user which one(s) to build. PRDs typically specify: name, domain, data structure, eval modes, challenge types, tutoring scaffold, and metrics — skip any questions already answered by the PRD.

**Otherwise**, ask the user for:
- **Primitive name** (e.g., "CountingBoard", "FractionBar")
- **Domain** (math, engineering, literacy, astronomy, physics, science, media, assessment, core)
- **Purpose** (what it teaches)
- **Interactive or display-only?** (interactive = evaluation + tutoring)
- **Grade range** (K-2, 3-5, 6-8, 9-12, etc.)
- **Challenge types** (if interactive with 2+ types: what are the distinct difficulty modes? e.g., build/subitize/make_ten/add/subtract)

## Phase 2: Design & Write the Component (Main Agent)

This is the **only creative work**. Read ONE reference component from the same domain for patterns, then design and write the component.

### 2a. Read a reference component

Pick one from the same domain:

| Domain | Good Reference Component |
|--------|-------------------------|
| math | `lumina/primitives/visual-primitives/math/CountingBoard.tsx` |
| engineering | `lumina/primitives/visual-primitives/engineering/TowerStacker.tsx` |
| astronomy | `lumina/primitives/visual-primitives/astronomy/MissionPlanner.tsx` |
| literacy | `lumina/primitives/visual-primitives/literacy/PhonicsBlender.tsx` |
| physics | `lumina/primitives/visual-primitives/physics/InclinedPlane.tsx` |
| core (explore+challenge) | `lumina/primitives/visual-primitives/core/FactFile.tsx` |
| core (timed drill) | `lumina/primitives/visual-primitives/core/FastFact.tsx` |

### 2b. Write the component

Create: `lumina/primitives/visual-primitives/<domain>/<Name>.tsx`

**Must follow these patterns:**

```tsx
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../evaluation';
import type { <Name>Metrics } from '../../evaluation/types';

// EXPORT the data interface — this is the single source of truth
export interface <Name>Data {
  title: string;
  description: string;
  // ... domain-specific fields ...

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<<Name>Metrics>) => void;
}
```

**UI rules:**
- Use shadcn/ui components (Card, Button, Badge, Accordion, etc.)
- Lumina theming: `backdrop-blur-xl bg-slate-900/40 border-white/10`
- Buttons: `variant="ghost" className="bg-white/5 border border-white/20 hover:bg-white/10"`
- Text: `text-slate-100` (primary), `text-slate-400` (secondary)

**If interactive, add AI tutoring triggers:**

```tsx
const { sendText } = useLuminaAI({
  primitiveType: '<id>',
  instanceId: resolvedInstanceId,
  primitiveData: aiPrimitiveData,
  gradeLevel,
});

// At pedagogical moments:
sendText('[ANSWER_CORRECT] Student answered correctly. Congratulate briefly.', { silent: true });
sendText('[ANSWER_INCORRECT] Student chose "X" but correct is "Y". Give a hint.', { silent: true });
sendText('[NEXT_ITEM] Moving to item N of M. Introduce it briefly.', { silent: true });
sendText('[ALL_COMPLETE] Student finished all items! Celebrate.', { silent: true });
```

**Rules for sendText:**
- Always use `{ silent: true }` — system-to-AI messages, not student chat
- Use bracketed tags: `[ANSWER_CORRECT]`, `[NEXT_ITEM]`, etc.
- Include context (student answer, correct answer, attempt count)
- Only trigger at moments where a human tutor would speak

**RECOMMENDED: Use shared hooks + `PhaseSummaryPanel` for multi-phase primitives.**

If the primitive has 2+ phases with sequential challenges, use the shared hooks to eliminate boilerplate:

```tsx
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// Module-level phase config
const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  build:    { label: 'Build',    icon: '🧱', accentColor: 'purple' },
  subitize: { label: 'Subitize', icon: '👁️', accentColor: 'blue' },
};

// Inside the component — replaces ~100 lines of manual state + useMemo:
const {
  currentIndex: currentChallengeIndex,
  currentAttempts,
  results: challengeResults,
  isComplete: allChallengesComplete,
  recordResult,       // replaces setChallengeResults(prev => [...prev, {...}])
  incrementAttempts,  // replaces setCurrentAttempts(a => a + 1)
  advance: advanceProgress,  // replaces setIndex(i+1); setAttempts(0)
} = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

const phaseResults = usePhaseResults({
  challenges, results: challengeResults, isComplete: allChallengesComplete,
  getChallengeType: (ch) => ch.type,
  phaseConfig: PHASE_TYPE_CONFIG,
  // Optional: custom scoring (default: correct/total * 100)
  // getScore: (rs) => Math.round(rs.reduce((s, r) => s + (r.score ?? 0), 0) / rs.length),
});
```

In check functions use `incrementAttempts()`. In handleCheckAnswer use `recordResult({...})`.
In advanceToNextChallenge: `if (!advanceProgress()) { /* all done — submit eval */ return; }` then reset domain-specific state.

Render the summary:
```tsx
{allChallengesComplete && phaseResults.length > 0 && (
  <PhaseSummaryPanel
    phases={phaseResults}
    overallScore={submittedResult?.score ?? localOverallScore}
    durationMs={elapsedMs}
    heading="Challenge Complete!"
    celebrationMessage="You completed all phases!"
    className="mb-6"
  />
)}
```

Use `phaseResults` for `[ALL_COMPLETE]` AI message:
```tsx
const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
sendText(`[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. Give encouraging phase-specific feedback.`, { silent: true });
```

**Skip shared hooks** for single-phase primitives or non-evaluable display components. Reference: `TenFrame.tsx`, `CountingBoard.tsx`.

### 2c. Identify outputs for subagents

After writing the component, note:
- The **component ID** (kebab-case, e.g., `counting-board`)
- The **exported data interface name** (e.g., `CountingBoardData`)
- The **component file path** relative to lumina/
- Whether it's **interactive** (needs evaluation + tutoring)
- The **pedagogical moments** you wired (for catalog tutoring field)
- The **key data fields** the AI tutor needs to see (for contextKeys)
- Whether it has **2+ challenge types** that warrant eval modes (for IRT difficulty targeting)
- The **required fields per challenge type** — for each `render<Type>Challenge()` function in the component, list every data field it reads. This is the CONTRACT the generator must fulfill.

**IMPORTANT — Required Fields Manifest:** Before proceeding to Phase 3, create a structured list like this:

```
REQUIRED FIELDS PER CHALLENGE TYPE:
- type="identify": targetCoin (answer), options[] (MC choices), coins[] (visual display)
- type="count": displayedCoins[] (visual), correctTotal (answer, must equal sum of displayedCoins)
- type="compare": groupA[] (visual), groupB[] (visual), correctGroup (answer, must match actual totals)
```

This manifest is passed to the Generator Agent in Phase 4. It prevents the #1 source of bugs: generators producing data the component can't render.

---

## Phase 3: Parallel Mechanical Subagents

After the component is written, launch **4-5 parallel subagents** using the Agent tool. Each reads only the files it needs. These are all mechanical registration tasks — no creative decisions.

**IMPORTANT: The generator is NOT built here.** It gets its own focused phase next.

### Subagent A: "Register types & primitive UI"

Prompt template:
```
Register a new Lumina primitive in the type system and UI registry.

Component ID: `<id>`
Component name: `<Name>`
Domain: `<domain>`
Data interface: `<Name>Data`
Component file: `lumina/primitives/visual-primitives/<domain>/<Name>.tsx`
Interactive: <yes/no>

Tasks:
1. Read `my-tutoring-app/src/components/lumina/types.ts`
   - Add `'<id>'` to the `ComponentId` union type (find the union, add alphabetically)
   - Add re-export: `export type { <Name>Data } from './primitives/visual-primitives/<domain>/<Name>';`

2. Read `my-tutoring-app/src/components/lumina/config/primitiveRegistry.tsx`
   - Add import: `import <Name> from '../primitives/visual-primitives/<domain>/<Name>';`
   - Add registry entry in PRIMITIVE_REGISTRY:
     ```
     '<id>': {
       component: <Name>,
       sectionTitle: '<Display Name>',
       showDivider: true,
       dividerStyle: 'left',
       allowMultiple: true,
       containerClassName: 'max-w-6xl mx-auto mb-20',
       supportsEvaluation: <true if interactive>,
     },
     ```

Both edits are append operations — match the existing style in each file.
```

### Subagent B: "Add catalog entry with tutoring"

Prompt template:
```
Add a catalog entry for a new Lumina primitive so the AI can select it.

Component ID: `<id>`
Purpose: <what the primitive teaches>
Grade range: <grade range>
Interactive: <yes/no>
Pedagogical moments: <list from Phase 2c>
Key data fields for AI tutor: <list from Phase 2c>
Has eval modes: <yes/no — yes if 2+ challenge types>
Eval modes (if yes): <list of { evalMode, label, beta, scaffoldingMode, challengeTypes, description }>

Tasks:
1. Read `my-tutoring-app/src/components/lumina/service/manifest/catalog/<domain>.ts` to see the existing pattern

2. Add a new entry to the catalog array:
   ```typescript
   {
     id: '<id>',
     description: '<Clear description>. Perfect for <use case>. ESSENTIAL for <grade> <subject>.',
     constraints: '<Any limitations>',
     <if eval modes, add evalModes field:>
     evalModes: [
       {
         evalMode: '<mode_key>',
         label: '<Mode Label (Tier)>',
         beta: <IRT prior beta>,
         scaffoldingMode: <1-6>,
         challengeTypes: ['<type1>'],
         description: '<What this mode tests>',
       },
       // ... more modes, ordered lowest beta to highest beta
     ],
     <if interactive, add tutoring field:>
     tutoring: {
       taskDescription: '<What the student is doing. Use {{key}} for runtime values.>',
       contextKeys: [<list of primitive_data keys the AI needs>],
       scaffoldingLevels: {
         level1: '"<Gentle nudge — ask a question>"',
         level2: '"<Specific guidance — break into steps, use {{key}}>"',
         level3: '"<Detailed walkthrough — step-by-step with concrete details>"',
       },
       commonStruggles: [
         { pattern: '<Observable behavior>', response: '<Actionable tutor response>' },
       ],
     },
     supportsEvaluation: true,
   },
   ```

Rules for tutoring field:
- taskDescription describes WHAT the student is doing, not what AI should say
- Use {{key}} for runtime primitive_data values
- Never give the answer at any scaffolding level
- commonStruggles describe OBSERVABLE behavior, not vague labels
```

### Subagent C: "Evaluation types & tester"

Prompt template (only if interactive):
```
Add evaluation metrics and tester entry for a new Lumina primitive.

Component ID: `<id>`
Component name: `<Name>`
Domain: `<domain>`
Data interface: `<Name>Data`

Tasks:
1. Read `my-tutoring-app/src/components/lumina/evaluation/types.ts`
   - Add metrics interface:
     ```typescript
     export interface <Name>Metrics extends BasePrimitiveMetrics {
       type: '<id>';
       // Add domain-specific metrics (accuracy, goalMet, attempts, etc.)
     }
     ```
   - Add to `PrimitiveMetrics` union type

2. Read `my-tutoring-app/src/components/lumina/evaluation/index.ts`
   - Add `<Name>Metrics` to the type exports

3. Read `my-tutoring-app/src/components/lumina/components/<Domain>PrimitivesTester.tsx`
   - Add import for the component
   - Add to PrimitiveType union
   - Add to PRIMITIVE_OPTIONS array with appropriate icon and topic
   - Add render case in the component (follow existing pattern — do NOT pass onEvaluationSubmit to avoid double submission)
```

### Subagent D: "Backend problem type registry" (only if eval modes)

Prompt template:
```
Register eval mode prior betas for a new Lumina primitive in the backend calibration registry.

Component ID: `<id>`
Eval modes: <list of { evalMode, beta, description }>

Tasks:
1. Read `backend/app/services/calibration/problem_type_registry.py`
   - Find the `PROBLEM_TYPE_REGISTRY` dict
   - Add a new entry at the end (before the closing `}`), in the appropriate section:
     ```python
     "<id>": {
         "<eval_mode>": PriorConfig(<beta>, "<description>"),
         # ... more modes
     },
     ```
   - Beta values MUST match the catalog entry exactly
   - Use the existing comment-section style (e.g., `# Core / general-content primitives`)

Write the edit. Do not just describe the change.
```

---

## Phase 4: Focused Generator Agent

**This is the most important phase.** The generator determines whether the primitive actually works. Launch a single focused agent with a tight mandate.

**Why separate:** The generator needs to understand the component's render paths to know which fields are truly required per challenge type. It also needs focused attention on schema design (flat vs nested, required vs nullable) and post-validation (reject vs fallback). This work should not compete for context with mechanical registration.

### Generator Agent Prompt Template

```
Create a Gemini content generator for a Lumina primitive. This is the MOST CRITICAL file —
it determines whether the primitive renders correctly or breaks silently.

## Primitive Context

Component ID: `<id>`
Data interface: `<Name>Data`
Import path: `../../primitives/visual-primitives/<domain>/<Name>`
Domain: `<domain>`
Purpose: <what the primitive teaches>
Grade range: <grade range>

## REQUIRED FIELDS CONTRACT

These fields MUST be present in the generator output for each challenge type.
The component READS these fields — if any are missing, the challenge renders broken.

<paste the Required Fields Manifest from Phase 2c>

## Your Tasks

### Task 1: Read reference files

1. Read the component file to understand exactly what fields each render function reads:
   `my-tutoring-app/src/components/lumina/primitives/visual-primitives/<domain>/<Name>.tsx`

2. Read ONE existing generator from the same domain for patterns:
   `my-tutoring-app/src/components/lumina/service/<domain>/gemini-<existing>.ts`

### Task 2: Design the schema

Design a Gemini JSON schema that reliably produces valid data.

**CRITICAL SCHEMA RULES:**

1. **Decide: single-type sub-generators vs multi-type schema.**
   - If 3+ challenge types: USE the orchestrator pattern (one Gemini call per type).
     Each sub-generator has a simpler schema with NO nullable fields. See `gemini-tape-diagram.ts`.
   - If 1-2 challenge types: a single schema is OK, but minimize nullable fields.

2. **Flatten arrays inside challenge objects** to avoid malformed LLM JSON:
   - `options: string[]` → `option0`, `option1`, `option2`, `option3`
   - `coins: {type, count}[]` → `coin0Type`/`coin0Count` through `coin3Type`/`coin3Count`
   - After Gemini call, reconstruct arrays from flat fields.

3. **NEVER make a field nullable if the component reads it without a fallback.**
   Cross-check against the Required Fields Contract above. If the component's render function
   reads `challenge.displayedCoins` and renders it directly, then `displayedCoin0Type` must NOT
   be nullable — it must be required for that challenge type.

4. **If using multi-type schema with nullable fields:** After flat-field reconstruction,
   VALIDATE that each challenge has all required fields for its type. REJECT (return null)
   any challenge missing critical data. NEVER silently fall back to a default value.

### Task 3: Write the generator

Create: `my-tutoring-app/src/components/lumina/service/<domain>/gemini-<id>.ts`

Structure:
```typescript
import { Type, Schema } from "@google/genai";
import { <Name>Data } from "../../primitives/visual-primitives/<domain>/<Name>";
import { ai } from "../geminiClient";

// If 2+ challenge types, import eval mode utilities:
import {
  resolveEvalModeConstraint, constrainChallengeTypeEnum,
  buildChallengeTypePromptSection, logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// If 2+ challenge types, define CHALLENGE_TYPE_DOCS:
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  '<type>': {
    promptDoc: `"<type>": <detailed description of what Gemini should generate>`,
    schemaDescription: "'<type>' (<short label>)",
  },
};

// Schema definition...
// Generator function...
// Post-validation...
```

**Generator function signature:**
```typescript
export const generate<Name> = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<<Name>Data> => { ... };
```

**Post-validation checklist (MANDATORY):**
1. After Gemini returns, reconstruct arrays from flat fields
2. For EACH challenge, validate required fields per type (use the contract)
3. REJECT challenges missing required fields (return null, filter nulls)
4. Recompute derived answers from visual data (e.g., correctTotal from displayedCoins)
5. Log rejection counts so we can debug
6. If all challenges rejected, use type-appropriate hardcoded fallback
7. If eval mode requires semantic differentiation beyond challengeType
   (e.g., "count-like" = single coin type), apply post-filter

**Anti-patterns to AVOID:**
- `correctTotal ?? 10` — silent fallback masks broken generation
- `challenge.options = options ?? ['a','b','c','d']` — hardcoded fallback produces static challenges
- Accepting a challenge with empty visual data (no coins, no groups, no items to interact with)

### Task 4: Register the generator

Read `my-tutoring-app/src/components/lumina/service/registry/generators/<domain>Generators.ts`
- Add import: `import { generate<Name> } from '../../<domain>/gemini-<id>';`
- Add registration:
  ```
  registerGenerator('<id>', async (item, topic, gradeContext) => ({
    type: '<id>',
    instanceId: item.instanceId,
    data: await generate<Name>(topic, gradeContext, item.config),
  }));
  ```

### Task 5: Self-verify

After writing the generator, mentally trace one challenge through:
1. Gemini returns flat fields → reconstruction → validation → component render
2. For each required field in the contract, confirm the generator either:
   a. Produces it reliably (non-nullable in schema), OR
   b. Derives it in post-validation, OR
   c. Rejects the challenge if missing

If any required field can reach the component as undefined/empty, fix the generator before finishing.
```

---

## Phase 5: Type Check (Main Agent)

After all agents complete, run: `cd my-tutoring-app && npx tsc --noEmit`

Fix any errors. Common issues:
- Missing `ComponentId` entry in types.ts
- Import path typos
- Metrics not added to PrimitiveMetrics union

**Known pre-existing error to IGNORE:** `ManifestViewer.tsx` has an incomplete `Record<ComponentId, string>` that is missing 140+ component IDs. This error predates your changes — do not try to fix it.

---

## Phase 6: QA Agent

After type-check passes, launch a focused QA agent that runs eval-test and verifies generator↔component sync.

**Only run if the primitive has eval modes.** Skip for display-only or single-phase primitives.

### QA Agent Prompt Template

```
You are QA-testing a newly created Lumina primitive. Your job is to verify
the generator produces data that the component can actually render correctly.

## Primitive Context

Component ID: `<id>`
Component file: `my-tutoring-app/src/components/lumina/primitives/visual-primitives/<domain>/<Name>.tsx`
Generator file: `my-tutoring-app/src/components/lumina/service/<domain>/gemini-<id>.ts`
Eval modes: <list of eval mode keys>

## REQUIRED FIELDS CONTRACT
<paste the same manifest from Phase 2c>

## Your Tasks

### Task 1: Run eval-test for every eval mode

For each eval mode:
```bash
curl -s "http://localhost:3000/api/lumina/eval-test?componentId=<id>&evalMode=<mode>"
```

If connection refused, STOP and report: "Dev server not running — user must start it."

Display the response JSON for the user.

### Task 2: Apply G1-G5 Sync Rules

For each eval mode's response, check ALL of these:

**G1 — Required fields per challenge type:**
For each challenge in fullData, check every field in the Required Fields Contract.
If a required field is missing or empty, flag as CRITICAL.

**G2 — Flat-field reconstruction audit:**
If the generator uses flat indexed fields (e.g., option0, option1), check whether
reconstruction actually produced arrays. If >50% of challenges have empty arrays, flag CRITICAL.

**G3 — Eval mode semantic differentiation:**
If two eval modes share the same challengeTypes, verify their output actually differs.
Generate both and compare. If indistinguishable, flag HIGH.

**G4 — Answer derivability:**
For each challenge, verify the correct answer can be computed from the visible data:
- MC: correct answer is in the options array
- Numeric: correctTotal equals sum of displayed items
- Comparison: correctGroup matches actual group totals
If not, flag CRITICAL.

**G5 — Fallback quality audit:**
Read the generator source. Find all fallback expressions (??, ||, ternary with default).
For each one:
- Is it reachable in normal operation? (Check if Gemini typically provides the field)
- If it fires, does it produce a correct challenge?
- If it fires for >30% of challenges, flag HIGH.

### Task 3: Report results

Print a results table:
```
QA Results — <id>
| Eval Mode | API Status | Challenges | G1 | G2 | G3 | G4 | G5 | Verdict |
|-----------|-----------|------------|----|----|----|----|----| --------|
| <mode>    | pass      | 5          | OK | OK | OK | OK | OK | PASS    |
```

For any failures, include:
- Which rule failed (G1-G5)
- Which challenge(s) are affected
- What field is missing/wrong
- Whether the fix should go in GENERATOR, COMPONENT, or CATALOG

### Task 4: Fix issues (if any)

If any G1-G5 checks fail:
1. Read the generator source
2. Identify the root cause (missing validation, silent fallback, unreliable schema field)
3. Fix the generator
4. Re-run the curl to confirm the fix
5. Re-check the affected rules

Repeat until all modes pass all rules.

### Task 5: Save eval report

Save to: `my-tutoring-app/qa/eval-reports/<id>-<YYYY-MM-DD>.md`
Format:
```markdown
# Eval Report: <id> — <YYYY-MM-DD>

## Results
| Eval Mode | Status | Issues |
|-----------|--------|--------|
| <mode>    | PASS   | —      |

## G1-G5 Sync Check: ALL PASS
(or list any issues found and fixed)
```
```

---

## Phase 7: Report (Main Agent)

After QA passes, report to the user:
- Files created/modified (list all)
- Pedagogical moments wired (if interactive)
- sendText tags defined
- Tutoring scaffold added (or why skipped for display-only)
- Eval modes added (if 2+ challenge types — list each mode with beta value)
- QA results (pass/fail per mode, any G1-G5 issues found and fixed)
- Backend problem_type_registry.py updated (if eval modes — confirm beta values match catalog)

**If QA found and fixed issues**, mention what was caught and how. This validates the phased approach.

---

## Domain Directory Reference

| Domain | Component Dir | Generator Dir | Catalog | Generator Registry | Tester |
|--------|--------------|---------------|---------|-------------------|--------|
| astronomy | `primitives/visual-primitives/astronomy/` | `service/astronomy/` | `catalog/astronomy.ts` | `generators/astronomyGenerators.ts` | `components/AstronomyPrimitivesTester.tsx` |
| math | `primitives/visual-primitives/math/` | `service/math/` | `catalog/math.ts` | `generators/mathGenerators.ts` | `components/MathPrimitivesTester.tsx` |
| engineering | `primitives/visual-primitives/engineering/` | `service/engineering/` | `catalog/engineering.ts` | `generators/engineeringGenerators.ts` | `components/EngineeringPrimitivesTester.tsx` |
| physics | `primitives/visual-primitives/physics/` | `service/physics/` | `catalog/physics.ts` | `generators/physicsGenerators.ts` | `components/PhysicsPrimitivesTester.tsx` |
| science | `primitives/visual-primitives/science/` | `service/science/` | `catalog/science.ts` | `generators/scienceGenerators.ts` | N/A |
| literacy | `primitives/visual-primitives/literacy/` | `service/literacy/` | `catalog/literacy.ts` | `generators/literacyGenerators.ts` | N/A |
| media | `primitives/visual-primitives/media/` | `service/media/` | `catalog/media.ts` | `generators/mediaGenerators.ts` | N/A |
| assessment | `primitives/visual-primitives/assessment/` | `service/assessment/` | `catalog/assessment.ts` | N/A | N/A |
| core | `primitives/visual-primitives/core/` | `service/core/` | `catalog/core.ts` | `generators/coreGenerators.ts` | N/A |

## Index Files to Update

When adding a **new domain** (not new primitive in existing domain), also update:
- `lumina/service/registry/generators/index.ts` — import new generator registry
- `lumina/service/manifest/catalog/index.ts` — import and spread new catalog array

## Key Rules

1. **Single source of truth**: Data interface defined and exported ONLY in the component file. Generator imports it.
2. **No double evaluation submission**: Tester does NOT pass `onEvaluationSubmit` — the `usePrimitiveEvaluation` hook handles context submission.
3. **Use shadcn/ui**: Cards, Buttons, Badges, Accordions — never custom div-based UI patterns.
4. **Write complete component files**: Use Write tool, not incremental edits, to prevent broken JSX.
5. **Required Fields Manifest**: Always create one in Phase 2c and pass it to Phases 4 and 6.
6. **Generator rejects, never silently falls back**: Missing visual data = reject challenge + log. Never `?? defaultValue` for fields the component renders.
7. **Orchestrator pattern for 3+ challenge types**: One Gemini call per type, simpler schemas, no nullable fields.

## PRD Reference

Primitive specs and requirements are documented in:
- `lumina/docs/space-primitives-prd.md` — Astronomy/space primitives
- `lumina/docs/lumina_difficulty_calibration_prd.md` — IRT calibration PRD (section 5.3 prior difficulty table for beta values)
- `lumina/docs/ADDING_EVAL_MODES.md` — Full eval modes implementation guide
