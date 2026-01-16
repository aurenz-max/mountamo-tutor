# K-5 Engineering Visual Primitives
## Product Requirements Document

### Overview

This document defines interactive visual primitives for elementary engineering education (grades K-5) within the Lumina platform. These primitives bring engineering concepts to life through construction, machines, and building themes—leveraging children's natural fascination with excavators, cranes, bridges, and how things work.

### Design Principles

1. **Hands-On Discovery**: Every primitive simulates real-world manipulation—digging, lifting, building, testing
2. **Authentic Contexts**: Problems feature real construction scenarios, not abstract puzzles
3. **Failure as Learning**: Safe experimentation with structural failure, load limits, and design iteration
4. **Progressive Complexity**: Simple "play" modes for K-1, engineering constraints that unlock for grades 2-5
5. **Cross-Curricular Integration**: Primitives connect to math (measurement, geometry), science (forces, materials), and literacy (technical vocabulary)
6. **State Serialization**: All primitives must serialize state for problem authoring and student response capture

---

## Primitives by Domain

### 1. Simple Machines & Mechanical Advantage

#### 1.1 Lever Lab

**Description**: An interactive lever/fulcrum system where students place loads and effort forces at different positions. Directly connects to how excavator arms, seesaws, and crowbars work.

**Core Interactions**:
- Drag fulcrum position along beam
- Place weighted objects at positions along lever
- Apply effort force and observe lift/no-lift
- Measure distances from fulcrum
- Calculate mechanical advantage (grades 3-5)

**Use Cases**:
- Balance and equality concepts (K-1)
- Fulcrum position effects (1-2)
- Load vs effort trade-offs (2-3)
- Mechanical advantage calculation (4-5)
- Real-world connections: excavator boom, wheelbarrow, bottle opener

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `beamLength` | number | Length of lever in units |
| `fulcrumPosition` | number | Initial fulcrum placement |
| `fixedFulcrum` | boolean | Lock fulcrum in place |
| `loads` | array | {position, weight, icon} objects |
| `showDistances` | boolean | Display measurement labels |
| `showMA` | boolean | Display mechanical advantage ratio |
| `effortInput` | enum | `drag`, `slider`, `numeric` |
| `theme` | enum | `seesaw`, `excavator`, `crowbar`, `generic` |

---

#### 1.2 Pulley System Builder

**Description**: A configurable pulley system where students arrange fixed and movable pulleys to lift loads. Shows how cranes and construction hoists multiply force.

**Core Interactions**:
- Add/remove pulleys (fixed and movable)
- Thread rope through pulley system
- Attach loads and observe rope tension
- Pull rope and watch load rise
- Measure force required vs load weight

