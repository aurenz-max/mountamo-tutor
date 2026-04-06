# Fundamental Physics Primitives
## Product Requirements Document

> **Status:** Draft
> **Supersedes:** `k5-physics-primitives-prd.md` (K-5), `physics-primitives-prd.md` (MS-AP) for build prioritization. Those documents remain valid references for detailed config options and full primitive inventories. This PRD defines the **buildable first 30 primitives** with full eval mode specs, Gemini generation constraints, and living simulation requirements.

---

## Philosophy

Physics is the science of *why things move, stop, change, and interact*. Every primitive in this PRD must answer a student's "what happens if...?" with a simulation they can see and manipulate — not a diagram they read.

**Core tension:** Physics spans K through AP/college. The same concept (e.g., "forces cause acceleration") must be explorable by a kindergartener pushing a toy car AND a high schooler computing F=ma. This PRD solves that with **grade-adaptive eval modes** — one primitive, multiple difficulty tiers, adaptive engine routes the right tier to the right student.

---

## Design Principles

1. **Living Simulation Pattern** — Every physics primitive uses canvas-based physics simulation. The component owns the physics engine (position, velocity, acceleration, forces, collisions). Gemini owns the words (challenge text, themes, object names, explanations). No SVG-label physics. No static diagrams pretending to be simulations.

2. **Predict-Observe-Explain** — Every eval mode above Tier 1 asks "What do you think will happen?" BEFORE running the simulation. The prediction IS the assessment. The simulation IS the feedback.

3. **Everyday First, Formalism Later** — K-2 sees playgrounds and toys. Grades 3-5 see labeled measurements. Grades 6-8 see graphs and equations. Grades 9-12 see vector decomposition and calculus connections. Same primitive, different presentation layer controlled by eval mode tier.

4. **One Concept, One Primitive** — Each primitive teaches ONE fundamental physics concept deeply. "Push & Pull Arena" teaches forces cause motion. It does NOT also teach energy, waves, or circuits. Cross-concept connections happen at the curriculum layer, not the primitive layer.

5. **Measurable Outcomes** — Every primitive produces a binary correct/incorrect signal for IRT calibration. Open-ended exploration is valuable but lives in `observe` eval modes with low beta — the adaptive engine needs clear signal from higher tiers.

6. **NGSS Alignment** — Every primitive maps to specific NGSS Performance Expectations. K-2 Disciplinary Core Ideas (DCI) form the foundation; 3-5, MS, and HS DCIs layer on top.

---

## Standards Coverage Map

### K-2 Physical Science (PS)

| DCI | Performance Expectation | Primitive(s) |
|-----|------------------------|-------------|
| PS2.A Forces & Motion | K-PS2-1: Pushes/pulls change motion | Push & Pull Arena |
| PS2.A Forces & Motion | K-PS2-2: Pushing/pulling changes speed/direction | Push & Pull Arena, Race Track Lab |
| PS2.B Friction | K-PS2-1: Different surfaces affect motion | Push & Pull Arena (surface friction) |
| PS3.B Conservation of Energy | K-PS3-1: Sunlight warms Earth | Heat Flow Simulator |
| PS3.C Energy Transfer | K-PS3-2: Bigger push = farther | Push & Pull Arena, Ramp Racer |
| PS4.A Wave Properties | 1-PS4-1: Sound from vibrating materials | Sound Wave Explorer (exists), Musical Instrument Builder |
| PS4.B EM Radiation | 1-PS4-2: Objects seen only with light | Shadow Theater |
| PS4.C Info Transfer | 1-PS4-4: Devices use light/sound to communicate | Sound Wave Explorer |
| PS1.A Structure of Matter | 2-PS1-1: Different materials have different properties | Sink or Float Lab |
| PS1.B Chemical Reactions | 2-PS1-4: Heating/cooling causes changes | Melting & Freezing Lab |

### 3-5 Physical Science

| DCI | Performance Expectation | Primitive(s) |
|-----|------------------------|-------------|
| PS2.A Forces & Motion | 3-PS2-1: Objects in contact exert forces | Push & Pull Arena, Collision Lab |
| PS2.A Forces & Motion | 3-PS2-2: Predict motion from forces | Race Track Lab, Gravity Drop Tower |
| PS2.B Friction | 3-PS2-1: Friction depends on materials | Push & Pull Arena |
| PS2.B Electrostatics | 3-PS2-3: Electric/magnetic forces at distance | Magnet Explorer, Static Electricity Lab |
| PS2.B Magnetism | 3-PS2-4: Magnetic force patterns | Magnet Explorer |
| PS3.A Energy | 4-PS3-1: Speed relates to energy | Roller Coaster Designer, Collision Lab |
| PS3.B Conservation | 4-PS3-2: Energy converts between forms | Roller Coaster Designer |
| PS3.C Transfer | 4-PS3-3: Energy from collision | Collision Lab |
| PS3.D Applications | 4-PS3-4: Apply energy transfer | Circuit Sandbox, Heat Flow Simulator |
| PS4.A Waves | 4-PS4-1: Waves are patterns of motion | Wave Tank |
| PS4.B Light | 4-PS4-2: Light reflects/refracts | Shadow Theater, Mirror & Lens Lab |
| PS1.A Matter | 5-PS1-1: Matter has measurable properties | Sink or Float Lab |
| PS2.B Gravity | 5-PS2-1: Gravitational force depends on mass | Gravity Drop Tower |

### MS Physical Science

| DCI | Performance Expectation | Primitive(s) |
|-----|------------------------|-------------|
| PS2.A Forces | MS-PS2-1: Apply Newton's 3rd Law | Force Diagram Builder |
| PS2.A Forces | MS-PS2-2: Plan investigation of F=ma | Force Diagram Builder, Push & Pull Arena |
| PS3.A Energy | MS-PS3-1: Construct explanation of KE | Roller Coaster Designer, Collision Lab |
| PS3.A Energy | MS-PS3-2: Potential energy from position | Roller Coaster Designer, Gravity Drop Tower |
| PS3.B Conservation | MS-PS3-5: Energy is conserved | Roller Coaster Designer |
| PS4.A Waves | MS-PS4-1: Model wave properties | Wave Tank |
| PS4.A Waves | MS-PS4-2: Model wave reflection/absorption | Wave Tank |

### HS Physical Science

