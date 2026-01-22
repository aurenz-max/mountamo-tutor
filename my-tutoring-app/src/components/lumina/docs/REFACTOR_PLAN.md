# Lumina Architecture Refactoring Plan

## 1. The Problem: "Context Debt" & The Monolith

**Why did we reach this conclusion?**
Currently, adding a single primitive requires an AI (or developer) to load and reason about three massive files:
1.  `geminiService.ts` (~5,753 lines) - Contains **50 cases** in `generateComponentContent` + **50 cases** in `assembleExhibitFromComponents`
2.  `gemini-manifest.ts` (~782 lines) - Contains **49 component definitions** in UNIVERSAL_CATALOG
3.  `route.ts` (~452 lines) - Contains **51 cases** in the API dispatcher

**Total Context Cost:** ~7,000 lines and **~151 switch cases** just to wire up *one* new component. This "Context Debt" makes AI assistance slower, more expensive, and more prone to hallucination as the file grows.

**The Solution:** Decouple the "Wiring" from the "Logic". By moving the wiring into small, modular registries, we reduce the context needed to add a primitive by **~99%**.

**Proven Pattern:** `primitiveRegistry.tsx` (581 lines) already demonstrates this pattern works for UI rendering. `ManifestOrderRenderer` in `App.tsx` uses it successfully, dramatically simplifying the render logic.

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
    *   **⚠️ VERIFY FIRST:** Run dead code analysis before deletion (see Phase 1).
2.  **❌ The API Route Switch:** In `route.ts`, adding `case 'generateMyPrimitive':`.
    *   **Why it's un-needed:** The existing `generateComponentContent` endpoint acts as a universal router.
3.  **❌ The Generation Switch:** In `geminiService.ts`, the massive `switch (item.componentId)` block.
    *   **Why it's un-needed:** Can be replaced by a dynamic registry lookup.

---

## 3. Implementation Plan

### Phase 0: Verification & Safety Net (Prerequisites)

**Goal:** Validate assumptions and create safety mechanisms before any changes.

**0.1 Dead Code Analysis**
Verify that `exhibit.barModels`, `exhibit.numberLines`, etc. are truly unused:
```bash
# Run from project root - check for any reads of legacy arrays
grep -r "exhibit\.barModels" --include="*.ts" --include="*.tsx" src/
grep -r "exhibit\.numberLines" --include="*.ts" --include="*.tsx" src/
grep -r "exhibit\.fractionBars" --include="*.ts" --include="*.tsx" src/
# ... repeat for all legacy array properties
```

**Expected Result:** Only writes in `assembleExhibitFromComponents`, no reads elsewhere.

**If reads exist:** Document them. These consumers must migrate to `orderedComponents` first.

**0.2 Snapshot Tests**
Create baseline tests before migration:
```typescript
// __tests__/generators/snapshot.test.ts
describe('Content Generator Snapshots', () => {
  const testCases = ['bar-model', 'number-line', 'fraction-bar', /* ... */];

  testCases.forEach(componentId => {
    it(`generates consistent output for ${componentId}`, async () => {
      const result = await generateComponentContent(
        { componentId, instanceId: 'test-1', config: {} },
        'fractions',
        'Grade 3'
      );
      expect(result).toMatchSnapshot();
    });
  });
});
```

**0.3 Feature Flag Setup**
Add a flag to switch between old/new paths during migration:
```typescript
// config/featureFlags.ts
export const USE_CONTENT_REGISTRY = process.env.USE_CONTENT_REGISTRY === 'true';
```

---

### Phase 1: The Service Registry (High Impact)

**Goal:** Decouple content generation logic from the main service file using an incremental approach.

