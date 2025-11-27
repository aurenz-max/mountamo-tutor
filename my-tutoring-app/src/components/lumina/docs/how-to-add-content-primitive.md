# How to Add a New Content Primitive

Content primitives (also called "basic primitives") are standalone, reusable components that represent major sections or features of an educational exhibit. Unlike visual primitives (which are embedded in Knowledge Checks), content primitives are top-level components in the exhibit structure.

## Overview

Content primitives are:
- **Standalone components**: They appear as independent sections in an exhibit
- **Part of the manifest system**: They can be selected by AI during exhibit generation
- **Reusable across exhibits**: Not tied to specific topics or grade levels
- **Composable**: Can be used alongside other primitives to build complete exhibits

Examples: `ConceptCard`, `CuratorBrief`, `FeatureExhibit`, `GenerativeTable`, `LetterTracing`

## Step-by-Step Guide

### 1. Create the Component File

Create a new file in `src/components/lumina/primitives/`

**File naming convention**: `PascalCase.tsx` (e.g., `TimelineCard.tsx`, `InteractiveQuiz.tsx`)

```tsx
// Example: TimelineCard.tsx
'use client';

import React, { useState } from 'react';
import { TimelineCardData } from '../types';

interface TimelineCardProps {
  data: TimelineCardData;
}

export const TimelineCard: React.FC<TimelineCardProps> = ({ data }) => {
  const { title, events, orientation } = data;
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);

  // Handle missing or invalid data
  if (!events || events.length === 0) {
    return (
      <div className="w-full my-6">
        <div className="text-center text-slate-400">
          <p>Timeline data is incomplete</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto my-12 animate-fade-in-up">
      <div className="glass-panel rounded-3xl overflow-hidden border border-blue-500/20">
        {/* Header */}
        <div className="bg-slate-900/80 p-6 border-b border-white/5">
          <h3 className="text-2xl font-bold text-white">{title}</h3>
        </div>

        {/* Timeline Content */}
        <div className="p-8">
          {/* Your component UI here */}
          <div className="space-y-4">
            {events.map((event, idx) => (
              <div
                key={idx}
                className="p-4 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={() => setSelectedEvent(idx)}
              >
                <div className="flex items-center gap-4">
                  <div className="text-blue-400 font-mono font-bold">
                    {event.year}
                  </div>
                  <div className="text-white">{event.title}</div>
                </div>
                {selectedEvent === idx && (
                  <div className="mt-4 text-slate-300 text-sm">
                    {event.description}
                  </div>
                )}
              </div>
            ))}
          </div>
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
- Use consistent styling patterns (see Design Guidelines below)
- Consider responsive design for mobile/tablet/desktop

---

### 2. Define TypeScript Types

Add type definitions to `src/components/lumina/types.ts`

```typescript
// Add your data interface
export interface TimelineEvent {
  year: number;
  title: string;
  description: string;
  category?: string;
}

export interface TimelineCardData {
  title: string;
  events: TimelineEvent[];
  orientation?: 'vertical' | 'horizontal';
}
```

**Note**: Content primitives are NOT added to union types like `VisualPrimitiveType` since they're standalone components.

---

### 3. Add to Universal Catalog (Manifest System)

If you want your primitive to be available for AI-generated exhibits, add it to the Universal Catalog in `src/components/lumina/service/geminiService.ts`

```typescript
export const UNIVERSAL_CATALOG: ComponentDefinition[] = [
  {
    id: 'curator-brief',
    description: 'Introduction, learning objectives, and hook. REQUIRED: Always include this first.',
    constraints: 'Must be first component'
  },
  // ... existing components ...
  {
    id: 'timeline-card',
    description: 'Chronological timeline of events. Use for historical sequences, process flows, or evolutionary progressions.',
    constraints: 'Requires temporal/sequential data'
  },
  {
    id: 'knowledge-check',
    description: 'Multiple choice quiz question. RECOMMENDED: Include at the end to assess understanding.',
    constraints: 'Typically one per exhibit, at the end'
  }
];
```

**Catalog Entry Fields**:
- `id`: Unique kebab-case identifier (matches ComponentId type)
- `description`: Clear explanation of when to use this component
- `constraints` (optional): Limitations or requirements (e.g., "Max 1 per exhibit", "Requires numeric data")

---

### 4. Add to ComponentId Type

Update the `ComponentId` type in `src/components/lumina/types.ts`

```typescript
export type ComponentId =
  // Core Narrative
  | 'curator-brief'
  | 'concept-card-grid'
  | 'feature-exhibit'
  | 'detail-drawer'

  // Data & Analysis
  | 'comparison-panel'
  | 'generative-table'
  | 'sentence-analyzer'
  | 'timeline-card' // <-- Add your new ID here

  // Math & Science Engines
  | 'formula-card'
  | 'math-visual'
  | 'custom-visual'

  // Assessment
  | 'knowledge-check';