| DCI | Performance Expectation | Primitive(s) |
|-----|------------------------|-------------|
| PS2.A Forces | HS-PS2-1: Analyze data to support Newton's 2nd Law | Force Diagram Builder |
| PS2.B Gravity | HS-PS2-4: Mathematical model of gravitational force | Gravity Drop Tower, Orbit Lab |
| PS3.A Energy | HS-PS3-1: Create computational model of energy | Roller Coaster Designer |
| PS3.B Conservation | HS-PS3-2: Develop model of energy conservation | Roller Coaster Designer, Collision Lab |
| PS3.D Applications | HS-PS3-3: Design energy transfer solution | Circuit Sandbox |
| PS4.A Waves | HS-PS4-1: Use math to represent wave properties | Wave Tank |
| PS4.B EM | HS-PS4-3: Evaluate communication technology | Circuit Sandbox |

---

## Primitives by Domain

### Domain 1: Forces & Motion (Mechanics Foundation)

The most fundamental physics concept: forces cause changes in motion. This domain is the #1 build priority — it covers the most NGSS standards and forms the foundation for every other domain.

---

#### 1.1 Push & Pull Arena

**Concept:** Forces cause motion. Bigger forces cause more acceleration. Heavier objects need bigger forces. Friction opposes motion.

**Grade Band:** K-5 (extends to MS with force decomposition)

**NGSS:** K-PS2-1, K-PS2-2, 3-PS2-1, 3-PS2-2, MS-PS2-2

**Living Simulation:**
- Canvas arena with physics: objects have mass, position, velocity
- Applied force → acceleration (F=ma under the hood, visible as "push strength" for young students)
- Friction coefficient per surface type decelerates objects
- Force arrows scale with magnitude, color-coded by direction
- Objects have visible size proportional to mass (heavier = bigger)
- Collision response when objects hit walls or each other

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | K-1 | Push an object, MC: "Which direction did it go?" / "Did it move fast or slow?" |
| `predict` | 3.0 | 1-3 | Given object weight + push strength, predict: will it move? Which moves farther? |
| `compare` | 4.5 | 2-4 | Two objects, two surfaces — rank by motion. "Which needs a bigger push?" |
| `design` | 6.0 | 3-5 | Set up forces to achieve a goal: move heavy object to target, stop a moving object, balance opposing forces |
| `calculate` | 7.5 | MS+ | Given mass and acceleration, determine force. Force decomposition with angles. |

**Gemini Generation:**
- Generates: theme (playground/toys/sports), objects (name, mass, image_description), surface (name, friction_coefficient), challenge instructions, correct answers
- Schema: `PushPullChallenge { theme, object: {name, mass, emoji}, surface: {name, friction}, forceDirection, forceStrength, question, correctAnswer, distractors[] }`
- Keep schema flat — 3 types max

**Tutoring Scaffold:**
- Level 1: "Push the [object]! Watch it slide. Did it go far or just a little?"
- Level 2: "This [object] is heavy. You'll need a BIG push. Try the strongest force — see how it moves compared to the light one?"
- Level 3: "Here's the rule: Force = mass x acceleration. A 2kg box with 4N of force accelerates at 2 m/s^2. The carpet has friction of 1N, so net force is 3N..."

---

#### 1.2 Race Track Lab

**Concept:** Speed is distance over time. Objects can move at constant speed or accelerate. Faster objects cover more distance in the same time.

**Grade Band:** K-5 (extends to MS with kinematics graphs)

**NGSS:** K-PS2-2, 3-PS2-2

**Living Simulation:**
- Canvas race track with grid lines for distance measurement
- 1-4 racers with individually controllable speeds
- Position updated each frame: x += v * dt (constant speed) or x += v*dt + 0.5*a*dt^2
- Time display counting up during race
- Optional "snapshot" mode: freeze positions at equal time intervals (bridge to motion diagrams)
- Finish line detection with placement results

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | K-1 | Watch race, answer: "Who won?" / "Who was fastest?" |
| `predict` | 3.0 | 1-2 | Set speeds, predict winner before race runs |
| `measure` | 4.5 | 2-4 | Count grid squares traveled, compare distances in same time |
| `calculate` | 6.0 | 4-5 | Given distance and time, compute speed. "How far will it go in 10 seconds?" |
| `graph` | 7.5 | MS | Generate position-time graph from race, identify velocity from slope |

**Gemini Generation:**
- Generates: racer characters (name, emoji, speed), track length, challenge question, correct answer
- Schema: `RaceChallenge { racers: {name, emoji, speed}[], trackLength, timeLimit?, question, correctAnswer, distractors[] }`

---

#### 1.3 Gravity Drop Tower

**Concept:** All objects fall at the same rate (without air resistance). Gravity pulls everything down. Heavier objects DON'T fall faster (the great misconception).

**Grade Band:** K-5 (extends to HS with g=9.8 m/s^2, projectile motion)

**NGSS:** 5-PS2-1, MS-PS2-2, HS-PS2-4

**Living Simulation:**
- Canvas with vertical drop zone, height markers
- Objects fall with acceleration g (scaled for visual clarity at K level)
- Optional air resistance mode: drag force proportional to cross-section and velocity
- Side-by-side drop comparison (two objects simultaneously)
- Slow-motion replay capability
- Splat/bounce animation on landing
- Height measurement tool

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | K-1 | Drop objects, answer: "What happened?" / "Did it go up or down?" |
| `predict` | 3.0 | 1-3 | "Which lands first — the bowling ball or the feather?" (with/without air) |
| `compare` | 4.5 | 2-4 | Drop from different heights, rank landing order. Toggle air resistance on/off. |
| `measure` | 6.0 | 4-5 | Time the fall, measure height, discover relationship between height and fall time |
| `calculate` | 7.5 | MS-HS | Use h = 1/2 g t^2 to predict fall time. Calculate velocity at impact. |

**Gemini Generation:**
- Generates: objects (name, mass, shape, drag_coefficient), drop heights, air_resistance flag, question, correct answer
- Schema: `DropChallenge { objects: {name, emoji, mass, dragCoeff}[], height, airResistance: boolean, question, correctAnswer, distractors[] }`

---

#### 1.4 Collision Lab

**Concept:** When objects collide, they transfer energy and momentum. Elastic collisions bounce, inelastic collisions stick. Total momentum is conserved.

**Grade Band:** 2-5 (extends to HS with momentum conservation equations)

**NGSS:** 4-PS3-1, 4-PS3-3, MS-PS3-1, HS-PS3-2

