/**
 * The in-item levers on number-sequencer `order_cards`, the one mode answered with the hands (`/add-support-tiers`,
 * handoff 21 M2; table qa/support-levers/m2-lever-tables-2026-09-28.md). The five spoken modes' levers are in
 * `numberSequencerSpokenLevers.ts`; all of them are one lever set here (`NUMBER_SEQUENCER_LEVERS`).
 * No real-learner evidence: the misses are what `orderMiss` observes.
 *
 * - `train_steps` (help): wordless bars over the empty places that grow from the first place to the last (the train
 *   always runs smallest to largest). Answers `reversed`. The direction only; never a card.
 * - `card_marks` (help): each card shows its amount as sticks of ten and dots. Answers `two_swapped`, `other_order`.
 *   Offered only when every card is 100 or less, where the marks stay countable. No rank.
 * - `three_cards` (simplify): an ungraded order of three cards 3 or more apart, none of the item's, near its range and
 *   laid out so no card sits in its place (contract R9); then the full item. Answers `two_swapped`, `other_order`.
 *   Offered only when the item has more than three cards or two within 2 of each other.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { sequencerItemsForChallenge, sequencerModeOf, type SequencerItem } from './numberSequencerDomain';
import { numberSequencerCard } from './numberSequencer.card';
import { CAR_MARKS_LEVER, MODEL_TRAIN_LEVER, SMALLER_LEVER, STEP_ARROW_LEVER, modelTrain, smallerNumbers, stepArrow, stepPhrase }
  from './numberSequencerSpokenLevers';

export const STEPS_LEVER = 'train_steps';
export const MARKS_LEVER = 'card_marks';
export const THREE_LEVER = 'three_cards';

/** A number as sticks of ten and loose dots. */
export const quantityParts = (n: number) => ({ tens: Math.floor(n / 10), ones: n % 10 });

/** Bar heights over the places, left to right: the train always grows from smallest to largest. */
export const trainSteps = (places: number) => Array.from({ length: places }, (_, i) => 6 + 4 * i);

/**
 * The easier order, or null when the item already is three cards far apart (or no set fits). Searched from 9 below
 * the item's range to 9 above it, never past the band's ceiling (20 at K unless the item already goes higher, else 100).
 */
export function threeCards(item: SequencerItem | null, band: 'K' | '1' = '1'): SequencerItem | null {
  if (item?.challengeType !== 'order-cards') return null;
  const own = item.answerOrder;
  const gaps = own.slice(1).map((n, i) => n - own[i]);
  if (own.length === 3 && gaps.every(g => g >= 3)) return null;
  const ceiling = Math.max(item.rangeMax, band === 'K' ? 20 : 100);
  const lo = Math.max(1, item.rangeMin - 9), hi = Math.min(ceiling, item.rangeMax + 9);
  for (let a = lo; a <= hi; a++) for (let b = a + 3; b <= hi; b++) for (let c = b + 3; c <= hi; c++) {
    if ([a, b, c].some(n => own.includes(n))) continue;
    // Laid out middle, largest, smallest: no card in its place, and no run of neighbours.
    const built = sequencerItemsForChallenge({ id: `${item.sourceId}~simpler`, type: 'order-cards', instruction: '',
      sequence: [b, c, a], correctAnswers: [a, b, c], rangeMin: a, rangeMax: c })[0];
    if (built) return { ...built, id: `${item.id}~simpler` };
  }
  return null;
}

/** The lesson context the lever set reads: the session's items and the grade band. */
export interface SequencerLeverContext { session: readonly SequencerItem[]; band: 'K' | '1' }

const ORDER = ['order_cards'];
const STEP_KINDS = ['count_from', 'before_after', 'fill_missing', 'decade_fill'];
const GAPS = ['fill_missing', 'decade_fill'];
const COUNTS = ['count_from', 'before_after'];
const SOUND_ALIKE = ['teen_ty_swap', 'decade_word'];

