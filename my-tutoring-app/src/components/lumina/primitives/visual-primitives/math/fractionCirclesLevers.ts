/**
 * The in-item levers on fraction-circles (`/add-support-tiers`, handoff 18 B2).
 *
 * Declared once as a lever set (`FRACTION_CIRCLES_LEVERS`, `bossLevers.ts`); the component draws a pulled lever and
 * calls `declare`/`onScreen`/`simpler`. From the failure inventory (qa/eval-reports/fraction-circles-levers-2026-09-27.md):
 * - `mark_pieces` (marks, identify): bold edges and one dot in every piece, shaded or not. Answers "miscounts the
 *   pieces". Leak rule: no digits, and every piece gets the same mark.
 * - `part_whole` (clue, identify/build): a fraction frame under the circle, a picture of a shaded part over a picture
 *   of the whole circle. Answers "swaps the numbers", "counts the unshaded". Leak rule: pictures only, no digits.
 * - `running_count` (marks, build/equivalent/build_equal): how many slices the learner has shaded (build_equal: how
 *   many pieces they cut and shaded). Answers "loses count". Leak rule: the learner's own work only. Easy (and no
 *   tier) starts with it pulled on build and equivalent.
 * - `split_reference` (marks, equivalent): each reference slice cut into k thinner slices, lines only. Leak rule: no
 *   digits, the learner's circle untouched; not offered when k is not a whole number.
 * - `overlay` (marks, compare): the left circle's shaded part outlined on the right circle. Leak rule: an outline
 *   only; nothing names the larger side.
 * - `show_reference` (layout, build_equal): the target drawn as a circle beside the learner's, which it never touches.
 * - Easier (a new, ungraded item of the same mode; never the learner's item or its value): `fewer_pieces` (identify),
 *   `unit_build` (build), `double_split` (equivalent), `far_pair` (compare), `smaller_target` (build_equal, from
 *   `fractionEqualBuild.ts`), `two_pictures` (touch_fraction, `twoPictureItem`).
 * Every builder is deterministic, so the live journey can rebuild the easier item from its parent.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { FractionCirclesChallenge } from './FractionCircles';
import { smallerTarget } from './fractionEqualBuild';
import { twoPictureItem, type FractionTouchItem } from './fractionCirclesWorkspace';
import { FRACTION_CIRCLES_MISSES_BY_MODE, type FractionCirclesMiss, type FractionCirclesMode, type FractionMiss } from './fractionCircles.card';

export type { FractionMiss, TouchMiss, FractionCirclesMiss } from './fractionCircles.card';

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
export const REFERENCE_LEVER = 'show_reference';
export const SMALLER_TARGET_LEVER = 'smaller_target';

/** One item on screen: a circle challenge, or a touch item with its pictures (the touch surface). */
export type FractionCirclesItem = FractionCirclesChallenge | FractionTouchItem;
/** The lesson context the levers read: the grade band's denominators. */
export interface FractionCirclesCtx { band?: string }

export const isTouchItem = (item: FractionCirclesItem): item is FractionTouchItem => 'challengeType' in item;
export const modeOfItem = (item: FractionCirclesItem): FractionCirclesMode =>
  (isTouchItem(item) ? item.challengeType : item.type);
const circle = (item: FractionCirclesItem) => (isTouchItem(item) ? null : item);

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

/** The easier circle item a simplify lever opens for `ch`, or null (the journey rebuilds practice items with it). */
export function simplerItem(ch: FractionCirclesChallenge, band?: string): FractionCirclesChallenge | null {
  switch (ch.type) {
    case 'identify': return fewerPieces(ch);
    case 'build': return unitBuild(ch);
    case 'equivalent': return doubleSplit(ch, band);
    case 'compare': return farPair(ch, band);
    case 'build_equal': return smallerTarget(ch, band);
    default: return null;
  }
}

/** The lever pulled at the start from the generator's tier, never a runtime pull. */
export function startLevers(ch: FractionCirclesChallenge | null): string[] {
  if (!ch) return [];
  if ((ch.type === 'build' || ch.type === 'equivalent') && ch.showWorkingCount !== false) return [COUNT_LEVER];
  return ch.startLevers?.filter(id => id === PIECES_LEVER) ?? [];
}

// ── the lever set ────────────────────────────────────────────────────────

