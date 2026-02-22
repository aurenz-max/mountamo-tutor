# PRD: Kindergarten Geometry Primitives

**Status:** Draft
**Date:** 2026-02-22
**Scope:** 4 new Lumina primitives targeting K-1 geometry standards

---

## 1. Problem Statement

Our current Lumina primitive library has one geometry primitive — `shape-builder` — which provides a grid-based construction and classification workspace suited to grades 2-5. However, kindergarten geometry requires a fundamentally different approach: visual recognition, hands-on sorting, guided tracing, and playful composition rather than coordinate-grid construction.

The curriculum data shows two full skill clusters (**Identify and describe shapes** with 6 subskills and **Analyze, compare, create, and compose shapes** with 7 subskills) with no purpose-built K-level primitives covering:

- **Shape identification & matching** (no "name the shape" / "find the shape" primitive for K)
- **3D shape recognition** (no 3D shapes at all — cubes, cones, cylinders are absent)
- **Shape drawing & tracing** (no guided drawing / complete-the-shape primitive)
- **Shape composition & decomposition** at K level (shape-builder's compose/decompose is grid-based and too advanced)

The existing `pattern-builder` already covers shape-based repeating patterns (the 7th subskill in Analyze/Compare), and `sorting-station` provides general attribute-based sorting. The 4 new primitives below fill the remaining gaps.

---

## 2. Skill Coverage Map

### What Existing Primitives Already Cover

| Existing Primitive | K Geometry Skills Covered |
|---|---|
| `shape-builder` | Build shapes on grids, discover properties with measurement tools, classify into categories, compose/decompose (grades 2-5 level) |
| `pattern-builder` | Create, extend, and describe repeating patterns using shapes and attributes |
| `sorting-station` | General attribute-based sorting and classification (not geometry-specific) |

### Gaps Requiring New Primitives

| Skill Cluster | Priority | Curriculum Subskills | Proposed Primitive |
|---|---|---|---|
| Match, name, identify 2D shapes; describe with geometric vocabulary; count/compare properties; sort by attributes | **High** | 5 subskills across both clusters (Difficulty 1-5) | `shape-sorter` |
| Recognize 3D shapes; distinguish 2D vs 3D; compare 3D properties | **High** | 2 subskills (Difficulty 4-7) | `3d-shape-explorer` |
| Draw, trace, complete shapes from descriptions and templates | **Medium** | 2 subskills (Difficulty 4-6) | `shape-tracer` |
| Compose larger shapes from basic shapes; decompose shapes; create pictures from shapes | **High** | 2 subskills (Difficulty 5-8) | `shape-composer` |

---

## 3. New Primitives

### 3.1 `shape-sorter`

**Purpose:** Teach shape identification, naming, matching, property counting, and attribute-based classification through interactive visual challenges — the core of K geometry.

**Grade Band:** K-1 (Difficulty 1-5)

**Skills Addressed:**
- Match and name basic 2D shapes (circles, squares, triangles, rectangles) regardless of size, color, or orientation
- Identify and describe shapes in real-world environments using geometric vocabulary (sides, corners) and basic attributes (curved vs. straight sides)
- Count and compare shape properties (number of sides, vertices) and sort shapes into groups based on these characteristics
- Identify and name basic 2D shapes based on their attributes (sides and vertices)
- Sort and classify shapes by single attributes (sides, corners, size) and identify shapes that don't belong
- Recognize and match shapes in different orientations and sizes, including shapes in real-world objects

**Interaction Model:**

Multi-phase challenges with 6 challenge types:

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `identify` | A grid of shapes in various sizes, colors, and orientations. Student taps all shapes matching the named target ("Tap all the triangles"). Correct shapes glow; distractors are similar but different (e.g., diamonds among squares). |
| 2 | `match` | Drag-to-match: shape images on the left, name labels on the right. Student draws connections. Shapes are shown in non-standard orientations (rotated triangles, skinny rectangles). |
| 3 | `count-properties` | A shape is displayed large. Student counts sides by tapping each side (they highlight sequentially), then counts corners/vertices. Answers "How many sides?" and "How many corners?" |
| 4 | `describe` | A shape is shown. Student selects all correct descriptions from options: "Has 4 sides," "Has curved sides," "All sides are the same length," "Has 3 corners." Builds geometric vocabulary. |
| 5 | `sort` | Mixed shapes at the top, 2-4 labeled bins below (e.g., "3 sides" / "4 sides" / "0 sides"). Student drags each shape into the correct bin. Bins can be labeled by name, property, or both. |
| 6 | `real-world` | A scene image (classroom, playground, kitchen) with shapes highlighted/outlined. Student taps each highlighted region and names the shape. "The clock is a ___" → circle. "The window is a ___" → rectangle. |

**Visual Design:**
- Colorful 2D shapes rendered as filled polygons with distinct colors (not just outlines)
- Shapes appear in varied sizes (small/medium/large), colors, and rotations to teach orientation invariance
- Side-highlighting animation: each side lights up sequentially as student taps/counts
- Corner/vertex markers: small dots appear at vertices when counting corners
- Real-world scenes: simple illustrated environments with shape regions glowing on hover
- Sorting bins with satisfying "drop" animation and counter badges
- Glass card Lumina theming

**Data Shape (key fields):**
```typescript
interface ShapeSorterData {
  challenges: Array<{
    type: 'identify' | 'match' | 'count-properties' | 'describe' | 'sort' | 'real-world';
    instruction: string;
    // identify
    targetShape?: string;           // 'triangle', 'circle', etc.
    shapes?: Array<{ shape: string; color: string; size: 'small' | 'medium' | 'large'; rotation: number; isTarget: boolean }>;
    // match
    matchPairs?: Array<{ shape: string; label: string; emoji: string }>;
    // count-properties
    displayShape?: string;
    expectedSides?: number;
    expectedCorners?: number;
    hasCurvedSides?: boolean;
    // describe
    correctDescriptions?: string[];
    allDescriptions?: string[];
    // sort
    sortingRule?: string;           // 'by-name', 'by-sides', 'by-corners', 'curved-vs-straight'
    bins?: Array<{ label: string; accepts: string[] }>;
    sortableShapes?: Array<{ shape: string; color: string; correctBin: string }>;
    // real-world
    sceneType?: string;             // 'classroom', 'playground', 'kitchen', 'city'
    highlightedRegions?: Array<{ label: string; correctShape: string; hint: string }>;
  }>;
  gradeBand: 'K' | '1';
  showPropertyLabels: boolean;      // show "sides: 4" labels
  includeIrregularShapes: boolean;  // include non-standard orientations
}
```

**AI Tutoring Hooks:**
- Context keys: `challengeType`, `targetShape`, `expectedSides`, `expectedCorners`, `sortingRule`, `studentAnswer`, `attemptNumber`, `sceneType`
- Scaffolding: L1 "Look at the shapes. Which ones look alike?" → L2 "Count the sides. Triangles have 3 sides. How many sides does this one have?" → L3 "This shape has 3 straight sides and 3 corners — that makes it a triangle! Even when it's turned sideways, it's still a triangle."
- Directive: "Always connect shape names to properties: 'A rectangle has 4 sides and 4 corners. Two sides are long and two are short.' Never say a shape IS its color or size — emphasize that shapes stay the same no matter how big, small, or rotated they are."

---

### 3.2 `3d-shape-explorer`

**Purpose:** Introduce 3D shapes (cubes, cones, cylinders, spheres) and build understanding of the distinction between flat (2D) and solid (3D) objects through visual, interactive exploration.

**Grade Band:** K-1 (Difficulty 4-7)

**Skills Addressed:**
- Recognize and name 3D shapes (cubes, cones, cylinders, spheres) and distinguish between 2D and 3D objects
- Analyze and compare 3D shapes by building and manipulating physical models
- Identify 3D shapes in real-world objects (ball → sphere, box → rectangular prism, can → cylinder)

**Interaction Model:**

Multi-phase challenges with 5 challenge types:

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `identify-3d` | A rotating 3D shape is displayed. Student selects its name from multiple choice. Shapes rotate slowly to show all faces. |
| 2 | `2d-vs-3d` | Mixed set of 2D shapes and 3D shapes. Student sorts them into "Flat shapes" and "Solid shapes" bins. |
| 3 | `match-to-real-world` | Real-world objects (ball, dice, can, ice cream cone, box) shown alongside 3D shape names. Student matches each object to its shape. |
| 4 | `faces-and-properties` | A 3D shape is shown. Student answers: "How many flat faces?" "Does it roll?" "Does it stack?" "What shape are the faces?" Builds 3D vocabulary. |
| 5 | `compare` | Two 3D shapes side by side. Student identifies similarities and differences: "Both roll," "One has flat faces, one doesn't," "One can stack, one can't." |

**Visual Design:**
- 3D shapes rendered with soft gradients and shadows to convey depth (isometric/pseudo-3D, not full WebGL)
- Slow auto-rotation with drag-to-spin for exploration
- "Unfold" animation: 3D shape flattens to show its 2D faces (cube → 6 squares, cylinder → 2 circles + rectangle)
- Real-world object cards with photographs/illustrations and glowing shape outlines
- Property checklist UI: tap to check/uncheck properties ("Has flat faces ✓", "Can roll ✓", "Can stack ✗")
- Glass card Lumina theming

**Data Shape (key fields):**
```typescript
interface ThreeDShapeExplorerData {
  challenges: Array<{
    type: 'identify-3d' | '2d-vs-3d' | 'match-to-real-world' | 'faces-and-properties' | 'compare';
    instruction: string;
    // identify-3d
    shape3d?: string;               // 'cube', 'sphere', 'cylinder', 'cone', 'rectangular-prism'
    options?: string[];             // multiple choice options
    // 2d-vs-3d
    mixedShapes?: Array<{ name: string; emoji: string; is3d: boolean }>;
    // match-to-real-world
    matchPairs?: Array<{ realWorldObject: string; emoji: string; shape3d: string }>;
    // faces-and-properties
    displayShape?: string;
    properties?: {
      flatFaces: number;
      curvedSurfaces: number;
      faceShapes: string[];         // ['square', 'square', ...] for a cube
      canRoll: boolean;
      canStack: boolean;
      canSlide: boolean;
    };
    propertyQuestions?: Array<{ question: string; correctAnswer: string | number | boolean }>;
    // compare
    shape1?: string;
    shape2?: string;
    similarities?: string[];
    differences?: string[];
  }>;
  gradeBand: 'K' | '1';
  showUnfoldAnimation: boolean;
  show3dRotation: boolean;
}
```

**AI Tutoring Hooks:**
- Context keys: `challengeType`, `shape3d`, `displayShape`, `properties`, `studentAnswer`, `attemptNumber`, `shape1`, `shape2`
- Scaffolding: L1 "Look at this shape. Is it flat like a piece of paper, or could you pick it up and hold it?" → L2 "Try to spin it. How many flat sides can you see? What shape are those flat parts?" → L3 "This is a cylinder. It has 2 flat circle faces on top and bottom, and a curved surface around the middle. A soup can is shaped like a cylinder!"
- Directive: "Always connect 3D shapes to objects kids know: 'A cube is like a dice block. A sphere is like a ball. A cylinder is like a can.' Use 'flat face' not 'side' for 3D shapes. Emphasize the key distinction: 'Flat shapes live on paper. Solid shapes you can hold in your hand!'"

---

### 3.3 `shape-tracer`

**Purpose:** Develop shape construction skills through guided tracing, drawing, and completion — connecting shape properties (number of sides, types of angles) to the motor act of creating them.

**Grade Band:** K-1 (Difficulty 4-6)

**Skills Addressed:**
- Draw and trace basic shapes using templates and verbal descriptions of their properties
- Create and complete basic shapes through drawing, building, and completing half-drawn figures

**Interaction Model:**

A drawing canvas with guided tracing and construction challenges:

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `trace` | A dotted-outline shape is displayed. Student traces along the dots to complete the shape. Tolerance zones highlight green as they trace correctly. Sides count up as each is completed ("Side 1 of 3!"). |
| 2 | `complete` | A shape is half-drawn (1-2 sides visible). Student draws the remaining sides to complete it. Vertex dots mark where to connect. E.g., 2 sides of a triangle are shown, student draws the 3rd. |
| 3 | `draw-from-description` | No template — student gets verbal instructions: "Draw a shape with 4 equal sides and 4 corners." Student draws on a dot grid. System checks if the result matches the described shape. |
| 4 | `connect-dots` | Numbered dots on the canvas. Student connects them in order (1→2→3→4→1) to reveal a shape, then names it. Progressive: dots are labeled, then unlabeled. |

**Visual Design:**
- Large drawing canvas (60% of card) with dot grid background for guidance
- Dotted trace lines with animated "ant trail" showing drawing direction
- Tolerance zones: wide green corridor around trace path for small hands
- Side counter: "Side 1 ✓ Side 2 ✓ Side 3 ..." with checkmarks as each side is drawn
- Celebratory shape-fill animation when tracing completes (shape fills with color and bounces)
- Property reminder panel: shows target properties ("Needs: 4 sides, 4 corners")
- Undo button for erasing last stroke
- Glass card Lumina theming

**Data Shape (key fields):**
```typescript
interface ShapeTracerData {
  challenges: Array<{
    type: 'trace' | 'complete' | 'draw-from-description' | 'connect-dots';
    instruction: string;
    targetShape: string;            // 'triangle', 'square', 'rectangle', 'circle', 'hexagon'
    // trace
    tracePath?: Array<{ x: number; y: number }>;  // ordered points defining the shape outline
    tolerance?: number;             // pixels of tolerance for tracing accuracy
    // complete
    drawnSides?: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
    remainingVertices?: Array<{ x: number; y: number }>;
    // draw-from-description
    description?: string;           // "Draw a shape with 3 sides"
    requiredProperties?: {
      sides?: number;
      corners?: number;
      allSidesEqual?: boolean;
      hasCurvedSides?: boolean;
    };
    // connect-dots
    dots?: Array<{ x: number; y: number; label?: string }>;
    correctOrder?: number[];
    revealShape?: string;           // shape name revealed after connecting
  }>;
  gridSize: number;                 // dot grid spacing
  showPropertyReminder: boolean;
  gradeBand: 'K' | '1';
}
```

**AI Tutoring Hooks:**
- Context keys: `challengeType`, `targetShape`, `description`, `requiredProperties`, `sidesCompleted`, `totalSides`, `attemptNumber`, `tracingAccuracy`
- Scaffolding: L1 "Follow the dots slowly. Start at the first dot and draw to the next one." → L2 "You've drawn {{sidesCompleted}} sides. How many more do you need? Look at the dots — where does the next side go?" → L3 "A triangle has 3 sides. You drew 2 already — now connect the last dot back to where you started to close the shape!"
- Directive: "Be patient with tracing accuracy — small hands need wide tolerances. Celebrate each completed side. For draw-from-description, focus on properties not perfection: 'Does it have 4 sides? Then it's a rectangle, even if it's a little wobbly!' Avoid correcting aesthetics — only check geometric properties."

---

### 3.4 `shape-composer`

**Purpose:** Teach spatial reasoning through shape composition (combining basic shapes into larger shapes and pictures) and decomposition (breaking complex shapes into basic components) — a key K geometry standard.

**Grade Band:** K-1 (Difficulty 5-8)

**Skills Addressed:**
- Compose larger shapes by combining basic shapes and decompose larger shapes into smaller basic shapes
- Compose and decompose shapes to form larger shapes and create pictures of familiar objects

**Interaction Model:**

A workspace with a shape palette and a target/canvas area:

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `compose-match` | A target shape silhouette is shown (e.g., a large square). Shape pieces are provided (e.g., 2 triangles). Student drags and rotates pieces to fill the target silhouette. Snap-to-fit guides help alignment. |
| 2 | `compose-picture` | A target picture is shown (house, tree, rocket, fish). Student selects shapes from a palette and arranges them to recreate the picture. E.g., house = square + triangle roof + rectangle door. |
| 3 | `decompose` | A composite shape is displayed. Student draws lines or taps to split it into basic shapes, then names each component. E.g., an arrow → rectangle + triangle. Shows the component list building up. |
| 4 | `free-create` | Open-ended: student picks shapes from the palette and composes any picture they like. AI comments on what shapes they used and what the picture looks like. |
| 5 | `how-many-ways` | A target shape (e.g., hexagon) with a goal: "Build this using triangles. How many do you need?" Then: "Can you build it using rectangles and triangles?" Multiple valid solutions. |

**Visual Design:**
- Split layout: shape palette on the left, canvas/target on the right
- Drag-and-drop shapes with rotation handle (45° snap increments for K, free rotation for grade 1)
- Snap-to-fit: shapes glow green and snap into correct position when close enough
- Target silhouette: semi-transparent gray outline that fills with color as pieces are placed
- Decomposition mode: tap to draw dividing lines, each resulting region gets a color and label
- Component list sidebar: shows identified shapes with counts ("2 triangles + 1 square")
- Picture gallery for compose-picture: simple, recognizable targets (house, boat, tree, rocket, cat face)
- Glass card Lumina theming

**Data Shape (key fields):**
```typescript
interface ShapeComposerData {
  challenges: Array<{
    type: 'compose-match' | 'compose-picture' | 'decompose' | 'free-create' | 'how-many-ways';
    instruction: string;
    // compose-match
    targetShape?: string;           // 'large-square', 'hexagon', 'rectangle'
    pieces?: Array<{
      shape: string;                // 'triangle', 'square', etc.
      color: string;
      initialRotation?: number;
      targetPosition?: { x: number; y: number };
      targetRotation?: number;
    }>;
    // compose-picture
    targetPicture?: string;         // 'house', 'tree', 'rocket', 'boat', 'cat'
    targetPictureOutline?: Array<{ shape: string; position: { x: number; y: number }; rotation: number }>;
    availableShapes?: Array<{ shape: string; color: string; count: number }>;
    // decompose
    compositeShape?: Array<{ x: number; y: number }>;  // polygon outline
    expectedComponents?: Array<{ shape: string; count: number }>;
    divisionLines?: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
    // how-many-ways
    targetForComposition?: string;
    allowedPieces?: string[];       // which shapes can be used
    validSolutions?: Array<Array<{ shape: string; count: number }>>;
  }>;
  snapTolerance: number;            // pixels for snap-to-fit
  rotationSnap: number;             // degrees (45 for K, 15 for grade 1)
  gradeBand: 'K' | '1';
}
```

**AI Tutoring Hooks:**
- Context keys: `challengeType`, `targetShape`, `targetPicture`, `piecesPlaced`, `totalPieces`, `expectedComponents`, `studentComponents`, `attemptNumber`
- Scaffolding: L1 "Look at the big shape. What smaller shapes could fit inside it?" → L2 "Try the triangle — can you turn it so it fits into the corner? Two triangles can make a square!" → L3 "You did it! Two triangles make one big square. The triangle's pointy corner fits right into the square's corner."
- Directive: "Celebrate creative solutions — there's often more than one way to compose a shape! In free-create mode, describe what you see: 'Wow, you used a triangle on top and a square below — that looks like a house!' Build spatial vocabulary: 'Turn it,' 'Flip it,' 'Slide it over,' 'It fits in the corner.'"

---

## 4. Priority & Sequencing

### Phase 1 — Core (Build First)

These two primitives address the highest-priority skill gaps and cover the most subskills:

| # | Primitive | Rationale |
|---|---|---|
| 1 | `shape-sorter` | Covers 6 subskills across both clusters (the most of any single primitive). Shape identification and naming is the foundational skill — all other geometry work depends on it. Difficulty 1-5 makes it the entry point for K geometry. |
| 2 | `shape-composer` | Composition and decomposition is the capstone K geometry skill and is prominently featured in both clusters. No existing primitive provides K-appropriate compose/decompose (shape-builder is grid-based and too advanced). |

### Phase 2 — Extended (Build Next)

| # | Primitive | Rationale |
|---|---|---|
| 3 | `3d-shape-explorer` | 3D shapes are a distinct skill with no existing coverage at all. The 2D-vs-3D distinction is an important conceptual leap. Difficulty 4-7 means students will encounter this after mastering basic 2D identification. |
| 4 | `shape-tracer` | Drawing and tracing is a motor skill that reinforces shape properties. Lower priority because it's the most dependent on touch/drawing input quality and is the narrowest in skill coverage (2 subskills). |

---

## 5. Integration with Existing Primitives

The new primitives complement (not replace) existing ones:

| Skill | Existing Primitive | New Primitive | When AI Should Choose New |
|---|---|---|---|
| Build shapes on grid | `shape-builder` | — | — (keep for grades 2-5) |
| Discover/measure shape properties | `shape-builder` | `shape-sorter` | When the focus is identification and naming at K level, not measurement with ruler/protractor tools |
| Classify shapes into categories | `shape-builder` | `shape-sorter` | When sorting by simple attributes (sides, corners) for K, not formal classification hierarchies |
| Compose/decompose shapes | `shape-builder` | `shape-composer` | When using tangram-style draggable pieces for K, not grid-based vertex construction |
| Sort objects by attributes | `sorting-station` | `shape-sorter` | When objects are specifically geometric shapes and the goal is learning shape names/properties |
| Shape-based repeating patterns | `pattern-builder` | — | — (pattern-builder already covers this well) |
| Find lines of symmetry | `shape-builder` | — | — (keep shape-builder's symmetry mode) |

---

## 6. Cross-Primitive Skill Progressions

### 2D Shape Mastery Flow
```
shape-sorter (identify & name shapes)
    ↓
shape-sorter (count properties: sides, corners)
    ↓
shape-sorter (sort by attributes)
    ↓
shape-tracer (trace shapes)
    ↓
shape-tracer (draw from description)
    ↓
shape-composer (compose shapes into pictures)
    ↓
shape-composer (decompose composite shapes)
    ↓
shape-builder (grid construction, grades 2+)
```

### 2D → 3D Progression
```
shape-sorter (master 2D shape names)
    ↓
3d-shape-explorer (identify 3D shapes)
    ↓
3d-shape-explorer (2D vs 3D sorting)
    ↓
3d-shape-explorer (faces & properties — "A cube has square faces")
    ↓
3d-shape-explorer (real-world matching)
```

### Geometry ↔ Math Connections
```
shape-sorter (sort shapes by attributes) ↔ sorting-station (general sorting skills)
shape-sorter (count properties) ↔ counting-board (counting objects)
shape-composer (how-many-ways) ↔ number-bond (decompose numbers into pairs)
pattern-builder (shape patterns) ↔ shape-sorter (shape identification)
```

---

## 7. Shared Infrastructure

All 4 primitives will use the existing multi-phase hooks:

- **`useMultiPhaseEvaluation`** — challenge progress tracking, result recording, phase summaries
- **`useLuminaAI`** — AI tutoring connection with context passing
- **`PhaseSummaryPanel`** — completion screen with score rings and tier badges

Each primitive supports `supportsEvaluation: true` in the catalog.

---

## 8. Generator Guidelines

Each primitive's Gemini generator should:

1. **Accept grade context** — K vs. 1 determines shape complexity (K: circle, square, triangle, rectangle; grade 1: adds hexagon, trapezoid, rhombus), vocabulary level, and challenge difficulty
2. **Generate 4-6 challenges** mixing challenge types with progressive difficulty
3. **Use varied orientations** — shapes must appear in non-standard positions (rotated triangles, tilted rectangles) to build orientation invariance
4. **Ensure distractor quality** — wrong answers should be plausible (e.g., diamond vs. square, oval vs. circle) to test genuine understanding
5. **Include clear instructions** — every challenge needs a student-facing `instruction` string written in simple, encouraging language
6. **Use real-world connections** — generators should incorporate familiar objects (clock → circle, door → rectangle) where appropriate

### Shape Vocabulary by Grade

| Grade | 2D Shapes | 3D Shapes | Property Language |
|---|---|---|---|
| K | circle, square, triangle, rectangle | cube, sphere, cone, cylinder | sides, corners, curved, straight, flat, round |
| 1 | + hexagon, trapezoid, rhombus, oval | + rectangular prism, pyramid | + vertices, edges, faces, parallel, angles |

---

## 9. Implementation Estimate

Per primitive, following the 7-file pattern:
1. Component (`.tsx`) — largest effort, includes all interaction modes
2. Types (data interface)
3. Generator (Gemini prompt + schema)
4. Generator registry entry
5. Catalog entry (math.ts)
6. Primitive registry entry
7. Evaluation types

**Recommended build order:** `shape-sorter` → `shape-composer` → `3d-shape-explorer` → `shape-tracer`

---

## 10. Success Metrics

| Metric | Target |
|---|---|
| Skill mastery improvement | 15%+ increase in geometry mastery scores within 4 weeks |
| Completion rate | 80%+ of students complete all challenges in a session |
| AI primitive selection accuracy | AI correctly selects geometry primitives for matching skills 90%+ of the time |
| Orientation invariance | Students correctly identify rotated/scaled shapes 75%+ of the time after 2 weeks |
| 2D-vs-3D distinction | 85%+ accuracy on 2D-vs-3D sorting after completing 3d-shape-explorer |

---

## Appendix: Full Skill → Primitive Mapping

<details>
<summary>Identify and Describe Shapes (6 subskills)</summary>

| Skill | Difficulty | Primary Primitive | Secondary |
|---|---|---|---|
| Match and name basic 2D shapes regardless of size, color, or orientation | 1-3 | `shape-sorter` | — |
| Identify shapes in real-world environments; geometric vocabulary (sides, corners, curved vs. straight) | 2-4 | `shape-sorter` | — |
| Count and compare shape properties (sides, vertices); sort into groups | 3-5 | `shape-sorter` | — |
| Recognize and name 3D shapes (cubes, cones, cylinders); distinguish 2D vs 3D | 4-6 | `3d-shape-explorer` | `shape-sorter` |
| Draw and trace basic shapes using templates and verbal descriptions | 4-6 | `shape-tracer` | — |
| Compose larger shapes from basic shapes; decompose larger shapes | 5-7 | `shape-composer` | `shape-builder` |
</details>

<details>
<summary>Analyze, Compare, Create, and Compose Shapes (7 subskills)</summary>

| Skill | Difficulty | Primary Primitive | Secondary |
|---|---|---|---|
| Identify and name basic 2D shapes based on attributes (sides and vertices) | 1-3 | `shape-sorter` | — |
| Sort and classify shapes by single attributes; identify shapes that don't belong | 2-4 | `shape-sorter` | `sorting-station` |
| Recognize and match shapes in different orientations/sizes, including real-world objects | 3-5 | `shape-sorter` | — |
| Create and complete basic shapes through drawing, building, completing half-drawn figures | 4-6 | `shape-tracer` | `shape-builder` |
| Analyze and compare 3D shapes by building and manipulating models | 5-7 | `3d-shape-explorer` | — |
| Compose and decompose shapes to form larger shapes and create pictures | 6-8 | `shape-composer` | — |
| Create, extend, and describe repeating patterns using multiple shapes and attributes | 7-9 | `pattern-builder` | — |
</details>
