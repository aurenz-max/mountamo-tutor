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

// ============================================================================
// Migration status: 12/12 engineering primitives registered
// ============================================================================
