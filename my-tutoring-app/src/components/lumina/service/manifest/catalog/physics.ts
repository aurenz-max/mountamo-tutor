/**
 * Physics Catalog - Component definitions for physics primitives
 *
 * Contains physics visualizations and interactive experiments for K-12 science education.
 * Covers mechanics, energy, forces, motion, waves, electricity, and other core physics concepts.
 */

import { ComponentDefinition } from '../../../types';

export const PHYSICS_CATALOG: ComponentDefinition[] = [
  {
    id: 'motion-diagram',
    description: 'Motion Diagram / Strobe Diagram showing object positions at equal time intervals with velocity and acceleration vectors. Perfect for teaching kinematics qualitatively. ESSENTIAL for Middle School - High School physics: introduction to motion (MS), velocity concepts (MS/HS), acceleration (HS), projectile motion (HS), circular motion (AP).',
    constraints: 'Best for grades 6-12. Use uniform motion for MS, accelerated/projectile for HS, circular for AP.',
    supportsEvaluation: true,
  },
  {
    id: 'sound-wave-explorer',
    description: 'Interactive sound lab where students tap virtual objects to create vibrations, see real-time wave visualizations, and explore how force (volume) and speed (pitch) affect sound. Includes medium selection (air/water/solid/vacuum) and distance controls. Uses Web Audio API for real audio feedback. ESSENTIAL for Grade 1 Physical Science (NGSS 1-PS4-1, 1-PS4-4).',
    constraints: 'Best for K-3. Themes: music_room (K-1), playground (1-2), science_lab (2-3). Keep oscillator frequencies in safe range (200-800Hz). Short tone bursts only.',
    evalModes: [
      {
        evalMode: 'observe',
        label: 'Observe (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['observe'],
        description: 'Tap objects, watch vibrations animate, answer MC about what produces sound',
      },
      {
        evalMode: 'predict',
        label: 'Predict (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['predict'],
        description: 'Adjust force/speed, predict pitch/volume change before hearing result',
      },
      {
        evalMode: 'classify',
        label: 'Classify (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['classify'],
        description: 'Compare objects/materials, rank by pitch or sort by sound travel properties',
      },
      {
        evalMode: 'apply',
        label: 'Apply (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 6,
        challengeTypes: ['apply'],
        description: 'Reverse reasoning — hear a sound, identify the force/speed/medium that produced it',
      },
    ],
    tutoring: {
      taskDescription: 'Student is exploring sound in a {{theme}} setup. Object: {{vibrationObject}}. Force: {{forceLevel}}/5, Speed: {{speedLevel}}/5. Medium: {{medium}}. Phase: {{phase}}.',
      contextKeys: ['theme', 'vibrationObject', 'forceLevel', 'speedLevel', 'medium', 'distance', 'phase', 'challengeActive'],
      scaffoldingLevels: {
        level1: '"Tap the {{vibrationObject}} and watch it shake! What do you see and hear?"',
        level2: '"See how the {{vibrationObject}} is shaking {{forceLevel > 3 ? \'really hard\' : \'gently\'}}? That makes the wave {{forceLevel > 3 ? \'tall — that means LOUD\' : \'small — that means quiet\'}}. The {{speedLevel > 3 ? \'fast\' : \'slow\'}} shaking makes the pitch {{speedLevel > 3 ? \'high like a bird\' : \'low like a bear\'}}."',
        level3: '"Here\'s the rule: FASTER shaking = HIGHER pitch. HARDER shaking = LOUDER sound. Look at the wave: tall waves are loud, squished-together waves are high-pitched."',
      },
      commonStruggles: [
        { pattern: 'Student confuses pitch and volume', response: '"Pitch is HOW HIGH or LOW the sound is (like a bird vs a bear). Volume is HOW LOUD or QUIET. They are different things! Try changing just the speed slider — hear how the sound goes higher? That\'s pitch changing while volume stays the same."' },
        { pattern: 'Student thinks sound travels through vacuum', response: '"Sound needs something to travel through — like air or water. In space (vacuum), there\'s nothing for the vibrations to push against, so there\'s no sound at all! Try switching to vacuum and see what happens."' },
        { pattern: 'Student does not connect vibration stopping to sound stopping', response: '"Put your hand on your throat and hum. Feel the vibration? Now stop humming. The vibration stops AND the sound stops! They always go together."' },
        { pattern: 'Student thinks louder sounds travel faster', response: '"Loud and quiet sounds actually travel at the SAME speed! Loud sounds just push the air harder, so you can hear them from farther away. But they don\'t go faster."' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'push-pull-arena',
    description: 'Interactive arena where students push and pull objects of different sizes on various surfaces (ice, wood, carpet, grass). Canvas-based physics simulation with force arrows, momentum, and friction. Students discover that bigger pushes make things move faster, and heavier things need bigger pushes. ESSENTIAL for K-5 Physical Science: pushes and pulls (K-PS2-1), motion from forces (K-PS2-2), balanced/unbalanced forces (3-PS2-1).',
    constraints: 'Best for K-5. Use observe mode for K-1, predict for 1-2, compare for 2-3, design for 4-5. Keep object weights 1-10 for clarity.',
    evalModes: [
      {
        evalMode: 'observe',
        label: 'Observe (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['observe'],
        description: 'Push/pull an object, answer MC about what happened (moved/didn\'t, direction, speed)',
      },
      {
        evalMode: 'predict',
        label: 'Predict (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['predict'],
        description: 'Given object weight + push strength, predict if it will move and how far',
      },
      {
        evalMode: 'compare',
        label: 'Compare (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['compare'],
        description: 'Two objects or two surfaces — which moves more/less? Rank by effort needed',
      },
      {
        evalMode: 'design',
        label: 'Design (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 6,
        challengeTypes: ['design'],
        description: 'Set up forces to achieve a goal (move heavy object, stop a moving one, balance forces)',
      },
    ],
    tutoring: {
      taskDescription: 'Student is exploring pushes and pulls in a {{theme}} arena. Object: {{objectName}} ({{objectWeight}}kg) on {{surface}}. Force: {{pushStrength}}/10 {{pushDirection}}. Challenge type: {{challengeType}}.',
      contextKeys: ['theme', 'objectName', 'objectWeight', 'surface', 'pushStrength', 'pushDirection', 'challengeType'],
      scaffoldingLevels: {
        level1: '"Try pushing the {{objectName}}! What do you think will happen?"',
        level2: '"The {{objectName}} weighs {{objectWeight}}kg and you\'re on {{surface}}. {{objectWeight > 5 ? \'Heavy objects need bigger pushes!\' : \'Light objects are easier to push!\'}} Try adjusting your force."',
        level3: '"Here\'s the rule: Force must be bigger than friction to make something move. {{surface}} has {{surface === \'ice\' ? \'very little\' : surface === \'carpet\' ? \'a lot of\' : \'some\'}} friction. A {{objectWeight}}kg object on {{surface}} needs about {{Math.ceil(objectWeight * (surface === \'ice\' ? 0.03 : surface === \'wood\' ? 0.2 : surface === \'carpet\' ? 0.5 : 0.4) * 9.8)}}N of force to start moving."',
      },
      commonStruggles: [
        { pattern: 'Student thinks heavier objects always move slower', response: '"Heavier objects DO need bigger pushes to get moving, but once moving, they can go just as fast! It\'s about how much force you use compared to their weight."' },
        { pattern: 'Student confuses push direction with object direction', response: '"A PUSH sends the object AWAY from you (to the right →). A PULL brings it TOWARD you (to the left ←). Try both and watch which way the object goes!"' },
        { pattern: 'Student does not understand why object won\'t move', response: '"The surface is holding the object back — that\'s called friction! {{surface === \'carpet\' ? \'Carpet has lots of friction\' : surface === \'grass\' ? \'Grass grabs onto things\' : \'\'}}. Try a bigger push, or try ice — it\'s super slippery!"' },
        { pattern: 'Student thinks objects move forever', response: '"Objects slow down because of friction — the surface rubs against them! On ice, things slide a long way because ice is smooth. On carpet, things stop quickly because carpet is rough."' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'race-track-lab',
    description: 'Interactive race track where students observe races between characters, predict winners, measure distances on a grid, calculate speed = distance / time, and analyze position-time graphs. Canvas-based with animated racers on a measured track. ESSENTIAL for K-5 Physical Science and extends to Middle School: comparing speeds (K-1), predicting motion (1-2), measuring distance (2-4), computing speed (4-5), position-time graphs and slope as velocity (MS).',
    constraints: 'Best for K-5, extends to MS. Use observe for K-1, predict for 1-2, measure for 2-4, calculate for 4-5, graph for MS. Keep racer count 2-4 for clarity.',
    evalModes: [
      {
        evalMode: 'observe',
        label: 'Observe (K-1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['observe'],
        description: 'Watch race, answer who won or who was fastest',
      },
      {
        evalMode: 'predict',
        label: 'Predict (1-2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['predict'],
        description: 'Set speeds, predict winner before race runs',
      },
      {
        evalMode: 'measure',
        label: 'Measure (2-4)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['measure'],
        description: 'Count grid squares traveled, compare distances in same time',
      },
      {
        evalMode: 'calculate',
        label: 'Calculate (4-5)',
        beta: 6.0,
        scaffoldingMode: 4,
        challengeTypes: ['calculate'],
        description: 'Given distance and time, compute speed',
      },
      {
        evalMode: 'graph',
        label: 'Graph (MS)',
        beta: 7.5,
        scaffoldingMode: 5,
        challengeTypes: ['graph'],
        description: 'Generate position-time graph from race, identify velocity from slope',
      },
    ],
    tutoring: {
      taskDescription: 'Student is watching races between {{racerCount}} characters and answering questions about speed, distance, and time on a {{trackLength}}-square track.',
      contextKeys: ['racers', 'trackLength', 'question', 'correctAnswer'],
      scaffoldingLevels: {
        level1: '"Which racer is moving the fastest? Look at how far each one has gone."',
        level2: '"Count the grid squares each racer traveled. If one racer went {{trackLength}} squares in less time, what does that tell us about their speed?"',
        level3: '"Speed means how far something goes in a certain time. If the 🐇 Rabbit goes 2 squares every second and the 🐢 Turtle goes 1 square every second, after 5 seconds the Rabbit will be at square 10 and the Turtle at square 5."',
      },
      commonStruggles: [
        { pattern: 'Student confuses speed with size or appearance', response: 'Speed is about how fast something moves, not how big it is. Count the squares to compare!' },
        { pattern: 'Student cannot read the position-time graph', response: 'Each line shows where a racer was at each second. A steeper line means faster speed.' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'gravity-drop-tower',
    description: 'Interactive drop tower where students drop objects side-by-side and discover that all objects fall at the same rate without air resistance. Canvas physics simulation with height markers, splat animations, slow-motion replay, and optional air resistance toggle. Busts the great misconception that heavier objects fall faster. ESSENTIAL for K-5 Physical Science: gravity pulls objects down (5-PS2-1), forces and motion (3-PS2-2), extends to HS gravitational force models (HS-PS2-4).',
    constraints: 'Best for K-5 (extends to HS). Use observe for K-1, predict for 1-3, compare for 2-4, measure for 4-5, calculate for MS-HS. Keep object count to 1-2 for clarity.',
    evalModes: [
      {
        evalMode: 'observe',
        label: 'Observe (K-1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['observe'],
        description: 'Drop objects, answer: "What happened?" / "Did it go up or down?"',
      },
      {
        evalMode: 'predict',
        label: 'Predict (1-3)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['predict'],
        description: '"Which lands first — the bowling ball or the feather?" (with/without air)',
      },
      {
        evalMode: 'compare',
        label: 'Compare (2-4)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['compare'],
        description: 'Drop from different heights, rank landing order. Toggle air resistance.',
      },
      {
        evalMode: 'measure',
        label: 'Measure (4-5)',
        beta: 6.0,
        scaffoldingMode: 4,
        challengeTypes: ['measure'],
        description: 'Time the fall, measure height, discover height-fall time relationship',
      },
      {
        evalMode: 'calculate',
        label: 'Calculate (MS-HS)',
        beta: 7.5,
        scaffoldingMode: 6,
        challengeTypes: ['calculate'],
        description: 'Use h = ½gt² to predict fall time. Calculate velocity at impact.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is dropping objects from a {{height}}m tower. Objects: {{objectNames}}. Air resistance: {{airResistance}}. Challenge type: {{challengeType}}.',
      contextKeys: ['height', 'objectNames', 'airResistance', 'challengeType', 'objects'],
      scaffoldingLevels: {
        level1: '"Drop the objects and watch! What do you notice about how they fall?"',
        level2: '"See how the {{objectNames}} are falling. Does the heavier one fall faster, slower, or the same? {{airResistance ? \'Remember, air resistance is ON, so shape matters!\' : \'Without air, only gravity pulls them down.\'}}"',
        level3: '"Here\'s the big secret: WITHOUT air resistance, ALL objects fall at the same speed — no matter how heavy! Gravity pulls everything equally. A bowling ball and a feather would land at the same time in a vacuum. But WITH air resistance, shape matters — flat things get slowed down more."',
      },
      commonStruggles: [
        { pattern: 'Student thinks heavier objects fall faster', response: '"That\'s what most people think! But try dropping the heavy and light objects together WITHOUT air resistance. They land at the same time! Gravity pulls on everything equally."' },
        { pattern: 'Student confuses air resistance with no-air results', response: '"There are two situations: WITH air (like real life) where shape matters — a feather floats because air pushes on it. WITHOUT air (like on the Moon), everything falls at the same speed. Try toggling air resistance to see the difference!"' },
        { pattern: 'Student cannot connect height to fall time', response: '"Higher up = longer fall. If you double the height, the fall time gets longer — but not exactly double! It follows a special rule: h = ½gt². Try dropping from different heights and timing it."' },
        { pattern: 'Student struggles with h = ½gt² formula', response: '"Think of it this way: t = √(2h/g). Plug in the height and g = 9.8. For example, from 5m: t = √(10/9.8) = √1.02 ≈ 1.01 seconds."' },
      ],
    },
    supportsEvaluation: true,
  },
  // Additional physics primitives will be added here
  // Examples could include:
  // - force-diagram (visualize forces with arrows and magnitude)
  // - motion-simulator (position, velocity, acceleration graphs)
  // - energy-converter (potential/kinetic energy transformations)
  // - wave-simulator (frequency, amplitude, wavelength)
  // - circuit-builder (series/parallel circuits, Ohm's law)
  // - collision-lab (elastic/inelastic collisions, momentum conservation)
  // - pendulum-lab (period, energy transfer, simple harmonic motion)
  // - inclined-plane (forces on slopes, friction)
  // - projectile-motion (trajectory, range, max height)
  // - spring-oscillator (Hooke's law, oscillation)
];
