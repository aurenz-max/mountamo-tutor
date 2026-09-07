/**
 * deductionBench — the scored answer key for the `deduction` response class,
 * plus the drive harness's answer material for di-deduction (design brief
 * 2026-09-07, "DI for Older Learners", concept 3).
 *
 * WHAT IS DIFFERENT ABOUT THIS CLASS
 * ----------------------------------
 * `concept_statement` hands the judge an IDEA; `procedure_step` hands it a
 * MOVE. This class hands it a DEDUCTION — a VERDICT plus the REASON that
 * reaches it from a rule — judged on meaning. Three things the buckets are
 * built around:
 *
 *   1. THE SIGNATURE ERROR IS A CONFIDENT YES. "Yes, because it lays eggs" on
 *      a `cannot_tell` case is fluent, cites the rule, and is wrong: the rule
 *      does not run backwards. A judge grading "did they use the rule" affirms
 *      it. `affirmed-consequent` is that bucket, and it must be zero-false-
 *      affirm before the class is anything but build-ahead.
 *   2. A VERDICT WITH NO REASON IS HALF AN ANSWER. "No" on a `deny` case is the
 *      right verdict; the ask was "how do you know?". `verdict-no-reason`
 *      refuses it — and refuses "no, because it's a spider", a reason that
 *      never touches the rule. The mirror is the short form the contract MUST
 *      accept: "nope, eight legs" carries the whole deduction.
 *   3. THE ECHO IS THE RULE READ BACK. "All insects have six legs" is true and
 *      answers nothing about the beetle. `echo` covers the rule and the case
 *      said back.
 *
 * `wrong-verdict` is the plain wrong direction: "yes" or "can't tell" on a
 * deny, "no" on a cannot_tell, "not an insect" on a conclude.
 * `adjacent-concept` (shared with concept_statement) is a TRUE fact about the
 * subject that the rule does not say — "a beetle is black" — the bucket for a
 * judge that affirms a true sentence for being true.
 *
 * WHY THE RULES ARE HAND-PICKED
 * -----------------------------
 * Each fixture rule exists for a shape the generator must handle: a rule with
 * NO lookalike (insects / six legs) builds no cannot_tell case at all — the
 * plan refuses it rather than shipping a vague reason — and two rules with
 * real, checkable lookalikes (birds / lay eggs → turtle; fish / live in water
 * → whale) carry the class's whole point. Every fact here was checked by eye
 * as a grade-3 text would state it. AUDIT THE KEY BEFORE BELIEVING ANY FINDING
 * THAT INDICTS THE TUTOR (the `zell` lesson).
 *
 * WHAT THIS BENCH CANNOT ANSWER
 * -----------------------------
 * The harness sends TEXT. It drives the judge's SEMANTICS and never the mic:
 * whether a nine-year-old's "no, because insects have six legs and it's got
 * eight" ARRIVES intact is the mic row (HUMAN-CHECKS #141).
 */

import type { OpenSetProbe } from './openSetWordBench';
import type { DiHarnessAnswers } from './diDrivePlan';
import { withArticle } from '../../../primitives/visual-primitives/direct-instruction/diDeductionPlan';
import {
  leakExemptSpansFor,
  leakTokensFor,
  type DeductionItem,
  type DeductionRuleSpec,
} from '../../../primitives/visual-primitives/direct-instruction/diDeductionScript';

