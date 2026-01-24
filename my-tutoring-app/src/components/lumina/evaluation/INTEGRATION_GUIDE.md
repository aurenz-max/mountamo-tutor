# Evaluation Integration Guide

## Overview

The Lumina evaluation system now features **automatic evaluation prop injection** for primitives marked as evaluable. This eliminates the need to manually wire evaluation props in every parent component.

## Architecture

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
│  for each component:                                         │
│    if (config.supportsEvaluation) {                          │
│      inject: instanceId, skillId, exhibitId, objectiveId     │
│    }                                                         │
│    <Component data={{...data, ...evalProps}} />              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Evaluable Primitive                         │
│  const { submitResult } = usePrimitiveEvaluation({          │
│    primitiveType: 'tower-stacker',                          │
│    instanceId: data.instanceId,  // ← Auto-injected         │
│    skillId: data.skillId,        // ← Auto-injected         │
│    exhibitId: data.exhibitId,    // ← Auto-injected         │
│  });                                                         │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Registry Marking

Primitives are marked as evaluable in the registry with `supportsEvaluation: true`:

```typescript
// primitiveRegistry.tsx
export const PRIMITIVE_REGISTRY: Record<ComponentId, PrimitiveConfig> = {
  'tower-stacker': {
    component: TowerStacker,
    sectionTitle: 'Tower Stacker',
    showDivider: true,
    dividerStyle: 'left',
    allowMultiple: true,
    containerClassName: 'max-w-6xl mx-auto mb-20',
    supportsEvaluation: true,  // ← Marks this primitive as evaluable
  },
};
```

### 2. Automatic Prop Injection

`ManifestOrderRenderer` detects evaluable primitives and automatically injects:

| Prop | Source | Description |
|------|--------|-------------|
| `instanceId` | Manifest | Unique instance ID for this component |
| `exhibitId` | EvaluationContext | Parent exhibit ID |
| `skillId` | Manifest config | Associated skill (if provided by Gemini) |
| `subskillId` | Manifest config | Associated subskill (if provided by Gemini) |
| `objectiveId` | Objectives | First objective ID linked to this component |

### 3. Primitive Integration

Primitives accept these as **optional props** and pass them to the evaluation hook:

```typescript
interface TowerStackerData {
  // ... component-specific props
  title: string;
  targetHeight: number;

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TowerStackerMetrics>) => void;
}

export const TowerStacker: React.FC<{ data: TowerStackerData }> = ({ data }) => {
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const { submitResult } = usePrimitiveEvaluation<TowerStackerMetrics>({
    primitiveType: 'tower-stacker',
    instanceId: instanceId || `tower-stacker-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // ... rest of component
};
```

## Adding Evaluation to a New Primitive

### Step 1: Define Metrics Type

```typescript
// evaluation/types.ts
export interface YourPrimitiveMetrics extends BasePrimitiveMetrics {
  type: 'your-primitive-type';

  // Goal achievement
  targetValue: number;
  achievedValue: number;
  goalMet: boolean;

  // Domain-specific metrics
  accuracy: number;
  efficiency: number;
}

// Add to union
export type PrimitiveMetrics =
  | TowerStackerMetrics
  | YourPrimitiveMetrics  // ← Add here
  | ...;
