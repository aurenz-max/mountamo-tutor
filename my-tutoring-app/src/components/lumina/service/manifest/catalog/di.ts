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
import { missLists } from './missLists';
import type { SpokenWordProblemMiss, WordProblemMiss } from '../../../primitives/visual-primitives/direct-instruction/diWordProblemWorkspace';
import { diMathFactsCard } from '../../../primitives/visual-primitives/direct-instruction/diMathFacts.card';
import { diSpokenPracticeCard } from '../../../primitives/visual-primitives/direct-instruction/diSpokenPractice.card';
import { diWordReadingCard } from '../../../primitives/visual-primitives/direct-instruction/diWordReading.card';
import { diLetterSoundsCard } from '../../../primitives/visual-primitives/direct-instruction/diLetterSounds.card';
import { diSentenceReadingCard } from '../../../primitives/visual-primitives/direct-instruction/diSentenceReading.card';
import { diDiceRollCard } from '../../../primitives/visual-primitives/direct-instruction/diDiceRoll.card';
import { diDeductionCard } from '../../../primitives/visual-primitives/direct-instruction/diDeduction.card';
import { diWorkedProcedureCard } from '../../../primitives/visual-primitives/direct-instruction/diWorkedProcedure.card';
import { diShapesCard } from '../../../primitives/visual-primitives/direct-instruction/diShapes.card';
import { diWordProblemSetupCard } from '../../../primitives/visual-primitives/direct-instruction/diWordProblemSetup.card';
import { bossEntry } from '../../../components/live-activity/boss';
import { ComponentDefinition } from '../../../types';
import { DI_DEDUCTION_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diDeductionModes';
import { DI_DICE_ROLL_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diDiceRollModes';
import { DI_LETTER_SOUNDS_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diLetterSoundsModes';
import { DI_MATH_FACTS_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diMathFactsModes';
import { DI_SENTENCE_READING_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diSentenceReadingModes';
import { DI_SHAPES_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diShapesModes';
import { DI_SPOKEN_PRACTICE_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diSpokenPracticeModes';
import { DI_WORD_PROBLEM_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diWordProblemModes';
import { DI_WORD_READING_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diWordReadingModes';
import { DI_WORKED_PROCEDURE_EVAL_MODES } from '../../../primitives/visual-primitives/direct-instruction/diWorkedProcedureModes';

export const DI_CATALOG: ComponentDefinition[] = [
  {
    id: 'di-letter-sounds',
    // How it is wired to the live tutor: `diLetterSounds.card.ts` (behavior: `diLetterSounds.boss.ts`).
    ...bossEntry(diLetterSoundsCard),
    description: 'Live-judged Direct Instruction for continuous letter SOUNDS (not letter names): the child sees a printed letter and says its sound; the tutor models only a DIFFERENT letter ("My turn: lll, like leaf"), never the child\'s own, and judges the spoken audio. The child SPEAKS each sound aloud (voice/microphone). Perfect for kindergarten phonemic awareness and letter-sound correspondence. ESSENTIAL for K phonics / early reading foundations — grapheme-to-phoneme mapping for pre-readers. Also drills first-sound (onset) isolation from a spoken word and cumulative spaced review of taught sounds.',
    constraints: 'Requires microphone + live audio tutor. Continuous (stretchable) sounds, short vowels and single clipped stops (t p c k h d g b) only — NOT letter names, digraphs, or blends. The manifest must NOT supply specific letters; the menu-scoped generator selects target letters from the objective and attaches keywords/pictures in code.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    // L1 eval modes — task identities, all within the benched continuant response
    // class (the produced audio is a held sound in every mode). β mirrors backend
    // problem_type_registry.py → "di-letter-sounds". Ordered easiest → hardest.
    evalModes: DI_LETTER_SOUNDS_EVAL_MODES,
    supportsEvaluation: true,
    // Misconception Loop gate 3 — family ruling, see the module docblock.
    misconceptionScope: 'primitive',
  },
  {
    id: 'di-word-reading',
    // How it is wired to the live tutor: `diWordReading.card.ts` (behavior: `diWordReading.boss.ts`).
    ...bossEntry(diWordReadingCard),
    description: 'Live-judged Direct Instruction WORD READING (DISTAR "What word?"): the child sees a printed word and reads it aloud; the tutor models only a DIFFERENT word (sounding out a decodable CVC word, "sss-uuu-nnn… sun", or naming a sight word whole), never the child\'s own, and judges the spoken audio. The child SEES the printed word and READS it aloud (voice/microphone). Perfect for kindergarten and grade 1 decoding: short-vowel CVC word reading, blending, and high-frequency sight-word recognition. ESSENTIAL for K/G1 early reading — print-to-speech decoding for beginning readers.',
    constraints: 'Requires microphone + live audio tutor. SHORT-vowel CVC words and starter sight words only — NO long-vowel or silent-e / magic-e (CVCe) words like cake, ride, or hope, and NO digraphs, blends, or multisyllable words. When the objective is the silent-e rule, long vowels, or any other pattern outside short-vowel CVC, use phonics-blender (cvce_blend), cvc-speller, or decodable-reader instead — this pack cannot serve those words and will fall back to short-vowel CVC ones. The manifest must NOT supply specific words; the menu-scoped generator selects target words from the objective (phonics pattern or sight-word set) and attaches graphemes/rewards in code. The printed word is the answer: no pictures or audio pre-cues before the child reads.',
    // reader: 'none' — the printed word IS the target skill, not incidental load: reading
    // it is the item, not a gate in front of it. (The scripted model → lead → test that once
    // read it first is gone; the tutor models a different word, 10-02 ruling.)
    affordances: { representation: 'symbolic', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    // L1 eval modes (2026-08-04): same spoken single-word response class;
    // modes differ by code-owned word pool and review identity.
    // β mirrors backend problem_type_registry.py → "di-word-reading".
    evalModes: DI_WORD_READING_EVAL_MODES,
    supportsEvaluation: true,
    // Misconception Loop gate 3 — family ruling, see the module docblock.
    misconceptionScope: 'primitive',
  },
  {
    id: 'di-math-facts',
    // How it is wired to the live tutor: `diMathFacts.card.ts` (behavior: `diMathFacts.boss.ts`).
    ...bossEntry(diMathFactsCard),
    description: 'Live-judged Direct Instruction MATH FACT fluency ("What is 2 plus 1?"): the tutor models a DIFFERENT fact aloud ("My turn: two plus one is three"), then asks the learner their own printed fact and judges the spoken number-word answer. The child SEES the printed problem and SPEAKS the answer aloud (voice/microphone); response time is captured silently as the fluency signal — no visible timer. Perfect for kindergarten and grade 1 fact fluency: addition within 5 or 10, doubles, make-ten pairs, take-away (subtraction) facts in the same range, cumulative mixed review of taught facts, and the counting-sequence step underneath them — see a number, say the number that comes next, all the way to 120 (decade transitions like "39 → forty" and compound numerals like "one hundred seven"). ALSO serves pure NUMERAL RECOGNITION AND NAMING: the child sees one printed numeral ("7") and says its name aloud ("seven"), with no computation and no sequence — the primitive for K.CC.3-style "recognize and name the written numbers 1 through 10" objectives, where the child must PRODUCE the number name rather than point at a match. NOT for identifying the SIGNS themselves: an objective like "identify the minus sign and the equals sign" or "recognize + and = as math symbols" is served by a symbol-introduction or equation-building block, never by this pack — every mode here has the child compute or name a NUMBER, so a sign-identification objective gets no assessment from it. ESSENTIAL for K/G1 MATHEMATICS operations — spoken fact fluency and number-word production for early learners.',
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
  },
  {
    id: 'di-dice-roll',
    // How it is wired to the live tutor: `diDiceRoll.card.ts` (behavior: `diDiceRoll.boss.ts`).
    ...bossEntry(diDiceRollCard),
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
  },
  {
    id: 'di-shapes',
    // How it is wired to the live tutor: `diShapes.card.ts` (behavior: `diShapes.boss.ts`).
    ...bossEntry(diShapesCard),
    description: 'Live-judged Direct Instruction SHAPE PRACTICE over voice: the tutor shows one drawn 2D shape, asks the child, and judges the spoken answer from the audio; any model is a DIFFERENT shape ("My turn: this shape is a hexagon"), never the child\'s own. Two kinds of ask — NAME the shape ("What shape is this?") and COUNT its attributes ("How many sides does this shape have?", "How many corners?") — plus an open build: the tutor names a shape ("Make a hexagon") and the child MAKES one on a dot grid. The child SEES the drawn shape and SPEAKS the answer aloud (voice/microphone); shapes appear at varied rotations so naming is orientation-independent. Perfect for kindergarten and grade 1 geometry: correctly naming circles, triangles, squares, rectangles, and hexagons regardless of orientation or size, plus ovals, pentagons, rhombuses, and trapezoids when the objective names them, and counting the sides and corners (vertices) of straight-sided shapes to confirm what they are. ESSENTIAL for K/G1 MATHEMATICS geometry — 2D shape identification, naming, and side/vertex counting for early learners.',
    constraints: 'Requires microphone + live audio tutor. FLAT 2D shapes only — NO 3D solids (spheres, cubes, cones, cylinders) and no composing, decomposing, or building shapes from other shapes; use a geometry primitive when composing IS the objective (build_shape makes ONE shape from its corners on a dot grid, straight-sided shapes only). Side and corner counting ARE supported (count_sides / count_corners), on straight-sided shapes only — a curved shape carries no side count, so a circles-and-ovals objective routes to naming. The manifest must NOT supply specific shapes; the menu-scoped generator selects target shapes from the objective and draws them in code at varied rotations. The drawn shape is the stimulus and the spoken answer is the answer: neither the shape name nor its side/corner count ever appears on screen (or in the title/description) before the child says it.',
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
  },
  {
    id: 'di-sentence-reading',
    // How it is wired to the live tutor: `diSentenceReading.card.ts` (behavior: `diSentenceReading.boss.ts`).
    ...bossEntry(diSentenceReadingCard),
    description: 'Live-judged Direct Instruction SENTENCE READING (connected text): the child reads a printed short sentence aloud, cold, and the tutor judges the spoken audio WORD BY WORD; any model is a DIFFERENT sentence read as "My turn", never the child\'s own — a skipped, added, or swapped word is corrected, not waved through. The child SEES the printed sentence and READS it aloud (voice/microphone). Perfect for kindergarten through grade 2 reading accuracy and fluency on short decodable sentences: reading fully sound-it-out CVC sentences (blending carried into connected text), reading sentences that carry irregular high-frequency sight words which must be recognised whole, and cumulative spaced review of sentences already taught. ESSENTIAL for K/G1/G2 early reading — the rung above single-word decoding, where reading accuracy first becomes measurable.',
    constraints: 'Requires microphone + live audio tutor. Short DECODABLE sentences of 3-8 words only — the 8-word ceiling is the benched limit for reliable one-word-error detection, and longer connected text is unverified. Short-vowel CVC vocabulary plus starter sight words; NO digraphs, blends, or multisyllable words. Use read-aloud-studio instead for CONNECTED PASSAGES at grades 1-6, or for phrasing / character-voice practice with older readers — since its own DI port (2026-08-12) that primitive is judged too, so the fork is no longer graded-vs-ungraded: this pack owns ISOLATED short sentences drawn from a phonics or sight-word menu at K-2, and read-aloud-studio owns a passage whose lines read as one continuous text. Use a single-word primitive (di-word-reading) when reading ONE word is the objective; this pack always reads connected text. The manifest must NOT supply specific sentences; the menu-scoped generator selects them from the objective (phonics pattern or sight-word focus) and attaches word counts/rewards in code. The printed sentence is the answer: no pictures or audio pre-cues before the child reads.',
    // reader: 'emerging' (R10, 2026-10-03). It was 'none' while the tutor read the sentence
    // first ("Listen", "Together"); with that gone the child reads 3-8 words of connected
    // text cold, so the pack needs an emerging reader.
    affordances: { representation: 'symbolic', reader: 'emerging', answers: ['spoken'], role: 'apply', minutes: 5 },
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
    // How it is wired to the live tutor: `diSpokenPractice.card.ts` (behavior: `diSpokenPractice.boss.ts`).
    ...bossEntry(diSpokenPracticeCard),
    misconceptionScope: 'primitive',
  },
  {
    // The first "DI for Older Learners" pack (design brief 2026-09-07). The
    // K-2 packs judge a WORD; this one judges a MOVE: the child narrates a
    // multi-digit subtraction one column at a time and the tutor corrects at
    // the column where the error happens. The step chain is code-built
    // (diWorkedProcedurePlan.ts); the script is hand-authored.
    id: 'di-worked-procedure',
    // How it is wired to the live tutor: `diWorkedProcedure.card.ts` (behavior: `diWorkedProcedure.boss.ts`).
    ...bossEntry(diWorkedProcedureCard),
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
  },
  {
    // The second "DI for Older Learners" pack (design brief 2026-09-07,
    // concept 3). di-worked-procedure judges a MOVE; this one judges a
    // DEDUCTION: a rule card, a case card, and the child says what follows and
    // how they know. The cases are code-built from one generated rule
    // (diDeductionPlan.ts); the script is hand-authored.
    id: 'di-deduction',
    // How it is wired to the live tutor: `diDeduction.card.ts` (behavior: `diDeduction.boss.ts`).
    ...bossEntry(diDeductionCard),
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
  },
  {
    // The third "DI for Older Learners" pack (design brief 2026-09-07, concept
    // 4) and the family's first math pack that MIXES hands and voice inside one
    // problem: the entry mode places the big amount; family modes place all
    // three story parts into small + small = big. The family is then SAID in
    // modes that include the `equation_statement` class. Stories,
    // numbers, families and answers are code-built (diWordProblemPlan.ts);
    // Gemini supplies only the themes.
    id: 'di-word-problem-setup',
    // How it is wired to the live tutor: `diWordProblemSetup.card.ts` (behavior: `diWordProblemSetup.boss.ts`).
    ...bossEntry(diWordProblemSetupCard),
    description:
      'Live-judged Direct Instruction WORD-PROBLEM SETUP (Connecting Math Concepts number families): a '
      + 'short addition or subtraction story is printed and read aloud. Depending on mode, the child '
      + 'either places the big amount and solves, or DRAGS all three story parts into small plus small equals big, then SAYS the family ("twelve plus '
      + 'box equals twenty"), says add or subtract, and works it — each step judged where it happens. '
      + 'Comparison, change, and part-whole stories with one unknown. Use for objectives about solving '
      + 'addition and subtraction word problems, representing a word problem with an equation or number '
      + 'sentence with an unknown, finding the whole or a part, or deciding whether to add or subtract. '
      + 'ESSENTIAL for G1-G4 word problems where the objective wants the SETUP — which number is the whole, '
      + 'which operation and why — not just the answer.',
    constraints:
      'Requires microphone + live audio tutor. ADDITION AND SUBTRACTION ONLY — no multiplication or '
      + 'division, no two-step problems, no stories with more than three quantities; numbers within 20 '
      + 'unless the objective says within 100. Two to four stories per block, each worked as 2-5 judged '
      + 'steps; a session runs ONE mode. The manifest must NOT supply stories or numbers: the pool builds '
      + 'them in code from the objective (range, story kinds) and Gemini supplies only names, an object '
      + 'noun, and a verb pair. Prefer addition-subtraction-scene when the child should act the story out '
      + 'with objects, and bar-model for drawing the model itself.',
    affordances: { representation: 'symbolic', reader: 'developing', answers: ['spoken', 'manipulate'], role: 'apply', minutes: 6 },
    // L1 eval modes — the step LIST is the mode: place + work (G1-2), place +
    // say the family + operation + work (G2-3), name the kind first (G3-4).
    // β mirrors backend problem_type_registry.py.
    evalModes: DI_WORD_PROBLEM_EVAL_MODES,
    supportsEvaluation: true,
    misconceptionScope: 'primitive',
  },
];
