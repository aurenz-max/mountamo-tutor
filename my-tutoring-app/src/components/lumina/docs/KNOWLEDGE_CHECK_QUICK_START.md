# Knowledge Check System - Quick Start

## TL;DR

The Knowledge Check system now supports **multiple problem types** using a **registry pattern** that mirrors the backend's `problem_type_schemas.py` approach.

## Two-Phase Generation (Backend Pattern)

### Phase 1: Type Selection
```typescript
// Backend decides WHAT problem types to generate
{
  "selected_types": [
    { "type": "multiple_choice", "count": 2, "reasoning": "..." },
    { "type": "true_false", "count": 3, "reasoning": "..." },
    { "type": "fill_in_blanks", "count": 1, "reasoning": "..." }
  ]
}
```

### Phase 2: Parallel Generation
```typescript
// Backend generates each type in parallel
await Promise.all([
  generateMultipleChoice(count: 2),
  generateTrueFalse(count: 3),
  generateFillInBlanks(count: 1)
])
```

## Usage

### New Format (Recommended)

```tsx
<KnowledgeCheck data={{
  problems: [
    {
      type: 'multiple_choice',
      id: 'mc_1',
      difficulty: 'medium',
      gradeLevel: 'elementary',
      question: 'What is the capital of France?',
      options: [
        { id: 'A', text: 'London' },
        { id: 'B', text: 'Paris' }
      ],
      correctOptionId: 'B',
      rationale: 'Paris is...',
      teachingNote: 'Connect to history',
      successCriteria: ['Identify capitals']
    },
    {
      type: 'true_false',
      id: 'tf_1',
      difficulty: 'easy',
      gradeLevel: 'elementary',
      statement: 'Paris is in France.',
      correct: true,
      rationale: 'France is...',
      teachingNote: 'Use map visuals',
      successCriteria: ['Verify basic facts']
    }
  ]
}} />
```

### Legacy Format (Still Works!)

```tsx
<KnowledgeCheck data={{
  question: 'What is 2 + 2?',
  options: [
    { id: 'A', text: '3' },
    { id: 'B', text: '4' }
  ],
  correctAnswerId: 'B',
  explanation: 'Basic math...'
}} />
```

## 8 Problem Types

| Type | Complexity | Use For |
|------|-----------|---------|
| `multiple_choice` | Medium | Testing comprehension |
| `true_false` | Simple | Quick fact checks |
| `fill_in_blanks` | Simple | Vocabulary recall |
| `matching_activity` | Complex | Building connections |
| `sequencing_activity` | Simple | Ordering steps |
| `categorization_activity` | Complex | Classification |
| `scenario_question` | Complex | Real-world application |
| `short_answer` | Simple | Open-ended responses |

## File Structure

```
primitives/
  ├── KnowledgeCheck.tsx              # Main container
  └── problem-primitives/             # Individual components
      ├── MultipleChoiceProblem.tsx
      ├── TrueFalseProblem.tsx
      ├── FillInBlanksProblem.tsx
      ├── MatchingActivityProblem.tsx
      ├── SequencingActivityProblem.tsx
      ├── CategorizationActivityProblem.tsx
      ├── ScenarioQuestionProblem.tsx
      ├── ShortAnswerProblem.tsx
      └── index.ts

config/
  └── problemTypeRegistry.tsx         # Registry mapping

types.ts                              # All type definitions
docs/
  ├── KNOWLEDGE_CHECK_SYSTEM.md       # Full documentation
  └── KNOWLEDGE_CHECK_QUICK_START.md  # This file
```

## Backend Alignment

This frontend structure mirrors the backend:

```python
# Backend: problem_type_schemas.py

# Phase 1: TYPE_SELECTION_SCHEMA
selected_types = decide_problem_types(topic, objectives)

# Phase 2: PROBLEM_TYPE_METADATA + parallel generation
problems = await generate_all_types_parallel(
    selected_types,
    using=PROBLEM_TYPE_METADATA
)
```

```typescript
// Frontend: problemTypeRegistry.tsx

// Receives generated problems
const problems = [...];  // From backend

// Registry automatically renders each type
<KnowledgeCheck data={{ problems }} />
```

## Adding a New Problem Type

1. **Add to types.ts:**
   ```typescript
   export interface MyNewProblemData extends BaseProblemData {
     type: 'my_new_type';
     customField: string;
   }
   ```

2. **Create component:**
   ```typescript
   // primitives/problem-primitives/MyNewProblem.tsx
   export const MyNewProblem: React.FC<{data: MyNewProblemData}> = ...
   ```

3. **Register it:**
   ```typescript
   // config/problemTypeRegistry.tsx
   PROBLEM_TYPE_REGISTRY['my_new_type'] = {
     component: MyNewProblem,
     complexity: 'medium',
     bestFor: '...'
   };
   ```

Done! ✅

## Key Concepts

### Type Safety
```typescript
// Union type ensures type safety
export type ProblemData =
  | MultipleChoiceProblemData
  | TrueFalseProblemData
  | ...

// TypeScript validates at compile time
```

### Registry Pattern
```typescript
// Map problem types to components
const registry = {
  'multiple_choice': MultipleChoiceProblem,
  'true_false': TrueFalseProblem,
  ...
};

// Automatic rendering
const Component = registry[problem.type];
<Component data={problem} />
```

### Backwards Compatibility
```typescript
// Detects format automatically
if (isLegacyFormat(data)) {
  // Convert to new format
} else {
  // Use new format directly
}
```

## Example Assessment

```typescript
// Progressive difficulty assessment
{
  problems: [
    { type: 'true_false', difficulty: 'easy', ... },     // Warm-up
    { type: 'multiple_choice', difficulty: 'medium', ... }, // Core
    { type: 'fill_in_blanks', difficulty: 'medium', ... },  // Apply
    { type: 'short_answer', difficulty: 'hard', ... }       // Synthesize
  ]
}
```

## Visual Primitives Support

All problem types support optional visual components:

```typescript
{
  type: 'multiple_choice',
  question: 'How many apples?',
  visual: {
    type: 'object-collection',
    data: {
      items: [{ name: 'apple', count: 5, icon: '🍎' }]
    }
  },
  options: [...],
  ...
}
```

Supported visuals:
- `object-collection`
- `comparison-panel`
- `letter-tracing`
- `letter-picture`
- `alphabet-sequence`
- `rhyming-pairs`
- `sight-word-card`
- `sound-sort`

## Benefits

✅ Mix multiple problem types in one assessment
✅ Backend generates types in parallel (faster)
✅ Type-safe rendering with TypeScript
✅ Easy to add new problem types
✅ Backwards compatible with existing code
✅ Consistent styling across all types

## Next Steps

- Read [KNOWLEDGE_CHECK_SYSTEM.md](./KNOWLEDGE_CHECK_SYSTEM.md) for full documentation
- Check [backend/app/generators/problem_type_schemas.py](../../../../backend/app/generators/problem_type_schemas.py) for schema definitions
- See [ADDING_PRIMITIVES.md](./ADDING_PRIMITIVES.md) for registry pattern details
