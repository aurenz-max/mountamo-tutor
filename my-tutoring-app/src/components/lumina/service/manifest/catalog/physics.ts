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
