# K-5 Physics Visual Primitives
## Product Requirements Document

### Overview

This document defines interactive visual primitives for elementary physics education (grades K-5) within the Lumina platform. These primitives make physics concepts tangible through everyday experiences—playgrounds, toys, kitchens, and nature—building intuition before formalism.

This document complements the existing Physics Education Visual Primitives PRD (middle school through AP/college) by providing foundational experiences that prepare students for more advanced study.

### Design Principles

1. **Wonder First**: Begin with "Wow, look at that!" before "Here's why"
2. **Everyday Contexts**: Problems feature playgrounds, toys, kitchens, and nature—not laboratories
3. **Body-Based Learning**: Connect to physical experiences children already have (pushing swings, throwing balls, feeling warmth)
4. **Progressive Revelation**: Simple "play" modes for K-1, scientific vocabulary gradually introduced for grades 2-5
5. **Prediction & Testing**: Always ask "What do you think will happen?" before showing results
6. **Safe Failure**: Experiments that "don't work" teach as much as successes
7. **Cross-Curricular Integration**: Connect to math (counting, measuring, patterns), literacy (describing observations), and art (light, color, sound)
8. **State Serialization**: All primitives must serialize state for problem authoring and student response capture

### Relationship to Advanced Physics Primitives

Each K-5 primitive is designed as a stepping stone to middle school and beyond:

| K-5 Primitive | Bridges To (MS+) |
|---------------|------------------|
| Race Track Lab | Motion Diagrams, Position-Time Graphs |
| Push & Pull Arena | Free Body Diagrams, Newton's Laws |
| Roller Coaster Designer | Energy Bar Charts, Conservation of Energy |
| Bouncy Ball Lab | Collision Simulator, Energy Loss |
| Musical Instrument Builder | Wave on String, Standing Waves |
| Shadow Theater | Ray Optics Workbench |
| Magnet Explorer | Magnetic Field Visualizer |
| Circuit Sandbox | DC Circuit Builder |
| Sink or Float Lab | Fluid Pressure, Buoyancy |

---

## Primitives by Domain

### 1. Motion & Movement

#### 1.1 Race Track Lab

**Description**: A colorful race track where students control toy cars, animals, or characters moving at different speeds. Students develop intuitive understanding of speed, distance, and time through racing and observation.

**Core Interactions**:
- Choose racers (cars, animals, characters)
- Set speed for each racer (slow, medium, fast)
- Watch race unfold with clear visual motion
- Predict winner before race starts
- See "snapshots" showing positions over time
- Count grid squares traveled
- Compare "who went farther in the same time"

