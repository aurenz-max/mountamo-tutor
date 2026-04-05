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
    description: 'Controlled-vocabulary reading passages with per-word TTS support. Every word is tappable for pronunciation. Tracks which words students tap (decoding difficulty proxy). Includes embedded comprehension question. Words color-coded by phonics pattern. ESSENTIAL for K-2 reading fluency.',
    constraints: 'Grades K-2. Requires controlled phonics patterns matching student decoding level.',
    evalModes: [
      { evalMode: 'default', label: 'Default (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['default'], description: 'Controlled-vocabulary reading with comprehension question.' },
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
        'title', 'gradeLevel', 'currentPhase', 'totalWords',
        'wordsTapped', 'wordsReadIndependently',
        'phonicsPatternsInPassage', 'comprehensionQuestion',
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
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive a message starting with [PRONOUNCE], you MUST immediately and clearly say ONLY '
            + 'the requested word. Do NOT add any commentary, questions, encouragement, or extra words. '
            + 'Just say the word naturally and clearly. This is used for audio playback when students tap words.\n'
            + 'Examples:\n'
            + '- "[PRONOUNCE] Say the word cat clearly." → Just say "cat"\n'
            + '- "[PRONOUNCE] Say the word the clearly." → Just say "the"',
        },
      ],
    },
  },

  {
    id: 'rhyme-studio',
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
    id: 'cvc-speller',
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
        level2: '"Stretch the word with emphasis on the vowel. Use keyword association: {{middlePhoneme}} like [keyword]."',
        level3: '"Isolate just the vowel sound. Say it alone, then connect to the letter. {{targetWord}} has {{middlePhoneme}} in the middle."',
      },
      commonStruggles: [
        { pattern: 'Vowel confusion (e.g., picking "e" instead of "a")', response: 'Contrast the two sounds: "Is it /\u0103/ like apple or /\u0115/ like egg?" Stretch the word to emphasize the middle.' },
        { pattern: 'Reversing letter order in spell-word mode', response: 'What\'s the FIRST sound? That goes in the first box. Segment the word: first... middle... last.' },
        { pattern: 'Cannot identify the medial vowel', response: 'Use the Stretch button. The AI will emphasize the vowel sound. It\'s the loud sound in the middle.' },
        { pattern: 'Sorting a word into the wrong bucket', response: 'Say both bucket vowel sounds, then the word. "Is cat more like apple... or egg?" Stretch the vowel to hear it.' },
      ],
      aiDirectives: [
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
    id: 'character-web',
    description: 'Interactive node-and-edge graph for character analysis and relationship mapping. Students build character profiles with traits and text evidence citations, then map relationships between characters. Tracks character change over time. Perfect for literary analysis grades 2-6.',
    constraints: 'Requires narrative text with 2+ characters. Best for grades 2-6.',
    evalModes: [
      { evalMode: 'default', label: 'Default (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['default'], description: 'Character trait identification and relationship mapping.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'poetry-lab',
    description: 'Dual-mode poetry primitive. Analysis mode: examine poems with interactive annotations for rhyme scheme, meter, figurative language, and structure. Composition mode: write poetry within structured templates (haiku, limerick, acrostic, free verse). TTS read-aloud with expressive prosody. Perfect for grades 1-6 poetry.',
    constraints: 'Best for grades 1-6. Analysis mode needs a poem; composition mode needs a template type.',
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
      { evalMode: 'default', label: 'Default (Tier 3)', beta: 3.0, scaffoldingMode: 3, challengeTypes: ['default'], description: 'Classify text excerpts by genre features.' },
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
  },
  {
    id: 'evidence-finder',
    description: 'Students find and highlight specific text evidence supporting claims in informational passages. Supports multiple claims, evidence strength ranking, and Claim-Evidence-Reasoning (CER) framework. Multi-color highlighting. Perfect for grades 2-6 evidence-based reading.',
    constraints: 'Best for grades 2-6. Requires informational passage with identifiable evidence.',
    evalModes: [
      { evalMode: 'default', label: 'Default (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['default'], description: 'Find and evaluate text evidence for claims.' },
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
      { evalMode: 'default', label: 'Default (Tier 3)', beta: 3.0, scaffoldingMode: 3, challengeTypes: ['default'], description: 'Pre-writing narrative planning with story arc.' },
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
    id: 'listen-and-respond',
    description: 'Listening comprehension primitive where passage is delivered via TTS audio only (text hidden during listening). Students answer questions from literal recall to inference. Supports replay of specific segments. Text reveal after submission. Perfect for K-6 listening comprehension.',
    constraints: 'Best for K-6. Passage text is hidden during listening phase.',
    evalModes: [
      { evalMode: 'default', label: 'Default (Tier 3)', beta: 3.0, scaffoldingMode: 3, challengeTypes: ['default'], description: 'Audio-only listening comprehension with mixed question types.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'read-aloud-studio',
    description: 'Fluency practice with three modes: Model (TTS with karaoke-style word highlighting), Practice (student records via microphone), Compare (side-by-side playback). Tracks WPM. Student self-assessment only, no AI speech grading. Perfect for grades 1-6 fluency.',
    constraints: 'Best for grades 1-6. Requires microphone for practice mode. No AI grading of speech.',
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
      + 'Match pairs limited to 5-6 per challenge.',
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
        description: 'Match word pairs (singular→plural, word→antonym, word→synonym)',
      },
    ],
    tutoring: {
      taskDescription:
        'Student is sorting words by {{sortingTopic}}. Challenge: {{instruction}}. Mode: {{challengeType}}. '
        + 'Sorted {{wordsSorted}}/{{totalWords}} words. Attempt: {{attemptNumber}}. '
        + 'Challenge {{currentChallengeIndex}}/{{totalChallenges}}.',
      contextKeys: [
        'challengeType', 'instruction', 'bucketLabels', 'wordsSorted', 'totalWords',
        'attemptNumber', 'currentChallengeIndex', 'totalChallenges', 'gradeLevel', 'sortingTopic',
      ],
      scaffoldingLevels: {
        level1:
          '"Look at this word carefully. Read it aloud. Now look at the bucket labels — which group does it belong to?"',
        level2:
          '"The word is {{currentWord}}. Think about what kind of word it is. Is it a {{bucketLabels}} word? Try saying it in a sentence to help you decide."',
        level3:
          '"{{currentWord}} is a {{correctCategory}} word. See how it fits with the other {{correctCategory}} words in that bucket? They all share something in common!"',
      },
      commonStruggles: [
        { pattern: 'Student places word in wrong bucket repeatedly', response: '"Let\'s think about this word together. Say it aloud: [word]. Now, does it describe a thing (noun), an action (verb), or how something looks (adjective)? That tells us which bucket!"' },
        { pattern: 'Student hesitates and does not tap any word', response: '"Pick any word to start — there is no wrong order! Tap one and read it aloud. Then we will figure out where it goes together."' },
        { pattern: 'Student confuses similar categories (e.g., noun vs verb for words like "run")', response: '"Some words can be tricky! Think about how the word is used HERE. Is \'run\' a thing you do (verb) or a thing you go on (noun)? The sentence around it gives you the clue."' },
      ],
    },
    supportsEvaluation: true,
  },
];
