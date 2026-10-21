/**
 * Engineering Catalog - Component definitions for engineering/STEM primitives
 *
 * Contains 4 simple machines and engineering concepts for K-5 STEM education.
 */

import { ComponentDefinition } from '../../../types';
import { rampLabCard } from '../../../primitives/visual-primitives/engineering/rampLab.card';
import { trainYardCard } from '../../../primitives/visual-primitives/engineering/trainYard.card';
import { towerStackerCard } from '../../../primitives/visual-primitives/engineering/towerStacker.card';
import { gearTrainBuilderCard } from '../../../primitives/visual-primitives/engineering/gearTrainBuilder.card';
import { airplaneDioramaCard } from '../../../primitives/visual-primitives/engineering/airplaneDiorama.card';
import { constructionSiteDioramaCard } from '../../../primitives/visual-primitives/engineering/constructionSiteDiorama.card';
import { flightForcesExplorerCard } from '../../../primitives/visual-primitives/engineering/flightForcesExplorer.card';
import { constructionSequencePlannerCard } from '../../../primitives/visual-primitives/engineering/constructionSequencePlanner.card';
import { propulsionLabCard } from '../../../primitives/visual-primitives/engineering/propulsionLab.card';
import { transportChallengeCard } from '../../../primitives/visual-primitives/engineering/transportChallenge.card';
import { bossEntry } from '../../../components/live-activity/boss';
import { vehicleComparisonLabCard } from '../../../primitives/visual-primitives/engineering/vehicleComparisonLab.card';

