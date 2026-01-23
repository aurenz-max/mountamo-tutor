# Adding New Primitives to Lumina

This guide explains how to add new primitive components to Lumina using the registry-based architecture.

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

**No changes needed to:**
- ~~`geminiService.ts`~~ - Registry pattern handles all component generation
- ~~`route.ts`~~ - Universal endpoint handles all components

---

## Step-by-Step Guide

### Step 1: Create the Primitive Component

Create a standalone React component that accepts a `data` prop.

**Important: Define and export your data interface here.** This component file is the **single source of truth** for the data type. The generator service will import this type rather than redefining it.

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

Register the React component for rendering.

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
  },
};
```

---

## Best Practices

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