/**
 * The misses each lever answers, per mode (`fractionMiss`, `equalBuildMiss`). The observer pulls the first open lever
 * that lists the learner's miss (`nextLever`): a count one off gets the running count; a count further off gets the
 * reference split (equivalent) or the easier item; a mix-up of part and whole gets the part-whole frame.
 */
const ANSWERS: Record<string, Partial<Record<FractionCirclesMode, readonly FractionCirclesMiss[]>>> = {
  [PIECES_LEVER]: { identify: ['bottom_not_pieces', 'top_one_off', 'top_off_by_more'] },
  [COUNT_LEVER]: {
    build: ['one_short', 'one_over', 'short_by_more', 'over_by_more'],
    equivalent: ['one_short', 'one_over'],
    build_equal: ['one_off'],
  },
  [FRAME_LEVER]: { identify: ['swapped', 'top_is_unshaded', 'not_a_fraction'], build: ['shaded_all', 'shaded_the_rest'] },
  [SPLIT_LEVER]: { equivalent: ['copied_the_count', 'short_by_more', 'over_by_more'] },
  [OVERLAY_LEVER]: { compare: ['picked_more_slices', 'picked_smaller', 'said_equal', 'missed_equal'] },
  [REFERENCE_LEVER]: { build_equal: ['shaded_the_rest', 'cut_cannot_make', 'off_by_more', 'unequal_pieces'] },
  [FEWER_LEVER]: { identify: ['bottom_not_pieces', 'top_off_by_more'] },
  [UNIT_LEVER]: { build: ['short_by_more', 'over_by_more', 'shaded_all', 'shaded_the_rest'] },
  [DOUBLE_LEVER]: { equivalent: ['copied_the_count', 'short_by_more', 'over_by_more'] },
  [FAR_LEVER]: { compare: ['picked_more_slices', 'picked_smaller'] },
  [SMALLER_TARGET_LEVER]: { build_equal: ['same_pieces', 'cut_cannot_make', 'off_by_more', 'unequal_pieces'] },
};
const modesOf = (id: string) => Object.keys(ANSWERS[id]) as FractionCirclesMode[];
const everyMode = (id: string) => Array.from(new Set(Object.values(ANSWERS[id]).flat())) as string[];
const own = (id: string) => (item: FractionCirclesItem) => ANSWERS[id][modeOfItem(item)] ?? [];
/** A help or easier lever offered in the modes its answers list, answering each mode's own misses. */
const listed = (id: string) => ({ id, modes: modesOf(id), answers: everyMode(id), answersOn: own(id) });
const SIMPLER = 'Opens an easier item first';
const UNGRADED = 'It is not graded; the full item comes back after it.';

/**
 * The levers, declared once (`bossLevers.ts`). None is offered on a practice item: the component declares nothing
 * while one is on screen. Spec order is the observer's order within a mode (help first, then the easier item).
 */