**1.1 Create the Registry with Strong Types**
`src/components/lumina/service/registry/contentRegistry.ts`
```typescript
import { ComponentId } from '../../types';

/** Manifest item passed to generators */
export interface ManifestItem<TConfig = Record<string, unknown>> {
  componentId: ComponentId;
  instanceId: string;
  title?: string;
  intent?: string;
  config?: TConfig;
}

/** Standard output from all content generators */
export interface GeneratedComponent<TData = unknown> {
  type: ComponentId;
  instanceId: string;
  data: TData;
}

/** Content generator function signature */
export type ContentGenerator<TConfig = any, TData = any> = (
  item: ManifestItem<TConfig>,
  topic: string,
  gradeContext: string
) => Promise<GeneratedComponent<TData>>;

/** Registry of all content generators */
export const CONTENT_GENERATORS: Partial<Record<ComponentId, ContentGenerator>> = {};

/** Register a generator (typically called at module load via side-effect import) */
export function registerGenerator<TConfig, TData>(
  id: ComponentId,
  generator: ContentGenerator<TConfig, TData>
): void {
  if (CONTENT_GENERATORS[id]) {
    console.warn(`Generator for ${id} already registered. Overwriting.`);
  }
  CONTENT_GENERATORS[id] = generator;
}

/** Lookup a generator */
export function getGenerator(id: ComponentId): ContentGenerator | undefined {
  return CONTENT_GENERATORS[id];
}
```

**1.2 Refactor `geminiService.ts` with Fallback (Incremental Migration)**
Keep the old switch as fallback during migration:

```typescript
import { CONTENT_GENERATORS, getGenerator } from './registry/contentRegistry';
import { USE_CONTENT_REGISTRY } from '../../config/featureFlags';

// Import registration files (side-effects) - add as you migrate
import './registry/generators/mathGenerators';
// import './registry/generators/engineeringGenerators';
// import './registry/generators/literacyGenerators';

export const generateComponentContent = async (
  item: ManifestItem,
  topic: string,
  grade: string
): Promise<GeneratedComponent | null> => {
  // Try registry first (new path)
  if (USE_CONTENT_REGISTRY) {
    const generator = getGenerator(item.componentId);
    if (generator) {
      return await generator(item, topic, grade);
    }
  }

  // Fallback to existing switch (old path) - remove after full migration
  switch (item.componentId) {
    case 'bar-model':
      return await generateBarModelContent(item, topic, grade);
    // ... existing cases
    default:
      console.warn(`Unknown component type: ${item.componentId}`);
      return null;
  }
};
```

**1.3 Create Self-Registering Generator Modules**
`src/components/lumina/service/registry/generators/mathGenerators.ts`
```typescript
import { registerGenerator } from '../contentRegistry';
import { generateBarModel } from '../../math/gemini-bar-model';
import { generateNumberLine } from '../../math/gemini-number-line';
// ... other imports

// Self-register on import
registerGenerator('bar-model', async (item, topic, gradeContext) => ({
  type: 'bar-model',
  instanceId: item.instanceId,
  data: await generateBarModel(topic, gradeContext, item.config),
}));

registerGenerator('number-line', async (item, topic, gradeContext) => ({
  type: 'number-line',
  instanceId: item.instanceId,
  data: await generateNumberLine(topic, gradeContext, item.config),
}));

// ... register others
```

**1.4 Migration Checklist**
Track migration of each generator:
- [ ] bar-model
- [ ] number-line
- [ ] fraction-bar
- [ ] fraction-circles
- [ ] base-ten-blocks
- [ ] ... (all 50 components)

**Validation:** After each migration, run snapshot tests to confirm output unchanged.

---

### Phase 2: Assembly Loop Cleanup

**Goal:** Remove the redundant `assembleExhibitFromComponents` switch after verifying dead code.

**2.1 Confirm Dead Code (from Phase 0)**
Only proceed if Phase 0.1 confirmed no reads of legacy arrays.

**2.2 Simplify Assembly**
Replace the switch-based assembly with direct push to `orderedComponents`:

```typescript
// Before (50-case switch)
case 'bar-model':
  if (!exhibit.barModels) exhibit.barModels = [];
  exhibit.barModels.push(dataWithInstanceId);
  break;

// After (universal)
exhibit.orderedComponents.push({
  type: component.type,
  instanceId: component.instanceId,
  data: component.data,
});
```

**2.3 Deprecate Legacy Array Types**
Mark legacy arrays as deprecated in `types.ts`:
```typescript
export interface ExhibitData {
  // ... active fields
  orderedComponents: OrderedComponent[];

  /** @deprecated Use orderedComponents instead */
  barModels?: BarModelData[];
  /** @deprecated Use orderedComponents instead */
  numberLines?: NumberLineData[];
  // ...
}
```

---

### Phase 3: Catalog Modules (Context Reduction)

**Goal:** Split the manifest catalog so AI agents don't need to read the entire list.

