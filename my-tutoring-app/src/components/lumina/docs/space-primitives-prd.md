# K-5 Space & Astronomy Visual Primitives
## Product Requirements Document

### Overview

This document defines interactive visual primitives for elementary space and astronomy education (grades K-5) within the Lumina platform. Rather than broad coverage, these primitives provide deep, layered experiences in core areas: the solar system, rockets and spaceflight, and what it means to be an astronaut. Each primitive scales from simple exploration (K-1) to quantitative reasoning (4-5).

### Design Principles

1. **Awe First**: Space inspires wonder—primitives should evoke the scale and beauty of the cosmos
2. **Deep Over Wide**: Fewer primitives with rich interaction layers beat many shallow ones
3. **Real Data**: Use actual planetary data, real rocket specs, genuine mission profiles
4. **Scale Challenges**: Help children grasp vastly different scales (planet vs moon vs person vs rocket)
5. **Active Exploration**: Students discover through manipulation, not just observation
6. **State Serialization**: All primitives must serialize state for problem authoring and student response capture

---

## Primitives by Domain

### 1. Solar System & Planets

#### 1.1 Solar System Explorer

**Description**: A dynamic, zoomable model of the solar system with accurate relative positions, sizes, and orbital periods. The central primitive for understanding our cosmic neighborhood—from the overview down to individual moons.

**Core Interactions**:
- Zoom from full solar system → planet → moons → surface
- Adjust time scale (watch orbits unfold)
- Click planets for detail panels
- Toggle between size-accurate and distance-accurate views
- Track specific objects over time
- Measure distances between bodies
- Compare any two objects side-by-side

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Planet names, order from sun, "our Earth" |
| 1 | Inner vs outer planets, relative sizes |
| 2 | Orbital paths, day/year concepts |
| 3 | Moons, rings, asteroid belt |
| 4 | Orbital periods, distance in AU |
| 5 | Gravity effects, Kepler's insights |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `visibleBodies` | array | Which planets/moons to show |
| `initialZoom` | enum | `system`, `inner`, `outer`, `planet`, `moon` |
| `focusBody` | string | Center view on specific object |
| `timeScale` | number | Simulation speed (1 = real-time) |
| `showOrbits` | boolean | Display orbital paths |
| `showLabels` | boolean | Display object names |
| `scaleMode` | enum | `size_accurate`, `distance_accurate`, `hybrid` |
| `showHabitableZone` | boolean | Highlight goldilocks zone |
| `dateTime` | datetime | Specific date to display positions |
| `showDistances` | boolean | Display AU measurements |
| `compareMode` | boolean | Enable side-by-side comparison |

