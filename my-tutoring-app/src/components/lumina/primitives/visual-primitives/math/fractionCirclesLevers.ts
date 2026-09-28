/**
 * The in-item levers on fraction-circles (`/add-support-tiers`, handoff 18 B2).
 *
 * Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule.
 * From the failure inventory (qa/eval-reports/fraction-circles-levers-2026-09-27.md):
 * - `mark_pieces` (help, identify): bold edges and one dot in every piece, shaded or not. Answers
 *   "miscounts the pieces". Leak rule: no digits, and every piece gets the same mark.
 * - `part_whole` (help, identify/build): a fraction frame under the circle, a picture of a shaded
 *   part over a picture of the whole circle. Answers "swaps the numbers", "counts the unshaded".
 *   Leak rule: pictures only, no digits.
 * - `running_count` (help, build/equivalent): how many slices the learner has shaded. Answers "loses
 *   count". Leak rule: the learner's own shading only. Easy (and no tier) starts with it pulled.
 * - `split_reference` (help, equivalent): each reference slice cut into k thinner slices, lines only.
 *   Leak rule: no digits, the learner's circle untouched; not offered when k is not a whole number.
 * - `overlay` (help, compare): the left circle's shaded part outlined on the right circle.
 *   Leak rule: an outline only; nothing names the larger side.
 * - Simplify (a new, ungraded item of the same mode; never the learner's item or its value):
 *   `fewer_pieces` (identify), `unit_build` (build), `double_split` (equivalent), `far_pair` (compare).
 *   `two_pictures` (touch_fraction) lives with the touch items (`twoPictureItem`).
 * Every builder is deterministic, so the live journey can rebuild the easier item from its parent.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { FractionCirclesChallenge } from './FractionCircles';

export const PIECES_LEVER = 'mark_pieces';
export const FRAME_LEVER = 'part_whole';
export const COUNT_LEVER = 'running_count';
export const SPLIT_LEVER = 'split_reference';
export const OVERLAY_LEVER = 'overlay';
export const FEWER_LEVER = 'fewer_pieces';
export const UNIT_LEVER = 'unit_build';
export const DOUBLE_LEVER = 'double_split';
export const FAR_LEVER = 'far_pair';
export const TWO_PICTURES_LEVER = 'two_pictures';

/** The generator's denominator pools (`gemini-fraction-circles.ts` GRADE_BAND_DENOMINATORS). */
const BAND_DENOMINATORS: Record<string, readonly number[]> = { 'K-2': [2, 3, 4], '3-5': [2, 3, 4, 5, 6, 8, 10, 12] };
const bandDenominators = (band?: string) => BAND_DENOMINATORS[band ?? ''] ?? BAND_DENOMINATORS['3-5'];
const same = (a: number, b: number, c: number, d: number) => a * d === b * c;

/** How many thinner slices each reference slice splits into, or null when the split is not whole. */
export function splitFactor(ch: FractionCirclesChallenge): number | null {
  const e = ch.equivalentDenominator;
  return ch.type === 'equivalent' && e && e > ch.denominator && e % ch.denominator === 0 ? e / ch.denominator : null;
}

/** Identify with fewer pieces: 2-4 slices, a different amount. Null when the item already has 2. */
export function fewerPieces(ch: FractionCirclesChallenge): FractionCirclesChallenge | null {
  if (ch.type !== 'identify' || ch.denominator <= 2) return null;
  const d = ch.denominator >= 5 ? 4 : ch.denominator - 1;
  const n = Array.from({ length: d - 1 }, (_, i) => i + 1).find(k => !same(k, d, ch.numerator, ch.denominator));
  if (!n) return null;
  return { ...ch, id: `${ch.id}~fewer`, numerator: n, denominator: d,
    instruction: 'What fraction of the circle is shaded?', narration: 'What fraction of the circle is shaded?' };
}

/** Build one slice of the same circle first. Null when the item is already one slice. */
export function unitBuild(ch: FractionCirclesChallenge): FractionCirclesChallenge | null {
  if (ch.type !== 'build' || ch.numerator <= 1) return null;
  const instruction = `Shade the circle to show 1/${ch.denominator}.`;
  return { ...ch, id: `${ch.id}~unit`, numerator: 1, instruction, narration: instruction };
}

