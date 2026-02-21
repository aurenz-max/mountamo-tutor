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
