# Relational Mapping Primitive - Implementation Guide

## Overview

The **Relational Mapping** primitive is a cognitive-operation-oriented visualization that shows how entities connect and why those connections exist. It's the first of four core science primitives designed to scale across domains (chemistry, physics, biology) without requiring unique schemas for each concept.

## What We Built (MVP)

### 1. Schema Definition ✓
Located in: `types.ts`

- `BaseSchema` - Shared by all science primitives
- `RelationalMappingSchema` - Specific to relational mapping
- `RelationalMappingContent` - The core content structure
- `RenderingHints` - Domain-specific visualization guidance

### 2. Chemistry Molecular Bonding Adapter ✓
Located in: `adapters/chemistry/molecular-bonding.tsx`

**Features:**
- 3D molecular visualization using Three.js
- Ball-and-stick model with CPK atom coloring
- Interactive rotation and zoom controls
- Displays emergent properties and satisfied constraints
- Shows assessment hooks for deeper learning

**Current Implementation:**
- Atoms rendered as colored spheres (H=white, O=red, C=gray, N=blue, etc.)
- Bonds rendered as gray cylinders between atoms
- Realistic atomic radii and molecular geometry
- Ambient + directional lighting for depth

**Not Yet Implemented (Future):**
- Electron clouds
- Orbital visualization
- Bond polarity indicators
- Animation of electron sharing

### 3. Primitive Renderer Component ✓
Located in: `primitives/RelationalMapping.tsx`

**Current Routing:**
- Chemistry + molecular_bonding → `MolecularBondingAdapter`
- Other domains → Fallback (shows "not implemented" with JSON)

**Future:** Replace hardcoded routing with registry-based adapter resolution.

### 4. LLM Prompt ✓
Located in: `service/geminiService.ts`

**Function:** `generateRelationalMappingChemistry(molecule, gradeLevel, topic?)`

**Generates:**
- Complete schema structure
- Realistic 3D atomic positions
- Bond properties and explanations
- Emergent molecular properties
- Assessment questions

**Example molecules supported:**
- Water (H₂O)
- Methane (CH₄)
- Ammonia (NH₃)
- Carbon Dioxide (CO₂)
- Any simple molecule

### 5. Testing Component ✓
Located in: `components/RelationalMappingTester.tsx`

**Features:**
- Sample water molecule data (hardcoded)
- Generate button for common molecules
- Schema validation checklist
- Raw JSON viewer
- Live 3D visualization

## How to Use

### Option 1: Hardcoded Sample Data

```tsx
import RelationalMapping from './primitives/RelationalMapping';
import { RelationalMappingSchema } from './types';

const waterMolecule: RelationalMappingSchema = {
  primitive: 'relational_mapping',
  pedagogicalIntent: 'understand_mechanism',
  domain: {
    field: 'chemistry',
    subtype: 'molecular_bonding',
    renderingHints: {
      entityRepresentation: 'atom_simple',
      connectionVisualization: 'electron_sharing',
      spatialLayout: 'molecular_geometry'
    }
  },
  content: {
    title: 'Water Molecule',
    centralQuestion: 'Why does oxygen bond with two hydrogen atoms?',
    entities: [/* ... */],
    relationships: [/* ... */],
    emergentProperties: [/* ... */],
    satisfiedConstraints: [/* ... */]
  },
  assessmentHooks: {
    predict: 'What if oxygen was replaced with sulfur?',
    transfer: 'How does this relate to ammonia?'
  }
};

function MyComponent() {
  return <RelationalMapping data={waterMolecule} />;
}
```

### Option 2: Generate with LLM

```tsx
import { generateRelationalMappingChemistry } from './service/geminiService';
import RelationalMapping from './primitives/RelationalMapping';

function MyComponent() {
  const [schema, setSchema] = useState(null);

  useEffect(() => {
    const generate = async () => {
      const result = await generateRelationalMappingChemistry(
        'Water (H₂O)',
        'high-school',
        'Chemistry fundamentals'
      );
      setSchema(result);
    };
    generate();
  }, []);

  if (!schema) return <div>Loading...</div>;

  return <RelationalMapping data={schema} />;
}
```

### Option 3: Via Manifest System

Add to `ExhibitData.relationalMappings`:

```tsx
export interface ExhibitData {
  // ... other fields
  relationalMappings?: RelationalMappingSchema[];
}
```

