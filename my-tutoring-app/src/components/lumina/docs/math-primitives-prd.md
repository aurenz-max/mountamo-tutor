# Math Education Visual Primitives
## Product Requirements Document

### Overview

This document defines the complete set of interactive visual primitives required for a comprehensive K-12+ mathematics education platform. Each primitive is a reusable, interactive component that can be embedded in problems, explanations, and assessments across multiple skill areas and grade levels.

### Design Principles

1. **Interactivity First**: Every primitive should support manipulation, not just display
2. **Multiple Representations**: Primitives should link to related representations where applicable
3. **Progressive Disclosure**: Simple modes for early learners, advanced options that unlock
4. **Accessibility**: Full keyboard navigation, screen reader support, high contrast modes
5. **State Serialization**: All primitives must serialize state for problem authoring and student response capture

---

## Primitives by Domain

### 1. Number Sense & Arithmetic

#### 1.1 Number Line

**Description**: A horizontal or vertical line with configurable endpoints, tick marks, and labeled intervals. Supports plotting points, segments, and rays.

**Core Interactions**:
- Drag to plot points
- Adjust endpoints and scale
- Zoom in/out for precision
- Toggle between integer, decimal, and fraction labels

**Use Cases**:
- Counting and ordering (K-2)
- Addition/subtraction as movement (1-3)
- Integers and negative numbers (6-7)
- Inequalities and solution sets (7-Algebra)
- Real number concepts (Algebra+)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `min` | number | Left/bottom endpoint |
| `max` | number | Right/top endpoint |
| `tickInterval` | number | Spacing between tick marks |
| `labelInterval` | number | Spacing between labels |
| `orientation` | enum | `horizontal` or `vertical` |
| `allowNegative` | boolean | Whether line extends below zero |
| `numberType` | enum | `integer`, `decimal`, `fraction`, `mixed` |

---

#### 1.2 Base-10 Blocks

**Description**: Virtual manipulatives representing ones (units), tens (rods), hundreds (flats), and thousands (cubes). Supports grouping, ungrouping, and regrouping animations.

**Core Interactions**:
- Drag blocks into workspace
- Click to break apart (ungroup) or combine (regroup)
- Snap to place value columns
- Animate regrouping for carrying/borrowing

