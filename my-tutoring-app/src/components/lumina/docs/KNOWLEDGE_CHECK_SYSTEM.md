# Knowledge Check System - Problem Registry Architecture

## Overview

The Knowledge Check system uses a **registry-based architecture** inspired by the backend's `problem_type_schemas.py`. This allows for:

- **Multiple problem types** in a single knowledge check
- **Parallel generation** of different problem types (mirroring backend approach)
- **Type-safe** problem rendering with TypeScript
- **Backwards compatibility** with existing single multiple-choice format
- **Scalable** - easy to add new problem types

## Architecture

### Key Files

```
my-tutoring-app/src/components/lumina/
├── types.ts                           # Problem type definitions
├── primitives/
│   ├── KnowledgeCheck.tsx            # Main container component
│   └── problem-primitives/           # Individual problem components
│       ├── index.ts                  # Exports all problem components
│       ├── MultipleChoiceProblem.tsx
│       ├── TrueFalseProblem.tsx
│       ├── FillInBlanksProblem.tsx
│       ├── MatchingActivityProblem.tsx
│       ├── SequencingActivityProblem.tsx
│       ├── CategorizationActivityProblem.tsx
│       ├── ScenarioQuestionProblem.tsx
│       └── ShortAnswerProblem.tsx
└── config/
    └── problemTypeRegistry.tsx       # Registry mapping types to components
```

## Problem Types

The system supports 8 problem types (matching backend schemas):

| Type | Complexity | Best For |
|------|-----------|----------|
| `multiple_choice` | Medium | Comprehension testing, concept assessment |
| `true_false` | Simple | Quick fact checking, misconception identification |
| `fill_in_blanks` | Simple | Vocabulary practice, key term recall |
| `matching_activity` | Complex | Building relationships, connecting concepts |
| `sequencing_activity` | Simple | Process understanding, chronological ordering |
| `categorization_activity` | Complex | Classification skills, grouping by attributes |
| `scenario_question` | Complex | Real-world application, critical thinking |
| `short_answer` | Simple | Open-ended responses, explanation practice |

## Usage

### Backend: Type Selection + Parallel Generation

Following the backend pattern from `problem_type_schemas.py`:

#### Step 1: Type Selection (using TYPE_SELECTION_SCHEMA)

```python
# Backend determines which problem types to generate
type_selection_result = {
    "selected_types": [
        {
            "type": "multiple_choice",
            "count": 2,
            "reasoning": "Test comprehension of key concepts"
        },
        {
            "type": "true_false",
            "count": 3,
            "reasoning": "Quick verification of basic facts"
        },
        {
            "type": "fill_in_blanks",
            "count": 1,
            "reasoning": "Vocabulary recall in context"
        }
    ],
    "overall_reasoning": "Mix of question types for comprehensive assessment"
}
```

#### Step 2: Parallel Generation (using specific schemas)

```python
# Backend generates problems in parallel using PROBLEM_TYPE_METADATA
import asyncio

async def generate_problems_parallel(selected_types):
    tasks = []

    for type_selection in selected_types:
        problem_type = type_selection['type']
        count = type_selection['count']

        # Get schema and model from PROBLEM_TYPE_METADATA
        metadata = PROBLEM_TYPE_METADATA[problem_type]
        schema = metadata['schema']
        model = metadata['model']  # e.g., "gemini-flash-latest"

        # Create generation task
        task = generate_problem_type(
            problem_type=problem_type,
            count=count,
            schema=schema,
            model=model
        )
        tasks.append(task)

    # Run all generations in parallel
    results = await asyncio.gather(*tasks)

    # Flatten results into single problem list
    all_problems = []
    for result in results:
        all_problems.extend(result['problems'])

    return all_problems
```

### Frontend: Rendering Problems

#### New Format (Problem Registry)

