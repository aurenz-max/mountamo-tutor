# Lumina Primitives Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         App.tsx                              │
│  (Orchestrates the exhibit, minimal primitive logic)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Uses
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              PrimitiveCollectionRenderer                     │
│  (Universal renderer for collections of primitives)         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Looks up config
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  primitiveRegistry                           │
│  (Central configuration: styling, headers, components)      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Maps to
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Primitive Components                            │
│  GraphBoard, GenerativeTable, MathVisuals, etc.             │
│  (Self-contained, stateful UI components)                   │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

```
ExhibitData (from AI)
       │
       │ Contains arrays like:
       │ - graphBoards: GraphBoardData[]
       │ - tables: TableData[]
       │ - specializedExhibits: SpecializedExhibit[]
       │
       ▼
PrimitiveCollectionRenderer
       │
       │ For each item in dataArray:
       ▼
Registry Lookup
       │
       │ Finds: { component, sectionTitle, containerClassName, ... }
       ▼
Render Section
       │
       ├─► Section Header (if configured)
       │   └─► "Interactive Graph ────────────"
       │
       └─► Component Instances
           ├─► <GraphBoard data={item1} />
           ├─► <GraphBoard data={item2} />
           └─► <GraphBoard data={item3} />
```

## Component Responsibility Model

### 🎯 Primitive Components (Bottom Layer)
**Responsibility:** Render a single concept with internal state management

**Example:** `GraphBoard`
- ✅ Manages point collection state
- ✅ Handles user interactions (clicks, hover)
- ✅ Computes polynomial equations
- ✅ Renders visualization
- ❌ Doesn't know about headers/sections
- ❌ Doesn't know about other primitives

```tsx
<GraphBoard data={{ title: "...", initialPoints: [...] }} />
```

### 🔧 Registry (Configuration Layer)
**Responsibility:** Define how primitives are presented

**Example Configuration:**
```tsx
'graph-board': {
  component: GraphBoard,           // What to render
  sectionTitle: 'Interactive Graph', // Section header
  showDivider: true,                // Show divider line
  dividerStyle: 'left',             // Header style
  containerClassName: 'max-w-5xl mx-auto mb-20', // Wrapper styles
  allowMultiple: true,              // Can have multiple instances
}
```

### 🎨 PrimitiveCollectionRenderer (Rendering Layer)
**Responsibility:** Render primitives using registry configuration

**What it does:**
1. Looks up configuration from registry
2. Renders section header (if configured)
3. Applies container styling
4. Maps over data array
5. Renders each primitive instance

```tsx
<PrimitiveCollectionRenderer
  componentId="graph-board"
  dataArray={[...graphBoardData]}
/>
```

### 🎭 App.tsx (Orchestration Layer)
**Responsibility:** Compose the overall exhibit experience

**What it does:**
- ✅ Manages global state (exhibit data, walk-through, drawers)
- ✅ Handles user interactions that cross primitives
- ✅ Orchestrates which primitives to show
- ❌ Doesn't implement primitive-specific rendering logic
- ❌ Doesn't duplicate headers/styling

## Pattern Comparison

### Old Pattern (Non-Scalable)

```tsx
// App.tsx - Every primitive needs this boilerplate
{exhibitData.X && exhibitData.X.length > 0 && (
  <div className="max-w-5xl mx-auto mb-20">
    <div className="flex items-center gap-4 mb-8">
      <span className="...">Section Title</span>
      <div className="h-px flex-1 ..."></div>
    </div>
    {exhibitData.X.map((item, idx) => (
      <ComponentX key={idx} data={item} />
    ))}
  </div>
)}
```

**Problems:**
- 🔴 10-15 lines per primitive type
- 🔴 Duplicated header/divider code
- 🔴 Inconsistent styling
- 🔴 Hard to maintain
- 🔴 App.tsx grows with every new primitive

### New Pattern (Scalable)

```tsx
// App.tsx - One line per primitive type
<PrimitiveCollectionRenderer
  componentId="component-x"
  dataArray={exhibitData.X || []}
/>
```

**Benefits:**
- 🟢 1-4 lines per primitive type
- 🟢 No duplication
- 🟢 Consistent rendering
- 🟢 Easy to maintain
- 🟢 App.tsx size stays constant

## Registry Pattern Benefits

