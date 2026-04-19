# Living Engineering Primitives PRD

## What Worked: The EngineExplorer Pattern

The EngineExplorer rewrite proved a repeatable formula for turning flat "illustrated textbook" primitives into genuinely educational simulations. The key principles:

| Principle | What it means | Why it matters |
|-----------|--------------|----------------|
| **The visual IS the explanation** | Particles piling up against a piston wall = pressure. No text needed. | Students build mental models from observation, not reading |
| **Direct manipulation first** | The student grabs the plane, steers the rocket, pushes the building onto soil. The simulation object IS the primary control. Sliders and levers set parameters (thrust magnitude, wind speed) — they never replace touching the thing itself. | Hands on the object = embodied learning. A "Launch" button is a spectator sport; dragging the rocket upward is an experience. |
| **Controls with consequences** | Fuel slider → particle speed → pressure → wheel RPM. Not decorative. | Cause-and-effect is the learning mechanism |
| **Failure is informative** | Engine stalls when overloaded. Bridge collapses. Plane stalls. | Failure creates cognitive conflict → the "aha" moment |
| **Component owns physics** | All geometry, particle behavior, and mechanical linkage hardcoded per variant. Gemini only provides educational text + challenge questions. | Gemini can't design physics. It hallucinates geometry like it hallucinates organic chemistry structures. |
| **One continuous experience** | No phase tabs for passive reading. Controls always available. Challenges appear when ready. | Mode switching breaks flow. Kids explore naturally. |
| **Prediction → observation cycle** | Challenges ask "what will happen?" BEFORE the student tries it. | This is the scientific method. Predict, test, revise. |

---

## Primitives to Upgrade

### Priority 1: High-impact, clear simulation path

#### 1. FlightForcesExplorer → "Living Flight"

**Current state**: SVG force arrows that resize when you move sliders. Trial-and-error until arrows match. No prediction step, no real physics consequence.

**Living version**: Canvas particle airflow simulation where **the student flies the plane**.
- **Direct manipulation**: The student drags the plane's nose up/down to change angle of attack and feels the consequences — tilt too steep and particles rip away from the wing, lift dies, the plane drops. Pull back gently and it climbs. The plane is the controller.
- **Visible physics**: Air particles flowing over/under wings. Faster flow above = lower pressure = visible lift. Thrust particles ejecting backward.
- **Force arrows driven by actual particle physics**, not slider values. The student tilts the plane, particles react, and the force arrows EMERGE from what the particles do.
- **The plane actually moves**: climbs, descends, cruises, or stalls. Stalling is dramatic — particles detach from the wing surface, lift arrow shrinks, plane drops. Students see WHY stalling happens because they caused it with their hands.
- **Parameter controls (sliders)**: Thrust magnitude (more thrust = more exhaust particles), Cargo weight (adds downward force). These set the conditions — the student's direct manipulation of the plane is the experience.
- **Challenges**: "Fly the plane to cruising altitude." → "Now level off without losing altitude." → "Tilt the nose — how steep can you go before stalling?" → "You're in a stall — recover!"
- **What Gemini provides**: Aircraft descriptions, challenge questions, zone explanations. No physics.

**Hardcoded physics per aircraft type**: Light prop plane, commercial jet, glider, fighter jet. Each has different wing profile, weight, thrust range.

**Complexity**: MEDIUM — similar Canvas particle system to EngineExplorer, but airflow patterns instead of zone-based flow. ~900 lines.

---

#### 2. AirfoilLab → "Living Wind Tunnel"

**Current state**: SVG airfoil with streamline overlays. "Move slider, watch streamlines" doesn't build a mental model of pressure differential.

**Living version**: Canvas particle wind tunnel where **the student sculpts and tilts the airfoil directly**.
- **Direct manipulation**: The student grabs the airfoil and rotates it to change angle of attack. Drag control points on the airfoil surface to reshape it — make it thicker, add camber, flatten it. The particles react in real-time to every adjustment. The airfoil is the interface.
- **Particles flow left-to-right** representing air. When they encounter the airfoil, they split above and below.
- **Particles above curve faster** (visible — they spread apart and speed up). **Particles below slow down** (visible — they bunch up).
- **Pressure = particle density**. Students can SEE that faster flow = fewer particles per area = lower pressure. This IS Bernoulli's principle made visible.
- **Lift emerges visually**: the pressure difference pushes the airfoil up. A force arrow grows proportional to the actual particle pressure differential.
- **Stall visualization**: At high angles, particles DETACH from the upper surface — turbulent swirling instead of smooth flow. Lift collapses. Visceral. The student caused it by tilting too far.
- **Comparison mode**: Two side-by-side wind tunnels with different airfoil shapes.
- **Parameter controls (sliders)**: Wind speed, airfoil shape presets (flat plate, symmetric, cambered, thick) as starting points for further sculpting.
- **Challenges**: "Reshape this flat plate to produce more lift." → "Tilt until it stalls — what do the particles do?" → "Design an airfoil that produces lift at low speed."

