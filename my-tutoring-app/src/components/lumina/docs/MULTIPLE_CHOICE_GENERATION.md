# Knowledge Check Problem Generation - Quick Start

This guide shows you how to use the frontend-only LLM generation system for creating multiple choice and true/false problems in KnowledgeCheck components.

## Overview

The problem generation functions in `geminiService.ts` create high-quality assessment questions that automatically render in the `KnowledgeCheck` component using the problem registry architecture.

### Available Generators

- **`generateMultipleChoiceProblems`** - Creates multiple choice questions with 4 options
- **`generateTrueFalseProblems`** - Creates true/false statements

## Basic Usage

### 1. Import the Generators

```typescript
import {
  generateMultipleChoiceProblems,
  generateTrueFalseProblems
} from './service/geminiService';
```

### 2. Generate Problems

```typescript
// Generate 3 multiple choice problems
const mcProblems = await generateMultipleChoiceProblems(
  'Photosynthesis',           // topic
  'elementary',               // grade level
  3,                          // number of problems
  'Plant biology unit'        // optional context
);

// Generate 4 true/false problems
const tfProblems = await generateTrueFalseProblems(
  'Cell structure',
  'middle-school',
  4,
  'Biology unit on cells'
);

// Mix problem types
const allProblems = [...mcProblems, ...tfProblems];
```

### 3. Render in KnowledgeCheck

```tsx
import { KnowledgeCheck } from './primitives/KnowledgeCheck';

<KnowledgeCheck data={{ problems: allProblems }} />
```

## Complete Example Component

```tsx
'use client';

import React, { useState } from 'react';
import {
  generateMultipleChoiceProblems,
  generateTrueFalseProblems
} from '../service/geminiService';
import { KnowledgeCheck } from './KnowledgeCheck';
import { ProblemData } from '../types';

export const GenerativeKnowledgeCheckDemo = () => {
  const [problems, setProblems] = useState<ProblemData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [topic, setTopic] = useState('Photosynthesis');
  const [gradeLevel, setGradeLevel] = useState('elementary');
  const [problemType, setProblemType] = useState<'multiple_choice' | 'true_false' | 'mixed'>('mixed');

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let generatedProblems: ProblemData[] = [];

      if (problemType === 'multiple_choice') {
        generatedProblems = await generateMultipleChoiceProblems(topic, gradeLevel, 3);
      } else if (problemType === 'true_false') {
        generatedProblems = await generateTrueFalseProblems(topic, gradeLevel, 4);
      } else {
        // Mixed: Generate both types
        const mcProblems = await generateMultipleChoiceProblems(topic, gradeLevel, 2);
        const tfProblems = await generateTrueFalseProblems(topic, gradeLevel, 3);
        generatedProblems = [...tfProblems.slice(0, 2), ...mcProblems, ...tfProblems.slice(2)];
      }

      setProblems(generatedProblems);
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-8">
      {/* Generation Controls */}
      <div className="mb-8 p-6 bg-slate-800 rounded-xl">
        <h2 className="text-2xl font-bold text-white mb-4">
          Generate Knowledge Check
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg"
              placeholder="Enter topic..."
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Grade Level</label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg"
            >
              <option value="toddler">Toddler</option>
              <option value="preschool">Preschool</option>
              <option value="kindergarten">Kindergarten</option>
              <option value="elementary">Elementary</option>
              <option value="middle-school">Middle School</option>
              <option value="high-school">High School</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-slate-300 mb-2">Problem Type</label>
          <select
            value={problemType}
            onChange={(e) => setProblemType(e.target.value as any)}
            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg"
          >
            <option value="mixed">Mixed (MC + T/F)</option>
            <option value="multiple_choice">Multiple Choice Only</option>
            <option value="true_false">True/False Only</option>
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate Problems'}
        </button>
      </div>

      {/* Render Problems */}
      {problems.length > 0 && (
        <KnowledgeCheck data={{ problems }} />
      )}
    </div>
  );
};
```

## Function Signatures

### Multiple Choice

```typescript
generateMultipleChoiceProblems(
  topic: string,        // Topic to generate questions about
  gradeLevel: string,   // Grade level: 'toddler', 'preschool', 'kindergarten',
                        //              'elementary', 'middle-school', 'high-school',
                        //              'undergraduate', 'graduate', 'phd'
  count?: number,       // Number of problems (default: 1)
  context?: string      // Optional additional context (e.g., "Unit on fractions")
): Promise<MultipleChoiceProblemData[]>
```

### True/False

```typescript
generateTrueFalseProblems(
  topic: string,        // Topic to generate questions about
  gradeLevel: string,   // Grade level (same options as above)
  count?: number,       // Number of problems (default: 1)
  context?: string      // Optional additional context
): Promise<TrueFalseProblemData[]>
```

## Generated Problem Structures

### Multiple Choice Problem

