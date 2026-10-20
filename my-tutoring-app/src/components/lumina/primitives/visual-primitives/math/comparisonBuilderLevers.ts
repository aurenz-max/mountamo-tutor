/**
 * The in-item levers on comparison-builder, every mode, as one lever set (`bossLevers.ts`; `/add-support-tiers`,
 * handoff 21 M2; table qa/support-levers/m2-lever-tables-2026-09-28.md). No real-learner evidence: the misses are what
 * `comparisonMiss` observes, plus the documented struggles (judging groups by spread, < and > confused, counting on
 * from the wrong number). Declared in the order the tutor reaches for them.
 *
 * compare_groups — which side has more IS the answer, so the help acts on a model outside the item or on the
 * learner's own counting, never on the item's pairing (LEV-CB-1: live match lines leaked it).
 * - `model_match` (model): a small model with two rows of dots the item does not use, matched in pairs, the extras
 *   ringed. When it comes is the set's `support` (by the lesson's tier).
 * - `tap_count` (marks): tapping an object stamps its running count on that side. Counts only what was tapped.
 * - `far_groups` (easier): an ungraded pair, both at most 6 and 3 or more apart, sharing no count with the item.
 * compare_numbers
 * - `quantity_marks` (marks): under each numeral, its amount as ten-sticks and dots, drawn alike on both sides.
 * - `far_numbers` (easier): an ungraded pair 5 or more apart, sharing no number with the item.
 * order
 * - `slot_steps` (marks): a bar under each slot that grows (or shrinks) in the building direction. Never a card.
 * - `quantity_marks` (marks): each card shows its amount as ten-sticks and dots. No rank.
 * - `three_far` (easier): three cards 3 or more apart, none of the item's numbers (R3: never a subset).
 * one_more_less
 * - `learner_hops` (marks): the target cell reads 0 and each cell from the target to the learner's own pick reads its
 *   hop count. Nothing is drawn beyond the learner's pick.
 * - `single_small` (easier): one "one more" ask on a target of 5 or less whose neighbours are not the item's.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { ComparisonBuilderChallenge } from './ComparisonBuilder';
import { COMPARISON_MISSES } from './comparisonBuilder.card';
import { COMPARISON_MODE, ownNumbers, type ComparisonItem } from './comparisonBuilderWorkspace';

export const MATCH_LEVER = 'model_match';
export const TAP_LEVER = 'tap_count';
export const FAR_GROUPS_LEVER = 'far_groups';
export const MARKS_LEVER = 'quantity_marks';
export const FAR_NUMBERS_LEVER = 'far_numbers';
export const STEPS_LEVER = 'slot_steps';
export const THREE_FAR_LEVER = 'three_far';
export const HOPS_LEVER = 'learner_hops';
export const SMALL_LEVER = 'single_small';

export type Band = 'K' | '1';
const bandMax = (band: Band) => band === 'K' ? 10 : 20;
const simplerId = (c: ComparisonBuilderChallenge) => `${c.id}~simpler`;

// ── Models and builders ──────────────────────────────────────────────────────

const MODEL_PAIRS: ReadonlyArray<readonly [number, number]> = [[5, 3], [4, 2], [6, 4], [3, 1], [7, 5], [5, 2], [6, 3]];

/** The model_match rows: bigger first, neither count one the item uses. */
export function modelPair(c: ComparisonBuilderChallenge): readonly [number, number] | null {
  if (c.type !== 'compare-groups') return null;
  const own = ownNumbers(c);
  return MODEL_PAIRS.find(([a, b]) => !own.includes(a) && !own.includes(b)) ?? null;
}

/** An easier groups item: both at most 6, a gap of 3 or more, no count the item uses; null when the item is already that. */
export function farGroups(c: ComparisonBuilderChallenge): ComparisonBuilderChallenge | null {
  if (c.type !== 'compare-groups' || !c.leftGroup || !c.rightGroup) return null;
  const l = c.leftGroup.count, r = c.rightGroup.count;
  if (l !== r && Math.abs(l - r) >= 3 && Math.max(l, r) <= 6) return null;
  for (const [small, big] of [[1, 5], [2, 6], [1, 4], [2, 5], [3, 6], [1, 6]]) {
    if ([l, r].includes(small) || [l, r].includes(big)) continue;
    // The item's side with more is not repeated as a pattern: an item whose left had more gets a smaller left.
    const [left, right] = c.correctAnswer === 'more' ? [small, big] : [big, small];
    return { id: simplerId(c), type: 'compare-groups', instruction: c.instruction,
      leftGroup: { ...c.leftGroup, count: left }, rightGroup: { ...c.rightGroup, count: right },
      correctAnswer: left > right ? 'more' : 'less' };
  }
  return null;
}

