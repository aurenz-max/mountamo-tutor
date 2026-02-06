/**
 * Biology Generators - Self-registering module for biology primitives
 *
 * This module registers all biology content generators (species-profile, etc.)
 * with the ContentRegistry.
 *
 * Each generator imports from its DEDICATED service file, NOT from geminiService.ts.
 * This follows the design pattern for reducing context window requirements.
 *
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/biologyGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// ============================================================================
// Biology Component Imports (from dedicated service files)
// ============================================================================
import { generateSpeciesProfile } from '../../biology/gemini-species-profile';
import { generateOrganismCard } from '../../biology/gemini-organism-card';
import { generateClassificationSorter } from '../../biology/gemini-classification-sorter';
import { generateLifeCycleSequencer } from '../../biology/gemini-life-cycle-sequencer';

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

// ============================================================================
// Biology Primitive Registrations
// ============================================================================

/**
 * Species Profile - Comprehensive species information with taxonomy, habitat, and characteristics
 *
 * Perfect for:
 * - Dinosaur profiles (T-Rex, Velociraptor, Triceratops, etc.)
 * - Modern animal studies (mammals, reptiles, birds, fish)
 * - Plant species information
 * - Comparative biology lessons
 * - Ecosystem and habitat studies
 *
 * Features:
 * - Physical stats with real-world comparisons
 * - Diet, behavior, and hunting strategies
 * - Habitat and geographic/temporal information
 * - Complete taxonomic classification
 * - Fascinating facts and discovery history
 * - AI-generated species images
 */
registerGenerator('species-profile', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Extract species name from config or topic
  const speciesName = config.speciesName || topic;

  return {
    type: 'species-profile',
    instanceId: item.instanceId,
    data: await generateSpeciesProfile(speciesName, gradeContext, config),
  };
});

/**
 * Organism Card - Foundational organism information card
 *
 * Perfect for:
 * - K-8 biology lessons (scales from simple to complex)
 * - Classification activities (sorting organisms by attributes)
 * - Comparison lessons (side-by-side organism cards)
 * - Reference material (quick organism facts)
 * - Introduction to taxonomy and biological diversity
 *
 * Features:
 * - Grade-appropriate complexity (K-2: basic, 3-5: intermediate, 6-8: advanced)
 * - Configurable visible fields based on grade level
 * - Key biological attributes (habitat, diet, size, locomotion, lifespan)
 * - Optional taxonomy for upper grades
 * - Fun facts to engage students
 * - Visual image prompts
 *
 * Grade Scaling:
 * - K-2: Simple vocabulary, 3-4 basic attributes, no scientific names
 * - 3-5: Scientific names, body temperature, reproduction, adaptations
 * - 6-8: Full taxonomy, cellular characteristics, evolutionary context
 */
registerGenerator('organism-card', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Extract organism name from config or topic
  const organismName = config.organismName || config.speciesName || topic;

  // Map grade context to grade band
  const gradeBandMap: Record<string, 'K-2' | '3-5' | '6-8'> = {
    'K': 'K-2',
    '1': 'K-2',
    '2': 'K-2',
    '3': '3-5',
    '4': '3-5',
    '5': '3-5',
    '6': '6-8',
    '7': '6-8',
    '8': '6-8',
    'K-2': 'K-2',
    '3-5': '3-5',
    '6-8': '6-8',
  };

  const gradeBand = config.gradeBand || gradeBandMap[gradeContext] || '3-5';

  return {
    type: 'organism-card',
    instanceId: item.instanceId,
    data: await generateOrganismCard(organismName, gradeBand, config),
  };
});

/**
 * Classification Sorter - Interactive drag-and-drop categorization
 *
 * Perfect for:
 * - Classification activities (sorting organisms into groups)
 * - Property-based sorting (warm-blooded vs cold-blooded)
 * - Taxonomic classification lessons
 * - Habitat sorting (aquatic vs terrestrial)
 * - Diet sorting (herbivore vs carnivore vs omnivore)
 * - Characteristic discrimination
 *
 * Features:
 * - Drag-and-drop interface with immediate feedback
 * - Binary sorts (K-2) to multi-category sorts (3-5, 6-8)
 * - Hierarchical classification support (6-8)
 * - Helpful hints on incorrect placements
 * - Boundary case items to challenge thinking
 * - Evaluation with first-attempt tracking
 *
 * Grade Scaling:
 * - K-2: Binary sorts (2 categories), 6-8 items, simple vocabulary
 * - 3-5: Multi-category sorts (3-5 categories), 8-10 items, scientific terms introduced
 * - 6-8: Complex/hierarchical sorts, 10-12 items, formal classification systems
 */
registerGenerator('classification-sorter', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Map grade context to grade band
  const gradeBandMap: Record<string, 'K-2' | '3-5' | '6-8'> = {
    'K': 'K-2',
    '1': 'K-2',
    '2': 'K-2',
    '3': '3-5',
    '4': '3-5',
    '5': '3-5',
    '6': '6-8',
    '7': '6-8',
    '8': '6-8',
    'K-2': 'K-2',
    '3-5': '3-5',
    '6-8': '6-8',
  };

  const gradeBand = config.gradeBand || gradeBandMap[gradeContext] || '3-5';

  return {
    type: 'classification-sorter',
    instanceId: item.instanceId,
    data: await generateClassificationSorter(topic, gradeBand, config),
  };
});

/**
 * Life Cycle Sequencer - Interactive temporal sequencing activity
 *
 * Perfect for:
 * - Organismal life cycles (butterfly, frog, plant, human development)
 * - Cellular processes (mitosis phases, meiosis, cell cycle)
 * - Ecological cycles (water cycle, carbon cycle, nitrogen cycle, rock cycle)
 * - Developmental sequences (embryo to adult, seed to plant)
 * - Teaching temporal relationships and transformation
 *
 * Features:
 * - Drag-and-drop interface with stage cards
 * - Linear layout for developmental sequences (embryo → adult)
 * - Circular layout for repeating cycles (water cycle, cell cycle)
 * - Connecting arrows show transitions between stages
 * - Duration indicators for each stage
 * - Misconception traps highlight common errors
 * - Evaluation with first-attempt tracking
 *
 * Grade Scaling:
 * - K-2: Simple linear sequences (4-6 stages), basic vocabulary, observable changes
 * - 3-5: More complex cycles (5-7 stages), scientific terms introduced, mechanisms explained
 * - 6-8: Complex circular/linear cycles (6-8 stages), molecular details, precise mechanisms
 */
registerGenerator('life-cycle-sequencer', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Map grade context to grade band
  const gradeBandMap: Record<string, 'K-2' | '3-5' | '6-8'> = {
    'K': 'K-2',
    '1': 'K-2',
    '2': 'K-2',
    '3': '3-5',
    '4': '3-5',
    '5': '3-5',
    '6': '6-8',
    '7': '6-8',
    '8': '6-8',
    'K-2': 'K-2',
    '3-5': '3-5',
    '6-8': '6-8',
  };

  const gradeBand = config.gradeBand || gradeBandMap[gradeContext] || '3-5';

  return {
    type: 'life-cycle-sequencer',
    instanceId: item.instanceId,
    data: await generateLifeCycleSequencer(topic, gradeBand, config),
  };
});

// ============================================================================
// Export generator count for documentation
// ============================================================================

// Total: 4 biology generators
// - species-profile
// - organism-card
// - classification-sorter
// - life-cycle-sequencer

console.log('✅ Biology Generators Registered: species-profile, organism-card, classification-sorter, life-cycle-sequencer');