export const ENGINEERING_CATALOG: ComponentDefinition[] = [
  {
    id: 'lever-lab',
    description: 'Interactive lever/fulcrum simulation for teaching simple machines. Students explore balance, mechanical advantage, and force trade-offs by manipulating loads, fulcrum position, and effort force. Features multiple themes (seesaw, excavator, crowbar) to connect abstract physics to real-world tools. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for elementary engineering and physics.',
    constraints: 'Best for grades K-5. Use for simple machines, balance concepts, mechanical advantage, force multiplication. Themes adapt complexity: seesaw for K-2 (basic balance), excavator/crowbar for 3-5 (mechanical advantage). Supports both exploration (movable fulcrum) and problem-solving (fixed challenges).',
    affordances: { representation: 'concrete', answers: ['manipulate', 'build'], role: ['visualize', 'apply'], minutes: 5 },
    supportsEvaluation: true,
    // With no mode resolved the activity is the unjudged sandbox (drag loads, move the fulcrum, press the beam).
    evalModes: [
      {
        evalMode: 'build_balance',
        affordances: { answers: ['build'] },
        label: 'Balance the Seesaw (open build)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['build_balance'],
        description: 'Open build: a kid sits on the left of a seesaw held still by blocks; the student seats kids of their '
          + 'choosing on the right, and at "I\'m done!" the blocks come away and code checks weight x distance on each side. '
          + 'Many seatings pass (a heavy kid near the middle, two light kids far out); the next item asks for a different way. K-5.',
      },
      {
        evalMode: 'build_lift',
        affordances: { answers: ['build'] },
        label: 'Lift the Rock (open build)',
        beta: 3.2,
        scaffoldingMode: 3,
        challengeTypes: ['build_lift'],
        description: 'Open build: a rock sits on the end of a bar; the student places the fulcrum and a helper lighter than the '
          + 'rock, and code checks that the helper is across the fulcrum and helper weight x distance is at least rock weight '
          + 'x distance. Any fulcrum close enough to the rock passes; the next item asks for a different fulcrum spot. Grades 3-5.',
      },
    ],
  },
  {
    id: 'pulley-system-builder',
    description: 'Interactive pulley system simulation for teaching mechanical advantage and simple machines. Students build and explore pulley configurations by adding fixed and movable pulleys, threading rope, and lifting loads. Shows how cranes, flagpoles, wells, and construction hoists work. Features multiple themes (crane, flagpole, well, construction) to connect physics to real-world applications. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching pulleys and mechanical advantage.',
    constraints: 'Best for grades K-5. Use for pulleys, mechanical advantage, force reduction, rope systems. Themes adapt complexity: flagpole for K-1 (direction change), well for 1-2 (fixed vs movable), crane/construction for 3-5 (mechanical advantage calculations). Supports exploration (add pulleys) and guided challenges (fixed configurations).',
    affordances: { representation: 'concrete', answers: ['build', 'manipulate'], role: ['visualize', 'apply'], minutes: 5 },
    supportsEvaluation: true,
  },
  {
    id: 'ramp-lab',
    description: 'Interactive inclined-plane simulation and controlled-investigation bench. Students compare ramp conditions, measure the least push that moves a load, and design within a force budget. Grades 3-5 can plan a fair test by changing only ramp angle, surface, or box mass while holding other conditions constant; record a prediction; run two trials; and explain aloud how the changed condition affected measured push using both trial records. Code owns the physics and observations; the live tutor judges spoken evidence-based comparisons. Earlier comparison and design modes support K-5 simple machines learning.',
    constraints: 'Best for grades K-5. Use for inclined planes, ramps, force reduction, friction effects, fair tests, and constraint-based engineering design. compare_conditions isolates angle, surface, or rolling/sliding in matched setups. find_threshold measures the least sufficient push. design_with_budget holds platform height fixed while students find the steepest feasible ramp. Themes adapt context: skateboard for fun exploration, loading_dock/dump_truck for real-world applications.',
    affordances: { representation: 'concrete', answers: ['manipulate', 'tap', 'spoken'], role: ['visualize', 'apply'], minutes: 8 },
    ...bossEntry(rampLabCard),
    evalModes: [
      {
        evalMode: 'compare_conditions',
        label: 'Compare Conditions',
        beta: -1.0,
        scaffoldingMode: 2,
        challengeTypes: ['compare_conditions'],
        description: 'Compare matched ramp setups that change one variable and identify which condition reduces the required push.',
      },
      {
        evalMode: 'find_threshold',
        label: 'Find the Threshold',
        beta: 0.0,
        scaffoldingMode: 3,
        challengeTypes: ['find_threshold'],
        description: 'Use controlled trials to find the smallest push setting that makes a fixed load climb.',
      },
      {
        evalMode: 'plan_fair_test',
        label: 'Plan a Fair Test',
        beta: 0.75,
        scaffoldingMode: 3,
        challengeTypes: ['plan_fair_test'],
        description: 'Grades 3-5: edit a second setup to isolate one requested variable; commit the plan, predict, and collect both trials. Plan correctness is separate from prediction.',
      },
      {
        evalMode: 'design_with_budget',
        label: 'Design with a Force Budget',
        beta: 1.5,
        scaffoldingMode: 5,
        challengeTypes: ['design_with_budget'],
        description: 'Hold the platform height fixed and design the steepest whole-degree ramp that stays within a force budget.',
      },
      {
        evalMode: 'explain_from_trials',
        label: 'Explain from Trials',
        beta: 2.5,
        scaffoldingMode: 4,
        challengeTypes: ['explain_from_trials'],
        description: 'Grades 3-5: predict, run two controlled trials, then explain the changed condition and measured push using both records. Spoken response; microphone and live tutor required.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'wheel-axle-explorer',
    description: 'Interactive wheel and axle simulation for teaching simple machines and force multiplication. Students rotate wheels of different sizes connected to axles to discover how steering wheels, doorknobs, winches, and well cranks multiply force. Adjust wheel and axle diameters to see how larger wheels make turning easier. Attach loads to axle to simulate lifting with a winch. Shows real-world connections: steering wheel, doorknob, well crank, winch, screwdriver. Features multiple themes (steering_wheel, winch, doorknob, well_crank) to connect physics to everyday objects. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching wheel and axle machines and gear ratios.',
    constraints: 'Best for grades K-5. Use for wheel and axle, force multiplication, gear ratios. K-1: doorknobs are easier than handles (doorknob theme). 1-2: well cranks and turning (well_crank theme). 2-3: bigger wheel = easier turn (winch theme). 4-5: mechanical advantage calculations, gear ratio introduction (steering_wheel theme). Supports exploration (adjustable sizes) and challenges (fixed configurations with loads to lift).',
    affordances: { representation: 'concrete', answers: ['manipulate'], role: ['visualize', 'apply'], minutes: 5 },
    supportsEvaluation: true,
  },
  {
    id: 'gear-train-builder',
    description: 'Build-a-gear-train challenge for teaching how gears pass motion along: every meshed gear turns the opposite way, a small gear driven by a big one turns faster, and gears in the middle change only the way, never the speed. Each session is 3 trains on an EMPTY track: the student taps gear sizes (8, 12, 16, 24, 32 teeth) to add gears to the end of the train, each meshing with the one before, and taps a gear to take it out. “I’m done!” turns the crank and the code checks the last gear: which way it turns, faster or slower than the first, or exactly how many times per turn of the first. Many trains pass. Real-world connections: clocks, bicycles, wind-up toys, mills. Perfect for K-5 engineering and NGSS simple machines. ESSENTIAL for teaching gears, direction changes and speed ratios.',
    constraints: 'Best for grades K-5. Code builds every train target (way, speed, ratio, number of gears) from the lesson grade; the manifest must NOT supply gears or ratios. K-1: which way the last gear turns, and faster or slower. Grades 2-3: way and faster or slower. Grades 4-5: faster or slower with a way, and exact ratios (2, 3, 4 times; once per 2 or 3 turns).',
    affordances: { representation: 'concrete', answers: ['build'], role: ['visualize', 'apply'], minutes: 6 },
    supportsEvaluation: true,
    ...bossEntry(gearTrainBuilderCard),
    evalModes: [
      {
        evalMode: 'build_direction',
        affordances: { answers: ['build'] },
        label: 'Which Way? (open build)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['build_direction'],
        description: 'Open build: "Build a gear train of at least 3 gears where the last gear turns the same way as the first." '
          + 'Any train passes with the right number of gears for the way (odd = same, even = opposite). K-3.',
      },
      {
        evalMode: 'build_speed',
        affordances: { answers: ['build'] },
        label: 'Faster or Slower (open build)',
        beta: 2.8,
        scaffoldingMode: 2,
        challengeTypes: ['build_speed'],
        description: 'Open build: make the last gear turn faster (or slower) than the first, sometimes also a way. A smaller '
          + 'last gear than the first is faster; middle gears change only the way. Grades 1-5.',
      },
      {
        evalMode: 'build_ratio',
        affordances: { answers: ['build'] },
        label: 'Exact Turns (open build)',
        beta: 3.6,
        scaffoldingMode: 4,
        challengeTypes: ['build_ratio'],
        description: 'Open build: make the last gear turn exactly 3 times for every turn of the first (or once for every 2), '
          + 'sometimes also a way. Turns = the first gear’s teeth / the last gear’s teeth. Grades 3-5.',
      },
    ],
  },
  {
    id: 'bridge-builder',
    description: 'Interactive 2D bridge construction canvas for teaching structural engineering. Students place beams, cables, and supports to span gaps, then test bridges with loads (cars, trucks, trains) to see if they hold. Watch bridges deform under stress with color-coded feedback (green/yellow/red). Teaches triangles are strong, load distribution, and truss optimization. Shows real-world connections: highway bridges, railroad trestles, footbridges. Features multiple themes (construction, medieval, modern) to connect engineering to different contexts. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching structural engineering, forces, and design iteration.',
    constraints: 'Best for grades K-5. Use for bridges, structural engineering, trusses, load distribution. K-1: connect two sides (simple spanning). 1-2: supports at edges vs middle (support concepts). 2-3: triangles are strong (truss introduction). 3-4: load distribution concepts (stress visualization). 4-5: truss design optimization (budget constraints, efficiency). Supports free building exploration and guided design challenges with piece limits.',
    affordances: { representation: 'concrete', answers: ['build'], role: ['visualize', 'apply'], minutes: 8 },
    supportsEvaluation: true,
  },
  {
    id: 'tower-stacker',
    description: 'Build-a-tower challenge for teaching structural stability, balance point (center of gravity) and wind loads. Each session is 3 towers on an EMPTY building area with a green goal line: the student picks blocks, big blocks and beams from a tray, may turn a piece on end, and taps where to drop it; it falls until it rests on what is under it. “I’m done!” tests the tower with real statics (each part stays up only if its balance point is over what holds it up) and, on windproof towers, a wind load. Many towers pass. Teaches wider bases, keeping weight over the support, building with fewer, taller pieces, and designing for wind. Real-world connections: skyscrapers, towers, building construction. Perfect for K-5 engineering and NGSS K-2-ETS1, 3-5-ETS1 design standards. ESSENTIAL for teaching structural stability and the physics of building.',
    constraints: 'Best for grades K-5. Code builds every tower (heights, piece limits, wind) from the lesson grade; the manifest must NOT supply heights, pieces or wind. K-1: reach the line and stand. Grades 2-3: add the few-pieces and windproof towers. Grades 4-5: few pieces and windproof.',
    affordances: { representation: 'concrete', answers: ['build'], role: ['visualize', 'apply'], minutes: 7 },
    supportsEvaluation: true,
    ...bossEntry(towerStackerCard),
    evalModes: [
      {
        evalMode: 'build_tall',
        affordances: { answers: ['build'] },
        label: 'Build a Tall Tower (open build)',
        beta: 2.5,
        scaffoldingMode: 1,
        challengeTypes: ['build_tall'],
        description: 'Open build: "Build a tower that reaches the green line and stays standing." Any tower passes whose every '
          + 'part stands and whose top reaches the line. K-2-ETS1.',
      },
      {
        evalMode: 'build_few',
        affordances: { answers: ['build'] },
        label: 'Build With Few Pieces (open build)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['build_few'],
        description: 'Open build: reach the green line using no more than N pieces (a beam stood on end is 4 tall). '
          + 'Material efficiency. Grades 2-4.',
      },
      {
        evalMode: 'build_windproof',
        affordances: { answers: ['build'] },
        label: 'Build a Windproof Tower (open build)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['build_windproof'],
        description: 'Open build: reach the green line and stay up when the strong wind blows. A plain two-wide column blows '
          + 'over; a wide-based tower stands. Designing for loads. Grades 2-5, 3-5-ETS1.',
      },
    ],
  },
  {
    id: 'shape-strength-tester',
    description: 'Interactive experimental rig for testing shape strength under load. Students discover why triangles dominate structural engineering by testing different 2D shapes (triangle, square, pentagon, hexagon) in a compression frame. Watch shapes deform or hold under increasing loads. Add diagonal bracing to weak shapes and see them become rigid. Teaches shape recognition, triangles are rigid, squares squish, triangulation principles, and truss analysis. Shows real-world connections: bridge trusses, building frames, tower structures, bicycle geometry. Features multiple materials (straw, wood, steel) and joint types (pinned, rigid) to explore structural behavior. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching why triangles are strong and how triangulation provides structural stability.',
    constraints: 'Best for grades K-5. Use for shapes in structures, triangulation, truss analysis, structural rigidity. K-1: shape recognition, triangles vs squares (simple comparison). 1-2: squares squish, triangles don\'t (discovery). 2-3: adding diagonals makes shapes strong (introduce bracing). 3-4: triangulation principles (understand why diagonals help). 4-5: truss analysis and optimization (minimize bracing, maximize strength). Supports free exploration and guided challenges with target loads and shapes.',
    affordances: { representation: 'concrete', answers: ['tap', 'build'], role: ['visualize', 'apply'], minutes: 6 },
    supportsEvaluation: true,
  },
  {
    id: 'foundation-builder',
    description: 'Interactive soil/foundation simulator for teaching why buildings need foundations and how engineers design them. Students select foundation types (spread, strip, slab, piles), adjust footing size, and test if their design supports the building without sinking. Different soil types (rock, gravel, sand, clay, mud) have different bearing capacities, teaching that soil matters. Calculate pressure = force ÷ area to understand how bigger footings reduce pressure on soil. Watch buildings settle/sink when pressure exceeds soil capacity. Teaches foundations spread weight like snowshoes, bigger footings = less pressure, soil types affect design, pressure calculations, and foundation optimization. Shows real-world connections: house footings, skyscraper foundations, deep piles for soft soil. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching foundations, pressure, and structural engineering fundamentals.',
    constraints: 'Best for grades K-5. Use for foundations, soil types, pressure calculations, structural support. K-1: buildings need foundations, bigger is better (discovery). 1-2: bigger footings spread weight (like snowshoes). 2-3: different soils are stronger or weaker (soil comparison). 3-4: pressure = force ÷ area calculations (introduce formula). 4-5: foundation optimization (minimal area that still works). Supports free design exploration and guided challenges with target loads and soil types.',
    affordances: { representation: ['concrete', 'symbolic'], answers: ['tap', 'manipulate'], role: ['visualize', 'apply'], minutes: 6 },
    supportsEvaluation: true,
  },
  {
    id: 'excavator-arm-simulator',
    description: 'Interactive multi-jointed excavator arm simulation with boom, stick, and bucket for teaching hydraulics, kinematics, and coordinated movement. Students control three joints (boom angle, stick angle, bucket angle) to position the bucket, dig material from different soil layers, lift loads, and dump at target zones. Features realistic Verlet physics for smooth arm movement. Material layers have different hardness values affecting excavation difficulty. Shows reach envelope to visualize workspace. Teaches cause and effect with joints, sequential operations (dig-lift-move-dump), joint coordination, reach and range concepts, efficiency optimization, and how excavators work. Shows real-world connections: construction excavators, backhoes, mining equipment, robotic arms. Features multiple control methods (sliders, buttons, drag) and themes (realistic, cartoon, blueprint) to adapt to different age groups. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching multi-jointed mechanisms, hydraulics, robotics, and construction equipment.',
    constraints: 'Best for grades K-5. Use for excavators, construction equipment, multi-joint systems, hydraulics, kinematics, robotics. K-1: cause and effect with joints, basic digging (buttons control, cartoon theme). 1-2: reach and range exploration (sliders, show reach envelope). 2-3: sequencing dig operations (dig-move-dump sequences, challenges). 3-4: joint angle coordination (all three joints working together, angles shown). 4-5: reach envelope and efficiency optimization (minimize operations, advanced challenges, blueprint theme). Supports free exploration and guided challenges with material excavation targets and dump zones.',
    affordances: { representation: 'concrete', reader: 'developing', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 8 },
    tutoring: {
      taskDescription: 'Student is running a construction Dig Site job board, driving a 3-joint excavator arm (boom, stick, bucket) to solve real jobs — the geometry engine is the judge, not a submit button. Current job {{jobNumber}} of {{jobsTotal}}: "{{jobTitle}}" ({{jobBadge}}). Goal: move {{goalUnits}} units by {{goalKind}}; progress {{progressUnits}}/{{goalUnits}}, bucket holds {{bucketLoad}}/{{bucketSize}}. Jobs solved: {{jobsSolved}}/{{jobsTotal}}. Active constraints — tracks stuck in mud: {{bodyLocked}}, stick hydraulic jammed: {{stickJammed}}, buried gas pipe: {{hasPipe}}, digs used: {{digsUsed}}/{{maxDigs}}.',
      contextKeys: ['jobTitle', 'jobBadge', 'jobNumber', 'jobsTotal', 'goalKind', 'goalUnits', 'progressUnits', 'jobsSolved', 'bucketLoad', 'bucketSize', 'digsUsed', 'maxDigs', 'bodyLocked', 'stickJammed', 'hasPipe', 'pipeStrikes', 'spilledUnits'],
      scaffoldingLevels: {
        level1: '"Which joint do you think moves the bucket closer to the dirt — the boom, the stick, or the bucket itself? Try dragging one glowing joint and watch what happens."',
        level2: '"To dig, the bucket tip has to be BELOW the ground line before you press Dig — watch the bite meter climb. Then swing over the drop spot and press Dump. Right now the bucket is holding {{bucketLoad}} of {{bucketSize}}."',
        level3: '"Work the joints in order: drop the boom to set your height, straighten or curl the stick to reach, then curl the bucket to bite. Push the tip deep until the bite meter reads 100% for a full scoop, press Dig, swing to the drop spot, and press Dump. Keep going until you reach {{goalUnits}} units."',
      },
      commonStruggles: [
        { pattern: 'Student presses Dig with the bucket tip still above the ground', response: 'Point out the bite meter only appears once the tip is below the dirt line — have them drag the joints so the bucket sinks in first.' },
        { pattern: 'Digs keep coming up half-empty (shallow bites)', response: 'A shallow bite only half-fills the bucket. Ask them to push the tip deeper until the bite meter reads 100% before digging — this matters most on the fuel-limited job.' },
        { pattern: 'On the far-patch job the student keeps trying to drive the body closer', response: 'Remind them the tracks are stuck in the mud — the only way out is to STRETCH the arm into one long straight line to reach inside the dashed circle.' },
        { pattern: 'On the pipe job the student digs deep in one spot', response: 'That is how pipes get struck. Tell them to take shallow scoops and slide the bucket sideways between digs so the trench spreads out.' },
        { pattern: 'Loads spill next to the truck instead of into it', response: 'The dump only counts when the bucket tip is over the truck bed. Ask them to swing until the tip is above the bed before pressing Dump.' },
      ],
      aiDirectives: [
        {
          title: 'JOB SOLVED',
          instruction: 'When [JOB_SOLVED], celebrate the specific job and then explain WHY their joint work succeeded in kid-friendly terms (reach, full scoops, precision, or redundancy). Keep it short and excited.',
        },
        {
          title: 'PIPE STRIKE',
          instruction: 'When [PIPE_STRIKE], reassure the student first — real crews hit pipes too — then coach shallow, spread-out scoops WITHOUT solving the trench for them.',
        },
        {
          title: 'HINT REQUESTED',
          instruction: 'When [HINT_REQUESTED], give a gentle nudge toward the right joint or action and the reason. Never hand over the full solution or exact angles.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'dump-truck-loader',
    description: 'Interactive dump truck loading and hauling simulation for teaching capacity, weight limits, and material transport efficiency. Students load material into the truck bed, monitor weight and volume capacity, drive to dump location, raise the bed to dump, and return for more loads. Features realistic Verlet physics for material particle simulation. Material types (dirt, gravel, sand, debris) have different densities affecting weight vs volume trade-offs. Teaches full and empty concepts, capacity constraints (weight AND volume), overloading consequences, counting loads, weight vs volume understanding, efficiency optimization (material per trip), and how dump trucks work. Shows real-world connections: construction sites, material delivery, landscaping, mining operations, waste management. Features multiple themes (realistic, cartoon, simple) to adapt to different age groups. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching capacity, material handling, weight concepts, and construction equipment.',
    constraints: 'Best for grades K-5. Use for dump trucks, capacity concepts, weight limits, material handling, construction equipment, efficiency. K: full and empty concepts (cartoon theme, simple loads). K-1: capacity and "too much" understanding (overload feedback). 1-2: counting loads, how many trips needed (target loads). 2-3: weight limits vs volume limits (different materials, show both). 3-4: material density understanding (gravel is heavier than debris for same volume). 4-5: efficiency optimization (maximize load size, minimize trips, time limits). Supports free exploration and guided challenges with material moving targets and efficiency goals. Curriculum home: G1 SCI005-02 "Construction Machines" (curriculum-fit 2026-08-21, 0.873 / 5-of-5).',
    affordances: { representation: 'concrete', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'load',
        label: 'Haul the Loads (Easy)',
        beta: -1.0,
        scaffoldingMode: 2,
        challengeTypes: ['load'],
        description: 'Haul a target number of loads and discover by doing which meter — bed volume or weight scale — stops you first.',
      },
      {
        evalMode: 'predict',
        label: 'Call the Limit (Medium)',
        beta: 0.0,
        scaffoldingMode: 3,
        challengeTypes: ['predict'],
        description: 'Commit to which meter will fill first BEFORE loading anything, then load up and check the call.',
      },
      {
        evalMode: 'plan_trips',
        label: 'Plan the Trips (Hard)',
        beta: 1.5,
        scaffoldingMode: 5,
        challengeTypes: ['plan_trips'],
        description: 'Clear a whole pile and work out how many trips the material density forces — same pile, different trip counts.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'construction-sequence-planner',
    description: 'Construction planner ("Build It Right"): job cards for a real project (house, bridge, tower, road or playground), and four planning tasks. Students tap the jobs into the order they must happen (a roof needs walls under it), order jobs whose cards say which jobs each one needs (a job can need two), plan one-week jobs into weeks so jobs that do not need each other happen at the same time and the build meets a deadline, and find the fewest weeks a build can take when crews work at the same time (the longest chain of needs, the critical path). A checked plan is built on screen block by block and stops at the first job whose need was not done, so students see the consequence of their own order; nothing on screen gives the order, a week for a job or the total first. Teaches first-then-last sequencing, dependencies, parallel vs sequential work, and the critical path. ESSENTIAL for teaching planning, sequencing and construction project management.',
    constraints: 'Best for grades K-5. Code builds every job card, need, deadline and answer from a library of real jobs; the manifest picks the project and the topic, never the jobs. K-1: sequence (3-5 jobs in a straight chain, needs hidden). 2-3: sequence or dependency_chain (4-6 jobs, needs shown, a job that needs two). 3-4: parallel (5-7 one-week jobs into weeks to meet a deadline; hard: two crews). 4-5: critical_path (the fewest weeks a branching build takes, said or tapped). Evaluable: every plan and total is checked by code.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'developing', answers: ['build', 'tap', 'spoken'], role: ['visualize', 'apply'], minutes: 8 },
    // The live wiring (three plan boards and a SAY_OR_SHOW total on the spoken preset) is the boss's card.
    ...bossEntry(constructionSequencePlannerCard),
    evalModes: [
      { evalMode: 'sequence', affordances: { answers: ['build'] }, label: 'Sequence (Basic)', beta: -1.0, scaffoldingMode: 2, challengeTypes: ['sequence'], description: 'Tap 3-5 jobs in a straight chain into the order they must happen; the cards do not show what a job needs (hard: 5 jobs)' },
      { evalMode: 'dependency_chain', affordances: { answers: ['build'] }, label: 'Dependency Chain (Intermediate)', beta: 0.0, scaffoldingMode: 3, challengeTypes: ['dependency_chain'], description: 'Order 4-6 jobs whose cards show their needs, with a job that needs two, so no job comes before a job it needs' },
      { evalMode: 'parallel', affordances: { answers: ['build'] }, label: 'Parallel Discovery (Advanced)', beta: 1.0, scaffoldingMode: 4, challengeTypes: ['parallel'], description: 'Plan 5-7 one-week jobs into weeks so jobs that do not need each other share a week and the build meets a deadline (hard: only two crews)' },
      { evalMode: 'critical_path', affordances: { answers: ['tap', 'spoken'] }, label: 'Critical Path (Expert)', beta: 2.0, scaffoldingMode: 5, challengeTypes: ['critical_path'], description: 'Find the fewest weeks a branching build of 5-7 jobs can take when crews work at the same time: the longest chain of needs (hard: the chain with the most jobs is not the longest)' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'blueprint-canvas',
    description: 'General-purpose grid-based drawing surface for creating technical drawings of ANY subject. Students sketch floor plans, machine diagrams, playground maps, vehicle schematics, bridge cross-sections, and more. Features gridded canvas, snap-to-grid drawing, multiple view types (plan/elevation/section), dimension tools, and export. Gemini adapts element labels and challenges to the topic: "rooms" for buildings, "components" for machines, "zones" for maps, "parts" for vehicles. Teaches spatial reasoning, technical drawing, measurement, scale, and design communication. Themes adapt to age: sketch (K-1), blueprint (2-3), technical (4-5). Perfect for K-5 engineering, NGSS design standards, and any topic needing spatial/technical drawing.',
    constraints: 'Best for grades K-5. Use for floor plans, machine diagrams, playground maps, vehicle designs, bridge cross-sections, garden layouts, city planning — any topic needing spatial/technical drawing. K-1: simple shapes, 2-3 elements, sketch theme, no measurements. 1-2: 3-4 elements with labels, show grid, snap enabled. 2-3: 4-5 elements with measurements, blueprint theme. 3-4: 5-6 elements, can use elevation view for machines/vehicles. 4-5: 6-7 elements, technical precision, smaller gridScale. Gemini picks the right viewType (plan for layouts, elevation for machines, section for internals) and elementLabel (rooms, components, parts, zones) based on topic.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['build'], role: 'apply', minutes: 8 },
    supportsEvaluation: true,
  },
  // Vehicles, Flight & Machines Primitives
  {
    id: 'machine-profile',
    description: 'Rich display profile for any vehicle or machine — the engineering equivalent of species-profile. Presents beautifully themed profiles for airplanes, trains, cars, ships, helicopters, submarines, bikes, bulldozers, spacecraft and more. Each profile includes specifications, how-it-works explanations, key components with fun analogies, history, fascinating facts, and real-world connections. Category-based color theming (10 categories) makes each machine type visually distinct. AI-generated machine illustrations. Perfect for K-5 vehicle and machine education. ESSENTIAL for answering "How does a [machine] work?" questions.',
    constraints: 'Best for grades K-5. Display-only (no direct evaluation). Use for any vehicle or machine topic: airplanes, cars, trains, ships, helicopters, trucks, submarines, bicycles, construction equipment, spacecraft. K-2: simple vocabulary, 2-3 sentence howItWorks, 3 keyComponents, fun analogies. 3-5: technical vocabulary, full paragraph howItWorks, 4-6 keyComponents, science connections.',
    affordances: { representation: 'pictorial', role: 'introduce', minutes: 3 },
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
    description: 'A plane in the sky with its four force arrows drawn to scale in counted units: lift up, weight down, thrust forward, drag back. Students work out what the plane does from how each pair compares (lift against weight sets the height, thrust against drag sets the speed), and the plane moves only after their answer, so nothing on screen names the result first. Three tasks: predict what a plane flying level does after one change (a load of water, the throttle, the landing gear, the nose angle, a stall); read a plane\'s arrows and say whether it climbs, sinks or stays level and whether it speeds up, slows down or keeps its speed; and set the thrust and the nose angle so the plane meets a goal (climb at a steady speed), where a steeper nose adds drag and too steep a nose stalls the wing. Air streams past the wing, and swirls off it in a stall. Perfect for K-5 lessons on the four forces of flight, balanced and unbalanced forces, and how a pilot controls a plane. ESSENTIAL for answering "How does an airplane fly?"',
    constraints: 'Best for grades K-5. K-2: predict only, with the force that changes named. 3-5: all three tasks. Code builds every item, force size and answer; the manifest picks the plane and the topic, never the questions. Not for wing shape or airflow over an airfoil (airfoil-lab) or the parts of an airplane (airplane-diorama). Evaluable: every answer is checked by code.',
    affordances: { representation: 'pictorial', reader: 'developing', answers: ['tap', 'spoken', 'manipulate'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      { evalMode: 'predict', affordances: { answers: ['tap', 'spoken'] }, label: 'Predict (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['predict'], description: 'A plane flying level at a steady speed, then one change (a load, the throttle, the landing gear, the nose angle): predict what happens to its height or speed before the change runs (hard: a two-step effect, a stall, or two changes that cancel)' },
      { evalMode: 'observe', affordances: { answers: ['tap', 'spoken'] }, label: 'Observe (Medium)', beta: 0.0, scaffoldingMode: 3, challengeTypes: ['observe'], description: 'Read a plane\'s four force arrows and say whether it climbs, sinks or stays level and whether it speeds up, slows down or keeps its speed (hard: one-unit differences, a nose that points up while the plane sinks)' },
      { evalMode: 'adjust', affordances: { answers: ['manipulate'] }, label: 'Adjust (Hard)', beta: 1.0, scaffoldingMode: 5, challengeTypes: ['adjust'], description: 'Set the thrust and the nose angle so the plane meets a goal such as climbing at a steady speed (hard: a steeper nose also adds drag, and the top angle stalls the wing)' },
    ],
    ...bossEntry(flightForcesExplorerCard),
    supportsEvaluation: true,
  },
  {
    id: 'airfoil-lab',
    description: 'Wing cross-section in a simulated wind tunnel. Students change the wing shape, angle of attack, and airspeed to observe how lift is generated. Animated streamlines, color-coded pressure maps, and force gauges make the invisible physics of flight visible and tangible. Drag handles reshape the airfoil. Compare two airfoils side-by-side. Stall visualization at extreme angles. Teaches variable manipulation, observation, cause-and-effect. Perfect for grades 1-5 flight and aerodynamics education. ESSENTIAL for answering "Why is the wing shaped like that?"',
    constraints: 'Best for grades 1-5. 1-2: relative terms (more/less lift), flat vs curved comparison, no numeric coefficients. 3-5: quantitative results, Bernoulli\'s principle, design optimization challenges. Evaluable: tracks shapes explored, variables manipulated, predictions, stall discovery, challenge performance.',
    affordances: { representation: ['concrete', 'pictorial'], reader: 'developing', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 6 },
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
    description: 'A data table of real, topic-specific vehicles (rows) and their measures (columns: top speed, weight, passengers, cargo, range, year introduced, CO₂ per rider), with vector art for each vehicle. The rows are never sorted and nothing marks a leader, so students must read and compare the numbers. Three tasks: find the vehicle that leads a named column (the greatest value, or the lowest CO₂); read a job with one need ("a crowd has to travel together in one trip") and choose both the vehicle and the column whose numbers prove it; and rule out the vehicles that miss a job\'s minimums (people, cargo, distance, speed) before choosing the best of the rest on one priority. Answers are tapped or said aloud. Best for K-5 comparative data reasoning about a named vehicle class or an explicit vehicle comparison.',
    constraints: 'Use for grades K-5 when the objective is to compare vehicles or justify a choice from vehicle data. K-2: find the leader only. A topic about airplanes should produce airplane peers; bicycles should produce bicycle peers; use a mixed air/land/sea set only for broad transportation comparison. The model supplies the roster and its real statistics; code builds every question and answer from those numbers. Do not use for fleet logistics, budgets, repeated trips, or optimization (transport-challenge owns that task). Evaluable: every answer is checked by code.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'developing', answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 7 },
    evalModes: [
      {
        evalMode: 'metric_leader',
        label: 'Find the Metric Leader',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['metric_leader'],
        description: 'Read one named column of a vehicle table and choose the vehicle with the greatest value, or the lowest CO₂ (hard: five rows, extra columns, a close race or a number whose first digit misleads).',
      },
      {
        evalMode: 'evidence_choice',
        label: 'Choose and Cite Evidence',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['evidence_choice'],
        description: 'Read a job with one need, worded without naming a column, and choose the vehicle for it and the column whose numbers prove it (easy: two columns; hard: four, each led by a different vehicle).',
      },
      {
        evalMode: 'constraint_tradeoff',
        label: 'Reason Through Trade-offs',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['constraint_tradeoff'],
        description: 'Rule out the vehicles that miss a job\'s minimums (people, cargo, distance or speed), then choose the one that leads the priority among the rest; the overall leader always misses a minimum (easy: one minimum; hard: two, and two vehicles that each miss one).',
      },
    ],
    ...bossEntry(vehicleComparisonLabCard),
    supportsEvaluation: true,
  },
  {
    id: 'propulsion-lab',
    description: 'A small craft with one or two engines (a jet engine, a rocket engine, a propeller, or a sail) on a track on Earth or floating in space. Students work out how it moves from Newton\'s Third Law: an engine pushes the craft the opposite way from its blast, two equal pushes the opposite way cancel, and a jet engine, a propeller and a sail need air while a rocket engine carries everything it needs and works in space. The craft moves only after the answer, so nothing on screen names the result first. Three tasks: predict what a craft does when its engines start (engines turned around, two engines pushing opposite ways, an engine with no air to push); watch what streams out of a clamped craft\'s engines and say which way it goes when let go; and set up two fair tests (engine, place, throttle) that answer a question such as "does a jet engine need air?". Perfect for grades 1-5 lessons on Newton\'s Third Law, action and reaction, why rockets work in space, and fair tests. ESSENTIAL for teaching Newton\'s Third Law through real vehicles.',
    constraints: 'Best for grades 1-5. 1-2: predict and observe. 3-5: all three tasks. Code builds every item, engine, place and answer; the manifest picks the topic, never the questions. Not for the four forces of flight (flight-forces-explorer) or the history of vehicles (propulsion-timeline). Evaluable: every answer is checked by code.',
    affordances: { representation: 'pictorial', reader: 'developing', answers: ['tap', 'spoken', 'manipulate'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      { evalMode: 'predict', affordances: { answers: ['tap', 'spoken'] }, label: 'Predict (Easy)', beta: -1.0, scaffoldingMode: 1, challengeTypes: ['predict'], description: 'A craft with a jet engine, rocket engine, propeller or sail, on Earth or in space, its engines off: predict whether it moves left, moves right or stays still when they start (hard: two engines pushing opposite ways)' },
      { evalMode: 'observe', affordances: { answers: ['tap', 'spoken'] }, label: 'Observe (Medium)', beta: 0.0, scaffoldingMode: 3, challengeTypes: ['observe'], description: 'Watch what streams out of a clamped craft\'s engines and say which way it goes when let go (hard: two opposite streams one unit apart)' },
      { evalMode: 'experiment', affordances: { answers: ['manipulate'] }, label: 'Experiment (Hard)', beta: 1.0, scaffoldingMode: 5, challengeTypes: ['experiment'], description: 'Set up two fair tests (engine, place, throttle) that answer a question such as "does a jet engine need air?" (hard: the tests start two changes apart, or where the engine has nothing to push)' },
    ],
    ...bossEntry(propulsionLabCard),
    supportsEvaluation: true,
  },
  {
    id: 'propulsion-timeline',
    description: 'Interactive timeline showing the evolution of transportation from walking to spacecraft. Scrub through eras, tap milestones for detail cards, filter by domain (land/sea/air/space), trace innovation chains showing how one invention enabled the next, complete chronological ordering challenges, and observe exponential speed record growth. Period-accurate vehicle descriptions with real dates and speeds. Perfect for K-5 history and engineering education. ESSENTIAL for teaching innovation history and technological progress.',
    constraints: 'Best for grades K-5. K-2: 6-8 milestones, simple sequencing with 4 items, 1 innovation chain. 3-5: 10-15 milestones, complex sequencing with 5-6 items, 2-3 innovation chains, speed record analysis. Evaluable: tracks milestones explored, sequencing accuracy, chains traced, domains explored, speed trend observation.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'developing', answers: ['tap', 'build'], role: ['visualize', 'apply'], minutes: 7 },
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
    affordances: { representation: ['concrete', 'symbolic'], reader: 'developing', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 8 },
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
    affordances: { representation: 'pictorial', reader: 'developing', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 6 },
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
    affordances: { representation: ['concrete', 'pictorial'], reader: 'developing', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 7 },
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
      studentPrompts: [
        // Self-grounding: each prompt names the live on-screen situation so the
        // tutor answers about THIS hydraulic system, not an earlier activity.
        {
          kind: 'explain',
          label: "Why won't it lift the {{loadWeight}}kg load?",
          prompt:
            'The {{loadWeight}}kg load is stuck — output force is only {{outputForce}}N. Why is that not enough, and how do I fix it?',
          showWhen: { key: 'isLifting', equals: false },
        },
        {
          kind: 'explain',
          label: 'How is it lifting {{loadWeight}}kg?',
          prompt:
            'How is this {{scenarioName}} lifting the {{loadWeight}}kg load with only {{inputForce}}N of input force?',
          showWhen: { key: 'isLifting', equals: true },
        },
        {
          kind: 'explain',
          label: 'What does {{forceRatio}}x force mean?',
          prompt:
            'What does the {{forceRatio}}x force multiplier mean in this {{scenarioName}}, and where does it come from?',
        },
        { kind: 'hint', label: 'Give me a hint', hintLevel: 1 },
        { kind: 'hint', label: "Explain Pascal's Law", hintLevel: 2 },
        {
          kind: 'check',
          label: 'What should I try next?',
          prompt:
            "I've explored these zones: {{zonesExplored}}. Challenge progress: {{challengeProgress}}. What should I try next?",
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'vehicle-design-studio',
    description: 'Engineering design process studio where students pick vehicle body, propulsion, and control parts then test against physics simulation. Includes radar performance chart, design log for iteration tracking, and challenge mode with constraints. Perfect for teaching the engineering design cycle (design \u2192 test \u2192 analyze \u2192 iterate), trade-off analysis, and systematic testing. ESSENTIAL for grades 2-5 engineering and design thinking.',
    constraints: 'Requires partsPalette with bodies, propulsion, and controls arrays. Each part needs numeric physics values. Challenges optional but recommended for grade 4-5.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'developing', answers: ['tap'], role: ['visualize', 'apply'], minutes: 8 },
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
    description: 'A transport planning job: move a load of people or tons of cargo (festival visitors, lumber, grain) from one place to another, with the vehicles that could do it (cars, minivans, buses, ferries, trains and planes for people; delivery trucks, semi trucks, freight trains, cargo planes and ships for cargo). Each card shows what ONE trip carries and its cost, hours and CO₂ per trip; students work out how many trips each vehicle needs (dividing and rounding up, since a part-full trip is still a trip) and multiply to find the totals, then pick the vehicle that meets the limits. A checked pick plays out its trips one icon a trip (50 car trips against 1 train trip) and fills bars for its totals against each limit; the table of every vehicle appears only after the job is answered. Three tasks: one limit (a budget, a time or a CO₂ cap), two limits at once, and three limits no vehicle keeps where the student finds the one that breaks only one. Perfect for grades 3-5 engineering, multi-step multiplication and division word problems, and data-driven decisions under constraints. ESSENTIAL for teaching constraint analysis and transport planning.',
    constraints: 'Best for grades 3-5. Code builds every job, vehicle figure, limit and answer from the eval mode and config.difficulty; the manifest gives the topic, never the numbers. Easy: every load fills its trips, cards show only the limited figures. Medium: a part-full trip, every figure shown, the cheapest per trip is not the answer. Hard: a vehicle that would pass only if its part-full trip were not counted. Not for comparing vehicle facts without a job (vehicle-comparison-lab). Evaluable: every pick is checked by code.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'developing', answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 7 },
    evalModes: [
      {
        evalMode: 'single_constraint',
        label: 'Single Constraint (Easy)',
        beta: -1.5,
        scaffoldingMode: 1,
        challengeTypes: ['single_constraint'],
        description: 'One limit (a budget, a time or a CO₂ cap): work out each vehicle\'s trips and total, and pick the one vehicle that does the whole job within it',
      },
      {
        evalMode: 'multi_constraint',
        label: 'Multi Constraint (Medium)',
        beta: 0.0,
        scaffoldingMode: 3,
        challengeTypes: ['multi_constraint'],
        description: 'Two limits at once: other vehicles each keep one limit and break the other; pick the one vehicle that keeps both',
      },
      {
        evalMode: 'full_optimization',
        label: 'Full Optimization (Hard)',
        beta: 1.5,
        scaffoldingMode: 5,
        challengeTypes: ['full_optimization'],
        description: 'Three limits and no vehicle keeps them all: find the one vehicle that breaks only one limit',
      },
    ],
    ...bossEntry(transportChallengeCard),
    supportsEvaluation: true,
  },
  {
    id: 'train-yard',
    description: 'Rail job-board simulation where students build a freight or passenger train (engines plus the right kind of car: hopper, tank car, centerbeam flatcar, boxcar, autorack, passenger coach) to haul a real load over a hill, then watch it climb or stall. Teaches matching cars to cargo, capacity (how many cars hold the load), and how hill steepness decides the pulling power (engines) a train needs; on delivery it shows how many trucks one train replaces. Perfect for lessons on trains, freight vs passenger trains, transportation and how goods move in communities, simple machines and forces. ESSENTIAL for grades 1-5 engineering and transportation.',
    constraints: 'Best for grades 1-5. Each session is 4 rail jobs built by the generator from the lesson intent; the manifest must NOT supply cargo, amounts, grades or car counts — the generator builds jobs deterministically. K-2 jobs use whole cars (skip-counting); 3-5 jobs need rounding up and 1-4 engines. Four tasks, easiest first: match the car to the cargo (K-1 entry), count the cars, choose the engines, build the whole train.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'developing', answers: ['tap'], role: ['apply', 'visualize'], minutes: 8 },
    evalModes: [
      {
        evalMode: 'match_car',
        label: 'Match the Car',
        beta: -1.5,
        scaffoldingMode: 1,
        challengeTypes: ['match_car'],
        description: 'Choose the kind of rail car built for the cargo (loose, liquid, long, boxed, vehicles, people); the yard sets the counts and engines',
      },
      {
        evalMode: 'enough_cars',
        label: 'Count the Cars',
        beta: -0.5,
        scaffoldingMode: 2,
        challengeTypes: ['enough_cars'],
        description: 'The right car is given; couple the fewest cars that hold the whole load (skip-count, or divide and round up)',
      },
      {
        evalMode: 'enough_pull',
        label: 'Choose the Engines',
        beta: 0.3,
        scaffoldingMode: 3,
        challengeTypes: ['enough_pull'],
        description: 'The loaded cars are given; add the fewest engines that pull the train up the hill, using the rule of the rails',
      },
      {
        evalMode: 'build_train',
        affordances: { answers: ['build'] },
        label: 'Build the Train',
        beta: 0.8,
        scaffoldingMode: 3,
        challengeTypes: ['build_train'],
        description: 'Build the fewest-car, fewest-engine train of the right car type for a job, then run it over the hill',
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(trainYardCard),
  },
  {
    id: 'construction-site-diorama',
    description: 'A 3D construction site with an excavator, a pile of dirt, sand, gravel or rocks, and a dump truck. Students work the excavator: tap the pile to dig a scoop, tap the truck to dump it, and each scoop lands as its own mound in the truck bed. They load the truck with the right amount and send it off to a job. Younger students load a stated number of scoops (counting objects to 7, one-to-one counting while doing); older students read the truck\'s weight limit and what one scoop weighs, and work out how many scoops fill it without going over (multiplication and division, weight and capacity). Perfect for lessons on construction machines, excavators and dump trucks, how machines help people work, counting, and measurement of weight. ESSENTIAL for K-5 engineering, construction and counting.',
    constraints: 'Grades K-5. Each session is 5 loads; code picks every number and writes every ask. K-2 asks name the number of scoops (2-7); 3-5 asks give the truck limit and the weight of one scoop (3-8 scoops). The manifest must NOT supply numbers.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['build'], role: ['apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'load_truck',
        label: 'Load the Truck',
        beta: -1.0,
        scaffoldingMode: 1,
        challengeTypes: ['load_truck'],
        description: 'Work the excavator to load the dump truck with the right number of scoops, then send it: a stated count (K-2) or as many as the weight limit allows (3-5)',
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(constructionSiteDioramaCard),
  },
  {
    id: 'airplane-diorama',
    description: 'A 3D passenger jet on a display stand that students turn, zoom and tap. Students find the parts of an airplane (wings, engines, tail, cockpit, landing gear, cabin, nose) and tap them on the jet; each part they find shows what it does (the engines spin up, the flaps slide down, the rudder moves, the gear bounces, the cockpit and cabin open to show the seats inside, the radar sweeps ahead of the nose), and the jet takes off when every part is found. Younger students find parts by name; older students find the part that does a job (lifts the plane, pushes it forward, keeps it steady). Students also plan flights: a trip between two airports on a map, where they load enough fuel tanks for the distance plus a spare and fly it (K-2 count the hops on the map; 3-5 divide the distance by how far one tank flies). Perfect for lessons on airplanes, parts of a machine and what each part does, flight, transportation, how vehicles work, and measurement or division word problems about distance and fuel. ESSENTIAL for K-5 engineering and transportation.',
    constraints: 'Grades K-5. Each session asks for 5 different parts of the jet. The manifest may name the parts the lesson is about in the intent ("the wings and the engines"); it must NOT write the asks, which code writes. K-2 asks name the part; 3-5 asks name only its job. A flight-plan session is 4 trips; code sets every distance and fuel rule.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'build'], role: ['visualize', 'apply'], minutes: 5 },
    evalModes: [
      {
        evalMode: 'find_part',
        affordances: { answers: ['tap'] },
        label: 'Find the Part',
        beta: -1.5,
        scaffoldingMode: 1,
        challengeTypes: ['find_part'],
        description: 'Find the asked part on the 3D jet and tap it: by its name (K-2) or by the job it does (3-5)',
      },
      {
        evalMode: 'flight_plan',
        affordances: { answers: ['build'] },
        label: 'Plan the Flight',
        beta: 0.5,
        scaffoldingMode: 3,
        challengeTypes: ['flight_plan'],
        description: 'Load enough fuel tanks for a trip between two airports plus one spare, then fly it: count the hops (K-2) or divide the distance by how far one tank flies (3-5)',
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(airplaneDioramaCard),
  },
];
