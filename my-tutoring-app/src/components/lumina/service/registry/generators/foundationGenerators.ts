/**
 * Foundation Generators - Self-registering module for foundational concept primitives
 *
 * This module registers foundation/concept-teaching content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/foundationGenerators';
 */

import { registerContextGenerator } from '../contentRegistry';

// Foundation Generator Imports
import { generateFoundationExplorer } from '../../foundation-explorer/gemini-foundation-explorer';

// ============================================================================
// Foundational Concept Primitives Registration
// ============================================================================

// Foundation Explorer
registerContextGenerator('foundation-explorer', async (ctx) => ({
  type: 'foundation-explorer',
  instanceId: ctx.instanceId,
  data: await generateFoundationExplorer(ctx),
}));

// ============================================================================
// Migration status: 1/1 foundation primitives registered
// ============================================================================
