# Visual Primitives System

## Overview

The Visual Primitives system provides reusable, AI-generated visual components for educational content in the Lumina product. These primitives are designed to enhance learning through visual representation, particularly for early learners (K-1) and visual/concrete learning scenarios.

## Architecture

### Component Structure

```
my-tutoring-app/src/components/lumina/
├── primitives/
│   ├── visual-primitives/
│   │   ├── ObjectCollection.tsx      # Display groups of objects
│   │   ├── ComparisonPanel.tsx       # Side-by-side comparison
│   │   └── index.tsx                 # Export barrel
│   ├── KnowledgeCheck.tsx            # Integrates visual primitives
│   └── ...
├── service/
│   └── geminiService.ts              # AI generation logic
├── types.ts                          # TypeScript definitions
└── docs/
    └── visual-primitives.md          # This file
```

### Data Flow

```
1. AI Generation (geminiService.ts)
   ↓
2. Schema Definition (Gemini API)
   ↓
3. Data Transformation (flat → nested structure)
   ↓
4. Component Rendering (React components)
   ↓
5. User Interaction (KnowledgeCheck.tsx)
```

## Current Visual Primitives

### 1. Object Collection (`object-collection`)

**Purpose**: Display groups of countable objects for identification, counting, and simple grouping tasks.

**Best For**:
- Counting discrete objects
- Showing groups of items
- Simple identification tasks
- "How many" questions

**Avoid For**:
- Abstract numerical data
- Complex data relationships
- Multi-step comparisons

**TypeScript Interface**:
```typescript
export interface VisualObjectItem {
  name: string;           // Object type name (e.g., 'apple', 'ball')
  count: number;          // Number of objects to display
  icon?: string;          // Emoji or icon (e.g., '🍎', '⚽️')
  attributes?: string[];  // Visual attributes (e.g., ['red', 'shiny'])
}

export interface VisualObjectCollection {
  instruction?: string;   // Optional scene description
  items: VisualObjectItem[];
  layout?: 'grid' | 'scattered' | 'row';
}
```

**Example Data**:
```json
{
  "type": "object-collection",
  "data": {
    "instruction": "Look at the happy red balls playing!",
    "items": [
      {
        "name": "ball",
        "count": 4,
        "icon": "🔴",
        "attributes": ["red"]
      }
    ],
    "layout": "grid"
  }
}
```

**Component Location**: `primitives/visual-primitives/ObjectCollection.tsx`

---

### 2. Comparison Panel (`comparison-panel`)

**Purpose**: Side-by-side comparison of two object collections.

**Best For**:
- "Who has more/less" questions
- Direct visual comparison of countable items
- Comparing two groups or entities

**Avoid For**:
- Abstract totals without visual objects
- Single group displays
- More than 2 groups

**TypeScript Interface**:
```typescript
export interface VisualComparisonPanel {
  label: string;                    // Panel label (e.g., "Maya's Apples")
  collection: VisualObjectCollection;
}

export interface VisualComparisonData {
  panels: [VisualComparisonPanel, VisualComparisonPanel]; // Exactly 2 panels
}
```

**Example Data**:
```json
{
  "type": "comparison-panel",
  "data": {
    "panels": [
      {
        "label": "Maya's Collection",
        "collection": {
          "items": [{"name": "cookie", "count": 3, "icon": "🍪"}]
        }
      },
      {
        "label": "Tom's Collection",
        "collection": {
          "items": [{"name": "cookie", "count": 5, "icon": "🍪"}]
        }
      }
    ]
  }
}
```

**Component Location**: `primitives/visual-primitives/ComparisonPanel.tsx`

---

## Integration Points

### 1. Type Definitions (`types.ts`)

All visual primitives must be defined in the central types file:

```typescript
// Add to types.ts
export type VisualPrimitiveType =
  | 'object-collection'
  | 'comparison-panel'
  | 'your-new-primitive';  // Add new types here

export interface VisualPrimitive {
  type: VisualPrimitiveType;
  data: VisualObjectCollection | VisualComparisonData | YourNewType;
}
```

### 2. AI Schema (`geminiService.ts`)

Define the Gemini API schema for AI generation:

