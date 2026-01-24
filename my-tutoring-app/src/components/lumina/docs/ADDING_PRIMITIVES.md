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
    <div className={className}>
      <h3 className="text-xl font-semibold mb-4">{data.title}</h3>
      <p className="text-gray-600 mb-4">{data.description}</p>
      {/* Your visualization */}

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSubmit}
          disabled={hasSubmitted}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {hasSubmitted ? 'Submitted' : 'Submit'}
        </button>
        {hasSubmitted && (
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
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
    <div className={className}>
      <h3 className="text-xl font-semibold mb-4">{data.title}</h3>
      <p className="text-gray-600 mb-4">{data.description}</p>
      {/* Your visualization */}
    </div>
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

- **[INTEGRATION_GUIDE.md](../evaluation/INTEGRATION_GUIDE.md)** - Comprehensive guide to the evaluation system
- **[TowerStacker.tsx](../primitives/visual-primitives/engineering/TowerStacker.tsx)** - ⭐ Reference implementation with evaluation (recommended starting point)
- **[BridgeBuilder.tsx](../primitives/visual-primitives/engineering/BridgeBuilder.tsx)** - Another evaluation example with complex metrics
- **[LeverLab.tsx](../primitives/visual-primitives/engineering/LeverLab.tsx)** - Evaluation with physics-based metrics
