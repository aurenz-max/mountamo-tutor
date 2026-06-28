/**
 * Astronomy Generators - Self-registering module for astronomy primitives
 *
 * This module registers all astronomy-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/astronomyGenerators';
 */

import { registerContextGenerator } from '../contentRegistry';

// Astronomy Generator Imports
import { generateSolarSystemExplorer } from '../../astronomy/gemini-solar-system-explorer';
import { generateScaleComparator } from '../../astronomy/gemini-scale-comparator';
import { generateDayNightSeasons } from '../../astronomy/gemini-day-night-seasons';
import { generateMoonPhasesLab } from '../../astronomy/gemini-moon-phases-lab';
import { generateRocketBuilder } from '../../astronomy/gemini-rocket-builder';
import { generateOrbitMechanicsLab } from '../../astronomy/gemini-orbit-mechanics-lab';
import { generateMissionPlanner } from '../../astronomy/gemini-mission-planner';
import { generateTelescopeSimulator } from '../../astronomy/gemini-telescope-simulator';
import { generateLightShadowLab } from '../../astronomy/gemini-light-shadow-lab';
import { generateConstellationBuilder } from '../../astronomy/gemini-constellation-builder';
import { generatePlanetaryExplorer } from '../../astronomy/gemini-planetary-explorer';

// ============================================================================
// Astronomy Primitives Registration (K-5)
// ============================================================================

// Solar System Explorer
registerContextGenerator('solar-system-explorer', async (ctx) => ({
  type: 'solar-system-explorer',
  instanceId: ctx.instanceId,
  data: await generateSolarSystemExplorer(ctx),
}));

// Scale Comparator
registerContextGenerator('scale-comparator', async (ctx) => ({
  type: 'scale-comparator',
  instanceId: ctx.instanceId,
  data: await generateScaleComparator(ctx),
}));

// Day/Night & Seasons Simulator
registerContextGenerator('day-night-seasons', async (ctx) => ({
  type: 'day-night-seasons',
  instanceId: ctx.instanceId,
  data: await generateDayNightSeasons(ctx),
}));

// Moon Phases Lab
registerContextGenerator('moon-phases-lab', async (ctx) => ({
  type: 'moon-phases-lab',
  instanceId: ctx.instanceId,
  data: await generateMoonPhasesLab(ctx),
}));

// Rocket Builder
registerContextGenerator('rocket-builder', async (ctx) => ({
  type: 'rocket-builder',
  instanceId: ctx.instanceId,
  data: await generateRocketBuilder(ctx),
}));

// Orbit Mechanics Lab
registerContextGenerator('orbit-mechanics-lab', async (ctx) => ({
  type: 'orbit-mechanics-lab',
  instanceId: ctx.instanceId,
  data: await generateOrbitMechanicsLab(ctx),
}));

// Mission Planner
registerContextGenerator('mission-planner', async (ctx) => ({
  type: 'mission-planner',
  instanceId: ctx.instanceId,
  data: await generateMissionPlanner(ctx),
}));

// Telescope Simulator
registerContextGenerator('telescope-simulator', async (ctx) => ({
  type: 'telescope-simulator',
  instanceId: ctx.instanceId,
  data: await generateTelescopeSimulator(ctx),
}));

// Light & Shadow Lab
registerContextGenerator('light-shadow-lab', async (ctx) => ({
  type: 'light-shadow-lab',
  instanceId: ctx.instanceId,
  data: await generateLightShadowLab(ctx),
}));

// Constellation Builder
registerContextGenerator('constellation-builder', async (ctx) => ({
  type: 'constellation-builder',
  instanceId: ctx.instanceId,
  data: await generateConstellationBuilder(ctx),
}));

// Planetary Explorer
registerContextGenerator('planetary-explorer', async (ctx) => ({
  type: 'planetary-explorer',
  instanceId: ctx.instanceId,
  data: await generatePlanetaryExplorer(ctx),
}));

// ============================================================================
// Migration status: 11/11 astronomy primitives registered
// ============================================================================
