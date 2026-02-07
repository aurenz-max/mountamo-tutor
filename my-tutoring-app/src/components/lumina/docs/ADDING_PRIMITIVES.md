# Adding New Primitives to Lumina

This guide explains how to add new primitive components to Lumina using the registry-based architecture.

## 🎯 Philosophy: Build Evaluation Into Interactive Primitives

**Interactive primitives with built-in evaluation significantly improve student learning outcomes.** When students can manipulate, build, and experiment with primitives that provide immediate feedback, they develop deeper understanding and retain concepts longer.

**Best Practice: If your primitive is interactive, make it evaluable.**

✅ **Do build evaluation into primitives when:**
- Students manipulate or construct something (drag, click, build, arrange)
- There's a clear learning goal or target state
- You can measure performance quality (accuracy, efficiency, strategy)
- The primitive involves problem-solving or decision-making

❌ **Skip evaluation for:**
- Pure display/visualization components (static diagrams, read-only charts)
- Informational content (text, images, videos without interaction)
- Navigation or organizational components

**Why this matters:** Primitives with evaluation enable adaptive learning pathways, personalized feedback, and data-driven instruction. They transform passive content into active learning experiences.

## Quick Start: 6 Files, Zero Switch Statements

Adding a new primitive involves these files:

| Step | File | What to Add |
|------|------|-------------|
| 1 | `primitives/.../MyPrimitive.tsx` | Create the React component |
| 2 | `types.ts` | Add ComponentId and data types |
| 3 | `service/[domain]/gemini-my-primitive.ts` | Create the generator service |
| 4 | `service/registry/generators/[domain]Generators.ts` | Register the generator |
| 5 | `service/manifest/catalog/[domain].ts` | Add to catalog for AI selection |
| 6 | `config/primitiveRegistry.tsx` | Register UI component for rendering |
| 7 (Optional) | `evaluation/types.ts` | Add metrics type if supporting evaluation |

**No changes needed to:**
- ~~`geminiService.ts`~~ - Registry pattern handles all component generation
- ~~`route.ts`~~ - Universal endpoint handles all components

---

## UI Component Guidelines

**IMPORTANT: Use shadcn/ui with Lumina theming for all primitives.**

### Why shadcn/ui?

- **Reduces code overhead** - 60 lines vs 500+ lines of custom styling
- **Consistent patterns** - Same components across all primitives
- **Built-in accessibility** - ARIA attributes and keyboard navigation
- **Easier to maintain** - Design system changes propagate automatically

### shadcn/ui Components for Lumina

| shadcn Component | Use For |
|-----------------|---------|
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | Main containers |
| `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` | Expandable sections |
| `Button` | Interactive elements |
| `Badge` | Labels and categories |
| `Separator` | Dividers |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Multi-section content |
| `Skeleton` | Loading states |

### Lumina Theming Classes

Apply these classes to shadcn components for the Lumina glass design:

**Cards:**
```tsx
<Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl">
```

**Accordion Items:**
```tsx
<AccordionItem value="section" className="border-white/10">
  <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline">
```

**Buttons:**
```tsx
<Button variant="ghost" className="bg-white/5 border border-white/20 hover:bg-white/10">
```

**Badges:**
```tsx
<Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300">
```

### Lumina Color Palette

Use these Tailwind classes for consistency:

| Element | Class | Usage |
|---------|-------|-------|
| Background (dark) | `bg-slate-900/40`, `bg-slate-800/30` | Card backgrounds with transparency |
| Background (darker) | `bg-black/20`, `bg-slate-900/60` | Nested sections |
| Border | `border-white/10`, `border-slate-700/50` | Subtle borders |
| Text (primary) | `text-slate-100`, `text-slate-200` | Main content |
| Text (secondary) | `text-slate-300`, `text-slate-400` | Descriptions |
| Text (muted) | `text-slate-500`, `text-slate-600` | Labels, metadata |
| Accent colors | `text-orange-300`, `text-emerald-300`, etc. | Kingdom/category colors |
| Hover states | `hover:bg-white/10`, `hover:border-white/20` | Interactive elements |
| Blur effects | `backdrop-blur-xl`, `backdrop-blur-sm` | Glass morphism |

---

## Step-by-Step Guide

### Step 1: Create the Primitive Component

Create a standalone React component that accepts a `data` prop.

**Important: Define and export your data interface here.** This component file is the **single source of truth** for the data type. The generator service will import this type rather than redefining it.