export const FRACTION_CIRCLES_LEVERS = leverSet<FractionCirclesItem, FractionCirclesCtx>({
  modeOf: modeOfItem,
  missesOf: mode => FRACTION_CIRCLES_MISSES_BY_MODE[mode as FractionCirclesMode] ?? [],
  // The fraction a `part_whole` frame must never write: the item's own.
  answersOf: item => (isTouchItem(item) ? [] : [`${item.numerator}/${item.denominator}`]),
  specs: [
    { ...listed(PIECES_LEVER), type: 'marks',
      when: 'The learner miscounts the pieces of the circle.',
      does: 'Draws every slice edge in bold and puts one dot in every piece, shaded or not, so each piece can be counted once. No numbers.',
      fact: 'Every slice edge is bold and every piece, shaded or not, has one dot.' },
    { ...listed(COUNT_LEVER), type: 'marks', carrier: 'both',
      when: item => (modeOfItem(item) === 'build_equal'
        ? 'The learner cuts a circle that works but shades one piece too many or too few.'
        : 'The learner loses count while shading: one too many or one too few.'),
      does: item => (modeOfItem(item) === 'build_equal'
        ? 'Shows under the circle how many pieces the learner cut it into and how many they shaded. Never the target, and never whether the two are equal.'
        : 'Shows under the circle how many slices the learner has shaded so far. Never the number to shade.'),
      // On build and equivalent the learner's own count reaches the tutor as their work (`workspaceScene`).
      fact: (_content, item) => (modeOfItem(item) === 'build_equal'
        ? "Under the learner's circle: how many pieces it is cut into and how many are shaded." : '') },
    // Never "one shaded piece": on a unit fraction that is the count to shade (replay RP-1, contract R5).
    { ...listed(FRAME_LEVER), type: 'clue', carrier: 'both',
      when: 'The learner swaps the top and bottom numbers, or counts the unshaded pieces.',
      does: 'Draws a fraction frame under the circle: a picture of a shaded part over a picture of the whole circle. No numbers, and no count of pieces.',
      fact: 'A fraction frame is under the circle: a picture of the shaded part on top, a picture of the whole circle below.' },
    { ...listed(SPLIT_LEVER), type: 'marks',
      when: 'The learner cannot see how the reference circle matches a circle with more slices.',
      does: 'Cuts every slice of the reference circle into thinner slices with lines, the same size as the slices of the circle to shade. No numbers.',
      content: item => { const ch = circle(item); return ch ? splitFactor(ch) : null; },
      fact: 'Each slice of the reference circle is cut by lines into thinner slices the same size as the slices to shade.' },
    { ...listed(OVERLAY_LEVER), type: 'marks',
      when: 'The learner judges by the numbers, for example thinks more slices means more, instead of the shaded amount.',
      does: "Outlines the left circle's shaded part on the right circle, so the two shaded amounts can be seen against each other.",
      fact: "The left circle's shaded part is outlined on the right circle." },
    { ...listed(REFERENCE_LEVER), type: 'layout',
      when: 'The learner shades the wrong amount, shades the part that should stay empty, cuts pieces of different sizes, or picks a cut that cannot make the fraction.',
      does: "Draws the target fraction as a second circle beside the learner's circle, cut into its own pieces with its pieces shaded. The learner's circle is untouched.",
      fact: "A reference circle beside the learner's circle shows the target fraction, cut into its own pieces with its pieces shaded." },
    { ...listed(FEWER_LEVER), type: 'easier',
      when: 'The learner cannot name a fraction with this many pieces yet.',
      does: `${SIMPLER}, a circle with fewer pieces. ${UNGRADED}`,
      content: item => { const ch = circle(item); return ch ? fewerPieces(ch) : null; } },
    { ...listed(UNIT_LEVER), type: 'easier',
      when: 'The learner cannot shade several pieces for a fraction yet.',
      does: `${SIMPLER}: shade one slice of the same circle. ${UNGRADED}`,
      content: item => { const ch = circle(item); return ch ? unitBuild(ch) : null; } },
    { ...listed(DOUBLE_LEVER), type: 'easier',
      when: 'The learner cannot build an equal fraction with this many slices yet.',
      does: `${SIMPLER}, where the circle to shade has exactly twice as many slices. ${UNGRADED}`,
      content: (item, ctx) => { const ch = circle(item); return ch ? doubleSplit(ch, ctx.band) : null; } },
    { ...listed(FAR_LEVER), type: 'easier',
      when: 'The two amounts are too close for the learner to tell apart yet.',
      does: `${SIMPLER}: two amounts far apart. ${UNGRADED}`,
      content: (item, ctx) => { const ch = circle(item); return ch ? farPair(ch, ctx.band) : null; } },
    { ...listed(SMALLER_TARGET_LEVER), type: 'easier',
      when: 'The learner cannot find another way to make this fraction yet.',
      does: `${SIMPLER}: make a fraction with fewer pieces, halves if they fit, your own way. ${UNGRADED}`,
      content: (item, ctx) => { const ch = circle(item); return ch ? smallerTarget(ch, ctx.band) : null; } },
    { id: TWO_PICTURES_LEVER, type: 'easier', modes: ['touch_fraction'], answers: 'all',
      when: 'The learner picks a picture with the right number of parts but the wrong amount shaded, or cannot choose among three.',
      does: `${SIMPLER}: another fraction to touch, two pictures far apart. ${UNGRADED}`,
      // Built from the touch item on screen; a two-picture item is already the easier one.
      content: item => (isTouchItem(item) && item.choices.length >= 3 ? twoPictureItem(item) : null) },
  ],
});

/**
 * What a wrong Check shows (`TeachingAttempt.miss`), from the learner's own work on the circle (the patterns are
 * listed on the card, `FractionMiss`). Undefined for a right answer or a touch item (`touchMiss`).
 */
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
