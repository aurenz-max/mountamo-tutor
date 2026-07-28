/**
 * Direct Instruction Catalog — the DI primitive family. Live-judged
 * call-response over Gemini Live: the tutor models/guides/tests a spoken
 * response and judges the audio in-band. Custom-made scripts per pack.
 *
 * MISCONCEPTION SCOPE — family ruling, 2026-07-25. Every pack declares
 * `misconceptionScope: 'primitive'`. PRD §5 rev-2 reserves `'skill'` for
 * "content-generic delivery vehicles" (KnowledgeCheck, MultipleChoice); DI
 * packs are the opposite — each is a hand-authored DISTAR script for ONE
 * response class, so the interaction model IS the concept. Primitive scope
 * also survives the standalone tester, where the subskill is unreliable (the
 * 2026-07-21 run had the runtime Gemini re-mapper land on a different subskill
 * than the birth-cert home) and `'skill'` would gate those runs out entirely.
 *
 * The declaration is gate 3 of `captureMisconception` — without it the packets
 * the components now build are dropped before the distiller, so this and the
 * component wiring only work as a pair.
 *
 * ⚠ KNOWN, ACCEPTED RISK: `di-math-facts` carries FOUR task identities under
 * one primitive_type, and primitive scope stores ONE misconception per pack
 * per student — so a diagnosis earned on `subtraction_fact` ("counts up
 * instead of back") would also be offered on `counting_next`, where counting
 * up is the CORRECT move. These eval modes are task identities, not difficulty
 * tiers, so the leak is genuine. Mitigation (shipped, not deferred): each pack
 * names its task identity inside `challengeSummary`, so the distilled sentence
 * is SELF-LIMITING ("when subtracting, the student…") and S5/S7 apply it
 * narrowly even though the key is coarse. If that proves insufficient the
 * escalation is a PRD amendment (identity += declared eval-mode family), NOT
 * quietly flipping DI to `'skill'`. di-sentence-reading carries a milder
 * version of the same tension: 4 modes, but all "read this sentence aloud", so
 * a misconception genuinely does transfer.
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
    // Misconception Loop gate 3 — family ruling, see the module docblock.
    misconceptionScope: 'primitive',
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
    // Misconception Loop gate 3 — family ruling, see the module docblock.
    misconceptionScope: 'primitive',
    // Same judged-loop engine, same transport need (see di-letter-sounds).
    // Its tutoring block still ships from diWordReadingScript at connect time;
    // moving it here is the pack's own /add-tutoring-scaffold (L2) layer.
    audioInput: { manual_activity: true },
  },
  {
    id: 'di-math-facts',
    description: 'Live-judged Direct Instruction MATH FACT fluency ("What is 2 plus 1?"): the tutor models a printed fact aloud ("two plus one is three"), practices it together, then asks the child and judges the spoken number-word answer. The child SEES the printed problem and SPEAKS the answer aloud (voice/microphone); response time is captured silently as the fluency signal — no visible timer. Perfect for kindergarten and grade 1 fact fluency: addition within 5 or 10, doubles, make-ten pairs, take-away (subtraction) facts in the same range, cumulative mixed review of taught facts, and the counting-sequence step underneath them (see a number, say the number that comes next). ESSENTIAL for K/G1 MATHEMATICS operations — spoken fact fluency and number-word production for early learners.',
    constraints: 'Requires microphone + live audio tutor. Addition and subtraction facts within 10 only, plus the next-number counting step — NO multiplication, division, or multi-digit problems. Use a dedicated counting primitive when COUNTING ITSELF is the objective (counting objects, one-to-one correspondence, counting past 10); this pack drills only the say-the-next-number step as fluency. The manifest must NOT supply specific facts; the scoped pool builds problems from the objective (within 5 / within 10 / doubles / make ten) and attaches number words + ASR aliases in code. The printed problem is the stimulus and the spoken number word is the answer: the answer never appears on screen before the child says it.',
    // L1 eval modes — task identities, all within the benched number-word
    // response class (the produced audio is a spoken number in every mode), so
    // the ladder needed no new bench sitting. β mirrors backend
    // problem_type_registry.py → "di-math-facts". Ordered easiest → hardest.
    // Deferred: G3 `multiplication_fact` (pack is curriculum-fit at K/G1 only —
    // needs its own fit probe + grade gate) and missing-addend (queued at L4).
    evalModes: [
      {
        evalMode: 'counting_next',
        label: 'The Number After',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['counting_next'],
        description: 'See a number, say the number that comes next — the rote counting sequence underneath counting on.',
      },
      {
        evalMode: 'answer_fact',
        label: 'Answer a Fact',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['answer_fact'],
        description: 'See one printed addition fact, say the answer as a number word — modeled and guided first, then answered alone.',
      },
      {
        evalMode: 'fact_review',
        label: 'Fact Review (Mixed Set)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['fact_review'],
        description: 'Cumulative / spaced review — answer already-taught facts drawn as a wide mix across the whole grade range, not one focused set.',
      },
      {
        evalMode: 'subtraction_fact',
        label: 'Take-Away Fact',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['subtraction_fact'],
        description: 'See one printed subtraction fact, say the difference as a number word. Same range as the addition facts; counting back is a legitimate route.',
      },
    ],
    supportsEvaluation: true,
    // Misconception Loop gate 3 — family ruling, see the module docblock.
    misconceptionScope: 'primitive',
    // Same judged-loop engine, same transport need (see di-letter-sounds).
    audioInput: { manual_activity: true },
    // L2 tutoring block — hand-authored (DI "custom-made" rule: exact wording is
    // the pedagogy). Moved here from diMathFactsScript at the L2 layer so both
    // connect paths (standalone fallback + lesson auth/switch) resolve it from
    // the catalog, the single source of truth. Sentinel discipline: no struggle
    // response or scaffolding line begins with "Yes" or "My turn" — the engine's
    // sentence-scoped verdict scan must never see a phantom opener. The per-item
    // judging contract still lives in diMathFactsScript (bench-proven wording);
    // this block is the session-level frame around it.
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction math-facts practice for a young learner '
        + '(current task: {{challengeType}}). You speak the exact scripted lines from each bracketed '
        + 'application message and judge each learner attempt from the audio you heard, using only '
        + 'the two allowed reply branches.',
      // Stimulus-side only. The answer (answerWord / solvedDisplay) is deliberately
      // absent: the tutor already receives it inside each [DI_ITEM] judging
      // contract, and RUNTIME STATE is echoed far more loosely than a scripted line.
      contextKeys: ['challengeType', 'display', 'problem', 'facts'],
      scaffoldingLevels: {
        level1: 'Repeat the question once, slowly.',
        level2: 'Model the whole fact, then ask for one retry.',
        level3: 'Accept the attempt warmly and continue as instructed.',
      },
      commonStruggles: [
        {
          pattern: 'Says a different number that is near the answer — "four" for a fact that makes five',
          response: 'Treat it as wrong and correct it: re-state the whole fact, then ask for it once more.',
        },
        {
          pattern: 'Counts out loud but never lands on a final number',
          response: 'Let the counting finish, then ask once for the number they ended on.',
        },
        {
          pattern: 'Repeats the problem back instead of answering it',
          response: 'State the whole fact once yourself, then ask again for the number that finishes it.',
        },
        {
          pattern: 'Echoes a number straight out of the problem as the answer — most often the LAST number heard ("2 + 1" answered "one")',
          response: 'Name their number and contrast it with the right one, so they hear that theirs was the wrong quantity rather than just hearing the fact again.',
        },
        {
          pattern: 'Stays silent after "Your turn"',
          response: 'Say the whole fact together once, then hand it back to them alone.',
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
            + 'sentence with those words — even excited praise like "Yes!" outside the affirmation line is '
            + 'forbidden. Judge honestly from the audio: affirm the right number, correct a wrong or missing '
            + 'one. EVERY correction re-models the whole fact and begins with "My turn". Do not praise to be '
            + 'kind. The application decides which fact comes next; never introduce one yourself.',
        },
        {
          title: 'NUMBER WORDS',
          instruction:
            'Always say numbers as words ("two plus one is three"), never as digits or symbols — read '
            + '"2 + 1" aloud as "two plus one", "3 - 1" as "three minus one", and "5 →" as "the number '
            + 'after five". The learner answers with a spoken number word; affirm a '
            + 'correct answer whether it came instantly, with young-child pronunciation (like "free" for '
            + 'three), or after counting out loud to reach it. You are judging the SOUND you heard, so a '
            + 'word that sounds like the target number IS the target number ("won" is one, "too" is two, '
            + '"for" is four, "ate" is eight) — but a DIFFERENT number is always wrong and gets the '
            + 'correction branch.',
        },
        {
          title: 'BREVITY',
          instruction:
            'Speak only the exact quoted lesson text. Never narrate judging, scoring, or application state. '
            + 'Keep pacing brisk: no filler, no chit-chat. Never mention time or speed — practice stays warm '
            + 'and unhurried out loud even though the learner is building quickness.',
        },
      ],
    },
  },
  {
    id: 'di-sentence-reading',
    description: 'Live-judged Direct Instruction SENTENCE READING (connected text): the tutor models a printed short sentence read fluently ("Listen: The cat sat."), reads it together with the child, then asks the child to read it alone and judges the spoken audio WORD BY WORD — a skipped, added, or swapped word is corrected, not waved through. The child SEES the printed sentence and READS it aloud (voice/microphone). Perfect for kindergarten through grade 2 reading accuracy and fluency on short decodable sentences: reading fully sound-it-out CVC sentences (blending carried into connected text), reading sentences that carry irregular high-frequency sight words which must be recognised whole, and cumulative spaced review of sentences already taught. ESSENTIAL for K/G1/G2 early reading — the rung above single-word decoding, where reading accuracy first becomes measurable.',
    constraints: 'Requires microphone + live audio tutor. Short DECODABLE sentences of 3-8 words only — the 8-word ceiling is the benched limit for reliable one-word-error detection, and longer connected text is unverified. Short-vowel CVC vocabulary plus starter sight words; NO digraphs, blends, or multisyllable words. Use read-aloud-studio instead for LONGER passages, words-per-minute tracking, or expression/dialogue practice with older readers — this pack owns judged accuracy on short sentences and produces graded evidence, which read-aloud-studio (student self-assessment only) does not. Use a single-word primitive (di-word-reading) when reading ONE word is the objective; this pack always reads connected text. The manifest must NOT supply specific sentences; the menu-scoped generator selects them from the objective (phonics pattern or sight-word focus) and attaches word counts/rewards in code. The printed sentence is the answer: no pictures or audio pre-cues beyond the scripted model line.',
    // L1 eval modes (2026-07-25) — task identities, all within the benched
    // response class (a printed 3-8 word sentence read aloud), so the ladder
    // needed no new bench sitting and every mode reads through the identical
    // bench-proven cue lines. A mode changes WHICH POOL is drawn, i.e. which
    // reading skill the item exercises. β mirrors backend
    // problem_type_registry.py → "di-sentence-reading". Ordered easiest →
    // hardest; `read_sentence` keeps its L0 β of 3.0 unchanged.
    // Deferred by design: a LONGER-text rung (leaves the benched scope — needs
    // its own bench sitting) and a pace/expression rung (read-aloud-studio's
    // territory, and the L0 judging contract explicitly refuses to judge speed).
    evalModes: [
      {
        evalMode: 'decodable_sentence',
        label: 'Sound-It-Out Sentence',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['decodable_sentence'],
        description: 'Read a sentence in which every content word is a sound-it-out CVC word — blending carried from single words into connected text. Phonics transfer, no irregular words to recall.',
      },
      {
        evalMode: 'read_sentence',
        label: 'Read a Sentence',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['read_sentence'],
        description: 'See one printed short sentence, read it aloud — every word, in order. Modeled and read together first, then read alone and judged for accuracy. The base skill over mixed vocabulary.',
      },
      {
        evalMode: 'sentence_review',
        label: 'Sentence Review (Mixed Set)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['sentence_review'],
        description: 'Cumulative / spaced review — re-read sentences of the kind already taught, drawn as a wide mix across every vowel pattern and word type rather than one focused set.',
      },
      {
        evalMode: 'sight_phrase_sentence',
        label: 'Sight-Word Sentence',
        beta: 4.0,
        scaffoldingMode: 4,
        challengeTypes: ['sight_phrase_sentence'],
        description: 'Read a sentence carrying several irregular high-frequency words ("You can see my dog.") — words that cannot be sounded out and must be recognised whole inside connected text.',
      },
    ],
    supportsEvaluation: true,
    // Misconception Loop gate 3 — family ruling, see the module docblock.
    misconceptionScope: 'primitive',
    // Same judged-loop engine, same transport need (see di-letter-sounds).
    audioInput: { manual_activity: true },
    // Tutoring block — hand-authored (DI "custom-made" rule: exact wording is
    // the pedagogy). The DI family's justified departure from the L0 "defer the
    // tutoring block" default: the mechanism IS the in-band judging contract,
    // so the generic tutor cannot run this primitive at all. It shipped in the
    // CATALOG at birth (rather than in the script, as the two older reading
    // packs did) because the family lesson-mode wiring already resolves both
    // connect paths from here — so lesson mode worked on day one instead of
    // waiting for /add-tutoring-scaffold.
    // L2 (2026-07-25) added what birth deliberately left out: contextKeys, the
    // {{challengeType}} placeholder they make safe (an unfilled key renders
    // SILENTLY, so the placeholder could not ship before its key), and
    // commonStruggles. The bench-proven aiDirectives are untouched, byte for
    // byte. Sentinel discipline re-checked on the new copy: no struggle
    // response or scaffolding line begins with "Yes" or "My turn" — the
    // engine's sentence-scoped verdict scan must never see a phantom opener.
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction sentence-reading practice for a beginning reader '
        + '(current task: {{challengeType}}). You speak the exact scripted lines from each bracketed '
        + 'application message and judge each learner attempt from the audio you heard, using only '
        + 'the two allowed reply branches.',
      // Unlike the sibling packs, EVERY key here is legitimately shareable. In
      // di-math-facts the answer (`answerWord`/`solvedDisplay`) is deliberately
      // kept out of RUNTIME STATE, because RUNTIME STATE is echoed far more
      // loosely than a scripted line. Here the printed sentence IS both the
      // stimulus and the target — the tutor must have it to model it, and it is
      // already on the child's screen — so there is no answer to withhold.
      contextKeys: ['challengeType', 'text', 'wordCount', 'sentences', 'supportTier'],
      // L3 note: level 1 used to say "Read the sentence once more, slowly." —
      // which at the `hard` tier would have read aloud the very sentence the
      // tier withheld, undoing it through the scaffolding channel (the tier
      // gotcha: hidden on screen, revealed by the tutor = only half applied).
      // Levels 2 and 3 are safe unchanged because they describe what happens
      // AFTER an attempt, and a correction re-models at every tier by design.
      scaffoldingLevels: {
        level1: 'Ask for one more try, unhurried.',
        level2: 'Read the whole sentence, then ask for one retry.',
        level3: 'Accept the attempt warmly and continue as instructed.',
      },
      // Observable behaviours from the standing-gate bench sitting and the two
      // live runs. The first two are the pack's signature error classes; the
      // middle two protect against OVER-correcting a child who actually read it.
      commonStruggles: [
        {
          pattern: 'Pauses in the middle of a sentence, so the attempt sounds finished before it is',
          response: 'Let the pause run and wait for the rest of the sentence — judge only the whole reading.',
        },
        {
          pattern: 'Leaves out a small word ("the", "a", "is") and reads the rest correctly',
          response: 'Treat the dropped word as a miss and correct it — a skipped word is the error this practice exists to catch, however small.',
        },
        {
          pattern: 'Stumbles on a word, then goes back and fixes it without help',
          response: 'That is a correct reading — affirm it, because self-correction is the skill, not a fault.',
        },
        {
          pattern: 'Reads word by word, slowly and without phrasing, but every word is right',
          response: 'Count it correct and move on — accuracy is what is being judged here, never speed.',
        },
        {
          pattern: 'Reads a near-neighbour word ("hen" for "pen", "hut" for "hat") and keeps going',
          response: 'A different word is a different word: re-read the whole sentence and ask for it again.',
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
            + 'sentence with those words. Judge honestly from the audio: affirm an accurate read, correct a '
            + 'misread one. EVERY correction re-reads the whole sentence and begins with "My turn". Do not '
            + 'praise to be kind. The application decides which sentence comes next; never introduce one '
            + 'yourself, and never invent a sentence of your own.',
        },
        {
          title: 'CONNECTED TEXT',
          instruction:
            'The target is a printed SENTENCE read aloud. When you model it, read it at an unhurried but '
            + 'natural pace — that is the fluent reading the learner copies, so never spell it, never sound '
            + 'it out word-by-word, and never explain what it means. Judge the learner on ACCURACY: every '
            + 'word, in order. A learner who reads slowly, or who stumbles and then fixes it themselves, read '
            + 'it correctly. A learner who swaps, skips, or adds a word did not — say so, however small the '
            + 'word, because a dropped word is exactly what this practice exists to catch. A pause in the '
            + 'middle of a sentence is part of one reading: wait for the whole sentence before judging it. '
            + 'Some items deliberately give you NOTHING to read first — when the quoted text is only the '
            + 'instruction to the learner, that learner is reading cold on purpose: say nothing else aloud '
            + 'before they read, and never preview the sentence for them.',
        },
        {
          title: 'BREVITY',
          instruction:
            'Speak only the exact quoted lesson text. Never narrate judging, scoring, or application state. '
            + 'Keep pacing brisk: no filler, no chit-chat, and no greeting before the first scripted line.',
        },
      ],
    },
  },
];
