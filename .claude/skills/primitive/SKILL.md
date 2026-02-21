# Add New Lumina Primitive

All primitive code lives under `my-tutoring-app/src/components/lumina/`. Do NOT search in `src/components/primitives/`, `src/services/`, `src/types/`, `src/registry/`, or `src/catalog/` — those paths do not exist.

All paths below are relative to `my-tutoring-app/src/components/`.

## Context Efficiency: Main Agent + Subagent Handoffs

This skill is designed for **context efficiency**. The main agent handles the creative work (designing and writing the component), then delegates mechanical registration tasks to parallel subagents. Each subagent reads only the 1-2 files it needs — the main agent never loads the full docs.

**DO NOT read `ADDING_PRIMITIVES.md` or `ADDING_TUTORING_SCAFFOLD.md`** — those are 1500+ lines of reference docs meant for humans. Everything you need is in this skill file.

---

## Phase 1: Gather Requirements (Main Agent)

Ask the user for:
- **Primitive name** (e.g., "CountingBoard", "FractionBar")
- **Domain** (math, engineering, literacy, astronomy, physics, science, media, assessment, core)
- **Purpose** (what it teaches)
- **Interactive or display-only?** (interactive = evaluation + tutoring)
- **Grade range** (K-2, 3-5, 6-8, 9-12, etc.)

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

**RECOMMENDED: Use `PhaseSummaryPanel` for multi-phase primitives.**

If the primitive has 2+ phases that each produce a score, add a phase evaluation summary screen when all phases complete. Import from `../../../components/PhaseSummaryPanel`.

```tsx
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';

// Compute phase results from your scoring state
const phaseSummaryData = useMemo((): PhaseResult[] => {
  if (!hasSubmittedEvaluation) return [];
  return [
    { label: 'Phase 1 Name', score: p1Score, attempts: p1Attempts, firstTry: p1Attempts === 1, icon: '🔢', accentColor: 'purple' },
    { label: 'Phase 2 Name', score: p2Score, attempts: p2Attempts, firstTry: p2Attempts === 1, icon: '🎯', accentColor: 'emerald' },
  ];
}, [hasSubmittedEvaluation, /* ...phase deps */]);

// Render after evaluation submission (after feedback bar)
{hasSubmittedEvaluation && phaseSummaryData.length > 0 && (
  <PhaseSummaryPanel
    phases={phaseSummaryData}
    overallScore={submittedResult?.score}
    durationMs={elapsedMs}
    heading="Challenge Complete!"
    celebrationMessage="You completed all phases!"
    className="mb-6"
  />
)}
```

Destructure `submittedResult` and `elapsedMs` from `usePrimitiveEvaluation` — they're already returned by the hook.

Enhance the `[ALL_COMPLETE]` sendText with per-phase scores so the AI tutor gives phase-specific feedback:
```tsx
sendText(
  `[ALL_COMPLETE] Phase scores: Phase 1 ${p1}% (${a1} attempts), Phase 2 ${p2}% (${a2} attempts). Overall: ${overall}%. Give encouraging phase-specific feedback.`,
  { silent: true }
);
```

**Skip PhaseSummaryPanel** for single-phase primitives or non-evaluable display components. Reference: `FractionBar.tsx`.

### 2c. Identify outputs for subagents

After writing the component, note:
- The **component ID** (kebab-case, e.g., `counting-board`)
- The **exported data interface name** (e.g., `CountingBoardData`)
- The **component file path** relative to lumina/
- Whether it's **interactive** (needs evaluation + tutoring)
- The **pedagogical moments** you wired (for catalog tutoring field)
- The **key data fields** the AI tutor needs to see (for contextKeys)

---

## Phase 3: Parallel Subagent Handoffs

After the component is written, launch **4 parallel subagents** using the Task tool. Each reads only the files it needs.

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

Tasks:
1. Read one existing generator from the same domain for the pattern:
   - `my-tutoring-app/src/components/lumina/service/<domain>/gemini-<existing>.ts`

2. Create `my-tutoring-app/src/components/lumina/service/<domain>/gemini-<id>.ts`:
   - Import `{ Type, Schema } from "@google/genai"` and `{ ai } from "../geminiClient"`
   - Import `{ <Name>Data } from '../../primitives/visual-primitives/<domain>/<Name>'` (NEVER redefine the interface)
   - Define a Gemini JSON schema matching the data interface
   - Export `generate<Name>` function with signature: `(topic: string, gradeLevel: string, config?: Partial<...>) => Promise<<Name>Data>`
   - Use model `"gemini-flash-lite-latest"` with `responseMimeType: "application/json"`
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

Tasks:
1. Read `my-tutoring-app/src/components/lumina/service/manifest/catalog/<domain>.ts` to see the existing pattern

2. Add a new entry to the catalog array:
   ```typescript
   {
     id: '<id>',
     description: '<Clear description>. Perfect for <use case>. ESSENTIAL for <grade> <subject>.',
     constraints: '<Any limitations>',
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

---

## Phase 4: Type Check (Main Agent)

After all subagents complete, run: `cd my-tutoring-app && npx tsc --noEmit`

Fix any errors. Common issues:
- Missing `ComponentId` entry in types.ts
- Import path typos
- Metrics not added to PrimitiveMetrics union

## Phase 5: Report (Main Agent)

Report to the user:
- Files created/modified (list all)
- Pedagogical moments wired (if interactive)
- sendText tags defined
- Tutoring scaffold added (or why skipped for display-only)

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
