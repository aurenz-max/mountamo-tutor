/**
 * percent-bar's in-item levers (/add-support-tiers; report qa/eval-reports/percent-bar-levers-2026-10-09.md).
 * The misses are what `percentMiss` observes on the bar or the option tapped; there is no real-learner evidence.
 *
 * - every place step (and the amount step of find_part / find_whole): `tenths` (help) the bar cut into ten equal parts
 *   by unlabelled marks; `fill_names` (help) the filled part of the bar named "the part" and the empty part "the rest of
 *   the whole"; `value_bar` (help, where the session does not already draw it, never on find_part / find_whole, whose
 *   amounts are bracketed on the bar) a second bar under the percent bar in the whole's own units, moving with it,
 *   labelled only at its ends.
 * - discount items (percent_remaining, convert): `discount_model` (help) a picture outside the item: a whole bar with a
 *   piece cut off, captioned what is taken off and what is still paid.
 * - tax/tip items (percent_total): `added_model` (help) a picture outside the item: a whole bar with a piece added past
 *   its end, captioned that the total goes past the whole.
 * - compare items (convert): `compare_model` (help) a picture outside the item: a long price bar with a big piece off
 *   that is still longer than a short price bar with a small piece off.
 * - find_whole (whole_of) items: `part_copies` (help, the amount step only) the filled part's length laid end to end
 *   along the bar by unlabelled marks, so the learner sees how many parts make the whole.
 * - `simpler_problem` (simplify, identify / percent_remaining / percent_total / find_part / find_whole) the same mode on a
 *   friendlier percent, built here. convert has none: a simpler compare either drops a step or removes the trap that
 *   defines it.
 *
 * Mode ids: percent_remaining and percent_total were find_part and find_whole until 10-16 (8.1f); find_part and
 * find_whole are now the part_of and whole_of items, which type an amount.
 *
 * Declared once as a lever set (`PERCENT_LEVERS`, `bossLevers.ts`). The bar levers (value_bar, tenths, fill_names) are
 * not offered on a choice step, which shows no bar; part_copies is offered from the first step and draws on the amount
 * step only. The pictures are `clue` levers: worded hints about this item that never name its numbers.
 *
 * Leak rules (code): no lever text, picture caption or scene fact carries a digit, so none can name a step's percent,
 * a value or a price; the marks are unlabelled; a practice problem has its own id and scenario and no step percent
 * within the tolerance of any of the item's, and keeps the mode.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { PercentBarAmountStep, PercentBarChallenge, PercentBarPlaceStep, PercentBarStep } from './PercentBar';
import { PERCENT_MISSES_BY_MODE, amountTarget, challengeSteps, withinTolerance, type PercentBarMiss } from './percentBarWorkspace';

export const TENTHS_LEVER = 'tenths';
export const FILL_NAMES_LEVER = 'fill_names';
export const VALUE_BAR_LEVER = 'value_bar';
export const DISCOUNT_MODEL_LEVER = 'discount_model';
export const ADDED_MODEL_LEVER = 'added_model';
export const COMPARE_MODEL_LEVER = 'compare_model';
export const PART_COPIES_LEVER = 'part_copies';
export const SIMPLER_LEVER = 'simpler_problem';

const SIMPLER = '~simpler';
export const isPracticePercent = (c: Pick<PercentBarChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');

const BENCHMARKS = [25, 50, 75];
const placeSteps = (c: PercentBarChallenge) => challengeSteps(c).filter((s): s is PercentBarPlaceStep => s.kind === 'place');
const amountSteps = (c: PercentBarChallenge) => challengeSteps(c).filter((s): s is PercentBarAmountStep => s.kind === 'amount');
/** Wholes for a find-whole practice problem: never the item's own whole, which is its answer. */
const PRACTICE_WHOLES = [50, 80, 40, 120, 60, 30, 150];
const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/**
 * The easier practice problem for `c` (same mode, a friendlier percent), or null when the item's percent is already
 * friendly or the mode has none:
 * - identify (direct): a percent that is not on a guide line → 50%, on the same whole;
 * - find_part (subtraction): a remainder that is not on a guide line → 25% off (75% still paid), on the same price;
 * - percent_total (addition): a rate that is not a whole ten → a 10% (or 20%) rate, both steps kept, on the same whole.
 * - find_part (part_of): a percent that is not 10 or 50 → 10% (or 50%) of the same whole.
 * - find_whole (whole_of): a percent that is not 10 or 50 → a part that is 10% (or 50%) of a different whole, since the
 *   item's whole is its answer.
 */
