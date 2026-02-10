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
import { generateBodySystemExplorer } from '../../biology/gemini-body-system-explorer';
import { generateHabitatDiorama } from '../../biology/gemini-habitat-diorama';
import { generateCompareContrast } from '../../biology/gemini-compare-contrast';
import { generateCompareContrastWithImages, generateCompareContrastWithImagesFromTopic } from '../../biology/gemini-compare-contrast-with-images';
import { generateProcessAnimator } from '../../biology/gemini-process-animator';
import { generateMicroscopeViewer } from '../../biology/gemini-microscope-viewer';
import { generateFoodWebBuilder } from '../../biology/gemini-food-web-builder';
import { generateAdaptationInvestigator } from '../../biology/gemini-adaptation-investigator';
import { generateCellBuilder } from '../../biology/gemini-cell-builder';
import { generateInheritanceLab } from '../../biology/gemini-inheritance-lab';

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

/**
 * Body System Explorer - Interactive layered anatomy diagram
 *
 * Perfect for:
 * - Human body systems (digestive, circulatory, respiratory, nervous, etc.)
 * - Anatomy lessons with organ details
 * - Understanding how organs work together
 * - Tracing pathways (blood flow, digestion, nerve signals)
 * - Teaching structure-function relationships
 *
 * Features:
 * - Toggle layers to show/hide different systems or organ groups
 * - Click organs to see detailed function information and fun facts
 * - Interactive pathway tracing (e.g., path of food, blood circulation)
 * - Visual connections between organs
 * - Grade-appropriate complexity and vocabulary
 * - SVG-based layered body diagram
 *
 * Grade Scaling:
 * - 2-4: Simple vocabulary, 4-6 main organs, basic pathways (3-5 steps)
 * - 5-6: Scientific terms, 6-8 organs, moderate complexity pathways (5-7 steps)
 * - 7-8: Medical terminology, 8-10+ organs, complex pathways with cellular detail (7-10+ steps)
 */
registerGenerator('body-system-explorer', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Map grade context to grade band for body system explorer
  const gradeBandMap: Record<string, '2-4' | '5-6' | '7-8'> = {
    '2': '2-4',
    '3': '2-4',
    '4': '2-4',
    '5': '5-6',
    '6': '5-6',
    '7': '7-8',
    '8': '7-8',
    '2-4': '2-4',
    '5-6': '5-6',
    '7-8': '7-8',
  };

  const gradeBand = config.gradeBand || gradeBandMap[gradeContext] || '5-6';

  // Extract system from config or try to infer from topic
  const systemKeywords: Record<string, string> = {
    'digest': 'digestive',
    'stomach': 'digestive',
    'intestine': 'digestive',
    'heart': 'circulatory',
    'blood': 'circulatory',
    'circul': 'circulatory',
    'lung': 'respiratory',
    'breath': 'respiratory',
    'respir': 'respiratory',
    'brain': 'nervous',
    'nerve': 'nervous',
    'neuron': 'nervous',
    'bone': 'skeletal',
    'skeleton': 'skeletal',
    'muscle': 'muscular',
    'immune': 'immune',
    'lymph': 'immune',
    'hormone': 'endocrine',
    'gland': 'endocrine',
    'kidney': 'urinary',
    'bladder': 'urinary',
    'urin': 'urinary',
  };

  let system = config.system;
  if (!system) {
    const topicLower = topic.toLowerCase();
    for (const [keyword, systemName] of Object.entries(systemKeywords)) {
      if (topicLower.includes(keyword)) {
        system = systemName;
        break;
      }
    }
  }

  // Default to digestive if no system detected
  if (!system) {
    system = 'digestive';
  }

  return {
    type: 'body-system-explorer',
    instanceId: item.instanceId,
    data: await generateBodySystemExplorer(system, gradeBand, config),
  };
});

/**
 * Habitat Diorama - Interactive ecosystem explorer
 *
 * Perfect for:
 * - Ecosystem and habitat studies (coral reef, rainforest, desert, tundra)
 * - Food chain and food web lessons
 * - Understanding ecological relationships (predator-prey, symbiosis, competition)
 * - Teaching about producers, consumers, and decomposers
 * - Exploring environmental features (water, sunlight, shelter)
 * - Ecosystem disruption scenarios (grades 3-8)
 * - Systems thinking and trophic cascades (grades 6-8)
 *
 * Features:
 * - Interactive organisms with detailed info cards
 * - Relationship visualization showing connections
 * - Environmental features (abiotic factors)
 * - Disruption scenarios for critical thinking
 * - Grade-appropriate complexity (K-2: observation, 3-5: food chains, 6-8: ecosystem dynamics)
 *
 * Grade Scaling:
 * - K-2: Simple observation (4-5 organisms, basic predator-prey relationships, no disruption)
 * - 3-5: Food chains (6-8 organisms, introduce symbiosis, simple disruption scenario)
 * - 6-8: Complex food webs (8-10 organisms, all relationship types, trophic cascade scenarios)
 */
