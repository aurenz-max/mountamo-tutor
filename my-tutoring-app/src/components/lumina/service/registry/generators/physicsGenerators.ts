/**
 * Physics Generators - Self-registering module for physics primitives
 *
 * This module registers all physics-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/physicsGenerators';
 */

import { registerContextGenerator } from '../contentRegistry';

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
registerContextGenerator('motion-diagram', async (ctx) => ({
  type: 'motion-diagram',
  instanceId: ctx.instanceId,
  data: await generateMotionDiagram(ctx),
}));

// Sound Wave Explorer - Interactive sound/vibration lab (K-3)
registerContextGenerator('sound-wave-explorer', async (ctx) => ({
  type: 'sound-wave-explorer',
  instanceId: ctx.instanceId,
  data: await generateSoundWaveExplorer(ctx),
}));

// Push & Pull Arena - Interactive force/friction arena (K-5)
registerContextGenerator('push-pull-arena', async (ctx) => ({
  type: 'push-pull-arena',
  instanceId: ctx.instanceId,
  data: await generatePushPullArena(ctx),
}));

// Race Track Lab - Speed/distance/time racing lab (K-5)
registerContextGenerator('race-track-lab', async (ctx) => ({
  type: 'race-track-lab',
  instanceId: ctx.instanceId,
  data: await generateRaceTrackLab(ctx),
}));

// Gravity Drop Tower - Free fall & air resistance lab (K-HS)
registerContextGenerator('gravity-drop-tower', async (ctx) => ({
  type: 'gravity-drop-tower',
  instanceId: ctx.instanceId,
  data: await generateGravityDropTower(ctx),
}));

// ============================================================================
// Migration status: 5/5 physics primitives registered
// ============================================================================