/** An equivalent where the build circle has exactly twice the reference's slices, a different amount. */
export function doubleSplit(ch: FractionCirclesChallenge, band?: string): FractionCirclesChallenge | null {
  if (ch.type !== 'equivalent' || ch.equivalentDenominator === 2 * ch.denominator) return null;
  const ceiling = Math.max(...bandDenominators(band));
  const pick = ([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]] as const)
    .find(([n, d]) => 2 * d <= ceiling && !same(n, d, ch.numerator, ch.denominator));
  if (!pick) return null;
  const [n, d] = pick;
  const instruction = `Build a fraction equivalent to ${n}/${d} using ${2 * d} equal slices.`;
  return { ...ch, id: `${ch.id}~double`, numerator: n, denominator: d, equivalentDenominator: 2 * d, instruction, narration: instruction };
}

/** A compare pair far apart in value (at least 0.4), unlike the learner's pair. Null when theirs is already far. */
export function farPair(ch: FractionCirclesChallenge, band?: string): FractionCirclesChallenge | null {
  const cmp = ch.compareFraction;
  if (ch.type !== 'compare' || !cmp) return null;
  if (Math.abs(ch.numerator / ch.denominator - cmp.numerator / cmp.denominator) >= 0.4) return null;
  const legal = bandDenominators(band);
  const pairs = [[[1, 4], [3, 4]], [[3, 4], [1, 3]], [[1, 4], [2, 3]], [[5, 6], [1, 6]], [[1, 8], [7, 8]]] as const;
  const hit = pairs.find(([[a, b], [c, d]]) => legal.includes(b) && legal.includes(d)
    && !(same(a, b, ch.numerator, ch.denominator) && same(c, d, cmp.numerator, cmp.denominator))
    && !(same(a, b, cmp.numerator, cmp.denominator) && same(c, d, ch.numerator, ch.denominator)));
  if (!hit) return null;
  const [[a, b], [c, d]] = hit;
  const instruction = `Which is larger: ${a}/${b} or ${c}/${d}?`;
  return { ...ch, id: `${ch.id}~far`, numerator: a, denominator: b, compareFraction: { numerator: c, denominator: d },
    instruction, narration: instruction };
}

/** The easier item a simplify lever opens for `ch`, or null. */
export function simplerItem(ch: FractionCirclesChallenge, band?: string): FractionCirclesChallenge | null {
  switch (ch.type) {
    case 'identify': return fewerPieces(ch);
    case 'build': return unitBuild(ch);
    case 'equivalent': return doubleSplit(ch, band);
    case 'compare': return farPair(ch, band);
    default: return null;
  }
}

/** The lever pulled at the start from the generator's tier, never a runtime pull. */
export function startLevers(ch: FractionCirclesChallenge | null): string[] {
  if (!ch) return [];
  if ((ch.type === 'build' || ch.type === 'equivalent') && ch.showWorkingCount !== false) return [COUNT_LEVER];
  return ch.startLevers?.filter(id => id === PIECES_LEVER) ?? [];
}

/**
 * The misses (`fractionMiss`) each lever answers, per mode. The observer pulls the first open lever that lists
 * the learner's miss (`nextLever`): a count one off gets the running count; a count further off gets the
 * reference split (equivalent) or the easier item; a mix-up of part and whole gets the part-whole frame.
 */
const LEVER_ANSWERS: Record<string, Record<string, readonly string[]>> = {
  identify: {
    [PIECES_LEVER]: ['bottom_not_pieces', 'top_one_off', 'top_off_by_more'],
    [FRAME_LEVER]: ['swapped', 'top_is_unshaded', 'not_a_fraction'],
    [FEWER_LEVER]: ['bottom_not_pieces', 'top_off_by_more'],
  },
  build: {
    [COUNT_LEVER]: ['one_short', 'one_over', 'short_by_more', 'over_by_more'],
    [FRAME_LEVER]: ['shaded_all', 'shaded_the_rest'],
    [UNIT_LEVER]: ['short_by_more', 'over_by_more', 'shaded_all', 'shaded_the_rest'],
  },
  equivalent: {
    [COUNT_LEVER]: ['one_short', 'one_over'],
    [SPLIT_LEVER]: ['copied_the_count', 'short_by_more', 'over_by_more'],
    [DOUBLE_LEVER]: ['copied_the_count', 'short_by_more', 'over_by_more'],
  },
  compare: {
    [OVERLAY_LEVER]: ['picked_more_slices', 'picked_smaller', 'said_equal', 'missed_equal'],
    [FAR_LEVER]: ['picked_more_slices', 'picked_smaller'],
  },
};
const leverAnswers = (type: string, id: string): readonly string[] | undefined => LEVER_ANSWERS[type]?.[id];