**Living Simulation:**
- Canvas with 1D or 2D collision arena
- Objects with mass, velocity, and coefficient of restitution
- Launch one or both objects toward each other
- Elastic collision: objects bounce with velocity exchange based on mass ratio
- Inelastic collision: objects stick together, combined velocity from momentum conservation
- Energy bar display (KE before/after) showing energy "lost" to sound/heat
- Momentum arrows displayed before and after collision

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | 2-3 | Crash two objects, MC: "What happened to the big one? The small one?" |
| `predict` | 3.0 | 3-4 | Before collision: "Will the red ball bounce back or keep going?" |
| `compare` | 4.5 | 4-5 | Same speed, different masses: "Which transfers more energy?" |
| `conserve` | 6.0 | MS | Given masses and initial velocities, predict final velocities using momentum conservation |
| `analyze` | 7.5 | HS | Calculate KE loss, classify elastic/inelastic, 2D collision with angle decomposition |

**Gemini Generation:**
- Generates: objects (name, mass, velocity, color), collision type (elastic/inelastic), question, correct answer
- Schema: `CollisionChallenge { objectA: {name, mass, velocity}, objectB: {name, mass, velocity}, collisionType, question, correctAnswer, distractors[] }`

---

#### 1.5 Force Diagram Builder

**Concept:** Forces are vectors with magnitude and direction. Net force determines acceleration. Free body diagrams are the tool for analyzing forces.

**Grade Band:** 4-5 (extends through AP)

**NGSS:** MS-PS2-1, MS-PS2-2, HS-PS2-1

**Living Simulation:**
- Canvas with an object at center
- Drag-to-create force arrows from the object
- Each arrow: direction (angle), magnitude (length), label
- Net force computed and displayed as dashed arrow
- When "play" is pressed, object accelerates in direction of net force
- Snap angles to 0/30/45/60/90 for clean problems
- Show force decomposition into x/y components (MS+)

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `identify` | 2.0 | 4-5 | Given a scenario, select which forces act (gravity, friction, normal, applied, tension) |
| `draw` | 3.5 | MS | Draw the correct free body diagram for a scenario. All forces with correct directions. |
| `balance` | 5.0 | MS | Add forces to achieve equilibrium (net force = 0). Object must not accelerate. |
| `calculate` | 6.5 | HS | Given force vectors, compute net force magnitude and direction. Decompose into components. |
| `predict` | 8.0 | AP | Multi-body problems: connected objects, pulleys, inclined planes. Predict acceleration of system. |

**Gemini Generation:**
- Generates: scenario description, object (name, mass), forces present (type, magnitude, angle), question, correct answer
- Schema: `ForceDiagramChallenge { scenario, object: {name, mass}, forces: {type, magnitude, angle}[], question, correctAnswer }`

---

### Domain 2: Energy (Conservation & Transfer)

Energy is the universal currency of physics. These primitives build from "fast things have energy" to conservation laws and thermodynamics.

---

#### 2.1 Roller Coaster Designer

**Concept:** Energy converts between potential (height) and kinetic (speed). Total energy is conserved (minus friction). You can't go higher than you started.

**Grade Band:** K-5 (extends to HS with energy equations)

**NGSS:** 4-PS3-1, 4-PS3-2, MS-PS3-1, MS-PS3-2, MS-PS3-5, HS-PS3-1, HS-PS3-2

**Living Simulation:**
- Canvas track builder: click/drag control points to shape the track
- Car released from starting height, moves along track
- Velocity computed from energy conservation: v = sqrt(2g(h_start - h_current))
- Car stops / fails if track goes higher than start
- Speed indicator (color gradient: slow=blue, fast=red)
- Energy bar chart: PE (blue) + KE (red) = Total (always same height)
- Optional friction: energy bar shows thermal energy growing, total shrinks
- Loop-the-loop feasibility: car must have enough speed at top (v^2/r >= g)

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `explore` | 1.5 | K-2 | Build a track, watch car go. MC: "Where was the car fastest?" |
| `predict` | 3.0 | 2-4 | "Will the car make it over this hill?" before releasing |
| `design` | 4.5 | 3-5 | Build a track that reaches a target zone. Must manage energy budget. |
| `analyze` | 6.0 | MS | Read the energy bar chart. "How much KE at the bottom?" |
| `calculate` | 7.5 | HS | Given mass and heights, calculate speed at each point. Include friction losses. |

**Gemini Generation:**
- Generates: track shape (control points), starting height, challenge goal, questions
- Schema: `CoasterChallenge { trackPoints: {x, y}[], startHeight, friction?, goal, question, correctAnswer }`

---

#### 2.2 Energy Transfer Chain

**Concept:** Energy flows from one form to another in chains. Every machine is an energy transfer chain. Energy is never created or destroyed, only converted.

**Grade Band:** 3-8

**NGSS:** 4-PS3-2, 4-PS3-4, MS-PS3-5

**Living Simulation:**
- Visual chain: source → converter → output (e.g., battery → motor → fan → wind)
- Each link shows energy type: chemical, electrical, kinetic, thermal, light, sound, elastic, gravitational
- Energy flow arrows with thickness proportional to amount
- "Waste" branches show thermal/sound losses at each conversion
- Students connect links to build working chains
- Animated energy particles flow through the chain

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `identify` | 2.0 | 3-4 | Given a device (flashlight, car, solar panel), identify energy types involved |
| `order` | 3.5 | 4-5 | Arrange energy conversions in correct order for a given machine |
| `complete` | 5.0 | 5-6 | Fill in missing links in a chain. "Battery → ? → Light" (answer: electrical) |
| `trace` | 6.5 | MS | Full chain with losses. "What % of energy reaches the output?" |

**Gemini Generation:**
- Generates: device/machine name, energy chain (ordered types), missing link index, question
- Schema: `EnergyChainChallenge { device, chain: {type, amount}[], missingIndex?, question, correctAnswer, distractors[] }`

---

#### 2.3 Heat Flow Simulator

**Concept:** Heat flows from hot to cold. Conductors transfer heat quickly, insulators slowly. Thermal equilibrium is reached when temperatures equalize.

**Grade Band:** 2-8

**NGSS:** K-PS3-1, 2-PS1-4, 4-PS3-4, MS-PS3-4