registerGenerator('habitat-diorama', async (item, topic, gradeContext) => {
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
    type: 'habitat-diorama',
    instanceId: item.instanceId,
    data: await generateHabitatDiorama(topic, gradeBand, config),
  };
});

/**
 * Compare & Contrast - Side-by-side or Venn diagram comparison
 *
 * Perfect for:
 * - Organism comparisons (frog vs toad, shark vs dolphin, bee vs wasp)
 * - Cell comparisons (plant cell vs animal cell, prokaryote vs eukaryote)
 * - Organ/system comparisons (heart vs lungs, roots vs stems)
 * - Process comparisons (mitosis vs meiosis, photosynthesis vs respiration)
 * - Biome comparisons (desert vs rainforest, tundra vs taiga)
 * - Teaching similarities and differences
 *
 * Features:
 * - Two modes: side-by-side (viewing) or venn-interactive (student activity)
 * - Side-by-side mode shows aligned attributes with highlights for shared/unique
 * - Venn-interactive mode: drag attributes into correct regions (A-only, B-only, Both)
 * - Key insight explaining why the comparison matters
 * - Evaluation support in venn-interactive mode
 * - Optional AI-generated images when config.generateImages is true
 *
 * Grade Scaling:
 * - K-2: 4-6 attributes per entity, simple vocabulary, observable characteristics
 * - 3-5: 6-8 attributes, scientific terms introduced, functional characteristics
 * - 6-8: 8-10 attributes, cellular/molecular details, evolutionary context
 */
registerGenerator('bio-compare-contrast', async (item, topic, gradeContext) => {
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

  // Determine mode: default to 'side-by-side' for viewing, use config.mode if specified
  const mode = config.mode || 'side-by-side';

  // Check if images should be generated
  const generateImages = config.generateImages === true;

  // If topic contains "vs" or "versus", use the topic-based generator
  if (topic.match(/\s+(?:vs\.?|versus)\s+/i)) {
    if (generateImages) {
      return {
        type: 'bio-compare-contrast',
        instanceId: item.instanceId,
        data: await generateCompareContrastWithImagesFromTopic(topic, gradeBand, mode),
      };
    } else {
      const { generateCompareContrastFromTopic } = await import('../../biology/gemini-compare-contrast');
      return {
        type: 'bio-compare-contrast',
        instanceId: item.instanceId,
        data: await generateCompareContrastFromTopic(topic, gradeBand, mode),
      };
    }
  }

  // Otherwise, expect entityA and entityB in config
  const entityA = config.entityA || 'Frog';
  const entityB = config.entityB || 'Toad';

  if (generateImages) {
    return {
      type: 'bio-compare-contrast',
      instanceId: item.instanceId,
      data: await generateCompareContrastWithImages(entityA, entityB, gradeBand, mode, config),
    };
  } else {
    return {
      type: 'bio-compare-contrast',
      instanceId: item.instanceId,
      data: await generateCompareContrast(entityA, entityB, gradeBand, mode, config),
    };
  }
});

/**
 * Process Animator - Step-through biological process animation
 *
 * Perfect for:
 * - Photosynthesis, cellular respiration, fermentation
 * - Digestion, blood circulation, breathing
 * - Pollination, germination, transpiration
 * - Protein synthesis, DNA replication
 * - Any multi-step biological process
 *
 * Features:
 * - Step-by-step animation control (play, pause, step forward/back)
 * - Narrated stages with visual descriptions
 * - Checkpoint questions embedded at key moments
 * - Progress tracking with stage indicator bar
 * - Evaluation support for checkpoint responses
 * - Grade-appropriate scaling (2-8)
 *
 * Grade Scaling:
 * - 2-4: Simple vocabulary, 3-5 stages, basic comprehension questions
 * - 5-6: Scientific terms introduced, 4-6 stages, causal understanding questions
 * - 7-8: Advanced terminology, 5-8 stages, application and synthesis questions
 */