```typescript
const generateKnowledgeCheckContent = async (...) => {
  // 1. Define item schemas (reusable sub-schemas)
  const yourItemSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      // Your properties here
    },
    required: ["field1", "field2"]
  };

  // 2. Add to main schema
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      // ...existing fields
      visualType: {
        type: Type.STRING,
        enum: ["none", "object-collection", "comparison-panel", "your-new-type"],
        description: "Type of visual primitive"
      },
      visualData: {
        type: Type.OBJECT,
        description: "Visual primitive data",
        properties: {
          // Add your new primitive's properties here
          yourNewField: { type: Type.STRING },
          // ...
        }
      }
    }
  };

  // 3. Update prompt
  const response = await ai.models.generateContent({
    contents: `
      ...existing prompt...

      3. "your-new-type" - Description of when to use
         Structure: { field1: "...", field2: [...] }
         Example: Specific use case
    `,
    // ...
  });

  // 4. Transform data (if needed)
  const transformedData = {
    // ...existing transformation
  };

  return { type: 'knowledge-check', instanceId: item.instanceId, data: transformedData };
};
```

### 3. Component Integration (`KnowledgeCheck.tsx`)

Add rendering logic for your new primitive:

```typescript
{data.visual && (
  <div className="mb-8">
    {data.visual.type === 'object-collection' && (
      <ObjectCollection data={data.visual.data as VisualObjectCollection} />
    )}
    {data.visual.type === 'comparison-panel' && (
      <ComparisonPanel data={data.visual.data as VisualComparisonData} />
    )}
    {data.visual.type === 'your-new-primitive' && (
      <YourNewPrimitive data={data.visual.data as YourNewType} />
    )}
  </div>
)}
```

---

## Adding a New Visual Primitive

### Step-by-Step Guide

#### 1. Define TypeScript Types

Add to `types.ts`:

```typescript
// Define your data structure
export interface YourNewPrimitiveData {
  title: string;
  items: YourItem[];
  // ...other properties
}

// Add to the union type
export type VisualPrimitiveType =
  | 'object-collection'
  | 'comparison-panel'
  | 'your-new-primitive';

// Update VisualPrimitive interface
export interface VisualPrimitive {
  type: VisualPrimitiveType;
  data: VisualObjectCollection | VisualComparisonData | YourNewPrimitiveData;
}
```

#### 2. Create React Component

Create `primitives/visual-primitives/YourNewPrimitive.tsx`:

```typescript
'use client';

import React from 'react';

export interface YourNewPrimitiveData {
  // Match the type definition
  title: string;
  items: YourItem[];
}

interface YourNewPrimitiveProps {
  data: YourNewPrimitiveData;
}

export const YourNewPrimitive: React.FC<YourNewPrimitiveProps> = ({ data }) => {
  return (
    <div className="w-full my-6 animate-fade-in-up">
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {/* Your component UI here */}
        <h3>{data.title}</h3>
        {/* Render items, etc. */}
      </div>
    </div>
  );
};
```

**Design Guidelines**:
- Use `glass-panel` class for consistent styling
- Include `animate-fade-in-up` for entry animation
- Use the color palette: purple/blue gradients, slate for text
- Include hover effects and transitions
- Ensure responsive design (mobile-first)
- NO answer keys or summaries (students must solve)

#### 3. Update Export Barrel

Add to `primitives/visual-primitives/index.tsx`:

```typescript
export { YourNewPrimitive, type YourNewPrimitiveData } from './YourNewPrimitive';
```

#### 4. Update Gemini Schema

In `geminiService.ts`, update `generateKnowledgeCheckContent`:

```typescript
// Add your schema definitions
const yourItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    field1: { type: Type.STRING },
    field2: { type: Type.INTEGER },
  },
  required: ["field1"]
};

// Update visualType enum
visualType: {
  type: Type.STRING,
  enum: ["none", "object-collection", "comparison-panel", "your-new-primitive"],
  description: "Type of visual primitive"
}

// Add fields to visualData.properties
visualData: {
  type: Type.OBJECT,
  properties: {
    // ...existing properties
    yourNewField: { type: Type.ARRAY, items: yourItemSchema },
    // ...
  }
}
```

#### 5. Update AI Prompt

Add guidance in the prompt string:

```typescript
contents: `
  ...existing content...

  3. "your-new-primitive" - Use for [specific use case]
     When visualType is "your-new-primitive", populate visualData with:
     {
       yourNewField: [{field1: "...", field2: 123}],
       // ...
     }
     Example: Specific example use case

  CRITICAL RULES:
  - Your specific rules here
  - ...
`
```

