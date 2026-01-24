# Lumina Evaluation System

A standardized system for capturing, tracking, and submitting student performance data from interactive primitives.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    EvaluationProvider                           │
│  (Wraps exhibit or app - manages submission queue & syncing)    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │ Primitive A │    │ Primitive B │    │ Primitive C │        │
│   │             │    │             │    │             │        │
│   │ usePrimitive│    │ usePrimitive│    │ usePrimitive│        │
│   │ Evaluation()│    │ Evaluation()│    │ Evaluation()│        │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘        │
│          │                  │                  │                │
│          └──────────────────┼──────────────────┘                │
│                             ▼                                   │
│                    submitEvaluation()                           │
│                             │                                   │
├─────────────────────────────┼───────────────────────────────────┤
│                             ▼                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Submission Queue                           │   │
│   │  - Offline support (localStorage)                       │   │
│   │  - Auto-retry on failure                                │   │
│   │  - Batch submission                                     │   │
│   │  - Auto-flush on reconnection                           │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
└─────────────────────────────┼───────────────────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │  Backend API    │
                    │ /api/evaluations│
                    └─────────────────┘
```

## Quick Start

### 1. Wrap your app/exhibit with EvaluationProvider

```tsx
import { EvaluationProvider } from '@/components/lumina/evaluation';

function ExhibitWrapper() {
  return (
    <EvaluationProvider
      studentId="student-123"
      exhibitId="physics-forces"
      onCompetencyUpdate={(updates) => console.log('Competency updates:', updates)}
    >
      <YourPrimitives />
    </EvaluationProvider>
  );
}
```

### 2. Use the hook in your primitive

```tsx
import { usePrimitiveEvaluation, type YourMetrics } from '@/components/lumina/evaluation';

const { submitResult, hasSubmitted } = usePrimitiveEvaluation<YourMetrics>({
  primitiveType: 'your-primitive-type',
  instanceId: 'unique-instance-id',
  skillId: 'optional-skill-id',
});

// When the user completes the task:
submitResult(
  true,           // success: boolean
  85,             // score: number (0-100)
  { /* metrics */ },
  { /* studentWork artifact */ }
);
```

---

## Adding Evaluation to a New Primitive

### Step 1: Define Your Metrics Type

Add your metrics interface to `types.ts`. Your metrics should capture **domain-specific measurements** that are meaningful for learning analytics.

```typescript
// In types.ts

export interface YourPrimitiveMetrics extends BasePrimitiveMetrics {
  // REQUIRED: Discriminator field (must match primitiveType)
  type: 'your-primitive-type';

  // Goal achievement
  targetValue: number;
  achievedValue: number;
  goalMet: boolean;

  // Domain-specific measurements
  // (What concepts did they demonstrate? How did they perform?)
  conceptA: number;
  conceptB: boolean;

  // Efficiency metrics (optional but recommended)
  attemptsCount: number;
  hintsUsed: number;
  efficiency: number;

  // State for replay (optional)
  finalState: YourStateType[];
}
```

### Step 2: Add to the Discriminated Union

In `types.ts`, add your metrics type to the union:

```typescript
export type PrimitiveMetrics =
  // Engineering
  | TowerStackerMetrics
  | BridgeBuilderMetrics
  // ... existing types
  | YourPrimitiveMetrics;  // Add here
```

### Step 3: Export from index.ts

```typescript
// In index.ts
export type {
  // ... existing exports
  YourPrimitiveMetrics,
} from './types';
```

### Step 4: Integrate the Hook in Your Component

```tsx
'use client';

import { usePrimitiveEvaluation, type YourPrimitiveMetrics } from '@/components/lumina/evaluation';

interface YourPrimitiveData {
  // Component props
  targetValue: number;

  // Evaluation integration (optional props)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<YourPrimitiveMetrics>) => void;
}