registerGenerator('bio-process-animator', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Map grade context to grade band for process animator
  const gradeBandMap: Record<string, '2-4' | '5-6' | '7-8'> = {
    '2': '2-4',
    '3': '2-4',
    '4': '2-4',
    '5': '5-6',
    '6': '5-6',
    '7': '7-8',
    '8': '7-8',
    '2-4': '2-4',
    '5-6': '5-6',
    '7-8': '7-8',
  };

  const gradeBand = config.gradeBand || gradeBandMap[gradeContext] || '5-6';

  return {
    type: 'bio-process-animator',
    instanceId: item.instanceId,
    data: await generateProcessAnimator(topic, gradeBand, config),
  };
});

/**
 * Microscope Viewer - Simulated microscope experience
 *
 * Perfect for:
 * - Cell biology (plant cells, animal cells, bacteria)
 * - Tissue examination (muscle, epithelial, nerve)
 * - Microorganism observation (paramecium, amoeba, euglena)
 * - Mineral/crystal structures
 * - Teaching microscope skills and scientific observation
 *
 * Features:
 * - Circular lens viewport with zoom levels (40x, 100x, 400x)
 * - Structure labeling tasks at each magnification
 * - Guided observation prompts
 * - AI-generated microscope images
 * - Evaluation support for labeling accuracy and observation quality
 *
 * Grade Scaling:
 * - 3-5: Simple vocabulary, 2-3 zoom levels, 2-4 structures per level, observable features
 * - 6-8: Scientific terms, 3-4 zoom levels, 3-6 structures per level, organelle detail
 */
registerGenerator('microscope-viewer', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Map grade context to grade band
  const gradeBandMap: Record<string, '3-5' | '6-8'> = {
    '3': '3-5',
    '4': '3-5',
    '5': '3-5',
    '6': '6-8',
    '7': '6-8',
    '8': '6-8',
    '3-5': '3-5',
    '6-8': '6-8',
  };

  const gradeBand = config.gradeBand || gradeBandMap[gradeContext] || '3-5';

  return {
    type: 'microscope-viewer',
    instanceId: item.instanceId,
    data: await generateMicroscopeViewer(topic, gradeBand, config),
  };
});

/**
 * Food Web Builder - Interactive food web construction
 *
 * Perfect for:
 * - Understanding food chains and food webs
 * - Teaching trophic levels and energy flow
 * - Producer/consumer/decomposer relationships
 * - Ecosystem disruption scenarios (keystone species, trophic cascades)
 * - Systems thinking and ecological balance
 *
 * Features:
 * - Node-graph interface with positioned organisms
 * - Draw directional arrows showing energy flow (prey → predator)
 * - Color coding by trophic level
 * - Disruption mode to explore ecosystem cascades
 * - Evaluation with connection accuracy and cascade prediction
 *
 * Grade Scaling:
 * - 3-5: Simple food chains (6-8 organisms), clear linear relationships, optional disruption
 * - 6-8: Complex food webs (8-10 organisms), interconnected relationships, required disruption scenarios
 */
registerGenerator('food-web-builder', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Map grade context to grade band
  const gradeBandMap: Record<string, '3-5' | '6-8'> = {
    '3': '3-5',
    '4': '3-5',
    '5': '3-5',
    '6': '6-8',
    '7': '6-8',
    '8': '6-8',
    '3-5': '3-5',
    '6-8': '6-8',
  };

  const gradeBand = config.gradeBand || gradeBandMap[gradeContext] || '3-5';

  return {
    type: 'food-web-builder',
    instanceId: item.instanceId,
    data: await generateFoodWebBuilder(topic, gradeBand, config),
  };
});

/**
 * Adaptation Investigator - Structure-function-environment reasoning
 *
 * Perfect for:
 * - Teaching why organisms have specific traits (structural, behavioral, physiological)
 * - Connecting adaptations to environmental pressures
 * - Causal reasoning about structure-function relationships
 * - "What If?" environmental change prediction scenarios
 * - Addressing common misconceptions about adaptation and evolution
 *
 * Features:
 * - Three-panel layout: The Trait, The Environment, The Connection
 * - "What If?" mode for grades 5-8 with predictive reasoning
 * - Common misconception section with correction
 * - AI-generated organism images
 * - Evaluation support for What If? scenario accuracy
 *
 * Grade Scaling:
 * - 2-4: Simple vocabulary, observable traits, 2 What If? scenarios
 * - 5-6: Scientific vocabulary introduced, functional descriptions, 2-3 scenarios
 * - 7-8: Evolutionary context, natural selection concepts, 3 nuanced scenarios
 */
