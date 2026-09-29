/**
 * The in-item levers on number-sequencer `order_cards`, the one mode answered with the hands (`/add-support-tiers`,
 * handoff 21 M2; table qa/support-levers/m2-lever-tables-2026-09-28.md). The five spoken modes are a later slice.
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
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { sequencerItemsForChallenge, type SequencerItem } from './numberSequencerDomain';

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

export function sequencerLevers(item: SequencerItem | null, pulled: readonly string[], band: 'K' | '1' = '1'): WorkspaceLever[] {
  if (item?.challengeType !== 'order-cards') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: string[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  return [
    lever(STEPS_LEVER, 'help', ['reversed'], 'The learner builds the train from the wrong end.',
      'Shows bars over the empty places that grow from the first place to the last. They name no card.'),
    ...(item.answerOrder.every(n => n <= 100) ? [lever(MARKS_LEVER, 'help', ['two_swapped', 'other_order'],
      'The learner mixes up which numbers are bigger.', 'Shows each card\'s amount on it as sticks of ten and dots.')] : []),
    ...(threeCards(item, band) ? [lever(THREE_LEVER, 'simplify', ['two_swapped', 'other_order'],
      'There are too many cards, or they are too close, to order yet.',
      'Opens an easier train first: three cards far apart, none of these. It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What the pulled levers put on screen, as a scene fact. Never a card's place. */
export function leverFacts(item: SequencerItem | null, pulled: readonly string[]): string {
  if (item?.challengeType !== 'order-cards') return '';
  return [
    pulled.includes(STEPS_LEVER) && 'Bars over the places grow from the first place to the last.',
    pulled.includes(MARKS_LEVER) && 'Each card shows its amount as sticks of ten and dots.',
  ].filter((s): s is string => !!s).join(' ');
}
