# Adding New Primitives to Lumina

This guide explains the scalable architecture for adding new primitive components to the Lumina exhibit system.

## Architecture Overview

The Lumina primitive system uses a **Registry Pattern** to eliminate repetitive code and make adding new primitives a simple 3-step process.

### Key Files

- **`config/primitiveRegistry.tsx`** - Central registry mapping component IDs to configurations
- **`components/PrimitiveRenderer.tsx`** - Universal renderer that uses the registry
- **`types.ts`** - TypeScript definitions including `ComponentId` enum
- **`primitives/`** - Individual primitive components

## How It Works

### Before (Non-Scalable Approach)

```tsx
// ❌ OLD WAY: Required custom code for each primitive
{exhibitData.graphBoards && exhibitData.graphBoards.length > 0 && (
   <div className="max-w-5xl mx-auto mb-20">
        <div className="flex items-center gap-4 mb-8">
            <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">
                Interactive Graph
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
        </div>
        {exhibitData.graphBoards.map((graphData, index) => (
            <GraphBoardWrapper key={index} data={graphData} />
        ))}
   </div>
)}
```

**Problems:**
- Duplicated header/divider code
- Manual mapping logic
- Conditional wrapper div
- Doesn't scale - every new primitive requires App.tsx changes

### After (Scalable Approach)

```tsx
// ✅ NEW WAY: Single line per primitive type
<PrimitiveCollectionRenderer
    componentId="graph-board"
    dataArray={exhibitData.graphBoards || []}
/>
```

**Benefits:**
- All styling/layout configured in registry
- No duplication
- Add new primitives without touching App.tsx
- Consistent rendering pattern

## Adding a New Primitive: Step-by-Step

### Step 1: Create Your Primitive Component

Make it a **standalone component** that manages its own state and accepts a `data` prop.

```tsx
// primitives/MyNewPrimitive.tsx
import React, { useState } from 'react';
import { MyNewPrimitiveData } from '../types';

interface MyNewPrimitiveProps {
  data: MyNewPrimitiveData;
  className?: string;
}

const MyNewPrimitive: React.FC<MyNewPrimitiveProps> = ({ data, className }) => {
  const [internalState, setInternalState] = useState(data.initialValue);

  return (
    <div className={className}>
      <h3>{data.title}</h3>
      {/* Your primitive's UI */}
    </div>
  );
};

export default MyNewPrimitive;
```

