# Adding New Primitives to Lumina

This guide explains the scalable architecture for adding new primitive components to the Lumina exhibit system.

## 🚀 Quick Reference: 7 Files You Must Touch

When adding a new primitive, you MUST modify these files (in order):

1. **`types.ts`** - Add ComponentId, data interface, and ExhibitData field
2. **`config/primitiveRegistry.tsx`** - Import and register component
3. **`service/geminiService.ts`** - Import, switch case, wrapper function, 2× assembly
4. **`App.tsx`** - Add PrimitiveCollectionRenderer call
5. **`service/manifest/gemini-manifest.ts`** - Add to catalog ⚠️ MOST MISSED!
6. **`app/api/lumina/route.ts`** - Import service and add API route handler ⚠️ CRITICAL!
7. **`primitives/.../YourComponent.tsx`** - Create the component (may already exist)

**Missing ANY of these = Component won't work!**

---

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

### Step 4.5: Add to Manifest Catalog (Make AI Aware)

**EQUALLY CRITICAL:** Even if your primitive renders and generates content correctly, the AI won't use it unless you add it to the manifest catalog.

```tsx
// service/manifest/gemini-manifest.ts

// Add to UNIVERSAL_CATALOG array (around line 103)
export const UNIVERSAL_CATALOG: ComponentDefinition[] = [
  // ... existing components
  {
    id: 'my-new-primitive',
    description: 'Clear description of what this primitive does and when to use it. Perfect for [use case]. ESSENTIAL for [subject area].',
    constraints: 'Any limitations or requirements (e.g., "Requires numeric data", "Best for grades 3-8")'
  },
];

// Also update the COMPONENT SELECTION BY SUBJECT section (around line 430)
## COMPONENT SELECTION BY SUBJECT:
- Elementary Math (Your Topic) → 'my-new-primitive', 'other-related'
```

**Real Example (FractionBar):**
```tsx
{
  id: 'fraction-bar',
  description: 'Interactive rectangular bar models showing fractional parts with adjustable partitions. Perfect for teaching fractions, equivalent fractions, comparing fractions, and fraction operations. Students can click to shade/unshade parts. ESSENTIAL for elementary math.',
  constraints: 'Requires fraction values (numerator/denominator). Supports multiple bars for comparison.'
},
```

**Why is this critical?**
- The manifest generation uses this catalog to decide which primitives to include
- Without this entry, AI will NEVER select your primitive, even if everything else works
- This is the most commonly missed step when adding new primitives

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

## Pre-Flight Checklist

Before you start coding, verify these prerequisites:

- [ ] The primitive component file exists and exports a React component
- [ ] The generation service file exists (e.g., `service/math/gemini-your-primitive.ts`)
- [ ] You have a clear understanding of the data structure the primitive needs
- [ ] You know which subject areas should use this primitive

## Complete Integration Checklist

When adding a new primitive from scratch, ensure you complete ALL steps:

### Core Implementation (Required for Basic Rendering)
- [ ] **Step 1:** Create the primitive component in `primitives/` or `primitives/visual-primitives/math/`
  - [ ] Component accepts `data` prop with defined TypeScript interface
  - [ ] Component manages its own internal state
  - [ ] Component is exported as default export

### TypeScript Type Definitions (Required for Type Safety)
- [ ] **Step 2:** Add TypeScript types to `types.ts`
  - [ ] Add new component ID to `ComponentId` type union (e.g., `'factor-tree'`)
  - [ ] Create data interface (e.g., `FactorTreeData`) with all required fields
  - [ ] Add optional field to `ExhibitData` interface (e.g., `factorTrees?: FactorTreeData[]`)

### Registry Configuration (Required for Rendering)
- [ ] **Step 3:** Register in `config/primitiveRegistry.tsx`
  - [ ] Import the component at the top of the file
  - [ ] Add entry to `PRIMITIVE_REGISTRY` object with:
    - [ ] `component`: Reference to imported component
    - [ ] `sectionTitle`: Display title for the section header
    - [ ] `showDivider`: Set to `true` for most components
    - [ ] `dividerStyle`: Usually `'left'` for math primitives
    - [ ] `allowMultiple`: Set to `true` if multiple instances allowed
    - [ ] `containerClassName`: Standard is `'max-w-6xl mx-auto mb-20'`

