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
// Wave 2 Imports
// ============================================================================
import { generatePhonicsBlender } from '../../literacy/gemini-phonics-blender';
import { generateDecodableReader } from '../../literacy/gemini-decodable-reader';
import { generateEvidenceFinder } from '../../literacy/gemini-evidence-finder';
import { generateContextCluesDetective } from '../../literacy/gemini-context-clues-detective';
import { generateOpinionBuilder } from '../../literacy/gemini-opinion-builder';
import { generateTextStructureAnalyzer } from '../../literacy/gemini-text-structure-analyzer';
import { generateCharacterWeb } from '../../literacy/gemini-character-web';
import { generateFigurativeLanguageFinder } from '../../literacy/gemini-figurative-language-finder';

// ============================================================================
// Wave 4 Imports
// ============================================================================
import { generatePoetryLab } from '../../literacy/gemini-poetry-lab';
import { generateReadAloudStudio } from '../../literacy/gemini-read-aloud-studio';
import { generateStoryPlanner } from '../../literacy/gemini-story-planner';
import { generateRevisionWorkshop } from '../../literacy/gemini-revision-workshop';
import { generateGenreExplorer } from '../../literacy/gemini-genre-explorer';
import { generateSpellingPatternExplorer } from '../../literacy/gemini-spelling-pattern-explorer';
import { generateRhymeStudio } from '../../literacy/gemini-rhyme-studio';
import { generateSyllableClapper } from '../../literacy/gemini-syllable-clapper';
import { generatePhonemeExplorer } from '../../literacy/gemini-phoneme-explorer';
import { generateSoundSwap } from '../../literacy/gemini-sound-swap';

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
// Wave 2: Reading Foundational Skills — Phonics Blender
// ============================================================================

/**
 * Phonics Blender - Sound-by-sound word building with phoneme tiles
 *
 * Perfect for:
 * - K-2 phonics instruction and decoding practice
 * - Phonemic awareness (blending sounds into words)
 * - CVC, CVCE, blends, digraphs, r-controlled vowels, diphthongs
 *
 * Grade Scaling:
 * - K: CVC words (3 sounds), onset-rime blending
 * - Grade 1: CVCE, blends, digraphs, short vs long vowels
 * - Grade 2: R-controlled, diphthongs, multisyllabic blending
 */
registerGenerator('phonics-blender', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  const patternType = config.patternType || undefined;

  return {
    type: 'phonics-blender',
    instanceId: item.instanceId,
    data: await generatePhonicsBlender(topic, gradeContext, {
      patternType,
      ...config,
    }),
  };
});

// ============================================================================
// Wave 2: Reading Foundational Skills — Decodable Reader
// ============================================================================

/**
 * Decodable Reader - Controlled-vocabulary reading with per-word TTS
 *
 * Perfect for:
 * - K-2 reading fluency and decoding practice
 * - Controlled-vocabulary passages matching decoding level
 * - Per-word pronunciation support via tap-to-hear
 * - Tracking which words students need help with
 *
 * Grade Scaling:
 * - K: 2-3 sentences, CVC + sight words only
 * - Grade 1: 4-6 sentences, CVCE, blends, digraphs
 * - Grade 2: 6-8 sentences, r-controlled, diphthongs, multisyllabic
 */