/** The fixture rules. Ids are stable; item ids derive from them. */
export const DEDUCTION_BENCH_RULES: DeductionRuleSpec[] = [
  // All insects have six legs. No lookalike a child knows → no cannot_tell
  // case; the rule ships conclude + deny only.
  {
    id: 'ddb-insects',
    category: 'insect',
    categoryPlural: 'insects',
    propertyPlural: 'have six legs',
    propertySingular: 'has six legs',
    propertyNegated: 'does not have six legs',
    kindNoun: 'animal',
    members: ['beetle', 'ant'],
    nonMembers: ['spider', 'snail'],
    lookalikes: [],
  },
  // All birds lay eggs. Lookalike: a turtle lays eggs and is not a bird.
  {
    id: 'ddb-birds',
    category: 'bird',
    categoryPlural: 'birds',
    propertyPlural: 'lay eggs',
    propertySingular: 'lays eggs',
    propertyNegated: 'does not lay eggs',
    kindNoun: 'animal',
    members: ['robin', 'penguin'],
    nonMembers: ['dog', 'cow'],
    lookalikes: ['turtle', 'frog'],
  },
  // All fish live in water. Lookalike: a whale lives in water and is not a fish.
  {
    id: 'ddb-fish',
    category: 'fish',
    categoryPlural: 'fish',
    propertyPlural: 'live in water',
    propertySingular: 'lives in water',
    propertyNegated: 'does not live in water',
    kindNoun: 'animal',
    members: ['shark', 'goldfish'],
    nonMembers: ['camel', 'eagle'],
    lookalikes: ['whale', 'frog'],
  },
];

const OFF_TASK: OpenSetProbe[] = [
  { text: "I don't know", bucket: 'off-task', expect: 'refuse', why: 'not an answer; the correction branch' },
  { text: 'umm', bucket: 'off-task', expect: 'refuse', why: 'a filler noise, no verdict and no reason' },
];

/** Probes keyed by ITEM id — no fallback match: nothing about one case's key
 *  transfers to another case. Mixed-mode ids: c0 = conclude (first member),
 *  c1 = deny (first non-member), c2 = cannot_tell. */
