# Add New Lumina Primitive

All primitive code lives under `my-tutoring-app/src/components/lumina/`. Do NOT search in `src/components/primitives/`, `src/services/`, `src/types/`, `src/registry/`, or `src/catalog/` — those paths do not exist.

All paths below are relative to `my-tutoring-app/src/components/`.

## Design contract — multi-instance is the default

Every evaluable primitive built with this skill ships as multi-instance from day one, following the canonical schema in [PRD_WITHIN_MODE_INSTANCE_DENSITY.md §4](../../my-tutoring-app/src/components/lumina/docs/PRD_WITHIN_MODE_INSTANCE_DENSITY.md#4-canonical-multi-instance-schema-pattern). The PRD's §5 playbook rules are the authoritative source for every decision this skill makes — pool service vs orchestrator, stale-state guards, answer-leak gating, metrics shape. Read it once before your first primitive build; reference it when an edge case comes up.

**Why this matters:** singular-schema primitives are Bucket A by definition. They produce one binary signal per session, fail to demonstrate mastery, and require an expensive refactor later. The 16 Workstream 3 ships in [SHIPPED_LOG.md](../../my-tutoring-app/src/components/lumina/docs/SHIPPED_LOG.md) each averaged ~2 hours to densify. Don't create new debt — get the schema right at creation.

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

**The data interface MUST follow the canonical multi-instance shape from [PRD §4](../../my-tutoring-app/src/components/lumina/docs/PRD_WITHIN_MODE_INSTANCE_DENSITY.md#4-canonical-multi-instance-schema-pattern).** Singular schemas (one problem per session, no `challenges[]` array) are Bucket A by definition and require an immediate multi-instance refactor — don't create new ones.

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { <Name>Metrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// EXPORT the challenge interface — the per-instance problem data
export interface <Name>Challenge {
  id: string;
  // ... per-challenge problem data (e.g., targetValue, prompt, expectedAnswer) ...
}

// EXPORT the data interface — single source of truth for the session shape
export interface <Name>Data {
  title: string;
  description: string;
  /** 3-6 challenges. REQUIRED. Built by the generator's pool service or orchestrator. */
  challenges: <Name>Challenge[];

  // Session-level config — keep flat. Per-challenge overrides are YAGNI.
  challengeType: '<modeA>' | '<modeB>'; // matches catalog evalMode challengeTypes
  // ... other session-wide flags ...

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<<Name>Metrics>) => void;
}
```

**`challenges` is required, not optional.** Optional `challenges?` fields are a smell — they create the latent gap where the generator never populates the array and the multi-instance code path is dead. See [SHIPPED_LOG §6j #1](../../my-tutoring-app/src/components/lumina/docs/SHIPPED_LOG.md) (balance-scale post-mortem).

**Schema decision — pool service vs orchestrator (REQUIRED before Phase 4):**

Classify the per-challenge data BEFORE designing the schema. This determines whether the generator uses Fork A (pool service) or Fork B (orchestrator) per [PRD §4](../../my-tutoring-app/src/components/lumina/docs/PRD_WITHIN_MODE_INSTANCE_DENSITY.md#generator-pick-a-fork):

| Per-challenge data | Fork | Examples |
|---|---|---|
| **Value-only** (a number, coordinate, target, matrix values) | **A: Pool service** — Gemini emits wrapper only; local code picks N values | `factor-tree`, `place-value-chart`, `area-model`, `matrix-display`, `slope-triangle`, `histogram`, `systems-equations` |
| **Content-bearing** (word problem text, scenario context, label sets) | **B: Orchestrator** — N parallel Gemini calls; results merged | `bar-model`, `tape-diagram`, `coin-counter` |

Document the choice in the Required Fields Manifest in Phase 2c so the Phase 4 Generator Agent knows which fork to build.

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

**REQUIRED: `useChallengeProgress` + `usePhaseResults` + `PhaseSummaryPanel`** for every evaluable primitive. These hooks are the canonical multi-instance wiring — skipping them produces Bucket A primitives that need an immediate refactor. Only display-only primitives (no scoring, no IRT routing) may skip.

```tsx
// Module-level phase config (one entry per challengeType; single-mode sessions get one entry)
const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  '<modeA>': { label: 'Mode A', icon: '🧱', accentColor: 'purple' },
  '<modeB>': { label: 'Mode B', icon: '👁️', accentColor: 'blue' },
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
} = useChallengeProgress({ challenges: data.challenges, getChallengeId: (ch) => ch.id });

const currentChallenge = data.challenges[currentChallengeIndex] ?? null;

const phaseResults = usePhaseResults({
  challenges: data.challenges, results: challengeResults, isComplete: allChallengesComplete,
  getChallengeType: (ch) => ch.type ?? data.challengeType,
  phaseConfig: PHASE_TYPE_CONFIG,
  // Custom getScore for primitives with within-challenge sub-phases (place-value-chart, area-model):
  // getScore: (rs) => Math.round(rs.reduce((s, r) => s + (r.score ?? 0), 0) / rs.length),
});

// REQUIRED — per-challenge reset useEffect (PRD §5 rule 8).
// Enumerate EVERY useState slot that depends on the active challenge.
// Grep for every useState and ask "would this be wrong for the next challenge?"
useEffect(() => {
  if (!currentChallenge) return;
  setMyInteractionState(initial(currentChallenge));
  setFeedback('');
  setFeedbackType('');
  setAttempts(0);
  recordedRef.current = false;
}, [currentChallenge?.id]);

// REQUIRED — stale-state guard (PRD §5 rule 9). Two variants:
// HANDLER-DRIVEN (button submit — most common): use recordedRef.current at top of submit handler.
const recordedRef = useRef(false);
const completeCurrentChallenge = (correct: boolean, extras = {}) => {
  if (!currentChallenge) return;
  if (recordedRef.current) return; // already recorded for this challenge
  recordedRef.current = true;
  recordResult({ challengeId: currentChallenge.id, correct, attempts, score, ...extras });
};

// EFFECT-DRIVEN (passive completion-detect, e.g. factor-tree's "all leaves prime"):
// useEffect(() => {
//   if (!currentChallenge) return;
//   if (!stateLooksComplete) return;
//   if (recordedRef.current) return;
//   if (!stateMatchesChallenge(currentChallenge)) return;  // content-match guard
//   recordedRef.current = true;
//   recordResult({ ... });
// }, [stateLooksComplete, currentChallenge, /* ... */]);
```

In check functions use `incrementAttempts()`. In submit handlers call `completeCurrentChallenge(correct)`.
In advance handler: `if (!advanceProgress()) { /* all done — session-complete useEffect fires submit */ return; }`.

**REQUIRED — answer-leak gating audit (PRD §5 rule 7).** Before declaring the component done, walk every label, tooltip, panel, stats display, frequency label, and default value in the rendered UI. Ask: *does this disclose the current mode's correct answer?* Labels correct as defaults are assessment-defeating as challenges. Examples:
- `histogram` hides the stats panel (`showStatistics: false`) in `estimate_center` mode — the mean was printed in plain text otherwise.
- `histogram` hides bar frequency labels in `find_modal_bin` / `read_frequency` — the height number above each bar IS the answer.
- `strategy-picker`'s `TallyViz` originally printed `"{total} total"` underneath the SVG — student read the answer instead of computing it.

Mode-specific visibility flips live in the component, reading `currentChallenge.challengeType` to decide what's hidden.

**REQUIRED — no in-component phase navigator on a single problem (PRD §5 rule 13).** If you find yourself building `setPhase('explore' | 'practice' | 'apply')` UI that walks the student through multiple interaction shapes on ONE problem, STOP. Eval-mode pinning makes the phase walk redundant — each of those phases is a different challenge in the session, not stages within one. See `function-machine` (§6f #1) and `percent-bar` (PRD §6 backlog) for the anti-pattern.

**Between-challenge interstitial** ("Next Number →", "Next Problem →"): when the final phase's celebration message would otherwise disappear instantly on advance, add a brief interstitial card with a "Next X →" button. The student needs ~2 seconds to read the success state. Reference: `PlaceValueChart.tsx` (`'challenge-done'` pseudo-phase).

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

**Display-only primitives may skip these hooks.** Reference: components without scoring, no IRT routing, no `usePrimitiveEvaluation`.

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
       taskDescription: '<Multi-X session — describe the per-challenge work>. Currently on {{challengeType}} challenge {{currentChallengeIndex}} of {{totalChallenges}}.',
       contextKeys: [
         'challengeType',
         'currentChallengeIndex',
         'totalChallenges',
         // ... scalar active-challenge fields (no per-challenge arrays — PRD §5 rule 15)
       ],
       scaffoldingLevels: {
         level1: '"<Gentle nudge — ask a question>"',
         level2: '"<Specific guidance — break into steps, use {{key}}>"',
         level3: '"<Detailed walkthrough — step-by-step with concrete details>"',
       },
       commonStruggles: [
         { pattern: '<Observable behavior>', response: '<Actionable tutor response>' },
       ],
       aiDirectives: [
         {
           title: 'MULTI-<X> PACING',
           instruction:
             'This is a {{totalChallenges}}-challenge session. After each correct answer the student clicks "Next <X> →". '
             + 'Encourage progression: "Nice — on to <x> {{currentChallengeIndex}}!" '
             + 'After a wrong attempt, point at the specific step that needs another look — do NOT just repeat the whole method.',
         },
       ],
     },
     supportsEvaluation: true,
   },
   ```

Rules for tutoring field:
- taskDescription describes WHAT the student is doing across the SESSION, not a single problem. ALWAYS template `{{totalChallenges}}` and `{{currentChallengeIndex}}` so the tutor knows it's a multi-problem session.
- `contextKeys` MUST be scalar session-level or active-challenge fields only. NEVER include per-challenge array fields (`challenges`, full `equations`, dataset arrays) — they flood the tutor prompt with hundreds of fields per turn (PRD §5 rule 15). The student sees the work; the tutor sees the pacing.
- Use {{key}} for runtime primitive_data values
- Never give the answer at any scaffolding level
- commonStruggles describe OBSERVABLE behavior, not vague labels
- Add a `MULTI-<X> PACING` aiDirective (canonical pattern across all multi-instance primitives — see `MULTI-EQUATION PACING` in balance-scale, `MULTI-FUNCTION PACING` in function-sketch, `MULTI-HISTOGRAM PACING` in histogram).
- `constraints` MUST clarify the manifest must NOT supply specific per-challenge values — the pool service or orchestrator builds challenges deterministically from the eval mode.
```

### Subagent C: "Evaluation types & tester"

Prompt template (only if interactive):
```
Add evaluation metrics and tester entry for a new Lumina primitive following the canonical 9-field flattened shape from PRD §4.

Component ID: `<id>`
Component name: `<Name>`
Domain: `<domain>`
Data interface: `<Name>Data`
Challenge types (eval mode keys): <list, e.g. 'modeA' | 'modeB'>

Tasks:

1. Read `my-tutoring-app/src/components/lumina/evaluation/types.ts`
   - Add metrics interface using the canonical 9-field shape (PRD §4):
     ```typescript
     export interface <Name>Metrics extends BasePrimitiveMetrics {
       type: '<id>';
       challengeType: '<modeA>' | '<modeB>' | /* ... */;
       totalChallenges: number;
       correctCount: number;
       attemptsCount: number;          // total tries across all challenges
       firstTryCount: number;          // challenges scoring 100 (first-try correct)
       hintsViewed: number;
       overallAccuracy: number;        // 0-100, average per-challenge score
       averageAttemptsPerChallenge: number;
     }
     ```
   - Add `<Name>Metrics` to the `AnyPrimitiveMetrics` union type.
   - DO NOT add per-challenge tautological fields (currentInput, phaseStep, mode-specific per-instance state) — they measure the LAST challenge, not the session (PRD §5 rule 18). If the primitive has genuine session-level signal not captured by the 9 canonical fields, justify it before adding.

2. Read `my-tutoring-app/src/components/lumina/evaluation/index.ts`
   - Re-export `<Name>Metrics` (add to the math-phase-2 export block or appropriate domain block).

3. Read `my-tutoring-app/src/components/lumina/components/<Domain>PrimitivesTester.tsx` and apply the 5-edit checklist (PRD §5 rule 17):

   **Edit 1 — Import the component:**
   ```tsx
   import <Name> from '../primitives/visual-primitives/<domain>/<Name>';
   ```

   **Edit 2 — Add to `PrimitiveType` union:**
   ```tsx
   type PrimitiveType = '...' | '<id>';
   ```

   **Edit 3 — Add to `PRIMITIVE_OPTIONS`:**
   ```tsx
   { value: '<id>', label: '<Display Name>', icon: '<emoji>', topic: '<short topic>' },
   ```

   **Edit 4 — Add render case (PASS evaluation props — DO NOT omit `onEvaluationSubmit`):**
   ```tsx
   case '<id>':
     return (
       <<Name>
         {...(data as Parameters<typeof <Name>>[0]['data'])}
         instanceId={instanceId}
         skillId={skillId}
         subskillId={subskillId}
         objectiveId={objectiveId}
         onEvaluationSubmit={handleEvaluationSubmit}
       />
     );
   ```
   **HARDCODED MOCK FIXTURES ARE A BUG.** If you find yourself constructing a `<Name>Data` object with literal field values in the render case, STOP — that masks all generator changes from the tester preview (the measurement-tools fixture-bug, SHIPPED_LOG §6k #4). Always spread the generator's `data` via `...(data as Parameters<...>[0]['data'])`.

   **Edit 5 — Add metrics breakdown block in the results panel:**
   ```tsx
   {result.metrics.type === '<id>' && (
     <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
       <span>Mode: {result.metrics.challengeType}</span>
       <span>Correct: {result.metrics.correctCount}/{result.metrics.totalChallenges}</span>
       <span>First try: {result.metrics.firstTryCount}</span>
       <span>Attempts: {result.metrics.attemptsCount}</span>
       <span>Avg attempts: {result.metrics.averageAttemptsPerChallenge.toFixed(1)}</span>
       <span>Hints viewed: {result.metrics.hintsViewed}</span>
       <span>Accuracy: {result.metrics.overallAccuracy.toFixed(0)}%</span>
     </div>
   )}
   ```
```

**Why `onEvaluationSubmit` MUST be passed:** Every recent multi-instance ship (function-sketch, balance-scale, measurement-tools, slope-triangle, matrix-display, histogram, systems-equations) passes `onEvaluationSubmit`. The old "do NOT pass onEvaluationSubmit to avoid double submission" guidance was wrong — `usePrimitiveEvaluation` guards via `submittedRef` against double submission, and omitting the prop silently suppresses ALL metrics submission from the tester (function-sketch §6i had this gap; matrix-display §6m had this gap). Always pass it.

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

Design a Gemini schema that reliably produces multi-instance valid data. **Read [PRD §4 + §5](../../my-tutoring-app/src/components/lumina/docs/PRD_WITHIN_MODE_INSTANCE_DENSITY.md) before designing anything — the schema decision is upstream of the schema text.**

**CRITICAL SCHEMA RULES:**

1. **Pick the fork from Phase 2c (PRD §5 rule 1).** The per-challenge data classification was made in Phase 2c. Now build the corresponding generator shape:

   **Fork A — Pool service (value-only per-challenge data).** Gemini emits ONLY the session wrapper (title, description, challengeType, mode flags). The N challenges are built deterministically in local code.

   ```typescript
   // Schema: wrapper metadata only — Gemini does NOT emit per-challenge data
   const wrapperSchema: Schema = {
     type: Type.OBJECT,
     properties: {
       title: { type: Type.STRING, description: 'Session title (do NOT name specific problems)' },
       description: { type: Type.STRING },
       challengeType: { type: Type.STRING, enum: [...] },
       gradeBand: { type: Type.STRING },
     },
     required: ['title', 'description', 'challengeType'],
   };

   // Local pool service builds N challenges deterministically:
   const challenges = selectFooChallenges(challengeType, { count: 4 });

   return { ...wrapper, challenges };
   ```

   Reference: [gemini-factor-tree.ts](../../my-tutoring-app/src/components/lumina/service/math/gemini-factor-tree.ts), [gemini-balance-scale.ts](../../my-tutoring-app/src/components/lumina/service/math/gemini-balance-scale.ts), [gemini-histogram.ts](../../my-tutoring-app/src/components/lumina/service/math/gemini-histogram.ts), [gemini-systems-equations.ts](../../my-tutoring-app/src/components/lumina/service/math/gemini-systems-equations.ts).

   **Fork B — Orchestrator (content-bearing per-challenge data).** N parallel Gemini calls (Promise.all) of a per-mode sub-generator; results merged into `challenges[]`. Use **orchestrator-same-mode** (one call shape, N copies) when the session pins to a single eval mode (the common case). Use **orchestrator-mixed-type** only when one render spans multiple challenge types.

   ```typescript
   const subGenerator = subGeneratorFor(challengeType);
   const results = await Promise.all(
     Array.from({ length: DEFAULT_INSTANCE_COUNT }, () => subGenerator(topic, gradeLevel))
   );
   const challenges = results.map((r, i) => ({ ...r.challenge, id: `foo-${i + 1}` }));
   return { ...firstResult.wrapper, challenges };
   ```

   Reference: [gemini-bar-model.ts](../../my-tutoring-app/src/components/lumina/service/math/gemini-bar-model.ts), [gemini-tape-diagram.ts](../../my-tutoring-app/src/components/lumina/service/math/gemini-tape-diagram.ts), [gemini-function-sketch.ts](../../my-tutoring-app/src/components/lumina/service/math/gemini-function-sketch.ts).

2. **Structured-output Gemini is CONVERGENT on values (PRD §5 rule 2).** With `responseMimeType: "application/json"` + `responseSchema`, Gemini IGNORES temperature for numeric/categorical values — same composites, same coordinates, same scenarios on every call, even at temperature 0.9. This is documented in [NUMBER_POOL_SERVICE.md](../../my-tutoring-app/src/components/lumina/service/math/NUMBER_POOL_SERVICE.md).

   **Implication:** if you put per-challenge value fields in the Gemini schema and rely on temperature for variance, the N challenges will be near-identical. ALWAYS pre-randomize value-only fields in code (Fork A) or use N independent parallel calls so independent draws produce variance (Fork B). NEVER rely on prompt-level "spread coverage" instructions to Gemini — they don't work.

3. **Pool-service variance enforcement (PRD §5 rule 3).** When the pool has structural categories beyond a single binary (odd/even, easy/hard, operation-family, distribution-shape), enforce one-per-category before back-filling. Standard pattern:

   ```typescript
   const families = new Set<string>();
   const selected: Challenge[] = [];
   for (const candidate of shuffled) {
     if (selected.length >= target) break;
     if (!families.has(family(candidate))) {
       selected.push(candidate);
       families.add(family(candidate));
     }
   }
   // back-fill remaining slots; force-swap if monoculture survived
   ```

   See factor-tree's "≥1 odd composite" guarantee, function-machine's operation-family rotation, histogram's shape rotation.

4. **Pre-compute expected answers in the generator (PRD §5 rule 4).** For deterministic-answer challenges, store `expectedScalar` / `expectedMatrix` / `expectedX,Y` / `targetAnswer` on the challenge object. Submit-time scoring becomes `parseFloat(input) === expected`. NEVER re-derive at submit — that's a class of stale-state bugs the multi-instance refactor exists to eliminate.

5. **Back-solve from the integer answer when constraints depend on it (PRD §5 rule 5).** Don't forward-search for integer solutions; pick `(x₀, y₀)` freely, then derive equation parameters that make both lines pass through it. Acceptance rate goes from ~5% to ~95%. Reference: `buildSlopeInterceptChallenge` in [gemini-systems-equations.ts](../../my-tutoring-app/src/components/lumina/service/math/gemini-systems-equations.ts).

6. **Canonical-key dedup** prevents duplicate challenges within a session:

   ```typescript
   const canonKey = (ch: Challenge) => `${ch.foo}|${ch.bar}|${ch.expectedX},${ch.expectedY}`;
   const seen = new Set<string>();
   while (challenges.length < target && attempts++ < target * 20) {
     const ch = builder(...);
     if (seen.has(canonKey(ch))) continue;
     seen.add(canonKey(ch));
     challenges.push(ch);
   }
   // fallback: accept duplicates if the candidate space was too narrow
   ```

7. **Index-derived challenge IDs, not `Date.now()`.** When using parallel orchestrator calls, all N resolve in the same millisecond and collide. Assign IDs from index AFTER Promise.all returns:

   ```typescript
   const challenges = results.map((r, i) => ({ ...r.challenge, id: `foo-${i + 1}` }));
   ```

   `useChallengeProgress` uses these IDs as React keys and the reset useEffect's dependency — collisions silently break the per-challenge state reset.

8. **Flatten arrays inside challenge objects** to avoid malformed LLM JSON (Fork B only, since Fork A doesn't emit per-challenge data from Gemini):
   - `options: string[]` → `option0`, `option1`, `option2`, `option3`
   - `coins: {type, count}[]` → `coin0Type`/`coin0Count` through `coin3Type`/`coin3Count`
   - After Gemini call, reconstruct arrays from flat fields.

9. **NEVER make a field nullable if the component reads it without a fallback.** Cross-check against the Required Fields Contract.

10. **If using multi-type schema with nullable fields:** After flat-field reconstruction, VALIDATE that each challenge has all required fields for its type. REJECT (return null) any challenge missing critical data. NEVER silently fall back to a default value.

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
2. **Pass `onEvaluationSubmit` in the tester**: `usePrimitiveEvaluation` guards against double submission via `submittedRef`. Omitting the prop silently suppresses ALL metrics submission from the tester (function-sketch and matrix-display both had this silent gap before the multi-instance refactors). **Always pass it.**
3. **Multi-instance is the default**: Every new evaluable primitive ships with `challenges: <Name>Challenge[]` and `useChallengeProgress`. Singular `<Name>Data` shapes are Bucket A by definition — don't create new ones. See [PRD §4](../../my-tutoring-app/src/components/lumina/docs/PRD_WITHIN_MODE_INSTANCE_DENSITY.md#4-canonical-multi-instance-schema-pattern).
4. **Use shadcn/ui**: Cards, Buttons, Badges, Accordions — never custom div-based UI patterns.
5. **Write complete component files**: Use Write tool, not incremental edits, to prevent broken JSX.
6. **Required Fields Manifest**: Always create one in Phase 2c (includes the Fork A vs Fork B decision from PRD §5 rule 1) and pass it to Phases 4 and 6.
7. **Generator rejects, never silently falls back**: Missing visual data = reject challenge + log. Never `?? defaultValue` for fields the component renders.
8. **Fork A (pool service) vs Fork B (orchestrator) — decision is value-only vs content-bearing, NOT by challenge-type count**. Value-only data (numbers, coordinates, matrix values) → pool service even with N challenge types. Content-bearing data (word problems, scenarios) → orchestrator. See [PRD §5 rule 1](../../my-tutoring-app/src/components/lumina/docs/PRD_WITHIN_MODE_INSTANCE_DENSITY.md#5-the-playbook-refactor-rules).
9. **Mode-specific answer-leak audit before declaring done**: walk every label, tooltip, panel, stats display in the rendered UI — would it disclose the current mode's correct answer? Fix by gating visibility on `currentChallenge.challengeType`. See [PRD §5 rule 7](../../my-tutoring-app/src/components/lumina/docs/PRD_WITHIN_MODE_INSTANCE_DENSITY.md#5-the-playbook-refactor-rules).
10. **No hardcoded mock fixtures in the tester** — they mask all generator changes. Always spread the generator's `data` via `...(data as Parameters<...>[0]['data'])`. See [SHIPPED_LOG §6k #4](../../my-tutoring-app/src/components/lumina/docs/SHIPPED_LOG.md).

## PRD Reference

This skill's design contract is defined by:
- **[PRD_WITHIN_MODE_INSTANCE_DENSITY.md](../../my-tutoring-app/src/components/lumina/docs/PRD_WITHIN_MODE_INSTANCE_DENSITY.md)** — canonical multi-instance schema (§4), refactor playbook rules (§5), current backlog (§6). READ THIS BEFORE building any new primitive — the patterns this skill enforces are documented there.
- **[SHIPPED_LOG.md](../../my-tutoring-app/src/components/lumina/docs/SHIPPED_LOG.md)** — per-primitive post-mortems for 16 shipped primitives. Useful as worked examples when you hit an unusual case.

Domain-specific PRDs:
- `lumina/docs/space-primitives-prd.md` — Astronomy/space primitives
- `lumina/docs/lumina_difficulty_calibration_prd.md` — IRT calibration PRD (section 5.3 prior difficulty table for beta values)
- `lumina/docs/ADDING_EVAL_MODES.md` — Full eval modes implementation guide