```tsx
import { KnowledgeCheck } from './primitives/KnowledgeCheck';

// Use the problem registry format
const knowledgeCheckData = {
  problems: [
    {
      type: 'multiple_choice',
      id: 'mc_1',
      difficulty: 'medium',
      gradeLevel: 'elementary',
      question: 'What is the capital of France?',
      options: [
        { id: 'A', text: 'London' },
        { id: 'B', text: 'Paris' },
        { id: 'C', text: 'Berlin' },
        { id: 'D', text: 'Madrid' }
      ],
      correctOptionId: 'B',
      rationale: 'Paris has been the capital of France since...',
      teachingNote: 'Connect this to French history',
      successCriteria: ['Identify capital cities', 'Recognize European geography']
    },
    {
      type: 'true_false',
      id: 'tf_1',
      difficulty: 'easy',
      gradeLevel: 'elementary',
      statement: 'The Eiffel Tower is located in Paris.',
      correct: true,
      rationale: 'The Eiffel Tower was built in 1889...',
      teachingNote: 'Famous landmarks help students remember locations',
      successCriteria: ['Identify famous landmarks']
    },
    {
      type: 'fill_in_blanks',
      id: 'fib_1',
      difficulty: 'medium',
      gradeLevel: 'elementary',
      textWithBlanks: 'France is a country in [blank_1] Europe, and its capital is [blank_2].',
      blanks: [
        {
          id: 'blank_1',
          correctAnswers: ['Western', 'western', 'West'],
          caseSensitive: false
        },
        {
          id: 'blank_2',
          correctAnswers: ['Paris'],
          caseSensitive: false
        }
      ],
      rationale: 'Understanding geography vocabulary is essential...',
      teachingNote: 'Accept variant spellings where appropriate',
      successCriteria: ['Use geographic vocabulary correctly']
    }
  ]
};

<KnowledgeCheck data={knowledgeCheckData} />
```

#### Legacy Format (Backwards Compatible)

```tsx
// Still works! Automatically converted to problem registry format
const legacyData = {
  question: 'What is 2 + 2?',
  options: [
    { id: 'A', text: '3' },
    { id: 'B', text: '4' },
    { id: 'C', text: '5' }
  ],
  correctAnswerId: 'B',
  explanation: 'Basic addition...',
  visual: {
    type: 'object-collection',
    data: { /* visual data */ }
  }
};

<KnowledgeCheck data={legacyData} />
```

## Problem Type Examples

### 1. Multiple Choice

```typescript
{
  type: 'multiple_choice',
  id: 'mc_1',
  difficulty: 'medium',
  gradeLevel: 'middle-school',
  question: 'Which process converts sunlight into chemical energy?',
  visual: {
    type: 'comparison-panel',
    data: { /* diagram of photosynthesis */ }
  },
  options: [
    { id: 'A', text: 'Respiration' },
    { id: 'B', text: 'Photosynthesis' },
    { id: 'C', text: 'Digestion' }
  ],
  correctOptionId: 'B',
  rationale: 'Photosynthesis is the process by which plants...',
  teachingNote: 'Connect to energy flow in ecosystems',
  successCriteria: ['Identify biological processes', 'Understand energy conversion']
}
```

### 2. True/False

```typescript
{
  type: 'true_false',
  id: 'tf_1',
  difficulty: 'easy',
  gradeLevel: 'elementary',
  statement: 'All mammals lay eggs.',
  correct: false,
  rationale: 'Most mammals give birth to live young. Only monotremes...',
  teachingNote: 'Use platypus as exception example',
  successCriteria: ['Classify animals by characteristics']
}
```

### 3. Fill in Blanks

```typescript
{
  type: 'fill_in_blanks',
  id: 'fib_1',
  difficulty: 'medium',
  gradeLevel: 'elementary',
  textWithBlanks: 'The [blank_1] is the powerhouse of the [blank_2].',
  blanks: [
    {
      id: 'blank_1',
      correctAnswers: ['mitochondria', 'Mitochondria'],
      caseSensitive: false
    },
    {
      id: 'blank_2',
      correctAnswers: ['cell'],
      caseSensitive: false
    }
  ],
  rationale: 'The mitochondria generates ATP...',
  teachingNote: 'Classic biology meme helps retention',
  successCriteria: ['Identify cell organelles and functions']
}
```

### 4. Matching Activity

```typescript
{
  type: 'matching_activity',
  id: 'match_1',
  difficulty: 'complex',
  gradeLevel: 'middle-school',
  prompt: 'Match each scientist to their discovery',
  leftItems: [
    { id: 'L1', text: 'Isaac Newton' },
    { id: 'L2', text: 'Marie Curie' },
    { id: 'L3', text: 'Albert Einstein' }
  ],
  rightItems: [
    { id: 'R1', text: 'Radioactivity' },
    { id: 'R2', text: 'Theory of Relativity' },
    { id: 'R3', text: 'Laws of Motion' }
  ],
  mappings: [
    { leftId: 'L1', rightIds: ['R3'] },
    { leftId: 'L2', rightIds: ['R1'] },
    { leftId: 'L3', rightIds: ['R2'] }
  ],
  rationale: 'Understanding scientific contributions builds historical context...',
  teachingNote: 'Discuss how discoveries build on each other',
  successCriteria: ['Connect scientists to contributions']
}
```

### 5. Sequencing Activity

```typescript
{
  type: 'sequencing_activity',
  id: 'seq_1',
  difficulty: 'simple',
  gradeLevel: 'elementary',
  instruction: 'Arrange the life cycle stages of a butterfly in order',
  items: [
    'Egg',
    'Larva (Caterpillar)',
    'Pupa (Chrysalis)',
    'Adult Butterfly'
  ],
  rationale: 'The butterfly undergoes complete metamorphosis...',
  teachingNote: 'Use real images to reinforce each stage',
  successCriteria: ['Understand life cycle sequences']
}
```

