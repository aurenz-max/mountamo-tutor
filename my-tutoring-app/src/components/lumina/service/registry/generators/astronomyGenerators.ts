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
import { generateScaleComparator } from '../../astronomy/gemini-scale-comparator';
import { generateDayNightSeasons } from '../../astronomy/gemini-day-night-seasons';
import { generateMoonPhasesLab } from '../../astronomy/gemini-moon-phases-lab';
import { generateRocketBuilder } from '../../astronomy/gemini-rocket-builder';

// ============================================================================
// Astronomy Primitives Registration (K-5)
// ============================================================================

// Solar System Explorer
registerGenerator('solar-system-explorer', async (item, topic, gradeContext) => ({
  type: 'solar-system-explorer',
  instanceId: item.instanceId,
  data: await generateSolarSystemExplorer(topic, gradeContext, item.config),
}));

// Scale Comparator
registerGenerator('scale-comparator', async (item, topic, gradeContext) => ({
  type: 'scale-comparator',
  instanceId: item.instanceId,
  data: await generateScaleComparator(topic, gradeContext, item.config),
}));

// Day/Night & Seasons Simulator
registerGenerator('day-night-seasons', async (item, topic, gradeContext) => ({
  type: 'day-night-seasons',
  instanceId: item.instanceId,
  data: await generateDayNightSeasons(topic, gradeContext, item.config),
}));

// Moon Phases Lab
registerGenerator('moon-phases-lab', async (item, topic, gradeContext) => ({
  type: 'moon-phases-lab',
  instanceId: item.instanceId,
  data: await generateMoonPhasesLab(topic, gradeContext, item.config),
}));

// Rocket Builder
registerGenerator('rocket-builder', async (item, topic, gradeContext) => ({
  type: 'rocket-builder',
  instanceId: item.instanceId,
  data: await generateRocketBuilder(topic, gradeContext, item.config),
}));

// ============================================================================
// Migration status: 5/5 astronomy primitives registered
// ============================================================================
