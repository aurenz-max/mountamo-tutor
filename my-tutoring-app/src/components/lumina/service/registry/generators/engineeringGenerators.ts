/**
 * Engineering Generators - Self-registering module for engineering/STEM primitives
 *
 * This module registers all engineering-related content generators with the ContentRegistry.
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/engineeringGenerators';
 */

import { registerContextGenerator } from '../contentRegistry';

// Engineering Generator Imports
import { generateLeverLab } from '../../engineering/gemini-lever-lab';
import { generatePulleySystemBuilder } from '../../engineering/gemini-pulley-system';
import { generateRampLab } from '../../engineering/gemini-ramp-lab';
import { generateWheelAxleExplorer } from '../../engineering/gemini-wheel-axle';
import { generateGearTrainBuilder } from '../../engineering/gemini-gear-train';
import { generateBridgeBuilder } from '../../engineering/gemini-bridge-builder';
import { generateTowerStacker } from '../../engineering/gemini-tower-stacker';
import { generateShapeStrengthTester } from '../../engineering/gemini-shape-strength-tester';
import { generateFoundationBuilder } from '../../engineering/gemini-foundation-builder';
import { generateExcavatorArmSimulator } from '../../engineering/gemini-excavator-arm-simulator';
import { generateDumpTruckLoader } from '../../engineering/gemini-dump-truck-loader';
import { generateConstructionSequencePlanner } from '../../engineering/gemini-construction-sequence-planner';
import { generateBlueprintCanvas } from '../../engineering/gemini-blueprint-canvas';
import { generateMachineProfile } from '../../engineering/gemini-machine-profile';
import { generateFlightForcesExplorer } from '../../engineering/gemini-flight-forces-explorer';
import { generateAirfoilLab } from '../../engineering/gemini-airfoil-lab';
import { generateVehicleComparisonLab } from '../../engineering/gemini-vehicle-comparison-lab';
import { generatePropulsionLab } from '../../engineering/gemini-propulsion-lab';
import { generatePropulsionTimeline } from '../../engineering/gemini-propulsion-timeline';
import { generatePaperAirplaneDesigner } from '../../engineering/gemini-paper-airplane-designer';
import { generateEngineExplorer } from '../../engineering/gemini-engine-explorer';
import { generateVehicleDesignStudio } from '../../engineering/gemini-vehicle-design-studio';
import { generateHydraulicsLab } from '../../engineering/gemini-hydraulics-lab';
import { generateTransportChallenge } from '../../engineering/gemini-transport-challenge';

// ============================================================================
// Engineering/STEM Primitives Registration
// ============================================================================

// Lever Lab
registerContextGenerator('lever-lab', async (ctx) => ({
  type: 'lever-lab',
  instanceId: ctx.instanceId,
  data: await generateLeverLab(ctx),
}));

// Pulley System Builder
registerContextGenerator('pulley-system-builder', async (ctx) => ({
  type: 'pulley-system-builder',
  instanceId: ctx.instanceId,
  data: await generatePulleySystemBuilder(ctx),
}));

// Ramp Lab
registerContextGenerator('ramp-lab', async (ctx) => ({
  type: 'ramp-lab',
  instanceId: ctx.instanceId,
  data: await generateRampLab(ctx),
}));

// Wheel & Axle Explorer
registerContextGenerator('wheel-axle-explorer', async (ctx) => ({
  type: 'wheel-axle-explorer',
  instanceId: ctx.instanceId,
  data: await generateWheelAxleExplorer(ctx),
}));

// Gear Train Builder
registerContextGenerator('gear-train-builder', async (ctx) => ({
  type: 'gear-train-builder',
  instanceId: ctx.instanceId,
  data: await generateGearTrainBuilder(ctx),
}));

// Bridge Builder
registerContextGenerator('bridge-builder', async (ctx) => ({
  type: 'bridge-builder',
  instanceId: ctx.instanceId,
  data: await generateBridgeBuilder(ctx),
}));

// Tower Stacker
registerContextGenerator('tower-stacker', async (ctx) => ({
  type: 'tower-stacker',
  instanceId: ctx.instanceId,
  data: await generateTowerStacker(ctx),
}));

// Shape Strength Tester
registerContextGenerator('shape-strength-tester', async (ctx) => ({
  type: 'shape-strength-tester',
  instanceId: ctx.instanceId,
  data: await generateShapeStrengthTester(ctx),
}));

