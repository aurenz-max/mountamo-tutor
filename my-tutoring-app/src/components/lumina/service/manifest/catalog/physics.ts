/**
 * Physics Catalog - Component definitions for physics primitives
 *
 * Contains physics visualizations and interactive experiments for K-12 science education.
 * Covers mechanics, energy, forces, motion, waves, electricity, and other core physics concepts.
 */

import { ComponentDefinition } from '../../../types';
import { bossEntry } from '../../../components/live-activity/boss';
import { pushPullArenaCard } from '../../../primitives/visual-primitives/physics/pushPullArena.card';
import { raceTrackLabCard } from '../../../primitives/visual-primitives/physics/raceTrackLab.card';
import { soundWaveExplorerCard } from '../../../primitives/visual-primitives/physics/soundWaveExplorer.card';
import { gravityDropTowerCard } from '../../../primitives/visual-primitives/physics/gravityDropTower.card';

export const PHYSICS_CATALOG: ComponentDefinition[] = [
  {
    id: 'motion-diagram',
    description: 'Motion Diagram / Strobe Diagram showing object positions at equal time intervals with velocity and acceleration vectors. Perfect for teaching kinematics qualitatively. ESSENTIAL for Middle School - High School physics: introduction to motion (MS), velocity concepts (MS/HS), acceleration (HS), projectile motion (HS), circular motion (AP).',
    constraints: 'Best for grades 6-12. Use uniform motion for MS, accelerated/projectile for HS, circular for AP.',
    // No evalModes/challengeTypes declared here despite supportsEvaluation, so `answers`
    // is left out rather than inferred from the component's own click-to-place/identify
    // surface — the same class of gap as media-player's MP-3.
    affordances: { representation: 'pictorial', role: 'visualize', minutes: 5 },
    supportsEvaluation: true,
  },
  {
    id: 'sound-wave-explorer',
    description: 'Sound lab built on vibration and drawn sound waves: drums, guitar strings, rubber bands, bells and tuning forks, each with its wave (a taller wave is a louder sound, crests packed closer a higher one) and a real tone. Four eval modes: observe (a sound maker starts or stops shaking, or its sound starts or stops; the learner says what happens to the other; hard items have a loud speaker make rice on a drum shake), predict (one change to how a sound maker is played or heard: harder, more gently, tightened, loosened, walking away, the air pumped out of a bell jar; the learner predicts the loudness or the pitch before the After wave and sound appear), classify (read two or three drawn waves: which sound is louder, quieter, higher or lower; the sounds play only after the answer), apply (from a Before and an After wave, say what was done: played harder or more gently, tightened or loosened, or both at once). Every item, choice and key is built by code; the wrong choices are the classic errors (pitch and loudness mixed up, sound with no shaking, a wave read by the wrong feature). ESSENTIAL for Grade 1 Physical Science (NGSS 1-PS4-1) and early wave reading toward 4-PS4-1.',
    constraints: 'Best for K-3. Kindergarten defaults to observe; grade 1 observe and predict; grade 2 predict and classify; grade 3 classify and apply. Sound travels through air only here: no water or solid materials, no wave speed, wavelength numbers or decibels. Tones are short sine bursts (220-700 Hz).',
    affordances: { representation: ['concrete', 'pictorial'], answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'observe',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Observe (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['observe'],
        description: 'A sound maker starts or stops shaking (or its sound starts or stops): say what happens to the other; hard items have a loud sound make something else shake',
      },
      {
        evalMode: 'predict',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Predict (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['predict'],
        description: 'One change to how a sound maker is played or heard: predict whether it gets louder, quieter, higher or lower, or stays the same, before the After wave and sound appear',
      },
      {
        evalMode: 'classify',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Classify (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['classify'],
        description: 'Read two or three drawn waves and say which sound is louder, quieter, higher or lower (height for loudness, crest spacing for pitch); the sounds play only after the answer',
      },
      {
        evalMode: 'apply',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Apply (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 6,
        challengeTypes: ['apply'],
        description: 'Reverse reasoning: from a Before and an After wave, say what was done to the sound maker (played harder or more gently, tightened or loosened, or both)',
      },
    ],
    // Wired to the live tutor by its boss (soundWaveExplorer.card.ts + soundWaveExplorer.boss.ts).
    ...bossEntry(soundWaveExplorerCard),
    supportsEvaluation: true,
  },
  {
    id: 'push-pull-arena',
    description: 'Live force arena with a spoken tutor where the child watches and runs canvas physics simulations — pushes and pulls on ice, wood, carpet and grass — and ANSWERS OUT LOUD: the tutor asks, responds to the spoken answer, corrects with the physics idea, and a credited answer advances. Modes: observe (watch the preset force, say "push" or "pull"), predict (say "moves" or "stays" before it runs; the sim plays the push once the answer is credited), compare (two objects, same push — say which slides farther), design (experiment with force controls, say whether the goal needs a big or little push). ESSENTIAL for K-5 Physical Science: pushes and pulls (K-PS2-1), motion from forces (K-PS2-2), balanced/unbalanced forces (3-PS2-1).',
    constraints: 'Best for K-5. Use observe mode for K-1, predict for 1-2, compare for 2-3, design for 4-5. Keep object weights 1-10 for clarity. Answers are single spoken words judged by the microphone-enabled Lumina tutor; there is no Check button and no printed answer options.',
    // reader: 'none': every answer is spoken, the child never reads anything, and the
    // constraint text itself says "no printed answer options."
    affordances: { representation: ['concrete', 'pictorial'], reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'observe',
        label: 'Observe (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['observe'],
        description: 'Watch the preset force move the object, then SAY whether it was a push or a pull',
      },
      {
        evalMode: 'predict',
        label: 'Predict (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['predict'],
        description: 'Given object weight + push strength, SAY "moves" or "stays" before the simulation runs',
      },
      {
        evalMode: 'compare',
        label: 'Compare (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['compare'],
        description: 'Two objects get the same push — SAY which one slides farther (by name)',
      },
      {
        evalMode: 'design',
        label: 'Design (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 6,
        challengeTypes: ['design'],
        description: 'Experiment with the force controls, then SAY whether the goal needs a big or little push',
      },
    ],
    supportsEvaluation: true,
    // Wired to the live tutor by its boss (pushPullArena.card.ts + pushPullArena.boss.ts).
    ...bossEntry(pushPullArenaCard),
  },
  {
    id: 'race-track-lab',
    description: 'Race track lab: toy cars named by colour on a track of numbered squares, each moving a whole number of squares per second. Five eval modes, each a task with a code-built key: observe (run a timed race that a bell stops; which car is fastest? same time, so the one that moved the most squares), predict (read each car\'s speed and starting square, predict which crosses the finish line first, then the race runs), measure (run a timed race and count how many squares a car moved, or how many more than another car), calculate (from a race log, speed = distance ÷ time), graph (read a position-time graph: the steeper line is faster; a speed from the slope). Harder items change the shape, not the numbers: a head start that puts a slower car in front, three cars, two cars with different times. No speed readout, medal or finish time is shown before the answer. ESSENTIAL for K-5 Physical Science and extends to Middle School: comparing speeds (K-1), predicting motion (1-2), measuring distance (2-4), computing speed (4-5), position-time graphs and slope as velocity (MS).',
    constraints: 'Best for K-5, extends to MS. Use observe for K-1, predict for 1-2, measure for 2-4, calculate for 4-5, graph for MS. Constant speeds only (no acceleration); one to three cars per race.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'observe',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Observe (K-1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['observe'],
        description: 'Run a timed race and say which car is fastest: every car ran the same time, so the one that moved the most squares (hard: a slower car with a head start ends in front)',
      },
      {
        evalMode: 'predict',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Predict (1-2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['predict'],
        description: 'Read each car\'s speed and starting square and predict which crosses the finish line first, before the race runs (medium: squares in a few seconds; hard: a head start)',
      },
      {
        evalMode: 'measure',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Measure (2-4)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['measure'],
        description: 'Run a timed race and count the squares a car moved (medium: how many more than another car; hard: from a head start)',
      },
      {
        evalMode: 'calculate',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Calculate (4-5)',
        beta: 6.0,
        scaffoldingMode: 4,
        challengeTypes: ['calculate'],
        description: 'From a race log of start, stop and seconds, compute speed = distance ÷ time (medium: a start past square 0; hard: two cars with different times, the faster one\'s speed)',
      },
      {
        evalMode: 'graph',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Graph (MS)',
        beta: 7.5,
        scaffoldingMode: 5,
        challengeTypes: ['graph'],
        description: 'Read a position-time graph: which car is fastest from the steepest line (medium: a head start makes the highest line not the steepest); hard: a car\'s speed from its slope',
      },
    ],
    ...bossEntry(raceTrackLabCard),
    supportsEvaluation: true,
  },
  {
    id: 'gravity-drop-tower',
    description: 'Drop tower where the learner reasons about falling objects before seeing the answer. A canvas tower drops objects (a bowling ball, a feather, a flat or crumpled sheet of paper, a rock...) in ordinary air or in a tube with the air pumped out, from heights code chooses. Five eval modes: observe (drop and watch, then tell which landed first or whether it sped up), predict (which of two lands first, and on hard items why, before the drop), compare (put three drops from different heights in landing order), measure (read a stopwatch table to find the fall time for a new height, or the height for a new time), calculate (h = ½gt²: fall time, drop height, impact speed). Every item, choice and key is built by code from one physics model; outside observe the drop runs after the answer is credited, and wrong choices are the classic errors (heavier falls faster, air ignored, time grows in step with height, the ½ or the square root left out). Busts the misconception that heavier objects fall faster. ESSENTIAL for K-5 Physical Science: gravity pulls objects down (5-PS2-1), forces and motion (3-PS2-2), extends to MS free fall.',
    constraints: 'Best for K-8. Use observe for K-1, predict for 1-3, compare for 2-4, measure for 4-5, calculate for 6-8. Air is set per item by code (no learner air toggle); measure and calculate are without air.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      { evalMode: 'observe', label: 'Observe (K-1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['observe'], affordances: { answers: ['tap', 'spoken'] },
        description: 'Drop two objects (or one) and watch, then tell which reached the ground first, that they landed together, or whether it sped up as it fell' },
      { evalMode: 'predict', label: 'Predict (1-3)', beta: 3.0, scaffoldingMode: 2, challengeTypes: ['predict'], affordances: { answers: ['tap', 'spoken'] },
        description: '"Which lands first, the bowling ball or the feather?" said before the drop, with or without air; hard items also give the reason' },
      { evalMode: 'compare', label: 'Compare (2-4)', beta: 4.5, scaffoldingMode: 3, challengeTypes: ['compare'], affordances: { answers: ['tap'] },
        description: 'Three objects let go together from different heights: tap them in landing order (mass against height; on hard items air against height)' },
      { evalMode: 'measure', label: 'Measure (4-5)', beta: 6.0, scaffoldingMode: 4, challengeTypes: ['measure'], affordances: { answers: ['tap', 'spoken'] },
        description: 'From a stopwatch table of measured drops, choose the fall time for a new height (4 or 9 times as high), or the height for a new fall time' },
      { evalMode: 'calculate', label: 'Calculate (6-8)', beta: 7.5, scaffoldingMode: 6, challengeTypes: ['calculate'], affordances: { answers: ['tap', 'spoken'] },
        description: 'Use h = ½gt² to find a fall time, a drop height, or the speed at the ground' },
    ],
    ...bossEntry(gravityDropTowerCard),
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