#### 6. Integrate into KnowledgeCheck

Update `primitives/KnowledgeCheck.tsx`:

```typescript
import { YourNewPrimitive } from './visual-primitives/YourNewPrimitive';
import { YourNewPrimitiveData } from '../types';

// In the render:
{data.visual && (
  <div className="mb-8">
    {/* ...existing primitives... */}
    {data.visual.type === 'your-new-primitive' && (
      <YourNewPrimitive data={data.visual.data as YourNewPrimitiveData} />
    )}
  </div>
)}
```

#### 7. Test the Integration

1. Generate content with your new primitive type
2. Verify the AI generates appropriate visualData
3. Check the component renders correctly
4. Test responsive behavior (mobile/tablet/desktop)
5. Ensure animations work smoothly

---

## Design System

### Color Palette

```css
/* Primary Colors */
--blue-400: #60a5fa
--blue-500: #3b82f6
--blue-600: #2563eb
--purple-400: #c084fc
--purple-500: #a855f7

/* Neutrals */
--slate-200: #e2e8f0
--slate-300: #cbd5e1
--slate-400: #94a3b8
--slate-900: #0f172a

/* Semantic Colors */
--emerald-400: #34d399 (success)
--emerald-500: #10b981 (success)
--red-500: #ef4444 (error)
```

### Common Classes

```css
/* Containers */
.glass-panel: backdrop-blur, semi-transparent background
.rounded-2xl: 16px border radius
.rounded-3xl: 24px border radius

/* Animations */
.animate-fade-in: fade in effect
.animate-fade-in-up: fade in + slide up
.animate-pulse: pulsing effect

/* Borders */
.border-white/10: 10% white opacity border
.border-white/5: 5% white opacity border

/* Shadows */
.drop-shadow-lg: large drop shadow
.shadow-lg: large box shadow
```

### Component Patterns

1. **Container Structure**:
   ```tsx
   <div className="w-full my-6 animate-fade-in-up">
     <div className="glass-panel rounded-2xl p-6 border border-white/10">
       {/* Content */}
     </div>
   </div>
   ```

2. **Headers**:
   ```tsx
   <div className="bg-slate-900/80 p-4 border-b border-white/5">
     <div className="flex items-center gap-2">
       <span className="text-xs font-mono uppercase tracking-widest text-purple-400">
         Your Header
       </span>
     </div>
   </div>
   ```

3. **Interactive Elements**:
   ```tsx
   <div className="transform transition-transform hover:scale-110">
     {/* Your element */}
   </div>
   ```

---

## Best Practices

### 1. Schema Design

- **Use concrete schemas**: Gemini API requires OBJECT types to have non-empty `properties`
- **Reuse sub-schemas**: Define common patterns (like `objectItemSchema`) once
- **Required fields**: Mark essential fields as `required`
- **Enums for constraints**: Use `enum` for limited value sets
- **Descriptions**: Add clear descriptions for AI guidance

### 2. Data Transformation

- **Flat to nested**: Transform flat API response to nested component structure
- **Validation**: Check for required fields before rendering
- **Type safety**: Use TypeScript interfaces consistently
- **Optional fields**: Handle missing optional data gracefully

### 3. Component Design

- **No answer keys**: Never display counts, summaries, or solutions
- **Accessibility**: Use semantic HTML and ARIA labels
- **Performance**: Use React.memo for expensive renders
- **Responsive**: Mobile-first design with Tailwind breakpoints
- **Animations**: Stagger animations with delays for visual appeal

### 4. AI Prompting

- **Clear examples**: Provide concrete JSON examples
- **Use cases**: Explain when to use each primitive
- **Critical rules**: Highlight important constraints
- **Grade-appropriate**: Tailor content to target audience

---

## Troubleshooting

### Common Issues

1. **API Error: "properties should be non-empty for OBJECT type"**
   - **Cause**: Empty `properties` in OBJECT schema
   - **Solution**: Add at least one property or use a different type

2. **Visual not rendering**
   - **Check**: `data.visual` exists and has correct `type`
   - **Check**: Type matches component conditional
   - **Check**: Data structure matches interface

3. **Type mismatch errors**
   - **Solution**: Update both `types.ts` AND `geminiService.ts`
   - **Solution**: Use type assertions `as YourType` carefully

4. **AI generates wrong structure**
   - **Solution**: Improve prompt with clearer examples
   - **Solution**: Add validation in schema with enums/patterns
   - **Solution**: Use data transformation to fix structure