#### Evaluable Primitive (Recommended for Interactive Components)

**⭐ Start here if your primitive involves student interaction.** Building evaluation directly into primitives from the start creates better learning experiences and enables personalized instruction.

If your primitive involves student interaction and goal achievement, add optional evaluation props:

```tsx
// primitives/visual-primitives/math/MyPrimitive.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../evaluation';
import type { MyPrimitiveMetrics } from '../../evaluation/types';

// ✅ EXPORT the data interface - include optional evaluation props
export interface MyPrimitiveData {
  // Component-specific props
  title: string;
  description: string;
  targetValue: number;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  // These enable student performance tracking and adaptive learning
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MyPrimitiveMetrics>) => void;
}

interface MyPrimitiveProps {
  data: MyPrimitiveData;
  className?: string;
}

const MyPrimitive: React.FC<MyPrimitiveProps> = ({ data, className }) => {
  const [currentValue, setCurrentValue] = useState(0);

  // Destructure evaluation props
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Initialize evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<MyPrimitiveMetrics>({
    primitiveType: 'my-primitive',
    instanceId: instanceId || `my-primitive-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const handleSubmit = () => {
    if (hasSubmitted) return;

    const success = currentValue >= data.targetValue;
    const score = Math.min(100, (currentValue / data.targetValue) * 100);

    const metrics: MyPrimitiveMetrics = {
      type: 'my-primitive',
      targetValue: data.targetValue,
      achievedValue: currentValue,
      goalMet: success,
      accuracy: score,
    };

    submitResult(success, score, metrics, {
      studentWork: { value: currentValue },
    });
  };

  const handleReset = () => {
    setCurrentValue(0);
    resetAttempt();
  };

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className}`}>
      <CardHeader>
        <CardTitle className="text-slate-100">{data.title}</CardTitle>
        <CardDescription className="text-slate-400">{data.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Your visualization */}

        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={hasSubmitted}
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10"
          >
            {hasSubmitted ? 'Submitted' : 'Submit'}
          </Button>
          {hasSubmitted && (
            <Button
              onClick={handleReset}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10"
            >
              Try Again
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MyPrimitive;
```

**Benefits of building evaluation into your primitive:**
- 📊 **Student progress tracking** - Automatically records performance in learning analytics
- 🎯 **Adaptive learning** - Enables personalized difficulty adjustment and skill recommendations
- 💡 **Immediate feedback** - Students get instant validation of their work
- 📈 **Data-driven instruction** - Teachers see which concepts students struggle with
- 🔄 **Retry mechanisms** - Built-in support for multiple attempts and mastery learning

#### Basic (Non-Evaluable) Primitive

Use this pattern **only for display-only components** like static visualizations, informational content, or navigation elements.

```tsx
// primitives/visual-primitives/math/MyPrimitive.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// ✅ EXPORT the data interface - this is the single source of truth
export interface MyPrimitiveData {
  title: string;
  description: string;
  values: number[];
}

interface MyPrimitiveProps {
  data: MyPrimitiveData;
  className?: string;
}

const MyPrimitive: React.FC<MyPrimitiveProps> = ({ data, className }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className}`}>
      <CardHeader>
        <CardTitle className="text-slate-100">{data.title}</CardTitle>
        <CardDescription className="text-slate-400">{data.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Your visualization */}
      </CardContent>
    </Card>
  );
};

export default MyPrimitive;
```

⚠️ **Consider: Can students interact with this?** If yes, use the evaluable pattern above instead.

### Step 2: Add TypeScript Types

Add the ComponentId and export your data type.

```tsx
// types.ts

// 1. Add to ComponentId union type
export type ComponentId =
  | 'bar-model'
  | 'number-line'
  | 'my-primitive'  // ← Add this
  | // ...
;

// 2. Export your data interface (if not already in component file)
export type { MyPrimitiveData } from './primitives/visual-primitives/math/MyPrimitive';
```

### Step 3: Create the Generator Service

Create an AI-powered generator that produces content for your primitive.

**Important: Import the data type from the component file.** Do NOT redefine the interface here. This ensures type consistency between what the generator produces and what the component expects.

```tsx
// service/math/gemini-my-primitive.ts
import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// ✅ IMPORT the data type from the component - single source of truth
import { MyPrimitiveData } from '../../primitives/visual-primitives/math/MyPrimitive';