### 1. Separation of Concerns
```
Primitive Component → Knows HOW to render itself
Registry Config     → Knows WHERE and HOW to present it
Renderer            → Knows HOW to apply the config
App.tsx             → Knows WHAT to show
```

### 2. Single Source of Truth
All presentation configuration in one place:
- Section titles
- Divider styles
- Container classes
- Multi-instance support

### 3. Open/Closed Principle
- **Open for extension:** Add new primitives by registering them
- **Closed for modification:** Don't modify App.tsx for each new primitive

### 4. Reduced Cognitive Load
Developers only need to:
1. Build the primitive
2. Add config to registry
3. Use in App.tsx

No need to remember header HTML, divider patterns, or container classes.

## Real-World Example

### Adding a "Timeline" Primitive

#### Step 1: Create Component
```tsx
// primitives/Timeline.tsx
const Timeline: React.FC<{ data: TimelineData }> = ({ data }) => {
  return (
    <div className="relative">
      {data.events.map(event => (
        <div key={event.id} className="timeline-event">
          {event.year}: {event.description}
        </div>
      ))}
    </div>
  );
};
```

#### Step 2: Register
```tsx
// config/primitiveRegistry.tsx
'timeline': {
  component: Timeline,
  sectionTitle: 'Historical Timeline',
  showDivider: true,
  dividerStyle: 'left',
  containerClassName: 'max-w-4xl mx-auto mb-20',
  allowMultiple: true,
}
```

#### Step 3: Use
```tsx
// App.tsx
<PrimitiveCollectionRenderer
  componentId="timeline"
  dataArray={exhibitData.timelines || []}
/>
```

**That's it!** The renderer handles:
- ✅ Section header: "Historical Timeline ──────────"
- ✅ Container div with max-width and margins
- ✅ Mapping over timeline array
- ✅ Rendering each timeline instance

## File Structure

```
lumina/
├── App.tsx                          # Orchestration layer
├── types.ts                         # TypeScript definitions
├── config/
│   └── primitiveRegistry.tsx        # Registry configuration
├── components/
│   ├── PrimitiveRenderer.tsx        # Universal renderers
│   └── ...                          # Other shared components
├── primitives/
│   ├── GraphBoard.tsx              # Primitive: Interactive graphs
│   ├── GenerativeTable.tsx         # Primitive: Data tables
│   ├── MathVisuals.tsx             # Primitive: Math visualizations
│   └── ...                         # Other primitives
└── service/
    └── geminiService.ts            # AI generation
```

## Design Principles

### 1. Primitives are Self-Contained
Each primitive manages its own:
- State
- User interactions
- Rendering logic
- Internal computations

### 2. Configuration is Declarative
Registry describes **what** should happen, not **how**:
```tsx
{
  sectionTitle: 'Interactive Graph',  // What to show
  showDivider: true,                  // Show it
  dividerStyle: 'left',               // How to style it
}
```

### 3. Composition over Inheritance
Rather than creating base classes, we compose:
- Primitive components
- Renderer logic
- Configuration objects

### 4. Convention over Configuration
Sensible defaults:
- `showDivider: false` by default
- `dividerStyle: 'left'` by default
- Empty `additionalProps` by default

## When to Use vs. Not Use

### ✅ Use Registry Pattern For:
- Primitives that appear in collections
- Primitives with standard section headers
- Primitives that share layout patterns
- Components that might be reused across exhibits

### ❌ Don't Use Registry Pattern For:
- One-off custom layouts (like CuratorBrief)
- Modal/drawer components (not in main flow)
- Components with highly specific interactions
- Wrapper/background components

## Performance Considerations

### Efficient Rendering
```tsx
// ✅ Only renders when data exists
<PrimitiveCollectionRenderer
  dataArray={exhibitData.graphs || []}  // Empty array = no render
/>

// The renderer checks:
if (!dataArray || dataArray.length === 0) {
  return null;  // No unnecessary divs
}
```

### React Keys
```tsx
// ✅ Proper key management
<PrimitiveCollectionRenderer
  componentId="graph"
  dataArray={data}
  keyExtractor={(item, idx) => item.id || `graph-${idx}`}
/>
```

## Summary

The Registry Pattern transforms Lumina's primitive system from:

**Imperative** → **Declarative**
**Coupled** → **Modular**
**Repetitive** → **DRY**
**Rigid** → **Extensible**

This makes adding new primitives fast, consistent, and maintainable.