export const DEDUCTION_BENCH_PROBES: Record<string, OpenSetProbe[]> = {
  // ── insects, conclude: "A beetle is an insect." ───────────────────────────
  'ddb-insects-c0-conclude': [
    { text: 'a beetle has six legs', bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording' },
    { text: 'it has six legs', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the conclusion with a pronoun' },
    { text: 'so beetles have six legs too', bucket: 'valid-paraphrase', expect: 'affirm', why: 'plural, "too" — the idea is there' },
    { text: 'um, that it\'s got six legs', bucket: 'valid-childlike', expect: 'affirm', why: 'grammar and hedging are not the skill' },
    { text: 'all insects have six legs', bucket: 'echo', expect: 'refuse', why: 'THE guard: the rule read back says nothing about the beetle' },
    { text: 'a beetle is an insect', bucket: 'echo', expect: 'refuse', why: 'the case read back' },
    { text: 'a beetle is not an insect', bucket: 'wrong-verdict', expect: 'refuse', why: 'contradicts the case' },
    { text: 'you can\'t tell', bucket: 'wrong-verdict', expect: 'refuse', why: 'the rule DOES tell you here — the over-learned "can\'t tell"' },
    { text: 'a beetle is black and shiny', bucket: 'adjacent-concept', expect: 'refuse', why: 'true, and not what the rule says' },
    ...OFF_TASK,
  ],
  // ── insects, deny: "A spider does not have six legs." ─────────────────────
  'ddb-insects-c1-deny': [
    { text: 'no, because all insects have six legs and a spider does not', bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording' },
    { text: 'it\'s not an insect. insects have six legs and it doesn\'t', bucket: 'valid-paraphrase', expect: 'affirm', why: 'verdict and reason, no anchor phrasing' },
    { text: 'nope, no six legs', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the short form the contract must accept' },
    { text: 'it\'s got eight legs so it\'s not one', bucket: 'valid-childlike', expect: 'affirm', why: 'the handoff\'s own example: a full answer in a child\'s words' },
    { text: 'yes, it is an insect', bucket: 'wrong-verdict', expect: 'refuse', why: 'the wrong direction' },
    { text: 'can\'t tell', bucket: 'wrong-verdict', expect: 'refuse', why: 'the rule DOES tell you: it lacks what every insect has' },
    { text: 'maybe, the rule doesn\'t say', bucket: 'wrong-verdict', expect: 'refuse', why: 'the same error, with a false reason' },
    { text: 'no', bucket: 'verdict-no-reason', expect: 'refuse', why: 'the right verdict and no reason — the ask was "how do you know?"' },
    { text: 'no, because it\'s a spider', bucket: 'verdict-no-reason', expect: 'refuse', why: 'a reason that never touches the rule' },
    { text: 'no, spiders are arachnids', bucket: 'verdict-no-reason', expect: 'refuse', why: 'true, from outside the rule — the reason the rule gives is missing' },
    { text: 'all insects have six legs', bucket: 'echo', expect: 'refuse', why: 'the rule read back' },
    { text: 'a spider has eight legs', bucket: 'adjacent-concept', expect: 'refuse', soft: true, why: 'the reason with no verdict — a defensible half; recorded, not counted' },
    ...OFF_TASK,
  ],
  // ── birds, cannot_tell: "This animal lays eggs." ──────────────────────────
  'ddb-birds-c2-cannot_tell': [
    { text: 'can\'t tell, because other things lay eggs too', bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording' },
    { text: 'maybe. lots of animals lay eggs, not just birds', bucket: 'valid-paraphrase', expect: 'affirm', why: '"maybe" plus the reason' },
    { text: 'the rule doesn\'t say only birds lay eggs, so you can\'t know', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the reason stated first' },
    { text: 'um, it might be a bird but it might not, like a turtle lays eggs and it\'s not a bird', bucket: 'valid-childlike', expect: 'affirm', why: 'a child\'s own counterexample' },
    { text: 'no, because other stuff lays eggs too', bucket: 'valid-paraphrase', expect: 'affirm', soft: true, why: 'a "no" carrying the can\'t-tell reason — the contract accepts it; soft because the verdict word is off' },
    { text: 'yes, because it lays eggs', bucket: 'affirmed-consequent', expect: 'refuse', why: 'THE signature error: fluent, cites the rule, wrong — the rule does not run backwards' },
    { text: 'yes, it\'s a bird. all birds lay eggs', bucket: 'affirmed-consequent', expect: 'refuse', why: 'the same error with the rule quoted' },
    { text: 'it\'s a bird', bucket: 'affirmed-consequent', expect: 'refuse', why: 'the confident yes, bare' },
    { text: 'no, it\'s not a bird', bucket: 'wrong-verdict', expect: 'refuse', why: 'a confident no is as wrong as a confident yes' },
    { text: 'no, because it\'s probably a lizard', bucket: 'wrong-verdict', expect: 'refuse', why: 'a guess dressed as a reason' },
    { text: 'can\'t tell', bucket: 'verdict-no-reason', expect: 'refuse', why: 'the right verdict and no reason' },
    { text: 'maybe', bucket: 'verdict-no-reason', expect: 'refuse', why: 'the same, in the DI word' },
    { text: 'all birds lay eggs', bucket: 'echo', expect: 'refuse', why: 'the rule read back' },
    ...OFF_TASK,
  ],
  // ── fish, conclude: "A shark is a fish." ──────────────────────────────────
  'ddb-fish-c0-conclude': [
    { text: 'a shark lives in water', bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording' },
    { text: 'it lives in the water', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the conclusion with an article slipped in' },
    { text: 'sharks live in water', bucket: 'valid-paraphrase', expect: 'affirm', why: 'plural' },
    { text: 'all fish live in water', bucket: 'echo', expect: 'refuse', why: 'the rule read back' },
    { text: 'a shark has sharp teeth', bucket: 'adjacent-concept', expect: 'refuse', why: 'true, and not what the rule says' },
    { text: 'a shark is not a fish', bucket: 'wrong-verdict', expect: 'refuse', why: 'contradicts the case' },
    ...OFF_TASK,
  ],
  // ── fish, deny: "A camel does not live in water." ─────────────────────────
  'ddb-fish-c1-deny': [
    { text: 'no, because all fish live in water and a camel does not', bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording' },
    { text: 'not a fish, it doesn\'t live in water', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the short form' },
    { text: 'nope, camels live in the desert, not in water', bucket: 'valid-childlike', expect: 'affirm', why: 'the reason in a child\'s words — it connects to the property' },
    { text: 'yes, a camel is a fish', bucket: 'wrong-verdict', expect: 'refuse', why: 'the wrong direction' },
    { text: 'can\'t tell', bucket: 'wrong-verdict', expect: 'refuse', why: 'the rule does tell you' },
    { text: 'no', bucket: 'verdict-no-reason', expect: 'refuse', why: 'no reason' },
    { text: 'no, because camels have humps', bucket: 'verdict-no-reason', expect: 'refuse', why: 'a true reason from outside the rule' },
    ...OFF_TASK,
  ],
  // ── fish, cannot_tell: "This animal lives in water." ──────────────────────
  'ddb-fish-c2-cannot_tell': [
    { text: 'can\'t tell, because other things live in water too', bucket: 'valid-canonical', expect: 'affirm', why: 'the anchor wording' },
    { text: 'maybe, whales live in water and they\'re not fish', bucket: 'valid-paraphrase', expect: 'affirm', why: 'a counterexample as the reason' },
    { text: 'just because it lives in water doesn\'t make it a fish', bucket: 'valid-paraphrase', expect: 'affirm', why: 'the reasoning without a verdict word — the idea IS the verdict' },
    { text: 'yes, it\'s a fish because it lives in water', bucket: 'affirmed-consequent', expect: 'refuse', why: 'THE signature error' },
    { text: 'a fish', bucket: 'affirmed-consequent', expect: 'refuse', why: 'the confident yes, bare' },
    { text: 'no, it\'s a whale', bucket: 'wrong-verdict', expect: 'refuse', why: 'a guess at the animal; the rule cannot tell either way' },
    { text: 'maybe', bucket: 'verdict-no-reason', expect: 'refuse', why: 'the right verdict, no reason' },
    { text: 'all fish live in water', bucket: 'echo', expect: 'refuse', why: 'the rule read back' },
    ...OFF_TASK,
  ],
};

/**
 * The harness's answer material for one case: the correct utterance, an
 * unambiguously wrong one, and the signature wrong the contract CLAIMS the
 * judge refuses. Probes ride along by item id where the fixture carries them.
 */
export const deductionHarnessAnswers = (item: DeductionItem): DiHarnessAnswers => {
  const r = item.rule;
  const s = item.case.subject;
  const cat = withArticle(r.category);
  const probes = DEDUCTION_BENCH_PROBES[item.id];
  const common = {
    leakTokens: leakTokensFor(item),
    leakExemptSpan: leakExemptSpansFor(item),
    ...(probes ? { probes } : {}),
  };
  if (item.shape === 'conclude') {
    return {
      correct: item.answerSpoken,
      plainWrong: `${s} is not ${cat}`,
      signatureWrong: {
        text: `all ${r.categoryPlural} ${r.propertyPlural}`,
        why: 'the echo: the rule read back — true, and no conclusion about the case',
      },
      ...common,
    };
  }
  if (item.shape === 'deny') {
    return {
      correct: item.answerSpoken,
      plainWrong: `yes, ${s} is ${cat}`,
      signatureWrong: {
        text: 'no',
        why: 'the right verdict with no reason — half an answer; the ask was "how do you know?"',
      },
      ...common,
    };
  }
  return {
    correct: item.answerSpoken,
    plainWrong: `no, ${s} is not ${cat}`,
    signatureWrong: {
      text: `yes, because it ${r.propertySingular}`,
      why: 'affirming the consequent: fluent, cites the rule, and wrong — the rule does not run backwards',
    },
    ...common,
  };
};