// ❌ DON'T redefine the interface here - it leads to drift and duplication

// The Gemini schema must match the TypeScript interface
const myPrimitiveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    values: { type: Type.ARRAY, items: { type: Type.NUMBER } }
  },
  required: ["title", "description", "values"]
};

export const generateMyPrimitive = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<MyPrimitiveData>  // ✅ Use imported type for config too
): Promise<MyPrimitiveData> => {
  const prompt = `Create educational content for "${topic}" at ${gradeLevel} level...`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: myPrimitiveSchema
    }
  });

  return JSON.parse(result.text || '{}');
};
```

### Step 4: Register the Generator

Add your generator to the appropriate domain module. This self-registers on import.

```tsx
// service/registry/generators/mathGenerators.ts

import { registerGenerator } from '../contentRegistry';
import { generateMyPrimitive } from '../../math/gemini-my-primitive';

// Add this registration (existing registrations above)
registerGenerator('my-primitive', async (item, topic, gradeContext) => ({
  type: 'my-primitive',
  instanceId: item.instanceId,
  data: await generateMyPrimitive(topic, gradeContext, item.config),
}));
```

### Step 5: Add to Manifest Catalog

Add your component to the appropriate domain catalog so the AI can select it.

```tsx
// service/manifest/catalog/math.ts

export const MATH_CATALOG: ComponentDefinition[] = [
  // ... existing components

  {
    id: 'my-primitive',
    description: 'Clear description of what this does. Perfect for [use case]. ESSENTIAL for [grade level] [subject].',
    constraints: 'Any limitations (e.g., "Requires numeric data", "Best for grades 3-8")'
  },
];
```

### Step 6: Register UI Component

Register the React component for rendering. If your primitive supports evaluation, set `supportsEvaluation: true` to enable automatic prop injection.

```tsx
// config/primitiveRegistry.tsx

import MyPrimitive from '../primitives/visual-primitives/math/MyPrimitive';

export const PRIMITIVE_REGISTRY: Record<ComponentId, PrimitiveConfig> = {
  // ... existing entries

  'my-primitive': {
    component: MyPrimitive,
    sectionTitle: 'My Primitive',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,  // ← Add this if primitive uses evaluation
  },
};
```

**When to set `supportsEvaluation: true`:**
- ✅ Primitive involves student interaction (e.g., building, selecting, manipulating)
- ✅ Has a clear goal or target state
- ✅ You've integrated the `usePrimitiveEvaluation` hook
- ✅ You've defined metrics in `evaluation/types.ts`

**⭐ Default to `true` for interactive primitives.** Evaluation powers adaptive learning and helps students learn faster.

### Step 7 (Optional): Add Evaluation Metrics

If your primitive supports evaluation, define a custom metrics interface in the evaluation system.

```typescript
// evaluation/types.ts

// 1. Define your metrics interface
export interface MyPrimitiveMetrics extends BasePrimitiveMetrics {
  type: 'my-primitive';

  // Goal achievement
  targetValue: number;
  achievedValue: number;
  goalMet: boolean;

  // Domain-specific metrics
  accuracy: number;  // 0-100
  efficiency?: number;  // Optional: steps taken vs optimal
  attempts?: number;  // Optional: number of tries before success
}

// 2. Add to the PrimitiveMetrics union
export type PrimitiveMetrics =
  | TowerStackerMetrics
  | BridgeBuilderMetrics
  | MyPrimitiveMetrics  // ← Add here
  | /* ... other metrics */;