export function fractionLevers(ch: FractionCirclesChallenge | null, pulled: readonly string[], band?: string): WorkspaceLever[] {
  if (!ch) return [];
  const lever = (id: string, kind: 'help' | 'simplify', carrier: WorkspaceLever['carrier'], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier, when, does, pulled: pulled.includes(id), answers: leverAnswers(ch.type, id) });
  const levers: WorkspaceLever[] = [];
  const simpler = simplerItem(ch, band);
  const frame = lever(FRAME_LEVER, 'help', 'both',
    'The learner swaps the top and bottom numbers, or counts the unshaded pieces.',
    'Draws a fraction frame under the circle: a picture of a shaded part over a picture of the whole circle. No numbers, and no count of pieces.');
  const count = lever(COUNT_LEVER, 'help', 'both', 'The learner loses count while shading: one too many or one too few.',
    'Shows under the circle how many slices the learner has shaded so far. Never the number to shade.');
  switch (ch.type) {
    case 'identify':
      levers.push(lever(PIECES_LEVER, 'help', 'shown', 'The learner miscounts the pieces of the circle.',
        'Draws every slice edge in bold and puts one dot in every piece, shaded or not, so each piece can be counted once. No numbers.'), frame);
      if (simpler) levers.push(lever(FEWER_LEVER, 'simplify', 'shown', 'The learner cannot name a fraction with this many pieces yet.',
        'Opens an easier circle first, with fewer pieces. It is not graded; the full item comes back after it.'));
      break;
    case 'build':
      levers.push(count, frame);
      if (simpler) levers.push(lever(UNIT_LEVER, 'simplify', 'shown', 'The learner cannot shade several pieces for a fraction yet.',
        'Opens an easier build first: shade one slice of the same circle. It is not graded; the full item comes back after it.'));
      break;
    case 'equivalent':
      levers.push(count);
      if (splitFactor(ch)) levers.push(lever(SPLIT_LEVER, 'help', 'shown',
        'The learner cannot see how the reference circle matches a circle with more slices.',
        'Cuts every slice of the reference circle into thinner slices with lines, the same size as the slices of the circle to shade. No numbers.'));
      if (simpler) levers.push(lever(DOUBLE_LEVER, 'simplify', 'shown', 'The learner cannot build an equal fraction with this many slices yet.',
        'Opens an easier item first, where the circle to shade has exactly twice as many slices. It is not graded; the full item comes back after it.'));
      break;
    case 'compare':
      levers.push(lever(OVERLAY_LEVER, 'help', 'shown',
        'The learner judges by the numbers, for example thinks more slices means more, instead of the shaded amount.',
        "Outlines the left circle's shaded part on the right circle, so the two shaded amounts can be seen against each other."));
      if (simpler) levers.push(lever(FAR_LEVER, 'simplify', 'shown', 'The two amounts are too close for the learner to tell apart yet.',
        'Opens an easier comparison first, two amounts far apart. It is not graded; the full item comes back after it.'));
      break;
  }
  return levers;
}

/** What a pulled help lever put on screen, as the tutor and the observer read it. Never the answer. */
export function leverFacts(ch: FractionCirclesChallenge, pulled: readonly string[]): string[] {
  const on = (id: string) => pulled.includes(id);
  const facts: string[] = [];
  if (ch.type === 'identify' && on(PIECES_LEVER)) facts.push('Every slice edge is bold and every piece, shaded or not, has one dot.');
  if ((ch.type === 'identify' || ch.type === 'build') && on(FRAME_LEVER))
    // Never "one shaded piece": on a unit fraction that is the count to shade (replay RP-1, contract R5).
    facts.push('A fraction frame is under the circle: a picture of the shaded part on top, a picture of the whole circle below.');
  if (ch.type === 'equivalent' && on(SPLIT_LEVER) && splitFactor(ch))
    facts.push('Each slice of the reference circle is cut by lines into thinner slices the same size as the slices to shade.');
  if (ch.type === 'compare' && on(OVERLAY_LEVER)) facts.push("The left circle's shaded part is outlined on the right circle.");
  return facts;
}

