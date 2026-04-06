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
import { generatePushPullArena } from '../../physics/gemini-push-pull-arena';
import { generateRaceTrackLab } from '../../physics/gemini-race-track-lab';
import { generateGravityDropTower } from '../../physics/gemini-gravity-drop-tower';

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

// Push & Pull Arena - Interactive force/friction arena (K-5)
registerGenerator('push-pull-arena', async (item, topic, gradeContext) => ({
  type: 'push-pull-arena',
  instanceId: item.instanceId,
  data: await generatePushPullArena(topic, gradeContext, item.config),
}));

// Race Track Lab - Speed/distance/time racing lab (K-5)
registerGenerator('race-track-lab', async (item, topic, gradeContext) => ({
  type: 'race-track-lab',
  instanceId: item.instanceId,
  data: await generateRaceTrackLab(topic, gradeContext, item.config),
}));

// Gravity Drop Tower - Free fall & air resistance lab (K-HS)
registerGenerator('gravity-drop-tower', async (item, topic, gradeContext) => ({
  type: 'gravity-drop-tower',
  instanceId: item.instanceId,
  data: await generateGravityDropTower(topic, gradeContext, item.config),
}));

// ============================================================================
// Migration status: 5/5 physics primitives registered
// ============================================================================