**3.1 Split the Catalog by Domain**
```
service/manifest/catalog/
├── index.ts           # Aggregates all catalogs
├── math.ts            # 15 components
├── engineering.ts     # 5 components
├── literacy.ts        # 8 components
├── science.ts         # 6 components
├── assessment.ts      # 4 components
└── media.ts           # 5 components
```

Example: `src/components/lumina/service/manifest/catalog/math.ts`
```typescript
import { ComponentDefinition } from '../types';

export const MATH_CATALOG: ComponentDefinition[] = [
  {
    id: 'bar-model',
    description: 'Interactive rectangular bar for part-whole relationships...',
    constraints: 'Best for grades 2-5. Requires numeric values.',
  },
  {
    id: 'number-line',
    description: 'Linear number representation with draggable markers...',
    constraints: 'Supports integers, fractions, decimals.',
  },
  // ... other math components
];
```

**3.2 Aggregate in Main Manifest**
`src/components/lumina/service/manifest/catalog/index.ts`
```typescript
import { MATH_CATALOG } from './math';
import { ENGINEERING_CATALOG } from './engineering';
import { LITERACY_CATALOG } from './literacy';
// ...

export const UNIVERSAL_CATALOG = [
  ...MATH_CATALOG,
  ...ENGINEERING_CATALOG,
  ...LITERACY_CATALOG,
  // ...
];

// For targeted lookups
export const CATALOGS_BY_DOMAIN = {
  math: MATH_CATALOG,
  engineering: ENGINEERING_CATALOG,
  literacy: LITERACY_CATALOG,
  // ...
};
```

**3.3 Update gemini-manifest.ts**
```typescript
import { UNIVERSAL_CATALOG } from './catalog';
// Remove inline catalog definition
```

---

### Phase 4: API Route Optimization

**Goal:** Stop editing `route.ts` for new primitives.

**4.1 Use Universal Endpoint**
The existing `generateComponentContent` action already routes to all generators:

```typescript
// Frontend call - works for ANY component
const response = await fetch('/api/lumina', {
  method: 'POST',
  body: JSON.stringify({
    action: 'generateComponentContent',
    params: {
      item: { componentId: 'fraction-bar', instanceId: 'fb-1', config: { ... } },
      topic: 'fractions',
      gradeLevel: 'Grade 3',
    },
  }),
});
```

**4.2 Freeze Route.ts**
After migration, `route.ts` should only contain:
- `generateComponentContent` (universal generator endpoint)
- `generateExhibitManifest` (manifest generation)
- `buildCompleteExhibit` (orchestration)
- Utility endpoints (hints, assessments, etc.)

**New primitives never touch this file.**

---

### Phase 5: Testing & Validation

**Goal:** Ensure migration doesn't break existing functionality.

**5.1 Test Matrix**
| Test Type | What It Validates | When to Run |
|-----------|-------------------|-------------|
| Snapshot tests | Generator output unchanged | After each migration |
| Integration tests | End-to-end exhibit generation | Before/after each phase |
| Visual regression | UI renders correctly | After Phase 2 |
| Performance tests | No latency regression | After Phase 1 complete |

**5.2 Validation Commands**
```bash
# Run all generator snapshots
npm test -- --testPathPattern=generators/snapshot

# Run integration tests
npm test -- --testPathPattern=integration

# Visual regression (if using Playwright/Chromatic)
npm run test:visual
```

**5.3 Rollback Plan**
If issues arise:
1. Set `USE_CONTENT_REGISTRY=false` to disable new path
2. Old switch statements remain functional during migration
3. Revert specific generator registrations as needed

---

### Phase 6: Workflow Update & Documentation

**Goal:** Simplify the developer experience for adding new primitives.

**6.1 New ADDING_PRIMITIVES.md**

```markdown
# Adding New Primitives (Post-Refactor)

## Quick Start: 4 Files, Zero Switch Statements

1. **Create Component:** `primitives/MyPrimitive.tsx`
2. **Create Generator:** `service/registry/generators/[domain]Generators.ts` (add to existing file)
3. **Register UI:** `config/primitiveRegistry.tsx`
4. **Add to Catalog:** `service/manifest/catalog/[domain].ts`

**That's it.** No changes to `geminiService.ts` or `route.ts`.

## Verification
\`\`\`bash
# Confirm registration (should return your component)
grep "my-primitive" src/components/lumina/service/registry/generators/*.ts
grep "my-primitive" src/components/lumina/config/primitiveRegistry.tsx
grep "my-primitive" src/components/lumina/service/manifest/catalog/*.ts
\`\`\`
```