**Use Cases**:
- Ropes and lifting (K-1)
- Single pulley direction change (1-2)
- Multiple pulleys reduce effort (2-3)
- Counting rope segments for MA (3-4)
- Pulley system design challenges (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `fixedPulleys` | array | Positions of fixed pulleys |
| `movablePulleys` | array | Positions of movable pulleys |
| `loadWeight` | number | Weight to lift |
| `ropeConfiguration` | array | Threading path |
| `showForceLabels` | boolean | Display tension values |
| `showRopeSegments` | boolean | Highlight and count segments |
| `maxPulleys` | number | Limit for building mode |
| `theme` | enum | `crane`, `flagpole`, `well`, `construction` |

---

#### 1.3 Inclined Plane / Ramp Lab

**Description**: A ramp with adjustable angle where students move loads up slopes. Connects to loading docks, dump trucks, and wheelchair ramps.

**Core Interactions**:
- Adjust ramp angle with slider or drag
- Place objects on ramp (roll vs slide)
- Apply push force to move load up
- Measure height, length, and angle
- Compare force needed at different angles

**Use Cases**:
- Rolling vs sliding exploration (K-1)
- Steeper = harder to push (1-2)
- Height vs length trade-off (2-3)
- Calculating slope advantage (4-5)
- Real-world design: ADA ramps, loading docks

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `rampLength` | number | Length of ramp surface |
| `rampAngle` | number | Angle in degrees (or height) |
| `adjustableAngle` | boolean | Allow student control |
| `loadWeight` | number | Object weight |
| `loadType` | enum | `box`, `barrel`, `wheel`, `custom` |
| `showMeasurements` | boolean | Display h, l, angle |
| `frictionLevel` | enum | `none`, `low`, `medium`, `high` |
| `theme` | enum | `loading_dock`, `dump_truck`, `skateboard`, `generic` |

---

#### 1.4 Wheel & Axle Explorer

**Description**: Interactive wheels of different sizes connected to axles. Students discover how steering wheels, doorknobs, and winches multiply force.

**Core Interactions**:
- Rotate wheel with drag gesture
- Observe axle rotation and force multiplication
- Adjust wheel and axle diameters
- Attach loads to axle (lift with wheel turn)
- Compare different wheel/axle ratios

**Use Cases**:
- Wheels make moving easier (K-1)
- Doorknobs vs handles (1-2)
- Bigger wheel = easier turn (2-3)
- Gear ratio introduction (4-5)
- Real-world: steering wheel, winch, screwdriver

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `wheelDiameter` | number | Size of outer wheel |
| `axleDiameter` | number | Size of inner axle |
| `adjustable` | boolean | Allow resizing |
| `attachedLoad` | number | Weight on axle rope |
| `showRatio` | boolean | Display diameter ratio |
| `showForce` | boolean | Display force values |
| `rotationInput` | enum | `drag`, `buttons`, `slider` |
| `theme` | enum | `steering_wheel`, `winch`, `doorknob`, `well_crank` |

---

#### 1.5 Gear Train Builder

**Description**: A sandbox for connecting gears of different sizes. Students discover speed/torque trade-offs fundamental to all machinery.

**Core Interactions**:
- Place gears on pegs/grid
- Connect gears by proximity (auto-mesh)
- Rotate driver gear, watch followers spin
- Count teeth and observe speed ratios
- Build gear chains for specific ratios

**Use Cases**:
- Gears turn together (K-1)
- Direction changes with each gear (1-2)
- Big gear turns slow gear fast (2-3)
- Counting teeth for ratios (3-4)
- Design challenges: specific output speed (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `availableGears` | array | Gear sizes (by tooth count) |
| `gridSize` | [rows, cols] | Workspace dimensions |
| `driverGear` | index | Which gear receives input |
| `showTeethCount` | boolean | Label gear teeth |
| `showSpeedRatio` | boolean | Display rotation ratio |
| `showDirection` | boolean | Indicate CW/CCW |
| `targetRatio` | number | Goal for design challenges |
| `maxGears` | number | Limit for scaffolded problems |

---

### 2. Structures & Building

#### 2.1 Bridge Builder

**Description**: A 2D bridge construction canvas where students place beams, trusses, and supports to span gaps. Bridges are tested with loads (trucks, trains) to see if they hold.

**Core Interactions**:
- Place structural members (beams, cables, supports)
- Connect members at joints
- Set support points (anchors)
- Apply load and run stress test
- Watch bridge deform/fail under load
- View stress coloring (green→yellow→red)

**Use Cases**:
- Connecting two sides (K-1)
- Supports at edges vs middle (1-2)
- Triangles are strong (2-3)
- Load distribution concepts (3-4)
- Truss design optimization (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `spanWidth` | number | Gap to bridge |
| `availablePieces` | array | Types and quantities of members |
| `anchorPoints` | array | Valid support positions |
| `loadType` | enum | `car`, `truck`, `train`, `point_load` |
| `loadWeight` | number | Force to apply |
| `loadPosition` | number | Where load crosses |
| `showStress` | boolean | Color members by load |
| `budget` | number | Optional piece limit |
| `materialStrength` | object | Breaking threshold per type |

---

#### 2.2 Tower Stacker

**Description**: A vertical building challenge where students stack blocks, beams, and shapes to reach target heights while maintaining stability. Foundation for understanding compression and center of gravity.

**Core Interactions**:
- Drag and place building pieces
- Rotate pieces before placement
- Stack pieces (snap to grid or freeform)
- Apply wind/shake force to test stability
- Watch tower sway and potentially topple
- Measure total height achieved

**Use Cases**:
- Stacking and balance (K)
- Wider base = more stable (K-1)
- Center of gravity exploration (2-3)
- Material efficiency (height per piece) (3-4)
- Wind resistance design (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `availablePieces` | array | Block types and quantities |
| `targetHeight` | number | Goal height to reach |
| `gridMode` | boolean | Snap to grid vs freeform |
| `enableWind` | boolean | Apply lateral force test |
| `windStrength` | number | Force of wind test |
| `showCenterOfGravity` | boolean | Display CoG indicator |
| `showHeight` | boolean | Display measurement |
| `groundWidth` | number | Available foundation space |

---

#### 2.3 Shape Strength Tester

**Description**: An experimental rig that tests different 2D shapes (triangle, square, pentagon, etc.) under load. Students discover why triangles dominate structural engineering.

**Core Interactions**:
- Select or build shape from straws/sticks
- Mount shape in testing frame
- Apply compressive force from top
- Watch shape deform or hold
- Compare rigidity across shapes
- Add diagonal bracing to weak shapes

**Use Cases**:
- Shape recognition in building (K-1)
- Squares squish, triangles don't (1-2)
- Adding diagonals makes squares strong (2-3)
- Triangulation principles (3-4)
- Truss analysis (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `shapeType` | enum | `triangle`, `square`, `pentagon`, `hexagon`, `custom` |
| `jointType` | enum | `pinned`, `rigid` |
| `showDeformation` | boolean | Animate shape change under load |
| `allowBracing` | boolean | Add diagonal members |
| `loadIncrement` | number | Force step size |
| `compareMode` | boolean | Side-by-side shape testing |
| `stickMaterial` | enum | `straw`, `wood`, `steel` |

---

#### 2.4 Foundation Builder

**Description**: A soil/foundation simulator where students design footings to support structures. Explores why buildings need foundations and how soil type matters.

**Core Interactions**:
- Select soil type (rock, sand, clay, mud)
- Design footing shape and size
- Place building load on foundation
- Watch for settling or sinking
- Adjust foundation to prevent failure
- Compare pressure distribution

**Use Cases**:
- Buildings need foundations (K-1)
- Bigger footings spread weight (1-2)
- Different soils hold different loads (2-3)
- Pressure = force ÷ area (3-4)
- Foundation design for soil types (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `soilType` | enum | `rock`, `gravel`, `sand`, `clay`, `mud` |
| `soilCapacity` | number | Bearing capacity (derived from type) |
| `buildingLoad` | number | Weight to support |
| `foundationType` | enum | `spread`, `strip`, `slab`, `piles` |
| `showPressure` | boolean | Display force/area calculation |
| `showSettlement` | boolean | Animate sinking |
| `designMode` | boolean | Allow custom footing shapes |

---

#### 2.5 Wall Framing Canvas

**Description**: A 2D wall builder where students place studs, headers, and plates to frame walls with door/window openings. Connects to real house construction.

**Core Interactions**:
- Place vertical studs at intervals
- Add top and bottom plates
- Create openings (cut studs)
- Add headers above openings
- Add jack and king studs for support
- Test wall under roof load

**Use Cases**:
- Walls have frames inside (K-1)
- Studs are evenly spaced (1-2)
- Openings need extra support (2-3)
- Header sizing for span (3-4)
- Load path concepts (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `wallLength` | number | Total wall span |
| `wallHeight` | number | Floor to ceiling |
| `studSpacing` | enum | `16_inch`, `24_inch`, `custom` |
| `openings` | array | {type, position, width} for doors/windows |
| `showLoadPath` | boolean | Visualize force flow |
| `showLabels` | boolean | Name framing members |
| `guidedMode` | boolean | Highlight required pieces |
| `structureLoad` | number | Roof weight to test |

---

### 3. Construction Vehicles & Mechanisms

#### 3.1 Excavator Arm Simulator

**Description**: A multi-jointed excavator arm with boom, stick, and bucket. Students control each joint to dig, lift, and dump—experiencing hydraulics and kinematics.

**Core Interactions**:
- Control boom angle (base joint)
- Control stick angle (middle joint)
- Control bucket angle (end joint)
- Dig into material layers
- Lift and move bucket contents
- Dump material at target location

**Use Cases**:
- Cause and effect with joints (K-1)
- Reach and range exploration (1-2)
- Sequencing dig operations (2-3)
- Joint angle coordination (3-4)
- Reach envelope and efficiency (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `boomLength` | number | Length of boom segment |
| `stickLength` | number | Length of stick segment |
| `bucketSize` | number | Capacity of bucket |
| `jointControl` | enum | `sliders`, `buttons`, `drag` |
| `showAngles` | boolean | Display joint angles |
| `showReach` | boolean | Display reach envelope |
| `terrainProfile` | array | Ground/material heights |
| `targetZone` | object | Dump target location |
| `materialLayers` | array | Soil types and colors |

---

#### 3.2 Crane Operator Station

**Description**: A tower or mobile crane simulator with boom rotation, cable length, and load swing physics. Students learn to position loads precisely.

**Core Interactions**:
- Rotate crane boom (slew)
- Extend/retract boom (if telescopic)
- Raise/lower cable (hoist)
- Control load swing (damping)
- Pick up and place loads at targets
- Monitor load weight vs capacity

**Use Cases**:
- Up/down, left/right control (K-1)
- Swing and timing (1-2)
- Precision placement (2-3)
- Load charts (what can lift what) (3-4)
- Boom angle vs capacity trade-off (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `craneType` | enum | `tower`, `mobile`, `crawler` |
| `boomLength` | number | Reach of boom |
| `cableLength` | number | Initial cable length |
| `loadWeight` | number | Attached load |
| `swingPhysics` | boolean | Enable pendulum motion |
| `showLoadChart` | boolean | Display capacity graph |
| `pickupZone` | object | Starting load position |
| `dropZones` | array | Target positions |
| `obstacles` | array | Things to avoid |

---

#### 3.3 Dump Truck Loader

**Description**: A simulation of loading and hauling material. Students fill trucks to capacity, manage weight distribution, and dump at destinations.

**Core Interactions**:
- Load material into truck bed
- Monitor fill level and weight
- Drive to dump location (simple path)
- Raise bed to dump angle
- Control dump rate
- Return for next load

**Use Cases**:
- Full and empty concepts (K)
- Capacity and "too much" (K-1)
- Counting loads (1-2)
- Weight limits and distribution (2-3)
- Efficiency (loads per time) (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `truckCapacity` | number | Maximum load weight |
| `bedVolume` | number | Maximum load volume |
| `materialType` | enum | `dirt`, `gravel`, `sand`, `debris` |
| `materialDensity` | number | Weight per volume |
| `showWeight` | boolean | Display load weight |
| `showFillLevel` | boolean | Display volume used |
| `tripDistance` | number | Haul route length |
| `sourceSize` | number | Total material to move |

---

#### 3.4 Hydraulic System Demo

**Description**: A connected hydraulic cylinder system showing how pressing one cylinder moves another. Foundation for understanding all hydraulic machinery.

**Core Interactions**:
- Push/pull on input cylinder
- Watch fluid transfer through lines
- Observe output cylinder movement
- Adjust cylinder diameters
- Calculate force multiplication
- Build multi-cylinder systems

**Use Cases**:
- Push here, move there (K-1)
- Connected movement (1-2)
- Big cylinder + small cylinder relationship (2-3)
- Force multiplication (3-4)
- Hydraulic system design (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `inputDiameter` | number | Input cylinder size |
| `outputDiameter` | number | Output cylinder size |
| `fluidColor` | color | Hydraulic fluid display |
| `showFluidFlow` | boolean | Animate fluid movement |
| `showForceLabels` | boolean | Display force values |
| `showAreaLabels` | boolean | Display cylinder areas |
| `multiCylinder` | boolean | Allow complex systems |
| `pressureGauge` | boolean | Show system pressure |

---

### 4. Materials & Properties

#### 4.1 Material Tester

**Description**: A testing machine that applies force to material samples. Students discover properties like strength, flexibility, and brittleness.

**Core Interactions**:
- Select material sample
- Choose test type (stretch, compress, bend)
- Apply increasing force
- Watch material respond (stretch, compress, crack)
- Record breaking point or behavior
- Compare materials side by side

**Use Cases**:
- Hard vs soft exploration (K)
- Stretchy vs stiff (K-1)
- Bendable vs breakable (1-2)
- Strength comparisons (2-3)
- Material selection for purpose (3-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `materials` | array | Available material types |
| `testType` | enum | `tension`, `compression`, `bending`, `all` |
| `showForceGraph` | boolean | Plot force vs deformation |
| `showBreakingPoint` | boolean | Mark failure threshold |
| `compareMode` | boolean | Test two materials simultaneously |
| `sampleSize` | object | Dimensions of test piece |
| `forceIncrement` | number | Load step size |

**Material Options**:
| Material | Properties |
|----------|------------|
| `wood` | Strong, splinters, moderate flex |
| `steel` | Very strong, stiff, bends then holds |
| `rubber` | Stretchy, returns to shape |
| `concrete` | Strong compression, weak tension, brittle |
| `rope` | Strong tension only, flexible |
| `glass` | Stiff, brittle, sudden break |
| `foam` | Soft, compressible, weak |
| `plastic` | Moderate strength, some flex |

---

#### 4.2 Beam Deflection Tester

**Description**: A horizontal beam supported at ends with loads applied. Students see beams bend and measure deflection—foundation for structural engineering.

**Core Interactions**:
- Place beam on supports
- Apply point loads at positions
- Watch beam deflect (sag)
- Measure deflection amount
- Change beam material or thickness
- Compare different beam configurations

**Use Cases**:
- Beams bend under weight (K-1)
- More load = more bend (1-2)
- Thicker beams bend less (2-3)
- Material affects stiffness (3-4)
- Span length effects (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `beamLength` | number | Length of beam |
| `beamMaterial` | enum | `wood`, `steel`, `aluminum`, `plastic` |
| `beamThickness` | number | Cross-section size |
| `supportPositions` | array | Where beam is held |
| `loads` | array | {position, weight} objects |
| `showDeflection` | boolean | Display bend measurement |
| `showDeflectionCurve` | boolean | Draw deformed shape |
| `maxDeflection` | number | Failure threshold |

---

#### 4.3 Concrete Mix Lab

**Description**: A mixing station where students combine cement, sand, gravel, and water in different ratios. Cured samples are tested for strength.

**Core Interactions**:
- Add ingredients by proportion
- Mix materials together
- Pour into mold
- Wait for curing (accelerated)
- Test cured sample strength
- Record and compare recipes

**Use Cases**:
- Mixing materials (K-1)
- Ratios and recipes (1-2)
- More cement isn't always better (2-3)
- Water-cement ratio effects (3-4)
- Optimization for strength vs cost (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `ingredients` | array | Available materials |
| `maxBatchSize` | number | Container capacity |
| `cureTime` | number | Simulated cure duration |
| `showRatios` | boolean | Display mix proportions |
| `showStrengthTest` | boolean | Include compression test |
| `costMode` | boolean | Assign costs to ingredients |
| `targetStrength` | number | Goal for challenges |

---

### 5. Design & Problem-Solving

#### 5.1 Blueprint Canvas

**Description**: A grid-based drawing surface for creating top-down and side-view plans. Students learn to communicate designs before building.

**Core Interactions**:
- Draw lines and shapes on grid
- Add dimension labels
- Switch between views (top, front, side)
- Add standard symbols (door, window, etc.)
- Trace from photo underlay
- Export/share designs

**Use Cases**:
- Bird's eye view concept (K-1)
- Drawing simple floor plans (1-2)
- Adding measurements (2-3)
- Multiple view correspondence (3-4)
- Scale drawings (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `gridSize` | [rows, cols] | Canvas dimensions |
| `gridScale` | number | Units per grid square |
| `showGrid` | boolean | Display grid lines |
| `snapToGrid` | boolean | Constrain to intersections |
| `tools` | array | Available drawing tools |
| `symbolLibrary` | array | Available standard symbols |
| `viewType` | enum | `plan`, `elevation`, `section`, `3d` |
| `underlayImage` | url | Reference image |

---

#### 5.2 Constraint Puzzle Builder

**Description**: Design challenges with specific requirements and limitations. Students must create solutions meeting all constraints—core engineering thinking.

**Core Interactions**:
- Read constraint requirements
- Build/design solution
- Test against each constraint
- See pass/fail for each requirement
- Iterate to meet all constraints
- Compare efficiency of solutions

**Use Cases**:
- Following simple rules (K-1)
- Meeting two requirements (1-2)
- Balancing competing constraints (2-3)
- Optimization within limits (3-4)
- Multi-constraint design (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `constraints` | array | {type, condition, weight} requirements |
| `builderPrimitive` | ref | Which building tool to use |
| `showConstraintStatus` | boolean | Live pass/fail indicators |
| `allowPartialSuccess` | boolean | Score partial solutions |
| `hintLevel` | enum | `none`, `gentle`, `detailed` |
| `exemplarSolution` | object | Reference solution for comparison |

**Constraint Types**:
| Type | Example Conditions |
|------|-------------------|
| `height` | Must reach X, cannot exceed Y |
| `span` | Must bridge gap of X |
| `load` | Must support X weight |
| `pieces` | Must use ≤ X pieces |
| `cost` | Must cost ≤ $X |
| `material` | Must use/avoid certain materials |
| `stability` | Must survive X wind/shake |

---

#### 5.3 Failure Analysis Tool

**Description**: A post-mortem tool for examining why structures failed. Students identify weak points and propose improvements—learning from failure.

**Core Interactions**:
- View failed structure (frozen at failure)
- Examine stress at each point
- Identify failure initiation point
- Propose modification
- Test modification
- Compare before/after

**Use Cases**:
- What broke? (K-1)
- Why did it break there? (1-2)
- How to make it stronger (2-3)
- Weakest link analysis (3-4)
- Systematic improvement (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `failedStructure` | object | Structure state at failure |
| `showStressMap` | boolean | Display stress coloring |
| `showFailurePoint` | boolean | Highlight break location |
| `allowModification` | boolean | Enable student fixes |
| `modificationBudget` | number | Pieces allowed to add |
| `showForceFlow` | boolean | Display load paths |
| `guidedAnalysis` | boolean | Step-by-step prompts |

---

### 6. Measurement & Surveying

#### 6.1 Construction Ruler & Tape

**Description**: Virtual measuring tools matching real construction equipment. Students measure lengths, mark cut lines, and verify dimensions.

**Core Interactions**:
- Extend/retract tape measure
- Snap to object endpoints
- Read measurements (imperial/metric)
- Mark positions for cutting
- Verify if measurement matches target
- Convert between units (grades 3+)

**Use Cases**:
- Measuring length (K-1)
- Reading a tape measure (1-2)
- Measuring to nearest 1/4 inch (2-3)
- Fractional inches (3-4)
- Unit conversion (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `units` | enum | `inches`, `feet`, `centimeters`, `meters` |
| `precision` | enum | `whole`, `half`, `quarter`, `eighth`, `sixteenth` |
| `maxLength` | number | Tape capacity |
| `showFractions` | boolean | Display fractional marks |
| `targetMeasurement` | number | Expected answer |
| `objectToMeasure` | object | Thing being measured |
| `convertMode` | boolean | Include unit conversion |

---

#### 6.2 Level & Plumb Checker

**Description**: Virtual spirit level and plumb bob for checking horizontal and vertical alignment—critical skills for real construction.

**Core Interactions**:
- Place level on surface
- Read bubble position
- Adjust object until level
- Drop plumb bob from point
- Check vertical alignment
- Measure off-level angle

**Use Cases**:
- Level vs tilted (K-1)
- Horizontal concept (1-2)
- Plumb/vertical concept (1-2)
- Measuring tilt amount (3-4)
- Correcting out-of-level work (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `toolType` | enum | `level`, `plumb`, `both` |
| `sensitivity` | number | How visible small tilts are |
| `showAngle` | boolean | Display tilt in degrees |
| `adjustableObject` | boolean | Allow student to fix alignment |
| `tolerance` | number | Acceptable deviation |
| `targetAlignment` | enum | `level`, `plumb`, `specific_angle` |

---

#### 6.3 Area & Volume Calculator

**Description**: A construction-focused measurement tool for calculating material quantities—square footage, cubic yards, coverage amounts.

**Core Interactions**:
- Define shapes by dimensions
- Calculate area automatically
- Extend to volume for 3D shapes
- Add/subtract regions (complex shapes)
- Convert to construction units
- Estimate material needs

**Use Cases**:
- Counting squares (K-1)
- Rectangle area by formula (2-3)
- Compound shapes (3-4)
- Volume of rectangular prisms (4-5)
- Material estimation (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `shapeType` | enum | `rectangle`, `triangle`, `circle`, `compound`, `prism` |
| `inputMode` | enum | `draw`, `dimensions`, `both` |
| `outputUnits` | enum | `sq_ft`, `sq_yd`, `cu_ft`, `cu_yd` |
| `showFormula` | boolean | Display calculation |
| `materialMode` | boolean | Calculate coverage/fill needs |
| `materialCoverage` | number | Area per unit of material |
| `materialDepth` | number | Thickness for volume |

---

### 7. Site & Environment

#### 7.1 Terrain Editor

**Description**: A moldable landscape where students create hills, valleys, trenches, and slopes. Foundation for understanding grading and earthwork.

**Core Interactions**:
- Raise/lower terrain with brush
- Cut trenches and channels
- Create level pads
- Add water and watch flow
- Measure elevations
- Calculate cut/fill volumes

**Use Cases**:
- Up and down landscape (K-1)
- Water flows downhill (K-1)
- Making flat areas (1-2)
- Drainage concepts (2-3)
- Cut and fill balance (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `terrainSize` | [width, depth] | Area dimensions |
| `initialProfile` | array | Starting elevation data |
| `brushSize` | number | Edit tool size |
| `editMode` | enum | `raise`, `lower`, `flatten`, `smooth` |
| `showContours` | boolean | Display elevation lines |
| `showWaterFlow` | boolean | Simulate drainage |
| `showCutFill` | boolean | Display volume calculations |
| `targetProfile` | array | Goal terrain shape |

---

#### 7.2 Site Layout Planner

**Description**: An overhead view canvas for positioning buildings, roads, and utilities on a site. Students learn spatial planning and setbacks.

**Core Interactions**:
- Place buildings on site
- Add roads and driveways
- Position utilities
- Check setback requirements
- Measure distances between elements
- Calculate coverage percentages

**Use Cases**:
- Things need space (K-1)
- Buildings don't touch property lines (1-2)
- Paths connecting places (2-3)
- Setback rules (3-4)
- Zoning and coverage limits (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `siteShape` | object | Property boundaries |
| `siteArea` | number | Total site area |
| `availableElements` | array | Buildings, features to place |
| `setbackRules` | object | Required distances from edges |
| `coverageLimit` | number | Maximum building coverage % |
| `showMeasurements` | boolean | Display distances |
| `showCoverage` | boolean | Display coverage calculation |
| `existingElements` | array | Fixed site features |

---

### 8. Safety & Process

#### 8.1 Safety Equipment Matcher

**Description**: An interactive activity matching construction tasks to required personal protective equipment (PPE). Building safety awareness.

**Core Interactions**:
- View construction task/hazard
- Select appropriate PPE items
- Check if selection is correct
- Learn why each item is needed
- Complete full PPE loadout

**Use Cases**:
- Safety gear identification (K-1)
- Matching gear to danger (1-2)
- Understanding why each item (2-3)
- Hazard identification (3-4)
- Complete safety planning (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `scenario` | object | Task and hazards present |
| `availablePPE` | array | Equipment options |
| `requiredPPE` | array | Correct answer set |
| `showExplanations` | boolean | Explain why each is needed |
| `hazardHighlight` | boolean | Point out danger sources |
| `multipleScenarios` | boolean | Series of situations |

**PPE Items**:
| Item | Protects Against |
|------|-----------------|
| `hard_hat` | Falling objects, head bumps |
| `safety_glasses` | Flying debris, dust |
| `ear_protection` | Loud noise |
| `gloves` | Cuts, splinters, chemicals |
| `steel_toe_boots` | Dropped objects, punctures |
| `high_vis_vest` | Not being seen by vehicles |
| `dust_mask` | Dust, particles |
| `harness` | Falls from height |

---

#### 8.2 Construction Sequence Planner

**Description**: A timeline/flowchart tool for ordering construction tasks. Students learn that building follows logical sequences.

**Core Interactions**:
- View list of construction tasks
- Arrange tasks in sequence
- Draw dependency arrows
- Check for logical errors
- Run through animated sequence
- Identify what must come first

**Use Cases**:
- First, then, last (K-1)
- Some things must wait (1-2)
- Dependency chains (2-3)
- Parallel vs sequential (3-4)
- Critical path basics (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `tasks` | array | {name, duration, icon} tasks |
| `dependencies` | array | Required orderings |
| `displayMode` | enum | `list`, `flowchart`, `timeline` |
| `showDependencies` | boolean | Draw arrow connections |
| `validateSequence` | boolean | Check logical order |
| `animateSequence` | boolean | Play through build |
| `parallelAllowed` | boolean | Allow concurrent tasks |

**Example Tasks**:
| Task | Typical Dependencies |
|------|---------------------|
| `excavate` | Clear site first |
| `pour_foundation` | Excavation complete |
| `frame_walls` | Foundation cured |
| `roof` | Walls complete |
| `rough_plumbing` | Walls framed, before drywall |
| `electrical` | Walls framed, before drywall |
| `insulation` | Rough-ins inspected |
| `drywall` | Insulation complete |

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

### Physics Simulation Requirements

Engineering primitives require physics fidelity:

- **Structural Analysis**: Simplified finite element for stress visualization
- **Rigid Body**: For balance, tipping, stacking simulations
- **Fluid**: Basic hydraulic simulation (incompressible flow)
- **Particle**: For material flow (dirt, gravel, concrete)

Performance targets:
- Physics step: < 8ms for 60fps interaction
- Structural solve: < 100ms for bridge/tower analysis
- Failure animation: 30fps minimum

### Accessibility Requirements

Each primitive must support:
- Full keyboard navigation
- Screen reader descriptions of mechanical state
- High contrast mode for stress visualization
- Reduced motion mode (instant state changes)
- Touch and pointer input
- Minimum touch target size (44x44px)

### Performance Requirements

- Initial render: < 100ms
- State update: < 16ms (60fps interactions)
- Physics simulation: < 8ms per step
- Serialization: < 50ms
- Maximum bundle size per primitive: 75KB gzipped

### Integration Points

Each primitive integrates with:
- Problem generation system (receiving configurations)
- Assessment system (submitting state for grading)
- Hint system (highlighting relevant portions)
- Audio narration (providing descriptions)
- Progress tracking (emitting interaction events)
- Failure logging (capturing failure states for analysis)

---

## Implementation Priority

### Phase 1: Core Machines & Building
1. Lever Lab
2. Bridge Builder
3. Tower Stacker
4. Excavator Arm Simulator
5. Construction Ruler & Tape

### Phase 2: Mechanisms & Structures
6. Pulley System Builder
7. Shape Strength Tester
8. Crane Operator Station
9. Level & Plumb Checker
10. Beam Deflection Tester

### Phase 3: Advanced Machines
11. Gear Train Builder
12. Inclined Plane / Ramp Lab
13. Wheel & Axle Explorer
14. Hydraulic System Demo
15. Dump Truck Loader

### Phase 4: Design & Materials
16. Blueprint Canvas
17. Material Tester
18. Concrete Mix Lab
19. Constraint Puzzle Builder
20. Failure Analysis Tool

### Phase 5: Site & Environment
21. Terrain Editor
22. Foundation Builder
23. Site Layout Planner
24. Wall Framing Canvas
25. Area & Volume Calculator

### Phase 6: Safety & Process
26. Safety Equipment Matcher
27. Construction Sequence Planner

---

## Appendix: Grade-Level Mapping

| Grade | Primary Primitives |
|-------|-------------------|
| K | Lever Lab (seesaw), Tower Stacker, Safety Matcher, Dump Truck Loader, Material Tester |
| 1 | Lever Lab, Pulley (single), Ramp Lab, Shape Strength, Construction Ruler, Level Check |
| 2 | Bridge Builder (basic), Excavator Arm, Crane Operator, Terrain Editor, Sequence Planner |
| 3 | Pulley System, Gear Train, Bridge Builder, Beam Tester, Blueprint Canvas |
| 4 | Hydraulic Demo, Foundation Builder, Material Tester, Constraint Puzzles, Wall Framing |
| 5 | Full Bridge Builder, Gear Ratios, Failure Analysis, Site Layout, Cut/Fill Calculations |

---

## Appendix: NGSS Alignment

| Standard | Supporting Primitives |
|----------|----------------------|
| K-2-ETS1-1 (Define problems) | Constraint Puzzle Builder, Blueprint Canvas |
| K-2-ETS1-2 (Develop solutions) | Bridge Builder, Tower Stacker, all building tools |
| K-2-ETS1-3 (Compare solutions) | Failure Analysis, Material Tester, Shape Strength |
| 3-5-ETS1-1 (Define criteria) | Constraint Puzzle Builder, Site Layout |
| 3-5-ETS1-2 (Generate solutions) | All building and design primitives |
| 3-5-ETS1-3 (Plan & carry out tests) | All testing primitives, Failure Analysis |
| K-PS2-1 (Pushes and pulls) | Lever Lab, Ramp Lab, Pulley System |
| K-PS2-2 (Motion comparison) | All machine simulators |
| 3-PS2-1 (Forces on motion) | All simple machine primitives |

---

## Appendix: Construction Theme Vocabulary

Each primitive should introduce and reinforce grade-appropriate technical vocabulary:

| Grade | Key Terms |
|-------|-----------|
| K | lift, push, pull, heavy, light, strong, weak, balance, stack |
| 1 | lever, fulcrum, ramp, pulley, load, effort, support, measure |
| 2 | beam, truss, foundation, excavate, hoist, boom, joint, frame |
| 3 | mechanical advantage, force, gear, hydraulic, ratio, stress, span |
| 4 | compression, tension, pressure, deflection, capacity, efficiency |
| 5 | torque, load path, structural failure, optimization, specification |
