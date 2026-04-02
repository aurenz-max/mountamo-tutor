# Living Engineering Primitives PRD

## What Worked: The EngineExplorer Pattern

The EngineExplorer rewrite proved a repeatable formula for turning flat "illustrated textbook" primitives into genuinely educational simulations. The key principles:

| Principle | What it means | Why it matters |
|-----------|--------------|----------------|
| **The visual IS the explanation** | Particles piling up against a piston wall = pressure. No text needed. | Students build mental models from observation, not reading |
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

**Living version**: Canvas particle airflow simulation around a plane cross-section.
- **Visible physics**: Air particles flowing over/under wings. Faster flow above = lower pressure = visible lift. Thrust particles ejecting backward.
- **Force arrows driven by actual particle physics**, not slider values. The student adjusts angle of attack and thrust, and the force arrows EMERGE from what the particles do.
- **The plane actually moves**: climbs, descends, cruises, or stalls. Stalling is dramatic — particles detach from the wing surface, lift arrow shrinks, plane drops. Students see WHY stalling happens, not just that "angle > 15° = stall."
- **Controls**: Thrust slider (more thrust = more exhaust particles = bigger thrust arrow), Angle of attack slider (tilts the wing, changes airflow pattern), Cargo weight (adds downward force).
- **Challenges**: "Set the controls so the plane climbs." → "Now make it cruise at level flight." → "What happens at 20° angle of attack?" → "Can you save a stalling plane?"
- **What Gemini provides**: Aircraft descriptions, challenge questions, zone explanations. No physics.

**Hardcoded physics per aircraft type**: Light prop plane, commercial jet, glider, fighter jet. Each has different wing profile, weight, thrust range.

**Complexity**: MEDIUM — similar Canvas particle system to EngineExplorer, but airflow patterns instead of zone-based flow. ~900 lines.

---

#### 2. AirfoilLab → "Living Wind Tunnel"

**Current state**: SVG airfoil with streamline overlays. "Move slider, watch streamlines" doesn't build a mental model of pressure differential.

**Living version**: Canvas particle wind tunnel where pressure is VISIBLE.
- **Particles flow left-to-right** representing air. When they encounter the airfoil, they split above and below.
- **Particles above curve faster** (visible — they spread apart and speed up). **Particles below slow down** (visible — they bunch up).
- **Pressure = particle density**. Students can SEE that faster flow = fewer particles per area = lower pressure. This IS Bernoulli's principle made visible.
- **Lift emerges visually**: the pressure difference pushes the airfoil up. A force arrow grows proportional to the actual particle pressure differential.
- **Stall visualization**: At high angles, particles DETACH from the upper surface — turbulent swirling instead of smooth flow. Lift collapses. Visceral.
- **Comparison mode**: Two side-by-side wind tunnels with different airfoil shapes.
- **Controls**: Airfoil shape selector (flat plate, symmetric, cambered, thick), angle of attack, wind speed.
- **Challenges**: "Which shape produces more lift?" → "At what angle does the flat plate stall?" → "Design an airfoil that produces lift at low speed."

**Complexity**: MEDIUM-HIGH — particle splitting around a shape requires path-following logic. ~1000 lines.

---

#### 3. PropulsionLab → "Living Newton's Third Law"

**Current state**: HTML divs with icons. "What If" predictions are just yes/no without mechanism. Students can't see WHY rockets work in vacuum.

**Living version**: Canvas simulation showing action/reaction with visible particles.
- **Core mechanic**: A vehicle sits in a medium (air, water, vacuum). The propulsion system EJECTS particles backward. The vehicle moves forward. Newton's Third Law is visible.
- **Jet engine**: Sucks in air particles from front, burns them (color change), blasts them out the back faster. Vehicle accelerates.
- **Rocket in vacuum**: No air particles to suck in — rocket carries its own propellant particles. Ejects them backward. Works in vacuum because it doesn't need external air.
- **Propeller in water**: Pushes water particles backward. Water is denser (more particles) = more thrust per push.
- **Sail**: Wind particles hit the sail, bounce off, transfer momentum. Can't go faster than wind. Can't work in vacuum (no particles!).
- **The "aha"**: Set propeller in vacuum → no air particles to push → no thrust. Set rocket in vacuum → still ejects propellant → thrust! Students SEE the difference.
- **Controls**: Propulsion type selector, medium selector (air/water/vacuum), throttle.
- **Challenges**: "Can a propeller work in space?" → "Why does a rocket work in vacuum but a propeller doesn't?" → "Which propulsion creates the most thrust in water?"

**Complexity**: MEDIUM — simpler particle system than EngineExplorer (no mechanical linkage). ~700 lines.

---

### Priority 2: Needs better interaction, not necessarily particles

#### 4. FoundationBuilder → "Living Soil Pressure"

**Current state**: Select soil + footing → see if it sinks. One decision, binary outcome.

**Living version**: Canvas with visible soil particle compression.
- **Soil as particles**: Rock = tightly packed rigid particles. Sand = loosely packed shifting particles. Clay = deformable particles that squeeze. Mud = flowing particles.
- **Building weight visible**: The building presses down → soil particles compress → you can SEE when the soil can't take it (particles start flowing sideways = foundation failure).
- **Footing spreads the load**: A wider footing distributes particles' pressure over more area. The formula P = F/A becomes visible — same building on narrow footing crushes the soil, on wide footing the soil holds.
- **Controls**: Soil type, footing width, building stories (weight).
- **Multi-step**: Build a house on 3 different soils. Budget constraint on footing size.

**Complexity**: MEDIUM — Canvas particle grid with compression physics. ~800 lines.

---

#### 5. VehicleComparisonLab → "Transport Challenge"

**Current state**: Bar chart reading. "Which is faster?" is a lookup task.

**Better version**: Constraint-based decision game (doesn't need particles).
- **Scenario cards**: "Transport 200 people from London to Paris. Budget: $50K. Time limit: 5 hours. Environmental limit: 500kg CO₂."
- **Students pick a vehicle** and see if it meets ALL constraints. Multiple valid answers for some scenarios.
- **Trade-off visualization**: Radar chart showing how each vehicle performs across all constraint dimensions. Students see that no vehicle is best at everything.
- **Justification**: After picking, student explains why (MC + short answer). AI tutor challenges their reasoning.
- **Progressive difficulty**: Easy (one obvious answer) → medium (2 viable options, pick the better one) → hard (all options have trade-offs, must prioritize constraints).

**Complexity**: LOW — mostly UI redesign, not physics simulation. ~600 lines.

---

#### 6. ConstructionSequencePlanner → "Build It Right"

**Current state**: Drag-to-reorder with trial-and-error until arrows stop being red.

**Better version**: Visual build animation showing WHY order matters.
- **When you place a task in the wrong order**, show what happens: roof before walls → roof collapses (animated). Plumbing after drywall → tear down the wall (animated).
- **Time clock**: Tasks take simulated time. Parallel tasks show workers working simultaneously. Students discover that some tasks CAN run in parallel.
- **Critical path highlighted**: The longest chain of dependent tasks glows. Students learn "this is what determines how long the whole project takes."
- **Challenge**: "Can you build this house in under 20 weeks?" → requires finding parallel paths.

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

---

## Success Criteria

For each upgraded primitive, verify:
- [ ] Student can't "complete" without interacting with the simulation
- [ ] Controls produce visible, cascading consequences
- [ ] At least one failure state exists and is informative
- [ ] Challenges reference what's visible in the simulation ("watch the particles and answer")
- [ ] A parent and child can have a meaningful conversation about what they see
- [ ] 60fps on Chromebook with particle count at budget