**6.2 Archive Old Documentation**
Move current `ADDING_PRIMITIVES.md` to `docs/archive/ADDING_PRIMITIVES_LEGACY.md` for reference.

---

### Phase 7: Cleanup (Final)

**Goal:** Remove all legacy code after successful migration.

**7.1 Remove Feature Flag**
Delete `USE_CONTENT_REGISTRY` flag and fallback switch.

**7.2 Remove Legacy Arrays from Types**
Remove deprecated fields from `ExhibitData` interface.

**7.3 Remove Dead Switch Statements**
Delete the `switch` statements in:
- `generateComponentContent` (replaced by registry lookup)
- `assembleExhibitFromComponents` (replaced by universal push)

**7.4 Remove Unused Route Cases**
Delete individual `case 'generateBarModel':` etc. from `route.ts`.

**Estimated Reduction:** ~2,000+ lines of boilerplate removed.

---

## 4. Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing generators | Medium | High | Snapshot tests + feature flag fallback |
| Legacy array consumers exist | Low | High | Dead code analysis in Phase 0 |
| Type safety regression | Medium | Medium | Strong typing in contentRegistry.ts |
| Performance degradation | Low | Medium | Registry lookup is O(1), same as switch |
| Team confusion during migration | Medium | Low | Clear migration checklist + feature flag |

---

## 5. Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Lines to add a primitive | ~150 (across 6 files) | ~30 (across 4 files) | 80% reduction |
| Files to modify | 6 | 4 | No geminiService.ts or route.ts |
| Context for AI assistance | ~7,000 lines | ~100 lines | 99% reduction |
| Switch cases in geminiService.ts | 100 | 0 | Complete elimination |
| Time to add primitive | ~30 min | ~10 min | 66% faster |

---

## 6. Implementation Timeline

| Phase | Scope | Estimated Effort | Dependencies |
|-------|-------|------------------|--------------|
| Phase 0 | Verification & Safety | 1 day | None |
| Phase 1 | Content Registry | 3-5 days | Phase 0 |
| Phase 2 | Assembly Cleanup | 1 day | Phase 0.1 verification |
| Phase 3 | Catalog Split | 1 day | None (can parallel) |
| Phase 4 | Route Optimization | 0.5 days | Phase 1 |
| Phase 5 | Testing | Ongoing | All phases |
| Phase 6 | Documentation | 0.5 days | Phases 1-4 |
| Phase 7 | Cleanup | 1 day | All phases complete |

**Total:** ~8-10 days of focused work, can be spread across sprints.

---

## 7. Current Status & Next Steps (January 2026)

### ✅ Completed
- **Phase 0**: Feature flags implemented (`USE_CONTENT_REGISTRY = true`)
- **Phase 1**: Content Registry fully operational with **52 generators** registered
  - `coreGenerators.ts`: 21 generators (curator-brief, concept-cards, knowledge-check, etc.)
  - `mathGenerators.ts`: 23 generators (all math primitives)
  - `engineeringGenerators.ts`: 4 generators (lever-lab, pulley, ramp, wheel-axle)
  - `mediaGenerators.ts`: 3 generators (media-player, flashcard-deck, image-comparison)
  - `foundationGenerators.ts`: 1 generator (foundation-explorer)
- **Dead Code Analysis**: Confirmed legacy arrays (`exhibit.barModels`, etc.) are NEVER read

### 🔲 Next Steps: geminiService.ts Cleanup

**Goal:** Reduce geminiService.ts from ~4,100 lines to ~700-950 lines (~75-80% reduction)

#### Step 1: Remove Legacy Fallback Switch (Lines 1003-1159)
Delete the entire `switch (item.componentId)` block in `generateComponentContent()`.
Since `USE_CONTENT_REGISTRY = true`, this code is never executed.

