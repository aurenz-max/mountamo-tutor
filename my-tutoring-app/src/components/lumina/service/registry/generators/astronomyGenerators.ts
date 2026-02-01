/**
 * Astronomy Generators - Self-registering module for astronomy primitives
 *
 * This module registers all astronomy-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/astronomyGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// Astronomy Generator Imports
import { generateSolarSystemExplorer } from '../../astronomy/gemini-solar-system-explorer';

// ============================================================================
// Astronomy Primitives Registration (K-5)
// ============================================================================

// Solar System Explorer
registerGenerator('solar-system-explorer', async (item, topic, gradeContext) => ({
  type: 'solar-system-explorer',
  instanceId: item.instanceId,
  data: await generateSolarSystemExplorer(topic, gradeContext, item.config),
}));

// ============================================================================
// Migration status: 1/1 astronomy primitives registered
// ============================================================================