const arrowSpec = (modes: string[], answers: string[]) => ({
  id: STEP_ARROW_LEVER, type: 'marks' as const, carrier: 'both' as const, modes, answers,
  when: 'The learner says a number already on the train, goes the wrong way, or takes the wrong size of step.',
  does: 'Puts an arrow on the car beside the glowing one, pointing at it and marked with the size of one step.',
  content: (item: SequencerItem) => stepArrow(item),
  fact: (arrow: { step: number }) => `An arrow on the printed car beside the glowing car points at it, marked ${stepPhrase(arrow.step)}.`,
});
const carMarksSpec = (modes: string[], answers: string[]) => ({
  id: CAR_MARKS_LEVER, type: 'marks' as const, modes, answers,
  when: 'The learner mixes up a teen and a -ty number, says "twenty-ten", or is far off.',
  does: 'Shows each printed car\'s amount on it as sticks of ten and dots. Empty cars show none.',
  offer: (item: SequencerItem) => item.rangeMax <= 100,
  fact: 'Each printed car shows its amount as sticks of ten and dots; the empty cars show none.',
});
const smallerSpec = (modes: string[], answers: string[]) => ({
  id: SMALLER_LEVER, type: 'easier' as const, carrier: 'shown' as const, modes, answers,
  when: 'These numbers are too big to work with yet.',
  does: 'Opens an easier train first: the same pattern with smaller numbers, one gap. It is not graded; the full item comes back after it.',
  content: (item: SequencerItem, ctx: SequencerLeverContext) => smallerNumbers(item, ctx.session),
});

/**
 * The levers over all six modes, as one lever set (`bossLevers.ts`). order_cards: the growing bars, the card marks, an
 * easier train of three cards. The four gap and count modes: the step arrow, the car marks, a smaller train (its
 * misses differ by mode, so each has a spec per mode group). spot_error: the model train.
 */
export const NUMBER_SEQUENCER_LEVERS = leverSet<SequencerItem, SequencerLeverContext>({
  modeOf: sequencerModeOf,
  missesOf: mode => numberSequencerCard.modes[mode].misses,
  // The model train shows a different train, solved (its odd number circled); the lesson's tier says when.
  support: { tier: item => item.supportTier ?? 'medium', different: 'a model train with different numbers',
    own: 'which number on this train does not belong' },
  specs: [
    { id: STEPS_LEVER, type: 'marks', modes: ORDER, answers: ['reversed'],
      when: 'The learner builds the train from the wrong end.',
      does: 'Shows bars over the empty places that grow from the first place to the last. They name no card.',
      fact: 'Bars over the places grow from the first place to the last.' },
    { id: MARKS_LEVER, type: 'marks', modes: ORDER, answers: ['two_swapped', 'other_order'],
      when: 'The learner mixes up which numbers are bigger.',
      does: 'Shows each card\'s amount on it as sticks of ten and dots.',
      offer: item => item.answerOrder.every(n => n <= 100),
      fact: 'Each card shows its amount as sticks of ten and dots.' },
    { id: THREE_LEVER, type: 'easier', carrier: 'shown', modes: ORDER, answers: ['two_swapped', 'other_order'],
      when: 'There are too many cards, or they are too close, to order yet.',
      does: 'Opens an easier train first: three cards far apart, none of these. It is not graded; the full item comes back after it.',
      content: (item, ctx) => threeCards(item, ctx.band) },
    arrowSpec(['count_from'], ['said_start', 'wrong_direction', 'skipped_one']),
    arrowSpec(['before_after'], ['said_shown', 'wrong_side', 'skipped_one']),
    arrowSpec(GAPS, ['said_neighbor', 'counted_by_one', 'one_short', 'one_over']),
    carMarksSpec(COUNTS, SOUND_ALIKE),
    carMarksSpec(GAPS, [...SOUND_ALIKE, 'short_by_more', 'over_by_more']),
    { id: MODEL_TRAIN_LEVER, type: 'model', modes: ['spot_error'], answers: ['said_repair', 'said_neighbor'],
      when: 'The learner says the number that should be there, or one that belongs, instead of the printed one that does not.',
      does: 'Shows a model train with different numbers below this one, its number that does not belong circled.',
      content: item => modelTrain(item),
      fact: 'Below the train, a model train with different numbers has its number that does not belong circled. It shares no number with this train.' },
    smallerSpec(COUNTS, SOUND_ALIKE),
    smallerSpec(GAPS, [...SOUND_ALIKE, 'short_by_more', 'over_by_more']),
  ],
});
