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
      'Emoji-based phoneme matching activity. Students hear a letter sound, see an example word with emoji, '
      + 'then pick from 4 emoji+word choices to find the word that starts with the same sound. '
      + 'Audio-first with AI tutor pronouncing phonemes. Perfect for beginning phoneme awareness. ESSENTIAL for K-2 literacy.',
    constraints: 'Use concrete, picturable words with clear emoji matches. Focus on beginning sounds.',
    tutoring: {
      taskDescription:
        'Phoneme matching activity. '
        + 'Challenge {{currentChallenge}}/{{totalChallenges}}: Sound "{{phonemeSound}}" (letter {{phoneme}}). '
        + 'Example: {{exampleWord}}. Attempts: {{attempts}}.',
      contextKeys: [
        'phoneme', 'phonemeSound', 'exampleWord', 'currentChallenge',
        'totalChallenges', 'attempts',
      ],
      scaffoldingLevels: {
        level1:
          '"Listen to the sound: {{phonemeSound}}. {{exampleWord}} starts with that sound. '
          + 'Which other word starts the same way?"',
        level2:
          '"Say {{phonemeSound}} slowly. Now say each word and listen for the beginning sound. '
          + 'Which one starts with {{phonemeSound}}?"',
        level3:
          '"The answer starts with the {{phoneme}} sound, like {{exampleWord}}. Listen: {{phonemeSound}}..."',
      },
      commonStruggles: [
        { pattern: 'Confusing letter names with sounds', response: 'We want the SOUND, not the letter name. "B" makes the sound "buh".' },
        { pattern: 'Looking at emojis instead of listening', response: 'Say each word out loud. Listen to the FIRST sound. Does it match?' },
        { pattern: 'Guessing randomly', response: 'Let\'s say the sound together: "{{phonemeSound}}". Now say each word. Which one starts the same?' },
      ],
      aiDirectives: [
        {
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive [NEW_CHALLENGE], say the phoneme sound clearly and slowly. '
            + 'Then say the example word, emphasizing the first sound. '
            + 'Ask which other word starts the same way. Keep it encouraging and playful.',
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
      'Interactive letter recognition with three modes: Name It (identify a displayed letter), Find It (locate letters in a grid), '
      + 'and Match It (pair uppercase with lowercase). Supports cumulative letter group progression (Groups 1-4). '
      + 'Perfect for kindergarten letter naming assessments. ESSENTIAL for K-2 literacy foundations.',
    constraints:
      'Requires letterGroup (1-4). Group 1: s,a,t,i,p,n. Group 2: adds c,k,e,h,r,m,d. '
      + 'Group 3: adds g,o,u,l,f,b. Group 4: adds j,z,w,v,y,x,q. b and d deliberately separated across groups.',
    tutoring: {
      taskDescription:
        'Letter recognition activity. Group {{letterGroup}} (letters: {{cumulativeLetters}}). '
        + 'Mode: {{challengeMode}}. Target letter: {{targetLetter}} ({{targetCase}}). '
        + 'Challenge {{currentChallenge}}/{{totalChallenges}}. Attempts: {{attempts}}.',
      contextKeys: [
        'letterGroup', 'cumulativeLetters', 'newLetters', 'challengeMode',
        'targetLetter', 'targetCase', 'currentChallenge', 'totalChallenges', 'attempts',
      ],
      scaffoldingLevels: {
        level1: '"Look at this letter carefully. What is its name?"',
        level2: '"This letter looks like [shape hint]. Does it remind you of any letter you know?"',
        level3: '"This is the letter {{targetLetter}}. Say it with me: {{targetLetter}}!"',
      },
      commonStruggles: [
        { pattern: 'Confusing b and d', response: 'Make a "bed" with your fists — left thumb up is b, right thumb up is d.' },
        { pattern: 'Confusing p and q', response: 'The letter p has its stick going DOWN. The letter q has its stick going DOWN too, but the circle is on the other side.' },
        { pattern: 'Confusing uppercase and lowercase forms', response: 'Big [letter] and little [letter] are the same letter, just different sizes. They make the same sound!' },
        { pattern: 'Cannot name new letters', response: 'This is a new letter! Let me introduce you: this is [name]. Can you say [name]?' },
      ],
      aiDirectives: [
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
    supportsEvaluation: true,
  },
  {
    id: 'letter-sound-link',
    description:
      'Letter-sound correspondence activity where students learn the sounds letters make. Three modes: see a letter and select its sound, '
      + 'hear a sound and find the letter, or match letters to keyword images. Uses cumulative letter groups (1-4) following systematic phonics '
      + 'progression. Color-coded: consonant sounds in blue, short vowel sounds in red. AI tutor pronounces clean phonemes. '
      + 'ESSENTIAL for kindergarten and first-grade phonics instruction.',
    constraints:
      'Requires AI tutor voice connection for phoneme pronunciation. Supports 4 cumulative letter groups. '
      + 'Each challenge needs 4 options with one correct answer.',
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
    supportsEvaluation: true,
  },

  // ===== READING: LITERATURE (RL) =====
  {
    id: 'story-map',
    description: 'Interactive plot structure diagram where students identify and place story elements on a visual arc. Supports beginning-middle-end (K-1), story mountain (2-3), full plot diagram (4-5), and hero\'s journey (5-6). Students drag event cards to arc positions. ESSENTIAL for reading comprehension K-6.',
    constraints: 'Requires narrative text. Structure type should match grade level.',
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
    supportsEvaluation: true,
  },
  {
    id: 'poetry-lab',
    description: 'Dual-mode poetry primitive. Analysis mode: examine poems with interactive annotations for rhyme scheme, meter, figurative language, and structure. Composition mode: write poetry within structured templates (haiku, limerick, acrostic, free verse). TTS read-aloud with expressive prosody. Perfect for grades 1-6 poetry.',
    constraints: 'Best for grades 1-6. Analysis mode needs a poem; composition mode needs a template type.',
    supportsEvaluation: true,
  },
  {
    id: 'genre-explorer',
    description: 'Students examine text excerpts and classify them by genre using feature checklists. Supports fiction, nonfiction, poetry, drama, folktale, myth, fable, biography, informational, persuasive. Side-by-side comparison of different genres on same topic. Perfect for grades 1-6 genre study.',
    constraints: 'Best for grades 1-6. Needs text excerpts from different genres.',
    supportsEvaluation: true,
  },

  // ===== READING: INFORMATIONAL TEXT (RI) =====
  {
    id: 'text-structure-analyzer',
    description: 'Students identify organizational structure of informational passages: cause-effect, compare-contrast, problem-solution, chronological, or description. Highlight signal words, select structure type, drag content onto visual templates (Venn, T-chart, flowchart, timeline). ESSENTIAL for grades 2-6 informational reading.',
    constraints: 'Best for grades 2-6. Requires informational text with clear organizational structure.',
    supportsEvaluation: true,
  },
  {
    id: 'evidence-finder',
    description: 'Students find and highlight specific text evidence supporting claims in informational passages. Supports multiple claims, evidence strength ranking, and Claim-Evidence-Reasoning (CER) framework. Multi-color highlighting. Perfect for grades 2-6 evidence-based reading.',
    constraints: 'Best for grades 2-6. Requires informational passage with identifiable evidence.',
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
    supportsEvaluation: true,
  },
  {
    id: 'story-planner',
    description: 'Pre-writing planning tool for narrative writing. Students fill structured cards: characters, setting, conflict, key events, resolution, theme. Generates visual story arc from inputs. AI-generated character/setting illustrations. Connects to story-map for read-to-write cycle. Perfect for K-6 narrative writing.',
    constraints: 'Best for K-6. Focus complexity on grade level.',
    supportsEvaluation: true,
  },
  {
    id: 'opinion-builder',
    description: 'Structured scaffold for opinion/argumentative writing. Uses OREO model (grades 2-4) transitioning to CER framework (grades 5-6). Students construct arguments piece by piece with validation. Counter-argument support at grades 5-6. TTS read-back. ESSENTIAL for persuasive writing grades 2-6.',
    constraints: 'Best for grades 2-4 (OREO), grades 5-6 (CER).',
    supportsEvaluation: true,
  },
  {
    id: 'revision-workshop',
    description: 'Students apply specific revision strategies to draft passages: adding details, strengthening word choice, combining sentences, fixing run-ons, improving transitions, reorganizing. Before/after comparison with TTS read-aloud. Perfect for grades 2-6 revision skills.',
    constraints: 'Best for grades 2-6. Focus on one revision skill at a time.',
    supportsEvaluation: true,
  },

  // ===== SPEAKING & LISTENING (SL) =====
  {
    id: 'listen-and-respond',
    description: 'Listening comprehension primitive where passage is delivered via TTS audio only (text hidden during listening). Students answer questions from literal recall to inference. Supports replay of specific segments. Text reveal after submission. Perfect for K-6 listening comprehension.',
    constraints: 'Best for K-6. Passage text is hidden during listening phase.',
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
    supportsEvaluation: true,
  },
  {
    id: 'context-clues-detective',
    description: 'Students determine unfamiliar word meaning using context clues. Teaches clue types: definition, synonym/antonym, example, inference. Students highlight clues, identify type, provide meaning. Dictionary comparison reveal. Perfect for grades 2-6 vocabulary.',
    constraints: 'Best for grades 2-6. Requires passage with context clues near target word.',
    supportsEvaluation: true,
  },
  {
    id: 'figurative-language-finder',
    description: 'Students identify and classify figurative language in passages: simile, metaphor, personification, hyperbole, idiom, alliteration, onomatopoeia, imagery. Color-coded highlighting by type. Literal translation mode. Connects to poetry-lab. Perfect for grades 3-6.',
    constraints: 'Best for grades 3-6. Requires passage rich in figurative language.',
    supportsEvaluation: true,
  },
  {
    id: 'spelling-pattern-explorer',
    description: 'Students investigate word groups sharing spelling patterns, discover underlying rules, then apply via audio dictation practice. Supports word families, vowel patterns, suffix rules, Latin/Greek roots. TTS pronunciation and slow syllable mode. Perfect for grades 1-6 spelling.',
    constraints: 'Best for grades 1-6. Pattern complexity should match grade level.',
    supportsEvaluation: true,
  },
];