```

Then export from the evaluation index:

```typescript
// evaluation/index.ts
export type {
  MyPrimitiveMetrics,
  // ... other exports
} from './types';
```

**What goes in metrics:**
- **Goal achievement**: Target vs achieved values, success/failure
- **Performance quality**: Accuracy, efficiency, optimality
- **Student behavior**: Attempts, time spent, strategy used
- **Domain concepts**: Specific to your educational domain (e.g., balance ratio, structural stability)

**💡 Pro tip:** Rich metrics enable better adaptive learning. Capture not just whether the student succeeded, but *how* they approached the problem. This data powers personalized learning pathways.

---

## Best Practices

### Prioritize Evaluation in Interactive Primitives

**Make evaluation the default for interactive components, not an afterthought.**

Research shows that interactive learning with immediate feedback dramatically improves:
- **Retention**: Students remember 75% of what they actively practice vs 10% of what they read
- **Engagement**: Interactive components keep students focused 3x longer
- **Mastery**: Built-in evaluation enables practice until proficiency is achieved

**Design pattern:**
1. ✅ **Start with evaluation** - If students interact, plan evaluation from the beginning
2. ✅ **Capture rich metrics** - Record approach and strategy, not just right/wrong
3. ✅ **Enable retry** - Use `resetAttempt()` to support mastery learning
4. ✅ **Provide feedback** - Show students what they achieved vs the goal

**Anti-pattern:**
1. ❌ Building interactive components without evaluation
2. ❌ Adding evaluation as an afterthought (requires refactoring)
3. ❌ Capturing only success/failure (loses valuable learning data)
4. ❌ One-shot interactions without retry capability

### Single Source of Truth for Data Types

**Always define your data interface in the component file and import it elsewhere.**

```
┌─────────────────────────────────────────────────────────────┐
│  MyPrimitive.tsx (DEFINES MyPrimitiveData)                  │
│  ↓                                                          │
│  gemini-my-primitive.ts (IMPORTS MyPrimitiveData)           │
│  ↓                                                          │
│  types.ts (RE-EXPORTS MyPrimitiveData if needed globally)   │
└─────────────────────────────────────────────────────────────┘
```

**Why this matters:**
- Changes to the data structure only need to happen in one place
- TypeScript will catch mismatches between generator output and component expectations
- Reduces copy-paste errors and type drift

**Common mistake to avoid:**
```tsx
// ❌ BAD: Defining the same interface in both files
// MyPrimitive.tsx
export interface MyPrimitiveData { title: string; values: number[]; }

// gemini-my-primitive.ts
export interface MyPrimitiveData { title: string; values: number[]; } // Duplicate!
```

```tsx
// ✅ GOOD: Single definition, imported where needed
// MyPrimitive.tsx
export interface MyPrimitiveData { title: string; values: number[]; }

// gemini-my-primitive.ts
import { MyPrimitiveData } from '../../primitives/.../MyPrimitive';
```

### Evaluation Props are Auto-Injected

When `supportsEvaluation: true` is set in the registry, `ManifestOrderRenderer` automatically injects:

| Prop | Source | Purpose |
|------|--------|---------|
| `instanceId` | Manifest | Unique identifier for this component instance |
| `exhibitId` | EvaluationContext | Parent exhibit containing this primitive |
| `skillId` | Manifest config | Primary skill being practiced |
| `subskillId` | Manifest config | Specific subskill being practiced |
| `objectiveId` | Objectives | Learning objective this maps to |

**You don't need to manually pass these props** - just mark optional in your data interface and they'll be provided at runtime when the primitive is rendered within an exhibit.

### Evaluation Props Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    App.tsx                                   │
│  <EvaluationProvider sessionId={...} studentId={...}>       │
│    <ManifestOrderRenderer orderedComponents={...} />         │
│  </EvaluationProvider>                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ManifestOrderRenderer                           │
│  if (config.supportsEvaluation) {                            │
│    inject: instanceId, skillId, exhibitId, objectiveId       │
│  }                                                           │
│  <Component data={{...data, ...evalProps}} />               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Your Primitive                              │
│  const { submitResult } = usePrimitiveEvaluation({          │
│    instanceId: data.instanceId,  // ← Auto-injected         │
│    skillId: data.skillId,        // ← Auto-injected         │
│  });                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Progressive Difficulty: Multi-Phase Learning Design

**⭐ RECOMMENDED: Structure complex primitives with progressive difficulty phases to maximize learning outcomes.**

Research in cognitive science shows that scaffolded learning (breaking complex tasks into progressive steps) significantly improves:
- **Mastery**: Students achieve 2x higher success rates vs. all-at-once learning
- **Transfer**: Students can apply concepts to new problems 60% more effectively
- **Confidence**: Reduces frustration and builds self-efficacy through small wins
- **Retention**: Multi-step learning creates stronger neural pathways

#### The Progressive Difficulty Pattern

Instead of asking students to solve the entire problem at once, break the learning into 3-5 phases that build on each other:

```typescript
type LearningPhase = 'explore' | 'practice' | 'apply' | 'extend';