### Content Generation Pipeline (Required for AI Content)
- [ ] **Step 4:** Add content generation logic in `service/geminiService.ts`
  - [ ] Import generation function from dedicated service file (e.g., `import { generateFactorTree } from './math/gemini-factor-tree'`)
  - [ ] Add case to `generateComponentContent` switch statement (around line 2600)
    - [ ] Case matches component ID exactly (e.g., `case 'factor-tree':`)
    - [ ] Returns properly formatted component data
  - [ ] Create `generate[ComponentName]Content` function (around line 4300-4900)
    - [ ] Accepts `item`, `topic`, and `gradeContext` parameters
    - [ ] Calls dedicated generation service or builds data inline
    - [ ] Returns object with `type`, `instanceId`, and `data` fields
  - [ ] **CRITICAL:** Add assembly case in BOTH `assembleExhibitFromComponents` loops (around line 5200-5400 AND 5500-5700)
    - [ ] Look for the comment "Map components to exhibit structure"
    - [ ] There are TWO nearly identical switch statements - you must update BOTH
    - [ ] In each switch, add your case BEFORE the `default:` case
    - [ ] Each case should: Initialize array if needed (e.g., `if (!exhibit.factorTrees) exhibit.factorTrees = []`)
    - [ ] Each case should: Push `dataWithInstanceId` to the array (second loop) or `component.data` (first loop, but verify which variable is used)
    - [ ] **Verification:** Search for your component-id in the file - you should see it in at least 3 places (import, switch case, assembly cases)

### App Integration (Required for Display)
- [ ] **Step 5:** Add `PrimitiveCollectionRenderer` call in `App.tsx`
  - [ ] Add in appropriate section (math primitives go after line 1040)
  - [ ] Use correct `componentId` matching registry key
  - [ ] Reference correct `ExhibitData` field with fallback to empty array
  - [ ] Example: `<PrimitiveCollectionRenderer componentId="factor-tree" dataArray={exhibitData.factorTrees || []} />`

### AI Manifest Awareness (CRITICAL - Most Commonly Missed!)
- [ ] **Step 6: CRITICAL** Add to manifest catalog in `service/manifest/gemini-manifest.ts`
  - [ ] Add component definition to `UNIVERSAL_CATALOG` array (around line 103)
    - [ ] `id`: Exact match to component ID
    - [ ] `description`: Clear description of what primitive does and when to use it
    - [ ] `constraints`: Any limitations or requirements
  - [ ] Add to appropriate subject category in `COMPONENT SELECTION BY SUBJECT` section (around line 430)
    - [ ] List component ID in relevant subjects (e.g., "Elementary Math")
  - [ ] Provide clear guidance on when AI should select this primitive

### API Route Integration (CRITICAL - For Math Primitives with Dedicated Services)
- [ ] **Step 7: CRITICAL** Add API route handler in `app/api/lumina/route.ts`
  - [ ] Import the generation function from the service file (e.g., `import { generateExpressionTree } from '@/components/lumina/service/math/gemini-expression-tree'`)
    - [ ] Add import near top of file with other math service imports (around line 24-37)
  - [ ] Add case to POST handler switch statement (before the `default:` case, around line 330)
    - [ ] Case name should match a clear action pattern (e.g., `case 'generateExpressionTree':`)
    - [ ] Call your generation function with appropriate parameters from `params`
    - [ ] Return the result wrapped in `NextResponse.json()`
  - [ ] **Example:**
    ```tsx
    case 'generateExpressionTree':
      const expressionTree = await generateExpressionTree(
        params.topic,
        params.gradeLevel,
        params.config
      );
      return NextResponse.json(expressionTree);
    ```
  - [ ] **Why is this needed?** Math primitive services with structured generation logic need their own API endpoints to be called from the frontend or other services

### Testing & Validation
- [ ] **Step 8:** Verify complete integration
  - [ ] Run all 6 verification commands below - ALL must return results
  - [ ] Generate a test exhibit with a topic that would use your primitive
  - [ ] Check browser console for "Unknown component type" errors - there should be NONE
  - [ ] Verify the component appears in the manifest layout (check console logs)
  - [ ] Confirm the component renders visually in the exhibit
  - [ ] Test all interactive features of the component
  - [ ] Verify styling and responsive behavior across different screen sizes
  - [ ] Check that multiple instances work if `allowMultiple: true`
  - [ ] Test with different grade levels to ensure content generation adapts appropriately

## Quick Verification Commands

After adding a new primitive, run these checks:

