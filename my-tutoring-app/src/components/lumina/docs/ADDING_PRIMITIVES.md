# Adding New Primitives to Lumina (Post-Refactor)

This guide explains the simplified architecture for adding new primitive components to Lumina.

## Quick Start: 4 Files, Zero Switch Statements

After the Phase 1-3 refactor, adding a new primitive is streamlined:

| Step | File | What to Add |
|------|------|-------------|
| 1 | `primitives/.../MyPrimitive.tsx` | Create the React component |
| 2 | `service/[domain]/gemini-my-primitive.ts` | Create the generator |
| 3 | `service/registry/generators/[domain]Generators.ts` | Register the generator |
| 4 | `service/manifest/catalog/[domain].ts` | Add to catalog |
| 5 | `config/primitiveRegistry.tsx` | Register UI component |
| 6 | `types.ts` | Add ComponentId and data types |

**No changes needed to:**
- ❌ ~~`geminiService.ts`~~ - Uses registry pattern now
- ❌ ~~`route.ts`~~ - Universal endpoint handles all components

---

## Step-by-Step Guide

### Step 1: Create the Primitive Component

Create a standalone React component that accepts a `data` prop.

```tsx
// primitives/visual-primitives/math/MyPrimitive.tsx
import React, { useState } from 'react';

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

### Step 2: Create the Generator Service

Create an AI-powered generator that produces content for your primitive.

```tsx
// service/math/gemini-my-primitive.ts
import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { MyPrimitiveData } from '../../primitives/visual-primitives/math/MyPrimitive';

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
  config?: Record<string, unknown>
): Promise<MyPrimitiveData> => {
  const prompt = `Create educational content for "${topic}" at ${gradeLevel} level...`;

  const result = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: myPrimitiveSchema
    }
  });

  return JSON.parse(result.text || '{}');
};
```

### Step 3: Register the Generator

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

### Step 4: Add to Manifest Catalog

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

### Step 5: Register UI Component

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

### Step 6: Add TypeScript Types

Update the type definitions.

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
| Math | `registry/generators/mathGenerators.ts` |
| Engineering | `registry/generators/engineeringGenerators.ts` |
| Science | (create `scienceGenerators.ts` if needed) |
| Literacy | (create `literacyGenerators.ts` if needed) |
| Media | `registry/generators/mediaGenerators.ts` |
| Foundation | `registry/generators/foundationGenerators.ts` |

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

The refactored architecture provides:

| Metric | Before | After |
|--------|--------|-------|
| Files to modify | 6 | 4 |
| Lines to add | ~150 | ~30 |
| Switch cases to update | 3 | 0 |
| AI context required | ~7,000 lines | ~100 lines |

---

## Troubleshooting

### Component doesn't render
1. Verify `componentId` matches registry key exactly
2. Check component appears in `exhibitData.orderedComponents`
3. Check console for warnings from `ManifestOrderRenderer`

### "Unknown component type" warning
1. Generator not registered - check `generators/[domain]Generators.ts`
2. Feature flag disabled - check `USE_CONTENT_REGISTRY` in `featureFlags.ts`

### AI never selects component
1. Not in catalog - add to appropriate `catalog/[domain].ts`
2. Description unclear - improve description with use cases

### TypeScript errors
1. Missing `ComponentId` entry in `types.ts`
2. Data interface not exported

---

## Legacy Documentation

For primitives added before the refactor (that still use switch statements), see:
- [ADDING_PRIMITIVES_LEGACY.md](./ADDING_PRIMITIVES_LEGACY.md)

The legacy switch statements in `geminiService.ts` serve as fallback during migration.
Once all generators are migrated to the registry, the fallback will be removed.
