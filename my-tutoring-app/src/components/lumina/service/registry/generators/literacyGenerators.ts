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

import { registerContextGenerator } from '../contentRegistry';

// ============================================================================
// Wave 1 Imports (highest priority)
// ============================================================================
import { generateParagraphArchitect } from '../../literacy/gemini-paragraph-architect';
import { generateSentenceBuilder } from '../../literacy/gemini-sentence-builder';
import { generateStoryMap } from '../../literacy/gemini-story-map';

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
import { generateLetterSpotter } from '../../literacy/gemini-letter-spotter';
import { generateLetterSoundLink } from '../../literacy/gemini-letter-sound-link';
import { generateCvcSpeller } from '../../literacy/gemini-cvc-speller';
import { generateWordWorkout } from '../../literacy/gemini-word-workout';
import { generateWordSorter } from '../../literacy/gemini-word-sorter';
import { generatePictureVocabulary } from '../../literacy/gemini-picture-vocabulary';

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
registerContextGenerator('paragraph-architect', async (ctx) => ({
  type: 'paragraph-architect',
  instanceId: ctx.instanceId,
  data: await generateParagraphArchitect(ctx),
}));

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
registerContextGenerator('sentence-builder', async (ctx) => ({
  type: 'sentence-builder',
  instanceId: ctx.instanceId,
  data: await generateSentenceBuilder(ctx),
}));

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
registerContextGenerator('story-map', async (ctx) => ({
  type: 'story-map',
  instanceId: ctx.instanceId,
  data: await generateStoryMap(ctx),
}));

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
registerContextGenerator('phonics-blender', async (ctx) => ({
  type: 'phonics-blender',
  instanceId: ctx.instanceId,
  data: await generatePhonicsBlender(ctx),
}));

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
registerContextGenerator('decodable-reader', async (ctx) => ({
  type: 'decodable-reader',
  instanceId: ctx.instanceId,
  data: await generateDecodableReader(ctx),
}));

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
registerContextGenerator('evidence-finder', async (ctx) => ({
  type: 'evidence-finder',
  instanceId: ctx.instanceId,
  data: await generateEvidenceFinder(ctx),
}));

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
registerContextGenerator('context-clues-detective', async (ctx) => ({
  type: 'context-clues-detective',
  instanceId: ctx.instanceId,
  data: await generateContextCluesDetective(ctx),
}));

// ============================================================================
// Wave 3: Writing — Opinion Builder
// ============================================================================

registerContextGenerator('opinion-builder', async (ctx) => ({
  type: 'opinion-builder',
  instanceId: ctx.instanceId,
  data: await generateOpinionBuilder(ctx),
}));

// ============================================================================
// Wave 3: Reading Informational Text — Text Structure Analyzer
// ============================================================================

registerContextGenerator('text-structure-analyzer', async (ctx) => ({
  type: 'text-structure-analyzer',
  instanceId: ctx.instanceId,
  data: await generateTextStructureAnalyzer(ctx),
}));

// ============================================================================
// Wave 3: Reading Literature — Character Web
// ============================================================================

registerContextGenerator('character-web', async (ctx) => ({
  type: 'character-web',
  instanceId: ctx.instanceId,
  data: await generateCharacterWeb(ctx),
}));

// ============================================================================
// Wave 3: Language — Figurative Language Finder
// ============================================================================

registerContextGenerator('figurative-language-finder', async (ctx) => ({
  type: 'figurative-language-finder',
  instanceId: ctx.instanceId,
  data: await generateFigurativeLanguageFinder(ctx),
}));

// ============================================================================
// Wave 4: Reading Literature — Poetry Lab
// ============================================================================

registerContextGenerator('poetry-lab', async (ctx) => ({
  type: 'poetry-lab',
  instanceId: ctx.instanceId,
  data: await generatePoetryLab(ctx),
}));

// ============================================================================
// Registration Complete
// ============================================================================

// ============================================================================
// Wave 4: Reading Foundational Skills — Read Aloud Studio
// ============================================================================

