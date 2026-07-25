/**
 * Direct Instruction Catalog — the DI primitive family. Live-judged
 * call-response over Gemini Live: the tutor models/guides/tests a spoken
 * response and judges the audio in-band. Custom-made scripts per pack.
 */
import { ComponentDefinition } from '../../../types';

export const DI_CATALOG: ComponentDefinition[] = [
  {
    id: 'di-letter-sounds',
    description: 'Live-judged Direct Instruction for continuous letter SOUNDS (not letter names): the tutor models a sound like /mmm/ as in "moon", practices it together, then asks the child to say it and judges the spoken audio. The child SPEAKS each sound aloud (voice/microphone). Perfect for kindergarten phonemic awareness and letter-sound correspondence. ESSENTIAL for K phonics / early reading foundations — grapheme-to-phoneme mapping for pre-readers. Also drills first-sound (onset) isolation from a spoken word and cumulative spaced review of taught sounds.',
    constraints: 'Requires microphone + live audio tutor. Continuous (stretchable) sounds and short vowels only — NOT letter names, digraphs, blends, or stop consonants. The manifest must NOT supply specific letters; the menu-scoped generator selects target letters from the objective and attaches keywords/pictures in code.',
    // L1 eval modes — task identities, all within the benched continuant response
    // class (the produced audio is a held sound in every mode). β mirrors backend
    // problem_type_registry.py → "di-letter-sounds". Ordered easiest → hardest.
    evalModes: [
      {
        evalMode: 'letter_sound',
        label: 'Letter Sound (Isolated)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['letter_sound'],
        description: 'See a letter, say its continuous sound (grapheme→phoneme). The base skill, taught as a focused cluster.',
      },
      {
        evalMode: 'letter_sound_review',
        label: 'Sound Review (Mixed Set)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['letter_sound_review'],
        description: 'Cumulative / spaced review — re-produce already-taught sounds drawn as a wide mix across many letters, not one set.',
      },
      {
        evalMode: 'first_sound_in_word',
        label: 'First Sound in a Word',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['first_sound_in_word'],
        description: 'Onset isolation (phonemic awareness): hear a whole word and say its first sound. Continuant onsets only.',
      },
    ],
    supportsEvaluation: true,
    // Judged-loop engine needs manual voice-activity brackets (Gemini's own VAD
    // is unusable for held phonemes — bench run-3 ruling). Declared here so a
    // LESSON session containing this primitive opens with manual activity; the
    // standalone connect falls back to it too.
    audioInput: { manual_activity: true },
    // L2 tutoring block — hand-authored (DI "custom-made" rule: exact wording
    // is the pedagogy). Moved here from diLetterSoundsScript at the L2 layer so
    // both connect paths (standalone fallback + lesson auth/switch) resolve it
    // from the catalog, the single source of truth. Sentinel discipline: no
    // struggle response or scaffolding line begins with "Yes" or "My turn" —
    // the engine's sentence-scoped verdict scan must never see a phantom opener.
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction letter-sounds practice for a kindergarten learner '
        + '(current task: {{challengeType}}). You speak the exact scripted lines from each bracketed '
        + 'application message and judge each learner attempt from the audio you heard, using only '
        + 'the two allowed reply branches.',
      contextKeys: ['challengeType', 'letter', 'keyword', 'letters'],
      scaffoldingLevels: {
        level1: 'Repeat the prompt once, slowly.',
        level2: 'Model the requested sound, then ask for one retry.',
        level3: 'Accept the attempt warmly and continue as instructed.',
      },
      commonStruggles: [
        {
          pattern: 'Adds a vowel to a continuant — "muh" or "suh" instead of a held "mmm"/"sss"',
          response: 'Stretch the sound long and ask for one clean held sound with no vowel at the end.',
        },
        {
          pattern: 'Says the letter NAME ("em") instead of its sound',
          response: 'Say that letters have a name and a sound, model the sound, and ask for the sound.',
        },
        {
          pattern: 'Stays silent after "Your turn"',
          response: 'Invite one try together first, then hand it back alone.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [DI_ITEM], [DI_MOVE_ON], or [DI_COMPLETE] contain the only lesson words you may '
            + 'speak. The square-bracket label is private metadata: never speak, reproduce, or invent it. Each '
            + '[DI_ITEM] message includes a two-branch judging rule: affirmations must begin with "Yes" and '
            + 'corrections must begin with "My turn", using the exact quoted lines. Never begin any other '
            + 'sentence with those words. Judge honestly from the audio: affirm a reasonable kindergarten '
            + 'production of the target; correct a wrong, missing, or different production. Every correction '
            + 're-models the sound and begins with "My turn". Do not praise to be kind. The application decides '
            + 'which item comes next; never introduce one yourself.',
        },
        {
          title: 'SOUND PRONUNCIATION',
          instruction:
            'A stretched letter sequence like "mmm", "sss", or "fff" is a continuous letter sound held for '
            + 'about two seconds. Never say a letter name and never spell it out — the sound, not the name.',
        },
        {
          title: 'BREVITY',
          instruction:
            'Speak only the exact quoted lesson text. Never narrate judging, scoring, or application state. '
            + 'Keep pacing brisk: no filler, no chit-chat.',
        },
      ],
    },
  },
  {
    id: 'di-word-reading',
    description: 'Live-judged Direct Instruction WORD READING (DISTAR "What word?"): the tutor models a printed word — sounding out a decodable CVC word ("sss-aaa-mmm… sam") or naming a sight word whole — practices it together, then asks the child to read it and judges the spoken audio. The child SEES the printed word and READS it aloud (voice/microphone). Perfect for kindergarten and grade 1 decoding: short-vowel CVC word reading, blending, and high-frequency sight-word recognition. ESSENTIAL for K/G1 early reading — print-to-speech decoding for beginning readers.',
    constraints: 'Requires microphone + live audio tutor. Short-vowel CVC words and starter sight words only — NO digraphs, blends, or multisyllable words. The manifest must NOT supply specific words; the menu-scoped generator selects target words from the objective (phonics pattern or sight-word set) and attaches graphemes/rewards in code. The printed word is the answer: no pictures or audio pre-cues before the child reads.',
    // L0: ONE eval mode at birth. Ladder candidates (cvc_reading / sight_word /
    // word_reading_review) are queued on the birth cert for /add-eval-modes.
    // β mirrors backend problem_type_registry.py → "di-word-reading".
    evalModes: [
      {
        evalMode: 'read_word',
        label: 'Read a Word',
        beta: 2.5,
        scaffoldingMode: 1,
        challengeTypes: ['read_word'],
        description: 'See one printed word, read it aloud — blend-and-read for decodable CVC words, whole-word recall for sight words.',
      },
    ],
    supportsEvaluation: true,
    // Same judged-loop engine, same transport need (see di-letter-sounds).
    // Its tutoring block still ships from diWordReadingScript at connect time;
    // moving it here is the pack's own /add-tutoring-scaffold (L2) layer.
    audioInput: { manual_activity: true },
  },
  {
    id: 'di-math-facts',
    description: 'Live-judged Direct Instruction MATH FACT fluency ("What is 2 plus 1?"): the tutor models a printed addition fact aloud ("two plus one is three"), practices it together, then asks the child and judges the spoken number-word answer. The child SEES the printed problem and SPEAKS the answer aloud (voice/microphone); response time is captured silently as the fluency signal — no visible timer. Perfect for kindergarten and grade 1 addition fact fluency: sums within 5, sums within 10, doubles, and make-ten facts. ESSENTIAL for K/G1 MATHEMATICS operations — addition fact fluency and spoken number-word production for early learners.',
    constraints: 'Requires microphone + live audio tutor. Addition facts within 10 only at birth — no subtraction, multiplication, or multi-digit problems. The manifest must NOT supply specific facts; the scoped fact pool builds problems from the objective (within 5 / within 10 / doubles / make ten) and attaches number words + ASR aliases in code. The printed problem is the stimulus and the spoken number word is the answer: the sum never appears on screen before the child answers.',
    // L0: ONE eval mode at birth. Ladder candidates (counting_next / fact_review /
    // subtraction_fact; G3 multiplication_fact) are queued on the birth cert for
    // /add-eval-modes. β mirrors backend problem_type_registry.py → "di-math-facts".
    evalModes: [
      {
        evalMode: 'answer_fact',
        label: 'Answer a Fact',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['answer_fact'],
        description: 'See one printed addition fact, say the answer as a number word — modeled and guided first, then answered alone.',
      },
    ],
    supportsEvaluation: true,
    // Same judged-loop engine, same transport need (see di-letter-sounds).
    // Its tutoring block still ships from diMathFactsScript at connect time;
    // moving it here is the pack's own /add-tutoring-scaffold (L2) layer.
    audioInput: { manual_activity: true },
  },
];