**Use Cases**:
- Fast vs slow concept (K)
- Predicting race outcomes (K-1)
- Farther in same time = faster (1-2)
- Measuring distance traveled (2-3)
- Introduction to speed = distance ÷ time (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `trackLength` | number | Length of track in grid units |
| `numRacers` | number | How many racers (1-4) |
| `racerTypes` | array | Available racer icons |
| `speedControl` | enum | `simple` (slow/fast), `slider`, `numeric` |
| `showSnapshots` | boolean | Display position markers over time |
| `showGrid` | boolean | Display distance grid |
| `showTimer` | boolean | Display elapsed time |
| `predictMode` | boolean | Require prediction before race |
| `theme` | enum | `cars`, `animals`, `runners`, `space` |

---

#### 1.2 Push & Pull Arena

**Description**: An interactive arena where students push and pull objects of different sizes. Students discover that bigger pushes make things move faster, and heavier things need bigger pushes.

**Core Interactions**:
- Select objects of different sizes/weights
- Apply push or pull with adjustable strength
- Watch object respond (move, barely move, or not move)
- Add multiple pushes in same or opposite directions
- Observe friction effects on different surfaces
- Feel the "effort" through visual feedback

**Use Cases**:
- Push makes things move, pull brings them (K)
- Bigger push = faster movement (K-1)
- Heavy things need bigger pushes (1-2)
- Opposite pushes can cancel out (2-3)
- Introduction to force arrows (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `objects` | array | Available objects with weights |
| `surfaces` | array | Surface types (ice, wood, carpet, grass) |
| `pushControl` | enum | `tap`, `hold`, `slider` |
| `showForceArrows` | boolean | Display push/pull arrows |
| `showStrength` | boolean | Display push strength indicator |
| `allowOpposingForces` | boolean | Multiple simultaneous pushes |
| `frictionVisible` | boolean | Show friction indicator |
| `theme` | enum | `playground`, `toys`, `sports`, `animals` |

---

#### 1.3 Playground Physics

**Description**: A virtual playground with swings, slides, merry-go-rounds, and seesaws. Students explore motion concepts through familiar play equipment they've experienced physically.

**Core Interactions**:
- Push swing and observe motion
- Adjust swing height/length
- Slide down slides of different angles
- Spin merry-go-round at different speeds
- Balance seesaw with different "riders"
- Time swings and spins
- Compare equipment behaviors

**Use Cases**:
- Swings go back and forth (K)
- Higher start = faster at bottom (K-1)
- Longer swings are slower (2-3)
- Timing swing patterns (3-4)
- Period depends on length, not weight (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `equipment` | array | Which playground items to include |
| `swingLength` | number | Adjustable swing chain length |
| `slideAngle` | number | Slide steepness |
| `showTimer` | boolean | Display timing tools |
| `showPath` | boolean | Trace motion path |
| `showSpeedIndicator` | boolean | Visual speed feedback |
| `riderOptions` | array | Characters for equipment |
| `guidedExperiments` | boolean | Step-by-step investigations |

**Equipment Types**:
| Equipment | Physics Concepts |
|-----------|-----------------|
| `swing` | Pendulum motion, period, amplitude |
| `slide` | Inclined plane, speed, friction |
| `merry_go_round` | Circular motion, spinning, dizziness |
| `seesaw` | Balance, lever, weight distribution |
| `spring_rider` | Oscillation, bouncing |
| `zip_line` | Gravity, acceleration, slope |

---

#### 1.4 Ball Drop Tower

**Description**: A tower where students drop balls of different sizes, weights, and materials. Students discover that all objects fall at the same rate (in absence of air), building intuition for gravity.

**Core Interactions**:
- Select balls (different sizes, materials, weights)
- Drop from different heights
- Predict which lands first
- Watch slow-motion replay
- Observe air resistance effects (feathers vs balls)
- Compare drop times
- Toggle "no air" mode

**Use Cases**:
- Things fall down (K)
- Higher drops hit harder (K-1)
- Heavy and light fall together! (surprise discovery) (1-2)
- Air slows some things more (2-3)
- Timing falls and measuring (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `towerHeight` | number | Maximum drop height |
| `availableBalls` | array | Ball types and properties |
| `airResistance` | enum | `off`, `low`, `realistic` |
| `showSlowMotion` | boolean | Slow-motion replay |
| `showTimer` | boolean | Display fall time |
| `sideBySide` | boolean | Drop two objects simultaneously |
| `heightMarkers` | boolean | Show height measurement |
| `predictMode` | boolean | Require prediction before drop |

---

#### 1.5 Spinning & Twirling Lab

**Description**: Explore rotation with spinning tops, figure skaters, and twirling objects. Students discover how arm position affects spin speed and experience centripetal effects.

**Core Interactions**:
- Spin tops with different force
- Watch figure skater pull arms in/out
- Twirl objects on strings of different lengths
- Observe what happens when you let go
- Feel the "pull outward" concept
- Compare spin speeds
- Create spin patterns

**Use Cases**:
- Things spin round and round (K)
- Faster spin = blur (K-1)
- Arms in = spin faster (like skaters) (2-3)
- Longer string = slower spin (3-4)
- Introduction to circular motion (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `spinnerType` | enum | `top`, `skater`, `string`, `merry_go_round` |
| `armControl` | boolean | Adjustable arm position (skater) |
| `stringLength` | number | Length of twirling string |
| `spinInput` | enum | `swipe`, `slider`, `tap` |
| `showSpeedometer` | boolean | Visual speed indicator |
| `showPath` | boolean | Trace circular path |
| `releaseMode` | boolean | Show what happens when released |

---

### 2. Energy & Motion

#### 2.1 Roller Coaster Designer

**Description**: A track-building toy where students create roller coasters and watch cars ride them. Students discover that starting height determines how high the car can go later.

**Core Interactions**:
- Draw/build coaster track
- Set starting height
- Release car and watch it ride
- Observe where car stops or fails
- Add loops and hills
- Compare different track designs
- See speed indicator (faster = more energy)

**Use Cases**:
- Up and down, wheee! (K)
- Start high to go high later (K-1)
- Car slows going up, speeds going down (1-2)
- Can't go higher than you started (2-3)
- Introduction to potential/kinetic energy (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `trackPieces` | array | Available track segment types |
| `maxHeight` | number | Maximum track height |
| `gridSize` | [rows, cols] | Building canvas size |
| `showSpeedometer` | boolean | Display speed indicator |
| `showEnergyBar` | boolean | Simple energy visualization |
| `showHeightMarker` | boolean | Display height measurement |
| `frictionLevel` | enum | `none`, `low`, `realistic` |
| `carTypes` | array | Different car options |
| `loopsAllowed` | boolean | Enable loop-the-loop pieces |

---

#### 2.2 Bouncy Ball Lab

**Description**: A ball-dropping experiment where students explore bouncing, energy loss, and different materials. Students discover why balls don't bounce back to their starting height.

**Core Interactions**:
- Drop balls from measured heights
- Measure bounce height
- Compare different ball materials
- Predict bounce height before dropping
- Try different surfaces
- Observe energy "loss" to sound and heat
- Count bounces until stop

**Use Cases**:
- Balls bounce! (K)
- Some balls bounce higher than others (K-1)
- Bounce height < drop height (why?) (1-2)
- Material matters (rubber vs tennis vs clay) (2-3)
- Introduction to energy transformation (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `ballTypes` | array | Ball materials and properties |
| `surfaceTypes` | array | Floor surface options |
| `dropHeight` | number | Initial/max drop height |
| `showHeightMarkers` | boolean | Measurement visualization |
| `showBounceCount` | boolean | Count bounces |
| `showEnergyLoss` | boolean | Simple energy visualization |
| `predictMode` | boolean | Require predictions |
| `slowMotion` | boolean | Slow-motion replay |
| `soundEffects` | boolean | Bounce sounds (louder = more energy) |

---

#### 2.3 Domino Chain Builder

**Description**: A domino setup canvas where students create chain reactions. Students discover how energy transfers from one object to another and design elaborate patterns.

**Core Interactions**:
- Place dominoes in patterns
- Tip the first domino
- Watch chain reaction
- Observe what makes chains fail
- Design branching paths
- Add ramps and obstacles
- Time the chain completion

**Use Cases**:
- Tip one, they all fall! (K)
- Gaps break the chain (K-1)
- Energy travels through the line (1-2)
- Branching and patterns (2-3)
- Speed of chain, energy transfer (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `gridSize` | [rows, cols] | Canvas dimensions |
| `maxDominoes` | number | Piece limit |
| `dominoSizes` | array | Different domino heights |
| `showPath` | boolean | Preview fall direction |
| `allowRamps` | boolean | Include ramp pieces |
| `allowCurves` | boolean | Curved arrangements |
| `showTimer` | boolean | Time the chain |
| `slowMotion` | boolean | Slow-motion replay |
| `challengeMode` | object | Target patterns to recreate |

---

#### 2.4 Ramp Racer

**Description**: A simplified ramp exploration where toy cars roll down ramps of different heights and angles. Students discover relationships between height, angle, and speed.

**Core Interactions**:
- Adjust ramp height and angle
- Release car and watch it roll
- Measure how far car travels on flat ground
- Compare different ramp setups
- Predict outcomes before testing
- Try different car weights

**Use Cases**:
- Higher ramp = faster car (K-1)
- Steeper vs gentler ramps (1-2)
- Same height, different angles (2-3)
- Measuring roll distance (3-4)
- Energy from height to motion (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `maxHeight` | number | Maximum ramp height |
| `angleControl` | enum | `presets`, `slider`, `drag` |
| `carTypes` | array | Different car options |
| `surfaceType` | enum | `smooth`, `carpet`, `bumpy` |
| `showMeasurements` | boolean | Display height, angle, distance |
| `showSpeedometer` | boolean | Display car speed |
| `predictMode` | boolean | Require predictions |
| `runwayLength` | number | Flat surface after ramp |

---

#### 2.5 Wrecking Ball

**Description**: A pendulum-based demolition game where students swing wrecking balls to knock down structures. Students discover how release height affects impact power.

**Core Interactions**:
- Pull wrecking ball to different heights
- Release and watch it swing
- Knock down block towers
- Observe: higher release = bigger smash
- Adjust ball weight and rope length
- Design towers that are hard to knock down
- Predict what will fall

**Use Cases**:
- Swing and smash! (K)
- Pull higher = bigger crash (K-1)
- Heavy ball vs light ball (1-2)
- Rope length changes swing (2-3)
- Energy from height to motion to crash (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `ballWeight` | enum | `light`, `medium`, `heavy` |
| `ropeLength` | number | Pendulum length |
| `releaseControl` | enum | `drag`, `presets` |
| `targetStructures` | array | Block arrangements to knock down |
| `buildMode` | boolean | Student builds targets |
| `showSwingPath` | boolean | Trace ball trajectory |
| `showSpeedIndicator` | boolean | Display ball speed |
| `showHeightMarker` | boolean | Display release height |

---

### 3. Sound & Vibration

#### 3.1 Musical Instrument Builder

**Description**: A creative sound lab where students build and play virtual instruments. Students discover relationships between size, tension, and pitch through playful experimentation.

**Core Interactions**:
- Build drums of different sizes
- Stretch rubber bands of different lengths
- Blow across bottles with different water levels
- Pluck strings of different tensions
- See sound "waves" when instruments play
- Arrange instruments by pitch
- Create simple songs

**Use Cases**:
- Making different sounds (K)
- Big drums = deep sounds, small = high (K-1)
- Tight strings = high sounds (1-2)
- Patterns in pitch and size (2-3)
- Frequency introduction (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `instrumentTypes` | array | Drums, strings, bottles, pipes |
| `sizeControl` | boolean | Adjust instrument size |
| `tensionControl` | boolean | Adjust string/drum tension |
| `waterLevelControl` | boolean | Adjust bottle water level |
| `showVibration` | boolean | Visualize vibrating parts |
| `showWaveform` | boolean | Simple wave visualization |
| `pitchLabels` | boolean | High/medium/low labels |
| `recordMode` | boolean | Record and playback songs |
| `compareMode` | boolean | Side-by-side instrument comparison |

---

#### 3.2 Sound Wave Viewer

**Description**: A microphone-connected visualizer that shows sound waves from voice and instruments. Students see their sounds and discover wave properties.

**Core Interactions**:
- Make sounds and see waves
- Compare loud vs quiet (wave height)
- Compare high vs low pitch (wave spacing)
- Make steady tones and see patterns
- Clap and see sharp spikes
- Play instruments and see their waves
- Try to match wave patterns

**Use Cases**:
- My voice makes waves! (K)
- Loud = big waves, quiet = small (K-1)
- High sounds look different than low (1-2)
- Sound patterns (2-3)
- Wave properties: amplitude, frequency (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `inputSource` | enum | `microphone`, `generated`, `both` |
| `waveStyle` | enum | `wiggly_line`, `bars`, `circles` |
| `showAmplitude` | boolean | Label wave height |
| `showFrequency` | boolean | Label wave spacing |
| `freezeFrame` | boolean | Pause and examine waves |
| `compareMode` | boolean | Side-by-side wave comparison |
| `presetSounds` | array | Built-in sounds to explore |
| `matchGame` | boolean | Match sound to wave pattern |

---

#### 3.3 Telephone Line

**Description**: A string telephone builder where students experiment with sound transmission. Students discover that sound travels through materials.

**Core Interactions**:
- Connect cups with different strings
- Speak into one cup, listen at other
- Try tight vs loose string
- Try different string materials
- Add more cups to the line
- Observe string vibration
- Test maximum distance

**Use Cases**:
- Sound travels through string! (K-1)
- Tight string works better (1-2)
- Different materials carry sound differently (2-3)
- Sound is vibration traveling (3-4)
- Properties affecting transmission (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `stringMaterials` | array | String types (cotton, nylon, wire) |
| `stringLength` | number | Distance between cups |
| `tensionControl` | boolean | Adjust string tightness |
| `showVibration` | boolean | Visualize string vibrating |
| `multiCup` | boolean | Allow branching connections |
| `volumeIndicator` | boolean | Show received sound strength |
| `experimentGuide` | boolean | Guided comparisons |

---

#### 3.4 Echo Canyon

**Description**: A sound reflection playground where students shout into canyons and hear echoes. Students discover that sound bounces off surfaces.

**Core Interactions**:
- Make sounds toward walls/cliffs
- Hear echoes return
- Measure echo delay (far walls = longer wait)
- Try different shaped rooms
- Observe multiple echoes
- Discover sound absorption (soft walls)
- Design rooms for echo effects

**Use Cases**:
- Echoes! Hello-ello-llo-lo (K)
- Far walls = longer echo wait (K-1)
- Sound bounces like a ball (1-2)
- Soft things absorb sound (2-3)
- Sound travels, bounces, returns (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `canyonShape` | enum | `corridor`, `cave`, `room`, `outdoor` |
| `wallDistance` | number | Distance to reflecting surface |
| `wallMaterial` | enum | `rock`, `wood`, `fabric`, `foam` |
| `showSoundWaves` | boolean | Visualize traveling sound |
| `showTimer` | boolean | Measure echo delay |
| `multiplEchoes` | boolean | Enable echo of echo |
| `designMode` | boolean | Student designs room shape |

---

### 4. Light & Color

#### 4.1 Shadow Puppet Theater

**Description**: A shadow-casting stage where students create shadow puppets. Students discover how shadows form and how distance affects shadow size.

**Core Interactions**:
- Place objects between light and screen
- Observe shadow formation
- Move object closer/farther from light
- Observe shadow size change
- Create puppet shows
- Use multiple light sources
- Make shadows overlap

**Use Cases**:
- Making shadows (K)
- Blocking light makes shadows (K-1)
- Closer to light = bigger shadow (1-2)
- Shadow shape matches object (2-3)
- Light travels in straight lines (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `lightSources` | number | Number of lights (1-3) |
| `lightPosition` | object | Light placement control |
| `puppetLibrary` | array | Pre-made puppet shapes |
| `customPuppets` | boolean | Draw custom shapes |
| `showLightRays` | boolean | Visualize light path |
| `coloredLights` | boolean | Multiple light colors |
| `screenDistance` | number | Light to screen distance |
| `performanceMode` | boolean | Theater presentation mode |

---

#### 4.2 Rainbow Maker

**Description**: A prism and light exploration where students create rainbows. Students discover that white light contains all colors.

**Core Interactions**:
- Shine white light through prism
- See rainbow emerge
- Identify color order (ROYGBIV)
- Combine colored lights back to white
- Explore what makes rainbows in nature
- Filter specific colors
- Mix colored lights

**Use Cases**:
- Rainbows are beautiful! (K)
- White light → many colors (K-1)
- Rainbow color order (1-2)
- Prisms bend light (2-3)
- Light spectrum, color mixing (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `lightSource` | enum | `flashlight`, `sunbeam`, `laser` |
| `prismType` | enum | `triangle`, `raindrop`, `cd` |
| `showLightPath` | boolean | Trace light through prism |
| `colorLabels` | boolean | Label spectrum colors |
| `mixingMode` | boolean | Combine colored lights |
| `filterMode` | boolean | Block specific colors |
| `naturalRainbows` | boolean | Show real-world examples |
| `interactiveSpectrum` | boolean | Explore full spectrum |

---

#### 4.3 Mirror Maze

**Description**: A mirror playground where students bounce light beams and create reflections. Students discover reflection rules and symmetry.

**Core Interactions**:
- Shine flashlight at mirrors
- Observe light bounce angle
- Aim light to hit targets
- Use multiple mirrors for chain reflections
- See multiple reflections (infinity mirrors)
- Create kaleidoscope patterns
- Design mirror mazes

**Use Cases**:
- Mirrors show reflections (K)
- Light bounces off mirrors (K-1)
- Angle in = angle out (2-3)
- Multiple reflections (3-4)
- Reflection geometry (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `mirrorTypes` | array | Flat, curved, angled |
| `numMirrors` | number | Available mirrors |
| `lightSource` | enum | `flashlight`, `laser`, `sun` |
| `showAngles` | boolean | Display reflection angles |
| `showLightPath` | boolean | Trace light beam |
| `targetMode` | boolean | Hit-the-target challenges |
| `kaleidoscopeMode` | boolean | Symmetric pattern maker |
| `mazeBuilder` | boolean | Design custom mazes |

---

#### 4.4 Color Mixing Lab

**Description**: A paint and light mixing studio where students explore how colors combine. Students discover the difference between mixing paints and mixing lights.

**Core Interactions**:
- Mix paint colors (subtractive)
- Mix light colors (additive)
- Discover primary colors for each
- Create target colors by mixing
- Compare paint mixing vs light mixing
- Explore why they're different
- Design colorful patterns

**Use Cases**:
- Colors mix to make new colors (K)
- Red + blue = purple (paint) (K-1)
- Red + green = yellow (light) - surprise! (2-3)
- Primary colors concept (3-4)
- Additive vs subtractive mixing (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `mixingType` | enum | `paint`, `light`, `both` |
| `primaryColors` | array | Available starting colors |
| `showRecipe` | boolean | Display color formula |
| `targetMatching` | boolean | Match a target color |
| `compareMode` | boolean | Paint vs light side-by-side |
| `freeMode` | boolean | Unlimited mixing exploration |
| `colorWheel` | boolean | Show color relationships |
| `realWorldExamples` | boolean | Connect to screens, printers |

---

#### 4.5 Light Beam Bender

**Description**: An exploration of how light bends when passing between materials (water, glass, air). Students discover refraction through visual experiments.

**Core Interactions**:
- Shine light into water
- Observe light beam bend
- Try different angles
- Compare different materials
- See "broken pencil" illusion
- Explore how lenses work
- Create magnification effects

**Use Cases**:
- Things look different in water (K-1)
- Light bends at water surface (1-2)
- Different materials bend light differently (2-3)
- Lenses bend light to focus (3-4)
- Introduction to refraction (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `materials` | array | Air, water, glass, oil |
| `angleControl` | enum | `presets`, `slider`, `drag` |
| `showLightPath` | boolean | Trace light beam |
| `showBendAngle` | boolean | Display angle change |
| `illusionMode` | boolean | Show optical illusions |
| `lensExplorer` | boolean | Experiment with lenses |
| `realWorldExamples` | boolean | Glasses, magnifiers, pools |

---

### 5. Magnets & Electricity

#### 5.1 Magnet Explorer

**Description**: A magnetic discovery lab where students play with virtual magnets. Students discover attraction, repulsion, and magnetic fields.

**Core Interactions**:
- Bring magnets near each other
- Discover attract/repel behavior
- Flip magnets and try again
- Explore what sticks to magnets
- See magnetic field with iron filings
- Find magnet strength varies by distance
- Discover Earth is a giant magnet

**Use Cases**:
- Magnets stick to some things (K)
- Magnets can push or pull each other (K-1)
- Two ends (poles) behave differently (1-2)
- Magnetic field visualization (2-3)
- Strength decreases with distance (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `magnetTypes` | array | Bar, horseshoe, ring, earth |
| `materialLibrary` | array | Objects to test (metal, wood, plastic) |
| `showFieldLines` | boolean | Magnetic field visualization |
| `showPoleLabels` | boolean | North/south labels |
| `strengthIndicator` | boolean | Force strength display |
| `distanceEffect` | boolean | Explore distance vs force |
| `ironFilings` | boolean | Field pattern visualization |
| `compassMode` | boolean | Include compass tool |

---

#### 5.2 Circuit Sandbox

**Description**: A simple circuit building playground where students light bulbs and ring buzzers. Students discover that electricity needs a complete path.

**Core Interactions**:
- Connect battery to bulb with wires
- Discover circuit must be complete
- Add switches to control flow
- Make buzzers buzz and motors spin
- Add multiple bulbs
- Compare bright vs dim bulbs
- Diagnose "broken" circuits

**Use Cases**:
- Light the bulb! (K-1)
- Complete the path (circuit) (1-2)
- Switches turn things on/off (2-3)
- More bulbs = dimmer (3-4)
- Series vs parallel introduction (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `components` | array | Available components |
| `maxComponents` | number | Complexity limit |
| `showCurrentFlow` | boolean | Animate electricity flow |
| `showBrightness` | boolean | Bulb brightness varies |
| `switchTypes` | array | Toggle, push, slider |
| `debugMode` | boolean | Find circuit problems |
| `challengeMode` | boolean | Specific goals to achieve |
| `symbolMode` | boolean | Show circuit symbols (grades 4-5) |

**Component Types**:
| Component | K-2 Name | 3-5 Name |
|-----------|----------|----------|
| `battery` | Power box | Battery |
| `bulb` | Light | Light bulb |
| `wire` | Connector | Wire |
| `switch` | On/off button | Switch |
| `buzzer` | Noise maker | Buzzer |
| `motor` | Spinner | Motor |

---

#### 5.3 Static Electricity Lab

**Description**: A charged-up exploration where students create static electricity through rubbing and observe attraction/repulsion. Students discover electric charge.

**Core Interactions**:
- Rub balloon on hair/sweater
- Observe hair standing up
- Attract small paper pieces
- Stick balloon to wall
- See "lightning" sparks (safely)
- Charge different objects
- Explore attract vs repel

**Use Cases**:
- Hair stands up! (K)
- Rubbing makes "sticky" electricity (K-1)
- Charged things attract or repel (1-2)
- Sparks happen when charge jumps (2-3)
- Introduction to electric charge (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `rubbingPairs` | array | Material combinations |
| `testObjects` | array | Objects to attract |
| `showCharge` | boolean | Visualize charge buildup |
| `showForce` | boolean | Attraction/repulsion arrows |
| `sparkMode` | boolean | Show discharge sparks |
| `compareMode` | boolean | Different material combinations |
| `realWorldExamples` | boolean | Lightning, shocks, etc. |

---

#### 5.4 Electromagnet Builder

**Description**: A hands-on electromagnet construction activity where students wind coils and discover that electricity can make magnetism.

**Core Interactions**:
- Wind wire around nail
- Connect to battery
- Test magnetic strength
- Add more coil turns
- Observe stronger magnet
- Reverse battery and observe
- Compare to permanent magnets

**Use Cases**:
- Wire + battery = magnet! (1-2)
- More coils = stronger (2-3)
- Can turn on/off unlike regular magnets (3-4)
- Reverse current = reverse poles (4-5)
- Electricity and magnetism are connected (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `coreTypes` | array | Nail, pencil, air core |
| `coilControl` | enum | `presets`, `winding_animation` |
| `batteryStrength` | enum | `weak`, `medium`, `strong` |
| `showFieldLines` | boolean | Magnetic field visualization |
| `strengthMeter` | boolean | Picking up paperclips |
| `polarityIndicator` | boolean | Show N/S poles |
| `compareMode` | boolean | Electromagnet vs permanent |

---

### 6. Floating & Sinking

#### 6.1 Sink or Float Lab

**Description**: A water tank where students predict and test whether objects sink or float. Students discover that size isn't everything—density matters.

**Core Interactions**:
- Predict: will it sink or float?
- Drop object in water
- Check prediction
- Compare surprising results
- Sort objects by behavior
- Explore why some heavy things float
- Discover density concept

**Use Cases**:
- Sink or float prediction game (K)
- Heavy doesn't always mean sink (K-1)
- Boats are heavy but float! (1-2)
- Shape matters (boat vs ball of clay) (2-3)
- Introduction to density (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `objectLibrary` | array | Objects to test |
| `predictMode` | boolean | Require prediction first |
| `liquidTypes` | array | Water, salt water, oil |
| `showDensityBar` | boolean | Density comparison |
| `reshapeMode` | boolean | Change object shape (clay boat) |
| `sortingMode` | boolean | Categorize results |
| `surpriseObjects` | boolean | Counterintuitive examples |
| `measureMode` | boolean | Weigh and measure objects |

**Sample Objects**:
| Object | Behavior | Surprise Factor |
|--------|----------|-----------------|
| `penny` | sinks | expected |
| `wooden_block` | floats | expected |
| `orange_with_peel` | floats | surprise! |
| `orange_peeled` | sinks | surprise! |
| `clay_ball` | sinks | expected |
| `clay_boat` | floats | learning moment |
| `empty_bottle` | floats | expected |
| `filled_bottle` | sinks | expected |

---

#### 6.2 Boat Builder

**Description**: A boat construction and testing facility where students design boats that float and carry cargo. Students discover how shape affects buoyancy.

**Core Interactions**:
- Build boats from different materials
- Shape hulls (flat, curved, deep)
- Test in water tank
- Add cargo until boat sinks
- Compare cargo capacity
- Observe waterline changes
- Design for maximum capacity

**Use Cases**:
- Make something float (K)
- Shape affects floating (K-1)
- Wide boats hold more (1-2)
- Waterline tells how much more (2-3)
- Hull design for capacity (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `buildMaterials` | array | Clay, foil, paper, wood |
| `shapeTools` | array | Hull shaping options |
| `cargoTypes` | array | Pennies, marbles, weights |
| `showWaterline` | boolean | Display water level |
| `showCapacity` | boolean | Cargo counter |
| `challengeMode` | boolean | Maximum cargo challenges |
| `compareMode` | boolean | Side-by-side boat testing |
| `realBoatExamples` | boolean | Show real boat designs |

---

#### 6.3 Submarine Controller

**Description**: A submarine simulation where students control depth by adjusting ballast tanks. Students discover how submarines rise and sink.

**Core Interactions**:
- Fill ballast tanks with water (sink)
- Empty ballast tanks (rise)
- Achieve neutral buoyancy (hover)
- Navigate to target depths
- Observe weight changes
- Complete underwater missions
- Rescue objects from different depths

**Use Cases**:
- Make submarine go up and down (K-1)
- Water in = sink, water out = rise (1-2)
- Hovering in the middle (2-3)
- Precise depth control (3-4)
- Buoyancy control principles (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `tankSize` | number | Ballast tank capacity |
| `depthRange` | number | Maximum diving depth |
| `fillControl` | enum | `buttons`, `slider` |
| `showBallast` | boolean | Water level in tanks |
| `showDepthGauge` | boolean | Current depth display |
| `targetDepths` | array | Goals to reach |
| `missionMode` | boolean | Object recovery missions |
| `physicsDetail` | enum | `simple`, `realistic` |

---

#### 6.4 Water Pressure Explorer

**Description**: A depth and pressure discovery lab where students explore how water pressure increases with depth through holes in containers and squeezing divers.

**Core Interactions**:
- Poke holes at different heights in container
- Observe water shoots farther from bottom
- Squeeze Cartesian diver to control depth
- Feel pressure increase concept
- Explore deep sea pressure
- Compare container shapes

**Use Cases**:
- Water squirts out of holes (K-1)
- Lower holes squirt farther (1-2)
- Deeper water pushes harder (2-3)
- Pressure increases with depth (3-4)
- Water pressure calculations (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `containerShapes` | array | Bottle, tank, column |
| `holePositions` | array | Where holes can be placed |
| `showPressureColor` | boolean | Color by pressure |
| `diverMode` | boolean | Cartesian diver toy |
| `squeezeControl` | enum | `click`, `hold`, `slider` |
| `deepSeaMode` | boolean | Explore ocean depths |
| `measurementMode` | boolean | Numerical pressure values |

---

### 7. Hot & Cold

#### 7.1 Temperature Explorer

**Description**: A thermal investigation lab where students explore hot and cold through everyday scenarios. Students discover how heat moves and how we sense temperature.

**Core Interactions**:
- Touch (virtually) hot and cold objects
- Observe temperature with thermometer
- Watch ice melt in warm places
- Watch water freeze in cold places
- Mix hot and cold water
- Explore what feels hot vs what IS hot
- Track temperature changes over time

**Use Cases**:
- Hot vs cold recognition (K)
- Some things are hot, some cold (K-1)
- Heat makes things warm up (1-2)
- Hot and cold mix to medium (2-3)
- Temperature measurement and change (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `objectLibrary` | array | Things to test |
| `thermometerType` | enum | `simple`, `numeric`, `color` |
| `mixingMode` | boolean | Combine different temperatures |
| `timelapseMode` | boolean | Watch temperature change over time |
| `freezeMeltMode` | boolean | Phase change observation |
| `feelVsRealMode` | boolean | Perception vs measurement |
| `safetyReminders` | boolean | Hot = dangerous messages |

---

#### 7.2 Heat Race

**Description**: A conduction experiment where students race heat through different materials. Students discover that materials conduct heat at different rates.

**Core Interactions**:
- Place heat source at one end
- Watch heat travel through materials
- Race different materials
- Predict which heats fastest
- Compare metals, wood, plastic
- Discover insulators and conductors
- Design to keep things hot or cold

**Use Cases**:
- Some things get hot faster (K-1)
- Metal spoon gets hot in soup (1-2)
- Materials conduct differently (2-3)
- Insulators vs conductors (3-4)
- Heat conduction comparison (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `materials` | array | Materials to test |
| `showHeatColor` | boolean | Temperature color map |
| `showThermometers` | boolean | End-point temperature |
| `raceMode` | boolean | Which reaches temperature first |
| `predictMode` | boolean | Prediction before test |
| `insulatorChallenge` | boolean | Keep ice frozen longest |
| `realWorldExamples` | boolean | Pot handles, oven mitts |

**Materials**:
| Material | Conduction | Category |
|----------|------------|----------|
| `copper` | very fast | conductor |
| `aluminum` | fast | conductor |
| `steel` | medium-fast | conductor |
| `water` | medium | medium |
| `wood` | slow | insulator |
| `plastic` | slow | insulator |
| `foam` | very slow | insulator |
| `air` | very slow | insulator |

---

#### 7.3 Melting & Freezing Lab

**Description**: A phase change exploration where students melt ice, freeze water, and observe state changes. Students discover that matter changes form with temperature.

**Core Interactions**:
- Heat ice and watch it melt
- Cool water and watch it freeze
- Observe temperature stays flat during change
- Try different substances (chocolate, butter)
- Time how long melting takes
- Compare melting points
- Explore evaporation

**Use Cases**:
- Ice turns to water (K)
- Cold makes water turn to ice (K-1)
- Melting and freezing are opposites (1-2)
- Temperature during melting (2-3)
- Different melting points (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `substances` | array | Things to melt/freeze |
| `heatControl` | enum | `buttons`, `slider`, `flame_position` |
| `showThermometer` | boolean | Temperature display |
| `showGraphOption` | boolean | Temperature vs time graph |
| `timerMode` | boolean | Time phase changes |
| `evaporationMode` | boolean | Include liquid→gas |
| `compareMaterials` | boolean | Side-by-side testing |

---

#### 7.4 Insulation Challenge

**Description**: An engineering-focused activity where students design insulation to keep things hot or cold. Students apply understanding of heat transfer to real problems.

**Core Interactions**:
- Start with hot or cold object
- Choose wrapping materials
- Predict how well insulation works
- Measure temperature over time
- Compare different insulation designs
- Compete for best performance
- Connect to real-world insulation

**Use Cases**:
- Wrapping keeps things warm (K-1)
- Some materials work better (1-2)
- Layering helps (2-3)
- Designing for performance (3-4)
- Insulation optimization (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `challengeType` | enum | `keep_hot`, `keep_cold` |
| `insulationMaterials` | array | Available wrapping materials |
| `layers` | number | Maximum insulation layers |
| `durationTest` | number | How long test runs |
| `showTemperatureGraph` | boolean | Temperature over time |
| `budgetMode` | boolean | Material costs |
| `realWorldContext` | enum | `lunchbox`, `house`, `cooler` |
| `competitionMode` | boolean | Compare with others |

---

### 8. Forces in Nature

#### 8.1 Wind & Weather Lab

**Description**: An exploration of wind and air pressure through pinwheels, kites, and weather instruments. Students discover that air pushes on things.

**Core Interactions**:
- Blow on pinwheels and wind socks
- Fly kites in different wind speeds
- Build and test paper airplanes
- Explore how wind forms
- Measure wind speed and direction
- See air pressure demonstrations
- Connect to weather concepts

**Use Cases**:
- Wind makes things move (K)
- Stronger wind = faster spinning (K-1)
- Wind has direction (1-2)
- Air pushes even though invisible (2-3)
- Wind and weather patterns (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `windControl` | enum | `fan_settings`, `slider`, `weather_simulation` |
| `windObjects` | array | Pinwheel, kite, windsock, airplane |
| `showWindLines` | boolean | Visualize air movement |
| `showSpeedMeter` | boolean | Wind speed indicator |
| `directionControl` | boolean | Change wind direction |
| `flightMode` | boolean | Paper airplane testing |
| `weatherMode` | boolean | Weather system connection |

---

#### 8.2 Gravity Well

**Description**: A gravity visualization where students roll marbles on curved surfaces to understand orbital motion. Students discover how gravity bends paths.

**Core Interactions**:
- Roll marbles on flat surface (straight lines)
- Roll marbles on curved "gravity well"
- Observe curved paths
- Try to achieve orbits
- Explore crash vs orbit vs escape
- Compare "planet" sizes (deeper wells)
- Discover orbital speed matters

**Use Cases**:
- Balls roll toward the middle (K-1)
- Curved surface makes curved path (1-2)
- Fast balls can go around without falling in (2-3)
- Orbiting like planets (3-4)
- Gravity and orbital mechanics introduction (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `wellDepth` | enum | `shallow`, `medium`, `deep` |
| `marbleSizes` | array | Different marble weights |
| `launchControl` | enum | `swipe`, `angle_speed_sliders` |
| `showPath` | boolean | Trace marble trajectory |
| `showSpeed` | boolean | Speed indicator |
| `orbitChallenge` | boolean | Achieve stable orbit |
| `multiWell` | boolean | Multiple gravity sources |
| `planetLabels` | boolean | Connect to solar system |

---

#### 8.3 Earthquake Shake Table

**Description**: A building stability tester where students construct towers and test them on a shake table. Students discover what makes buildings earthquake-resistant.

**Core Interactions**:
- Build block towers
- Apply earthquake shaking
- Observe what falls
- Adjust shake intensity and frequency
- Redesign for stability
- Compare different building strategies
- Explore real earthquake engineering

**Use Cases**:
- Shaking makes things fall (K)
- Wide base = more stable (K-1)
- Some shapes resist shaking (1-2)
- Triangles and cross-braces help (2-3)
- Resonance and structural design (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `buildingBlocks` | array | Block types available |
| `shakeIntensity` | enum | `light`, `medium`, `strong` |
| `shakePattern` | enum | `single`, `sustained`, `random` |
| `frequencyControl` | boolean | Adjust shake speed |
| `buildingChallenges` | array | Target heights to achieve |
| `replayMode` | boolean | Slow-motion replay of collapse |
| `realExamples` | boolean | Real building techniques |

---

#### 8.4 Erosion Explorer

**Description**: A sandbox where students observe how water and wind shape landscapes. Students discover geological forces through time-lapse observation.

**Core Interactions**:
- Create sand/soil landscapes
- Add water (rain, rivers)
- Add wind
- Watch erosion happen (accelerated)
- See deltas, canyons, dunes form
- Plant vegetation to prevent erosion
- Compare erosion rates

**Use Cases**:
- Water moves sand (K-1)
- Rivers cut through land (1-2)
- Wind blows sand into piles (2-3)
- Plants prevent erosion (3-4)
- Geological timescales and forces (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `terrainType` | enum | `sand`, `soil`, `rock` |
| `waterControl` | enum | `rain`, `river`, `waves` |
| `windControl` | boolean | Enable wind erosion |
| `timeScale` | number | Speed of erosion |
| `vegetationMode` | boolean | Add plants for protection |
| `showTimeLapse` | boolean | Accelerated visualization |
| `landformExamples` | boolean | Real canyon, delta images |

---

### 9. Measurement & Observation

#### 9.1 Measuring Olympics

**Description**: A measurement challenge course where students practice using rulers, scales, and other tools. Students develop measurement skills through sports-themed activities.

**Core Interactions**:
- Measure jump distances
- Weigh objects for competitions
- Time races with stopwatch
- Compare measurements
- Record and rank results
- Use appropriate units
- Estimate before measuring

**Use Cases**:
- Using a ruler to measure (K-1)
- Using a scale to weigh (K-1)
- Using a stopwatch to time (1-2)
- Recording and comparing data (2-3)
- Choosing appropriate units (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `events` | array | Long jump, weightlifting, sprint |
| `measurementTools` | array | Ruler, scale, stopwatch |
| `units` | enum | `simple`, `standard`, `metric` |
| `estimateFirst` | boolean | Require estimation |
| `recordSheet` | boolean | Data recording |
| `competitionMode` | boolean | Multiple competitors |
| `accuracyScoring` | boolean | Points for precision |

---

#### 9.2 Pattern Finder

**Description**: A data collection and pattern recognition activity where students observe phenomena and find patterns. Foundation for scientific thinking.

**Core Interactions**:
- Collect data from experiments
- Organize in tables and charts
- Look for patterns
- Make predictions based on patterns
- Test predictions
- Communicate findings
- Create graphs

**Use Cases**:
- Same vs different (K)
- Sorting and grouping (K-1)
- Finding what's the same (1-2)
- Patterns in data (2-3)
- Predicting from patterns (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `dataSource` | enum | Which experiment to analyze |
| `organizerType` | enum | `table`, `chart`, `graph` |
| `patternHints` | boolean | Guidance for finding patterns |
| `predictionMode` | boolean | Make and test predictions |
| `graphTypes` | array | Bar, line, pictograph |
| `communicationMode` | boolean | Explain findings |

---

#### 9.3 Comparison Scale

**Description**: A balance scale for comparing weights without numbers. Students develop intuition for comparison and ordering before measurement.

**Core Interactions**:
- Place objects on balance
- Observe which side goes down
- Order objects by weight
- Find objects that balance
- Estimate before comparing
- Group by weight categories
- Discover heavier doesn't mean bigger

**Use Cases**:
- Heavier goes down (K)
- Comparing two objects (K-1)
- Ordering several objects (1-2)
- Balancing equal weights (2-3)
- Connecting to measurement (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `objectLibrary` | array | Objects to compare |
| `scaleType` | enum | `balance`, `seesaw`, `spring` |
| `showWeightNumbers` | boolean | Numerical display |
| `orderingMode` | boolean | Rank objects by weight |
| `balanceChallenge` | boolean | Find balancing combinations |
| `surpriseObjects` | boolean | Counterintuitive weights |

---

### 10. Investigation Skills

#### 10.1 Question Lab

**Description**: A guided inquiry activity where students practice asking scientific questions about observations. Foundation for inquiry-based learning.

**Core Interactions**:
- Observe phenomena
- Generate "I wonder..." questions
- Categorize questions as testable or not
- Design simple investigations
- Collect evidence
- Draw conclusions
- Share findings

**Use Cases**:
- "I wonder why..." (K)
- Asking questions about observations (K-1)
- Questions we can test (1-2)
- Designing simple tests (2-3)
- Fair tests and variables (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `phenomenon` | object | What to observe and question |
| `questionStarters` | array | Sentence starters |
| `testableGuide` | boolean | Help identify testable questions |
| `investigationBuilder` | boolean | Design experiments |
| `evidenceCollector` | boolean | Record observations |
| `shareMode` | boolean | Communicate findings |

---

#### 10.2 Lab Journal

**Description**: A digital science notebook where students record observations, predictions, and conclusions. Develops scientific documentation habits.

**Core Interactions**:
- Write/draw observations
- Record predictions
- Note what happened
- Compare prediction to result
- Organize by investigation
- Review past experiments
- Share discoveries

**Use Cases**:
- Drawing what I see (K)
- Writing what I notice (K-1)
- Before and after recording (1-2)
- Organized investigation notes (2-3)
- Full lab report structure (4-5)

**Configuration Options**:
| Option | Type | Description |
|--------|------|-------------|
| `entryTypes` | array | Drawing, writing, photos |
| `templateMode` | boolean | Guided entry structure |
| `predictionPrompt` | boolean | Always ask for prediction |
| `reflectionPrompt` | boolean | What did you learn? |
| `organizerView` | boolean | View by topic or date |
| `shareMode` | boolean | Publish discoveries |

---

## Technical Requirements

### State Management

All primitives must implement:

```typescript
interface K5PhysicsPrimitiveState {
  // Unique identifier
  id: string;

  // Configuration
  config: PrimitiveConfig;

  // Current state (student interaction)
  state: any;

  // Grade level adaptations
  gradeLevel: 'K' | '1' | '2' | '3' | '4' | '5';

  // Serialization
  serialize(): string;
  deserialize(data: string): void;

  // Event emission
  onChange(callback: (state: any) => void): void;

  // Validation
  validate(): ValidationResult;

  // Assessment hooks
  getPrediction(): any;
  getObservation(): any;
  getConclusion(): any;

  // Accessibility
  getScreenReaderDescription(): string;
}
```

### Physics Simulation Requirements

K-5 physics primitives require simplified but accurate physics:

- **Gravity**: Consistent downward acceleration
- **Collisions**: Simple bounce with energy loss
- **Buoyancy**: Object density vs fluid density
- **Friction**: Simplified coefficient model
- **Pendulum**: Small angle approximation
- **Heat Transfer**: Simplified conduction model

Performance targets:
- Physics step: < 8ms for 60fps interaction
- Visual response to input: < 50ms
- Animation: 60fps minimum

### Age-Appropriate Safeguards

1. **No Dangerous Scenarios**: Avoid simulating dangerous situations children might replicate
2. **Safety Reminders**: Include safety notes for heat, electricity, and height experiments
3. **Simplified Numbers**: Use whole numbers and simple fractions appropriate to grade level
4. **Forgiving Interactions**: Large click/touch targets, undo support, no time pressure

### Accessibility Requirements

Each primitive must support:
- Full keyboard navigation
- Screen reader descriptions of all states and changes
- High contrast mode
- Reduced motion mode (instant state changes)
- Touch and pointer input
- Minimum touch target size (48x48px for K-2, 44x44px for 3-5)
- Audio descriptions of visual phenomena
- Color-blind safe palettes (no red/green only distinctions)

### Performance Requirements

- Initial render: < 100ms
- State update: < 16ms (60fps interactions)
- Physics simulation: < 8ms per step
- Serialization: < 50ms
- Maximum bundle size per primitive: 75KB gzipped
- Works on tablets and Chromebooks (primary K-5 devices)

### Integration Points

Each primitive integrates with:
- Problem generation system (receiving configurations)
- Assessment system (submitting predictions, observations, conclusions)
- Hint system (age-appropriate guidance)
- Audio narration (descriptions and instructions)
- Progress tracking (emitting interaction events)
- Parent/teacher dashboard (activity summaries)

---

## Implementation Priority

### Phase 1: Core Motion & Energy (Foundation)
1. Race Track Lab
2. Push & Pull Arena
3. Roller Coaster Designer
4. Ball Drop Tower
5. Bouncy Ball Lab

### Phase 2: Light & Sound
6. Shadow Puppet Theater
7. Rainbow Maker
8. Musical Instrument Builder
9. Sound Wave Viewer
10. Mirror Maze

### Phase 3: Forces & Floating
11. Sink or Float Lab
12. Boat Builder
13. Magnet Explorer
14. Circuit Sandbox
15. Playground Physics

### Phase 4: Heat & Weather
16. Temperature Explorer
17. Heat Race
18. Melting & Freezing Lab
19. Wind & Weather Lab
20. Insulation Challenge

### Phase 5: Advanced Explorations
21. Gravity Well
22. Submarine Controller
23. Domino Chain Builder
24. Wrecking Ball
25. Spinning & Twirling Lab

### Phase 6: Investigation Tools
26. Measuring Olympics
27. Comparison Scale
28. Pattern Finder
29. Question Lab
30. Lab Journal

### Phase 7: Extended Experiences
31. Color Mixing Lab
32. Light Beam Bender
33. Static Electricity Lab
34. Electromagnet Builder
35. Telephone Line

### Phase 8: Nature & Environment
36. Echo Canyon
37. Earthquake Shake Table
38. Erosion Explorer
39. Water Pressure Explorer
40. Ramp Racer

---

## Appendix A: Grade-Level Mapping

| Grade | Primary Primitives | Concepts |
|-------|-------------------|----------|
| K | Race Track, Push & Pull, Sink/Float, Shadow Theater, Ball Drop | Fast/slow, push/pull, sink/float, light/shadow, up/down |
| 1 | Roller Coaster, Bouncy Ball, Magnet Explorer, Musical Instruments, Temperature | Speed, bounce, magnets attract/repel, high/low sounds, hot/cold |
| 2 | Circuit Sandbox, Mirror Maze, Boat Builder, Playground Physics, Domino Chain | Complete circuits, reflection, floating shapes, swings, chain reactions |
| 3 | Rainbow Maker, Sound Wave Viewer, Heat Race, Gravity Well, Comparison Scale | Spectrum, wave patterns, conductors/insulators, orbits, measuring |
| 4 | Light Beam Bender, Electromagnet, Submarine, Earthquake Table, Pattern Finder | Refraction, electromagnetism, buoyancy control, structural stability, data patterns |
| 5 | All primitives with advanced options | Quantitative analysis, variables, experimental design, graphing |

---

## Appendix B: NGSS Alignment

### K-2 Physical Science Standards

| Standard | Code | Supporting Primitives |
|----------|------|----------------------|
| Pushes and pulls can make objects move | K-PS2-1 | Push & Pull Arena, Wrecking Ball, Domino Chain |
| Pushing/pulling changes speed/direction | K-PS2-2 | Race Track Lab, Playground Physics |
| Sunlight warms Earth's surface | K-PS3-1 | Temperature Explorer, Heat Race |
| Sound makes matter vibrate | 1-PS4-1 | Musical Instrument Builder, Telephone Line |
| Objects can only be seen with light | 1-PS4-2 | Shadow Puppet Theater |
| Light/sound from vibrating materials | 1-PS4-1 | Sound Wave Viewer |
| Heating/cooling causes changes | 2-PS1-4 | Melting & Freezing Lab, Temperature Explorer |

### K-2 Engineering Standards

| Standard | Code | Supporting Primitives |
|----------|------|----------------------|
| Define simple problems | K-2-ETS1-1 | Question Lab, All building primitives |
| Develop simple solutions | K-2-ETS1-2 | Boat Builder, Roller Coaster Designer, Circuit Sandbox |
| Analyze/compare solutions | K-2-ETS1-3 | Insulation Challenge, Bridge stability testing |

### 3-5 Physical Science Standards

| Standard | Code | Supporting Primitives |
|----------|------|----------------------|
| Objects in contact exert forces | 3-PS2-1 | Push & Pull Arena, Playground Physics |
| Predict motion changes | 3-PS2-2 | Race Track Lab, Gravity Well |
| Electric/magnetic forces at distance | 3-PS2-3 | Magnet Explorer, Static Electricity Lab |
| Magnetic force patterns | 3-PS2-4 | Magnet Explorer, Electromagnet Builder |
| Energy transferred between objects | 4-PS3-1 | Bouncy Ball Lab, Domino Chain |
| Energy conversion | 4-PS3-2 | Roller Coaster Designer, Wrecking Ball |
| Energy from collision | 4-PS3-3 | Bouncy Ball Lab, Collision experiments |
| Energy transfer applications | 4-PS3-4 | Circuit Sandbox, Heat Race |
| Light travels | 4-PS4-2 | Shadow Puppet Theater, Mirror Maze |
| Patterns in waves | 4-PS4-1 | Sound Wave Viewer, Water waves |
| Structure and properties of matter | 5-PS1-1 | Sink or Float Lab, Heat Race |
| Gravitational force | 5-PS2-1 | Ball Drop Tower, Gravity Well |

### 3-5 Engineering Standards

| Standard | Code | Supporting Primitives |
|----------|------|----------------------|
| Define criteria and constraints | 3-5-ETS1-1 | Boat Builder, Insulation Challenge |
| Generate and compare solutions | 3-5-ETS1-2 | All building primitives |
| Plan and carry out fair tests | 3-5-ETS1-3 | Pattern Finder, Question Lab, all comparison modes |

---

## Appendix C: Physics Vocabulary Progression

| Grade | Core Vocabulary |
|-------|----------------|
| K | push, pull, fast, slow, big, small, heavy, light, hot, cold, loud, quiet, light, dark, sink, float |
| 1 | force, motion, speed, magnet, attract, repel, bounce, energy, vibrate, sound, shadow, reflect |
| 2 | circuit, conduct, balance, weight, temperature, freeze, melt, echo, friction, surface |
| 3 | gravity, orbit, conductor, insulator, absorb, wave, pitch, volume, lens, prism, spectrum |
| 4 | acceleration, friction force, potential energy, kinetic energy, refraction, frequency, current, voltage, buoyancy, density |
| 5 | mass vs weight, Newton, Joule, wavelength, amplitude, resistance, charge, pressure, variable, controlled experiment |

---

## Appendix D: Cross-Curricular Connections

### Mathematics Integration

| Math Concept | Physics Primitives |
|--------------|-------------------|
| Counting | Ball bounces, dominoes, circuit components |
| Comparison | Race Track (faster/slower), Balance Scale |
| Measurement | Measuring Olympics, Temperature Explorer |
| Data tables | Pattern Finder, Lab Journal |
| Graphing | Sound Wave Viewer, Temperature over time |
| Fractions | Bouncy Ball (3/4 height), Division of forces |
| Geometry | Mirror angles, Shadow shapes |

### Literacy Integration

| Literacy Skill | Supporting Features |
|----------------|-------------------|
| Scientific vocabulary | Word banks, labeled diagrams |
| Procedural writing | Lab Journal, experiment steps |
| Explanatory writing | Why did that happen? prompts |
| Speaking/listening | Share findings mode |
| Following directions | Investigation procedures |

### Art Integration

| Art Concept | Physics Primitives |
|-------------|-------------------|
| Color theory | Rainbow Maker, Color Mixing Lab |
| Light and shadow | Shadow Puppet Theater |
| Pattern and rhythm | Sound Wave Viewer, Domino patterns |
| Design | Boat Builder, Roller Coaster Designer |

---

## Appendix E: Safety Considerations

### Physical Safety Reminders

Each primitive should include contextual safety notes when relevant:

| Topic | Safety Note |
|-------|-------------|
| Heat | "Real hot things can burn you! Always ask an adult before touching anything that might be hot." |
| Electricity | "Real electricity is dangerous! Only play with circuits that an adult says are safe." |
| Heights | "Falling from high places is dangerous! This is why we only experiment in the computer." |
| Magnets | "Strong magnets can pinch fingers and damage electronics. Handle real magnets carefully!" |
| Water | "Always swim with adult supervision. Water can be dangerous!" |
| Light | "Never look directly at the sun or bright lights! It can hurt your eyes." |

### Simulation Limitations

Clear messaging when simulations are simplified:
- "In our game, we can't feel the heat, but in real life this would be too hot to touch!"
- "Real electricity works a bit differently, but this shows you the basic idea."
- "Air resistance is tricky - our simulation shows what happens without much air."

---

## Appendix F: Assessment Framework

### Prediction → Observation → Explanation Cycle

Every primitive should support this assessment pattern:

1. **Prediction Phase**
   - "What do you think will happen?"
   - Record student prediction
   - Capture reasoning if appropriate

2. **Observation Phase**
   - Run experiment/simulation
   - "What did you see?"
   - Compare to prediction

3. **Explanation Phase**
   - "Why do you think that happened?"
   - Grade-appropriate vocabulary prompts
   - Connection to prior knowledge

### Assessment Data Points

| Data Type | Example |
|-----------|---------|
| Prediction accuracy | Did student predict correctly? |
| Observation quality | Did they notice key phenomena? |
| Explanation depth | Scientific vocabulary used |
| Iteration behavior | Did they modify and retry? |
| Time to success | How long to achieve goal? |
| Help requests | When did they need hints? |

### Mastery Indicators by Grade

| Grade | Mastery Looks Like |
|-------|-------------------|
| K | Makes predictions, notices cause-effect |
| 1 | Uses basic vocabulary, compares outcomes |
| 2 | Explains using science words, fair tests |
| 3 | Identifies patterns, controls variables |
| 4 | Quantitative reasoning, graphs data |
| 5 | Designs investigations, evaluates evidence |
