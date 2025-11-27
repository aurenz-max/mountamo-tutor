# How to Add a New Visual Primitive

Visual primitives are interactive components that can be embedded within Knowledge Check questions to provide visual context for early learning topics (counting, letters, phonics, etc.).

## Overview

Visual primitives are:
- **Embedded within Knowledge Checks**: They appear inside quiz questions to provide visual context
- **Focused on early learning**: Designed for toddler through elementary grade levels
- **AI-generated content**: The Gemini service automatically generates data for these components

## Step-by-Step Guide

### 1. Create the Component File

Create a new file in `src/components/lumina/primitives/visual-primitives/`

**File naming convention**: `PascalCase.tsx` (e.g., `NumberBlocks.tsx`, `ShapeMatch.tsx`)

```tsx
// Example: NumberBlocks.tsx
'use client';

import React from 'react';
import { NumberBlocksData } from '../../types';

interface NumberBlocksProps {
  data: NumberBlocksData;
}

export const NumberBlocks: React.FC<NumberBlocksProps> = ({ data }) => {
  const { value, showLabels, colorScheme } = data;

  // Handle missing or invalid data
  if (!value || value < 0) {
    return (
      <div className="w-full my-6 animate-fade-in-up">
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <div className="text-center text-slate-400">
            <p>Number blocks data is incomplete</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full my-6 animate-fade-in-up">
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {/* Your component UI here */}
        <div className="text-center">
          <p className="text-lg text-white">
            Showing {value} blocks
          </p>
        </div>
      </div>
    </div>
  );
};
```

**Component Requirements**:
- Use `'use client'` directive at the top
- Accept a `data` prop with your custom data type
- Handle invalid/missing data gracefully
- Use consistent styling with `glass-panel`, `rounded-2xl`, and Tailwind classes
- Include `animate-fade-in-up` for smooth entry animations

---

### 2. Define TypeScript Types

Add type definitions to `src/components/lumina/types.ts`

```typescript
// Add your data interface
export interface NumberBlocksData {
  value: number;
  showLabels?: boolean;
  colorScheme?: 'blue' | 'green' | 'rainbow';
}

// Add to the VisualPrimitiveType union
export type VisualPrimitiveType =
  | 'object-collection'
  | 'comparison-panel'
  | 'letter-picture'
  | 'alphabet-sequence'
  | 'rhyming-pairs'
  | 'sight-word-card'
  | 'sound-sort'
  | 'number-blocks'; // <-- Add your new type here

// Update the VisualPrimitive interface data union
export interface VisualPrimitive {
  type: VisualPrimitiveType;
  data: VisualObjectCollection
    | VisualComparisonData
    | LetterTracingData
    | LetterPictureData
    | AlphabetSequenceData
    | RhymingPairsData
    | SightWordCardData
    | SoundSortData
    | NumberBlocksData; // <-- Add your new data type here
}
```

---

### 3. Export from Index File

Add your component to `src/components/lumina/primitives/visual-primitives/index.tsx`

```typescript
export { ObjectCollection, type ObjectCollectionData, type ObjectItem } from './ObjectCollection';
export { ComparisonPanel, type ComparisonPanelData, type ComparisonPanelItem } from './ComparisonPanel';
export { LetterPicture } from './LetterPicture';
export { AlphabetSequence } from './AlphabetSequence';
export { RhymingPairs } from './RhymingPairs';
export { SightWordCard } from './SightWordCard';
export { SoundSort } from './SoundSort';
export { NumberBlocks } from './NumberBlocks'; // <-- Add your export here
```

---

### 4. Add to KnowledgeCheck Component

Update `src/components/lumina/primitives/KnowledgeCheck.tsx` to render your component

```tsx
// Add import
import {
  ObjectCollection,
  ComparisonPanel,
  LetterPicture,
  AlphabetSequence,
  RhymingPairs,
  SightWordCard,
  SoundSort,
  NumberBlocks // <-- Add your import here
} from './visual-primitives';

// Import type
import {
  // ... other types
  NumberBlocksData // <-- Add your type import
} from '../types';

// Inside the component render, add your case
{data.visual && (
  <div className="mb-8">
    {/* ... existing cases ... */}
    {data.visual.type === 'number-blocks' && (
      <NumberBlocks data={data.visual.data as NumberBlocksData} />
    )}
  </div>
)}
```

---

### 5. Add to Gemini Service Schema

Update `src/components/lumina/service/geminiService.ts` to enable AI generation

#### 5a. Add to visualType enum

```typescript
visualType: {
  type: Type.STRING,
  enum: [
    "none",
    "object-collection",
    "comparison-panel",
    "letter-picture",
    "alphabet-sequence",
    "rhyming-pairs",
    "sight-word-card",
    "sound-sort",
    "number-blocks" // <-- Add here
  ],
  description: "Type of visual primitive (or 'none' if no visual needed)"
},
```

#### 5b. Add schema properties to visualData

```typescript
visualData: {
  type: Type.OBJECT,
  description: "Visual primitive data - structure depends on visualType",
  properties: {
    // ... existing properties ...

    // For number-blocks
    value: { type: Type.NUMBER, description: "Number value to represent" },
    showLabels: { type: Type.BOOLEAN, description: "Show number labels" },
    colorScheme: {
      type: Type.STRING,
      enum: ["blue", "green", "rainbow"],
      description: "Color scheme for blocks"
    },
  }
}
```