const [currentPhase, setCurrentPhase] = useState<LearningPhase>('explore');
```

**Phase Structure:**

1. **Explore (Discovery)**: Students discover the core concept or relationship
   - Focused on ONE key insight
   - Provides strong scaffolding and hints
   - Usually just 1-2 values to find
   - Example: "Find the unit rate (when input = 1, what's the output?)"

2. **Practice (Guided Application)**: Students apply the concept with support
   - Limited scope (2-3 problems)
   - Immediate feedback on correctness
   - Still provides hints if needed
   - Example: "Use the unit rate to find 2 more values"

3. **Apply (Independent Work)**: Students solve the full problem
   - Complete the entire task
   - Minimal scaffolding
   - Example: "Find all remaining values using what you learned"

4. **Extend (Optional Challenge)**: Push beyond the original problem
   - Reverse the problem or add complexity
   - For advanced students who finish early
   - Example: "Now given the output, find the input"

#### Real-World Example: Double Number Line

The [DoubleNumberLine.tsx](../primitives/visual-primitives/math/DoubleNumberLine.tsx) primitive demonstrates this pattern perfectly:

**Phase 1 - Explore (Unit Rate Discovery)**
```typescript
// Student finds the fundamental relationship
{currentPhase === 'explore' && (
  <div>
    <label>When {topLabel} = 1, what is {bottomLabel}?</label>
    <input
      value={studentUnitRate}
      onChange={(e) => setStudentUnitRate(e.target.value)}
    />
    <button onClick={handleCheckUnitRate}>Check Unit Rate</button>
  </div>
)}
```

Key aspects:
- Students focus on ONE insight: the unit rate
- Clear question guides discovery
- Immediate feedback when they check
- Success unlocks next phase

**Phase 2 - Practice (Guided Scaling)**
```typescript
// Show only first 2 target points
{currentPhase === 'practice' && targetPoints.map((point, i) => {
  if (i >= 2) return null; // Limit to 2 points
  // Render input for this point
})}

// Check if practice points are correct before advancing
const practiceCorrect = studentPoints.slice(0, 2).every((p, i) => {
  const target = targetPoints[i];
  return isWithinTolerance(parseFloat(p.bottomValue), target.bottomValue);
});

if (practiceCorrect) {
  setFeedback('Excellent! Now try finding all the remaining points!');
  setCurrentPhase('apply');
}
```

Key aspects:
- Limited to 2-3 points (manageable cognitive load)
- Students apply the unit rate they discovered
- Success feedback builds confidence
- Automatic progression to next phase

**Phase 3 - Apply (Full Problem)**
```typescript
// Show ALL target points
{currentPhase === 'apply' && targetPoints.map((point, i) => {
  // Render all points
})}

// Final evaluation when all points correct
if (allCorrect) {
  handleSubmit(finalPoints); // Submit to evaluation system
}
```

Key aspects:
- Students complete the full problem
- Uses all previously learned concepts
- Final evaluation tracks overall mastery

#### Visual Progress Indicators

Make phases visible to students so they know where they are:

```typescript
{/* Phase Progress Indicator */}
<div className="flex items-center gap-2">
  <div className={currentPhase === 'explore' ? 'active' : 'inactive'}>
    <span>1. Explore</span>
  </div>
  <div className={currentPhase === 'practice' ? 'active' : 'inactive'}>
    <span>2. Practice</span>
  </div>
  <div className={currentPhase === 'apply' ? 'active' : 'inactive'}>
    <span>3. Apply</span>
  </div>
</div>
```

Benefits:
- Students understand the learning journey
- Provides sense of progress and accomplishment
- Clear expectations for what comes next

#### Phase-Specific Instructions

Provide different instructions for each phase:

```typescript
{currentPhase === 'explore' && (
  <p>Step 1: Find the Unit Rate - Look for where {topLabel} = 1...</p>
)}

{currentPhase === 'practice' && (
  <p>Step 2: Practice Scaling - Use the unit rate to find other values...</p>
)}