/** An easier numbers item: 5 or more apart, in band, no number the item uses; null when the item is already that. */
export function farNumbers(c: ComparisonBuilderChallenge, band: Band): ComparisonBuilderChallenge | null {
  if (c.type !== 'compare-numbers' || c.leftNumber === undefined || c.rightNumber === undefined) return null;
  const l = c.leftNumber, r = c.rightNumber, max = bandMax(band);
  if (l !== r && Math.abs(l - r) >= 5) return null;
  for (const gap of [6, 5, 7]) for (let a = 1; a + gap <= max; a++) {
    const b = a + gap;
    if ([l, r].includes(a) || [l, r].includes(b)) continue;
    const [left, right] = l > r ? [a, b] : [b, a];
    return { id: simplerId(c), type: 'compare-numbers', instruction: c.instruction, leftNumber: left, rightNumber: right,
      correctSymbol: left > right ? '>' : '<' };
  }
  return null;
}

/** An easier order item: three cards 3 or more apart, in band, none of the item's; null when the item is already that. */
export function threeFar(c: ComparisonBuilderChallenge, band: Band): ComparisonBuilderChallenge | null {
  if (c.type !== 'order' || !c.numbers?.length) return null;
  const own = c.numbers, sorted = [...own].sort((a, b) => a - b), max = bandMax(band);
  if (own.length === 3 && sorted[1] - sorted[0] >= 3 && sorted[2] - sorted[1] >= 3) return null;
  for (let a = 1; a <= max; a++) for (let b = a + 3; b <= max; b++) for (let d = b + 3; d <= max; d++) {
    if ([a, b, d].some(n => own.includes(n))) continue;
    return { id: simplerId(c), type: 'order', instruction: c.instruction, numbers: [b, d, a], direction: c.direction };
  }
  return null;
}

/** An easier one-more item: one "one more" ask on a target of 5 or less, clear of the item's target and neighbours. */
export function singleSmall(c: ComparisonBuilderChallenge): ComparisonBuilderChallenge | null {
  if (c.type !== 'one-more-one-less' || c.targetNumber === undefined) return null;
  const t = c.targetNumber, ask = c.askFor ?? 'both';
  if (ask === 'one-more' && t <= 5) return null;
  const near = [t - 1, t, t + 1];
  const next = [3, 4, 2, 5, 1].find(n => !near.includes(n) && !near.includes(n + 1));
  return next === undefined ? null
    : { id: simplerId(c), type: 'one-more-one-less', instruction: c.instruction, targetNumber: next, askFor: 'one-more' };
}

/** The easier challenge a simplify lever opens on this challenge, if there is one. */
export function simplerItem(c: ComparisonBuilderChallenge, band: Band): ComparisonBuilderChallenge | null {
  switch (c.type) {
    case 'compare-groups': return farGroups(c);
    case 'compare-numbers': return farNumbers(c, band);
    case 'order': return threeFar(c, band);
    default: return singleSmall(c);
  }
}

/** The practice item a simplify lever opens, run as the lesson runs its items (band and tier carried over). */
export function practiceItem(c: ComparisonItem): ComparisonItem | null {
  const easier = simplerItem(c, c.band ?? 'K');
  return easier ? { ...easier, band: c.band ?? 'K', ...(c.tier ? { tier: c.tier } : {}) } : null;
}

// ── Render helpers (pure, so the leak rules are testable) ───────────────────

/** A number as ten-sticks and loose dots. */
export const quantityParts = (n: number) => ({ tens: Math.floor(Math.max(0, n) / 10), ones: Math.max(0, n) % 10 });

/** One slot bar height per slot, growing in the building direction. Heights only; no card is named. */
export const slotSteps = (slots: number, direction: 'ascending' | 'descending' | undefined) =>
  Array.from({ length: slots }, (_, i) => 6 + 4 * (direction === 'descending' ? slots - 1 - i : i));

/** The hop count shown on each cell: 0 on the target, then 1, 2, ... up to the learner's own pick and never past it. */
export function hopLabels(target: number, pick: number | null): Map<number, number> {
  const labels = new Map<number, number>([[target, 0]]);
  if (pick === null || pick === target) return labels;
  const step = pick > target ? 1 : -1;
  for (let i = target + step; i !== pick + step; i += step) labels.set(i, Math.abs(i - target));
  return labels;
}

// ── The lever set ────────────────────────────────────────────────────────────

