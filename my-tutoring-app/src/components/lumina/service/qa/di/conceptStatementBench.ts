/**
 * conceptStatementBench — the scored answer key for the `concept_statement`
 * response class (qa/di/BACKLOG.md item 36; handoff
 * `qa/HANDOFF-di-spoken-practice-explain-2026-09-07.md` §5).
 *
 * WHAT IS DIFFERENT ABOUT THIS CLASS, AND WHY THE KEY IS SHAPED THE WAY IT IS
 * ------------------------------------------------------------------------
 * `open_set_word` hands the judge a RULE and asks whether a WORD satisfies it.
 * This class hands the judge an IDEA and asks whether an UTTERANCE expresses
 * it. Two consequences the buckets are built around:
 *
 *   1. TOKEN OVERLAP IS NEITHER NECESSARY NOR SUFFICIENT. "They match" has no
 *      anchor token in it and is a full answer to "what does = mean?"; "they
 *      are NOT the same" has every anchor token in it and is the opposite. A
 *      judge that grades on word overlap fails BOTH directions, and the two
 *      buckets that exist for this class alone — `valid-paraphrase` (must
 *      affirm) and `negated-keyword` (must refuse) — are those two directions
 *      made testable. A class that only affirms canonical wording is
 *      `closed_set_choice` in disguise and must not clear; that is why the
 *      paraphrase bucket carries a floor (≥ 80% affirmed) and not just a report.
 *   2. THE SIGNATURE WRONG ANSWER IS TRUE. "Five" IS three plus two; "ten" IS
 *      the next number; "the rod is longer" IS a fact about the rod. None of
 *      them is an explanation. `answer-not-explanation` and `adjacent-concept`
 *      catch a judge that affirms a true sentence for being true.
 *
 * TWO SUB-SHAPES, ONE MODE. The two frozen lesson-bench failures this class
 * closes are different shapes: `…ah5w` obj2 is ONE concept session-wide (what
 * = means) over varied instances, and `…f00i` obj3 is a concept PER ITEM (the
 * rule of THIS pattern) whose answer is often two words ("plus two"). The
 * fixture carries both — the equal sign and the ten rod are session-wide
 * concepts, the two patterns are per-item rules — because one shape alone
 * could pass 13/13 and hide a contract gap on the other (the open-set bench's
 * own method note).
 *
 * WHY THE PROBES ARE HAND-AUTHORED
 * --------------------------------
 * ⚠️ Whether a probe is a paraphrase or an adjacent concept is a judgment the
 * AUTHOR makes by reading the stimulus, and it cannot be derived. "It skips a
 * number each time" is a correct rule for 2, 4, 6, 8 and a wrong one for 2, 5,
 * 8; "they are all even" is a true description of 2, 4, 6, 8 and NOT the rule
 * the objective asks for — it was left OUT rather than filed on a coin flip.
 * Every REFUSE probe below was checked by eye against the trap it encodes, and
 * the arguable ones are marked `soft`: recorded, never counted. AUDIT THE KEY
 * BEFORE BELIEVING ANY FINDING THAT INDICTS THE TUTOR (the `zell` lesson).
 *
 * THE BUCKETS
 * -----------
 *   valid-canonical         the anchor wording itself                     AFFIRM
 *   valid-paraphrase        the idea with NONE of the anchor phrases —
 *                           the bucket the class exists for; ≥ 80%       AFFIRM
 *   valid-childlike         grammar and diction are not the skill         AFFIRM
 *   valid-partial           a defensible half-answer ("same") — SOFT      AFFIRM
 *   echo                    the stimulus read back, nothing added         REFUSE
 *   answer-not-explanation  the RESULT ("five", "ten", the next colour)   REFUSE
 *   adjacent-concept        the documented misconception, or a true
 *                           fact about the stimulus that is not the idea  REFUSE
 *   negated-keyword         anchor tokens present, idea absent or
 *                           reversed                                      REFUSE
 *   off-task                a turn that is not an answer                  REFUSE
 *
 * WHAT THIS BENCH CANNOT ANSWER
 * -----------------------------
 * The harness sends TEXT. That drives the judge's SEMANTICS — the whole
 * question for this class — and touches neither acoustics nor ASR. Whether a
 * six-year-old's "they're even" ARRIVES as "they're even" is the mic row this
 * bench leaves open. True silence is not sendable, so off-task probes "I don't
 * know" and a filler noise; dead air stays a mic-row question.
 */