```

---

### 5. Create Content Generator Function

Add a generator function in `src/components/lumina/service/geminiService.ts`

```typescript
/**
 * Generate Timeline Card content
 */
const generateTimelineCardContent = async (item: any, topic: string, gradeContext: string) => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      events: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.NUMBER },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING }
          },
          required: ["year", "title", "description"]
        }
      },
      orientation: {
        type: Type.STRING,
        enum: ["vertical", "horizontal"]
      }
    },
    required: ["title", "events"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create timeline for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

Generate a chronological timeline with 5-10 key events.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);
  return {
    type: 'timeline-card',
    instanceId: item.instanceId,
    data
  };
};
```

---

### 6. Add to Content Router

Update `generateComponentContent` function in `geminiService.ts` to route to your generator:

```typescript
export const generateComponentContent = async (
  item: any,
  topic: string,
  gradeLevel: string
): Promise<any> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  switch (item.componentId) {
    case 'curator-brief':
      return await generateCuratorBriefContent(item, topic, gradeLevelContext);

    case 'concept-card-grid':
      return await generateConceptCardsContent(item, topic, gradeLevelContext);

    // ... existing cases ...

    case 'timeline-card':
      return await generateTimelineCardContent(item, topic, gradeLevelContext);

    case 'knowledge-check':
      return await generateKnowledgeCheckContent(item, topic, gradeLevelContext);

    default:
      console.warn(`Unknown component type: ${item.componentId}`);
      return null;
  }
};
```

---

### 7. Add to Exhibit Assembly

Update `buildCompleteExhibitFromTopic` function to handle your new component:

```typescript
export const buildCompleteExhibitFromTopic = async (
  topic: string,
  gradeLevel: string = 'elementary'
): Promise<any> => {
  // ... existing code ...

  const exhibit: any = {
    topic: manifest.topic,
    themeColor: manifest.themeColor,
    intro: null,
    cards: [],
    featureExhibit: null,
    comparison: null,
    tables: [],
    timelines: [], // <-- Add array for your component
    knowledgeCheck: null,
    specializedExhibits: [],
    relatedTopics: []
  };

  // Map components to exhibit structure
  for (const component of validComponents) {
    if (!component) continue;

    switch (component.type) {
      case 'curator-brief':
        exhibit.intro = component.data;
        break;

      // ... existing cases ...

      case 'timeline-card':
        exhibit.timelines.push(component.data); // <-- Add your case
        break;

      case 'knowledge-check':
        exhibit.knowledgeCheck = component.data;
        break;

      default:
        console.warn('Unknown component type:', component.type);
    }
  }

  return exhibit;
};
```

---

### 8. Add to App.tsx Rendering

Update `src/components/lumina/App.tsx` to render your component in the exhibit:

```tsx
import { TimelineCard } from './primitives/TimelineCard';

