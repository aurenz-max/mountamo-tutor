/**
 * Foundation Generators - Self-registering module for foundational concept primitives
 *
 * This module registers foundation/concept-teaching content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/foundationGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// Foundation Generator Imports
import { generateFoundationExplorer } from '../../foundation-explorer/gemini-foundation-explorer';

// ============================================================================
// Foundational Concept Primitives Registration
// ============================================================================

// Foundation Explorer
registerGenerator('foundation-explorer', async (item, topic, gradeContext) => ({
  type: 'foundation-explorer',
  instanceId: item.instanceId,
  data: await generateFoundationExplorer(topic, gradeContext, item.config),
}));

// ============================================================================
// Migration status: 1/1 foundation primitives registered
// ============================================================================