**Living Simulation:**
- Canvas with two or more connected regions at different temperatures
- Temperature represented by color gradient (blue=cold through red=hot)
- Heat particles flow from hot to cold regions
- Rate depends on material conductivity (metal=fast, wood=slow, styrofoam=very slow)
- Temperature numbers update in real-time as equilibrium approaches
- Insulation layers can be added between regions

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | 2-3 | Touch hot thing to cold thing, MC: "Which got warmer? Which got cooler?" |
| `predict` | 3.0 | 3-4 | "If you put the ice cube on the metal plate, what happens?" |
| `rank` | 4.5 | 4-5 | Rank materials by how fast they transfer heat. "Best insulator?" |
| `equilibrium` | 6.0 | MS | "Two objects at 80C and 20C — what's the final temperature?" (equal masses) |
| `calculate` | 7.5 | MS-HS | Q = mcDeltaT calculations. Different masses, specific heats. |

**Gemini Generation:**
- Generates: objects with temperatures and materials, question about heat flow
- Schema: `HeatChallenge { objects: {name, temperature, material, mass}[], question, correctAnswer, distractors[] }`

---

#### 2.4 Melting & Freezing Lab

**Concept:** Matter changes phase at specific temperatures. Adding heat doesn't always raise temperature — it can change the state instead. Phase diagrams show boundaries.

**Grade Band:** K-5 (extends to HS with latent heat calculations)

**NGSS:** 2-PS1-4, 5-PS1-1, MS-PS1-4

**Living Simulation:**
- Canvas with a substance in a container
- Heat source (burner) and cold source (ice bath) controllable
- Temperature gauge rising/falling
- Visual phase transitions: solid particles vibrate in place → liquid particles flow → gas particles fly apart
- Temperature PLATEAUS during phase changes (the key insight)
- Heating curve graph updates alongside the simulation

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | K-2 | Heat ice, watch it melt. MC: "What happened to the ice?" |
| `predict` | 3.0 | 2-3 | "What happens if we keep heating the water?" |
| `identify` | 4.5 | 3-5 | Given a temperature, identify the state. "Is water at 110C a solid, liquid, or gas?" |
| `graph` | 6.0 | MS | Read a heating curve. "Why does temperature stop rising here?" |
| `calculate` | 7.5 | HS | Calculate energy needed to melt 200g of ice and raise it to 50C. Include latent heat. |

**Gemini Generation:**
- Generates: substance (name, melting_point, boiling_point), starting temperature, heat/cool action, question
- Schema: `PhaseChallenge { substance: {name, meltingPoint, boilingPoint}, startTemp, action, question, correctAnswer, distractors[] }`

---

### Domain 3: Waves, Sound & Light

Waves are how energy travels without matter moving. This domain covers mechanical waves (sound), electromagnetic waves (light), and their shared properties.

---

#### 3.1 Sound Wave Explorer (EXISTS)

Already built and shipped with 4 eval modes. See [physics.ts](../service/manifest/catalog/physics.ts).

---

#### 3.2 Musical Instrument Builder

**Concept:** Pitch depends on size, tension, and material. Bigger/longer = lower pitch. Tighter/shorter = higher pitch. All sound comes from vibration.

**Grade Band:** K-5

**NGSS:** 1-PS4-1, 4-PS4-1

**Living Simulation:**
- Canvas with instrument builder zones: drums, strings, pipes, bottles
- Resize instruments (bigger drums, longer strings, taller bottles)
- Pluck/strike to hear sound (Web Audio API oscillator tuned to physics-correct frequency)
- Visible vibration animation scaled to frequency
- Optional waveform display showing frequency/amplitude
- Instrument rack for arranging by pitch (sorting challenge)

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `play` | 1.5 | K-1 | Tap instruments, MC: "Which one made the highest sound?" |
| `predict` | 3.0 | 1-3 | "I'm going to make this drum BIGGER. Will the sound go higher or lower?" |
| `sort` | 4.5 | 2-4 | Arrange 4-5 instruments from lowest to highest pitch |
| `design` | 6.0 | 4-5 | Build an instrument that matches a target pitch. Adjust size/tension. |

**Gemini Generation:**
- Generates: instrument type, size/tension parameters, target pitch for design mode, question
- Schema: `InstrumentChallenge { instrumentType, size, tension?, question, correctAnswer, distractors[] }`

---

#### 3.3 Wave Tank

**Concept:** Waves have amplitude, frequency, and wavelength. They reflect, refract, diffract, and interfere. All wave behavior follows the same rules.

**Grade Band:** 3-8 (extends to HS with mathematical wave description)

**NGSS:** 4-PS4-1, MS-PS4-1, MS-PS4-2, HS-PS4-1

**Living Simulation:**
- Canvas with 2D water surface simulation (ripple tank)
- Point source creates circular waves, plane source creates parallel waves
- Amplitude and frequency sliders
- Barriers with gaps (for diffraction)
- Two sources (for interference patterns)
- Reflective walls (for reflection)
- Color-coded: peaks = bright, troughs = dark
- Wavelength measurement tool (distance between peaks)

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | 3-4 | Create waves, MC: "What happens when waves hit the wall?" |
| `measure` | 3.0 | 4-5 | Measure wavelength and count wave peaks in a given time (frequency) |
| `predict` | 4.5 | MS | "I increase frequency. What happens to wavelength?" (inverse relationship) |
| `interference` | 6.0 | MS-HS | Two sources: identify constructive/destructive interference zones |
| `calculate` | 7.5 | HS | v = fλ calculations. Diffraction angle from slit width. |

**Gemini Generation:**
- Generates: wave source config, barriers/slits, measurement targets, question
- Schema: `WaveChallenge { sources: {type, frequency, amplitude}[], barriers: {position, gapWidth?}[], question, correctAnswer, distractors[] }`

---

#### 3.4 Shadow Theater

**Concept:** Light travels in straight lines. Shadows form when light is blocked. Shadow size depends on distance from light source and object.

**Grade Band:** K-5 (extends to MS with ray diagrams)

**NGSS:** 1-PS4-2, 4-PS4-2

**Living Simulation:**
- Canvas with point light source, movable objects, and a screen/wall
- Light rays drawn from source past object edges to screen
- Shadow region clearly shaded
- Move object closer/farther from light → shadow changes size
- Multiple objects create overlapping shadows
- Color filters on light sources (for color mixing)
- Rotate objects to change shadow shape

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | K-1 | Move objects, MC: "Where is the shadow?" / "Is it bigger or smaller now?" |
| `predict` | 3.0 | 1-3 | "If I move the object closer to the light, what happens to the shadow?" |
| `match` | 4.5 | 2-4 | Create a shadow that matches a target shape by positioning objects |
| `trace` | 6.0 | 4-5 | Draw where the shadow will fall given light position and object position |
| `ray_diagram` | 7.5 | MS | Draw light rays to explain shadow formation. Calculate shadow size from geometry. |