export function simplerPercent(c: PercentBarChallenge): PercentBarChallenge | null {
  if (isPracticePercent(c)) return null;
  const [first] = placeSteps(c);
  if (!first) return null;
  const whole = first.wholeValue, id = `${c.id}${SIMPLER}`;
  const base = { ...c, id, hint: '', wholeValue: whole, wholeValueLabel: first.wholeValueLabel, steps: undefined, maxPercent: undefined };
  let practice: PercentBarChallenge | null = null;
  if (c.type === 'direct') {
    if (BENCHMARKS.includes(first.targetPercent)) return null;
    practice = { ...base, scenario: `Practice first, with the same whole: ${whole} in all.`,
      question: 'Show 50% of it on the bar.', targetPercent: 50 };
  } else if (c.type === 'subtraction') {
    if (BENCHMARKS.includes(first.targetPercent)) return null;
    practice = { ...base, scenario: `Practice first: something costs $${whole} and is 25% off.`,
      question: 'What percent of the original price do you still pay? Show it on the bar.', targetPercent: 75 };
  } else if (c.type === 'addition') {
    const rate = first.targetPercent;
    if (rate % 10 === 0) return null;
    const easy = [10, 20].find(r => !withinTolerance(r, rate))!;
    const added = (first.recapLabel ?? 'fee').toLowerCase();
    const steps: PercentBarStep[] = [
      { ...first, prompt: `Step 1 — the ${added}: what percent of the whole is it? Place it on the bar.`, targetPercent: easy,
        maxPercent: 100, hint: '' },
      { ...(placeSteps(c)[1] ?? first), prompt: `Step 2 — the total: with the ${added} added, the total is what percent of the whole? `
        + 'Place the TOTAL on the bar.', targetPercent: 100 + easy, maxPercent: Math.max(150, placeSteps(c)[1]?.maxPercent ?? 150), hint: '' },
    ];
    practice = { ...base, scenario: `Practice first: the same $${whole}, with a ${easy}% ${added} added.`, question: steps[0].prompt,
      targetPercent: 100 + easy, maxPercent: steps[1].kind === 'place' ? steps[1].maxPercent : 150, steps };
  } else if (c.type === 'part_of' || c.type === 'whole_of') {
    const [amount] = amountSteps(c);
    if (!amount || amount.percent === 10 || amount.percent === 50) return null;
    const easy = [10, 50].find(r => !withinTolerance(r, amount.percent))!;
    const findWhole = c.type === 'whole_of';
    const practiceWhole = findWhole
      ? PRACTICE_WHOLES.find(w => w !== amount.whole && (w * easy) / 100 !== amount.part && w !== amountTarget(amount))
      : amount.whole;
    if (practiceWhole === undefined || (practiceWhole * easy) % 100 !== 0) return null;
    const part = (practiceWhole * easy) / 100;
    if (!findWhole && part === amount.part) return null;
    const label = first.wholeValueLabel;
    const steps: PercentBarStep[] = findWhole ? [
      { kind: 'place', prompt: `Step 1 — the $${part} is ${easy}% of the whole. Mark ${easy}% on the bar.`, wholeValue: practiceWhole,
        wholeValueLabel: label, targetPercent: easy, maxPercent: 100, wholeUnknown: true, knownPart: part, hint: '' },
      { kind: 'amount', prompt: 'Step 2 — the whole bar is 100%. How many dollars is the whole? Type the amount.', percent: easy,
        whole: practiceWhole, part, unknown: 'whole', wholeValueLabel: label, hint: '' },
    ] : [
      { kind: 'place', prompt: `Step 1 — mark ${easy}% on the bar. The whole bar is the $${practiceWhole}.`, wholeValue: practiceWhole,
        wholeValueLabel: label, targetPercent: easy, maxPercent: 100, hint: '' },
      { kind: 'amount', prompt: `Step 2 — how many dollars is ${easy}% of $${practiceWhole}? Type the amount.`, percent: easy,
        whole: practiceWhole, part, unknown: 'part', wholeValueLabel: label, hint: '' },
    ];
    practice = { ...base, wholeValue: practiceWhole, steps, question: steps[0].prompt, targetPercent: easy,
      scenario: findWhole ? `Practice first: $${part} is ${easy}% of a whole.` : `Practice first, with the same whole: $${practiceWhole}.` };
  }
  return practice && !practiceLeaks(c, practice) ? practice : null;
}

/** Leak rule for a practice problem: never the learner's item (its id, its scenario), no step percent near one of the
 *  item's, and the same mode. */
