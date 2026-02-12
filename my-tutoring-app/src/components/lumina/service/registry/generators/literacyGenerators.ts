/**
 * Literacy Generators - Self-registering module for K-6 language arts primitives
 *
 * This module registers all literacy content generators with the ContentRegistry.
 * Organized by Common Core ELA strands:
 *   RF: Reading Foundational Skills
 *   RL: Reading Literature
 *   W:  Writing
 *   SL: Speaking & Listening
 *   L:  Language
 *
 * See PRD_LANGUAGE_ARTS_SUITE.md for full specification.
 *
 * Import this file for side-effects to register the generators.
 *
 * Usage: import './registry/generators/literacyGenerators';
 */

import { registerGenerator } from '../contentRegistry';

// ============================================================================
// Wave 1 Imports (highest priority)
// ============================================================================
import { generateParagraphArchitect } from '../../literacy/gemini-paragraph-architect';
import { generateSentenceBuilder } from '../../literacy/gemini-sentence-builder';
import { generateStoryMap } from '../../literacy/gemini-story-map';
import { generateListenAndRespond } from '../../literacy/gemini-listen-and-respond';

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
 * Map individual grade levels to ELA grade bands
 */
const getGradeBand = (gradeContext: string): string => {
  const grade = gradeContext.replace(/[^0-9K]/gi, '').toUpperCase();
  if (grade === 'K' || grade === '1') return 'K-1';
  if (grade === '2' || grade === '3') return '2-3';
  if (grade === '4' || grade === '5') return '4-5';
  return '5-6';
};

// ============================================================================
// Wave 1: Writing — Paragraph Architect
// ============================================================================

/**
 * Paragraph Architect - Scaffolded paragraph construction
 *
 * Perfect for:
 * - Teaching paragraph structure (topic, details, conclusion)
 * - Informational, narrative, and opinion paragraph types
 * - Writing workshops and scaffolded writing practice
 *
 * Grade Scaling:
 * - Grade 1: Heavy scaffolding, 2 details
 * - Grade 2-3: Full hamburger, linking words
 * - Grade 4-6: Multi-paragraph preview, varying sentence structure
 */
registerGenerator('paragraph-architect', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const paragraphType = config.paragraphType || 'informational';

  return {
    type: 'paragraph-architect',
    instanceId: item.instanceId,
    data: await generateParagraphArchitect(topic, gradeContext, {
      paragraphType,
      ...config,
    }),
  };
});

// ============================================================================
// Wave 1: Language — Sentence Builder
// ============================================================================

/**
 * Sentence Builder - Construct grammatical sentences from word tiles
 *
 * Perfect for:
 * - Grammar and syntax instruction
 * - Subject-verb-object understanding
 * - Progressive sentence complexity (simple → compound-complex)
 *
 * Grade Scaling:
 * - Grade 1: S+V (3-4 tiles)
 * - Grade 2: S+V+O (4-5 tiles)
 * - Grade 3: Compound with conjunctions (6-7 tiles)
 * - Grade 4-6: Complex and compound-complex (7-10 tiles)
 */
registerGenerator('sentence-builder', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  return {
    type: 'sentence-builder',
    instanceId: item.instanceId,
    data: await generateSentenceBuilder(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 1: Reading Literature — Story Map
// ============================================================================

/**
 * Story Map - Interactive plot structure diagram
 *
 * Perfect for:
 * - Reading comprehension K-6
 * - Plot structure analysis (BME, story mountain, plot diagram)
 * - Character and setting identification
 * - Narrative analysis and literary response
 *
 * Grade Scaling:
 * - K-1: Beginning-middle-end
 * - Grade 2-3: Story mountain
 * - Grade 4-6: Full plot diagram with conflict types
 */
registerGenerator('story-map', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  return {
    type: 'story-map',
    instanceId: item.instanceId,
    data: await generateStoryMap(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 1: Speaking & Listening — Listen and Respond
// ============================================================================

/**
 * Listen and Respond - Audio comprehension with hidden text
 *
 * Perfect for:
 * - Listening comprehension K-6
 * - Auditory processing skills
 * - Identifying main idea, details, and speaker purpose
 * - Note-taking and active listening practice
 *
 * Grade Scaling:
 * - K: 30-60 sec story, "Who?" and "What happened?" questions
 * - Grade 1-2: 1-2 minute passage, retelling and main topic
 * - Grade 3-4: Main idea, speaker's purpose
 * - Grade 5-6: Evaluate arguments, identify rhetorical techniques
 */
registerGenerator('listen-and-respond', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const passageType = (config.passageType || 'narrative') as 'narrative' | 'informational' | 'persuasive' | 'dialogue';

  return {
    type: 'listen-and-respond',
    instanceId: item.instanceId,
    data: await generateListenAndRespond(topic, gradeContext, passageType, config),
  };
});

// ============================================================================
// Registration Complete
// ============================================================================

console.log('📚 Literacy generators registered: 4 (Wave 1)');