{currentPhase === 'apply' && (
  <p>Step 3: Apply Your Understanding - Find all remaining values...</p>
)}
```

#### Evaluation Tracking Across Phases

Track which phases students complete and how they perform:

```typescript
const metrics: DoubleNumberLineMetrics = {
  type: 'double-number-line',

  // Overall performance
  totalTargetPoints: targetPoints.length,
  correctPoints,
  allPointsCorrect,

  // Phase 1 tracking
  unitRateIdentified: true, // Did they find the unit rate?

  // Attempt tracking (includes practice attempts)
  attemptsCount: attemptCount,

  // Support used
  hintsUsed: showHints ? 1 : 0,

  // Accuracy breakdown
  topValueAccuracy: (topCorrect / targetPoints.length) * 100,
  bottomValueAccuracy: (bottomCorrect / targetPoints.length) * 100,
};
```

This rich data enables:
- Identifying which phase students struggle with
- Adapting future problems based on phase performance
- Understanding conceptual gaps (e.g., found unit rate but couldn't scale)

#### Design Guidelines for Progressive Phases

**✅ DO:**
- Break complex problems into 3-4 distinct phases
- Make each phase have a clear, achievable goal
- Provide phase-specific instructions and feedback
- Limit scope in early phases (1-2 items in explore, 2-3 in practice)
- Auto-advance when students demonstrate mastery
- Track phase completion in evaluation metrics
- Use visual indicators to show progress
- Celebrate phase completion with positive feedback

**❌ DON'T:**
- Create too many phases (>5 becomes tedious)
- Make phases feel like arbitrary gates
- Require perfection to advance (allow "skip ahead" option)
- Repeat the same type of problem in each phase
- Hide what's coming next (show the full problem early)
- Force students to restart if they fail a phase

#### Progressive Difficulty in Generator Services

Generators should create data that supports phases. See [gemini-double-number-line.ts](../service/math/gemini-double-number-line.ts):

```typescript
const prompt = `
Create a double number line problem with 3 learning phases:
1. Students find the UNIT RATE (when input = 1, what's the output?)
2. Students practice with 2-3 points
3. Students find all remaining points

Return:
- unitRateInput: 1 (the discover phase question)
- unitRateOutput: The answer students find in phase 1
- targetInputs: 3-4 OTHER values for phases 2-3
`;

// Structure the response data to support phases
const data: DoubleNumberLineData = {
  targetPoints: [
    // Phase 1: Unit rate discovery
    { topValue: unitRateInput, bottomValue: unitRateOutput, label: 'Unit Rate' },
    // Phases 2-3: Progressive practice
    ...targetInputs.map(input => ({
      topValue: input,
      bottomValue: input * unitRate,
    }))
  ],
};
```

The generator explicitly creates data knowing how the primitive will use it across phases.

#### When to Use Progressive Difficulty

Use this pattern when:
- ✅ The primitive teaches a multi-step concept (ratios, proportions, algebraic thinking)
- ✅ Students need to discover a relationship before applying it
- ✅ The full problem has 5+ values/steps to complete
- ✅ Students might get overwhelmed by the full problem at once
- ✅ You can identify a clear "key insight" that unlocks the rest

Skip this pattern when:
- ❌ The primitive is simple with <3 interactions
- ❌ Each interaction is independent (not building on previous)
- ❌ The concept is procedural (just following steps, not discovering patterns)
- ❌ Students already know the relationship (just practicing execution)

#### Progressive Difficulty Summary

**Progressive difficulty transforms good primitives into excellent learning experiences.** By scaffolding complex problems into manageable phases, you:
- Reduce cognitive overload and frustration
- Build confidence through incremental success
- Help students discover concepts rather than memorizing procedures
- Create richer evaluation data for adaptive learning
- Significantly improve learning outcomes

**Reference implementations:**
- [DoubleNumberLine.tsx](../primitives/visual-primitives/math/DoubleNumberLine.tsx) - Multi-phase ratio learning
- [gemini-double-number-line.ts](../service/math/gemini-double-number-line.ts) - Generator supporting phases

Start with 3 phases (explore → practice → apply) and adjust based on concept complexity.

---

## Domain Catalog Reference

Add new components to the appropriate domain file:

| Domain | File | Components |
|--------|------|------------|
| Math | `catalog/math.ts` | bar-model, number-line, fraction-bar, etc. |
| Engineering | `catalog/engineering.ts` | lever-lab, pulley-system-builder, etc. |
| Science | `catalog/science.ts` | molecule-viewer, periodic-table |
| Literacy | `catalog/literacy.ts` | sentence-analyzer, word-builder |
| Media | `catalog/media.ts` | media-player, flashcard-deck, image-comparison |
| Assessment | `catalog/assessment.ts` | knowledge-check, scale-spectrum |
| Core | `catalog/core.ts` | curator-brief, concept-card-grid, etc. |

---

## Generator Registry Reference

Add generators to the appropriate domain module:

| Domain | File |
|--------|------|
| Core | `registry/generators/coreGenerators.ts` |
| Math | `registry/generators/mathGenerators.ts` |
| Engineering | `registry/generators/engineeringGenerators.ts` |
| Media | `registry/generators/mediaGenerators.ts` |
| Foundation | `registry/generators/foundationGenerators.ts` |

To add a new domain, create `registry/generators/[domain]Generators.ts` and import it in `registry/generators/index.ts`.

---

## Verification Commands

After adding a new primitive, verify integration:

```bash
# 1. Check ComponentId type
grep "my-primitive" src/components/lumina/types.ts