**Gemini Generation:**
- Generates: light source position, object shapes and positions, screen position, question
- Schema: `ShadowChallenge { lightSource: {x, y}, objects: {shape, x, y}[], screenPosition, question, correctAnswer, distractors[] }`

---

#### 3.5 Mirror & Lens Lab

**Concept:** Light reflects off mirrors (angle in = angle out) and refracts through lenses (bending at boundaries). Lenses form images.

**Grade Band:** 3-8 (extends to HS with lens/mirror equations)

**NGSS:** 4-PS4-2, MS-PS4-2, HS-PS4-1

**Living Simulation:**
- Canvas with ray optics simulation
- Flat mirror: incident ray, reflected ray, normal line, angle measurement
- Curved mirror: parallel rays converge at focal point
- Lens: rays refract at both surfaces, form image
- Draggable light source and optical elements
- Virtual/real image indicator
- Magnification visible

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | 3-4 | Shine light at mirror, MC: "Where does the light go?" |
| `predict` | 3.0 | 4-5 | "If I move the mirror, where will the light reflect?" |
| `trace` | 5.0 | MS | Draw reflected/refracted ray given incident ray and surface |
| `image` | 6.5 | MS-HS | Find image location for a given object distance and focal length |
| `calculate` | 8.0 | HS | 1/f = 1/do + 1/di, magnification = -di/do |

**Gemini Generation:**
- Generates: optical element (type, focal_length), light source position, question
- Schema: `OpticsChallenge { element: {type, focalLength, position}, lightSource: {position, angle?}, question, correctAnswer, distractors[] }`

---

### Domain 4: Electricity & Magnetism

From static shocks to circuits to electromagnetic induction — the physics that powers civilization.

---

#### 4.1 Static Electricity Lab

**Concept:** Objects can gain or lose electric charge. Like charges repel, opposite charges attract. Charge transfers by contact or induction.

