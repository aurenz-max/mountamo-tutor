# Lumina Architecture Refactoring Plan

## 1. The Problem: "Context Debt" & The Monolith

**Why did we reach this conclusion?**
Currently, adding a single primitive requires an AI (or developer) to load and reason about three massive files:
1.  `geminiService.ts` (~5,700 lines)
2.  `gemini-manifest.ts` (~800 lines)
3.  `route.ts` (~450 lines)

**Total Context Cost:** ~7,000 lines of code just to wire up *one* new component. This "Context Debt" makes AI assistance slower, more expensive, and more prone to hallucination as the file grows.

**The Solution:** Decouple the "Wiring" from the "Logic". By moving the wiring into small, modular registries, we reduce the context needed to add a primitive by **~99%**.

---

## 2. Architectural Flow & Optimization

### Current vs. New Architecture

```mermaid
graph TD
    User[User] -->|1. Request Topic| App[App.tsx]
    App -->|2. Generate Manifest| ManifestService[gemini-manifest.ts]
    ManifestService -->|3. Return Blueprint| App
    App -->|4. Build Exhibit| GeminiService[geminiService.ts]
    
    subgraph "Current State (The Bottleneck)"
        GeminiService -->|Huge Switch Statement| GenBar[generateBarModel]
        GeminiService -->|Huge Switch Statement| GenLine[generateNumberLine]
        GeminiService -->|Manual Assembly Loop| LegacyArrays[Legacy Arrays\n(exhibit.barModels)]
    end
    
    subgraph "Target State (The Registry)"
        GeminiService -->|1-Line Lookup| ContentRegistry[ContentRegistry]
        ContentRegistry -->|Dynamic Import| GenBar
        ContentRegistry -->|Dynamic Import| GenLine
        GeminiService -->|Streamlined| OrderedComponents[OrderedComponents Array]
    end
    
    OrderedComponents -->|5. Render| Renderer[ManifestOrderRenderer]
    Renderer -->|6. Display| User
    
    style LegacyArrays fill:#ffcccc,stroke:#ff0000,stroke-width:2px,stroke-dasharray: 5 5
    style OrderedComponents fill:#ccffcc,stroke:#00ff00,stroke-width:2px
```

### Identified "Un-needed Steps" (To Delete)

1.  **❌ The Assembly Switch:** In `geminiService.ts`, the second loop that pushes data into `exhibit.barModels`, `exhibit.numberLines`, etc.
    *   **Why it's un-needed:** `ManifestOrderRenderer` renders exclusively from `orderedComponents`. The specific arrays are dead code for new primitives.
2.  **❌ The API Route Switch:** In `route.ts`, adding `case 'generateMyPrimitive':`.
    *   **Why it's un-needed:** The existing `generateComponentContent` endpoint acts as a universal router.
3.  **❌ The Generation Switch:** In `geminiService.ts`, the massive `switch (item.componentId)` block.
    *   **Why it's un-needed:** Can be replaced by a dynamic registry lookup.

---

## 3. Implementation Plan

### Phase 1: The Service Registry (High Impact)

**Goal:** Decouple content generation logic from the main service file.

**1.1 Create the Registry**
`src/components/lumina/service/registry/contentRegistry.ts`
```typescript
import { ComponentId } from '../../types';

export type ContentGenerator = (
  item: any, 
  topic: string, 
  gradeContext: string
) => Promise<{ type: string; instanceId: string; data: any }>;

export const CONTENT_GENERATORS: Record<string, ContentGenerator> = {};

export function registerGenerator(id: ComponentId, generator: ContentGenerator) {
  CONTENT_GENERATORS[id] = generator;
}
```

**1.2 Refactor `geminiService.ts`**
Replace the massive switch statement in `generateComponentContent` with:

```typescript
import { CONTENT_GENERATORS } from './registry/contentRegistry';
// Import registration files (side-effects)
import './registry/mathGenerators'; 

export const generateComponentContent = async (item: any, topic: string, grade: string) => {
  const generator = CONTENT_GENERATORS[item.componentId];
  if (generator) return await generator(item, topic, grade);
  return null;
};
```

### Phase 2: Catalog Modules (Context Reduction)

**Goal:** Split the manifest catalog so AI agents don't need to read the entire list.

**2.1 Split the Catalog**
Create `src/components/lumina/service/manifest/catalog/math.ts`:
```typescript
export const MATH_CATALOG = [
  { id: 'bar-model', description: '...' },
  // ...
];
```

**2.2 Aggregate**
Update `gemini-manifest.ts` to import these arrays instead of defining them inline.

### Phase 3: API Route Optimization

**Goal:** Stop editing `route.ts`.

**Strategy:** Use the "Universal Endpoint".
Instead of adding `case 'generateFractionBar'`, call the existing `generateComponentContent` endpoint from the frontend.

```typescript
// Frontend Call
fetch('/api/lumina', {
  body: JSON.stringify({
    action: 'generateComponentContent',
    params: { componentId: 'fraction-bar', ... }
  })
})
```

### Phase 4: Workflow Update

Update `ADDING_PRIMITIVES.md` to reflect the new, efficient workflow:

1.  **Create Component:** `primitives/MyPrimitive.tsx`
2.  **Create Generator:** `service/my-primitive/generator.ts`
3.  **Register UI:** `config/primitiveRegistry.tsx`
4.  **Register Service:** `service/registry/contentRegistry.ts`
5.  **Add to Catalog:** `service/manifest/catalog/math.ts`

**Result:** `geminiService.ts` and `route.ts` remain untouched.