// Foundation Builder
registerContextGenerator('foundation-builder', async (ctx) => ({
  type: 'foundation-builder',
  instanceId: ctx.instanceId,
  data: await generateFoundationBuilder(ctx),
}));

// Excavator Arm Simulator
registerContextGenerator('excavator-arm-simulator', async (ctx) => ({
  type: 'excavator-arm-simulator',
  instanceId: ctx.instanceId,
  data: await generateExcavatorArmSimulator(ctx),
}));

// Dump Truck Loader
registerContextGenerator('dump-truck-loader', async (ctx) => ({
  type: 'dump-truck-loader',
  instanceId: ctx.instanceId,
  data: await generateDumpTruckLoader(ctx),
}));

// Construction Sequence Planner
registerContextGenerator('construction-sequence-planner', async (ctx) => ({
  type: 'construction-sequence-planner',
  instanceId: ctx.instanceId,
  data: await generateConstructionSequencePlanner(ctx),
}));

// Blueprint Canvas
registerContextGenerator('blueprint-canvas', async (ctx) => ({
  type: 'blueprint-canvas',
  instanceId: ctx.instanceId,
  data: await generateBlueprintCanvas(ctx),
}));

// Machine Profile (display-only vehicle/machine profiles)
registerContextGenerator('machine-profile', async (ctx) => ({
  type: 'machine-profile',
  instanceId: ctx.instanceId,
  data: await generateMachineProfile(ctx),
}));

// Flight Forces Explorer (interactive four forces of flight)
registerContextGenerator('flight-forces-explorer', async (ctx) => ({
  type: 'flight-forces-explorer',
  instanceId: ctx.instanceId,
  data: await generateFlightForcesExplorer(ctx),
}));

// Airfoil Lab (wing shape and lift exploration)
registerContextGenerator('airfoil-lab', async (ctx) => ({
  type: 'airfoil-lab',
  instanceId: ctx.instanceId,
  data: await generateAirfoilLab(ctx),
}));

// Vehicle Comparison Lab (side-by-side vehicle data analysis)
registerContextGenerator('vehicle-comparison-lab', async (ctx) => ({
  type: 'vehicle-comparison-lab',
  instanceId: ctx.instanceId,
  data: await generateVehicleComparisonLab(ctx),
}));

// Propulsion Lab (Newton's Third Law across propulsion types)
registerContextGenerator('propulsion-lab', async (ctx) => ({
  type: 'propulsion-lab',
  instanceId: ctx.instanceId,
  data: await generatePropulsionLab(ctx),
}));

// Propulsion Timeline (history of transportation)
registerContextGenerator('propulsion-timeline', async (ctx) => ({
  type: 'propulsion-timeline',
  instanceId: ctx.instanceId,
  data: await generatePropulsionTimeline(ctx),
}));

// Paper Airplane Designer (engineering design process: design-build-test-iterate)
registerContextGenerator('paper-airplane-designer', async (ctx) => ({
  type: 'paper-airplane-designer',
  instanceId: ctx.instanceId,
  data: await generatePaperAirplaneDesigner(ctx),
}));

// Engine Explorer (interactive engine cutaway view)
registerContextGenerator('engine-explorer', async (ctx) => ({
  type: 'engine-explorer',
  instanceId: ctx.instanceId,
  data: await generateEngineExplorer(ctx),
}));

// Vehicle Design Studio (drag-and-drop vehicle designer with physics simulation)
registerContextGenerator('vehicle-design-studio', async (ctx) => ({
  type: 'vehicle-design-studio',
  instanceId: ctx.instanceId,
  data: await generateVehicleDesignStudio(ctx),
}));

// Hydraulics Lab (Pascal's Law — hydraulic force multiplication)
registerContextGenerator('hydraulics-lab', async (ctx) => ({
  type: 'hydraulics-lab',
  instanceId: ctx.instanceId,
  data: await generateHydraulicsLab(ctx),
}));

// Transport Challenge (living transport simulation — vehicle optimization)
registerContextGenerator('transport-challenge', async (ctx) => ({
  type: 'transport-challenge',
  instanceId: ctx.instanceId,
  data: await generateTransportChallenge(ctx),
}));

// ============================================================================
// Migration status: 24/24 engineering primitives registered (context-native)
// ============================================================================