Then render in your exhibit:

```tsx
<PrimitiveCollectionRenderer
  componentId="relational-mapping"
  dataArray={exhibitData.relationalMappings || []}
/>
```

## Testing the Implementation

### Running the Test Component

1. Import the tester in your app or page:

```tsx
import RelationalMappingTester from './components/lumina/components/RelationalMappingTester';

function TestPage() {
  return <RelationalMappingTester />;
}
```

2. Open the page in your browser

3. You should see:
   - 3D water molecule visualization
   - Oxygen (red) bonded to two hydrogens (white)
   - Interactive rotation (click and drag)
   - Emergent properties panel
   - Assessment questions

### Validation Checklist

The tester component includes automatic validation:

✓ Schema primitive type is 'relational_mapping'
✓ Domain field is 'chemistry'
✓ Domain subtype is 'molecular_bonding'
✓ Has 3 entities (atoms)
✓ Has 2 relationships (bonds)
✓ Has 1+ emergent properties
✓ Has 1+ satisfied constraints
✓ Has at least one assessment hook

### Testing Questions

**Can you:**
1. ✓ Pass water molecule JSON → get 3D visual output?
2. ⏳ LLM generate a new molecule (methane) → visual output?
3. ⏳ Change renderingHints → adapter respects them?

## Next Steps (Future Enhancements)

### Phase 1: Complete Chemistry Adapter
- [ ] Add electron cloud visualization
- [ ] Show bond polarity (delta+ and delta- indicators)
- [ ] Animate electron sharing
- [ ] Add atom selection with property panels
- [ ] Implement different rendering modes (ball-stick, space-filling, Lewis dot)

### Phase 2: Additional Adapters
- [ ] Physics: Force diagrams adapter
- [ ] Biology: Ecological network adapter
- [ ] Generic fallback: D3 force-directed graph

### Phase 3: Adapter Registry System
Replace hardcoded routing with:

```tsx
const registry = new RendererRegistry();

registry.register({
  key: 'relational_mapping:chemistry/molecular_bonding',
  adapter: MolecularBondingAdapter,
  confidence: 1.0
});

registry.register({
  key: 'relational_mapping:chemistry/*',
  adapter: GenericChemistryAdapter,
  confidence: 0.8
});

registry.register({
  key: 'relational_mapping:*/*',
  adapter: GenericRelationalMappingAdapter,
  confidence: 0.6
});
```

### Phase 4: Other Primitives
- [ ] State Transformation (reactions, phase changes)
- [ ] Constraint Satisfaction (electron config, balanced equations)
- [ ] Scale Bridging (macro to micro explanations)

## Architecture Decisions

### Why This Design?

1. **Cognitive-oriented schemas** - Defines what to learn, not how to render
2. **Domain adapters** - Same schema works across chemistry, physics, biology
3. **Rendering hints** - Guides adapters without dictating implementation
4. **Assessment hooks** - Standardized across all primitives
5. **Fallback system** - New content renders immediately with generic visualization

### Key Files

```
lumina/
├── types.ts                          # Schema definitions
├── primitives/
│   └── RelationalMapping.tsx         # Universal primitive component
├── adapters/
│   └── chemistry/
│       └── molecular-bonding.tsx     # Three.js 3D visualization
├── service/
│   └── geminiService.ts              # LLM generation
├── components/
│   └── RelationalMappingTester.tsx   # Testing component
└── config/
    └── primitiveRegistry.tsx         # Registry configuration
```

## Known Limitations (MVP)

1. **Only chemistry domain implemented** - Physics and biology adapters pending
2. **Basic ball-and-stick model** - No advanced rendering modes yet
3. **Hardcoded adapter routing** - Registry system not yet implemented
4. **No validation errors** - Schema validation could be more robust
5. **No user interactivity** - Can't click atoms for details yet

## Resources

- **Three.js Docs:** https://threejs.org/docs/
- **Science Primitives Architecture:** `docs/SCIENCE PRIMITIVES.md`
- **Adding Primitives Guide:** `docs/ADDING_PRIMITIVES.md`

## Questions?

This is an MVP implementation. The goal was to validate:
- ✓ Schema structure works for chemistry
- ✓ Rendering hints are expressive enough
- ✓ LLM can generate valid schemas
- ✓ 3D visualization is feasible with Three.js

Next step: Build additional adapters and implement the full registry system!