```typescript
{
  type: 'multiple_choice',
  id: 'mc_1',                    // Unique ID
  difficulty: 'medium',          // easy, medium, or hard
  gradeLevel: 'elementary',      // Matches input
  question: 'What is...?',       // The question text
  options: [                     // 4 answer choices
    { id: 'A', text: 'Option A' },
    { id: 'B', text: 'Option B' },
    { id: 'C', text: 'Option C' },
    { id: 'D', text: 'Option D' }
  ],
  correctOptionId: 'B',          // Correct answer
  rationale: 'Because...',       // Educational explanation
  teachingNote: 'Tip...',        // Teaching guidance
  successCriteria: [             // Learning objectives
    'Identify key concepts',
    'Apply understanding'
  ]
}
```

### True/False Problem

```typescript
{
  type: 'true_false',
  id: 'tf_1',                    // Unique ID
  difficulty: 'easy',            // easy, medium, or hard
  gradeLevel: 'elementary',      // Matches input
  statement: 'All birds can fly.', // The true/false statement
  correct: false,                // Whether it's true or false
  rationale: 'This is false because...', // Educational explanation
  teachingNote: 'Use penguins as an example...', // Teaching guidance
  successCriteria: [             // Learning objectives
    'Identify characteristics of birds',
    'Recognize exceptions to general rules'
  ]
}
```

## Quality Features

Both generators automatically:

✅ **Adapts to Grade Level** - Uses age-appropriate vocabulary and complexity
✅ **Varies Difficulty** - Progressively increases challenge when generating multiple problems
✅ **Provides Rich Feedback** - Includes educational rationales, not just answers
✅ **Includes Teaching Notes** - Pedagogical guidance for educators
✅ **Defines Success Criteria** - Clear learning objectives for each problem
✅ **Targets Misconceptions** - Addresses common student errors

### Multiple Choice Specific:
✅ **Randomizes Answers** - Mixes correct answer positions (A, B, C, D)
✅ **Creates Plausible Distractors** - Wrong answers are believable but clearly incorrect

### True/False Specific:
✅ **Balances True and False** - Natural mix of true and false statements
✅ **Avoids Trick Questions** - Focuses on genuine understanding, not wordplay
✅ **Explains Both Sides** - False statements explain what's wrong AND what's correct

## Integration with Existing Components

The generated problems work seamlessly with:

- **KnowledgeCheck.tsx** - Main container component (handles both legacy and registry format)
- **MultipleChoiceProblem.tsx** - Renders multiple choice questions
- **TrueFalseProblem.tsx** - Renders true/false statements
- **Visual Primitives** - Can be extended to include visuals in future

## Example Generations

### Elementary Math - Mixed
```typescript
const mcProblems = await generateMultipleChoiceProblems(
  'Adding fractions with like denominators',
  'elementary',
  2
);

const tfProblems = await generateTrueFalseProblems(
  'Fraction basics',
  'elementary',
  3
);

const allProblems = [...tfProblems, ...mcProblems];
```

### Middle School Science - True/False Only
```typescript
const problems = await generateTrueFalseProblems(
  'Cell structure and function',
  'middle-school',
  5,
  'Biology unit on cells and organelles'
);
```

### High School Literature - Multiple Choice
```typescript
const problems = await generateMultipleChoiceProblems(
  'Symbolism in To Kill a Mockingbird',
  'high-school',
  3,
  'American Literature unit'
);
```

### Quick Fact Check - True/False
```typescript
// Great for quick concept verification
const quickCheck = await generateTrueFalseProblems(
  'Water cycle',
  'elementary',
  4
);
```

## Error Handling

```typescript
try {
  const problems = await generateMultipleChoiceProblems(topic, gradeLevel, 3);
  setProblems(problems);
} catch (error) {
  console.error('Generation failed:', error);
  // Show error message to user
}
```

## Next Steps

This system is ready for rapid frontend development. When you're ready to connect to the backend:

1. The generated format matches the `MultipleChoiceProblemData` interface
2. Backend can use the same structure from `KNOWLEDGE_CHECK_SYSTEM.md`
3. Simply swap the `generateMultipleChoiceProblems` call with a backend API endpoint

## Advanced: Mixing Problem Types

The problem registry architecture supports multiple problem types. Mix them for comprehensive assessments:

```typescript
// Scaffolded assessment: easy → hard
const warmup = await generateTrueFalseProblems('Topic', 'elementary', 2);
const core = await generateMultipleChoiceProblems('Topic', 'elementary', 2);
const challenge = await generateTrueFalseProblems('Topic', 'elementary', 1);

const problems = [...warmup, ...core, ...challenge];

<KnowledgeCheck data={{ problems }} />
```

### Future Problem Types

Coming soon:
- `generateFillInBlankProblems` - Fill in the blank questions
- `generateMatchingProblems` - Matching activities
- `generateSequencingProblems` - Ordering tasks
- And more from the [KNOWLEDGE_CHECK_SYSTEM.md](./KNOWLEDGE_CHECK_SYSTEM.md)

## API Key Setup

Ensure `NEXT_PUBLIC_GEMINI_API_KEY` is set in your `.env.local` file:

```bash
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
```
