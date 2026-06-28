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

import { registerContextGenerator } from '../contentRegistry';

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
import { generateStoichiometryLab } from '../../chemistry/gemini-stoichiometry-lab';
import { generateGasLawsSimulator } from '../../chemistry/gemini-gas-laws-simulator';

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

// Molecule Viewer (3D molecular structure). Special case: the molecule prompt is
// the per-component intent/title, and generateMoleculeData takes (prompt, grade),
// so this stays a thin ctx adapter rather than a (topic, grade, config) generator.
registerContextGenerator('molecule-viewer', async (ctx) => {
  const gradeLevel = inferGradeLevel(ctx.gradeContext);
  const moleculePrompt = ctx.intent || ctx.title || ctx.topic;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await generateMoleculeData(moleculePrompt, gradeLevel as any);
  return {
    type: 'molecule-viewer',
    instanceId: ctx.instanceId,
    data
  };
});

// Periodic Table (interactive elements table). Self-contained — built inline from
// the manifest title/intent/config, sourced from ctx.
registerContextGenerator('periodic-table', async (ctx) => {
  const config = getConfig({ config: ctx.raw });
  // Periodic table is self-contained with all element data
  const data = {
    title: ctx.title || 'Periodic Table of Elements',
    description: ctx.intent || 'Explore the elements and their properties',
    highlightElements: config.highlightElements || [],
    focusCategory: config.focusCategory
  };
  return {
    type: 'periodic-table',
    instanceId: ctx.instanceId,
    data
  };
});

// Matter Explorer (interactive matter classification)
registerContextGenerator('matter-explorer', async (ctx) => ({
  type: 'matter-explorer',
  instanceId: ctx.instanceId,
  data: await generateMatterExplorer(ctx),
}));

// Reaction Lab (interactive chemistry experiment station)
registerContextGenerator('reaction-lab', async (ctx) => ({
  type: 'reaction-lab',
  instanceId: ctx.instanceId,
  data: await generateReactionLab(ctx),
}));

// States of Matter (interactive particle simulation)
registerContextGenerator('states-of-matter', async (ctx) => ({
  type: 'states-of-matter',
  instanceId: ctx.instanceId,
  data: await generateStatesOfMatter(ctx),
}));

// Atom Builder (interactive atom construction with Bohr model)
registerContextGenerator('atom-builder', async (ctx) => ({
  type: 'atom-builder',
  instanceId: ctx.instanceId,
  data: await generateAtomBuilder(ctx),
}));

// Molecule Constructor (interactive molecule building)
registerContextGenerator('molecule-constructor', async (ctx) => ({
  type: 'molecule-constructor',
  instanceId: ctx.instanceId,
  data: await generateMoleculeConstructor(ctx),
}));

// Equation Balancer (interactive chemical equation balancing)
registerContextGenerator('equation-balancer', async (ctx) => ({
  type: 'equation-balancer',
  instanceId: ctx.instanceId,
  data: await generateEquationBalancer(ctx),
}));

// Energy of Reactions (exothermic/endothermic enthalpy diagrams)
registerContextGenerator('energy-of-reactions', async (ctx) => ({
  type: 'energy-of-reactions',
  instanceId: ctx.instanceId,
  data: await generateEnergyOfReactions(ctx),
}));

// Mixing and Dissolving (interactive solutions/mixtures explorer)
registerContextGenerator('mixing-and-dissolving', async (ctx) => ({
  type: 'mixing-and-dissolving',
  instanceId: ctx.instanceId,
  data: await generateMixingAndDissolving(ctx),
}));

// pH Explorer (interactive acid-base rainbow)
registerContextGenerator('ph-explorer', async (ctx) => ({
  type: 'ph-explorer',
  instanceId: ctx.instanceId,
  data: await generatePhExplorer(ctx),
}));

// Safety Lab (lab safety training & virtual PPE)
registerContextGenerator('safety-lab', async (ctx) => ({
  type: 'safety-lab',
  instanceId: ctx.instanceId,
  data: await generateSafetyLab(ctx),
}));

// Stoichiometry Lab (mole conversions, limiting reagent, theoretical yield)
registerContextGenerator('stoichiometry-lab', async (ctx) => ({
  type: 'stoichiometry-lab',
  instanceId: ctx.instanceId,
  data: await generateStoichiometryLab(ctx),
}));

// Gas Laws Simulator (KMT + Boyle/Charles/Gay-Lussac/Combined/Ideal gas law)
registerContextGenerator('gas-laws-simulator', async (ctx) => ({
  type: 'gas-laws-simulator',
  instanceId: ctx.instanceId,
  data: await generateGasLawsSimulator(ctx),
}));
