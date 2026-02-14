# K-5 Vehicles, Flight & Machines Visual Primitives
## Product Requirements Document — Lumina Platform

### Overview

This document defines interactive visual primitives for vehicle, flight, and machine education (grades K-5) within the Lumina platform. These primitives are designed to be populated by the Gemini Content API using structured JSON schemas, rendered by Lumina's frontend primitive engine, and tracked by the backend evaluation and recommendation services.

The existing engineering primitives cover construction and simple machines (levers, pulleys, gears, bridges). The space primitives cover rockets and orbital mechanics. **Neither covers the machines children encounter and wonder about daily** — airplanes, cars, trains, helicopters, boats. When a child asks "How does an airplane fly?", the platform has no primitive to answer that question with hands-on exploration.

This PRD addresses that gap with **15 primitives across 4 domains**, anchored by **MachineProfile** — a generalized display primitive modeled after SpeciesProfile that provides rich, AI-generated profiles for any vehicle or machine.

### Design Principles

1. **Wonder-Driven**: Start from the questions kids actually ask — "Why don't planes fall?", "How does a helicopter spin?", "What makes a train go?" — and build primitives that answer through exploration, not explanation
2. **Real Machines, Real Data**: Feature actual aircraft, vehicles, and machines with real specifications. A Boeing 747 weighs 178,000 kg and flies at 920 km/h — kids learn with real numbers, not toy examples
3. **See the Invisible**: Airflow, thrust, lift, drag, and friction are invisible forces. Every aerodynamic primitive must make these forces visible through streamlines, color-coded pressure maps, and animated force arrows
4. **Touch and Try**: Every interactive primitive invites manipulation — change wing angle, adjust engine power, load cargo, design a vehicle — and shows immediate causal feedback
5. **Gemini-Native Generation**: Every primitive schema is designed for single-shot Gemini API generation via JSON mode. MachineProfile data, flight scenarios, engine configurations, and vehicle comparisons are all AI-generated from structured prompts
6. **Evaluation Hooks**: Primitives with assessment capability expose evaluation metrics that capture student interaction data for the backend evaluation service
7. **State Serialization**: All primitives serialize to JSON for problem authoring, student response capture, and session replay
8. **Cross-Domain Connections**: Bridge to existing engineering primitives (gears and levers are inside engines), space primitives (rockets are vehicles), and biology (bird wing → airplane wing)

---

## Current State Audit

### What Exists (Related)

| Primitive | Domain | Relevance | Gap |
|-----------|--------|-----------|-----|
| `lever-lab` | Engineering | Lever concept applies to flight controls | No flight context |
| `gear-train-builder` | Engineering | Gears are inside engines and transmissions | No vehicle/engine context |
| `pulley-system-builder` | Engineering | Pulleys are used in cranes and elevators | No connection to vehicles |
| `bridge-builder` | Engineering | Structural engineering overlaps | No aerodynamic concepts |
| `dump-truck-loader` | Engineering | One construction vehicle | No general vehicle system |
| `excavator-arm-simulator` | Engineering | One construction vehicle | No general vehicle system |
| `blueprint-canvas` | Engineering | Design tool | Not vehicle-specific |
| `rocket-builder` | Space (planned) | Covers rocket propulsion | No airplane/helicopter/car/ship coverage |

### Available Multimodal Infrastructure

| Capability | Service | Current Usage | Vehicle Primitive Usage |
|-----------|---------|---------------|----------------------|
| **AI Tutoring Scaffold** | `TutoringScaffold` in catalog → `useLuminaAI` hook → Gemini Live WebSocket → real-time speech | `phonics-blender`, `fraction-bar`, literacy primitives | Context-aware tutoring at every pedagogical moment — the AI sees what the student is doing (force values, wing angle, cargo placement) and responds like a real tutor with progressive scaffolding. See [ADDING_TUTORING_SCAFFOLD.md](ADDING_TUTORING_SCAFFOLD.md). |
| **Image Generation** | Gemini image generation | `image-panel`, `media-player`, `species-profile` | Machine profile illustrations, vehicle cutaway diagrams |
| **Drag-and-Drop** | React DnD patterns | `word-builder`, engineering primitives | Cargo loading, vehicle design, control surface manipulation |
| **Rich Evaluation** | `usePrimitiveEvaluation` + metrics system | Engineering, literacy primitives | Flight challenges, design optimization, identification tasks |
| **Animation/Simulation** | Canvas/SVG animation | Engineering physics simulations | Streamline rendering, flight path simulation, engine cycle animation |
| **Comparison Panels** | `comparison-panel` primitive | Core assessment | Vehicle comparison lab |

---

## Primitives by Domain

---

## DOMAIN 1: Flight & Aerodynamics

### 1. `flight-forces-explorer` — Interactive Four Forces of Flight

**Purpose:** The most direct answer to "How does an airplane fly?" An interactive airplane diagram showing the four forces of flight (lift, weight, thrust, drag) as dynamic, adjustable vectors. Students manipulate conditions and watch how the balance of forces determines whether a plane climbs, cruises, descends, or stalls.

**Grade Band:** K-5

**Cognitive Operation:** Identify forces, predict motion from force balance, causal reasoning

**Multimodal Features:**
- **Visual:** Animated force arrows that grow/shrink proportionally. Airflow streamlines over the wing. Flight state indicator (climbing, level, descending, stalled). Color-coded force arrows (lift = blue, weight = red, thrust = green, drag = orange).
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees current force values, flight state, and student adjustments in real time. Speaks at pedagogical moments: celebrates when student achieves level flight, gives progressive hints when struggling to balance forces ("What happens if you increase thrust just a little?"), narrates force relationships as student explores, and guides through challenges with scaffolded support.
- **Image Generation:** AI-generated illustrations of real aircraft when switching profiles (Cessna, 747, glider, fighter jet).
- **Interactive:** Throttle slider (thrust), pitch control (angle of attack), cargo loading (weight), altitude indicator. Force balance bar chart updates in real-time.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K | Four forces have names; plane goes up when lift beats weight |
| 1 | Thrust pushes forward, drag slows down; faster = more lift |
| 2 | Adding cargo makes the plane heavier; needs more thrust to stay up |
| 3 | Angle of attack affects lift and drag together; too steep = stall |
| 4 | Force balance determines flight path; net force concept; compare aircraft |
| 5 | Stall conditions, force vector addition, designing for efficiency vs speed |

**Interaction Model:**
- Phase 1 (Explore): Tap each force arrow to learn its name and what it does. Watch a plane fly in balance.
- Phase 2 (Manipulate): Adjust thrust and angle. Observe how the plane responds. Try to make it climb, cruise, and descend.
- Phase 3 (Challenge): Achieve specific flight targets — "Make the plane fly level at 5000 feet" or "Land the plane safely."
- Phase 4 (Compare): Switch between aircraft profiles and notice how force magnitudes differ for a glider vs a jumbo jet.

**Schema:**
```json
{
  "primitiveType": "flight-forces-explorer",
  "aircraft": {
    "name": "string",
    "type": "string (cessna | jumbo_jet | glider | fighter | biplane | custom)",
    "imagePrompt": "string",
    "emptyWeight": "number (kg)",
    "maxThrust": "number (N)",
    "wingArea": "number (m²)",
    "maxSpeed": "number (km/h)"
  },
  "initialConditions": {
    "altitude": "number (meters)",
    "speed": "number (km/h)",
    "thrustPercent": "number (0-100)",
    "angleOfAttack": "number (degrees)",
    "cargoWeight": "number (kg)"
  },
  "forces": {
    "lift": { "magnitude": "number (N)", "description": "string" },
    "weight": { "magnitude": "number (N)", "description": "string" },
    "thrust": { "magnitude": "number (N)", "description": "string" },
    "drag": { "magnitude": "number (N)", "description": "string" }
  },
  "flightStates": [
    {
      "condition": "string (e.g., 'lift > weight AND thrust > drag')",
      "name": "string (climbing, descending, cruising, stalling, accelerating)",
      "description": "string",
      "narration": "string (AI tutor explanation for this flight state)"
    }
  ],
  "challenges": [
    {
      "id": "string",
      "instruction": "string (e.g., 'Make the plane fly level at constant speed')",
      "targetConditions": {
        "altitudeRange": { "min": "number", "max": "number" },
        "speedRange": { "min": "number", "max": "number" }
      },
      "hint": "string"
    }
  ],
  "showOptions": {
    "forceArrows": "boolean",
    "forceValues": "boolean",
    "airflowStreamlines": "boolean",
    "forceBalanceChart": "boolean",
    "flightPathTrace": "boolean",
    "altitudeIndicator": "boolean"
  },
  "gradeBand": "K-2 | 3-5"
}
```

**Gemini Generation Notes:** At K-2, Gemini should generate simple force descriptions ("Lift pushes the plane up like a hand under a paper airplane") and omit numeric values. At 3-5, include real force magnitudes and challenge scenarios requiring quantitative reasoning. Always include the `narration` field — these feed into the AI tutor's context and should be conversational, not textbook.

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'flight-forces-explorer'`
- `challengesCompleted` / `challengesTotal`
- `forcesIdentifiedCorrectly` / `forcesTotal` (did they tap and identify all four forces)
- `timeToAchieveLevel` (seconds to reach target conditions in challenge mode)
- `stateTransitionsExplored` (how many flight states did they discover: climbing, descending, cruising, stalled)
- `aircraftProfilesCompared` (count of different aircraft examined)
- `stallTriggered` (boolean — did they discover the stall condition)
- `attemptsPerChallenge` (average attempts to complete each challenge)

---

### 2. `airfoil-lab` — Wing Shape and Lift Exploration

**Purpose:** A wing cross-section (airfoil) in a simulated wind tunnel. Students change the wing shape, angle, and airspeed to observe how lift is generated. Streamlines, pressure zones, and force readouts make the invisible physics of flight visible and tangible. Answers "Why is the wing shaped like that?"

**Grade Band:** 1-5

**Cognitive Operation:** Variable manipulation, observation, cause-and-effect, comparing

**Multimodal Features:**
- **Visual:** Animated streamlines flowing over and under the airfoil. Color-coded pressure map (red = high pressure below, blue = low pressure above). Lift and drag force gauges. Real-time airfoil shape deformation with drag handles.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees current airfoil shape, angle of attack, wind speed, and lift/drag results. Guides experimentation: "What do you think will happen if you make the wing more curved?" Celebrates discoveries ("You found the stall angle!"), provides progressive hints during challenges, and connects observations to real aircraft ("That's the same shape as a Cessna wing!").
- **Image Generation:** AI-generated diagrams of real wing shapes (Cessna wing, 747 swept wing, bird wing) for comparison.
- **Interactive:** Drag handles to reshape the airfoil camber. Angle of attack rotation control. Wind speed slider. Compare mode with two airfoils side-by-side. Stall visualization at extreme angles.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 1 | Air goes over and under the wing; curved shape makes lift |
| 2 | Wing shape matters — experiment with flat vs curved |
| 3 | Angle of attack changes lift; too steep = stall; streamline patterns |
| 4 | Pressure difference creates lift; Bernoulli's principle introduction |
| 5 | Lift equation variables (shape, speed, area, angle); design optimization |

**Interaction Model:**
- Phase 1 (Observe): Watch streamlines flow over a preset airfoil. Notice the difference in speed above vs below.
- Phase 2 (Experiment): Change one variable (shape, angle, or speed) and predict what happens to lift before watching the result.
- Phase 3 (Compare): Place two airfoils side-by-side and design one for maximum lift, one for minimum drag.
- Phase 4 (Apply): Given a flight scenario ("Slow flight for landing"), choose or design the best airfoil shape.

**Schema:**
```json
{
  "primitiveType": "airfoil-lab",
  "airfoil": {
    "shape": "string (flat | symmetric | cambered | thick | supercritical | bird_wing | custom)",
    "name": "string (e.g., 'NACA 2412')",
    "description": "string",
    "imagePrompt": "string"
  },
  "initialConditions": {
    "angleOfAttack": "number (degrees)",
    "windSpeed": "number (m/s)",
    "airDensity": "number (kg/m³, default 1.225)"
  },
  "results": {
    "liftCoefficient": "number",
    "dragCoefficient": "number",
    "liftForce": "number (N)",
    "dragForce": "number (N)",
    "stallAngle": "number (degrees)"
  },
  "presetComparisons": [
    {
      "name": "string (e.g., 'Flat Plate vs Cambered Wing')",
      "airfoilA": "string (shape reference)",
      "airfoilB": "string (shape reference)",
      "question": "string (e.g., 'Which generates more lift at the same speed?')",
      "explanation": "string"
    }
  ],
  "challenges": [
    {
      "scenario": "string (e.g., 'Design a wing for slow, stable flight')",
      "targetLift": "string (high | medium | low)",
      "targetDrag": "string (high | medium | low)",
      "hint": "string"
    }
  ],
  "visualizationOptions": {
    "streamlines": "boolean",
    "pressureMap": "boolean",
    "velocityMap": "boolean",
    "particleMode": "boolean",
    "forceGauges": "boolean",
    "stallVisualization": "boolean"
  },
  "gradeBand": "1-2 | 3-5"
}
```

**Gemini Generation Notes:** Generate real airfoil descriptions with kid-friendly analogies ("The NACA 2412 airfoil is like a raindrop sliced in half — smooth and curved on top, flatter on the bottom"). Include the `presetComparisons` to scaffold structured experimentation. At grades 1-2, omit numeric coefficients and use relative terms (more lift, less drag). At 3-5, include quantitative results and the connection to Bernoulli's principle.

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'airfoil-lab'`
- `shapesExplored` (count of different airfoil configurations tested)
- `variablesManipulated` (which of: shape, angle, speed were changed)
- `predictionsCorrect` / `predictionsTotal` (Phase 2 predict-then-observe)
- `comparisonCompleted` (boolean — did they use compare mode)
- `stallDiscovered` (boolean — did they find the stall angle)
- `challengeOptimality` (0-100 — how close to optimal design in challenge mode)
- `attemptsCount`

---

### 3. `paper-airplane-designer` — Design-Build-Test-Iterate

**Purpose:** A hands-on design-build-test-iterate experience that teaches the engineering design process through paper airplane creation. Students choose a template, modify fold patterns and wing geometry, then launch in a simulated flight test. Performance metrics (distance, time aloft, accuracy) drive iterative improvement — the most tangible connection between "design choices have consequences" and "iteration makes things better."

**Grade Band:** K-5

**Cognitive Operation:** Design thinking, variable isolation, iteration, optimization

**Multimodal Features:**
- **Visual:** Step-by-step fold animation showing how the design becomes a plane. Simulated flight with trajectory trace. Performance dashboard (distance, hang time, stability score). Design history comparison showing improvement across iterations.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees design parameters, launch settings, and flight results across iterations. Celebrates improvement ("3 meters farther — your wider wings really helped!"), coaches the design process ("You changed two things at once — try changing just the nose angle this time"), guides struggling students toward productive changes, and narrates fold instructions for younger learners.
- **Interactive:** Template selection. Fold angle adjustment sliders. Wing dimension controls. Winglet and elevator tab toggles. Launch angle and force controls. Flight log for comparing designs.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K | Different shapes fly differently; pick a plane, throw it, watch it go |
| 1 | Wings need to be even (symmetry); pointy vs wide noses |
| 2 | Fold angles change flight path; nose weight helps stability |
| 3 | Design iteration — change ONE thing, test, compare to last attempt |
| 4 | Trade-offs: distance vs hang time vs accuracy; constraint challenges |
| 5 | Systematic variable testing, data collection, optimization graphs |

**Interaction Model:**
- Phase 1 (Build): Choose a template and customize folds, wings, and features.
- Phase 2 (Launch): Set launch angle and force, then fly the plane in simulation.
- Phase 3 (Analyze): Review performance metrics. Compare to previous designs in the flight log.
- Phase 4 (Iterate): Modify the design based on results and retest. Track improvement.