**Use Cases**:
- Place value understanding (K-2)
- Multi-digit addition with regrouping (1-3)
- Multi-digit subtraction with borrowing (2-3)
- Decimal place value (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `maxPlace` | enum | `ones`, `tens`, `hundreds`, `thousands` |
| `showPlaceColumns` | boolean | Display labeled columns |
| `allowRegrouping` | boolean | Enable break/combine interactions |
| `decimalMode` | boolean | Treat flat as "one" for decimal work |
| `initialValue` | number | Pre-populate blocks |

---

#### 1.3 Place Value Chart

**Description**: A tabular representation showing digits in labeled columns from ones through millions (or down to thousandths for decimals). Supports digit manipulation and expanded form display.

**Core Interactions**:
- Enter/edit digits in columns
- Drag digits between columns (with automatic value adjustment display)
- Toggle expanded form overlay
- Animate "multiplying by 10" shifts

**Use Cases**:
- Reading and writing large numbers (3-5)
- Decimal place value (4-6)
- Scientific notation introduction (7-8)
- Powers of 10 relationships (4-6)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `minPlace` | number | Smallest place value (e.g., -3 for thousandths) |
| `maxPlace` | number | Largest place value (e.g., 6 for millions) |
| `showExpandedForm` | boolean | Display sum notation below |
| `showMultipliers` | boolean | Show ×1, ×10, ×100 headers |
| `editableDigits` | boolean | Allow student input |

---

#### 1.4 Fraction Bar / Strip

**Description**: A rectangular bar divided into equal parts with configurable shading to represent fractions. Supports stacking multiple bars for comparison and operations.

**Core Interactions**:
- Adjust number of partitions (denominator)
- Shade/unshade parts (numerator)
- Stack bars vertically for comparison
- Align partitions across bars for equivalence
- Slide bars horizontally for addition visualization

**Use Cases**:
- Fraction introduction (2-3)
- Equivalent fractions (3-4)
- Comparing fractions (3-5)
- Adding/subtracting fractions (4-5)
- Fraction of a whole (3-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `partitions` | number | Number of equal parts |
| `shaded` | number | Number of shaded parts |
| `barCount` | number | Number of stacked bars |
| `showLabels` | boolean | Display fraction notation |
| `allowPartitionEdit` | boolean | Student can change denominator |
| `showEquivalentLines` | boolean | Draw alignment guides |

---

#### 1.5 Area Model

**Description**: A rectangular region divided into a grid representing the product of two factors. Supports partial products visualization for multi-digit multiplication and polynomial multiplication.

**Core Interactions**:
- Set dimensions (factors)
- Click to shade regions
- Display partial products in cells
- Animate assembly of final product
- Extend to algebraic terms (x, x², constants)

**Use Cases**:
- Single-digit multiplication (3)
- Multi-digit multiplication (4-5)
- Distributive property (5-6)
- Polynomial multiplication (Algebra)
- Factoring (Algebra)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `factor1Parts` | array | Decomposition of first factor (e.g., [20, 3] for 23) |
| `factor2Parts` | array | Decomposition of second factor |
| `showPartialProducts` | boolean | Display products in cells |
| `showDimensions` | boolean | Label side lengths |
| `algebraicMode` | boolean | Allow variable terms |
| `highlightCell` | [row, col] | Emphasize specific cell |

---

#### 1.6 Array / Grid

**Description**: A rectangular arrangement of discrete objects (dots, icons) in rows and columns. Foundational for multiplication facts and combinatorial thinking.

**Core Interactions**:
- Set row and column counts
- Click to highlight rows, columns, or regions
- Partition with lines to show grouping
- Toggle between dots, squares, and custom icons
- Animate counting strategies (skip counting by row)

**Use Cases**:
- Introduction to multiplication (2-3)
- Multiplication facts fluency (3-4)
- Commutative property (3)
- Area concepts (3-4)
- Combinatorics foundations (5+)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `rows` | number | Number of rows |
| `columns` | number | Number of columns |
| `iconType` | enum | `dot`, `square`, `star`, `custom` |
| `showRowLabels` | boolean | Number the rows |
| `showColumnLabels` | boolean | Number the columns |
| `partitionLines` | array | Coordinates for dividing lines |
| `highlightMode` | enum | `row`, `column`, `cell`, `region` |

---

#### 1.7 Factor Tree

**Description**: A branching diagram showing the prime factorization of a composite number. Each node splits into factor pairs until all leaves are prime.

**Core Interactions**:
- Enter starting number at root
- Click node to split into factor pair
- System validates factor pairs
- Highlights when all leaves are prime
- Displays prime factorization in exponential form

**Use Cases**:
- Factors and multiples (4)
- Prime vs composite (4)
- Prime factorization (5-6)
- GCF and LCM (6)
- Simplifying fractions (5-6)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `rootValue` | number | Starting composite number |
| `highlightPrimes` | boolean | Visually distinguish prime leaves |
| `showExponentForm` | boolean | Display final factorization |
| `guidedMode` | boolean | Suggest valid factor pairs |
| `allowReset` | boolean | Clear and restart |

---

### 2. Proportional Reasoning

#### 2.1 Ratio Table

**Description**: A two-row (or two-column) table showing corresponding values in a proportional relationship. Supports scaling up/down and finding missing values.

**Core Interactions**:
- Enter values in cells
- Apply multiplier/divisor to generate new columns
- Highlight constant ratio between rows
- Identify and fill missing values
- Toggle between horizontal and vertical orientations

**Use Cases**:
- Equivalent ratios (6)
- Unit rates (6-7)
- Proportional relationships (7)
- Scaling recipes and maps (6-7)
- Percent problems (6-7)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `rowLabels` | [string, string] | Names for the two quantities |
| `initialColumns` | array | Starting value pairs |
| `editableCells` | array | Which cells accept input |
| `showMultipliers` | boolean | Display ×n between columns |
| `showUnitRate` | boolean | Highlight ratio to 1 |
| `orientation` | enum | `horizontal` or `vertical` |

---

#### 2.2 Double Number Line

**Description**: Two parallel number lines with aligned tick marks, showing the correspondence between two proportional quantities. Critical bridge from additive to multiplicative reasoning.

**Core Interactions**:
- Set scale for each line independently
- Plot corresponding points (auto-aligns vertically)
- Drag to explore proportional relationships
- Zoom to find unit rate
- Extend lines in either direction

**Use Cases**:
- Ratio introduction (6)
- Percent as rate per 100 (6-7)
- Unit rate problems (6-7)
- Proportional reasoning (7)
- Measurement conversions (5-7)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `topLabel` | string | Label for top quantity |
| `bottomLabel` | string | Label for bottom quantity |
| `topScale` | {min, max, interval} | Top line configuration |
| `bottomScale` | {min, max, interval} | Bottom line configuration |
| `linkedPoints` | array | Pre-plotted corresponding pairs |
| `showVerticalGuides` | boolean | Draw alignment lines |

---

#### 2.3 Percent Bar

**Description**: A horizontal bar representing a whole (100%) with adjustable shading and markers for part-whole percent relationships.

**Core Interactions**:
- Shade to represent a percentage
- Place markers at specific percentages
- Overlay actual values alongside percentages
- Compare part to whole visually
- Split bar into benchmark fractions (½, ¼, etc.)

**Use Cases**:
- Percent concepts (5-6)
- Percent of a number (6-7)
- Percent increase/decrease (7)
- Tax, tip, discount problems (7)
- Probability as percent (7)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `wholeValue` | number | The value representing 100% |
| `shadedPercent` | number | Percentage shaded |
| `showPercentLabels` | boolean | Display % markers |
| `showValueLabels` | boolean | Display absolute values |
| `benchmarkLines` | array | Show guides at specified %s |
| `doubleBar` | boolean | Show value bar below % bar |

---

#### 2.4 Tape Diagram / Bar Model

**Description**: Rectangular bars representing quantities in part-part-whole or comparison relationships. The single most versatile visual for word problems from elementary through algebra.

**Core Interactions**:
- Create bars of adjustable length
- Partition bars into labeled segments
- Stack bars for comparison
- Add brackets with total labels
- Mark unknown with variable

**Use Cases**:
- Part-part-whole (1-3)
- Comparison word problems (2-4)
- Multi-step word problems (3-6)
- Ratio and proportion (6-7)
- Algebraic equation setup (6-Algebra)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `bars` | array | Array of bar configurations |
| `bar.segments` | array | Parts within each bar |
| `bar.totalLabel` | string | Label for whole bar |
| `comparisonMode` | boolean | Align bars for comparison |
| `showBrackets` | boolean | Display grouping brackets |
| `unknownSegment` | index | Mark segment with "?" |

---

### 3. Algebra & Functions

#### 3.1 Balance / Scale Model

**Description**: A two-pan balance showing equality between expressions. Objects/weights on each side must balance, making equation solving intuitive through maintaining equilibrium.

**Core Interactions**:
- Place objects (constants, variables) on pans
- Perform same operation on both sides
- Remove/add equal amounts from both sides
- Animate rebalancing
- Reveal solution when variable isolated

**Use Cases**:
- Equality concepts (1-2)
- Missing addend problems (1-3)
- One-step equations (6)
- Two-step equations (7)
- Variables on both sides (7-8)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `leftSide` | array | Objects on left pan |
| `rightSide` | array | Objects on right pan |
| `variableValue` | number | Hidden value of x |
| `showTilt` | boolean | Animate imbalance |
| `allowOperations` | array | Permitted solving moves |
| `stepHistory` | array | Track solution steps |

---

#### 3.2 Function Machine

**Description**: A visual "machine" with input hopper, rule display, and output chute. Numbers enter, get transformed by the rule, and exit—building function concepts.

**Core Interactions**:
- Drop input values into machine
- Watch transformation animation
- Guess the rule from input/output pairs
- Edit rule (in authoring mode)
- Chain multiple machines for composition

**Use Cases**:
- Input/output patterns (3-4)
- Function concept introduction (5-6)
- Function notation f(x) (8)
- Composition of functions (Algebra 2)
- Inverse functions (Algebra 2)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `rule` | expression | The transformation rule |
| `showRule` | boolean | Display or hide the rule |
| `inputQueue` | array | Values to process |
| `outputDisplay` | enum | `immediate`, `animated`, `hidden` |
| `chainable` | boolean | Allow connecting machines |
| `ruleComplexity` | enum | `oneStep`, `twoStep`, `expression` |

---

#### 3.3 Mapping Diagram

**Description**: Two parallel sets (domain and range) with arrows showing correspondence between elements. Clarifies function vs relation and visualizes domain/range.

**Core Interactions**:
- Add elements to domain and range sets
- Draw arrows connecting elements
- System identifies if mapping is a function
- Highlight domain, range, and codomain
- Show one-to-one and onto properties

**Use Cases**:
- Relations introduction (8)
- Function definition (8)
- Domain and range (8-Algebra)
- Inverse functions (Algebra 2)
- Injection/surjection (advanced)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `domainElements` | array | Elements in domain set |
| `rangeElements` | array | Elements in range set |
| `mappings` | array | Arrow connections |
| `showFunctionTest` | boolean | Indicate if it's a function |
| `editMode` | enum | `arrows`, `elements`, `both`, `none` |
| `setLabels` | [string, string] | Names for domain/range |

---

#### 3.4 Coordinate Graph (2D)

**Description**: A full-featured Cartesian coordinate plane for plotting points, lines, curves, and regions. The foundational graphing primitive for algebra and beyond.

**Core Interactions**:
- Plot points by clicking or coordinate entry
- Draw lines, segments, rays
- Graph functions from equations
- Shade regions for inequalities
- Zoom, pan, and adjust window
- Trace along curves to read coordinates
- Identify intercepts, maxima, minima

**Use Cases**:
- Ordered pairs (5)
- Graphing linear equations (7-8)
- Slope and intercepts (8)
- Systems of equations (8-Algebra)
- Function families (Algebra-Precalc)
- Inequalities and linear programming (Algebra 2)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `xRange` | [min, max] | Horizontal bounds |
| `yRange` | [min, max] | Vertical bounds |
| `gridSpacing` | {x, y} | Grid line intervals |
| `showAxes` | boolean | Display x and y axes |
| `showGrid` | boolean | Display background grid |
| `plotMode` | enum | `points`, `freehand`, `equation` |
| `equations` | array | Functions to graph |
| `points` | array | Discrete points to plot |
| `traceEnabled` | boolean | Allow curve tracing |

---

#### 3.5 Slope Triangle Overlay

**Description**: A right triangle overlay on a line showing rise and run, making slope calculation visual and concrete.

**Core Interactions**:
- Attach to any graphed line
- Drag to reposition along line
- Resize to show different rise/run pairs
- Display calculated slope value
- Toggle between rise/run and Δy/Δx notation

**Use Cases**:
- Slope introduction (8)
- Slope calculation (8)
- Slope-intercept form (8)
- Parallel and perpendicular lines (Geometry/Algebra)
- Rate of change (Algebra)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `attachedLine` | lineRef | Line to attach to |
| `position` | point | Triangle location |
| `size` | number | Scale of triangle |
| `showMeasurements` | boolean | Display rise/run values |
| `showSlope` | boolean | Display calculated ratio |
| `notation` | enum | `riseRun`, `deltaNotation` |

---

#### 3.6 Systems of Equations Visualizer

**Description**: Multiple equations graphed together with emphasis on intersection points. Supports algebraic and graphical solution methods side-by-side.

**Core Interactions**:
- Enter/edit multiple equations
- Graph all equations simultaneously
- Highlight intersection point(s)
- Toggle solution method panels (substitution, elimination)
- Animate algebraic solution steps
- Classify system type (one solution, none, infinite)

**Use Cases**:
- Systems with graphing (8)
- Substitution method (8-Algebra)
- Elimination method (8-Algebra)
- System classification (Algebra)
- Applications of systems (Algebra)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `equations` | array | System equations (2-3) |
| `showGraph` | boolean | Display graphical representation |
| `showAlgebraic` | boolean | Show solution steps panel |
| `solutionMethod` | enum | `graphing`, `substitution`, `elimination` |
| `highlightIntersection` | boolean | Mark solution point(s) |
| `stepByStep` | boolean | Animate solution process |

---

#### 3.7 Expression Tree

**Description**: A tree diagram showing the hierarchical structure of a mathematical expression, with operators as internal nodes and operands as leaves.

**Core Interactions**:
- Build expression by adding nodes
- Click node to evaluate subtree
- Reorder for equivalent expressions
- Highlight order of operations path
- Collapse/expand subexpressions
- Compare equivalent trees

**Use Cases**:
- Order of operations (5-6)
- Expression structure (6-7)
- Distributive property (6-7)
- Equivalent expressions (7-Algebra)
- Simplification strategies (Algebra)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `expression` | string | Mathematical expression |
| `evaluationOrder` | array | Steps for evaluation animation |
| `editable` | boolean | Allow tree modification |
| `showValues` | boolean | Display intermediate results |
| `compareTree` | expressionTree | Second tree for equivalence |
| `highlightNode` | nodeRef | Emphasize specific node |

---

#### 3.8 Table-Graph-Equation Linker

**Description**: A multi-representation display showing the same function as a table of values, a graph, and an equation. Changes to one representation automatically update others.

**Core Interactions**:
- Edit table values → graph and equation update
- Manipulate graph → table and equation update
- Change equation → table and graph update
- Highlight corresponding elements across representations
- Toggle between representations

**Use Cases**:
- Multiple representations (7-8)
- Linear functions (8)
- Function families (Algebra)
- Regression and modeling (Algebra 2)
- Transformation analysis (Algebra 2)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `functionType` | enum | `linear`, `quadratic`, `exponential`, etc. |
| `equation` | string | Function equation |
| `tableRange` | [min, max] | x-values for table |
| `editableReps` | array | Which representations can be modified |
| `linkedHighlight` | boolean | Synchronized selection |
| `showAllThree` | boolean | Display all vs toggle |

---

#### 3.9 Formula Explainer

**Description**: An annotated formula display with interactive labels explaining each component. Supports substitution animation and unit analysis.

**Core Interactions**:
- Hover/tap components for explanations
- Substitute values into variables
- Watch calculation cascade through formula
- Toggle between formula and verbal description
- Highlight unit propagation

**Use Cases**:
- Formula introduction (varies)
- Geometric formulas (6-Geometry)
- Physics formulas (various)
- Financial formulas (Algebra 2)
- Statistical formulas (Statistics)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `formula` | string | LaTeX formula string |
| `annotations` | array | {position, label, description} |
| `variables` | object | Variable values for substitution |
| `showSteps` | boolean | Display calculation steps |
| `unitTracking` | boolean | Show unit analysis |
| `verbalForm` | string | Text description of formula |

---

#### 3.10 Matrix Display / Editor

**Description**: An m×n grid for displaying and manipulating matrices. Supports operations, transformations, and system representation.

**Core Interactions**:
- Enter/edit cell values
- Perform row operations
- Multiply matrices
- Calculate determinant, inverse
- Apply to transformation vectors
- Augment for system solving

**Use Cases**:
- Organizing data (7-8)
- Transformations (Geometry)
- Systems as matrices (Algebra 2)
- Matrix operations (Algebra 2/Precalc)
- Linear algebra foundations (advanced)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `rows` | number | Number of rows |
| `columns` | number | Number of columns |
| `values` | 2D array | Matrix entries |
| `editable` | boolean | Allow cell editing |
| `showOperations` | array | Available matrix operations |
| `augmented` | boolean | Display as augmented matrix |
| `highlightCells` | array | Emphasized cells |

---

### 4. Geometry & Measurement

#### 4.1 Shape Canvas

**Description**: A drawing area for constructing and manipulating geometric shapes with precise control over properties (side lengths, angles, etc.).

**Core Interactions**:
- Select shape tool (point, segment, ray, line, polygon, circle)
- Draw shapes by clicking/dragging
- Measure lengths, angles, areas
- Move, rotate, resize shapes
- Snap to grid or other shapes
- Mark congruent parts

**Use Cases**:
- Shape identification (K-2)
- Properties of shapes (3-5)
- Constructions (Geometry)
- Coordinate geometry (8-Geometry)
- Proofs with diagrams (Geometry)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `tools` | array | Available shape tools |
| `showGrid` | boolean | Display background grid |
| `snapToGrid` | boolean | Constrain to grid points |
| `measureTools` | array | Available measurement tools |
| `shapes` | array | Pre-drawn shapes |
| `lockShapes` | boolean | Prevent modification |

---

#### 4.2 Protractor / Angle Maker

**Description**: A virtual protractor for measuring and constructing angles. Supports angle classification and arc notation.

**Core Interactions**:
- Position protractor on vertex
- Align with one ray
- Read angle measurement
- Construct angles of specific measure
- Classify as acute, right, obtuse, straight, reflex
- Draw arc notation

**Use Cases**:
- Angle measurement (4)
- Angle classification (4)
- Angle relationships (7-Geometry)
- Constructions (Geometry)
- Trigonometry setup (Geometry/Precalc)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `mode` | enum | `measure` or `construct` |
| `showClassification` | boolean | Display angle type |
| `protractorType` | enum | `half` (180°) or `full` (360°) |
| `precision` | number | Decimal places in measurement |
| `showArc` | boolean | Display angle arc |
| `snapToAngles` | array | Snap to specific angles (e.g., 45°, 90°) |

---

#### 4.3 Transformation Toolkit

**Description**: Tools for performing and analyzing geometric transformations on the coordinate plane: translation, rotation, reflection, and dilation.

**Core Interactions**:
- Select transformation type
- Specify parameters (vector, center, line, scale factor)
- Apply transformation to shape
- View pre-image and image together
- Identify transformation from result
- Compose multiple transformations

**Use Cases**:
- Slides, flips, turns (2-3)
- Coordinate transformations (8)
- Congruence and similarity (8-Geometry)
- Transformation proofs (Geometry)
- Symmetry analysis (Geometry)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `transformationType` | enum | `translate`, `rotate`, `reflect`, `dilate` |
| `parameters` | object | Transformation-specific parameters |
| `showPreImage` | boolean | Display original shape |
| `showImage` | boolean | Display transformed shape |
| `showMapping` | boolean | Draw correspondence arrows |
| `compositionMode` | boolean | Allow chaining transformations |

---

#### 4.4 Net Folder

**Description**: An interactive tool showing the relationship between 2D nets and 3D solids. Animates the folding/unfolding process.

**Core Interactions**:
- Select 3D solid (cube, prism, pyramid, cylinder, cone)
- Unfold to show net
- Click net faces to identify on solid
- Fold animation from net to solid
- Calculate surface area from net
- Identify valid vs invalid nets

**Use Cases**:
- 3D shape properties (3-5)
- Surface area concepts (6)
- Surface area calculation (6-7)
- Visualization skills (Geometry)
- Design and packaging (applications)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `solidType` | enum | Solid to display |
| `dimensions` | object | Solid dimensions |
| `viewMode` | enum | `solid`, `net`, `folding` |
| `animationSpeed` | number | Fold/unfold speed |
| `showMeasurements` | boolean | Display dimensions |
| `labelFaces` | boolean | Name/number faces |

---

#### 4.5 Unit Tiling

**Description**: A region filled with unit squares (area) or unit cubes (volume) for concrete understanding of measurement. Supports fractional units for precision.

**Core Interactions**:
- Draw or select region
- Fill with unit squares/cubes
- Count full and partial units
- Adjust unit size
- Compare different tilings
- Transition to formula calculation

**Use Cases**:
- Area introduction (3)
- Area of rectangles (3)
- Area of irregular shapes (3-4)
- Volume introduction (5)
- Volume of prisms (5-6)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `region` | shape | Area/volume to tile |
| `unitSize` | number | Size of each unit |
| `dimension` | enum | `2d` or `3d` |
| `showCount` | boolean | Display unit count |
| `showPartial` | boolean | Include fractional units |
| `showFormula` | boolean | Display formula after tiling |

---

#### 4.6 Circle Diagram

**Description**: An interactive circle with labeled parts (center, radius, diameter, chord, secant, tangent, arc, sector, segment) and measurement capabilities.

**Core Interactions**:
- Draw/identify circle parts
- Measure radius, diameter, circumference
- Calculate and display π relationships
- Shade sectors and segments
- Measure central and inscribed angles
- Explore arc length and sector area

**Use Cases**:
- Circle vocabulary (3-5)
- Circumference and π (7)
- Area of circles (7)
- Arc length and sector area (Geometry)
- Circle theorems (Geometry)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `radius` | number | Circle radius |
| `showParts` | array | Which parts to label |
| `highlightPart` | enum | Part to emphasize |
| `sectorAngle` | number | Central angle for sector |
| `showMeasurements` | boolean | Display calculations |
| `interactionMode` | enum | `identify`, `construct`, `measure` |

---

#### 4.7 3D Coordinate System

**Description**: A three-dimensional coordinate system for plotting points, vectors, lines, and surfaces in space.

**Core Interactions**:
- Rotate view (orbit)
- Plot points with (x, y, z) coordinates
- Draw vectors from origin or between points
- Graph planes and simple surfaces
- Trace curves in 3D
- Project onto coordinate planes

**Use Cases**:
- 3D coordinates (Geometry/Precalc)
- Vectors in 3D (Precalc)
- Planes and lines (Precalc/Calc 3)
- Surfaces and solids (Calc 3)
- Cross-sections (Calc 3)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `xRange` | [min, max] | X-axis bounds |
| `yRange` | [min, max] | Y-axis bounds |
| `zRange` | [min, max] | Z-axis bounds |
| `viewAngle` | {theta, phi} | Initial camera position |
| `showPlanes` | array | Coordinate planes to display |
| `objects` | array | Points, vectors, surfaces to render |
| `allowOrbit` | boolean | Enable view rotation |

---

### 5. Statistics & Probability

#### 5.1 Dot Plot / Line Plot

**Description**: A number line with stacked dots representing data values. Simple and effective for small datasets and frequency visualization.

**Core Interactions**:
- Click number line to add data points
- Remove points by clicking
- View frequency at each value
- Calculate and display mean, median, mode
- Compare two datasets with parallel plots

**Use Cases**:
- Data representation (2-3)
- Frequency concepts (3-4)
- Mean, median, mode (5-6)
- Data distribution shape (6-7)
- Comparing datasets (6-7)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `range` | [min, max] | Number line range |
| `dataPoints` | array | Dataset values |
| `showStatistics` | boolean | Display measures |
| `editable` | boolean | Allow adding/removing points |
| `parallel` | boolean | Enable second dataset |
| `stackStyle` | enum | `dots`, `x`, `icons` |

---

#### 5.2 Histogram

**Description**: A bar chart showing frequency distribution with adjustable bin widths. Essential for understanding data distribution shapes.

**Core Interactions**:
- Enter raw data or frequencies
- Adjust bin width interactively
- Watch distribution shape change
- Overlay normal curve (optional)
- Identify skew and outliers
- Read frequencies from bars

**Use Cases**:
- Grouped data (6)
- Distribution shape (6-7)
- Comparing distributions (7-Statistics)
- Normal distribution (Statistics)
- Data analysis (Statistics)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `data` | array | Raw data values |
| `binWidth` | number | Width of each bin |
| `binStart` | number | Left edge of first bin |
| `showFrequency` | boolean | Label bar heights |
| `showCurve` | boolean | Overlay distribution curve |
| `editable` | boolean | Allow data entry |

---

#### 5.3 Box-and-Whisker Plot

**Description**: A five-number summary visualization showing minimum, Q1, median, Q3, and maximum. Powerful for comparing distributions.

**Core Interactions**:
- Enter data to generate plot automatically
- Manually adjust five-number summary
- Display individual data points alongside
- Compare multiple box plots vertically
- Identify and mark outliers (IQR method)
- Toggle between showing and hiding outliers

**Use Cases**:
- Five-number summary (6)
- Quartiles and IQR (6-7)
- Comparing distributions (7-Statistics)
- Outlier detection (Statistics)
- Data analysis reports (Statistics)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `data` | array | Raw data values |
| `showDataPoints` | boolean | Display individual points |
| `showOutliers` | boolean | Mark outliers separately |
| `orientation` | enum | `horizontal` or `vertical` |
| `multipleDatasets` | array | For comparison plots |
| `showStats` | boolean | Display five-number values |

---

#### 5.4 Tree Diagram

**Description**: A branching structure showing all possible outcomes of sequential events. Foundation for probability calculations and counting.

**Core Interactions**:
- Add branches at each level
- Label branches with outcomes and probabilities
- Trace paths to calculate combined probability
- Count total outcomes
- Highlight specific paths
- Generate sample space list

**Use Cases**:
- Counting outcomes (4-5)
- Organized lists (5-6)
- Probability fundamentals (7)
- Compound probability (7-Statistics)
- Conditional probability (Statistics)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `levels` | number | Number of event stages |
| `branches` | nested array | Tree structure |
| `showProbabilities` | boolean | Display branch probabilities |
| `highlightPath` | array | Path to emphasize |
| `showSampleSpace` | boolean | List all outcomes |
| `calculateProduct` | boolean | Show path probability |

---

#### 5.5 Two-Way Table / Venn Diagram

**Description**: A tabular display for categorical data showing joint and marginal frequencies. Includes convertible Venn diagram view for two categories.

**Core Interactions**:
- Enter frequencies in cells
- Calculate row/column totals automatically
- Convert between table and Venn diagram
- Shade regions for probability questions
- Calculate conditional probabilities
- Switch between frequency and relative frequency

**Use Cases**:
- Categorical data (7)
- Joint probability (7-Statistics)
- Conditional probability (Statistics)
- Set relationships (7)
- Independence testing (Statistics)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `rowCategories` | array | Row category labels |
| `columnCategories` | array | Column category labels |
| `frequencies` | 2D array | Cell values |
| `showTotals` | boolean | Display marginal totals |
| `displayMode` | enum | `table`, `venn`, `both` |
| `showProbabilities` | boolean | Convert to relative frequency |

---

#### 5.6 Spinner / Random Sampler

**Description**: A circular spinner divided into sectors with a frequency tracker for experimental probability. Bridge between theoretical and experimental probability.

**Core Interactions**:
- Define sectors (size and label)
- Spin and record outcomes
- Track frequency in real-time
- Compare experimental to theoretical probability
- Adjust for unfair/weighted spinners
- Run multiple trials rapidly

**Use Cases**:
- Probability introduction (4-5)
- Experimental probability (5-7)
- Law of large numbers (7-Statistics)
- Simulation (Statistics)
- Expected value (Statistics)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `sectors` | array | {label, size (degrees), color} |
| `spinCount` | number | Number of spins completed |
| `results` | array | Outcome history |
| `showTheoretical` | boolean | Display expected probabilities |
| `showFrequencyTable` | boolean | Display outcome frequencies |
| `rapidMode` | boolean | Allow batch spinning |

---

### 6. Calculus Preparation & Advanced

#### 6.1 Secant-Tangent Animator

**Description**: An interactive graph showing a function with a movable secant line that approaches the tangent line as the second point approaches the first.

**Core Interactions**:
- Select point on curve
- Move second point along curve
- Watch secant line approach tangent
- Display slope calculation at each position
- Show limit notation as Δx → 0
- Freeze tangent line at a point

**Use Cases**:
- Derivative concept introduction (Precalc/Calc)
- Instantaneous rate of change (Calc)
- Tangent line equations (Calc)
- Derivative at a point (Calc)
- Limit concept visualization (Calc)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `function` | string | Function to graph |
| `fixedPoint` | number | x-coordinate of fixed point |
| `movingPoint` | number | x-coordinate of second point |
| `showSecant` | boolean | Display secant line |
| `showTangent` | boolean | Display tangent line |
| `showSlope` | boolean | Display calculated slope |
| `showLimit` | boolean | Display limit notation |

---

#### 6.2 Riemann Sum Visualizer

**Description**: A graph with adjustable rectangular approximations for area under a curve. Supports left, right, midpoint, and trapezoidal methods.

**Core Interactions**:
- Select function to integrate
- Adjust number of rectangles
- Choose approximation method
- Watch approximation improve with more rectangles
- Display sum calculation
- Compare to exact integral

**Use Cases**:
- Area under curve introduction (Calc)
- Riemann sum methods (Calc)
- Definite integral concept (Calc)
- Numerical integration (Calc)
- Error analysis (Calc)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `function` | string | Function to integrate |
| `interval` | [a, b] | Integration bounds |
| `rectangles` | number | Number of subdivisions |
| `method` | enum | `left`, `right`, `midpoint`, `trapezoid` |
| `showSum` | boolean | Display numerical approximation |
| `showExact` | boolean | Display exact integral value |
| `animate` | boolean | Smooth rectangle count changes |

---

#### 6.3 Vector Field Display

**Description**: A 2D plane with vector arrows showing direction and magnitude at each point. Foundation for multivariable calculus concepts.

**Core Interactions**:
- Define vector field function
- Adjust grid density
- Scale vector length display
- Trace flow lines (integral curves)
- Add particles to visualize flow
- Overlay scalar field as color

**Use Cases**:
- Vector visualization (Precalc)
- Slope fields for DEs (Calc)
- Gradient fields (Calc 3)
- Fluid flow (applications)
- Electric/magnetic fields (physics)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `fieldFunction` | {Fx, Fy} | Vector components |
| `xRange` | [min, max] | Horizontal bounds |
| `yRange` | [min, max] | Vertical bounds |
| `gridDensity` | number | Vectors per unit |
| `vectorScale` | number | Length scaling factor |
| `showFlowLines` | boolean | Display integral curves |
| `colorByMagnitude` | boolean | Color vectors by length |

---

#### 6.4 Parametric Curve Tracer

**Description**: An animated graph showing a point moving along a curve defined by parametric equations x(t) and y(t). Displays velocity vectors and traces the path.

**Core Interactions**:
- Define x(t) and y(t) functions
- Play/pause animation
- Adjust parameter range and speed
- Show velocity and acceleration vectors
- Trace curve with parameter labels
- Display direction of motion

**Use Cases**:
- Parametric equations (Precalc)
- Motion in plane (Calc)
- Vector-valued functions (Calc 3)
- Physics kinematics (applications)
- Complex motion analysis (advanced)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `xFunction` | string | x(t) expression |
| `yFunction` | string | y(t) expression |
| `tRange` | [min, max] | Parameter interval |
| `animationSpeed` | number | Playback speed |
| `showVelocity` | boolean | Display velocity vector |
| `showAcceleration` | boolean | Display acceleration vector |
| `showPath` | boolean | Draw curve trace |
| `showTLabels` | boolean | Mark t values along curve |

---

### 7. Cross-Cutting Tools

#### 7.1 Calculator Pad

**Description**: A context-aware calculator that adapts to the current problem type. Supports basic, scientific, graphing, and statistical modes.

**Core Interactions**:
- Standard calculation entry
- Expression history with edit/reuse
- Memory functions
- Mode switching based on problem context
- Copy results to other primitives
- Show calculation steps (optional)

**Use Cases**:
- All mathematical contexts
- Checking work
- Complex calculations
- Statistical calculations
- Expression evaluation

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `mode` | enum | `basic`, `scientific`, `graphing`, `statistics` |
| `showHistory` | boolean | Display calculation history |
| `showSteps` | boolean | Display intermediate steps |
| `precision` | number | Decimal places |
| `availableFunctions` | array | Enabled function buttons |
| `linkToPrimitive` | ref | Send results to other component |

---

#### 7.2 Scratchpad / Whiteboard

**Description**: A freeform drawing and annotation area for student work, with handwriting recognition for mathematical expressions.

**Core Interactions**:
- Freehand drawing with pen/stylus
- Shape recognition (optional)
- Handwriting to LaTeX conversion
- Text and typed math insertion
- Multiple pages
- Export work as image

**Use Cases**:
- Showing work (all levels)
- Rough calculations
- Diagram sketching
- Problem-solving process
- Geometric constructions (freehand)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `tools` | array | Available drawing tools |
| `backgroundColor` | color | Canvas color |
| `gridLines` | enum | `none`, `lined`, `grid`, `dotted` |
| `handwritingRecognition` | boolean | Convert writing to text/math |
| `pages` | number | Number of available pages |
| `readOnly` | boolean | View only mode |

---

#### 7.3 Step-by-Step Solution Builder

**Description**: A structured interface for showing mathematical work with justifications. Each step connects to the next with explicit reasoning.

**Core Interactions**:
- Enter expressions/equations per step
- Select or type justification for each step
- System validates step correctness
- Highlight changes between steps
- Branch for alternative solution paths
- Generate from solution or build manually

**Use Cases**:
- Equation solving (6+)
- Proof writing (Geometry+)
- Algebraic manipulation (Algebra+)
- Calculus solutions (Calc)
- Learning to show work (all levels)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `steps` | array | {expression, justification, valid} |
| `validateSteps` | boolean | Check correctness |
| `justificationOptions` | array | Selectable reason list |
| `allowBranching` | boolean | Multiple solution paths |
| `showHighlights` | boolean | Mark changes between steps |
| `autoGenerate` | boolean | Build from final answer |

---

## Technical Requirements

### State Management

All primitives must implement:

```typescript
interface PrimitiveState {
  // Unique identifier
  id: string;
  
  // Configuration
  config: PrimitiveConfig;
  
  // Current state (student interaction)
  state: any;
  
  // Serialization
  serialize(): string;
  deserialize(data: string): void;
  
  // Event emission
  onChange(callback: (state: any) => void): void;
  
  // Validation
  validate(): ValidationResult;
  
  // Comparison
  compare(targetState: any): ComparisonResult;
}
```

### Accessibility Requirements

Each primitive must support:
- Full keyboard navigation
- Screen reader descriptions
- High contrast mode
- Reduced motion mode
- Touch and pointer input
- Minimum touch target size (44x44px)

### Performance Requirements

- Initial render: < 100ms
- State update: < 16ms (60fps interactions)
- Serialization: < 50ms
- Maximum bundle size per primitive: 50KB gzipped

### Integration Points

Each primitive integrates with:
- Problem generation system (receiving configurations)
- Assessment system (submitting state for grading)
- Hint system (highlighting relevant portions)
- Audio narration (providing descriptions)
- Progress tracking (emitting interaction events)

---

## Implementation Priority

### Phase 1: Core Foundations
1. Number Line
2. Fraction Bar
3. Tape Diagram
4. Coordinate Graph (2D)
5. Shape Canvas
6. Calculator Pad

### Phase 2: Arithmetic & Early Algebra
7. Base-10 Blocks
8. Area Model
9. Array/Grid
10. Balance/Scale Model
11. Function Machine

### Phase 3: Proportional Reasoning & Data
12. Ratio Table
13. Double Number Line
14. Percent Bar
15. Dot Plot
16. Box-and-Whisker Plot

### Phase 4: Advanced Algebra & Geometry
17. Systems of Equations Visualizer
18. Expression Tree
19. Transformation Toolkit
20. Circle Diagram
21. Protractor

### Phase 5: Statistics & Probability
22. Histogram
23. Tree Diagram
24. Two-Way Table
25. Spinner/Random Sampler

### Phase 6: Advanced & Calculus Prep
26. 3D Coordinate System
27. Matrix Display
28. Secant-Tangent Animator
29. Riemann Sum Visualizer
30. Parametric Curve Tracer
31. Vector Field Display

### Phase 7: Supporting Tools
32. Place Value Chart
33. Factor Tree
34. Net Folder
35. Unit Tiling
36. Mapping Diagram
37. Slope Triangle Overlay
38. Formula Explainer
39. Table-Graph-Equation Linker
40. Scratchpad/Whiteboard
41. Step-by-Step Solution Builder

---

## Appendix: Grade-Level Mapping

| Grade | Primary Primitives |
|-------|-------------------|
| K | Number Line, Base-10 Blocks (ones only), Array, Shape Canvas |
| 1 | Number Line, Base-10 Blocks, Tape Diagram, Balance Model |
| 2 | Number Line, Base-10 Blocks, Fraction Bar, Array, Tape Diagram |
| 3 | Fraction Bar, Area Model, Array, Shape Canvas, Tape Diagram |
| 4 | Fraction Bar, Area Model, Factor Tree, Protractor, Tape Diagram |
| 5 | Coordinate Graph, Area Model, Volume Tiling, Dot Plot, Tape Diagram |
| 6 | Ratio Table, Double Number Line, Percent Bar, Histogram, Box Plot |
| 7 | Coordinate Graph, Percent Bar, Tree Diagram, Two-Way Table |
| 8 | Coordinate Graph, Systems Visualizer, Transformation Toolkit, Function Tools |
| Algebra | Expression Tree, Table-Graph-Equation, Matrix, Formula Explainer |
| Geometry | Shape Canvas, Transformation Toolkit, Circle Diagram, 3D System |
| Algebra 2 | Systems, Matrix, Function Families, Statistics Tools |
| Precalc | Parametric Curves, Vectors, 3D Graphing |
| Calculus | Secant-Tangent, Riemann Sum, Vector Field |