export const YourPrimitive: React.FC<{ data: YourPrimitiveData }> = ({ data }) => {
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
    elapsedMs,
    markCheckpoint,  // For multi-stage tasks
  } = usePrimitiveEvaluation<YourPrimitiveMetrics>({
    primitiveType: 'your-primitive-type',
    instanceId: instanceId || `your-primitive-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Your component state
  const [state, setState] = useState(/* initial state */);

  // Handle completion
  const handleComplete = () => {
    if (hasSubmitted) return; // Prevent double submission

    // Calculate success and score
    const success = /* your success logic */;
    const score = /* your scoring logic (0-100) */;

    // Build metrics object
    const metrics: YourPrimitiveMetrics = {
      type: 'your-primitive-type',
      targetValue: data.targetValue,
      achievedValue: /* calculated */,
      goalMet: success,
      conceptA: /* measured value */,
      conceptB: /* boolean check */,
      attemptsCount: /* count */,
      hintsUsed: /* count */,
      efficiency: /* calculated */,
      finalState: /* clone of state */,
    };

    // Submit
    submitResult(success, score, metrics, { state });
  };

  // Handle reset for retry
  const handleReset = () => {
    setState(/* initial state */);
    resetAttempt(); // Resets attemptId, timing, submission state
  };

  return (/* your JSX */);
};
```

---

## Metrics Design Guidelines

### What to Capture

| Category | Purpose | Examples |
|----------|---------|----------|
| **Goal Achievement** | Did they complete the objective? | `goalMet`, `targetReached`, `solutionFound` |
| **Accuracy** | How close were they to the target? | `error`, `accuracy`, `precision` |
| **Efficiency** | How resourcefully did they work? | `attemptsCount`, `hintsUsed`, `stepsToSolve` |
| **Concept Demonstration** | What understanding did they show? | `conceptApplied`, `variablesExplored` |
| **Process Data** | How did they approach the problem? | `operationsPerformed[]`, `strategyUsed` |
| **Final State** | What did they produce? | `placedPieces[]`, `drawnPath[]`, `configuration` |

### Scoring Guidelines

Scores should be **normalized to 0-100** and reflect overall performance:

```typescript
// Example: Composite scoring
const score = (
  goalAchievementWeight * (goalMet ? 100 : partialProgress * 100) +
  accuracyWeight * accuracy +
  efficiencyWeight * efficiency
);

// Clamp to valid range
const finalScore = Math.max(0, Math.min(100, score));
```

### Partial Credit

For multi-objective tasks, use the `partialCredit` field:

```typescript
submitResult(
  fullySuccessful,  // success: only true if ALL objectives met
  overallScore,     // score: weighted average
  metrics,
  studentWork,
  partialCreditScore // partialCredit: score for what they DID accomplish
);
```

---

## Reference: Existing Metrics Patterns

### Engineering Primitives Pattern

```typescript
interface EngineeringMetrics {
  // Goal
  targetX: number;
  achievedX: number;
  goalMet: boolean;

  // Testing/Validation
  testPassed: boolean;
  testCondition: number;

  // Efficiency
  resourcesUsed: number;
  resourcesAvailable: number;
  efficiency: number;

  // Domain concepts
  physicsPropertyA: number;
  physicsPropertyB: number;

  // Replay state
  finalConfiguration: ComponentState[];
}
```

**Examples:** TowerStacker, BridgeBuilder, LeverLab

### Assessment Primitives Pattern

```typescript
interface AssessmentMetrics {
  // Correctness
  isCorrect: boolean;
  selectedAnswer: string | string[];
  correctAnswer: string | string[];

  // Accuracy (for multi-part)
  totalItems: number;
  correctItems: number;
  accuracy: number; // correctItems / totalItems

  // Behavior
  attemptCount: number;
  changedAnswer: boolean;
  timeToFirstAnswer: number;

  // Per-item details (if applicable)
  itemResults: Array<{
    itemId: string;
    selected: string;
    correct: string;
    isCorrect: boolean;
  }>;
}
```

**Examples:** MultipleChoice, FillInBlanks, Matching, Sequencing

### Exploration Primitives Pattern

```typescript
interface ExplorationMetrics {
  // Discovery
  ruleToDiscover: string;
  ruleDiscovered: boolean;

  // Exploration breadth
  inputsExplored: number[];
  outputsObserved: number[];
  variablesManipulated: string[];

  // Process
  attemptsToDiscover: number;
  hintsUsed: number;
  experimentCount: number;

  // Predictions (if applicable)
  predictionsMade: number;
  correctPredictions: number;
  predictionAccuracy: number;
}
```

**Examples:** FunctionMachine, RampLab

---

## Hook API Reference

### `usePrimitiveEvaluation<TMetrics>(options)`

#### Options

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `primitiveType` | `ComponentId` | Yes | Type identifier (must match metrics `type`) |
| `instanceId` | `string` | Yes | Unique instance ID within the session |
| `skillId` | `string` | No | Associated skill for competency tracking |
| `subskillId` | `string` | No | Associated subskill |
| `objectiveId` | `string` | No | Learning objective ID |
| `exhibitId` | `string` | No | Parent exhibit ID |
| `onSubmit` | `(result) => void` | No | Callback when result is submitted |
| `onSubmitSuccess` | `(result) => void` | No | Callback on successful backend submission |
| `onSubmitError` | `(error, result) => void` | No | Callback on submission failure |
| `autoSubmitOnUnmount` | `boolean` | No | Submit pending work on unmount (default: false) |

#### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `attemptId` | `string` | Unique ID for this attempt |
| `startedAt` | `string` | ISO timestamp when attempt started |
| `elapsedMs` | `number` | Elapsed time in milliseconds |
| `isSubmitting` | `boolean` | Whether submission is in progress |
| `hasSubmitted` | `boolean` | Whether result has been submitted |
| `submittedResult` | `PrimitiveEvaluationResult \| null` | The submitted result |
| `submitResult` | `(success, score, metrics, studentWork?, partialCredit?) => result` | Submit the evaluation |
| `resetAttempt` | `() => void` | Reset for a new attempt |
| `markCheckpoint` | `(name, data?) => void` | Mark a checkpoint (multi-stage) |
| `checkpoints` | `Array<{name, timestamp, data?}>` | All checkpoints |

---

## EvaluationProvider Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sessionId` | `string` | auto-generated | Session identifier |
| `exhibitId` | `string` | - | Parent exhibit ID |
| `studentId` | `string` | - | Student identifier |
| `maxRetries` | `number` | `3` | Max retry attempts for failed submissions |
| `retryDelay` | `number` | `2000` | Delay between retries (ms) |
| `autoFlushInterval` | `number` | `30000` | Auto-flush interval (ms). `0` to disable |
| `persistToStorage` | `boolean` | `true` | Persist pending evaluations to localStorage |
| `onCompetencyUpdate` | `(updates) => void` | - | Callback when competency updates received |

---

## Backend Integration

### Endpoints Expected

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/evaluations/submit` | POST | Submit single evaluation |
| `/api/evaluations/submit-batch` | POST | Submit multiple evaluations |
| `/api/evaluations/session-summary` | POST | Submit session summary |
| `/api/evaluations/student/:id/history` | GET | Get evaluation history |
| `/api/evaluations/student/:id/stats` | GET | Get aggregated stats |
| `/api/evaluations/:id/replay` | GET | Get evaluation for replay |

### Request Payload

```typescript
// Single submission
{
  primitiveType: string;
  instanceId: string;
  attemptId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  success: boolean;
  score: number;
  partialCredit?: number;
  metrics: PrimitiveMetrics;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  studentWork?: unknown;
  studentId?: string;
}
```

### Response

```typescript
{
  success: boolean;
  evaluationId: string;
  competencyUpdates?: Array<{
    skillId: string;
    subskillId?: string;
    currentScore: number;
    suggestedScore: number;
    scoreDelta: number;
    confidence: 'low' | 'medium' | 'high';
  }>;
}
```

---

## Checklist for Adding a New Primitive

- [ ] Define metrics interface in `types.ts`
- [ ] Add type to `PrimitiveMetrics` union in `types.ts`
- [ ] Export type from `index.ts`
- [ ] Add optional type guard function in `types.ts` (recommended)
- [ ] Import and use `usePrimitiveEvaluation` in your component
- [ ] Add optional evaluation props to your component's data interface
- [ ] Implement completion handler that calls `submitResult`
- [ ] Implement reset handler that calls `resetAttempt`
- [ ] Test with EvaluationProvider wrapper

---

## Example: Complete Integration (GearTrain)

Here's a complete example following the TowerStacker pattern:

```tsx
'use client';

import { usePrimitiveEvaluation, type GearTrainMetrics } from '@/components/lumina/evaluation';

interface GearTrainData {
  title: string;
  targetGearRatio: number;
  targetOutputDirection: 'clockwise' | 'counter-clockwise';
  availableGears: { teeth: number; count: number }[];

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
}

export const GearTrain: React.FC<{ data: GearTrainData }> = ({ data }) => {
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<GearTrainMetrics>({
    primitiveType: 'gear-train',
    instanceId: data.instanceId || `gear-train-${Date.now()}`,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
  });

  const [placedGears, setPlacedGears] = useState<PlacedGear[]>([]);

  const handleTest = () => {
    if (hasSubmitted) return;

    // Calculate results
    const achievedRatio = calculateGearRatio(placedGears);
    const achievedDirection = calculateOutputDirection(placedGears);

    const ratioGoalMet = Math.abs(achievedRatio - data.targetGearRatio) < 0.01;
    const directionCorrect = achievedDirection === data.targetOutputDirection;
    const success = ratioGoalMet && directionCorrect;

    // Score: 60% ratio accuracy + 40% direction
    const ratioAccuracy = 1 - Math.min(Math.abs(achievedRatio - data.targetGearRatio) / data.targetGearRatio, 1);
    const score = (ratioAccuracy * 60) + (directionCorrect ? 40 : 0);

    const metrics: GearTrainMetrics = {
      type: 'gear-train',
      targetGearRatio: data.targetGearRatio,
      achievedGearRatio: achievedRatio,
      ratioGoalMet,
      targetOutputDirection: data.targetOutputDirection,
      achievedOutputDirection: achievedDirection,
      directionCorrect,
      gearCount: placedGears.length,
      gearSizes: placedGears.map(g => g.teeth),
      speedMultiplier: 1 / achievedRatio,
      torqueMultiplier: achievedRatio,
    };

    submitResult(success, score, metrics, { placedGears });
  };

  const handleReset = () => {
    setPlacedGears([]);
    resetAttempt();
  };

  return (/* JSX */);
};
```

---

## Troubleshooting

### "No EvaluationContext found" warning

Your primitive is not wrapped in an `EvaluationProvider`. Either:
1. Wrap your app/exhibit with the provider
2. The evaluation will work locally but won't sync to backend

### Submissions not reaching backend

1. Check browser Network tab for API errors
2. Check `pendingSubmissions` and `failedSubmissions` via context
3. Verify `isOnline` status
4. Check localStorage for `lumina_evaluation_pending` key

### Metrics type errors

Ensure your metrics interface:
1. Extends `BasePrimitiveMetrics`
2. Has a `type` discriminator matching your `primitiveType`
3. Is added to the `PrimitiveMetrics` union
