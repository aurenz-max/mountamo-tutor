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

// Gear Train Builder
registerGenerator('gear-train-builder', async (item, topic, gradeContext) => ({
  type: 'gear-train-builder',
  instanceId: item.instanceId,
  data: await generateGearTrainBuilder(topic, gradeContext, item.config),
}));

// Bridge Builder
registerGenerator('bridge-builder', async (item, topic, gradeContext) => ({
  type: 'bridge-builder',
  instanceId: item.instanceId,
  data: await generateBridgeBuilder(topic, gradeContext, item.config),
}));

// Tower Stacker
registerGenerator('tower-stacker', async (item, topic, gradeContext) => ({
  type: 'tower-stacker',
  instanceId: item.instanceId,
  data: await generateTowerStacker(topic, gradeContext, item.config),
}));

// Shape Strength Tester
registerGenerator('shape-strength-tester', async (item, topic, gradeContext) => ({
  type: 'shape-strength-tester',
  instanceId: item.instanceId,
  data: await generateShapeStrengthTester(topic, gradeContext, item.config),
}));

// Foundation Builder
registerGenerator('foundation-builder', async (item, topic, gradeContext) => ({
  type: 'foundation-builder',
  instanceId: item.instanceId,
  data: await generateFoundationBuilder(topic, gradeContext, item.config),
}));

// Excavator Arm Simulator
registerGenerator('excavator-arm-simulator', async (item, topic, gradeContext) => ({
  type: 'excavator-arm-simulator',
  instanceId: item.instanceId,
  data: await generateExcavatorArmSimulator(topic, gradeContext, item.config),
}));

// Dump Truck Loader
registerGenerator('dump-truck-loader', async (item, topic, gradeContext) => ({
  type: 'dump-truck-loader',
  instanceId: item.instanceId,
  data: await generateDumpTruckLoader(topic, gradeContext, item.config),
}));

// Construction Sequence Planner
registerGenerator('construction-sequence-planner', async (item, topic, gradeContext) => ({
  type: 'construction-sequence-planner',
  instanceId: item.instanceId,
  data: await generateConstructionSequencePlanner(topic, gradeContext, item.config),
}));

// Blueprint Canvas
registerGenerator('blueprint-canvas', async (item, topic, gradeContext) => ({
  type: 'blueprint-canvas',
  instanceId: item.instanceId,
  data: await generateBlueprintCanvas(topic, gradeContext, item.config),
}));

// Machine Profile (display-only vehicle/machine profiles)
registerGenerator('machine-profile', async (item, topic, gradeContext) => ({
  type: 'machine-profile',
  instanceId: item.instanceId,
  data: await generateMachineProfile(topic, gradeContext, item.config),
}));

// Flight Forces Explorer (interactive four forces of flight)
registerGenerator('flight-forces-explorer', async (item, topic, gradeContext) => ({
  type: 'flight-forces-explorer',
  instanceId: item.instanceId,
  data: await generateFlightForcesExplorer(topic, gradeContext, item.config),
}));

// Airfoil Lab (wing shape and lift exploration)
registerGenerator('airfoil-lab', async (item, topic, gradeContext) => ({
  type: 'airfoil-lab',
  instanceId: item.instanceId,
  data: await generateAirfoilLab(topic, gradeContext, item.config),
}));

// Vehicle Comparison Lab (side-by-side vehicle data analysis)
registerGenerator('vehicle-comparison-lab', async (item, topic, gradeContext) => ({
  type: 'vehicle-comparison-lab',
  instanceId: item.instanceId,
  data: await generateVehicleComparisonLab(topic, gradeContext, item.config),
}));

// Propulsion Lab (Newton's Third Law across propulsion types)
registerGenerator('propulsion-lab', async (item, topic, gradeContext) => ({
  type: 'propulsion-lab',
  instanceId: item.instanceId,
  data: await generatePropulsionLab(topic, gradeContext, item.config),
}));

// Propulsion Timeline (history of transportation)
registerGenerator('propulsion-timeline', async (item, topic, gradeContext) => ({
  type: 'propulsion-timeline',
  instanceId: item.instanceId,
  data: await generatePropulsionTimeline(topic, gradeContext, item.config),
}));

// Paper Airplane Designer (engineering design process: design-build-test-iterate)
registerGenerator('paper-airplane-designer', async (item, topic, gradeContext) => ({
  type: 'paper-airplane-designer',
  instanceId: item.instanceId,
  data: await generatePaperAirplaneDesigner(topic, gradeContext, item.config),
}));

// Engine Explorer (interactive engine cutaway view)
registerGenerator('engine-explorer', async (item, topic, gradeContext) => ({
  type: 'engine-explorer',
  instanceId: item.instanceId,
  data: await generateEngineExplorer(topic, gradeContext, item.config),
}));

// Vehicle Design Studio (drag-and-drop vehicle designer with physics simulation)
registerGenerator('vehicle-design-studio', async (item, topic, gradeContext) => ({
  type: 'vehicle-design-studio',
  instanceId: item.instanceId,
  data: await generateVehicleDesignStudio(topic, gradeContext, item.config),
}));

// ============================================================================
// Migration status: 22/22 engineering primitives registered
// ============================================================================
