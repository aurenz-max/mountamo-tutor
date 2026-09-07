/**
 * workedProcedureBench — the scored answer key for the `procedure_step`
 * response class, plus the drive harness's answer material for
 * di-worked-procedure (design brief 2026-09-07, "DI for Older Learners").
 *
 * WHAT IS DIFFERENT ABOUT THIS CLASS
 * ----------------------------------
 * `number_word_to_20` hands the judge a NUMBER; `concept_statement` hands it an
 * IDEA. This class hands it a MOVE — "what do you do in this column?" — whose
 * answer is a decision plus the numbers the decision produces. Three things
 * the buckets are built around:
 *
 *   1. THE WRONG MOVE IS FLUENT. "Eight minus two is six" is a confident,
 *      grammatical, arithmetically true sentence, and it is the signature
 *      error of the whole skill (smaller-from-larger). A judge grading on
 *      "did they say a subtraction fact correctly" affirms it. `flipped-column`
 *      is that bucket, and every shipped regroup column is built so the flip
 *      also lands on the WRONG digit (the plan's flip ≠ result gate), so the
 *      judge always has two signals.
 *   2. HALF A MOVE IS A NAMED MISCONCEPTION. "I regroup, twelve" is the right
 *      decision with the tens digit left untouched — forgot-to-decrement, the
 *      error a teacher catches at THIS step because the child never crossed
 *      out the five. `forgot-decrement` must refuse it even though every word
 *      in it is true.
 *   3. THE RIGHT NUMBER WITH NO MOVE IS NOT AN ANSWER. "Four" on a regroup
 *      step could be a lucky read of the answer key; the ask was "tell me what
 *      you do". `no-move` refuses a bare number on a decide step.
 *
 * On a NO-REGROUP decide step the mirror errors apply: `unneeded-regroup`
 * (borrowing where the column subtracts cleanly) and, on a column that lent,
 * `forgot-decrement` again (reading the crossed-out digit).
 *
 * WHY THE PROBLEMS ARE HAND-PICKED
 * --------------------------------
 * Each fixture problem exists for one column shape: a plain ones regroup, a
 * tens column that both LENT and must REGROUP (the double mark), a no-regroup
 * column that lent, and a no-regroup column that did not. All three pass the
 * plan gates — the fixture is built through `itemsFromProblems`, so a problem
 * the pack would refuse fails the fixture's own test rather than thinning the
 * bench silently.
 *
 * WHAT THIS BENCH CANNOT ANSWER
 * -----------------------------
 * The harness sends TEXT. It drives the judge's SEMANTICS and never the mic:
 * whether an eight-year-old's "I can't so I borrow, it's twelve and four"
 * ARRIVES intact is the mic row (HUMAN-CHECKS #140).
 */

import type { OpenSetProbe } from './openSetWordBench';
import type { DiHarnessAnswers } from './diDrivePlan';
import {
  columnPhrase,
  leakExemptSpansFor,
  leakTokensFor,
  type WorkedProblemSpec,
  type WorkedProcedureItem,
} from '../../../primitives/visual-primitives/direct-instruction/diWorkedProcedureScript';
import { numberWord } from '../../../primitives/visual-primitives/direct-instruction/diWorkedProcedurePlan';

const w = numberWord;

/** The fixture problems. Ids are stable; item ids derive from them. */
export const WORKED_PROCEDURE_BENCH_PROBLEMS: WorkedProblemSpec[] = [
  // 52 − 28 = 24: ones 2−8 regroups (tens 5→4, ones 12; flip 8−2=6 ≠ 4);
  // tens 4−2=2 on a column that LENT.
  { id: 'wpb-52-28', minuend: 52, subtrahend: 28, challengeType: 'subtract_regroup' },
  // 342 − 168 = 174: ones 2−8 regroups (tens 4→3, ones 12); tens 3−6 regroups
  // on a column that already lent (hundreds 3→2, tens 13; flip 6−3=3 ≠ 7);
  // hundreds 2−1=1 on a column that lent.
  { id: 'wpb-342-168', minuend: 342, subtrahend: 168, challengeType: 'subtract_regroup' },
  // 75 − 32 = 43: no regroup anywhere; the ones column did not lend.
  { id: 'wpb-75-32', minuend: 75, subtrahend: 32, challengeType: 'subtract_no_regroup' },
];

const OFF_TASK: OpenSetProbe[] = [
  { text: "I don't know", bucket: 'off-task', expect: 'refuse', why: 'not an answer; the correction branch' },
  { text: 'umm', bucket: 'off-task', expect: 'refuse', why: 'a filler noise, no move and no number' },
];

