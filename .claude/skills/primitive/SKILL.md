# Add New Lumina Primitive

All primitive code lives under `my-tutoring-app/src/components/lumina/`. Do NOT search in `src/components/primitives/`, `src/services/`, `src/types/`, `src/registry/`, or `src/catalog/` — those paths do not exist.

All paths below are relative to `my-tutoring-app/src/components/`.

## Context Efficiency: Main Agent + Subagent Handoffs

This skill is designed for **context efficiency**. The main agent handles the creative work (designing and writing the component), then delegates mechanical registration tasks to parallel subagents. Each subagent reads only the 1-2 files it needs — the main agent never loads the full docs.

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

---

## Phase 3: Parallel Subagent Handoffs

After the component is written, launch **4-5 parallel subagents** using the Task tool. Each reads only the files it needs. Launch Subagent E only if the primitive has eval modes.

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

### Subagent B: "Create generator & register"

Prompt template:
```
Create a Gemini content generator for a new Lumina primitive and register it.

Component ID: `<id>`
Data interface: `<Name>Data`
Import path: `../../primitives/visual-primitives/<domain>/<Name>`
Domain: `<domain>`
Purpose: <what the primitive teaches>
Grade range: <grade range>
Eval mode constraint target: <which field on which array the challenge types map to, e.g., `challenges[].type` or `selfChecks[].difficulty`>

Tasks:
1. Read one existing generator from the same domain for the pattern:
   - `my-tutoring-app/src/components/lumina/service/<domain>/gemini-<existing>.ts`

2. Create `my-tutoring-app/src/components/lumina/service/<domain>/gemini-<id>.ts`:
   - Import `{ Type, Schema } from "@google/genai"` and `{ ai } from "../geminiClient"`
   - Import `{ <Name>Data } from '../../primitives/visual-primitives/<domain>/<Name>'` (NEVER redefine the interface)
   - If the primitive has 2+ challenge types, also import eval mode utilities:
     `import { resolveEvalModeConstraint, constrainChallengeTypeEnum, buildChallengeTypePromptSection, type ChallengeTypeDoc } from '../evalMode';`
   - If using eval modes, define a `CHALLENGE_TYPE_DOCS` record at the top with `promptDoc` + `schemaDescription` per challenge type (see `gemini-ten-frame.ts` for the pattern)
   - Define a Gemini JSON schema matching the data interface.
     **IMPORTANT — Flatten arrays inside challenge/item objects** to avoid malformed LLM JSON:
     - `options: string[]` → `option0`, `option1`, `option2`, `option3` (separate STRING fields)
     - `sequenceItems: {id, text}[]` → `orderItem0Id`/`orderItem0Text` through `orderItem4Id`/`orderItem4Text`
     - `matchPairs: {term, def}[]` → `matchTerm0`/`matchDef0` through `matchTerm3`/`matchDef3`
     - `relatedWords: string[]` → `relatedWord0`, `relatedWord1`, `relatedWord2`
     - `correctOrder: string[]` → `correctOrderCsv` (comma-separated string)
     - `correctPairs: [n,n][]` → `correctPairsCsv` (format: `"0-0,1-1,2-2"`)
     The validation function then reconstructs the nested arrays from flat fields.
     See `gemini-fact-file.ts` or `gemini-how-it-works.ts` for concrete examples.
   - Export `generate<Name>` function with signature: `(topic: string, gradeLevel: string, config?: Partial<...>) => Promise<<Name>Data>`
   - Config type should include `targetEvalMode?: string` if eval modes are used
   - Use model `"gemini-flash-lite-latest"` with `responseMimeType: "application/json"`
   - If eval modes: call `resolveEvalModeConstraint()`, `constrainChallengeTypeEnum()`, and `buildChallengeTypePromptSection()` before the Gemini call. `constrainChallengeTypeEnum()` targets the enum field specified by the eval mode constraint target (e.g., the `type` enum on `challenges[]` items, or `difficulty` enum on `selfChecks[]` items). Pass `activeSchema` (not base schema) to Gemini.
   - Add validation/defaults after parsing

3. Read `my-tutoring-app/src/components/lumina/service/registry/generators/<domain>Generators.ts`
   - Add import: `import { generate<Name> } from '../../<domain>/gemini-<id>';`
   - Add registration:
     ```
     registerGenerator('<id>', async (item, topic, gradeContext) => ({
       type: '<id>',
       instanceId: item.instanceId,
       data: await generate<Name>(topic, gradeContext, item.config),
     }));
     ```
```

