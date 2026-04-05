/**
 * Engineering Catalog - Component definitions for engineering/STEM primitives
 *
 * Contains 4 simple machines and engineering concepts for K-5 STEM education.
 */

import { ComponentDefinition } from '../../../types';

export const ENGINEERING_CATALOG: ComponentDefinition[] = [
  {
    id: 'lever-lab',
    description: 'Interactive lever/fulcrum simulation for teaching simple machines. Students explore balance, mechanical advantage, and force trade-offs by manipulating loads, fulcrum position, and effort force. Features multiple themes (seesaw, excavator, crowbar) to connect abstract physics to real-world tools. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for elementary engineering and physics.',
    constraints: 'Best for grades K-5. Use for simple machines, balance concepts, mechanical advantage, force multiplication. Themes adapt complexity: seesaw for K-2 (basic balance), excavator/crowbar for 3-5 (mechanical advantage). Supports both exploration (movable fulcrum) and problem-solving (fixed challenges).',
    supportsEvaluation: true,
  },
  {
    id: 'pulley-system-builder',
    description: 'Interactive pulley system simulation for teaching mechanical advantage and simple machines. Students build and explore pulley configurations by adding fixed and movable pulleys, threading rope, and lifting loads. Shows how cranes, flagpoles, wells, and construction hoists work. Features multiple themes (crane, flagpole, well, construction) to connect physics to real-world applications. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching pulleys and mechanical advantage.',
    constraints: 'Best for grades K-5. Use for pulleys, mechanical advantage, force reduction, rope systems. Themes adapt complexity: flagpole for K-1 (direction change), well for 1-2 (fixed vs movable), crane/construction for 3-5 (mechanical advantage calculations). Supports exploration (add pulleys) and guided challenges (fixed configurations).',
    supportsEvaluation: true,
  },
  {
    id: 'ramp-lab',
    description: 'Interactive inclined plane (ramp) simulation for teaching simple machines. Students explore how ramps reduce the force needed to lift objects by trading distance for effort. Adjust angle, friction, and push force to see how steeper ramps require more force. Shows real-world connections: loading docks, wheelchair ramps (ADA), dump trucks, skateboard ramps. Features multiple themes (loading_dock, dump_truck, skateboard, generic) and load types (box, barrel, wheel). Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching inclined planes and force trade-offs.',
    constraints: 'Best for grades K-5. Use for inclined planes, ramps, force reduction, friction effects. K-1: rolling vs sliding exploration (wheel vs box). 1-2: steeper = harder to push. 2-3: height vs length trade-off. 4-5: mechanical advantage calculations, force decomposition. Themes adapt context: skateboard for fun exploration, loading_dock/dump_truck for real-world applications.',
    supportsEvaluation: true,
  },
  {
    id: 'wheel-axle-explorer',
    description: 'Interactive wheel and axle simulation for teaching simple machines and force multiplication. Students rotate wheels of different sizes connected to axles to discover how steering wheels, doorknobs, winches, and well cranks multiply force. Adjust wheel and axle diameters to see how larger wheels make turning easier. Attach loads to axle to simulate lifting with a winch. Shows real-world connections: steering wheel, doorknob, well crank, winch, screwdriver. Features multiple themes (steering_wheel, winch, doorknob, well_crank) to connect physics to everyday objects. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching wheel and axle machines and gear ratios.',
    constraints: 'Best for grades K-5. Use for wheel and axle, force multiplication, gear ratios. K-1: doorknobs are easier than handles (doorknob theme). 1-2: well cranks and turning (well_crank theme). 2-3: bigger wheel = easier turn (winch theme). 4-5: mechanical advantage calculations, gear ratio introduction (steering_wheel theme). Supports exploration (adjustable sizes) and challenges (fixed configurations with loads to lift).',
    supportsEvaluation: true,
  },
  {
    id: 'gear-train-builder',
    description: 'Interactive gear train sandbox for teaching speed/torque trade-offs fundamental to all machinery. Students place gears on a grid, connect them by proximity (auto-mesh), rotate driver gear, and watch followers spin. Count teeth and observe speed ratios. Build gear chains for specific ratios. Shows real-world connections: bicycle gears, clock mechanisms, wind-up toys, car transmissions. Features multiple themes (toy, machine, clock, bicycle) to connect engineering to everyday objects. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching gears, speed ratios, direction changes, and mechanical advantage.',
    constraints: 'Best for grades K-5. Use for gears, speed ratios, direction changes, torque trade-offs. K-1: gears turn together (toy theme, free play). 1-2: direction changes with each gear (showDirection). 2-3: big gear turns small gear fast (showSpeedRatio). 3-4: counting teeth for ratios (showTeethCount). 4-5: design challenges with specific output speeds (targetRatio). Supports free exploration and guided design challenges.',
    supportsEvaluation: true,
  },
  {
    id: 'bridge-builder',
    description: 'Interactive 2D bridge construction canvas for teaching structural engineering. Students place beams, cables, and supports to span gaps, then test bridges with loads (cars, trucks, trains) to see if they hold. Watch bridges deform under stress with color-coded feedback (green/yellow/red). Teaches triangles are strong, load distribution, and truss optimization. Shows real-world connections: highway bridges, railroad trestles, footbridges. Features multiple themes (construction, medieval, modern) to connect engineering to different contexts. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching structural engineering, forces, and design iteration.',
    constraints: 'Best for grades K-5. Use for bridges, structural engineering, trusses, load distribution. K-1: connect two sides (simple spanning). 1-2: supports at edges vs middle (support concepts). 2-3: triangles are strong (truss introduction). 3-4: load distribution concepts (stress visualization). 4-5: truss design optimization (budget constraints, efficiency). Supports free building exploration and guided design challenges with piece limits.',
    supportsEvaluation: true,
  },
  {
    id: 'tower-stacker',
    description: 'Interactive vertical building challenge for teaching stability and center of gravity. Students stack blocks, beams, triangles, and arches to reach target heights while maintaining stability. Features wind/shake test to check structural integrity. Shows center of gravity indicator to help students understand balance. Teaches wider base = more stable, center of gravity concepts, material efficiency, and wind resistance design. Shows real-world connections: skyscrapers, building construction, architecture. Features multiple themes (blocks, construction, city) to adapt to different age groups. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching structural stability, balance, and physics of building.',
    constraints: 'Best for grades K-5. Use for stacking, balance, stability, center of gravity, building design. K: simple stacking exploration (blocks theme, no wind). K-1: wider base = more stable (introduce stability concept). 2-3: center of gravity exploration (showCenterOfGravity: true). 3-4: material efficiency - height per piece (limited pieces). 4-5: wind resistance design (high wind strength, optimization). Supports free building and height challenges with piece limits.',
    supportsEvaluation: true,
  },
  {
    id: 'shape-strength-tester',
    description: 'Interactive experimental rig for testing shape strength under load. Students discover why triangles dominate structural engineering by testing different 2D shapes (triangle, square, pentagon, hexagon) in a compression frame. Watch shapes deform or hold under increasing loads. Add diagonal bracing to weak shapes and see them become rigid. Teaches shape recognition, triangles are rigid, squares squish, triangulation principles, and truss analysis. Shows real-world connections: bridge trusses, building frames, tower structures, bicycle geometry. Features multiple materials (straw, wood, steel) and joint types (pinned, rigid) to explore structural behavior. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching why triangles are strong and how triangulation provides structural stability.',
    constraints: 'Best for grades K-5. Use for shapes in structures, triangulation, truss analysis, structural rigidity. K-1: shape recognition, triangles vs squares (simple comparison). 1-2: squares squish, triangles don\'t (discovery). 2-3: adding diagonals makes shapes strong (introduce bracing). 3-4: triangulation principles (understand why diagonals help). 4-5: truss analysis and optimization (minimize bracing, maximize strength). Supports free exploration and guided challenges with target loads and shapes.',
    supportsEvaluation: true,
  },
  {
    id: 'foundation-builder',
    description: 'Interactive soil/foundation simulator for teaching why buildings need foundations and how engineers design them. Students select foundation types (spread, strip, slab, piles), adjust footing size, and test if their design supports the building without sinking. Different soil types (rock, gravel, sand, clay, mud) have different bearing capacities, teaching that soil matters. Calculate pressure = force ÷ area to understand how bigger footings reduce pressure on soil. Watch buildings settle/sink when pressure exceeds soil capacity. Teaches foundations spread weight like snowshoes, bigger footings = less pressure, soil types affect design, pressure calculations, and foundation optimization. Shows real-world connections: house footings, skyscraper foundations, deep piles for soft soil. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching foundations, pressure, and structural engineering fundamentals.',
    constraints: 'Best for grades K-5. Use for foundations, soil types, pressure calculations, structural support. K-1: buildings need foundations, bigger is better (discovery). 1-2: bigger footings spread weight (like snowshoes). 2-3: different soils are stronger or weaker (soil comparison). 3-4: pressure = force ÷ area calculations (introduce formula). 4-5: foundation optimization (minimal area that still works). Supports free design exploration and guided challenges with target loads and soil types.',
    supportsEvaluation: true,
  },
  {
    id: 'excavator-arm-simulator',
    description: 'Interactive multi-jointed excavator arm simulation with boom, stick, and bucket for teaching hydraulics, kinematics, and coordinated movement. Students control three joints (boom angle, stick angle, bucket angle) to position the bucket, dig material from different soil layers, lift loads, and dump at target zones. Features realistic Verlet physics for smooth arm movement. Material layers have different hardness values affecting excavation difficulty. Shows reach envelope to visualize workspace. Teaches cause and effect with joints, sequential operations (dig-lift-move-dump), joint coordination, reach and range concepts, efficiency optimization, and how excavators work. Shows real-world connections: construction excavators, backhoes, mining equipment, robotic arms. Features multiple control methods (sliders, buttons, drag) and themes (realistic, cartoon, blueprint) to adapt to different age groups. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching multi-jointed mechanisms, hydraulics, robotics, and construction equipment.',
    constraints: 'Best for grades K-5. Use for excavators, construction equipment, multi-joint systems, hydraulics, kinematics, robotics. K-1: cause and effect with joints, basic digging (buttons control, cartoon theme). 1-2: reach and range exploration (sliders, show reach envelope). 2-3: sequencing dig operations (dig-move-dump sequences, challenges). 3-4: joint angle coordination (all three joints working together, angles shown). 4-5: reach envelope and efficiency optimization (minimize operations, advanced challenges, blueprint theme). Supports free exploration and guided challenges with material excavation targets and dump zones.',
    supportsEvaluation: true,
  },
  {
    id: 'dump-truck-loader',
    description: 'Interactive dump truck loading and hauling simulation for teaching capacity, weight limits, and material transport efficiency. Students load material into the truck bed, monitor weight and volume capacity, drive to dump location, raise the bed to dump, and return for more loads. Features realistic Verlet physics for material particle simulation. Material types (dirt, gravel, sand, debris) have different densities affecting weight vs volume trade-offs. Teaches full and empty concepts, capacity constraints (weight AND volume), overloading consequences, counting loads, weight vs volume understanding, efficiency optimization (material per trip), and how dump trucks work. Shows real-world connections: construction sites, material delivery, landscaping, mining operations, waste management. Features multiple themes (realistic, cartoon, simple) to adapt to different age groups. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching capacity, material handling, weight concepts, and construction equipment.',
    constraints: 'Best for grades K-5. Use for dump trucks, capacity concepts, weight limits, material handling, construction equipment, efficiency. K: full and empty concepts (cartoon theme, simple loads). K-1: capacity and "too much" understanding (overload feedback). 1-2: counting loads, how many trips needed (target loads). 2-3: weight limits vs volume limits (different materials, show both). 3-4: material density understanding (gravel is heavier than debris for same volume). 4-5: efficiency optimization (maximize load size, minimize trips, time limits). Supports free exploration and guided challenges with material moving targets and efficiency goals.',
    supportsEvaluation: true,
  },
  {
    id: 'construction-sequence-planner',
    description: 'Interactive timeline/flowchart tool for ordering construction tasks and understanding dependencies. Students learn that building follows logical sequences by arranging tasks in order, drawing dependency arrows, and seeing what must come first. Features drag-and-drop task ordering, dependency visualization, sequence validation, and animated playthrough of construction steps. Teaches first-then-last sequencing, dependency understanding, parallel vs sequential task concepts, and critical path basics. Shows real-world connections: house construction, bridge building, project management, any multi-step construction project. Project types include house, bridge, tower, road, and playground. Features three learning phases: Explore (identify first task), Practice (order subset), Apply (complete sequence). Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching planning, sequencing, logical thinking, and construction project management.',
    constraints: 'Best for grades K-5. Use for construction sequencing, project planning, dependencies, logical ordering, critical path. K-1: first, then, last (3-4 simple tasks, list display). 1-2: some things must wait (4-5 tasks with simple dependencies, show arrows). 2-3: dependency chains (5-6 tasks, multiple dependencies, flowchart display). 3-4: parallel vs sequential (6-8 tasks, some can happen together, parallelAllowed: true). 4-5: critical path basics (8-10 tasks, timeline display, identify longest path). Supports progressive difficulty with three learning phases and animated sequence visualization.',
    supportsEvaluation: true,
  },
  {
    id: 'blueprint-canvas',
    description: 'Grid-based drawing surface for creating top-down and side-view technical drawings. Students learn to communicate designs before building by sketching floor plans, elevations, and sections with measurements. Features gridded canvas, snap-to-grid drawing, multiple view types (plan/elevation/section), dimension tools, and export functionality. Teaches bird\'s eye view concepts, floor plan drawing, measurement labeling, multiple view correspondence, scale drawing principles, and architectural communication. Shows real-world connections: architecture, engineering drawings, building design, technical documentation. Themes adapt to age: sketch (playful) for K-1, blueprint (classic blue) for 2-3, technical (professional) for 4-5. Perfect for K-5 engineering and NGSS design standards. ESSENTIAL for teaching technical drawing, spatial reasoning, and design communication.',
    constraints: 'Best for grades K-5. Use for floor plans, technical drawings, architectural design, spatial reasoning, scale drawings. K-1: bird\'s eye view concept, draw simple shapes for rooms (2-3 rooms, sketch theme, no measurements). 1-2: simple floor plans with walls and labels (3-4 rooms, show grid, snap enabled). 2-3: adding measurements and dimensions (4-5 rooms, blueprint theme, showMeasurements: true). 3-4: multiple views introduction, plan vs elevation (5-6 rooms, can switch viewType). 4-5: scale drawings and technical precision (6-7 rooms, technical theme, smaller gridScale, snapToGrid optional). Supports free drawing exploration and guided challenges with target room counts.',
    supportsEvaluation: true,
  },
  // Vehicles, Flight & Machines Primitives
  {
    id: 'machine-profile',
    description: 'Rich display profile for any vehicle or machine — the engineering equivalent of species-profile. Presents beautifully themed profiles for airplanes, trains, cars, ships, helicopters, submarines, bikes, bulldozers, spacecraft and more. Each profile includes specifications, how-it-works explanations, key components with fun analogies, history, fascinating facts, and real-world connections. Category-based color theming (10 categories) makes each machine type visually distinct. AI-generated machine illustrations. Perfect for K-5 vehicle and machine education. ESSENTIAL for answering "How does a [machine] work?" questions.',
    constraints: 'Best for grades K-5. Display-only (no direct evaluation). Use for any vehicle or machine topic: airplanes, cars, trains, ships, helicopters, trucks, submarines, bicycles, construction equipment, spacecraft. K-2: simple vocabulary, 2-3 sentence howItWorks, 3 keyComponents, fun analogies. 3-5: technical vocabulary, full paragraph howItWorks, 4-6 keyComponents, science connections.',
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
  },
  {
    id: 'flight-forces-explorer',
    description: 'Canvas particle-physics simulation of the four forces of flight. Hundreds of air particles stream around a wing cross-section in real time — particles above the wing move faster (visible lower pressure = lift). At high angle of attack particles detach and swirl to visualize stall. The plane moves up/down based on the live force balance. Force arrows emerge from the physics, not from labels. Controls: aircraft type (cessna, jumbo_jet, glider, fighter), thrust slider, angle of attack slider, cargo weight slider. Challenges are predict/observe/adjust MC questions. Perfect for K-5 flight and aerodynamics education. ESSENTIAL for answering "How does an airplane fly?"',
    constraints: 'Best for grades K-5. K-2: simple force names, tap-to-identify, no numeric values, 1-2 easy challenges. 3-5: real force magnitudes, quantitative challenges, stall exploration, aircraft comparison. Evaluable: tracks challenges completed, forces identified, states explored, stall discovery.',
    tutoring: {
      taskDescription: 'Student explores four forces of flight by adjusting thrust, angle of attack, and cargo weight while watching air particle flow around the wing.',
      contextKeys: ['aircraft', 'flightState', 'thrustPct', 'aoa', 'speed', 'altitude', 'stallCount', 'statesExplored', 'challengeProgress'],
      scaffoldingLevels: {
        level1: '"Watch the tiny air particles flowing over the wing. Do you see how the ones on top move faster?"',
        level2: '"Faster particles mean lower pressure above the wing. That pressure difference pushes the wing UP — that\'s lift! Now look at the force arrows."',
        level3: '"When lift is greater than weight, the plane climbs. When thrust is greater than drag, it speeds up. To fly level, you need lift = weight AND thrust = drag. Try adjusting the sliders to balance all four forces."',
      },
      commonStruggles: [
        { pattern: 'Doesn\'t connect particle speed to lift', response: '"Look closely at the particles above and below the wing. Which ones are moving faster? Faster air = lower pressure = the wing gets pushed UP."' },
        { pattern: 'Afraid to try high angle of attack', response: '"Go ahead — crank that angle up! Something cool happens when it gets too steep. The particles will show you exactly what a stall looks like."' },
        { pattern: 'Doesn\'t experiment with cargo weight', response: '"Try adding more cargo! Watch what happens to the weight arrow and the plane\'s altitude. Can you add thrust to compensate?"' },
        { pattern: 'Does not explore different aircraft profiles', response: '"Want to see how a glider is different from a jumbo jet? Try switching the aircraft!"' },
      ],
      aiDirectives: [
        {
          title: 'PARTICLE NARRATION',
          instruction: 'When you receive [ACTIVITY_START] or [AIRCRAFT_CHANGED], draw attention to the particle flow. When [AOA_CHANGED] or [AOA_STALL_ZONE], narrate what\'s happening to the particles. When [STALL], describe the swirling detachment dramatically but reassuringly.',
        },
        {
          title: 'CHALLENGE COACHING',
          instruction: 'When [CHALLENGE_CORRECT], celebrate and reinforce the physics. When [CHALLENGE_INCORRECT], give a particle-based hint. When [ALL_COMPLETE], summarize what the student discovered about forces.',
        },
        {
          title: 'CONTROL COACHING',
          instruction: 'When [THRUST_CHANGED] or [CARGO_CHANGED], briefly connect the slider change to the force arrows and particle behavior. Keep it to one sentence.',
        },
      ],
    },
    evalModes: [
      { evalMode: 'predict', label: 'Predict (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['predict'], description: 'Predict flight outcomes before testing' },
      { evalMode: 'observe', label: 'Observe (Medium)', beta: 0.0, scaffoldingMode: 3, challengeTypes: ['observe'], description: 'Watch particles and explain forces' },
      { evalMode: 'adjust', label: 'Adjust (Hard)', beta: 1.0, scaffoldingMode: 5, challengeTypes: ['adjust'], description: 'Set controls to achieve specific flight states' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'airfoil-lab',
    description: 'Wing cross-section in a simulated wind tunnel. Students change the wing shape, angle of attack, and airspeed to observe how lift is generated. Animated streamlines, color-coded pressure maps, and force gauges make the invisible physics of flight visible and tangible. Drag handles reshape the airfoil. Compare two airfoils side-by-side. Stall visualization at extreme angles. Teaches variable manipulation, observation, cause-and-effect. Perfect for grades 1-5 flight and aerodynamics education. ESSENTIAL for answering "Why is the wing shaped like that?"',
    constraints: 'Best for grades 1-5. 1-2: relative terms (more/less lift), flat vs curved comparison, no numeric coefficients. 3-5: quantitative results, Bernoulli\'s principle, design optimization challenges. Evaluable: tracks shapes explored, variables manipulated, predictions, stall discovery, challenge performance.',
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
    supportsEvaluation: true,
  },
  {
    id: 'vehicle-comparison-lab',
    description: 'Side-by-side vehicle comparison workspace with real data. Students compare airplanes, trains, cars, ships, bicycles, and spacecraft across speed, weight, capacity, range, and environmental impact. Bar charts, data tables, and challenge modes where students choose the best vehicle for a given scenario. Includes surprising facts that challenge assumptions. Perfect for K-5 data analysis and transportation education. ESSENTIAL for answering "Which is faster, a train or a plane?" with real data.',
    constraints: 'Best for grades K-5. K-2: 4-5 vehicles, simple "which is faster/bigger" comparisons, bar chart only. 3-5: 6-8 vehicles, trade-off analysis, environmental data, multi-constraint challenges. Evaluable: tracks vehicles compared, metrics explored, challenge performance, surprising facts discovered.',
    tutoring: {
      taskDescription: 'Compare vehicles using real data. Selected vehicles: {{selectedVehicles}}. Active metrics: {{activeMetrics}}. Phase: {{phase}}.',
      contextKeys: ['selectedVehicles', 'activeMetrics', 'phase', 'challengeActive', 'currentChallenge'],
      scaffoldingLevels: {
        level1: '"Look at the bar chart. Which vehicle has the tallest bar for speed?"',
        level2: '"The plane is fastest, but the train carries more people. Can you find a vehicle that\'s fast AND carries a lot of people?"',
        level3: '"No single vehicle is best at everything — that\'s called a trade-off. The best choice depends on what you need: speed, capacity, cost, or environmental impact."',
      },
      commonStruggles: [
        { pattern: 'Only compares two vehicles', response: '"Try adding a third vehicle! You might find some surprises. What about adding a bicycle or a ship?"' },
        { pattern: 'Focuses only on speed', response: '"Speed is fun, but what about passengers? A bicycle is slower than a plane, but it costs nothing and produces zero pollution!"' },
        { pattern: 'Struggles with challenge scenarios', response: '"Read the constraints carefully — how many passengers? How far? Then look at the data for each vehicle."' },
      ],
      aiDirectives: [
        {
          title: 'SURPRISING FACT NARRATION',
          instruction: 'When [SURPRISING_FACT], react with genuine enthusiasm. These facts should feel like "did you know?" moments. Example: "Whoa! A container ship carries as much cargo as 10,000 trucks? That\'s incredible!"',
        },
        {
          title: 'CHALLENGE COACHING',
          instruction: 'When [CHALLENGE_STARTED], introduce the scenario dramatically. When [CHALLENGE_COMPLETED], celebrate data-driven reasoning. When [CHALLENGE_INCORRECT], explain gently using the actual data from the vehicles.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'propulsion-lab',
    description: 'Interactive exploration of how vehicles generate thrust. Students see action/reaction force arrows for jets, propellers, wheels, sails, and rockets — all unified by Newton\'s Third Law. Toggle force arrow overlays, adjust throttle, compare propulsion types side-by-side, and test predictions in "What If?" experiments. Teaches that propellers need air but rockets work in vacuum. Perfect for grades 1-5 physics and engineering. ESSENTIAL for teaching Newton\'s Third Law through real vehicles.',
    constraints: 'Best for grades 1-5. 1-2: 4 propulsion types, simple push-backward/go-forward concept, everyday analogies. 3-5: 5-6 types including rocket (vacuum discussion), medium dependency, action/reaction identification, efficiency comparisons. Evaluable: tracks pairs identified, what-if accuracy, types explored, medium understanding.',
    tutoring: {
      taskDescription: 'Student explores Newton\'s Third Law by switching propulsion types (jet, rocket, propeller, sail) across mediums (air, water, vacuum) and watching particle physics.',
      contextKeys: ['propulsion', 'medium', 'throttle', 'speed', 'exploredCombos', 'noThrustMoments', 'challengeProgress'],
      scaffoldingLevels: {
        level1: '"Look at the tiny particles shooting out the back. What do you notice about them when you change the throttle?"',
        level2: '"Now try switching to the propeller and set the medium to vacuum. What happens to the particles? Why do you think the vehicle stopped moving?"',
        level3: '"The rocket carries its own particles to push out — it doesn\'t need air! But the propeller pushes AIR backward. No air, no push. Try each propulsion type in vacuum and see which ones still work."',
      },
      commonStruggles: [
        { pattern: 'Thinks propeller works in vacuum', response: '"Switch to the propeller and try vacuum — watch the particles. A propeller pushes air backward, but in vacuum there IS no air to push. What happens?"' },
        { pattern: 'Doesn\'t experiment with different mediums', response: '"You\'ve been using air the whole time! Try switching to vacuum — something really interesting happens with some propulsion types."' },
        { pattern: 'Doesn\'t connect exhaust particles to motion', response: '"Watch the particles carefully — they fly backward. Now look at the vehicle — it moves forward. Every particle that goes back pushes the vehicle forward. That\'s Newton\'s Third Law!"' },
        { pattern: 'Confuses action and reaction', response: '"The particles going backward ARE the action. The vehicle moving forward IS the reaction. More particles backward = more speed forward!"' },
      ],
      aiDirectives: [
        {
          title: 'ACTIVITY START',
          instruction: 'When [ACTIVITY_START], welcome the student and invite them to pick a propulsion type. Don\'t explain the physics yet — let them discover it.',
        },
        {
          title: 'PROPULSION CHANGED',
          instruction: 'When [PROPULSION_CHANGED], ask what they notice about the particles. Different propulsion types eject different particle patterns.',
        },
        {
          title: 'MEDIUM CHANGED',
          instruction: 'When [MEDIUM_CHANGED], ask what changed about the particles and the speed. Guide toward noticing that some propulsion types need a medium to push against.',
        },
        {
          title: 'THROTTLE HIGH',
          instruction: 'When [THROTTLE_HIGH], ask them to watch the particle rate and connect it to speed. More particles ejected = more thrust.',
        },
        {
          title: 'NO THRUST MOMENT',
          instruction: 'When [NO_THRUST], this is the key aha moment. The student has a propulsion type that doesn\'t work in the current medium (e.g., propeller in vacuum). Ask: "Why aren\'t there any particles? What does a propeller need to push against?"',
        },
        {
          title: 'CHALLENGE COACHING',
          instruction: 'When [CHALLENGE_CORRECT], celebrate and reinforce the physics principle. When [CHALLENGE_INCORRECT], don\'t reveal the answer — guide them to test it in the simulation.',
        },
        {
          title: 'ALL COMPLETE',
          instruction: 'When [ALL_COMPLETE], summarize what they discovered about Newton\'s Third Law and how different propulsion types work.',
        },
      ],
    },
    evalModes: [
      { evalMode: 'predict', label: 'Predict (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['predict'], description: 'Predict what will happen before testing' },
      { evalMode: 'observe', label: 'Observe (Medium)', beta: 0.0, scaffoldingMode: 3, challengeTypes: ['observe'], description: 'Watch particles and explain what you see' },
      { evalMode: 'experiment', label: 'Experiment (Hard)', beta: 1.0, scaffoldingMode: 5, challengeTypes: ['experiment'], description: 'Design experiments to test hypotheses' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'propulsion-timeline',
    description: 'Interactive timeline showing the evolution of transportation from walking to spacecraft. Scrub through eras, tap milestones for detail cards, filter by domain (land/sea/air/space), trace innovation chains showing how one invention enabled the next, complete chronological ordering challenges, and observe exponential speed record growth. Period-accurate vehicle descriptions with real dates and speeds. Perfect for K-5 history and engineering education. ESSENTIAL for teaching innovation history and technological progress.',
    constraints: 'Best for grades K-5. K-2: 6-8 milestones, simple sequencing with 4 items, 1 innovation chain. 3-5: 10-15 milestones, complex sequencing with 5-6 items, 2-3 innovation chains, speed record analysis. Evaluable: tracks milestones explored, sequencing accuracy, chains traced, domains explored, speed trend observation.',
    tutoring: {
      taskDescription: 'Explore the history of transportation. Phase: {{phase}}. Selected milestone: {{selectedMilestone}}. Milestones explored: {{milestonesExplored}}/{{milestonesTotal}}.',
      contextKeys: ['phase', 'selectedMilestone', 'milestonesExplored', 'milestonesTotal', 'domainFilter'],
      scaffoldingLevels: {
        level1: '"Tap a milestone on the timeline to learn about it! Start with one that looks interesting."',
        level2: '"Notice how each invention builds on the one before it. The steam engine made trains possible, and trains made it possible to build factories far from rivers."',
        level3: '"Innovation is a chain — each breakthrough enables the next. The wheel led to carts, carts led to roads, roads led to cars. What do you think comes after electric cars?"',
      },
      commonStruggles: [
        { pattern: 'Only explores one domain', response: '"You\'ve been looking at {{domainFilter}} vehicles — try switching to a different domain! How did sea travel change over time?"' },
        { pattern: 'Struggles with sequencing', response: '"Think about the technology needed. Could you have a jet engine before you discovered how to burn fuel? What had to come first?"' },
        { pattern: 'Doesn\'t notice speed trends', response: '"Look at the speed numbers as you go through time. Walking: 5 km/h. Horse: 40 km/h. Train: 200 km/h. Plane: 900 km/h. Rocket: 28,000 km/h! What pattern do you notice?"' },
      ],
      aiDirectives: [
        {
          title: 'MILESTONE NARRATION',
          instruction: 'When [MILESTONE_EXPLORED], narrate with storytelling flair. Make it vivid: "In 1903, two brothers from Ohio built a wooden airplane and flew for just 12 seconds. TWELVE SECONDS changed everything!"',
        },
        {
          title: 'INNOVATION CHAIN NARRATION',
          instruction: 'When [INNOVATION_CHAIN], trace the cause-and-effect chain as a story. Help the student see that each invention was only possible because of the ones that came before.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'paper-airplane-designer',
    description: 'Interactive paper airplane design lab where students choose templates (dart, glider, stunt, wide body), customize wing geometry and fold parameters, then launch in simulated flight tests. Performance metrics (distance, hang time, stability, accuracy) drive iterative improvement. Tracks design iterations and variable isolation. Perfect for teaching the engineering design process and scientific method. ESSENTIAL for K-5 engineering and design thinking.',
    constraints: 'Requires understanding of the 4-phase workflow: build → launch → analyze → iterate. Flight simulation is approximate — focus is on the design process, not physics accuracy.',
    tutoring: {
      taskDescription: 'Student is designing and testing paper airplanes using the {{template}} template (version {{designVersion}}). Current design: nose angle {{designParameters.noseAngle.value}}°, wing span {{designParameters.wingSpan.value}}cm, wing angle {{designParameters.wingAngle.value}}°. They have completed {{flightLog.length}} flights so far.',
      contextKeys: ['template', 'designParameters', 'launchSettings', 'flightLog', 'designVersion', 'currentResults', 'challenges', 'gradeBand'],
      scaffoldingLevels: {
        level1: '"What do you think will happen if you make the wings a bit wider? Try it and see!"',
        level2: '"Last time you changed the nose angle and the wing span together. Pick just ONE to change — that way you\'ll know exactly what made the difference."',
        level3: '"Let\'s try this step by step: 1) Look at your flight log — which design flew farthest? 2) What was different about that design? 3) Now change just that one thing and test again."',
      },
      commonStruggles: [
        { pattern: 'Student changes multiple variables between tests', response: 'Point out which variables changed and suggest isolating one. Ask: Which change do you think mattered most?' },
        { pattern: 'Student keeps using same template without modifying parameters', response: 'Encourage experimentation: What happens if you move just the wing span slider? Make a prediction first!' },
        { pattern: 'Student does not review flight log before iterating', response: 'Prompt them to open the flight log: Your best flight was design #X — what was special about it?' },
        { pattern: 'Student frustrated by decreasing performance', response: 'Normalize setbacks: Engineers learn from every test! Look at what changed — that tells you what NOT to do next time.' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'engine-explorer',
    description: 'Living Engine particle simulation — students watch water/fuel particles heat up, build pressure, push a piston, and turn a drive wheel. Canvas-based physics with fuel and load sliders that have real consequences. Interactive zone exploration and MC challenges. Perfect for teaching energy transformation, cause-and-effect, and mechanical systems. ESSENTIAL for grades 1-5 engineering and physics.',
    constraints: 'Requires engineType. Zone descriptions, challenges, and energyFlow are generated content. Engine geometry and particle physics are hardcoded per engine type in the component.',
    tutoring: {
      taskDescription: 'Student is exploring a living {{engineName}} ({{engineType}}) simulation for {{vehicleContext}}. Fuel: {{fuelLevel}}%, Load: {{loadLevel}}%, Wheel: {{wheelRPM}} RPM. Zones explored: {{zonesExplored}}. Selected zone: {{selectedZone}}. Challenge progress: {{challengeProgress}}.',
      contextKeys: ['engineType', 'engineName', 'vehicleContext', 'fuelLevel', 'loadLevel', 'wheelRPM', 'zonesExplored', 'selectedZone', 'challengeProgress'],
      scaffoldingLevels: {
        level1: '"What do you notice about the particles when you add more fuel?" or "Tap on a zone to learn what it does!"',
        level2: '"Watch the particles in the boiler — see how they speed up and change color? That is the water turning into steam! Now follow them through the pipe to the piston."',
        level3: '"Let me trace the energy for you: The fire heats water in the boiler until it becomes steam. The steam rushes through the pipe into the cylinder. There, it pushes against the piston — see the particles bouncing off it? The piston pushes the connecting rod, which turns the wheel. Then the steam cools in the condenser and returns as water. It is a cycle!"',
      },
      commonStruggles: [
        { pattern: 'Student leaves fuel at default without experimenting', response: 'Prompt: "Try cranking the coal all the way up — what happens to the particles? Now try turning it way down."' },
        { pattern: 'Student has not tapped any zones to learn about them', response: 'Highlight that zones are tappable: "See those labeled areas? Tap on the Boiler to find out what is happening to the particles inside!"' },
        { pattern: 'Engine stalled from too much load and too little fuel', response: 'Guide: "The engine stopped! The load is too heavy. What could you do? Try adding more fuel to build more steam pressure."' },
        { pattern: 'Student struggles with challenge questions', response: 'Connect the question to what they can see: "Look at the simulation right now — watch what the particles do when you change the fuel. That will help you answer!"' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'hydraulics-lab',
    description: 'Living Hydraulics particle simulation — students watch fluid particles transmit pressure between two connected pistons of different sizes. Canvas-based physics with input force, piston diameter, and load sliders that have real consequences. Demonstrates Pascal\'s Law (F₁/A₁ = F₂/A₂), force multiplication, and work conservation. Interactive zone exploration and MC challenges. Four scenarios: hydraulic press, car lift, excavator, brake system. Perfect for teaching fluid mechanics, force multiplication, and mechanical advantage. ESSENTIAL for grades 3-8 engineering and physics.',
    constraints: 'Requires scenario type. Zone descriptions, challenges, and Pascal\'s Law explanation are generated content. Hydraulic geometry, particle physics, and force calculations are hardcoded in the component.',
    evalModes: [
      {
        evalMode: 'predict',
        label: 'Predict (Easy)',
        beta: -1.0,
        scaffoldingMode: 1,
        challengeTypes: ['predict'],
        description: 'Predict hydraulic outcomes before testing',
      },
      {
        evalMode: 'observe',
        label: 'Observe (Medium)',
        beta: 0.0,
        scaffoldingMode: 3,
        challengeTypes: ['observe'],
        description: 'Watch fluid particles and explain pressure transmission',
      },
      {
        evalMode: 'adjust',
        label: 'Adjust (Hard)',
        beta: 1.0,
        scaffoldingMode: 5,
        challengeTypes: ['adjust'],
        description: 'Set piston sizes and forces to achieve specific outputs',
      },
    ],
    tutoring: {
      taskDescription: 'Student is exploring a living hydraulic system simulation ({{scenarioName}}) for {{realWorldContext}}. Input force: {{inputForce}}N, Small piston: {{smallDiameter}}cm, Large piston: {{largeDiameter}}cm, Load: {{loadWeight}}kg. Output force: {{outputForce}}N, Force ratio: {{forceRatio}}x, Lifting: {{isLifting}}. Zones explored: {{zonesExplored}}. Selected zone: {{selectedZone}}. Challenge progress: {{challengeProgress}}.',
      contextKeys: ['scenario', 'scenarioName', 'realWorldContext', 'inputForce', 'smallDiameter', 'largeDiameter', 'loadWeight', 'systemPressure', 'outputForce', 'forceRatio', 'isLifting', 'zonesExplored', 'challengeProgress', 'selectedZone'],
      scaffoldingLevels: {
        level1: '"What do you notice about the fluid particles when you push harder on the small piston?"',
        level2: '"Watch the force arrows — the input arrow is small but the output arrow is much bigger! That\'s because the large piston has a bigger area. More area means more force from the same pressure."',
        level3: '"Pascal\'s Law says pressure is the same everywhere in the fluid. Pressure = Force ÷ Area. So if you push 100N on a 10cm² piston, the pressure is 10 N/cm². That same 10 N/cm² pushes on the big piston — and if it\'s 100cm², the output force is 10 × 100 = 1000N! That\'s why hydraulic machines are so powerful."',
      },
      commonStruggles: [
        { pattern: 'Student has not adjusted any sliders', response: 'Try pushing on the small piston! Drag the Input Force slider to see what happens to the particles and the large piston.' },
        { pattern: 'Student has not explored zones', response: 'Tap on the pistons and the pipe to learn what each part does!' },
        { pattern: 'Student cannot lift the load', response: 'The output force needs to be bigger than the load weight. Try making the large piston wider or pushing harder on the small piston.' },
        { pattern: 'Student confused about area vs diameter', response: 'Remember, area grows much faster than diameter because it depends on radius SQUARED. Doubling the diameter makes the area 4 times bigger!' },
      ],
      aiDirectives: [
        {
          title: 'ACTIVITY START',
          instruction: 'When [ACTIVITY_START], welcome the student and point out the two pistons and the fluid particles connecting them. Don\'t explain Pascal\'s Law yet — let them discover it.',
        },
        {
          title: 'ZONE EXPLORED',
          instruction: 'When [ZONE_EXPLORED], explain that zone with an analogy and connect it to Pascal\'s Law. Keep it conversational.',
        },
        {
          title: 'FORCE CHANGED',
          instruction: 'When [FORCE_CHANGED], draw attention to the particle color change and the output force arrow growing. Ask what they notice.',
        },
        {
          title: 'PISTON SIZE CHANGED',
          instruction: 'When [PISTON_SIZE_CHANGED], ask them to watch the force ratio change. Bigger area difference = bigger force multiplication.',
        },
        {
          title: 'LOAD CHANGED',
          instruction: 'When [LOAD_CHANGED], ask what happens when the load exceeds the output force. Guide them to increase force or piston size.',
        },
        {
          title: 'FORCE MULTIPLICATION DISCOVERED',
          instruction: 'When [FORCE_MULTIPLICATION_DISCOVERED], celebrate the >5:1 ratio achievement. This is the key aha moment — small force in, huge force out!',
        },
        {
          title: 'WORK CONSERVATION',
          instruction: 'When [WORK_CONSERVATION_MOMENT], explain that more force comes with less distance — the large piston moves less than the small one. Same work, different trade-off.',
        },
        {
          title: 'CHALLENGE COACHING',
          instruction: 'When [CHALLENGE_CORRECT], celebrate and reinforce Pascal\'s Law. When [CHALLENGE_INCORRECT], don\'t reveal the answer — guide them to test it in the simulation.',
        },
        {
          title: 'ALL COMPLETE',
          instruction: 'When [ALL_COMPLETE], summarize Pascal\'s Law and how hydraulic machines use it to multiply force. Connect to real-world hydraulic systems.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'vehicle-design-studio',
    description: 'Engineering design process studio where students pick vehicle body, propulsion, and control parts then test against physics simulation. Includes radar performance chart, design log for iteration tracking, and challenge mode with constraints. Perfect for teaching the engineering design cycle (design \u2192 test \u2192 analyze \u2192 iterate), trade-off analysis, and systematic testing. ESSENTIAL for grades 2-5 engineering and design thinking.',
    constraints: 'Requires partsPalette with bodies, propulsion, and controls arrays. Each part needs numeric physics values. Challenges optional but recommended for grade 4-5.',
    tutoring: {
      taskDescription: 'Student is designing a {{domain}} vehicle. They select parts from a palette (body: {{selectedBody}}, propulsion: {{selectedPropulsion}}, controls: {{selectedControls}}) and test their design. Current simulation shows {{latestSimulation}}. This is iteration {{designIterations}}. Active challenge: {{activeChallenge}}.',
      contextKeys: ['domain', 'selectedBody', 'selectedPropulsion', 'selectedControls', 'latestSimulation', 'designIterations', 'activeChallenge', 'constraintsMet'],
      scaffoldingLevels: {
        level1: '"What do you think will happen if you test this design? Which metric do you think will be strongest?"',
        level2: '"Look at your stability score \u2014 it\'s {{latestSimulation.stability}}. What controls could you add to improve it? Remember, adding weight affects speed too."',
        level3: '"Let\'s think step by step. Your vehicle weighs {{latestSimulation.totalWeight}}kg. The constraint says max {{activeChallenge.constraints.maxWeight}}kg. You need to either pick a lighter body or remove a control part. Try swapping just the body first \u2014 that way you\'ll know exactly what changed."',
      },
      commonStruggles: [
        { pattern: 'Student changes multiple parts between tests', response: 'Encourage changing only one variable at a time so they can see what each change does to performance.' },
        { pattern: 'Student ignores low stability scores and only focuses on speed', response: 'Ask what happens in real life when a vehicle is unstable. Guide them to notice the stability metric.' },
        { pattern: 'Student does not use the design log to compare iterations', response: 'Suggest opening the design log to compare their current results with previous tests.' },
        { pattern: 'Student is stuck and cannot meet constraints', response: 'Help them identify which constraint is hardest to meet, then focus on that one metric first.' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'transport-challenge',
    description: 'Living transport simulation where students pick vehicles and watch animated trips play out. Students see 50 cars making round trips vs 2 buses vs 1 plane — the visual IS the explanation. Constraint bars (budget, time, CO₂) fill in real-time. Comparison tables reveal trade-offs. Perfect for K-5 engineering, logistics, and data-driven decision making. ESSENTIAL for teaching constraint analysis and transport planning.',
    constraints: 'Best for grades 3-5. Use for transport logistics, constraint-based decisions, trade-off analysis, data comparison. Easy: single constraint, obvious answer. Medium: 2-3 constraints, multiple viable options. Hard: all constraints active, no perfect answer. Vehicles include cars, buses, vans, trains, planes with realistic capacity/speed/cost/CO2 data.',
    evalModes: [
      {
        evalMode: 'single_constraint',
        label: 'Single Constraint (Easy)',
        beta: -1.5,
        scaffoldingMode: 1,
        challengeTypes: ['single_constraint'],
        description: 'One constraint dominates, one obvious best vehicle',
      },
      {
        evalMode: 'multi_constraint',
        label: 'Multi Constraint (Medium)',
        beta: 0.0,
        scaffoldingMode: 3,
        challengeTypes: ['multi_constraint'],
        description: 'Multiple constraints create trade-offs between vehicles',
      },
      {
        evalMode: 'full_optimization',
        label: 'Full Optimization (Hard)',
        beta: 1.5,
        scaffoldingMode: 5,
        challengeTypes: ['full_optimization'],
        description: 'All constraints active, no perfect answer, must prioritize',
      },
    ],
    tutoring: {
      taskDescription: 'Student is choosing vehicles to transport {{peopleToTransport}} people from {{origin}} to {{destination}} under constraints: {{constraints}}. They watch an animated simulation showing vehicles making round trips.',
      contextKeys: ['currentScenario', 'origin', 'destination', 'people', 'constraints'],
      scaffoldingLevels: {
        level1: '"How many trips do you think that vehicle would need? Look at its capacity."',
        level2: '"Let\'s check the numbers: {{capacity}} people per trip for {{peopleToTransport}} people means... how many trips? Now multiply by the cost per trip."',
        level3: '"This vehicle carries {{capacity}} people. For {{peopleToTransport}} people, that\'s {{trips}} trips. Each trip costs ${{costPerTrip}}, so total = {{trips}} × ${{costPerTrip}} = ${{totalCost}}. Does that fit the budget?"',
      },
      commonStruggles: [
        { pattern: 'Student picks the fastest vehicle without checking budget', response: 'Ask: "That vehicle is fast! But how much will all those trips cost? Let\'s check the budget constraint."' },
        { pattern: 'Student picks the cheapest per-trip vehicle without considering total trips', response: 'Ask: "That vehicle is cheap per trip, but how many trips will it need? What\'s the TOTAL cost?"' },
        { pattern: 'Student ignores CO2 constraint', response: 'Point to the CO₂ bar: "Don\'t forget the environmental limit! How much CO₂ does each trip produce?"' },
      ],
    },
    supportsEvaluation: true,
  },
];