### 6. Categorization Activity

```typescript
{
  type: 'categorization_activity',
  id: 'cat_1',
  difficulty: 'complex',
  gradeLevel: 'middle-school',
  instruction: 'Sort these words by part of speech',
  categories: ['Noun', 'Verb', 'Adjective'],
  categorizationItems: [
    { itemText: 'run', correctCategory: 'Verb' },
    { itemText: 'beautiful', correctCategory: 'Adjective' },
    { itemText: 'cat', correctCategory: 'Noun' },
    { itemText: 'quickly', correctCategory: 'Adjective' },
    { itemText: 'think', correctCategory: 'Verb' }
  ],
  rationale: 'Parts of speech determine how words function...',
  teachingNote: 'Use sentence examples to clarify',
  successCriteria: ['Identify parts of speech in context']
}
```

### 7. Scenario Question

```typescript
{
  type: 'scenario_question',
  id: 'scen_1',
  difficulty: 'complex',
  gradeLevel: 'high-school',
  scenario: 'A ball is thrown upward with an initial velocity of 20 m/s from the top of a 50m tall building.',
  scenarioQuestion: 'What is the maximum height the ball will reach above the ground?',
  scenarioAnswer: 'The ball will reach approximately 70.4 meters above the ground. Using the equation v² = u² + 2as, where v=0 at max height, u=20 m/s, a=-9.8 m/s², we get s ≈ 20.4m above the building, totaling 70.4m from the ground.',
  rationale: 'This problem applies kinematic equations to vertical motion...',
  teachingNote: 'Draw a diagram showing the trajectory',
  successCriteria: ['Apply kinematic equations', 'Solve multi-step problems']
}
```

### 8. Short Answer

```typescript
{
  type: 'short_answer',
  id: 'sa_1',
  difficulty: 'simple',
  gradeLevel: 'elementary',
  question: 'In your own words, explain why seasons occur.',
  rationale: 'Seasons occur because Earth\'s axis is tilted at 23.5° relative to its orbit around the Sun. This tilt means different parts of Earth receive varying amounts of sunlight throughout the year.',
  teachingNote: 'Look for understanding of axis tilt, not perfect wording',
  successCriteria: [
    'Mentions Earth\'s tilt or axis',
    'Connects tilt to sunlight variation',
    'Explains how this causes seasonal changes'
  ]
}
```

## How It Works

### 1. Type Selection Phase (Backend)

The backend first decides **what types** of problems to generate:

```python
# Uses TYPE_SELECTION_SCHEMA
selected_types = [
    {"type": "multiple_choice", "count": 2},
    {"type": "true_false", "count": 3},
    {"type": "fill_in_blanks", "count": 1}
]
```

### 2. Parallel Generation Phase (Backend)

Then generates all problems **in parallel** using type-specific schemas:

```python
# Each type uses its own schema from PROBLEM_TYPE_METADATA
multiple_choice_problems = generate_with_schema(
    MULTIPLE_CHOICE_GENERATION_SCHEMA,
    model="gemini-flash-latest",
    count=2
)

true_false_problems = generate_with_schema(
    TRUE_FALSE_GENERATION_SCHEMA,
    model="gemini-flash-lite-latest",  # Simpler problems = faster model
    count=3
)

fill_in_blanks_problems = generate_with_schema(
    FILL_IN_BLANKS_GENERATION_SCHEMA,
    model="gemini-flash-lite-latest",
    count=1
)
```

### 3. Frontend Rendering

The `KnowledgeCheck` component receives all problems and uses the registry:

```typescript
// KnowledgeCheck.tsx automatically:
// 1. Detects format (legacy vs registry)
// 2. Maps each problem type to its component
// 3. Renders with consistent styling

<KnowledgeCheck data={{ problems: all_generated_problems }} />
```

### 4. Problem Registry Lookup

Each problem is rendered via the registry:

```typescript
// problemTypeRegistry.tsx
const config = PROBLEM_TYPE_REGISTRY[problem.type];
const ProblemComponent = config.component;

return <ProblemComponent data={problem} />;
```

## Adding New Problem Types

Following the same pattern as `ADDING_PRIMITIVES.md`:

### Step 1: Add Type Definition

```typescript
// types.ts

export type ProblemType =
  | 'multiple_choice'
  | 'true_false'
  // ... existing types
  | 'my_new_type';  // ← Add here

export interface MyNewTypeProblemData extends BaseProblemData {
  type: 'my_new_type';
  // Add type-specific fields
  customField: string;
}

// Add to union type
export type ProblemData =
  | MultipleChoiceProblemData
  | TrueFalseProblemData
  // ... existing types
  | MyNewTypeProblemData;  // ← Add here
```