import type { OpenSetProbe, OpenSetProbeResult } from './openSetWordBench';

/** The generator's flat item shape, with every field the fixture needs present
 *  and typed — it is assignable to `RawSpokenItem` and goes through the same
 *  `buildSpokenItem`. */
export interface ConceptBenchRaw {
  stimulusText: string;
  stimulusEmoji?: string;
  ask: string;
  expectedAnswer: string;
  alsoAccept: string;
  conceptStatement: string;
  acceptRule: string;
  signatureError: string;
  correctionBody: string;
}

export interface ConceptBenchStimulus {
  /** Item id in the drive plan. */
  id: string;
  /**
   * The item as the GENERATOR would emit it — it goes through the shipped
   * `buildSpokenItem` + `gateSpokenItems`, so the bench exercises the contract
   * the primitive actually uses. A fixture item that fails those gates fails
   * the fixture's own test, not silently the bench.
   */
  raw: ConceptBenchRaw;
  /** Which of the two sub-shapes this stimulus represents. */
  shape: 'session-wide' | 'per-item';
  probes: OpenSetProbe[];
}

/** The off-task pair, identical for every stimulus — it is about the SHAPE of
 *  the turn, not the idea. */
const offTask = (): OpenSetProbe[] => [
  {
    text: "I don't know",
    bucket: 'off-task',
    expect: 'refuse',
    why: 'an honest non-answer. The contract names it, and a judge without a scripted branch here invents one',
  },
  {
    text: 'um',
    bucket: 'off-task',
    expect: 'refuse',
    why: 'filler, not an idea — the nearest a text turn gets to dead air',
  },
];

/**
 * FOUR STIMULI ACROSS BOTH SUB-SHAPES. The handoff asks for ≥ 4 so a single
 * concept cannot hide a contract gap; these four are the two frozen failures'
 * own instances (the equal sign from `…ah5w`, the two patterns from `…f00i`)
 * plus the base-ten shape from `…vhjy`, so the bench measures the judge on the
 * exact ideas the lessons will hand it.
 */
