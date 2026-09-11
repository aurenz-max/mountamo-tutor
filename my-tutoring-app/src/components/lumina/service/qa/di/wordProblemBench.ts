/**
 * wordProblemBench — the scored answer key for the `equation_statement`
 * response class, plus the drive harness's answer material for
 * di-word-problem-setup (design brief 2026-09-07, "DI for Older Learners",
 * concept 4).
 *
 * WHAT IS DIFFERENT ABOUT THIS CLASS
 * ----------------------------------
 * `number_word_to_20` hands the judge a NUMBER; `procedure_step` hands it a
 * MOVE. This class hands it a spoken NUMBER SENTENCE WITH A SLOT — "twelve plus
 * box equals twenty" — and what the judge scores is the RIGHT NUMBERS IN THE
 * RIGHT SLOTS, not the tokens. Three things the buckets are built around:
 *
 *   1. THE BIG NUMBER BELONGS AT THE END. "Twenty plus twelve equals box" has
 *      every right number and is the signature error — "the biggest number I
 *      see" carried into the family. `big-number-misplaced` is that bucket, and
 *      it must be zero-false-affirm.
 *   2. THE SUBTRACTION FORM IS NOT A FAMILY. "Twenty minus twelve equals box"
 *      is correct arithmetic and skips the decision the step exists to make.
 *      `operation-not-family` refuses it even though every word in it is true.
 *   3. BOTH SMALL NUMBERS MUST BE PRESENT. "Box equals twenty" is half a
 *      family. `family-incomplete` refuses it.
 *
 * The placement step is a GESTURE (its verdict is computed in code, so there is
 * nothing to bench); the operation and solve steps carry a few probes so a
 * sitting can see the whole story, but the class key is the family items.
 *
 * WHY THE PROBLEMS ARE HAND-PICKED
 * --------------------------------
 * Each fixture story exists for one family shape: the big number unknown
 * (addition family), the big number known with the difference unknown, a
 * change story whose verb disagrees with the operation, and both part-whole
 * shapes. All pass the plan gates — the fixture is built through
 * `itemsFromProblems`, so a story the pack would refuse fails the fixture's own
 * test rather than thinning the bench silently.
 *
 * WHAT THIS BENCH CANNOT ANSWER
 * -----------------------------
 * The harness sends TEXT. It drives the judge's SEMANTICS and never the mic:
 * whether a seven-year-old's "twelve… and, um, something… is twenty" ARRIVES
 * intact is the mic row (HUMAN-CHECKS).
 */

import type { OpenSetProbe } from './openSetWordBench';
import type { DiHarnessAnswers } from './diDrivePlan';
import {
  leakExemptSpansFor,
  leakTokensFor,
  type WordProblemItem,
  type WordProblemProblemSpec,
} from '../../../primitives/visual-primitives/direct-instruction/diWordProblemScript';
import {
  bigNumberWrongPlacement,
  familyIncomplete,
  familyMisplaced,
  familySpoken,
  numberWord,
  SHAPE_WORD,
  wrongWayAnswer,
  type StoryShape,
  type StoryTheme,
} from '../../../primitives/visual-primitives/direct-instruction/diWordProblemPlan';

const w = numberWord;

export const WORD_PROBLEM_BENCH_THEME: StoryTheme = {
  nameA: 'Jen', nameB: 'Tom', nounPlural: 'stickers',
  gainPast: 'found', gainBase: 'find', losePast: 'lost', loseBase: 'lose',
};

