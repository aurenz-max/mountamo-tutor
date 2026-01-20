/**
 * Engineering Generators - Self-registering module for engineering/STEM primitives
 *
 * This module registers all engineering-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/engineeringGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// Engineering Generator Imports
import { generateLeverLab } from '../../engineering/gemini-lever-lab';
import { generatePulleySystemBuilder } from '../../engineering/gemini-pulley-system';
import { generateRampLab } from '../../engineering/gemini-ramp-lab';
import { generateWheelAxleExplorer } from '../../engineering/gemini-wheel-axle';

// ============================================================================
// Engineering/STEM Primitives Registration
// ============================================================================

// Lever Lab
registerGenerator('lever-lab', async (item, topic, gradeContext) => ({
  type: 'lever-lab',
  instanceId: item.instanceId,
  data: await generateLeverLab(topic, gradeContext, item.config),
}));

// Pulley System Builder
registerGenerator('pulley-system-builder', async (item, topic, gradeContext) => ({
  type: 'pulley-system-builder',
  instanceId: item.instanceId,
  data: await generatePulleySystemBuilder(topic, gradeContext, item.config),
}));

// Ramp Lab
registerGenerator('ramp-lab', async (item, topic, gradeContext) => ({
  type: 'ramp-lab',
  instanceId: item.instanceId,
  data: await generateRampLab(topic, gradeContext, item.config),
}));

// Wheel & Axle Explorer
registerGenerator('wheel-axle-explorer', async (item, topic, gradeContext) => ({
  type: 'wheel-axle-explorer',
  instanceId: item.instanceId,
  data: await generateWheelAxleExplorer(topic, gradeContext, item.config),
}));

// ============================================================================
// Migration status: 4/4 engineering primitives registered
// ============================================================================