export function practiceLeaks(parent: PercentBarChallenge, practice: PercentBarChallenge): boolean {
  if (practice.id === parent.id || practice.scenario === parent.scenario || practice.type !== parent.type) return true;
  const theirs = placeSteps(parent).map(s => s.targetPercent);
  const theirAmounts = amountSteps(parent).map(amountTarget);
  return placeSteps(practice).some(s => theirs.some(t => withinTolerance(s.targetPercent, t)))
    || amountSteps(practice).some(s => theirAmounts.includes(amountTarget(s)))
    || challengeSteps(practice).length !== challengeSteps(parent).length;
}

// ── the lever set ────────────────────────────────────────────────────────

export interface PercentLeverContext {
  /** The session already draws the second bar in the whole's units (a starting position). */
  valueBarShown: boolean;
  /** The step on screen: the bar levers are not offered on a choice step, which shows no bar. */
  step?: PercentBarStep['kind'];
}

/** The eval mode of an item (the catalog's name for its challenge type). */
const MODE_OF: Record<PercentBarChallenge['type'], string> = {
  direct: 'identify_percent', part_of: 'find_part', subtraction: 'percent_remaining', addition: 'percent_total',
  whole_of: 'find_whole', comparison: 'convert',
};
const modeOf = (c: PercentBarChallenge) => MODE_OF[c.type];

const PLACEMENT: readonly PercentBarMiss[] = ['near_miss', 'too_high', 'too_low'];
/** The misses a lever answers, by mode, where they differ by mode; `answers` lists every mode's, `answersOn` the item's. */
const ANSWERS: Record<string, Record<string, readonly PercentBarMiss[]>> = {
  [TENTHS_LEVER]: {
    identify_percent: [...PLACEMENT, 'placed_value'], percent_remaining: [...PLACEMENT, 'placed_value'],
    percent_total: [...PLACEMENT, 'placed_value'], convert: [...PLACEMENT, 'placed_value'],
    find_part: [...PLACEMENT, 'placed_value', 'tenth_only', 'percent_as_amount'],
    find_whole: [...PLACEMENT, 'placed_value', 'percent_as_amount', 'part_times_ten'],
  },
  [FILL_NAMES_LEVER]: {
    identify_percent: ['complement'], percent_remaining: ['placed_discount'], convert: ['placed_discount'],
    percent_total: ['rate_not_total'], find_part: ['complement', 'rest_not_part'], find_whole: ['complement', 'rest_not_whole'],
  },
  [SIMPLER_LEVER]: {
    identify_percent: [...PLACEMENT, 'complement'], percent_remaining: [...PLACEMENT, 'placed_discount'],
    percent_total: [...PLACEMENT, 'rate_not_total', 'whole_only', 'took_off_rate'],
    find_part: [...PLACEMENT, 'rest_not_part', 'percent_as_amount', 'tenth_only'],
    find_whole: [...PLACEMENT, 'percent_of_part', 'part_times_ten', 'rest_not_whole', 'part_as_whole'],
  },
};
const everyMode = (id: string) => Array.from(new Set(Object.values(ANSWERS[id]).flat()));
const own = (id: string) => (c: PercentBarChallenge) => ANSWERS[id][modeOf(c)] ?? [];
/** None is offered on a practice problem (the component declares nothing while one is on screen). */
const notPractice = (c: PercentBarChallenge) => !isPracticePercent(c);
/** The bar levers draw on the bar: offered on a step that shows one. */
const onBar = (c: PercentBarChallenge, ctx: PercentLeverContext) => notPractice(c) && ctx?.step !== 'choice';
const AMOUNT_TYPES: readonly PercentBarChallenge['type'][] = ['part_of', 'whole_of'];