**Schema:**
```json
{
  "primitiveType": "paper-airplane-designer",
  "template": {
    "name": "string (dart | glider | stunt | wide_body | custom)",
    "description": "string",
    "baseFolds": "integer",
    "imagePrompt": "string (what the folded plane looks like)"
  },
  "designParameters": {
    "noseAngle": { "value": "number (degrees)", "adjustable": "boolean", "min": "number", "max": "number" },
    "wingSpan": { "value": "number (cm)", "adjustable": "boolean", "min": "number", "max": "number" },
    "wingAngle": { "value": "number (degrees)", "adjustable": "boolean", "min": "number", "max": "number" },
    "hasWinglets": "boolean",
    "hasElevatorTab": "boolean",
    "noseWeight": { "value": "number (paper clips, 0-3)", "adjustable": "boolean" }
  },
  "launchSettings": {
    "angle": { "value": "number (degrees)", "adjustable": "boolean", "min": "number", "max": "number" },
    "force": { "value": "number (1-10 scale)", "adjustable": "boolean" },
    "windSpeed": "number (m/s, 0 = calm)",
    "windDirection": "number (degrees)"
  },
  "simulatedResults": {
    "distance": "number (meters)",
    "hangTime": "number (seconds)",
    "stability": "number (0-100, higher = less wobble)",
    "accuracy": "number (0-100, closeness to straight line)",
    "trajectory": [{ "x": "number", "y": "number", "t": "number" }]
  },
  "challenges": [
    {
      "id": "string",
      "name": "string (e.g., 'Distance Champion')",
      "goal": "string (e.g., 'Fly farther than 15 meters')",
      "targetMetric": "string (distance | hangTime | accuracy)",
      "targetValue": "number",
      "hint": "string",
      "maxAttempts": "integer | null"
    }
  ],
  "flightLog": [
    {
      "designVersion": "integer",
      "parameters": "object (snapshot of design at time of flight)",
      "results": "object (distance, hangTime, stability, accuracy)"
    }
  ],
  "gradeBand": "K-2 | 3-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'paper-airplane-designer'`
- `designIterations` (count of distinct designs tested)
- `improvementAcrossIterations` (did performance improve from first to last design?)
- `variableIsolation` (boolean — did they change only one parameter between tests, at least once)
- `challengesCompleted` / `challengesTotal`
- `bestDistance` / `bestHangTime` / `bestAccuracy`
- `templateVariety` (count of different base templates tried)
- `flightLogUsed` (boolean — did they review past designs to inform changes)
- `attemptsCount`

---

### 4. `flight-control-surfaces` — How Pilots Steer

**Purpose:** An interactive 3D airplane model where students move control surfaces (ailerons, elevator, rudder) and watch how the plane responds. Connects the pilot's control inputs to the physics of turning, climbing, and rolling — answering "How does a pilot steer an airplane?" and introducing the concepts of roll, pitch, and yaw.

**Grade Band:** 1-5

**Cognitive Operation:** Spatial reasoning, cause-and-effect, system mapping (input → output)

**Multimodal Features:**
- **Visual:** 3D airplane model with highlighted, color-coded control surfaces (ailerons = blue, elevator = green, rudder = red). Rotation axis lines (roll, pitch, yaw). Airflow deflection arrows at each surface. Flight path trace during maneuvers.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees which control surfaces are active, current flight attitude, and challenge progress. Names surfaces as student discovers them ("Those are the ailerons — they control roll!"), coaches through ring challenges ("Try using the elevator to pitch up just a little"), and builds toward coordinated flight with progressive scaffolding.
- **Interactive:** Virtual flight stick (left/right = ailerons → roll, forward/back = elevator → pitch). Virtual rudder pedals (rudder → yaw). Ring-flying challenges. Switchable views (external, cockpit, split).

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 1 | Moving the stick makes the plane turn, go up, or go down |
| 2 | Three different ways to steer: tilt (roll), nose up/down (pitch), turn left/right (yaw) |
| 3 | Control surfaces are movable parts on wings and tail — each controls one axis |
| 4 | How deflecting air creates turning forces; coordinated turns use multiple surfaces |
| 5 | Trim, stability, control coupling; why airliners use computers to help pilots |

**Interaction Model:**
- Phase 1 (Discover): Tap each control surface to see its name and what it does. Move the stick and watch one axis at a time.
- Phase 2 (Practice): Fly through 3-5 ring targets using individual controls (roll only, pitch only, yaw only).
- Phase 3 (Combine): Coordinated maneuvers requiring multiple controls simultaneously (banked turn = roll + pitch).
- Phase 4 (Identify): Given a desired flight maneuver, identify which control surfaces to move.

**Schema:**
```json
{
  "primitiveType": "flight-control-surfaces",
  "aircraft": {
    "model": "string (trainer | airliner | fighter | biplane | custom)",
    "name": "string",
    "imagePrompt": "string"
  },
  "controlSurfaces": [
    {
      "name": "string (ailerons | elevator | rudder | flaps | trim_tab)",
      "location": "string (e.g., 'Trailing edge of each wing')",
      "axis": "string (roll | pitch | yaw)",
      "description": "string",
      "funAnalogy": "string (e.g., 'Like tilting your arms while running — you lean into the turn')"
    }
  ],
  "axes": [
    {
      "name": "string (roll | pitch | yaw)",
      "description": "string",
      "controlledBy": "string (which surface)",
      "visualColor": "string (hex)"
    }
  ],
  "challenges": [
    {
      "id": "string",
      "instruction": "string (e.g., 'Fly through all 5 rings')",
      "rings": [{ "x": "number", "y": "number", "z": "number" }],
      "requiredControls": ["string (which surfaces are needed)"],
      "difficulty": "number (1-5)"
    }
  ],
  "identificationQuiz": [
    {
      "maneuver": "string (e.g., 'The pilot wants to turn left')",
      "correctSurfaces": ["string"],
      "explanation": "string"
    }
  ],
  "viewOptions": {
    "external": "boolean",
    "cockpit": "boolean",
    "split": "boolean"
  },
  "simplifiedPhysics": "boolean (easier handling for K-2)",
  "gradeBand": "1-2 | 3-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'flight-control-surfaces'`
- `surfacesIdentified` / `surfacesTotal` (did they tap and learn each surface)
- `axesExplored` / `axesTotal` (did they discover roll, pitch, yaw)
- `ringsCompleted` / `ringsTotal` (challenge mode)
- `quizCorrect` / `quizTotal` (identification quiz)
- `coordinatedManeuverAttempted` (boolean — did they use multiple controls simultaneously)
- `viewModesUsed` (which perspectives did they explore)
- `attemptsPerChallenge`

---

### 5. `wind-tunnel-simulator` — Shape and Drag Exploration

**Purpose:** A virtual wind tunnel where students place different shapes and objects into an airflow and observe drag, lift, and turbulence. Why are race cars low and sleek? Why are airplanes noses rounded? Why are trucks boxy (and how much fuel does that waste)? Students discover aerodynamic principles through shape comparison and experimentation.

**Grade Band:** K-5

**Cognitive Operation:** Observation, comparison, classification (streamlined vs non-streamlined), cause-and-effect

**Multimodal Features:**
- **Visual:** Animated streamlines flowing around shapes. Color-coded pressure map (red = high, blue = low). Velocity map option. Smoke/particle visualization mode. Turbulence wake visualization behind blunt shapes. Drag force meter with numerical readout.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees which shapes are in the tunnel, current drag readings, and comparison results. Narrates discoveries ("Wow, the teardrop has 10x less drag than the flat plate!"), asks prediction questions before tests ("Which shape do you think will have less drag?"), connects to real vehicles ("That's why airplane noses are rounded, not flat!"), and guides custom shape design.
- **Interactive:** Place preset shapes into the tunnel. Adjust wind speed. Compare two shapes side-by-side. Build custom shapes with drag handles. Toggle between visualization modes.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K | Smooth shapes let air pass easier; blocky shapes slow down more |
| 1 | Pointy front and smooth back = less drag (teardrop is king) |
| 2 | Streamlining — making shapes that cut through air efficiently |
| 3 | Pressure differences: high pressure in front, low pressure behind |
| 4 | Drag coefficient concept; quantitative comparison of shapes |
| 5 | Turbulent vs laminar flow; designing for specific drag targets |

**Interaction Model:**
- Phase 1 (Explore): Put preset shapes (sphere, cube, teardrop, flat plate) in the tunnel one at a time. Watch the streamlines.
- Phase 2 (Compare): Place two shapes side-by-side and predict which has more drag before turning on the wind.
- Phase 3 (Design): Use the shape editor to create the lowest-drag shape possible. Compare to the teardrop benchmark.
- Phase 4 (Real-World): Test real vehicle shapes (car, truck, airplane, bicycle rider) and explain why they're shaped the way they are.

**Schema:**
```json
{
  "primitiveType": "wind-tunnel-simulator",
  "presetShapes": [
    {
      "id": "string",
      "name": "string (e.g., 'Sphere', 'School Bus', 'Boeing 747 nose')",
      "category": "string (geometric | vehicle | natural | custom)",
      "dragCoefficient": "number",
      "imagePrompt": "string",
      "description": "string",
      "realWorldExamples": ["string (e.g., 'Basketball', 'Water tower')"]
    }
  ],
  "tunnelSettings": {
    "windSpeed": { "value": "number (m/s)", "adjustable": "boolean", "min": "number", "max": "number" },
    "airDensity": "number (kg/m³)"
  },
  "comparisons": [
    {
      "name": "string (e.g., 'Brick vs Teardrop')",
      "shapeA": "string (shape id)",
      "shapeB": "string (shape id)",
      "question": "string (e.g., 'Which shape would make a faster car?')",
      "explanation": "string",
      "dragRatio": "string (e.g., 'The brick has 8x more drag')"
    }
  ],
  "challenges": [
    {
      "scenario": "string (e.g., 'Design a shape with drag coefficient under 0.1')",
      "targetDrag": "number",
      "hint": "string"
    }
  ],
  "visualizationOptions": {
    "streamlines": "boolean",
    "smoke": "boolean",
    "particles": "boolean",
    "pressureMap": "boolean",
    "velocityMap": "boolean",
    "forceVectors": "boolean",
    "turbulenceWake": "boolean"
  },
  "customShapeEditor": "boolean",
  "gradeBand": "K-2 | 3-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'wind-tunnel-simulator'`
- `shapesExplored` (count of different shapes tested)
- `comparisonsCompleted` / `comparisonsAvailable`
- `predictionsCorrect` / `predictionsTotal` (predict drag ranking before testing)
- `customShapeDesigned` (boolean)
- `bestCustomDragCoefficient` (closest to optimal in design challenge)
- `realWorldShapesExplored` (count of vehicle/real-world shapes tested)
- `visualizationModesUsed` (which modes did they toggle)
- `attemptsCount`

---

## DOMAIN 2: Machine Profiles & Anatomy

### 6. `machine-profile` — The SpeciesProfile of Engineering

**Purpose:** The generalized display primitive for vehicles and machines — the engineering equivalent of `species-profile` for biology. Presents rich, beautifully themed profiles for any machine: airplanes, trains, cars, ships, helicopters, submarines, bikes, bulldozers, space shuttles, and more. Each profile includes specifications, how-it-works explanations, key components, history, and fascinating facts. Category-based color theming makes each machine type visually distinct.

This is a **data display primitive** (not an interactive simulation). The AI generates the profile data, and the component renders it with Lumina glass morphism styling, SpotlightCards, accordions, badges, and on-demand image generation — following the exact same architectural pattern as SpeciesProfile.

**Grade Band:** K-5 (complexity scales with grade)

**Cognitive Operation:** Identify, describe, compare, connect to real world

**Multimodal Features:**
- **Visual:** Category-themed color accents (sky blue for airplanes, red for cars, orange for trains — see theming table below). AI-generated machine illustration with "Generate Visual" button. Quick stats grid with kid-friendly comparisons ("As heavy as 8 elephants"). Accordion sections for progressive detail disclosure.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees which machine profile is displayed and which sections the student has explored. Can narrate the "how it works" section conversationally, answer follow-up questions about the machine, connect facts to the student's experience ("Have you ever seen one of these at the airport?"), and guide exploration of accordion sections the student hasn't opened yet.
- **Image Generation:** AI-generated illustration of the specific machine using the `imagePrompt` field. Same pattern as SpeciesProfile: prompt stored in data, user clicks "Generate Visual" to trigger API call.
- **Interactive:** Accordion expand/collapse for sections. Image generation button. Related machines badges (tappable for navigation).

**Category Theming:**
| Category | Text Color | Accent Hex | RGB | Icon Motif | Examples |
|----------|-----------|------------|-----|------------|----------|
| `airplane` | `text-sky-300` | `#0ea5e9` | `14, 165, 233` | Wings | Cessna 172, Boeing 747, Wright Flyer, Concorde |
| `helicopter` | `text-teal-300` | `#14b8a6` | `20, 184, 166` | Rotor | Chinook, Black Hawk, rescue helicopter |
| `car` | `text-red-300` | `#f87171` | `248, 113, 113` | Wheel | Model T, Tesla, Formula 1, school bus |
| `train` | `text-orange-300` | `#fb923c` | `251, 146, 60` | Rails | Steam locomotive, bullet train, freight train |
| `ship` | `text-blue-300` | `#60a5fa` | `96, 165, 250` | Anchor | Titanic, container ship, sailboat, aircraft carrier |
| `truck` | `text-amber-300` | `#fbbf24` | `251, 191, 36` | Cab | Semi-truck, fire truck, dump truck |
| `submarine` | `text-cyan-300` | `#22d3ee` | `34, 211, 238` | Periscope | Nuclear sub, research submersible |
| `bicycle` | `text-green-300` | `#86efac` | `134, 239, 172` | Chain | Mountain bike, penny-farthing, BMX |
| `construction` | `text-yellow-300` | `#fde047` | `253, 224, 71` | Boom | Excavator, crane, bulldozer |
| `spacecraft` | `text-violet-300` | `#c084fc` | `192, 132, 252` | Rocket | Space shuttle, Apollo capsule, ISS |

