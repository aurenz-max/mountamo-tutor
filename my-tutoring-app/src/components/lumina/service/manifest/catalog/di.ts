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
import { DI_DEDUCTION_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diDeductionModes';
import { DI_DICE_ROLL_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diDiceRollModes';
import { DI_LETTER_SOUNDS_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diLetterSoundsModes';
import { DI_MATH_FACTS_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diMathFactsModes';
import { DI_SENTENCE_READING_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diSentenceReadingModes';
import { DI_SHAPES_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diShapesModes';
import { DI_SPOKEN_PRACTICE_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diSpokenPracticeModes';
import { DI_WORD_READING_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diWordReadingModes';
import { DI_WORKED_PROCEDURE_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diWorkedProcedureModes';

export const DI_CATALOG: ComponentDefinition[] = [
  {
    id: 'di-letter-sounds',
    description: 'Live-judged Direct Instruction for continuous letter SOUNDS (not letter names): the tutor models a sound like /mmm/ as in "moon", practices it together, then asks the child to say it and judges the spoken audio. The child SPEAKS each sound aloud (voice/microphone). Perfect for kindergarten phonemic awareness and letter-sound correspondence. ESSENTIAL for K phonics / early reading foundations — grapheme-to-phoneme mapping for pre-readers. Also drills first-sound (onset) isolation from a spoken word and cumulative spaced review of taught sounds.',
    constraints: 'Requires microphone + live audio tutor. Continuous (stretchable) sounds and short vowels only — NOT letter names, digraphs, blends, or stop consonants. The manifest must NOT supply specific letters; the menu-scoped generator selects target letters from the objective and attaches keywords/pictures in code.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    // L1 eval modes — task identities, all within the benched continuant response
    // class (the produced audio is a held sound in every mode). β mirrors backend
    // problem_type_registry.py → "di-letter-sounds". Ordered easiest → hardest.
    evalModes: DI_LETTER_SOUNDS_EVAL_MODES,
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
      // Stimulus-side only — the target sound reaches the tutor inside each
      // [DI_ITEM] judging contract, never through RUNTIME STATE. `supportTier`
      // (L3) is the tier the cue is composed at, so the tutor's own scaffolding
      // channel stays tier-aware — at `hard` nothing may say, stretch, or model
      // the target sound before the learner's attempt.
      contextKeys: ['challengeType', 'letter', 'keyword', 'letters', 'supportTier'],
      // L3 tier audit (2026-08-01): like di-math-facts, NO rewording was needed.
      // Level 1 repeats the PROMPT — the ask the tutor just spoke ("Your turn.
      // What sound?"), which never carries the target sound — not the model
      // line. Levels 2-3 and the sound-modeling commonStruggles below all
      // describe post-attempt (or non-attempt) remediation — correction
      // territory, which re-models at every tier by design (standing gate 3:
      // remediation is not scaffolding).
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
            + 'which item comes next; never introduce one yourself. Some items deliberately give you nothing '
            + 'to model before the ask — when the quoted text is only the "Your turn" line, the learner is '
            + 'answering cold on purpose: never say, stretch, or model the target sound before they have '
            + 'answered.',
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
    constraints: 'Requires microphone + live audio tutor. SHORT-vowel CVC words and starter sight words only — NO long-vowel or silent-e / magic-e (CVCe) words like cake, ride, or hope, and NO digraphs, blends, or multisyllable words. When the objective is the silent-e rule, long vowels, or any other pattern outside short-vowel CVC, use phonics-blender (cvce_blend), cvc-speller, or decodable-reader instead — this pack cannot serve those words and will fall back to short-vowel CVC ones. The manifest must NOT supply specific words; the menu-scoped generator selects target words from the objective (phonics pattern or sight-word set) and attaches graphemes/rewards in code. The printed word is the answer: no pictures or audio pre-cues before the child reads.',
    // reader: 'none' — the printed word IS the target skill, not incidental load, and the
    // DI script models it aloud (model → lead → test) before the child is ever asked to
    // read it alone. Nothing on the child's path requires unaided reading to advance.
    affordances: { representation: 'symbolic', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    // L1 eval modes (2026-08-04): same spoken single-word response class;
    // modes differ by code-owned word pool and review identity.
    // β mirrors backend problem_type_registry.py → "di-word-reading".
    evalModes: DI_WORD_READING_EVAL_MODES,
    supportsEvaluation: true,
    // Misconception Loop gate 3 — family ruling, see the module docblock.
    misconceptionScope: 'primitive',
    // Same judged-loop engine, same transport need (see di-letter-sounds).
    audioInput: { manual_activity: true },
    // L2 tutoring block (2026-08-03) — hand-authored (DI "custom-made" rule:
    // exact wording is the pedagogy). Moved here from diWordReadingScript at the
    // L2 layer so both connect paths (standalone fallback + lesson
    // auth/switch_primitive) resolve it from the catalog, the single source of
    // truth. The cue lines and per-item judging contract stay in
    // diWordReadingScript (bench-proven wording, byte-frozen); this block is the
    // session-level frame around them. Sentinel discipline re-checked on all the
    // new copy: no scaffolding level, struggle response, or directive sentence
    // begins with "Yes" or "My turn" — the engine's sentence-scoped verdict scan
    // must never see a phantom opener.
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction word-reading practice for a beginning reader '
        + '(current task: {{challengeType}}). You speak the exact scripted lines from each bracketed '
        + 'application message and judge each learner attempt from the audio you heard, using only '
        + 'the two allowed reply branches.',
      // Follows the SENTENCE precedent, not math's: the printed word is the
      // stimulus and the target at once — the tutor must have it to model it,
      // and the child is already looking at it — so there is no answer side to
      // withhold, and `word` legitimately sits in RUNTIME STATE. What IS new
      // here is `words`: the whole practice list, including words not yet shown.
      // That is the sibling packs' shape (`sentences` / `letters` / `facts`) and
      // the reason the WORD READING directive below carries an explicit
      // never-preview clause.
      // `wordType` carries the branch that matters pedagogically: a decodable
      // word is BLENDED, an irregular sight word is recalled whole and must
      // never be sounded out. The handoff's fifth candidate — the graphemes /
      // sound-out blend — is deliberately NOT here: it is absent on every sight
      // word (an absent key renders the literal string "(not set)" into RUNTIME
      // STATE), it is derived rather than generated (so it can never resolve at
      // Tier-2 probe time), and the [DI_ITEM] cue already carries the blend
      // verbatim for the item in flight. RUNTIME STATE is the ambient frame,
      // not a second copy of the script.
      contextKeys: ['challengeType', 'word', 'wordType', 'words'],
      // Ported from the L0 block unchanged, and re-audited against the pack's
      // pre-read rule ("no audio pre-cues before the child reads"). Level 1
      // repeats the PROMPT — "Your turn. What word?", which never carries the
      // word — not the model line. Levels 2-3 describe what happens AFTER an
      // attempt: correction territory, which re-models at every tier by design
      // (standing gate 3 — remediation is not scaffolding). The same ruling
      // covers the word-modeling struggle responses below.
      scaffoldingLevels: {
        level1: 'Repeat the prompt once, slowly.',
        level2: 'Model the word (sound it out if decodable), then ask for one retry.',
        level3: 'Accept the attempt warmly and continue as instructed.',
      },
      // Observable behaviours only. The first is this pack's signature error
      // class and the one real risk the waived bench gate deferred here
      // (near-neighbour over-affirmation: matt/mat, son/sun, read/red,
      // sea/see); the last protects against OVER-correcting a child who
      // actually read the word, which the strict contract makes the live risk
      // in the other direction.
      commonStruggles: [
        {
          pattern: 'Reads a close-sounding DIFFERENT word — "matt" for "mat", "son" for "sun", "read" for "red"',
          response: 'A different word is a different word: correct it and re-model the target, however close it sounded.',
        },
        {
          pattern: 'Spells the word with letter NAMES ("see-ay-tee") instead of reading it',
          response: 'Say that letters have a name and a sound, sound the word out yourself, then ask for the whole word.',
        },
        {
          pattern: 'Sounds the word out but stops before saying it fast — "sss-aaa-mmm" with no whole word at the end',
          response: 'Treat the blend alone as unfinished: re-model the sound-out ending in the whole word, then ask what word it is.',
        },
        {
          pattern: 'Sounds it out slowly first and then says the whole word correctly',
          response: 'That is a correct read — affirm it, because blending out loud is the skill at this stage, not a fault.',
        },
        {
          pattern: 'Stays silent after "Your turn. What word?"',
          response: 'Read the word together once, then hand it back to them alone.',
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
            + 'sentence with those words. Judge honestly from the audio: affirm a real read of the target word; '
            + 'correct a wrong, missing, or different word. EVERY correction re-models the word (sounding it '
            + 'out when the correction line does) and begins with "My turn". Do not praise to be kind. The '
            + 'application decides which word comes next; never introduce one yourself.',
        },
        {
          title: 'WORD READING',
          instruction:
            'The target is a whole printed word read aloud. A hyphenated stretch like "sss-aaa-mmm" is a '
            + 'slow sound-out blend: say each sound smoothly and then the whole word fast. Never spell with '
            + 'letter names. Affirm a correct read whether it was fluent or sounded out first — but judge the '
            + 'FINAL word strictly: a close-sounding different word (like "son" for "sun" or "read" for "red") '
            + 'is wrong and gets the correction branch. The practice word list in your runtime state is '
            + 'background only: the child must READ each word off the screen, so never say a word aloud before '
            + 'the quoted lesson text for that word asks you to, and never preview a word that is still coming.',
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
    id: 'di-math-facts',
    description: 'Live-judged Direct Instruction MATH FACT fluency ("What is 2 plus 1?"): the tutor models a printed fact aloud ("two plus one is three"), practices it together, then asks the child and judges the spoken number-word answer. The child SEES the printed problem and SPEAKS the answer aloud (voice/microphone); response time is captured silently as the fluency signal — no visible timer. Perfect for kindergarten and grade 1 fact fluency: addition within 5 or 10, doubles, make-ten pairs, take-away (subtraction) facts in the same range, cumulative mixed review of taught facts, and the counting-sequence step underneath them — see a number, say the number that comes next, all the way to 120 (decade transitions like "39 → forty" and compound numerals like "one hundred seven"). ALSO serves pure NUMERAL RECOGNITION AND NAMING: the child sees one printed numeral ("7") and says its name aloud ("seven"), with no computation and no sequence — the primitive for K.CC.3-style "recognize and name the written numbers 1 through 10" objectives, where the child must PRODUCE the number name rather than point at a match. NOT for identifying the SIGNS themselves: an objective like "identify the minus sign and the equals sign" or "recognize + and = as math symbols" is served by a symbol-introduction or equation-building block, never by this pack — every mode here has the child compute or name a NUMBER, so a sign-identification objective gets no assessment from it. ESSENTIAL for K/G1 MATHEMATICS operations — spoken fact fluency and number-word production for early learners.',
    constraints: 'Requires microphone + live audio tutor. Addition and subtraction facts within 10 only — NO multiplication, division, or multi-digit arithmetic. The next-number counting step reaches 120 (a G1 "counting forward within 120" objective is served with a session windowed near the top of its range). Use a dedicated counting primitive when COUNTING ITSELF is the objective (counting objects, one-to-one correspondence); this pack drills only the say-the-next-number step as fluency. That carve-out is about COUNTING, not about numerals: naming a written numeral aloud is a recognition/production task with no counting in it, and IS served here. Likewise NOT for objectives asking the child to identify, name, or point at a printed OPERATOR or relational symbol (+, -, =): none of this pack\'s modes test symbol recognition — only numeral naming and fact computation — so a sign-identification objective needs a different primitive\'s introduce/apply block, not this one. The manifest must NOT supply specific facts; the scoped pool builds problems from the objective (within 5 / within 10 / within 120 counting / doubles / make ten) and attaches number words + ASR aliases in code. The printed problem is the stimulus and the spoken number word is the answer: the answer never appears on screen before the child says it.',
    affordances: { representation: 'symbolic', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 4 },
    // L1 eval modes — task identities, all within the benched number-word
    // response class (the produced audio is a spoken number in every mode), so
    // the ladder needed no new bench sitting. β mirrors backend
    // problem_type_registry.py → "di-math-facts". Ordered easiest → hardest.
    // Deferred: G3 `multiplication_fact` (pack is curriculum-fit at K/G1 only —
    // needs its own fit probe + grade gate) and missing-addend (queued at L4).
    evalModes: DI_MATH_FACTS_EVAL_MODES,
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
      // `supportTier` (L3) is the tier the cue is composed at, so the tutor's own
      // scaffolding channel stays tier-aware — at `hard` nothing may speak the
      // fact or its answer before the learner's attempt.
      contextKeys: ['challengeType', 'display', 'problem', 'facts', 'supportTier'],
      // L3 tier audit: unlike di-sentence-reading, level 1 needed NO rewording —
      // it repeats the QUESTION, which is the stimulus already printed on the
      // child's screen, never the fact statement carrying the answer. Levels 2-3
      // are safe for the sibling pack's reason: they describe what happens AFTER
      // an attempt, and a correction re-models the whole fact at every tier by
      // design (standing gate 3 — remediation is not scaffolding). The same
      // ruling covers the commonStruggles below that model the fact: each is a
      // post-attempt (or non-attempt) remediation, i.e. correction territory.
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
            + 'kind. The application decides which fact comes next; never introduce one yourself. Some items '
            + 'deliberately give you nothing to say before the question — when the quoted text is only the '
            + '"Your turn" ask, the learner is answering cold on purpose: never say the fact or its answer '
            + 'before they have answered.',
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
            + 'correction branch. Past twenty an answer may take several words: "fifty-one", "one hundred '
            + 'seven" — read "39 →" aloud as "the number after thirty-nine". That is still ONE answer and '
            + 'it only counts when the whole number arrives: "hundred seven" and a trailing-off "one '
            + 'hundred" are incomplete, not close. A teen and its decade are different numbers however '
            + 'alike they sound — thirteen is not thirty, fourteen is not forty, seventeen is not '
            + 'seventy — so judge the number you actually heard.',
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
    id: 'di-dice-roll',
    affordances: { representation: ['concrete', 'pictorial'], reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    description:
      'Live-judged Direct Instruction DICE practice: the child taps one or two dice to roll, looks at the '
      + 'pip patterns, and answers aloud while the tutor judges the spoken response in-band. Supports three '
      + 'distinct early-math skills: recognize/count one die, compare two visible quantities by saying left, '
      + 'right, or same, and add two dice by saying the total. Builds one-to-one counting, dice-pip quantity '
      + 'recognition, comparison, early subitizing, and concrete addition without printing the answer first. '
      + 'Perfect for ages 3-7, Pre-K through grade 1 early mathematics.',
    constraints:
      'Requires microphone + live audio tutor. Use standard six-sided dice with approved pip layouts only; '
      + 'no numeral faces or polyhedral dice. count_pips uses one die; compare_dice and sum_two_dice use two. '
      + 'Generate 3-6 controlled challenges per session and render from each challenge\'s own type in blended '
      + 'or mixed runs. The generator owns every finalized face value (1-6), relation, total (2-12), and spoken '
      + 'answer. Difficulty keeps count_pips unchanged, narrows non-tie comparison gaps from 3 to 2 to 1, and '
      + 'lengthens the right-die count-on path while preserving each addition total. Does not yet support choosing '
      + 'dice to make a target, matching a built quantity, or roll-until probability.',
    // L1 ladder (2026-09-03, /add-eval-modes). All three identities use
    // already-benched DI response classes: number_word_to_20 for count/sum and
    // short_spoken_word for left/right/same. β mirrors the backend registry.
    // Count is one concrete quantity; compare adds relational attention across
    // two sets; sum composes both sets and may produce totals through twelve.
    evalModes: DI_DICE_ROLL_EVAL_MODES,
    supportsEvaluation: true,
    // Misconception Loop gate 3 — family ruling, see the module docblock.
    misconceptionScope: 'primitive',
    // The live tutor judges the child's number word inside the manual turn.
    audioInput: { manual_activity: true },
    // DI-native birth exception: exact cue wording and in-band judgment are the
    // mechanism, so the generic tutor cannot execute this primitive safely.
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction dice practice (current task: {{challengeType}}; '
        + 'support tier: {{supportTier}}; interaction: {{interaction}}). Speak only the exact scripted lines in each bracketed '
        + 'application message and judge the learner\'s spoken number or comparison word from the audio you heard.',
      // Answer-safe runtime state only. The die value, number word, aliases, and
      // expected answer remain inside the per-item judging contract.
      contextKeys: ['challengeType', 'supportTier', 'interaction'],
      scaffoldingLevels: {
        level1: 'Repeat only the item\'s exact scripted question, then wait; never add an unscripted strategy.',
        level2: 'Use the item\'s exact tier-aware correction line, then wait. The line already contains all support allowed at the current supportTier.',
        level3: 'Use the exact tier-aware model-and-retry correction and continue only when the application instructs you; never supplement it with easier-tier help.',
      },
      commonStruggles: [
        {
          pattern: 'Loses one-to-one correspondence by skipping a pip or touching the same pip twice',
          response: 'Use only the item\'s exact tier-aware correction branch. It supplies touch-each-dot language only when the active support tier allows it.',
        },
        {
          pattern: 'Guesses a number immediately without inspecting or counting the pips',
          response: 'Judge the spoken number honestly; if it is wrong, use the exact tier-aware correction branch without adding an easier-tier strategy.',
        },
        {
          pattern: 'Recounts repeatedly, changes the answer, or never lands on one final number',
          response: 'Wait for a final number; judge the last completed count, and use only the scripted correction if no final number arrives.',
        },
        {
          pattern: 'Compares the physical position of the dice instead of matching their pip quantities',
          response: 'Use only the exact tier-aware comparison correction, then ask for left, right, or same again.',
        },
        {
          pattern: 'Counts each die correctly but states one face instead of the combined total',
          response: 'Use only the exact tier-aware addition correction before re-eliciting the total; never append an easier-tier count-on hint.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [DICE_ITEM], [DICE_MOVE_ON], or [DICE_COMPLETE] contain the only lesson words '
            + 'you may speak. Never speak the bracketed tag or invent wording. Use the exact quoted branch '
            + 'for the audio actually heard: an affirmation begins with "Yes"; every correction begins with '
            + '"My turn". Never begin any other sentence with those verdict words. The application alone '
            + 'chooses and advances items.',
        },
        {
          title: 'JUDGE THE CURRENT DICE TASK',
          instruction:
            'For count and sum, judge the learner\'s final spoken number; counting aloud and ending on the '
            + 'correct quantity is correct. For compare, accept the scripted left/right/same equivalents only. '
            + 'Never say a die value, total, or correct relation before the learner attempts it unless the '
            + 'application\'s exact quoted correction line models it after an incorrect or missing answer.',
        },
        {
          title: 'EXACT CUES AND BREVITY',
          instruction:
            'Speak only the exact quoted cue or judging line, then stop and wait. Never narrate the die state, '
            + 'count the pips for the learner, reveal an upcoming value, explain scoring, or add praise, hints, '
            + 'filler, or chit-chat outside the scripted line.',
        },
        {
          title: 'SUPPORT TIER STAYS SCRIPT-OWNED',
          instruction:
            'RUNTIME STATE names the current supportTier, but each [DICE_ITEM] correction already contains '
            + 'the complete strategy allowance for that tier. Easy may name the explicit one-to-one strategy; '
            + 'medium gives one brief reminder; hard re-models and immediately re-asks. Never add support from '
            + 'a different tier or change how the spoken answer is judged.',
        },
      ],
    },
  },
  {
    id: 'di-shapes',
    description: 'Live-judged Direct Instruction SHAPE PRACTICE over voice: the tutor shows one drawn 2D shape, models the answer aloud ("this shape is a triangle" / "this shape has three sides"), practices it together, then asks the child and judges the spoken answer from the audio. Two kinds of ask — NAME the shape ("What shape is this?") and COUNT its attributes ("How many sides does this shape have?", "How many corners?"). The child SEES the drawn shape and SPEAKS the answer aloud (voice/microphone); shapes appear at varied rotations so naming is orientation-independent. Perfect for kindergarten and grade 1 geometry: correctly naming circles, triangles, squares, rectangles, and hexagons regardless of orientation or size, plus ovals, pentagons, rhombuses, and trapezoids when the objective names them, and counting the sides and corners (vertices) of straight-sided shapes to confirm what they are. ESSENTIAL for K/G1 MATHEMATICS geometry — 2D shape identification, naming, and side/vertex counting for early learners.',
    constraints: 'Requires microphone + live audio tutor. FLAT 2D shapes only — NO 3D solids (spheres, cubes, cones, cylinders) and no composing, decomposing, or building shapes from other shapes; use a geometry primitive when composing IS the objective. Side and corner counting ARE supported (count_sides / count_corners), on straight-sided shapes only — a curved shape carries no side count, so a circles-and-ovals objective routes to naming. The manifest must NOT supply specific shapes; the menu-scoped generator selects target shapes from the objective and draws them in code at varied rotations. The drawn shape is the stimulus and the spoken answer is the answer: neither the shape name nor its side/corner count ever appears on screen (or in the title/description) before the child says it.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    // L1 ladder (2026-08-07, /add-eval-modes). Four task identities over ONE
    // stage. Two response classes, BOTH already benched, so no new sitting was
    // owed under standing gate 1: naming is the single-spoken-word class, and
    // the counting answer is a number word in 3..6 — the #46 class, and short
    // of the multi-word numerals that gated item 10 (the menu tops out at a
    // hexagon). β mirrors backend problem_type_registry.py → "di-shapes".
    //
    // ORDERING RATIONALE (β, easiest → hardest): naming one shape is a single
    // recall (1.5); reviewing names over a wide cumulative draw is the same act
    // with an unpredictable pool (2.5 — the β both sibling packs' review modes
    // use); counting sides is a NEW act — attend to an attribute, enumerate,
    // speak a number (3.0); counting corners is harder than counting sides
    // because a vertex is a point-percept, easier to skip or double-count than
    // a whole traceable edge (3.5).
    //
    // Curriculum homes MEASURED, not assumed — /curriculum-fit 2026-08-07:
    // naming → K GEOM001-01-A "Match and name basic 2D shapes … regardless of
    // size, color, or orientation" (0.795); counting → G1 GEOM001-01-b "Count
    // the number of sides and vertices of various 2D shapes" (0.785) and
    // K GEOM001-02-A "…based on their attributes (sides and vertices)" (0.786).
    evalModes: DI_SHAPES_EVAL_MODES,
    supportsEvaluation: true,
    // Misconception Loop gate 3 — family ruling, see the module docblock.
    misconceptionScope: 'primitive',
    // Same judged-loop engine, same transport need (see di-letter-sounds).
    audioInput: { manual_activity: true },
    // Tutoring block — hand-authored (DI "custom-made" rule), in the CATALOG at
    // birth per the family lesson-mode wiring (di-sentence-reading precedent),
    // so lesson mode works on day one. Sentinel discipline checked on every
    // line: no scaffolding level, struggle response, or directive sentence
    // begins with "Yes" or "My turn". RUNTIME STATE is deliberately minimal —
    // the ANSWERS are the shape names (naming modes) and the side/corner counts
    // (counting modes), so neither the current shape, the session's shape list,
    // nor any count may enter contextKeys (the math-facts answer-side rule,
    // stricter here because the answer is a single word). `challengeType` names
    // only the ASK, and the COMPONENT sends the CURRENT item's identity so a
    // blended session never leaves it stale. `supportTier` (L3) is the tier the
    // cue is composed at — not an answer, and load-bearing: at `hard` the script
    // hands the tutor nothing to say before the ask, so the tier is what tells
    // it that the silence is deliberate rather than a missing line.
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction shape practice for a young learner '
        + '(current task: {{challengeType}} — either naming a drawn shape or counting its sides or '
        + 'corners). You speak the exact scripted lines from each bracketed '
        + 'application message and judge each learner attempt from the audio you heard, using only '
        + 'the two allowed reply branches.',
      contextKeys: ['challengeType', 'supportTier'],
      // These are POST-attempt remediation, so a support tier does NOT withdraw
      // them (standing gate 3 — DISTAR always re-models on an error; remediation
      // is not scaffolding). level2 says "model the answer" rather than "the way
      // the script did": at the `hard` tier the script models nothing before the
      // ask, so a back-reference to a model line would point at silence.
      scaffoldingLevels: {
        level1: 'Repeat the question once, slowly.',
        level2: 'Model the answer once yourself, then ask for one retry.',
        level3: 'Accept the attempt warmly and continue as instructed.',
      },
      commonStruggles: [
        {
          pattern: 'Names a close DIFFERENT shape — "rectangle" for a square, "circle" for an oval, "pentagon" for a hexagon',
          response: 'A different shape name is a different shape: name theirs and contrast it with the right one, so they hear that their word was for another shape.',
        },
        {
          pattern: 'Describes the shape instead of naming it — "it\'s round", "the pointy one", a color or size word',
          response: 'Acknowledge the description in a word, then model the name and ask for the shape\'s name.',
        },
        {
          pattern: 'Says the name with young-child pronunciation — "twiangle", "wectangle"',
          response: 'That is the right name said the way young children say it — affirm it as correct.',
        },
        {
          pattern: 'Stays silent after "Your turn"',
          response: 'Say the answer together once, then hand it back to them alone.',
        },
        {
          pattern: 'Counting task — gives a number that is off by one, usually from double-counting a corner or skipping the side they started on',
          response: 'Off by one is still the wrong count: say their number back, contrast it with the right one, and re-ask. Do not treat "close" as correct.',
        },
        {
          pattern: 'Counting task — answers with the shape NAME instead of a number ("triangle" when asked how many sides)',
          response: 'They answered a different question. Acknowledge nothing, re-model the count, and ask again for how many — the count is what this item measures.',
        },
        {
          pattern: 'Counting task — counts aloud ("one, two, three") instead of stating the total',
          response: 'Counting out loud is exactly right at this age. Wait for them to stop and judge only the number they finish on; if it is right, affirm it as correct.',
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
            + 'sentence with those words. Judge honestly from the audio: affirm the right answer, correct '
            + 'a wrong or missing one. EVERY correction re-models the answer and begins with "My turn". Do not '
            + 'praise to be kind. The application decides which shape and which question come next; never '
            + 'introduce either yourself. Some items deliberately give you nothing to say before the '
            + 'question — when the quoted text is only the "Your turn" ask, the learner is answering cold '
            + 'on purpose: never name the shape, state its count, or describe the drawing before they have '
            + 'answered.',
        },
        {
          title: 'SHAPE NAMES',
          instruction:
            'The learner answers with a spoken shape name; affirm a correct name whether it came instantly, '
            + 'with young-child pronunciation ("twiangle" for triangle, "wectangle" for rectangle), or with or '
            + 'without "a" or "an" in front. A DIFFERENT shape name is always wrong and gets the correction '
            + 'branch, however close: at this age a rectangle is not a square, a circle is not an oval, and a '
            + 'hexagon is not a pentagon — the near-name is exactly the error this practice corrects. When an '
            + 'item\'s quoted rule says another word is also correct (like "diamond" for a rhombus), accept it. '
            + 'Judge the name you actually heard, never the name you expected.',
        },
        {
          title: 'SIDE AND CORNER COUNTS',
          instruction:
            'On a counting item the learner answers with a NUMBER, not a shape name. Counting out loud is a '
            + 'correct route at this age, not hesitation: wait until they stop and judge only the number they '
            + 'finish on. A different number is wrong even by one — an off-by-one from double-counting a corner '
            + 'is precisely the error this practice corrects, so it gets the correction branch with their own '
            + 'number said back to them. A shape name, "lots", "many", or a colour is not a count and gets the '
            + 'plain re-model. Never count the sides or corners aloud yourself except inside a quoted scripted '
            + 'line — doing the counting for them replaces the thing being measured. Judge the number you '
            + 'actually heard, never the number you expected.',
        },
        {
          title: 'BREVITY',
          instruction:
            'Speak only the exact quoted lesson text. Never narrate judging, scoring, or application state. '
            + 'Keep pacing brisk: no filler, no chit-chat, and never describe the shape on screen beyond the '
            + 'scripted lines — describing its look would hand over the answer.',
        },
      ],
    },
  },
  {
    id: 'di-sentence-reading',
    description: 'Live-judged Direct Instruction SENTENCE READING (connected text): the tutor models a printed short sentence read fluently ("Listen: The cat sat."), reads it together with the child, then asks the child to read it alone and judges the spoken audio WORD BY WORD — a skipped, added, or swapped word is corrected, not waved through. The child SEES the printed sentence and READS it aloud (voice/microphone). Perfect for kindergarten through grade 2 reading accuracy and fluency on short decodable sentences: reading fully sound-it-out CVC sentences (blending carried into connected text), reading sentences that carry irregular high-frequency sight words which must be recognised whole, and cumulative spaced review of sentences already taught. ESSENTIAL for K/G1/G2 early reading — the rung above single-word decoding, where reading accuracy first becomes measurable.',
    constraints: 'Requires microphone + live audio tutor. Short DECODABLE sentences of 3-8 words only — the 8-word ceiling is the benched limit for reliable one-word-error detection, and longer connected text is unverified. Short-vowel CVC vocabulary plus starter sight words; NO digraphs, blends, or multisyllable words. Use read-aloud-studio instead for CONNECTED PASSAGES at grades 1-6, or for phrasing / character-voice practice with older readers — since its own DI port (2026-08-12) that primitive is judged too, so the fork is no longer graded-vs-ungraded: this pack owns ISOLATED short sentences drawn from a phonics or sight-word menu at K-2, and read-aloud-studio owns a passage whose lines read as one continuous text. Use a single-word primitive (di-word-reading) when reading ONE word is the objective; this pack always reads connected text. The manifest must NOT supply specific sentences; the menu-scoped generator selects them from the objective (phonics pattern or sight-word focus) and attaches word counts/rewards in code. The printed sentence is the answer: no pictures or audio pre-cues beyond the scripted model line.',
    // reader: 'none' — same derivation as di-word-reading: the tutor models the sentence,
    // reads it WITH the child, and only then tests. The print is the objective, not a gate.
    affordances: { representation: 'symbolic', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
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
    evalModes: DI_SENTENCE_READING_EVAL_MODES,
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
  {
    id: 'di-spoken-practice',
    description:
      'Live-judged Direct Instruction practice for ANY skill whose answer is one short SPOKEN word or '
      + 'phrase: the tutor asks a scripted question out loud, the child ANSWERS ALOUD (voice/microphone), '
      + 'and the tutor judges the audio in-band. The stimulus is generated per objective — printed text, a '
      + 'picture, a group of pictures to count, or nothing at all (the tutor says it). Use this when the '
      + 'skill is genuinely verbal and there is NO manipulative the child needs to touch: recall answers, '
      + 'reading a short printed item aloud, counting a group and saying how many, saying which word '
      + 'from a set the objective NAMES (longer/shorter, heavier/lighter) describes two things shown side '
      + 'by side, and — for explain / describe / tell-why objectives — saying IN THEIR OWN WORDS what a '
      + 'shown instance means or what rule it follows (what the equal sign means, the rule of a pattern), '
      + 'judged on meaning rather than wording. '
      + 'ESSENTIAL where a tutor-driven spoken loop is the right modality but no bespoke primitive exists.',
    constraints:
      'Requires microphone + live audio tutor. The answer must be 1-3 short spoken words from a CLOSED set, '
      + 'or — explain_concept only — one short IDEA (up to ten words, any wording) about a shown instance; '
      + 'never open-ended production (name any animal, make up a rhyme), never a letter NAME, and never a '
      + 'procedure or a multi-sentence explanation; the generator refuses items it cannot place in a benched '
      + 'spoken response class. Prefer the specialised pack when one exists — di-letter-sounds, di-word-reading, '
      + 'di-math-facts, di-shapes, di-sentence-reading — and prefer a bespoke primitive whenever the child '
      + 'must MANIPULATE something (counting-board, cvc-speller, push-pull-arena): this pack has no '
      + 'manipulative and cannot teach one. Counting stays at 1-10 objects.',
    // L1 eval modes — task identities by the ACT the child performs, because
    // the CONTENT is generated per objective rather than fixed by the pack.
    // β mirrors backend problem_type_registry.py → "di-spoken-practice".
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    evalModes: DI_SPOKEN_PRACTICE_EVAL_MODES,
    supportsEvaluation: true,
    misconceptionScope: 'primitive',
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction spoken practice (current task: {{challengeType}}). You speak '
        + 'the exact scripted lines from each bracketed application message and judge each learner '
        + 'attempt from the audio you heard, using only the two allowed reply branches.',
      // Stimulus-side only, mirroring di-math-facts: the answer is deliberately
      // absent (RUNTIME STATE is echoed far more loosely than a scripted line),
      // and decode sessions push no stimulus at all — there the stimulus IS the
      // answer. Keys are produced by `contextFor` in diSpokenPracticeScript.ts;
      // the two lists must stay in lockstep. An earlier revision emptied this
      // channel after a state-recitation run; user overruling 2026-08-11: the
      // generalized pack keeps the platform's full channel, and the recitation
      // root was mis-voiced struggle text below, not the channel.
      contextKeys: ['challengeType', 'stimulus'],
      scaffoldingLevels: {
        level1: 'Repeat the prompt once, slowly.',
        level2: 'Give one concrete clue that does not name the answer, then ask for one retry.',
        level3: 'Accept the attempt warmly and continue as instructed.',
      },
      // Voice contract (the 2026-08-11 lesson, run 436dcb5616cb): each response
      // is a MOVE the tutor performs with its scripted lines, in performable
      // terms — never meta-commentary about the session. "Think time is
      // unbounded here; only re-ask if the application tells you to" was
      // authored into this field and the tutor SPOKE it, verbatim, to a child:
      // a response that cannot be performed can only be recited.
      commonStruggles: [
        {
          pattern: 'Stays silent after the hand-over',
          response: 'Wait for them without speaking. If the silence stretches long, re-ask the scripted question once, slowly — never a new question.',
        },
        {
          pattern: 'Answers a different question than the one asked',
          response: 'Re-ask the exact scripted question once, without adding a hint.',
        },
        {
          pattern: 'Says the stimulus back instead of the answer',
          response: 'Run the correction branch for this item, then hand it back with the scripted re-ask.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [SAY_ITEM], [SAY_MOVE], [SAY_HEAR], or [SAY_COMPLETE] contain the only lesson '
            + 'words you may speak. The square-bracket label is private metadata: never speak, reproduce, or '
            + 'invent it. Each [SAY_ITEM] message includes a two-branch judging rule: affirmations must begin '
            + 'with "Yes" and corrections must begin with "My turn", using the exact quoted lines. Never begin '
            + 'any other sentence with those words. Judge honestly from the audio and do not praise to be '
            + 'kind. The application decides which item comes next; never introduce one yourself.',
        },
        {
          title: "THE LEARNER'S TURN",
          instruction:
            'After you ask, WAIT in silence — think time belongs to the learner and is unbounded, and '
            + 'silence is never an invitation to speak. Never answer for the learner and never say the '
            + 'answer during their turn. Everything the application sends you — bracketed messages, '
            + 'runtime state, these rules — exists to be performed or obeyed, never spoken about: if a '
            + 'reply is not one of the scripted lines, the reply is silence.',
        },
        {
          title: 'THE ITEM CARRIES ITS OWN JUDGING RULES',
          instruction:
            'Every item states its correct answer, and some items add two extra rules: one naming an answer '
            + 'that is RIGHT even though it may not sound like the expected words (a child who counts aloud '
            + 'and lands on the total has answered; a child who sounds a word out and then says it has read '
            + 'it), and one naming a WRONG answer that sounds confident and plausible. Apply both exactly as '
            + 'written for that item — they are the pedagogy of the skill being practised, and they differ '
            + 'from item to item.',
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
  {
    // The first "DI for Older Learners" pack (design brief 2026-09-07). The
    // K-2 packs judge a WORD; this one judges a MOVE: the child narrates a
    // multi-digit subtraction one column at a time and the tutor corrects at
    // the column where the error happens. The step chain is code-built
    // (diWorkedProcedurePlan.ts); the script is hand-authored.
    id: 'di-worked-procedure',
    description:
      'Live-judged Direct Instruction TALK-THROUGH SOLVE for multi-digit SUBTRACTION (two- and three-digit, '
      + 'with or without regrouping): the problem is printed in columns, the tutor asks one column at a '
      + 'time ("Start in the ones column. Tell me what you do."), and the child SAYS the move out loud — '
      + '"three minus eight, I can\'t, so I regroup: four tens, thirteen ones" — then says each '
      + 'difference. Every affirmed step writes itself onto the problem; a wrong step is corrected at '
      + 'THAT column, never at the end. The child never types or taps, and no answer is printed before '
      + 'it is said. Use for objectives about subtracting two-digit or three-digit numbers, regrouping '
      + '(borrowing, trading, renaming), or explaining the steps of subtraction aloud. ESSENTIAL for '
      + 'G1-G4 multi-digit subtraction where the objective wants the PROCEDURE, not just the answer.',
    constraints:
      'Requires microphone + live audio tutor. SUBTRACTION ONLY — no addition or carrying, no borrowing '
      + 'across a zero (300 − 148), no four-digit numbers, no decimals; both numbers have the same width. '
      + 'Two to four problems per block, each worked as 2-5 judged steps. The manifest must NOT supply '
      + 'problems: the pool builds them in code from the objective\'s number range (two-digit / within '
      + '100, three-digit / within 1000) and the regrouping mode. Prefer di-math-facts for single-digit '
      + 'facts and a manipulative primitive when the child must BUILD with base-ten blocks.',
    affordances: { representation: 'symbolic', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 6 },
    // L1 eval modes — both are the same ACT (read a column, say the move and
    // the difference); the regroup mode adds the decision that carries the
    // skill's signature errors. β mirrors backend problem_type_registry.py.
    evalModes: DI_WORKED_PROCEDURE_EVAL_MODES,
    supportsEvaluation: true,
    misconceptionScope: 'primitive',
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction talk-through subtraction (current task: {{challengeType}}; problem '
        + '{{problem}}; column open: {{column}}). You speak the exact scripted lines from each bracketed '
        + 'application message and judge each learner step from the audio you heard, using only the '
        + 'scripted reply branches.',
      // Stimulus side only: the printed problem and which column is open. The
      // answer to a step (the regrouped digits, the difference) reaches the tutor
      // inside each [WP_ITEM] judging contract, never through RUNTIME STATE.
      contextKeys: ['challengeType', 'problem', 'column', 'supportTier'],
      scaffoldingLevels: {
        level1: 'Repeat the column ask once, slowly.',
        level2: 'Model the column once more, then hand it back with the scripted re-ask.',
        level3: 'Accept the step warmly and continue as instructed.',
      },
      commonStruggles: [
        {
          pattern: 'Turns the column upside down — "eight minus three is five" where three is on top',
          response: 'Run the correction branch for this step: name what they said, model the regroup, then hand the column back.',
        },
        {
          pattern: 'Regroups but never changes the digit above — says the new ones and nothing about the tens',
          response: 'Run the forgot-to-decrement branch: say what the tens become, then hand the column back.',
        },
        {
          pattern: 'Says a bare number on a "tell me what you do" ask',
          response: 'Run the correction branch — a number with no move is not the step — then hand the column back.',
        },
        {
          pattern: 'Stays silent after the hand-over',
          response: 'Wait for them without speaking. If the silence stretches long, re-ask the scripted column question once, slowly — never a new question.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [WP_ITEM], [WP_MOVE_ON], [WP_HEAR], or [WP_COMPLETE] contain the only lesson '
            + 'words you may speak. The square-bracket label is private metadata: never speak, reproduce, or '
            + 'invent it. Each [WP_ITEM] message includes its judging rule: affirmations must begin with '
            + '"Yes" and every correction must begin with "My turn", using the exact quoted lines. Never '
            + 'begin any other sentence with those words. Judge honestly from the audio and do not praise '
            + 'to be kind. The application decides which column comes next; never continue into another '
            + 'column or another problem yourself.',
        },
        {
          title: 'WHAT COUNTS AS A STEP',
          instruction:
            'On a "tell me what you do" ask the learner must say the MOVE — regroup (they may say borrow, '
            + 'trade, or take one from the tens) with both new numbers, or the column subtracted cleanly. A '
            + 'bare number is not a step. On a "subtract the ones" ask the learner says the difference, as '
            + 'the bare number or the whole fact, right away or after counting back to it. Always say '
            + 'numbers as words, never as digits.',
        },
        {
          title: "THE LEARNER'S TURN",
          instruction:
            'After you ask, WAIT in silence — think time belongs to the learner and is unbounded. Never '
            + 'say the move or the difference during their turn, and never read the problem\'s working off '
            + 'the runtime state. Everything the application sends you exists to be performed or obeyed, '
            + 'never spoken about: if a reply is not one of the scripted lines, the reply is silence.',
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
  {
    // The second "DI for Older Learners" pack (design brief 2026-09-07,
    // concept 3). di-worked-procedure judges a MOVE; this one judges a
    // DEDUCTION: a rule card, a case card, and the child says what follows and
    // how they know. The cases are code-built from one generated rule
    // (diDeductionPlan.ts); the script is hand-authored.
    id: 'di-deduction',
    description:
      'Live-judged Direct Instruction DEDUCTIONS: a RULE card ("All insects have six legs.") and a CASE '
      + 'card ("A beetle is an insect." / "A spider does not have six legs." / "This animal has six legs."), '
      + 'and the child SAYS what the rule tells them and how they know — "so a beetle has six legs", "no, '
      + 'not an insect, because all insects have six legs and it doesn\'t", "can\'t tell, other things '
      + 'have six legs too". Three case shapes: conclude (apply the rule to a member), deny (rule a thing '
      + 'out), cannot_tell (recognize that having the property does not make it a member — the reasoning '
      + 'standard where "yes, because it has six legs" is the error). The conclusion is written under '
      + 'the cards only after the child says it; a wrong deduction is corrected on THAT case. The child '
      + 'never types or taps. Use for objectives about reasoning from a rule or generalization, using '
      + 'evidence to draw conclusions, classification rules in science (all mammals…, all insects…), '
      + 'rules in social studies, or if-then / inference reasoning in reading. ESSENTIAL for G3-G5 '
      + 'objectives that want the child to EXPLAIN a conclusion from a stated rule.',
    constraints:
      'Requires microphone + live audio tutor. ONE-RULE DEDUCTIONS ONLY — no two-rule chains or '
      + 'syllogisms with a middle term, no written justification, no probability ("most", "some"): every '
      + 'rule is a universal "All A have P" the code prints. The manifest must NOT supply rules or cases: '
      + 'the generator scopes a category, a property and short entity lists from the objective, code '
      + 'builds every case and answer, and a truth review drops any rule that is false in the world. Three '
      + 'to nine cases per block over up to four rules. Prefer di-spoken-practice for a one-word answer '
      + 'and a reading primitive when the child must find the rule in a text first.',
    // reader `none`: the tutor reads the rule on each rule's first case and
    // every case aloud, and tap-to-hear re-reads both — the child's own path
    // needs no reading after read-aloud is accounted for.
    affordances: { representation: 'symbolic', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 6 },
    // L1 eval modes — the three case SHAPES. Same act (read a rule and a case,
    // say what follows and why); the shapes are ordered by the logic they
    // demand. β mirrors backend problem_type_registry.py.
    evalModes: DI_DEDUCTION_EVAL_MODES,
    supportsEvaluation: true,
    misconceptionScope: 'primitive',
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction deductions (current case shape: {{challengeType}}; rule on screen: '
        + '{{rule}}; case on screen: {{case}}). You speak the exact scripted lines from each bracketed '
        + 'application message and judge each learner deduction from the audio you heard, using only the '
        + 'scripted reply branches.',
      // Stimulus side only: the printed rule and case. The conclusion and the
      // verdict reach the tutor inside each [DD_ITEM] judging contract, never
      // through RUNTIME STATE.
      contextKeys: ['challengeType', 'rule', 'case', 'supportTier'],
      scaffoldingLevels: {
        level1: 'Repeat the case ask once, slowly.',
        level2: 'Model the reasoning once more, then hand it back with the scripted re-ask.',
        level3: 'Accept the deduction warmly and continue as instructed.',
      },
      commonStruggles: [
        {
          pattern: 'Says yes on a can\'t-tell case — "yes, because it lays eggs" — running the rule backwards',
          response: 'Run the signature-error branch for this case: the rule does not work backwards, model the reasoning with the counterexample, then hand the case back.',
        },
        {
          pattern: 'Gives the right verdict with no reason — "no", or "no, because it\'s a spider"',
          response: 'Run the how-do-you-know branch: model the reason from the rule, then hand the case back.',
        },
        {
          pattern: 'Reads the rule back instead of answering — "all insects have six legs"',
          response: 'Run the general correction branch — the rule read back is not a conclusion — then hand the case back.',
        },
        {
          pattern: 'Stays silent after the hand-over',
          response: 'Wait for them without speaking. If the silence stretches long, re-ask the scripted case question once, slowly — never a new question.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [DD_ITEM], [DD_MOVE_ON], [DD_HEAR], or [DD_COMPLETE] contain the only lesson '
            + 'words you may speak. The square-bracket label is private metadata: never speak, reproduce, or '
            + 'invent it. Each [DD_ITEM] message includes its judging rule: affirmations must begin with '
            + '"Yes" and every correction must begin with "My turn", using the exact quoted lines. Never '
            + 'begin any other sentence with those words. Judge honestly from the audio and do not praise '
            + 'to be kind. The application decides which case comes next; never continue into another '
            + 'case or another rule yourself.',
        },
        {
          title: 'WHAT COUNTS AS A DEDUCTION',
          instruction:
            'On a "what does the rule tell you" ask the learner states the conclusion about the case in '
            + 'any words. On an "is it… how do you know" ask the learner gives a VERDICT (no, or can\'t '
            + 'tell) AND a REASON that comes from the rule; a bare verdict is half an answer, and a reason '
            + 'from outside the rule is not the reason the rule gives. Judge the meaning, not the words: '
            + 'a child\'s own phrasing counts when the idea is there. The rule read back is never an answer.',
        },
        {
          title: "THE LEARNER'S TURN",
          instruction:
            'After you ask, WAIT in silence — think time belongs to the learner and is unbounded. Never '
            + 'say the conclusion or the verdict during their turn, and never read the case\'s answer off '
            + 'the runtime state. Everything the application sends you exists to be performed or obeyed, '
            + 'never spoken about: if a reply is not one of the scripted lines, the reply is silence.',
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