#### 5c. Add schema definition (if complex)

```typescript
// Add near other schema definitions (around line 1415)
const numberBlocksSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.NUMBER, description: "Number value" },
    showLabels: { type: Type.BOOLEAN, description: "Show labels" },
    colorScheme: {
      type: Type.STRING,
      enum: ["blue", "green", "rainbow"]
    }
  },
  required: ["value"]
};
```

#### 5d. Add documentation to the prompt

Add your visual primitive to the prompt documentation (around line 1552):

```typescript
const response = await ai.models.generateContent({
  model: "gemini-flash-lite-latest",
  contents: `Create knowledge check quiz for: "${topic}"

// ... existing documentation ...

9. "number-blocks" - Use for number representation, place value, base-10 understanding
   When visualType is "number-blocks", populate visualData with:
   {
     value: 15,
     showLabels?: true,
     colorScheme?: "rainbow"
   }
   GUIDANCE: Use for numbers 1-100. Choose colorScheme based on learning objective.

10. "none" - No visual needed (for abstract concepts or text-only questions)

CRITICAL RULES:
// ... existing rules ...
- For number-blocks: Keep values appropriate for grade level (1-20 for K-1, up to 100 for grade 2-3)
```

---

### 6. Add to Visual Primitives Tester (Optional)

Add an example to `src/components/lumina/App.tsx` for testing:

```tsx
const visualPrimitiveExamples = [
  // ... existing examples ...
  {
    name: 'Number Blocks',
    component: (
      <NumberBlocks
        data={{
          value: 15,
          showLabels: true,
          colorScheme: 'rainbow'
        }}
      />
    )
  }
];
```

---

### 7. Test Your Visual Primitive

1. **Manual Testing**: Go to the visual primitives tester in your app
2. **AI Generation Testing**: Generate a kindergarten or elementary math topic and check if Knowledge Checks use your new primitive
3. **Edge Cases**: Test with missing/invalid data

---

## Design Guidelines

### Visual Design
- Use the `glass-panel` class for consistent card styling
- Use Tailwind utilities for spacing and colors
- Follow the color scheme: blues for primary, greens for success, purples for highlights
- Include smooth animations with `animate-fade-in-up`

### Content Guidelines
- **Target Audience**: Design for ages 3-10 (preschool through elementary)
- **Simplicity**: Use simple, clear visuals with minimal text
- **Engagement**: Include interactive or dynamic elements when appropriate
- **Accessibility**: Use high-contrast colors and readable font sizes

### Data Structure
- Keep data structures simple and flat when possible
- Use optional properties for enhanced features
- Always validate required fields
- Provide sensible defaults

---

## Example: Complete Visual Primitive

Here's a complete example for reference:

```tsx
// PatternBlocks.tsx
'use client';

import React from 'react';
import { PatternBlocksData } from '../../types';

interface PatternBlocksProps {
  data: PatternBlocksData;
}

export const PatternBlocks: React.FC<PatternBlocksProps> = ({ data }) => {
  const { pattern, missingIndex, showHint } = data;

  if (!pattern || pattern.length === 0) {
    return (
      <div className="w-full my-6 animate-fade-in-up">
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <div className="text-center text-slate-400">
            <p>Pattern data is incomplete</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full my-6 animate-fade-in-up">
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-block px-4 py-2 bg-purple-500/20 rounded-full border border-purple-400/30 mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-purple-300">
              Pattern Recognition
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            What comes next in the pattern?
          </p>
        </div>

        {/* Pattern Display */}
        <div className="flex justify-center items-center gap-4 flex-wrap p-8 bg-slate-900/50 rounded-xl border border-white/5">
          {pattern.map((item, idx) => (
            <div
              key={idx}
              className={`w-16 h-16 flex items-center justify-center text-4xl rounded-lg ${
                idx === missingIndex
                  ? 'bg-slate-700 border-2 border-dashed border-yellow-400'
                  : 'bg-slate-800 border border-white/10'
              }`}
            >
              {idx === missingIndex ? '?' : item}
            </div>
          ))}
        </div>

        {/* Hint */}
        {showHint && (
          <div className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-400/20">
            <div className="flex items-start gap-3">
              <div className="text-blue-400 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-300 font-medium mb-1">Hint</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Look at the pattern carefully. What repeats?
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## Checklist

Before submitting your visual primitive, ensure:

- [ ] Component file created in `visual-primitives/` directory
- [ ] TypeScript types defined in `types.ts`
- [ ] Component exported from `index.tsx`
- [ ] Added to `KnowledgeCheck.tsx` rendering logic
- [ ] Schema added to `geminiService.ts` (enum, properties, documentation)
- [ ] Example added to visual primitives tester (optional)
- [ ] Component handles missing/invalid data gracefully
- [ ] Styling follows design guidelines
- [ ] Component tested manually and with AI generation

---

## Common Pitfalls

1. **Forgetting to add to VisualPrimitiveType union**: This will cause TypeScript errors
2. **Not handling invalid data**: Always validate and show error states
3. **Inconsistent styling**: Use the standard `glass-panel` wrapper
4. **Missing from Gemini prompt**: AI won't know when to use your primitive
5. **Complex data structures**: Keep it simple for AI generation

---

## Need Help?

- Review existing visual primitives in `primitives/visual-primitives/`
- Check the TypeScript types in `types.ts` for reference
- Test with the visual primitives gallery before integrating with AI generation