**Complexity**: MEDIUM-HIGH — particle splitting around a shape requires path-following logic. ~1000 lines.

---

#### 3. PropulsionLab → "Living Newton's Third Law"

**Current state**: HTML divs with icons. "What If" predictions are just yes/no without mechanism. Students can't see WHY rockets work in vacuum.

**Living version**: Canvas simulation where **the student directly controls the vehicle's thrust and direction**.
- **Direct manipulation**: The student drags the vehicle to aim it and controls throttle by touch/drag intensity — push harder, more propellant ejects, more thrust. In rocket mode, the student literally launches by dragging upward; the rocket follows their hand, ejecting particles downward. Release and it coasts (or falls). The vehicle responds to the student's hand, not a "Launch" button.
- **Core mechanic**: A vehicle sits in a medium (air, water, vacuum). The propulsion system EJECTS particles backward. The vehicle moves forward. Newton's Third Law is visible in the student's hands.
- **Jet engine**: Sucks in air particles from front, burns them (color change), blasts them out the back faster. Vehicle accelerates as the student pushes.
- **Rocket in vacuum**: No air particles to suck in — rocket carries its own propellant particles. Ejects them backward. Works in vacuum because it doesn't need external air. Student feels the difference when they switch mediums — same drag gesture, different response.
- **Propeller in water**: Pushes water particles backward. Water is denser (more particles) = more thrust per push.
- **Sail**: Wind particles hit the sail, bounce off, transfer momentum. Can't go faster than wind. Student tries to drag past wind speed — vehicle won't respond. Can't work in vacuum (no particles!).
- **The "aha"**: Student drags the propeller vehicle in vacuum → no air particles to push → it won't move no matter how hard they drag. Switch to rocket → same drag gesture → thrust! Students FEEL the difference in their hands.
- **Parameter controls (sliders)**: Propulsion type selector, medium selector (air/water/vacuum). These set the conditions. The student's direct manipulation provides the throttle and direction.
- **Challenges**: "Launch the rocket to orbit height." → "Try to move the propeller in space — why won't it go?" → "Which propulsion lets you go fastest in water?"

**Complexity**: MEDIUM — simpler particle system than EngineExplorer (no mechanical linkage). ~700 lines.

---

### Priority 2: Needs better interaction, not necessarily particles

#### 4. FoundationBuilder → "Living Soil Pressure"

**Current state**: Select soil + footing → see if it sinks. One decision, binary outcome.

**Living version**: Canvas with visible soil particle compression where **the student places and loads the building directly**.
- **Direct manipulation**: The student drags the building onto the soil and watches it sink or hold. They can stack floors onto the building by dragging them on — each floor adds visible weight, and the soil responds in real-time. Drag the footing edges wider or narrower and watch the pressure redistribute. The student is the construction crew, not a slider operator.
- **Soil as particles**: Rock = tightly packed rigid particles. Sand = loosely packed shifting particles. Clay = deformable particles that squeeze. Mud = flowing particles.
- **Building weight visible**: The student drops the building → soil particles compress → they SEE when the soil can't take it (particles start flowing sideways = foundation failure). Add another floor by dragging → it collapses.
- **Footing spreads the load**: Student drags footing edges wider → pressure redistributes visually over more area. The formula P = F/A becomes visible in their hands — same building on narrow footing crushes the soil, widen it and the soil holds.
- **Parameter controls (sliders)**: Soil type selector. The building placement, floor stacking, and footing sizing are all direct manipulation.
- **Multi-step**: Build a house on 3 different soils. Budget constraint on footing size.

**Complexity**: MEDIUM — Canvas particle grid with compression physics. ~800 lines.

---

#### 5. VehicleComparisonLab → "Transport Challenge"

**Current state**: Bar chart reading. "Which is faster?" is a lookup task.

**Better version**: Constraint-based decision game where **the student drags vehicles onto routes and loads them up**.
- **Direct manipulation**: A map with origin and destination. The student drags a vehicle onto the route and then drags passengers, cargo, and fuel onto it. Overload it → it won't make the trip (runs out of fuel, too slow). Constraints are felt through packing and route interaction, not read from a table.
- **Scenario cards**: "Transport 200 people from London to Paris. Budget: $50K. Time limit: 5 hours. Environmental limit: 500kg CO₂."
- **Students drag passengers onto the vehicle** — watch capacity fill up, cost tick up, CO₂ accumulate. Hit a constraint → visual warning, vehicle shakes, refuses more.
- **Trade-off visualization**: Radar chart showing how each vehicle performs across all constraint dimensions. Students see that no vehicle is best at everything.
- **Justification**: After picking, student explains why (MC + short answer). AI tutor challenges their reasoning.
- **Progressive difficulty**: Easy (one obvious answer) → medium (2 viable options, pick the better one) → hard (all options have trade-offs, must prioritize constraints).