**After cleanup, `generateComponentContent` should be ~25 lines:**
```typescript
export const generateComponentContent = async (
  item: any,
  topic: string,
  gradeLevel: string
): Promise<any> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);
  const generator = getGenerator(item.componentId);
  if (generator) {
    return await generator(item, topic, gradeLevelContext);
  }
  console.warn(`Unknown component type: ${item.componentId}`);
  return null;
};
```

#### Step 2: Remove Inline Generator Functions (~2,500 lines)
Delete ALL `generate*Content` functions (they exist in dedicated service files now):

| Lines (approx) | Functions to Remove |
|----------------|---------------------|
| 1166-2027 | `generateCuratorBriefContent`, `generateConceptCardsContent`, `generateMathVisualContent`, `generateCustomVisualContent`, `generateComparisonContent`, `generateTableContent`, `generateFeatureExhibitContent`, `generateKnowledgeCheckContent`, `generateFormulaCardContent`, `generateSentenceAnalyzerContent` |
| 2033-2395 | `generateGraphBoardContent`, `generateScaleSpectrumContent`, `generateAnnotatedExampleContent`, `generateImagePanelContent` |
| 2400-2911 | `generateTakeHomeActivityContent`, `generateInteractivePassageContent`, `generateWordBuilderContent`, `generateMoleculeViewerContent`, `generatePeriodicTableContent` |
| 2917-2984 | `generateMediaPlayerContent`, `generateFlashcardDeckContent`, `generateImageComparisonContent` |
| 2989-3700+ | All math generators: `generateBarModelContent`, `generateNumberLineContent`, `generateBaseTenBlocksContent`, `generateFractionCirclesContent`, `generateFractionBarContent`, `generateGeometricShapeContent`, `generatePlaceValueChartContent`, `generateAreaModelContent`, `generateArrayGridContent`, `generateDoubleNumberLineContent`, `generateTapeDiagramContent`, `generateFactorTreeContent`, `generateRatioTableContent`, `generateBalanceScaleContent`, `generateFunctionMachineContent`, `generateCoordinateGraphContent`, `generateSlopeTriangleContent`, `generateSystemsEquationsContent`, `generateMatrixDisplayContent`, `generateDotPlotContent`, `generateHistogramContent`, `generateTwoWayTableContent` |
| Various | Engineering: `generateLeverLabContent`, `generatePulleySystemBuilderContent`, `generateRampLabContent`, `generateWheelAxleExplorerContent` |
| Various | Foundation: `generateFoundationExplorerContent` |

#### Step 3: Remove Unused Imports (Lines 24-51)
Delete imports for functions that are now only used via registry:
```typescript
// DELETE these imports:
import { generateMediaPlayer } from "./media-player/gemini-media-player";
import { generateFlashcardDeck } from "./flashcard-deck/gemini-flashcard";
import { generateImageComparison } from "./image-comparison/gemini-image-comparison";
import { generatePlaceValueChart } from "./math/gemini-place-value";
// ... all math, engineering, foundation imports
```

#### Step 4: Remove Assembly Switch (Lines 3885-4127)
Delete the entire `switch (component.type)` block in `buildCompleteExhibitFromManifest()`.
The `orderedComponents` array is already populated correctly above the switch.
Legacy arrays (`exhibit.barModels`, etc.) are confirmed dead code.

#### Step 5: Move UNIVERSAL_CATALOG (Lines 809-890)
Move to `service/manifest/catalog/index.ts` and import from there.

### 🔲 Post-Cleanup Tasks

1. **Remove Feature Flag**: Delete `USE_CONTENT_REGISTRY` after confirming cleanup works
2. **Update Types**: Remove deprecated legacy array types from `ExhibitData` interface
3. **Update Documentation**: Update ADDING_PRIMITIVES.md to reflect new workflow
4. **Archive Old Docs**: Move legacy documentation to `docs/archive/`

### What to KEEP in geminiService.ts

After cleanup, retain only:
- Helper functions: `getGradeLevelContext()`, `getObjectiveContext()`
- Standalone generators used by registry: `generateCustomWebExhibit()`, `generateCustomSVGExhibit()`, `generateSentenceExhibit()`, `generateMathVisualExhibit()`, `generateSpecializedExhibits()`
- Core exports: `generateItemDetail()`, `generateConceptImage()`, `generateComponentContent()`, `buildCompleteExhibitFromManifest()`, `generateIntroBriefing()`
- Registry imports and type imports
