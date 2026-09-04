/**
 * History Generators - Self-registering module for history primitives
 *
 * This module registers all history-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/historyGenerators';
 */

import { registerContextGenerator } from '../contentRegistry';

// History Generator Imports
import { generateCauseEffectChain } from '../../history/gemini-cause-effect-chain';
import { generateEraExplorer } from '../../history/gemini-era-explorer';

// ============================================================================
// History Primitives Registration (K-6)
// ============================================================================

// Era Explorer (one era through 3 lenses → locate / sort / compare / explain)
//
// `...ctx.raw` is item.config verbatim, so it already carries objectiveText and
// any curator pin; `targetEvalMode` is re-stamped from the typed axis afterwards
// so the resolver reads the canonical value rather than whatever the escape
// hatch happened to hold. `intent` is the routing signal when nothing is pinned.
registerContextGenerator('era-explorer', async (ctx) => ({
  type: 'era-explorer',
  instanceId: ctx.instanceId,
  data: await generateEraExplorer(ctx.topic, ctx.grade ?? ctx.gradeLevel, {
    ...ctx.raw,
    targetEvalMode: ctx.targetEvalMode,
    intent: ctx.intent,
  }),
}));

// Cause & Effect Chain (identify the causes → order them → name root vs. proximate)
//
// `...ctx.raw` is item.config verbatim, so it already carries objectiveText and
// any curator pin; `targetEvalMode` is re-stamped from the typed axis afterwards
// so the resolver reads the canonical value rather than whatever the escape
// hatch happened to hold. `intent` is the routing signal when nothing is pinned.
registerContextGenerator('cause-effect-chain', async (ctx) => ({
  type: 'cause-effect-chain',
  instanceId: ctx.instanceId,
  data: await generateCauseEffectChain(ctx.topic, ctx.grade ?? ctx.gradeLevel, {
    ...ctx.raw,
    targetEvalMode: ctx.targetEvalMode,
    intent: ctx.intent,
  }),
}));

// ============================================================================
// Migration status: 2/2 history primitives registered
// ============================================================================