```

### Step 2: Export from index.ts

```typescript
// evaluation/index.ts
export type {
  YourPrimitiveMetrics,
} from './types';
```

### Step 3: Mark as Evaluable in Registry

```typescript
// primitiveRegistry.tsx
'your-primitive-type': {
  component: YourPrimitive,
  sectionTitle: 'Your Primitive',
  showDivider: true,
  dividerStyle: 'left',
  allowMultiple: true,
  containerClassName: 'max-w-6xl mx-auto mb-20',
  supportsEvaluation: true,  // ← Add this
},
```

### Step 4: Add Optional Evaluation Props to Interface

```typescript
interface YourPrimitiveData {
  // Component props
  targetValue: number;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<YourPrimitiveMetrics>) => void;
}
```

### Step 5: Integrate Evaluation Hook

```typescript
export const YourPrimitive: React.FC<{ data: YourPrimitiveData }> = ({ data }) => {
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<YourPrimitiveMetrics>({
    primitiveType: 'your-primitive-type',
    instanceId: instanceId || `your-primitive-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const handleComplete = () => {
    if (hasSubmitted) return;

    const success = /* your success logic */;
    const score = /* your scoring logic (0-100) */;

    const metrics: YourPrimitiveMetrics = {
      type: 'your-primitive-type',
      targetValue: data.targetValue,
      achievedValue: /* calculated */,
      goalMet: success,
      accuracy: /* calculated */,
      efficiency: /* calculated */,
    };

    submitResult(success, score, metrics, { /* student work */ });
  };

  const handleReset = () => {
    // Reset component state
    resetAttempt();
  };

  return (/* JSX */);
};
```

## Metadata Flow from Gemini

When Gemini generates an exhibit, it can include evaluation metadata in the manifest:

```json
{
  "componentId": "tower-stacker",
  "instanceId": "tower-1",
  "title": "Build a Stable Tower",
  "intent": "Students practice structural stability...",
  "config": {
    "skillId": "engineering-stability",
    "subskillId": "center-of-gravity",
    "targetHeight": 10,
    "windStrength": 50
  }
}
```

The `ManifestOrderRenderer` automatically extracts:
- `skillId` from `config.skillId`
- `subskillId` from `config.subskillId`
- `objectiveId` from linked objectives

## Benefits of This Pattern

✅ **No manual wiring** - Evaluation props are injected automatically
✅ **Primitives stay clean** - Props are optional, primitives work standalone
✅ **Gemini-friendly** - Content generation doesn't change
✅ **Single integration point** - All logic in `ManifestOrderRenderer`
✅ **Type-safe** - Full TypeScript support
✅ **Flexible** - Works with or without EvaluationProvider

## EvaluationProvider Setup

Wrap your exhibit at the app level:

```typescript
// App.tsx
import { EvaluationProvider } from '@/components/lumina/evaluation';

function App() {
  return (
    <EvaluationProvider
      studentId="student-123"
      exhibitId="physics-forces"
      sessionId="session-abc"
      onCompetencyUpdate={(updates) => {
        console.log('Competency updates:', updates);
      }}
    >
      <ManifestOrderRenderer orderedComponents={orderedComponents} />
    </EvaluationProvider>
  );
}
```

## Troubleshooting

### "No EvaluationContext found" warning

The primitive is not wrapped in an `EvaluationProvider`. Either:
1. Wrap your app/exhibit with the provider
2. The evaluation will work locally but won't sync to backend

### Evaluation props not being injected

Check:
1. `supportsEvaluation: true` is set in the registry
2. `ManifestOrderRenderer` is being used
3. Manifest contains the instanceId

### TypeScript errors on data props

Ensure your data interface includes optional evaluation props:
```typescript
interface YourData {
  // ... your props
  instanceId?: string;
  skillId?: string;
  // ... other evaluation props
}
```

## Currently Evaluable Primitives

The following primitives are marked with `supportsEvaluation: true`:

### Engineering Primitives
- `tower-stacker`
- `bridge-builder`
- `lever-lab`
- `pulley-system-builder`
- `ramp-lab`
- `wheel-axle-explorer`
- `gear-train-builder`

### Math Primitives
- `balance-scale`
- `function-machine`
- `coordinate-graph`

### Adding More

Simply add `supportsEvaluation: true` to any primitive in the registry, then follow the integration steps above.

## See Also

- [README.md](./README.md) - Full evaluation system documentation
- [types.ts](./types.ts) - All metrics interfaces
- [hooks/usePrimitiveEvaluation.ts](./hooks/usePrimitiveEvaluation.ts) - Hook implementation
- [TowerStacker.tsx](../primitives/visual-primitives/engineering/TowerStacker.tsx) - Reference implementation