export default function App() {
  // ... existing code ...

  return (
    <div>
      {/* ... existing sections ... */}

      {/* Timeline Cards Section */}
      {exhibitData.timelines && exhibitData.timelines.length > 0 && (
        <div className="space-y-8">
          {exhibitData.timelines.map((timeline, index) => (
            <TimelineCard key={index} data={timeline} />
          ))}
        </div>
      )}

      {/* ... remaining sections ... */}
    </div>
  );
}
```

---

### 9. Update ExhibitData Type

Update the `ExhibitData` interface in `types.ts` to include your component:

```typescript
export interface ExhibitData {
  topic: string;
  intro: IntroData;
  specializedExhibits?: SpecializedExhibit[];
  featureExhibit: FeatureExhibitData;
  comparison: ComparisonData;
  cards: ConceptCardData[];
  tables: TableData[];
  timelines?: TimelineCardData[]; // <-- Add your component type
  knowledgeCheck: KnowledgeCheckData;
  relatedTopics: RelatedTopic[];
}
```

---

### 10. Test Your Content Primitive

1. **Manual Testing**: Create test data and render the component directly
2. **Manifest Testing**: Use the manifest generator with a relevant topic
3. **Full Flow Testing**: Generate a complete exhibit and verify your component appears
4. **Edge Cases**: Test with missing data, edge values, different grade levels

---

## Design Guidelines

### Visual Hierarchy
- **Container**: Use `.glass-panel` with `rounded-3xl` for main container
- **Header**: Dark background (`bg-slate-900/80`) with border separator
- **Content Area**: Padded content with `p-8` or `p-12`
- **Cards/Items**: Use `bg-slate-800/50` with `rounded-xl` for sub-sections

### Styling Patterns

```tsx
// Standard container
<div className="w-full max-w-5xl mx-auto my-12 animate-fade-in-up">
  <div className="glass-panel rounded-3xl overflow-hidden border border-blue-500/20">
    {/* Content */}
  </div>
</div>

// Terminal-style header
<div className="bg-slate-900/80 p-4 flex items-center justify-between border-b border-white/5">
  <div className="flex items-center gap-2">
    <span className="text-xs font-mono uppercase tracking-widest text-blue-400">
      Section Title
    </span>
  </div>
</div>

// Interactive item
<button className="p-6 rounded-xl bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-white/5 hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-2">
  {/* Content */}
</button>
```

### Color Scheme
- **Primary (Blue)**: `text-blue-400`, `bg-blue-500/20`, `border-blue-500/30`
- **Success (Green)**: `text-emerald-400`, `bg-emerald-500/20`
- **Accent (Purple)**: `text-purple-400`, `bg-purple-500/20`
- **Text**: `text-white` for headings, `text-slate-300` for body, `text-slate-400` for muted
- **Backgrounds**: `bg-slate-900`, `bg-slate-800`, `glass-panel`

### Responsive Design
- Use Tailwind's responsive utilities: `sm:`, `md:`, `lg:`
- Default to mobile-first design
- Use `max-w-5xl` or similar for content containers
- Grid layouts: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

---

## Standalone vs. Manifest-Enabled Primitives

### Standalone Primitives (No Manifest Integration)
If you don't want your primitive to be AI-generated, you can skip steps 3-9:
- **Example**: `LetterTracing` (moved to standalone)
- **Use**: Import and use directly in your app
- **No need to**: Add to Universal Catalog, create generators, or add to exhibit assembly

### Manifest-Enabled Primitives (Full Integration)
For AI-generated exhibits, complete all steps:
- **Example**: `ConceptCard`, `FeatureExhibit`, `GenerativeTable`
- **Use**: Available in manifest system for automatic exhibit generation
- **Requires**: Catalog entry, generator function, assembly logic

---

## Example: Complete Content Primitive

Here's a minimal but complete example:

```tsx
// VocabularyCard.tsx
'use client';

import React, { useState } from 'react';
import { VocabularyCardData } from '../types';

interface VocabularyCardProps {
  data: VocabularyCardData;
}