/** The fixture stories. Ids are stable; item ids derive from them. */
export const WORD_PROBLEM_BENCH_PROBLEMS: WordProblemProblemSpec[] = [
  // Jen has 12. Tom has 8 more than Jen. How many does Tom have? → 20.
  // Big number = Tom's (the box); "the biggest number I see" = Jen's 12.
  { id: 'wpsb-cmp-big', frameId: 'comparison:more_person', theme: WORD_PROBLEM_BENCH_THEME, first: 12, second: 8, challengeType: 'build_family' },
  // Jen has 20. Tom has 12. How many more does Jen have? → 8.
  // Big number = Jen's 20 (known); the subtraction form is the live wrong.
  { id: 'wpsb-cmp-diff', frameId: 'comparison:difference', theme: WORD_PROBLEM_BENCH_THEME, first: 20, second: 12, challengeType: 'build_family' },
  // Jen had 9. Then Jen found some more. Now Jen has 15. How many did Jen find? → 6.
  // "found" sounds like add; the family says subtract. Classify is on.
  { id: 'wpsb-chg-gain', frameId: 'change:gain_change', theme: WORD_PROBLEM_BENCH_THEME, first: 9, second: 15, challengeType: 'classify_and_build' },
  // Jen had 15. Then Jen lost 6 of them. How many now? → 9.
  { id: 'wpsb-chg-loss', frameId: 'change:loss_end', theme: WORD_PROBLEM_BENCH_THEME, first: 15, second: 6, challengeType: 'build_family' },
  // There are 7 red stickers and 5 blue stickers. How many in all? → 12.
  { id: 'wpsb-pw-whole', frameId: 'part_whole:whole', theme: WORD_PROBLEM_BENCH_THEME, first: 7, second: 5, challengeType: 'find_big_number' },
  // There are 12 stickers. 7 are red. The rest are blue. How many are blue? → 5.
  { id: 'wpsb-pw-part', frameId: 'part_whole:part', theme: WORD_PROBLEM_BENCH_THEME, first: 12, second: 7, challengeType: 'build_family' },
];

const OFF_TASK: OpenSetProbe[] = [
  { text: "I don't know", bucket: 'off-task', expect: 'refuse', why: 'not an answer; the correction branch' },
  { text: 'umm', bucket: 'off-task', expect: 'refuse', why: 'a filler noise, no family and no number' },
];

/** Probes keyed by ITEM id — no fallback match: nothing about one story's key
 *  transfers to another story. */