**Schema:**
```json
{
  "primitiveType": "machine-profile",
  "machineName": "string (e.g., 'Boeing 747')",
  "designation": "string | null (e.g., '747-400', 'Model T', 'Class 800')",
  "nameMeaning": "string | null (e.g., 'Named after the Wright Brothers who invented powered flight')",
  "category": "string (airplane | helicopter | car | train | ship | truck | submarine | bicycle | construction | spacecraft)",
  "era": "string (e.g., '1970 — Present', '1908-1927', 'Modern')",

  "imageUrl": "string | null",
  "imagePrompt": "string (for AI generation, e.g., 'A Boeing 747-400 in flight, dramatic angle from below showing all four engines, blue sky with scattered clouds, photorealistic')",

  "quickStats": {
    "topSpeed": "string | null (e.g., '920 km/h (570 mph)')",
    "weight": "string | null (e.g., '178,000 kg empty')",
    "range": "string | null (e.g., '14,200 km')",
    "capacity": "string | null (e.g., '416 passengers in typical layout')",
    "yearIntroduced": "string | null (e.g., '1970')",
    "powerSource": "string | null (e.g., '4× CF6-80C2 turbofan engines')",
    "size": "string | null (e.g., '70.7 m long, 64.4 m wingspan')",
    "speedComparison": "string | null (e.g., 'Faster than any bird — even a peregrine falcon in level flight')",
    "weightComparison": "string | null (e.g., 'As heavy as about 30 school buses')",
    "sizeComparison": "string | null (e.g., 'Wingspan wider than a basketball court is long')"
  },

  "howItWorks": "string (plain-language operating principle, e.g., 'The 747's four jet engines suck in air, compress it, mix it with fuel, ignite it, and blast it out the back. This creates thrust — a push that moves the plane forward. As it speeds up, air flows over the curved wings and creates lift — an upward force stronger than gravity. That's how 400 people and their luggage can fly across an ocean.')",

  "keyComponents": [
    {
      "name": "string (e.g., 'Turbofan Engine')",
      "description": "string (e.g., 'Sucks in air with a giant fan, compresses it, mixes it with jet fuel, and blasts hot exhaust out the back at incredible speed')",
      "funAnalogy": "string | null (e.g., 'Like a giant hairdryer, but instead of blowing hot air to dry your hair, it blows hot air backwards to push the whole plane forward')"
    }
  ],

  "history": {
    "inventor": "string | null",
    "yearInvented": "string | null",
    "originStory": "string | null (e.g., 'Boeing designed the 747 in the late 1960s when air travel was booming...')",
    "milestones": ["string (e.g., '1970: First commercial flight, Pan Am New York → London')"],
    "famousExamples": ["string (e.g., 'Air Force One — the US President\\'s airplane is a modified 747')"]
  },

  "fascinatingFacts": [
    {
      "title": "string (e.g., 'Queen of the Skies')",
      "description": "string (e.g., 'The 747 was nicknamed the Queen of the Skies. When it first flew in 1970, it was so much bigger than any other airplane that airports had to build new, wider gates just to fit it.')",
      "icon": "string (sparkles | zap | gauge | clock | globe | ruler)"
    }
  ],

  "realWorldConnections": ["string (e.g., 'Next time you\\'re at an airport, see if you can spot a 747 — it\\'s the one with the big bump on top where the upper deck is')"],

  "relatedMachines": ["string (e.g., 'Airbus A380', 'Boeing 787 Dreamliner', 'Concorde')"],

  "gradeBand": "K-2 | 3-5"
}
```