**Data Requirements**:
- Accurate orbital elements for all planets
- Current positions calculable for any date
- Moon systems for major planets (at minimum: Earth's Moon, Jupiter's Galilean moons, Saturn's major moons)
- Dwarf planets (Pluto, Ceres, Eris) as optional objects
- Asteroid belt representation

---

#### 1.2 Planet Builder / Anatomy Viewer

**Description**: An interactive cross-section and surface explorer for planetary bodies. Students peel back layers to see internal structure, explore surface features, and understand what makes each world unique.

**Core Interactions**:
- Select any planet or major moon
- Peel/slice to reveal internal layers
- Tap layers for composition information
- Explore surface features (mountains, craters, storms)
- Compare internal structures across planets
- Adjust transparency of layers
- "Build" a planet by selecting core, mantle, crust, atmosphere

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Planets look different (colors, features) |
| 1 | Rocky vs gas giants basic distinction |
| 2 | Layers concept (core, surface, atmosphere) |
| 3 | Composition differences, why gas giants are big |
| 4 | Density, pressure, temperature gradients |
| 5 | Magnetic fields, geological activity |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `body` | enum | Planet or moon to examine |
| `viewMode` | enum | `surface`, `cross_section`, `layers`, `build` |
| `visibleLayers` | array | Which layers are shown |
| `interactiveSlice` | boolean | Allow student to cut |
| `showLabels` | boolean | Name the layers |
| `showData` | boolean | Display composition, temperature |
| `compareBody` | string | Second body for comparison |
| `buildMode` | boolean | Construct planet from components |
| `showMagneticField` | boolean | Visualize field lines |
| `showAtmosphere` | boolean | Display atmospheric layers |

**Planet Data Required**:
| Planet | Key Features |
|--------|--------------|
| Mercury | Large iron core, cratered surface, no atmosphere |
| Venus | Thick CO2 atmosphere, volcanic surface, runaway greenhouse |
| Earth | Iron core, mantle convection, liquid water, life |
| Mars | Small core, iron oxide surface, thin atmosphere, polar ice |
| Jupiter | No solid surface, metallic hydrogen, Great Red Spot, 4 major moons |
| Saturn | Lowest density, spectacular rings, hexagonal pole storm |
| Uranus | Tilted axis, ice giant, faint rings |
| Neptune | Strongest winds, deep blue, ice giant |

---

#### 1.3 Scale Comparator

**Description**: A dedicated tool for grappling with the mind-bending scales of space. Compare sizes, distances, and times using familiar references—because "Jupiter is 11 times wider than Earth" means little without visceral understanding.

**Core Interactions**:
- Select two objects to compare
- View side-by-side at true scale
- Add familiar objects for reference (car, house, city)
- Switch between size, distance, and time comparisons
- Create scale models ("if the Sun were a basketball...")
- Walk/fly through scaled distances

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Big and small, Earth vs Moon |
| 1 | Planet sizes relative to Earth |
| 2 | Sun is MUCH bigger than planets |
| 3 | Distances are MUCH bigger than sizes |
| 4 | Scale model calculations |
| 5 | Light-travel time, AU as unit |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `compareType` | enum | `size`, `distance`, `mass`, `time` |
| `objects` | array | Objects to compare (2+) |
| `referenceObjects` | array | Familiar items for scale |
| `scaleModelBase` | object | "If X were Y size..." |
| `showRatios` | boolean | Display numeric comparisons |
| `showFamiliarEquivalent` | boolean | "That's like X football fields" |
| `interactiveWalk` | boolean | Move through scaled space |
| `units` | enum | `km`, `miles`, `AU`, `light_seconds` |

**Reference Object Library**:
| Object | Size | Use For |
|--------|------|---------|
| Basketball | 24 cm | Scaled Sun |
| Marble | 1.5 cm | Scaled Earth (with basketball Sun) |
| Pinhead | 1 mm | Scaled Moon |
| Football field | 100 m | Distance reference |
| School bus | 12 m | Size reference |
| Your town | varies | Local reference |
| Airplane flight | varies | Distance reference |

---

#### 1.4 Day/Night & Seasons Simulator

**Description**: An interactive model showing how Earth's rotation creates day/night and how its tilted orbit creates seasons. Critical for correcting the common misconception that seasons come from distance to Sun.

**Core Interactions**:
- Spin Earth to see day/night terminator move
- Position Earth at different points in orbit
- Observe how tilt affects sunlight angle
- Place markers at different latitudes
- Track hours of daylight at locations
- View from space or from surface perspective

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Day and night happen because Earth spins |
| 1 | Sun doesn't move—we do |
| 2 | Seasons exist, related to Earth's path |
| 3 | Tilt causes seasons (not distance) |
| 4 | Hemisphere differences, equinox/solstice |
| 5 | Latitude effects, arctic circle phenomena |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `viewPerspective` | enum | `space_north`, `space_side`, `surface`, `sun_view` |
| `earthPosition` | enum | `march_equinox`, `june_solstice`, `sept_equinox`, `dec_solstice`, `custom` |
| `showTiltAxis` | boolean | Display Earth's axial tilt |
| `showSunRays` | boolean | Display parallel light rays |
| `showTerminator` | boolean | Highlight day/night boundary |
| `markerLatitudes` | array | Locations to track |
| `showDaylightHours` | boolean | Display hours of light |
| `animationMode` | enum | `rotation`, `orbit`, `both` |
| `timeSpeed` | number | Animation speed |
| `showTemperatureZones` | boolean | Display climate bands |

---

#### 1.5 Moon Phases Lab

**Description**: An interactive model of the Earth-Moon-Sun system that explains why the Moon appears to change shape. Students can view from Earth, from space, and manipulate the geometry.

**Core Interactions**:
- Position Moon in orbit around Earth
- View Moon from Earth's surface
- View system from space (top-down)
- Match phase to orbital position
- Predict next phase in sequence
- Track full cycle over simulated month
- Understand why same side always faces us

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Moon looks different on different nights |
| 1 | Moon phase names, sequence |
| 2 | Moon goes around Earth |
| 3 | Phase is about geometry—light angle |
| 4 | Predicting phases, cycle length |
| 5 | Tidal locking, lunar eclipses |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `viewMode` | enum | `from_earth`, `from_space`, `split_view` |
| `moonPosition` | number | Degrees around orbit (0-360) |
| `showSunDirection` | boolean | Indicate where light comes from |
| `showOrbit` | boolean | Display Moon's orbital path |
| `phaseLabels` | boolean | Show phase names |
| `interactivePosition` | boolean | Student can move Moon |
| `animateOrbit` | boolean | Watch cycle unfold |
| `cycleSpeed` | number | Days per second |
| `showEarthView` | boolean | Inset of Moon from surface |
| `showTidalLocking` | boolean | Explain same-side-facing |

---

### 2. Rockets & Spaceflight

#### 2.1 Rocket Builder

**Description**: A comprehensive rocket design and simulation tool where students assemble rockets from components, balance thrust and weight, and launch to see if their designs reach space. The flagship spaceflight primitive.

**Core Interactions**:
- Select rocket stages and components
- Stack stages vertically
- Choose engine types and fuel amounts
- Adjust payload (what we're launching)
- Check thrust-to-weight ratio
- Launch and watch flight profile
- See staging events during flight
- Analyze why designs succeed or fail

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Rockets go up, have parts |
| 1 | Engines push, fuel gets used up |
| 2 | Heavier rockets need more thrust |
| 3 | Staging—dropping empty parts helps |
| 4 | Thrust-to-weight ratio, fuel efficiency |
| 5 | Delta-v budgets, orbit insertion |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `availableComponents` | array | Parts student can use |
| `maxStages` | number | Maximum stage count (1-5) |
| `targetAltitude` | number | Goal height to reach |
| `targetOrbit` | boolean | Must achieve stable orbit |
| `showTWR` | boolean | Display thrust-to-weight |
| `showFuelGauge` | boolean | Display remaining fuel |
| `showForces` | boolean | Display thrust, drag, gravity vectors |
| `atmosphereModel` | enum | `simple`, `realistic` |
| `guidedMode` | boolean | Suggestions for improvement |
| `budget` | number | Optional cost constraint |
| `simulationSpeed` | number | Time compression |

**Component Library**:
| Component | Properties |
|-----------|------------|
| `capsule_small` | 1 crew, 500 kg |
| `capsule_medium` | 3 crew, 2000 kg |
| `fuel_tank_small` | 1000 kg propellant |
| `fuel_tank_medium` | 5000 kg propellant |
| `fuel_tank_large` | 20000 kg propellant |
| `engine_small` | 50 kN thrust, low efficiency |
| `engine_medium` | 200 kN thrust, medium efficiency |
| `engine_large` | 1000 kN thrust, high efficiency |
| `booster_solid` | Fixed thrust, simple, cheap |
| `fins` | Stability during atmospheric flight |
| `fairing` | Protect payload, reduce drag |
| `satellite` | Payload, various masses |

---

#### 2.2 Launch Sequencer

**Description**: A mission control experience where students manage the countdown, monitor systems, and make go/no-go decisions. Emphasizes that spaceflight is a careful process with many checks.

**Core Interactions**:
- Follow countdown checklist
- Monitor system status indicators
- Make go/no-go calls at hold points
- Respond to anomalies (weather, technical)
- Execute launch sequence
- Track rocket through ascent
- Celebrate successful insertion (or analyze failures)

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Countdown sequence, anticipation |
| 1 | Different systems must all work |
| 2 | Weather affects launches |
| 3 | Go/no-go decisions, safety first |
| 4 | System dependencies, critical path |
| 5 | Abort modes, contingency planning |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `missionType` | enum | `satellite`, `crew`, `cargo`, `probe` |
| `countdownLength` | enum | `short`, `medium`, `realistic` |
| `anomalyChance` | number | Probability of issues |
| `anomalyTypes` | array | Possible problems to encounter |
| `showSystems` | array | Which systems to monitor |
| `holdPoints` | array | Countdown holds for checks |
| `weatherEnabled` | boolean | Include weather factor |
| `guidedMode` | boolean | Hints for decisions |
| `realTimeClock` | boolean | Actual countdown timing |

**System Monitors**:
| System | What to Check |
|--------|---------------|
| `propulsion` | Engine status, fuel pressure |
| `electrical` | Power levels, battery charge |
| `guidance` | Navigation system lock |
| `life_support` | If crewed, O2 and pressure |
| `weather` | Wind, clouds, lightning |
| `range_safety` | Tracking, destruct system |
| `ground_support` | Umbilicals, pad clear |

---

#### 2.3 Orbit Mechanics Lab

**Description**: An interactive orbital mechanics sandbox where students learn that orbiting is falling while moving sideways, and how to change orbits with carefully timed burns.

**Core Interactions**:
- Launch object at different speeds and angles
- Observe resulting orbit (or crash)
- Add velocity at different points
- Watch how burns change orbit shape
- Raise/lower orbit with prograde/retrograde burns
- Plan transfers between orbits
- Rendezvous with target object

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Things can go around and around |
| 1 | Satellites don't fall because they're fast |
| 2 | Different orbits—high, low, around equator |
| 3 | Orbit shape depends on speed |
| 4 | Changing orbits with burns |
| 5 | Hohmann transfers, orbital rendezvous |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `centralBody` | enum | `earth`, `moon`, `mars`, `sun` |
| `initialOrbit` | object | Starting position and velocity |
| `showOrbitPath` | boolean | Display projected trajectory |
| `showVelocityVector` | boolean | Display speed and direction |
| `allowBurns` | boolean | Student can add velocity |
| `burnMode` | enum | `direction_picker`, `prograde_retrograde`, `manual` |
| `targetOrbit` | object | Goal orbit parameters |
| `targetObject` | object | Rendezvous target |
| `showApogeePerigee` | boolean | Mark high and low points |
| `showOrbitalPeriod` | boolean | Display time per orbit |
| `gravityVisualization` | enum | `none`, `field_lines`, `well` |

---

#### 2.4 Mission Planner

**Description**: A simplified mission design tool where students plan trips to the Moon, Mars, and beyond. Covers launch windows, travel times, and what you need to bring.

**Core Interactions**:
- Select destination
- Choose launch window
- Plan trajectory (direct vs gravity assist)
- Pack supplies for crew (if crewed)
- Estimate travel time
- Calculate fuel requirements
- Monitor mission progress

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | We can visit other places in space |
| 1 | Different places take different times |
| 2 | Need to bring supplies |
| 3 | Launch windows—can't go anytime |
| 4 | Gravity assists—getting help from planets |
| 5 | Trade-offs: speed vs fuel vs payload |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `destination` | enum | `moon`, `mars`, `venus`, `jupiter`, `asteroid` |
| `missionType` | enum | `flyby`, `orbit`, `landing`, `return` |
| `crewed` | boolean | Human or robotic |
| `showLaunchWindows` | boolean | Display optimal dates |
| `showTrajectory` | boolean | Display flight path |
| `supplyCalculator` | boolean | Pack food, water, O2 |
| `gravityAssistOption` | boolean | Allow planetary assists |
| `fuelConstraint` | number | Available propellant |
| `missionClock` | boolean | Track elapsed time |

---

#### 2.5 Rocket Science Explainer

**Description**: An interactive visualization of the core physics of rocketry—Newton's Third Law, exhaust velocity, and why rockets work in vacuum. Addresses the common question "what do rockets push against in space?"

**Core Interactions**:
- Fire rocket engine and see exhaust
- Measure thrust force and exhaust velocity
- Understand momentum conservation
- Compare engines in atmosphere vs vacuum
- Experiment with exhaust direction
- See why more exhaust = less efficiency

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Push one way, go the other |
| 1 | Balloon rocket demonstration |
| 2 | Rockets don't push against air |
| 3 | Action-reaction with numbers |
| 4 | Exhaust velocity matters |
| 5 | Specific impulse, efficiency |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `demonstrationMode` | enum | `balloon`, `rocket`, `physics_vectors` |
| `showMomentumArrows` | boolean | Display p=mv vectors |
| `showExhaustParticles` | boolean | Visualize exhaust mass |
| `environmentType` | enum | `atmosphere`, `vacuum`, `toggle` |
| `engineType` | enum | `chemical`, `ion`, `comparison` |
| `showMath` | boolean | Display equations |
| `interactiveExhaust` | boolean | Adjust exhaust parameters |
| `showThrustEquation` | boolean | F = ṁv |

---

### 3. Being an Astronaut

#### 3.1 Spacesuit Designer

**Description**: An interactive exploration of what spacesuits do and why they're designed the way they are. Students "build" a suit by selecting components that address specific hazards.

**Core Interactions**:
- Learn about space hazards (vacuum, temperature, radiation)
- Select suit components to address each hazard
- See what happens without each component
- Balance mobility vs protection
- Compare different suit designs (Apollo, shuttle, modern)
- Design suit for different environments (Moon, Mars, station)

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Space is dangerous, suits protect us |
| 1 | No air, too hot/cold, astronauts need help |
| 2 | Different parts of suit do different things |
| 3 | Trade-offs: more protection = harder to move |
| 4 | Life support systems, consumables |
| 5 | Suit design for specific missions |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `designMode` | enum | `guided`, `freeform`, `compare` |
| `environment` | enum | `leo`, `moon`, `mars`, `deep_space` |
| `showHazards` | boolean | Display environmental dangers |
| `showSystems` | array | Which suit systems to explore |
| `historicalSuits` | boolean | Compare real suit designs |
| `showVitals` | boolean | Display astronaut health |
| `failureMode` | boolean | Show what happens if system fails |
| `missionDuration` | number | How long EVA lasts |

**Suit Systems**:
| System | Hazard Addressed |
|--------|------------------|
| `pressure_layer` | Vacuum—keeps air around body |
| `thermal_control` | Temperature extremes |
| `micrometeorite_layer` | High-speed particles |
| `radiation_protection` | Cosmic rays, solar particles |
| `oxygen_supply` | No breathable air |
| `co2_scrubber` | Exhaled CO2 buildup |
| `cooling_system` | Body heat in vacuum |
| `communications` | Can't hear in vacuum |
| `mobility_joints` | Need to move and work |
| `helmet_visor` | Sun glare, protection |

---

#### 3.2 Space Station Life Simulator

**Description**: A day-in-the-life experience of living on a space station. Students manage schedules, handle microgravity challenges, and understand how basic tasks change in space.

**Core Interactions**:
- Plan daily schedule (work, exercise, meals, sleep)
- Experience microgravity effects on activities
- Manage consumables (food, water, air)
- Handle equipment maintenance
- Communicate with ground control
- Deal with emergencies

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Living in space is different |
| 1 | Floating, eating, sleeping in space |
| 2 | Exercise is required, everything floats |
| 3 | Station systems, resource management |
| 4 | Scheduling, teamwork, communication delay |
| 5 | Long-duration effects, psychology |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `simulationLength` | enum | `hour`, `day`, `week` |
| `stationModel` | enum | `iss`, `future`, `simplified` |
| `crewSize` | number | Astronauts to manage |
| `showPhysicsEffects` | boolean | Microgravity demonstrations |
| `resourceManagement` | boolean | Track consumables |
| `emergencyEvents` | boolean | Include drills/problems |
| `communicationDelay` | number | Ground contact delay |
| `activityLibrary` | array | Available tasks |

**Activities**:
| Activity | Microgravity Challenge |
|----------|------------------------|
| `eating` | Food floats, liquids form spheres |
| `sleeping` | No up/down, strap into bag |
| `exercise` | Must exercise 2hr/day, special equipment |
| `hygiene` | No showers, water doesn't fall |
| `work` | Tools float away, anchor yourself |
| `communication` | Time delay to Earth |

---

#### 3.3 EVA (Spacewalk) Planner

**Description**: A mission planning and execution tool for extravehicular activity. Students plan tasks, manage limited resources, and execute spacewalk objectives.

**Core Interactions**:
- Review EVA objectives
- Plan task sequence
- Check suit consumables
- Execute EVA with time pressure
- Handle tool management (tethered tools)
- Navigate to work sites
- Complete objectives before resources run out

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Astronauts work outside in space |
| 1 | Need to be connected, tools tethered |
| 2 | Plan before you go, limited time |
| 3 | Task sequencing, efficiency |
| 4 | Consumable management, margins |
| 5 | Contingency planning, teamwork |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `missionObjectives` | array | Tasks to complete |
| `evaDuration` | number | Available time (hours) |
| `suitConsumables` | object | O2, power, CO2 capacity |
| `worksites` | array | Locations on station |
| `toolKit` | array | Available tools |
| `showTimer` | boolean | Display remaining time |
| `showConsumables` | boolean | Display suit resources |
| `partnerAstronaut` | boolean | Two-person EVA |
| `emergencyScenarios` | boolean | Include contingencies |

---

#### 3.4 Gravity Comparison Lab

**Description**: An interactive simulation showing how weight and motion change on different worlds. Students experience (through simulation) what it would feel like to jump, drop objects, and move on the Moon, Mars, and other bodies.

**Core Interactions**:
- Select planetary body
- Drop objects and time their fall
- Simulate jumping—see height achieved
- Throw objects and observe trajectories
- Compare same actions across worlds
- Calculate weight on different bodies
- Experience what astronauts feel

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | You'd weigh different amounts on different planets |
| 1 | Moon jumps are high, Jupiter is hard |
| 2 | Gravity is pulling—stronger on some worlds |
| 3 | Weight vs mass distinction |
| 4 | g-values, calculating weight |
| 5 | Orbital mechanics connection, surface gravity formula |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `bodies` | array | Worlds to compare |
| `activityType` | enum | `drop`, `jump`, `throw`, `all` |
| `showGValue` | boolean | Display surface gravity |
| `showWeight` | boolean | Display weight in N or lbs |
| `showFlightTime` | boolean | Display time in air |
| `showHeight` | boolean | Display jump/throw height |
| `inputMass` | number | Object or person mass |
| `splitScreen` | boolean | Compare side-by-side |
| `slowMotion` | boolean | See details of motion |

**Surface Gravity Data**:
| Body | g (m/s²) | g (Earth = 1) |
|------|----------|---------------|
| Sun | 274 | 28.0 |
| Mercury | 3.7 | 0.38 |
| Venus | 8.9 | 0.91 |
| Earth | 9.8 | 1.00 |
| Moon | 1.6 | 0.17 |
| Mars | 3.7 | 0.38 |
| Jupiter | 24.8 | 2.53 |
| Saturn | 10.4 | 1.07 |
| Uranus | 8.7 | 0.89 |
| Neptune | 11.2 | 1.14 |

---

### 4. Observation & Discovery

#### 4.1 Telescope Simulator

**Description**: A virtual telescope experience where students explore the night sky, find objects, and understand how astronomers work. Connects classroom learning to real sky observation.

**Core Interactions**:
- Point telescope at sky region
- Adjust magnification
- Find specific objects (Moon, planets, stars)
- Observe over time (see motion)
- Switch between viewing modes (visible, infrared)
- Log observations in journal
- Compare to real telescope images

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | We can see space with telescopes |
| 1 | Moon craters, planets are disks |
| 2 | Finding things in the sky |
| 3 | Different telescopes see different things |
| 4 | Systematic observation, logging |
| 5 | Professional astronomy techniques |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `skyDate` | datetime | Date and time for sky |
| `location` | coordinates | Observer location |
| `telescopeType` | enum | `binoculars`, `small`, `large`, `space` |
| `magnification` | number | Zoom level |
| `viewMode` | enum | `visible`, `infrared`, `radio` |
| `showLabels` | boolean | Identify objects |
| `showGrid` | boolean | Display coordinates |
| `targetObjects` | array | Objects to find |
| `journalMode` | boolean | Record observations |
| `realImageComparison` | boolean | Show actual photos |

---

#### 4.2 Star Life Cycle Visualizer

**Description**: An interactive journey through the life of stars—from nebula birth to white dwarf, neutron star, or black hole death. Students see how our Sun will evolve and how heavy elements form.

**Core Interactions**:
- Watch star form from nebula
- Adjust initial star mass
- See main sequence lifetime
- Observe end-of-life evolution
- Compare different mass outcomes
- Track element creation
- Explore stellar remnants

**Learning Progression**:
| Grade | Focus |
|-------|-------|
| K | Stars are born and can die |
| 1 | Our Sun is a star, will last long time |
| 2 | Stars come from clouds, return to clouds |
| 3 | Bigger stars have shorter lives |
| 4 | Element creation in stars |
| 5 | Stellar remnants, black holes |

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `starMass` | number | Initial mass in solar masses |
| `showTimeline` | boolean | Display time scale |
| `showComposition` | boolean | Display element makeup |
| `animationSpeed` | number | Time compression |
| `interactiveMass` | boolean | Student adjusts mass |
| `compareStars` | boolean | Multiple stars side-by-side |
| `showOurSun` | boolean | Highlight Sun's path |
| `showEndState` | boolean | Display final form |
| `elementTracker` | boolean | Show element creation |

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

Space primitives require specialized computation:

- **Orbital Mechanics**: Kepler equation solving, numerical integration for complex orbits
- **N-Body**: Simplified n-body for multi-object systems
- **Realistic Data**: JPL ephemeris data for accurate planetary positions
- **Physics**: Accurate gravity, thrust, and trajectory calculations

Performance targets:
- Orbital calculation: < 10ms per step
- Position lookup: < 5ms for any date
- Animation: 60fps for smooth planetary motion

### Accessibility Requirements

Each primitive must support:
- Full keyboard navigation
- Screen reader descriptions of celestial positions and states
- High contrast mode for space visualizations
- Reduced motion mode
- Touch and pointer input
- Minimum touch target size (44x44px)

### Performance Requirements

- Initial render: < 150ms (space scenes have more assets)
- State update: < 16ms (60fps interactions)
- Orbital simulation: < 10ms per step
- Serialization: < 50ms
- Maximum bundle size per primitive: 100KB gzipped (larger for 3D assets)

### Data Requirements

- Planetary ephemeris data (JPL Horizons or equivalent)
- Accurate physical constants (masses, radii, orbital elements)
- High-quality imagery for planet textures
- Real mission data where appropriate

---

## Implementation Priority

### Phase 1: Solar System Foundation
1. Solar System Explorer
2. Planet Builder / Anatomy Viewer
3. Scale Comparator

### Phase 2: Earth-Moon System
4. Day/Night & Seasons Simulator
5. Moon Phases Lab

### Phase 3: Rocketry
6. Rocket Builder
7. Rocket Science Explainer
8. Launch Sequencer

### Phase 4: Orbital Mechanics
9. Orbit Mechanics Lab
10. Mission Planner

### Phase 5: Astronaut Experience
11. Gravity Comparison Lab
12. Spacesuit Designer
13. Space Station Life Simulator
14. EVA Planner

### Phase 6: Advanced Astronomy
15. Telescope Simulator
16. Star Life Cycle Visualizer

---

## Appendix: Grade-Level Mapping

| Grade | Primary Primitives |
|-------|-------------------|
| K | Solar System Explorer (names), Scale Comparator (big/small), Gravity Lab (jumping), Day/Night (basic) |
| 1 | Planet Anatomy (rocky vs gas), Moon Phases (shapes), Rocket Science (push/pull), Spacesuit (dangers) |
| 2 | Solar System (orbits), Moon Phases (geometry), Rocket Builder (basic), Station Life (daily routines) |
| 3 | Planet Anatomy (layers), Seasons Simulator (tilt), Rocket Builder (staging), EVA Planner (basic) |
| 4 | Scale Comparator (distances), Orbit Lab (burns), Mission Planner (supplies), Star Cycle (mass effects) |
| 5 | Full Orbit Mechanics, Full Mission Planner, Telescope Simulator, Complete Rocket Builder |

---

## Appendix: NGSS Alignment

| Standard | Supporting Primitives |
|----------|----------------------|
| 1-ESS1-1 (Sun, Moon, stars patterns) | Day/Night Simulator, Moon Phases Lab |
| 1-ESS1-2 (Sunrise/sunset predictable) | Day/Night Simulator |
| 3-PS2-1 (Forces cause motion) | Rocket Science Explainer, Gravity Lab |
| 5-ESS1-1 (Sun star, distances) | Solar System Explorer, Scale Comparator |
| 5-ESS1-2 (Daily/seasonal changes) | Day/Night & Seasons Simulator |
| 5-PS2-1 (Gravity force) | Gravity Lab, Orbit Mechanics |
| MS-ESS1-1 (Earth-Sun-Moon system) | Moon Phases, Seasons, Scale Comparator |
| MS-ESS1-2 (Earth's place in universe) | Solar System Explorer, Star Cycle |
| MS-ESS1-3 (Scale of solar system) | Scale Comparator, Solar System Explorer |

---

## Appendix: Space Vocabulary by Grade

| Grade | Key Terms |
|-------|-----------|
| K | planet, star, sun, moon, rocket, astronaut, space, Earth |
| 1 | orbit, rotate, gravity, launch, fuel, engine, crater, atmosphere |
| 2 | solar system, satellite, space station, phase, axis, telescope |
| 3 | thrust, payload, stage, orbit, mass, weight, core, mantle, revolution |
| 4 | trajectory, delta-v, gravity assist, AU, light-year, EVA, consumable |
| 5 | orbital mechanics, Hohmann transfer, specific impulse, ephemeris, apogee, perigee |

---

## Appendix: Real Mission Integration

Where possible, primitives should connect to real space exploration:

| Primitive | Real Mission Connections |
|-----------|-------------------------|
| Rocket Builder | Saturn V, Falcon 9, SLS comparisons |
| Mission Planner | Apollo trajectories, Mars missions |
| Solar System Explorer | Current spacecraft positions (Voyager, JWST) |
| Space Station Life | ISS daily schedule, real astronaut experiences |
| Telescope Simulator | Hubble/JWST imagery comparison |
| Moon Phases | Apollo landing sites visible |
| Orbit Lab | Real satellite orbits (ISS, GPS) |

---

## Appendix: Common Misconceptions Addressed

| Misconception | Primitive That Addresses It |
|---------------|----------------------------|
| "Seasons are caused by Earth's distance from Sun" | Day/Night & Seasons Simulator |
| "Rockets push against air" | Rocket Science Explainer |
| "There's no gravity in space" | Orbit Mechanics Lab, Gravity Lab |
| "The Moon makes its own light" | Moon Phases Lab |
| "The dark side of the Moon is always dark" | Moon Phases Lab |
| "Astronauts are weightless because there's no gravity" | Space Station Life, Orbit Lab |
| "Space is close—you could drive there in a few hours" | Scale Comparator |
| "All planets are similar to Earth" | Planet Anatomy, Solar System Explorer |