```bash
# 1. Check if component ID is in ComponentId type
grep "your-component-id" src/components/lumina/types.ts

# 2. Check if registered in primitiveRegistry
grep "your-component-id" src/components/lumina/config/primitiveRegistry.tsx

# 3. Check if in App.tsx
grep "your-component-id" src/components/lumina/App.tsx

# 4. Check if content generation exists
grep "your-component-id" src/components/lumina/service/geminiService.ts

# 5. Check if in manifest catalog
grep "your-component-id" src/components/lumina/service/manifest/gemini-manifest.ts

# 6. Check if in API route (for math primitives with dedicated services)
grep "your-component-id\|YourComponentName" src/app/api/lumina/route.ts
```

All six checks should return results. If any check fails, that step is missing!

**Note:** Check #6 is only required if your primitive has a dedicated generation service file (like math primitives). Some primitives generate content inline in geminiService.ts and don't need an API route.

## Common Pitfalls & How to Avoid Them

### ❌ Pitfall 1: "Unknown component type: your-component-id"
**Symptom:** Error appears in console logs during exhibit generation
**Cause:** Missing case in `generateComponentContent` switch statement
**Fix:** Add case handler in geminiService.ts around line 2600-2700
**Prevention:** Always use grep to verify: `grep "case 'your-component-id':" src/components/lumina/service/geminiService.ts`

### ❌ Pitfall 2: Component generates but doesn't render
**Symptom:** No errors, but component doesn't appear in exhibit
**Cause:** Missing assembly case in `assembleExhibitFromComponents`
**Fix:** Add case to BOTH assembly loops (lines ~5200-5400 and ~5500-5700)
**Prevention:** Search for your component-id in geminiService.ts - should appear in at least 3 locations

### ❌ Pitfall 3: Component renders but has no section header
**Symptom:** Component appears but without title/divider
**Cause:** Missing or incomplete registry configuration
**Fix:** Verify `sectionTitle` and `showDivider` are set in primitiveRegistry.tsx
**Prevention:** Copy configuration from a similar component type

### ❌ Pitfall 4: AI never selects your component
**Symptom:** Manifest generation succeeds but your component never appears
**Cause:** Not added to manifest catalog in gemini-manifest.ts
**Fix:** Add to UNIVERSAL_CATALOG array and subject category lists
**Prevention:** This is the MOST commonly missed step - always check grep output for manifest file

### ❌ Pitfall 5: TypeScript errors about missing properties
**Symptom:** Build fails with type errors
**Cause:** ComponentId type or ExhibitData interface not updated
**Fix:** Add to ComponentId union type and ExhibitData interface in types.ts
**Prevention:** Run TypeScript check: `npm run type-check` or check IDE errors

### ❌ Pitfall 6: Math primitive generation fails or is unavailable
**Symptom:** Component is registered but generation function is not accessible or callable
**Cause:** Missing API route handler in `app/api/lumina/route.ts`
**Fix:**
1. Import generation function at top of route.ts file
2. Add case handler in POST switch statement
3. Return result wrapped in NextResponse.json()
**Prevention:** Always check if your primitive has a dedicated service file in `service/math/` - if it does, it MUST have an API route
**Example:**
```tsx
// At top of file (line ~24-37)
import { generateExpressionTree } from '@/components/lumina/service/math/gemini-expression-tree';

// In POST handler switch statement (before default case, line ~330)
case 'generateExpressionTree':
  const expressionTree = await generateExpressionTree(
    params.topic,
    params.gradeLevel,
    params.config
  );
  return NextResponse.json(expressionTree);
```

## Post-Integration Verification Checklist

After completing all integration steps, perform this final verification:

- [ ] **File Check:** Verify you modified exactly 6-7 files:
  1. `primitives/visual-primitives/math/YourComponent.tsx` (or already existed)
  2. `types.ts` (added ComponentId and interfaces)
  3. `config/primitiveRegistry.tsx` (imported and registered)
  4. `service/geminiService.ts` (import, switch case, wrapper function, 2x assembly cases)
  5. `App.tsx` (added PrimitiveCollectionRenderer)
  6. `service/manifest/gemini-manifest.ts` (added to catalog) - **CRITICAL, often missed!**
  7. `app/api/lumina/route.ts` (import and API handler) - **CRITICAL for math primitives!**

- [ ] **Console Test:** Run exhibit generation and check for these success indicators:
  - ✅ No "Unknown component type" errors
  - ✅ Component appears in manifest layout array (visible in console logs)
  - ✅ Component data is generated successfully
  - ✅ Component renders visually in browser

- [ ] **Grep Verification:** All 6 verification commands return results (see above)

- [ ] **Visual Test:** Component appears in a real exhibit with proper styling

If any check fails, revisit the relevant section in the checklist above.

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