**Gemini Generation Notes:** This is the highest-reuse primitive in the set — it will be called for dozens of different machines across all categories. Key generation instructions:
- At K-2: Use simple vocabulary. Keep `howItWorks` to 2-3 sentences. Limit `keyComponents` to 3. Make `funAnalogy` entries relatable to playground/kitchen/home experiences. Always include `speedComparison`, `weightComparison`, `sizeComparison` using animals, school buses, basketball courts.
- At 3-5: More technical vocabulary is fine. `howItWorks` can be a full paragraph. Include 4-6 `keyComponents`. `milestones` should include 3-5 entries. Connect to science concepts (Newton's laws, energy transformation).
- Always: `imagePrompt` should be vivid and specific enough for high-quality AI image generation. `fascinatingFacts` should include genuine "wow" moments that kids will want to tell their parents about. Never generate fake statistics — all `quickStats` values must be real.

**Evaluable:** No direct evaluation. Used as reference material, comparison input, and reward/motivation content.

---

### 7. `engine-explorer` — How Machines Are Powered

**Purpose:** An interactive cutaway view of different engine types. Students see the internal workings animated step-by-step — pistons firing, turbines spinning, electric motors turning. Connects power sources to the vehicles they drive. Answers "What's inside the engine?" and "How does fuel make things go?"

**Grade Band:** 1-5

**Cognitive Operation:** Sequence understanding (engine cycles), energy transformation, part-whole reasoning

**Multimodal Features:**
- **Visual:** Animated internal cycle with labeled stages (intake → compression → combustion → exhaust for piston; compressor → combustor → turbine for jet). Cutaway depth toggle (exterior → overview → detailed). Color-coded energy flow path (fuel = red → heat = orange → motion = green). RPM gauge.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees current engine type, animation stage, throttle position, and which components have been explored. Narrates each cycle stage conversationally ("Now watch — the piston pushes down and sucks in air and fuel, like breathing in!"), asks comprehension checks ("What do you think happens next?"), guides component exploration, and coaches engine-to-vehicle matching.
- **Image Generation:** AI-generated cutaway diagrams for each engine type in context of its vehicle.
- **Interactive:** Engine type selector. Throttle slider with RPM response. Tap individual components for info cards. Compare mode for two engine types side-by-side. Vehicle context toggle (see the engine inside its vehicle).

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 1 | Engines make things go; fuel gives energy; different vehicles have different engines |
| 2 | Engine parts move in a cycle — round and round or back and forth |
| 3 | Energy transformation: fuel → heat → motion; the four-stroke cycle |
| 4 | Comparing efficiency: why jet engines for planes, electric motors for cars |
| 5 | Thermodynamic principles, energy losses (heat, sound), future propulsion |

**Interaction Model:**
- Phase 1 (Watch): Select an engine type and watch the animated cycle at slow speed with narration.
- Phase 2 (Explore): Tap individual components to learn their names and functions. Adjust the throttle.
- Phase 3 (Compare): View two engine types side-by-side. Identify shared components and unique features.
- Phase 4 (Connect): Match engines to the vehicles they power and explain why each vehicle uses its specific engine type.

**Schema:**
```json
{
  "primitiveType": "engine-explorer",
  "engineType": "string (jet_turbofan | piston_4stroke | electric_motor | steam | diesel | turboprop | rocket)",
  "engineName": "string (e.g., 'Rolls-Royce Trent 900 Turbofan')",
  "vehicleContext": "string (airplane | car | train | ship | helicopter | motorcycle)",
  "overview": "string (1-2 sentence description of what this engine does)",

  "components": [
    {
      "id": "string",
      "name": "string",
      "function": "string",
      "analogy": "string (e.g., 'Like squeezing a balloon — compression makes the air hot')",
      "position": { "x": "percentage", "y": "percentage" }
    }
  ],

  "cycle": {
    "name": "string (e.g., 'Four-Stroke Cycle', 'Brayton Cycle')",
    "stages": [
      {
        "order": "integer",
        "name": "string (e.g., 'Intake', 'Compression', 'Combustion', 'Exhaust')",
        "description": "string",
        "narration": "string (TTS-friendly)",
        "visualDescription": "string (what the animation shows)",
        "energyState": "string (e.g., 'Chemical energy in fuel', 'Heat energy', 'Kinetic energy')"
      }
    ]
  },

  "energyFlow": {
    "input": "string (e.g., 'Jet fuel (kerosene)')",
    "transformations": ["string (e.g., 'Chemical → Heat → Kinetic')"],
    "output": "string (e.g., 'Thrust (forward push)')",
    "efficiency": "string | null (e.g., '35% — most energy is lost as heat')",
    "losses": ["string (e.g., 'Heat escaping through exhaust', 'Sound energy')"]
  },

  "vehicleConnection": {
    "vehicle": "string (e.g., 'Boeing 747')",
    "howConnected": "string (e.g., 'The 747 has four turbofan engines, two under each wing')",
    "whyThisEngine": "string (e.g., 'Turbofans are the best for airplanes because they produce enormous thrust while being fuel-efficient at high altitude')"
  },

  "comparisonPoints": [
    {
      "feature": "string (e.g., 'Fuel type')",
      "thisEngine": "string",
      "vs": "string (engine type to compare against)",
      "vsValue": "string"
    }
  ],

  "gradeBand": "1-2 | 3-5"
}
```

**Gemini Generation Notes:** Focus the `analogy` fields on everyday experiences: squeezing balloons (compression), spinning pinwheels (turbines), magnets on the fridge (electric motors). The `narration` fields should be conversational. At grades 1-2, limit to 3-4 components and describe the cycle in 3 stages max. At 3-5, include the full cycle with energy flow and efficiency concepts.

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'engine-explorer'`
- `componentsIdentified` / `componentsTotal`
- `cycleStagesUnderstood` (count of stages the student could explain — based on checkpoint questions)
- `energyFlowTraced` (boolean — did they follow the full energy transformation path)
- `comparisonsExplored` (count of engine types compared)
- `vehicleMatchesCorrect` / `vehicleMatchesTotal` (matching engines to vehicles)
- `engineTypesExplored` (count of different engine types viewed)
- `attemptsCount`

---

### 8. `cockpit-explorer` — Instruments and Controls

**Purpose:** An interactive instrument panel for different vehicles. Students tap instruments to learn what each one measures, manipulate controls, and understand how operators monitor and control their machines. From an airplane cockpit to a ship's bridge to a train cab — every vehicle has instruments that tell the operator what's happening.

**Grade Band:** K-5

**Cognitive Operation:** Part identification, reading instruments, cause-and-effect (control input → instrument response)

**Multimodal Features:**
- **Visual:** Detailed instrument panel rendered for the selected vehicle. Tap-to-highlight any instrument. Animated needle/dial movement when controls are adjusted. Simplified mode (K-2) shows 4-6 key instruments; realistic mode (3-5) shows full panel.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees which instruments the student has explored, current readings, and control positions. Names instruments on tap ("That's the altimeter — it tells you how high you're flying"), reads values with real-world comparisons ("5,000 feet — that's about as high as a tall mountain!"), coaches through scenarios ("Look at the fuel gauge — what should the pilot do?"), and quizzes instrument identification.
- **Interactive:** Tap instruments for info cards. Manipulate throttle/stick/wheel and watch instruments respond. Instrument identification quizzes. Scenario-based challenges ("You see the fuel gauge at 1/4 — what should you do?").

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K | Vehicles have controls: steering wheel, buttons, pedals; instruments tell you things |
| 1 | Important instruments: speedometer (how fast), fuel gauge (how much gas), temperature |
| 2 | Different vehicles have different instruments; airplane cockpit vs car dashboard |
| 3 | Reading instruments accurately: altitude, heading, speed, RPM |
| 4 | How instruments work: speedometer uses magnetism, altimeter measures air pressure |
| 5 | Instrument systems, redundancy (why planes have 3 of each), navigation instruments |

**Interaction Model:**
- Phase 1 (Name): Tap each instrument to learn its name and what it measures.
- Phase 2 (Read): Given instrument readings, answer questions about the vehicle's state ("Is the plane climbing or descending?").
- Phase 3 (Control): Move controls and observe which instruments respond and how.
- Phase 4 (Scenario): Respond to flight/driving/sailing scenarios using instrument information.

**Schema:**
```json
{
  "primitiveType": "cockpit-explorer",
  "vehicleType": "string (airplane | helicopter | car | train | ship | submarine | spacecraft)",
  "vehicleName": "string (e.g., 'Cessna 172 Skyhawk')",
  "panelComplexity": "string (simplified | standard | realistic)",
  "imagePrompt": "string (for generating the panel illustration)",

  "instruments": [
    {
      "id": "string",
      "name": "string (e.g., 'Altimeter')",
      "measures": "string (e.g., 'How high the plane is above sea level')",
      "unit": "string (e.g., 'feet')",
      "currentReading": "string (e.g., '5,000 ft')",
      "howItWorks": "string | null (e.g., 'Measures air pressure — lower pressure means higher altitude')",
      "funFact": "string | null",
      "position": { "x": "percentage", "y": "percentage" },
      "respondsTo": ["string (control ids that affect this instrument)"]
    }
  ],

  "controls": [
    {
      "id": "string",
      "name": "string (e.g., 'Throttle')",
      "function": "string (e.g., 'Controls engine power — push forward for more power')",
      "affects": ["string (instrument ids)"],
      "position": { "x": "percentage", "y": "percentage" }
    }
  ],

  "scenarios": [
    {
      "id": "string",
      "situation": "string (e.g., 'The altimeter is dropping and the speed is increasing')",
      "question": "string (e.g., 'Is the plane climbing or descending?')",
      "answer": "string",
      "explanation": "string",
      "instrumentsToRead": ["string (instrument ids)"]
    }
  ],

  "identificationQuiz": [
    {
      "question": "string (e.g., 'Which instrument tells you how high you are?')",
      "correctInstrumentId": "string",
      "hint": "string"
    }
  ],

  "gradeBand": "K-2 | 3-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'cockpit-explorer'`
- `instrumentsIdentified` / `instrumentsTotal`
- `readingsInterpretedCorrectly` / `readingsTotal`
- `quizCorrect` / `quizTotal`
- `scenariosCompleted` / `scenariosTotal`
- `controlsExplored` / `controlsTotal` (did they manipulate each control)
- `vehicleTypesExplored` (count of different vehicle panels viewed)
- `attemptsCount`

---

## DOMAIN 3: Power, Motion & How Vehicles Move

### 9. `vehicle-comparison-lab` — Data-Driven Vehicle Analysis

**Purpose:** A side-by-side comparison workspace where students compare real vehicles across multiple dimensions — speed, weight, fuel type, passenger capacity, range, environmental impact. The visual equivalent of "Which is faster, a train or a plane?" backed with real data and visualized for impact.

**Grade Band:** K-5

**Cognitive Operation:** Compare, order, analyze trade-offs, read data visualizations

**Multimodal Features:**
- **Visual:** Bar chart comparisons that update as vehicles are selected. Vehicles shown at relative scale. Radar/spider chart for multi-metric comparison. Scatter plot mode (speed vs weight, range vs capacity). Sortable data table.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees which vehicles are selected, which metrics are displayed, and challenge responses. Narrates surprising comparisons ("Did you know the bullet train carries more people than THREE 747s?"), asks analysis questions ("Why do you think ships are so slow but carry so much?"), guides trade-off reasoning during challenges, and celebrates data-driven decision making.
- **Image Generation:** AI-generated illustrations of each vehicle at comparative scale.
- **Interactive:** Select 2-4 vehicles from a pool. Choose which metrics to compare. Drag vehicles onto scatter plot. Sort by any metric. Category filter (air, land, sea). Challenge mode ("Which vehicle would you pick to carry 1,000 people from New York to London?").

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K | Big and small; fast and slow; some fly, some drive, some float |
| 1 | Comparing two vehicles: which is faster? Which carries more people? |
| 2 | Different vehicles for different jobs — you can't fly a ship or sail a car |
| 3 | Reading comparison charts; understanding that multiple metrics matter |
| 4 | Trade-offs: speed vs capacity vs fuel cost vs environmental impact |
| 5 | Efficiency analysis, cost-per-passenger-mile, data-driven decision making |

**Interaction Model:**
- Phase 1 (Select): Choose 2 vehicles from the pool. See their profiles side-by-side.
- Phase 2 (Compare): View bar chart comparisons across 3-4 metrics. Notice which vehicle "wins" in each category.
- Phase 3 (Analyze): Add a third vehicle. Discover that no single vehicle is best at everything (trade-offs).
- Phase 4 (Challenge): Given a transportation problem, choose the best vehicle and justify with data.

**Schema:**
```json
{
  "primitiveType": "vehicle-comparison-lab",
  "title": "string (e.g., 'Air vs Land vs Sea: How Do We Move?')",
  "instructions": "string",

  "vehicles": [
    {
      "id": "string",
      "name": "string (e.g., 'Boeing 747-400')",
      "category": "string (air | land | sea)",
      "imagePrompt": "string",
      "metrics": {
        "topSpeed": { "value": "number", "unit": "string", "display": "string" },
        "weight": { "value": "number", "unit": "string", "display": "string" },
        "passengerCapacity": { "value": "number", "unit": "string", "display": "string" },
        "range": { "value": "number", "unit": "string", "display": "string" },
        "fuelType": "string",
        "yearIntroduced": "number",
        "costPerTrip": "string | null",
        "co2PerPassengerKm": "number | null"
      },
      "funFact": "string"
    }
  ],

  "comparisonMetrics": ["string (which metrics to show in chart)"],
  "chartType": "string (bar | radar | scatter | table)",

  "challenges": [
    {
      "scenario": "string (e.g., 'You need to move 500 people from Tokyo to Osaka (500 km). Which vehicle?')",
      "constraints": { "passengers": "number", "distance": "number", "maxTime": "string | null" },
      "bestVehicleId": "string",
      "explanation": "string",
      "acceptableAlternatives": ["string (vehicle ids)"]
    }
  ],

  "surprisingFacts": [
    {
      "fact": "string (e.g., 'A single container ship carries as much cargo as 10,000 trucks!')",
      "vehicleIds": ["string"]
    }
  ],

  "gradeBand": "K-2 | 3-5"
}
```

**Required Vehicle Data:**
| Vehicle | Speed | Weight | Capacity | Range | Notes |
|---------|-------|--------|----------|-------|-------|
| Boeing 747 | 920 km/h | 178,756 kg | 416 pax | 14,200 km | Most iconic airplane |
| Shinkansen N700 | 300 km/h | 715,000 kg | 1,323 pax | 500 km/trip | Fastest commercial train |
| Tesla Model 3 | 225 km/h | 1,760 kg | 5 pax | 580 km | Electric car benchmark |
| Maersk E-class | 46 km/h | 55,000 tonnes | 0 pax, 15,000 TEU | 24,000 km | Largest ships afloat |
| School Bus | 90 km/h | 10,000 kg | 72 pax | 450 km | Kids know this one |
| Bicycle | 25 km/h | 10 kg | 1 pax | unlimited | Human-powered |
| Space Shuttle | 28,000 km/h | 2,030,000 kg | 7 crew | LEO | Fastest vehicle |
| Wright Flyer | 48 km/h | 274 kg | 1 pilot | 260 m | First powered airplane |

**Gemini Generation Notes:** Always include at least one "surprise" vehicle — a tiny comparison (bicycle) or extreme comparison (Space Shuttle) — to create "wow" moments. The `surprisingFacts` should surface counterintuitive data that makes students rethink assumptions ("A 747 is faster than a sports car but a container ship carries more than 10,000 trucks worth of stuff").

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'vehicle-comparison-lab'`
- `vehiclesCompared` (count of unique comparison pairs)
- `metricsExplored` (which metrics did they examine)
- `challengeAnswersCorrect` / `challengesTotal`
- `challengeJustificationProvided` (boolean — did they explain their choice with data)
- `chartTypesUsed` (which visualization modes explored)
- `surprisingFactsDiscovered` / `surprisingFactsTotal`
- `attemptsCount`

---

### 10. `propulsion-lab` — Newton's Third Law in Action

**Purpose:** An interactive exploration of how vehicles generate thrust. Students see how different propulsion methods work — propellers pushing air, jet engines expelling exhaust, wheels gripping road, sails catching wind — all unified by Newton's Third Law: every action has an equal and opposite reaction. The connective tissue between "how things move" across air, land, sea, and space.

**Grade Band:** 1-5

**Cognitive Operation:** Causal reasoning, Newton's Third Law, comparing across contexts, medium-awareness

**Multimodal Features:**
- **Visual:** Animated propulsion mechanism with action/reaction force arrows. The "push something backward → go forward" principle visualized for each method. Medium visualization (air particles for propellers, water for marine props, exhaust for jets, nothing for rockets in vacuum).
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees selected propulsion type, force arrow state, and what-if experiment responses. Explains Newton's Third Law conversationally through analogies ("Remember when you blew up a balloon and let it go? Same thing here!"), coaches action/reaction identification, guides what-if predictions, and connects concepts across propulsion types ("See? The jet engine and the rocket both push something backward to go forward!").
- **Interactive:** Select propulsion type. Adjust input power with throttle. Toggle Newton's Third Law force arrow overlay. Compare two propulsion types side-by-side. "What if?" experiments ("What happens if you put a propeller in space?").

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 1 | Pushing makes things go; pushing harder = faster; different ways to push |
| 2 | Push backward → go forward (balloon demo, rowing a boat) |
| 3 | Newton's Third Law in vehicles: action and reaction pair in every engine |
| 4 | Medium matters: propellers need air or water; rockets work in vacuum |
| 5 | Propulsion efficiency, why different methods for different environments |

**Interaction Model:**
- Phase 1 (Experience): Watch each propulsion type in action with force arrows. Start with the balloon — the most intuitive example.
- Phase 2 (Identify): For each propulsion type, identify the "action" (what gets pushed backward) and the "reaction" (the vehicle moving forward).
- Phase 3 (Compare): Place two propulsion types side-by-side. Which produces more thrust per unit of fuel?
- Phase 4 (What-If): Predict what happens in different environments — propeller underwater, rocket in atmosphere vs space, sail with no wind.

**Schema:**
```json
{
  "primitiveType": "propulsion-lab",
  "propulsionTypes": [
    {
      "id": "string",
      "name": "string (e.g., 'Jet Turbofan Engine')",
      "method": "string (propeller_air | jet | propeller_water | wheel_friction | sail | paddle | rocket | electric)",
      "vehicle": "string (e.g., 'Boeing 747')",
      "actionDescription": "string (e.g., 'Hot exhaust gas blasts out the back at high speed')",
      "reactionDescription": "string (e.g., 'The engine — and the whole airplane — is pushed forward')",
      "medium": "string (air | water | ground | vacuum | wind)",
      "mediumRequired": "boolean (false for rockets, true for propellers/wheels)",
      "analogy": "string (e.g., 'Like a balloon zooming around a room when you let the air out')",
      "imagePrompt": "string"
    }
  ],
  "newtonThirdLaw": {
    "statement": "string (kid-friendly version)",
    "examples": [
      {
        "action": "string",
        "reaction": "string",
        "context": "string"
      }
    ]
  },
  "whatIfExperiments": [
    {
      "scenario": "string (e.g., 'What if you put an airplane propeller in space (no air)?')",
      "prediction_options": ["string"],
      "correctAnswer": "string",
      "explanation": "string",
      "relatedPropulsionId": "string"
    }
  ],
  "comparisons": [
    {
      "propulsionA": "string (id)",
      "propulsionB": "string (id)",
      "question": "string",
      "insight": "string"
    }
  ],
  "gradeBand": "1-2 | 3-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'propulsion-lab'`
- `actionReactionPairsIdentified` / `pairsTotal`
- `whatIfCorrect` / `whatIfTotal`
- `propulsionTypesExplored` (count)
- `newtonThirdUnderstood` (boolean — could they state the law in their own words via checkpoint question)
- `comparisonsCompleted` / `comparisonsTotal`
- `mediumDependencyUnderstood` (boolean — did they correctly predict propeller vs rocket in vacuum)
- `attemptsCount`

---

### 11. `propulsion-timeline` — History of How Humans Move

**Purpose:** An interactive timeline showing the evolution of transportation — from walking to horse-drawn carts to steam engines to jet aircraft to electric vehicles. Students scrub through history and see how each innovation built on previous ones. Connects engineering progress to human needs and scientific breakthroughs.

**Grade Band:** K-5

**Cognitive Operation:** Temporal sequencing, cause-and-effect across history, understanding innovation chains

**Multimodal Features:**
- **Visual:** Scrollable/zoomable timeline with era-specific color bands. Vehicle icons at each milestone. Speed record graph overlaid on timeline. Parallel tracks for land, sea, and air transportation. Zoom into specific eras for detail.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees which milestones and eras the student has explored, and sequencing challenge attempts. Narrates milestones with storytelling flair ("In 1903, the Wright Brothers flew for just 12 seconds — imagine, 12 seconds changed the world!"), coaches chronological ordering, highlights innovation connections ("The steam engine made the train possible, and the train made factories possible"), and asks reflection questions.
- **Image Generation:** AI-generated period-accurate vehicle illustrations at each milestone.
- **Interactive:** Scrub timeline slider. Tap milestones for detail cards. Toggle parallel tracks (land/sea/air). "What came first?" ordering challenges. Speed record comparison mode.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K | People have always wanted to go places: walking → animals → wheels → engines |
| 1 | Key inventions: wheel, sail, steam engine, automobile, airplane |
| 2 | Each invention made travel faster, farther, or easier |
| 3 | Innovation chains: one invention enables the next (steam → train → factory → car) |
| 4 | Technology enabling technology: materials, fuels, and manufacturing unlock new vehicles |
| 5 | Future transportation; sustainability; engineering trade-offs across eras |

**Interaction Model:**
- Phase 1 (Explore): Scrub the timeline from ancient history to present. Tap milestones to read about each vehicle.
- Phase 2 (Sequence): Given 5-6 vehicles, put them in chronological order.
- Phase 3 (Connect): Draw connection lines between innovations that enabled each other (steam engine → railroad → transcontinental travel).
- Phase 4 (Predict): Based on trends, predict what transportation might look like in 50 years.

**Schema:**
```json
{
  "primitiveType": "propulsion-timeline",
  "title": "string",
  "timeRange": { "startYear": "number", "endYear": "number" },

  "milestones": [
    {
      "id": "string",
      "year": "number",
      "name": "string (e.g., 'Wright Brothers First Flight')",
      "vehicle": "string (e.g., 'Wright Flyer')",
      "domain": "string (land | sea | air | space)",
      "topSpeed": "string (e.g., '48 km/h')",
      "description": "string",
      "significance": "string (why this mattered)",
      "imagePrompt": "string",
      "enabledBy": "string | null (id of earlier milestone that made this possible)",
      "enabledNext": "string | null (id of later milestone this enabled)"
    }
  ],

  "eras": [
    {
      "name": "string (e.g., 'Age of Sail', 'Steam Revolution', 'Jet Age')",
      "startYear": "number",
      "endYear": "number",
      "color": "string (hex)",
      "description": "string",
      "dominantTransport": "string"
    }
  ],

  "speedRecords": [
    {
      "year": "number",
      "speed": "number (km/h)",
      "vehicle": "string",
      "domain": "string"
    }
  ],

  "sequencingChallenges": [
    {
      "items": ["string (milestone ids to put in order)"],
      "correctOrder": ["string (milestone ids)"],
      "hint": "string"
    }
  ],

  "innovationChains": [
    {
      "name": "string (e.g., 'From Steam to Space')",
      "milestoneIds": ["string (ordered)"],
      "narrative": "string (how each step enabled the next)"
    }
  ],

  "gradeBand": "K-2 | 3-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'propulsion-timeline'`
- `milestonesExplored` / `milestonesTotal`
- `sequencingCorrect` / `sequencingTotal` (ordering challenges)
- `innovationChainsTraced` (count of chains completed)
- `erasExplored` / `erasTotal`
- `domainsExplored` (which of land/sea/air/space)
- `speedTrendObserved` (boolean — did they explore the speed records visualization)
- `attemptsCount`

---

## DOMAIN 4: Design & Innovation Challenges

### 12. `vehicle-design-studio` — Engineering Design Process

**Purpose:** A drag-and-drop vehicle designer where students select a body shape, propulsion type, wheels/wings/hull, and payload — then test their creation against physics-based performance metrics. This is the engineering design process made tangible: define → design → test → iterate. The culminating challenge primitive that draws on concepts from all other domains.

**Grade Band:** 2-5

**Cognitive Operation:** Design thinking, constraint reasoning, trade-off analysis, iteration

**Multimodal Features:**
- **Visual:** Parts palette on the left, design canvas in the center, performance report on the right. Physics simulation shows the vehicle in motion. Performance radar chart comparing speed, range, stability, efficiency, capacity. Design version history showing improvement across iterations.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees selected parts, design constraints, simulation results, and iteration history. Coaches the design process: asks prediction questions before tests ("What do you think will happen with that heavy body and small engine?"), analyzes results with the student ("Your stability is low — what could you change?"), encourages single-variable testing, celebrates improvement across iterations, and guides constraint satisfaction.
- **Interactive:** Drag-and-drop parts from palette. Test button runs simulation. Performance report auto-generates. Constraint cards show requirements. Design log tracks iterations.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 2 | Picking parts: big wheels vs small wheels, flat bottom for boats, wings for planes |
| 3 | Adding/removing parts changes performance; shapes matter |
| 4 | Design constraints — can't have everything; trade-offs between speed and capacity |
| 5 | Systematic testing with variable isolation; multi-objective optimization |

**Interaction Model:**
- Phase 1 (Design): Choose a domain (land/sea/air). Select body, propulsion, and control components from the parts palette.
- Phase 2 (Test): Run the physics simulation and watch the vehicle perform.
- Phase 3 (Analyze): Review performance report. Identify weakest metric.
- Phase 4 (Iterate): Modify the design and retest. Compare to previous version in the design log.
- Challenge Mode: Meet specific constraints ("Carry 100kg over 500km, use less than 50 liters of fuel").

**Schema:**
```json
{
  "primitiveType": "vehicle-design-studio",
  "domain": "string (land | sea | air | amphibious)",
  "title": "string",

  "partsPalette": {
    "bodies": [
      {
        "id": "string",
        "name": "string (e.g., 'Streamlined Car Body')",
        "weight": "number (kg)",
        "dragCoefficient": "number",
        "capacity": "number (passengers or kg cargo)",
        "cost": "number (budget units)",
        "imagePrompt": "string"
      }
    ],
    "propulsion": [
      {
        "id": "string",
        "name": "string (e.g., 'Electric Motor')",
        "thrustOutput": "number (N)",
        "fuelEfficiency": "number (km per unit fuel)",
        "weight": "number (kg)",
        "cost": "number",
        "requires": "string (e.g., 'air' | 'ground' | 'any')"
      }
    ],
    "controls": [
      {
        "id": "string",
        "name": "string (e.g., 'Fixed Wings')",
        "stabilityBonus": "number",
        "dragPenalty": "number",
        "weight": "number (kg)",
        "cost": "number"
      }
    ]
  },

  "constraints": {
    "maxWeight": "number | null",
    "maxCost": "number | null",
    "minRange": "number | null",
    "minSpeed": "number | null",
    "minCapacity": "number | null",
    "requiredDomain": "string | null"
  },

  "simulationOutput": {
    "topSpeed": "number",
    "range": "number",
    "stability": "number (0-100)",
    "efficiency": "number (0-100)",
    "capacity": "number",
    "totalWeight": "number",
    "totalCost": "number",
    "meetsConstraints": "boolean"
  },

  "designTips": [
    {
      "condition": "string (e.g., 'stability < 30')",
      "tip": "string (e.g., 'Your vehicle wobbles too much — try adding a tail fin or widening the base')"
    }
  ],

  "challenges": [
    {
      "name": "string (e.g., 'Cargo Hauler Challenge')",
      "description": "string",
      "constraints": "object (same shape as constraints above)",
      "targetMetric": "string (which metric to optimize)",
      "difficulty": "number (1-5)"
    }
  ],

  "gradeBand": "2-3 | 4-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'vehicle-design-studio'`
- `designIterations` (count of distinct designs tested)
- `constraintsMet` (boolean — did final design meet all constraints)
- `improvementAcrossIterations` (metric improvement from first to final design)
- `partsExplored` / `partsTotal` (how many different parts did they try)
- `challengesCompleted` / `challengesTotal`
- `variableIsolation` (boolean — did they change one thing at a time at least once)
- `designLogUsed` (boolean — did they reference previous designs)
- `bestEfficiencyScore` (0-100)
- `attemptsCount`

---

### 13. `cargo-loading-challenge` — Weight, Balance & Logistics

**Purpose:** A weight distribution and loading puzzle. Students load vehicles (planes, trucks, ships) with cargo while maintaining balance, staying under weight limits, and optimizing space. Connects to real-world logistics and center-of-gravity concepts — and explains why flight attendants care about where you sit.

**Grade Band:** K-5

**Cognitive Operation:** Spatial reasoning, balance/symmetry, constraint satisfaction, optimization

**Multimodal Features:**
- **Visual:** Top-down or side-view of vehicle cargo area. Cargo items with visible weight labels. Center of gravity indicator (dot that moves as cargo is placed). Weight gauge showing current vs maximum. Balance meter (tilts when load is asymmetric). Stability simulation shows vehicle tipping if overloaded on one side.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees cargo positions, center of gravity location, weight gauge, and balance state. Provides real-time guidance: warns about imbalance ("I notice the left side is getting heavier — what could you move?"), celebrates when CG enters the target zone, coaches weight optimization ("You're close to the limit — is there lighter cargo you could swap in?"), and guides through stability simulation results.
- **Interactive:** Drag cargo items into vehicle. Watch balance indicator respond in real-time. Weight gauge fills up. Run stability simulation. Optimization challenges (fit all required cargo in minimum space).

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K | Heavy things go on the bottom; don't tip over! Balance = equal on both sides |
| 1 | Balance: put the same weight on each side of the center |
| 2 | Weight limits: you can't carry everything; some things don't fit |
| 3 | Center of gravity: the balance point changes as you add/remove cargo |
| 4 | Weight distribution affects how the vehicle handles (nose-heavy plane dives) |
| 5 | Load optimization, fuel weight adds to total, cargo manifests, real logistics |

**Interaction Model:**
- Phase 1 (Load): Drag cargo items into the vehicle. Watch the weight gauge and balance indicator.
- Phase 2 (Balance): Rearrange cargo to center the balance point. No tipping allowed.
- Phase 3 (Optimize): Fit all required cargo within weight and space limits. Minimize wasted space.
- Phase 4 (Simulate): Run the stability test — does the vehicle stay balanced during movement?

**Schema:**
```json
{
  "primitiveType": "cargo-loading-challenge",
  "vehicleType": "string (airplane | truck | ship | train_car | helicopter)",
  "vehicleName": "string",
  "imagePrompt": "string",

  "cargoArea": {
    "width": "number (units)",
    "length": "number (units)",
    "maxWeight": "number (kg)",
    "centerOfGravity": { "x": "number", "y": "number" },
    "targetCGZone": {
      "minX": "number", "maxX": "number",
      "minY": "number", "maxY": "number",
      "description": "string (e.g., 'The balance point must stay inside this zone')"
    }
  },

  "cargoItems": [
    {
      "id": "string",
      "name": "string (e.g., 'Piano')",
      "weight": "number (kg)",
      "size": { "width": "number", "height": "number" },
      "icon": "string",
      "fragile": "boolean",
      "required": "boolean (must be loaded to complete challenge)"
    }
  ],

  "challenges": [
    {
      "name": "string (e.g., 'Balanced Load')",
      "instruction": "string",
      "requiredCargoIds": ["string"],
      "successCriteria": {
        "cgInZone": "boolean",
        "underWeight": "boolean",
        "allRequiredLoaded": "boolean"
      },
      "hint": "string"
    }
  ],

  "stabilitySimulation": {
    "enabled": "boolean",
    "tiltThreshold": "number (degrees before tipping)",
    "description": "string"
  },

  "gradeBand": "K-2 | 3-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'cargo-loading-challenge'`
- `challengesCompleted` / `challengesTotal`
- `cgInTargetZone` (boolean — was the center of gravity within the acceptable zone)
- `weightUnderLimit` (boolean)
- `allRequiredCargoLoaded` (boolean)
- `rearrangementsCount` (how many times they moved cargo — fewer = better planning)
- `stabilityTestPassed` (boolean)
- `spaceEfficiency` (0-100 — how well cargo area was utilized)
- `attemptsCount`

---

### 14. `journey-planner` — Multi-Modal Transportation

**Purpose:** A map-based transportation planning tool. Students plan how to move people or goods from point A to point B, choosing vehicle types for each leg and comparing routes. Introduces multi-modal transportation, route planning, and the idea that different vehicles excel in different environments. Answers "How does stuff get to the store?"

**Grade Band:** 1-5

**Cognitive Operation:** Spatial reasoning, decision-making, trade-off analysis, systems thinking

**Multimodal Features:**
- **Visual:** Simplified map with start point, destination, and terrain features (ocean, mountains, rivers, cities). Route lines color-coded by vehicle type. Metrics dashboard (time, cost, environmental impact). Multi-modal route showing vehicle change points.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees route segments, vehicle selections, terrain obstacles, and optimization metrics. Narrates the journey as it's built ("First your truck drives 200 km to the port — 3 hours. Now you hit the ocean — you'll need a different vehicle!"), coaches vehicle-to-terrain matching, asks trade-off questions ("Would the faster route be worth the extra cost?"), and guides supply chain thinking.
- **Interactive:** Drag route segments between waypoints. Select vehicle for each segment. Compare alternative routes side-by-side. Discover obstacles that force vehicle changes (can't drive across an ocean).

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 1 | Different ways to get places: walk, car, bus, plane, boat; matching vehicle to terrain |
| 2 | Some trips need more than one vehicle (drive to airport → fly → taxi) |
| 3 | Comparing routes: faster isn't always better — cost and environment matter too |
| 4 | Supply chain basics: how a t-shirt gets from cotton field to store (farm → truck → ship → truck → store) |
| 5 | Logistics optimization, environmental impact of shipping, global trade routes |

**Interaction Model:**
- Phase 1 (Simple): Plan a one-vehicle trip between two nearby points. Choose the best vehicle.
- Phase 2 (Multi-Modal): Plan a trip that requires at least 2 different vehicles (drive to airport, then fly).
- Phase 3 (Optimize): Compare two routes for the same journey — one optimized for speed, one for cost.
- Phase 4 (Supply Chain): Trace a product's journey from source to consumer across multiple legs and vehicles.

**Schema:**
```json
{
  "primitiveType": "journey-planner",
  "title": "string (e.g., 'From Farm to Fork: How Food Travels')",
  "mapType": "string (simple | regional | continental | global)",

  "waypoints": [
    {
      "id": "string",
      "name": "string (e.g., 'Wheat Farm, Kansas')",
      "type": "string (start | waypoint | destination)",
      "terrain": "string (land | coast | ocean | mountain | city)",
      "position": { "x": "percentage", "y": "percentage" }
    }
  ],

  "segments": [
    {
      "fromId": "string",
      "toId": "string",
      "distance": "number (km)",
      "terrain": "string (road | ocean | air | rail | river)",
      "availableVehicles": [
        {
          "vehicleType": "string (truck | ship | airplane | train | bicycle | walking)",
          "timeEstimate": "string",
          "costEstimate": "string",
          "co2Estimate": "string | null",
          "constraints": "string | null (e.g., 'Can only carry 20 tonnes')"
        }
      ]
    }
  ],

  "obstacles": [
    {
      "between": ["string (waypoint ids)"],
      "type": "string (ocean | mountain | no_road | border)",
      "description": "string (e.g., 'The Pacific Ocean is 10,000 km wide — you can\\'t drive across it!')",
      "requiredVehicleType": "string (which vehicle types CAN cross this obstacle)"
    }
  ],

  "challenges": [
    {
      "name": "string (e.g., 'Fastest Route')",
      "optimizeFor": "string (time | cost | environment | reliability)",
      "description": "string",
      "optimalRoute": {
        "segments": [{ "fromId": "string", "toId": "string", "vehicleType": "string" }],
        "totalTime": "string",
        "totalCost": "string"
      }
    }
  ],

  "supplyChainMode": {
    "product": "string (e.g., 'A banana from Ecuador to your lunch table')",
    "steps": [
      {
        "description": "string",
        "vehicle": "string",
        "fromWaypoint": "string",
        "toWaypoint": "string"
      }
    ]
  },

  "gradeBand": "1-2 | 3-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'journey-planner'`
- `routeCompletedSuccessfully` (boolean — did the route connect start to destination)
- `vehicleChoicesAppropriate` / `segmentsTotal` (did they match vehicle to terrain correctly)
- `multiModalRouteCreated` (boolean — did they use more than one vehicle type)
- `optimizationGoalMet` (boolean — did the route meet the challenge criteria)
- `routeComparisonMade` (boolean — did they compare alternative routes)
- `supplyChainCompleted` (boolean — full product journey traced)
- `obstaclesHandled` / `obstaclesTotal` (did they navigate around terrain barriers)
- `attemptsCount`

---

### 15. `how-it-moves` — Forces on a Moving Vehicle

**Purpose:** A "free body diagram" tool for vehicles in motion. Students see a vehicle (car on a hill, boat in water, plane in flight, sled on ice) and identify all the forces acting on it — gravity, friction, thrust, drag, lift, normal force, buoyancy. Then they predict the motion. Bridges from the flight-specific `flight-forces-explorer` to forces on ALL vehicles.

**Grade Band:** 2-5

**Cognitive Operation:** Force identification, prediction from force balance, transfer across contexts

**Multimodal Features:**
- **Visual:** Vehicle in a scene with force arrow overlay. Draggable force labels that snap to correct position and direction. Net force arrow showing combined result. Motion prediction (accelerating, decelerating, constant speed, stationary). Color-coded force categories.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees force placements, direction assignments, motion predictions, and what-if responses. Coaches force identification ("Good — you found gravity pulling down. What other forces act on this car?"), validates predictions before revealing answers, explains balanced vs unbalanced forces conversationally, and guides what-if reasoning ("What happens to the car if the engine turns off?").
- **Interactive:** Drag force labels onto the vehicle. Set force magnitudes. Predict the motion before revealing the answer. Switch between vehicle scenarios. Toggle net force display.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 2 | Gravity pulls down; ground pushes up; engines push forward; friction slows down |
| 3 | Balanced forces = no change in motion; unbalanced = speeding up or slowing down |
| 4 | Free body diagrams; identifying all forces on a vehicle; force pairs |
| 5 | Net force calculation; force in different media (air drag vs water drag vs friction) |

**Interaction Model:**
- Phase 1 (Identify): Given a vehicle scenario, identify all forces acting on it by dragging labels.
- Phase 2 (Direction): Set the correct direction for each force arrow.
- Phase 3 (Predict): Based on the forces, predict whether the vehicle will speed up, slow down, stay constant, or stay still.
- Phase 4 (What-If): Change one force (e.g., "the engine turns off") and predict the new motion.

**Schema:**
```json
{
  "primitiveType": "how-it-moves",
  "scenario": {
    "name": "string (e.g., 'Car on a flat road at constant speed')",
    "vehicle": "string",
    "environment": "string (flat_road | hill | water | air | ice | space)",
    "imagePrompt": "string",
    "description": "string"
  },
  "forces": [
    {
      "id": "string",
      "name": "string (e.g., 'Gravity')",
      "category": "string (gravity | contact | applied | friction | fluid)",
      "magnitude": "number (N)",
      "direction": "string (up | down | left | right | forward | backward)",
      "description": "string",
      "appliedBy": "string (e.g., 'The Earth', 'The engine', 'The air')",
      "actingOn": "string (e.g., 'The car')"
    }
  ],
  "netForce": {
    "magnitude": "number (N)",
    "direction": "string",
    "resultingMotion": "string (accelerating | decelerating | constant_speed | stationary)"
  },
  "whatIfScenarios": [
    {
      "change": "string (e.g., 'The engine turns off')",
      "forcesAffected": [{ "forceId": "string", "newMagnitude": "number" }],
      "newNetForce": { "magnitude": "number", "direction": "string" },
      "newMotion": "string",
      "explanation": "string"
    }
  ],
  "identificationChallenge": {
    "forceLabels": ["string (labels to drag onto diagram)"],
    "distractors": ["string (incorrect force labels)"],
    "correctPlacements": [{ "label": "string", "forceId": "string" }]
  },
  "gradeBand": "2-3 | 4-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'how-it-moves'`
- `forcesIdentifiedCorrectly` / `forcesTotal`
- `directionsCorrect` / `forcesTotal`
- `distractorsRejected` / `distractorsTotal` (didn't use incorrect force labels)
- `motionPredictionCorrect` (boolean)
- `whatIfPredictionsCorrect` / `whatIfTotal`
- `scenariosCompleted` / `scenariosTotal`
- `attemptsCount`

---

## Technical Requirements

### State Management

All primitives must implement:

```typescript
interface PrimitiveState {
  id: string;
  config: PrimitiveConfig;
  state: any;

  serialize(): string;
  deserialize(data: string): void;
  onChange(callback: (state: any) => void): void;
  validate(): ValidationResult;
  compare(targetState: any): ComparisonResult;
}
```

### Simulation Requirements

Vehicles & flight primitives require specialized computation:

- **Aerodynamics**: Simplified panel method for airfoil lift/drag, streamline particle rendering, pressure field visualization
- **Rigid Body**: Vehicle dynamics, center of gravity, balance/stability simulation
- **Fluid Flow**: Wind tunnel streamline/smoke rendering, turbulence wake visualization
- **Trajectory**: Projectile motion for paper airplane, basic flight path simulation
- **Engine Cycles**: Animated multi-step cycle visualization (piston, turbine)

Performance targets:
- Aerodynamic calculation: < 15ms per step
- Streamline/particle rendering: 60fps with up to 200 particles
- Flight simulation step: < 10ms
- Vehicle comparison data lookup: < 5ms
- Engine cycle animation: 60fps

### Accessibility Requirements

Each primitive must support:
- Full keyboard navigation
- Screen reader descriptions of forces, instruments, vehicle states, and animations
- High contrast mode for flow visualizations and force arrows
- Reduced motion mode (static diagrams instead of animations, step-by-step instead of continuous)
- Touch and pointer input
- Minimum touch target size (44x44px)

### Performance Requirements

- Initial render: < 100ms (< 150ms for 3D flight controls and cockpit)
- State update: < 16ms (60fps interactions)
- Aerodynamic simulation: < 15ms per step
- Serialization: < 50ms
- Maximum bundle size per primitive: 75KB gzipped (100KB for 3D cockpit/flight controls)

### Data Requirements

- Real vehicle specifications (speed, range, weight, capacity) — sourced from manufacturer data
- Historical vehicle data for timeline (dates, speeds, inventors)
- Accurate airfoil data (NACA profiles or equivalent lift/drag coefficients)
- Real-world route distances and typical transit times
- Vehicle imagery/illustration prompts for AI generation
- Engine specifications and cycle parameters

---

## Catalog & Domain Structure

### New Catalog Module: `catalog/vehicles.ts`

All 15 primitives join a new `VEHICLES_CATALOG` in the manifest system. This follows the same pattern as `catalog/engineering.ts` and `catalog/literacy.ts`.

**Subcategories within the catalog:**

| Subcategory | Primitives |
|---|---|
| Flight & Aerodynamics | `flight-forces-explorer`, `airfoil-lab`, `paper-airplane-designer`, `flight-control-surfaces`, `wind-tunnel-simulator` |
| Machine Profiles & Anatomy | `machine-profile`, `engine-explorer`, `cockpit-explorer` |
| Power, Motion & Comparison | `vehicle-comparison-lab`, `propulsion-lab`, `propulsion-timeline` |
| Design & Innovation | `vehicle-design-studio`, `cargo-loading-challenge`, `journey-planner`, `how-it-moves` |

### Generator Domain

New directory: `service/vehicles/` with individual generator files. New `vehiclesGenerators.ts` in the generators registry.

---

## File Inventory

### New Files (per primitive: component + generator = 2 files)

| # | Primitive | Component File | Generator File |
|---|-----------|---------------|---------------|
| 1 | `flight-forces-explorer` | `primitives/visual-primitives/vehicles/FlightForcesExplorer.tsx` | `service/vehicles/gemini-flight-forces-explorer.ts` |
| 2 | `airfoil-lab` | `primitives/visual-primitives/vehicles/AirfoilLab.tsx` | `service/vehicles/gemini-airfoil-lab.ts` |
| 3 | `paper-airplane-designer` | `primitives/visual-primitives/vehicles/PaperAirplaneDesigner.tsx` | `service/vehicles/gemini-paper-airplane-designer.ts` |
| 4 | `flight-control-surfaces` | `primitives/visual-primitives/vehicles/FlightControlSurfaces.tsx` | `service/vehicles/gemini-flight-control-surfaces.ts` |
| 5 | `wind-tunnel-simulator` | `primitives/visual-primitives/vehicles/WindTunnelSimulator.tsx` | `service/vehicles/gemini-wind-tunnel-simulator.ts` |
| 6 | `machine-profile` | `primitives/visual-primitives/vehicles/MachineProfile.tsx` | `service/vehicles/gemini-machine-profile.ts` |
| 7 | `engine-explorer` | `primitives/visual-primitives/vehicles/EngineExplorer.tsx` | `service/vehicles/gemini-engine-explorer.ts` |
| 8 | `cockpit-explorer` | `primitives/visual-primitives/vehicles/CockpitExplorer.tsx` | `service/vehicles/gemini-cockpit-explorer.ts` |
| 9 | `vehicle-comparison-lab` | `primitives/visual-primitives/vehicles/VehicleComparisonLab.tsx` | `service/vehicles/gemini-vehicle-comparison-lab.ts` |
| 10 | `propulsion-lab` | `primitives/visual-primitives/vehicles/PropulsionLab.tsx` | `service/vehicles/gemini-propulsion-lab.ts` |
| 11 | `propulsion-timeline` | `primitives/visual-primitives/vehicles/PropulsionTimeline.tsx` | `service/vehicles/gemini-propulsion-timeline.ts` |
| 12 | `vehicle-design-studio` | `primitives/visual-primitives/vehicles/VehicleDesignStudio.tsx` | `service/vehicles/gemini-vehicle-design-studio.ts` |
| 13 | `cargo-loading-challenge` | `primitives/visual-primitives/vehicles/CargoLoadingChallenge.tsx` | `service/vehicles/gemini-cargo-loading-challenge.ts` |
| 14 | `journey-planner` | `primitives/visual-primitives/vehicles/JourneyPlanner.tsx` | `service/vehicles/gemini-journey-planner.ts` |
| 15 | `how-it-moves` | `primitives/visual-primitives/vehicles/HowItMoves.tsx` | `service/vehicles/gemini-how-it-moves.ts` |

### Shared Files (created once)

| File | Purpose |
|---|---|
| `service/registry/generators/vehiclesGenerators.ts` | Register all 15 generators |

### Existing Files Modified

| File | Changes |
|---|---|
| `types.ts` | Add 15 new ComponentIds to union |
| `config/primitiveRegistry.tsx` | Add 15 registry entries |
| `evaluation/types.ts` | Add 14 metrics interfaces + union members (MachineProfile has no eval) |
| `evaluation/index.ts` | Export new metrics types |
| `service/manifest/catalog/vehicles.ts` | **New** — 15 catalog entries with descriptions |
| `service/registry/generators/index.ts` | Import `vehiclesGenerators.ts` |

**Total: 31 new files + 5 existing file modifications + 1 new catalog file.**

---

## Multimodal Integration Summary

| Modality | Primitives Using It | Infrastructure |
|---|---|---|
| **AI Tutoring Scaffold** | All 15 primitives | `TutoringScaffold` in catalog → `useLuminaAI` hook → Gemini Live WebSocket → real-time speech. See [ADDING_TUTORING_SCAFFOLD.md](ADDING_TUTORING_SCAFFOLD.md). Existing pattern — used in `phonics-blender`, `fraction-bar`, etc. |
| **AI Image Generation** | `machine-profile`, `engine-explorer`, `cockpit-explorer`, `propulsion-timeline`, `vehicle-comparison-lab` | Gemini image generation (exists, same as `species-profile`) |
| **Drag-and-Drop** | `paper-airplane-designer`, `vehicle-design-studio`, `cargo-loading-challenge`, `how-it-moves` | React DnD patterns (exists in engineering primitives) |
| **Physics Simulation** | `flight-forces-explorer`, `airfoil-lab`, `paper-airplane-designer`, `wind-tunnel-simulator`, `cargo-loading-challenge` | Canvas/SVG animation (exists, extends engineering patterns) |
| **3D Interaction** | `flight-control-surfaces`, `cockpit-explorer` | **New** — 3D airplane model rendering (Three.js or simplified SVG) |
| **Rich Evaluation** | 14 of 15 primitives (all except `machine-profile`) | `usePrimitiveEvaluation` + metrics (exists) |
| **Data Visualization** | `vehicle-comparison-lab`, `propulsion-timeline`, `vehicle-design-studio` | Chart rendering (bar, radar, scatter, timeline) |

### New Infrastructure Required

| Capability | Used By | Complexity |
|---|---|---|
| **Streamline/particle renderer** | `airfoil-lab`, `wind-tunnel-simulator` | Medium — animated particle paths following velocity field |
| **3D airplane model** | `flight-control-surfaces`, `cockpit-explorer` | Medium-High — simplified 3D model with control surface animation |
| **Flight physics engine** | `flight-forces-explorer`, `paper-airplane-designer` | Medium — simplified lift/drag/thrust/weight simulation |
| **Vehicle specification database** | `vehicle-comparison-lab`, `machine-profile` | Low — static JSON data with real vehicle specs |
| **Timeline renderer** | `propulsion-timeline` | Low — scrollable/zoomable timeline with event markers |
| **Tutoring scaffold catalog entries** | All 15 primitives | Low — single `tutoring` field per catalog entry, following [ADDING_TUTORING_SCAFFOLD.md](ADDING_TUTORING_SCAFFOLD.md) pattern. No backend changes. |

---

## AI Tutoring Scaffold Definitions

Every interactive primitive must include a `tutoring` field in its `catalog/vehicles.ts` entry following the pattern in [ADDING_TUTORING_SCAFFOLD.md](ADDING_TUTORING_SCAFFOLD.md). This is a **single file edit** — no backend changes required. The backend is primitive-agnostic and formats whatever scaffolding the frontend sends.

Each scaffold defines: what the AI knows about the task (`taskDescription`), what runtime state it can see (`contextKeys`), how to progressively scaffold (`scaffoldingLevels`), what struggles to watch for (`commonStruggles`), any special commands (`aiDirectives`), and where the component should trigger AI speech (`sendText` pedagogical moments).

### 1. `flight-forces-explorer`

```typescript
{
  id: 'flight-forces-explorer',
  // ... existing fields ...
  tutoring: {
    taskDescription: 'Explore the four forces of flight (lift, weight, thrust, drag). Aircraft: {{aircraftName}}. Current state: {{flightState}}. Thrust: {{thrustPercent}}%. Angle: {{angleOfAttack}}°.',
    contextKeys: ['aircraftName', 'flightState', 'thrustPercent', 'angleOfAttack', 'liftMagnitude', 'weightMagnitude', 'thrustMagnitude', 'dragMagnitude', 'altitude', 'speed', 'challengeActive', 'challengeGoal'],
    scaffoldingLevels: {
      level1: '"What do you notice about the size of the force arrows right now?"',
      level2: '"Lift pushes up, weight pushes down. Which one is bigger? What does that tell you about what the plane will do?"',
      level3: '"When lift is greater than weight, the plane climbs. When thrust is greater than drag, it speeds up. To fly level, you need lift = weight AND thrust = drag."',
    },
    commonStruggles: [
      { pattern: 'Cannot achieve level flight — keeps climbing or descending', response: '"Focus on just one pair first. Can you make lift and weight equal? Try adjusting the angle of attack."' },
      { pattern: 'Stalls the aircraft repeatedly', response: '"When the angle is too steep, the air can\'t flow smoothly over the wing. Try a smaller angle — think of holding your hand flat out a car window."' },
      { pattern: 'Ignores drag — focuses only on lift', response: '"There are four forces, not just two! What\'s happening in the forward-backward direction?"' },
      { pattern: 'Does not explore different aircraft profiles', response: '"Want to see how a glider is different from a jumbo jet? Try switching the aircraft!"' },
    ],
    aiDirectives: [
      {
        title: 'FORCE STATE NARRATION',
        instruction: 'When you receive [FLIGHT_STATE_CHANGE], briefly narrate what\'s happening in kid-friendly language. Example: "The plane is climbing because lift (the blue arrow) is bigger than weight (the red arrow)!" Keep it to one sentence.',
      },
      {
        title: 'CHALLENGE COACHING',
        instruction: 'When [CHALLENGE_STARTED], introduce the goal. When [CHALLENGE_FAILED], give a hint based on which forces are out of balance. When [CHALLENGE_COMPLETED], celebrate and explain why it worked.',
      },
    ],
  },
}
```

**Pedagogical Moments (`sendText`):**
- `[FORCE_TAPPED]` — student taps a force arrow → name it and explain what it does
- `[FLIGHT_STATE_CHANGE]` — plane transitions between climbing/descending/level/stalled → narrate
- `[CHALLENGE_STARTED]` — new challenge begins → introduce the goal
- `[CHALLENGE_COMPLETED]` — challenge met → celebrate, explain the force balance that worked
- `[CHALLENGE_FAILED]` — student can't meet challenge → hint based on force imbalance
- `[STALL_TRIGGERED]` — student discovers stall → explain what happened and why
- `[AIRCRAFT_SWITCHED]` — new aircraft profile selected → compare forces to previous aircraft

---

### 2. `airfoil-lab`

```typescript
{
  id: 'airfoil-lab',
  tutoring: {
    taskDescription: 'Experiment with wing shapes to understand how lift is generated. Current airfoil: {{airfoilName}}. Angle of attack: {{angleOfAttack}}°. Wind speed: {{windSpeed}} m/s. Lift: {{liftForce}} N. Drag: {{dragForce}} N.',
    contextKeys: ['airfoilName', 'airfoilShape', 'angleOfAttack', 'windSpeed', 'liftForce', 'dragForce', 'stallAngle', 'compareModeActive'],
    scaffoldingLevels: {
      level1: '"Look at how the streamlines move above and below the wing. Do you notice a difference?"',
      level2: '"The air moves faster over the curved top. Faster air has lower pressure. What direction does that push the wing?"',
      level3: '"Curved wings create a pressure difference — low pressure above, high pressure below. This pressure difference IS lift. It\'s called Bernoulli\'s principle."',
    },
    commonStruggles: [
      { pattern: 'Doesn\'t change variables — just watches', response: '"Try making the wing more curved! Drag the top of the wing upward and see what happens to the lift number."' },
      { pattern: 'Increases angle of attack past stall without understanding', response: '"Whoa — the streamlines went crazy! That\'s called a stall. The air can\'t follow the wing anymore. Try backing off the angle."' },
      { pattern: 'Confuses lift and drag', response: '"Lift goes UP (keeps the plane in the air). Drag goes BACKWARD (slows the plane down). Which one do we want more of?"' },
    ],
  },
}
```

**Pedagogical Moments:** `[SHAPE_CHANGED]`, `[ANGLE_CHANGED]`, `[STALL_REACHED]`, `[COMPARISON_STARTED]`, `[CHALLENGE_RESULT]`, `[PREDICTION_SUBMITTED]`

---

### 3. `paper-airplane-designer`

```typescript
{
  id: 'paper-airplane-designer',
  tutoring: {
    taskDescription: 'Design, build, and test paper airplanes. Template: {{templateName}}. Design iteration: {{designVersion}}. Last flight: {{lastDistance}}m distance, {{lastHangTime}}s hang time.',
    contextKeys: ['templateName', 'designVersion', 'noseAngle', 'wingSpan', 'wingAngle', 'hasWinglets', 'noseWeight', 'launchAngle', 'launchForce', 'lastDistance', 'lastHangTime', 'lastStability', 'challengeActive', 'challengeGoal'],
    scaffoldingLevels: {
      level1: '"What do you think would happen if you made the wings wider?"',
      level2: '"Your last plane went {{lastDistance}}m. You changed the nose angle AND the wing span. Next time, try changing just ONE thing — that way you\'ll know what caused the difference."',
      level3: '"The engineering design process: 1) Change one thing. 2) Test it. 3) Compare to your last design. 4) Keep what works, change what doesn\'t. This is how real engineers work!"',
    },
    commonStruggles: [
      { pattern: 'Changes multiple variables at once', response: '"You changed three things! Which one made the difference? Try changing just the nose angle this time."' },
      { pattern: 'Doesn\'t iterate — tries once and stops', response: '"Real airplane designers test hundreds of designs! Your first try went {{lastDistance}}m. Can you beat that?"' },
      { pattern: 'Plane nosedives consistently', response: '"Your plane dives down fast. That usually means it\'s too heavy in the front. Try removing a paper clip or moving the wings forward."' },
    ],
    aiDirectives: [
      {
        title: 'DESIGN ITERATION COACHING',
        instruction: 'When [FLIGHT_RESULT], compare to the previous design. Highlight what changed and whether performance improved. Use specific numbers: "Last time: 8m. This time: 11m — your wider wings added 3 meters!"',
      },
    ],
  },
}
```

**Pedagogical Moments:** `[DESIGN_MODIFIED]`, `[FLIGHT_RESULT]`, `[CHALLENGE_STARTED]`, `[CHALLENGE_COMPLETED]`, `[IMPROVEMENT_DETECTED]`, `[REGRESSION_DETECTED]`

---

### 4. `flight-control-surfaces`

```typescript
{
  id: 'flight-control-surfaces',
  tutoring: {
    taskDescription: 'Learn how pilots steer airplanes using control surfaces. Active surface: {{activeSurface}}. Current axis: {{activeAxis}}. Challenge: {{challengeId}}.',
    contextKeys: ['activeSurface', 'activeAxis', 'rollAngle', 'pitchAngle', 'yawAngle', 'challengeId', 'ringsCompleted', 'ringsTotal', 'viewMode'],
    scaffoldingLevels: {
      level1: '"Try moving the stick to the left. What happens to the plane?"',
      level2: '"The ailerons (on the wing edges) control ROLL — tilting the plane left or right. The elevator (on the tail) controls PITCH — nose up or down."',
      level3: '"There are three ways to rotate: Roll (ailerons, wings tilt), Pitch (elevator, nose up/down), Yaw (rudder, nose left/right). A real turn uses ailerons AND elevator together."',
    },
    commonStruggles: [
      { pattern: 'Confuses roll and yaw', response: '"Roll tilts the whole plane sideways (like a kayak). Yaw turns the nose left or right (like a car). Try them one at a time!"' },
      { pattern: 'Can\'t complete ring challenges — over-corrects', response: '"Small movements! Real pilots use tiny adjustments. Try barely moving the stick."' },
      { pattern: 'Only uses one control surface', response: '"You\'ve mastered the ailerons! Now try the elevator — push the stick forward and see what happens."' },
    ],
  },
}
```

**Pedagogical Moments:** `[SURFACE_TAPPED]`, `[AXIS_DISCOVERED]`, `[RING_COMPLETED]`, `[RING_MISSED]`, `[COORDINATED_TURN]`, `[QUIZ_ANSWER]`

---

### 5. `wind-tunnel-simulator`

```typescript
{
  id: 'wind-tunnel-simulator',
  tutoring: {
    taskDescription: 'Test shapes in a virtual wind tunnel to understand aerodynamics. Shape: {{shapeName}}. Wind speed: {{windSpeed}} m/s. Drag: {{dragValue}}.',
    contextKeys: ['shapeName', 'shapeCategory', 'windSpeed', 'dragValue', 'dragCoefficient', 'compareModeActive', 'comparisonShapeA', 'comparisonShapeB', 'customShapeActive'],
    scaffoldingLevels: {
      level1: '"Look at the streamlines. Are they smooth or messy behind the shape?"',
      level2: '"Smooth streamlines = low drag. Messy, swirly air behind the shape = high drag. Which shape has smoother flow?"',
      level3: '"Drag comes from two things: the shape pushing air aside (form drag) and air sticking to the surface (friction drag). A teardrop shape minimizes both by letting air close smoothly behind it."',
    },
    commonStruggles: [
      { pattern: 'Thinks pointy = always less drag', response: '"A pointy front helps, but the BACK matters just as much! A pointy front with a flat back still creates lots of turbulence. Try the teardrop."' },
      { pattern: 'Doesn\'t use compare mode', response: '"Want to see something cool? Put two shapes side by side and turn on the wind. The difference is dramatic!"' },
    ],
  },
}
```

**Pedagogical Moments:** `[SHAPE_PLACED]`, `[COMPARISON_RESULT]`, `[PREDICTION_SUBMITTED]`, `[CUSTOM_SHAPE_TESTED]`, `[CHALLENGE_RESULT]`

---

### 6. `machine-profile`

```typescript
{
  id: 'machine-profile',
  tutoring: {
    taskDescription: 'Exploring a machine profile: {{machineName}} ({{category}}). Help the student understand how this machine works and connect to their experience.',
    contextKeys: ['machineName', 'category', 'era', 'sectionsOpened'],
    scaffoldingLevels: {
      level1: '"What do you already know about {{machineName}}? Have you ever seen one?"',
      level2: '"Let\'s look at the How It Works section. What part surprises you most?"',
      level3: '"This machine works by {{howItWorksSummary}}. Can you think of another machine that works in a similar way?"',
    },
    commonStruggles: [
      { pattern: 'Only looks at the picture, doesn\'t explore sections', response: '"There\'s so much more to discover! Try tapping the Key Components section — you\'ll learn what\'s inside."' },
      { pattern: 'Asks questions the profile doesn\'t cover', response: 'Answer the student\'s question using your general knowledge about {{machineName}}, then guide them back to the profile content.' },
    ],
  },
}
```

**Pedagogical Moments:** `[SECTION_OPENED]`, `[IMAGE_GENERATED]`, `[RELATED_MACHINE_TAPPED]`

---

### 7. `engine-explorer`

```typescript
{
  id: 'engine-explorer',
  tutoring: {
    taskDescription: 'Explore how a {{engineType}} engine works. Current stage: {{currentStage}}. Vehicle context: {{vehicleContext}}.',
    contextKeys: ['engineType', 'engineName', 'currentStage', 'stageName', 'throttlePosition', 'vehicleContext', 'componentsExplored', 'componentsTotal', 'compareModeActive'],
    scaffoldingLevels: {
      level1: '"What do you think happens next in the cycle?"',
      level2: '"We just saw {{previousStage}}. Now the {{currentComponent}} does its job. What kind of energy is changing?"',
      level3: '"Energy flows through this engine: fuel (chemical energy) → combustion (heat energy) → motion (kinetic energy). Some energy is lost as heat and sound — that\'s why engines get hot!"',
    },
    commonStruggles: [
      { pattern: 'Doesn\'t understand the cycle repeats', response: '"Notice how it goes back to the beginning? This cycle happens hundreds of times every SECOND!"' },
      { pattern: 'Can\'t identify energy transformations', response: '"Think of fuel like a battery full of energy. When it burns, that energy has to go somewhere. Where does it go?"' },
      { pattern: 'Doesn\'t explore component details', response: '"Try tapping on the {{unexploredComponent}} — you\'ll find out what it does inside the engine!"' },
    ],
    aiDirectives: [
      {
        title: 'CYCLE STAGE NARRATION',
        instruction: 'When [STAGE_ADVANCED], narrate what\'s happening at this stage using the analogy from the component data. Keep it to 1-2 sentences. Example: "Now the piston pushes down and sucks in air and fuel — like taking a deep breath!"',
      },
    ],
  },
}
```

**Pedagogical Moments:** `[STAGE_ADVANCED]`, `[COMPONENT_TAPPED]`, `[THROTTLE_CHANGED]`, `[ENGINE_TYPE_SWITCHED]`, `[COMPARISON_STARTED]`, `[VEHICLE_MATCH_SUBMITTED]`

---

### 8. `cockpit-explorer`

```typescript
{
  id: 'cockpit-explorer',
  tutoring: {
    taskDescription: 'Explore a {{vehicleType}} cockpit/control panel. Vehicle: {{vehicleName}}. Instruments explored: {{instrumentsExplored}}/{{instrumentsTotal}}.',
    contextKeys: ['vehicleType', 'vehicleName', 'panelComplexity', 'instrumentsExplored', 'instrumentsTotal', 'lastInstrumentTapped', 'scenarioActive', 'scenarioQuestion'],
    scaffoldingLevels: {
      level1: '"What do you think this instrument tells the pilot?"',
      level2: '"This is the {{instrumentName}}. It measures {{measures}}. Right now it reads {{currentReading}}."',
      level3: '"Pilots check instruments constantly. The {{instrumentName}} tells them {{measures}} so they can make safe decisions."',
    },
    commonStruggles: [
      { pattern: 'Overwhelmed by number of instruments', response: '"There are a lot of instruments! Let\'s start with the most important three: speed, altitude, and heading. Can you find the speedometer?"' },
      { pattern: 'Doesn\'t connect controls to instruments', response: '"Try moving the throttle and watch what happens to the speed gauge! Controls and instruments are connected."' },
    ],
  },
}
```

**Pedagogical Moments:** `[INSTRUMENT_TAPPED]`, `[CONTROL_MOVED]`, `[SCENARIO_STARTED]`, `[SCENARIO_ANSWERED]`, `[QUIZ_ANSWER]`, `[VEHICLE_TYPE_SWITCHED]`

---

### 9. `vehicle-comparison-lab`

```typescript
{
  id: 'vehicle-comparison-lab',
  tutoring: {
    taskDescription: 'Compare real vehicles using data. Comparing: {{vehicleA}} vs {{vehicleB}}. Metrics visible: {{activeMetrics}}.',
    contextKeys: ['selectedVehicles', 'activeMetrics', 'chartType', 'challengeActive', 'challengeScenario', 'challengeAnswer'],
    scaffoldingLevels: {
      level1: '"Which vehicle do you think is faster? Take a guess before looking at the chart!"',
      level2: '"Look at the bars. {{vehicleA}} is faster, but {{vehicleB}} carries way more people. Which matters more?"',
      level3: '"There\'s no single \'best\' vehicle. It depends on what you need: speed, capacity, range, cost, or environment. That\'s called a trade-off."',
    },
    commonStruggles: [
      { pattern: 'Only compares speed — ignores other metrics', response: '"Speed is fun, but what if you need to move 1,000 people? Is the fastest vehicle still the best choice?"' },
      { pattern: 'Can\'t justify challenge answers', response: '"Use the data! Point to a specific number that supports your choice."' },
    ],
  },
}
```

**Pedagogical Moments:** `[VEHICLES_SELECTED]`, `[METRIC_CHANGED]`, `[CHALLENGE_ANSWER_SUBMITTED]`, `[SURPRISING_FACT_REVEALED]`

---

### 10. `propulsion-lab`

```typescript
{
  id: 'propulsion-lab',
  tutoring: {
    taskDescription: 'Explore how different propulsion systems create thrust using Newton\'s Third Law. Current type: {{propulsionType}}. Medium: {{medium}}.',
    contextKeys: ['propulsionType', 'medium', 'thrustLevel', 'newtonThirdVisible', 'whatIfScenario', 'whatIfAnswer'],
    scaffoldingLevels: {
      level1: '"When you blow up a balloon and let it go, which way does the air go? Which way does the balloon go?"',
      level2: '"The {{propulsionType}} pushes {{actionDescription}} backward. The reaction? The vehicle moves forward! That\'s Newton\'s Third Law."',
      level3: '"Every action has an equal and opposite reaction. The jet engine pushes hot gas BACKWARD — the plane is pushed FORWARD. Same force, opposite direction."',
    },
    commonStruggles: [
      { pattern: 'Thinks engines push against the ground or air behind them', response: '"A rocket works in empty space where there\'s nothing to push against! It\'s not pushing ON the air — it\'s pushing air OUT."' },
      { pattern: 'Can\'t identify the action/reaction pair', response: '"Look for what gets pushed backward. That\'s the action. The vehicle moving forward is the reaction."' },
    ],
  },
}
```

**Pedagogical Moments:** `[PROPULSION_SELECTED]`, `[NEWTON_THIRD_TOGGLED]`, `[WHAT_IF_ANSWERED]`, `[ACTION_REACTION_IDENTIFIED]`, `[COMPARISON_RESULT]`

---

### 11. `propulsion-timeline`

```typescript
{
  id: 'propulsion-timeline',
  tutoring: {
    taskDescription: 'Explore the history of transportation from {{eraName}}. Current milestone: {{milestoneName}} ({{milestoneYear}}).',
    contextKeys: ['currentEra', 'eraName', 'milestoneName', 'milestoneYear', 'domainsVisible', 'sequencingChallengeActive'],
    scaffoldingLevels: {
      level1: '"What do you think came first — the car or the airplane?"',
      level2: '"The {{milestoneName}} was invented in {{milestoneYear}}. What was different about the world after this invention?"',
      level3: '"Each invention built on earlier ones. {{enabledByName}} made {{milestoneName}} possible. Without steam engines, we wouldn\'t have had trains."',
    },
    commonStruggles: [
      { pattern: 'Assumes modern inventions came first', response: '"People traveled for thousands of years before engines existed! What do you think they used?"' },
      { pattern: 'Struggles with chronological ordering', response: '"Think about what each invention needs. An airplane needs an engine — so engines must have come first!"' },
    ],
  },
}
```

**Pedagogical Moments:** `[MILESTONE_TAPPED]`, `[ERA_ENTERED]`, `[SEQUENCING_SUBMITTED]`, `[INNOVATION_CHAIN_TRACED]`

---

### 12. `vehicle-design-studio`

```typescript
{
  id: 'vehicle-design-studio',
  tutoring: {
    taskDescription: 'Design a {{domain}} vehicle. Iteration: {{designIteration}}. Constraints: {{constraintsSummary}}. Last test: speed={{lastSpeed}}, stability={{lastStability}}.',
    contextKeys: ['domain', 'designIteration', 'selectedBody', 'selectedPropulsion', 'selectedControls', 'totalWeight', 'totalCost', 'constraintsMet', 'lastSpeed', 'lastStability', 'lastRange', 'lastEfficiency', 'challengeActive'],
    scaffoldingLevels: {
      level1: '"What do you think will happen when you test this design?"',
      level2: '"Your vehicle weighs {{totalWeight}}kg but your engine only produces {{thrustOutput}}N of thrust. Do you think that\'s enough?"',
      level3: '"To improve, change just ONE part at a time and retest. Compare: did speed go up? Did stability change? Real engineers call this \'iterative design.\'"',
    },
    commonStruggles: [
      { pattern: 'Picks the biggest/most expensive parts without considering constraints', response: '"Check the budget! You\'ve spent {{totalCost}} out of {{maxCost}}. Is there a lighter, cheaper option?"' },
      { pattern: 'Doesn\'t iterate — tries one design and gives up', response: '"Your first design is never the final one! Even the Wright Brothers tested hundreds of wing shapes. Change one thing and try again."' },
      { pattern: 'Can\'t meet constraints', response: '"Which constraint are you missing? Let\'s focus on that one. What part of your design affects {{failedConstraint}} most?"' },
    ],
    aiDirectives: [
      {
        title: 'DESIGN FEEDBACK',
        instruction: 'When [TEST_RESULT], compare to the previous iteration using specific numbers. Highlight what improved and what got worse. Suggest ONE specific change to try next.',
      },
    ],
  },
}
```

**Pedagogical Moments:** `[PART_SELECTED]`, `[TEST_RESULT]`, `[CONSTRAINT_VIOLATED]`, `[CONSTRAINT_MET]`, `[IMPROVEMENT_DETECTED]`, `[CHALLENGE_COMPLETED]`

---

### 13. `cargo-loading-challenge`

```typescript
{
  id: 'cargo-loading-challenge',
  tutoring: {
    taskDescription: 'Load cargo into a {{vehicleType}} while maintaining balance and staying under weight limit. Weight: {{currentWeight}}/{{maxWeight}}kg. CG in zone: {{cgInZone}}.',
    contextKeys: ['vehicleType', 'currentWeight', 'maxWeight', 'cgX', 'cgY', 'cgInZone', 'cargoItemsLoaded', 'cargoItemsTotal', 'balanceTilt'],
    scaffoldingLevels: {
      level1: '"Is the balance indicator leaning to one side?"',
      level2: '"The heavy piano is on the left. What could you put on the right side to balance it out?"',
      level3: '"Center of gravity is the balance point. Every time you add cargo, the CG moves toward that cargo. To keep it centered, put heavy things near the middle or balance heavy things on opposite sides."',
    },
    commonStruggles: [
      { pattern: 'Loads all cargo on one side', response: '"Look at the balance meter — it\'s tilting! In a real airplane, this would make it roll. Try spreading cargo evenly."' },
      { pattern: 'Exceeds weight limit', response: '"You\'re over the weight limit! Which cargo is least important? Can you swap something heavy for something lighter?"' },
      { pattern: 'Doesn\'t understand center of gravity', response: '"Think of a seesaw. If you put all the heavy kids on one end, it tips. Same with a vehicle — keep the weight balanced around the middle."' },
    ],
  },
}
```

**Pedagogical Moments:** `[CARGO_PLACED]`, `[CARGO_REMOVED]`, `[CG_ENTERED_ZONE]`, `[CG_LEFT_ZONE]`, `[WEIGHT_LIMIT_EXCEEDED]`, `[STABILITY_TEST_RESULT]`, `[CHALLENGE_COMPLETED]`

---

### 14. `journey-planner`

```typescript
{
  id: 'journey-planner',
  tutoring: {
    taskDescription: 'Plan a journey from {{startName}} to {{endName}}. Segments planned: {{segmentsPlanned}}/{{segmentsTotal}}. Current vehicle: {{currentVehicle}}.',
    contextKeys: ['startName', 'endName', 'segmentsPlanned', 'segmentsTotal', 'currentVehicle', 'totalTime', 'totalCost', 'obstacleEncountered', 'optimizationGoal'],
    scaffoldingLevels: {
      level1: '"How would you get from {{startName}} to the next stop? What kind of road or water is in the way?"',
      level2: '"You\'re at the coast now — you can\'t drive across the ocean! What vehicle works on water?"',
      level3: '"A truck handles roads, a ship handles oceans, a plane handles long distances fast. Sometimes the best trip uses multiple vehicles — that\'s called multi-modal transportation."',
    },
    commonStruggles: [
      { pattern: 'Tries to use one vehicle for entire journey', response: '"Can a truck cross the ocean? Sometimes you need to switch vehicles! Look at the terrain between your stops."' },
      { pattern: 'Ignores cost or time constraints', response: '"The airplane is fastest, but look at the cost! Is there a slower option that saves money?"' },
    ],
  },
}
```

**Pedagogical Moments:** `[VEHICLE_SELECTED]`, `[OBSTACLE_HIT]`, `[SEGMENT_COMPLETED]`, `[ROUTE_COMPLETED]`, `[OPTIMIZATION_COMPARED]`

---

### 15. `how-it-moves`

```typescript
{
  id: 'how-it-moves',
  tutoring: {
    taskDescription: 'Identify forces acting on a {{vehicleName}} ({{environment}}). Forces placed: {{forcesPlaced}}/{{forcesTotal}}. Motion prediction: {{motionPrediction}}.',
    contextKeys: ['vehicleName', 'environment', 'forcesPlaced', 'forcesTotal', 'forcesCorrect', 'motionPrediction', 'actualMotion', 'whatIfActive'],
    scaffoldingLevels: {
      level1: '"What\'s pulling this {{vehicleName}} downward? What\'s holding it up?"',
      level2: '"You\'ve found gravity pulling down. Now think — what other forces act on a {{vehicleName}} on a {{environment}}? Is anything pushing it forward or slowing it down?"',
      level3: '"All the forces together determine motion. If forces are balanced (equal in all directions), the {{vehicleName}} stays at constant speed. If forces are unbalanced, it speeds up or slows down."',
    },
    commonStruggles: [
      { pattern: 'Forgets normal force (ground pushing up)', response: '"Gravity pulls the car down, but the car doesn\'t fall through the road! Something pushes back up. What is it?"' },
      { pattern: 'Confuses force direction', response: '"Friction always acts OPPOSITE to the direction of motion. If the car moves forward, friction pushes backward."' },
      { pattern: 'Can\'t predict motion from forces', response: '"Add up all the forces. Are they balanced? If the forward forces are bigger than the backward forces, which way will the vehicle go?"' },
    ],
  },
}
```

**Pedagogical Moments:** `[FORCE_PLACED]`, `[FORCE_DIRECTION_SET]`, `[PREDICTION_SUBMITTED]`, `[PREDICTION_REVEALED]`, `[WHAT_IF_CHANGE]`, `[WHAT_IF_PREDICTED]`, `[ALL_FORCES_CORRECT]`

---

## Implementation Priority

### Phase 1 — Foundation (highest impact, most reusable)

| Primitive | Rationale |
|-----------|-----------|
| `machine-profile` | Highest reuse value — works for ANY machine or vehicle. Direct SpeciesProfile equivalent. Foundation for all other vehicle content. |
| `flight-forces-explorer` | Direct answer to "how do planes fly?" — the question that sparked this PRD. Core aerodynamics concept. |
| `airfoil-lab` | Makes lift physics visible. Natural companion to flight forces. |

### Phase 2 — Core Flight & Comparison

| Primitive | Rationale |
|-----------|-----------|
| `paper-airplane-designer` | Hands-on engineering design process. Most tangible and engaging. |
| `vehicle-comparison-lab` | Data literacy + vehicle knowledge. Uses real-world data. High engagement. |
| `wind-tunnel-simulator` | Aerodynamic shape understanding. Connects to real vehicle design. |

### Phase 3 — Controls, Power & History

| Primitive | Rationale |
|-----------|-----------|
| `flight-control-surfaces` | 3D interaction complexity; builds on Phase 1 flight understanding. |
| `engine-explorer` | How machines are powered — universal curiosity topic. |
| `propulsion-lab` | Newton's Third Law across all vehicle types. Core physics connection. |

### Phase 4 — Advanced Challenges & Integration

| Primitive | Rationale |
|-----------|-----------|
| `cockpit-explorer` | Instrument literacy. Rich but not physics-critical. |
| `cargo-loading-challenge` | Weight and balance — practical engineering. |
| `propulsion-timeline` | History of transportation. Lower interaction complexity. |

### Phase 5 — Culminating Experiences

| Primitive | Rationale |
|-----------|-----------|
| `vehicle-design-studio` | Full design-build-test loop. Draws on all other primitives. |
| `journey-planner` | Multi-modal transportation. Systems thinking. |
| `how-it-moves` | Generalized force diagrams. Transfer learning across vehicle types. |

---

## Primitive Sequencing Recommendations

### The "How Do Planes Fly?" Learning Path
```
machine-profile (airplane) → flight-forces-explorer → airfoil-lab → flight-control-surfaces → cockpit-explorer
    (what is it?)               (four forces)          (wing shape)       (how to steer)         (pilot's view)
```

### The Engineering Design Path
```
wind-tunnel-simulator → paper-airplane-designer → vehicle-design-studio → cargo-loading-challenge
     (shape matters)       (design + iterate)        (full design loop)        (optimization)
```

### The "How Things Move" Physics Path
```
propulsion-lab → flight-forces-explorer → how-it-moves → vehicle-comparison-lab
  (Newton's 3rd)      (flight forces)     (all forces)     (real-world data)
```

### The "How We Got Here" History Path
```
propulsion-timeline → machine-profile (Wright Flyer) → machine-profile (747) → vehicle-comparison-lab
   (overview)              (first airplane)                (modern airplane)          (compare eras)
```

### The "How Machines Work" Inside Path
```
machine-profile → engine-explorer → propulsion-lab → cockpit-explorer
  (overview)        (inside engine)   (how thrust works)   (controls)
```

---

## Cross-Domain Connections

| This Primitive | Connects To | Connection |
|---------------|-------------|------------|
| `flight-forces-explorer` | **Lever Lab** (engineering) | Wing as a lever arm; lift force concept |
| `engine-explorer` | **Gear Train Builder** (engineering) | Gears inside engines and transmissions |
| `propulsion-lab` | **Rocket Science Explainer** (space) | Same Newton's Third Law, different context |
| `wind-tunnel-simulator` | **Shape Strength Tester** (engineering) | Aerodynamic vs structural shape optimization |
| `cargo-loading-challenge` | **Construction Sequence Planner** (engineering) | Loading order, dependencies, planning |
| `vehicle-design-studio` | **Blueprint Canvas** (engineering) | Design documentation and specification |
| `machine-profile` | **SpeciesProfile** (biology) | Same generalized profile pattern, different domain |
| `cockpit-explorer` | **Crane Operator Station** (engineering) | Instrument panels and operator controls |
| `journey-planner` | **Site Layout Planner** (engineering) | Spatial planning and logistics |
| `airfoil-lab` | **Species Profile: Birds** (biology) | Bird wing shape → airplane wing shape |
| `how-it-moves` | **Ramp Lab** (engineering) | Same force concepts on inclined planes |
| `propulsion-timeline` | **Evolution Timeline** (biology) | Same timeline UX pattern, different content |

---

## Appendix: Grade-Level Mapping

| Grade | Primary Primitives |
|-------|-------------------|
| K | MachineProfile (simple), Flight Forces (arrows only, no numbers), Vehicle Comparison (big/small, fast/slow), Cargo Loading (balance only) |
| 1 | MachineProfile, Flight Forces (thrust/lift named), Airfoil Lab (curved vs flat), Propulsion Lab (push backward = go forward), Journey Planner (simple) |
| 2 | Paper Airplane (design + iterate), Wind Tunnel (shapes), Engine Explorer (basic cycle), Cockpit (simplified), How It Moves (gravity + push) |
| 3 | Airfoil Lab (angle of attack), Flight Controls (roll/pitch/yaw), Vehicle Comparison (charts), Propulsion Lab (Newton's 3rd), Propulsion Timeline |
| 4 | Wind Tunnel (drag coefficient), Engine Explorer (energy flow), Vehicle Design Studio (constraints), Journey Planner (trade-offs), Cargo Loading (CG) |
| 5 | Full Airfoil Lab, Full Flight Controls, Vehicle Design (optimization), Cargo Loading (logistics), Journey Planner (global supply chains), How It Moves (all forces) |

---

## Appendix: NGSS Alignment

| Standard | Supporting Primitives |
|----------|----------------------|
| K-PS2-1 (Pushes and pulls) | Flight Forces Explorer, Propulsion Lab, How It Moves |
| K-PS2-2 (Motion comparison) | Vehicle Comparison Lab, Wind Tunnel Simulator |
| K-2-ETS1-1 (Define problems) | Vehicle Design Studio, Cargo Loading Challenge |
| K-2-ETS1-2 (Develop solutions) | Paper Airplane Designer, Vehicle Design Studio |
| K-2-ETS1-3 (Compare solutions) | Wind Tunnel, Vehicle Comparison, Paper Airplane |
| 3-PS2-1 (Forces on motion) | Flight Forces, Airfoil Lab, Propulsion Lab, How It Moves |
| 3-PS2-2 (Force patterns) | Wind Tunnel, Flight Control Surfaces, How It Moves |
| 3-5-ETS1-1 (Define criteria) | Vehicle Design Studio, Journey Planner |
| 3-5-ETS1-2 (Generate solutions) | Paper Airplane, Vehicle Design, Cargo Loading |
| 3-5-ETS1-3 (Plan & carry out tests) | Wind Tunnel, Airfoil Lab, Paper Airplane |
| 4-PS3-1 (Speed relates to energy) | Vehicle Comparison, Engine Explorer |
| 4-PS3-4 (Energy transfer) | Engine Explorer, Propulsion Lab |
| 5-PS2-1 (Gravity force) | Flight Forces Explorer, Cargo Loading, How It Moves |

---

## Appendix: Vehicles, Flight & Machines Vocabulary by Grade

| Grade | Key Terms |
|-------|-----------|
| K | fast, slow, fly, drive, float, push, pull, engine, wing, wheel, heavy, light, balance |
| 1 | lift, thrust, drag, weight, propeller, jet, cockpit, brake, accelerate, fuel, steer |
| 2 | airfoil, streamline, cargo, center of gravity, symmetry, design, test, iterate, improve |
| 3 | aerodynamic, angle of attack, Newton's Third Law, roll, pitch, yaw, aileron, rudder, elevator |
| 4 | drag coefficient, efficiency, turbine, combustion, payload, route, constraint, trade-off |
| 5 | Bernoulli's principle, laminar flow, turbulence, specific impulse, optimization, logistics, multi-modal |

---

## Appendix: Real Vehicle Integration

| Primitive | Real Vehicle Connections |
|-----------|--------------------------|
| MachineProfile | Any real vehicle: Boeing 747, Wright Flyer, Ford Model T, Titanic, Shinkansen, bicycle, submarine, etc. |
| Flight Forces | Cessna 172 (trainer), Boeing 747 (heavy), Blanik L-13 glider (no engine), F-22 (fighter) |
| Airfoil Lab | NACA 2412 (Cessna), Clark Y (classic), supercritical (modern jets), bird wing cross-section |
| Paper Airplane | Record-holders: Joe Ayoob's 69.14m throw, Takuo Toda's 27.9s hang time |
| Flight Controls | Cessna 172 trainer panel, simplified Airbus A320 sidestick |
| Wind Tunnel | Real drag coefficients: Tesla Model S (0.208), Hummer H2 (0.57), cyclist (0.88), 747 (0.031) |
| Engine Explorer | Wright Flyer engine (12 hp), Rolls-Royce Trent 900, Tesla Model 3 motor, Newcomen steam engine |
| Vehicle Comparison | Real specs sourced from manufacturer data for all vehicles |
| Propulsion Timeline | Wheel (~3500 BCE), Sail (~3000 BCE), Steam engine (1712), Wright Flyer (1903), Sputnik (1957), Tesla Roadster (2008) |
| Journey Planner | Real routes: New York → London, Farm → Grocery Store supply chain, Amazon warehouse → your door |

---

## Appendix: Common Misconceptions Addressed

| Misconception | Primitive That Addresses It |
|---------------|----------------------------|
| "Wings push air down to create lift" (incomplete) | Airfoil Lab (shows pressure difference above/below) |
| "Heavier planes can't fly" | Flight Forces Explorer (more thrust + bigger wings compensate) |
| "Jet engines push against the air behind them" | Propulsion Lab (Newton's Third Law — rockets work in vacuum too) |
| "Bigger engines always mean faster" | Engine Explorer, Vehicle Comparison (efficiency matters more) |
| "Airplanes fly because of engine power alone" | Flight Forces (lift comes from wings, not engines; gliders prove it) |
| "All vehicles should be as fast as possible" | Journey Planner, Vehicle Design (trade-offs: speed vs cost vs capacity) |
| "Electric vehicles don't have engines" | Engine Explorer (electric motors ARE engines — different type) |
| "Boats float because they're light" | MachineProfile for ships (displacement/buoyancy — aircraft carriers float!) |
| "Helicopters fly like airplanes" | MachineProfile (rotary wing vs fixed wing — fundamentally different) |
| "Airplanes can fly because they're lighter than air" | Flight Forces, MachineProfile (a 747 weighs 178 tonnes — it's NOT lighter than air) |
| "All propulsion works the same way" | Propulsion Lab (many methods; each optimized for different medium) |
| "Streamlined means pointy" | Wind Tunnel (teardrop is optimal — smooth tail matters more than sharp nose) |

---

## Appendix: Gemini API Content Generation Guidelines

### Temperature & Model Settings

| Content Type | Temperature | Model | Rationale |
|-------------|-------------|-------|-----------|
| Machine profiles, vehicle specs | 0.2-0.4 | gemini-2.0-flash | Accuracy-critical real-world data |
| Challenges, scenarios, analogies | 0.6-0.8 | gemini-2.0-flash | Need variety and creativity |
| Engine cycles, force descriptions | 0.3-0.5 | gemini-2.0-flash | Balance accuracy with engagement |
| Complex schemas (design studio, journey) | 0.3-0.5 | gemini-2.0-pro | Schema adherence critical |

### Prompt Engineering Notes

1. **Accuracy Guardrail:** All vehicle specifications must be factually accurate. Include in prompts: "Use real-world specifications only. Do not fabricate vehicle stats. If unsure, use well-known public data."

2. **Kid-Friendly Analogies:** Every `analogy` and `funAnalogy` field should connect to everyday childhood experience: playground, kitchen, sports, school. Never assume kids have seen inside a real engine or airplane.

3. **Comparison Anchors:** Always include size/weight/speed comparisons to things kids know: school buses, basketball courts, running speed, swimming pools, elephants. This is critical for making large numbers meaningful.

4. **Image Prompt Quality:** `imagePrompt` fields should specify: subject, angle/perspective, style (photorealistic for real vehicles, illustrated for cross-sections), and key features to show. Example: "Cutaway view of a turbofan jet engine showing the fan, compressor, combustion chamber, and turbine sections, technical illustration style, labeled, clean white background."

5. **Misconception Surfacing:** Where schemas include `whatIfExperiments`, `whatIfScenarios`, or misconception-related content, prompt Gemini with: "Include the most common student misconception about this concept. Design the scenario to reveal and correct it."

---

## Open Questions

1. **3D Rendering Technology** — `flight-control-surfaces` and `cockpit-explorer` benefit from 3D airplane models. Options: (a) Three.js with lightweight models, (b) pre-rendered SVG views from multiple angles, (c) simplified CSS 3D transforms. Three.js adds bundle size; SVG limits interactivity. Needs spike.

2. **Aerodynamic Simulation Fidelity** — How accurate should `airfoil-lab` and `wind-tunnel-simulator` be? Options: (a) real panel method CFD (accurate but complex), (b) lookup table from NACA data (fast, limited shapes), (c) simplified analytical model (fast, customizable, approximate). Recommendation: NACA lookup tables for presets + simplified analytical for custom shapes.

3. **Vehicle Specification Database** — Multiple primitives need real vehicle data. Should this be: (a) embedded in each generator prompt, (b) a shared JSON data file, (c) a backend API endpoint? Shared JSON is simplest and avoids Gemini hallucinating specs.

4. **MachineProfile vs SpeciesProfile Architecture** — Should MachineProfile share a base component with SpeciesProfile (common ProfileCard), or be a separate implementation following the same pattern? Separate implementation is simpler and avoids coupling; shared base reduces code duplication. Recommend separate implementation initially.

5. **Existing Engineering Primitive Overlap** — `dump-truck-loader` and `excavator-arm-simulator` are construction vehicles that could also appear as MachineProfile entries. Should MachineProfile link to existing interactive primitives when available? (e.g., "Want to try driving this excavator? [Open Excavator Arm Simulator]")

6. **Paper Airplane Physical Counterpart** — `paper-airplane-designer` simulates flight digitally. Should the primitive include printable fold instructions so kids can build the real thing and compare to simulation? This would be a powerful engagement hook. Low-tech integration.

7. **Audio Design** — Should flight and engine primitives include ambient sound effects (engine noise, wind, cockpit alerts), or keep audio limited to TTS narration? Sound effects add immersion but increase bundle size and may distract. Suggest: optional, off by default, enabled per-primitive.

8. **Cross-Domain Primitive Linking** — Several connections exist (engine → gear train, flight forces → lever lab). Should the UI allow direct navigation from one primitive to a related one in another domain? This is a platform-level feature, not primitive-specific.