/** What the screen holds that a lever's words read: the objects the learner has tapped on each side. */
export interface ComparisonLeverContext { tapped: { left: number; right: number } }

const RELATION_MISSES = COMPARISON_MISSES.compare_groups;
const EASIER_DOES = 'It is not graded; the full item comes back after it.';

export const COMPARISON_LEVERS = leverSet<ComparisonItem, ComparisonLeverContext>({
  modeOf: c => COMPARISON_MODE[c.type],
  missesOf: mode => COMPARISON_MISSES[mode as keyof typeof COMPARISON_MISSES] ?? [],
  support: { tier: c => c.tier ?? 'medium', different: 'a different pair of groups, matched one to one',
    own: 'which group has more' },
  specs: [
    { id: MATCH_LEVER, type: 'model', modes: ['compare_groups'], answers: RELATION_MISSES,
      when: 'The learner judges the groups by how they look, not by matching or counting.',
      does: 'Shows a small model beside the groups: two rows of dots, a different pair, joined in pairs with the extra dots ringed.',
      content: modelPair,
      fact: (pair: readonly [number, number]) =>
        `A model beside the groups shows ${pair[0]} dots and ${pair[1]} dots joined in pairs, the ${pair[0] - pair[1]} extra ringed.` },
    { id: TAP_LEVER, type: 'marks', modes: ['compare_groups'], carrier: 'both', answers: RELATION_MISSES,
      when: 'The learner loses track while counting the groups.',
      does: 'Lets the learner tap each object; a tapped object shows its count on its side. Nothing is counted for them.',
      fact: (_on: unknown, _c: ComparisonItem, { tapped }: ComparisonLeverContext) =>
        `Each object the learner taps shows its count. Tapped so far: ${tapped.left} on the left, ${tapped.right} on the right.` },
    { id: FAR_GROUPS_LEVER, type: 'easier', modes: ['compare_groups'], carrier: 'shown', answers: ['reversed', 'said_equal'],
      when: 'These two groups are too close to compare yet.',
      does: `Opens an easier pair of groups first, small and far apart. ${EASIER_DOES}`,
      content: practiceItem },
    { id: MARKS_LEVER, type: 'marks', modes: ['compare_numbers'], answers: COMPARISON_MISSES.compare_numbers,
      when: 'The learner does not see how big each written number is.',
      does: 'Shows each number\'s amount under it as sticks of ten and dots, drawn the same way on both sides.',
      fact: 'Each number shows its amount under it as sticks of ten and dots.' },
    { id: FAR_NUMBERS_LEVER, type: 'easier', modes: ['compare_numbers'], carrier: 'shown', answers: ['reversed', 'said_equal'],
      when: 'These two numbers are too close to compare yet.',
      does: `Opens an easier pair of numbers first, far apart. ${EASIER_DOES}`,
      content: practiceItem },
    { id: STEPS_LEVER, type: 'marks', modes: ['order'], answers: ['reversed'],
      when: 'The learner builds the order the wrong way round.',
      does: 'Puts a bar under each slot that grows in the direction the numbers go. It names no number.',
      fact: 'Each slot has a bar under it that grows in the direction the numbers go.' },
    { id: MARKS_LEVER, type: 'marks', modes: ['order'], answers: ['two_swapped', 'other_order'],
      when: 'The learner mixes up which numbers are bigger.',
      does: 'Shows each card\'s amount on it as sticks of ten and dots.',
      fact: 'Each card shows its amount as sticks of ten and dots.' },
    { id: THREE_FAR_LEVER, type: 'easier', modes: ['order'], carrier: 'shown', answers: ['two_swapped', 'other_order'],
      when: 'There are too many numbers, or they are too close, to order yet.',
      does: `Opens an easier set first: three numbers far apart, none of these. ${EASIER_DOES}`,
      content: practiceItem },
    { id: HOPS_LEVER, type: 'marks', modes: ['one_more_less'], answers: COMPARISON_MISSES.one_more_less,
      when: 'The learner does not step one number from the target, or steps the wrong way.',
      does: 'Marks the target 0 and numbers the hops from the target to the learner\'s own pick. Nothing past their pick.',
      fact: 'The target cell reads 0 and the cells up to the learner\'s own pick show their hop count.' },
    { id: SMALL_LEVER, type: 'easier', modes: ['one_more_less'], carrier: 'shown', answers: ['wrong_way', 'short_by_more', 'over_by_more'],
      when: 'Both directions, or this big a number, is too much yet.',
      does: `Opens an easier ask first: one more than a small number. ${EASIER_DOES}`,
      content: practiceItem },
  ],
});