---

## ABCs/Early Literacy Visual Primitives

### 3. Letter Tracing (`letter-tracing`)

**Purpose**: Interactive letter formation practice with stroke order guidance.

**Best For**:
- Letter formation practice
- Handwriting instruction
- Stroke order teaching
- Fine motor skill development

**Avoid For**:
- Letter recognition without writing
- Phonics without letter formation focus

**TypeScript Interface**:
```typescript
export interface StrokeOrder {
  path: string;           // SVG path data
  number: number;         // Stroke order number
}

export interface LetterTracingData {
  letter: string;                    // Letter to trace
  case: 'uppercase' | 'lowercase';   // Letter case
  showDirectionArrows?: boolean;     // Show stroke direction
  showDottedGuide?: boolean;         // Show dotted tracing guide
  strokeOrder?: StrokeOrder[];       // Stroke order information
}
```

**Example Data**:
```json
{
  "type": "letter-tracing",
  "data": {
    "letter": "A",
    "case": "uppercase",
    "showDirectionArrows": true,
    "showDottedGuide": true,
    "strokeOrder": [
      {"path": "M10,50 L25,10", "number": 1},
      {"path": "M25,10 L40,50", "number": 2},
      {"path": "M15,35 L35,35", "number": 3}
    ]
  }
}
```

**Component Location**: `primitives/visual-primitives/LetterTracing.tsx`

---

### 4. Letter Picture (`letter-picture`)

**Purpose**: Letter-sound correspondence through visual items.

**Best For**:
- Letter-sound correspondence
- Initial sound identification
- Phonics instruction
- Vocabulary building

**Avoid For**:
- Letter formation practice
- Problems not involving initial sounds

**TypeScript Interface**:
```typescript
export interface LetterPictureItem {
  name: string;           // Item name
  image: string;          // Emoji or image
  highlight: boolean;     // True if starts with focus letter
}

export interface LetterPictureData {
  letter: string;         // Focus letter
  items: LetterPictureItem[];
}
```

**Example Data**:
```json
{
  "type": "letter-picture",
  "data": {
    "letter": "A",
    "items": [
      {"name": "Apple", "image": "🍎", "highlight": true},
      {"name": "Ant", "image": "🐜", "highlight": true},
      {"name": "Ball", "image": "⚽", "highlight": false},
      {"name": "Alligator", "image": "🐊", "highlight": true}
    ]
  }
}
```

**Component Location**: `primitives/visual-primitives/LetterPicture.tsx`

---

### 5. Alphabet Sequence (`alphabet-sequence`)

**Purpose**: Alphabetical order and missing letter identification.

**Best For**:
- Alphabetical order practice
- Missing letter identification
- Sequence completion
- Letter recognition in context

**Avoid For**:
- Single letter recognition
- Phonics without order context

**TypeScript Interface**:
```typescript
export interface AlphabetSequenceData {
  sequence: string[];         // Sequence with blanks as '_'
  missing: string[];          // Letters that are missing
  highlightMissing?: boolean; // Highlight missing positions
  showImages?: boolean;       // Show images for letters
}
```

**Example Data**:
```json
{
  "type": "alphabet-sequence",
  "data": {
    "sequence": ["A", "B", "_", "D", "E"],
    "missing": ["C"],
    "highlightMissing": true,
    "showImages": false
  }
}
```

**Component Location**: `primitives/visual-primitives/AlphabetSequence.tsx`

---

### 6. Rhyming Pairs (`rhyming-pairs`)

**Purpose**: Rhyme identification and phonological awareness.

**Best For**:
- Rhyme identification
- Phonological awareness
- Word families
- Sound pattern recognition

**Avoid For**:
- Non-rhyming word problems
- Letter recognition tasks

**TypeScript Interface**:
```typescript
export interface RhymingPair {
  word1: string;
  image1?: string;
  word2: string;
  image2?: string;
}

export interface RhymingPairsData {
  pairs: RhymingPair[];
  showConnectingLines?: boolean;
}
```

**Example Data**:
```json
{
  "type": "rhyming-pairs",
  "data": {
    "pairs": [
      {"word1": "cat", "image1": "🐱", "word2": "hat", "image2": "🎩"},
      {"word1": "dog", "image1": "🐶", "word2": "log", "image2": "🪵"}
    ],
    "showConnectingLines": true
  }
}
```

