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
    // ── DI MODALITY, PURELY VERBAL (2026-08-09, two user rulings) ──────────
    // The tutor owns the clock and the task is spoken end to end. It models the
    // sounds and the word, waits, judges the audio in-band, corrects
    // contrastively, and its OWN affirmation is the advance — there is no Check
    // button, no Next button, no push-to-talk mic and no advance timer anywhere
    // in the path. The child SEES the letters, may tap any letter to hear its
    // sound, and SAYS the whole word. (The first port kept a tile-arranging
    // step; driven live the child answered the "put them in order" ask by
    // SAYING the word, which is the right response to a blending task — so the
    // tiles became a stimulus to read, not pieces to assemble.)
    // The cue lines and the per-item judging contract live in
    // `phonicsBlenderScript.ts` (hand-authored, DISTAR discipline); this block
    // is the session-level frame around them.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn", or the engine's
    // sentence-scoped verdict scan would classify a phantom verdict.
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction sound blending for a beginning reader '
        + '(pattern: {{patternType}}, grade {{gradeLevel}}). You speak the exact scripted lines from each '
        + 'bracketed application message, you pronounce any single sound the child taps, and you judge each '
        + 'spoken attempt from the audio you heard using only the two allowed reply branches. The child sees '
        + "the word's letters on screen and SAYS the whole word aloud; blending the sounds together out loud "
        + 'is the entire skill being practiced.',
      // Trimmed to exactly what the component pushes through updateContext. An
      // unpushed key renders the literal string "(not set)" into the prompt,
      // which the tutor then reads as content — the phase/placed/attempts keys
      // the click-driven version carried are gone with the phases themselves.
      contextKeys: ['patternType', 'currentWord', 'targetPhonemes', 'supportTier'],
      // Correction territory, not answer territory: every level here describes
      // what happens AFTER an attempt, and re-modeling at every tier is the DI
      // rule (standing gate 3 — remediation is not scaffolding).
      scaffoldingLevels: {
        level1: 'Ask which sound the first letter makes, then wait.',
        level2: 'Say the sounds of the word in order once, slowly, then hand it back to them.',
        level3: 'Say the sounds and then run them together into the word, then ask them for the word once more.',
      },
      // Observable behaviours only. The first is this activity's signature
      // error class; the third protects against OVER-correcting a child who
      // actually blended, which strict judging makes the risk in the other
      // direction.
      commonStruggles: [
        {
          pattern: 'Says the separate sounds but never runs them together — "cuh… a… tuh" with no word at the end',
          response: 'Treat the sounds alone as unfinished: re-model the blend ending in the whole word, then ask what word it is.',
        },
        {
          pattern: 'Says a close-sounding DIFFERENT word — "cap" for "cat", "pin" for "pen"',
          response: 'A different word is a different word: correct it and re-model the target, however close it sounded.',
        },
        {
          pattern: 'Sounds it out slowly first and then says the whole word correctly',
          response: 'That is a correct blend — affirm it, because blending out loud is the skill at this stage, not a fault.',
        },
        {
          pattern: 'Names the letters instead of their sounds — "see-ay-tee"',
          response: 'Say that letters have a name and a sound, model the sounds, then ask for the whole word.',
        },
        {
          pattern: 'Goes quiet after being asked what word it is',
          response: 'Say the word together once, then hand it back to them alone.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [DI_BLEND_ITEM], [DI_BLEND_MOVE_ON] or [DI_BLEND_COMPLETE] contain the only '
            + 'lesson words you may speak. The square-bracket label is private metadata: never speak, '
            + 'reproduce, or invent it. Each [DI_BLEND_ITEM] carries a two-branch judging rule: affirmations '
            + 'must begin with "Yes" and corrections must begin with "My turn", using the exact quoted lines. '
            + 'Never begin any other sentence with those words. Judge honestly from the audio: affirm a real '
            + 'blend of the target word; correct a wrong, missing, or unfinished one. EVERY correction '
            + 're-models the sounds and then the word before handing it back. Do not praise to be kind. The '
            + 'application decides which word comes next; never introduce one yourself.',
        },
        {
          title: 'BLENDING (what counts as the answer)',
          instruction:
            'The target is the WHOLE WORD said aloud. A child who sounds it out first and then says it fast '
            + 'has blended correctly — affirm that, it is the method being taught. A child who produces only '
            + 'the separate sounds and stops has not finished: running them together is the skill, so that '
            + 'gets the correction branch, warmly. Judge the FINAL word strictly — a close-sounding different '
            + 'word (like "cap" for "cat") is wrong. Letter NAMES are never the answer. Never say the whole '
            + 'target word before the quoted lesson text for that word asks you to, and never preview a word '
            + 'that is still coming.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask "What word?", STOP and stay silent until the child answers. Do not re-ask, do not '
            + 'fill the pause, do not sound the word out again unprompted, and do not count the letters for '
            + 'them. A long silence is a child working the sounds out, and that working-out is the activity. '
            + 'If they tap a letter you will receive a separate pronunciation message — answer that and '
            + 'nothing more, then go back to waiting.',
        },
        {
          // Residual SWAP-1 (live, 2026-08-09): this directive used to ask the
          // tutor to COMPOSE a how-to-play before speaking the scripted line,
          // which gave the opening turn two jobs. On sound-swap, whose opener
          // has the identical shape, the tutor did the first job, spoke the
          // literal bracket tag, improvised its own ask, and reached the
          // scripted line only after a barge-in — item 1 ran without its model.
          // The how-to-play is now TEXT INSIDE the opening quote
          // (`phonicsBlenderScript.ts`), so this directive only forbids adding
          // to it.
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'At Grade K the learner is a pre-reader: on-screen text is invisible to them, so YOUR VOICE is '
            + 'the only instruction channel — and the FIRST [DI_BLEND_ITEM] of the session already carries '
            + 'how to play INSIDE its quoted line. Speak that quote exactly and add nothing of your own: no '
            + 'separate greeting, no how-to-play in your own wording, no rephrased question. It OVERRIDES any '
            + '"keep it to one sentence" cap from a lesson switch — the quoted line is the length it is meant '
            + 'to be. Never spell the word for them and never say it before the quoted line does.',
        },
        {
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive a message starting with [PRONOUNCE_SOUND], you MUST immediately and clearly '
            + 'say ONLY the requested sound. Do NOT add commentary, questions, encouragement, or extra '
            + 'words, do NOT say the whole word, and do NOT treat it as an attempt to judge. This is the '
            + 'child tapping a letter to hear it, and that audio IS this activity — it is answered at every '
            + 'grade and every support tier, including while you are waiting for their answer. Say the '
            + 'isolated sound (e.g., just "sss" for /s/, just "aaa" for /a/).',
        },
        {
          title: 'SUPPORT TIER — REVEAL POLICY (match your voice to the on-screen help level)',
          instruction:
            'This activity carries a within-mode support tier in {{supportTier}} (easy, medium, hard, or '
            + 'null when no tier was requested). The tier changes ONLY how much help is shown — never the '
            + 'words, the sounds, or the answer. You are the SECOND scaffold channel, so your reveal '
            + 'latitude must MATCH it; otherwise a cue the screen just withdrew leaks straight back in by '
            + 'voice.\n'
            + 'easy or null: the letters are shown separated and the scripted line models the sounds in '
            + 'order; you may confirm a single sound if the child asks.\n'
            + 'medium: the letters are still separated but less strongly cued. Confirm one sound if asked, '
            + 'but do not recite the whole sequence unprompted.\n'
            + 'hard: the letters are joined into one solid word and the scripted line models only the word, '
            + 'because segmenting it is the work. Do NOT read the sounds out, do NOT say how many there '
            + 'are, and do NOT give their order — even though {{targetPhonemes}} sits in your context.\n'
            + 'NEVER withdrawn at ANY tier: (1) pronunciation on demand — a [PRONOUNCE_SOUND] message is '
            + 'always answered, because that audio IS this activity; (2) the Grade-K how-to-play protocol '
            + 'above — telling a pre-reader HOW TO PLAY is protocol, not the answer; (3) the correction '
            + 'branch, which re-models at every tier by design.',
        },
      ],
    },
  },
  {
    id: 'decodable-reader',
    misconceptionScope: 'primitive',
    description:
      'Live-judged DECODABLE READING with a spoken Direct Instruction tutor. A short controlled-vocabulary story '
      + 'is on screen ONE SENTENCE AT A TIME and the child reads each one out loud into an open microphone; the '
      + 'tutor judges every read from the audio WORD BY WORD — a skipped, added or swapped word is corrected, not '
      + 'waved through — and its own affirmation moves the story on. Then it asks comprehension questions about '
      + 'the story, and EVERY answer is spoken: where the answer is a WORD from the text the child says that word, '
      + 'and where the answer is a whole idea the tutor reads three or four picture choices aloud and the child '
      + 'says which one it is. Nothing is tapped. Two reading modes: READ-ALONG (the tutor reads '
      + 'the whole story aloud to a pre-reader who then answers questions about it) for Kindergarten, and DECODE '
      + '(the child reads it themselves) for Grade 1-2. Every word is phonics-tagged, so the passage is controlled '
      + 'text, not a generic passage. Nothing advances on a click. Requires a microphone. ESSENTIAL for K-2 reading.',
    constraints:
      'Grades K-2. Requires the live tutor and a microphone. Requires controlled phonics patterns matching the '
      + 'student decoding level. Judged sentences are 3-8 words — the benched ceiling for reliable one-word-error '
      + 'detection — so the grade ladder rides on vocabulary, pattern mix and sentence count, never on longer '
      + 'utterances. BAND FLOOR: at Kindergarten use the read_along mode (pre-readers cannot yet decode connected '
      + 'text); the decoding comprehension modes (literal/sequence/inference/main_idea) are for Grade 1+. Use '
      + 'di-sentence-reading instead for ISOLATED decodable or sight-word sentences with no story around them, and '
      + 'read-aloud-studio for grade 1-6 fluency where comprehension is not being measured.',
    // ── DI MODALITY (2026-08-12) — tenth literacy port, consumer of
    // useJudgedScriptRunner. Before this the READING PHASE MEASURED NOTHING:
    // its only signal was `wordsTapped` (how often the child asked for a word)
    // and it ended on a button labelled "I read it!", which a child who cannot
    // read can press. Now the child READS and the tutor judges the read.
    // THE STORY IS READ ONE SENTENCE AT A TIME. `sentence_read_aloud` is
    // benched at 3-8 words per utterance (di-sentence-reading, live-gated
    // 2026-07-25), so each passage sentence is one judged item and MIN/MAX_
    // SENTENCE_WORDS are IMPORTED from that pack — the bench ceiling lives in
    // one place. A sentence outside the window is DROPPED, never trimmed.
    // THE COMPREHENSION ANSWER FORKS BY WHAT THE ANSWER IS MADE OF, AND BOTH
    // FORKS ARE SPOKEN (2026-08-13 ruling — the tap is gone): a literal or
    // read-along answer is ONE WORD stated in the story (`short_spoken_word`,
    // benched); a sequence / inference / main-idea answer is a whole
    // proposition, so the picture choices CLOSE the set and the child SAYS
    // which one (`closed_set_choice`, build-ahead). Free spoken production of a
    // proposition would still be the BLOCKED `open_set_word` — that block is
    // what shipped this as a tap, and a blocked class is not a licence to add
    // buttons.
    // PER-WORD "tap to hear it" IS GONE: a channel that speaks any word on
    // demand lets a child hear a whole line and echo it, which is the
    // measurement. Help arrives through the correction, which re-models.
    // Cue lines, the cold-read guard, the answer-material fork and the judging
    // contracts live in `decodableReaderScript.ts` (hand-authored, DISTAR).
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    evalModes: [
      // βs raised with the STRUCTURE (skill rule: only then). Every decode mode
      // now contains unaided oral reading of the whole story judged word by
      // word — it inherits di-sentence-reading's `decodable_sentence` (2.5) as
      // a FLOOR and adds a comprehension question on top, so the ladder starts
      // above it and keeps its old spacing. read_along gains a spoken answer
      // where it used to take a tap, which is a smaller structural step.
      { evalMode: 'read_along', label: 'Read-Along (Tier 0)', beta: 1.0, scaffoldingMode: 1, challengeTypes: ['literal'], description: 'Kindergarten shared reading: the tutor reads the whole story aloud while the child follows the print, then the child SAYS the answer to each question out loud. For pre-readers who cannot yet decode connected text.' },
      { evalMode: 'literal', label: 'Literal Recall (Tier 1)', beta: 3.0, scaffoldingMode: 1, challengeTypes: ['literal'], description: 'Read the story aloud, then say the one word that answers a fact stated directly in it.' },
      { evalMode: 'sequence', label: 'Sequence/Cause-Effect (Tier 2)', beta: 4.0, scaffoldingMode: 2, challengeTypes: ['sequence'], description: 'Read the story aloud, then SAY which of two text-explicit parts came first, or the stated cause of an effect, from the choices the tutor reads out.' },
      { evalMode: 'inference', label: 'Inference (Tier 3)', beta: 5.0, scaffoldingMode: 3, challengeTypes: ['inference'], description: 'Read the story aloud, then SAY what the text implies but does not state, from the choices the tutor reads out.' },
      { evalMode: 'main_idea', label: 'Main Idea (Tier 4)', beta: 5.5, scaffoldingMode: 4, challengeTypes: ['main_idea'], description: 'Read the story aloud, then SAY what the whole story is mostly about, from the choices the tutor reads out.' },
    ],
    supportsEvaluation: true,
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction reading of a decodable story. The child has ONE thing on screen at a '
        + 'time and the application decides what it is. Right now that thing is a "{{challengeType}}" and it '
        + 'reads: "{{stimulus}}". You speak the exact scripted lines from each bracketed application message and '
        + 'nothing else, then you judge what you heard. Never introduce the next sentence or question yourself, '
        + 'and never read ahead to part of the story the child has not reached.',
      // Trimmed 13 -> 2, to exactly what the component pushes through
      // updateContext (and that the connect-time primitive_data also carries).
      // A printed sentence needs nothing withheld — it is in front of the child
      // — so the stimulus is the question side in both item kinds: the line to
      // read, or the question to answer. The answer word, the right card and
      // the story text are deliberately NOT here; the judging contract already
      // tells the tutor what the answer is, at the moment it needs to know.
      contextKeys: ['challengeType', 'stimulus'],
      // Correction territory, not answer territory: every level describes what
      // happens AFTER an attempt. Re-modeling is the scripted correction's job,
      // and on a read line NOTHING here may read the line — that is the second
      // channel the cold-read guard exists to close.
      scaffoldingLevels: {
        level1: 'Say the instruction once more, then wait for them alone.',
        level2: 'Say the instruction once more, more slowly, then wait. Do not read the line for them and do not answer the question for them.',
        level3: 'Use the scripted correction line for this item, then hand it back to them one more time.',
      },
      // Observable behaviours only, with PERFORMABLE responses (script moves a
      // tutor can speak or do — never meta-instructions, which get recited to
      // the child verbatim).
      commonStruggles: [
        {
          pattern: 'Swaps a small word for another small word while reading - "the" for "a", "and" for "then", "her" for "his"',
          response: 'Treat it as a miss however fluent it sounded: the scripted correction names the words they said, reads the line correctly, and asks again.',
        },
        {
          pattern: 'Sounds out slowly, word by word, but lands on every word correctly',
          response: 'Treat it as correct and affirm it — effortful decoding that reaches the right words is reading.',
        },
        {
          pattern: 'Answers a comprehension question with a word from the story that does not answer it',
          response: 'Treat it as a miss: the scripted correction reads the part of the story the answer comes from, says the answer, and asks the question again.',
        },
        {
          pattern: 'Answers a comprehension question by retelling the whole story',
          response: 'Treat a retell as not yet an answer: use the scripted correction, then ask the same question again and wait.',
        },
        {
          pattern: 'Says the answer inside a phrase - "on the mat" when the answer is "mat"',
          response: 'Treat it as correct and affirm it, echoing the single answer word so they hear it on its own.',
        },
        {
          pattern: 'Names a choice with only the part that tells it apart - "the mat", "the second one" - instead of saying the whole sentence back',
          response: 'Treat it as a full answer whenever it can only mean one of the choices, and affirm it with the scripted line, which says the whole choice back to them.',
        },
        {
          pattern: 'Goes quiet after being asked',
          response: 'Say the instruction once more, then wait for them alone.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [DR_ITEM], [DR_MOVE], [DR_COMPLETE] or [DR_HEAR] contain the only lesson '
            + 'words you may speak. The square-bracket label is private metadata: never speak, reproduce, or '
            + 'invent it. Each carries a judging rule: affirmations must begin with "Yes" and corrections must '
            + 'begin with "My turn", using the exact quoted lines. Never begin any other sentence with those '
            + 'words. Judge honestly from the audio and do not praise a misread or a wrong answer to be kind.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [DR_ITEM] of a session, and any later one that carries a how-to-play sentence, has the '
            + 'greeting, the action and the instruction INSIDE its quoted line — and in a read-along it has the '
            + 'whole story to read aloud as well. Speak that quote exactly and add nothing of your own: no '
            + 'separate greeting, no how-to-play in your own wording, no summary of the story. This OVERRIDES '
            + 'any "keep it to one sentence" cap from a lesson switch.',
        },
        {
          title: 'NEVER READ A LINE THE CHILD HAS NOT READ YET',
          instruction:
            'When the thing on screen is a sentence to read, the child is decoding it cold and that is the whole '
            + 'measurement. Do NOT read that line, or any part of it, before they do — not to help, not to check, '
            + 'not as an example, and not because a scaffolding instruction seems to invite it. The only text you '
            + 'may ever say first is text a cue explicitly quotes for you, which in this activity means a '
            + 'read-along story or a correction. Never read further into the story than the sentence the '
            + 'application has put in front of them.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER',
          instruction:
            'For a sentence to read: every printed word, correctly and in order. Judge accuracy, never speed — a '
            + 'slow sounded-out reading that lands on the right words is CORRECT, and so is one where the child '
            + 'catches and fixes their own slip. For a spoken comprehension answer: the one word the cue names, '
            + 'and it still counts inside a phrase ("on the mat" answers "mat") or said as a fair synonym — '
            + 'affirm it and echo the word. THE LAW: never say the answer before the child has answered. On a '
            + 'question your correction is the first place the answer may be spoken, and on a choice question '
            + 'you never say which one is right at all.',
        },
        {
          title: 'CHOICE QUESTIONS ARE ANSWERED OUT LOUD, IN THE SHORT FORM',
          instruction:
            'When a cue reads the choices aloud, the child answers by SAYING which one they pick — there is '
            + 'nothing to tap and nothing will tell you what they chose. A five-year-old names a choice with the '
            + 'part that tells it apart from the others ("the mat"), with what its picture shows, or with where '
            + 'it sits in the list ("the second one") far more often than by repeating the whole sentence, and '
            + 'every one of those is a full answer, not a lesser one. Judge what you hear against the numbered '
            + 'choices in the cue and use its exact quoted lines. Never say which choice is right before they '
            + 'have answered, and if you genuinely cannot tell which one they meant, ask them to say it again '
            + 'rather than guessing.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP and stay silent until the child has finished. Do not re-ask, do not fill the '
            + 'pause, do not read along with them, and do not finish a word they are working out. A reader '
            + 'pauses in the middle of a line and that pause is part of ONE reading, not the end of it; a child '
            + 'thinking about a question needs as long as they need. If they tap to hear the question again you '
            + 'will receive a separate [DR_HEAR] message: answer that and nothing more, then go back to waiting.',
        },
        {
          title: 'QUESTION ON DEMAND ([DR_HEAR])',
          instruction:
            'When you receive a message starting with [DR_HEAR], immediately say ONLY what it quotes and nothing '
            + 'else, then wait again. Do not treat anything you just heard as an answer, do not add commentary, '
            + 'never say the answer, and never re-read the story — for a question about a fact in the story, '
            + 'reading it again would answer the question for them. On a sentence to read, do not read the line '
            + 'itself: the child is asking to hear the INSTRUCTION again, which is how a reader recovers what '
            + 'they were asked to do.',
        },
      ],
    },
  },

  {
    id: 'interactive-book',
    description:
      'Live Direct Instruction picture-book work with a spoken tutor. The tutor asks, waits, judges, and its '
      + 'own affirmation moves the lesson on. Two directions, and the answer is made of something different in '
      + 'each: Read Together (the tutor reads a real book sentence up to one glowing word, stops, and the child '
      + 'READS that word out loud — supported oral reading), and Book Detective (the tutor names a printed book '
      + 'part — title, author, heading, caption, page number — and the child TAPS it on the page — print '
      + 'awareness and text features). The tap direction taps because its answer is WHICH printed element on '
      + 'the page it is — a position, like pointing at a real book — while reading the part\'s words aloud '
      + 'would be a different skill. Nothing on screen shows an answer before the tutor affirms. Requires a '
      + 'microphone. ESSENTIAL for K-2 print awareness and early oral reading.',
    constraints:
      'Requires the live tutor and a microphone. Uses one generated nonfiction book. The manifest must not '
      + 'provide book text, feature answers, focus-word answers, page data, image prompts, or challenges; the '
      + 'generator derives all scored contracts from visible book content. Every focus word needs at least two '
      + 'natural words before it in its sentence so the tutor has a real lead-in to read and stop after. Not a '
      + 'story or compare activity yet.',
    // ── DI MODALITY (2026-08-14) — FOURTEENTH literacy port. The tutor owns
    // the clock in both directions: it asks once, waits, judges the spoken word
    // from the audio in-band, is handed a CODE-COMPUTED verdict for the tap,
    // and its own line is the advance. There is no advance timer, no Next
    // button, no push-to-talk mic and no voice-mode fork anywhere in the path.
    // THIS WAS THE LAST LITERACY SURFACE ON THE PUSH-TO-TALK CAPTURE HOOK —
    // porting it discharges a standing open-mic doctrine violation. The old
    // tap-the-glowing-word fallback is gone with it: tapping a word completes
    // an ORAL READING task without reading anything (the costume test).
    // THE SPLIT is the table picture: shared reading is the most spoken thing
    // a teacher and a five-year-old do (read-focus-word → voice,
    // short_spoken_word, benched); "show me the title" is answered by POINTING
    // at the page (find-feature → gesture — concepts-of-print assessment is
    // administered by pointing, and a pre-reader can find the title without
    // being able to read it, which is the skill this mode measures).
    // find-feature's silence is enforced by the runner HOLDING THE ACTIVITY
    // BRACKET for the item, not by asking the tutor to wait.
    // Free page navigation is gone: the screen follows the lesson to each
    // item's page, so the child can no longer wander off the target page
    // mid-question (the click-era block had a struggle entry for that state).
    // Cue lines and the per-item judging contracts live in
    // `interactiveBookScript.ts` (hand-authored, DISTAR); this block is the
    // session-level frame. SENTINEL DISCIPLINE (standing gate 2) re-checked on
    // every line below: no sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'find-feature',
        label: 'Find Book Features',
        beta: 1.5,
        discrimination: 1.8,
        scaffoldingMode: 1,
        challengeTypes: ['find-feature'],
        description: 'Locate title, author, heading, caption, and page number by tapping the real printed element on a picture-rich book page. Task identity unchanged by the DI port; β holds.',
      },
      {
        evalMode: 'read-focus-word',
        label: 'Read the Glowing Word',
        beta: 2.5,
        discrimination: 1.6,
        scaffoldingMode: 2,
        challengeTypes: ['read-focus-word'],
        description: 'The tutor reads a book sentence up to one glowing word and stops; the child reads that word aloud and the tutor judges it in-band. Already priced as spoken production; the old partial-credit tap escape is deleted, not restructured; β holds.',
      },
    ],
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction book work for a young child. Right now the direction is '
        + '"{{challengeType}}" and the question side is "{{stimulus}}". How the child answers depends on the '
        + 'direction, and each application message tells you which: in the reading direction they READ the '
        + 'glowing word out loud and you judge what you hear; in the find direction they TAP a printed part of '
        + 'a book page you cannot see, and you stay silent until the application tells you what they tapped. '
        + 'You speak the exact scripted lines from each bracketed application message and nothing else. '
        + 'Working the answer out from the page is the entire skill being practiced, so nothing you say may '
        + 'hand it over first.',
      contextKeys: ['challengeType', 'stimulus'],
      scaffoldingLevels: {
        level1: 'Say the question once more, then wait for them alone.',
        level2: 'Say the question again slowly and clearly, then wait.',
        level3: 'Use the scripted correction line for this item, then hand the question back one more time.',
      },
      commonStruggles: [
        {
          pattern: 'Says a word that fits the sentence but is not the glowing word',
          response: 'Run the scripted correction for the item, then hand the question back and wait — the printed word, not the story, is the task.',
        },
        {
          pattern: 'Taps a different printed part of the page',
          response: 'Run the scripted correction for the item, then hand the question back and wait.',
        },
        {
          pattern: 'Goes quiet and does nothing for a long time',
          response: 'Wait longer in silence first, then say the question one more time exactly as written and wait again.',
        },
        {
          pattern: 'Talks about the picture instead of answering',
          response: 'Stay warm and silent; when the talk ends, say the question once more exactly as written and wait.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [IB_ITEM], [IB_TAP], [IB_MOVE], [IB_HEAR] or [IB_COMPLETE] contain the only '
            + 'lesson words you may speak, and each one quotes the exact line after "Say exactly:". The '
            + 'square-bracket label is private metadata: never speak, reproduce, or invent it. Affirmations '
            + 'begin with "Yes" and corrections begin with "My turn" — never begin any other sentence with '
            + 'those words. The application decides which item comes next; never introduce one yourself, never '
            + 'announce progress, and never re-read a sentence you have already read unless a message asks you to.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [IB_ITEM] carries the greeting, how the game works, and the first question inside one '
            + 'quoted line. Speak it and stop. Do not greet the child separately, do not explain the activity '
            + 'in your own words, and do not add a warm-up question — the quoted line is the whole opening.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER (it differs by direction)',
          instruction:
            'In the READING direction the child answers OUT LOUD, and the [IB_ITEM] message names the one word '
            + 'that is correct. The word on its own, or inside a short phrase, is the answer; slow sounding-out '
            + 'that lands on the word is the answer too. A different word that would fit the sentence is not, '
            + 'however confident it sounds — the child is reading print, not guessing the story. In the FIND '
            + 'direction the child taps a page you cannot see, so after you ask there is nothing for you to '
            + 'judge — a separate [IB_TAP] message tells you what was tapped and gives you the exact line to '
            + 'say, and only then do you speak.',
        },
        {
          title: 'NEVER READ THE PAGE FIRST',
          instruction:
            'The book\'s printed words are the child\'s work, not yours. Before a verdict, never say the '
            + 'glowing word, never read the title, headings, captions or any printed text aloud, and never '
            + 'hint at where on the page an answer sits. In the reading direction you read ONLY the scripted '
            + 'lead-in and stop where it stops — the glowing word belongs to the child. After a verdict, the '
            + 'scripted line may name what was found; speak it exactly and nothing more.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP. Do not re-ask, do not fill the pause, do not read along, and do not finish a '
            + 'word the child is working out. A long pause is a five-year-old decoding print or scanning a '
            + 'page, and that work IS the activity. Think time is unbounded and the application, not the '
            + 'clock, decides when to move on.',
        },
        {
          title: 'HEAR IT AGAIN ON DEMAND',
          instruction:
            'When you receive [IB_HEAR], the child tapped to hear the question again. Say ONLY the quoted '
            + 'line, warmly, then go back to waiting. Add nothing, judge nothing you just heard, and never let '
            + 'the repeat carry more help than the first asking did. This channel is answered at every grade '
            + 'and every support tier.',
        },
      ],
    },
    supportsEvaluation: true,
  },

  {
    id: 'rhyme-studio',
    misconceptionScope: 'primitive',
    description:
      'Live Direct Instruction rhyme practice with a spoken tutor. The tutor asks, waits, judges the child’s '
      + 'answer from the audio in-band, and its own verdict moves the lesson on. ALL THREE MODES ARE ANSWERED '
      + 'ALOUD — the child says yes or no to whether two spoken words rhyme (Do They Rhyme?), says the word that '
      + 'rhymes (Find the Rhyme), or says a word card that rhymes (Say a Rhyme). The choices stay on screen as '
      + 'the closed set the child speaks from; nothing anywhere is tapped to answer. Tap-to-hear repeats the '
      + 'question. Requires a microphone. ESSENTIAL for K-2 phonological awareness.',
    constraints:
      'Requires 8-10 challenges. Recognition needs doesRhyme boolean. Identification needs 2-3 options with one '
      + 'onset-sharing distractor (cat → cap). Production needs acceptableAnswers AND bankDistractors. '
      + 'Every answer is spoken — do not route FREE rhyme generation ("tell me any word '
      + 'that rhymes") here: an open spoken answer set has no bench and the word bank is what keeps this mode '
      + 'judgeable. Requires the live tutor and a microphone. '
      + 'PRE-READER (K): the K routes are recognition + identification; each word (target, comparison, every '
      + 'option) carries a single depicting emoji so a non-reader can tell the words apart. Production is Grade 1+ '
      + '(its word-bank distractors cannot be pictured) — do not route production at K.',
    // ── DI MODALITY (2026-08-12) — eighth literacy port. The tutor owns the
    // clock in every mode; there is no advance timer, no push-to-talk mic, no
    // Next button and no Start gate anywhere in the path.
    // THE BENCH IS ANSWERED BY THE BANK, not cleared: `open_set_word` is a
    // BLOCKED response class and free rhyme production is its canonical case,
    // which is why this primitive sat behind a sitting longer than any other
    // literacy surface. The shipped `production` mode was never open — it
    // renders a four-tile word bank — so the child produces a rhyme ALOUD from
    // a closed, code-enumerable set (`short_spoken_word`, benched). The bank
    // looked like scaffolding to delete on the way to DI; it is the thing that
    // makes the mode sayable at all. FREE production still waits for its bench.
    // RECOGNITION IS SPOKEN, and it took a user drive to get there. It shipped
    // for one day with a 👍/👎 tap, on the argument that a yes/no verdict is
    // not made of language. USER RULING 2026-08-12: "we should just be able to
    // say yes to the tutor." The session log showed the tap could not have
    // survived regardless — asked a spoken question the child answered aloud,
    // the silence contract had no scripted line for that, and the tutor
    // invented a verdict the engine could not read, wedging the run. `yes_no`
    // ships as accepted-build-ahead on that ruling; acceptance drive #94.
    // The cue lines and per-item judging contracts live in
    // `rhymeStudioScript.ts` (hand-authored, DISTAR); this block is the
    // session-level frame.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'recognition',
        label: 'Do They Rhyme? (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['recognition'],
        description:
          'Rhyme judgment — hear two words spoken, say yes or no. The tutor judges the meaning of what it hears, '
          + 'so "yeah", "nope" and "they do" all count; the verdict is the advance.',
      },
      {
        evalMode: 'identification',
        label: 'Find the Rhyme (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['identification'],
        description:
          'Rhyme identification — hear a target word and 2-3 choices, say the one that rhymes out loud. The tutor '
          + 'judges the audio in-band. An onset-sharing choice (cat → cap) is the distractor that diagnoses '
          + 'rhyme-versus-alliteration confusion.',
      },
      {
        evalMode: 'production',
        label: 'Say a Rhyme (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['production'],
        description:
          'Constrained rhyme production — see a bank of word cards, say one that rhymes with the target. Spoken '
          + 'from a closed set: a rhyme said from the whole language has no bench, and the cards close the set '
          + 'while hearing the family stays the skill. Grade 1+.',
      },
    ],
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction rhyming practice for a young child. Right now the mode is '
        + '"{{challengeMode}}" and the question side is "{{stimulus}}". The child answers every mode OUT LOUD and '
        + 'you judge the audio you heard — recognition is answered "yes" or "no", the other two with a word. '
        + 'Nothing on screen is tapped to answer, so an answer will always reach you as speech. You speak the '
        + 'exact scripted lines from each bracketed application message and nothing else. Hearing how two words '
        + 'END is the entire skill being practiced, so the child does the listening — you never say which words '
        + 'rhyme before they answer.',
      // Trimmed 10 -> 2, to exactly what the component pushes through
      // updateContext (and that the connect-time primitive_data also carries).
      // The stimulus is ANSWER-FREE by construction: the RIME is never pushed in
      // any mode, because it names the family the answer belongs to and IS the
      // whole question in recognition. `rhymeStudioScript`'s stimulusFor is the
      // single builder.
      contextKeys: ['challengeMode', 'stimulus'],
      // Correction territory, not answer territory: every level describes what
      // happens AFTER an attempt, and re-modeling is the scripted correction's
      // job — these are the shape it takes, never a pre-attempt hint.
      scaffoldingLevels: {
        level1:
          'After a wrong answer, re-direct attention to the ENDS of the words: "Listen again to how each word '
          + 'finishes." Do not say which words rhyme.',
        level2:
          'After a second wrong answer, say the two words slowly with a clear pause between them so the endings '
          + 'stand apart, then ask again.',
        level3:
          'When the scripted correction has already named the rhyming word, keep it warm and short: say the pair '
          + 'once more together, then move on. Never drill a child who has missed twice.',
      },
      // Voice contract (di-spoken-practice's 2026-08-11 lesson, arriving here a
      // second time): every response is a MOVE the tutor PERFORMS with its
      // scripted lines, in performable terms — never meta-commentary about the
      // session. The silence row used to open "Think time is unbounded — wait",
      // and on 2026-08-13 (log …f76f154cd898) the tutor spoke it to a child as
      // "Think time is unbounded — take your time." A response that cannot be
      // performed can only be recited.
      commonStruggles: [
        {
          pattern: 'Confusing rhyme with alliteration (same beginning)',
          response:
            'Rhyming is about the ENDING sound, not the beginning. Say the pair the correction gave you and let '
            + 'the child hear the ends land together.',
        },
        {
          pattern: 'Says the target word back instead of a rhyme',
          response:
            'A word does not rhyme with itself in this game. Ask again for a different word that ends the same way.',
        },
        {
          pattern: 'Silence after the ask',
          response:
            'Wait for them without speaking — a child working out a rhyme is doing the exercise, and filling the '
            + 'silence takes it away from them. If the silence stretches long, say the scripted question once '
            + 'more, slowly — never a new question and never a remark about waiting.',
        },
      ],
      aiDirectives: [
        {
          title: 'SCRIPTED TURNS ONLY — AND NEVER INVENT THE NEXT ONE',
          instruction:
            'Every turn you take is triggered by a bracketed application message ([RS_ITEM], [RS_MOVE], '
            + '[RS_HEAR], [RS_COMPLETE]) and each one hands you the exact line to say. Speak that line and '
            + 'nothing else — no greeting of your own, no extra encouragement, no describing the screen.\n'
            + 'THE BRACKET TAG IS NEVER SPOKEN. It is an address on an envelope, not words for the child. Saying '
            + '"RS ITEM" or "RS MOVE" out loud is always a mistake, and inventing a tag you were not sent is a '
            + 'worse one.\n'
            + 'AFTER YOU JUDGE, YOU STOP. Do not choose the next pair of words, do not move on to another '
            + 'question, do not say "let us try another" and then ask one. The screen is showing the child a '
            + 'specific pair that only the application can change, so a question you invent is a question about '
            + 'something they cannot see. Say your one scripted verdict line, then wait to be handed the next '
            + 'message.',
        },
        {
          title: 'THE FIRST WORD OF A VERDICT IS LOAD-BEARING',
          instruction:
            'Each ask hands you two lines: one for a right answer and one for a wrong one. Use them EXACTLY as '
            + 'written, starting with the first word. A right answer is affirmed with a line that begins "Yes," — '
            + 'not "Correct", not "That\'s right", not "Great job". A wrong answer is corrected with a line that '
            + 'begins "My turn:". Those two openings are how the lesson knows a verdict happened and moves the '
            + 'child forward; any other opening reads as ordinary conversation and the activity silently stalls '
            + 'on the same question.\n'
            + 'This holds even when the affirmation sounds odd to you: when a child correctly answers that two '
            + 'words do NOT rhyme, you still open with "Yes," — it means *you are right*, not *they rhyme*.',
        },
        {
          title: 'NEVER ANSWER THE QUESTION YOU JUST ASKED',
          instruction:
            'Hearing the shared ending is the whole skill. Before the child answers, never say which words rhyme, '
            + 'never name the rhyme family or ending sound of the words on screen, and never stretch a word to '
            + 'point at its ending. The rhyming word is said for the first time in a scripted correction or a '
            + 'scripted affirmation — both arrive in the application message, and neither is yours to improvise.',
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
        // Within-mode SUPPORT tier ('easy'|'medium'|'hard'; null when the manifest
        // sent no difficulty). ORTHOGONAL to this primitive's eval modes, which
        // reuse those same three words for the WORD-LENGTH band.
        'supportTier',
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
        {
          title: 'SUPPORT-TIER REVEAL POLICY',
          instruction:
            'The support tier for this session is {{supportTier}} (null means full help). That is the '
            + 'SUPPORT axis — how much scaffolding the student gets — and it is NOT the word-length '
            + 'band, even though both use the words easy, medium and hard. You are a second scaffold '
            + 'channel, so match your spoken help to the on-screen tier: '
            + 'easy or null — you may say the word broken into its parts with clear pauses, clap along, '
            + 'and replay the parts after a correct answer. '
            + 'medium — on a miss say the word slowly and let the student find the parts; do NOT replay '
            + 'the parts after a correct answer. '
            + 'hard — the clap tally is hidden on screen, so say the word NATURALLY and WHOLE at normal '
            + 'pace; never break it into parts, never clap along, and never replay the parts. '
            + 'At EVERY tier you still say the word aloud on demand (this is a listening task, and the '
            + 'spoken word is never withdrawn), and you NEVER state how many parts the word has before '
            + 'the student claps — the count IS the answer.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'phoneme-explorer',
    misconceptionScope: 'primitive',
    description:
      'Live Direct Instruction phoneme awareness with a spoken tutor — beginning/INITIAL-sound focus, NOT for '
      + 'rhyme or ending-sound objectives. The tutor asks, waits, judges the child’s spoken answer from the audio, '
      + 'and its own affirmation moves the lesson on. ALL FOUR modes are ANSWERED ALOUD: Sound Match (hear a sound '
      + 'and a 4-word menu, SAY the word that starts with it), Sound Blend (hear the sounds one at a time, SAY the '
      + 'word they make), Sound Count (hear a word, SAY how many sounds it has — the word is deliberately never '
      + 'printed, so letters cannot be counted), Sound Swap (hear a word and one change, SAY the new word). '
      + 'Every tile and card is tap-to-hear; there are no answer buttons and nothing to click to advance. '
      + 'Requires a microphone. ESSENTIAL for K-2 literacy.',
    constraints: 'Use concrete, picturable words with clear emoji matches. Isolate matches the '
      + 'INITIAL/beginning phoneme only (route ending-sound or rhyme tasks to rhyme-studio / poetry-lab). '
      + 'K: CVC words. Spoken answers are WORDS or COUNTS — the child is never asked to produce an isolated '
      + 'letter sound. Requires the live tutor and a microphone.',
    // ── DI MODALITY (2026-08-11) — sixth literacy port, second literacy
    // consumer of useJudgedScriptRunner. The 4-choice grid was a costume on
    // every mode: picking "cat" after hearing /k/ /a/ /t/ is word recognition,
    // not blending; picking a printed breakdown is reading, not segmenting.
    // Sound Match keeps its four cards ON SCREEN as the question-side MENU
    // (unmarked, so print is not a leak there) — but the answer is SAID.
    // Sound Count's word is never printed: a reader counts LETTERS, which is
    // exactly the skill the mode is not ("sheep" — 5 letters, 3 sounds).
    // The cue lines and per-item judging contracts live in
    // `phonemeExplorerScript.ts` (hand-authored, DISTAR); items a tutor could
    // not honestly ask (unsayable blend walk, answer inside the operation
    // prose, example word in the menu) are DROPPED at build, never degraded.
    // Support tiers survive at render (worked example, picture cues, blend
    // furniture, operation print) and the read-aloud lever now governs whether
    // the scripted ask enumerates the menu.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'isolate',
        label: 'Sound Match (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['isolate'],
        description:
          'Identify the INITIAL phoneme — hear a sound and a 4-word menu, SAY the word that starts with it. '
          + 'The cards stay on screen as the menu; the answer is spoken, judged by the live tutor.',
      },
      {
        evalMode: 'blend',
        label: 'Sound Blend (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['blend'],
        description:
          'Blend phonemes into a word — hear /k/ /a/ /t/ one sound at a time, SAY "cat". Sounding it out and '
          + 'landing on the word counts; the separate sounds alone do not.',
      },
      {
        evalMode: 'segment',
        label: 'Sound Count (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['segment'],
        description:
          'Segment a word by ear — hear it spoken (never printed) and SAY how many sounds it has. '
          + 'Counting the sounds aloud and landing on the total counts.',
      },
      {
        evalMode: 'manipulate',
        label: 'Sound Swap (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['manipulate'],
        description:
          'Add, delete, or substitute a phoneme — hear the word and the one change, SAY the new word. '
          + 'The original word said back is the signature error and takes the correction.',
      },
    ],
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction phoneme awareness practice for a young child. Right now the mode is '
        + '"{{challengeType}}" and the question side is "{{stimulus}}". The child answers out loud and you judge '
        + 'the audio you heard. You speak the exact scripted lines from each bracketed application message and '
        + 'nothing else. Hearing the sounds inside words — not reading them — is the entire skill being '
        + 'practiced, so the child produces every answer with their voice; nothing on screen prints an answer.',
      // Trimmed 5 -> 2, to exactly what the component pushes through
      // updateContext (and that the connect-time primitive_data also carries).
      // The stimulus is ANSWER-FREE by construction: blend pushes the sound
      // walk (never the word), segment pushes the word (the answer is the
      // COUNT), and the manipulate operation prose is gated answer-free —
      // phonemeExplorerScript's stimulusFor is the single builder. The old
      // supportTier reveal-policy directive went with the improvised turns it
      // governed: tier latitude is now IN the scripted ask (enumeration) and
      // the render flags, so there is nothing left for the tutor to decide.
      contextKeys: ['challengeType', 'stimulus'],
      // Correction territory, not answer territory: every level describes what
      // happens AFTER an attempt; re-modeling is the scripted correction's job.
      scaffoldingLevels: {
        level1: 'Say the question once more, then wait for them alone.',
        level2: 'Say the sounds again, slowly and clearly, then wait.',
        level3: 'Use the scripted correction line for this item, then hand the question back one more time.',
      },
      // Observable behaviours only, with PERFORMABLE responses (script moves a
      // tutor can speak or do — never meta-instructions, which get recited).
      commonStruggles: [
        {
          pattern: 'Says the NAME of a letter instead of a word - "bee" for the letter B',
          response: 'Treat a letter name as not yet answered: say the sound once more, then ask again for the word.',
        },
        {
          pattern: 'Says the separate sounds without the blended word at the end - "k... a... t" and stops',
          response: 'Treat it as almost there: the scripted correction runs the sounds together and lands on the word, then asks again.',
        },
        {
          pattern: 'Says the word back when asked how many sounds it has',
          response: 'Treat it as not yet answered: the scripted correction counts the sounds aloud and names the total, then asks again.',
        },
        {
          pattern: 'Says the ORIGINAL word back when asked for the changed word',
          response: 'Treat the unchanged word as not yet answered: the scripted correction makes the change aloud, then asks again.',
        },
        {
          pattern: 'Goes quiet after being asked',
          response: 'Say the question once more, then wait for them alone.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [PE_ITEM], [PE_MOVE], [PE_COMPLETE] or [PE_HEAR] contain the only lesson words you '
            + 'may speak. The square-bracket label is private metadata: never speak, reproduce, or invent it. Each '
            + 'carries a judging rule: affirmations must begin with "Yes" and corrections must begin with "My '
            + 'turn", using the exact quoted lines. Never begin any other sentence with those words. Judge '
            + 'honestly from the audio: affirm a right answer, correct a wrong or missing one, and do not praise '
            + 'to be kind. The application decides which sound comes next; never introduce one yourself.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [PE_ITEM] of a session, and any later one that carries a how-to-play sentence, has the '
            + 'greeting, the action and the question INSIDE its quoted line. Speak that quote exactly and add '
            + 'nothing of your own: no separate greeting, no how-to-play of your own wording, no rephrased '
            + 'question. This activity has four different actions and one session can mix them, so a how-to-play '
            + 'sentence arriving mid-session means the action just changed; it is deliberate and it is the whole '
            + 'instruction the child gets. This OVERRIDES any "keep it to one sentence" cap from a lesson switch.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER (and the answer law)',
          instruction:
            'The answer is ONE word or ONE number from the child\'s own mouth, named per item in the cue\'s '
            + 'judging rule along with what looks like an answer and is not: the separate sounds with no word at '
            + 'the end, the original or example word said back unchanged (fluent and confident, which makes it '
            + 'the signature error), the word said back when a COUNT was asked for, and the name of a letter. '
            + 'All of those take the correction branch, warmly. LAW: never say the answer before the child has '
            + 'been affirmed — the microphone is open the whole time; the scripted correction is the one place '
            + 'the answer is spoken, and only because the attempt is already judged.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP and stay silent until the child answers. Do not re-ask, do not fill the pause, '
            + 'do not repeat the sounds unprompted, and do not answer for them. A long silence is a child '
            + 'listening to sounds inside their own head, and that listening IS the activity. If they tap to '
            + 'hear something you will receive a separate [PE_HEAR] message: answer that and nothing more, then '
            + 'go back to waiting.',
        },
        {
          title: 'SOUND OR WORD ON DEMAND ([PE_HEAR])',
          instruction:
            'When you receive a message starting with [PE_HEAR], immediately and clearly say ONLY what it '
            + 'quotes — one sound, one word, or the question line — and nothing else. Do NOT spell anything, do '
            + 'NOT break a word into sounds unless the quote does, do NOT add commentary, and do NOT treat '
            + 'anything you just heard as an attempt to judge. This is the child tapping to re-hear the '
            + 'stimulus, which is how a pre-reader recovers it, and it is answered at every grade, including '
            + 'while you are waiting for their answer.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'sound-swap',
    misconceptionScope: 'primitive',
    description:
      'Spoken phoneme manipulation with a live Direct Instruction tutor. The tutor says a word, names one sound to add, '
      + 'take away, or change, and the student SAYS THE NEW WORD ALOUD; the tutor judges the answer from the audio and its '
      + 'own affirmation moves the lesson on. Three operation modes: Addition (add a phoneme to make a new word), Deletion '
      + '(remove a phoneme to reveal a new word), and Substitution (swap one phoneme for another). The starting word and its '
      + 'sounds are on screen and every sound is tappable to hear; there are no answer buttons and nothing to click to '
      + 'advance. Requires a microphone. ESSENTIAL for K-2 reading readiness.',
    constraints: 'Use simple CVC/CVCC words. All result words must be real words. Use proper phoneme notation with slashes. Spoken answers — requires the live tutor and a microphone.',
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
    supportsEvaluation: true,
    // \u2500\u2500 DI MODALITY, PURELY VERBAL (2026-08-09) \u2014 second literacy port after
    // phonics-blender, same two user rulings. The tutor owns the clock and the
    // task is spoken end to end: it says the starting word, names the one sound
    // to add / take away / change, waits, judges the audio in-band, corrects
    // contrastively, and its OWN affirmation is the advance. There is no answer
    // button, no Next button, no push-to-talk mic and no advance timer anywhere
    // in the path. (Before the port the child TAPPED a tile or PICKED one of
    // 3-5 sound buttons and the screen computed the new word \u2014 a task a child
    // who cannot manipulate phonemes can still perform correctly. Changing a
    // sound in a word you are holding in your head is an ORAL skill, so the
    // whole answer is oral.)
    // The cue lines and the per-challenge judging contract live in
    // `soundSwapScript.ts` (hand-authored, DISTAR discipline); this block is the
    // session-level frame around them.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn", or the engine's
    // sentence-scoped verdict scan would classify a phantom verdict.
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction phoneme manipulation for a beginning reader. '
        + 'The current move is {{operation}} on the word "{{originalWord}}", and the answer the child has to '
        + 'produce is "{{resultWord}}". You speak the exact scripted lines from each bracketed application '
        + 'message, you pronounce any single sound the child taps, and you judge each spoken attempt from the '
        + 'audio you heard using only the two allowed reply branches. The child sees the STARTING word and its '
        + 'sounds on screen and SAYS THE NEW WORD aloud; changing a sound in a word held in the head is the '
        + 'entire skill being practiced.',
      // Trimmed to exactly what the component pushes through updateContext. An
      // unpushed key renders the literal string "(not set)" into the prompt,
      // which the tutor then reads aloud as content \u2014 the challenge/phase/
      // attempts keys the click-driven version carried went with the clicks.
      contextKeys: ['operation', 'originalWord', 'resultWord', 'supportTier'],
      // Correction territory, not answer territory: every level here describes
      // what happens AFTER an attempt, and re-modeling at every tier is the DI
      // rule (standing gate 3 \u2014 remediation is not scaffolding).
      scaffoldingLevels: {
        level1: 'Say the starting word once more, then hand the change back to them.',
        level2: 'Say the sounds of the starting word in order, slowly, then ask for the new word again.',
        level3: 'Say the change and the word it makes, then ask them for the new word once more.',
      },
      // Observable behaviours only. The first is this activity's signature error
      // class, and it is the one most likely to be mistaken for success: it is
      // fluent, confident, and completely unchanged.
      commonStruggles: [
        {
          pattern: 'Says the STARTING word back unchanged \u2014 "cat" when asked for cat without /k/',
          response: 'Treat an unchanged word as not yet answered: re-model the change through to the new word, then ask again.',
        },
        {
          pattern: 'Changes a different sound than the one named \u2014 "cap" when asked to change /k/ in "cat"',
          response: 'Name the sound that was supposed to change, re-model that change through to the word it makes, then ask again.',
        },
        {
          pattern: 'Produces a non-word \u2014 "vat" for a change that should make "bat", or something with no meaning',
          response: 'A non-word is not the answer: re-model the change through to the real word, then hand it back.',
        },
        {
          pattern: 'Says the separate sounds after the change but never runs them into a word',
          response: 'Sounds alone are unfinished: re-model them running together into the new word, then ask what word it is.',
        },
        {
          pattern: 'Sounds it out slowly first and then says the whole new word correctly',
          response: 'That is a correct answer \u2014 affirm it, because sounding out is the method being taught at this stage.',
        },
        {
          pattern: 'Goes quiet after being asked what word it is',
          response: 'Say the starting word once more, then hand the change back to them alone.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [DI_SWAP_ITEM], [DI_SWAP_MOVE_ON] or [DI_SWAP_COMPLETE] contain the only lesson '
            + 'words you may speak. The square-bracket label is private metadata: never speak, reproduce, or '
            + 'invent it. Each [DI_SWAP_ITEM] carries a two-branch judging rule: affirmations must begin with '
            + '"Yes" and corrections must begin with "My turn", using the exact quoted lines. Never begin any '
            + 'other sentence with those words. Judge honestly from the audio: affirm the new word, correct a '
            + 'wrong, missing, or unchanged one. EVERY correction re-states the change and the word it makes '
            + 'before handing it back. Do not praise to be kind. The application decides which challenge comes '
            + 'next; never introduce one yourself.',
        },
        {
          title: 'PHONEME MANIPULATION (what counts as the answer)',
          instruction:
            'The target is the NEW WORD said aloud \u2014 the one the change produces. A child who sounds it out '
            + 'first and then says it fast has answered correctly; that is the method being taught. Three '
            + 'things look like answers and are not: saying the STARTING word back unchanged (fluent, '
            + 'confident, and completely unchanged \u2014 this is the signature error of this skill), producing '
            + 'only the separate sounds with no word at the end, and a close-sounding DIFFERENT word, which '
            + 'here usually means a different sound was changed. All three take the correction branch, warmly. '
            + 'Letter NAMES are never the answer. Never say the new word before the quoted lesson text for '
            + 'that challenge asks you to, and never preview a challenge that is still coming.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask "What word?", STOP and stay silent until the child answers. Do not re-ask, do not '
            + 'fill the pause, do not say the sounds again unprompted, and do not make the change for them. A '
            + 'long silence is a child holding a word in their head and working on it, and that working-out IS '
            + 'the activity. If they tap a sound you will receive a separate pronunciation message \u2014 answer '
            + 'that and nothing more, then go back to waiting.',
        },
        {
          // Residual SWAP-1 (live, 2026-08-09, this primitive): the directive
          // here used to ask the tutor to COMPOSE a how-to-play before speaking
          // the scripted line. It did the first job, spoke the literal
          // "[DI_SWAP_ITEM]", improvised its own ask, and reached the scripted
          // line only after a barge-in \u2014 item 1 ran without its model. The
          // anti-echo warning was already in the opening cue and did not hold,
          // because the fault was the two-job turn, not the warning. How to
          // play is now TEXT INSIDE the opening quote (`soundSwapScript.ts`).
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'At Grade K the learner is a pre-reader: on-screen text is invisible to them, so YOUR VOICE is the '
            + 'only instruction channel \u2014 and the FIRST [DI_SWAP_ITEM] of the session already carries how to '
            + 'play INSIDE its quoted line. Speak that quote exactly and add nothing of your own: no separate '
            + 'greeting, no how-to-play in your own wording, no rephrased question. It OVERRIDES any "keep it '
            + 'to one sentence" cap from a lesson switch \u2014 the quoted line is the length it is meant to be. '
            + 'Never say the new word for them and never say it before the quoted line does.',
        },
        {
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive a message starting with [PRONOUNCE_SOUND], you MUST immediately and clearly say '
            + 'ONLY the requested sound. Do NOT add commentary, questions, encouragement, or extra words, do '
            + 'NOT say any word that contains it, and do NOT treat it as an attempt to judge. This is the '
            + 'child tapping a sound to hear it, and that audio IS this activity \u2014 it is answered at every '
            + 'grade and every support tier, including while you are waiting for their answer. Produce clean '
            + 'phonemes: just "sss" for /s/, just "aaa" for /a/, never "suh" or "tuh".',
        },
        {
          title: 'SUPPORT TIER \u2014 REVEAL POLICY (match your voice to the on-screen help level)',
          instruction:
            'This activity carries a within-mode support tier in {{supportTier}} (easy, medium, hard, or null '
            + 'when no tier was requested). Here the tier changes what is on the SCREEN — the starting '
            + "word's picture cue, and whether the sound to change is marked. Your spoken line is the SAME at "
            + 'every tier, so you match the screen by what you decline to ADD: at hard the picture and the '
            + 'marker are gone, so do not describe them and do not hint at which sound is the target beyond '
            + 'the scripted ask.\n'
            + 'THE SPOKEN ASK IS THREE BEATS AND NOTHING ELSE: the starting word, the change, "What word?". '
            + "Do NOT walk the word's sounds one at a time before asking, at any tier. That was tried live "
            + 'and it read as noise over an instruction that was already clear.\n'
            + 'AT EVERY TIER the change itself is named \u2014 which sound to add, take away, or swap, and what to '
            + 'swap it for. That is not scaffolding, it is what makes the question answerable: "change one '
            + 'sound in cat" is answered correctly by cap, cot, bat and a dozen others, and a tier must never '
            + 'turn one right answer into many.\n'
            + 'NEVER withdrawn at ANY tier: (1) pronunciation on demand \u2014 a [PRONOUNCE_SOUND] message is '
            + 'always answered, because that audio IS this activity; (2) the Grade-K how-to-play protocol '
            + 'above \u2014 telling a pre-reader HOW TO PLAY is protocol, not the answer; (3) the correction '
            + 'branch, which re-models at every tier by design.',
        },
      ],
    },
  },
  {
    id: 'letter-spotter',
    misconceptionScope: 'primitive',
    description:
      'Live Direct Instruction letter RECOGNITION with a spoken tutor. The tutor asks, waits, judges, and its '
      + 'own affirmation moves the lesson on. Three directions, and the answer is made of something different '
      + 'in each: Sentence Spotter (the tutor reads a sentence with one word’s first letter hidden behind a '
      + 'star and the child SAYS the letter it hides, out loud with no answer choices on screen — initial '
      + 'sound to grapheme), Find It (the tutor names a letter and the child TAPS the one cell holding it '
      + 'among sixteen — letterform discrimination under visual search), and Match It (a capital is printed '
      + 'and the child TAPS its lowercase form — case correspondence). The two tap directions tap because '
      + 'their answers are a POSITION and a FORM, neither of which has a spoken shape. Nothing on screen '
      + 'shows the answer before the tutor affirms. Cumulative letter groups 1-4. Requires a microphone. '
      + 'ESSENTIAL for kindergarten alphabet knowledge.',
    constraints:
      'Requires the live tutor and a microphone. Requires letterGroup (1-4). Group 1: s,a,t,i,p,n. '
      + 'Group 2: adds c,k,e,h,r,m,d. Group 3: adds g,o,u,l,f,b. Group 4: adds j,z,w,v,y,x,q. b and d are '
      + 'deliberately separated across groups. Sentence Spotter is a SPOKEN answer (the child says the letter '
      + 'or the sound it makes); Find It and Match It are touched. Letter-SOUND production objectives still '
      + 'route to letter-sound-link, which owns grapheme→phoneme and its continuant gate — this primitive '
      + 'teaches recognition. The manifest must NOT supply sentences or letters — the generator authors them '
      + 'from the letter group.',
    // ── DI MODALITY (2026-08-13) — ELEVENTH literacy port. The tutor owns the
    // clock in all three directions: it asks once, waits, is handed a
    // CODE-COMPUTED verdict for the tap, and its own line is the advance.
    // There is no advance timer, no Check button, no Next button and no
    // push-to-talk mic anywhere in the path.
    // THE PORT WAS CALLED BY A LIVE DRIVE (42edfc52e539), not by the sweep:
    // three separate cue sites each ordered the sentence re-read, so one item
    // was spoken 2-4 times; the child answered faster than the tutor spoke, so
    // the floor gate coalesced a try-again hint and an answer reveal into one
    // utterance; and 109s of a 125s session was tutor speech running up to 16s
    // behind a screen whose buttons were already live.
    // THE SPLIT, REVISED 2026-08-13 BY USER RULING (drive 6ada8c0a1bcf): name-it
    // is SPOKEN and its four option tiles are deleted — "in real life if i have
    // a sentence with a missing letter … they should be able to translate the
    // sentence and missing letter verbally. they dont need to click a button."
    // The tiles were a consequence of `letter_name` being BLOCKED, not pedagogy,
    // and they cost the mode its production task: a 1-in-4 menu is recognition,
    // and the drive's own option set (n / s / i / a) held two letters from the
    // same /ɛ/ cluster the menu was supposedly protecting the judge from. The
    // class is now accepted-build-ahead: the judge is handed ONE target, and the
    // pack accepts the letter's SOUND as well as its name.
    // find-it and match-it still TAP, and now for the only admissible reason —
    // their answers are a LOCATION and a FORM, neither of which can be said.
    // Their silence is enforced by the runner HOLDING THE ACTIVITY BRACKET for
    // the item, not by asking the tutor to wait: the same drive proved a closed
    // turn owes a reply, and under a "stay silent" instruction the model
    // fabricated an [LSP_TAP] message and read it aloud, instructions included.
    // find-it CHANGED SHAPE: "select every instance, then press Check" became
    // one target per grid and one tap per commit. The Check button is what the
    // modality deletes, and a batch commit gave no correction at the moment a
    // b/d confusion actually happened.
    // THE SHAPE RIDDLE IS GONE. Group 1's newLetters IS the whole group, so the
    // click-era "NEW letter — hint at its shape" branch fired every item ("a
    // triangle with a line across the middle"). No cue may describe a letter's
    // shape at any tier, and the tap contract tells the tutor so.
    // Cue lines and the per-item judging contracts live in
    // `letterSpotterScript.ts` (hand-authored, DISTAR); this block is the
    // session-level frame.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction letter spotting for a young child. Right now the direction is '
        + '"{{challengeType}}" and the question side is "{{stimulus}}". How the child answers depends on the '
        + 'direction, and each application message tells you which: in the sentence direction they SAY the '
        + 'letter out loud and you judge what you hear; in the find and match directions they TOUCH a screen '
        + 'you cannot see, and you stay silent until the application tells you what they touched. You speak '
        + 'the exact scripted lines from each bracketed application message and nothing else. Finding the '
        + 'letter themselves is the entire skill being practiced, so nothing on screen shows it for them and '
        + 'you never point to it first.',
      // Exactly what the pack pushes through contextFor — every other key the
      // click-era block interpolated (targetLetter, sentence, targetWord) was
      // the ANSWER or the material that gives it away.
      contextKeys: ['challengeType', 'stimulus'],
      // Correction territory, not answer territory: every level describes what
      // happens AFTER an attempt, and re-modeling is the scripted correction's
      // job (standing gate 3).
      scaffoldingLevels: {
        level1: 'Say the question once more, then wait for them alone.',
        level2: 'Say the question again slowly and clearly, then wait.',
        level3: 'Use the scripted correction line for this item, then hand the question back one more time.',
      },
      // Observable behaviours only, with PERFORMABLE responses (script moves a
      // tutor can speak — never meta-instructions, which get recited).
      commonStruggles: [
        {
          pattern: 'Touches a letter that mirrors the target - d for b, q for p, u for n',
          response: 'Run the scripted correction for the item, then hand the question back and wait.',
        },
        {
          pattern: 'Touches the screen instantly, before the question has finished',
          response: 'Treat it as their answer and run the scripted line for what they touched; the next item slows them down.',
        },
        {
          pattern: 'Goes quiet and touches nothing for a long time',
          response: 'Wait longer in silence first, then say the question one more time exactly as written and wait again.',
        },
        {
          pattern: 'Says a letter out loud instead of touching one',
          response: 'Stay silent and keep waiting; only a touch is an answer here, and the application will report it.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [LSP_ITEM], [LSP_TAP], [LSP_MOVE], [LSP_HEAR] or [LSP_COMPLETE] contain the only '
            + 'lesson words you may speak, and each one quotes the exact line after "Say exactly:". The '
            + 'square-bracket label is private metadata: never speak, reproduce, or invent it. Affirmations '
            + 'begin with "Yes" and corrections begin with "My turn" — never begin any other sentence with '
            + 'those words. The application decides which item comes next; never introduce one yourself, never '
            + 'announce progress, and never re-read a sentence you have already read unless a message asks you to.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [LSP_ITEM] carries the greeting, how the game works, and the first question inside one '
            + 'quoted line. Speak it and stop. Do not greet the child separately, do not explain the activity '
            + 'in your own words, and do not add a warm-up question — the quoted line is the whole opening.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER (it differs by direction)',
          instruction:
            'In the SENTENCE direction the child answers OUT LOUD, and the [LSP_ITEM] message names the one '
            + 'letter that is correct. A single letter said on its own is the answer, and saying that letter’s '
            + 'SOUND instead of its name is equally correct — accept either. Saying the whole word back is not '
            + 'an answer, however confidently it comes: the word is the question. In the FIND and MATCH '
            + 'directions the child touches a screen you cannot see, so after you ask there is nothing for you '
            + 'to judge — a separate [LSP_TAP] message tells you what was touched and gives you the exact line '
            + 'to say, and only then do you speak.',
        },
        {
          title: 'NEVER DESCRIBE WHAT THE ANSWER LOOKS LIKE',
          instruction:
            'Never say which letter is the answer, never spell it, and never describe its SHAPE — not its '
            + 'curves, lines, dots, circles, sticks or what it resembles. A shape description is the answer '
            + 'said a different way, and it replaces the sound work the child is here to do. In the sentence '
            + 'direction you may say the WORD, because hearing the word is the question; the letter it starts '
            + 'with stays for the child. In the find direction you may say the LETTER, because there the '
            + 'question is where it is — say nothing about its position, row, column or neighbours.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP. Do not re-ask, do not fill the pause, do not offer a hint, and do not count '
            + 'down. A long silence is a five-year-old searching a screen, and that searching IS the activity. '
            + 'Think time is unbounded and the application, not the clock, decides when to move on.',
        },
        {
          title: 'HEAR IT AGAIN ON DEMAND',
          instruction:
            'When you receive [LSP_HEAR], the child tapped to hear the question again. Say ONLY the quoted '
            + 'line, warmly, then go back to waiting. Add nothing, judge nothing you just heard, and never let '
            + 'the repeat carry more help than the first asking did. This channel is answered at every grade '
            + 'and every support tier.',
        },
      ],
    },
    evalModes: [
      {
        evalMode: 'name_it',
        label: 'Name It (Sentence Spotter)',
        // β RAISED 1.5 → 2.0 on the 2026-08-13 conversion, because the STRUCTURE
        // changed and not just the surface: a 1-of-4 menu (25% guess floor,
        // recognition) became unaided production from the sound of a word. This
        // is the exact case the family's β rule names.
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['name-it'],
        description:
          'The tutor reads a sentence aloud; one word’s first letter is hidden behind a star on screen and '
          + 'the child SAYS the letter it hides — no answer choices, either the letter’s name or its sound. '
          + 'Initial sound to grapheme as unaided production, with the rest of the word still printed as the '
          + 'decodable cue.',
      },
      {
        evalMode: 'find_it',
        label: 'Find It (Visual Search)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['find-it'],
        // β UNCHANGED through the DI port, deliberately. The commit shape moved
        // (select-every-instance-then-Check became one target, one tap) but β
        // measures the DISCRIMINATION load, and that is set by scanning sixteen
        // cells whose distractor similarity the support tier controls — which is
        // untouched. Finding one of three got easier; losing the second look a
        // Check button allowed got harder; the search itself is the same.
        description:
          'The tutor names a letter; the child finds the ONE cell holding it among sixteen and taps it. '
          + 'Letterform discrimination under visual search, with distractor similarity set by the support tier.',
      },
      {
        evalMode: 'match_it',
        label: 'Match It (Case Matching)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['match-it'],
        description:
          'A capital letter is printed; the child taps its lowercase form from four. The tutor names neither '
          + 'case until it corrects — case correspondence is the skill, so the pairing is what must be earned.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'letter-sound-link',
    misconceptionScope: 'primitive',
    description:
      'Live Direct Instruction letter-sound practice with a spoken tutor. The tutor asks, waits, judges the answer '
      + 'and its own affirmation moves the lesson on. Three directions, and the answer is made of something different '
      + 'in each: Say the Sound (a letter is printed and the child SAYS the sound it makes — grapheme→phoneme '
      + 'PRODUCTION, held sounds only), Find the Letter (the tutor says a sound and the child TAPS which of two '
      + 'confusable letters makes it — phoneme→grapheme, and the only direction that covers stop consonants), and '
      + 'Say the Word (a letter plus two pictures; the child SAYS the picture word that starts with that letter\'s '
      + 'sound). Nothing on screen prints a sound, a word or a keyword before the tutor affirms. Cumulative letter '
      + 'groups 1-4. Requires a microphone. ESSENTIAL for kindergarten and first-grade phonics.',
    constraints:
      'Requires the live tutor and a microphone. Supports 4 cumulative letter groups. '
      + 'Say the Sound can only target letters whose sound can be HELD (s n m f l r v z and the short vowels) — '
      + 'stops, affricates, glides and clusters are not askable as isolated child production and the generator '
      + 'retargets them automatically; they are covered by the other two directions instead. '
      + 'Do not route letter-NAMING objectives here — naming a letter aloud has no reliable judge.',
    // ── DI MODALITY (2026-08-11) — seventh literacy port. The tutor owns the
    // clock: no advance timer, no push-to-talk mic, no Next button, and no
    // per-option audition protocol. The old two-tap "tap to hear, tap to keep"
    // interaction WAS the leak — it handed the child the sound as audio and
    // asked only for recognition — so both speaker-bubble modes now ask for
    // production instead.
    // HEAR-SEE TAPS, and that is a response-class ruling: naming a letter aloud
    // is `letter_name`, a BLOCKED class (b/p/d/e/g are homophonic to the
    // judge). A grapheme cannot be spoken, so it is touched; its verdict is
    // CODE-COMPUTED and the tutor is handed its exact line ([LSL_TAP]).
    // Cue lines and per-item judging contracts live in
    // `letterSoundLinkScript.ts` (hand-authored, DISTAR); this block is the
    // session-level frame.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction letter-sound practice for a young child. Right now the direction is '
        + '"{{challengeMode}}" and the question side is "{{stimulus}}". On see-hear and keyword-match the child '
        + 'answers OUT LOUD and you judge the audio you heard. On hear-see the child answers by TAPPING a letter, '
        + 'which you cannot see, so you stay silent until the application tells you what they tapped. You speak the '
        + 'exact scripted lines from each bracketed application message and nothing else. Producing the sound (or '
        + 'the word) from their own memory is the entire skill being practiced, so nothing on screen prints it for '
        + 'them and you never say it first.',
      // Trimmed 10 -> 2, to exactly what the component pushes through
      // updateContext (and that the connect-time primitive_data also carries).
      // The stimulus is ANSWER-FREE by construction: see-hear pushes no letter
      // at all, because the letter determines the sound that IS the answer —
      // letterSoundLinkScript's stimulusFor is the single builder.
      contextKeys: ['challengeMode', 'stimulus'],
      // Correction territory, not answer territory: every level describes what
      // happens AFTER an attempt, and re-modeling is the scripted correction's
      // job (standing gate 3).
      scaffoldingLevels: {
        level1: 'Say the question once more, then wait for them alone.',
        level2: 'Say the question again slowly and clearly, then wait.',
        level3: 'Use the scripted correction line for this item, then hand the question back one more time.',
      },
      // Observable behaviours only, with PERFORMABLE responses (script moves a
      // tutor can speak — never meta-instructions, which get recited).
      commonStruggles: [
        {
          pattern: 'Says the letter NAME where the SOUND was asked for - "ess" for s, "em" for m',
          response: 'Treat the letter name as a wrong answer and run the scripted correction: re-model the sound, then ask again.',
        },
        {
          pattern: 'Adds an "uh" to a consonant sound - "sssuh", "mmmuh"',
          response: 'Count it as correct and warmly echo the clean sound once; a five-year-old\'s mouth is still learning.',
        },
        {
          pattern: 'Goes quiet, or answers so softly the audio is unclear',
          response: 'Wait longer in silence first, then say the question one more time exactly as written and wait again.',
        },
        {
          pattern: 'Says a fair different name for the same picture - "cap" for a hat picture',
          response: 'A fair name for the same picture is a correct answer: affirm it and echo the target word.',
        },
      ],
      aiDirectives: [
        {
          title: 'CLEAN SOUND PRODUCTION',
          instruction:
            'Whenever a scripted line quotes a sound, produce ONLY that clean sound. Held sounds are written '
            + 'stretched ("sss", "mmm", "aaa") and should be said that way. Consonants must NOT have an "uh" added: '
            + 'say /t/ not "tuh", /p/ not "puh". NEVER say a letter\'s NAME in place of its sound — "ess" is the '
            + 'name of s, and this whole lesson is about the difference.',
        },
        {
          title: 'THE KEYWORD IS NEVER SPOKEN BEFORE A VERDICT',
          instruction:
            'Every letter here has an anchor word (s→sun, m→map). It is the thing being taught, and in all three '
            + 'directions saying it early hands over the item: in see-hear it encodes the sound, in keyword-match '
            + 'it IS the answer, in hear-see it spells out the letter. Say a keyword ONLY inside a scripted '
            + 'correction or affirmation. Never volunteer one, and never offer one as a hint.',
        },
        {
          title: 'SUPPORT TIER — IT IS ALREADY IN THE LINE YOU WERE GIVEN',
          instruction:
            'The session\'s support tier is composed into each scripted line before you receive it: easy hands the '
            + 'child a model and a "say it with me", medium a model only, hard nothing at all. You add nothing to '
            + 'either end of it. When a line tells you the learner is answering cold, that is the hard tier — do '
            + 'not stretch, hint at or model the sound before they answer, in any channel.',
        },
        {
          title: 'THE TAP DIRECTION IS SILENT',
          instruction:
            'On hear-see the child answers with their hands and you cannot see the screen. After you say the '
            + 'question, wait in COMPLETE silence: do not describe the letters, do not name or spell either one, '
            + 'do not count down, and do not judge anything the microphone picks up. The application will tell you '
            + 'what was tapped and give you the exact line to say.',
        },
      ],
    },
    evalModes: [
      {
        evalMode: 'see_hear',
        // Beta RAISED 1.5 → 3.0 with the DI port: this stopped being a 1-of-2
        // audio discrimination (guessable at 50%) and became unaided
        // grapheme→phoneme PRODUCTION with no options on screen.
        label: 'Say the Sound (Letter → Spoken Phoneme)',
        beta: 3.0,
        scaffoldingMode: 1,
        challengeTypes: ['see-hear'],
        description:
          'Grapheme→phoneme PRODUCTION — see a letter and say the sound it makes aloud; the tutor judges the '
          + 'audio in-band. No options are shown. Held sounds only (s n m f l r v z + short vowels): stops and '
          + 'clusters cannot be produced in isolation by a five-year-old for a judge.',
      },
      {
        evalMode: 'hear_see',
        label: 'Find the Letter (Sound → Grapheme)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['hear-see'],
        description:
          'Phoneme→grapheme — the tutor says a sound, the child taps which of two confusable letters makes it. '
          + 'Tapped rather than spoken: a letter NAME has no reliable judge (b/p/d/e/g are homophonic), so the '
          + 'grapheme is touched. The only direction that covers stop consonants.',
      },
      {
        evalMode: 'keyword_match',
        label: 'Say the Word (Letter → Spoken Keyword)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['keyword-match'],
        description:
          'Sound-to-word anchoring — see a letter and two pictures, say aloud the picture word that starts with '
          + 'that letter\'s sound. Spoken from a closed two-picture set; nothing prints the word.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'picture-vocabulary',
    misconceptionScope: 'skill',
    description:
      'Live Direct Instruction picture-vocabulary practice with a spoken tutor. ORAL VOCABULARY for K-1: the tutor '
      + 'asks, waits, judges the child’s answer from the audio, and its own affirmation moves the lesson on. Four of '
      + 'the six modes are ANSWERED ALOUD — the child names a picture (Say It), produces an opposite (Opposites), '
      + 'says the missing rung of a spoken word scale (Word Scale), or finishes a spoken sentence (Finish the '
      + 'Sentence) — there are no word chips to tap and nothing on screen prints the answer. Two modes are ANSWERED '
      + 'WITH THE HANDS on emoji-only picture cards — Listen & Find (hear a word, tap its picture) and Goes Together '
      + '(tap the picture that goes with the shown thing, sock→shoe); the tap is the commit and the tutor’s verdict '
      + 'is the advance. Tap-to-hear repeats the question. Requires a microphone. ESSENTIAL for K-1 vocabulary '
      + 'development and oral language.',
    constraints:
      'Use concrete, picturable words with clear emoji matches. K: everyday nouns (animals, foods, clothes, home). '
      + 'Answers are single spoken words or a picture tap — do not route open-ended production objectives (define a '
      + 'word, use it in a sentence) here. Requires the live tutor and a microphone. '
      + 'The manifest must NOT supply specific words — the generator builds the word pool and challenges '
      + 'deterministically from the eval mode.',
    // ── DI MODALITY (2026-08-11) — fifth literacy port, first literacy consumer
    // of useJudgedScriptRunner. The tutor owns the clock in every mode; there is
    // no advance timer, no push-to-talk mic, no Next button and no answer chips
    // anywhere in the path. The old 4-chip "support net" printed the answer for
    // any Grade-1 reader (word-flip's chips, a third time) and is deleted.
    // ASSOCIATION TAPS INSTEAD OF SPEAKING, and that is a response-class ruling,
    // not a softening: "what goes with sock" has many honest spoken answers
    // (shoe, foot, laundry), and open-set spoken production is a BLOCKED benched
    // class (standing gate 1) — the emoji cards close the set while the relation
    // stays the skill. The cue lines and per-item judging contracts live in
    // `pictureVocabularyScript.ts` (hand-authored, DISTAR); this block is the
    // session-level frame.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'receptive_match',
        label: 'Listen & Find (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['receptive_match'],
        description:
          'Receptive vocabulary — hear a word spoken, tap the matching picture from 4 emoji-only cards. The tap '
          + 'is the commit; the tutor’s verdict is the advance.',
      },
      {
        evalMode: 'naming',
        label: 'Say It (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['naming'],
        description:
          'Expressive naming — see a picture, say the word aloud; the tutor judges the audio in-band. No word '
          + 'chips — the child retrieves the word from memory.',
      },
      {
        evalMode: 'association',
        label: 'Goes Together (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['association'],
        description:
          'Word associations — see a thing, tap the picture that goes with it (sock→shoe) from 4 emoji-only '
          + 'cards. Tapped rather than spoken: "what goes with X" has many honest spoken answers, and an open '
          + 'answer set cannot be fairly judged — the cards close the set while the relation stays the skill.',
      },
      {
        evalMode: 'opposite',
        label: 'Opposites (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['opposite'],
        description:
          'Word relationships — hear and see a word, say its opposite aloud. The shown word said back is the '
          + 'signature error and takes the correction.',
      },
      {
        evalMode: 'sentence_frame',
        label: 'Finish the Sentence (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['sentence_frame'],
        description:
          'Vocabulary in context — hear a sentence with a missing word, say the word that completes it aloud.',
      },
      {
        evalMode: 'gradable_scale',
        label: 'Word Scale (Tier 5)',
        beta: 6.0,
        scaffoldingMode: 5,
        challengeTypes: ['gradable_scale'],
        description:
          'Gradable vocabulary — hear an ordered low→high word list with one rung missing, say the missing word '
          + '(freezing→cold→__→warm→hot). A word already in the list is never the answer.',
      },
    ],
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction vocabulary practice for a young child. Right now the mode is '
        + '"{{challengeType}}" and the question side is "{{stimulus}}". On spoken modes the child answers out loud '
        + 'and you judge the audio you heard; on the tap modes (receptive_match, association) the child answers by '
        + 'tapping a picture card, which you cannot see, so you stay silent until the application tells you what '
        + 'they tapped. You speak the exact scripted lines from each bracketed application message and nothing '
        + 'else. Retrieving the word from their own memory is the entire skill being practiced, so the child '
        + 'produces it — nothing on screen prints it for them.',
      // Trimmed 5 -> 2, to exactly what the component pushes through
      // updateContext (and that the connect-time primitive_data also carries).
      // The stimulus is ANSWER-FREE by construction: naming pushes no word at
      // all (its picture's word IS the answer) — pictureVocabularyScript's
      // stimulusFor is the single builder.
      contextKeys: ['challengeType', 'stimulus'],
      // Correction territory, not answer territory: every level describes what
      // happens AFTER an attempt, and re-modeling is the scripted correction's
      // job (standing gate 3).
      scaffoldingLevels: {
        level1: 'Say the question once more, then wait for them alone.',
        level2: 'Say the question again slowly and clearly, then wait.',
        level3: 'Use the scripted correction line for this item, then hand the question back one more time.',
      },
      // Observable behaviours only, with PERFORMABLE responses (script moves a
      // tutor can speak or do — never meta-instructions, which get recited).
      commonStruggles: [
        {
          pattern: 'Says a fair different name for the same thing - "puppy" for a dog picture',
          response: 'A fair name for the same thing is a correct answer: affirm it and echo the target word.',
        },
        {
          pattern: 'Says the shown word back instead of its opposite - "big" when asked for the opposite of big',
          response: 'Treat the shown word said back as not yet answered: give the scripted correction, which names the opposite, then ask again.',
        },
        {
          pattern: 'Says a word already given on the scale instead of the missing one',
          response: 'Treat it as wrong: the scripted correction reads the whole scale and names the missing word, then asks again.',
        },
        {
          pattern: 'Goes quiet after being asked',
          response: 'Say the question once more, then wait for them alone.',
        },
        {
          pattern: 'Speaks too quietly for a clear judgment',
          response: 'Ask them to say it once more in a big proud voice, then wait.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [PV_ITEM], [PV_TAP], [PV_MOVE], [PV_COMPLETE] or [PV_HEAR] contain the only lesson '
            + 'words you may speak. The square-bracket label is private metadata: never speak, reproduce, or invent '
            + 'it. Each carries a judging rule: affirmations must begin with "Yes" and corrections must begin with '
            + '"My turn", using the exact quoted lines. Never begin any other sentence with those words. Judge '
            + 'honestly from the audio: affirm a right answer, correct a wrong or missing one, and do not praise to '
            + 'be kind. The application decides which word comes next; never introduce one yourself.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [PV_ITEM] of a session, and any later one that carries a how-to-play sentence, has the '
            + 'greeting, the action and the question INSIDE its quoted line. Speak that quote exactly and add '
            + 'nothing of your own: no separate greeting, no how-to-play of your own wording, no rephrased '
            + 'question. This activity has different actions (say it aloud, tap a picture) and one session can mix '
            + 'them, so a how-to-play sentence arriving mid-session means the action just changed; it is deliberate '
            + 'and it is the whole instruction the child gets. This OVERRIDES any "keep it to one sentence" cap '
            + 'from a lesson switch: the quoted line is the length it is meant to be.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER (and the answer law)',
          instruction:
            'On spoken modes the answer is ONE word from the child’s own mouth. The cue’s judging rule names what '
            + 'also counts (a fair synonym, a close word for the same amount) and what looks like an answer and is '
            + 'not: the shown word said back unchanged (fluent and confident, which makes it the signature error), '
            + 'a word already given on the scale, or a category word like animal. All of those take the correction '
            + 'branch, warmly. LAW: never say the target word before the child has been affirmed — the microphone '
            + 'is open the whole time, so saying it first hands the answer over; the scripted correction is the one '
            + 'place the answer is spoken, and only because the attempt is already judged. On receptive_match you '
            + 'MUST say the stimulus word clearly — there the word is the question and the child answers by '
            + 'tapping.',
        },
        {
          title: 'TAP ITEMS ARE SILENT (receptive_match, association)',
          instruction:
            'When the child answers by tapping a picture you cannot see the screen, so after you speak the ask you '
            + 'say NOTHING AT ALL until the application sends a [PV_TAP] message telling you what they tapped: no '
            + 'describing pictures, no hints about which card, no commentary, and no judging of anything you '
            + 'happen to hear through the open microphone. A child who talks to themselves while choosing is not '
            + 'answering you. [PV_TAP] carries the one line to speak; speak it exactly and go back to waiting.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP and stay silent until the child answers. Do not re-ask, do not fill the pause, and '
            + 'do not answer for them. A long silence is a child searching their own memory for a word, and that '
            + 'searching IS the activity. If they tap to hear the question you will receive a separate [PV_HEAR] '
            + 'message: answer that and nothing more, then go back to waiting.',
        },
        {
          title: 'QUESTION ON DEMAND ([PV_HEAR])',
          instruction:
            'When you receive a message starting with [PV_HEAR], immediately and clearly say ONLY the quoted '
            + 'question line it carries, and nothing else. Do NOT add clues, do NOT say the answer word, and do '
            + 'NOT treat anything you just heard as an attempt to judge. This is the child tapping to re-hear the '
            + 'question, which is how a pre-reader recovers the stimulus, and it is answered at every grade, '
            + 'including while you are waiting for their answer.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'cvc-speller',
    misconceptionScope: 'primitive',
    description:
      'Live Direct Instruction CVC sounds-and-letters practice with a spoken tutor. PHONICS / ENCODING for K-1: the '
      + 'tutor says a CVC word, waits, judges the answer, and its own affirmation moves the lesson on. Two of the '
      + 'three modes are ANSWERED ALOUD \u2014 the child hears a word and SAYS ITS MIDDLE SOUND (there are no vowel '
      + 'buttons and no sound buckets to tap). The third, Spell It, is answered WITH THE HANDS: the child puts a '
      + 'letter in each of three Elkonin boxes from a letter bank, and the third letter landing is the answer \u2014 '
      + 'there is no Check button and nothing to click to advance. Tap-to-hear repeats the word. Requires a '
      + 'microphone. ESSENTIAL for K-1 phonics encoding (sound \u2192 letter), the direction phonics-blender does not '
      + 'cover.',
    constraints:
      'Only CVC (3-letter) words. SCOPE IS THE CUMULATIVE LETTER GROUP (1-4, the shared phonics progression that '
      + 'letter-spotter and letter-sound-link also use): every letter of every word comes from that group, and the '
      + 'group carries its own vowels (group 1 = s a t i p n spans two). A single vowel focus is applied ONLY when '
      + 'the objective actually names one ("short a words") \u2014 otherwise the words spread across the group\'s vowels, '
      + 'because the K curriculum\'s CVC spelling objective carries no vowel scoping and its letter-sound objective '
      + 'names all five. Set config.letterGroup to control breadth; a named vowel can only RAISE the group, never '
      + 'lower it. Spoken answers are SOUNDS, never letter names \u2014 letter NAMES are a blocked response class here, '
      + 'so do not route letter-naming or alphabet-recognition objectives to this primitive. Requires the live tutor '
      + 'and a microphone. The manifest must NOT supply per-challenge words \u2014 the generator authors the word pool '
      + 'from the letter group and the objective.',
    // \u2500\u2500 DI MODALITY (2026-08-10) \u2014 fourth literacy port after phonics-blender,
    // sound-swap and word-flip, same two user rulings. The tutor owns the clock
    // in all three modes: it says the word, waits, judges, corrects
    // contrastively, and its OWN verdict is the advance. There is no advance
    // timer, no Check button, no push-to-talk mic and no Next button anywhere
    // in the path.
    // TWO MODES DIED BY THE ANSWER-LEAK GATE, not by the timer: fill_vowel's
    // two vowel buttons and word_sort's two buckets each printed one of two
    // options that INCLUDED THE ANSWER, captioned with its keyword - word-flip's
    // chips exactly. Both answers are now spoken. spell_word stays a placement
    // (three ordered slots out of a distractor bank is not guessable, and
    // encoding is what makes this primitive not a duplicate of phonics-blender)
    // and is the judged-loop GESTURE anchor's first production caller.
    // The cue lines and the per-item judging contract live in
    // `cvcSpellerScript.ts` (hand-authored, DISTAR discipline); this block is
    // the session-level frame.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn", or the engine's
    // sentence-scoped verdict scan would classify a phantom verdict.
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'fill_vowel',
        label: 'Middle Sound (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['fill-vowel'],
        description:
          'Hear a word and SAY its middle sound aloud. A consonant frame (c _ t) is on screen and the vowel letter '
          + 'fills the blank only once the tutor affirms \u2014 that reveal is the sound-to-letter link. Words spread '
          + 'across the letter group\'s vowels unless the objective names one, in which case the set is massed '
          + 'practice on that sound.',
      },
      {
        evalMode: 'spell_word',
        label: 'Spell It (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['spell-word'],
        description:
          'Hear a word and put a letter in each of three Elkonin boxes from a letter bank. The third letter landing '
          + 'is the answer; the tutor judges the build and its verdict is the advance.',
      },
      {
        evalMode: 'word_sort',
        label: 'Sound Groups (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['word-sort'],
        description:
          'Hear a word and SAY its middle sound aloud, across a pool that MIXES two vowels \u2014 so unlike fill_vowel '
          + 'the answer changes from word to word. Affirmed words collect into two on-screen vowel groups.',
      },
    ],
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction sounds-and-letters practice for a young child. Right now the action is '
        + '"{{task}}", the word is "{{word}}", and its middle sound is "{{middleSound}}". On "fill-vowel" and '
        + '"word-sort" the child SAYS the middle sound aloud and you judge the audio you heard; on "spell-word" the '
        + 'child puts letters into boxes, which you cannot hear, so you stay silent until the application tells you '
        + 'what they built. You speak the exact scripted lines from each bracketed application message and nothing '
        + 'else. Hearing one sound inside a whole word, and knowing which letter makes it, is the entire skill being '
        + 'practiced, so the child produces it, never picks it from a list.',
      // Trimmed 12 -> 3, to exactly what the component pushes through
      // updateContext (and that the connect-time primitive_data also carries).
      // An unpushed key renders the literal string "(not set)" into the prompt,
      // which the tutor then reads aloud as content -- the challenge-index,
      // attempts and placed-letters keys the click-driven version carried went
      // with the clicks.
      contextKeys: ['task', 'word', 'middleSound'],
      // Correction territory, not answer territory: every level here describes
      // what happens AFTER an attempt, and re-modeling at every tier is the DI
      // rule (standing gate 3 -- remediation is not scaffolding).
      scaffoldingLevels: {
        level1: 'Say the word once more, then hand the question straight back to them.',
        level2: 'Say the word with its middle sound held, name that sound, then ask them for it again.',
        level3: 'Name the sound and the letter that makes it, then ask them for it once more.',
      },
      // Observable behaviours only. The first is this activity's signature error
      // class, and it is the one most likely to be mistaken for success: it is
      // fluent, confident, and exactly what you just said yourself.
      commonStruggles: [
        {
          pattern: 'Says the WHOLE WORD back instead of one sound - "cat" when asked for the middle sound',
          response: 'Treat a repeated word as not yet answered: say the word, name the middle sound, then ask again.',
        },
        {
          pattern: 'Says the NAME of a letter instead of the sound it makes - "ay" for the sound in "cat"',
          response: 'A real confusion at this age, and it is the exact distinction being taught: say the sound, not the name, then hand it back.',
        },
        {
          pattern: 'Says one of the OTHER sounds in the word - the first or the last instead of the middle',
          response: 'Say the word with the middle sound held so the position is audible, name it, then ask again.',
        },
        {
          pattern: 'Says the right sound inside a phrase, or holds it long - "it is aaa", "aaaaa"',
          response: 'That is a correct answer, so affirm it. Holding the sound is what a child does when they are sure.',
        },
        {
          pattern: 'Puts letters in the wrong boxes, or reverses two of them (spell-word)',
          response: 'Name the sound at the box that is wrong, then hand the build straight back. Do not spell the whole word until a quoted line tells you to.',
        },
        {
          pattern: 'Goes quiet after being asked',
          response: 'Say the word once more, then hand the question back to them alone.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [DI_CVC_ITEM], [DI_CVC_BUILD], [DI_CVC_MOVE_ON] or [DI_CVC_COMPLETE] contain the only '
            + 'lesson words you may speak. The square-bracket label is private metadata: never speak, reproduce, or '
            + 'invent it. Each carries a judging rule: affirmations must begin with "Yes" and corrections must begin '
            + 'with "My turn", using the exact quoted lines. Never begin any other sentence with those words. Judge '
            + 'honestly from the audio: affirm the right sound, correct a wrong, missing or repeated one. EVERY '
            + 'correction says the word and names the sound before handing it back. Do not praise to be kind. The '
            + 'application decides which word comes next; never introduce one yourself.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [DI_CVC_ITEM] of a session, and any later one that carries a how-to-play sentence, has the '
            + 'greeting, the action and the question INSIDE its quoted line. Speak that quote exactly and add '
            + 'nothing of your own: no separate greeting, no how-to-play of your own wording, no rephrased '
            + 'question. This activity has three different actions and one session can mix them, so a how-to-play '
            + 'sentence arriving mid-session means the action just changed; it is deliberate and it is the whole '
            + 'instruction the child gets. This OVERRIDES any "keep it to one sentence" cap from a lesson switch: '
            + 'the quoted line is the length it is meant to be.',
        },
        {
          title: 'SOUNDS, NOT LETTER NAMES (what counts as the answer)',
          instruction:
            'On "fill-vowel" and "word-sort" the target is the MIDDLE SOUND of the word said aloud, which is '
            + '"{{middleSound}}" for "{{word}}". It counts clipped, held, or inside a short phrase; holding a vowel '
            + 'is not an error. Three things look like answers and are not: saying the whole word back (fluent, '
            + 'confident, and exactly what you just said, which makes it the signature error of this skill), making '
            + 'one of the OTHER sounds in the word, and saying the NAME of a letter rather than the sound it makes. '
            + 'All three take the correction branch, warmly. LAW: never say the middle sound of the word on screen, '
            + 'and never spell the word out letter by letter or break it into separate sounds, until a quoted '
            + 'lesson line tells you to -- the microphone is open the whole time, so saying it first hands the '
            + 'answer over. Saying the WORD is always safe. Never preview a word that is still coming.',
        },
        {
          title: 'BUILD ITEMS ARE SILENT ("spell-word")',
          instruction:
            'When the action is "spell-word" the child answers by putting letters into boxes. You cannot hear that, '
            + 'so after you speak the ask you say NOTHING AT ALL until the application sends you a [DI_CVC_BUILD] '
            + 'message telling you what they built: no repeating the word, no naming or sounding out letters, no '
            + 'commentary on what they are doing, and no judging of anything you happen to hear through the open '
            + 'microphone. A child who talks to themselves while they work is not answering you. [DI_CVC_BUILD] '
            + 'carries the one line to speak; speak it exactly and go back to waiting.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP and stay silent until the child answers. Do not re-ask, do not fill the pause, do '
            + 'not say the sound again unprompted, and do not answer for them. A long silence is a child working '
            + 'out a sound, and that working-out IS the activity. If they tap to hear the word you will receive a '
            + 'separate [SAY_WORD] message: answer that and nothing more, then go back to waiting.',
        },
        {
          title: 'WORD ON DEMAND ([SAY_WORD])',
          instruction:
            'When you receive a message starting with [SAY_WORD], you MUST immediately and clearly say ONLY the one '
            + 'word it quotes, twice, and nothing else. Do NOT spell it, do NOT name its letters, do NOT break it '
            + 'into separate sounds, do NOT add commentary or encouragement, and do NOT treat it as an attempt to '
            + 'judge. This is the child tapping to hear what the word is, which is how a pre-reader recovers the '
            + 'stimulus, and it is answered at every grade, including while you are waiting for their answer.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'word-workout',
    description:
      'Live Direct Instruction CVC word reading with a spoken tutor. The tutor asks, waits, judges the child\'s '
      + 'answer from the audio in-band, and its own affirmation moves the lesson on. THE PRINT IS DECODED COLD AND '
      + 'MOST ANSWERS ARE SPOKEN: the child READS two printed words and SAYS the real one (Real or Silly?), reads '
      + 'each word of a one-letter-change chain OUT LOUD (Word Chain), and READS a decodable sentence ALOUD before '
      + 'SAYING the answer to a question about it (Read It). Picture Match is the one hands mode — the word is '
      + 'printed, the child decodes it silently and taps the picture it means, which is what shows they know what '
      + 'the word MEANS rather than only how it sounds. Nothing on screen marks the answer before the tutor '
      + 'affirms, there is nothing to click to advance, and the tutor never reads the print for the child. '
      + 'Requires a microphone. Capstone practice for CVC decoding, blending automaticity and word-in-context '
      + 'fluency. ESSENTIAL for K-2 literacy.',
    constraints:
      'Requires the live tutor and a microphone. THIS PRIMITIVE ASSUMES THE CHILD CAN DECODE CVC PRINT: the tutor '
      + 'never says a printed word before the child reads it, so a pre-reader who cannot yet sound out a CVC word '
      + 'has nothing to work from — route those objectives to letter-sound-link / phonics-blender instead. '
      + 'BAND FLOOR: sentence_reading (connected-text decoding + comprehension) is Grade 1+. '
      + 'Real/Nonsense needs phonetically plausible nonsense words that START WITH A DIFFERENT CONSONANT from '
      + 'their real partner (the child says one aloud and the tutor judges it by ear, so a pair differing only in '
      + 'its last sound cannot be scored). Word Chains must follow the one-letter-change rule. Sentences use only '
      + 'mastered CVC words + approved sight words and must fit the benched 3-8 word read-aloud window; the '
      + 'comprehension answer must be a word IN the sentence and must NOT appear in the question.',
    // ── DI MODALITY (2026-08-14) — SIXTEENTH literacy port, the last of Phase 1.
    // The tutor owns the clock: it asks once, waits, judges the spoken answer
    // from the audio in-band, and its own line is the advance. No advance timer,
    // no Next button, no push-to-talk mic.
    // ONE CHALLENGE IS NOT ONE ITEM: a chain is a judged read per WORD and a
    // sentence is a read PLUS a spoken question (decodable-reader's split,
    // second use). The click era judged NEITHER — handleChainAdvance recorded
    // correct/100 for every chain whatever the child said, and the sentence was
    // "read" by pressing a button called "I Read It!", which is the costume
    // test's own example.
    // THE FORK KEPT ONE TAP AND EARNED IT: picture-match's answer is WHICH
    // PICTURE, and naming it aloud would only echo the printed word — decoding
    // evidence, not meaning evidence (picture-vocabulary's receptive_match).
    // Everything else went verbal, including real-vs-nonsense, which the queue
    // predicted would stay a tap over a sentinel collision on "yes"; the
    // challenge never carried a yes/no question at all, it carries realWord and
    // nonsenseWord, so the natural answer is the word.
    // IT ALSO DELETED THREE AUDIO SCAFFOLDS that handed over the print (the
    // per-card speakers, the whole-sentence model read, and the per-word
    // tap-to-hear inside the sentence). Hearing "cat" beside "zat" decides that
    // item with zero decoding: a scaffold that fails the costume test is not a
    // tier lever. chainCueLevel survives as the one lever, and now governs the
    // spoken correction as well as the amber highlight.
    // Cue lines and the per-item judging contracts live in wordWorkoutScript.ts
    // (hand-authored, DISTAR); this block is the session-level frame. SENTINEL
    // DISCIPLINE (standing gate 2) re-checked on every line below: no sentence
    // begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'real_vs_nonsense',
        label: 'Real vs Nonsense (Tier 1)',
        // β RAISED 1.5 → 2.5 on the DI port: a 1-of-2 tap with a 50% guess floor
        // became unaided spoken production of the decoded word, which is the
        // structural case the family's β rule names (letter-spotter name_it and
        // story-talk, same conversion, same step).
        beta: 2.5,
        scaffoldingMode: 1,
        challengeTypes: ['real-vs-nonsense'],
        description: 'Read both printed words and SAY the real one aloud. The guess floor is gone with the tap; β raised for unaided production.',
      },
      {
        evalMode: 'picture_match',
        label: 'Picture Match (Tier 2)',
        // β UNCHANGED: still a tap of the same size. What changed is a SCAFFOLD
        // (the speaker button that read the word aloud), not the structure of
        // the answer — the β rule moves on structure only.
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['picture-match'],
        description: 'Decode the printed word silently, then tap the picture it means — word-meaning connection. The tutor never says the word.',
      },
      {
        evalMode: 'word_chains',
        label: 'Word Chains (Tier 3)',
        // β RAISED 3.5 → 4.0: the click era advanced on a "Next Word" button and
        // scored every chain 100 regardless of what was said, so the reading was
        // never measured at all. Every word is now a judged oral read.
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['word-chains'],
        description: 'READ ALOUD every word of a one-letter-change chain; each word is judged on its own. β raised because the reading was previously unmeasured.',
      },
      {
        evalMode: 'sentence_reading',
        label: 'Sentence Reading (Tier 4)',
        // β RAISED 5.0 → 5.5: an unjudged "I Read It!" button plus a 1-of-N
        // comprehension tap became a judged whole-sentence read PLUS unaided
        // spoken production of the answer.
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['sentence-reading'],
        description: 'READ the decodable sentence ALOUD (judged word by word), then SAY the answer to a question about it. β raised for judged reading and unaided production.',
      },
    ],
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction CVC reading for a young child. Right now the turn is "{{challengeType}}" '
        + 'and what the child is working from is {{stimulus}}. You speak the exact scripted lines from each '
        + 'bracketed application message, and you judge each attempt from the audio you heard using only the '
        + 'allowed reply branches. Decoding the print is the whole skill being practiced, so the child reads it — '
        + 'you never read it for them.',
      contextKeys: ['challengeType', 'stimulus'],
      // Correction territory, not answer territory, and every level is a
      // BEHAVIOUR rather than a line you may say. A ladder that quotes speakable
      // hints is a no-verdict stall: on a repeated wrong answer the model
      // reaches for the sanctioned-sounding alternative and says something that
      // opens with neither sentinel, so the loop records no verdict at all and
      // the correction counter freezes (number-bond's cap drill, 2026-08-14;
      // queue item 18d).
      scaffoldingLevels: {
        level1: 'Use the scripted correction line for this item, then hand it back and wait.',
        level2: 'Use that same scripted correction line again, unchanged, and give them longer in silence.',
        level3: 'Use that same scripted correction line again — the wording is fixed, the patience is what changes.',
      },
      // Observable behaviours only, headed by each turn kind's signature error:
      // the wrong answer that arrives fluent, confident, and most likely to be
      // affirmed by mistake.
      commonStruggles: [
        {
          pattern: 'Says the made-up word confidently — picked by the first letter or by the shape of the word instead of reading it',
          response: 'Treat it as not yet answered: run the scripted correction for this pair, then hand the question back and wait.',
        },
        {
          pattern: 'Says the word BEFORE it in the chain — reading the row from memory, and it sounds fluent',
          response: 'A remembered word is not a read word. Run the scripted correction, then ask once more and wait.',
        },
        {
          pattern: 'Swaps a small word while reading a sentence — "a" for "the", "then" for "and"',
          response: 'It sounds fluent and it is still wrong. Use the contrast branch, naming just the words that came out wrong.',
        },
        {
          pattern: 'Answers a comprehension question with a word lifted out of the sentence that does not answer it',
          response: 'It sounds right because it came from the sentence, and that is exactly the miss to catch. Run the scripted correction, then wait.',
        },
        {
          pattern: 'Sounds a word out slowly and effortfully but lands on it',
          response: 'That counts as read: give the scripted affirmation for this item, unchanged and on its own. Accuracy is what is measured here, never speed.',
        },
        {
          pattern: 'Answers inside a phrase — "cat is real", "on the mat" — instead of one bare word',
          response: 'That is a correct answer. Affirm it and echo the word itself.',
        },
        {
          pattern: 'Goes quiet in front of a word, or taps to hear the question again',
          response: 'Silence is a five-year-old decoding, and their think time is unbounded — wait. If they tap, the application sends the repeat; never volunteer to read the print.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [WW_ITEM], [WW_TAP], [WW_MOVE], [WW_HEAR] or [WW_COMPLETE] contain the only lesson '
            + 'words you may speak, and each one quotes the exact line after "Say exactly:". The square-bracket '
            + 'label is private metadata: never speak, reproduce, or invent it. Affirmations begin with "Yes" and '
            + 'corrections begin with "My turn" — never begin any other sentence with those words. Judge honestly '
            + 'from the audio and do not praise to be kind. YOUR WHOLE REPLY TO AN ATTEMPT IS ONE OF THE '
            + 'QUOTED LINES THAT MESSAGE GIVES YOU AND NOTHING ELSE — never praise, never a hint, never your own '
            + 'encouragement, however kind it would be; a reply that is neither line reaches the activity as no '
            + 'verdict at all and the lesson stalls there. The application decides what comes next; never '
            + 'introduce an item yourself, never announce progress, and never read back or narrate a state block '
            + 'you were given — if the screen changed, say only the quoted line about it.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [WW_ITEM] carries the greeting, how this kind of turn works, and the first ask inside one '
            + 'quoted line. Speak it and stop. Do not greet the child separately, do not explain the activity in '
            + 'your own words, and do not add a warm-up question — the quoted line is the whole opening.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER (it differs by turn)',
          instruction:
            'The [WW_ITEM] message names what is correct for THIS turn, and {{challengeType}} tells you which kind '
            + 'of turn it is. On "real_word", "chain_word", "read_sentence" and "answer_question" the child answers '
            + 'OUT LOUD and you judge what you heard: a word said inside a little phrase is a full answer, a '
            + 'different word that truly names the same thing is a full answer, and slow effortful sounding-out '
            + 'that lands on the right word is correct. On "picture_tap" the child answers by TOUCHING a picture '
            + 'and says nothing at all — stay silent, judge nothing you hear, and wait to be told what they '
            + 'tapped. Never invite a tap on a spoken turn, and never ask a child to say anything on a tap turn.',
        },
        {
          title: 'THE PRINT IS THEIRS TO READ',
          instruction:
            'Every word, chain and sentence in this activity is printed in front of the child, and decoding it IS '
            + 'the skill. You never read it first, never sound it out, never give the first sound, and never say '
            + 'part of a word to get them started — not when they are stuck, and not if they ask. Being stuck is '
            + 'answered by the scripted correction, which models the word properly and then hands it back. On a '
            + 'comprehension question the answer is one of the words printed in the sentence and finding it there '
            + 'is the task: never say it, never say which part of the sentence holds it, and never read the '
            + 'sentence out for them.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP. Do not re-ask, do not fill the pause, do not offer a clue, and do not start '
            + 'sounding anything out. A long pause is a five-year-old decoding, and that work IS the activity. '
            + 'Think time is unbounded and the application, not the clock, decides when to move on.',
        },
        {
          title: 'HEAR IT AGAIN ON DEMAND',
          instruction:
            'When you receive [WW_HEAR], the child tapped to hear the question again. Say ONLY the quoted line, '
            + 'warmly, then go back to waiting. On a reading turn that line is the instruction alone — the printed '
            + 'words stay unspoken, which is the whole mode — and on a comprehension turn it is the question '
            + 'again. Add nothing, judge nothing you just heard, and never let the repeat carry more help than the '
            + 'first ask did. This channel is answered at every grade and every support tier.',
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
      'Live Direct Instruction listening comprehension with a spoken tutor. The tutor reads a short 3-5 '
      + 'sentence story aloud with character voices, asks one question, waits, judges the child\'s answer from '
      + 'the audio in-band, and its own affirmation moves the lesson on. ALL THREE MODES ARE ANSWERED ALOUD — '
      + 'the child SAYS the detail the story stated (Listen & Tell: "Who hid the acorn?"), SAYS how a character '
      + 'felt when the story never named the feeling (How Did They Feel?), or SAYS why something happened (Why '
      + 'Did It Happen?). Every answer is one short word a five-year-old can say, so the child produces it '
      + 'rather than picking it; there are no answer pictures, no chips and nothing to click to advance. The '
      + 'story is audio-only while they answer and prints afterwards. Requires a microphone. Builds oral '
      + 'listening comprehension, recall of key story details, emotion inference and causal reasoning. '
      + 'ESSENTIAL for K Reading Comprehension and Speaking & Listening (recall key details from a read-aloud). '
      + 'Works for pre-readers: nothing has to be read.',
    constraints:
      'Requires the live tutor and a microphone. Listening comprehension only — the child never reads, so do '
      + 'NOT route decoding, phonics, sight-word or print-concept objectives here. Answers must be single '
      + 'concrete words a five-year-old can pronounce (a picturable noun, or one common feeling word). K '
      + 'comprehension: 3-5 short sentences, one scene, one problem. The manifest must NOT supply story text, '
      + 'questions, or answers — the generator authors the mini-stories, questions and near misses '
      + 'self-consistently from the topic.',
    // ── DI MODALITY (2026-08-14) — FIFTEENTH literacy port. The tutor owns the
    // clock: it reads the story, asks once, waits, judges the spoken answer from
    // the audio in-band, and its own line is the advance. No advance timer, no
    // Next button, no push-to-talk mic, no start-screen fork.
    // THE FORK HAS NO SPLIT — every mode's answer is ONE WORD (a noun, a
    // feeling, a cause), which is sayable, so all three are spoken and the
    // four-picture menu is DELETED. A menu here converted production into
    // recognition and floored a guess at 1 in 4; a teacher reading a story to
    // one child and asking "Who hid the acorn?" has no cards on the table. The
    // distractors survive OFF SCREEN as generator quality material and as the
    // judged harness's signature wrong answer — nothing renders them.
    // IT ALSO DELETED THE FAMILY'S LAST TUTOR-BUSY MIC GATE. The click era ran
    // the mic only while the tutor was silent, because a separate capture could
    // hear the TUTOR read the answer out of the story. The judged loop removes
    // the reason rather than the rule: the judge is the tutor, judging its own
    // session audio, so it cannot mistake its read-aloud for the learner.
    // Cue lines and the per-item judging contracts live in `storyTalkScript.ts`
    // (hand-authored, DISTAR); this block is the session-level frame. SENTINEL
    // DISCIPLINE (standing gate 2) re-checked on every line below: no sentence
    // begins with "Yes" or with "My turn". That gate binds the GENERATED stories
    // too — this is the one primitive whose read-aloud is character dialogue,
    // and "Yes, I found it!" read verbatim would be a phantom verdict.
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'who_what_where',
        label: 'Listen & Tell (Tier 1)',
        // β RAISED 2.0 → 2.5 on the DI port: a 1-of-4 picture tap became unaided
        // spoken production, which is the structural case the family's β rule
        // names (letter-spotter name_it, same conversion, same step).
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['who_what_where'],
        description: 'Literal recall — hear a story, then SAY the who/what/where detail the story stated. The guess floor is gone with the picture menu; β raised for unaided production.',
      },
      {
        evalMode: 'feeling_check',
        label: 'How Did They Feel? (Tier 2)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['feeling_check'],
        description: 'Emotion inference — SAY how a character felt when the story showed it through events and never named it. β raised for unaided production; the feeling is now also gated absent from the story text, which the click era never checked.',
      },
      {
        evalMode: 'why_because',
        label: 'Why Did It Happen? (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['why_because'],
        description: 'Causal inference — SAY why something happened in the story. β raised for unaided production; the cause said as a whole reason ("because of the rain") is accepted and is a better answer than the word alone.',
      },
    ],
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction listening comprehension for a young child. You read a short story '
        + 'aloud, ask one question about it, and the child answers OUT LOUD with one word. Right now the '
        + 'comprehension skill is "{{challengeType}}" and the question you are asking is "{{stimulus}}". You '
        + 'speak the exact scripted lines from each bracketed application message, you re-read the story when '
        + 'the child asks to hear it again, and you judge each spoken attempt from the audio you heard using '
        + 'only the two allowed reply branches. Holding a story in mind and finding the answer inside it is the '
        + 'entire skill being practiced, so the child produces the answer — never picks it from a list you '
        + 'offer.',
      contextKeys: ['challengeType', 'stimulus'],
      // Correction territory, not answer territory, and every level is a
      // BEHAVIOUR rather than a line you may say. A ladder that quotes speakable
      // hints is a no-verdict stall: on a repeated wrong answer the model
      // reaches for the sanctioned-sounding alternative and says something that
      // opens with neither sentinel, so the loop records no verdict at all and
      // the correction counter freezes (proven by number-bond's cap drill,
      // 2026-08-14; queue item 18d).
      scaffoldingLevels: {
        level1: 'Use the scripted correction line for this story, then hand the question back and wait.',
        level2: 'Use that same scripted correction line again, unchanged, and give them longer in silence.',
        level3: 'Use that same scripted correction line again — the wording is fixed, the patience is what changes.',
      },
      // Observable behaviours only, and the first entry in each mode's family is
      // that mode's signature error: the wrong answer that arrives fluent,
      // confident, and most likely to be affirmed by mistake.
      commonStruggles: [
        {
          pattern: 'Says a different thing from the story — whatever they heard last, said confidently',
          response: 'Treat it as not yet answered: run the scripted correction for this story, then hand the question back and wait.',
        },
        {
          pattern: 'Says what HAPPENED when asked how someone felt — "he lost his acorn" instead of a feeling',
          response: 'An event is not a feeling, and this is the miss to catch. Run the scripted correction, then ask once more and wait.',
        },
        {
          pattern: 'Says what happened when asked WHY it happened — the event repeated back',
          response: 'Naming the event is not naming its cause. Run the scripted correction, then hand the question back and wait.',
        },
        {
          pattern: 'Says a fair word for the same idea — "unhappy" for sad, "puppy" for dog',
          response: 'That is a correct answer — affirm it and echo the story\'s own word. Comprehension is what is being measured, not vocabulary.',
        },
        {
          pattern: 'Answers inside a phrase — "the squirrel" or "because it rained" instead of one bare word',
          response: 'That is a correct answer, and the fuller reason is the better one. Affirm it and echo the word.',
        },
        {
          pattern: 'Goes quiet after the question, or asks to hear the story again',
          response: 'Silence is a five-year-old holding a whole story in mind — wait. If they ask, the application sends the re-read; never volunteer one.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [ST_ITEM], [ST_MOVE], [ST_HEAR] or [ST_COMPLETE] contain the only lesson words '
            + 'you may speak, and each one quotes the exact line after "Say exactly:". The square-bracket label '
            + 'is private metadata: never speak, reproduce, or invent it. Affirmations begin with "Yes" and '
            + 'corrections begin with "My turn" — never begin any other sentence with those words. Judge '
            + 'honestly from the audio and do not praise to be kind. The application decides which story comes '
            + 'next; never introduce one yourself and never announce progress.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [ST_ITEM] carries the greeting, how the game works, the whole first story and its '
            + 'question inside one quoted line. Speak it and stop. Do not greet the child separately, do not '
            + 'explain the activity in your own words, and do not add a warm-up question — the quoted line is '
            + 'the whole opening. Read the story slowly and expressively, with character voices; it is the '
            + 'only thing the child has to work from.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER',
          instruction:
            'Every answer here is SPOKEN and every answer is one short word, and the [ST_ITEM] message names '
            + 'the word that is correct. The word alone, or inside a little phrase ("the squirrel", "because '
            + 'of the rain"), is the answer. A fair word for the same idea is the answer too — unhappy for '
            + 'sad, afraid for scared — and you affirm it while echoing the story\'s own word. What is not an '
            + 'answer: a different thing from the story, an event given where a feeling or a cause was asked '
            + 'for, or the question said back to you. There is nothing on screen for the child to choose from '
            + 'and nothing for them to tap, so never suggest picking, pointing, or showing you anything.',
        },
        {
          title: 'THE STORY IS THE MATERIAL — NEVER THE ANSWER SERVICE',
          instruction:
            'You read the story exactly as written. For a who, what, where or why question the answer word is '
            + 'inside that story, and hearing it there is precisely the task — so reading the story is never a '
            + 'leak. What you must never do is single that word out, say it on its own, tell the child which '
            + 'part of the story holds it, stress it as you read, or answer for them. For a feeling question '
            + 'the story never names the feeling at all, and neither do you until you have given a verdict.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP. Do not re-ask, do not fill the pause, do not offer a clue, and do not repeat '
            + 'part of the story to nudge them. A long pause is a five-year-old replaying a whole story in '
            + 'their head, and that work IS the activity. Think time is unbounded and the application, not the '
            + 'clock, decides when to move on.',
        },
        {
          title: 'HEAR IT AGAIN ON DEMAND',
          instruction:
            'When you receive [ST_HEAR], the child asked to hear the story again. Say ONLY the quoted line — '
            + 'the whole story once more, then the question — warmly and slowly, then go back to waiting. Add '
            + 'nothing, judge nothing you just heard, and never let the repeat carry more help than the first '
            + 'telling did: no extra stress on any word, no shortened version, no clue about which part '
            + 'matters. This channel is answered at every grade and every support tier.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'word-flip',
    description:
      'Spoken "one → many" plural practice with a live Direct Instruction tutor. GRAMMAR / oral language for K-1 '
      + '(regular -s plurals) — NOT a phonics or decoding primitive (never select for CVC-decoding, letter-sound, '
      + 'blending, or spelling objectives; route those to cvc-speller / word-workout / phonics-blender). A '
      + 'counted-picture frame shows one object then several ("one dog 🐕 → three 🐕🐕🐕 ___?"); the tutor names the '
      + 'one thing, says how many there are now, waits, and the child SAYS THE NEW WORD ALOUD ("dogs"). The tutor '
      + 'judges the answer from the audio and its own affirmation moves the lesson on. The one-thing word is on '
      + 'screen and tappable to hear; there are no answer chips and nothing to click to advance. Requires a '
      + 'microphone. Teaches regular -s plural formation (singular/plural nouns, "more than one"). ESSENTIAL for '
      + 'Kindergarten Language Arts grammar.',
    constraints:
      'GRAMMAR objectives only (plural / "more than one" / singular-vs-plural). Do NOT route decoding/CVC/phonics/spelling objectives here — the noun pool is chosen for clean -s plural formation, not for a target vowel or decodability, so it cannot honor a decoding scope. Covers ONLY regular -s plurals at birth (no -es, no irregular plurals — those modes come later). Nouns must be concrete, picturable words with a clear emoji so pre-readers can play. The manifest must NOT supply specific per-challenge words — the generator authors the noun pool and code assembles the plural_s challenges deterministically. Spoken answers — requires the live tutor and a microphone.',
    // ── DI MODALITY, PURELY VERBAL (2026-08-09) — third literacy port after
    // phonics-blender and sound-swap, same two user rulings. The tutor owns the
    // clock and the task is spoken end to end: it models the rule on a noun this
    // session never asks about, names the one thing, says how many there are
    // now, waits, judges the audio in-band, corrects contrastively, and its OWN
    // affirmation is the advance. There is no answer chip, no Next button, no
    // start-screen fork and no advance timer anywhere in the path. (Before the
    // port the child could TAP the plural out of three printed words — reading,
    // which a child who cannot form a plural does correctly every time — and the
    // chip printed the answer on screen. One deletion closed the costume and the
    // leak together.)
    // The cue lines and the per-item judging contract live in `wordFlipScript.ts`
    // (hand-authored, DISTAR discipline); this block is the session-level frame.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn", or the engine's
    // sentence-scoped verdict scan would classify a phantom verdict.
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction plural practice for a young child. The frame shows ONE of a thing and then '
        + 'several of it, and the child SAYS the more-than-one word aloud. Right now the one-thing word is '
        + '"{{singular}}", the many-side shows {{countWord}} of them, and the word the child has to produce is '
        + '"{{answer}}". You speak the exact scripted lines from each bracketed application message, you say the '
        + 'one-thing word when the child taps it, and you judge each spoken attempt from the audio you heard using '
        + 'only the two allowed reply branches. Turning a word for one thing into the word for many is the entire '
        + 'skill being practiced, so the child produces it — never picks it.',
      // Trimmed to exactly what the component pushes through updateContext (and
      // that the connect-time primitive_data also carries). An unpushed key
      // renders the literal string "(not set)" into the prompt, which the tutor
      // then reads aloud as content — the challenge-index/attempts/voiceMode
      // keys the click-driven version carried went with the clicks.
      contextKeys: ['singular', 'countWord', 'answer'],
      // Correction territory, not answer territory: every level here describes
      // what happens AFTER an attempt, and re-modeling at every tier is the DI
      // rule (standing gate 3 — remediation is not scaffolding).
      scaffoldingLevels: {
        level1: 'Say the one-thing word once more, then hand the question back to them.',
        level2: 'Show the pattern on a DIFFERENT noun — one of it, then two of it — and then ask for theirs again.',
        level3: 'Say the pattern for the word on screen, then ask them for the more-than-one word once more.',
      },
      // Observable behaviours only. The first is this activity's signature error
      // class, and it is the one most likely to be mistaken for success: it is
      // fluent, confident, and completely unchanged.
      commonStruggles: [
        {
          pattern: 'Says the ONE-thing word back with nothing added — "dog" when asked what three of them are',
          response: 'Treat an unchanged word as not yet answered: say the one-and-many pair for that word, then ask again.',
        },
        {
          pattern: 'Adds too much ending — "dogses" for "dogs"',
          response: 'A real error at this age, not carelessness: the rule was applied twice. Say the correct pair once, hand it straight back, and do not dwell on it.',
        },
        {
          pattern: 'Says the NUMBER instead of the word — "three"',
          response: 'The number is already in the picture; the word is what is being asked for. Say the pair for that word, then ask again.',
        },
        {
          pattern: 'Names something else in the picture, or a different word entirely',
          response: 'Say the one-thing word, then the many word, then ask them for the many word once more.',
        },
        {
          pattern: 'Says the right word inside a phrase — "three dogs" rather than "dogs" alone',
          response: 'That is a correct answer — affirm it. The ending is what is being measured, not whether the word arrived alone.',
        },
        {
          pattern: 'Goes quiet after being asked',
          response: 'Say the one-thing word once more, then hand the question back to them alone.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [DI_FLIP_ITEM], [DI_FLIP_MOVE_ON] or [DI_FLIP_COMPLETE] contain the only lesson '
            + 'words you may speak. The square-bracket label is private metadata: never speak, reproduce, or '
            + 'invent it. Each [DI_FLIP_ITEM] carries a two-branch judging rule: affirmations must begin with '
            + '"Yes" and corrections must begin with "My turn", using the exact quoted lines. Never begin any '
            + 'other sentence with those words. Judge honestly from the audio: affirm the more-than-one word, '
            + 'correct a wrong, missing, or unchanged one. EVERY correction says the one-and-many pair for that '
            + 'word before handing it back. Do not praise to be kind. The application decides which item comes '
            + 'next; never introduce one yourself.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The FIRST [DI_FLIP_ITEM] of a session carries the greeting, how to play, and the first question '
            + 'INSIDE its quoted line. Speak that quote exactly and add nothing of your own — no separate '
            + 'greeting, no how-to-play of your own wording, no rephrased question. It already models the rule '
            + 'on a noun this session never asks about, which is the whole introduction the child needs. This '
            + 'holds at every grade, and it OVERRIDES any "keep it to one sentence" cap from a lesson switch: '
            + 'the quoted line is the length it is meant to be.',
        },
        {
          title: 'PLURALS (what counts as the answer)',
          instruction:
            'The target is the MORE-THAN-ONE word said aloud. It counts whether it arrives on its own ("dogs") '
            + 'or inside the natural phrase a child actually says ("three dogs") — the ending is what is being '
            + 'measured, not whether the word arrived alone. Three things look like answers and are not: saying '
            + 'the ONE-thing word back with nothing added (fluent, confident, and completely unchanged — this is '
            + 'the signature error of this skill), adding too much ending ("dogses", which is the rule applied '
            + 'twice and a real error at this age), and saying only the number. All three take the correction '
            + 'branch, warmly. LAW: never say the more-than-one form of the word on screen until a quoted lesson '
            + 'line tells you to — the microphone is open the whole time, so saying it first hands the answer '
            + 'over. Saying the one-thing word ("dog") is always safe; the plural ("dogs") is a leak. Never '
            + 'preview an item that is still coming.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP and stay silent until the child answers. Do not re-ask, do not fill the pause, '
            + 'do not say the pattern again unprompted, and do not make the change for them. A long silence is a '
            + 'child working out a word, and that working-out IS the activity. If they tap the picture you will '
            + 'receive a separate [SAY_WORD] message — answer that and nothing more, then go back to waiting.',
        },
        {
          title: 'WORD ON DEMAND ([SAY_WORD])',
          instruction:
            'When you receive a message starting with [SAY_WORD], you MUST immediately and clearly say ONLY the '
            + 'one word it quotes, twice, and nothing else. Do NOT add commentary, questions, encouragement, or '
            + 'extra words; do NOT add the ending that means more than one; and do NOT treat it as an attempt to '
            + 'judge. This is the child tapping the picture to hear what the thing is called, which is how a '
            + 'pre-reader recovers the stimulus, and it is answered at every grade — including while you are '
            + 'waiting for their answer.',
        },
      ],
    },
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
    description: 'Audio-first and text-based poetry lab for grades K-6. At K-1, the tutor reads nursery-style poems aloud and students tap the two pictured ending words that rhyme, with no reading required. Analysis mode examines rhyme scheme, mood, and figurative language in grades 2-6. Composition mode supports structured poetry writing in grades 3-6.',
    constraints: 'rhyme_hunt: grades K-1 (audio-first, no reading required; the tutor reads each poem aloud and the child taps two pictured ending words). Analysis: grades 2-6 (poem reading, mood vocabulary, figurative language, rhyme notation). Composition: grades 3-6 (typed free-text writing). The manifest must not supply poem text, candidate words, answers, or templates; the generator authors mode-specific content.',
    evalModes: [
      { evalMode: 'rhyme_hunt', label: 'Rhyme Hunt (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['rhyme_hunt'], description: 'Hear a short poem read aloud, then tap the pair of words that rhyme.' },
      { evalMode: 'analysis', label: 'Analysis (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['analysis'], description: 'Identify poetic elements in given poem.' },
      { evalMode: 'composition', label: 'Composition (Tier 5)', beta: 6.0, scaffoldingMode: 5, challengeTypes: ['composition'], description: 'Compose poem using template structure.' },
    ],
    tutoring: {
      taskDescription:
        'You are the rhyme and poetry coach for "{{title}}" at Grade {{gradeLevel}}. '
        + 'Mode: {{mode}}. In rhyme_hunt, this is round {{currentRound}} of {{roundsTotal}}. '
        + 'The poem for this round is: {{roundPoem}}. The candidate ending words are {{candidateWords}}. '
        + 'The rhyming pair is {{rhymeWordA}}/{{rhymeWordB}} — this is the answer the student must discover by EAR. '
        + 'Never name the pair outright; stretch word endings so the student hears the relationship. '
        + 'Attempts: {{attempts}}. First-try correct so far: {{firstTryCorrect}}.',
      contextKeys: [
        'title', 'gradeLevel', 'mode', 'currentRound', 'roundsTotal', 'roundPoem',
        'candidateWords', 'rhymeWordA', 'rhymeWordB', 'attempts', 'firstTryCorrect',
      ],
      scaffoldingLevels: {
        level1: 'Ask the student to listen again for the sounds at the very ends of the lines. Do not name either answer word.',
        level2: 'Slowly stretch the endings of the two words the student tapped and ask whether those ending sounds match. Do not offer a replacement word.',
        level3: 'Re-read the four line endings with equal emphasis, then invite the student to compare two choices at a time. Never say which pair is correct.',
      },
      commonStruggles: [
        { pattern: 'The student taps words that share a beginning sound', response: 'Contrast beginning and ending sounds, then re-read the tapped words with their endings stretched.' },
        { pattern: 'The student misses the same round more than once', response: 'Re-read the stanza slowly and isolate all four line endings without grouping or naming the answer pair.' },
        { pattern: 'The student waits without choosing', response: 'Repeat the tap-two protocol in ear terms and encourage one exploratory pair without narrowing the choices.' },
      ],
      aiDirectives: [
        {
          title: 'ORIENT',
          instruction: 'On [ACTIVITY_START], greet once and frame the activity: "We\'re going to listen to a little poem and find the two words that rhyme."',
        },
        {
          title: 'STIMULUS',
          instruction: 'On [ACTIVITY_START] or [ROUND_START] in rhyme_hunt, read {{roundPoem}} aloud slowly with playful prosody, emphasizing every line-ending word equally. Do not group, repeat, or name {{rhymeWordA}} and {{rhymeWordB}} as a pair. In analysis mode, offer to read the poem aloud on request.',
        },
        {
          title: 'DISAMBIGUATE',
          instruction: 'For rhyme_hunt, explain once that rhyming words sound the same at the end, using an unrelated example such as cat/hat, then say: "Tap the two words that rhyme." For analysis, enact rhyme notation in sound terms before using letters such as AABB.',
        },
        {
          title: 'RECOVER',
          instruction: 'On [RHYME_MISS], stretch only the two words the student tapped and ask whether their endings match. Never name, contrast with, or hint {{rhymeWordA}}/{{rhymeWordB}}.',
        },
        {
          title: 'QUIET CELEBRATION',
          instruction: 'On [RHYME_CORRECT], celebrate only for the first round, a comeback, or the final round. On [ACTIVITY_COMPLETE], close in one short sentence. Never repeat the answer pair.',
        },
      ],
    },
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
    tutoring: {
      taskDescription:
        'Student is planning a story called "{{title}}". The story idea is: {{writingPrompt}}. '
        + 'They are on the {{plannerPhase}} step. Their plan so far: {{chosenSummary}}. '
        + 'The parts of the story are: {{arcLabels}} ({{arcFilledCount}} of {{arcSlotCount}} filled in). '
        + 'At grade band {{gradeBand}}. At K-1 they cannot read or type: they are asked one question at a '
        + 'time ("{{currentQuestion}}") and tap one of three pictures ({{currentChoiceLabels}}), then tap '
        + 'event pictures ({{arcTrayLabels}}) into numbered slots to put the story in order. '
        + 'At grade 2 and up they type their own plan into cards and then the story arc.',
      contextKeys: [
        'title',
        'writingPrompt',
        'gradeBand',
        'plannerPhase',
        'currentQuestion',
        'currentChoiceLabels',
        'chosenSummary',
        'arcLabels',
        'arcTrayLabels',
        'arcFilledCount',
        'arcSlotCount',
      ],
      scaffoldingLevels: {
        level1: '"This is your story — you get to decide. What do you think happens?"',
        level2: '"Think about the story idea: {{writingPrompt}}. Which of these feels like it belongs in YOUR story?"',
        level3: '"Let us go one piece at a time. I will say each picture out loud, and you pick the one you like. Then we will think about which one happens first."',
      },
      commonStruggles: [
        {
          pattern: 'Student stalls at the first question because they think there is a right answer',
          response: '"There is no right answer here — this is your story, so any of them works. Pick the one that sounds most fun to you."',
        },
        {
          pattern: 'Student taps event pictures into slots at random without thinking about order',
          response: '"Think about which one could only happen at the very start — before anything else has happened yet. Put that one first."',
        },
        {
          pattern: 'Student puts the ending first because it is the picture they like best',
          response: '"That is a great one to end with! Something has to happen before it, though. What would happen first, to get there?"',
        },
        {
          pattern: 'Student cannot remember what the pictures are because they cannot read the words',
          response: '"Let me say them again for you." Then describe each picture out loud, slowly, one at a time. Never ask them to read.',
        },
        {
          pattern: 'A grade 2+ student writes one or two words into a planning card and moves on',
          response: '"Tell me more about that. What do they look like, or how do they feel? Add that to your card so your reader can picture it too."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten and grade 1)',
          instruction:
            'At {{gradeBand}} K-1 the student CANNOT read the story idea, the question, the picture captions, or the '
            + 'slot labels. Your voice is the only channel that carries them. '
            + 'When you receive [STORY_ELEMENT_ASKED], first read the story idea aloud word for word if the message '
            + 'gives it to you, then ask the question, then say each of the three picture choices out loud so they '
            + 'know what they can pick. Reading and saying these IS your greeting — this OVERRIDES any instruction '
            + 'to keep it to one sentence or to be brief. '
            + 'When you receive [STORY_PLAN_READ_ALOUD], read aloud, word for word, exactly the text the message '
            + 'gives you, then wait. '
            + 'When you receive [STORY_ARC_STARTED], describe each event picture out loud so a non-reader knows what '
            + 'they are holding. '
            + 'Never ask a K-1 student to read anything, to type, or to spell. Never say a number of points, a score, '
            + 'or how many they have left.',
        },
        {
          title: 'THE STORY IS THEIRS — NEVER PLAN IT FOR THEM',
          instruction:
            'Picking a character or a place has NO right answer, so never steer, never praise one option over '
            + 'another, and never say "good choice" in a way that implies the others were worse. '
            + 'When you receive [STORY_ELEMENT_CHOSEN], say their pick back warmly in a few words and stop — do not '
            + 'add a follow-up question, and do not start narrating the story on their behalf. '
            + 'When you receive [STORY_PLAN_ORIENT] (grade 2 and up), welcome them and point them at the first card; '
            + 'do not suggest what to write in it. '
            + 'When you receive [STORY_PLAN_COMPLETE], tell their story back to them using ONLY the pieces they '
            + 'actually chose, then celebrate. Do not add plot they did not pick, and do not correct anything.',
        },
        {
          title: 'ORDER IS THE ANSWER — NEVER GIVE IT AWAY',
          instruction:
            'Putting the event pictures in story order is the thing being assessed. The correct order is NOT in your '
            + 'context and you must never guess it aloud. '
            + 'Do not say which picture goes first, last, or in any numbered slot; do not say a slot is empty in a way '
            + 'that names what belongs there; and do not rule options out, because eliminating is the same as telling. '
            + 'When you receive [STORY_EVENT_PLACED], name what they placed and where they put it, and STOP — never '
            + 'say whether it is right or wrong, and never react differently to a right one than a wrong one. '
            + 'To help, ask what could only happen before anything else, or what could only happen at the very end. '
            + 'Questions about the story are always allowed; statements about the order are not.',
        },
      ],
    },
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
    misconceptionScope: 'primitive',
    description:
      'Live-judged READ-ALOUD FLUENCY with a spoken Direct Instruction tutor. A short connected passage is '
      + 'split into single-breath lines and the child reads them ONE AT A TIME, out loud, into an open '
      + 'microphone; the tutor judges each read from the audio WORD BY WORD — a skipped, added or swapped word '
      + 'is corrected, not waved through — and its own affirmation moves the lesson to the next line. Three '
      + 'fluency identities: Read It (the child decodes the printed line COLD, with nothing spoken first), Say '
      + 'It Back (the tutor models the line as one smooth phrase and the child reads it back), and Character '
      + 'Voice (the tutor models one character\'s line in that character\'s voice and the child reads it back '
      + 'their way). There are no recording buttons, no self-rating, and nothing to click to advance. Requires '
      + 'a microphone. Perfect for grades 1-6 oral reading fluency.',
    constraints:
      'Best for grades 1-6. Requires the live tutor and a microphone. Judged lines are 3-8 words — the benched '
      + 'ceiling for reliable one-word-error detection — so the grade ladder rides on vocabulary, line count '
      + 'and Lexile, never on longer utterances. The passage must READ AS ONE CONNECTED TEXT across its lines; '
      + 'use di-sentence-reading instead for K-2 practice on ISOLATED decodable or sight-word sentences. '
      + 'The tutor judges WORDS, never how the reading sounded: prosody is taught by model-and-imitate and is '
      + 'not graded. No comprehension questions — this primitive measures oral reading, not understanding.',
    // ── DI MODALITY (2026-08-12) — ninth literacy port, consumer of
    // useJudgedScriptRunner. Before this, the primitive judged NOTHING: its
    // score was modelListened + recordingMade + selfAssessment + comparisonUsed
    // (four button presses) and "estimated WPM" was wall-clock duration divided
    // by the passage word count, computed whether or not the child said a word.
    // Every graded action passed the costume test — a child who cannot read
    // could tap Play, Start, Stop and "5 out of 5" for a full score.
    // THE PASSAGE IS NOW READ ONE LINE AT A TIME. A 120-word blob cannot be
    // judged (there is nothing to contrast against) and `sentence_read_aloud`
    // is benched at 3-8 words per utterance, so the passage arrives already
    // split and each line is one judged item. MIN/MAX_SENTENCE_WORDS are
    // IMPORTED from di-sentence-reading — the bench ceiling lives in one place.
    // PROSODY IS TAUGHT, NOT GRADED: no prosody response class exists, and a
    // judge asked "did that sound expressive?" rubber-stamps. expression and
    // dialogue model the delivery and grade the WORDS, and every contract on
    // those modes carries an explicit clause forbidding a sound-based refusal.
    // Cue lines, delivery notes, the cold-read guard and the judging contracts
    // live in `readAloudStudioScript.ts` (hand-authored, DISTAR); lines that
    // cannot be asked honestly (outside the word window, a sentence opening
    // with a verdict sentinel, dialogue with no speaker) are DROPPED at build.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    evalModes: [
      // βs raised with the STRUCTURE (skill rule: only then). Every mode went
      // from an ungraded button press to unaided spoken production judged word
      // by word. `accuracy` is pinned to di-sentence-reading's `read_sentence`
      // (3.0) — the same act on the same benched utterance window — and the
      // other two keep their spacing above it.
      { evalMode: 'accuracy', label: 'Read It (Tier 2)', beta: 3.0, scaffoldingMode: 1, challengeTypes: ['accuracy'], description: 'Decode the printed line COLD and read it aloud, every word in order. Nothing speaks it first.' },
      { evalMode: 'expression', label: 'Say It Back (Tier 3)', beta: 4.5, scaffoldingMode: 3, challengeTypes: ['expression'], description: 'The tutor models the line as one smooth phrase; the child reads it back. Phrasing is taught, the words are judged.' },
      { evalMode: 'dialogue', label: 'Character Voice (Tier 4)', beta: 5.5, scaffoldingMode: 4, challengeTypes: ['dialogue'], description: 'The tutor models one character\'s line in that character\'s voice; the child reads it back their way.' },
    ],
    supportsEvaluation: true,
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction read-aloud practice. A short passage is on the child\'s screen ONE LINE '
        + 'AT A TIME, and reading that printed line aloud accurately is the entire skill. Right now the mode is '
        + '"{{challengeType}}" and the line in front of them is "{{stimulus}}". You speak the exact scripted '
        + 'lines from each bracketed application message and nothing else, then you judge the audio you heard '
        + 'against the printed words. The application decides which line comes next; never introduce one '
        + 'yourself and never read ahead to a line the child has not reached.',
      // Trimmed 11 -> 2, to exactly what the component pushes through
      // updateContext (and that the connect-time primitive_data also carries).
      // There is nothing to WITHHOLD in the stimulus here — unlike the sibling
      // packs, the printed line is both the question and the target and it is
      // already on the child's screen. What must not happen is the tutor
      // SPEAKING an accuracy line early, and the per-item cold-read guard in
      // readAloudStudioScript forbids that on every cue that can reach it.
      contextKeys: ['challengeType', 'stimulus'],
      // Correction territory, not answer territory: every level describes what
      // happens AFTER an attempt. Re-modeling is the scripted correction's job,
      // and on an accuracy line NOTHING here may read the line — that is the
      // second channel the cold-read guard exists to close.
      scaffoldingLevels: {
        level1: 'Say the instruction once more, then wait for them alone.',
        level2: 'Say the instruction once more, more slowly, then wait. Do not read the line for them.',
        level3: 'Use the scripted correction line for this item, then hand the reading back one more time.',
      },
      // Observable behaviours only, with PERFORMABLE responses (script moves a
      // tutor can speak or do — never meta-instructions, which get recited to
      // the child verbatim).
      commonStruggles: [
        {
          pattern: 'Swaps a small word for another small word - "the" for "a", "and" for "then", "her" for "his"',
          response: 'Treat it as a miss however fluent it sounded: the scripted correction names the words they said, reads the line correctly, and asks again.',
        },
        {
          pattern: 'Drops a word out of the middle of a smooth, confident reading',
          response: 'Treat the missing word as a miss: the scripted correction names it, reads the line correctly, and asks again.',
        },
        {
          pattern: 'Says the IDEA of the line in their own words instead of reading the printed words',
          response: 'Treat a retelling as not yet read: the scripted correction reads the printed words, then asks them to read it again.',
        },
        {
          pattern: 'Sounds out slowly, word by word, but lands on every word correctly',
          response: 'Treat it as correct and affirm it — effortful decoding that reaches the right words is reading.',
        },
        {
          pattern: 'Stops in the middle of a line and starts again',
          response: 'Wait for them to finish the whole line, then judge the reading they finished on.',
        },
        {
          pattern: 'Goes quiet after being asked',
          response: 'Say the instruction once more, then wait for them alone.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [RA_ITEM], [RA_MOVE], [RA_COMPLETE] or [RA_HEAR] contain the only lesson words you '
            + 'may speak. The square-bracket label is private metadata: never speak, reproduce, or invent it. '
            + 'Each carries a judging rule: affirmations must begin with "Yes" and corrections must begin with '
            + '"My turn", using the exact quoted lines. Never begin any other sentence with those words. Judge '
            + 'honestly from the audio, word by word, and do not praise a misread to be kind.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [RA_ITEM] of a session, and any later one that carries a how-to-play sentence, has the '
            + 'greeting, the action and the instruction INSIDE its quoted line. Speak that quote exactly and add '
            + 'nothing of your own: no separate greeting, no how-to-play in your own wording, no rephrased '
            + 'instruction. This OVERRIDES any "keep it to one sentence" cap from a lesson switch.',
        },
        {
          title: 'NEVER READ A LINE THE CHILD HAS NOT READ YET',
          instruction:
            'In the "accuracy" mode the child is decoding the printed line cold, and that is the whole '
            + 'measurement. Do NOT read that line, or any part of it, before they do — not to help, not to '
            + 'check, not as an example, and not because a scaffolding instruction seems to invite it. In the '
            + 'other two modes the cue quotes a "Listen:" model for you to read FIRST; those are the only '
            + 'lines you may ever say before the child says them, and only when the cue quotes them. Never '
            + 'read a line further down the passage than the one the application has put in front of them.',
        },
        {
          title: 'THE WORDS ARE THE VERDICT, NOT THE SOUND OF IT',
          instruction:
            'Judge whether every printed word was read, correctly and in order. Do NOT judge how the reading '
            + 'sounded: a flat, plain, unexpressive delivery with every word right is CORRECT, and so is a slow, '
            + 'effortful, sounded-out reading that lands on the right words. Speed is never judged. Where a cue '
            + 'asks you to model a phrase or a character voice, that model is TEACHING — it never becomes a '
            + 'standard you then refuse the child against.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP and stay silent until the child has finished reading the whole line. Do not '
            + 're-ask, do not fill the pause, do not read along with them, and do not finish a word they are '
            + 'working out. A reader pauses in the middle of a line and that pause is part of ONE reading, not '
            + 'the end of it. If they tap to hear the instruction again you will receive a separate [RA_HEAR] '
            + 'message: answer that and nothing more, then go back to waiting.',
        },
        {
          title: 'INSTRUCTION ON DEMAND ([RA_HEAR])',
          instruction:
            'When you receive a message starting with [RA_HEAR], immediately say ONLY what it quotes and '
            + 'nothing else, then wait again. Do not treat anything you just heard as a reading to judge, do '
            + 'not add commentary, and on an accuracy line do not read the line itself — the child is asking to '
            + 'hear the INSTRUCTION again, which is how a reader recovers what they were asked to do.',
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
        + 'Word the student is holding right now (empty if none): {{selectedWord}}. '
        + 'On-screen support tier: {{supportTier}} ("(not set)" = no tier is in play, treat it as full support; '
        + 'easy/medium = bucket picture cues, already-filed word badges, and a criterion-naming instruction are all on screen; '
        + 'hard = all three are withdrawn on purpose).',
      contextKeys: [
        'challengeType', 'instruction', 'bucketLabels', 'wordsSorted', 'totalWords',
        'attemptNumber', 'challengeNumber', 'totalChallenges', 'gradeLevel', 'sortingTopic', 'selectedWord',
        'supportTier',
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
            + '(2) name each bucket out loud so the child knows the choices: {{bucketLabels}} — EXCEPT in the name-free '
            + 'stance the SUPPORT TIER directive defines (support tier "hard" at Grade 1 and above), where you skip this '
            + 'step and let the on-screen labels speak for themselves; at Kindergarten you name the buckets aloud at EVERY tier; '
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
        {
          title: 'SUPPORT TIER — how much of the sorting rule you may say out loud',
          instruction:
            'The support tier is {{supportTier}} — the scaffolding level the on-screen activity is set to. Your talk must '
            + 'MATCH it, because you are a second scaffold channel and can undo what the screen deliberately withheld. '
            + 'If it is "(not set)" there is no tier in play: behave as at easy. '
            + 'easy — full support: name each bucket aloud, restate the sorting rule in child terms, and think it through with the student. '
            + 'medium — light support: name each bucket aloud and ask the sorting question, but do not restate the rule for every word. '
            + 'hard — name-free coaching: the on-screen instruction does NOT name the sorting rule, the bucket picture cues are '
            + 'gone, and the already-sorted word badges are hidden, so you must not supply any of that. Do not state the '
            + 'criterion, do not read the bucket labels aloud for a Grade 1+ student, and never name the group a word belongs '
            + 'to. Coach by question instead ("Say the word out loud. What do you notice about it?"). '
            + 'BAND FLOOR — at Kindergarten the child cannot read anything on screen, so at EVERY tier including hard you '
            + 'still say each word card aloud when it is staged ([WORD_STAGED] / [WORD_TAP]) and you still name each bucket '
            + 'aloud so the choices exist for them; what hard withholds at Kindergarten is the sorting RULE, never the words. '
            + 'At every tier you never say which bucket or match is correct — that is the answer the student is producing.',
        },
      ],
    },
    supportsEvaluation: true,
  },
];