/** The levers, declared once (`bossLevers.ts`). The context is what the session already draws and the step on screen. */
export const PERCENT_LEVERS = leverSet<PercentBarChallenge, PercentLeverContext>({
  modeOf,
  missesOf: mode => PERCENT_MISSES_BY_MODE[mode] ?? [],
  answersOf: c => itemKeys(c),
  specs: [
    // find_part / find_whole draw the amounts as brackets on the bar and fix it on the amount step: no value bar.
    { id: VALUE_BAR_LEVER, type: 'layout', modes: ['identify_percent', 'percent_remaining', 'percent_total', 'convert'],
      answers: ['placed_value'], offer: (c, ctx) => onBar(c, ctx) && !ctx?.valueBarShown,
      when: 'The learner sets the bar to the value (dollars, points) instead of the percent.',
      does: 'Draws a second bar under the percent bar, in the whole\'s own units, that moves with it; it is labelled only at '
        + 'its ends, zero and the whole. No value or percent is written.',
      fact: 'Under the percent bar is a second bar in the whole\'s units, moving with it, labelled only at zero and the whole.' },
    { id: TENTHS_LEVER, type: 'marks', answers: everyMode(TENTHS_LEVER), answersOn: own(TENTHS_LEVER), offer: onBar,
      when: 'The learner cannot find where a percent sits on the bar, or lands near it.',
      does: 'Cuts the bar into ten equal parts with unlabelled marks, each a tenth of the whole. No number is written.',
      fact: 'The bar is cut into ten equal parts by unlabelled marks.' },
    { id: FILL_NAMES_LEVER, type: 'marks', answers: everyMode(FILL_NAMES_LEVER), answersOn: own(FILL_NAMES_LEVER), offer: onBar,
      when: c => (c.type === 'direct' ? 'The learner sets the bar to the rest of the whole instead of the part.'
        : AMOUNT_TYPES.includes(c.type) ? 'The learner marks or types the rest of the whole instead of the part.'
          : 'The learner places the wrong part of the whole.'),
      does: 'Names the parts of the bar in words: the filled part from the left is "the part", the empty part is "the rest of the '
        + 'whole". No number is written.',
      fact: 'The filled part of the bar is named "the part" and the empty part "the rest of the whole".' },
    { id: DISCOUNT_MODEL_LEVER, type: 'clue', modes: ['percent_remaining', 'convert'], answers: ['placed_discount'], offer: notPractice,
      when: 'The learner places the discount instead of what is still paid.',
      does: 'Shows a picture outside the item: a whole bar with a piece cut off, captioned "taken off" on the piece and "still '
        + 'paid" on the rest. Read the caption aloud; it uses none of the item\'s numbers.',
      fact: 'Beside the bar is a picture outside the item: a whole bar with a piece cut off, captioned taken off and still paid.' },
    { id: ADDED_MODEL_LEVER, type: 'clue', modes: ['percent_total'], answers: ['rate_not_total', 'whole_only', 'took_off_rate'],
      offer: notPractice,
      when: 'The learner places only the added rate, only the whole, or takes the rate off.',
      does: 'Shows a picture outside the item: a whole bar with a piece added past its end line, captioned "the whole" and '
        + '"added on top", so the total ends past the whole. Read the caption aloud; it uses none of the item\'s numbers.',
      fact: 'Beside the bar is a picture outside the item: a whole bar with a piece added past its end, captioned the whole '
        + 'and added on top.' },
    { id: COMPARE_MODEL_LEVER, type: 'clue', modes: ['convert'], answers: ['bigger_discount', 'other_price'], offer: notPractice,
      when: 'The learner picks by the bigger percent off, or the other option, instead of comparing the prices found.',
      does: 'Shows a picture outside the item: a long price bar with a big piece off that is still longer than a short price '
        + 'bar with a small piece off, captioned "compare what is still paid". It uses none of the item\'s numbers.',
      fact: 'Beside the options is a picture outside the item: a long price bar with a big piece off still longer than a short '
        + 'one with a small piece off, captioned compare what is still paid.' },
    // Offered from the first step (journey sweep J9 reads the levers at mount); it draws on the amount step only.
    { id: PART_COPIES_LEVER, type: 'marks', modes: ['find_whole'],
      answers: ['percent_of_part', 'part_times_ten', 'rest_not_whole', 'part_as_whole'], offer: notPractice,
      when: 'On the amount step, the learner cannot get from the part to the whole.',
      does: 'Lays the filled part\'s length end to end along the bar with unlabelled marks, so the learner can count how many '
        + 'parts fill the whole bar (the last may be a piece of one). No number is written. Works on the amount step only.',
      fact: 'On the amount step, the filled part\'s length is laid end to end along the bar by unlabelled marks.' },
    // convert has none: a simpler compare either drops a step or removes the trap that defines it.
    { id: SIMPLER_LEVER, type: 'easier', modes: Object.keys(ANSWERS[SIMPLER_LEVER]), answers: everyMode(SIMPLER_LEVER),
      answersOn: own(SIMPLER_LEVER), content: c => simplerPercent(c),
      when: 'This percent is too hard to place yet.',
      does: c => `Opens an easier problem of the same kind first, on a percent that sits on a guide line or a whole ten${
        c.type === 'whole_of' ? ', with another whole' : ', with the same whole'}. It is not graded; the full item comes back after it.` },
  ],
});

/** Leak rule for the levers' words and captions: no digit at all (every key is a number or a price). */
export const leverTextLeaks = (text: string) => /\d/.test(text);

/** Every number a step of the item answers with (percents and the option prices), for the tests' leak checks. */
export const itemKeys = (c: PercentBarChallenge) => [
  ...placeSteps(c).flatMap(s => [String(s.targetPercent), money((s.targetPercent / 100) * s.wholeValue)]),
  ...amountSteps(c).map(s => money(amountTarget(s))),
];