registerGenerator('adaptation-investigator', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Map grade context to grade band
  const gradeBandMap: Record<string, '2-4' | '5-6' | '7-8'> = {
    '2': '2-4',
    '3': '2-4',
    '4': '2-4',
    '5': '5-6',
    '6': '5-6',
    '7': '7-8',
    '8': '7-8',
    '2-4': '2-4',
    '5-6': '5-6',
    '7-8': '7-8',
  };

  const gradeBand = config.gradeBand || gradeBandMap[gradeContext] || '5-6';

  return {
    type: 'adaptation-investigator',
    instanceId: item.instanceId,
    data: await generateAdaptationInvestigator(topic, gradeBand, config),
  };
});

/**
 * Cell Builder - Three-phase interactive cell biology primitive
 *
 * Perfect for:
 * - Cell structure lessons (animal, plant, prokaryotic, fungal cells)
 * - Specialized cell contexts (muscle, nerve, leaf, root cells)
 * - Organelle classification (which belong vs distractors)
 * - Zone-based spatial reasoning (center, peripheral, near-nucleus, etc.)
 * - Quantity reasoning (muscle cells need lots of mitochondria)
 * - Structure-function mapping via matching quiz
 *
 * Three Phases:
 * 1. Sort: Classify organelles as belonging or not belonging (distractors)
 * 2. Place + Quantity: Zone-based placement + quantity reasoning for specialized cells
 * 3. Match Functions: Click-to-match organelles with function descriptions
 *
 * Grade Scaling:
 * - 4-5: Simple vocabulary, 5-7 organelles + 2-3 distractors, everyday analogies
 * - 6-8: Scientific terminology, 7-10 organelles + 3-4 distractors, detailed functions
 */
registerGenerator('cell-builder', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Map grade context to grade band
  const gradeBandMap: Record<string, '4-5' | '6-8'> = {
    '4': '4-5',
    '5': '4-5',
    '6': '6-8',
    '7': '6-8',
    '8': '6-8',
    '4-5': '4-5',
    '6-8': '6-8',
  };

  const gradeBand = config.gradeBand || gradeBandMap[gradeContext] || '4-5';

  return {
    type: 'cell-builder',
    instanceId: item.instanceId,
    data: await generateCellBuilder(topic, gradeBand, config),
  };
});

/**
 * Inheritance Lab - Interactive Punnett square and trait prediction tool
 *
 * Perfect for:
 * - Mendelian genetics (monohybrid crosses, dominant/recessive traits)
 * - Dihybrid crosses and independent assortment (grade 8)
 * - Incomplete dominance and codominance (grade 8)
 * - X-linked inheritance patterns (grade 8)
 * - Probability and ratio prediction in biology
 * - Connecting genetics to real-world traits (flower color, eye color, etc.)
 *
 * Features:
 * - Interactive Punnett square grid with student-fillable cells
 * - Genotype and phenotype visualization
 * - Population simulation showing predicted vs observed ratios
 * - Expected genotypic and phenotypic ratio display
 * - Real-world trait examples
 * - Evaluation tracking for Punnett square accuracy
 *
 * Grade Scaling:
 * - 6-7: Monohybrid crosses only, complete dominance, 2x2 grid, simple vocabulary
 * - 8: Mono- or dihybrid crosses, incomplete dominance/codominance/x-linked, scientific terminology
 */
registerGenerator('inheritance-lab', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  // Map grade context to grade band
  const gradeBandMap: Record<string, '6-7' | '8'> = {
    '6': '6-7',
    '7': '6-7',
    '8': '8',
    '6-7': '6-7',
    '8': '8',
  };

  const gradeBand = config.gradeBand || gradeBandMap[gradeContext] || '6-7';

  return {
    type: 'inheritance-lab',
    instanceId: item.instanceId,
    data: await generateInheritanceLab(topic, gradeBand, config),
  };
});

// ============================================================================
// Export generator count for documentation
// ============================================================================

// Total: 13 biology generators
// - species-profile
// - organism-card
// - classification-sorter
// - life-cycle-sequencer
// - body-system-explorer
// - habitat-diorama
// - bio-compare-contrast
// - bio-process-animator
// - microscope-viewer
// - food-web-builder
// - adaptation-investigator
// - inheritance-lab

console.log('✅ Biology Generators Registered: species-profile, organism-card, classification-sorter, life-cycle-sequencer, body-system-explorer, habitat-diorama, bio-compare-contrast, bio-process-animator, microscope-viewer, food-web-builder, adaptation-investigator, cell-builder, inheritance-lab');
