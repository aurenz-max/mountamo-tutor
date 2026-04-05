/**
 * Chemistry Generators - Self-registering module for chemistry primitives
 *
 * This module registers all chemistry content generators (molecule-viewer,
 * periodic-table, matter-explorer, reaction-lab, etc.) with the ContentRegistry.
 *
 * Each generator imports from its DEDICATED service file, NOT from geminiService.ts.
 * This follows the design pattern for reducing context window requirements.
 *
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/chemistryGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// ============================================================================
// Chemistry Component Imports (from dedicated service files)
// ============================================================================
import { generateMoleculeData } from '../../chemistry/gemini-chemistry';
import { generateMatterExplorer } from '../../chemistry/gemini-matter-explorer';
import { generateReactionLab } from '../../chemistry/gemini-reaction-lab';
import { generateStatesOfMatter } from '../../chemistry/gemini-states-of-matter';
import { generateAtomBuilder } from '../../chemistry/gemini-atom-builder';
import { generateMoleculeConstructor } from '../../chemistry/gemini-molecule-constructor';
import { generateEquationBalancer } from '../../chemistry/gemini-equation-balancer';
import { generateEnergyOfReactions } from '../../chemistry/gemini-energy-of-reactions';
import { generateMixingAndDissolving } from '../../chemistry/gemini-mixing-and-dissolving';
import { generatePhExplorer } from '../../chemistry/gemini-ph-explorer';
import { generateSafetyLab } from '../../chemistry/gemini-safety-lab';

// ============================================================================
// Helper Types
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConfig = Record<string, any>;

/**
 * Helper to safely extract config values with proper typing
 */
const getConfig = (item: { config?: unknown }): AnyConfig => {
  return (item.config as AnyConfig) || {};
};

/**
 * Extract grade level from context string
 */
const inferGradeLevel = (gradeContext: string): string => {
  if (gradeContext.includes('toddler')) return 'Toddler';
  if (gradeContext.includes('preschool')) return 'Preschool';
  if (gradeContext.includes('kindergarten')) return 'Kindergarten';
  if (gradeContext.includes('elementary') || gradeContext.includes('grades 1-5')) return 'Elementary';
  if (gradeContext.includes('middle') || gradeContext.includes('grades 6-8')) return 'Middle School';
  if (gradeContext.includes('high') || gradeContext.includes('grades 9-12')) return 'High School';
  if (gradeContext.includes('undergraduate')) return 'Undergraduate';
  if (gradeContext.includes('graduate')) return 'Graduate';
  if (gradeContext.includes('phd')) return 'PhD';
  return 'Elementary';
};

// ============================================================================
// Chemistry Primitive Registrations
// ============================================================================

// Molecule Viewer (3D molecular structure)
registerGenerator('molecule-viewer', async (item, topic, gradeContext) => {
  const gradeLevel = inferGradeLevel(gradeContext);
  const moleculePrompt = item.intent || item.title || topic;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await generateMoleculeData(moleculePrompt, gradeLevel as any);
  return {
    type: 'molecule-viewer',
    instanceId: item.instanceId,
    data
  };
});

// Periodic Table (interactive elements table)
registerGenerator('periodic-table', async (item, _topic, _gradeContext) => {
  const config = getConfig(item);
  // Periodic table is self-contained with all element data
  const data = {
    title: item.title || 'Periodic Table of Elements',
    description: item.intent || 'Explore the elements and their properties',
    highlightElements: config.highlightElements || [],
    focusCategory: config.focusCategory
  };
  return {
    type: 'periodic-table',
    instanceId: item.instanceId,
    data
  };
});

// Matter Explorer (interactive matter classification)
registerGenerator('matter-explorer', async (item, topic, gradeContext) => {
  const data = await generateMatterExplorer(topic, gradeContext, {
    intent: item.intent,
  });
  return {
    type: 'matter-explorer',
    instanceId: item.instanceId,
    data,
  };
});

// Reaction Lab (interactive chemistry experiment station)
registerGenerator('reaction-lab', async (item, topic, gradeContext) => {
  const data = await generateReactionLab(topic, gradeContext, {
    intent: item.intent,
  });
  return {
    type: 'reaction-lab',
    instanceId: item.instanceId,
    data,
  };
});

// States of Matter (interactive particle simulation)
registerGenerator('states-of-matter', async (item, topic, gradeContext) => {
  const data = await generateStatesOfMatter(topic, gradeContext, {
    intent: item.intent,
  });
  return {
    type: 'states-of-matter',
    instanceId: item.instanceId,
    data,
  };
});

// Atom Builder (interactive atom construction with Bohr model)
registerGenerator('atom-builder', async (item, topic, gradeContext) => {
  const data = await generateAtomBuilder(topic, gradeContext, {
    intent: item.intent,
  });
  return {
    type: 'atom-builder',
    instanceId: item.instanceId,
    data,
  };
});

// Molecule Constructor (interactive molecule building)
registerGenerator('molecule-constructor', async (item, topic, gradeContext) => {
  const data = await generateMoleculeConstructor(topic, gradeContext, {
    intent: item.intent,
  });
  return {
    type: 'molecule-constructor',
    instanceId: item.instanceId,
    data,
  };
});

// Equation Balancer (interactive chemical equation balancing)
registerGenerator('equation-balancer', async (item, topic, gradeContext) => ({
  type: 'equation-balancer',
  instanceId: item.instanceId,
  data: await generateEquationBalancer(topic, gradeContext, item.config),
}));

// Energy of Reactions (exothermic/endothermic enthalpy diagrams)
registerGenerator('energy-of-reactions', async (item, topic, gradeContext) => ({
  type: 'energy-of-reactions',
  instanceId: item.instanceId,
  data: await generateEnergyOfReactions(topic, gradeContext, item.config),
}));

// Mixing and Dissolving (interactive solutions/mixtures explorer)
registerGenerator('mixing-and-dissolving', async (item, topic, gradeContext) => ({
  type: 'mixing-and-dissolving',
  instanceId: item.instanceId,
  data: await generateMixingAndDissolving(topic, gradeContext, item.config),
}));

// pH Explorer (interactive acid-base rainbow)
registerGenerator('ph-explorer', async (item, topic, gradeContext) => ({
  type: 'ph-explorer',
  instanceId: item.instanceId,
  data: await generatePhExplorer(topic, gradeContext, item.config),
}));

// Safety Lab (lab safety training & virtual PPE)
registerGenerator('safety-lab', async (item, topic, gradeContext) => ({
  type: 'safety-lab',
  instanceId: item.instanceId,
  data: await generateSafetyLab(topic, gradeContext, item.config),
}));