/** Probes keyed by ITEM id — no fallback match: nothing about one column's key
 *  transfers to another column. */
export const WORKED_PROCEDURE_BENCH_PROBES: Record<string, OpenSetProbe[]> = {
  // ── 52 − 28, ones column: the plain regroup ───────────────────────────────
  'wpb-52-28-c0-decide': [
    { text: "I can't take eight from two, so I regroup: four tens, twelve ones", bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording' },
    { text: 'I borrow one from the five. The five is four now and the two is twelve.', bucket: 'valid-paraphrase', expect: 'affirm', why: '"borrow" for regroup, digits named by value — the move and both numbers with none of the anchor phrasing' },
    { text: 'trade a ten. twelve and four', bucket: 'valid-paraphrase', expect: 'affirm', why: 'terse, order reversed, "trade" for regroup — still the whole move' },
    { text: "um, two take away eight, can't do it, so borrow, it's twelve now and the five goes down to four", bucket: 'valid-childlike', expect: 'affirm', why: 'grammar and hedging are not the skill' },
    { text: 'eight minus two is six', bucket: 'flipped-column', expect: 'refuse', why: 'THE signature error: the column turned upside down. Fluent, true as a fact, wrong as a move' },
    { text: 'two minus eight is six', bucket: 'flipped-column', expect: 'refuse', why: 'the flip stated as if it were the column — same error, different words' },
    { text: 'I regroup, the two becomes twelve', bucket: 'forgot-decrement', expect: 'refuse', why: 'the right decision with the tens digit left at five — the error a teacher catches here, not at the tens' },
    { text: 'borrow, twelve minus eight', bucket: 'forgot-decrement', expect: 'refuse', why: 'names the regroup and the new ones, never the four' },
    { text: 'four', bucket: 'no-move', expect: 'refuse', why: 'the eventual difference with no move — the ask was "tell me what you do"' },
    { text: 'twelve', bucket: 'no-move', expect: 'refuse', why: 'the new ones number alone: a number, not a move, and the tens are untouched' },
    { text: 'I regroup: four tens, thirteen ones', bucket: 'wrong-landing', expect: 'refuse', why: 'the right move landing on the wrong number' },
    { text: "borrow, so it's eleven and four", bucket: 'wrong-landing', expect: 'refuse', why: 'off by one on the regrouped ones' },
    ...OFF_TASK,
  ],
  // ── 52 − 28, ones column: subtract after the regroup ──────────────────────
  'wpb-52-28-c0-subtract': [
    { text: 'four', bucket: 'valid-canonical', expect: 'affirm', why: 'the difference' },
    { text: 'twelve minus eight is four', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the whole fact' },
    { text: 'eleven, ten, nine, eight, seven, six, five, four', bucket: 'valid-childlike', expect: 'affirm', why: 'counting back, landing on four' },
    { text: 'six', bucket: 'flipped-column', expect: 'refuse', why: 'eight minus two — the flip, which the plan gate guarantees is a different digit' },
    { text: 'five', bucket: 'wrong-number', expect: 'refuse', why: 'plain wrong' },
    ...OFF_TASK,
  ],
  // ── 52 − 28, tens column: no regroup, on a column that lent ───────────────
  'wpb-52-28-c1-decide': [
    { text: 'two', bucket: 'valid-canonical', expect: 'affirm', why: 'the difference, read off the decremented four' },
    { text: 'four minus two is two', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the whole column' },
    { text: "I don't need to borrow. four take away two, two", bucket: 'valid-childlike', expect: 'affirm', why: 'the decision said out loud, then the fact' },
    { text: 'three', bucket: 'forgot-decrement', expect: 'refuse', why: 'five minus two — read the crossed-out five' },
    { text: 'five minus two is three', bucket: 'forgot-decrement', expect: 'refuse', why: 'the same error, narrated' },
    { text: 'I regroup, fourteen minus two is twelve', bucket: 'unneeded-regroup', expect: 'refuse', why: 'borrowing where the column subtracts cleanly' },
    { text: 'twelve', bucket: 'unneeded-regroup', expect: 'refuse', why: 'the result of an unneeded regroup, bare' },
    { text: 'one', bucket: 'wrong-number', expect: 'refuse', why: 'plain wrong' },
    ...OFF_TASK,
  ],
  // ── 342 − 168, tens column: LENT and must REGROUP (the double mark) ───────
  'wpb-342-168-c1-decide': [
    { text: "I can't take six from three, so I regroup: two hundreds, thirteen tens", bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording, on the decremented three' },
    { text: "borrow from the three hundred, it's two now and the tens are thirteen", bucket: 'valid-paraphrase', expect: 'affirm', why: 'the move and both numbers, no anchor phrasing' },
    { text: 'four minus six, can\'t, regroup: two hundreds, fourteen tens', bucket: 'wrong-landing', expect: 'refuse', why: 'read the crossed-out four, so the regroup lands on fourteen — the double-mark trap' },
    { text: 'six minus three is three', bucket: 'flipped-column', expect: 'refuse', why: 'the flip; the plan gate makes it a different digit from seven' },
    { text: 'I regroup, thirteen', bucket: 'forgot-decrement', expect: 'refuse', why: 'the hundreds never change' },
    { text: 'thirteen minus six is seven', bucket: 'forgot-decrement', expect: 'refuse', why: 'skips to the difference; the hundreds were never decremented' },
    { text: 'seven', bucket: 'no-move', expect: 'refuse', why: 'a bare number on a decide step' },
    ...OFF_TASK,
  ],
  // ── 342 − 168, hundreds column: no regroup, on a column that lent ─────────
  'wpb-342-168-c2-decide': [
    { text: 'one', bucket: 'valid-canonical', expect: 'affirm', why: 'two minus one' },
    { text: 'two minus one is one', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the whole column' },
    { text: 'three minus one is two', bucket: 'forgot-decrement', expect: 'refuse', why: 'read the crossed-out three' },
    { text: 'two', bucket: 'forgot-decrement', expect: 'refuse', why: 'the same error, bare' },
    ...OFF_TASK,
  ],
  // ── 75 − 32, ones column: no regroup, nothing lent ────────────────────────
  'wpb-75-32-c0-decide': [
    { text: 'three', bucket: 'valid-canonical', expect: 'affirm', why: 'five minus two' },
    { text: 'five minus two is three', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the whole column' },
    { text: 'no regrouping, three', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the decision named' },
    { text: 'I regroup: fifteen minus two is thirteen', bucket: 'unneeded-regroup', expect: 'refuse', why: 'borrowing where five minus two is clean' },
    { text: 'thirteen', bucket: 'unneeded-regroup', expect: 'refuse', why: 'the result of an unneeded regroup, bare' },
    { text: 'two', bucket: 'wrong-number', expect: 'refuse', why: 'plain wrong' },
    ...OFF_TASK,
  ],
};

/**
 * The harness's answer material for one step: the correct utterance, an
 * unambiguously wrong one, and the signature wrong the contract CLAIMS the
 * judge refuses. Probes ride along by item id where the fixture carries them.
 */
export const workedProcedureHarnessAnswers = (item: WorkedProcedureItem): DiHarnessAnswers => {
  const c = item.column;
  const probes = WORKED_PROCEDURE_BENCH_PROBES[item.id];
  const common = {
    leakTokens: leakTokensFor(item),
    leakExemptSpan: leakExemptSpansFor(item),
    ...(probes ? { probes } : {}),
  };
  if (item.kind === 'decide' && item.regroup) {
    return {
      correct: item.answerSpoken,
      plainWrong: `I regroup: ${w(item.newAbove)} ${item.placeAbove}, ${w(c.effectiveTop + 1)} ${c.place}`,
      signatureWrong: {
        text: `${w(c.bottom)} minus ${w(c.topAfterLend)} is ${w(c.bottom - c.topAfterLend)}`,
        why: 'smaller-from-larger: the column turned upside down — fluent, arithmetically true, and the wrong move',
      },
      ...common,
    };
  }
  if (item.kind === 'decide') {
    const wrong = c.difference === 1 ? c.difference + 1 : c.difference - 1;
    return {
      correct: item.answerSpoken,
      plainWrong: w(wrong),
      signatureWrong: c.lent
        ? {
            text: `${w(c.top)} minus ${w(c.bottom)} is ${w(c.top - c.bottom)}`,
            why: 'forgot-to-decrement: read the crossed-out digit instead of the one written above it',
          }
        : {
            text: `I regroup: ${w(c.topAfterLend + 10)} minus ${w(c.bottom)} is ${w(c.topAfterLend + 10 - c.bottom)}`,
            why: 'regroup-when-not-needed: borrowing on a column that subtracts cleanly',
          },
      ...common,
    };
  }
  const wrong = c.difference === 1 ? c.difference + 1 : c.difference - 1;
  return {
    correct: `${columnPhrase(item)} is ${w(c.difference)}`,
    plainWrong: w(wrong),
    signatureWrong: {
      text: w(c.bottom - c.topAfterLend),
      why: 'the digits subtracted the wrong way round — a different digit by the plan gate',
    },
    ...common,
  };
};