/**
 * What a wrong Check shows (`TeachingAttempt.miss`), from the learner's own work on the circle. Only the
 * observable pattern; why the learner did it is the tutor's and the distiller's to judge.
 * - identify (typed n/d): `not_a_fraction`; `swapped` (the piece count on top, the shaded count below);
 *   `bottom_not_pieces` (the bottom is not the circle's piece count); `top_is_unshaded` (the top is the
 *   unshaded count); `top_one_off` / `top_off_by_more`.
 * - build (slices shaded): `shaded_all`; `shaded_the_rest` (the unshaded count shaded instead);
 *   `one_short` / `one_over` / `short_by_more` / `over_by_more`.
 * - equivalent (slices shaded on the finer circle): `copied_the_count` (the reference's shaded count shaded
 *   again); then the four count misses.
 * - compare: `picked_more_slices` (the smaller amount, on the circle with more slices); `picked_smaller`;
 *   `said_equal` (they are not); `missed_equal` (a side picked when they are equal).
 * Undefined for a right answer or a touch item (`touchMiss`).
 */
export type FractionMiss = 'not_a_fraction' | 'swapped' | 'bottom_not_pieces' | 'top_is_unshaded' | 'top_one_off'
  | 'top_off_by_more' | 'shaded_all' | 'shaded_the_rest' | 'copied_the_count' | 'one_short' | 'one_over'
  | 'short_by_more' | 'over_by_more' | 'picked_more_slices' | 'picked_smaller' | 'said_equal' | 'missed_equal';

const countMiss = (shaded: number, target: number): FractionMiss | undefined => {
  const off = shaded - target;
  if (off === 0) return undefined;
  return off === -1 ? 'one_short' : off === 1 ? 'one_over' : off < 0 ? 'short_by_more' : 'over_by_more';
};

export function fractionMiss(ch: FractionCirclesChallenge | null,
  work: { typed: string; shaded: number; choice: string }): FractionMiss | undefined {
  if (!ch) return undefined;
  const { numerator: n, denominator: d } = ch;
  switch (ch.type) {
    case 'identify': {
      const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(work.typed);
      if (!match) return 'not_a_fraction';
      const top = Number(match[1]), bottom = Number(match[2]);
      if (bottom > 0 && same(top, bottom, n, d)) return undefined;
      if (top === d && bottom === n) return 'swapped';
      if (bottom !== d) return 'bottom_not_pieces';
      if (top === d - n) return 'top_is_unshaded';
      return Math.abs(top - n) === 1 ? 'top_one_off' : 'top_off_by_more';
    }
    case 'build':
      if (work.shaded === n) return undefined;
      if (work.shaded === d) return 'shaded_all';
      if (work.shaded === d - n) return 'shaded_the_rest';
      return countMiss(work.shaded, n);
    case 'equivalent': {
      const e = ch.equivalentDenominator;
      if (!e || same(work.shaded, e, n, d)) return undefined;
      if (work.shaded === n) return 'copied_the_count';
      return countMiss(work.shaded, n * e / d);
    }
    case 'compare': {
      const cmp = ch.compareFraction;
      if (!cmp) return undefined;
      const diff = n / d - cmp.numerator / cmp.denominator;
      const key = Math.abs(diff) < 0.001 ? 'equal' : diff > 0 ? 'left' : 'right';
      if (work.choice === key) return undefined;
      if (key === 'equal') return 'missed_equal';
      if (work.choice === 'equal') return 'said_equal';
      const pickedSlices = work.choice === 'left' ? d : cmp.denominator, otherSlices = work.choice === 'left' ? cmp.denominator : d;
      return pickedSlices > otherSlices ? 'picked_more_slices' : 'picked_smaller';
    }
    default: return undefined;
  }
}

/** Leak rule shared by every drawn help lever: a lever label never carries a digit. */
export const leverTextLeaks = (text: string) => /\d/.test(text);