**Component Location**: `primitives/visual-primitives/RhymingPairs.tsx`

---

### 7. Sight Word Card (`sight-word-card`)

**Purpose**: High-frequency word recognition and sight word practice.

**Best For**:
- High-frequency word recognition
- Sight word practice in context
- Instant word recognition
- Reading fluency

**Avoid For**:
- Decodable words
- Complex sentences beyond sight word focus

**TypeScript Interface**:
```typescript
export interface SightWordCardData {
  word: string;
  fontSize?: 'small' | 'medium' | 'large';
  showInContext?: boolean;
  sentence?: string;
  highlightWord?: boolean;
}
```

**Example Data**:
```json
{
  "type": "sight-word-card",
  "data": {
    "word": "the",
    "fontSize": "large",
    "showInContext": true,
    "sentence": "The cat runs fast.",
    "highlightWord": true
  }
}
```

**Component Location**: `primitives/visual-primitives/SightWordCard.tsx`

---

### 8. Sound Sort (`sound-sort`)

**Purpose**: Phoneme categorization and sound discrimination.

**Best For**:
- Phoneme categorization
- Sound discrimination
- Vowel sound practice
- Word sorting by sound patterns

**Avoid For**:
- Letter recognition without sound focus
- Non-phonetic word problems

**TypeScript Interface**:
```typescript
export interface SoundSortCategory {
  label: string;
  words: string[];
}

export interface SoundSortData {
  targetSound: string;
  categories: SoundSortCategory[];
  showPictures?: boolean;
}
```

**Example Data**:
```json
{
  "type": "sound-sort",
  "data": {
    "targetSound": "short a",
    "categories": [
      {"label": "Has short 'a'", "words": ["cat", "hat", "mat"]},
      {"label": "No short 'a'", "words": ["dog", "sun", "tree"]}
    ],
    "showPictures": true
  }
}
```

**Component Location**: `primitives/visual-primitives/SoundSort.tsx`

---

## Future Primitives (Roadmap)

Based on `backend/app/generators/content_schemas.py`, consider adding:

### Math Visuals
- `bar-model`: Abstract quantity comparison
- `number-line`: Number sequences and ordering
- `base-ten-blocks`: Place value visualization
- `fraction-circles`: Part-whole fractions
- `geometric-shape`: Shape identification

### Science Visuals
- `labeled-diagram`: Parts of complex objects
- `cycle-diagram`: Repeating processes
- `tree-diagram`: Hierarchical relationships
- `line-graph`: Change over time
- `thermometer`: Temperature measurements

### Language Arts Visuals
- `sentence-diagram`: Parts of speech
- `story-sequence`: Narrative structure
- `word-web`: Word associations
- `character-web`: Character relationships
- `venn-diagram`: Concept comparison

---

## References

- **Backend Schema**: `backend/app/generators/content_schemas.py`
- **Visual Metadata**: `VISUAL_TYPE_METADATA` dictionary
- **Component Types**: `my-tutoring-app/src/components/lumina/types.ts`
- **AI Service**: `my-tutoring-app/src/components/lumina/service/geminiService.ts`
- **Gemini API**: [Google Generative AI Documentation](https://ai.google.dev/docs)

---

## Changelog

### v1.1.0 (Current)
- Added all 6 ABCs/Early Literacy visual primitives:
  - `letter-tracing` - Letter formation practice with stroke order
  - `letter-picture` - Letter-sound correspondence
  - `alphabet-sequence` - Alphabetical order and missing letters
  - `rhyming-pairs` - Rhyme identification
  - `sight-word-card` - High-frequency word recognition
  - `sound-sort` - Phoneme categorization
- Updated type definitions in `types.ts`
- Integrated all ABC primitives into `KnowledgeCheck` component
- Updated documentation with complete examples and usage guidance

### v1.0.0
- Initial implementation of visual primitives system
- Added `object-collection` primitive
- Added `comparison-panel` primitive
- Integrated into `KnowledgeCheck` component
- Removed answer keys for educational integrity

---

## Contributing

When adding new primitives:

1. Follow the step-by-step guide above
2. Match the visual style of existing primitives
3. Add comprehensive TypeScript types
4. Include clear AI prompt examples
5. Update this documentation
6. Test across all breakpoints
7. Ensure no answer keys are displayed

For questions or issues, refer to the troubleshooting section or review existing primitive implementations as reference examples.