registerContextGenerator('read-aloud-studio', async (ctx) => ({
  type: 'read-aloud-studio',
  instanceId: ctx.instanceId,
  data: await generateReadAloudStudio(ctx),
}));

// ============================================================================
// Wave 4: Writing — Story Planner
// ============================================================================

registerContextGenerator('story-planner', async (ctx) => ({
  type: 'story-planner',
  instanceId: ctx.instanceId,
  data: await generateStoryPlanner(ctx),
}));

// ============================================================================
// Wave 4: Writing — Revision Workshop
// ============================================================================

registerContextGenerator('revision-workshop', async (ctx) => ({
  type: 'revision-workshop',
  instanceId: ctx.instanceId,
  data: await generateRevisionWorkshop(ctx),
}));

// ============================================================================
// Wave 4: Reading Literature — Genre Explorer
// ============================================================================

registerContextGenerator('genre-explorer', async (ctx) => ({
  type: 'genre-explorer',
  instanceId: ctx.instanceId,
  data: await generateGenreExplorer(ctx),
}));

// ============================================================================
// Wave 4: Language — Spelling Pattern Explorer
// ============================================================================

registerContextGenerator('spelling-pattern-explorer', async (ctx) => ({
  type: 'spelling-pattern-explorer',
  instanceId: ctx.instanceId,
  data: await generateSpellingPatternExplorer(ctx),
}));

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
registerContextGenerator('rhyme-studio', async (ctx) => ({
  type: 'rhyme-studio',
  instanceId: ctx.instanceId,
  data: await generateRhymeStudio(ctx),
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
registerContextGenerator('syllable-clapper', async (ctx) => ({
  type: 'syllable-clapper',
  instanceId: ctx.instanceId,
  data: await generateSyllableClapper(ctx),
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
registerContextGenerator('phoneme-explorer', async (ctx) => ({
  type: 'phoneme-explorer',
  instanceId: ctx.instanceId,
  data: await generatePhonemeExplorer(ctx),
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
registerContextGenerator('sound-swap', async (ctx) => ({
  type: 'sound-swap',
  instanceId: ctx.instanceId,
  data: await generateSoundSwap(ctx),
}));

// ============================================================================
// Kindergarten Phonics & Alphabet — Letter Spotter
// ============================================================================

/**
 * Letter Spotter - Interactive letter recognition across three modes
 *
 * Perfect for:
 * - K-2 letter identification and alphabet knowledge
 * - Name It: see a letter, pick its name from options
 * - Find It: hear a letter name, find all instances in a 4x4 grid
 * - Match It: match uppercase to lowercase
 * - Cumulative group progression (4 groups covering all 26 letters)
 *
 * Grade Scaling:
 * - K: Groups 1-2, high-frequency letters, larger visual display
 * - Grade 1: Groups 2-3, uppercase/lowercase discrimination
 * - Grade 2: Groups 3-4, full alphabet review with similar-letter distractors
 */
registerContextGenerator('letter-spotter', async (ctx) => ({
  type: 'letter-spotter',
  instanceId: ctx.instanceId,
  data: await generateLetterSpotter(ctx),
}));

// ============================================================================
// Kindergarten Phonics & Alphabet — Letter Sound Link
// ============================================================================

/**
 * Letter Sound Link - Letter-sound correspondence mapping
 *
 * Perfect for:
 * - K-2 phonics and alphabetic principle instruction
 * - See-Hear: see a letter, pick its phoneme from options
 * - Hear-See: hear a sound, identify which letter makes it
 * - Keyword-Match: match letter to keyword association (s -> sun)
 * - Cumulative group progression (4 groups covering all 26 letters + qu)
 *
 * Grade Scaling:
 * - K: Groups 1-2, high-frequency letter sounds, keyword anchoring
 * - Grade 1: Groups 2-3, c/k disambiguation, more distractors
 * - Grade 2: Groups 3-4, full alphabet including x=/ks/ and qu=/kw/
 */
registerContextGenerator('letter-sound-link', async (ctx) => ({
  type: 'letter-sound-link',
  instanceId: ctx.instanceId,
  data: await generateLetterSoundLink(ctx),
}));

// ============================================================================
// Kindergarten Phonics & Alphabet — CVC Speller
// ============================================================================

/**
 * CVC Speller - CVC word encoding (spelling from audio)
 *
 * Perfect for:
 * - K-2 CVC word spelling and phonemic encoding
 * - Students hear a CVC word and spell it by placing letters in 3 slots
 * - Short vowel focus with progressive letter group difficulty
 * - Common error feedback for targeted remediation
 *
 * Grade Scaling:
 * - K: Letter groups 1-2, simple CVC words, high-frequency consonants
 * - Grade 1: Letter groups 2-3, wider CVC vocabulary
 * - Grade 2: Letter groups 3-4, full consonant set, review and fluency
 */
registerContextGenerator('cvc-speller', async (ctx) => ({
  type: 'cvc-speller',
  instanceId: ctx.instanceId,
  data: await generateCvcSpeller(ctx),
}));

// ============================================================================
// Kindergarten Phonics & Alphabet — Word Workout
// ============================================================================

/**
 * Word Workout - CVC word application across 4 modes
 *
 * Perfect for:
 * - K-2 CVC word fluency and application
 * - Real vs. Nonsense: distinguish real CVC words from plausible nonsense
 * - Picture Match: match CVC words to emoji pictures
 * - Word Chains: read chains of words with one-letter changes
 * - Sentence Reading: read decodable sentences built from CVC + sight words
 *
 * Grade Scaling:
 * - K: Simple CVC words, short vowels, common consonants
 * - Grade 1: Wider CVC vocabulary, mixed vowels
 * - Grade 2: Full CVC mastery review, fluency focus
 */
registerContextGenerator('word-workout', async (ctx) => ({
  type: 'word-workout',
  instanceId: ctx.instanceId,
  data: await generateWordWorkout(ctx),
}));

// ============================================================================
// Language — Word Sorter
// ============================================================================

/**
 * Word Sorter - Drag word cards into category buckets
 *
 * Perfect for:
 * - K-2 grammar, vocabulary, and comprehension sorting
 * - Binary sort (2 buckets), ternary sort (3 buckets), pair matching
 * - Parts of speech, singular/plural, opposites, synonyms
 *
 * Grade Scaling:
 * - K: Simple concrete categories, every card has emoji, 1-syllable words
 * - Grade 1: Nouns/verbs, singular/plural, beginning sounds
 * - Grade 2: Tense sorting, compound words, synonyms/antonyms
 */
registerContextGenerator('word-sorter', async (ctx) => ({
  type: 'word-sorter',
  instanceId: ctx.instanceId,
  data: await generateWordSorter(ctx),
}));

// ============================================================================
// Speaking & Listening / Language — Picture Vocabulary
// ============================================================================

/**
 * Picture Vocabulary - Spoken picture vocabulary with speech judge (tap fallback)
 *
 * Perfect for:
 * - K-1 oral vocabulary development and word production
 * - Listen & Find: hear a word, tap the matching picture
 * - Say It: see a picture, name it aloud (speech-judged)
 * - Opposites: see a word+picture, say its opposite
 * - Finish the Sentence: hear a sentence with a blank, say the missing word
 *
 * Grade Scaling:
 * - K: everyday concrete nouns (animals, foods, clothes, home)
 * - Grade 1: broader vocabulary, opposites, sentence-frame production
 */
registerContextGenerator('picture-vocabulary', async (ctx) => ({
  type: 'picture-vocabulary',
  instanceId: ctx.instanceId,
  data: await generatePictureVocabulary(ctx),
}));

console.log('📚 Literacy generators registered: 28 (Wave 1-4 + Rhyme Studio + Syllable Clapper + Phoneme Explorer + Sound Swap + Letter Spotter + Letter Sound Link + CVC Speller + Word Workout + Word Sorter + Picture Vocabulary)');