### Step 2: Create Problem Component

```typescript
// primitives/problem-primitives/MyNewTypeProblem.tsx

'use client';
import React, { useState } from 'react';
import { MyNewTypeProblemData } from '../../types';

interface MyNewTypeProblemProps {
  data: MyNewTypeProblemData;
}

export const MyNewTypeProblem: React.FC<MyNewTypeProblemProps> = ({ data }) => {
  const [isSubmitted, setIsSubmitted] = useState(false);

  return (
    <div className="w-full">
      {/* Your problem UI */}
      <h3 className="text-2xl font-bold text-white mb-8">
        {data.customField}
      </h3>

      {/* Submission logic */}
      {!isSubmitted ? (
        <button onClick={() => setIsSubmitted(true)}>
          Submit
        </button>
      ) : (
        <div className="bg-black/20 rounded-2xl p-6">
          <p>{data.rationale}</p>
          {data.teachingNote && <p>💡 {data.teachingNote}</p>}
        </div>
      )}
    </div>
  );
};
```

### Step 3: Register in Registry

```typescript
// config/problemTypeRegistry.tsx

import { MyNewTypeProblem } from '../primitives/problem-primitives/MyNewTypeProblem';

export const PROBLEM_TYPE_REGISTRY: Record<ProblemType, ProblemTypeConfig> = {
  // ... existing types

  my_new_type: {
    component: MyNewTypeProblem,
    complexity: 'medium',
    bestFor: 'Description of when to use this type',
    description: 'What this problem type does',
    exampleUseCase: 'Specific example scenario'
  }
};
```

### Step 4: Export from Index

```typescript
// primitives/problem-primitives/index.ts

export { MyNewTypeProblem } from './MyNewTypeProblem';
```

**That's it!** The problem type is now available for use.

## Backend Schema Alignment

This frontend architecture mirrors the backend's approach:

| Backend File | Frontend Equivalent | Purpose |
|-------------|---------------------|---------|
| `problem_type_schemas.py` | `types.ts` | Type definitions |
| `TYPE_SELECTION_SCHEMA` | `ProblemTypeSelectionResult` | Phase 1: Select types |
| `PROBLEM_TYPE_METADATA` | `PROBLEM_TYPE_REGISTRY` | Maps types to schemas/components |
| Individual schemas (e.g., `MULTIPLE_CHOICE_GENERATION_SCHEMA`) | Problem component props | Type-specific structure |
| Parallel generation with `asyncio.gather()` | Problem collection rendering | Efficient processing |

## Benefits

✅ **Scalable**: Add new problem types without modifying KnowledgeCheck
✅ **Type-Safe**: Full TypeScript support with discriminated unions
✅ **Performant**: Backend generates problems in parallel
✅ **Consistent**: All problems follow same structure and styling
✅ **Flexible**: Mix multiple problem types in single assessment
✅ **Backwards Compatible**: Existing code continues to work
✅ **Maintainable**: Configuration in registry, not scattered across files

## Migration Guide

### From Legacy Single Multiple Choice

**Before:**
```typescript
const data = {
  question: "What is X?",
  options: [...],
  correctAnswerId: "A",
  explanation: "..."
};
```

**After:**
```typescript
const data = {
  problems: [
    {
      type: 'multiple_choice',
      id: 'mc_1',
      difficulty: 'medium',
      gradeLevel: 'elementary',
      question: "What is X?",
      options: [...],
      correctOptionId: "A",
      rationale: "...",
      teachingNote: "",
      successCriteria: []
    }
  ]
};
```

**Or:** Keep using legacy format - it still works!

## Best Practices

1. **Use Type Selection**: Let the LLM decide problem types based on content
2. **Generate in Parallel**: Use backend's parallel generation for speed
3. **Mix Complexity**: Combine simple and complex types for engagement
4. **Provide Context**: Use `visual` field for additional information
5. **Clear Feedback**: Write helpful `rationale` and `teachingNote` fields
6. **Success Criteria**: Define clear learning objectives

## Example: Complete Knowledge Check

```typescript
{
  problems: [
    // Quick warm-up
    { type: 'true_false', ... },
    { type: 'true_false', ... },

    // Core concepts
    { type: 'multiple_choice', ... },
    { type: 'multiple_choice', ... },

    // Application
    { type: 'fill_in_blanks', ... },
    { type: 'matching_activity', ... },

    // Synthesis
    { type: 'short_answer', ... }
  ]
}
```

This creates a scaffolded assessment that builds from simple recall to complex application.
