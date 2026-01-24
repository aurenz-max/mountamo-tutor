# Evaluation System Architecture

## System Overview

The Lumina evaluation system provides a unified way to track student performance across all interactive primitives with automatic prop injection.

## Component Hierarchy

```
┌──────────────────────────────────────────────────────────────┐
│                       App / Exhibit Root                      │
│  - Manages exhibit lifecycle                                  │
│  - Provides student and session context                       │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                   EvaluationProvider                          │
│  - Manages submission queue                                   │
│  - Handles offline/retry logic                                │
│  - Syncs to backend                                           │
│  - Provides exhibitId context                                 │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                   ExhibitProvider                             │
│  - Provides objectives mapping                                │
│  - Provides manifest items                                    │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                ManifestOrderRenderer                          │
│  - Iterates over orderedComponents                            │
│  - Looks up config in PRIMITIVE_REGISTRY                      │
│  - If config.supportsEvaluation === true:                     │
│    • Extracts instanceId from manifest                        │
│    • Extracts skillId from manifest.config                    │
│    • Extracts subskillId from manifest.config                 │
│    • Gets objectiveId from linked objectives                  │
│    • Gets exhibitId from EvaluationContext                    │
│    • Injects all as props into component data                 │
│  - Renders: <Component data={{...data, ...evalProps}} />     │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              Evaluable Primitive Component                    │
│  - Receives evaluation props (instanceId, skillId, etc.)      │
│  - Calls usePrimitiveEvaluation() with these props            │
│  - On task completion, calls submitResult()                   │
│  - On reset, calls resetAttempt()                             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              usePrimitiveEvaluation Hook                      │
│  - Tracks attempt timing (startedAt, elapsedMs)               │
│  - Generates unique attemptId                                 │
│  - Builds PrimitiveEvaluationResult on submit                 │
│  - Calls context.submitEvaluation()                           │
│  - Manages submission state (isSubmitting, hasSubmitted)      │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              EvaluationContext.submitEvaluation               │
│  - Adds to submission queue                                   │
│  - Attempts immediate submission                              │
│  - If offline/failed: stores in localStorage                  │
│  - Retries on reconnection                                    │
│  - Batch submits when queue grows                             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  Backend API                                  │
│  POST /api/evaluations/submit                                 │
│  - Stores evaluation data                                     │
│  - Updates competency scores                                  │
│  - Returns competency update suggestions                      │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Manifest Generation (Gemini)

```json
{
  "componentId": "tower-stacker",
  "instanceId": "tower-1",
  "title": "Build a Stable Tower",
  "intent": "Practice center of gravity...",
  "config": {
    "skillId": "engineering-stability",      // ← Added by Gemini
    "subskillId": "center-of-gravity",       // ← Added by Gemini
    "targetHeight": 10,
    "windStrength": 50
  },
  "objectiveIds": ["obj-1"]                   // ← Linked objectives
}
```

### 2. Prop Injection (ManifestOrderRenderer)

```typescript
// ManifestOrderRenderer extracts and injects:
const evalProps = {
  instanceId: 'tower-1',                      // from manifest.instanceId
  exhibitId: 'physics-forces',                // from EvaluationContext
  skillId: 'engineering-stability',           // from manifest.config.skillId
  subskillId: 'center-of-gravity',            // from manifest.config.subskillId
  objectiveId: 'obj-1',                       // from linked objectives[0]
};

// Rendered as:
<TowerStacker data={{ ...originalData, ...evalProps }} />
```

### 3. Evaluation Submission (Primitive)

```typescript
// In TowerStacker component:
const { submitResult } = usePrimitiveEvaluation<TowerStackerMetrics>({
  primitiveType: 'tower-stacker',
  instanceId: data.instanceId,                // 'tower-1'
  skillId: data.skillId,                      // 'engineering-stability'
  subskillId: data.subskillId,                // 'center-of-gravity'
  objectiveId: data.objectiveId,              // 'obj-1'
  exhibitId: data.exhibitId,                  // 'physics-forces'
});

