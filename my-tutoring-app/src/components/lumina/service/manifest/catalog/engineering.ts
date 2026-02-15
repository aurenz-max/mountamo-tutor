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
    constraints: 'Best for grades K-5. Use for simple machines, balance concepts, mechanical advantage, force multiplication. Themes adapt complexity: seesaw for K-2 (basic balance), excavator/crowbar for 3-5 (mechanical advantage). Supports both exploration (movable fulcrum) and problem-solving (fixed challenges).'
  },
  {
    id: 'pulley-system-builder',
    description: 'Interactive pulley system simulation for teaching mechanical advantage and simple machines. Students build and explore pulley configurations by adding fixed and movable pulleys, threading rope, and lifting loads. Shows how cranes, flagpoles, wells, and construction hoists work. Features multiple themes (crane, flagpole, well, construction) to connect physics to real-world applications. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching pulleys and mechanical advantage.',
    constraints: 'Best for grades K-5. Use for pulleys, mechanical advantage, force reduction, rope systems. Themes adapt complexity: flagpole for K-1 (direction change), well for 1-2 (fixed vs movable), crane/construction for 3-5 (mechanical advantage calculations). Supports exploration (add pulleys) and guided challenges (fixed configurations).'
  },
  {
    id: 'ramp-lab',
    description: 'Interactive inclined plane (ramp) simulation for teaching simple machines. Students explore how ramps reduce the force needed to lift objects by trading distance for effort. Adjust angle, friction, and push force to see how steeper ramps require more force. Shows real-world connections: loading docks, wheelchair ramps (ADA), dump trucks, skateboard ramps. Features multiple themes (loading_dock, dump_truck, skateboard, generic) and load types (box, barrel, wheel). Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching inclined planes and force trade-offs.',
    constraints: 'Best for grades K-5. Use for inclined planes, ramps, force reduction, friction effects. K-1: rolling vs sliding exploration (wheel vs box). 1-2: steeper = harder to push. 2-3: height vs length trade-off. 4-5: mechanical advantage calculations, force decomposition. Themes adapt context: skateboard for fun exploration, loading_dock/dump_truck for real-world applications.'
  },
  {
    id: 'wheel-axle-explorer',
    description: 'Interactive wheel and axle simulation for teaching simple machines and force multiplication. Students rotate wheels of different sizes connected to axles to discover how steering wheels, doorknobs, winches, and well cranks multiply force. Adjust wheel and axle diameters to see how larger wheels make turning easier. Attach loads to axle to simulate lifting with a winch. Shows real-world connections: steering wheel, doorknob, well crank, winch, screwdriver. Features multiple themes (steering_wheel, winch, doorknob, well_crank) to connect physics to everyday objects. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching wheel and axle machines and gear ratios.',
    constraints: 'Best for grades K-5. Use for wheel and axle, force multiplication, gear ratios. K-1: doorknobs are easier than handles (doorknob theme). 1-2: well cranks and turning (well_crank theme). 2-3: bigger wheel = easier turn (winch theme). 4-5: mechanical advantage calculations, gear ratio introduction (steering_wheel theme). Supports exploration (adjustable sizes) and challenges (fixed configurations with loads to lift).'
  },
  {
    id: 'gear-train-builder',
    description: 'Interactive gear train sandbox for teaching speed/torque trade-offs fundamental to all machinery. Students place gears on a grid, connect them by proximity (auto-mesh), rotate driver gear, and watch followers spin. Count teeth and observe speed ratios. Build gear chains for specific ratios. Shows real-world connections: bicycle gears, clock mechanisms, wind-up toys, car transmissions. Features multiple themes (toy, machine, clock, bicycle) to connect engineering to everyday objects. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching gears, speed ratios, direction changes, and mechanical advantage.',
    constraints: 'Best for grades K-5. Use for gears, speed ratios, direction changes, torque trade-offs. K-1: gears turn together (toy theme, free play). 1-2: direction changes with each gear (showDirection). 2-3: big gear turns small gear fast (showSpeedRatio). 3-4: counting teeth for ratios (showTeethCount). 4-5: design challenges with specific output speeds (targetRatio). Supports free exploration and guided design challenges.'
  },
  {
    id: 'bridge-builder',
    description: 'Interactive 2D bridge construction canvas for teaching structural engineering. Students place beams, cables, and supports to span gaps, then test bridges with loads (cars, trucks, trains) to see if they hold. Watch bridges deform under stress with color-coded feedback (green/yellow/red). Teaches triangles are strong, load distribution, and truss optimization. Shows real-world connections: highway bridges, railroad trestles, footbridges. Features multiple themes (construction, medieval, modern) to connect engineering to different contexts. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching structural engineering, forces, and design iteration.',
    constraints: 'Best for grades K-5. Use for bridges, structural engineering, trusses, load distribution. K-1: connect two sides (simple spanning). 1-2: supports at edges vs middle (support concepts). 2-3: triangles are strong (truss introduction). 3-4: load distribution concepts (stress visualization). 4-5: truss design optimization (budget constraints, efficiency). Supports free building exploration and guided design challenges with piece limits.'
  },
  {
    id: 'tower-stacker',
    description: 'Interactive vertical building challenge for teaching stability and center of gravity. Students stack blocks, beams, triangles, and arches to reach target heights while maintaining stability. Features wind/shake test to check structural integrity. Shows center of gravity indicator to help students understand balance. Teaches wider base = more stable, center of gravity concepts, material efficiency, and wind resistance design. Shows real-world connections: skyscrapers, building construction, architecture. Features multiple themes (blocks, construction, city) to adapt to different age groups. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching structural stability, balance, and physics of building.',
    constraints: 'Best for grades K-5. Use for stacking, balance, stability, center of gravity, building design. K: simple stacking exploration (blocks theme, no wind). K-1: wider base = more stable (introduce stability concept). 2-3: center of gravity exploration (showCenterOfGravity: true). 3-4: material efficiency - height per piece (limited pieces). 4-5: wind resistance design (high wind strength, optimization). Supports free building and height challenges with piece limits.'
  },
  {
    id: 'shape-strength-tester',
    description: 'Interactive experimental rig for testing shape strength under load. Students discover why triangles dominate structural engineering by testing different 2D shapes (triangle, square, pentagon, hexagon) in a compression frame. Watch shapes deform or hold under increasing loads. Add diagonal bracing to weak shapes and see them become rigid. Teaches shape recognition, triangles are rigid, squares squish, triangulation principles, and truss analysis. Shows real-world connections: bridge trusses, building frames, tower structures, bicycle geometry. Features multiple materials (straw, wood, steel) and joint types (pinned, rigid) to explore structural behavior. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching why triangles are strong and how triangulation provides structural stability.',
    constraints: 'Best for grades K-5. Use for shapes in structures, triangulation, truss analysis, structural rigidity. K-1: shape recognition, triangles vs squares (simple comparison). 1-2: squares squish, triangles don\'t (discovery). 2-3: adding diagonals makes shapes strong (introduce bracing). 3-4: triangulation principles (understand why diagonals help). 4-5: truss analysis and optimization (minimize bracing, maximize strength). Supports free exploration and guided challenges with target loads and shapes.'
  },
  {
    id: 'foundation-builder',
    description: 'Interactive soil/foundation simulator for teaching why buildings need foundations and how engineers design them. Students select foundation types (spread, strip, slab, piles), adjust footing size, and test if their design supports the building without sinking. Different soil types (rock, gravel, sand, clay, mud) have different bearing capacities, teaching that soil matters. Calculate pressure = force ÷ area to understand how bigger footings reduce pressure on soil. Watch buildings settle/sink when pressure exceeds soil capacity. Teaches foundations spread weight like snowshoes, bigger footings = less pressure, soil types affect design, pressure calculations, and foundation optimization. Shows real-world connections: house footings, skyscraper foundations, deep piles for soft soil. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching foundations, pressure, and structural engineering fundamentals.',
    constraints: 'Best for grades K-5. Use for foundations, soil types, pressure calculations, structural support. K-1: buildings need foundations, bigger is better (discovery). 1-2: bigger footings spread weight (like snowshoes). 2-3: different soils are stronger or weaker (soil comparison). 3-4: pressure = force ÷ area calculations (introduce formula). 4-5: foundation optimization (minimal area that still works). Supports free design exploration and guided challenges with target loads and soil types.'
  },
  {
    id: 'excavator-arm-simulator',
    description: 'Interactive multi-jointed excavator arm simulation with boom, stick, and bucket for teaching hydraulics, kinematics, and coordinated movement. Students control three joints (boom angle, stick angle, bucket angle) to position the bucket, dig material from different soil layers, lift loads, and dump at target zones. Features realistic Verlet physics for smooth arm movement. Material layers have different hardness values affecting excavation difficulty. Shows reach envelope to visualize workspace. Teaches cause and effect with joints, sequential operations (dig-lift-move-dump), joint coordination, reach and range concepts, efficiency optimization, and how excavators work. Shows real-world connections: construction excavators, backhoes, mining equipment, robotic arms. Features multiple control methods (sliders, buttons, drag) and themes (realistic, cartoon, blueprint) to adapt to different age groups. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching multi-jointed mechanisms, hydraulics, robotics, and construction equipment.',
    constraints: 'Best for grades K-5. Use for excavators, construction equipment, multi-joint systems, hydraulics, kinematics, robotics. K-1: cause and effect with joints, basic digging (buttons control, cartoon theme). 1-2: reach and range exploration (sliders, show reach envelope). 2-3: sequencing dig operations (dig-move-dump sequences, challenges). 3-4: joint angle coordination (all three joints working together, angles shown). 4-5: reach envelope and efficiency optimization (minimize operations, advanced challenges, blueprint theme). Supports free exploration and guided challenges with material excavation targets and dump zones.'
  },
  {
    id: 'dump-truck-loader',
    description: 'Interactive dump truck loading and hauling simulation for teaching capacity, weight limits, and material transport efficiency. Students load material into the truck bed, monitor weight and volume capacity, drive to dump location, raise the bed to dump, and return for more loads. Features realistic Verlet physics for material particle simulation. Material types (dirt, gravel, sand, debris) have different densities affecting weight vs volume trade-offs. Teaches full and empty concepts, capacity constraints (weight AND volume), overloading consequences, counting loads, weight vs volume understanding, efficiency optimization (material per trip), and how dump trucks work. Shows real-world connections: construction sites, material delivery, landscaping, mining operations, waste management. Features multiple themes (realistic, cartoon, simple) to adapt to different age groups. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching capacity, material handling, weight concepts, and construction equipment.',
    constraints: 'Best for grades K-5. Use for dump trucks, capacity concepts, weight limits, material handling, construction equipment, efficiency. K: full and empty concepts (cartoon theme, simple loads). K-1: capacity and "too much" understanding (overload feedback). 1-2: counting loads, how many trips needed (target loads). 2-3: weight limits vs volume limits (different materials, show both). 3-4: material density understanding (gravel is heavier than debris for same volume). 4-5: efficiency optimization (maximize load size, minimize trips, time limits). Supports free exploration and guided challenges with material moving targets and efficiency goals.'
  },
  {
    id: 'construction-sequence-planner',
    description: 'Interactive timeline/flowchart tool for ordering construction tasks and understanding dependencies. Students learn that building follows logical sequences by arranging tasks in order, drawing dependency arrows, and seeing what must come first. Features drag-and-drop task ordering, dependency visualization, sequence validation, and animated playthrough of construction steps. Teaches first-then-last sequencing, dependency understanding, parallel vs sequential task concepts, and critical path basics. Shows real-world connections: house construction, bridge building, project management, any multi-step construction project. Project types include house, bridge, tower, road, and playground. Features three learning phases: Explore (identify first task), Practice (order subset), Apply (complete sequence). Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching planning, sequencing, logical thinking, and construction project management.',
    constraints: 'Best for grades K-5. Use for construction sequencing, project planning, dependencies, logical ordering, critical path. K-1: first, then, last (3-4 simple tasks, list display). 1-2: some things must wait (4-5 tasks with simple dependencies, show arrows). 2-3: dependency chains (5-6 tasks, multiple dependencies, flowchart display). 3-4: parallel vs sequential (6-8 tasks, some can happen together, parallelAllowed: true). 4-5: critical path basics (8-10 tasks, timeline display, identify longest path). Supports progressive difficulty with three learning phases and animated sequence visualization.'
  },
  {
    id: 'blueprint-canvas',
    description: 'Grid-based drawing surface for creating top-down and side-view technical drawings. Students learn to communicate designs before building by sketching floor plans, elevations, and sections with measurements. Features gridded canvas, snap-to-grid drawing, multiple view types (plan/elevation/section), dimension tools, and export functionality. Teaches bird\'s eye view concepts, floor plan drawing, measurement labeling, multiple view correspondence, scale drawing principles, and architectural communication. Shows real-world connections: architecture, engineering drawings, building design, technical documentation. Themes adapt to age: sketch (playful) for K-1, blueprint (classic blue) for 2-3, technical (professional) for 4-5. Perfect for K-5 engineering and NGSS design standards. ESSENTIAL for teaching technical drawing, spatial reasoning, and design communication.',
    constraints: 'Best for grades K-5. Use for floor plans, technical drawings, architectural design, spatial reasoning, scale drawings. K-1: bird\'s eye view concept, draw simple shapes for rooms (2-3 rooms, sketch theme, no measurements). 1-2: simple floor plans with walls and labels (3-4 rooms, show grid, snap enabled). 2-3: adding measurements and dimensions (4-5 rooms, blueprint theme, showMeasurements: true). 3-4: multiple views introduction, plan vs elevation (5-6 rooms, can switch viewType). 4-5: scale drawings and technical precision (6-7 rooms, technical theme, smaller gridScale, snapToGrid optional). Supports free drawing exploration and guided challenges with target room counts.'
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
    description: 'Interactive four forces of flight visualization. Students manipulate thrust, angle of attack, and cargo loading to see how lift, weight, thrust, and drag determine flight behavior. Color-coded force arrows grow/shrink proportionally. Flight state indicator shows climbing, cruising, descending, or stalled. Includes challenge mode where students must achieve specific flight conditions. Compare different aircraft profiles. Teaches force balance, cause-and-effect, and aerodynamic fundamentals. Perfect for K-5 flight and aerodynamics education. ESSENTIAL for answering "How does an airplane fly?"',
    constraints: 'Best for grades K-5. K-2: simple force names, tap-to-identify, no numeric values, 1-2 easy challenges. 3-5: real force magnitudes, quantitative challenges, stall exploration, aircraft comparison. Evaluable: tracks challenges completed, forces identified, states explored, stall discovery.',
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
  },
  {
    id: 'propulsion-lab',
    description: 'Interactive exploration of how vehicles generate thrust. Students see action/reaction force arrows for jets, propellers, wheels, sails, and rockets — all unified by Newton\'s Third Law. Toggle force arrow overlays, adjust throttle, compare propulsion types side-by-side, and test predictions in "What If?" experiments. Teaches that propellers need air but rockets work in vacuum. Perfect for grades 1-5 physics and engineering. ESSENTIAL for teaching Newton\'s Third Law through real vehicles.',
    constraints: 'Best for grades 1-5. 1-2: 4 propulsion types, simple push-backward/go-forward concept, everyday analogies. 3-5: 5-6 types including rocket (vacuum discussion), medium dependency, action/reaction identification, efficiency comparisons. Evaluable: tracks pairs identified, what-if accuracy, types explored, medium understanding.',
    tutoring: {
      taskDescription: 'Explore propulsion through Newton\'s Third Law. Selected: {{selectedPropulsion}} ({{method}}). Medium: {{medium}}. Phase: {{phase}}. Throttle: {{throttle}}%.',
      contextKeys: ['selectedPropulsion', 'method', 'medium', 'phase', 'showForceArrows', 'throttle', 'propulsionTypesExplored'],
      scaffoldingLevels: {
        level1: '"Watch the arrows — something is being pushed backward. Can you see what it is?"',
        level2: '"The engine pushes hot exhaust gas backward (that\'s the action), and the airplane moves forward (that\'s the reaction). It\'s like blowing up a balloon and letting it go!"',
        level3: '"Newton\'s Third Law: every action has an equal and opposite reaction. Jets push exhaust backward, propellers push air backward, rockets push fuel backward. They all push something back to go forward!"',
      },
      commonStruggles: [
        { pattern: 'Doesn\'t see the connection between propulsion types', response: '"Look — the jet engine and the propeller both push something backward. What\'s the same about ALL of these?"' },
        { pattern: 'Thinks rockets need air', response: '"This is the coolest part — rockets carry their own reaction mass! They push exhaust out the back. What if there\'s no air? The rocket still works!"' },
        { pattern: 'Confuses action and reaction', response: '"The action is what gets pushed BACKWARD. The reaction is the vehicle moving FORWARD. Remember the balloon: air goes backward, balloon goes forward!"' },
      ],
      aiDirectives: [
        {
          title: 'PROPULSION SELECTION',
          instruction: 'When [PROPULSION_SELECTED], describe this propulsion method using the analogy from the data. Connect it to the student\'s experience.',
        },
        {
          title: 'WHAT-IF COACHING',
          instruction: 'When [WHAT_IF_CORRECT], celebrate and reinforce the physics. When [WHAT_IF_INCORRECT], use the analogy to explain. Focus on medium dependency: "Can you push air if there is no air?"',
        },
      ],
    },
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
  },
  {
    id: 'engine-explorer',
    description: 'Interactive engine cutaway showing how different engine types work — pistons, turbines, electric motors. Students watch animated cycles, explore components, compare engines, and connect them to vehicles. Perfect for teaching energy transformation and mechanical systems. ESSENTIAL for grades 1-5 engineering and physics.',
    constraints: 'Requires engineType, components, cycle, energyFlow, and vehicleConnection data. Best for single engine type per instance — use multiple instances for comparison across types.',
    tutoring: {
      taskDescription: 'Student is exploring a {{engineName}} ({{engineType}}) engine in the context of a {{vehicleContext}}. Currently in {{currentPhase}} phase, viewing stage: {{currentStage}}. Throttle at {{throttlePosition}}%. Explored {{componentsExplored}} of {{totalComponents}} components.',
      contextKeys: ['engineType', 'engineName', 'vehicleContext', 'currentPhase', 'currentStage', 'throttlePosition', 'componentsExplored', 'totalComponents', 'overview'],
      scaffoldingLevels: {
        level1: '"What do you think happens next in the cycle?" or "Can you find the part that makes the engine spin?"',
        level2: '"Look at the {{currentStage}} stage — notice how the energy changes from {{energyState}}. What kind of energy is that?" or "This component is like {{analogy}} — can you see why?"',
        level3: '"Let me walk you through it step by step: First, {{stage1}} brings in fuel. Then {{stage2}} squeezes it tight. Next, {{stage3}} ignites it — that is where the power comes from! Finally, {{stage4}} pushes out the used gas. Can you see each part doing its job?"',
      },
      commonStruggles: [
        { pattern: 'Student skips through stages without reading narration', response: 'Pause the animation and ask about the current stage before moving on. Use the narration as a conversation starter.' },
        { pattern: 'Student only explores 1-2 components then moves on', response: 'Highlight an unexplored component and connect it to one they already know. "You found the piston — can you find what pushes fuel into it?"' },
        { pattern: 'Student does not open energy flow section', response: 'Ask where the fuel energy goes. Guide them to open the energy flow diagram to trace the transformation.' },
        { pattern: 'Student struggles with engine-to-vehicle connection', response: 'Use size and speed analogies: "A jet engine pushes air backward really fast — that is like blowing up a balloon and letting it fly across the room!"' },
      ],
    },
  },
];