registerGenerator('decodable-reader', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  return {
    type: 'decodable-reader',
    instanceId: item.instanceId,
    data: await generateDecodableReader(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 2: Reading Informational Text — Evidence Finder
// ============================================================================

/**
 * Evidence Finder - Find and highlight text evidence for claims
 *
 * Perfect for:
 * - Grades 2-6 evidence-based reading comprehension
 * - Claim-Evidence-Reasoning (CER) framework practice
 * - Distinguishing evidence from opinion
 * - Evidence strength evaluation
 *
 * Grade Scaling:
 * - Grade 2: "Find the sentence that tells you..." (1 claim, explicit evidence)
 * - Grade 3: Fact vs opinion, 1 claim, 2-3 evidence sentences
 * - Grade 4: CER enabled, evidence strength rating, 1-2 claims
 * - Grade 5-6: Competing claims, nuanced evidence quality
 */
registerGenerator('evidence-finder', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  return {
    type: 'evidence-finder',
    instanceId: item.instanceId,
    data: await generateEvidenceFinder(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 2: Language — Context Clues Detective
// ============================================================================

/**
 * Context Clues Detective - Determine word meaning from surrounding text
 *
 * Perfect for:
 * - Grades 2-6 vocabulary instruction
 * - Teaching context clue strategies (definition, synonym, antonym, example, inference)
 * - Building independent word-learning skills
 *
 * Grade Scaling:
 * - Grade 2: Definition and example clues, simple vocabulary
 * - Grade 3: Add synonym clues, grade 3 vocabulary
 * - Grade 4: All five clue types, academic vocabulary
 * - Grade 5: Emphasis on inference, Greek/Latin root connections
 * - Grade 6: Connotation vs denotation, multiple-meaning words
 */
registerGenerator('context-clues-detective', async (item, topic, gradeContext) => {
  const config = getConfig(item);

  return {
    type: 'context-clues-detective',
    instanceId: item.instanceId,
    data: await generateContextCluesDetective(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 3: Writing — Opinion Builder
// ============================================================================

registerGenerator('opinion-builder', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  return {
    type: 'opinion-builder',
    instanceId: item.instanceId,
    data: await generateOpinionBuilder(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 3: Reading Informational Text — Text Structure Analyzer
// ============================================================================

registerGenerator('text-structure-analyzer', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  return {
    type: 'text-structure-analyzer',
    instanceId: item.instanceId,
    data: await generateTextStructureAnalyzer(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 3: Reading Literature — Character Web
// ============================================================================

registerGenerator('character-web', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  return {
    type: 'character-web',
    instanceId: item.instanceId,
    data: await generateCharacterWeb(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 3: Language — Figurative Language Finder
// ============================================================================

registerGenerator('figurative-language-finder', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  return {
    type: 'figurative-language-finder',
    instanceId: item.instanceId,
    data: await generateFigurativeLanguageFinder(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 4: Reading Literature — Poetry Lab
// ============================================================================

registerGenerator('poetry-lab', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  return {
    type: 'poetry-lab',
    instanceId: item.instanceId,
    data: await generatePoetryLab(topic, gradeContext, config),
  };
});

// ============================================================================
// Registration Complete
// ============================================================================

// ============================================================================
// Wave 4: Reading Foundational Skills — Read Aloud Studio
// ============================================================================

registerGenerator('read-aloud-studio', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  return {
    type: 'read-aloud-studio',
    instanceId: item.instanceId,
    data: await generateReadAloudStudio(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 4: Writing — Story Planner
// ============================================================================

registerGenerator('story-planner', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  return {
    type: 'story-planner',
    instanceId: item.instanceId,
    data: await generateStoryPlanner(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 4: Writing — Revision Workshop
// ============================================================================

registerGenerator('revision-workshop', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  return {
    type: 'revision-workshop',
    instanceId: item.instanceId,
    data: await generateRevisionWorkshop(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 4: Reading Literature — Genre Explorer
// ============================================================================

registerGenerator('genre-explorer', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  return {
    type: 'genre-explorer',
    instanceId: item.instanceId,
    data: await generateGenreExplorer(topic, gradeContext, config),
  };
});

// ============================================================================
// Wave 4: Language — Spelling Pattern Explorer
// ============================================================================

registerGenerator('spelling-pattern-explorer', async (item, topic, gradeContext) => {
  const config = getConfig(item);
  return {
    type: 'spelling-pattern-explorer',
    instanceId: item.instanceId,
    data: await generateSpellingPatternExplorer(topic, gradeContext, config),
  };
});

// ============================================================================
// Kindergarten Phonics & Alphabet — Rhyme Studio
// ============================================================================

/**
 * Rhyme Studio - Multi-mode rhyme practice (recognition, identification, production)
 *
 * Perfect for:
 * - K-2 phonological awareness and rhyme fluency
 * - Progressive difficulty: recognize → identify → produce rhymes
 * - Rhyme family pattern recognition (-at, -un, -ig, etc.)
 *
 * Grade Scaling:
 * - K: Simple CVC words, 2-option identification, common rhyme families
 * - Grade 1: CVCE words, 3-option identification, near-miss distractors
 * - Grade 2: Multisyllabic words, trickier pairs, broader vocabulary
 */
registerGenerator('rhyme-studio', async (item, topic, gradeContext) => ({
  type: 'rhyme-studio',
  instanceId: item.instanceId,
  data: await generateRhymeStudio(topic, gradeContext, item.config),
}));

// ============================================================================
// Kindergarten Phonics & Alphabet — Syllable Clapper
// ============================================================================

/**
 * Syllable Clapper - Syllable counting & segmentation practice
 *
 * Perfect for:
 * - K-2 phonological awareness and syllable segmentation
 * - Clap/tap syllable counting with immediate visual feedback
 * - Progressive difficulty: 1-syllable → 4-syllable words
 *
 * Grade Scaling:
 * - K: Simple CVC + common 2-syllable words, one or two 3-syllable
 * - Grade 1: Wider vocabulary, 1-4 syllable words
 * - Grade 2: Academic words, compound words, prefixed/suffixed words
 */
registerGenerator('syllable-clapper', async (item, topic, gradeContext) => ({
  type: 'syllable-clapper',
  instanceId: item.instanceId,
  data: await generateSyllableClapper(topic, gradeContext, item.config),
}));

// ============================================================================
// Kindergarten Phonics & Alphabet — Phoneme Explorer
// ============================================================================

/**
 * Phoneme Explorer - Phoneme isolation, onset-rime, and segmentation practice
 *
 * Perfect for:
 * - K-2 phonological awareness ("breaking apart" skills)
 * - Onset-rime blending and isolation
 * - Beginning, ending, and medial sound isolation
 * - Full phoneme segmentation
 *
 * Grade Scaling:
 * - K: Simple CVC words, 3-phoneme segmentation, common word families
 * - Grade 1: Blends, digraphs, 3-4 phoneme words, blend onsets
 * - Grade 2: Complex onsets, r-controlled vowels, 3-5 phoneme words
 */
registerGenerator('phoneme-explorer', async (item, topic, gradeContext) => ({
  type: 'phoneme-explorer',
  instanceId: item.instanceId,
  data: await generatePhonemeExplorer(topic, gradeContext, item.config),
}));

// ============================================================================
// Kindergarten Phonics & Alphabet — Sound Swap
// ============================================================================

/**
 * Sound Swap - Phoneme manipulation (addition, deletion, substitution)
 *
 * Perfect for:
 * - K-2 phoneme manipulation — the most advanced phonological awareness skill
 * - Adding, deleting, or substituting individual phonemes in words
 * - Direct predictor of reading success
 *
 * Grade Scaling:
 * - K: Simple CVC words, single consonant manipulations
 * - Grade 1: CVC/CVCC words, blends, digraphs
 * - Grade 2: CCVC, CVCC, multisyllabic, r-controlled vowels
 */
registerGenerator('sound-swap', async (item, topic, gradeContext) => ({
  type: 'sound-swap',
  instanceId: item.instanceId,
  data: await generateSoundSwap(topic, gradeContext, item.config),
}));

console.log('📚 Literacy generators registered: 22 (Wave 1-4 + Rhyme Studio + Syllable Clapper + Phoneme Explorer + Sound Swap)');