**Grade Band:** 2-5 (extends to MS with Coulomb's law)

**NGSS:** 3-PS2-3

**Living Simulation:**
- Canvas with objects that can be charged by rubbing
- Charge visualized as + and - symbols accumulating on surfaces
- Charged objects attract/repel based on charge signs
- Hair/paper bits respond to nearby charged objects (electroscope effect)
- Spark/discharge animation when charge difference is large enough
- Grounding: touch charged object to ground, charge drains away

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | 2-3 | Rub balloon on sweater, MC: "What happened to the paper bits?" |
| `predict` | 3.0 | 3-4 | "Two balloons both rubbed on wool — will they attract or repel?" |
| `explain` | 4.5 | 4-5 | "Why does the balloon stick to the wall?" (charge transfer reasoning) |
| `model` | 6.0 | MS | Draw charge distribution. "Where are the + and - charges?" |

**Gemini Generation:**
- Generates: objects (material, initial charge), rubbing action, question about resulting behavior
- Schema: `StaticChallenge { objects: {name, material, charge}[], action, question, correctAnswer, distractors[] }`

---

#### 4.2 Magnet Explorer

**Concept:** Magnets have poles (N/S). Like poles repel, opposite attract. Magnetic fields exist around magnets. Some materials are magnetic, others are not.

**Grade Band:** K-5 (extends to MS with field lines, HS with electromagnetism)

**NGSS:** 3-PS2-3, 3-PS2-4

**Living Simulation:**
- Canvas with draggable bar magnets, horseshoe magnets, ring magnets
- Field lines drawn in real-time using dipole field equations
- Iron filings simulation: particles align with field
- Attract/repel forces simulated: magnets slide toward or away from each other
- Test objects: some attracted (paperclip, nail), some not (wood, plastic, aluminum)
- Compass needle that aligns with local field direction

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `explore` | 1.5 | K-2 | Drag magnet near objects, MC: "Which ones stuck to the magnet?" |
| `predict` | 3.0 | 2-4 | "I'm bringing N pole toward N pole. Attract or repel?" |
| `field` | 4.5 | 4-5 | Draw where iron filings would line up. Identify N/S on an unlabeled magnet. |
| `design` | 6.0 | MS | Arrange magnets to create a specific field pattern or move an object to a target |

**Gemini Generation:**
- Generates: magnet configurations, test objects, field questions
- Schema: `MagnetChallenge { magnets: {type, position, orientation}[], testObjects: {name, magnetic: boolean}[], question, correctAnswer, distractors[] }`

---

#### 4.3 Circuit Sandbox

**Concept:** Electric circuits need a complete loop. Current flows from battery through components. Series vs parallel circuits behave differently. Ohm's law: V=IR.

**Grade Band:** 2-8 (extends to HS with Kirchhoff's laws)

**NGSS:** 4-PS3-4, MS-PS3-3, HS-PS3-3

**Living Simulation:**
- Canvas with component palette: batteries, wires, bulbs, switches, resistors, motors
- Drag components onto grid, connect with wires
- Circuit solver runs in real-time: current flows when loop is complete
- Bulb brightness proportional to current
- Ammeter and voltmeter tools for measurement
- Short circuit detection with warning
- Wire color indicates current flow (animated dots)

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `build` | 1.5 | 2-3 | Build a circuit that lights the bulb. "Connect battery, wire, bulb in a loop." |
| `predict` | 3.0 | 3-4 | "I add a second bulb in series. Brighter, dimmer, or same?" |
| `series_parallel` | 4.5 | 4-5 | Build series vs parallel circuits, compare bulb brightness, identify which is which |
| `measure` | 6.0 | MS | Use ammeter/voltmeter. "What's the current through this resistor?" |
| `calculate` | 7.5 | HS | Apply V=IR, series/parallel resistance formulas, Kirchhoff's laws |

**Gemini Generation:**
- Generates: circuit components, target configuration, measurement questions
- Schema: `CircuitChallenge { components: {type, value?}[], targetCircuit?, question, correctAnswer, distractors[] }`

---

#### 4.4 Electromagnetic Induction Lab

**Concept:** Moving a magnet through a coil generates electricity. Changing magnetic fields create electric fields. This is how generators and transformers work.

**Grade Band:** MS-HS

**NGSS:** MS-PS2-3, HS-PS2-5

**Living Simulation:**
- Canvas with a coil of wire connected to a galvanometer/LED
- Draggable bar magnet that can be pushed through the coil
- Faster movement = more voltage (Faraday's law visible)
- Reverse direction = reverse current
- Adjustable coil turns (more turns = more voltage)
- Generator mode: spinning magnet near coil produces AC waveform
- Transformer mode: two coils, varying turns ratio

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 2.0 | MS | Move magnet through coil, MC: "What happened to the meter?" |
| `predict` | 3.5 | MS | "I move the magnet FASTER. What happens to the voltage?" |
| `design` | 5.0 | MS-HS | Build a generator: arrange magnet and coil to produce maximum voltage |
| `calculate` | 7.0 | HS | EMF = -N dΦ/dt. Transformer turns ratio calculations. |

**Gemini Generation:**
- Generates: coil parameters, magnet motion, measurement targets
- Schema: `InductionChallenge { coil: {turns, area}, magnet: {strength, velocity}, question, correctAnswer, distractors[] }`

---

### Domain 5: Fluids & Pressure

Why do things float? Why does water flow? How do hydraulics work? The physics of liquids and gases.

---

#### 5.1 Sink or Float Lab

**Concept:** Whether an object sinks or floats depends on its density compared to the liquid. Density = mass/volume. Shape matters too (boats are hollow).

**Grade Band:** K-5 (extends to MS with density calculations, buoyant force)

**NGSS:** 2-PS1-1, 5-PS1-1

**Living Simulation:**
- Canvas with a tank of liquid (water by default, other liquids selectable)
- Drop objects into liquid: they sink, float, or hover at neutral buoyancy
- Objects have visible mass labels and size (volume) indication
- Density comparison bar: object density vs liquid density
- "Boat builder" sub-mode: shape a piece of clay — flat shapes float, balls sink (same mass!)
- Liquid layers: oil on water on honey — objects settle at different levels

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | K-2 | Drop objects, MC: "Did it sink or float?" |
| `predict` | 3.0 | 2-3 | "This rock is heavy but small. Will it sink or float?" |
| `sort` | 4.5 | 3-4 | Sort 5 objects into "sink" and "float" before testing |
| `density` | 6.0 | 4-5 | Calculate density from mass and volume. "Which liquid will this float in?" |
| `buoyancy` | 7.5 | MS | Archimedes' principle: Fb = ρ_liquid * V_displaced * g. Calculate buoyant force. |

**Gemini Generation:**
- Generates: objects (name, mass, volume, material), liquid (name, density), question
- Schema: `FloatChallenge { objects: {name, mass, volume, emoji}[], liquid: {name, density}, question, correctAnswer, distractors[] }`

---

### Domain 6: Rotation & Oscillation

Spinning, swinging, vibrating — periodic motion is everywhere from playground swings to atomic clocks.

---

#### 6.1 Pendulum Lab

**Concept:** A pendulum's period depends on its length (and gravity), NOT its mass or amplitude (for small swings). This is one of physics' most beautiful and counterintuitive results.

**Grade Band:** 2-8 (extends to HS with SHM equations)

**NGSS:** 3-PS2-1, 3-PS2-2, MS-PS2-2

**Living Simulation:**
- Canvas with a swinging pendulum: bob on a string from a fixed pivot
- Adjustable: string length, bob mass, starting angle
- Timer counting period (time for one complete swing)
- Side-by-side comparison: two pendulums with different parameters
- Trace the arc path
- Energy display: KE + PE bar chart oscillating
- Small angle mode (SHM) vs large angle mode

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | 2-3 | Pull and release, MC: "Does it go back and forth or in circles?" |
| `predict` | 3.0 | 3-4 | "I made the string LONGER. Will it swing faster or slower?" |
| `test` | 4.5 | 4-5 | "What happens if I use a heavier bob?" (answer: nothing changes!) |
| `measure` | 6.0 | MS | Time 10 swings, compute period. Discover T ∝ √L. |
| `calculate` | 7.5 | HS | T = 2π√(L/g). Calculate g from measured T and L. |

**Gemini Generation:**
- Generates: pendulum parameters, variable to test, question about period/behavior
- Schema: `PendulumChallenge { length, mass, startAngle, question, correctAnswer, distractors[] }`

---

#### 6.2 Orbit Lab

**Concept:** Gravity holds planets in orbit. Closer = faster. Orbits are ellipses. Satellites must go fast enough not to fall but not so fast they escape.

**Grade Band:** 3-8 (extends to HS with Kepler's laws, orbital mechanics)

**NGSS:** 5-PS2-1, MS-PS2-4, HS-PS2-4

**Living Simulation:**
- Canvas with central mass (star/planet) and orbiting body
- Gravity computed: F = GMm/r^2 (scaled for visual clarity)
- Launch satellite with adjustable speed and direction
- Too slow: falls into planet. Too fast: escapes. Just right: orbits.
- Trail shows orbital path (ellipse)
- Kepler's 2nd law visible: equal areas in equal times
- Multiple bodies: show orbital periods at different distances

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 1.5 | 3-4 | Launch satellite, MC: "What shape is the orbit?" / "Did it crash or orbit?" |
| `predict` | 3.0 | 4-5 | "I launch FASTER. Bigger orbit or smaller?" |
| `kepler` | 5.0 | MS | "Planet A is twice as far as Planet B. Which has a longer year?" |
| `calculate` | 7.0 | HS | Use T^2 = (4π^2/GM)r^3. Calculate orbital velocity. Escape velocity. |

**Gemini Generation:**
- Generates: central body mass, orbiting body parameters, launch conditions, question
- Schema: `OrbitChallenge { centralMass, satellite: {mass, distance, velocity}, question, correctAnswer, distractors[] }`

---

### Domain 7: Modern Physics (HS-AP Extension)

Relativity, quantum mechanics, nuclear physics. These extend the earlier domains for advanced students.

---

#### 7.1 Photoelectric Effect Lab

**Concept:** Light is made of photons with energy proportional to frequency. Below a threshold frequency, no electrons are emitted regardless of intensity. Above threshold, electron energy depends on frequency, not intensity.

**Grade Band:** HS-AP

**NGSS:** HS-PS4-3, HS-PS4-5

**Living Simulation:**
- Canvas with metal plate, light source, and electron detector
- Frequency slider (color changes: red→violet→UV)
- Intensity slider (brighter light = more photons)
- Below threshold: light hits plate, nothing happens (the key insight)
- Above threshold: electrons fly off with KE = hf - φ
- Current meter shows electron rate (proportional to intensity)
- Energy meter shows electron KE (proportional to frequency - threshold)
- Stopping voltage control to measure max KE

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 3.0 | HS | Change frequency, MC: "At what color did electrons start?" |
| `predict` | 5.0 | HS | "I double the intensity but keep frequency the same. More electrons or faster electrons?" |
| `graph` | 6.5 | HS-AP | Plot KE_max vs frequency. Extract work function from y-intercept. |
| `calculate` | 8.0 | AP | KE_max = hf - φ. Calculate threshold frequency, stopping voltage, Planck's constant from data. |

**Gemini Generation:**
- Generates: metal (name, work_function), light parameters, question
- Schema: `PhotoelectricChallenge { metal: {name, workFunction}, frequency, intensity, question, correctAnswer, distractors[] }`

---

#### 7.2 Nuclear Decay Simulator

**Concept:** Radioactive atoms decay randomly but with predictable half-lives. After one half-life, half the atoms have decayed. Decay types: alpha (lose 2p+2n), beta (neutron→proton), gamma (energy release).

**Grade Band:** HS-AP

**NGSS:** HS-PS1-8

**Living Simulation:**
- Canvas grid of atoms (colored circles), each with a random decay timer
- Click "start" and watch atoms decay one by one, randomly
- Decayed atoms change color/shape
- Running count: remaining vs decayed
- Decay curve graph plotting N vs t alongside simulation
- Half-life marker on graph
- Adjustable: initial count, half-life, decay type
- Decay chain mode: parent → daughter → granddaughter

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `observe` | 3.0 | HS | Watch 100 atoms decay. MC: "After 1 half-life, about how many are left?" |
| `predict` | 5.0 | HS | "Starting with 200 atoms, half-life = 5 min. How many left after 15 min?" |
| `identify` | 6.5 | HS-AP | Given parent and daughter nuclei, identify decay type (alpha/beta/gamma) |
| `calculate` | 8.0 | AP | N(t) = N_0 (1/2)^(t/t_half). Calculate activity, find half-life from data. |

**Gemini Generation:**
- Generates: isotope, half-life, initial count, time elapsed, question
- Schema: `DecayChallenge { isotope: {name, massNumber, atomicNumber}, halfLife, initialCount, time, question, correctAnswer, distractors[] }`

---

### Domain 8: Measurement & Scientific Thinking

Physics isn't just concepts — it's the discipline of measuring precisely and thinking systematically.

---

#### 8.1 Measurement Olympics

**Concept:** Measuring length, mass, time, and temperature with appropriate tools and units. Estimation skills. Unit conversion.

**Grade Band:** K-5

**NGSS:** K-2-ETS1-1, 3-5-ETS1-3

**Living Simulation:**
- Canvas with objects to measure and tool palette
- Tools: ruler (cm/in), scale/balance (g/kg), stopwatch (s), thermometer (C/F)
- Drag tool to object, tool shows measurement
- Estimation mode: guess first, then measure to check
- Unit conversion challenges at higher levels

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `choose_tool` | 1.5 | K-1 | "Which tool measures how heavy something is?" |
| `estimate` | 3.0 | 1-3 | Estimate length/mass before measuring. Closer estimate = better score. |
| `measure` | 4.5 | 2-4 | Read the measurement from the tool. "How long is this pencil?" |
| `convert` | 6.0 | 4-5 | "12 inches = ? cm" / "2.5 kg = ? g" |

**Gemini Generation:**
- Generates: objects with actual measurements, tools available, questions
- Schema: `MeasureChallenge { object: {name, measurements: {length?, mass?, temp?}}, tool, question, correctAnswer, distractors[] }`

---

#### 8.2 Experiment Designer

**Concept:** The scientific method: hypothesis → controlled experiment → data → conclusion. Variables: independent, dependent, controlled. Fair tests change one thing at a time.

**Grade Band:** 3-8

**NGSS:** 3-5-ETS1-3, MS-ETS1-2, MS-ETS1-3

**Living Simulation:**
- Canvas with experimental setup template
- Students choose: what to change (independent variable), what to measure (dependent variable), what to keep the same (controlled variables)
- Run the "experiment" (linked to another physics primitive's simulation)
- Data table auto-populates
- Simple graph generation from data
- Conclusion prompt: "Did changing X affect Y?"

**Eval Modes:**

| Mode | Beta | Grade | Description |
|------|------|-------|-------------|
| `identify` | 2.0 | 3-4 | Given an experiment description, identify the variables |
| `design` | 3.5 | 4-5 | "Design a fair test: does ramp height affect car speed?" Choose variables correctly. |
| `analyze` | 5.0 | MS | Given data table, identify the relationship. "As X increases, Y...?" |
| `conclude` | 6.5 | MS | Write a conclusion supported by the data. Identify sources of error. |

**Gemini Generation:**
- Generates: experiment scenario, variables, data, question about experimental design
- Schema: `ExperimentChallenge { scenario, variables: {independent, dependent, controlled[]}, data?: {x, y}[], question, correctAnswer, distractors[] }`

---

## Implementation Roadmap

### Wave 1: Forces & Motion Foundation (build first)
> Priority: Covers the most NGSS standards, enables the entire physics curriculum to begin

| # | Primitive | NGSS | Effort | Status | Notes |
|---|-----------|------|--------|--------|-------|
| 1 | Push & Pull Arena | K-PS2-1/2, 3-PS2-1 | MEDIUM | ✅ DONE | Canvas physics, force arrows, friction |
| 2 | Race Track Lab | K-PS2-2, 3-PS2-2 | MEDIUM | ✅ DONE | Grid-based speed/distance |
| 3 | Gravity Drop Tower | 5-PS2-1 | MEDIUM | | Side-by-side drop, air resistance toggle |
| 4 | Collision Lab | 4-PS3-1/3 | MEDIUM | | 1D elastic/inelastic collisions |

### Wave 2: Energy & Everyday Physics
> Priority: Energy conservation is the most important law in physics, and these are the most engaging primitives

| # | Primitive | NGSS | Effort | Status | Notes |
|---|-----------|------|--------|--------|-------|
| 5 | Roller Coaster Designer | 4-PS3-1/2, MS-PS3-5 | LARGE | | Track builder + energy bar chart |
| 6 | Heat Flow Simulator | K-PS3-1, 2-PS1-4 | MEDIUM | | Temperature gradient animation |
| 7 | Melting & Freezing Lab | 2-PS1-4, 5-PS1-1 | MEDIUM | | Phase change with heating curve |
| 8 | Energy Transfer Chain | 4-PS3-2/4 | MEDIUM | | Visual chain builder |

### Wave 3: Waves, Light & Sound
> Priority: Builds on existing sound-wave-explorer, fills K-5 light standards gap

| # | Primitive | NGSS | Effort | Status | Notes |
|---|-----------|------|--------|--------|-------|
| 9 | Musical Instrument Builder | 1-PS4-1 | MEDIUM | | Web Audio + pitch exploration |
| 10 | Shadow Theater | 1-PS4-2, 4-PS4-2 | MEDIUM | | Ray-based shadow casting |
| 11 | Wave Tank | 4-PS4-1, MS-PS4-1 | LARGE | | 2D ripple simulation |
| 12 | Mirror & Lens Lab | 4-PS4-2 | LARGE | | Ray optics simulation |

### Wave 4: Electricity & Magnetism
> Priority: Fills 3-PS2-3/4 and circuit standards

| # | Primitive | NGSS | Effort | Status | Notes |
|---|-----------|------|--------|--------|-------|
| 13 | Magnet Explorer | 3-PS2-3/4 | MEDIUM | | Field line simulation |
| 14 | Static Electricity Lab | 3-PS2-3 | MEDIUM | | Charge transfer |
| 15 | Circuit Sandbox | 4-PS3-4, HS-PS3-3 | LARGE | | Full circuit solver |
| 16 | Electromagnetic Induction Lab | HS-PS2-5 | MEDIUM | | Faraday's law |

### Wave 5: Mechanics Deepening
> Priority: MS-HS standards, builds on Wave 1 foundations

| # | Primitive | NGSS | Effort | Status | Notes |
|---|-----------|------|--------|--------|-------|
| 17 | Force Diagram Builder | MS-PS2-1/2, HS-PS2-1 | LARGE | | Free body diagram tool |
| 18 | Pendulum Lab | 3-PS2-1 | MEDIUM | | Period vs length discovery |
| 19 | Orbit Lab | 5-PS2-1, HS-PS2-4 | LARGE | | Gravitational orbit simulation |
| 20 | Sink or Float Lab | 5-PS1-1 | MEDIUM | | Density & buoyancy |

### Wave 6: Scientific Skills & Modern Physics
> Priority: Investigation tools and advanced extensions

| # | Primitive | NGSS | Effort | Status | Notes |
|---|-----------|------|--------|--------|-------|
| 21 | Measurement Olympics | K-2-ETS1-1 | MEDIUM | | Tool selection & reading |
| 22 | Experiment Designer | 3-5-ETS1-3 | MEDIUM | | Variable identification & fair tests |
| 23 | Photoelectric Effect Lab | HS-PS4-3 | MEDIUM | | Quantum threshold behavior |
| 24 | Nuclear Decay Simulator | HS-PS1-8 | MEDIUM | | Half-life & decay curves |

---

## Gemini Generation Guidelines (all physics primitives)

1. **Schema simplicity:** Max 3-4 types per generator. Flat fields preferred. If a primitive has 4+ eval modes, use orchestrator pattern (one sub-generator per mode).

2. **No answer leakage:** Challenge text must never reveal the answer. "Will the heavy ball fall faster?" is fine. "The heavy ball falls at the same speed because..." is NOT a challenge.

3. **Thematic variety:** Gemini must generate diverse themes/contexts per challenge. A Push & Pull Arena challenge might be set in a playground, a hockey rink, a bowling alley, or a supermarket. Variety keeps content fresh across the difficulty ladder.

4. **Grade-appropriate language:** K-2 challenges use simple vocabulary (push, pull, fast, slow). MS+ challenges introduce technical terms (force, acceleration, momentum). The eval mode tier implicitly selects vocabulary level.

5. **Distractor quality:** MC distractors must be plausible misconceptions, not obviously wrong. "The feather falls slower because it's lighter" is a good distractor (common misconception). "The feather falls slower because it's purple" is not.

---

## Physics Engine Requirements

All living simulation primitives share these physics engine constraints:

1. **Frame rate:** 60fps target, 30fps minimum. Use `requestAnimationFrame` with dt clamping.
2. **Integration:** Semi-implicit Euler for simple cases (push/pull, race track). Verlet for constrained systems (pendulum, orbits).
3. **Scale:** Physics constants (g, G, etc.) scaled for visual clarity. A 1-second fall should take ~1 second of screen time, not 0.45s of real physics.
4. **Determinism:** Same initial conditions = same simulation result. Required for eval mode correctness.
5. **State serialization:** Full simulation state must be serializable for problem authoring and student response capture.

---

## Relationship to Existing PRDs

| Existing PRD | Relationship |
|-------------|-------------|
| `k5-physics-primitives-prd.md` | This PRD absorbs the top K-5 primitives with added eval modes, Gemini specs, and living simulation requirements. The K-5 PRD's Phase 1-3 primitives are prioritized here. Remaining K-5 primitives (Domino Chain, Wrecking Ball, Echo Canyon, etc.) remain valid future additions. |
| `physics-primitives-prd.md` | This PRD absorbs the core MS-AP primitives (Force Diagram Builder, Collision Simulator, Circuit Builder, etc.) with eval modes. The MS-AP PRD's detailed config options remain the reference for implementation. Advanced primitives (Lorentz Force, Capacitor Explorer, PV Diagrams, etc.) remain valid future additions. |

---

## Appendix: Vocabulary Progression

| Grade Band | Core Physics Vocabulary |
|-----------|----------------------|
| K-1 | push, pull, fast, slow, big, small, heavy, light, hot, cold, loud, quiet, light, dark, sink, float, magnet, stick, bounce |
| 2-3 | force, motion, speed, energy, vibrate, sound, shadow, reflect, circuit, balance, weight, temperature, freeze, melt, friction |
| 4-5 | gravity, conductor, insulator, wave, pitch, volume, lens, prism, density, buoyancy, potential energy, kinetic energy |
| MS | acceleration, Newton, Joule, wavelength, frequency, amplitude, resistance, current, voltage, momentum, conservation |
| HS | vector, component, net force, free body diagram, work, power, impulse, angular momentum, electric field, magnetic flux, photon, half-life |
| AP | Lagrangian, Hamiltonian, wave function, differential equation, field line integral, Gauss's law, Faraday's law, Planck's constant |