// On completion:
submitResult(
  success,    // true/false
  score,      // 0-100
  metrics,    // TowerStackerMetrics
  studentWork // { placedPieces: [...] }
);
```

### 4. Backend Payload

```json
{
  "primitiveType": "tower-stacker",
  "instanceId": "tower-1",
  "attemptId": "uuid-1234",
  "startedAt": "2026-01-23T10:00:00Z",
  "completedAt": "2026-01-23T10:02:30Z",
  "durationMs": 150000,
  "success": true,
  "score": 85,
  "metrics": {
    "type": "tower-stacker",
    "targetHeight": 10,
    "achievedHeight": 12,
    "heightGoalMet": true,
    "stabilityScore": 85,
    "windTestPassed": true,
    "windStrength": 50,
    "piecesUsed": 8,
    "efficiency": 1.5,
    "baseWidth": 4,
    "centerOfGravityOffset": 0.2,
    "placedPieces": [...]
  },
  "skillId": "engineering-stability",
  "subskillId": "center-of-gravity",
  "objectiveId": "obj-1",
  "exhibitId": "physics-forces",
  "studentId": "student-123",
  "studentWork": { "placedPieces": [...] }
}
```

## Registry Configuration

### Marking a Primitive as Evaluable

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
    supportsEvaluation: true,  // ← This triggers auto-injection
  },
};
```

## Key Interfaces

### PrimitiveConfig

```typescript
interface PrimitiveConfig {
  component: React.ComponentType<any>;
  sectionTitle?: string;
  showDivider?: boolean;
  dividerStyle?: 'left' | 'center';
  containerClassName?: string;
  allowMultiple?: boolean;
  supportsEvaluation?: boolean;  // ← New field
}
```

### PrimitiveEvaluationResult

```typescript
interface PrimitiveEvaluationResult<TMetrics extends PrimitiveMetrics> {
  primitiveType: ComponentId;
  instanceId: string;
  attemptId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  success: boolean;
  score: number;
  partialCredit?: number;
  metrics: TMetrics;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  studentWork?: unknown;
  studentId?: string;
}
```

### BasePrimitiveMetrics

```typescript
interface BasePrimitiveMetrics {
  type: string;  // Discriminator - must match primitiveType
}
```

## Evaluation Lifecycle States

```
┌─────────────┐
│   IDLE      │  hasSubmitted = false, isSubmitting = false
└──────┬──────┘
       │ submitResult()
       ▼
┌─────────────┐
│ SUBMITTING  │  hasSubmitted = false, isSubmitting = true
└──────┬──────┘
       │ success/failure
       ▼
┌─────────────┐
│  SUBMITTED  │  hasSubmitted = true, isSubmitting = false
└──────┬──────┘
       │ resetAttempt()
       ▼
┌─────────────┐
│   IDLE      │  (new attemptId, reset timing)
└─────────────┘
```

## Offline/Retry Flow

```
submitResult()
     │
     ▼
Is online? ──No──┐
     │           │
    Yes          │
     │           │
     ▼           ▼
Submit to    Add to queue
  backend    Store in localStorage
     │           │
  Success?      │
     │ No       │
     ▼          │
Add to retry    │
   queue        │
     │          │
     └──────┬───┘
            │
            ▼
    Retry on reconnection
    or auto-flush (30s)
```

## Extension Points

### Custom Metrics

Define domain-specific metrics for your primitive:

```typescript
interface YourMetrics extends BasePrimitiveMetrics {
  type: 'your-primitive';
  conceptMastery: number;
  errorRate: number;
  strategyUsed: 'approach-a' | 'approach-b';
}
```

### Custom Submission Callbacks

```typescript
const { submitResult } = usePrimitiveEvaluation({
  primitiveType: 'your-primitive',
  instanceId: data.instanceId,
  onSubmit: (result) => {
    console.log('Local callback:', result);
  },
  onSubmitSuccess: (result) => {
    console.log('Backend confirmed:', result);
  },
  onSubmitError: (error, result) => {
    console.error('Submission failed:', error);
  },
});
```

### Checkpoints (Multi-Stage Tasks)

For tasks with intermediate milestones:

```typescript
const { markCheckpoint, checkpoints } = usePrimitiveEvaluation({
  primitiveType: 'multi-stage-lab',
  instanceId: data.instanceId,
});

// Mark intermediate progress
markCheckpoint('setup-complete', { apparatusConfigured: true });
markCheckpoint('data-collected', { measurements: [...] });
markCheckpoint('analysis-done', { conclusion: '...' });

// On final submission, checkpoints are included in the result
```

## Benefits Summary

✅ **Automatic prop injection** - No manual wiring in parent components
✅ **Type-safe** - Full TypeScript support throughout
✅ **Offline-resilient** - Queue + retry + localStorage persistence
✅ **Flexible metadata** - Gemini can provide skillId, subskillId in manifest
✅ **Single integration point** - All logic centralized in renderer
✅ **Graceful degradation** - Works without EvaluationProvider (local only)
✅ **Scalable** - Easy to add new evaluable primitives

## See Also

- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Step-by-step integration
- [README.md](./README.md) - Full evaluation system documentation
- [types.ts](./types.ts) - All metrics type definitions