export const VocabularyCard: React.FC<VocabularyCardProps> = ({ data }) => {
  const { words } = data;
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);

  if (!words || words.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-5xl mx-auto my-12 animate-fade-in-up">
      <div className="glass-panel rounded-3xl overflow-hidden border border-purple-500/20">
        <div className="bg-slate-900/80 p-6 border-b border-white/5">
          <h3 className="text-2xl font-bold text-white">Key Vocabulary</h3>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {words.map((word, idx) => (
            <div
              key={idx}
              className="relative h-48 cursor-pointer perspective-1000"
              onClick={() => setFlippedIndex(flippedIndex === idx ? null : idx)}
            >
              <div className={`w-full h-full transition-transform duration-500 transform-style-3d ${
                flippedIndex === idx ? 'rotate-y-180' : ''
              }`}>
                {/* Front */}
                <div className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
                  <h4 className="text-2xl font-bold text-white text-center">
                    {word.term}
                  </h4>
                </div>

                {/* Back */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center p-6 bg-slate-800 rounded-xl border border-white/10">
                  <p className="text-sm text-slate-300 text-center leading-relaxed">
                    {word.definition}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

**Corresponding Types:**

```typescript
// types.ts
export interface VocabularyWord {
  term: string;
  definition: string;
}

export interface VocabularyCardData {
  words: VocabularyWord[];
}
```

**Generator Function:**

```typescript
// geminiService.ts
const generateVocabularyCardContent = async (item: any, topic: string, gradeContext: string) => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      words: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING },
            definition: { type: Type.STRING }
          },
          required: ["term", "definition"]
        }
      }
    },
    required: ["words"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create vocabulary cards for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

Generate 6-9 key terms with clear, age-appropriate definitions.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);
  return {
    type: 'vocabulary-card',
    instanceId: item.instanceId,
    data
  };
};
```

---

## Checklist

Before submitting your content primitive, ensure:

- [ ] Component file created in `primitives/` directory
- [ ] TypeScript types defined in `types.ts`
- [ ] Component ID added to `ComponentId` type (if manifest-enabled)
- [ ] Component added to Universal Catalog (if manifest-enabled)
- [ ] Generator function created in `geminiService.ts` (if manifest-enabled)
- [ ] Added to `generateComponentContent` router (if manifest-enabled)
- [ ] Added to `buildCompleteExhibitFromTopic` assembly (if manifest-enabled)
- [ ] ExhibitData interface updated (if manifest-enabled)
- [ ] Component rendered in `App.tsx`
- [ ] Component handles missing/invalid data gracefully
- [ ] Styling follows design guidelines
- [ ] Component tested manually and with AI generation (if applicable)

---

## Common Pitfalls

1. **Forgetting to add to ComponentId type**: TypeScript will complain about unknown component IDs
2. **Not updating ExhibitData interface**: Your component won't be included in the exhibit structure
3. **Missing from generateComponentContent router**: Generator won't be called
4. **Incorrect assembly logic**: Component data won't be mapped correctly
5. **Inconsistent return types**: Ensure generator returns `{ type, instanceId, data }` format
6. **Not handling arrays**: If multiple instances are allowed, use arrays in ExhibitData
7. **Skipping validation**: Always validate data before rendering

---

## Advanced Topics

### Dynamic Configuration
Accept configuration options from the manifest:

```typescript
// In your generator
const itemCount = item.config?.itemCount || 6;
const difficulty = item.config?.difficulty || 'medium';
```

### Interactive Features
Add state management for interactivity:

```tsx
const [selectedItem, setSelectedItem] = useState<string | null>(null);
const [isExpanded, setIsExpanded] = useState(false);
```

### Sub-components
Break down complex primitives into smaller pieces:

```tsx
// TimelineCard.tsx
import { TimelineEvent } from './components/TimelineEvent';
import { TimelineAxis } from './components/TimelineAxis';
```

### Theming
Use dynamic theme colors from the manifest:

```tsx
<div style={{
  backgroundColor: `${data.themeColor}20`,
  borderColor: `${data.themeColor}40`
}}>
```

---

## Need Help?

- Review existing content primitives in `primitives/`
- Check `geminiService.ts` for generator patterns
- Look at `App.tsx` to see how components are rendered in exhibits
- Test with the manifest viewer to debug AI generation issues
