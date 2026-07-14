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
    description: 'Interactive sentence grammar analysis. Students identify parts of speech, grammatical roles, label all words, and parse sentence structure. 4 progressive challenge types from concrete identification to full structural parsing. Perfect for grades 2-8 grammar and language arts.',
    constraints: 'Requires language/grammar content. Best for grades 2-8.',
    evalModes: [
      {
        evalMode: 'identify_pos',
        label: 'Identify POS (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify_pos'],
        description: 'Identify the part of speech of a highlighted word from multiple choice options.',
      },
      {
        evalMode: 'identify_role',
        label: 'Identify Role (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['identify_role'],
        description: 'Identify the grammatical role of a highlighted word from multiple choice options.',
      },
      {
        evalMode: 'label_all',
        label: 'Label All (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['label_all'],
        description: 'Label every word in a sentence with its part of speech.',
      },
      {
        evalMode: 'parse_structure',
        label: 'Parse Structure (Tier 5)',
        beta: 6.5,
        scaffoldingMode: 5,
        challengeTypes: ['parse_structure'],
        description: 'Group words into subject/predicate and classify sentence type.',
      },
    ],
    tutoring: {
      taskDescription: 'Student is analyzing sentence grammar at the {{challengeType}} level. Current sentence: "{{sentence}}"',
      contextKeys: ['challengeType', 'sentence', 'words', 'targetWord', 'gradeLevel'],
      scaffoldingLevels: {
        level1: '"What job does this word do in the sentence? Think about whether it names something, describes something, or shows action."',
        level2: '"Let\'s break this down. Look at {{targetWord}} — does it answer WHO, WHAT, or WHAT ABOUT? That tells you its role."',
        level3: '"In the sentence, the {{partOfSpeech}} \'{{targetWord}}\' acts as the {{grammaticalRole}} because it {{roleExplanation}}."',
      },
      commonStruggles: [
        { pattern: 'Student confuses nouns and verbs when word can be both (e.g., "run", "play")', response: 'Ask: "In THIS sentence, is the word naming a thing or showing an action? Context decides."' },
        { pattern: 'Student labels adjectives as adverbs or vice versa', response: 'Ask: "Is this word describing a NOUN (adjective) or describing a VERB (adverb)?"' },
        { pattern: 'Student cannot distinguish subject from predicate', response: 'Ask: "Who or what is the sentence about? That is the subject. What does it DO or what IS it? That is the predicate."' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'word-builder',
    description: 'Interactive morphology lab where students construct complex words from roots, prefixes, and suffixes to understand their meaning. Drag-and-drop construction with visual breakdown showing how word parts combine. Perfect for vocabulary development, etymology, and morphological analysis in language arts.',
    constraints: 'Best for grades 3-8. Requires words that can be meaningfully broken into morphological components (prefixes, roots, suffixes).',
    evalModes: [
      {
        evalMode: 'simple_affix',
        label: 'Simple Affixes (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['simple_affix'],
        description: 'Single prefix or suffix with a common root (un+happy, play+ful).',
      },
      {
        evalMode: 'compound_affix',
        label: 'Compound Affixes (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['compound_affix'],
        description: 'Prefix + root + suffix combinations (un+help+ful, re+play+able).',
      },
      {
        evalMode: 'greek_latin',
        label: 'Greek/Latin Roots (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['greek_latin'],
        description: 'Academic words from Greek/Latin morphemes (bio+log+y, tele+scope).',
      },
      {
        evalMode: 'multi_morpheme',
        label: 'Multi-Morpheme (Tier 6)',
        beta: 7.0,
        scaffoldingMode: 6,
        challengeTypes: ['multi_morpheme'],
        description: 'Complex multi-morpheme words with abstract roots (pre+dict+able, anti+bio+tic).',
      },
    ],
    supportsEvaluation: true,
  },

  // ===== READING: FOUNDATIONAL SKILLS (RF) =====
    {
      id: 'phonics-blender',
      misconceptionScope: 'primitive',
    description: 'Sound-by-sound word building with phoneme tiles. Students tap to hear individual sounds, then blend into words. Supports CVC, CVCE, blends, digraphs, diphthongs, and r-controlled vowels. Audio playback via TTS. AI-generated word images on success. ESSENTIAL for K-2 phonics instruction.',
    constraints: 'Grades K-2 only. Requires phonics/decoding content.',
    evalModes: [
      {
        evalMode: 'cvc',
        label: 'CVC (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['cvc'],
        description: 'Simple CVC blending (cat, dog).',
      },
      {
        evalMode: 'cvce_blend',
        label: 'CVCE & Blends (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['cvce', 'blend'],
        description: 'Silent-e and consonant blends.',
      },
      {
        evalMode: 'digraph',
        label: 'Digraphs (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['digraph'],
        description: 'Two letters, one sound (sh, ch, th).',
      },
      {
        evalMode: 'advanced',
        label: 'Advanced (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['r-controlled', 'diphthong'],
        description: 'R-controlled vowels and diphthongs.',
      },
    ],
    supportsEvaluation: true,
    tutoring: {
      taskDescription:
        'You ARE the voice of this phonics blending activity. '
        + 'Your primary job is to pronounce sounds and words when the student taps tiles, '
        + 'and to provide scaffolded hints when asked. '
        + 'Pattern: {{patternType}}, Grade {{gradeLevel}}. '
        + 'Word {{completedWords}}/{{totalWords}}: "{{currentWord}}". '
        + 'Phase: {{currentPhase}}. Phonemes: {{targetPhonemes}}. '
        + 'Student has placed: {{placedPhonemes}}. Attempts on this word: {{attempts}}.',
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
      aiDirectives: [
        {
          title: 'ACTIVITY INTRODUCTION',
          instruction:
            'When you receive [ACTIVITY_START], warmly introduce the phonics blending activity. '
            + 'Mention that we are going to practice phonics — listening to sounds and blending them into words. '
            + 'Then introduce the first word and encourage the student to tap each sound tile to hear it. '
            + 'Keep it brief (2-3 sentences), warm, and enthusiastic. Use age-appropriate language for the grade level.',
        },
        {
          title: 'PHASE TRANSITIONS',
          instruction:
            'When you receive [PHASE_TO_BUILD], briefly instruct the student to arrange the sound tiles in order. '
            + 'Keep it to one sentence. Do not repeat the sounds — the student already heard them.',
        },
        {
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive a message starting with [PRONOUNCE], you MUST immediately and clearly say ONLY '
            + 'the requested sound or word. Do NOT add any commentary, questions, encouragement, or extra words. '
            + 'Just produce the sound or word exactly as requested. This is used for audio playback of phonemes and words.\n'
            + 'For phonemes, say the isolated sound (e.g., just "sss" for /s/, just "aaa" for /a/).\n'
            + 'For words, say the word naturally (e.g., "sun").\n'
            + 'Examples:\n'
            + '- "[PRONOUNCE] Say the sound /k/ clearly." → Just say the /k/ sound\n'
            + '- "[PRONOUNCE] Say the word cat clearly." → Just say "cat"',
        },
      ],
    },
  },
  {
    id: 'decodable-reader',
    description: 'Controlled-vocabulary reading passages with per-word TTS support. Every word is tappable for pronunciation. Tracks which words students tap (decoding difficulty proxy). Includes an embedded picture-based comprehension question. Two reading modes: READ-ALONG (the tutor reads the passage aloud while a pre-reader follows, then answers by picture) for Kindergarten, and DECODE (the student decodes the passage themselves) for Grade 1-2. ESSENTIAL for K-2 reading.',
    constraints: 'Grades K-2. Requires controlled phonics patterns matching student decoding level. BAND FLOOR: at Kindergarten use the read_along mode (pre-readers cannot yet decode connected text); the decoding comprehension modes (literal/sequence/inference/main_idea) are for Grade 1+.',
    evalModes: [
      { evalMode: 'read_along', label: 'Read-Along (Tier 0)', beta: 0.5, scaffoldingMode: 1, challengeTypes: ['literal'], description: 'Kindergarten shared reading: the tutor reads the passage aloud while the child follows along, then the child answers a picture-based question. For pre-readers who cannot yet decode connected text.' },
      { evalMode: 'literal', label: 'Literal Recall (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['literal'], description: 'Recall a fact stated directly in the passage.' },
      { evalMode: 'sequence', label: 'Sequence/Cause-Effect (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['sequence'], description: 'Connect two text-explicit parts: order of events or stated cause/effect.' },
      { evalMode: 'inference', label: 'Inference (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['inference'], description: 'Deduce something the text implies but does not state.' },
      { evalMode: 'main_idea', label: 'Main Idea (Tier 4)', beta: 4.0, scaffoldingMode: 4, challengeTypes: ['main_idea'], description: 'Synthesize the passage into its central message.' },
    ],
    supportsEvaluation: true,
    tutoring: {
      taskDescription:
        'You ARE the voice of this decodable reading activity. '
        + 'The student is reading a controlled-vocabulary passage titled "{{title}}" at Grade {{gradeLevel}}. '
        + 'Phonics patterns in this passage: {{phonicsPatternsInPassage}}. '
        + 'Phase: {{currentPhase}}. Words: {{totalWords}} total, {{wordsTapped}} tapped for help, '
        + '{{wordsReadIndependently}} read independently. '
        + 'Comprehension question: "{{comprehensionQuestion}}". '
        + 'Comprehension attempts: {{comprehensionAttempts}}.',
      contextKeys: [
        'title', 'gradeLevel', 'readingMode', 'currentPhase', 'totalWords',
        'wordsTapped', 'wordsReadIndependently',
        'phonicsPatternsInPassage', 'passageText', 'comprehensionQuestion',
        'comprehensionChoices',
        'comprehensionAttempts', 'comprehensionCorrect',
      ],
      scaffoldingLevels: {
        level1:
          'READING phase: "Can you read this by yourself? Tap any word you need help with!" '
          + 'COMPREHENSION phase: "Think about what you read. What does the question ask?" '
          + 'REVIEW phase: "Look at the words you tapped—those are your practice words!"',
        level2:
          'READING phase: "Try sounding out each word. If it\'s tricky, tap it to hear it." '
          + 'COMPREHENSION phase: "Go back to the passage and find the answer. Look for key words." '
          + 'REVIEW phase: "You read {{wordsReadIndependently}} words all by yourself! Let\'s look at the ones you tapped."',
        level3:
          'READING phase: "Let\'s read together. I\'ll help with any word—just tap it." '
          + 'COMPREHENSION phase: "The answer is in the passage. Look at the sentence that talks about [topic]. What does it say?" '
          + 'REVIEW phase: "Great job! You read {{wordsReadIndependently}} of {{totalWords}} words independently. The words you tapped are good ones to practice."',
      },
      commonStruggles: [
        { pattern: 'Tapping most words (wordsTapped > 50% of totalWords)', response: 'Encourage the student—"You\'re doing great asking for help! Let\'s try reading a few words without tapping."' },
        { pattern: 'Rushing through without tapping any words', response: '"Take your time! Tap any word you want to hear. It\'s okay to listen first."' },
        { pattern: 'Multiple wrong comprehension attempts', response: '"Let\'s go back and read the passage again. The answer is in there!"' },
        { pattern: 'Skipping comprehension to review', response: '"That\'s okay! Let\'s look at what you read and practice those words."' },
      ],
      aiDirectives: [
        {
          title: 'READER LEVEL — AUDIO IS THE INSTRUCTION CHANNEL',
          instruction:
            'This student is a beginning reader (Grade {{gradeLevel}}) and may NOT be able to read the '
            + 'on-screen text — including the comprehension question and its answer choices. Your VOICE is how '
            + 'they receive every instruction. Never tell them to "read the question" or "read the choices" '
            + 'silently; you must SAY those words for them. Keep every spoken turn to one or two short, warm '
            + 'sentences a five-year-old understands.',
        },
        {
          title: 'ORIENT — WELCOME THE CHILD (fires on [READING_START], decode mode)',
          instruction:
            'When you receive a message starting with [READING_START], the activity has just opened in DECODE '
            + 'mode (the child reads it themselves). Warmly greet the child and tell them what to do in ONE short '
            + 'sentence, e.g. "Here is a little story — try to read it, and tap any word you want me to say for you." '
            + 'This opening greeting IS your frame for the activity and overrides any "one sentence only / keep it '
            + 'brief" cap from a lesson switch. Then stay quiet and let them read; do not narrate every tap.',
        },
        {
          title: 'READ-ALONG — READ THE WHOLE STORY ALOUD (fires on [READ_ALONG_START], Kindergarten)',
          instruction:
            'When you receive a message starting with [READ_ALONG_START], this is a Kindergarten read-along: the '
            + 'child is a pre-reader who cannot decode yet, so YOU read the story TO them. Read the entire passage '
            + 'aloud, warmly and clearly, word for word (the exact text is given to you as {{passageText}}). This '
            + 'read-aloud IS your greeting and your whole first turn — it OVERRIDES any "one sentence only / keep '
            + 'it brief" cap from a lesson switch; never summarize or shorten the story. When you finish, invite '
            + 'the child to tap any word to hear it again.',
        },
        {
          title: 'READ THE QUESTION AND EVERY CHOICE ALOUD (fires on [READING_DONE])',
          instruction:
            'When you receive a message starting with [READING_DONE], the child has finished reading and is now '
            + 'at the comprehension question. You MUST, in order: (1) read the question aloud — {{comprehensionQuestion}} '
            + '(2) read EVERY answer choice aloud, each with its letter, exactly as given: {{comprehensionChoices}} '
            + '(3) ask the child which one they think it is. The child cannot read the choices, so skipping any of '
            + 'them strands them. Do NOT say or hint which choice is correct — just read them all fairly and ask.',
        },
        {
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive a message starting with [PRONOUNCE_SOUND], you MUST immediately and clearly say ONLY '
            + 'the requested word. Do NOT add any commentary, questions, encouragement, or extra words. '
            + 'Just say the word naturally and clearly. This is used for audio playback when students tap a word.\n'
            + 'Examples:\n'
            + '- "[PRONOUNCE_SOUND] The word is \\"cat\\". cat." → Just say "cat"\n'
            + '- "[PRONOUNCE_SOUND] The word is \\"the\\". the." → Just say "the"',
        },
      ],
    },
  },

  {
    id: 'rhyme-studio',
    misconceptionScope: 'primitive',
    description: 'Interactive rhyme awareness activity with three progressive modes: Recognition (do these words rhyme?), Identification (which word rhymes?), and Production (type a rhyming word). Covers the full rhyme awareness progression. Perfect for kindergarten phonological awareness. ESSENTIAL for K-2 literacy.',
    constraints: 'Requires 8-10 challenges mixing all three modes. Recognition challenges need doesRhyme boolean. Identification needs 2-3 options. Production needs acceptableAnswers array.',
    evalModes: [
      {
        evalMode: 'recognition',
        label: 'Recognition (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['recognition'],
        description: 'Do these words rhyme? Yes or no decision.',
      },
      {
        evalMode: 'identification',
        label: 'Identification (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['identification'],
        description: 'Pick the rhyming word from 2-3 options.',
      },
      {
        evalMode: 'production',
        label: 'Production (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['production'],
        description: 'Generate a word that rhymes with the target.',
      },
    ],
    tutoring: {
      taskDescription:
        'Rhyme awareness activity. Mode: {{challengeMode}}. '
        + 'Challenge {{currentChallenge}}/{{totalChallenges}}: '
        + 'Target word: "{{targetWord}}" (rhyme family: {{rhymeFamily}}). '
        + 'Phase: {{currentPhase}}. Attempts: {{attempts}}.',
      contextKeys: [
        'challengeMode', 'targetWord', 'rhymeFamily',
        'currentChallenge', 'totalChallenges', 'currentPhase', 'attempts',
      ],
      scaffoldingLevels: {
        level1:
          'RECOGNITION: "Listen to how the words end. Do they sound the same?" '
          + 'IDENTIFICATION: "Say each word slowly. Which one ends like {{targetWord}}?" '
          + 'PRODUCTION: "What sounds like {{targetWord}}? Think of the -{{rhymeFamily}} family."',
        level2:
          'RECOGNITION: "{{targetWord}} ends with {{rhymeFamily}}. Does the other word end the same way?" '
          + 'IDENTIFICATION: "{{targetWord}} ends in {{rhymeFamily}}. Which choice has that same ending?" '
          + 'PRODUCTION: "Words that rhyme with {{targetWord}} end in {{rhymeFamily}}. Can you think of one?"',
        level3:
          'RECOGNITION: "Listen: {{targetWord}}... hear the {{rhymeFamily}}? Now listen to the other word." '
          + 'IDENTIFICATION: "The answer rhymes with {{targetWord}} — it ends in {{rhymeFamily}}. Try saying each choice." '
          + 'PRODUCTION: "Here are some {{rhymeFamily}} words: [examples]. Can you think of another?"',
      },
      commonStruggles: [
        { pattern: 'Confusing rhyme with alliteration (same beginning)', response: 'Rhyming is about the ENDING sound. Cat and hat end the same: -at.' },
        { pattern: 'Cannot produce rhymes', response: 'Start with the rhyme family. If the word is "cat", the family is -at. Now put a new sound at the beginning: b-at, m-at, s-at.' },
        { pattern: 'Random guessing in identification', response: 'Say each word out loud slowly. Listen to the ending of each one.' },
      ],
      aiDirectives: [
        {
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive [PRONOUNCE_WORDS], clearly say the word(s) for this challenge. '
            + 'Say each word distinctly with a brief pause between them. '
            + 'Slightly emphasize the ending sounds to draw attention to the rhyme pattern. '
            + 'Do NOT add extra commentary — just say the words.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'syllable-clapper',
    description: 'Syllable clapping activity where students hear a word and tap/clap to count its syllables. Visual bar splits into color-coded syllable segments. AI tutor pronounces words and syllables. Supports 1-4 syllable words. Perfect for phonological awareness development. ESSENTIAL for kindergarten literacy.',
    constraints: 'Requires 1-4 syllable words appropriate for kindergarten. Each word needs correct syllable segmentation.',
    evalModes: [
      {
        evalMode: 'easy',
        label: 'Easy Words (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['easy'],
        description: 'High-frequency 1-2 syllable words with clear boundaries. AI over-emphasizes beats and paces slowly.',
      },
      {
        evalMode: 'medium',
        label: 'Medium Words (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['medium'],
        description: '2-3 syllable words, broader vocabulary including compound words. AI models once then lets student try.',
      },
      {
        evalMode: 'hard',
        label: 'Hard Words (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['hard'],
        description: '3-4 syllable words with some ambiguous boundaries. AI says word naturally, student parses independently.',
      },
    ],
    tutoring: {
      taskDescription:
        'Syllable clapping activity. Word {{currentChallenge}}/{{totalChallenges}}: '
        + '"{{currentWord}}" ({{syllableCount}} syllables: {{syllables}}). '
        + 'Student clapped: {{studentClaps}}. Attempts: {{attempts}}.',
      contextKeys: [
        'currentWord', 'syllableCount', 'syllables',
        'studentClaps', 'currentChallenge', 'totalChallenges', 'attempts',
      ],
      scaffoldingLevels: {
        level1: '"Let\'s clap the word! Say it with me and clap each part."',
        level2: '"Listen: {{currentWord}}. I\'ll say it slowly — clap when you hear a new part."',
        level3: '"{{currentWord}} has {{syllableCount}} parts: {{syllables}}. Clap with me: [clap each syllable]."',
      },
      commonStruggles: [
        { pattern: 'Clapping too many times (adding extra syllables)', response: 'Say the word slowly and naturally. Only clap when your mouth makes a new sound.' },
        { pattern: 'Clapping once for all multi-syllable words', response: 'Put your hand under your chin. Each time your chin drops, that\'s a new syllable.' },
        { pattern: 'Confusing syllables with phonemes', response: 'We\'re listening for big parts, not little sounds. "Cat" is one clap. "Kitten" is two claps.' },
      ],
      aiDirectives: [
        {
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive [PRONOUNCE_WORD], say the word naturally and clearly. Just the word. '
            + 'When you receive [PRONOUNCE_SYLLABLES], say the word with clear pauses between syllables '
            + '(e.g., "but...ter...fly"). Exaggerate the breaks slightly. '
            + 'When you receive [PRONOUNCE_SYLLABLE], say just the single syllable requested.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'phoneme-explorer',
    misconceptionScope: 'primitive',
    description:
      'Multi-mode phoneme awareness activity with four progressive modes: '
      + 'Isolate (match initial/final sound), Blend (combine phoneme tiles into word), '
      + 'Segment (break word into phonemes), Manipulate (add/delete/substitute phoneme). '
      + 'Emoji+word 4-choice format. Audio-first with AI tutor. ESSENTIAL for K-2 literacy.',
    constraints: 'Use concrete, picturable words with clear emoji matches. K: CVC words, initial sounds only.',
    evalModes: [
      {
        evalMode: 'isolate',
        label: 'Isolate (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['isolate'],
        description: 'Identify initial/final phoneme — hear a sound, pick the word that starts with it.',
      },
      {
        evalMode: 'blend',
        label: 'Blend (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['blend'],
        description: 'Combine phoneme tiles into a word — see /c/ /a/ /t/, pick "cat".',
      },
      {
        evalMode: 'segment',
        label: 'Segment (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['segment'],
        description: 'Break a word into its component phonemes — pick correct breakdown.',
      },
      {
        evalMode: 'manipulate',
        label: 'Manipulate (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['manipulate'],
        description: 'Add, delete, or substitute a phoneme to create a new word.',
      },
    ],
    tutoring: {
      taskDescription:
        'Phoneme awareness activity. Mode: {{mode}}. '
        + 'Challenge {{currentChallenge}}/{{totalChallenges}}. Attempts: {{attempts}}.',
      contextKeys: [
        'mode', 'currentChallenge', 'totalChallenges', 'attempts',
      ],
      scaffoldingLevels: {
        level1:
          '"Listen to the sound carefully. Say each word out loud and listen for the beginning sound."',
        level2:
          '"Let\'s break it down together. Say the sounds slowly, one at a time."',
        level3:
          '"I\'ll give you a hint — listen to the first sound again..."',
      },
      commonStruggles: [
        { pattern: 'Confusing letter names with sounds', response: 'We want the SOUND, not the letter name. "B" makes the sound "buh".' },
        { pattern: 'Looking at emojis instead of listening', response: 'Say each word out loud. Listen to the FIRST sound. Does it match?' },
        { pattern: 'Struggling with blending', response: 'Say the sounds slowly, then faster: "/k/... /a/... /t/... cat!"' },
        { pattern: 'Struggling with segmentation', response: 'Put up a finger for each sound you hear. How many fingers?' },
      ],
      aiDirectives: [
        {
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive [NEW_CHALLENGE], adapt to the mode. '
            + 'For isolate: say the phoneme sound clearly. '
            + 'For blend: say each sound slowly then blend. '
            + 'For segment: say the word clearly. '
            + 'For manipulate: say the original word and the operation.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'sound-swap',
    misconceptionScope: 'primitive',
    description:
      'Interactive phoneme manipulation activity where students add, delete, or substitute individual sounds in words to create new words. '
      + 'Three operation modes: Addition (add a phoneme to make a new word), Deletion (remove a phoneme to reveal a new word), '
      + 'and Substitution (swap one phoneme for another to transform a word). Uses visual sound tiles with animated transitions. '
      + 'Perfect for advanced phonological awareness practice. ESSENTIAL for K-2 reading readiness.',
    constraints: 'Use simple CVC/CVCC words. All result words must be real words. Use proper phoneme notation with slashes.',
    evalModes: [
      {
        evalMode: 'addition',
        label: 'Addition (Tier 1)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['addition'],
        description: 'Add a phoneme to make a new word.',
      },
      {
        evalMode: 'deletion',
        label: 'Deletion (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['deletion'],
        description: 'Remove a phoneme — what word remains?',
      },
      {
        evalMode: 'substitution',
        label: 'Substitution (Tier 3)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['substitution'],
        description: 'Swap a phoneme to change the word.',
      },
    ],
    tutoring: {
      taskDescription:
        'Phoneme manipulation activity. Operation: {{operation}}. '
        + 'Challenge {{currentChallenge}}/{{totalChallenges}}: '
        + '"{{originalWord}}" \u2192 {{operationDescription}} \u2192 "{{resultWord}}". '
        + 'Phase: {{currentPhase}}. Attempts: {{attempts}}.',
      contextKeys: [
        'operation', 'originalWord', 'resultWord', 'operationDescription',
        'currentChallenge', 'totalChallenges', 'currentPhase', 'attempts',
        'targetPhoneme', 'newPhoneme', 'position', 'originalPhonemes',
      ],
      scaffoldingLevels: {
        level1: '"Say {{originalWord}}. Now {{operationDescription}}. What word do you get?"',
        level2: '"Listen to {{originalWord}}: {{originalPhonemes}}. If we {{operationDescription}}, what changes?"',
        level3: '"{{originalWord}} is made of {{originalPhonemes}}. When we {{operationDescription}}, it becomes {{resultWord}}."',
      },
      commonStruggles: [
        { pattern: 'Cannot hold the original word in memory', response: 'Say the original word one more time. Now say it again, but this time...' },
        { pattern: 'Changes the wrong sound', response: 'Point to the sound we are changing. Which tile are we working with?' },
        { pattern: 'Produces a nonsense word', response: 'Let\'s try again. Say the sounds one at a time after the change.' },
      ],
      aiDirectives: [
        {
          title: 'CHALLENGE PRESENTATION',
          instruction:
            'When you receive [PRESENT_CHALLENGE], deliver the full manipulation instruction clearly. '
            + 'Say the original word, then the operation, then ask for the result. '
            + 'Example: "Say cat. Now change the /k/ to /b/. What word do you get?"',
        },
        {
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive [PRONOUNCE], say ONLY the requested word or sound. No extra commentary. '
            + 'Produce clean phonemes \u2014 /t/ not "tuh", /s/ not "suh".',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'letter-spotter',
    description:
      'Interactive letter recognition with three modes: Name It (sentence spotter — hear a sentence, spot the missing letter hidden by an emoji), '
      + 'Find It (locate letters in a grid), and Match It (pair uppercase with lowercase). '
      + 'Supports cumulative letter group progression (Groups 1-4). '
      + 'Perfect for kindergarten letter naming assessments. ESSENTIAL for K-2 literacy foundations.',
    constraints:
      'Requires letterGroup (1-4). Group 1: s,a,t,i,p,n. Group 2: adds c,k,e,h,r,m,d. '
      + 'Group 3: adds g,o,u,l,f,b. Group 4: adds j,z,w,v,y,x,q. b and d deliberately separated across groups.',
    tutoring: {
      taskDescription:
        'Letter recognition activity. Group {{letterGroup}} (letters: {{cumulativeLetters}}). '
        + 'Mode: {{challengeMode}}. Target letter: {{targetLetter}} ({{targetCase}}). '
        + 'Sentence: {{sentence}}. Target word: {{targetWord}}. '
        + 'Challenge {{currentChallenge}}/{{totalChallenges}}. Attempts: {{attempts}}.',
      contextKeys: [
        'letterGroup', 'cumulativeLetters', 'newLetters', 'challengeMode',
        'targetLetter', 'targetCase', 'targetWord', 'sentence',
        'currentChallenge', 'totalChallenges', 'attempts',
      ],
      scaffoldingLevels: {
        level1: '"Listen to the sentence again carefully. What sound does the word start with?"',
        level2: '"The word is {{targetWord}}. Say it slowly — what letter do you hear first?"',
        level3: '"This is the letter {{targetLetter}}. The word {{targetWord}} starts with {{targetLetter}}!"',
      },
      commonStruggles: [
        { pattern: 'Confusing b and d', response: 'Make a "bed" with your fists — left thumb up is b, right thumb up is d.' },
        { pattern: 'Confusing p and q', response: 'The letter p has its stick going DOWN. The letter q has its stick going DOWN too, but the circle is on the other side.' },
        { pattern: 'Confusing uppercase and lowercase forms', response: 'Big [letter] and little [letter] are the same letter, just different sizes. They make the same sound!' },
        { pattern: 'Cannot name new letters', response: 'This is a new letter! Let me introduce you: this is [name]. Can you say [name]?' },
      ],
      aiDirectives: [
        {
          title: 'SENTENCE SPOTTER (name-it mode)',
          instruction:
            'For [SENTENCE_SPOTTER] challenges, READ THE FULL SENTENCE ALOUD clearly and naturally. '
            + 'The student sees the sentence with an emoji hiding one letter. Your job is to speak the sentence '
            + 'so they can hear the missing letter in context. Emphasize the target word slightly. '
            + 'Ask "What letter is hiding behind the [emoji]?" after reading. '
            + 'On incorrect answers, re-read the sentence slowly and emphasize the target word.',
        },
        {
          title: 'LETTER NAMING',
          instruction:
            'When you receive [SAY_LETTER_NAME] or [FIND_LETTER], say the letter name clearly. '
            + 'Use the standard letter name (e.g., "A" as "ay", "S" as "ess"). '
            + 'For [FIND_LETTER], say "Find the letter [name]!" with enthusiasm. '
            + 'For [NEW_LETTER_INTRO], warmly introduce the letter with a brief description of its shape.',
        },
      ],
    },
    evalModes: [
      {
        evalMode: 'name_it',
        label: 'Name It (Sentence Spotter)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['name-it'],
        description: 'Hear a sentence spoken aloud, spot which letter an emoji is hiding in a key word.',
      },
      {
        evalMode: 'find_it',
        label: 'Find It (Visual Search)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['find-it'],
        description: 'Hear a letter name, find all instances in a 4x4 grid.',
      },
      {
        evalMode: 'match_it',
        label: 'Match It (Case Matching)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['match-it'],
        description: 'See an uppercase letter, match it to the correct lowercase form.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'letter-sound-link',
    misconceptionScope: 'primitive',
    description:
      'Audio-first letter-sound correspondence activity. Three modes: see a letter and hear two sounds via speaker bubbles (pick the right one), '
      + 'hear a sound auto-played and pick the correct letter, or match a letter to a keyword image. Binary discrimination (2 options) with '
      + 'phonologically confusable distractors (t/d, p/b, a/e, etc.) for genuine phonological awareness training. No phoneme text shown — '
      + 'students LISTEN, not read. Uses cumulative letter groups (1-4). AI tutor pronounces clean phonemes. '
      + 'ESSENTIAL for kindergarten and first-grade phonics instruction.',
    constraints:
      'Requires AI tutor voice connection for phoneme pronunciation. Supports 4 cumulative letter groups. '
      + 'Each challenge has exactly 2 options (binary discrimination) with confusable sound distractors.',
    tutoring: {
      taskDescription:
        'Letter-sound correspondence activity. Group {{letterGroup}}. '
        + 'Mode: {{challengeMode}}. Target: letter "{{targetLetter}}" → sound {{targetSound}}. '
        + 'Keyword: "{{keywordWord}}". Challenge {{currentChallenge}}/{{totalChallenges}}. Attempts: {{attempts}}.',
      contextKeys: [
        'letterGroup', 'challengeMode', 'targetLetter', 'targetSound',
        'keywordWord', 'currentChallenge', 'totalChallenges', 'attempts',
        'sharedSoundLetters',
      ],
      scaffoldingLevels: {
        level1: '"What sound does this letter make? Think of a word that starts with it."',
        level2: '"This letter makes the sound... think of {{keywordWord}}. What sound does {{keywordWord}} start with?"',
        level3: '"The letter {{targetLetter}} makes the sound {{targetSound}}, like in {{keywordWord}}. Say it with me: {{targetSound}}!"',
      },
      commonStruggles: [
        { pattern: 'Saying the letter name instead of the sound', response: 'That\'s the letter NAME. We want the SOUND it makes. The letter S is named "ess" but it SOUNDS like /s/.' },
        { pattern: 'Adding "uh" to consonant sounds', response: 'Make the sound really short and crisp. Just /t/, not "tuh". Clip it off quickly!' },
        { pattern: 'Confusing short vowel sounds (e vs i)', response: 'For /ĕ/, think of "egg". For /ĭ/, think of "itch". They\'re different mouth shapes.' },
        { pattern: 'Confused by c and k making the same sound', response: 'C and K are best friends — they make the same sound! /k/ like in "cat" and "kite".' },
      ],
      aiDirectives: [
        {
          title: 'CLEAN SOUND PRODUCTION',
          instruction:
            'CRITICAL: When you receive [PRONOUNCE_SOUND] or [TAP_OPTION], produce ONLY the clean phoneme. '
            + 'Consonants must NOT have an "uh" added: say /t/ not "tuh", /s/ not "suh", /p/ not "puh". '
            + 'Vowels should be the short sound: /ă/ as in apple, /ĕ/ as in egg, /ĭ/ as in itch, /ŏ/ as in octopus, /ŭ/ as in up. '
            + 'No letter names, no extra words. Just the sound.',
        },
        {
          title: 'KEYWORD ASSOCIATIONS',
          instruction:
            'When you receive [SAY_KEYWORD], say the sound followed by "as in [keyword]". '
            + 'Example: "/s/ as in sun". Keep it brief.',
        },
      ],
    },
    evalModes: [
      {
        evalMode: 'see_hear',
        label: 'See-Hear (Letter → Sound)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['see-hear'],
        description: 'See a letter displayed, pick its sound from options.',
      },
      {
        evalMode: 'hear_see',
        label: 'Hear-See (Sound → Letter)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['hear-see'],
        description: 'Hear a phoneme, identify which letter makes that sound.',
      },
      {
        evalMode: 'keyword_match',
        label: 'Keyword Match (Letter → Word)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['keyword-match'],
        description: 'Match a letter to its keyword association (e.g., s → sun).',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'picture-vocabulary',
    misconceptionScope: 'skill',
    description:
      'Spoken picture-vocabulary activity — the student SAYS their answers out loud and a speech judge confirms them (conversational voice mode; tap fallback always available). '
      + 'Six progressive modes: Listen & Find (hear a word, tap the matching picture), Say It (see a picture, name it aloud — "What is this?"), '
      + 'Goes Together (see a thing, say what naturally goes with it — sock→shoe), Opposites (see a word, say its opposite), '
      + 'Finish the Sentence (hear a sentence with a blank, say the missing word), Word Scale (see an ordered word gradient with a missing rung and say it — freezing→cold→__→warm→hot). '
      + 'Matches vocabulary words to pictures, builds oral vocabulary and word production. ESSENTIAL for K-1 vocabulary development and oral language.',
    constraints:
      'Use concrete, picturable words with clear emoji matches. K: everyday nouns (animals, foods, clothes, home). '
      + 'The manifest must NOT supply specific words — the generator builds the word pool and challenges deterministically from the eval mode.',
    evalModes: [
      {
        evalMode: 'receptive_match',
        label: 'Listen & Find (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['receptive_match'],
        description: 'Receptive vocabulary — hear a word spoken, tap the matching picture from 4.',
      },
      {
        evalMode: 'naming',
        label: 'Say It (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['naming'],
        description: 'Expressive naming — see a picture, say the word aloud (speech-judged; tap fallback).',
      },
      {
        evalMode: 'association',
        label: 'Goes Together (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['association'],
        description: 'Word associations — see a thing, say what naturally goes with it (sock→shoe; speech-judged, tap fallback).',
      },
      {
        evalMode: 'opposite',
        label: 'Opposites (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['opposite'],
        description: 'Word relationships — see a word+picture, produce its opposite aloud.',
      },
      {
        evalMode: 'sentence_frame',
        label: 'Finish the Sentence (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['sentence_frame'],
        description: 'Vocabulary in context — hear a sentence with a missing word, say the word that completes it.',
      },
      {
        evalMode: 'gradable_scale',
        label: 'Word Scale (Tier 5)',
        beta: 6.0,
        scaffoldingMode: 5,
        challengeTypes: ['gradable_scale'],
        description: 'Gradable vocabulary — order a low→high gradient and say the missing rung (freezing→cold→__→warm→hot).',
      },
    ],
    tutoring: {
      taskDescription:
        'Multi-challenge spoken vocabulary session — student answers by SPEAKING (or tapping as fallback). '
        + 'Currently on {{challengeType}} challenge {{currentChallengeIndex}} of {{totalChallenges}}. Voice mode: {{voiceMode}}.',
      contextKeys: [
        'challengeType',
        'currentChallengeIndex',
        'totalChallenges',
        'attempts',
        'voiceMode',
      ],
      scaffoldingLevels: {
        level1: '"Look closely at the picture. What do you see? Take your time and say it out loud!"',
        level2: '"Think about where you see this at home or outside. What do you call it? Say the word!"',
        level3: '"Listen to the first sound of the word — I\'ll give you a clue about what it does or where it lives. Now you say the whole word!"',
      },
      commonStruggles: [
        { pattern: 'Says a related word instead of the target (e.g. "puppy" for "dog")', response: 'Warmly accept the meaning, then ask for the specific word: "Yes, it IS a puppy — and a puppy is a baby...?"' },
        { pattern: 'Silent / will not speak', response: 'Never pressure. Point them to the tap choices: "You can tap it too! Which one is it?"' },
        { pattern: 'Speaks too quietly for the mic', response: 'Make it a game: "The microphone is a little sleepy — say it BIG and proud!"' },
      ],
      aiDirectives: [
        {
          title: 'PROMPT LAW — NEVER SAY THE ANSWER',
          instruction:
            'In Say It, Goes Together, Opposites, Finish the Sentence, and Word Scale modes the microphone auto-opens the moment you stop talking. '
            + 'You must NEVER speak the answer word (or any rhyme/first-sound of it) in your question, hints, or encouragement until the student has succeeded or the answer is revealed. '
            + 'If your voice contained the answer, the judge could hear YOU instead of the student. Ask short questions, then be silent and wait. '
            + 'Exception: Listen & Find mode — there you MUST say the target word clearly, because the student answers by tapping.',
        },
        {
          title: 'QUIET BY DEFAULT — LESS IS MORE',
          instruction:
            'This is a spoken {{totalChallenges}}-picture session and your voice should be RARE, not constant. '
            + 'Set the game up in ONE warm sentence at the very start, then STEP BACK. Do NOT re-ask "what is this?" every round — '
            + 'the picture on screen and the live microphone already prompt the child. Most correct answers need NO words from you: '
            + 'a happy sound and the next picture are enough. The silence between pictures is intentional — it gives the child room to talk. '
            + 'Speak up ONLY when it earns it: the child\'s first spoken answer, a gentle clue after a real miss, or the final celebration. '
            + 'When you do speak, ONE short sentence, then stop.',
        },
        {
          title: 'SPOKEN OUTCOME HANDLING',
          instruction:
            'You are only pinged to react at moments that matter — routine successes will NOT ping you, and that silence is by design; do not fill it. '
            + 'On [SPOKEN_MATCH]: ONE joyful sentence (you may say the word now), then STOP. '
            + 'On [SPOKEN_MISS]/[SPOKEN_UNCLEAR]/[SPOKEN_NO_SPEECH]: ONE warm, no-pressure sentence with at most a tiny concrete clue (category, use, location) — never scold, never say the answer word. The mic re-opens after you finish.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'cvc-speller',
    misconceptionScope: 'primitive',
    description:
      'Audio-first CVC word encoding with three progressive task modes. Fill-the-Vowel: hear a word, see consonant frame (c_t), '
      + 'pick the correct vowel from 2 confusable options. Spell-It: hear a word, place all 3 letters in Elkonin boxes. '
      + 'Word-Sort: hear words, categorize into 2 vowel-sound buckets. AI tutor provides progressive phoneme scaffolding '
      + '(natural word \u2192 stretched vowel \u2192 isolated vowel sound). ESSENTIAL for K-1 phonics encoding.',
    constraints:
      'Only CVC (3-letter) words. One vowel focus per activity. Requires AI tutor voice for pronunciation. '
      + 'Fill-vowel has 2 confusable vowel options. Word-sort has 2 vowel-sound buckets.',
    evalModes: [
      {
        evalMode: 'fill_vowel',
        label: 'Fill the Vowel (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['fill-vowel'],
        description: 'Hear word, pick missing vowel from 2 confusable options in a C_C frame.',
      },
      {
        evalMode: 'spell_word',
        label: 'Spell It (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['spell-word'],
        description: 'Hear word, spell all 3 letters in Elkonin boxes from a letter bank.',
      },
      {
        evalMode: 'word_sort',
        label: 'Word Sort (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['word-sort'],
        description: 'Hear words, sort into 2 vowel-sound buckets (e.g., short-a vs short-e).',
      },
    ],
    tutoring: {
      taskDescription:
        'CVC encoding activity. Task: {{taskType}}. Vowel focus: {{vowelFocus}}. '
        + 'Word {{currentChallenge}}/{{totalChallenges}}: "{{targetWord}}" ({{targetPhonemes}}). '
        + 'Attempts: {{attempts}}.',
      contextKeys: [
        'vowelFocus', 'letterGroup', 'taskType', 'targetWord', 'targetPhonemes', 'targetLetters',
        'placedLetters', 'currentChallenge', 'totalChallenges', 'attempts',
        'firstPhoneme', 'middlePhoneme',
      ],
      scaffoldingLevels: {
        level1: '"Say the word again naturally. Ask: what sounds do you hear?"',
        level2: '"Stretch the word with emphasis on the vowel. Use the keyword for {{middlePhoneme}}: apple (a), egg (e), itch (i), octopus (o), up (u)."',
        level3: '"Isolate just the vowel sound. Say it alone, then connect to the letter. {{targetWord}} has {{middlePhoneme}} in the middle."',
      },
      commonStruggles: [
        { pattern: 'Vowel confusion (e.g., picking "e" instead of "a")', response: 'Contrast the two sounds: "Is it /\u0103/ like apple or /\u0115/ like egg?" Stretch the word to emphasize the middle.' },
        { pattern: 'Reversing letter order in spell-word mode', response: 'What\'s the FIRST sound? That goes in the first box. Segment the word: first... middle... last.' },
        { pattern: 'Cannot identify the medial vowel', response: 'Stretch the word for them yourself, aloud — say each sound slowly and HOLD the middle sound ("/mmm/... /aaaa/... /t/"). It\'s the loud sound in the middle. Never tell them to read anything or find a button.' },
        { pattern: 'Sorting a word into the wrong bucket', response: 'Say both bucket vowel sounds, then the word. "Is cat more like apple... or egg?" Stretch the vowel to hear it.' },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER ORIENT + SAY-THE-WORD BEAT (K contract)',
          instruction:
            'The student is a pre-reader: on-screen text is invisible to them — your voice carries everything. '
            + 'Your FIRST utterance for this activity, and for EVERY new word, must SAY the target word "{{targetWord}}" aloud, clearly, twice. '
            + 'In lesson mode this beat IS your greeting/switch line and OVERRIDES any one-sentence or keep-it-brief cap. '
            + 'Right after saying the word, state the task in child terms, one short line by task type — '
            + 'spell-word: "Tap the letter for each sound you hear, then tap the green check." '
            + 'fill-vowel: "Which sound do you hear in the MIDDLE?" '
            + 'word-sort: say BOTH bucket sounds with their keywords ("/ă/ like apple... /ĕ/ like egg") and ask which one the word has. '
            + 'Say the WORD only — never spell it letter-by-letter and never name the vowel letter unprompted.',
        },
        {
          title: 'PROGRESSIVE PHONEME SCAFFOLDING',
          instruction:
            'This is the core pedagogical strategy. When the student struggles, progress through these levels: '
            + 'LEVEL 1 ([SAY_WORD], [REPEAT_WORD]): Say the word naturally \u2014 clear, twice. '
            + 'LEVEL 2 ([STRETCH_WORD], [STRETCH_VOWEL]): Stretch the word with emphasis on the vowel. '
            + 'Say each phoneme with a pause: "/k/... /aaaa/... /t/". Hold the vowel longer. '
            + 'LEVEL 3 ([ISOLATE_VOWEL]): Say JUST the vowel sound alone: "/\u0103/... /\u0103/. That\'s the letter A, like apple." '
            + 'Never jump to level 3 \u2014 always scaffold progressively.',
        },
        {
          title: 'SOUND CONFIRMATION',
          instruction:
            'When you receive [CONFIRM_SOUND], say just the clean phoneme for that letter \u2014 no words, no commentary. '
            + 'Consonants: crisp, no "uh" added (/t/ not "tuh"). Vowels: short sound only.',
        },
        {
          title: 'VOWEL CONTRAST',
          instruction:
            'When you receive [VOWEL_CONFUSION], [FILL_VOWEL_WRONG], [SORT_WRONG_L1]: contrast the two vowel sounds. '
            + 'Use keyword associations: /\u0103/ = apple, /\u0115/ = egg, /\u012D/ = itch, /\u014F/ = octopus, /\u016D/ = up. '
            + 'Say both sounds clearly so the student can hear the difference. Then say the word again.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'word-workout',
    description:
      'CVC word application activity with four modes: Real vs. Nonsense (discriminate real from made-up words), '
      + 'Picture Match (connect decoded words to meaning), Word Chains (build automaticity with one-letter-change sequences), '
      + 'and Sentence Reading (apply decoding in connected text). Capstone assessment for CVC mastery. ESSENTIAL for K-2 literacy.',
    constraints:
      'Requires mode selection. Real/Nonsense needs phonetically plausible nonsense words. '
      + 'Word Chains must follow one-letter-change rule. Sentences use only mastered CVC words + approved sight words.',
    evalModes: [
      {
        evalMode: 'real_vs_nonsense',
        label: 'Real vs Nonsense (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['real-vs-nonsense'],
        description: 'Is this a real word? Recognition-level decoding.',
      },
      {
        evalMode: 'picture_match',
        label: 'Picture Match (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['picture-match'],
        description: 'Match decoded word to picture — word-meaning connection.',
      },
      {
        evalMode: 'word_chains',
        label: 'Word Chains (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['word-chains'],
        description: 'Read chain of words with one-letter changes.',
      },
      {
        evalMode: 'sentence_reading',
        label: 'Sentence Reading (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['sentence-reading'],
        description: 'Read word in decodable sentence context.',
      },
    ],
    tutoring: {
      taskDescription:
        'CVC word application activity. Mode: {{mode}}. '
        + 'Challenge {{currentChallenge}}/{{totalChallenges}}. '
        + 'Mastered vowels: {{masteredVowels}}. Phase: {{currentPhase}}. Attempts: {{attempts}}.',
      contextKeys: [
        'mode', 'currentChallenge', 'totalChallenges', 'masteredVowels',
        'currentPhase', 'attempts',
      ],
      scaffoldingLevels: {
        level1:
          'REAL/NONSENSE: "Sound out both words. Which one is a word you know?" '
          + 'PICTURE MATCH: "Read the word, then look at each picture." '
          + 'WORD CHAINS: "Read each word. What letter changed?" '
          + 'SENTENCES: "Try reading the sentence. Tap any word you need help with."',
        level2:
          'REAL/NONSENSE: "One of these makes sense and one is a silly made-up word. Sound them out." '
          + 'PICTURE MATCH: "What sounds do you hear in the word? Which picture matches those sounds?" '
          + 'WORD CHAINS: "The word changed from [old] to [new]. What\'s different?" '
          + 'SENTENCES: "Start with the first word. Sound it out. Then the next one."',
        level3:
          'REAL/NONSENSE: "The real word is one you\'ve seen before or that means something. The nonsense word is just sounds." '
          + 'PICTURE MATCH: "The word says [word]. Can you find the picture of a [word]?" '
          + 'WORD CHAINS: "In [old word], we changed the [position] letter from [old] to [new] to make [new word]." '
          + 'SENTENCES: "Let me read it first, then you try."',
      },
      commonStruggles: [
        { pattern: 'Cannot distinguish real from nonsense', response: 'Sound out each word slowly. Does it mean something? Is it a thing you know?' },
        { pattern: 'Picking picture by phonetic similarity, not meaning', response: 'Read the word one more time. What does it mean? Now find that picture.' },
        { pattern: 'Getting stuck in word chains', response: 'Just one letter changed! Look at the word above \u2014 what\'s different?' },
        { pattern: 'Cannot read sentences fluently', response: 'Read one word at a time. Don\'t rush. Tap any word you need help with.' },
      ],
      aiDirectives: [
        {
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive [PRONOUNCE], say ONLY the requested word. No extra commentary. '
            + 'When you receive [READ_SENTENCE], read the sentence fluently and naturally. No extra commentary. '
            + 'When you receive [CHAIN_WORD], say the word and optionally add a brief note about what changed '
            + '(e.g., "mat \u2014 we changed the first letter!").',
        },
      ],
    },
    supportsEvaluation: true,
  },

  // ===== READING: LITERATURE (RL) =====
  {
    id: 'story-map',
    description: 'Interactive plot structure diagram where students identify and place story elements on a visual arc. Supports beginning-middle-end (K-1), story mountain (2-3), full plot diagram (4-5), and hero\'s journey (5-6). Students drag event cards to arc positions. ESSENTIAL for reading comprehension K-6.',
    constraints: 'Requires narrative text. Structure type should match grade level.',
    evalModes: [
      { evalMode: 'bme', label: 'BME (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['bme'], description: 'Beginning-Middle-End (K-1).' },
      { evalMode: 'story_mountain', label: 'Story Mountain (Tier 2)', beta: 3.0, scaffoldingMode: 2, challengeTypes: ['story-mountain'], description: '5-part narrative arc (2-3).' },
      { evalMode: 'plot_diagram', label: 'Plot Diagram (Tier 4)', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['plot-diagram'], description: 'Freytag\'s pyramid (4-6).' },
      { evalMode: 'heros_journey', label: 'Hero\'s Journey (Tier 5)', beta: 6.5, scaffoldingMode: 5, challengeTypes: ['heros-journey'], description: 'Complex narrative structure (5-6).' },
    ],
    supportsEvaluation: true,
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
    id: 'story-talk',
    description:
      'Listening-comprehension activity for Kindergarten — the tutor READS a short 3-5 sentence story ALOUD with character voices, then the student answers a literal-recall question ("Who hid the acorn?", "What did Milo find?", "Where did it happen?") by tapping the matching picture from 4 options. Builds oral listening comprehension, recall of key story details, and who/what/where questioning. ESSENTIAL for K Reading Comprehension and Speaking & Listening (recall key details from a read-aloud). Answers are single picturable words shown as pictures, so it works for pre-readers.',
    constraints:
      'Story stays audio-only while the student answers (a listening task) — do not rely on the child reading. Answers must be single concrete, picturable words with a clear emoji. K comprehension: 3-5 short sentences, one scene, one problem. The manifest must NOT supply story text, questions, or answers — the generator authors the mini-stories and questions deterministically from the topic.',
    evalModes: [
      { evalMode: 'who_what_where', label: 'Listen & Tell (Tier 1)', beta: 2.0, scaffoldingMode: 2, challengeTypes: ['who_what_where'], description: 'Literal recall — answer a who/what/where question about a detail the story stated aloud.' },
      { evalMode: 'feeling_check', label: 'How Did They Feel? (Tier 2)', beta: 3.0, scaffoldingMode: 3, challengeTypes: ['feeling_check'], description: 'Emotion inference — infer how a character felt from what happened (the feeling is not stated).' },
      { evalMode: 'why_because', label: 'Why Did It Happen? (Tier 3)', beta: 4.0, scaffoldingMode: 3, challengeTypes: ['why_because'], description: 'Causal inference — tap the picture of WHY something happened in the story.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'word-flip',
    description:
      'Spoken grammar transformation game for Kindergarten and Grade 1 Language Arts: a counted-picture frame shows one object then several ("One dog 🐕 → three ___?") and the child SAYS the plural form aloud ("dogs") into an open mic, with tap chips as the fallback. Teaches regular -s plural formation (singular/plural nouns, "more than one"). Perfect for K grammar basics, plurals, and oral language production. ESSENTIAL for Kindergarten Language Arts grammar.',
    constraints:
      'Covers ONLY regular -s plurals at birth (no -es, no irregular plurals — those modes come later). Nouns must be concrete, picturable words with a clear emoji so pre-readers can play. The manifest must NOT supply specific per-challenge words — the generator authors the noun pool and code assembles the plural_s challenges deterministically.',
    supportsEvaluation: true,
  },
  {
    id: 'character-web',
    description: 'Interactive node-and-edge graph for character analysis and relationship mapping. Students build character profiles with traits and text evidence citations, then map relationships between characters. Tracks character change over time. Perfect for literary analysis grades 2-6.',
    constraints: 'Requires narrative text with 2+ characters. Best for grades 2-6.',
    evalModes: [
      { evalMode: 'trait_id', label: 'Identify Traits (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['trait_id'], description: 'Name single-word traits a character shows through what they do and say.' },
      { evalMode: 'trait_evidence', label: 'Trait Evidence (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['trait_evidence'], description: 'Support each trait claim with a specific quote or paraphrase from the text.' },
      { evalMode: 'relationship_map', label: 'Relationship Map (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['relationship_map'], description: 'Analyze how character relationships drive the plot.' },
      { evalMode: 'character_change', label: 'Character Change (Tier 5)', beta: 4.5, scaffoldingMode: 5, challengeTypes: ['character_change'], description: 'Analyze a dynamic character\'s development and the cause behind it.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'poetry-lab',
    description: 'Dual-mode poetry primitive. Analysis mode: examine poems with interactive annotations for rhyme scheme, mood, and figurative language. Composition mode: write poetry within structured templates (haiku, limerick, acrostic, free verse). Silent-read text activity — no read-aloud. Perfect for grades 2-6 poetry.',
    constraints: 'Analysis mode: grades 2-6 (silent reading of a poem plus mood vocabulary and rhyme-scheme notation). Composition mode: grades 3-6 (typed free-text writing). NOT suitable for K-1 / pre-readers: there is no audio path and no hear-and-identify-rhymes task.',
    evalModes: [
      { evalMode: 'analysis', label: 'Analysis (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['analysis'], description: 'Identify poetic elements in given poem.' },
      { evalMode: 'composition', label: 'Composition (Tier 5)', beta: 6.0, scaffoldingMode: 5, challengeTypes: ['composition'], description: 'Compose poem using template structure.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'genre-explorer',
    description: 'Students examine text excerpts and classify them by genre using feature checklists. Supports fiction, nonfiction, poetry, drama, folktale, myth, fable, biography, informational, persuasive. Side-by-side comparison of different genres on same topic. Perfect for grades 1-6 genre study.',
    constraints: 'Best for grades 1-6. Needs text excerpts from different genres.',
    evalModes: [
      { evalMode: 'identify_basic', label: 'Fiction vs Nonfiction (Tier 1)', beta: 2.0, scaffoldingMode: 1, challengeTypes: ['identify_basic'], description: 'Binary fiction vs nonfiction recognition on one excerpt.' },
      { evalMode: 'classify_genre', label: 'Classify Genre (Tier 3)', beta: 3.0, scaffoldingMode: 3, challengeTypes: ['classify_genre'], description: 'Multi-way classification among specific literary/informational genres.' },
      { evalMode: 'compare_genres', label: 'Compare Genres (Tier 4)', beta: 4.5, scaffoldingMode: 4, challengeTypes: ['compare_genres'], description: 'Contrast two genres on the same topic side by side.' },
    ],
    supportsEvaluation: true,
  },

  // ===== READING: INFORMATIONAL TEXT (RI) =====
  {
    id: 'text-structure-analyzer',
    description: 'Students identify organizational structure of informational passages: cause-effect, compare-contrast, problem-solution, chronological, or description. Highlight signal words, select structure type, drag content onto visual templates (Venn, T-chart, flowchart, timeline). ESSENTIAL for grades 2-6 informational reading.',
    constraints: 'Best for grades 2-6. Requires informational text with clear organizational structure.',
    evalModes: [
      { evalMode: 'chronological_description', label: 'Chronological/Description (Tier 1)', beta: 2.0, scaffoldingMode: 1, challengeTypes: ['chronological', 'description'], description: 'Identify sequence or descriptive structure.' },
      { evalMode: 'cause_effect', label: 'Cause-Effect (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['cause-effect'], description: 'Identify cause and effect relationships.' },
      { evalMode: 'compare_contrast', label: 'Compare-Contrast (Tier 3)', beta: 3.0, scaffoldingMode: 3, challengeTypes: ['compare-contrast'], description: 'Analyze similarities and differences.' },
      { evalMode: 'problem_solution', label: 'Problem-Solution (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['problem-solution'], description: 'Identify problem and proposed solutions.' },
    ],
    supportsEvaluation: true,
    tutoring: {
      taskDescription:
        'You are the reading-strategy coach for this text-structure analysis activity. '
        + 'The student is analyzing the passage "{{title}}" at Grade {{gradeLevel}} across four phases: '
        + 'find signal words, identify the organizational structure, map key ideas onto a template, then review. '
        + 'Current phase: {{currentPhase}}. '
        + 'Signal words found: {{signalWordsFound}} of {{signalWordsTotal}}. '
        + 'Key ideas placed: {{keyIdeasPlaced}} of {{keyIdeasTotal}}. Attempts: {{attempts}}. '
        + 'The passage is actually organized as {{structureType}} — this is the ANSWER the student must discover. '
        + 'NEVER state the structure type outright; instead steer them to the signal words and template clues so they reason it out.',
      contextKeys: [
        'title', 'gradeLevel', 'currentPhase', 'structureType',
        'signalWordsFound', 'signalWordsTotal',
        'keyIdeasPlaced', 'keyIdeasTotal', 'attempts',
      ],
      scaffoldingLevels: {
        level1:
          'SIGNAL-WORDS phase: "What transition words do you see — words like because, first, however, or unlike?" '
          + 'IDENTIFY phase: "What do the signal words you found tell you about how the ideas connect?" '
          + 'MAP phase: "Where does this idea belong in the template?" '
          + 'REVIEW phase: "Does your structure choice match the signal words you highlighted?"',
        level2:
          'SIGNAL-WORDS phase: "Re-read slowly and tap every word that links one idea to another." '
          + 'IDENTIFY phase: "Group the signal words you found — do they show time order, a comparison, a cause, or a problem being solved?" '
          + 'MAP phase: "Read each region label, then ask which key idea answers it." '
          + 'REVIEW phase: "Check each region: does every idea sit in the part that matches it?"',
        level3:
          'SIGNAL-WORDS phase: "Look for one signal word per sentence that joins ideas, and highlight it." '
          + 'IDENTIFY phase: "Match your signal-word family to a structure: order words = sequence, likeness/difference words = compare, because/so = cause, problem/solution words = problem-solution. Then choose." '
          + 'MAP phase: "Take one key idea at a time and place it in the region whose label it best answers." '
          + 'REVIEW phase: "Walk region by region and confirm each placement before submitting — adjust any that feel off."',
      },
      commonStruggles: [
        { pattern: 'Highlights content words instead of transition/signal words', response: 'Point out that signal words connect ideas (like, because, first) rather than name things.' },
        { pattern: 'Picks a structure that ignores the signal words found', response: 'Ask which signal words they highlighted and what those words usually show.' },
        { pattern: 'Places key ideas in the wrong template region', response: 'Have them read the region label aloud and ask which idea answers it.' },
        { pattern: 'Many attempts without progress (attempts > 1)', response: 'Slow down to one phase at a time — start by re-reading the signal words for a clue.' },
        { pattern: 'Confuses compare-contrast with cause-effect', response: 'Ask: are two things being measured against each other, or is one thing making another happen?' },
      ],
      aiDirectives: [
        {
          title: 'ACTIVITY INTRODUCTION',
          instruction:
            'When you receive [ACTIVITY_START], warmly introduce the text-structure activity for the passage "{{title}}". '
            + 'Tell the student to begin by tapping the signal words that show how the passage is organized. '
            + 'Do NOT name or hint at the correct structure type — discovering it is the goal. Keep it to 2-3 sentences.',
        },
        {
          title: 'PHASE TRANSITIONS',
          instruction:
            'When you receive [PHASE_TO_IDENTIFY], [PHASE_TO_MAP], or [PHASE_TO_REVIEW], briefly orient the student to the new phase in one sentence. '
            + 'Never name the correct structure and never place ideas for them.',
        },
        {
          title: 'COMPLETION FEEDBACK',
          instruction:
            'When you receive [ANALYSIS_CORRECT], celebrate briefly and name one strength. '
            + 'When you receive [ANALYSIS_INSIGHT], encourage the student, then reflect on which signal words point to the real structure so they learn from the miss — coach the reasoning, do not just announce the answer.',
        },
      ],
    },
  },
  {
    id: 'evidence-finder',
    description: 'Students find and highlight specific text evidence supporting claims in informational passages. Supports multiple claims, evidence strength ranking, and Claim-Evidence-Reasoning (CER) framework. Multi-color highlighting. Perfect for grades 2-6 evidence-based reading.',
    constraints: 'Best for grades 2-6. Requires informational passage with identifiable evidence.',
    evalModes: [
      { evalMode: 'locate_evidence', label: 'Locate Evidence (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['locate_evidence'], description: 'Find explicit, directly-stated evidence for one claim.' },
      { evalMode: 'match_evidence_to_claim', label: 'Match Evidence to Claim (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['match_evidence_to_claim'], description: 'Assign each evidence sentence to the correct of two claims.' },
      { evalMode: 'evaluate_evidence_strength', label: 'Evaluate Evidence Strength (Tier 4)', beta: 4.5, scaffoldingMode: 4, challengeTypes: ['evaluate_evidence_strength'], description: 'Rate evidence strength and justify it (CER framework).' },
    ],
    supportsEvaluation: true,
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
    constraints: 'Best for grades 1-6. Select paragraph type appropriate to grade level.',
    evalModes: [
      { evalMode: 'informational', label: 'Informational (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['informational'], description: 'Structured informational paragraph.' },
      { evalMode: 'narrative', label: 'Narrative (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['narrative'], description: 'Narrative paragraph with elements.' },
      { evalMode: 'opinion', label: 'Opinion (Tier 4)', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['opinion'], description: 'Opinion with claim + support.' },
    ],
    supportsEvaluation: true,
    tutoring: {
      taskDescription:
        'You are the writing coach for this paragraph-building activity. '
        + 'The student is writing a {{paragraphType}} paragraph about "{{topic}}" at Grade {{gradeLevel}}. '
        + 'They are using the hamburger model: topic sentence (top bun), detail sentences (filling), '
        + 'concluding sentence (bottom bun). '
        + 'Current phase: {{currentPhase}}. '
        + 'Explore completed: {{exploreCompleted}}. Practice submitted: {{practiceSubmitted}}. '
        + 'Detail sentences written: {{detailCount}}. Linking words used: {{linkingWordsUsed}}.',
      contextKeys: [
        'paragraphType', 'topic', 'gradeLevel', 'currentPhase',
        'exploreCompleted', 'practiceSubmitted',
        'detailCount', 'linkingWordsUsed',
      ],
      scaffoldingLevels: {
        level1:
          '"What is the most important thing you want to tell the reader about {{topic}}?" '
          + '"Which sentence tells us what the whole paragraph is about?" '
          + '"Can you add one more detail to support your main idea?"',
        level2:
          '"A {{paragraphType}} paragraph starts with a topic sentence that tells the main idea. '
          + 'What is the main idea about {{topic}}?" '
          + '"Good detail sentences give examples, facts, or reasons. '
          + 'Try using a linking word like \'because\' or \'for example\' to connect your ideas." '
          + '"Your concluding sentence should wrap up your paragraph—try restating the main idea in a new way."',
        level3:
          '"Let\'s build this step by step. First, your topic sentence: '
          + 'pick a sentence starter and fill in what you want to say about {{topic}}." '
          + '"Now add details. Each detail should support your topic sentence. '
          + 'Use the sentence frames to help you start each one." '
          + '"Finally, wrap it up: restate your main idea or tell the reader '
          + 'why {{topic}} matters."',
      },
      commonStruggles: [
        {
          pattern: 'Student writes detail sentences that do not relate to the topic sentence',
          response: 'Read your topic sentence again. Does this detail tell us more about that main idea? If not, try a detail that connects back to your topic.',
        },
        {
          pattern: 'Student skips the concluding sentence or writes a very short one',
          response: 'Your paragraph needs a bottom bun! Try restating your main idea in different words, or tell the reader why this topic matters.',
        },
        {
          pattern: 'Student writes only one detail sentence',
          response: 'Strong paragraphs usually have 2–3 detail sentences. Can you think of another example, reason, or fact about your topic?',
        },
        {
          pattern: 'Student does not use any linking words',
          response: 'Linking words like "because," "also," and "for example" help connect your ideas. Try clicking a linking word chip to add one to your sentence.',
        },
        {
          pattern: 'Student struggles to identify the topic sentence in the Explore phase',
          response: 'The topic sentence is usually the first sentence. It tells the reader what the whole paragraph will be about. Which sentence does that?',
        },
      ],
    },
  },
  {
    id: 'story-planner',
    description: 'Pre-writing planning tool for narrative writing. Students fill structured cards: characters, setting, conflict, key events, resolution, theme. Generates visual story arc from inputs. AI-generated character/setting illustrations. Connects to story-map for read-to-write cycle. Perfect for K-6 narrative writing.',
    constraints: 'Best for K-6. Focus complexity on grade level.',
    evalModes: [
      { evalMode: 'story_structure', label: 'Story Structure (Tier 1)', beta: 2.0, scaffoldingMode: 1, challengeTypes: ['story_structure'], description: 'Sequence the narrative arc: beginning-middle-end.' },
      { evalMode: 'character_setting', label: 'Character & Setting (Tier 2)', beta: 3.0, scaffoldingMode: 2, challengeTypes: ['character_setting'], description: 'Develop a believable character and a vivid setting.' },
      { evalMode: 'conflict_resolution', label: 'Conflict & Resolution (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['conflict_resolution'], description: 'Plan a central conflict and a connected resolution.' },
      { evalMode: 'theme_craft', label: 'Theme & Craft (Tier 5)', beta: 5.0, scaffoldingMode: 5, challengeTypes: ['theme_craft'], description: 'Weave theme, dialogue, and craft into the plan.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'opinion-builder',
    description: 'Structured scaffold for opinion/argumentative writing. Uses OREO model (grades 2-4) transitioning to CER framework (grades 5-6). Students construct arguments piece by piece with validation. Counter-argument support at grades 5-6. TTS read-back. ESSENTIAL for persuasive writing grades 2-6.',
    constraints: 'Best for grades 2-4 (OREO), grades 5-6 (CER).',
    evalModes: [
      { evalMode: 'oreo', label: 'OREO (Tier 2)', beta: 3.0, scaffoldingMode: 2, challengeTypes: ['oreo'], description: 'Opinion-Reason-Example-Opinion (grades 2-4).' },
      { evalMode: 'cer', label: 'CER (Tier 4)', beta: 5.5, scaffoldingMode: 4, challengeTypes: ['cer'], description: 'Claim-Evidence-Reasoning (grades 5-6).' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'revision-workshop',
    description: 'Students apply specific revision strategies to draft passages: adding details, strengthening word choice, combining sentences, fixing run-ons, improving transitions, reorganizing. Before/after comparison with TTS read-aloud. Perfect for grades 2-6 revision skills.',
    constraints: 'Best for grades 2-6. Focus on one revision skill at a time.',
    evalModes: [
      { evalMode: 'add_details', label: 'Add Details (Tier 1)', beta: 2.0, scaffoldingMode: 1, challengeTypes: ['add-details'], description: 'Expand with sensory/specific details.' },
      { evalMode: 'word_choice', label: 'Word Choice (Tier 2)', beta: 3.0, scaffoldingMode: 2, challengeTypes: ['word-choice'], description: 'Replace weak/vague words.' },
      { evalMode: 'combine_sentences', label: 'Combine Sentences (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['combine-sentences'], description: 'Combine choppy sentences.' },
      { evalMode: 'transitions', label: 'Transitions (Tier 3)', beta: 4.5, scaffoldingMode: 3, challengeTypes: ['transitions'], description: 'Add/improve transition words.' },
      { evalMode: 'reorganize', label: 'Reorganize (Tier 4)', beta: 5.5, scaffoldingMode: 4, challengeTypes: ['reorganize'], description: 'Reorder for logical flow.' },
      { evalMode: 'concision', label: 'Concision (Tier 5)', beta: 6.5, scaffoldingMode: 5, challengeTypes: ['concision'], description: 'Eliminate wordiness.' },
    ],
    supportsEvaluation: true,
  },

  // ===== SPEAKING & LISTENING (SL) =====
  {
    id: 'read-aloud-studio',
    description: 'Fluency practice with three modes: Model (TTS with karaoke-style word highlighting), Practice (student records via microphone), Compare (side-by-side playback). Tracks WPM. Student self-assessment only, no AI speech grading. Perfect for grades 1-6 fluency.',
    constraints: 'Best for grades 1-6. Requires microphone for practice mode. No AI grading of speech.',
    evalModes: [
      { evalMode: 'accuracy', label: 'Accuracy (Tier 1)', beta: 2.0, scaffoldingMode: 1, challengeTypes: ['accuracy'], description: 'Smooth, accurate word reading (automaticity).' },
      { evalMode: 'expression', label: 'Expression (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['expression'], description: 'Prosody: phrasing, pausing, and emphasis.' },
      { evalMode: 'dialogue', label: 'Dialogue (Tier 4)', beta: 4.5, scaffoldingMode: 4, challengeTypes: ['dialogue'], description: 'Character voices and dramatic tone.' },
    ],
    supportsEvaluation: true,
    tutoring: {
      taskDescription:
        'You are coaching a fluency read-aloud session. '
        + 'The student is reading a passage titled "{{title}}" at Grade {{gradeLevel}} (Lexile {{lexileLevel}}). '
        + 'Target WPM: {{targetWPM}}. Phase: {{currentPhase}}. '
        + 'Model listened: {{modelListened}}. Recording made: {{recordingMade}}. '
        + 'Estimated WPM: {{estimatedWPM}}. Self-assessment: {{selfAssessment}}/5.',
      contextKeys: [
        'title', 'gradeLevel', 'lexileLevel', 'targetWPM',
        'currentPhase', 'modelListened', 'recordingMade',
        'estimatedWPM', 'selfAssessment', 'comparisonUsed',
        'passageWordCount',
      ],
      scaffoldingLevels: {
        level1:
          'LISTEN phase: "Listen carefully to how the reading sounds. Notice the rhythm!" '
          + 'PRACTICE phase: "Try reading along. Watch for the expression markers!" '
          + 'RECORD phase: "Read the passage at a pace that feels natural to you." '
          + 'REVIEW phase: "How do you think you did? What felt smooth?"',
        level2:
          'LISTEN phase: "Pay attention to where the reader pauses and which words are emphasized." '
          + 'PRACTICE phase: "See the pause marks and bold words? Those tell you where to pause and emphasize." '
          + 'RECORD phase: "Try to match the pace you heard in the model—aim for about {{targetWPM}} words per minute." '
          + 'REVIEW phase: "Compare your WPM to the target. Was your pace comfortable? Did you pause at the right spots?"',
        level3:
          'LISTEN phase: "Listen one more time. Notice the reader pauses at the | marks and stresses the bold words. That\'s called expression." '
          + 'PRACTICE phase: "Let\'s practice together. Pause where you see |, and read bold words a little louder and slower." '
          + 'RECORD phase: "Take a breath, then read the whole passage. Don\'t worry about mistakes—just keep going at a steady pace." '
          + 'REVIEW phase: "You read at {{estimatedWPM}} WPM (target: {{targetWPM}}). Rate how your reading sounded using the 1-5 scale."',
      },
      commonStruggles: [
        { pattern: 'Reading too fast (estimatedWPM much higher than targetWPM)', response: 'Encourage slowing down: "Try reading a bit slower so every word is clear. Expression matters more than speed."' },
        { pattern: 'Reading too slowly (estimatedWPM much lower than targetWPM)', response: 'Encourage smoother reading: "Try not to stop between words—let them flow together like you\'re talking."' },
        { pattern: 'Skipping practice phase', response: '"Before you record, try reading along once with the expression markers. It helps you practice the pauses and emphasis."' },
        { pattern: 'Not using comparison after recording', response: '"Try comparing your recording with the model. It\'s a great way to hear how you\'re improving!"' },
        { pattern: 'Low self-assessment (1-2)', response: '"Reading takes practice! Each time you read, your fluency improves. Let\'s try again and see how it sounds."' },
      ],
      aiDirectives: [
        {
          title: 'ACTIVITY INTRODUCTION',
          instruction:
            'When you receive [ACTIVITY_START], warmly introduce the read-aloud session. '
            + 'Mention the passage title and that we will listen to a model reading first, '
            + 'then practice, then record our own reading. '
            + 'Encourage the student to listen carefully. Keep it brief (2-3 sentences).',
        },
        {
          title: 'MODEL READING',
          instruction:
            'When you receive [READ_PASSAGE], read the passage aloud with clear, expressive fluency. '
            + 'Use natural pacing at the requested WPM. Pause where indicated by | marks. '
            + 'Emphasize bold words slightly. Read the ENTIRE passage naturally—do NOT add commentary, '
            + 'encouragement, or extra words before, during, or after the reading. '
            + 'Just read the passage exactly as written, like a teacher modeling fluent reading.',
        },
        {
          title: 'FLUENCY COACHING',
          instruction:
            'You are a fluency coach, NOT a speech grader. Never score or critique the student\'s pronunciation. '
            + 'Focus on encouragement, expression tips, and pacing. '
            + 'When discussing WPM, frame it positively—any reading is progress. '
            + 'Emphasize that expression (pausing, emphasis, intonation) matters as much as speed.',
        },
      ],
    },
  },

  // ===== LANGUAGE (L) =====
  {
    id: 'sentence-builder',
    description: 'Students construct grammatical sentences by arranging color-coded word/phrase tiles by grammatical role (subject=blue, predicate=red, object=green, modifier=yellow). Progressive complexity from simple S-V to compound-complex sentences. TTS read-back. ESSENTIAL for grades 1-6 grammar.',
    constraints: 'Best for grades 1-6. Sentence complexity should match grade level.',
    evalModes: [
      {
        evalMode: 'simple',
        label: 'Simple (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['simple'],
        description: 'Build simple sentence from tiles.',
      },
      {
        evalMode: 'compound',
        label: 'Compound (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['compound'],
        description: 'Join clauses with conjunction.',
      },
      {
        evalMode: 'complex',
        label: 'Complex (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['complex'],
        description: 'Subordinate clause construction.',
      },
      {
        evalMode: 'compound_complex',
        label: 'Compound-Complex (Tier 5)',
        beta: 7.0,
        scaffoldingMode: 5,
        challengeTypes: ['compound-complex'],
        description: 'Multi-clause sentence building.',
      },
    ],
    tutoring: {
      taskDescription:
        'Student is building {{sentenceType}} sentences by arranging color-coded tiles into grammatical order. '
        + 'Phase: {{currentPhase}} ({{phaseDescription}}). Challenge {{withinPhaseIndex}}/{{totalChallengesPerPhase}}. '
        + 'Target meaning: "{{targetMeaning}}". Tiles placed: {{tilesPlaced}}/{{totalTiles}}. Attempt: {{attemptNumber}}.',
      contextKeys: [
        'sentenceType', 'currentPhase', 'phaseDescription', 'withinPhaseIndex',
        'totalChallengesPerPhase', 'targetMeaning', 'tilesPlaced', 'totalTiles',
        'attemptNumber', 'gradeLevel', 'placedWords', 'tileRoles',
      ],
      scaffoldingLevels: {
        level1:
          '"Read the target meaning aloud. Now look at your tiles — which one tells us WHO or WHAT the sentence is about?"',
        level2:
          '"The sentence should say: {{targetMeaning}}. Start with the {{subjectHint}} — that\'s the subject (blue tile). '
          + 'Next, what does the subject DO? That\'s the predicate (red tile)."',
        level3:
          '"Let\'s build it together step by step: First, find the subject (blue) — who is the sentence about? '
          + 'Then the predicate (red) — what do they do? Finally, the object (green) — what do they do it to? '
          + 'Read it back: does it match the meaning?"',
      },
      commonStruggles: [
        { pattern: 'Student places tiles in wrong order repeatedly', response: '"Let\'s slow down. Read the meaning again. Now point to WHO the sentence is about — that word goes first. Sentences usually follow: Who → Does what → To what."' },
        { pattern: 'Student confuses subject and object', response: '"Both are things or people, but one DOES the action and the other RECEIVES it. In \'The cat chased the mouse\', who is doing the chasing? That\'s the subject!"' },
        { pattern: 'Student forgets punctuation tile', response: '"Almost there! Every sentence needs something at the end. What mark tells the reader the sentence is finished?"' },
        { pattern: 'Student hesitates and places no tiles', response: '"Start with any tile you\'re sure about! The blue tiles are subjects — pick the one that matches WHO the sentence is about."' },
        { pattern: 'Student struggles with conjunctions in compound sentences', response: '"You have two ideas to connect. Words like \'and\', \'but\', and \'so\' are bridges between them. Which bridge word fits the meaning best?"' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'context-clues-detective',
    description: 'Students determine unfamiliar word meaning using context clues. Teaches clue types: definition, synonym/antonym, example, inference. Students highlight clues, identify type, provide meaning. Dictionary comparison reveal. Perfect for grades 2-6 vocabulary.',
    constraints: 'Best for grades 2-6. Requires passage with context clues near target word.',
    evalModes: [
      {
        evalMode: 'definition',
        label: 'Definition (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['definition'],
        description: 'Meaning stated directly in text.',
      },
      {
        evalMode: 'synonym_antonym',
        label: 'Synonym/Antonym (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['synonym', 'antonym'],
        description: 'Meaning from similar/opposite words.',
      },
      {
        evalMode: 'example',
        label: 'Example (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['example'],
        description: 'Meaning from given examples.',
      },
      {
        evalMode: 'inference',
        label: 'Inference (Tier 4)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['inference'],
        description: 'Meaning from broader context.',
      },
    ],
    supportsEvaluation: true,
    tutoring: {
      taskDescription:
        'You ARE the detective coach for this context-clues activity. '
        + 'The student is figuring out what an unfamiliar word means using clues in the passage — '
        + 'NEVER reveal the meaning, the clue type, or which sentence is the clue; coach the strategy instead. '
        + 'Grade {{gradeLevel}}. Mystery word {{itemIndex}}/{{totalItems}}: "{{targetWord}}". '
        + 'Phase: {{currentPhase}} (find the clue sentence -> classify the clue type -> define the word). '
        + 'Student has highlighted {{highlightCount}} sentence(s); their current clue-type guess is "{{selectedClueType}}".',
      contextKeys: [
        'gradeLevel', 'targetWord', 'currentPhase', 'clueType',
        'itemIndex', 'totalItems', 'selectedClueType', 'highlightCount',
      ],
      scaffoldingLevels: {
        level1:
          'FIND phase: "Which sentence tells you something about {{targetWord}}?" '
          + 'CLASSIFY phase: "What is that clue sentence DOING for {{targetWord}}?" '
          + 'DEFINE phase: "Use the clue — what could {{targetWord}} mean?"',
        level2:
          'FIND phase: "Read the sentence right next to {{targetWord}} — does it hint at the meaning?" '
          + 'CLASSIFY phase: "Does the clue define it, give a similar or opposite word, give an example, or make you infer?" '
          + 'DEFINE phase: "Put the clue in your own words — that is close to what {{targetWord}} means."',
        level3:
          'FIND phase: "Look for the sentence that explains or hints at {{targetWord}}, then click it." '
          + 'CLASSIFY phase: "Compare the clue to {{targetWord}}: a matching word is a synonym, an opposite is an antonym, a meaning spelled out is a definition." '
          + 'DEFINE phase: "Re-read the clue sentence and say the meaning of {{targetWord}} using those words."',
      },
      commonStruggles: [
        { pattern: 'Highlights a sentence with no clue', response: 'A clue sentence helps explain {{targetWord}} — does this one do that, or is it just part of the story?' },
        { pattern: 'Cannot tell which clue type it is', response: 'Ask: does the clue sentence DEFINE {{targetWord}}, give a similar/opposite word, give an example, or make you figure it out?' },
        { pattern: 'Confuses synonym and antonym clues', response: 'Is the nearby word similar to {{targetWord}} or the opposite of it?' },
        { pattern: 'Guesses the meaning without using the clue', response: 'Point back to the clue sentence — what does it tell you {{targetWord}} is about?' },
        { pattern: 'Repeated wrong attempts on the meaning', response: 'Read just the clue sentence again slowly and say the meaning of {{targetWord}} in your own words.' },
      ],
      aiDirectives: [
        {
          title: 'ACTIVITY INTRODUCTION',
          instruction:
            'When you receive [ACTIVITY_START], warmly introduce the context-clues detective activity. '
            + 'Frame the student as a detective who figures out word meanings from clues in the passage, '
            + 'then point them to the first mystery word and tell them to click the sentence that gives a clue. '
            + 'NEVER reveal the meaning or which sentence is the clue. Keep it brief (2-3 sentences), warm, and enthusiastic. '
            + 'Use age-appropriate language for the grade level.',
        },
        {
          title: 'NEVER REVEAL THE ANSWER',
          instruction:
            'Across all phases, you must never state what {{targetWord}} means, never name the correct clue type, '
            + 'and never point to the exact clue sentence. Coach the strategy (find -> classify -> define) and nudge with questions. '
            + 'The on-screen dictionary definition appears only AFTER the student answers — do not preempt it.',
        },
      ],
    },
  },
  {
    id: 'figurative-language-finder',
    description: 'Students identify and classify figurative language in passages: simile, metaphor, personification, hyperbole, idiom, alliteration, onomatopoeia, imagery. Color-coded highlighting by type. Literal translation mode. Connects to poetry-lab. Perfect for grades 3-6.',
    constraints: 'Best for grades 3-6. Requires passage rich in figurative language.',
    evalModes: [
      {
        evalMode: 'sound_devices',
        label: 'Sound Devices (Tier 1)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['alliteration', 'onomatopoeia'],
        description: 'Identify sound-based devices.',
      },
      {
        evalMode: 'comparison',
        label: 'Comparison (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['simile', 'metaphor'],
        description: 'Identify explicit/implicit comparisons.',
      },
      {
        evalMode: 'advanced',
        label: 'Advanced (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['personification', 'hyperbole', 'imagery'],
        description: 'Non-literal expression identification.',
      },
      {
        evalMode: 'idiom',
        label: 'Idiom (Tier 5)',
        beta: 6.0,
        scaffoldingMode: 5,
        challengeTypes: ['idiom'],
        description: 'Interpret culturally specific expressions.',
      },
    ],
    supportsEvaluation: true,
    tutoring: {
      taskDescription:
        'You coach a student through a figurative-language activity. '
        + 'They progress through phases: FIND (tap figurative phrases in the passage), '
        + 'CLASSIFY (label each phrase by type), INTERPRET (write the literal meaning), and REVIEW. '
        + 'Grade {{gradeLevel}}. Phase: {{currentPhase}}. '
        + 'Found {{instancesFound}} of {{totalInstances}} phrases; {{classifiedCount}} labeled so far. '
        + 'Types present in this passage: {{typesPresent}}. '
        + 'NEVER name which phrases are figurative or what type they are — guide with signal words and the literal-vs-figurative distinction only.',
      contextKeys: [
        'gradeLevel', 'currentPhase', 'totalInstances',
        'instancesFound', 'typesPresent', 'classifiedCount',
      ],
      scaffoldingLevels: {
        level1:
          'FIND: "Read slowly — which words paint a picture or do not mean exactly what they say?" '
          + 'CLASSIFY: "How does this phrase work — is it comparing, exaggerating, or making a sound?" '
          + 'INTERPRET: "If you said this in plain words, what would it really mean?"',
        level2:
          'FIND: "Look for comparisons (like/as), exaggerations, or human actions given to objects." '
          + 'CLASSIFY: "Does it use \'like\' or \'as\'? Does it give an object a human action? That tells you the type." '
          + 'INTERPRET: "Picture what is literally happening, then write it as a plain fact."',
        level3:
          'FIND: "Scan each sentence for a phrase that cannot be literally true — that is your figurative phrase." '
          + 'CLASSIFY: "Match the signal: \'like/as\' = comparison, an action only people do = personification, a wild overstatement = exaggeration." '
          + 'INTERPRET: "Restate it directly: drop the imagery and say the underlying meaning in one plain sentence."',
      },
      commonStruggles: [
        { pattern: 'Cannot find any figurative phrases', response: 'Read one sentence at a time — does any part stretch the truth or compare two things?' },
        { pattern: 'Confuses simile and metaphor', response: 'Check for the words "like" or "as" — that is the difference between the two comparison types.' },
        { pattern: 'Labels literal language as figurative', response: 'Could this sentence be literally true? If yes, it may not be figurative.' },
        { pattern: 'Literal interpretation just repeats the phrase', response: 'Do not reuse the figurative words — say what actually, plainly happens.' },
        { pattern: 'Repeated wrong classification', response: 'Think about HOW the phrase works — comparing, exaggerating, making a sound, or giving human traits?' },
      ],
      aiDirectives: [
        {
          title: 'ACTIVITY INTRODUCTION',
          instruction:
            'When you receive [ACTIVITY_START], warmly introduce the figurative-language activity in 2 sentences max. '
            + 'Mention we will find, classify, and interpret figurative language, and encourage the student to tap each figurative phrase they spot. '
            + 'Never reveal which phrases are figurative or their types. Use age-appropriate language for the grade level.',
        },
        {
          title: 'PHASE TRANSITIONS',
          instruction:
            'When you receive [PHASE_CLASSIFY], [PHASE_INTERPRET], or [PHASE_REVIEW], give one brief sentence orienting the student to the new step. '
            + 'Do not reveal any answer or correct type.',
        },
        {
          title: 'CLASSIFICATION FEEDBACK',
          instruction:
            'When you receive [CLASSIFY_CORRECT], affirm in one short sentence and name the signal that makes the phrase that type. '
            + 'When you receive [CLASSIFY_INCORRECT], give a brief hint about what to look for WITHOUT naming the correct type.',
        },
        {
          title: 'COMPLETION',
          instruction:
            'When you receive [ACTIVITY_COMPLETE], give a brief, warm wrap-up (one or two sentences) acknowledging their results, plus one tip for spotting figurative language next time.',
        },
      ],
    },
  },
  {
    id: 'spelling-pattern-explorer',
    description: 'Students investigate word groups sharing spelling patterns, discover underlying rules, then apply via audio dictation practice. Supports word families, vowel patterns, suffix rules, Latin/Greek roots. TTS pronunciation and slow syllable mode. Perfect for grades 1-6 spelling.',
    constraints: 'Best for grades 1-6. Pattern complexity should match grade level.',
    evalModes: [
      {
        evalMode: 'short_vowel',
        label: 'Short Vowel (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['short-vowel'],
        description: 'CVC and short vowel patterns.',
      },
      {
        evalMode: 'long_vowel',
        label: 'Long Vowel (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['long-vowel'],
        description: 'CVCe, vowel teams.',
      },
      {
        evalMode: 'r_controlled',
        label: 'R-Controlled (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['r-controlled'],
        description: 'ar, er, ir, or, ur patterns.',
      },
      {
        evalMode: 'silent_letter',
        label: 'Silent Letter (Tier 3)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['silent-letter'],
        description: 'Silent letter conventions.',
      },
      {
        evalMode: 'morphological',
        label: 'Morphological (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['suffix-change', 'latin-root'],
        description: 'Morpheme-based spelling.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'word-sorter',
    description:
      'Interactive word sorting — drag word cards into labeled category buckets. Supports binary sorting (noun/verb, singular/plural), '
      + 'ternary sorting (past/present/future, noun/verb/adjective), and pair matching (antonyms, irregular plurals). '
      + 'ESSENTIAL for K-2 grammar, vocabulary, and comprehension.',
    constraints:
      'Requires 2-3 bucket categories per challenge. Words must be age-appropriate and sortable by a single clear criterion. '
      + 'Match pairs limited to 5-6 per challenge. BAND FLOOR: at Kindergarten use binary_sort or ternary_sort only — '
      + 'match_pairs is text-to-text matching (rhymes, antonyms) that requires decoding, so it is for Grade 1+.',
    evalModes: [
      {
        evalMode: 'binary_sort',
        label: 'Two Buckets (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['binary_sort'],
        description: 'Sort word cards into 2 labeled buckets (e.g., nouns vs verbs, singular vs plural)',
      },
      {
        evalMode: 'ternary_sort',
        label: 'Three Buckets (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['ternary_sort'],
        description: 'Sort word cards into 3 labeled buckets (e.g., past/present/future tense)',
      },
      {
        evalMode: 'match_pairs',
        label: 'Match Pairs (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 4,
        challengeTypes: ['match_pairs'],
        description: 'Grade 1+ ONLY (never Kindergarten — text-to-text matching requires decoding). Match word pairs (singular→plural, word→antonym, word→synonym)',
      },
    ],
    tutoring: {
      taskDescription:
        'Student is sorting words by {{sortingTopic}}. Challenge {{challengeNumber}}/{{totalChallenges}} ({{challengeType}}): {{instruction}}. '
        + 'Buckets: {{bucketLabels}}. Sorted {{wordsSorted}}/{{totalWords}} words. Attempt: {{attemptNumber}}. '
        + 'Word the student is holding right now (empty if none): {{selectedWord}}.',
      contextKeys: [
        'challengeType', 'instruction', 'bucketLabels', 'wordsSorted', 'totalWords',
        'attemptNumber', 'challengeNumber', 'totalChallenges', 'gradeLevel', 'sortingTopic', 'selectedWord',
      ],
      scaffoldingLevels: {
        level1:
          '"Listen — I\'ll say the word out loud for you. Say it with me. Which group does it SOUND like it belongs with? Tap the bucket you think!"',
        level2:
          '"Say the word {{selectedWord}} out loud with me. Now listen to our sorting question one more time — I\'ll ask it again. Think about what the word MEANS, then tap your best guess."',
        level3:
          '"Let\'s do this one together. The word is {{selectedWord}} — say it with me. I\'ll give you a clue about how the groups are different, and then YOU tap the bucket you think. Ready? Listen..."',
      },
      commonStruggles: [
        { pattern: 'Student places a word in the wrong bucket repeatedly', response: '"Let\'s slow down and do this one together. I\'ll say the word out loud — you say it after me. Now listen to our sorting question again, then tap the bucket that sounds right."' },
        { pattern: 'Student hesitates and does not tap anything', response: '"Pick any card to start — there is no wrong order! Tap one and I\'ll say it out loud. Then we\'ll figure out where it goes together."' },
        { pattern: 'Student confuses two similar categories', response: '"Some words are tricky! Say the word out loud with me and think about what it MEANS. I\'ll give you a clue about how the two groups are different — then you make the pick."' },
        { pattern: 'Student taps matches at random in pair matching', response: '"Let\'s slow down. Tap one word on the left and I\'ll say it out loud. Then listen while we think about its partner — which one sounds right together?"' },
      ],
      // ORIENT + STIMULUS beat (reader-fit RF-1): word-sorter claims K — a
      // pre-reader cannot decode the instruction, the word cards, or the bucket
      // labels, and contextKeys are tutor-reference only. In lesson mode the
      // [PRIMITIVE SWITCH]/greeting cap the tutor at one sentence, so without a
      // directive the tutor greets and stops, stranding the non-reader. These
      // directives make voicing the sort the mandatory first action and override
      // the one-sentence cap (addition-subtraction-scene pattern).
      aiDirectives: [
        {
          title: 'SAY THE SORT OUT LOUD FIRST — the student is a K-2 child who may not read',
          instruction:
            'The student may not be able to read the instruction, the word cards, or the bucket labels — you are their voice. '
            + 'Whenever a new sorting challenge begins (a [PRIMITIVE SWITCH], [ACTIVITY_START], or [NEXT_ITEM]), your FIRST action is: '
            + '(1) say what we are doing in child terms — the challenge is: "{{instruction}}"; '
            + '(2) name each bucket out loud so the child knows the choices: {{bucketLabels}}; '
            + '(3) ask the sorting question as a spoken question (for example, "Is it an animal, or something an animal DOES?"). '
            + 'Saying the sort out loud IS your greeting for this activity — this overrides any instruction to keep the '
            + 'transition to a single sentence. Never say which bucket a word belongs in.',
        },
        {
          title: 'SAY WORD CARDS ALOUD — the child reads with your voice',
          instruction:
            'When you receive a [WORD_STAGED] or [WORD_TAP] message, say that word aloud clearly — just the word itself, '
            + 'warmly and once. The child cannot read the card; your voice is how they know what it says. '
            + 'Never hint at which bucket or match the word belongs to when saying it.',
        },
      ],
    },
    supportsEvaluation: true,
  },
];