**Complexity**: LOW — mostly UI redesign, not physics simulation. ~600 lines.

---

#### 6. ConstructionSequencePlanner → "Build It Right"

**Current state**: Drag-to-reorder with trial-and-error until arrows stop being red.

**Better version**: Visual build simulation where **the student physically places building elements in sequence**.
- **Direct manipulation**: The student drags construction elements (foundation, walls, roof, plumbing, wiring) onto the building site in whatever order they choose. Place roof before walls → the roof falls through (animated collapse). Place plumbing after drywall → watch workers tear down the wall to fit pipes. The student learns sequencing by building, not by reordering a list.
- **Time clock**: Tasks take simulated time. Drag two compatible tasks to the site simultaneously → workers work in parallel. Students discover that some tasks CAN run in parallel by trying it.
- **Critical path highlighted**: The longest chain of dependent tasks glows. Students learn "this is what determines how long the whole project takes."
- **Challenge**: "Build this house in under 20 weeks." → requires discovering which tasks can run in parallel by dragging them onto the site together.

**Complexity**: MEDIUM — Canvas timeline with animated consequences. ~800 lines.

---

## Implementation Order

| Phase | Primitive | Effort | Rationale |
|-------|-----------|--------|-----------|
| **1** | PropulsionLab | ~700 lines | Simplest particle system (no linkage), highest pedagogical gap (can't see WHY rockets work in vacuum) |
| **2** | FlightForcesExplorer | ~900 lines | Builds on particle airflow from PropulsionLab, dramatic stall visualization |
| **3** | AirfoilLab | ~1000 lines | Most complex particle system (flow splitting), but reuses airflow patterns from FlightForces |
| **4** | FoundationBuilder | ~800 lines | New domain (soil particles), but proven Canvas pattern |
| **5** | VehicleComparisonLab | ~600 lines | UI redesign, no physics simulation needed |
| **6** | ConstructionSequencePlanner | ~800 lines | Animation system, different from particle simulations |

**Total estimated**: ~4800 lines of component code + ~1500 lines of generator updates.

---

## Technical Pattern (Reusable)

Every "living" primitive follows this architecture:

```
Component File (~800-1000 lines):
├── Data interface (Gemini provides: text, challenges, descriptions)
├── Layout constants (hardcoded per variant: geometry, physics params)
├── Particle/Physics engine (Canvas sub-component, requestAnimationFrame)
├── Main component (controls, zone info, challenges, eval, AI hooks)
└── Export

Generator File (~200-300 lines):
├── Flat Gemini schema (strings, MC questions — NO geometry/physics)
├── Validation + reconstruction from flat fields
└── Fallback defaults
```

**Component owns**: All geometry, physics, drawing, mechanical linkage.
**Gemini owns**: Educational text, analogies, challenge questions, narration.

### Direct Manipulation Contract

Every living primitive must answer: **"What does the student touch?"** The answer is always the simulation object itself — the plane, the rocket, the building, the airfoil. Never a button that makes the thing go.

| Layer | What it is | Examples |
|-------|-----------|----------|
| **Primary interaction** | Direct manipulation of the simulation object on the canvas. Drag, rotate, push, place, reshape. This is the experience. | Drag the plane's nose to change angle of attack. Drag the rocket upward to launch. Drag floors onto the building. |
| **Parameter controls** | Sliders/selectors below the canvas that set conditions and constraints. These tune the world the student is interacting with. | Thrust magnitude, wind speed, soil type, medium (air/water/vacuum), cargo weight. |
| **Never** | Buttons that perform the core action for the student. No "Launch," "Fly," "Build," or "Test" buttons that replace touching the thing. | If you're tempted to add a "Launch" button, ask: "Can the student drag the rocket upward instead?" The answer is yes. |

---

## Success Criteria

For each upgraded primitive, verify:
- [ ] **The student touches the thing itself** — primary interaction is direct manipulation of the simulation object, not buttons/sliders that act on their behalf
- [ ] Student can't "complete" without interacting with the simulation
- [ ] Parameter sliders set conditions; the student's hands provide the action
- [ ] Controls produce visible, cascading consequences
- [ ] At least one failure state exists and is informative — caused by the student's direct manipulation
- [ ] Challenges reference what's visible in the simulation ("watch the particles and answer")
- [ ] A parent and child can have a meaningful conversation about what they see
- [ ] 60fps on Chromebook with particle count at budget
