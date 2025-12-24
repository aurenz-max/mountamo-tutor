# Physics Education Visual Primitives
## Product Requirements Document

### Overview

This document defines the complete set of interactive visual primitives required for a comprehensive physics education platform spanning middle school through AP/undergraduate levels. Each primitive is a reusable, interactive component that can be embedded in problems, explanations, and assessments across multiple topic areas.

### Design Principles

1. **Physical Realism**: Simulations must accurately reflect physical laws within stated approximations
2. **Visible Abstractions**: Make invisible concepts visible (fields, forces, energy) through appropriate visualization
3. **Quantitative & Qualitative**: Support both conceptual exploration and precise measurement/calculation
4. **Scale Flexibility**: Handle phenomena from subatomic to astronomical scales appropriately
5. **Real-World Connection**: Link idealized models to real-world applications and limitations

---

## Primitives by Domain

### 1. Mechanics - Kinematics

#### 1.1 Motion Diagram / Strobe Diagram

**Description**: A visualization showing object positions at equal time intervals, with optional velocity and acceleration vectors. The foundational representation for understanding motion qualitatively.

**Core Interactions**:
- Watch object move and leave position markers
- Adjust time interval between markers
- Toggle velocity vectors at each position
- Toggle acceleration vectors
- Measure distances between markers
- Create custom motion patterns
- Compare uniform vs accelerated motion