# 2. Check primitive registry
grep "my-primitive" src/components/lumina/config/primitiveRegistry.tsx

# 3. Check generator registry
grep "my-primitive" src/components/lumina/service/registry/generators/*.ts

# 4. Check manifest catalog
grep "my-primitive" src/components/lumina/service/manifest/catalog/*.ts
```

All four checks should return results.

**Note:** TypeScript compilation checking (`npx tsc --noEmit`) may fail due to syntax issues in other parts of the codebase. Focus on verifying the four integration points above instead.

---

## Architecture Benefits

The registry-based architecture provides:

| Metric | Before (Switch-based) | After (Registry) |
|--------|----------------------|------------------|
| Files to modify | 6 (including geminiService.ts & route.ts) | 6 (small, focused files) |
| Lines to add | ~150 | ~50 |
| Switch cases to update | 3 | 0 |
| AI context required | ~7,000 lines | ~100 lines |
| Risk of merge conflicts | High (shared monolithic files) | Low (separate domain files) |

---

## Troubleshooting

### Component doesn't render
1. Verify `componentId` matches registry key exactly (case-sensitive)
2. Check component appears in `exhibitData.orderedComponents`
3. Check console for warnings from `ManifestOrderRenderer`
4. Verify UI component is registered in `primitiveRegistry.tsx`

### "Unknown component type" warning
1. Generator not registered - check `generators/[domain]Generators.ts`
2. Verify the generator file is imported in `registry/generators/index.ts`

### AI never selects component
1. Not in catalog - add to appropriate `catalog/[domain].ts`
2. Description unclear - improve description with specific use cases and grade levels
3. Verify catalog file is imported in `catalog/index.ts`

### TypeScript errors
1. Missing `ComponentId` entry in `types.ts`
2. Data interface not exported from component file
3. Evaluation metrics not added to `PrimitiveMetrics` union

### Evaluation not working
1. Verify `supportsEvaluation: true` in registry
2. Check that component is wrapped in `EvaluationProvider` (in App.tsx)
3. Verify metrics interface is defined and exported from `evaluation/types.ts`
4. Check browser console for warnings from `usePrimitiveEvaluation`

---

## Quick Checklist for New Primitives

Use this checklist when adding a new primitive:

- [ ] **Interaction analysis**: Does this primitive involve student interaction?
  - If YES → Plan to include evaluation from the start
  - If NO → Non-evaluable pattern is fine
- [ ] **Data interface**: Defined in component file with optional evaluation props
- [ ] **ComponentId**: Added to `types.ts`
- [ ] **Generator**: Created in `service/[domain]/`
- [ ] **Registry**: Registered in `generators/[domain]Generators.ts`
- [ ] **Catalog**: Added to `catalog/[domain].ts` with clear description
- [ ] **UI config**: Added to `primitiveRegistry.tsx` with `supportsEvaluation: true` if interactive
- [ ] **Metrics** (if evaluable): Custom metrics interface in `evaluation/types.ts`
- [ ] **Evaluation hook** (if evaluable): Integrated `usePrimitiveEvaluation` with submit/reset handlers
- [ ] **Testing**: Verified primitive works standalone and within exhibits

## Additional Resources

- **[MIGRATING_TO_SHADCN.md](MIGRATING_TO_SHADCN.md)** - Guide for converting existing primitives to use shadcn/ui
- **[INTEGRATION_GUIDE.md](../evaluation/INTEGRATION_GUIDE.md)** - Comprehensive guide to the evaluation system
- **[TowerStacker.tsx](../primitives/visual-primitives/engineering/TowerStacker.tsx)** - ⭐ Reference implementation with evaluation (recommended starting point)
- **[BridgeBuilder.tsx](../primitives/visual-primitives/engineering/BridgeBuilder.tsx)** - Another evaluation example with complex metrics
- **[LeverLab.tsx](../primitives/visual-primitives/engineering/LeverLab.tsx)** - Evaluation with physics-based metrics