### Subagent C: "Add catalog entry with tutoring"

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
         beta: <IRT prior β — must match backend problem_type_registry.py>,
         scaffoldingMode: <1-6>,
         challengeTypes: ['<type1>'],
         description: '<What this mode tests>',
       },
       // ... more modes, ordered lowest β → highest β
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
     supportsEvaluation: true,  // ← Add for evaluable primitives (used by practice-visual-catalog)
   },
   ```

Rules for tutoring field:
- taskDescription describes WHAT the student is doing, not what AI should say
- Use {{key}} for runtime primitive_data values
- Never give the answer at any scaffolding level
- commonStruggles describe OBSERVABLE behavior, not vague labels
```

### Subagent D: "Evaluation types & tester"

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

### Subagent E: "Backend problem type registry" (only if eval modes)

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

## Phase 4: Type Check (Main Agent)

After all subagents complete, run: `cd my-tutoring-app && npx tsc --noEmit`

Fix any errors. Common issues:
- Missing `ComponentId` entry in types.ts
- Import path typos
- Metrics not added to PrimitiveMetrics union

**Known pre-existing error to IGNORE:** `ManifestViewer.tsx` has an incomplete `Record<ComponentId, string>` that is missing 140+ component IDs. This error predates your changes — do not try to fix it.

## Phase 5: Smoke Test via Eval-Test API (Main Agent)

**Only if the primitive has eval modes (2+ challenge types).** Skip for display-only or single-phase primitives.

After type-check passes, curl the eval-test endpoint for each eval mode to verify the generator produces valid data that the component can render.

### 5a. Test each eval mode

For each eval mode defined in the catalog entry:

```bash
curl -s "http://localhost:3000/api/lumina/eval-test?componentId=<id>&evalMode=<mode>"
```

If connection refused, tell the user: `cd my-tutoring-app && npm run dev` and wait for them to confirm the dev server is running before retrying.

**Tip:** To extract summary fields from curl JSON on Windows (no python3), use node:
```bash
curl -s "URL" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(JSON.stringify({status:d.status,evalMode:d.evalMode,validation:d.validation},null,2))"
```

### 5b. Analyze the response

For each response, check:

1. **Status**: `status` field should be `"pass"`. If `"fail"` or `"error"`, report the error immediately.
2. **Challenge types**: `validation.typesFound` should only contain allowed types. `validation.disallowedTypes` should be empty/absent.
3. **Challenge count**: `validation.challengeCount` should be > 0 (generator actually produced challenges).
   - **Note:** The eval-test API only detects arrays named `challenges`, `words`, `instances`, `questions`, `items`, or `problems`. If your primitive uses a different array name (e.g., `selfChecks`, `events`, `terms`), `challengeCount: 0` is expected — verify the data shape manually in `fullData` instead.
4. **Data shape**: Read the component source and verify that `fullData` contains the fields the component destructures from its `Data` interface. Flag any missing required fields.
5. **Answer integrity**: Check that correct answers are not leaked in title, description, or hint fields visible before interaction.
6. **Math correctness**: For math primitives, spot-check that operands produce the claimed results.

### 5c. Report results inline

Print a compact results table:

```
Eval-Test Smoke Results:
| Eval Mode      | Status | Challenges | Types Found       | Issues |
|----------------|--------|------------|-------------------|--------|
| <mode>         | PASS   | 6          | [build, subitize] | —      |
```

**If any mode fails:**
- Show the error/validation message from the API
- Read the generator and component to diagnose the root cause
- Fix the issue (generator schema mismatch, missing field defaults, wrong type constraint)
- Re-run the curl to confirm the fix

**If ALL modes pass**, proceed to Phase 6.

---

## Phase 6: Report (Main Agent)

Report to the user:
- Files created/modified (list all)
- Pedagogical moments wired (if interactive)
- sendText tags defined
- Tutoring scaffold added (or why skipped for display-only)
- Eval modes added (if 2+ challenge types — list each mode with β value)
- Eval-test smoke results (pass/fail per mode)
- Backend problem_type_registry.py updated (if eval modes — confirm beta values match catalog)

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

## PRD Reference

Primitive specs and requirements are documented in:
- `lumina/docs/space-primitives-prd.md` — Astronomy/space primitives
- `lumina/docs/lumina_difficulty_calibration_prd.md` — IRT calibration PRD (§5.3 prior difficulty table for β values)
- `lumina/docs/ADDING_EVAL_MODES.md` — Full eval modes implementation guide
