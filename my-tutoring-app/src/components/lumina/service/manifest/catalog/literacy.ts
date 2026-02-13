/**
 * Literacy Catalog - Component definitions for language arts primitives
 *
 * Contains components for reading, writing, vocabulary, and language learning.
 * Organized by Common Core ELA strands:
 *   RF: Reading Foundational Skills
 *   RL: Reading Literature
 *   RI: Reading Informational Text
 *   W:  Writing
 *   SL: Speaking & Listening
 *   L:  Language
 *
 * See PRD_LANGUAGE_ARTS_SUITE.md for full specification.
 */

import { ComponentDefinition } from '../../../types';

export const LITERACY_CATALOG: ComponentDefinition[] = [
  // ===== EXISTING PRIMITIVES =====
  {
    id: 'sentence-analyzer',
    description: 'Linguistic breakdown of sentence structure. Use for grammar, syntax, or language learning.',
    constraints: 'Requires language/grammar content'
  },
  {
    id: 'word-builder',
    description: 'Interactive morphology lab where students construct complex words from roots, prefixes, and suffixes to understand their meaning. Drag-and-drop construction with visual breakdown showing how word parts combine. Perfect for vocabulary development, etymology, and morphological analysis in language arts.',
    constraints: 'Best for grades 3-8. Requires words that can be meaningfully broken into morphological components (prefixes, roots, suffixes).'
  },

  // ===== READING: FOUNDATIONAL SKILLS (RF) =====
  {
    id: 'phonics-blender',
    description: 'Sound-by-sound word building with phoneme tiles. Students tap to hear individual sounds, then blend into words. Supports CVC, CVCE, blends, digraphs, diphthongs, and r-controlled vowels. Audio playback via TTS. AI-generated word images on success. ESSENTIAL for K-2 phonics instruction.',
    constraints: 'Grades K-2 only. Requires phonics/decoding content.',
    tutoring: {
      taskDescription:
        'You ARE the voice of this phonics blending activity. '
        + 'Your primary job is to pronounce sounds and words when the student taps tiles. '
        + 'Pattern: {{patternType}}, Grade {{gradeLevel}}. '
        + 'Word {{completedWords}}/{{totalWords}}: "{{currentWord}}". '
        + 'Phase: {{currentPhase}}. Phonemes: {{targetPhonemes}}. '
        + 'Student has placed: {{placedPhonemes}}. Attempts on this word: {{attempts}}. '
        + 'CRITICAL: When you see [PRONOUNCE], respond with ONLY the requested sound or word — '
        + 'no extra words, no encouragement, no explanation. Just the clear pronunciation. '
        + 'For phonemes, say the isolated sound (e.g., just "sss" for /s/, just "aaa" for /a/). '
        + 'For words, say the word naturally (e.g., "sun"). '
        + 'When the student asks for HINTS (not pronunciation), then use the scaffolding levels below.',
      contextKeys: [
        'currentWord', 'currentPhase', 'targetPhonemes',
        'placedPhonemes', 'patternType', 'attempts',
        'completedWords', 'totalWords', 'gradeLevel',
      ],
      scaffoldingLevels: {
        level1:
          'LISTEN phase: "Can you hear each sound? Tap the tiles!" '
          + 'BUILD phase: "Which sound comes first in {{currentWord}}?" '
          + 'BLEND phase: "Try saying all the sounds together quickly!"',
        level2:
          'LISTEN phase: "Tap each tile and listen carefully to each sound." '
          + 'BUILD phase: "{{currentWord}} starts with the first sound in {{targetPhonemes}}—find that tile!" '
          + 'BLEND phase: "Let\'s blend: {{targetPhonemes}} → {{currentWord}}"',
        level3:
          'LISTEN phase: "These sounds make the word {{currentWord}}. Let me say them: {{targetPhonemes}}." '
          + 'BUILD phase: "Put them in this order: {{targetPhonemes}}. Drag each tile one at a time." '
          + 'BLEND phase: "Run the sounds together fast: {{currentWord}}! You did it!"',
      },
      commonStruggles: [
        { pattern: 'Wrong phoneme order in build phase', response: "Say {{currentWord}} slowly—what's the FIRST sound you hear?" },
        { pattern: 'Multiple failed attempts (attempts > 2)', response: "Let's go back and tap each sound tile for {{currentWord}} one more time." },
        { pattern: 'Cannot blend sounds together', response: 'Start with just the first two sounds together, then add the next one.' },
        { pattern: 'Skipping listen phase too quickly', response: "Let's hear each sound one more time before we start building." },
        { pattern: 'Confusing similar sounds', response: "Listen again—tap the two sounds you\'re unsure about and compare them." },
      ],
    },
  },
  {
    id: 'decodable-reader',
    description: 'Controlled-vocabulary reading passages with per-word TTS support. Every word is tappable for pronunciation. Tracks which words students tap (decoding difficulty proxy). Includes embedded comprehension question. Words color-coded by phonics pattern. ESSENTIAL for K-2 reading fluency.',
    constraints: 'Grades K-2. Requires controlled phonics patterns matching student decoding level.'
  },

  // ===== READING: LITERATURE (RL) =====
  {
    id: 'story-map',
    description: 'Interactive plot structure diagram where students identify and place story elements on a visual arc. Supports beginning-middle-end (K-1), story mountain (2-3), full plot diagram (4-5), and hero\'s journey (5-6). Students drag event cards to arc positions. ESSENTIAL for reading comprehension K-6.',
    constraints: 'Requires narrative text. Structure type should match grade level.',
    tutoring: {
      taskDescription: 'Map story elements to {{structureType}} structure. Current phase: {{currentPhase}}. Elements found: {{elementsIdentified}}.',
      contextKeys: ['structureType', 'currentPhase', 'elementsIdentified'],
      scaffoldingLevels: {
        level1: 'Think about what happens at this part of the story.',
        level2: 'Remember when [character] did [action]? Which part does that belong in?',
        level3: 'The [element] usually comes here. Look for clues like [signal words].',
      },
      commonStruggles: [
        { pattern: 'Confusing parts', response: 'Point to visual structure, ask where event fits' },
        { pattern: 'Missing elements', response: "What haven't we filled in yet?" },
        { pattern: 'Wrong sequence', response: 'Think about what happened first, next, last' },
      ],
    },
  },
  {
    id: 'character-web',
    description: 'Interactive node-and-edge graph for character analysis and relationship mapping. Students build character profiles with traits and text evidence citations, then map relationships between characters. Tracks character change over time. Perfect for literary analysis grades 2-6.',
    constraints: 'Requires narrative text with 2+ characters. Best for grades 2-6.'
  },
  {
    id: 'poetry-lab',
    description: 'Dual-mode poetry primitive. Analysis mode: examine poems with interactive annotations for rhyme scheme, meter, figurative language, and structure. Composition mode: write poetry within structured templates (haiku, limerick, acrostic, free verse). TTS read-aloud with expressive prosody. Perfect for grades 1-6 poetry.',
    constraints: 'Best for grades 1-6. Analysis mode needs a poem; composition mode needs a template type.'
  },
  {
    id: 'genre-explorer',
    description: 'Students examine text excerpts and classify them by genre using feature checklists. Supports fiction, nonfiction, poetry, drama, folktale, myth, fable, biography, informational, persuasive. Side-by-side comparison of different genres on same topic. Perfect for grades 1-6 genre study.',
    constraints: 'Best for grades 1-6. Needs text excerpts from different genres.'
  },

  // ===== READING: INFORMATIONAL TEXT (RI) =====
  {
    id: 'text-structure-analyzer',
    description: 'Students identify organizational structure of informational passages: cause-effect, compare-contrast, problem-solution, chronological, or description. Highlight signal words, select structure type, drag content onto visual templates (Venn, T-chart, flowchart, timeline). ESSENTIAL for grades 2-6 informational reading.',
    constraints: 'Best for grades 2-6. Requires informational text with clear organizational structure.'
  },
  {
    id: 'evidence-finder',
    description: 'Students find and highlight specific text evidence supporting claims in informational passages. Supports multiple claims, evidence strength ranking, and Claim-Evidence-Reasoning (CER) framework. Multi-color highlighting. Perfect for grades 2-6 evidence-based reading.',
    constraints: 'Best for grades 2-6. Requires informational passage with identifiable evidence.',
    tutoring: {
      taskDescription: 'Find textual evidence for claims. Claim: {{currentClaim}}.',
      contextKeys: ['currentClaim'],
      scaffoldingLevels: {
        level1: 'What part of the text talks about this idea?',
        level2: 'Look for sentences with words like [keywords].',
        level3: 'The evidence is in paragraph X. Highlight the sentence that proves the claim.',
      },
      commonStruggles: [
        { pattern: 'Opinion vs evidence', response: 'Did the author say that, or is it your idea?' },
        { pattern: 'Weak evidence', response: 'Does this PROVE the claim or just mention it?' },
        { pattern: 'Wrong section', response: 'Direct to correct paragraph' },
      ],
    },
  },

  // ===== WRITING (W) =====
  {
    id: 'paragraph-architect',
    description: 'Scaffolded paragraph construction using hamburger model (topic sentence -> details -> conclusion). Supports informational, narrative, and opinion paragraph types. Sentence-starter frames, linking word guidance, TTS read-back. ESSENTIAL for grades 1-6 writing instruction.',
    constraints: 'Best for grades 1-6. Select paragraph type appropriate to grade level.'
  },
  {
    id: 'story-planner',
    description: 'Pre-writing planning tool for narrative writing. Students fill structured cards: characters, setting, conflict, key events, resolution, theme. Generates visual story arc from inputs. AI-generated character/setting illustrations. Connects to story-map for read-to-write cycle. Perfect for K-6 narrative writing.',
    constraints: 'Best for K-6. Focus complexity on grade level.'
  },
  {
    id: 'opinion-builder',
    description: 'Structured scaffold for opinion/argumentative writing. Uses OREO model (grades 2-4) transitioning to CER framework (grades 5-6). Students construct arguments piece by piece with validation. Counter-argument support at grades 5-6. TTS read-back. ESSENTIAL for persuasive writing grades 2-6.',
    constraints: 'Best for grades 2-4 (OREO), grades 5-6 (CER).'
  },
  {
    id: 'revision-workshop',
    description: 'Students apply specific revision strategies to draft passages: adding details, strengthening word choice, combining sentences, fixing run-ons, improving transitions, reorganizing. Before/after comparison with TTS read-aloud. Perfect for grades 2-6 revision skills.',
    constraints: 'Best for grades 2-6. Focus on one revision skill at a time.'
  },

  // ===== SPEAKING & LISTENING (SL) =====
  {
    id: 'listen-and-respond',
    description: 'Listening comprehension primitive where passage is delivered via TTS audio only (text hidden during listening). Students answer questions from literal recall to inference. Supports replay of specific segments. Text reveal after submission. Perfect for K-6 listening comprehension.',
    constraints: 'Best for K-6. Passage text is hidden during listening phase.'
  },
  {
    id: 'read-aloud-studio',
    description: 'Fluency practice with three modes: Model (TTS with karaoke-style word highlighting), Practice (student records via microphone), Compare (side-by-side playback). Tracks WPM. Student self-assessment only, no AI speech grading. Perfect for grades 1-6 fluency.',
    constraints: 'Best for grades 1-6. Requires microphone for practice mode. No AI grading of speech.'
  },

  // ===== LANGUAGE (L) =====
  {
    id: 'sentence-builder',
    description: 'Students construct grammatical sentences by arranging color-coded word/phrase tiles by grammatical role (subject=blue, predicate=red, object=green, modifier=yellow). Progressive complexity from simple S-V to compound-complex sentences. TTS read-back. ESSENTIAL for grades 1-6 grammar.',
    constraints: 'Best for grades 1-6. Sentence complexity should match grade level.'
  },
  {
    id: 'context-clues-detective',
    description: 'Students determine unfamiliar word meaning using context clues. Teaches clue types: definition, synonym/antonym, example, inference. Students highlight clues, identify type, provide meaning. Dictionary comparison reveal. Perfect for grades 2-6 vocabulary.',
    constraints: 'Best for grades 2-6. Requires passage with context clues near target word.'
  },
  {
    id: 'figurative-language-finder',
    description: 'Students identify and classify figurative language in passages: simile, metaphor, personification, hyperbole, idiom, alliteration, onomatopoeia, imagery. Color-coded highlighting by type. Literal translation mode. Connects to poetry-lab. Perfect for grades 3-6.',
    constraints: 'Best for grades 3-6. Requires passage rich in figurative language.'
  },
  {
    id: 'spelling-pattern-explorer',
    description: 'Students investigate word groups sharing spelling patterns, discover underlying rules, then apply via audio dictation practice. Supports word families, vowel patterns, suffix rules, Latin/Greek roots. TTS pronunciation and slow syllable mode. Perfect for grades 1-6 spelling.',
    constraints: 'Best for grades 1-6. Pattern complexity should match grade level.'
  },
];