export const WORD_PROBLEM_BENCH_PROBES: Record<string, OpenSetProbe[]> = {
  // ── Jen 12, Tom 8 more → Tom ?: the ADDITION family (box is the big number) ─
  'wpsb-cmp-big-family': [
    { text: 'twelve plus eight equals box', bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording' },
    { text: 'eight and twelve makes something', bucket: 'valid-paraphrase', expect: 'affirm', why: 'smalls swapped, "and"/"makes"/"something" — right numbers, right slots, none of the anchor phrasing' },
    { text: 'twelve plus eight is what', bucket: 'valid-paraphrase', expect: 'affirm', why: '"what" for the box' },
    { text: 'um, twelve… and then eight… is, box', bucket: 'valid-childlike', expect: 'affirm', why: 'in pieces, hedged — the family is whole' },
    { text: 'twelve plus eight equals twenty', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the box filled with the right number — the family is right' },
    { text: 'eight plus box equals twelve', bucket: 'big-number-misplaced', expect: 'refuse', why: 'THE signature error: Jen\'s twelve promoted to the big slot because it is the biggest number seen; the box demoted to a small' },
    { text: 'box plus eight equals twelve', bucket: 'big-number-misplaced', expect: 'refuse', why: 'the same upside-down family, smalls swapped' },
    { text: 'twelve plus box', bucket: 'family-incomplete', expect: 'refuse', why: 'no equals, no big number' },
    { text: 'box equals twelve', bucket: 'family-incomplete', expect: 'refuse', why: 'one small number and a wrong big' },
    { text: 'Jen has twelve stickers and Tom has eight more', bucket: 'echo', expect: 'refuse', why: 'the story read back — no family' },
    ...OFF_TASK,
  ],
  // ── Jen 20, Tom 12 → how many more?: the SUBTRACTION family (box is small) ─
  'wpsb-cmp-diff-family': [
    { text: 'twelve plus box equals twenty', bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording' },
    { text: 'box and twelve is twenty', bucket: 'valid-paraphrase', expect: 'affirm', why: 'smalls swapped, "and"/"is"' },
    { text: 'twelve plus what equals twenty', bucket: 'valid-paraphrase', expect: 'affirm', why: '"what" for the box' },
    { text: 'twelve plus eight equals twenty', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the box filled with the right number' },
    { text: 'twenty plus twelve equals box', bucket: 'big-number-misplaced', expect: 'refuse', why: 'THE signature error: the big number said before equals, the box last — every number present, family upside down' },
    { text: 'twelve plus twenty equals box', bucket: 'big-number-misplaced', expect: 'refuse', why: 'the same, smalls swapped' },
    { text: 'twenty minus twelve equals box', bucket: 'operation-not-family', expect: 'refuse', why: 'correct arithmetic, not a family — skips the decision' },
    { text: 'twenty take away twelve is box', bucket: 'operation-not-family', expect: 'refuse', why: 'the subtraction form in child words' },
    { text: 'box equals twenty', bucket: 'family-incomplete', expect: 'refuse', why: 'no small number' },
    { text: 'twelve plus box', bucket: 'family-incomplete', expect: 'refuse', why: 'no big number' },
    { text: 'Jen has twenty and Tom has twelve', bucket: 'echo', expect: 'refuse', why: 'the story read back' },
    ...OFF_TASK,
  ],
  // ── Jen had 15, lost 6 → now?: start is the big number ─────────────────────
  'wpsb-chg-loss-family': [
    { text: 'six plus box equals fifteen', bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording' },
    { text: 'box plus six makes fifteen', bucket: 'valid-paraphrase', expect: 'affirm', why: 'smalls swapped, "makes"' },
    { text: 'fifteen plus six equals box', bucket: 'big-number-misplaced', expect: 'refuse', why: 'the start promoted past equals — the biggest number seen, placed wrong' },
    { text: 'fifteen minus six equals box', bucket: 'operation-not-family', expect: 'refuse', why: 'the subtraction sentence' },
    { text: 'six plus box', bucket: 'family-incomplete', expect: 'refuse', why: 'no big number' },
    ...OFF_TASK,
  ],
  // ── 12 stickers, 7 red, rest blue → blue?: the whole is the big number ─────
  'wpsb-pw-part-family': [
    { text: 'seven plus box equals twelve', bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording' },
    { text: 'box and seven is twelve', bucket: 'valid-paraphrase', expect: 'affirm', why: 'smalls swapped' },
    { text: 'twelve plus seven equals box', bucket: 'big-number-misplaced', expect: 'refuse', why: 'the whole in a small slot' },
    { text: 'twelve minus seven equals box', bucket: 'operation-not-family', expect: 'refuse', why: 'the subtraction sentence' },
    { text: 'box equals twelve', bucket: 'family-incomplete', expect: 'refuse', why: 'no small number' },
    ...OFF_TASK,
  ],
  // ── the operation, where the story's verb disagrees with the family ────────
  'wpsb-chg-gain-operation': [
    { text: 'subtract', bucket: 'valid-canonical', expect: 'affirm', why: 'the box is a small number' },
    { text: 'take away', bucket: 'valid-paraphrase', expect: 'affirm', why: 'child words for subtract' },
    { text: 'add', bucket: 'wrong-verdict', expect: 'refuse', why: 'THE signature error: "found" sounds like add; the family says subtract' },
    { text: 'plus, because Jen found more', bucket: 'wrong-verdict', expect: 'refuse', why: 'the operation taken from the story\'s word' },
    ...OFF_TASK,
  ],
  // ── the classify step ──────────────────────────────────────────────────────
  'wpsb-chg-gain-classify': [
    { text: 'change', bucket: 'valid-canonical', expect: 'affirm', why: 'the menu word' },
    { text: 'a change problem', bucket: 'valid-paraphrase', expect: 'affirm', why: 'inside a phrase' },
    { text: 'comparison', bucket: 'wrong-verdict', expect: 'refuse', why: 'THE signature error: the last sentence asks how many did Jen find, which sounds like comparing' },
    { text: 'part-whole', bucket: 'wrong-verdict', expect: 'refuse', why: 'plain wrong' },
    ...OFF_TASK,
  ],
  // ── the solve step ─────────────────────────────────────────────────────────
  'wpsb-cmp-diff-solve': [
    { text: 'eight', bucket: 'valid-canonical', expect: 'affirm', why: 'the answer' },
    { text: 'Jen has eight more stickers than Tom', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the whole sentence' },
    { text: 'thirty-two', bucket: 'wrong-number', expect: 'refuse', why: 'THE signature error: the two story numbers added' },
    { text: 'seven', bucket: 'wrong-number', expect: 'refuse', why: 'plain wrong' },
    ...OFF_TASK,
  ],
};

const otherShape = (shape: StoryShape): StoryShape =>
  (shape === 'comparison' ? 'part_whole' : shape === 'change' ? 'part_whole' : 'change');

/** The kind a child names when they classify the LAST sentence, not the story. */
const lastSentenceShape = (shape: StoryShape): StoryShape =>
  (shape === 'change' ? 'comparison' : shape === 'comparison' ? 'change' : 'comparison');

/**
 * The harness's answer material for one step: the correct utterance, an
 * unambiguously wrong one, and the signature wrong the contract CLAIMS the
 * judge refuses. The placement step carries its right and wrong quantity ids
 * instead (`tapped`), since its verdict is computed in code. Probes ride along
 * by item id where the fixture carries them.
 */
export const wordProblemHarnessAnswers = (item: WordProblemItem): DiHarnessAnswers => {
  const p = item.plan;
  const probes = WORD_PROBLEM_BENCH_PROBES[item.id];
  const common = {
    leakTokens: leakTokensFor(item),
    leakExemptSpan: leakExemptSpansFor(item),
    ...(probes ? { probes } : {}),
  };
  switch (item.kind) {
    case 'classify':
      return {
        correct: SHAPE_WORD[p.shape],
        plainWrong: SHAPE_WORD[otherShape(p.shape)],
        signatureWrong: {
          text: SHAPE_WORD[lastSentenceShape(p.shape)],
          why: 'the kind of the last sentence, not of the whole story',
        },
        ...common,
      };
    case 'big_number': {
      const wrong = bigNumberWrongPlacement(p);
      return {
        correct: p.big.label,
        plainWrong: wrong.label,
        signatureWrong: {
          text: wrong.label,
          why: p.big.known
            ? 'the other printed amount placed as the big number'
            : '"the biggest number I see" — the larger printed amount placed as the big number',
        },
        tapped: { correct: p.big.id, wrong: wrong.id },
        ...common,
      };
    }
    case 'family':
      return {
        correct: familySpoken(p),
        plainWrong: familyIncomplete(p),
        signatureWrong: {
          text: familyMisplaced(p),
          why: 'the big number in a small slot — every number present, the family upside down',
        },
        ...common,
      };
    case 'operation': {
      const other = p.operation === 'add' ? 'subtract' : 'add';
      return {
        correct: p.operation,
        plainWrong: other,
        signatureWrong: p.verbCueOperation !== p.operation
          ? { text: p.verbCueOperation, why: `the operation taken from the story's word "${p.verbCueWord}" instead of from the family` }
          : { text: other, why: 'the other operation' },
        ...common,
      };
    }
    case 'solve': {
      const wrong = p.answer === 1 ? 2 : p.answer - 1;
      return {
        correct: w(p.answer),
        plainWrong: w(wrong),
        signatureWrong: {
          text: w(wrongWayAnswer(p)),
          why: 'the two story numbers combined the wrong way',
        },
        ...common,
      };
    }
  }
};