**Use Cases**:
- Introduction to motion (Middle School)
- Velocity concept (Middle School/High School)
- Acceleration concept (High School)
- Projectile motion analysis (High School)
- Circular motion (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `motionType` | enum | `uniform`, `accelerated`, `projectile`, `circular`, `custom` |
| `timeInterval` | number | Seconds between markers |
| `showVelocityVectors` | boolean | Display v arrows |
| `showAccelerationVectors` | boolean | Display a arrows |
| `showPath` | boolean | Draw trajectory line |
| `vectorScale` | number | Size of vector arrows |
| `markerCount` | number | Number of position markers |

---

#### 1.2 Position-Time Graph

**Description**: An interactive x-t graph for analyzing motion, with linked animation showing corresponding object movement.

**Core Interactions**:
- Draw position vs time curve freehand
- Watch object move according to graph
- Calculate velocity from slope
- Identify constant velocity vs acceleration
- Click graph to see corresponding position
- Compare multiple objects' motion
- Generate graph from motion description

**Use Cases**:
- Graphical analysis of motion (Middle School/High School)
- Velocity from slope (High School)
- Matching graphs to motion (High School)
- Multi-object problems (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `xRange` | [min, max] | Position axis bounds |
| `tRange` | [min, max] | Time axis bounds |
| `curves` | array | Position functions or data |
| `showAnimation` | boolean | Linked motion display |
| `showSlope` | boolean | Display tangent/velocity |
| `editMode` | enum | `draw`, `points`, `equation`, `none` |
| `multipleObjects` | boolean | Compare several motions |

---

#### 1.3 Velocity-Time Graph

**Description**: An interactive v-t graph showing velocity changes over time, with displacement calculation from area under curve.

**Core Interactions**:
- Draw or edit velocity vs time
- Calculate displacement from area
- Calculate acceleration from slope
- Link to position-time graph
- Link to motion animation
- Shade areas for displacement
- Identify positive/negative velocity regions

**Use Cases**:
- Velocity graphs (High School)
- Area under curve = displacement (High School)
- Acceleration from slope (High School)
- Kinematic problem solving (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `vRange` | [min, max] | Velocity axis bounds |
| `tRange` | [min, max] | Time axis bounds |
| `curves` | array | Velocity functions or data |
| `showArea` | boolean | Shade displacement area |
| `showSlope` | boolean | Display acceleration |
| `linkToXT` | boolean | Show corresponding x-t graph |
| `linkToAnimation` | boolean | Show motion animation |

---

#### 1.4 Acceleration-Time Graph

**Description**: An a-t graph completing the kinematic graph trio, showing acceleration changes and linking to velocity through area.

**Core Interactions**:
- Display acceleration vs time
- Calculate velocity change from area
- Link to v-t and x-t graphs
- Identify constant vs changing acceleration
- Handle impulsive forces (spikes)
- Compare to motion animation

**Use Cases**:
- Complete graph analysis (High School)
- Non-uniform acceleration (AP/College)
- Impulse connection (AP/College)
- Jerk and higher derivatives (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `aRange` | [min, max] | Acceleration axis bounds |
| `tRange` | [min, max] | Time axis bounds |
| `curves` | array | Acceleration functions or data |
| `showArea` | boolean | Shade Δv area |
| `linkToVT` | boolean | Show corresponding v-t graph |
| `linkToXT` | boolean | Show corresponding x-t graph |

---

#### 1.5 Kinematic Equation Solver

**Description**: A structured tool for solving kinematics problems using the five kinematic variables (x, v₀, v, a, t) and selecting appropriate equations.

**Core Interactions**:
- Identify known and unknown quantities
- Select appropriate kinematic equation
- Solve for unknown variable
- Show algebraic manipulation steps
- Verify with other equations
- Visualize problem with animation
- Handle two-part problems

**Use Cases**:
- Kinematics problem solving (High School)
- Equation selection strategy (High School)
- Free fall problems (High School)
- Multi-step kinematics (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `knownVariables` | object | Given values |
| `unknownVariable` | string | What to solve for |
| `showEquationSelection` | boolean | Display equation choice |
| `showAlgebra` | boolean | Show solving steps |
| `showVisualization` | boolean | Animate the problem |
| `problemType` | enum | `linear`, `freefall`, `twopart` |

---

#### 1.6 Projectile Motion Simulator

**Description**: A comprehensive 2D projectile motion simulation with adjustable launch parameters, trajectory visualization, and component analysis.

**Core Interactions**:
- Set launch angle and initial velocity
- Watch trajectory unfold
- Display horizontal and vertical components
- Show velocity vectors along path
- Measure range, max height, time of flight
- Toggle air resistance
- Overlay multiple trajectories for comparison

**Use Cases**:
- Projectile motion introduction (High School)
- Component analysis (High School)
- Optimization problems (High School/AP)
- Air resistance effects (AP/College)
- Sports physics applications (all levels)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `initialSpeed` | number | Launch speed (m/s) |
| `launchAngle` | number | Angle from horizontal |
| `launchHeight` | number | Initial height |
| `showComponents` | boolean | Display vₓ, vᵧ |
| `showVectors` | boolean | Velocity arrows along path |
| `airResistance` | boolean | Include drag |
| `showCalculations` | boolean | Display R, H, T formulas |
| `compareTrajectories` | array | Multiple launches |

---

#### 1.7 Relative Motion Visualizer

**Description**: A tool for understanding motion from different reference frames, showing how velocity and position depend on the observer.

**Core Interactions**:
- Set up two reference frames
- Define object motion in one frame
- Transform to view from other frame
- Show relative velocity calculation
- Animate from each perspective
- Handle 1D and 2D cases
- Include classic problems (boat/river, airplane/wind)

**Use Cases**:
- Reference frames (High School)
- Relative velocity (High School)
- Vector addition of velocities (High School/AP)
- Galilean transformation (AP/College)
- Special relativity preparation (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `frames` | array | Reference frame definitions |
| `objectMotion` | object | Velocity in original frame |
| `dimensions` | enum | `1d`, `2d` |
| `showTransformation` | boolean | Display vector math |
| `animateBothFrames` | boolean | Side-by-side views |
| `problemTemplate` | enum | `boat`, `airplane`, `train`, `custom` |

---

### 2. Mechanics - Dynamics (Forces)

#### 2.1 Free Body Diagram Builder

**Description**: An interactive tool for constructing and analyzing free body diagrams, the essential skill for dynamics problem solving.

**Core Interactions**:
- Select object to analyze
- Add force vectors (gravity, normal, friction, tension, applied, etc.)
- Adjust force magnitudes and directions
- Decompose forces into components
- Check equilibrium or net force
- Link to motion prediction
- Show coordinate system choices

**Use Cases**:
- Force identification (Middle School/High School)
- Free body diagrams (High School)
- Newton's laws application (High School)
- Equilibrium problems (High School/AP)
- Inclined planes (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `scenario` | object | Physical situation description |
| `availableForces` | array | Force types to use |
| `showComponents` | boolean | Decompose angled forces |
| `coordinateSystem` | object | Axis orientation |
| `checkMode` | enum | `equilibrium`, `netForce`, `free` |
| `showNetForce` | boolean | Display resultant |
| `guidedMode` | boolean | Step-by-step assistance |

---

#### 2.2 Force Table Simulator

**Description**: A virtual force table showing vector addition of multiple forces, finding equilibrant, and demonstrating equilibrium.

**Core Interactions**:
- Add force vectors at various angles
- Adjust magnitudes with virtual masses
- See resultant vector
- Find equilibrant for balance
- Verify mathematically
- Animate approach to equilibrium
- Compare graphical and analytical methods

**Use Cases**:
- Vector addition (High School)
- Force equilibrium (High School)
- Laboratory simulation (High School)
- Component method (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `forces` | array | Force vectors (magnitude, angle) |
| `showResultant` | boolean | Display vector sum |
| `showEquilibrant` | boolean | Show balancing force |
| `showComponents` | boolean | Display x, y components |
| `calculationMode` | enum | `graphical`, `analytical`, `both` |
| `virtualMasses` | boolean | Use hanging masses |

---

#### 2.3 Newton's Second Law Simulator

**Description**: An interactive demonstration of F=ma showing how net force and mass affect acceleration, with real-time graphing.

**Core Interactions**:
- Apply forces to object
- Adjust object mass
- Watch resulting acceleration
- Plot F vs a (varying F, constant m)
- Plot a vs m (varying m, constant F)
- Extract relationship from data
- Verify F = ma quantitatively

**Use Cases**:
- Newton's second law introduction (Middle School/High School)
- Proportional reasoning (High School)
- Experimental physics concepts (High School)
- Inertial mass (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `mass` | number | Object mass (kg) |
| `appliedForces` | array | Forces acting on object |
| `showGraph` | boolean | Real-time plotting |
| `graphType` | enum | `FvsA`, `avsM`, `both` |
| `showCalculation` | boolean | Display F=ma |
| `experimentMode` | boolean | Collect data points |

---

#### 2.4 Friction Explorer

**Description**: A tool for investigating static and kinetic friction, showing the relationship between normal force and friction force.

**Core Interactions**:
- Apply horizontal force to object
- Watch static friction match applied force
- See transition to kinetic friction
- Adjust coefficient of friction
- Vary normal force (mass, incline)
- Plot friction vs applied force
- Compare surfaces

**Use Cases**:
- Friction introduction (Middle School/High School)
- Static vs kinetic friction (High School)
- Coefficients of friction (High School)
- Inclined plane problems (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `coefficientStatic` | number | μₛ value |
| `coefficientKinetic` | number | μₖ value |
| `mass` | number | Object mass |
| `inclineAngle` | number | Surface angle |
| `showGraph` | boolean | f vs F_applied |
| `showForces` | boolean | Display force vectors |
| `surfacePresets` | array | Common surface pairs |

---

#### 2.5 Inclined Plane Analyzer

**Description**: A specialized tool for analyzing forces on inclined planes, with component decomposition and motion prediction.

**Core Interactions**:
- Adjust incline angle
- Show all forces on object
- Decompose weight into components
- Calculate normal force
- Determine friction force
- Predict motion (static, sliding up/down)
- Solve for critical angles

**Use Cases**:
- Inclined plane introduction (High School)
- Component analysis (High School)
- Friction on inclines (High School)
- Connected objects on inclines (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `inclineAngle` | number | Angle in degrees |
| `mass` | number | Object mass |
| `frictionCoefficient` | number | μ value (0 for frictionless) |
| `appliedForce` | object | Additional force (magnitude, direction) |
| `showComponents` | boolean | Weight components |
| `showAllForces` | boolean | Complete FBD |
| `predictMotion` | boolean | Determine behavior |

---

#### 2.6 Atwood Machine Simulator

**Description**: An interactive simulation of the classic Atwood machine showing connected mass dynamics and constraint equations.

**Core Interactions**:
- Set both masses
- Release system and watch motion
- Display forces on each mass
- Show acceleration calculation
- Measure experimental acceleration
- Vary mass ratio to explore limits
- Add friction to pulley (advanced)

**Use Cases**:
- Connected objects (High School)
- System analysis (High School/AP)
- Constraint equations (AP/College)
- Experimental verification (High School)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `mass1` | number | First mass (kg) |
| `mass2` | number | Second mass (kg) |
| `showForces` | boolean | FBD for each mass |
| `showCalculation` | boolean | Display derivation |
| `pulleyMass` | number | For advanced problems |
| `pulleyFriction` | number | Rotational resistance |
| `measureMode` | boolean | Experimental data collection |

---

#### 2.7 Tension and Pulley Systems

**Description**: A tool for analyzing various pulley configurations including multiple pulleys, mechanical advantage, and complex systems.

**Core Interactions**:
- Build pulley system configurations
- Identify tension throughout rope
- Calculate mechanical advantage
- Determine accelerations
- Handle multiple ropes
- Analyze fixed vs movable pulleys
- Solve for equilibrium conditions

**Use Cases**:
- Simple pulleys (High School)
- Mechanical advantage (High School)
- Complex systems (AP/College)
- Statics problems (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `configuration` | enum | Preset pulley systems |
| `masses` | array | Hanging masses |
| `showTensions` | boolean | Label rope tensions |
| `showFBDs` | boolean | Free body diagrams |
| `calculateMA` | boolean | Mechanical advantage |
| `customBuild` | boolean | Create own system |

---

#### 2.8 Circular Motion Analyzer

**Description**: A comprehensive tool for analyzing uniform and non-uniform circular motion, including centripetal force and acceleration.

**Core Interactions**:
- Set radius and speed (or period)
- Display velocity and acceleration vectors
- Show centripetal force
- Calculate centripetal acceleration
- Explore banked curves
- Handle vertical circles
- Show relationship between variables

**Use Cases**:
- Circular motion introduction (High School)
- Centripetal acceleration (High School)
- Centripetal force (High School/AP)
- Banked curves (AP/College)
- Vertical circles (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `radius` | number | Circle radius |
| `speed` | number | Tangential speed |
| `motionType` | enum | `horizontal`, `vertical`, `banked` |
| `showVectors` | boolean | v, a, F vectors |
| `showCalculations` | boolean | Display formulas |
| `bankAngle` | number | For banked curves |
| `showForceAnalysis` | boolean | Source of centripetal force |

---

### 3. Mechanics - Energy & Momentum

#### 3.1 Energy Bar Chart

**Description**: A visual representation of energy storage and transfer using bar charts, showing conservation and transformation of energy.

**Core Interactions**:
- Define system and states
- Set energy values for each type (KE, PE_g, PE_s, etc.)
- Show conservation (total constant)
- Animate energy transformation
- Include work by external forces
- Compare initial and final states
- Handle dissipation (friction)

**Use Cases**:
- Energy introduction (Middle School)
- Conservation of energy (High School)
- Work-energy theorem (High School)
- Energy transformations (High School/AP)
- Dissipative systems (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `energyTypes` | array | Which energy forms to include |
| `states` | array | System configurations |
| `showTotal` | boolean | Display total energy |
| `showWork` | boolean | External work bar |
| `animate` | boolean | Smooth transitions |
| `allowDissipation` | boolean | Include thermal energy |
| `linkedSimulation` | boolean | Connect to physical animation |

---

#### 3.2 Work Calculator / Visualizer

**Description**: A tool for calculating and visualizing work done by forces, including constant forces, variable forces, and work from graphs.

**Core Interactions**:
- Define force and displacement
- Calculate W = Fd cos θ
- Handle variable forces (area under F-x curve)
- Show work-energy theorem application
- Distinguish positive, negative, zero work
- Calculate work by multiple forces
- Link to energy change

**Use Cases**:
- Work introduction (High School)
- Work-energy theorem (High School)
- Variable force work (AP/College)
- Work by friction (High School/AP)
- Power introduction (High School)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `forceType` | enum | `constant`, `variable`, `spring` |
| `force` | object | Force vector or function |
| `displacement` | object | Displacement vector |
| `showAngle` | boolean | Display θ between F and d |
| `showGraph` | boolean | F vs x with area |
| `showWorkEnergy` | boolean | ΔKE = W_net |
| `multipleForces` | array | Work by each force |

---

#### 3.3 Spring/Elastic PE Simulator

**Description**: An interactive spring simulation showing Hooke's law, elastic potential energy, and oscillatory motion.

**Core Interactions**:
- Stretch/compress spring
- See restoring force (F = -kx)
- Display potential energy (½kx²)
- Release for oscillation
- Analyze energy exchange (KE ↔ PE)
- Vary spring constant k
- Compare different springs

**Use Cases**:
- Hooke's law (High School)
- Elastic potential energy (High School)
- Simple harmonic motion connection (High School/AP)
- Energy conservation (High School)
- Spring combinations (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `springConstant` | number | k value (N/m) |
| `mass` | number | Attached mass |
| `initialDisplacement` | number | Starting position |
| `showForce` | boolean | Display F = -kx |
| `showEnergy` | boolean | Display PE and KE |
| `showGraph` | boolean | Energy vs position |
| `dampingCoefficient` | number | For damped oscillations |

---

#### 3.4 Conservation of Energy Simulator

**Description**: A comprehensive simulation demonstrating energy conservation in various scenarios (ramps, pendulums, springs, roller coasters).

**Core Interactions**:
- Set up physical scenario
- Track energy forms in real-time
- Display energy bar chart alongside motion
- Verify conservation mathematically
- Add friction to observe dissipation
- Predict motion from energy considerations
- Solve for unknowns using conservation

**Use Cases**:
- Energy conservation (High School)
- Gravitational PE (High School)
- Complex energy problems (AP/College)
- Roller coaster physics (High School)
- Pendulum motion (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `scenario` | enum | `ramp`, `pendulum`, `spring`, `coaster`, `custom` |
| `showBarchart` | boolean | Energy bar visualization |
| `showNumerical` | boolean | Calculate values |
| `includeFriction` | boolean | Dissipative forces |
| `trackEnergies` | array | Which forms to track |
| `solveMode` | boolean | Find unknown variables |

---

#### 3.5 Momentum Bar Chart

**Description**: Visual representation of momentum for collision and explosion analysis, showing conservation and impulse.

**Core Interactions**:
- Set object masses and velocities
- Display momentum bars for each object
- Show system total momentum
- Analyze before and after collision
- Calculate impulse for each object
- Verify conservation
- Handle 2D collisions

**Use Cases**:
- Momentum introduction (High School)
- Conservation of momentum (High School)
- Collisions (High School/AP)
- Impulse-momentum theorem (High School/AP)
- Explosions (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `objects` | array | Mass and velocity for each |
| `dimensions` | enum | `1d`, `2d` |
| `showTotal` | boolean | System momentum |
| `showBefore` | boolean | Pre-collision state |
| `showAfter` | boolean | Post-collision state |
| `showImpulse` | boolean | Δp for each object |
| `linkedAnimation` | boolean | Motion visualization |

---

#### 3.6 Collision Simulator

**Description**: A simulation for exploring elastic and inelastic collisions in one and two dimensions.

**Core Interactions**:
- Set masses and initial velocities
- Choose collision type (elastic, inelastic, perfectly inelastic)
- Run collision animation
- Display momentum conservation
- Calculate energy changes
- Analyze 2D scattering angles
- Verify collision equations

**Use Cases**:
- Collision types (High School)
- Elastic collisions (High School/AP)
- Inelastic collisions (High School/AP)
- 2D collisions (AP/College)
- Center of mass frame (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `mass1` | number | First object mass |
| `mass2` | number | Second object mass |
| `velocity1` | object | Initial velocity of object 1 |
| `velocity2` | object | Initial velocity of object 2 |
| `collisionType` | enum | `elastic`, `inelastic`, `perfectlyInelastic` |
| `dimensions` | enum | `1d`, `2d` |
| `showMomentum` | boolean | Momentum vectors/bars |
| `showEnergy` | boolean | KE before and after |
| `coefficientRestitution` | number | For partial elasticity |

---

#### 3.7 Impulse-Momentum Visualizer

**Description**: A tool for analyzing impulse and its relationship to momentum change, including force-time graphs.

**Core Interactions**:
- Apply force over time interval
- Calculate impulse (area under F-t curve)
- Show momentum change equals impulse
- Compare short/large force vs long/small force
- Handle variable forces
- Explore safety applications (airbags, crumple zones)
- Link to collision analysis

**Use Cases**:
- Impulse introduction (High School)
- Impulse-momentum theorem (High School/AP)
- Force-time graphs (AP/College)
- Safety physics (High School)
- Sports applications (High School)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `forceProfile` | enum | `constant`, `triangular`, `realistic`, `custom` |
| `forceMagnitude` | number | Peak or constant force |
| `duration` | number | Time interval |
| `mass` | number | Object mass |
| `showGraph` | boolean | F vs t plot |
| `showArea` | boolean | Shade impulse area |
| `showMomentumChange` | boolean | Δp calculation |
| `compareProfiles` | boolean | Multiple force patterns |

---

#### 3.8 Center of Mass Visualizer

**Description**: A tool for finding and analyzing the center of mass of systems, including motion of the center of mass.

**Core Interactions**:
- Place point masses in 1D or 2D
- Calculate center of mass position
- Track CM motion during interactions
- Show CM velocity
- Demonstrate CM frame
- Handle continuous mass distributions
- Verify conservation laws in CM frame

**Use Cases**:
- Center of mass concept (High School/AP)
- System analysis (AP/College)
- CM frame collisions (College)
- Extended objects (AP/College)
- Rocket propulsion (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `masses` | array | Mass values |
| `positions` | array | Position vectors |
| `dimensions` | enum | `1d`, `2d` |
| `showCM` | boolean | Display CM position |
| `trackMotion` | boolean | CM trajectory |
| `showVelocity` | boolean | CM velocity |
| `continuousObject` | object | For extended bodies |

---

### 4. Mechanics - Rotational Motion

#### 4.1 Angular Motion Visualizer

**Description**: A tool for visualizing and analyzing rotational kinematics, including angular position, velocity, and acceleration.

**Core Interactions**:
- Set angular motion parameters
- Watch rotation animation
- Display angular quantities (θ, ω, α)
- Show tangential and centripetal components
- Link to linear motion analogies
- Graph angular quantities vs time
- Convert between angular and linear

**Use Cases**:
- Rotational kinematics (High School/AP)
- Angular-linear relationship (AP/College)
- Uniform circular motion (High School)
- Non-uniform rotation (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `angularVelocity` | number | ω (rad/s) |
| `angularAcceleration` | number | α (rad/s²) |
| `radius` | number | For linear conversions |
| `showVectors` | boolean | Angular quantity vectors |
| `showTangential` | boolean | Tangential components |
| `showGraphs` | boolean | θ-t, ω-t, α-t plots |
| `analogyMode` | boolean | Show linear equivalents |

---

#### 4.2 Torque Calculator / Visualizer

**Description**: An interactive tool for calculating torque and analyzing rotational equilibrium.

**Core Interactions**:
- Apply forces at various positions
- Calculate torque for each force
- Show lever arm visualization
- Determine net torque
- Analyze rotational equilibrium
- Explore mechanical advantage
- Handle multiple forces

**Use Cases**:
- Torque introduction (High School)
- Rotational equilibrium (High School/AP)
- Levers and simple machines (Middle School/High School)
- Static equilibrium (AP/College)
- Moments in engineering (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `pivot` | object | Axis of rotation position |
| `forces` | array | Force vectors and positions |
| `showLeverArms` | boolean | Display r⊥ |
| `showTorqueVectors` | boolean | τ arrows |
| `calculateNet` | boolean | Sum of torques |
| `equilibriumCheck` | boolean | Verify Στ = 0 |
| `includeFriction` | boolean | Pivot friction |

---

#### 4.3 Moment of Inertia Explorer

**Description**: A tool for understanding and calculating rotational inertia for various shapes and mass distributions.

**Core Interactions**:
- Select object shape
- Visualize mass distribution effect
- Calculate moment of inertia
- Use parallel axis theorem
- Compare different shapes
- Build composite objects
- Show derivation for simple shapes

**Use Cases**:
- Moment of inertia concept (AP/College)
- Common shapes (AP/College)
- Parallel axis theorem (AP/College)
- Rotational dynamics (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `shape` | enum | `point`, `rod`, `disk`, `sphere`, `hoop`, etc. |
| `mass` | number | Total mass |
| `dimensions` | object | Shape-specific dimensions |
| `axis` | object | Rotation axis location |
| `showFormula` | boolean | Display I equation |
| `parallelAxis` | object | For off-center axes |
| `composite` | array | Multiple shapes |

---

#### 4.4 Rotational Dynamics Simulator

**Description**: A simulation demonstrating Newton's second law for rotation (τ = Iα) with real-world applications.

**Core Interactions**:
- Apply torque to rotating object
- Observe angular acceleration
- Verify τ = Iα relationship
- Analyze rolling motion
- Explore rotational energy
- Handle coupled rotation/translation
- Compare objects with different I

**Use Cases**:
- Rotational Newton's second law (AP/College)
- Rolling motion (AP/College)
- Rotational energy (AP/College)
- Angular momentum (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `object` | object | Shape and mass distribution |
| `appliedTorque` | number | τ value |
| `showAcceleration` | boolean | Display α |
| `includeRolling` | boolean | Rolling without slipping |
| `showEnergy` | boolean | Rotational KE |
| `showAngularMomentum` | boolean | L = Iω |

---

#### 4.5 Angular Momentum Demonstrator

**Description**: A visualization of angular momentum conservation, including ice skater effect and precession.

**Core Interactions**:
- Set rotating system
- Change moment of inertia
- Watch angular velocity change (L conserved)
- Demonstrate ice skater effect
- Show gyroscopic precession
- Analyze collisions with rotation
- Explore Kepler's second law connection

**Use Cases**:
- Angular momentum (AP/College)
- Conservation of L (AP/College)
- Gyroscopes (College)
- Satellite motion (AP/College)
- Figure skating physics (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `initialI` | number | Starting moment of inertia |
| `initialOmega` | number | Starting angular velocity |
| `changeI` | boolean | Allow I modification |
| `showL` | boolean | Display angular momentum |
| `showConservation` | boolean | L_initial = L_final |
| `demonstrationType` | enum | `skater`, `gyroscope`, `collision` |

---

### 5. Oscillations & Waves

#### 5.1 Simple Harmonic Motion Simulator

**Description**: A comprehensive simulation of SHM with position, velocity, acceleration graphs and circular motion connection.

**Core Interactions**:
- Set amplitude, frequency/period
- Watch oscillation animation
- Display x(t), v(t), a(t) graphs simultaneously
- Show circular motion projection
- Explore phase relationships
- Analyze energy exchange
- Vary parameters and observe effects

**Use Cases**:
- SHM introduction (High School)
- Mass-spring systems (High School/AP)
- Pendulum motion (High School/AP)
- Phase and circular motion (AP/College)
- Energy in SHM (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `oscillatorType` | enum | `spring`, `pendulum`, `generic` |
| `amplitude` | number | Maximum displacement |
| `frequency` | number | Oscillation frequency |
| `phase` | number | Initial phase |
| `showGraphs` | boolean | x, v, a vs t |
| `showCircular` | boolean | Reference circle |
| `showEnergy` | boolean | KE, PE, total |
| `showPhasor` | boolean | Rotating vector |

---

#### 5.2 Pendulum Lab

**Description**: An interactive pendulum simulation exploring period dependence on length, mass, amplitude, and gravity.

**Core Interactions**:
- Adjust pendulum length
- Change bob mass
- Set initial amplitude
- Measure period
- Plot T vs L, T vs m, T vs θ
- Verify T = 2π√(L/g)
- Compare simple vs physical pendulum
- Explore large angle deviations

**Use Cases**:
- Pendulum basics (Middle School/High School)
- Period relationships (High School)
- Small angle approximation (AP/College)
- Physical pendulum (AP/College)
- Gravity measurement (High School)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `length` | number | Pendulum length |
| `mass` | number | Bob mass |
| `initialAngle` | number | Starting amplitude |
| `gravity` | number | g value |
| `showPeriodFormula` | boolean | Display T equation |
| `experimentMode` | boolean | Data collection |
| `physicalPendulum` | boolean | Extended object |
| `largeAngle` | boolean | Include nonlinear effects |

---

#### 5.3 Damped and Driven Oscillation Simulator

**Description**: A simulation exploring damped oscillations and resonance with driven oscillators.

**Core Interactions**:
- Set damping coefficient
- Observe amplitude decay
- Classify damping (under, critical, over)
- Add driving force
- Vary driving frequency
- Observe resonance
- Plot amplitude vs driving frequency

**Use Cases**:
- Damped oscillations (AP/College)
- Types of damping (AP/College)
- Forced oscillations (AP/College)
- Resonance (AP/College)
- Q factor (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `naturalFrequency` | number | ω₀ of system |
| `dampingCoefficient` | number | b value |
| `drivingForce` | object | Amplitude and frequency |
| `showEnvelope` | boolean | Decay curve |
| `showResonanceCurve` | boolean | A vs ω_d |
| `classifyDamping` | boolean | Identify regime |
| `showQFactor` | boolean | Quality factor |

---

#### 5.4 Wave on String Simulator

**Description**: An interactive simulation of transverse waves on a string, including reflection, interference, and standing waves.

**Core Interactions**:
- Generate pulses or continuous waves
- Adjust frequency, amplitude, wavelength
- Change string tension and density
- Observe wave speed relationship
- See reflection at boundaries (fixed/free)
- Create standing waves
- Measure wavelength and frequency

**Use Cases**:
- Wave basics (Middle School/High School)
- Wave properties (High School)
- Wave speed on string (High School/AP)
- Standing waves (High School/AP)
- Resonance frequencies (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `waveType` | enum | `pulse`, `continuous` |
| `frequency` | number | Wave frequency |
| `amplitude` | number | Wave amplitude |
| `tension` | number | String tension |
| `linearDensity` | number | Mass per length |
| `boundaryType` | enum | `fixed`, `free`, `none` |
| `showStanding` | boolean | Standing wave modes |
| `showFormula` | boolean | v = √(T/μ) |

---

#### 5.5 Longitudinal Wave Visualizer

**Description**: A visualization of longitudinal waves showing compressions and rarefactions, particularly for sound waves.

**Core Interactions**:
- Generate longitudinal pulses or waves
- See particle motion vs wave propagation
- Display compressions and rarefactions
- Show pressure variation graph
- Compare to transverse representation
- Relate to sound properties
- Visualize wavelength in longitudinal form

**Use Cases**:
- Longitudinal waves (Middle School/High School)
- Sound waves (High School)
- Pressure waves (High School/AP)
- Wave representation (High School)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `frequency` | number | Wave frequency |
| `amplitude` | number | Displacement amplitude |
| `medium` | enum | Medium type |
| `showParticles` | boolean | Individual particle motion |
| `showPressureGraph` | boolean | P vs x |
| `showDisplacementGraph` | boolean | s vs x |
| `compareTransverse` | boolean | Side-by-side comparison |

---

#### 5.6 Wave Interference Demonstrator

**Description**: A tool for exploring superposition, constructive and destructive interference, and beat frequencies.

**Core Interactions**:
- Set up two wave sources
- Adjust frequencies and phases
- Observe interference pattern
- Identify constructive/destructive regions
- Create beats with similar frequencies
- Show path difference analysis
- 2D interference patterns

**Use Cases**:
- Superposition (High School)
- Interference (High School/AP)
- Beats (High School/AP)
- Two-source interference (AP/College)
- Diffraction connection (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `wave1` | object | Frequency, amplitude, phase |
| `wave2` | object | Frequency, amplitude, phase |
| `dimensions` | enum | `1d`, `2d` |
| `showResultant` | boolean | Combined wave |
| `showBeats` | boolean | For similar frequencies |
| `showPathDifference` | boolean | For 2D patterns |
| `showNodes` | boolean | Mark interference nodes |

---

#### 5.7 Standing Wave Analyzer

**Description**: A focused tool for analyzing standing waves, harmonics, and resonance in strings and pipes.

**Core Interactions**:
- Set boundary conditions (string, open/closed pipe)
- Generate harmonic modes
- Identify nodes and antinodes
- Calculate resonance frequencies
- Display harmonic series
- Show relationship between L, λ, f
- Hear audio for sound applications

**Use Cases**:
- Standing waves (High School)
- Musical instruments (High School)
- Harmonics and overtones (High School/AP)
- Resonance tubes (AP/College)
- Acoustic physics (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `systemType` | enum | `string`, `openPipe`, `closedPipe` |
| `length` | number | System length |
| `harmonic` | number | Which mode (n) |
| `showNodes` | boolean | Mark nodes/antinodes |
| `showWavelength` | boolean | λ relationship |
| `showFrequencies` | boolean | Harmonic series |
| `playAudio` | boolean | Hear the frequency |
| `waveSpeed` | number | v in medium |

---

#### 5.8 Doppler Effect Simulator

**Description**: An interactive demonstration of the Doppler effect for sound and light, showing frequency shifts due to relative motion.

**Core Interactions**:
- Set source and observer velocities
- Hear/see frequency shift
- Calculate observed frequency
- Visualize wavefront compression/expansion
- Handle moving source vs moving observer
- Explore sonic boom (supersonic)
- Connect to redshift/blueshift

**Use Cases**:
- Doppler effect basics (High School)
- Doppler calculations (High School/AP)
- Radar and sonar applications (High School)
- Astronomical redshift (AP/College)
- Relativistic Doppler (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `sourceVelocity` | number | Source speed |
| `observerVelocity` | number | Observer speed |
| `sourceFrequency` | number | Emitted frequency |
| `waveSpeed` | number | Speed of sound/light |
| `waveType` | enum | `sound`, `light` |
| `showWavefronts` | boolean | Visualize waves |
| `showCalculation` | boolean | Doppler formula |
| `supersonicMode` | boolean | Allow v > c_sound |

---

### 6. Electricity & Magnetism

#### 6.1 Electric Field Visualizer

**Description**: A tool for visualizing electric fields from point charges, dipoles, and charge distributions using field lines and vectors.

**Core Interactions**:
- Place point charges (positive/negative)
- Display field lines
- Show field vectors at any point
- Calculate field magnitude and direction
- Create dipoles and distributions
- Show equipotential lines
- Explore superposition

**Use Cases**:
- Electric fields introduction (High School)
- Field lines (High School)
- Superposition (High School/AP)
- Dipole fields (AP/College)
- Continuous distributions (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `charges` | array | Charge positions and values |
| `showFieldLines` | boolean | Draw field lines |
| `showVectors` | boolean | E vectors at points |
| `showEquipotentials` | boolean | Constant V lines |
| `fieldLineDensity` | number | Lines per charge |
| `vectorGridSpacing` | number | Vector field resolution |
| `calculateAtPoint` | boolean | E at clicked point |

---

#### 6.2 Electric Potential Visualizer

**Description**: A 3D and 2D visualization of electric potential landscapes with equipotential surfaces and relationship to field.

**Core Interactions**:
- Display potential as height (3D surface)
- Show equipotential lines (2D contours)
- Place charges and see potential change
- Calculate potential at any point
- Show E = -∇V relationship
- Calculate potential energy
- Work and path independence

**Use Cases**:
- Electric potential (High School/AP)
- Equipotential surfaces (High School/AP)
- Potential energy (AP/College)
- E and V relationship (AP/College)
- Work by electric force (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `charges` | array | Source charges |
| `displayMode` | enum | `surface3D`, `contour2D`, `both` |
| `showGradient` | boolean | E from V |
| `calculateAtPoint` | boolean | V at clicked point |
| `showPotentialEnergy` | boolean | U = qV |
| `pathTool` | boolean | Calculate work along path |

---

#### 6.3 Capacitor Explorer

**Description**: An interactive tool for analyzing capacitors, including parallel plate geometry, dielectrics, and capacitor circuits.

**Core Interactions**:
- Adjust plate area and separation
- Calculate capacitance (C = ε₀A/d)
- Insert dielectric materials
- Charge capacitor to voltage V
- Display charge, energy stored
- Analyze series/parallel combinations
- Show electric field between plates

**Use Cases**:
- Capacitance introduction (High School/AP)
- Parallel plate capacitor (High School/AP)
- Dielectrics (AP/College)
- Energy storage (AP/College)
- Capacitor circuits (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `plateArea` | number | Plate area |
| `separation` | number | Plate distance |
| `dielectricConstant` | number | κ value |
| `appliedVoltage` | number | V across plates |
| `showField` | boolean | E between plates |
| `showEnergy` | boolean | U = ½CV² |
| `circuitMode` | boolean | Series/parallel analysis |

---

#### 6.4 DC Circuit Builder

**Description**: A comprehensive circuit simulation tool for building and analyzing DC circuits with resistors, capacitors, batteries, and more.

**Core Interactions**:
- Drag and drop components
- Connect with wires
- Adjust component values
- Measure voltage, current, power
- Apply Kirchhoff's laws
- Analyze series/parallel combinations
- Include ammeters and voltmeters

**Use Cases**:
- Basic circuits (Middle School/High School)
- Ohm's law (High School)
- Series and parallel (High School)
- Kirchhoff's laws (High School/AP)
- RC circuits (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `availableComponents` | array | Component types |
| `showCurrentFlow` | boolean | Animate current |
| `showVoltages` | boolean | Display V at nodes |
| `showPower` | boolean | Power dissipation |
| `analysisMode` | enum | `simple`, `kirchhoff`, `nodal` |
| `includeCapacitors` | boolean | RC analysis |
| `realComponents` | boolean | Internal resistance |

---

#### 6.5 Ohm's Law Calculator / Visualizer

**Description**: A focused tool for exploring and applying Ohm's law with visual circuit representation.

**Core Interactions**:
- Set any two of V, I, R
- Calculate the third
- Visualize with simple circuit
- Show power calculation
- Plot V-I characteristics
- Explore non-ohmic materials
- Unit conversions

**Use Cases**:
- Ohm's law introduction (Middle School/High School)
- Basic calculations (High School)
- V-I graphs (High School)
- Resistivity (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `knownValues` | object | Given V, I, or R |
| `showCircuit` | boolean | Visual representation |
| `showGraph` | boolean | V vs I plot |
| `showPower` | boolean | P = IV |
| `showFormulas` | boolean | V=IR, P=IV, etc. |
| `nonOhmic` | boolean | Include diodes, etc. |

---

#### 6.6 Magnetic Field Visualizer

**Description**: A tool for visualizing magnetic fields from various sources including bar magnets, current-carrying wires, loops, and solenoids.

**Core Interactions**:
- Place magnetic field sources
- Display field lines
- Show field vectors
- Use right-hand rule helper
- Calculate field at points
- Explore superposition
- Show 3D field structure

**Use Cases**:
- Magnetic fields (High School)
- Field from currents (High School/AP)
- Right-hand rules (High School/AP)
- Solenoids and loops (AP/College)
- Biot-Savart applications (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `sources` | array | Magnets, wires, loops |
| `showFieldLines` | boolean | Draw B field lines |
| `showVectors` | boolean | B vectors |
| `show3D` | boolean | 3D visualization |
| `calculateAtPoint` | boolean | B at clicked point |
| `showRightHandRule` | boolean | Visual helper |
| `currentDirection` | boolean | Show current |

---

#### 6.7 Electromagnetic Induction Lab

**Description**: A simulation of Faraday's law showing induced EMF from changing magnetic flux.

**Core Interactions**:
- Move magnet through coil
- Change magnetic field strength
- Vary loop area or orientation
- Measure induced EMF
- Observe current direction (Lenz's law)
- Plot EMF vs time
- Explore generators and transformers

**Use Cases**:
- Electromagnetic induction (High School/AP)
- Faraday's law (AP/College)
- Lenz's law (AP/College)
- Generators (High School/AP)
- Transformers (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `inductionMethod` | enum | `movingMagnet`, `changingB`, `changingArea` |
| `coilTurns` | number | Number of loops |
| `coilArea` | number | Loop area |
| `magnetStrength` | number | B field |
| `showFlux` | boolean | Display Φ |
| `showEMF` | boolean | Induced voltage |
| `showLenz` | boolean | Current direction |
| `plotEMF` | boolean | EMF vs time graph |

---

#### 6.8 Lorentz Force Demonstrator

**Description**: A visualization of forces on charged particles and current-carrying wires in magnetic fields.

**Core Interactions**:
- Set charge, velocity, magnetic field
- Calculate and display force (F = qv×B)
- Show circular motion in uniform B
- Analyze current in magnetic field
- Explore mass spectrometer
- Visualize Hall effect
- 3D cross product helper

**Use Cases**:
- Magnetic force on charges (High School/AP)
- Circular motion in B field (AP/College)
- Force on current (High School/AP)
- Mass spectrometer (AP/College)
- Hall effect (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `charge` | number | Particle charge |
| `velocity` | object | Velocity vector |
| `magneticField` | object | B field vector |
| `showForce` | boolean | Display F vector |
| `showPath` | boolean | Particle trajectory |
| `currentMode` | boolean | Wire instead of particle |
| `showCrossProduct` | boolean | v × B visualization |

---

### 7. Light & Optics

#### 7.1 Ray Optics Workbench

**Description**: A comprehensive ray tracing tool for analyzing reflection and refraction at plane and curved surfaces.

**Core Interactions**:
- Place mirrors (plane, concave, convex)
- Place lenses (converging, diverging)
- Draw incident rays
- Trace reflected/refracted rays
- Locate images
- Apply mirror/lens equations
- Build optical systems

**Use Cases**:
- Reflection basics (Middle School/High School)
- Mirrors (High School)
- Refraction (High School)
- Lenses (High School)
- Optical instruments (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `opticalElements` | array | Mirrors, lenses, surfaces |
| `raySource` | object | Light source type |
| `showNormals` | boolean | Surface normals |
| `showAngles` | boolean | Incidence/reflection angles |
| `showFocalPoints` | boolean | f, 2f markers |
| `showImage` | boolean | Image location |
| `traceMultipleRays` | boolean | Principal ray method |

---

#### 7.2 Snell's Law Calculator

**Description**: A focused tool for exploring refraction, calculating angles, and understanding total internal reflection.

**Core Interactions**:
- Set indices of refraction
- Adjust incident angle
- Calculate refracted angle
- Visualize ray bending
- Find critical angle
- Demonstrate total internal reflection
- Explore dispersion

**Use Cases**:
- Refraction (High School)
- Snell's law calculations (High School)
- Total internal reflection (High School/AP)
- Fiber optics application (High School)
- Dispersion and prisms (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `n1` | number | First medium index |
| `n2` | number | Second medium index |
| `incidentAngle` | number | θ₁ |
| `showCriticalAngle` | boolean | Calculate θc |
| `showTIR` | boolean | Total internal reflection |
| `showDispersion` | boolean | Wavelength dependence |
| `prismMode` | boolean | Prism geometry |

---

#### 7.3 Lens/Mirror Equation Solver

**Description**: A tool for solving thin lens and mirror equations with ray diagram visualization.

**Core Interactions**:
- Enter known values (do, f, or di)
- Solve for unknowns
- Display ray diagram
- Calculate magnification
- Classify image (real/virtual, upright/inverted)
- Handle sign conventions
- Compare lens vs mirror

**Use Cases**:
- Mirror equation (High School)
- Lens equation (High School)
- Magnification (High School)
- Image characteristics (High School)
- Optical system design (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `opticsType` | enum | `concaveMirror`, `convexMirror`, `convergingLens`, `divergingLens` |
| `objectDistance` | number | do |
| `focalLength` | number | f |
| `showRayDiagram` | boolean | Visual solution |
| `showCalculation` | boolean | Step-by-step |
| `showMagnification` | boolean | M = -di/do |
| `classifyImage` | boolean | Image properties |

---

#### 7.4 Wave Optics Simulator

**Description**: A simulation for exploring interference, diffraction, and polarization using wave models of light.

**Core Interactions**:
- Set up single/double slits
- Adjust slit width and separation
- Observe interference patterns
- Calculate fringe positions
- Explore diffraction gratings
- Demonstrate polarization
- Thin film interference

**Use Cases**:
- Double-slit interference (AP/College)
- Single-slit diffraction (AP/College)
- Diffraction gratings (AP/College)
- Polarization (AP/College)
- Thin films (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `experimentType` | enum | `doubleSlit`, `singleSlit`, `grating`, `thinFilm` |
| `wavelength` | number | Light wavelength |
| `slitWidth` | number | a |
| `slitSeparation` | number | d |
| `screenDistance` | number | L |
| `showPattern` | boolean | Interference pattern |
| `showCalculations` | boolean | Position formulas |
| `showIntensity` | boolean | I vs position graph |

---

#### 7.5 Color and Spectrum Explorer

**Description**: A tool for exploring the electromagnetic spectrum, visible light, color mixing, and spectral analysis.

**Core Interactions**:
- Navigate EM spectrum
- Explore wavelength-frequency-energy relationships
- Mix colors (additive and subtractive)
- Analyze emission/absorption spectra
- Connect to atomic transitions
- Explore blackbody radiation
- Identify elements from spectra

**Use Cases**:
- EM spectrum (Middle School/High School)
- Light and color (High School)
- Spectroscopy (High School/AP)
- Blackbody radiation (AP/College)
- Quantum connections (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `spectrumRange` | enum | `visible`, `full`, `custom` |
| `showWavelength` | boolean | λ scale |
| `showFrequency` | boolean | f scale |
| `showEnergy` | boolean | E scale |
| `colorMixing` | enum | `additive`, `subtractive` |
| `spectralLines` | boolean | Emission/absorption |
| `blackbodyMode` | boolean | Temperature-color relationship |

---

### 8. Modern Physics

#### 8.1 Photoelectric Effect Simulator

**Description**: An interactive simulation of the photoelectric effect demonstrating quantum concepts and wave-particle duality.

**Core Interactions**:
- Adjust light frequency and intensity
- Observe electron emission
- Measure stopping potential
- Plot KE_max vs frequency
- Determine work function
- Extract Planck's constant
- Compare classical vs quantum predictions

**Use Cases**:
- Photoelectric effect (High School/AP)
- Photon concept (AP/College)
- Work function (AP/College)
- Wave-particle duality (AP/College)
- Historical physics (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `metalType` | enum | Different work functions |
| `lightFrequency` | number | Incident frequency |
| `lightIntensity` | number | Photon flux |
| `showStoppingPotential` | boolean | V_stop measurement |
| `showGraph` | boolean | KE vs f plot |
| `showThreshold` | boolean | Cutoff frequency |
| `compareClassical` | boolean | Wave prediction |

---

#### 8.2 Matter Wave Visualizer

**Description**: A tool for exploring de Broglie waves, wave-particle duality, and quantum mechanical wave functions.

**Core Interactions**:
- Calculate de Broglie wavelength
- Visualize matter waves
- Explore electron diffraction
- Show wave packet and uncertainty
- Demonstrate Heisenberg uncertainty
- Compare particle sizes
- Explore quantum tunneling

**Use Cases**:
- de Broglie hypothesis (AP/College)
- Wave-particle duality (AP/College)
- Electron microscopy (AP/College)
- Uncertainty principle (College)
- Quantum basics (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `particleMass` | number | Particle mass |
| `particleVelocity` | number | Particle speed |
| `showWavelength` | boolean | Calculate λ |
| `showWaveFunction` | boolean | Ψ visualization |
| `showDiffraction` | boolean | Wave behavior |
| `uncertaintyMode` | boolean | Δx Δp demonstration |
| `particlePresets` | array | Electron, proton, baseball |

---

#### 8.3 Atomic Model Explorer

**Description**: An exploration of atomic models from Bohr to quantum mechanical, showing orbitals and energy levels.

**Core Interactions**:
- View Bohr model orbits
- See energy level diagrams
- Calculate transition energies
- Show quantum mechanical orbitals
- Visualize probability densities
- Explore quantum numbers
- Connect to spectral lines

**Use Cases**:
- Bohr model (High School)
- Energy levels (High School/AP)
- Spectral lines (High School/AP)
- Quantum mechanical model (AP/College)
- Orbital shapes (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `element` | string | Atom to display |
| `modelType` | enum | `bohr`, `quantumMechanical`, `both` |
| `showEnergyLevels` | boolean | Energy diagram |
| `showTransitions` | boolean | Electron jumps |
| `showOrbitals` | boolean | QM probability clouds |
| `quantumNumbers` | boolean | n, l, m, s labels |
| `showSpectrum` | boolean | Resulting spectral lines |

---

#### 8.4 Nuclear Physics Toolkit

**Description**: A comprehensive tool for nuclear structure, radioactive decay, and nuclear reactions.

**Core Interactions**:
- Explore nuclear composition
- View binding energy curve
- Simulate radioactive decay
- Balance nuclear equations
- Calculate Q-values
- Explore fission and fusion
- Half-life calculations

**Use Cases**:
- Nuclear structure (High School)
- Radioactive decay (High School/AP)
- Nuclear reactions (AP/College)
- Binding energy (AP/College)
- Fission and fusion (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `nuclide` | string | Nucleus to analyze |
| `showComposition` | boolean | Protons, neutrons |
| `showBindingEnergy` | boolean | BE and BE/A |
| `decayMode` | enum | `alpha`, `beta`, `gamma` |
| `showDecayChain` | boolean | Decay series |
| `reactionMode` | boolean | Nuclear equations |
| `halfLifeCalculator` | boolean | Decay calculations |

---

#### 8.5 Special Relativity Visualizer

**Description**: A tool for exploring time dilation, length contraction, and relativistic effects.

**Core Interactions**:
- Set relative velocity
- Calculate gamma factor
- Show time dilation
- Show length contraction
- Explore twin paradox
- Relativistic momentum and energy
- Spacetime diagrams

**Use Cases**:
- Special relativity introduction (AP/College)
- Time dilation (AP/College)
- Length contraction (AP/College)
- Relativistic dynamics (College)
- Spacetime geometry (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `relativeVelocity` | number | v as fraction of c |
| `showGamma` | boolean | Lorentz factor |
| `showTimeDilation` | boolean | Δt' calculation |
| `showLengthContraction` | boolean | L' calculation |
| `showMomentum` | boolean | Relativistic p |
| `showEnergy` | boolean | E = mc² |
| `spacetimeDiagram` | boolean | Minkowski diagram |

---

### 9. Thermodynamics

#### 9.1 Ideal Gas Simulator

**Description**: A kinetic theory simulation showing ideal gas behavior and the relationships between P, V, T, and n.

**Core Interactions**:
- Adjust P, V, T, n
- Watch particle motion
- Verify PV = nRT
- Plot isotherms, isobars, isochores
- Show Maxwell-Boltzmann distribution
- Calculate RMS speed
- Explore deviations from ideal

**Use Cases**:
- Ideal gas law (High School)
- Kinetic theory (High School/AP)
- Gas processes (AP/College)
- Statistical mechanics (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `pressure` | number | Gas pressure |
| `volume` | number | Container volume |
| `temperature` | number | Temperature |
| `moles` | number | Amount of gas |
| `showParticles` | boolean | Molecular simulation |
| `showGraph` | enum | `pv`, `vt`, `pt` |
| `showDistribution` | boolean | Speed distribution |
| `processType` | enum | `isothermal`, `isobaric`, `isochoric`, `adiabatic` |

---

#### 9.2 PV Diagram Analyzer

**Description**: An interactive PV diagram for analyzing thermodynamic processes and calculating work and heat.

**Core Interactions**:
- Draw or select processes
- Calculate work (area under curve)
- Apply first law (Q = ΔU + W)
- Create thermodynamic cycles
- Analyze engine efficiency
- Compare different processes
- Identify process types

**Use Cases**:
- PV diagrams (AP/College)
- Work from graphs (AP/College)
- First law applications (AP/College)
- Heat engines (AP/College)
- Carnot cycle (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `process` | object | Path definition |
| `gasProperties` | object | n, Cv, Cp |
| `showWork` | boolean | Shade W area |
| `showHeat` | boolean | Calculate Q |
| `showDeltaU` | boolean | Internal energy change |
| `cycleMode` | boolean | Complete cycle analysis |
| `engineEfficiency` | boolean | Calculate η |

---

#### 9.3 Heat Engine Simulator

**Description**: A simulation of heat engines including Carnot, Otto, and Diesel cycles with efficiency analysis.

**Core Interactions**:
- Select engine type
- Set hot and cold reservoir temperatures
- Watch cycle animation
- Calculate efficiency
- Compare to Carnot efficiency
- Analyze each stroke
- Plot on PV diagram

**Use Cases**:
- Heat engines (AP/College)
- Second law (AP/College)
- Carnot cycle (College)
- Real engines (AP/College)
- Entropy introduction (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `engineType` | enum | `carnot`, `otto`, `diesel`, `stirling` |
| `T_hot` | number | Hot reservoir |
| `T_cold` | number | Cold reservoir |
| `compressionRatio` | number | For Otto/Diesel |
| `showCycle` | boolean | Animated operation |
| `showPVDiagram` | boolean | Cycle on PV plot |
| `showEfficiency` | boolean | Calculate and compare |
| `showEntropy` | boolean | TS diagram |

---

#### 9.4 Heat Transfer Visualizer

**Description**: A tool for visualizing and calculating heat transfer by conduction, convection, and radiation.

**Core Interactions**:
- Set up heat transfer scenario
- Adjust material properties
- Calculate heat flow rate
- Visualize temperature gradients
- Compare transfer mechanisms
- Analyze thermal resistance
- Explore insulation

**Use Cases**:
- Heat transfer basics (High School)
- Conduction equation (High School/AP)
- Thermal conductivity (AP/College)
- Stefan-Boltzmann law (AP/College)
- Building physics applications (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `transferType` | enum | `conduction`, `convection`, `radiation`, `combined` |
| `material` | object | Thermal properties |
| `geometry` | object | Dimensions |
| `temperatures` | object | Boundary conditions |
| `showGradient` | boolean | Temperature distribution |
| `showFlowRate` | boolean | Q/t calculation |
| `timeEvolution` | boolean | Transient behavior |

---

### 10. Measurement & Analysis Tools

#### 10.1 Vernier Caliper Simulator

**Description**: A virtual vernier caliper for learning precision measurement techniques.

**Core Interactions**:
- Open/close caliper jaws
- Read main scale
- Read vernier scale
- Calculate measurement
- Practice with objects of known size
- Learn least count
- Record measurements with uncertainty

**Use Cases**:
- Measurement techniques (High School)
- Significant figures (High School)
- Laboratory skills (all levels)
- Uncertainty (High School/AP)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `objectSize` | number | Item being measured |
| `showGuides` | boolean | Reading assistance |
| `showCalculation` | boolean | Step-by-step reading |
| `leastCount` | number | Vernier precision |
| `practiceMode` | boolean | Random objects |
| `showUncertainty` | boolean | Include ± value |

---

#### 10.2 Oscilloscope Simulator

**Description**: A virtual oscilloscope for analyzing waveforms, measuring frequency, amplitude, and phase.

**Core Interactions**:
- Input signal(s)
- Adjust time base
- Adjust voltage scale
- Trigger settings
- Measure period and frequency
- Measure amplitude
- Analyze phase difference
- Use cursors for measurement

**Use Cases**:
- Waveform analysis (High School/AP)
- AC circuits (AP/College)
- Signal characteristics (AP/College)
- Laboratory techniques (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `channels` | number | Number of inputs |
| `signals` | array | Input waveforms |
| `timeBase` | number | s/division |
| `voltageScale` | number | V/division |
| `triggerSettings` | object | Trigger configuration |
| `showMeasurements` | boolean | Auto-measure |
| `cursorsEnabled` | boolean | Manual measurement |

---

#### 10.3 Data Analysis Tool

**Description**: A statistical analysis tool for physics data including linear regression, uncertainty propagation, and graphing.

**Core Interactions**:
- Enter experimental data
- Calculate mean, std dev
- Perform linear regression
- Propagate uncertainties
- Create graphs with error bars
- Linearize non-linear data
- Compare to theoretical predictions

**Use Cases**:
- Data analysis (all levels)
- Graphing skills (High School)
- Linear regression (High School/AP)
- Uncertainty analysis (AP/College)
- Lab reports (all levels)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `data` | array | Experimental values |
| `uncertainties` | array | Measurement errors |
| `showStatistics` | boolean | Mean, std dev |
| `linearRegression` | boolean | Best fit line |
| `showErrorBars` | boolean | Graph with uncertainty |
| `propagation` | boolean | Error propagation |
| `linearization` | enum | Transform options |

---

#### 10.4 Unit Converter and Dimensional Analysis

**Description**: A physics-focused unit converter with dimensional analysis verification.

**Core Interactions**:
- Convert between units
- Show dimensional analysis
- Verify equation dimensions
- Handle SI and non-SI units
- Show conversion factors
- Check physical reasonableness
- Common physics unit sets

**Use Cases**:
- Unit conversion (all levels)
- Dimensional analysis (High School/AP)
- Equation verification (AP/College)
- Problem solving checks (all levels)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `value` | number | Input value |
| `fromUnit` | string | Starting unit |
| `toUnit` | string | Target unit |
| `showConversion` | boolean | Factor chain |
| `dimensionalCheck` | boolean | Verify dimensions |
| `unitCategory` | enum | Mechanics, E&M, thermal, etc. |
| `significantFigures` | number | Output precision |

---

#### 10.5 Vector Calculator

**Description**: A tool for performing vector operations common in physics including addition, dot product, and cross product.

**Core Interactions**:
- Enter vectors (component or magnitude/angle)
- Add/subtract vectors
- Calculate dot product
- Calculate cross product
- Find magnitude and direction
- Resolve into components
- Visualize operations in 2D/3D

**Use Cases**:
- Vector basics (High School)
- Vector addition (High School)
- Dot product (AP/College)
- Cross product (AP/College)
- 3D problems (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `vectors` | array | Input vectors |
| `operation` | enum | `add`, `subtract`, `dot`, `cross` |
| `inputFormat` | enum | `components`, `magnitudeAngle` |
| `dimensions` | enum | `2d`, `3d` |
| `showVisualization` | boolean | Graphical display |
| `showCalculation` | boolean | Step-by-step |

---

### 11. Simulation Environments

#### 11.1 Physics Sandbox

**Description**: An open-ended 2D physics simulation where objects interact according to physical laws.

**Core Interactions**:
- Place objects (balls, blocks, springs, ropes)
- Set initial conditions
- Apply forces and constraints
- Watch simulation evolve
- Pause and measure
- Add/remove elements dynamically
- Save and share scenarios

**Use Cases**:
- Exploration (all levels)
- Hypothesis testing (all levels)
- Complex system behavior (all levels)
- Problem visualization (all levels)
- Creative physics play (all levels)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `availableObjects` | array | Object palette |
| `gravity` | number | g value |
| `friction` | number | Global friction |
| `airResistance` | boolean | Include drag |
| `showVectors` | boolean | Force/velocity display |
| `measurementTools` | boolean | Rulers, protractors |
| `slowMotion` | boolean | Time scaling |

---

#### 11.2 Solar System Simulator

**Description**: A gravitational simulation of planetary motion demonstrating Kepler's laws and orbital mechanics.

**Core Interactions**:
- View solar system orbits
- Focus on individual planets
- Adjust time scale
- Measure orbital parameters
- Verify Kepler's laws
- Add custom bodies
- Explore gravitational slingshots

**Use Cases**:
- Gravity and orbits (Middle School/High School)
- Kepler's laws (High School/AP)
- Gravitational potential (AP/College)
- Orbital mechanics (College)
- Space mission physics (AP/College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `bodies` | array | Planets and objects |
| `timeScale` | number | Simulation speed |
| `viewMode` | enum | `topDown`, `3d`, `fromBody` |
| `showOrbits` | boolean | Trajectory paths |
| `showVectors` | boolean | Velocity, acceleration |
| `keplerAnalysis` | boolean | Law verification |
| `customBodies` | boolean | Add objects |

---

#### 11.3 Electromagnetic Wave Animator

**Description**: A 3D visualization of electromagnetic waves showing the relationship between E and B fields.

**Core Interactions**:
- Visualize propagating EM wave
- Show E and B field oscillations
- Demonstrate perpendicularity
- Relate to Poynting vector
- Explore polarization
- Adjust frequency/wavelength
- Show energy transport

**Use Cases**:
- EM waves (High School/AP)
- Wave properties (AP/College)
- Polarization (AP/College)
- Energy in EM waves (AP/College)
- Maxwell's equations (College)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `wavelength` | number | Wave wavelength |
| `amplitude` | number | Field amplitude |
| `showEField` | boolean | Electric field |
| `showBField` | boolean | Magnetic field |
| `showPoynting` | boolean | Energy flow |
| `polarization` | enum | `linear`, `circular` |
| `animationSpeed` | number | Propagation speed |

---

## Technical Requirements

### State Management

All primitives must implement:

```typescript
interface PhysicsPrimitiveState {
  // Unique identifier
  id: string;
  
  // Configuration
  config: PrimitiveConfig;
  
  // Current state
  state: SimulationState;
  
  // Serialization
  serialize(): string;
  deserialize(data: string): void;
  
  // Event emission
  onChange(callback: (state: any) => void): void;
  
  // Validation
  validate(): ValidationResult;
  
  // Physics accuracy verification
  checkPhysicalConsistency(): PhysicsValidationResult;
  
  // Time evolution (for simulations)
  step(dt: number): void;
}
```

### Physics Engine Requirements

- Support for rigid body dynamics
- Spring and constraint systems
- Collision detection and response
- Field calculations (gravity, electric, magnetic)
- Wave propagation
- Conservation law verification
- Numerical integration (RK4 minimum)
- Adaptive time stepping

### Accuracy Standards

- All simulations must conserve appropriate quantities within numerical precision
- Display clear indicators when approximations are used
- Option to show idealized vs realistic behavior
- Clear documentation of physical assumptions

### Accessibility Requirements

Each primitive must support:
- Full keyboard navigation
- Screen reader descriptions
- High contrast mode
- Color-blind safe (not just red/green for positive/negative)
- Alternative representations for visual simulations
- Adjustable animation speeds
- Audio feedback options for blind users

### Performance Requirements

- Initial render: < 100ms
- Physics step: < 16ms (60fps minimum)
- Smooth animations at 60fps with up to 1000 particles
- State save/load: < 100ms
- Maximum bundle size per primitive: 150KB gzipped

---

## Implementation Priority

### Phase 1: Core Mechanics
1. Motion Diagram / Strobe Diagram
2. Position-Time Graph
3. Velocity-Time Graph
4. Free Body Diagram Builder
5. Kinematic Equation Solver
6. Newton's Second Law Simulator

### Phase 2: Forces & Energy
7. Projectile Motion Simulator
8. Friction Explorer
9. Inclined Plane Analyzer
10. Energy Bar Chart
11. Work Calculator
12. Conservation of Energy Simulator

### Phase 3: Momentum & Rotation
13. Momentum Bar Chart
14. Collision Simulator
15. Impulse-Momentum Visualizer
16. Torque Calculator
17. Angular Motion Visualizer

### Phase 4: Oscillations & Waves
18. Simple Harmonic Motion Simulator
19. Pendulum Lab
20. Wave on String Simulator
21. Wave Interference Demonstrator
22. Standing Wave Analyzer
23. Doppler Effect Simulator

### Phase 5: Electricity & Magnetism
24. Electric Field Visualizer
25. Electric Potential Visualizer
26. DC Circuit Builder
27. Ohm's Law Calculator
28. Magnetic Field Visualizer
29. Electromagnetic Induction Lab

### Phase 6: Light & Modern Physics
30. Ray Optics Workbench
31. Snell's Law Calculator
32. Wave Optics Simulator
33. Photoelectric Effect Simulator
34. Atomic Model Explorer

### Phase 7: Thermodynamics & Advanced
35. Ideal Gas Simulator
36. PV Diagram Analyzer
37. Heat Engine Simulator
38. Special Relativity Visualizer
39. Nuclear Physics Toolkit

### Phase 8: Tools & Environments
40. Vernier Caliper Simulator
41. Data Analysis Tool
42. Unit Converter
43. Vector Calculator
44. Physics Sandbox
45. Solar System Simulator

### Phase 9: Remaining Primitives
46. Acceleration-Time Graph
47. Relative Motion Visualizer
48. Force Table Simulator
49. Atwood Machine Simulator
50. Tension and Pulley Systems
51. Circular Motion Analyzer
52. Spring/Elastic PE Simulator
53. Center of Mass Visualizer
54. Moment of Inertia Explorer
55. Rotational Dynamics Simulator
56. Angular Momentum Demonstrator
57. Damped and Driven Oscillations
58. Longitudinal Wave Visualizer
59. Capacitor Explorer
60. Lorentz Force Demonstrator
61. Lens/Mirror Equation Solver
62. Color and Spectrum Explorer
63. Matter Wave Visualizer
64. Heat Transfer Visualizer
65. Oscilloscope Simulator
66. EM Wave Animator

---

## Appendix A: Level Mapping

| Level | Primary Primitives |
|-------|-------------------|
| Middle School | Motion Diagrams, Position-Time Graphs, Free Body Diagrams, Energy Bar Charts, Wave Basics, Circuit Basics, Ray Optics |
| High School Physics | All kinematics, Forces, Energy, Momentum, Waves, Basic E&M, Geometric Optics |
| AP Physics 1 | Mechanics (deep), Waves, Basic Circuits, Rotational Motion |
| AP Physics 2 | Fluids, Thermodynamics, E&M, Optics, Modern Physics |
| AP Physics C | Advanced Mechanics, Calculus-based E&M, Rotational Dynamics |
| College Intro | All above with increased mathematical rigor |
| College Advanced | Special Relativity, Quantum Basics, Statistical Mechanics |

---

## Appendix B: Physical Constants Database

The system requires accurate values for:

**Fundamental Constants**
- Speed of light (c)
- Planck's constant (h, ℏ)
- Elementary charge (e)
- Electron mass (mₑ)
- Proton mass (mₚ)
- Gravitational constant (G)
- Boltzmann constant (k_B)
- Avogadro's number (N_A)
- Permittivity of free space (ε₀)
- Permeability of free space (μ₀)

**Derived Constants**
- Stefan-Boltzmann constant (σ)
- Coulomb's constant (k)
- Rydberg constant (R)
- Fine structure constant (α)

**Material Properties**
- Densities of common materials
- Specific heats
- Thermal conductivities
- Indices of refraction
- Resistivities
- Spring constants (typical)
- Coefficients of friction

---

## Appendix C: Common Physical Scenarios

Pre-built scenarios for quick deployment:

**Mechanics**
- Ball rolling down ramp
- Pendulum clock
- Bouncing ball
- Car collision
- Roller coaster
- Atwood machine
- Spring oscillator

**Waves**
- Guitar string
- Organ pipe
- Ripple tank
- Radio transmission

**E&M**
- Charging capacitor
- RC circuit
- Electromagnetic crane
- Electric motor
- Generator

**Optics**
- Magnifying glass
- Camera obscura
- Telescope
- Fiber optic cable
- Rainbow

**Modern**
- Hydrogen atom
- Photoelectric cell
- Nuclear decay chain
- Time dilation scenario

---

## Appendix D: Safety Considerations

Although physics simulations are generally safer than chemistry, certain considerations apply:

1. **Electrical Safety**: Any real-world electrical experiments referenced should include safety warnings
2. **Radiation**: Nuclear physics simulations should include context about radiation safety
3. **Scale Awareness**: Make clear when phenomena are dangerous at human scales
4. **Laser Safety**: Optics simulations mentioning lasers should note eye safety
5. **High Voltage**: E&M applications should note high voltage dangers
6. **Realistic Limits**: Show what happens when physical systems exceed safe operating ranges
