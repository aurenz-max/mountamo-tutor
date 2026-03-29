/**
 * Physics Generators - Self-registering module for physics primitives
 *
 * This module registers all physics-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/physicsGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// Physics Generator Imports
import { generateMotionDiagram } from '../../physics/gemini-motion-diagram';
import { generateSoundWaveExplorer } from '../../physics/gemini-sound-wave-explorer';

// ============================================================================
// Physics Primitives Registration (Middle School - High School)
// ============================================================================

// Motion Diagram / Strobe Diagram - Kinematics visualization
registerGenerator('motion-diagram', async (item, topic, gradeContext) => ({
  type: 'motion-diagram',
  instanceId: item.instanceId,
  data: await generateMotionDiagram(topic, gradeContext, item.config),
}));

// Sound Wave Explorer - Interactive sound/vibration lab (K-3)
registerGenerator('sound-wave-explorer', async (item, topic, gradeContext) => ({
  type: 'sound-wave-explorer',
  instanceId: item.instanceId,
  data: await generateSoundWaveExplorer(topic, gradeContext, item.config),
}));

// ============================================================================
// Migration status: 2/2 physics primitives registered
// ============================================================================