export const CONCEPT_BENCH_STIMULI: ConceptBenchStimulus[] = [
  {
    id: 'bench-concept-equal-sign',
    shape: 'session-wide',
    raw: {
      stimulusText: '3 + 2 = 5',
      ask: 'Three plus two equals five. Look at the equal sign. What does the equal sign tell us?',
      expectedAnswer: 'both sides the same',
      alsoAccept: 'balanced, equal amounts',
      conceptStatement: 'The equal sign means both sides have the same amount.',
      acceptRule:
        'Any words that say the two sides match, are even, are balanced, or have the same count '
        + 'are right, even without the word same.',
      signatureError:
        'Saying the sum, five, is NOT an explanation. Saying the equal sign means the answer '
        + 'comes next, or means add them up, is NOT correct.',
      correctionBody:
        'The equal sign means both sides have the same amount. Three plus two is five, and five '
        + 'is five, so the two sides match.',
    },
    probes: [
      { text: 'both sides are the same', bucket: 'valid-canonical', expect: 'affirm', why: 'the primary anchor, as a child would say it' },
      { text: 'it means equal', bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor "equal amounts" in its shortest honest form — equal IS the concept' },
      { text: 'they match', bucket: 'valid-paraphrase', expect: 'affirm', why: 'THE BUCKET THE CLASS EXISTS FOR: not one anchor token in it, and a complete statement of the idea' },
      { text: 'this side and that side are even', bucket: 'valid-paraphrase', expect: 'affirm', why: 'a second paraphrase on a different word ("even"), so the bucket is not one lucky synonym' },
      { text: "it's, um, same same on the two", bucket: 'valid-childlike', expect: 'affirm', why: 'grammar and diction are not the skill; the idea (same on both) is there' },
      { text: 'same', bucket: 'valid-partial', expect: 'affirm', soft: true, why: 'a defensible half-answer — same WHAT is unsaid. Recorded either way, never counted' },
      { text: 'three plus two equals five', bucket: 'echo', expect: 'refuse', why: 'the stimulus read straight back with nothing added. A child affirmed here learns that reading the screen is explaining it' },
      { text: 'five', bucket: 'answer-not-explanation', expect: 'refuse', why: 'THE K-1 SIGNATURE ERROR: the sum. True, confident, and not what = means — the miss a judge grading "did they say something correct" waves through' },
      { text: 'it means the answer is next', bucket: 'adjacent-concept', expect: 'refuse', why: 'the documented misconception (= as "the answer comes here"), named in the objective\'s own intent text' },
      { text: 'it means add them up', bucket: 'adjacent-concept', expect: 'refuse', why: 'the operator confusion — the sign that tells you to add is +, and this reads = as an instruction' },
      { text: 'they are not the same', bucket: 'negated-keyword', expect: 'refuse', why: 'THE BUCKET THAT FAILS A WORD-MATCHING JUDGE: the anchor "the same" is in it, and the idea is reversed' },
      { text: 'one side has more, not equal', bucket: 'negated-keyword', expect: 'refuse', why: 'anchor token "equal" present, claim opposite — second reading of the same trap' },
      ...offTask(),
    ],
  },
  {
    id: 'bench-concept-growing-pattern',
    shape: 'per-item',
    raw: {
      stimulusText: '2, 4, 6, 8',
      ask: 'Two, four, six, eight. Listen again: two, four, six, eight. What is the rule of this pattern?',
      expectedAnswer: 'plus two',
      alsoAccept: 'add two, counting by twos',
      conceptStatement: 'This pattern grows by adding two each time.',
      acceptRule:
        'Saying what gets added each time, or skip counting by two, counts — the words plus, '
        + 'add, more, jump, or up by are all fine.',
      signatureError:
        'Saying the next number, ten, is NOT the rule. Saying it goes up or gets bigger without '
        + 'saying by how much is NOT the rule.',
      correctionBody:
        'The rule is add two. Two, add two is four, add two is six, add two is eight.',
    },
    probes: [
      { text: 'plus two', bucket: 'valid-canonical', expect: 'affirm', why: 'the primary anchor — two words, and the whole answer from a six-year-old' },
      { text: 'you add two every time', bucket: 'valid-canonical', expect: 'affirm', why: 'the second anchor in a sentence' },
      { text: 'it jumps by two', bucket: 'valid-paraphrase', expect: 'affirm', why: 'no anchor PHRASE in it ("plus two" / "add two" / "counting by twos" are all absent); "two" alone is unavoidable in any true rule for this pattern' },
      { text: 'every number is two more than the one before', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the rule stated as a relation between neighbours — a different framing, same idea' },
      { text: "it's like, two more, two more, two more", bucket: 'valid-childlike', expect: 'affirm', why: 'how a K child says "add two each time" — repetition is the child\'s "each time"' },
      { text: 'twos', bucket: 'valid-partial', expect: 'affirm', soft: true, why: 'a defensible half-answer — twos WHAT is unsaid. Recorded, never counted' },
      { text: 'two four six eight', bucket: 'echo', expect: 'refuse', why: 'the stimulus read straight back — the pattern said, not its rule' },
      { text: 'ten', bucket: 'answer-not-explanation', expect: 'refuse', why: 'the NEXT number. Correct extension of the pattern, and not the rule — exactly the obj2/obj3 confusion the lesson separates' },
      { text: 'it goes up', bucket: 'adjacent-concept', expect: 'refuse', why: 'the growing-pattern half-idea the signature clause names: direction without amount is not a rule' },
      { text: 'it counts', bucket: 'adjacent-concept', expect: 'refuse', why: 'a true remark about the stimulus that names no rule' },
      { text: "it's not plus two, it's plus one", bucket: 'negated-keyword', expect: 'refuse', why: 'THE anchor phrase "plus two" is IN the utterance, negated. A word-matching judge affirms this' },
      { text: 'you take away two each time', bucket: 'negated-keyword', expect: 'refuse', why: 'the keyword "two" with the direction reversed' },
      ...offTask(),
    ],
  },
  {
    id: 'bench-concept-repeating-pattern',
    shape: 'per-item',
    raw: {
      stimulusText: 'red, blue, red, blue',
      ask: 'Red, blue, red, blue. What is the rule of this pattern?',
      expectedAnswer: 'red then blue',
      alsoAccept: 'red blue repeats, same two colors again',
      conceptStatement: 'The pattern repeats red then blue over and over.',
      acceptRule:
        'Naming the part that repeats, red and blue, in either word order, or saying it goes back '
        + 'and forth between the two colors, counts. Saying the colors AND that they keep going, '
        + 'repeat, or go over and over is a full answer.',
      signatureError:
        'Saying the next color, red, is NOT the rule. Saying just "colors", or naming one color, '
        + 'is NOT the rule. Saying it grows or gets bigger is NOT correct — nothing is added.',
      correctionBody:
        'The rule is red then blue, over and over. Red, blue, then red, blue again — the same '
        + 'two colors repeat.',
    },
    probes: [
      { text: 'red then blue', bucket: 'valid-canonical', expect: 'affirm', why: 'the primary anchor' },
      { text: 'red, blue, red, blue, over and over', bucket: 'valid-canonical', expect: 'affirm', why: 'THE ECHO-PLUS-IDEA CASE: the stimulus is inside it, and "over and over" is the concept. The echo guard must refuse the read-back ALONE, not the read-back with the rule attached' },
      { text: 'it takes turns, one color then the other', bucket: 'valid-paraphrase', expect: 'affirm', why: 'no colour named, no anchor token — the idea of alternation stated abstractly' },
      { text: 'it switches back and forth between them', bucket: 'valid-paraphrase', expect: 'affirm', why: 'second paraphrase on a different verb' },
      { text: 'red, blue, red, blue, and it just keeps going like that', bucket: 'valid-childlike', expect: 'affirm', why: 'how a K child explains repetition — by doing it and saying "keeps going"' },
      { text: 'it repeats', bucket: 'valid-partial', expect: 'affirm', soft: true, why: 'the idea without the unit — a defensible half-answer. Recorded, never counted' },
      { text: 'red blue red blue', bucket: 'echo', expect: 'refuse', why: 'the stimulus read straight back with NOTHING added — contrast the canonical probe two rows up, where "over and over" is added' },
      { text: 'red', bucket: 'answer-not-explanation', expect: 'refuse', why: 'the next colour. A correct extension, and not the rule' },
      { text: 'colors', bucket: 'adjacent-concept', expect: 'refuse', why: 'the category the signature clause names — true, and not a rule' },
      { text: 'it gets bigger', bucket: 'adjacent-concept', expect: 'refuse', why: 'the growing-pattern confusion — this lesson\'s own obj2 contrast, applied to the wrong pattern' },
      { text: "it's red then blue then green", bucket: 'negated-keyword', expect: 'refuse', why: 'THE anchor phrase "red then blue" is in it, and the unit is wrong. A word-matching judge affirms this' },
      { text: 'it does not repeat', bucket: 'negated-keyword', expect: 'refuse', why: 'the keyword "repeat" with the idea reversed' },
      ...offTask(),
    ],
  },
  {
    id: 'bench-concept-ten-rod',
    shape: 'session-wide',
    raw: {
      stimulusText: '1 ten rod and 10 ones',
      ask: 'One ten rod, and ten ones. What does the ten rod show us?',
      expectedAnswer: 'ten ones make ten',
      alsoAccept: 'same amount, same as ten ones',
      conceptStatement: 'One ten rod is the same as ten ones.',
      acceptRule:
        'Any words that say the rod and the ten little cubes are the same amount, are both ten, '
        + 'or that ten ones make a ten or fit inside a ten, count.',
      signatureError:
        'Saying ten, or one, is NOT an explanation. Saying the rod is longer or bigger is NOT '
        + 'correct — it is the same amount, not more.',
      correctionBody:
        'One ten rod is the same as ten ones. If you break the rod apart you get ten little '
        + 'ones, so they are the same amount.',
    },
    probes: [
      { text: 'ten ones make one ten', bucket: 'valid-canonical', expect: 'affirm', why: 'the primary anchor ("ten ones make ten") as a child completes it' },
      { text: 'the rod is the same as the ten cubes', bucket: 'valid-canonical', expect: 'affirm', why: 'the concept sentence in a child\'s words' },
      { text: "they're both ten", bucket: 'valid-paraphrase', expect: 'affirm', why: 'equivalence stated without "same", "make", or "ones" — no anchor phrase present' },
      { text: "it's just the little cubes stuck together", bucket: 'valid-paraphrase', expect: 'affirm', why: 'the composition idea from the other direction (a ten is made of ones) with no anchor token' },
      { text: "it's, like, ten of the little ones but in one piece", bucket: 'valid-childlike', expect: 'affirm', why: 'diction is not the skill; ten-ones-as-one-piece IS the idea' },
      { text: 'same', bucket: 'valid-partial', expect: 'affirm', soft: true, why: 'a defensible half-answer. Recorded, never counted' },
      { text: 'one ten rod and ten ones', bucket: 'echo', expect: 'refuse', why: 'the stimulus read straight back' },
      { text: 'ten', bucket: 'answer-not-explanation', expect: 'refuse', why: 'the number. True of both things on the table, and not an explanation of why they are the same' },
      { text: 'the rod is longer', bucket: 'adjacent-concept', expect: 'refuse', why: 'a TRUE fact about the rod that is not the idea — the trap for a judge grading truth instead of relevance' },
      { text: "the rod is bigger so it's more", bucket: 'adjacent-concept', expect: 'refuse', why: 'the base-ten misconception itself (a ten rod is "more" than ten ones)' },
      { text: 'ten ones is not the same as a ten', bucket: 'negated-keyword', expect: 'refuse', why: 'every anchor token present, idea reversed — THE word-matching trap' },
      { text: 'the rod is one and the cubes are ten, so the cubes are more', bucket: 'negated-keyword', expect: 'refuse', why: 'the keywords one and ten, deployed to argue inequality — the counting-the-pieces confusion' },
      ...offTask(),
    ],
  },
];

/** The REFUSE buckets whose false affirmation fails the run outright. Every
 *  REFUSE probe in this fixture is in one of them; `soft` is the only escape. */
export const CONCEPT_HARD_REFUSE_BUCKETS = [
  'echo', 'answer-not-explanation', 'adjacent-concept', 'negated-keyword', 'off-task',
] as const;

/** The floor the paraphrase bucket must clear, as a fraction. Below it the
 *  judge is matching wording, and the class is `closed_set_choice` in disguise. */
export const PARAPHRASE_AFFIRM_FLOOR = 0.8;

export const allConceptProbes = (): number =>
  CONCEPT_BENCH_STIMULI.reduce((n, s) => n + s.probes.length, 0);

/**
 * The gate, as a function — and it is STRICTER than the open-set gate on
 * purpose. Zero false affirmations in the hard REFUSE buckets is the family's
 * bar (`benchPasses`). This class adds a floor on `valid-paraphrase`: a judge
 * that refuses every honest paraphrase never teaches a false thing, so the
 * family's gate would pass it, but it also never affirms a child who has the
 * idea in their own words — which is the entire mode. No-verdict turns count
 * as NOT affirmed here, exactly as elsewhere.
 *
 * The Python scorer (`report_di_bench`) prints the family's verdict; this
 * function is the second half, applied to the same rows in the run record.
 */
export const paraphraseAffirmRate = (results: OpenSetProbeResult[]): number | null => {
  const rows = results.filter((r) => r.probe.bucket === 'valid-paraphrase');
  if (!rows.length) return null;
  return rows.filter((r) => r.observed === 'affirm').length / rows.length;
};

export const conceptBenchPasses = (results: OpenSetProbeResult[]): boolean => {
  if (!results.length) return false;
  const falseAffirm = results.some(
    (r) => r.probe.expect === 'refuse' && !r.probe.soft && r.observed === 'affirm',
  );
  const rate = paraphraseAffirmRate(results);
  return !falseAffirm && rate !== null && rate >= PARAPHRASE_AFFIRM_FLOOR;
};