**Key Points:**
- ✅ Accept a `data` prop with your primitive's data structure
- ✅ Manage state internally (don't require wrapper components)
- ✅ Keep it focused on a single visualization/interaction concept

### Step 2: Add TypeScript Types

```tsx
// types.ts

// 1. Add your component ID to the enum (if needed)
export type ComponentId =
  | 'curator-brief'
  | 'graph-board'
  | 'my-new-primitive'  // ← Add this
  | ...;

// 2. Define your data structure
export interface MyNewPrimitiveData {
  title: string;
  description: string;
  initialValue: number;
  // ... other fields
}

// 3. Add to ExhibitData (if part of main exhibit flow)
export interface ExhibitData {
  topic: string;
  // ... existing fields
  myNewPrimitives?: MyNewPrimitiveData[];  // ← Add this
}
```

### Step 3: Register Your Primitive

```tsx
// config/primitiveRegistry.tsx

// 1. Import your component
import MyNewPrimitive from '../primitives/MyNewPrimitive';

// 2. Add to registry
export const PRIMITIVE_REGISTRY: Record<ComponentId, PrimitiveConfig> = {
  // ... existing entries

  'my-new-primitive': {
    component: MyNewPrimitive,
    sectionTitle: 'My Cool Feature',     // Optional: section header text
    showDivider: true,                    // Optional: show header divider
    dividerStyle: 'left',                 // 'left' or 'center'
    allowMultiple: true,                  // Can have multiple instances?
    containerClassName: 'max-w-5xl mx-auto mb-20',  // Optional: wrapper styles
  },
};
```

### Step 4: Add Content Generation Logic

**CRITICAL STEP:** The registry pattern handles rendering, but you must also wire up the content generation pipeline in `geminiService.ts`.

```tsx
// service/geminiService.ts

// 1. Import your generation function (if you have a dedicated service file)
import { generateMyNewPrimitive } from "./my-primitive/gemini-my-primitive";

// 2. Add case to generateComponentContent switch statement (around line 2600)
case 'my-new-primitive':
  return await generateMyNewPrimitiveContent(item, topic, gradeLevelContext);

// 3. Create the content generation function (around line 4300)
const generateMyNewPrimitiveContent = async (
  item: any,
  topic: string,
  gradeContext: string
): Promise<{ type: string; instanceId: string; data: any }> => {
  // Extract configuration from manifest item
  const config = item.config || {};

  // Call your dedicated generation service or build data directly
  const primitiveData = await generateMyNewPrimitive(topic, gradeContext, config);
  // OR build data structure directly:
  // const primitiveData = {
  //   title: item.title,
  //   description: item.intent,
  //   // ... other fields
  // };

  return {
    type: 'my-new-primitive',
    instanceId: item.instanceId,
    data: primitiveData
  };
};

// 4. Add assembly case in assembleExhibitFromComponents (around line 4650)
case 'my-new-primitive':
  if (!exhibit.myNewPrimitives) exhibit.myNewPrimitives = [];
  exhibit.myNewPrimitives.push(component.data);
  break;
```

**Why is this needed?**
- The registry handles how components are **rendered**
- But `geminiService.ts` handles how component **content is generated** from the manifest
- Without this step, the manifest will call your component, but it won't have any data to show

### Step 5: Use in App.tsx

```tsx
// App.tsx

// Single line to render all instances:
<PrimitiveCollectionRenderer
    componentId="my-new-primitive"
    dataArray={exhibitData.myNewPrimitives || []}
/>

// Or for a single instance:
<PrimitiveCollectionRenderer
    componentId="my-new-primitive"
    dataArray={exhibitData.myNewPrimitive ? [exhibitData.myNewPrimitive] : []}
/>
```

**That's it!** Your primitive is now fully integrated.

## Advanced: Passing Additional Props

If your primitive needs props beyond `data`:

```tsx
<PrimitiveCollectionRenderer
    componentId="generative-table"
    dataArray={exhibitData.tables || []}
    additionalProps={{
        onRowClick: handleDetailItemClick,
        theme: 'dark'
    }}
/>
```

These props are spread to each component instance.

## Registry Configuration Options

```tsx
interface PrimitiveConfig {
  // Required: The React component
  component: React.ComponentType<any>;

  // Optional: Wrap each instance in a custom wrapper
  wrapper?: React.ComponentType<{
    children: React.ReactNode;
    data: any;
    index?: number
  }>;

  // Optional: Section header text
  sectionTitle?: string;

  // Optional: Show divider line
  showDivider?: boolean;

  // Optional: Divider style ('left' or 'center')
  dividerStyle?: 'left' | 'center';

  // Optional: Container classes for the whole section
  containerClassName?: string;

  // Optional: Whether multiple instances are allowed
  allowMultiple?: boolean;
}
```

## Example: Header Styles

### Left-Aligned Header (Default)
```tsx
dividerStyle: 'left'
```
Renders:
```
Data Analysis ────────────────────────────────────
```

### Center-Aligned Header
```tsx
dividerStyle: 'center'
```
Renders:
```
──────────── Knowledge Assessment ────────────────
```

## When NOT to Use This Pattern

- **One-off components** that appear exactly once with custom layout (e.g., `CuratorBrief`)
- **Modal/Drawer components** that aren't part of the main content flow
- **Wrapper/Layout components** like `GenerativeBackground`

For these, keep them in App.tsx as-is.

## Benefits Summary

✅ **Scalable**: Add primitives without modifying App.tsx
✅ **Consistent**: All primitives rendered with same pattern
✅ **DRY**: No duplicated header/wrapper code
✅ **Type-Safe**: Full TypeScript support
✅ **Flexible**: Support for collections and single instances
✅ **Maintainable**: Configuration in one place

## Real Examples from Codebase

### Graph Board (Collection)
```tsx
<PrimitiveCollectionRenderer
    componentId="graph-board"
    dataArray={exhibitData.graphBoards || []}
/>
```

### Tables with Click Handler
```tsx
<PrimitiveCollectionRenderer
    componentId="generative-table"
    dataArray={exhibitData.tables || []}
    additionalProps={{ onRowClick: handleDetailItemClick }}
/>
```

### Knowledge Check (Single Instance)
```tsx
<PrimitiveCollectionRenderer
    componentId="knowledge-check"
    dataArray={exhibitData.knowledgeCheck ? [exhibitData.knowledgeCheck] : []}
/>
```

## Troubleshooting

### My primitive doesn't render
1. Check that the `componentId` matches the registry key exactly
2. Verify `dataArray` is not empty in React DevTools
3. Check console for warnings from `PrimitiveCollectionRenderer`
4. **MOST COMMON:** Look for "Unknown component type" in console - this means you forgot Step 4 (content generation logic)

### "Unknown component type" error in console
This means the manifest is calling your component, but `geminiService.ts` doesn't know how to generate content for it.
1. Add the case handler in `generateComponentContent` switch statement
2. Create the `generate[ComponentName]Content` function
3. Add the assembly case in `assembleExhibitFromComponents`

### Headers/dividers not showing
1. Set `showDivider: true` in registry config
2. Add `sectionTitle` in registry config

### Wrong styling
1. Check `containerClassName` in registry config
2. Verify your primitive's internal className handling

### TypeScript errors
1. Ensure `ComponentId` type includes your new ID
2. Verify data structure matches interface definition
3. Check that primitive component accepts `data` prop

## Complete Integration Checklist

When adding a new primitive from scratch, ensure you complete ALL steps:

- [ ] **Step 1:** Create the primitive component in `primitives/`
- [ ] **Step 2:** Add TypeScript types to `types.ts` (ComponentId, data interface, ExhibitData field)
- [ ] **Step 3:** Register in `primitiveRegistry.tsx` with configuration
- [ ] **Step 4:** Add content generation logic in `geminiService.ts`
  - [ ] Import generation function (if needed)
  - [ ] Add case to `generateComponentContent` switch
  - [ ] Create `generate[ComponentName]Content` function
  - [ ] Add assembly case in `assembleExhibitFromComponents`
- [ ] **Step 5:** Add `PrimitiveCollectionRenderer` call in `App.tsx`
- [ ] **Step 6:** Add to manifest catalog in `gemini-manifest.ts` (if you want AI to use it)
- [ ] Test that manifest generation includes your component
- [ ] Test that content generation works without "Unknown component type" error
- [ ] Test that the component renders correctly in the exhibit

## Migration Checklist

When converting an existing primitive to the registry pattern:

- [ ] Remove state management from wrapper components
- [ ] Move state into the primitive component itself
- [ ] Change props from `{ value, onChange }` to `{ data }`
- [ ] Register in `primitiveRegistry.tsx`
- [ ] Ensure content generation logic exists in `geminiService.tsx`
- [ ] Replace custom rendering code in `App.tsx` with `PrimitiveCollectionRenderer`
- [ ] Test that all functionality still works
- [ ] Remove unused wrapper components and imports
